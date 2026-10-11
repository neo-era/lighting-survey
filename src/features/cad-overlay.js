// CAD nền — nhập DXF (kiểm tra/tự sửa), offset + hiệu chỉnh 2 điểm, sửa vị trí text, cắm mốc RTK, đo khoảng cách, lớp CAD
// Tách từ index.html (đợt 3 module hoá, v175) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ ("</script><script src=…><script>") nên thứ tự chạy lúc nạp giữ nguyên.
// Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau. Thêm code CHẠY LÚC NẠP phải rà lại.

        // ═══════════════════════════════════════════════════════════════════
        // T19 — DXF Pre-flight Validation V1 (blocker + warning + info)
        // ═══════════════════════════════════════════════════════════════════

        function _validateDxf(entities, bounds, layers) {
            const blockers = [], warnings = [], infos = [];

            if (!entities || entities.length === 0) {
                blockers.push({ msg: 'DXF không có entity hỗ trợ (LINE/POLYLINE/CIRCLE/TEXT)', hint: 'Kiểm tra file gốc có content không.' });
                return { blockers, warnings, infos };
            }

            const w = bounds ? Math.abs(bounds.maxX - bounds.minX) : 0;
            const h = bounds ? Math.abs(bounds.maxY - bounds.minY) : 0;
            const maxDim = Math.max(w, h);

            // BLOCKER: coord range > 1 triệu km
            if (maxDim > 1e9) {
                blockers.push({
                    msg: `Coord range vô lý: ${(maxDim / 1e6).toFixed(0)} triệu km — file hỏng hoặc datum sai`,
                    hint: 'Mở lại trong AutoCAD → Save As DXF R2013 ASCII'
                });
            }

            // WARNING: đơn vị
            if (maxDim > 1e8) {
                warnings.push({
                    msg: `Nghi đơn vị = MILIMET (bounds ${maxDim.toExponential(1)}) — cần chia 1000 để về met`,
                    fixKey: 'unit_mm'
                });
            } else if (maxDim > 0 && maxDim < 1000) {
                warnings.push({
                    msg: `Nghi đơn vị = KILOMET (bounds ${maxDim.toFixed(1)}) — cần nhân 1000 để về met`,
                    fixKey: 'unit_km'
                });
            }

            // WARNING: bounds quá rộng
            if (w > 100000 || h > 100000) {
                warnings.push({
                    msg: `Bounds > 100km (${(w / 1000).toFixed(0)}km × ${(h / 1000).toFixed(0)}km) — có thể sai zone hoặc mix múi`,
                    fixKey: null
                });
            }

            // WARNING: chỉ Layer 0
            const nonDefaultLayers = (layers || []).filter(l => l && l !== '0');
            if (layers && layers.length === 1 && (layers[0] === '0' || !layers[0])) {
                warnings.push({
                    msg: `Toàn bộ entity trên Layer "0" — không theo chuẩn LIGHTING_POLE/CABLE`,
                    fixKey: 'layer_map'
                });
            }

            // INFO: entity count thấp
            if (entities.length < 10) {
                infos.push({ msg: `Chỉ ${entities.length} entity — file có thể chưa đầy đủ` });
            }

            // INFO: không có Layer LIGHTING_*
            if (nonDefaultLayers.length > 0 && !nonDefaultLayers.some(l => /LIGHTING|POLE|CABLE|LAMP|CS_/i.test(l))) {
                infos.push({ msg: 'Không có Layer LIGHTING_* — không detect được trụ độc lập theo tên layer' });
            }

            // INFO: entity types breakdown
            const byType = {};
            entities.forEach(e => { byType[e.type || '?'] = (byType[e.type || '?'] || 0) + 1; });
            const typesStr = Object.entries(byType).map(([t, n]) => `${t}:${n}`).join(' · ');
            infos.push({ msg: `${entities.length} entities · ${nonDefaultLayers.length} custom layers · ${typesStr}` });

            return { blockers, warnings, infos };
        }
        window._validateDxf = _validateDxf;

        // ── P44: Auto-fix helpers ────────────────────────────────────
        // Layer mapping dictionary (regex → target chuẩn LIGHTING_*)
        const LAYER_MAP = [
            { re: /(^|\W)(đèn|den|pole|cot|c[o0]t|lamp|lighting[-_]?pole)(\W|$)/i, to: 'LIGHTING_POLE' },
            { re: /(^|\W)(c[áa]p|cable|d[âa]y|lighting[-_]?cable)(\W|$)/i,           to: 'LIGHTING_CABLE' },
            { re: /(^|\W)(t[ủu]|cabinet|tủ[-_]?đk|lighting[-_]?cabinet)(\W|$)/i,      to: 'LIGHTING_CABINET' },
            { re: /(^|\W)(text|nh[áa]n|nhan|label|lighting[-_]?text)(\W|$)/i,        to: 'LIGHTING_TEXT' },
        ];

        // Return NEW entities array (deep-clone points) sau khi apply fix.
        // Không mutate input. Return { entities, bounds, layers } đã update.
        function _applyDxfFix(fixKey, entities, bounds, layers) {
            const cloneEnt = e => {
                const c = { ...e };
                if (e.points) c.points = e.points.map(p => ({ ...p }));
                if (e.center) c.center = { ...e.center };
                if (e.position) c.position = { ...e.position };
                return c;
            };

            let out = entities.map(cloneEnt);
            let scale = null;

            if (fixKey === 'unit_mm') scale = 1 / 1000;
            else if (fixKey === 'unit_km') scale = 1000;

            if (scale != null) {
                out.forEach(e => {
                    if (e.points) e.points.forEach(p => { p.x *= scale; p.y *= scale; });
                    if (e.center) { e.center.x *= scale; e.center.y *= scale; if (e.radius) e.radius *= scale; }
                    if (e.position) { e.position.x *= scale; e.position.y *= scale; }
                });
            }

            if (fixKey === 'layer_map') {
                out.forEach(e => {
                    const orig = String(e.layer || '').trim();
                    if (!orig || orig === '0') return;
                    for (const rule of LAYER_MAP) {
                        if (rule.re.test(orig)) {
                            e.layer = rule.to;
                            return;
                        }
                    }
                });
            }

            const newBounds = _computeCadBounds(out);
            const newLayers = [...new Set(out.map(e => e.layer || '0'))];
            return { entities: out, bounds: newBounds, layers: newLayers };
        }
        window._applyDxfFix = _applyDxfFix;

        // Show modal — resolve với object:
        //   { ok: true, entities, bounds, layers }   → tiếp tục upload (có thể đã fix)
        //   { ok: false }                            → user hủy
        // Cho phép user "Sửa tất cả tự động" → apply fixes → re-validate → refresh modal
        function _showDxfPreflightModal(v, entities, bounds, layers) {
            return new Promise(resolve => {
                let curEntities = entities;
                let curBounds = bounds;
                let curLayers = layers;
                let curV = v;

                const modal = document.getElementById('dxfPreflightModal');
                const body = document.getElementById('dxfPreflightBody');
                const footer = document.getElementById('dxfPreflightFooter');

                const sectionHtml = (icon, color, items, withCheckbox = false) =>
                    items.length ? `<div style="border-left:4px solid ${color};padding:8px 12px;margin-bottom:8px;background:${color}15;border-radius:4px;">
                        ${items.map((it, i) => `<div style="margin-bottom:4px;display:flex;gap:6px;align-items:start;">
                            ${withCheckbox && it.fixKey ? `<input type="checkbox" class="dpf-fix-cb" data-fixkey="${_esc(it.fixKey)}" checked style="margin-top:3px;">` : `<span>${icon}</span>`}
                            <div style="flex:1;">
                                ${_esc(it.msg)}${it.hint ? `<br><small style="opacity:.7;">💡 ${_esc(it.hint)}</small>` : ''}
                                ${it.fixKey ? `<br><small style="color:#059669;">🔧 Auto-fix key: <code>${_esc(it.fixKey)}</code></small>` : ''}
                            </div>
                        </div>`).join('')}
                    </div>` : '';

                const render = () => {
                    body.innerHTML =
                        sectionHtml('🚫', '#dc2626', curV.blockers) +
                        sectionHtml('⚠', '#f59e0b', curV.warnings, true) +
                        sectionHtml('ℹ', '#3b82f6', curV.infos);

                    const done = (ok, ret) => {
                        modal.style.display = 'none';
                        resolve(ok ? { ok: true, ...(ret || {}) } : { ok: false });
                    };
                    window._dxfPreflightDone = done;

                    if (curV.blockers.length > 0) {
                        footer.innerHTML = '<button class="ctrl-btn outline" style="flex:1;margin-bottom:0;padding:10px;font-size:13px;" onclick="_dxfPreflightDone(false)">Đóng</button>';
                        return;
                    }

                    const fixables = curV.warnings.filter(w => w.fixKey);
                    let btns = `<button class="ctrl-btn outline" style="flex:1;margin-bottom:0;padding:10px;font-size:12px;" onclick="_dxfPreflightDone(false)">Hủy upload</button>`;
                    if (fixables.length > 0) {
                        btns += `<button class="ctrl-btn primary" style="flex:1;margin-bottom:0;padding:10px;font-size:12px;background:#7c3aed;" onclick="_dpfApplyChecked()">🔧 Áp dụng có chọn lọc</button>`;
                        btns += `<button class="ctrl-btn primary" style="flex:1;margin-bottom:0;padding:10px;font-size:12px;background:#0891b2;" onclick="_dpfApplyAll()">🔧 Sửa tất cả tự động</button>`;
                    }
                    btns += `<button class="ctrl-btn primary" style="flex:1;margin-bottom:0;padding:10px;font-size:12px;background:#059669;" onclick="_dpfContinue()">${curV.warnings.length ? 'Bỏ qua &amp; Upload' : 'Tiếp tục'}</button>`;
                    footer.innerHTML = btns;
                };

                // Apply 1 danh sách fixKey
                const applyFixes = (fixKeys) => {
                    const uniqKeys = [...new Set(fixKeys)];
                    let ent = curEntities, b = curBounds, ly = curLayers;
                    for (const key of uniqKeys) {
                        const r = _applyDxfFix(key, ent, b, ly);
                        ent = r.entities; b = r.bounds; ly = r.layers;
                    }
                    curEntities = ent; curBounds = b; curLayers = ly;
                    curV = _validateDxf(curEntities, curBounds, curLayers);
                    displayInfo && displayInfo(`🔧 Đã áp dụng ${uniqKeys.length} fix: ${uniqKeys.join(', ')}`);
                    // Log
                    try { if (typeof _logAction === 'function') _logAction('dxf_fix', '', '', JSON.stringify({ fixes: uniqKeys })); } catch(e){_swallow(e);}
                    // Nếu no more warnings → auto continue
                    if (curV.blockers.length === 0 && curV.warnings.length === 0) {
                        window._dxfPreflightDone(true, { entities: curEntities, bounds: curBounds, layers: curLayers });
                        return;
                    }
                    render();
                };

                window._dpfApplyAll = () => {
                    const fixKeys = curV.warnings.map(w => w.fixKey).filter(Boolean);
                    if (fixKeys.length === 0) return;
                    applyFixes(fixKeys);
                };
                window._dpfApplyChecked = () => {
                    const checkboxes = body.querySelectorAll('.dpf-fix-cb:checked');
                    const fixKeys = [...checkboxes].map(cb => cb.dataset.fixkey);
                    if (fixKeys.length === 0) {
                        displayError && displayError('Chưa chọn fix nào');
                        return;
                    }
                    applyFixes(fixKeys);
                };
                window._dpfContinue = () => {
                    window._dxfPreflightDone(true, { entities: curEntities, bounds: curBounds, layers: curLayers });
                };

                render();
                modal.style.display = 'flex';
            });
        }
        window._showDxfPreflightModal = _showDxfPreflightModal;

        // ═══════════════════════════════════════════════════════════════════
        // (End T19 Validation V1)
        // ═══════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════
        // T20.5 — Calibrate 2 points: auto-detect dE/dN offset
        // ═══════════════════════════════════════════════════════════════════

        let _calibrateTarget = null;  // 'csv' | 'cad' — nơi apply kết quả
        let _calibrateResult = null;  // { dE, dN, error }

        function _openCalibrateModal(target) {
            _calibrateTarget = target || 'csv';
            _calibrateResult = null;
            // Reset inputs
            ['cal_p1_locE','cal_p1_locN','cal_p1_stdE','cal_p1_stdN',
             'cal_p2_locE','cal_p2_locN','cal_p2_stdE','cal_p2_stdN'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.getElementById('calResult').innerHTML = 'Điền tọa độ 2 điểm rồi bấm "Tính offset"...';
            document.getElementById('calBtnApply').disabled = true;
            document.getElementById('calibrateModal').style.display = 'flex';
        }
        window._openCalibrateModal = _openCalibrateModal;

        function _closeCalibrateModal() {
            document.getElementById('calibrateModal').style.display = 'none';
        }
        window._closeCalibrateModal = _closeCalibrateModal;

        function _calibrateCompute() {
            const get = id => parseFloat((document.getElementById(id) || {}).value);
            const p1 = { locE: get('cal_p1_locE'), locN: get('cal_p1_locN'), stdE: get('cal_p1_stdE'), stdN: get('cal_p1_stdN') };
            const p2 = { locE: get('cal_p2_locE'), locN: get('cal_p2_locN'), stdE: get('cal_p2_stdE'), stdN: get('cal_p2_stdN') };

            for (const k of ['locE','locN','stdE','stdN']) {
                if (!isFinite(p1[k]) || !isFinite(p2[k])) {
                    document.getElementById('calResult').innerHTML = '<span style="color:#dc2626;">⚠ Điền đủ 8 tọa độ.</span>';
                    return;
                }
            }
            const distLocal = Math.hypot(p2.locE - p1.locE, p2.locN - p1.locN);
            if (distLocal < 10) {
                document.getElementById('calResult').innerHTML = `<span style="color:#dc2626;">⚠ 2 điểm quá gần (${distLocal.toFixed(1)}m local). Cần ≥ 100m để đảm bảo chính xác.</span>`;
                return;
            }

            // Compute translation vectors
            // Convention (đối xứng T20 import): local = std + (dE, dN) → std = local - (dE, dN)
            // → dE = local - std cho mỗi point
            const dE1 = p1.locE - p1.stdE;
            const dN1 = p1.locN - p1.stdN;
            const dE2 = p2.locE - p2.stdE;
            const dN2 = p2.locN - p2.stdN;

            const avgDE = (dE1 + dE2) / 2;
            const avgDN = (dN1 + dN2) / 2;

            // Check consistency (should be same for pure translation)
            const errE = Math.abs(dE2 - dE1);
            const errN = Math.abs(dN2 - dN1);
            const err = Math.hypot(errE, errN);

            let msg = `
                <b>Vector điểm 1:</b> ΔE=${dE1.toFixed(3)}, ΔN=${dN1.toFixed(3)}<br>
                <b>Vector điểm 2:</b> ΔE=${dE2.toFixed(3)}, ΔN=${dN2.toFixed(3)}<br>
                <b>Sai lệch:</b> ${err.toFixed(3)}m<br>
                <hr style="margin:6px 0;">
            `;

            if (err < 5) {
                msg += `<span style="color:#059669;font-weight:700;">✅ Pure translation — offset khớp perfect</span><br>`;
                msg += `<b>dE = ${avgDE.toFixed(3)}m, dN = ${avgDN.toFixed(3)}m</b>`;
                _calibrateResult = { dE: avgDE, dN: avgDN, error: err };
                document.getElementById('calBtnApply').disabled = false;
            } else if (err < 30) {
                msg += `<span style="color:#f59e0b;">⚠ Có xoay/scale nhẹ (err ${err.toFixed(1)}m). Dùng translation-only sẽ có sai số.</span><br>`;
                msg += `<b>dE ~ ${avgDE.toFixed(3)}m, dN ~ ${avgDN.toFixed(3)}m</b> (trung bình)`;
                _calibrateResult = { dE: avgDE, dN: avgDN, error: err };
                document.getElementById('calBtnApply').disabled = false;
            } else {
                msg += `<span style="color:#dc2626;">❌ Không phải translation (err ${err.toFixed(1)}m). File dùng affine transform — cần P19 calibration 2 điểm cho CAD.</span>`;
                _calibrateResult = null;
                document.getElementById('calBtnApply').disabled = true;
            }
            document.getElementById('calResult').innerHTML = msg;
        }
        window._calibrateCompute = _calibrateCompute;

        async function _calibrateApply() {
            if (!_calibrateResult) return;
            const { dE, dN } = _calibrateResult;

            // Apply vào input tùy target
            if (_calibrateTarget === 'csv') {
                const inE = document.getElementById('csvOffsetE');
                const inN = document.getElementById('csvOffsetN');
                if (inE) inE.value = dE.toFixed(3);
                if (inN) inN.value = dN.toFixed(3);
                if (typeof _onCsvOffsetChange === 'function') _onCsvOffsetChange();
            } else if (_calibrateTarget === 'cad') {
                const inE = document.getElementById('cgOffsetE');
                const inN = document.getElementById('cgOffsetN');
                if (inE) inE.value = dE.toFixed(3);
                if (inN) inN.value = dN.toFixed(3);
            }

            // Prompt lưu preset
            const name = prompt('Lưu thành preset? Đặt tên (để trống = không lưu):');
            if (name) {
                const region = prompt('Khu vực (tùy chọn):', '') || '';
                // P47: admin có thể chọn shared, ngược lại local
                let mode = 'local';
                if (currentUser && currentUser.role === 'admin') {
                    mode = confirm(`Lưu shared (🌍 cả team) hay local (👤 chỉ trình duyệt này)?\n\n[OK] = Shared\n[Cancel] = Local`) ? 'shared' : 'local';
                }
                const saved = await _saveCadOffsetPreset({
                    name, region,
                    dE: parseFloat(dE.toFixed(3)),
                    dN: parseFloat(dN.toFixed(3)),
                    cm: 105.75, k0: 0.9999,
                    verify: `Calibrate 2 điểm — err ${_calibrateResult.error.toFixed(2)}m`,
                    createdAt: new Date().toISOString()
                }, mode);
                const badge = saved.source === 'shared' ? '🌍 Shared' : '👤 Local';
                displayInfo && displayInfo(`✅ Đã lưu preset "${name}" (${badge}, dE=${dE.toFixed(2)}, dN=${dN.toFixed(2)})`);
            } else {
                displayInfo && displayInfo(`✅ Đã áp dụng offset dE=${dE.toFixed(2)}, dN=${dN.toFixed(2)}`);
            }
            _closeCalibrateModal();
        }
        window._calibrateApply = _calibrateApply;

        // ═══════════════════════════════════════════════════════════════════
        // (End T20.5 Calibrate 2 points)
        // ═══════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════
        // T26 (P56) — Live edit text CAD trên map
        // ═══════════════════════════════════════════════════════════════════
        // - Toggle → text markers thành draggable
        // - dragend → convert Lat/Lon → VN2000 → update entity.position → persist IndexedDB
        // - Undo stack 10 slots (in-memory)
        // - Reset all → snapshot entities gốc lúc load lần đầu (persist)
        // - Snap to grid (m) tùy chọn

        let _cadTextEditMode = false;
        const _cadTextUndoStack = [];  // [{entity, oldPos: {x,y}}]
        const _CAD_TEXT_UNDO_MAX = 10;

        function _toggleCadTextEdit(checked) {
            if (!_cadMeta || !_cadEntities.length) {
                if (typeof displayError === 'function') displayError('Chưa có CAD nào để sửa text');
                const cb = document.getElementById('cadTextEditCheckbox');
                if (cb) cb.checked = false;
                return;
            }
            _cadTextEditMode = !!checked;
            const toolbar = document.getElementById('cadTextEditToolbar');
            if (toolbar) toolbar.style.display = _cadTextEditMode ? 'block' : 'none';
            // Snapshot original positions cho reset (lần đầu bật edit)
            if (_cadTextEditMode && !_cadMeta._originalTextPositions) {
                _cadMeta._originalTextPositions = _cadEntities
                    .filter(e => e.type === 'text' && e.position)
                    .map(e => ({ text: e.text, x: e.position.x, y: e.position.y }));
            }
            // Re-render CAD layer để refresh draggable state
            if (typeof _renderCadLayer === 'function') _renderCadLayer(false);
            if (typeof displayInfo === 'function') {
                displayInfo(_cadTextEditMode
                    ? '✏ Chế độ sửa text ON — drag text để dịch chuyển. Ctrl+Z để undo.'
                    : '✏ Chế độ sửa text OFF');
            }
        }
        window._toggleCadTextEdit = _toggleCadTextEdit;

        // Convert Lat/Lon (map) → VN2000 entity coord — đảo ngược _cvt của _renderCadLayer
        function _mapLatLonToCadEntityCoord(lat, lon) {
            if (!_cadMeta) return null;
            const cm = _cadMeta.zone || 105.75;
            const k0 = _cadMeta.k0 || 0.9996;
            const dE = _cadMeta.dE || 0;
            const dN = _cadMeta.dN || 0;
            // _cvt: entity(x,y) - (dE,dN) → convertVn2000ToLatLon → (lat, lon)
            // → Reverse: convertLatLonToVn2000 → (x_std, y_std) → + (dE, dN) = entity coord
            const vn = convertLatLonToVn2000(lat, lon, cm, k0);
            // Nếu có affine calibration → skip (P19 flow phức tạp, không apply cho text edit MVP)
            if (_cadMeta.affine) {
                console.warn('[CAD text edit] Affine calibrated CAD — text edit chưa hỗ trợ, position có thể lệch');
            }
            return { x: vn.x + dE, y: vn.y + dN };
        }

        function _onCadTextDragEnd(marker, latlng) {
            const entity = marker._cadEntity;
            if (!entity || entity.type !== 'text' || !entity.position) return;
            const newPos = _mapLatLonToCadEntityCoord(latlng.lat, latlng.lng);
            if (!newPos) return;

            // Snap to grid nếu có
            const gridEl = document.getElementById('cadTextSnapGrid');
            const grid = gridEl ? parseFloat(gridEl.value) : 0;
            if (grid > 0) {
                newPos.x = Math.round(newPos.x / grid) * grid;
                newPos.y = Math.round(newPos.y / grid) * grid;
            }

            // Push undo (giữ old position)
            _cadTextUndoStack.push({
                entity,
                oldPos: { x: entity.position.x, y: entity.position.y }
            });
            if (_cadTextUndoStack.length > _CAD_TEXT_UNDO_MAX) {
                _cadTextUndoStack.shift();  // drop oldest
            }

            // Apply new position
            entity.position.x = newPos.x;
            entity.position.y = newPos.y;

            // Persist to IndexedDB
            _persistCadEdits();

            // Update info
            const info = document.getElementById('cadTextEditInfo');
            if (info) info.textContent = `Đã dịch "${entity.text}" → (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}) · Undo: ${_cadTextUndoStack.length}/${_CAD_TEXT_UNDO_MAX}`;

            // Re-render để marker snap về grid position (nếu có snap)
            if (grid > 0 && typeof _renderCadLayer === 'function') _renderCadLayer(false);
        }
        window._onCadTextDragEnd = _onCadTextDragEnd;

        async function _persistCadEdits() {
            try {
                if (typeof _idbSetCad === 'function' && typeof currentSheet !== 'undefined') {
                    await _idbSetCad(currentSheet, { entities: _cadEntities, meta: _cadMeta });
                }
            } catch (err) {
                console.warn('[CAD text edit] Persist failed:', err);
            }
        }

        function _cadTextUndo() {
            if (_cadTextUndoStack.length === 0) {
                if (typeof displayInfo === 'function') displayInfo('Undo stack trống');
                return;
            }
            const last = _cadTextUndoStack.pop();
            if (last && last.entity && last.entity.position) {
                last.entity.position.x = last.oldPos.x;
                last.entity.position.y = last.oldPos.y;
                _persistCadEdits();
                if (typeof _renderCadLayer === 'function') _renderCadLayer(false);
                if (typeof displayInfo === 'function') {
                    displayInfo(`↶ Undo "${last.entity.text}" · Còn ${_cadTextUndoStack.length} bước undo`);
                }
                const info = document.getElementById('cadTextEditInfo');
                if (info) info.textContent = `Undo → "${last.entity.text}" (${last.oldPos.x.toFixed(2)}, ${last.oldPos.y.toFixed(2)}) · Còn ${_cadTextUndoStack.length}/${_CAD_TEXT_UNDO_MAX}`;
            }
        }
        window._cadTextUndo = _cadTextUndo;

        function _cadTextResetAll() {
            if (!_cadMeta || !_cadMeta._originalTextPositions) {
                if (typeof displayError === 'function') displayError('Không có snapshot gốc để reset');
                return;
            }
            if (!confirm(`Reset vị trí ${_cadMeta._originalTextPositions.length} text về gốc? Undo stack sẽ bị xóa.`)) return;
            const origMap = new Map(_cadMeta._originalTextPositions.map(p => [p.text, { x: p.x, y: p.y }]));
            let n = 0;
            _cadEntities.forEach(e => {
                if (e.type !== 'text' || !e.position) return;
                const orig = origMap.get(e.text);
                if (orig && (e.position.x !== orig.x || e.position.y !== orig.y)) {
                    e.position.x = orig.x;
                    e.position.y = orig.y;
                    n++;
                }
            });
            _cadTextUndoStack.length = 0;
            _persistCadEdits();
            if (typeof _renderCadLayer === 'function') _renderCadLayer(false);
            if (typeof displayInfo === 'function') displayInfo(`🔄 Reset ${n} text về vị trí gốc`);
        }
        window._cadTextResetAll = _cadTextResetAll;

        // Ctrl+Z shortcut khi edit mode ON
        document.addEventListener('keydown', function(e) {
            if (!_cadTextEditMode) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                // Chỉ trigger khi focus không phải input/textarea
                const t = document.activeElement && document.activeElement.tagName;
                if (t === 'INPUT' || t === 'TEXTAREA') return;
                e.preventDefault();
                _cadTextUndo();
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // (End T26 Live edit text CAD)
        // ═══════════════════════════════════════════════════════════════════

        function _openCadUpload() {
            const modal = document.getElementById('cadUploadModal');
            if (!modal) return;
            // Set default meridian theo district
            const sel = document.getElementById('cadMeridianInput');
            if (sel && !sel.value) sel.value = String(_CAD_DEFAULT_MERIDIAN[currentSheet] || 105);
            // Reset file input
            const fi = document.getElementById('cadFileInput');
            if (fi) fi.value = '';
            const info = document.getElementById('cadFileInfo');
            if (info) info.textContent = '';
            // Restore offset local grid từ localStorage
            _restoreCadOffset();
            modal.style.display = 'flex';
            closeControlsModal && closeControlsModal();
        }

        function _closeCadUpload() {
            const modal = document.getElementById('cadUploadModal');
            if (modal) modal.style.display = 'none';
        }

        function _onCadFileChange(input) {
            const file = input.files && input.files[0];
            const info = document.getElementById('cadFileInfo');
            if (!file || !info) return;
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            info.textContent = `📎 ${file.name} — ${sizeMB} MB`;
        }

        async function _handleCadUpload() {
            const fi = document.getElementById('cadFileInput');
            const file = fi && fi.files && fi.files[0];
            if (!file) { displayError('Chưa chọn file DXF'); return; }
            if (!file.name.toLowerCase().endsWith('.dxf')) { displayError('Chỉ nhận file .dxf'); return; }

            const sizeMB = file.size / 1024 / 1024;
            // Cảnh báo file lớn — parse trong main thread có thể block 30s+
            if (sizeMB > 20) {
                const proceed = confirm(
                    `⚠ File ${sizeMB.toFixed(1)}MB rất lớn.\n\n` +
                    `Parse trong browser có thể mất 30-90 giây và freeze UI.\n` +
                    `Trên mobile có thể bị OOM (crash).\n\n` +
                    `Khuyến nghị:\n` +
                    `• Mở AutoCAD → xóa layer không cần → Save As DXF R2013 → thử lại\n` +
                    `• Hoặc tách file theo địa bàn\n\n` +
                    `Vẫn tiếp tục?`
                );
                if (!proceed) return;
            } else if (sizeMB > 10) {
                displayInfo(`⏳ File ${sizeMB.toFixed(1)}MB — parse có thể mất 10-20 giây...`);
            }

            const meridianDeg = parseFloat(document.getElementById('cadMeridianInput').value) || 105;
            const k0 = parseFloat(document.getElementById('cadK0Input').value) || 0.9996;
            // Bù offset local grid (nếu bản vẽ dùng grid công trình)
            const cadOff = _getCadOffset();
            _onCadOffsetChange();  // persist vào localStorage

            displayInfo('Đang tải thư viện DXF...');
            try { await _loadDxfParser(); }
            catch (err) { displayError(err.message); return; }

            displayInfo('Đang đọc file...');
            await new Promise(r => setTimeout(r, 30)); // yield UI cho toast render

            // Detect Binary DXF (parser chỉ hỗ trợ ASCII text)
            const headerBuf = await file.slice(0, 30).arrayBuffer();
            const headerStr = new TextDecoder('ascii').decode(headerBuf);
            if (headerStr.startsWith('AutoCAD Binary DXF')) {
                displayError(
                    'File này là Binary DXF, parser chỉ hỗ trợ ASCII DXF.\n' +
                    'Mở AutoCAD → Save As → chọn "AutoCAD ASCII DXF (*.dxf)" (không phải Binary DXF).'
                );
                return;
            }

            // Đọc file với encoding auto-detect: thử UTF-8 trước, fallback Windows-1252 (tiếng Việt)
            async function _readWithEncoding(f, enc) {
                return new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = () => rej(r.error);
                    r.readAsText(f, enc);
                });
            }

            let text;
            try {
                text = await _readWithEncoding(file, 'utf-8');
            } catch (err) {
                displayError('Không đọc được file: ' + err.message);
                return;
            }

            // Sanity check: DXF ASCII phải có "SECTION" gần đầu file
            if (!text.slice(0, 5000).includes('SECTION')) {
                // Thử encoding tiếng Việt Windows-1258
                console.warn('UTF-8 không tìm thấy SECTION — thử Windows-1258');
                try { text = await _readWithEncoding(file, 'windows-1258'); } catch {}
            }

            // Sanity check cuối file có EOF marker không
            const tail = text.slice(-500).toUpperCase();
            if (!tail.includes('EOF')) {
                console.warn('File không có EOF marker cuối. Tail:', text.slice(-200));
                displayError(
                    'File DXF thiếu marker EOF ở cuối — có thể bị cắt/hỏng.\n' +
                    'Kiểm tra: mở lại trong AutoCAD → Save As DXF (ghi đè) → thử lại.'
                );
                return;
            }

            displayInfo(`Đang phân tích ${sizeMB.toFixed(1)}MB DXF... (có thể freeze UI)`);
            await new Promise(r => setTimeout(r, 30));

            let dxf;
            try {
                const parser = new DxfParser();
                dxf = parser.parseSync(text);
            } catch (err) {
                console.error('DXF parse error:', err);
                console.log('File head (200 chars):', text.slice(0, 200));
                console.log('File tail (200 chars):', text.slice(-200));
                displayError(
                    'Không parse được DXF: ' + (err.message || err) +
                    '\n\nGợi ý:\n' +
                    '• Mở lại trong AutoCAD → Save As → định dạng "AutoCAD 2013/LT2013 ASCII DXF"\n' +
                    '• Xem console (F12) để xem head/tail file'
                );
                return;
            }

            let entities = await _parseDxfEntities(dxf);
            if (!entities.length) { displayError('DXF không có entity hỗ trợ (LINE/POLYLINE/CIRCLE/TEXT)'); return; }

            let bounds = _computeCadBounds(entities);
            let layers = [...new Set(entities.map(e => e.layer || '0'))];

            // T19 Pre-flight validation (V1 + V2 auto-fix)
            const validation = _validateDxf(entities, bounds, layers);
            if (validation.blockers.length > 0 || validation.warnings.length > 0 || validation.infos.length > 0) {
                const result = await _showDxfPreflightModal(validation, entities, bounds, layers);
                if (!result || !result.ok) { displayInfo && displayInfo('Đã hủy upload DXF'); return; }
                // Nếu user đã apply fix → dùng entities/bounds/layers đã fix
                if (result.entities) { entities = result.entities; bounds = result.bounds; layers = result.layers; }
            }

            _cadEntities = entities;
            _cadMeta = {
                filename: file.name,
                uploadedAt: new Date().toISOString(),
                zone: meridianDeg,
                k0,
                dE: cadOff.dE,
                dN: cadOff.dN,
                layers,
                entityCount: entities.length,
                bounds
            };
            _cadVisible = true;
            // P18: Reset layer state cho file mới, load state cũ nếu file trùng tên
            _cadLayerVisibility = {}; _cadLayerColorOverride = {};
            _loadCadLayerState();

            // Cache
            await _idbSetCad(currentSheet, { entities, meta: _cadMeta });

            _renderCadLayer(true);
            _closeCadUpload();
            displayInfo(`Đã tải ${entities.length} đối tượng CAD`);
        }

        let _cadZoomHookInstalled = false;
        function _installCadZoomHook() {
            if (_cadZoomHookInstalled || typeof map === 'undefined') return;
            _cadZoomHookInstalled = true;
            map.on('zoomend', debounce(() => {
                if (!_cadTextLayer || !_cadVisible) return;
                if (map.getZoom() >= _CAD_TEXT_MIN_ZOOM) {
                    if (!map.hasLayer(_cadTextLayer)) _cadTextLayer.addTo(map);
                } else {
                    if (map.hasLayer(_cadTextLayer)) map.removeLayer(_cadTextLayer);
                }
            }, 100));
        }

        function _toggleCad() {
            if (!_cadLayer) return;
            _cadVisible = !_cadVisible;
            if (_cadVisible) {
                _cadLayer.addTo(map);
                if (_cadTextLayer && map.getZoom() >= _CAD_TEXT_MIN_ZOOM) _cadTextLayer.addTo(map);
            } else {
                map.removeLayer(_cadLayer);
                if (_cadTextLayer && map.hasLayer(_cadTextLayer)) map.removeLayer(_cadTextLayer);
            }
            const btn = document.getElementById('btnCadToggle');
            if (btn) btn.textContent = _cadVisible ? '👁 Ẩn' : '👁 Hiện';
        }

        // Sync text/style của tất cả buttons .basemap-toggle-btn (CAD section + Global ☰ panel)
        function _syncBasemapButtons(hidden) {
            document.querySelectorAll('.basemap-toggle-btn').forEach(btn => {
                if (hidden) {
                    btn.textContent = '🗺 Hiện bản đồ nền';
                    btn.style.color = '#92400e';
                    btn.style.borderColor = '#fde68a';
                    btn.style.background = '#fef3c7';
                } else {
                    btn.textContent = '🗺 Ẩn bản đồ nền';
                    btn.style.color = '';
                    btn.style.borderColor = '';
                    btn.style.background = '';
                }
            });
        }

        function _toggleBasemap() {
            if (_hiddenTileLayers.length === 0) {
                // Ẩn: lưu và xóa tất cả tile layers khỏi map
                map.eachLayer(l => {
                    if (l instanceof L.TileLayer) {
                        _hiddenTileLayers.push(l);
                        map.removeLayer(l);
                    }
                });
                _syncBasemapButtons(true);
            } else {
                // Restore
                _hiddenTileLayers.forEach(l => l.addTo(map));
                _hiddenTileLayers = [];
                _syncBasemapButtons(false);
            }
        }

        async function _removeCad() {
            if (!_cadMeta) return;
            if (!confirm(`Gỡ bản vẽ "${_cadMeta.filename}" khỏi ${currentSheet}?`)) return;
            if (_cadLayer) { map.removeLayer(_cadLayer); _cadLayer = null; }
            if (_cadTextLayer) { map.removeLayer(_cadTextLayer); _cadTextLayer = null; }
            // Restore tile layers nếu đang ẩn
            if (_hiddenTileLayers.length > 0) {
                _hiddenTileLayers.forEach(l => l.addTo(map));
                _hiddenTileLayers = [];
            }
            _stopCalibrate();
            _cadVertexIndex = [];
            _cadEntities = []; _cadMeta = null;
            _cadLayerVisibility = {}; _cadLayerColorOverride = {};
            localStorage.removeItem('cad_layers_' + currentSheet);
            await _idbDelCad(currentSheet);
            const infoBox = document.getElementById('cadInfoBox');
            const toggle = document.getElementById('btnCadToggle');
            if (infoBox) infoBox.style.display = 'none';
            if (toggle) toggle.disabled = true;
            displayInfo('Đã gỡ bản vẽ CAD');
        }

        // P18: Compute stats per layer
        function _computeCadLayerStats() {
            const stats = {};
            _cadEntities.forEach(e => {
                const layer = e.layer || '0';
                if (!stats[layer]) stats[layer] = { count: 0, firstColor: null, types: {} };
                stats[layer].count++;
                stats[layer].types[e.type] = (stats[layer].types[e.type] || 0) + 1;
                if (!stats[layer].firstColor && e.color != null) {
                    stats[layer].firstColor = _dxfColorToHex(e.color);
                }
            });
            return stats;
        }

        function _saveCadLayerState() {
            if (!_cadMeta) return;
            const key = 'cad_layers_' + currentSheet;
            try {
                localStorage.setItem(key, JSON.stringify({
                    visibility: _cadLayerVisibility,
                    colors: _cadLayerColorOverride
                }));
            } catch { /* quota */ }
        }

        function _loadCadLayerState() {
            const key = 'cad_layers_' + currentSheet;
            try {
                const s = JSON.parse(localStorage.getItem(key) || '{}');
                _cadLayerVisibility = s.visibility || {};
                _cadLayerColorOverride = s.colors || {};
            } catch {
                _cadLayerVisibility = {};
                _cadLayerColorOverride = {};
            }
        }

        function _openCadLayers() {
            if (!_cadMeta) return;
            _renderCadLayerList();
            document.getElementById('cadLayerModal').style.display = 'flex';
            closeControlsModal && closeControlsModal();
        }

        function _closeCadLayers() {
            document.getElementById('cadLayerModal').style.display = 'none';
        }

        function _renderCadLayerList() {
            const stats = _computeCadLayerStats();
            const layers = Object.keys(stats).sort();
            const container = document.getElementById('cadLayerList');
            const totalCount = document.getElementById('cadLayerTotalCount');
            if (totalCount) totalCount.textContent = layers.length;
            if (!container) return;
            const q = (document.getElementById('cadLayerSearch') || {}).value || '';
            const nQ = normalizeTextSearchable(q);
            container.innerHTML = layers.map(layer => {
                const s = stats[layer];
                const visible = _cadLayerVisibility[layer] !== false;
                const color = _cadLayerColorOverride[layer] || s.firstColor || '#333';
                const nLayer = normalizeTextSearchable(layer);
                const match = !nQ || nLayer.includes(nQ);
                if (!match) return '';
                const typesSummary = Object.entries(s.types)
                    .map(([t, c]) => `${{line:'━', polyline:'╱', circle:'●', text:'A'}[t] || '?'}${c}`)
                    .join(' ');
                return `
                    <label class="cad-layer-row" data-layer="${layer}">
                        <input type="checkbox" ${visible ? 'checked' : ''}
                               onchange="_toggleCadLayer('${layer.replace(/'/g,"\\'")}', this.checked)">
                        <input type="color" value="${color}"
                               onchange="_setCadLayerColor('${layer.replace(/'/g,"\\'")}', this.value)"
                               style="width:26px;height:22px;border:1px solid #ccc;padding:1px;cursor:pointer;background:transparent;"
                               title="Đổi màu">
                        <span class="layer-name">${layer.replace(/</g,'&lt;')}</span>
                        <span class="layer-summary" title="Số lượng entity theo loại">${typesSummary}</span>
                        <span class="layer-count">${s.count}</span>
                    </label>`;
            }).join('');
        }

        function _toggleCadLayer(layer, visible) {
            _cadLayerVisibility[layer] = visible;
            _renderCadLayer(false);
            _saveCadLayerState();
        }

        function _setCadLayerColor(layer, color) {
            _cadLayerColorOverride[layer] = color;
            _renderCadLayer(false);
            _saveCadLayerState();
        }

        function _filterCadLayers() {
            _renderCadLayerList();
        }

        function _cadLayersSelectAll(visible) {
            const stats = _computeCadLayerStats();
            Object.keys(stats).forEach(layer => {
                _cadLayerVisibility[layer] = visible;
            });
            _renderCadLayerList();
            _renderCadLayer(false);
            _saveCadLayerState();
        }

        // ─── P19: Calibration 2 điểm — bù rotation + scale ───

        function _startCalibrate() {
            if (!_cadMeta || !_cadEntities.length) {
                displayError('Chưa có bản vẽ CAD để calibrate');
                return;
            }
            if (!_cadVertexIndex.length) {
                displayError('Chưa build vertex index — thử reload CAD');
                return;
            }
            closeControlsModal && closeControlsModal();
            _calibData = { cadA: null, realA: null, cadB: null, realB: null };
            _clearCalibMarkers();
            _calibMode = 'cadA';
            _updateCalibHint();
            map.getContainer().style.cursor = 'crosshair';
            if (!_calibLayerGroup) _calibLayerGroup = L.layerGroup().addTo(map);
            else _calibLayerGroup.addTo(map);
        }

        function _stopCalibrate() {
            _calibMode = null;
            _clearCalibMarkers();
            const bar = document.getElementById('calibHintBar');
            if (bar) bar.style.display = 'none';
            map.getContainer().style.cursor = '';
        }

        function _clearCalibMarkers() {
            if (_calibLayerGroup) _calibLayerGroup.clearLayers();
        }

        function _updateCalibHint() {
            const bar = document.getElementById('calibHintBar');
            const hints = {
                cadA: '📍 Bước 1/4: Click 1 điểm trên <b>bản vẽ CAD</b> (đỉnh trụ, giao lộ...)',
                realA: '🗺 Bước 2/4: Click cùng điểm đó trên <b>bản đồ Google</b> (vị trí thực)',
                cadB: '📍 Bước 3/4: Click điểm B khác trên <b>CAD</b> (xa điểm A ≥ 100m)',
                realB: '🗺 Bước 4/4: Click cùng điểm B trên <b>bản đồ Google</b>'
            };
            if (bar) {
                bar.style.display = 'flex';
                bar.querySelector('.hint-text').innerHTML = hints[_calibMode] || '';
            }
        }

        function _addCalibMarker(lat, lon, color, label) {
            const marker = L.circleMarker([lat, lon], {
                radius: 8, color, weight: 3, fillColor: color, fillOpacity: 0.4
            }).addTo(_calibLayerGroup);
            const tip = L.marker([lat, lon], {
                icon: L.divIcon({
                    className: '',
                    html: `<div style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-weight:800;font-size:11px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,.3);">${label}</div>`,
                    iconAnchor: [0, 30]
                }),
                interactive: false
            }).addTo(_calibLayerGroup);
        }

        function _handleCalibMapClick(e) {
            if (!_calibMode) return;
            const { lat, lng } = e.latlng;
            if (_calibMode === 'cadA' || _calibMode === 'cadB') {
                // Find nearest CAD vertex trong bán kính 100m
                const nearest = _findNearestCadVertex(lat, lng, 100);
                if (!nearest) {
                    displayError('Không tìm thấy đỉnh CAD gần đó (< 100m). Click gần bản vẽ hơn.');
                    return;
                }
                const key = _calibMode;
                _calibData[key] = { lat: nearest.lat, lon: nearest.lon, origX: nearest.origX, origY: nearest.origY };
                _addCalibMarker(nearest.lat, nearest.lon,
                    key === 'cadA' ? '#10b981' : '#f97316',
                    'CAD ' + key.slice(-1));
                _calibMode = key === 'cadA' ? 'realA' : 'realB';
                _updateCalibHint();
            } else if (_calibMode === 'realA' || _calibMode === 'realB') {
                const key = _calibMode;
                const pair = key === 'realA' ? 'cadA' : 'cadB';
                _calibData[key] = { lat, lon: lng };
                const color = key === 'realA' ? '#10b981' : '#f97316';
                _addCalibMarker(lat, lng, color, 'Real ' + key.slice(-1));
                // Draw dashed line từ CAD → Real
                L.polyline([[_calibData[pair].lat, _calibData[pair].lon], [lat, lng]], {
                    color, weight: 2, dashArray: '5 5', opacity: 0.6
                }).addTo(_calibLayerGroup);
                if (key === 'realA') {
                    _calibMode = 'cadB';
                    _updateCalibHint();
                } else {
                    // Done — show preview
                    const bar = document.getElementById('calibHintBar');
                    if (bar) bar.style.display = 'none';
                    map.getContainer().style.cursor = '';
                    _showCalibPreview();
                }
            }
        }

        function _showCalibPreview() {
            const affine = _computeCalibAffine(_calibData);
            if (affine.error) {
                displayError(affine.error);
                _stopCalibrate();
                return;
            }
            const scalePct = ((affine.scale - 1) * 100).toFixed(3);
            const rotateDeg = (affine.rotate * 180 / Math.PI).toFixed(3);
            const transM = Math.hypot(affine.tx, affine.ty).toFixed(1);
            // Store temporary for confirm
            window._pendingCalibAffine = affine;
            const modal = document.getElementById('calibPreviewModal');
            modal.querySelector('#calibScale').textContent = affine.scale.toFixed(6) + `  (${scalePct > 0 ? '+' : ''}${scalePct}%)`;
            modal.querySelector('#calibRotate').textContent = rotateDeg + '°';
            modal.querySelector('#calibTrans').textContent = `Đông ${affine.tx.toFixed(1)}m, Bắc ${affine.ty.toFixed(1)}m (tổng ${transM}m)`;
            modal.querySelector('#calibCadLen').textContent = affine._debug.cadLen + 'm';
            modal.querySelector('#calibRealLen').textContent = affine._debug.realLen + 'm';
            modal.style.display = 'flex';
        }

        async function _applyCalibAffine() {
            if (!window._pendingCalibAffine || !_cadMeta) return;
            _cadMeta.affine = window._pendingCalibAffine;
            delete window._pendingCalibAffine;
            _renderCadLayer(false);
            await _idbSetCad(currentSheet, { entities: _cadEntities, meta: _cadMeta });
            _stopCalibrate();
            document.getElementById('calibPreviewModal').style.display = 'none';
            displayInfo(`Đã calibrate: scale ${_cadMeta.affine.scale.toFixed(4)}, xoay ${(_cadMeta.affine.rotate * 180 / Math.PI).toFixed(2)}°`);
        }

        function _cancelCalibPreview() {
            delete window._pendingCalibAffine;
            document.getElementById('calibPreviewModal').style.display = 'none';
            _stopCalibrate();
        }

        async function _resetCalibAffine() {
            if (!_cadMeta || !_cadMeta.affine) return;
            if (!confirm('Xóa calibration hiện tại?')) return;
            delete _cadMeta.affine;
            _renderCadLayer(false);
            await _idbSetCad(currentSheet, { entities: _cadEntities, meta: _cadMeta });
            displayInfo('Đã reset calibration');
        }

        // ─── P34: Đo khoảng cách trên bản đồ ───
        function _toggleMeasureMode() {
            _measureMode = !_measureMode;
            const btn = document.getElementById('btnMeasureToggle');
            if (btn) {
                btn.style.background = _measureMode ? '#dc2626' : '';
                btn.style.color = _measureMode ? '#fff' : '';
                btn.textContent = _measureMode ? '✗ Tắt đo' : '📏 Đo khoảng cách';
            }
            map.getContainer().style.cursor = _measureMode ? 'crosshair' : '';
            if (!_measureMode) _clearMeasure();
            else closeControlsModal && closeControlsModal();
        }

        function _clearMeasure() {
            _measurePoints = [];
            if (_measureLayerGroup) _measureLayerGroup.clearLayers();
        }

        function _handleMeasureClick(e) {
            if (!_measureMode) return;
            if (!_measureLayerGroup) _measureLayerGroup = L.layerGroup().addTo(map);
            const p = [e.latlng.lat, e.latlng.lng];
            _measurePoints.push(p);
            L.circleMarker(p, { radius: 5, color: '#dc2626', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(_measureLayerGroup);

            if (_measurePoints.length === 2) {
                const [a, b] = _measurePoints;
                const dist = haversineM(a[0], a[1], b[0], b[1]);
                L.polyline([a, b], { color: '#dc2626', weight: 3, opacity: 0.85 }).addTo(_measureLayerGroup);
                const midLat = (a[0] + b[0]) / 2, midLon = (a[1] + b[1]) / 2;
                const txt = dist < 1000 ? dist.toFixed(1) + ' m' : (dist / 1000).toFixed(3) + ' km';
                L.marker([midLat, midLon], {
                    icon: L.divIcon({
                        className: '',
                        html: `<div style="background:#fff;border:2px solid #dc2626;padding:3px 8px;border-radius:6px;font-weight:800;color:#dc2626;font-family:monospace;font-size:12px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,.2);">${txt}</div>`,
                        iconAnchor: [30, 12]
                    }),
                    interactive: false
                }).addTo(_measureLayerGroup);
                _measurePoints = []; // Reset for next pair
            }
        }

        // ─── P20: Stake-out RTK điều hướng đến đỉnh CAD ───

        function _startStakeoutPick() {
            if (!_cadMeta || !_cadEntities.length) {
                displayError('Chưa có bản vẽ CAD');
                return;
            }
            if (!_cadVertexIndex.length) {
                displayError('Chưa build vertex index — reload CAD');
                return;
            }
            _stopStakeout(); // Cleanup nếu đang có target
            closeControlsModal && closeControlsModal();
            _stakeoutPickMode = true;
            map.getContainer().style.cursor = 'crosshair';
            const bar = document.getElementById('stakeoutPickHint');
            if (bar) bar.style.display = 'flex';
        }

        function _handleStakeoutPick(e) {
            if (!_stakeoutPickMode) return;
            const nearest = _findNearestCadVertex(e.latlng.lat, e.latlng.lng, 100);
            if (!nearest) {
                displayError('Không tìm thấy đỉnh CAD gần đó (< 100m)');
                return;
            }
            _stakeoutPickMode = false;
            map.getContainer().style.cursor = '';
            const hint = document.getElementById('stakeoutPickHint');
            if (hint) hint.style.display = 'none';
            _startStakeout({ lat: nearest.lat, lon: nearest.lon, layer: nearest.layer });
        }

        function _startStakeout(target) {
            _stakeoutTarget = target;
            _stakeoutReached = false;

            // Ngưỡng theo GPS mode
            const cfg = GPS_MODES[currentGpsMode] || GPS_MODES.phone;
            _stakeoutMinDistM = currentGpsMode === 'rtk' ? 0.10 : 3.0;
            const threshEl = document.getElementById('stakeoutThreshold');
            if (threshEl) threshEl.textContent = _stakeoutMinDistM < 1
                ? (_stakeoutMinDistM * 100).toFixed(0) + ' cm'
                : _stakeoutMinDistM.toFixed(1) + ' m';

            // Marker target
            _stakeoutTargetMarker = L.marker([target.lat, target.lon], {
                icon: L.divIcon({
                    className: '',
                    html: `<div style="width:32px;height:32px;border:3px solid #dc2626;border-radius:50%;background:rgba(255,255,255,.7);box-shadow:0 0 12px rgba(220,38,38,.5);position:relative;animation:stakeoutPulse 1.5s ease-in-out infinite;">
                        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:8px;height:8px;background:#dc2626;border-radius:50%;"></div>
                    </div>`,
                    iconSize: [38, 38],
                    iconAnchor: [19, 19]
                }),
                interactive: false, keyboard: false
            }).addTo(map);
            map.setView([target.lat, target.lon], Math.max(map.getZoom(), 18));

            // Show floating bar
            const bar = document.getElementById('stakeoutBar');
            if (bar) bar.style.display = 'flex';

            // Start watch
            _stakeoutWatchId = navigator.geolocation.watchPosition(
                pos => _updateStakeout(pos),
                err => {
                    console.error('stakeout err', err);
                    displayError('GPS error: ' + err.message);
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 }
            );

            const layerBadge = document.getElementById('stakeoutLayer');
            if (layerBadge) layerBadge.textContent = target.layer || '—';
        }

        function _updateStakeout(pos) {
            if (!_stakeoutTarget) return;
            const { latitude: cLat, longitude: cLon, accuracy: acc } = pos.coords;
            const dist = haversineM(cLat, cLon, _stakeoutTarget.lat, _stakeoutTarget.lon);
            const bearing = _computeBearing(cLat, cLon, _stakeoutTarget.lat, _stakeoutTarget.lon);

            // Update UI
            const distEl = document.getElementById('stakeoutDist');
            const bearingEl = document.getElementById('stakeoutBearing');
            const arrowEl = document.getElementById('stakeoutArrow');
            const accEl = document.getElementById('stakeoutAcc');
            if (distEl) {
                if (dist < 1) {
                    distEl.textContent = (dist * 100).toFixed(1);
                    distEl.nextElementSibling.textContent = 'cm';
                } else if (dist < 1000) {
                    distEl.textContent = dist.toFixed(2);
                    distEl.nextElementSibling.textContent = 'm';
                } else {
                    distEl.textContent = (dist / 1000).toFixed(2);
                    distEl.nextElementSibling.textContent = 'km';
                }
            }
            if (bearingEl) bearingEl.textContent = _bearingLabel(bearing);
            if (arrowEl) arrowEl.style.transform = `rotate(${bearing}deg)`;
            if (accEl) {
                const status = (currentGpsMode === 'rtk') ? rtkStatus(acc) : null;
                accEl.textContent = status
                    ? `${status.emoji} ${status.label} ${formatAccuracy(acc)}`
                    : `📱 Phone ${formatAccuracy(acc)}`;
            }

            // Color feedback theo distance
            const bar = document.getElementById('stakeoutBar');
            if (bar) {
                let bg;
                if (dist <= _stakeoutMinDistM) bg = 'linear-gradient(135deg,#059669,#10b981)';   // green
                else if (dist < 1) bg = 'linear-gradient(135deg,#2563eb,#3b82f6)';               // blue
                else if (dist < 5) bg = 'linear-gradient(135deg,#d97706,#f59e0b)';               // orange
                else bg = 'linear-gradient(135deg,#1e293b,#334155)';                              // dark
                bar.style.background = bg;
            }

            // User marker + line + accuracy circle
            if (_stakeoutUserMarker) _stakeoutUserMarker.setLatLng([cLat, cLon]);
            else _stakeoutUserMarker = L.circleMarker([cLat, cLon], {
                radius: 8, color:'#2563eb', fillColor:'#2563eb', fillOpacity:0.6, weight:2
            }).addTo(map);
            if (_stakeoutLine) map.removeLayer(_stakeoutLine);
            _stakeoutLine = L.polyline([[cLat, cLon], [_stakeoutTarget.lat, _stakeoutTarget.lon]], {
                color: dist <= _stakeoutMinDistM ? '#10b981' : '#dc2626',
                weight: 2.5, opacity: 0.75, dashArray: '6 4'
            }).addTo(map);
            if (_stakeoutAccCircle) map.removeLayer(_stakeoutAccCircle);
            if (acc && acc < 50) {
                _stakeoutAccCircle = L.circle([cLat, cLon], {
                    radius: acc, color:'#2563eb', fillColor:'#2563eb', fillOpacity:0.08, weight:1
                }).addTo(map);
            }

            // Reach detection
            if (dist <= _stakeoutMinDistM && !_stakeoutReached) {
                _stakeoutReached = true;
                _onStakeoutReached(dist);
            } else if (dist > _stakeoutMinDistM * 3) {
                _stakeoutReached = false; // Reset để có thể alert lại nếu rời xa rồi quay lại
            }
        }

        function _computeBearing(lat1, lon1, lat2, lon2) {
            const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
            const Δλ = (lon2 - lon1) * Math.PI / 180;
            const y = Math.sin(Δλ) * Math.cos(φ2);
            const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
            return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
        }

        function _bearingLabel(deg) {
            const dirs = ['B', 'ĐB', 'Đ', 'ĐN', 'N', 'TN', 'T', 'TB'];
            return `${dirs[Math.round(deg / 45) % 8]} (${Math.round(deg)}°)`;
        }

        function _onStakeoutReached(dist) {
            if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 400]);
            const distTxt = dist < 1 ? `${(dist * 100).toFixed(1)} cm` : `${dist.toFixed(2)} m`;
            displayInfo(`✅ Đã đến vị trí target — sai số ${distTxt}`);
            if (window.speechSynthesis) {
                try {
                    const u = new SpeechSynthesisUtterance('Đã đến vị trí');
                    u.lang = 'vi-VN'; u.rate = 1.2;
                    speechSynthesis.speak(u);
                } catch {}
            }
            // Prompt add marker
            setTimeout(() => {
                if (!_stakeoutTarget) return;
                const t = _stakeoutTarget;
                if (confirm(`✅ Đã đến đỉnh CAD (sai số ${distTxt}).\n\nThêm marker tại đây?\n\nTọa độ: ${t.lat.toFixed(6)}, ${t.lon.toFixed(6)}`)) {
                    _stopStakeout();
                    showMarkerPopupAt(t.lat, t.lon);
                }
            }, 600);
        }

        function _stopStakeout() {
            if (_stakeoutWatchId !== null) {
                navigator.geolocation.clearWatch(_stakeoutWatchId);
                _stakeoutWatchId = null;
            }
            _stakeoutTarget = null;
            _stakeoutReached = false;
            _stakeoutPickMode = false;
            map.getContainer().style.cursor = '';
            if (_stakeoutTargetMarker) { map.removeLayer(_stakeoutTargetMarker); _stakeoutTargetMarker = null; }
            if (_stakeoutUserMarker) { map.removeLayer(_stakeoutUserMarker); _stakeoutUserMarker = null; }
            if (_stakeoutLine) { map.removeLayer(_stakeoutLine); _stakeoutLine = null; }
            if (_stakeoutAccCircle) { map.removeLayer(_stakeoutAccCircle); _stakeoutAccCircle = null; }
            const bar = document.getElementById('stakeoutBar');
            if (bar) bar.style.display = 'none';
            const hint = document.getElementById('stakeoutPickHint');
            if (hint) hint.style.display = 'none';
        }

        // Snap toggle
        function _toggleCadSnap(enabled) {
            _cadSnapEnabled = !!enabled;
            localStorage.setItem('cad_snap_enabled', enabled ? '1' : '0');
            const sliderWrap = document.getElementById('cadSnapSliderWrap');
            if (sliderWrap) sliderWrap.style.display = enabled ? 'block' : 'none';
        }

        function _onCadSnapDistChange(val) {
            _cadSnapMaxDist = parseFloat(val) || 5;
            localStorage.setItem('cad_snap_max_dist', String(_cadSnapMaxDist));
            const disp = document.getElementById('cadSnapDistDisplay');
            if (disp) disp.textContent = _cadSnapMaxDist + 'm';
        }

        function _restoreCadSnapState() {
            _cadSnapEnabled = localStorage.getItem('cad_snap_enabled') === '1';
            _cadSnapMaxDist = parseFloat(localStorage.getItem('cad_snap_max_dist') || '5');
        }

        function _cadLayersPreset(presetKey) {
            const p = _CAD_LAYER_PRESETS[presetKey];
            if (!p) return;
            const stats = _computeCadLayerStats();
            Object.keys(stats).forEach(layer => {
                if (p.show) _cadLayerVisibility[layer] = p.show.test(layer);
                else if (p.hide) _cadLayerVisibility[layer] = !p.hide.test(layer);
            });
            _renderCadLayerList();
            _renderCadLayer(false);
            _saveCadLayerState();
        }

        function _getFirstCadPoint() {
            for (const e of _cadEntities) {
                if (e.points && e.points.length) return e.points[0];
                if (e.center) return e.center;
                if (e.position) return e.position;
            }
            return null;
        }

        function _updateCadAdjPreview() {
            const p = _getFirstCadPoint();
            const out = document.getElementById('cadAdjCoord');
            if (!p || !out) return;
            const mer = parseFloat(document.getElementById('cadAdjMeridianInput').value) || 105.75;
            const k0 = parseFloat(document.getElementById('cadAdjK0Input').value) || 0.9999;
            // Convention mới: dE/dN — trừ khỏi tọa độ trước convert (giống CSV)
            const dE = parseFloat(document.getElementById('cadAdjOffsetX').value) || 0;
            const dN = parseFloat(document.getElementById('cadAdjOffsetY').value) || 0;
            const deltaEl = document.getElementById('cadAdjDelta');
            try {
                const c = convertVn2000ToLatLon(p.x - dE, p.y - dN, mer, k0);
                out.textContent = `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`;
                out.style.color = '#059669';
                // Tính delta so với trung tâm địa bàn hiện tại (không hardcode Cần Giuộc)
                const ref = DISTRICT_CENTERS[currentSheet] || DISTRICT_CENTERS.DanhSachTru;
                const dLatKm = (c.lat - ref.lat) * 111.32;
                const dLonKm = (c.lon - ref.lon) * 111.32 * Math.cos(ref.lat * Math.PI / 180);
                const distKm = Math.hypot(dLatKm, dLonKm);
                const dirs = [];
                if (Math.abs(dLatKm) > 0.5) dirs.push(dLatKm > 0 ? `${dLatKm.toFixed(1)}km bắc` : `${(-dLatKm).toFixed(1)}km nam`);
                if (Math.abs(dLonKm) > 0.5) dirs.push(dLonKm > 0 ? `${dLonKm.toFixed(1)}km đông` : `${(-dLonKm).toFixed(1)}km tây`);
                // Update reference label
                const refLabel = document.getElementById('cadAdjRefLabel');
                if (refLabel) refLabel.textContent = `${ref.label} trung tâm: ${ref.lat.toFixed(3)}, ${ref.lon.toFixed(3)}`;
                if (deltaEl) {
                    if (distKm < 1) {
                        deltaEl.innerHTML = `<span style="color:#059669;font-weight:700;">✓ Rất gần trung tâm ${ref.label} (${distKm.toFixed(2)} km)</span>`;
                    } else if (distKm < 5) {
                        deltaEl.innerHTML = `<span style="color:#d97706;">± ${distKm.toFixed(1)}km (${dirs.join(', ')})</span>`;
                    } else {
                        deltaEl.innerHTML = `<span style="color:#dc2626;">⚠ Lệch ${distKm.toFixed(1)}km (${dirs.join(', ')}) — bình thường nếu file phủ nhiều khu vực</span>`;
                    }
                }
            } catch (err) {
                out.textContent = 'Lỗi: ' + err.message;
                out.style.color = '#dc2626';
                if (deltaEl) deltaEl.textContent = '';
            }
        }

        function _setCadMer(val) {
            const inp = document.getElementById('cadAdjMeridianInput');
            if (inp) { inp.value = val; _updateCadAdjPreview(); }
        }
        function _nudgeCadMer(delta) {
            const inp = document.getElementById('cadAdjMeridianInput');
            if (!inp) return;
            const cur = parseFloat(inp.value) || 105.75;
            inp.value = (cur + delta).toFixed(3);
            _updateCadAdjPreview();
        }

        function _openCadAdjust() {
            if (!_cadMeta) return;
            const modal = document.getElementById('cadAdjustModal');
            const merInp = document.getElementById('cadAdjMeridianInput');
            const k0Sel = document.getElementById('cadAdjK0Input');
            const offX = document.getElementById('cadAdjOffsetX');
            const offY = document.getElementById('cadAdjOffsetY');
            if (merInp) merInp.value = String(_cadMeta.zone);
            if (k0Sel) k0Sel.value = String(_cadMeta.k0 || 0.9996);
            // Convention mới: dE/dN (CSV convention). Input IDs giữ nguyên cho backward compat DOM.
            if (offX) offX.value = String(_cadMeta.dE || 0);
            if (offY) offY.value = String(_cadMeta.dN || 0);
            _updateCadAdjPreview();
            modal.style.display = 'flex';
            closeControlsModal && closeControlsModal();
        }

        function _closeCadAdjust() {
            document.getElementById('cadAdjustModal').style.display = 'none';
        }

        async function _applyCadAdjust() {
            if (!_cadMeta) { _closeCadAdjust(); return; }
            const mer = parseFloat(document.getElementById('cadAdjMeridianInput').value) || 105.75;
            const k0 = parseFloat(document.getElementById('cadAdjK0Input').value) || 0.9999;
            const dE = parseFloat(document.getElementById('cadAdjOffsetX').value) || 0;
            const dN = parseFloat(document.getElementById('cadAdjOffsetY').value) || 0;
            _cadMeta.zone = mer;
            _cadMeta.k0 = k0;
            _cadMeta.dE = dE;
            _cadMeta.dN = dN;
            // Clean up old convention fields nếu còn
            delete _cadMeta.offsetX;
            delete _cadMeta.offsetY;
            _renderCadLayer(true);
            // Update cache
            await _idbSetCad(currentSheet, { entities: _cadEntities, meta: _cadMeta });
            _closeCadAdjust();
            displayInfo(`KTTT ${mer}°, k₀=${k0}, offset ΔE=${dE}m, ΔN=${dN}m`);
        }

        async function _loadCachedCad(sheetName) {
            // Cleanup CAD hiện tại
            if (_cadLayer) { map.removeLayer(_cadLayer); _cadLayer = null; }
            if (_cadTextLayer) { map.removeLayer(_cadTextLayer); _cadTextLayer = null; }
            _cadEntities = []; _cadMeta = null;
            const infoBox = document.getElementById('cadInfoBox');
            const toggle = document.getElementById('btnCadToggle');
            if (infoBox) infoBox.style.display = 'none';
            if (toggle) toggle.disabled = true;

            const cached = await _idbGetCad(sheetName);
            if (!cached || !cached.entities || !cached.meta) return;
            // Re-clean text từ cache cũ (có thể chứa MTEXT format codes chưa strip)
            const needsClean = cached.entities.some(e =>
                e.type === 'text' && e.text && (e.text.includes('{f') || e.text.includes('\\C') || e.text.includes('\\P') || e.text.includes('%%'))
            );
            // Migration: convention cũ offsetX/Y (cộng sau convert, Đông+/Bắc+ mét) →
            // convention mới dE/dN (trừ trước convert, ΔE/ΔN local grid). Sign đảo dấu.
            const needsOffsetMigration =
                (cached.meta.offsetX != null || cached.meta.offsetY != null) &&
                (cached.meta.dE == null && cached.meta.dN == null);
            if (needsOffsetMigration) {
                cached.meta.dE = -(cached.meta.offsetX || 0);
                cached.meta.dN = -(cached.meta.offsetY || 0);
                delete cached.meta.offsetX;
                delete cached.meta.offsetY;
                console.log(`[CAD migration] ${sheetName}: offsetX/Y → dE/dN`, cached.meta.dE, cached.meta.dN);
            }
            if (needsClean || needsOffsetMigration) {
                if (needsClean) {
                    cached.entities = cached.entities
                        .map(e => e.type === 'text' ? { ...e, text: _cleanMText(e.text) } : e)
                        .filter(e => e.type !== 'text' || e.text);
                }
                // Ghi lại cache đã clean/migrated để lần sau không cần re-process
                await _idbSetCad(sheetName, cached);
            }
            _cadEntities = cached.entities;
            _cadMeta = cached.meta;
            _cadVisible = true;
            // P18: Restore layer visibility/color state cho district này
            _loadCadLayerState();
            _renderCadLayer(false);
        }
