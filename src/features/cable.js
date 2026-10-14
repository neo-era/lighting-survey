// src/features/cable.js - So do cap tren ban do: ve/sua/toggle (module hoa dot 4b).
// Classic script toan cuc, nap place: before (sau src/core, truoc khoi <script> chinh).
// Goi global runtime tu index.html: map, loadedData, L, syncRowToGAS, displayError/Info, _getFilteredRows...
// _buildCableLines/_removeCableLines GIU global cho data-tools.js + print.js dung chung.
// 27 ham + 10 state. KHONG import/export.

        let _cableLayerGroup = null;

        function _detectCableCycle(rows) {
            const parent = {};
            rows.forEach(r => {
                const name = String(r[1] || '').trim();
                const par  = String(r[14] || '').trim();
                if (name && par && name !== par) parent[name] = par;
            });
            for (const start of Object.keys(parent)) {
                const visited = new Set();
                const path = [];
                let cur = start;
                while (cur && parent[cur]) {
                    if (visited.has(cur)) {
                        // Cycle: cắt path từ chỗ cur xuất hiện lần đầu, thêm cur ở cuối để hiển thị vòng
                        const startIdx = path.indexOf(cur);
                        return path.slice(startIdx).concat([cur]);
                    }
                    visited.add(cur); path.push(cur); cur = parent[cur];
                }
            }
            return null;
        }

        // @@CABLELEN_START
        const CL_MAX_LEN = 500;

        const _clNum = v => parseFloat(typeof v === 'string' ? v.replace(',', '.') : v);

        function _clDist(lat1, lon1, lat2, lon2) {
            const r = Math.PI / 180, R = 6371000;
            const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        function _clToward(lat1, lon1, lat2, lon2, d) {
            const r = Math.PI / 180, R = 6371000;
            const p1 = lat1 * r, p2 = lat2 * r, dl = (lon2 - lon1) * r;
            const brg = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
            const dr = d / R;
            const p3 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(brg));
            const l3 = lon1 * r + Math.atan2(Math.sin(brg) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p3));
            return { lat: p3 / r, lon: l3 / r };
        }

        function _clRootOf(name, rows) {
            const parentOf = new Map();
            rows.forEach(r => { const n = String(r[1] || '').trim(); if (n && !parentOf.has(n)) parentOf.set(n, String(r[14] || '').trim()); });
            const seen = new Set();
            let cur = name;
            // Dừng ở trụ cuối CÓ THẬT — Marker gốc gõ sai / là ID thì không trả về tên không tồn tại
            while (!seen.has(cur)) {
                seen.add(cur);
                const p = parentOf.get(cur);
                if (!p || !parentOf.has(p)) break;
                cur = p;
            }
            return cur;
        }

        function _clPlanLength(rows, childName, newLen, anchorName) {
            // Làm tròn 0.1m TRƯỚC khi dời để vị trí khớp đúng số ghi vào sheet
            const L = Math.round(Number(newLen) * 10) / 10;
            if (!isFinite(L) || L <= 0 || L > CL_MAX_LEN) return { error: 'len' };
            const byName = new Map();
            rows.forEach(r => { const n = String(r[1] || '').trim(); if (!n) return; if (!byName.has(n)) byName.set(n, []); byName.get(n).push(r); });
            if (!byName.has(childName)) return { error: 'no_row' };
            const parentName = String(byName.get(childName)[0][14] || '').trim();
            if (!parentName || !byName.has(parentName) || parentName === childName) return { error: 'no_parent' };
            // A ← B và B ← A: 2 cạnh gộp thành 1 trong đồ thị vô hướng → kiểm riêng
            if (byName.get(parentName).some(r => String(r[14] || '').trim() === childName)) return { error: 'cycle' };
            // Đồ thị vô hướng theo tên (cáp = cạnh child–parent)
            const adj = new Map();
            const link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
            byName.forEach((list, n) => list.forEach(r => {
                const p = String(r[14] || '').trim();
                if (p && p !== n && byName.has(p)) { link(n, p); link(p, n); }
            }));
            const component = (start, cutA, cutB) => {
                const seen = new Set([start]), q = [start];
                while (q.length) {
                    const cur = q.shift();
                    (adj.get(cur) || []).forEach(nb => {
                        if ((cur === cutA && nb === cutB) || (cur === cutB && nb === cutA) || seen.has(nb)) return;
                        seen.add(nb); q.push(nb);
                    });
                }
                return seen;
            };
            const childSide = component(childName, childName, parentName);
            if (childSide.has(parentName)) return { error: 'cycle' };
            const anchor = (anchorName && byName.has(anchorName)) ? anchorName : _clRootOf(childName, rows);
            const anchorOnChildSide = childSide.has(anchor) && anchor !== parentName;
            const fixed = anchorOnChildSide ? childName : parentName;
            const head = anchorOnChildSide ? parentName : childName;
            const moving = anchorOnChildSide ? component(parentName, childName, parentName) : childSide;
            // Đồ thị theo TÊN: dòng trùng tên chỉ an toàn khi là bản sao cùng 1 trụ (cách nhau ≤ 5m).
            // Trùng tên nhưng ở xa → là 2 trụ khác nhau, dời theo tên sẽ kéo nhầm trụ kia.
            const dup = [...moving, fixed].filter(n => {
                const list = byName.get(n);
                if (list.length < 2) return false;
                const la0 = _clNum(list[0][2]), lo0 = _clNum(list[0][3]);
                return list.some(r => !(_clDist(la0, lo0, _clNum(r[2]), _clNum(r[3])) <= 5));
            });
            if (dup.length) return { error: 'dup', names: dup };
            const A = byName.get(fixed)[0], B = byName.get(head)[0];
            const la = _clNum(A[2]), loa = _clNum(A[3]), lb = _clNum(B[2]), lob = _clNum(B[3]);
            if (![la, loa, lb, lob].every(isFinite)) return { error: 'bad_coord' };
            if (_clDist(la, loa, lb, lob) < 0.01) return { error: 'same' };
            const nb = _clToward(la, loa, lb, lob, L);
            const dLat = nb.lat - lb, dLon = nb.lon - lob;
            const moves = [];
            for (const n of moving) {
                for (const r of byName.get(n)) {
                    const rl = _clNum(r[2]), ro = _clNum(r[3]);
                    if (!isFinite(rl) || !isFinite(ro)) return { error: 'bad_coord' };
                    moves.push({ row: r, lat: rl + dLat, lon: ro + dLon });
                }
            }
            // Dòng của đoạn cáp vừa sửa (cột Khoảng cách ghi L) — chỉ dòng child có ĐÚNG Marker gốc này
            const edgeRows = byName.get(childName).filter(r => String(r[14] || '').trim() === parentName);
            return { fixed, head, moving: [...moving], moves, length: L, edgeRows };
        }

        // @@CABLELEN_END

        function _buildCableLines(rows) {
            const cycle = _detectCableCycle(rows);
            // Build set tên node thuộc vòng lặp (bỏ phần tử cuối trùng đầu)
            const cycleSet = new Set();
            if (cycle) {
                cycle.slice(0, -1).forEach(n => cycleSet.add(n));
                const chain = cycle.join(' → ');
                const _cycleFirstNode = cycle[0];
                console.error('[cable] Vòng lặp Marker gốc:', chain);
                displayError('⚠ Vòng lặp Marker gốc: ' + chain + ' — đoạn đỏ trên bản đồ, click để xóa.');
                // Cho phép click toast để nhảy đến vị trí vòng lặp
                (function() {
                    const el = document.getElementById('error');
                    if (!el) return;
                    el.style.pointerEvents = 'auto';
                    el.style.cursor = 'pointer';
                    // Kéo dài timeout 12s (thay vì 4s) để user kịp click
                    if (_toastTimer) clearTimeout(_toastTimer);
                    _toastTimer = setTimeout(function() {
                        el.style.display = 'none';
                        el.style.pointerEvents = '';
                        el.style.cursor = '';
                        el.onclick = null;
                    }, 12000);
                    el.onclick = function() {
                        const r = (loadedData || []).slice(1).find(function(row) {
                            return String(row[1] || '').trim() === _cycleFirstNode;
                        });
                        if (r) {
                            const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                            if (Number.isFinite(lat) && Number.isFinite(lon)) map.flyTo([lat, lon], 18);
                        }
                        el.style.pointerEvents = '';
                        el.style.cursor = '';
                        el.onclick = null;
                    };
                })();
                // KHÔNG return — vẫn vẽ toàn bộ, cycle segments tô đỏ
            }
            _removeCableLines();
            _cableLayerGroup = L.layerGroup().addTo(map);
            // posIdx từ TẤT CẢ marker (kể cả tủ cha nằm ngoài filter)
            const posIdx = {};
            ((loadedData || []).slice(1)).forEach(r => {
                const name = String(r[1] || '').trim();
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (name && Number.isFinite(lat) && Number.isFinite(lon)) posIdx[name] = [lat, lon];
            });
            let cableCount = 0;
            rows.forEach(r => {
                const parent = String(r[14] || '').trim();
                if (!parent) return;
                if (!posIdx[parent]) { console.warn('[cable] Không tìm thấy vị trí trụ cha:', parent); return; }
                const child = String(r[1] || '').trim();
                if (!child || !posIdx[child] || child === parent) return;
                const from = posIdx[parent], to = posIdx[child];
                // Segment thuộc cycle khi cả child lẫn parent đều trong cycleSet
                const isCycle = cycleSet.size > 0 && cycleSet.has(child) && cycleSet.has(parent);
                let lineColor, lineDash, lineWeight;
                if (isCycle) {
                    lineColor = '#ef4444'; lineDash = '6 4'; lineWeight = 3.5;
                } else {
                    const style = CABLE_STYLE[String(r[22] || 'noi')] || CABLE_STYLE.noi;
                    lineColor = style.color; lineDash = style.dashArray; lineWeight = 2.5;
                }
                const line = L.polyline([from, to], {
                    color: lineColor, weight: lineWeight, dashArray: lineDash, opacity: isCycle ? 1 : 0.8
                });
                line._cableRow = r;
                line._isCycle  = isCycle;
                line.addTo(_cableLayerGroup);
                if (_cableEditMode) _attachCableEditHandler(line);
                cableCount++;
                const distVal = String(r[15] || '').trim();
                const distLabel = distVal || String(haversineM(from[0], from[1], to[0], to[1]));
                const mid = [(from[0]+to[0])/2, (from[1]+to[1])/2];
                // v161: chế độ Sửa cáp → bấm nhãn số mét để sửa, trụ dời theo
                const editable = _cableEditMode && canDrag() && !isCycle;
                const lbl = L.marker(mid, {
                    icon: L.divIcon({ className: 'cable-label' + (editable ? ' cable-label-edit' : ''), html:`<span>${_esc(distLabel)}m</span>`, iconSize:null, iconAnchor:[20,10] }),
                    interactive: editable, keyboard: false, title: editable ? 'Bấm để sửa số mét — trụ sẽ dời theo' : ''
                }).addTo(_cableLayerGroup);
                if (editable) lbl.on('click', e => { L.DomEvent.stopPropagation(e); _openCableLengthEditor(child, mid); });
            });
            // Ghim trụ gốc đang chọn (đứng yên khi sửa số mét)
            if (_cableAnchor && posIdx[_cableAnchor]) {
                L.marker(posIdx[_cableAnchor], {
                    icon: L.divIcon({ className: '', html: '<div style="font-size:22px;line-height:1;transform:translate(-4px,-30px);">📌</div>', iconSize: [0, 0] }),
                    interactive: false, keyboard: false
                }).addTo(_cableLayerGroup);
            }
            if (cableCount === 0) {
                displayError('Không có đường cáp — hãy nhập cột "Marker gốc" cho các trụ để vẽ sơ đồ.');
            }
        }

        function _removeCableLines() {
            if (_cableLayerGroup) { map.removeLayer(_cableLayerGroup); _cableLayerGroup = null; }
        }

        function _attachCableEditHandler(line) {
            line.setStyle({ weight: 4, opacity: 1 });
            line.getElement && (line.getElement().style.cursor = 'pointer');
            line.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                _showCableContextMenu(e.latlng, line._cableRow, line._isCycle);
            });
        }

        function _showCableContextMenu(latlng, row, isCycle) {
            const childName  = String(row[1]  || '').trim();
            const parentName = String(row[14] || '').trim();
            const dist       = String(row[15] || '').trim();
            L.popup({ closeButton: true, className: 'cable-ctx-popup' })
                .setLatLng(latlng)
                .setContent(`
                    <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;">
                        Cáp: <span style="color:#1e40af;">${_esc(childName)}</span>
                        ← ${_esc(parentName)}${dist ? ' <span style="color:#64748b;">('+_esc(dist)+'m)</span>' : ''}
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <button id="_cableCtxXoa"
                            style="background:#ef4444;color:white;border:none;border-radius:5px;
                                   padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">
                            🗑 Xóa đoạn cáp này
                        </button>
                        <button id="_cableCtxDoi"
                            style="background:#1e40af;color:white;border:none;border-radius:5px;
                                   padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">
                            ↩ Đổi điểm gốc (trụ cha)
                        </button>
                        ${canDrag() && !isCycle ? `<button id="_cableCtxLen"
                            style="background:#f59e0b;color:white;border:none;border-radius:5px;
                                   padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">
                            📏 Sửa số mét (dời trụ)
                        </button>` : ''}
                    </div>
                `)
                .openOn(map);
            // Gán sự kiện sau khi popup đã render vào DOM (tránh lỗi dấu ngoặc kép trong onclick attr)
            setTimeout(() => {
                const btnXoa = document.getElementById('_cableCtxXoa');
                if (btnXoa) btnXoa.addEventListener('click', () => {
                    map.closePopup();
                    _deleteCableSegment(childName);
                });
                const btnDoi = document.getElementById('_cableCtxDoi');
                if (btnDoi) btnDoi.addEventListener('click', () => {
                    map.closePopup();
                    _pickParentMode(childName);
                });
                const btnLen = document.getElementById('_cableCtxLen');
                if (btnLen) btnLen.addEventListener('click', () => {
                    map.closePopup();
                    _openCableLengthEditor(childName, latlng);
                });
            }, 0);
        }

        let _cableAnchor = null;   // tên trụ đứng yên khi sửa số mét; null = gốc cây cáp (thường là tủ)

        function _cableAnchorLabelUpdate() {
            const el = document.getElementById('cableAnchorLabel');
            if (el) el.textContent = _cableAnchor || 'tủ';
        }

        function _onCableDataReload() {
            _cableAnchor = null;
            _cableAnchorLabelUpdate();
            try { _raUndo = null; } catch (_) { /* _raUndo khai báo phía sau — chưa khởi tạo thì không cần xoá */ }
        }

        function _toggleCableAnchor() {
            if (_cableAnchor) {
                _cableAnchor = null;
                _cableAnchorLabelUpdate();
                if (_cableVisible) _rebuildCableLines();
                displayInfo('Trụ gốc trở về mặc định: gốc của cây cáp (tủ).');
                return;
            }
            if (_pickParentActive) return;
            _pickParentActive = true;
            if (typeof closeControlsModal === 'function') closeControlsModal();
            displayInfo('Bấm vào 1 trụ/tủ để làm trụ gốc (đứng yên khi sửa số mét cáp). ESC để hủy.');
            map.getContainer().style.cursor = 'crosshair';
            const done = () => {
                map.off('click', onMapClick);
                document.removeEventListener('keydown', onEsc);
                _pickParentActive = false;
                map.getContainer().style.cursor = '';
            };
            const onMapClick = function(e) {
                const q = map.latLngToContainerPoint(e.latlng);
                let nearest = null, best = 40;
                markers.forEach(m => {
                    if (!m.marker || !m.marker._rowRef) return;
                    const p = map.latLngToContainerPoint(m.marker.getLatLng());
                    const d = Math.hypot(p.x - q.x, p.y - q.y);
                    if (d < best) { best = d; nearest = m.marker._rowRef; }
                });
                done();
                const name = nearest && String(nearest[1] || '').trim();
                if (!name) { displayError('Không tìm thấy trụ/tủ tại vị trí đó.'); return; }
                _cableAnchor = name;
                _cableAnchorLabelUpdate();
                if (_cableVisible) _rebuildCableLines();
                displaySuccess('Trụ gốc: ' + name + ' — đứng yên khi sửa số mét cáp.');
            };
            const onEsc = e => { if (e.key === 'Escape') done(); };
            map.on('click', onMapClick);
            document.addEventListener('keydown', onEsc);
        }

        function _openCableLengthEditor(childName, latlng) {
            if (!canDrag()) { displayError('Tài khoản hiện tại không có quyền dời marker.'); return; }
            const rows = _raAllRows();
            const row = rows.find(r => String(r[1] || '').trim() === childName);
            if (!row) return;
            const parentName = String(row[14] || '').trim();
            const p = rows.find(r => String(r[1] || '').trim() === parentName);
            const geo = p ? _clDist(parseCoord(row[2]), parseCoord(row[3]), parseCoord(p[2]), parseCoord(p[3])) : NaN;
            // Sheet locale VN có thể lưu "21,5" — input type=number chỉ nhận dấu chấm
            const cur = String(row[15] || '').trim().replace(',', '.') || (isFinite(geo) ? geo.toFixed(1) : '');
            // Trụ đứng yên tính đúng như lúc áp dụng (trụ gốc đã chọn không thuộc cây này → về gốc mặc định)
            const preview = _clPlanLength(rows, childName, isFinite(geo) && geo > 0 ? Math.min(geo, CL_MAX_LEN) : 1, _cableAnchor);
            const anchor = preview.fixed || _clRootOf(childName, rows);
            L.popup({ closeButton: true, className: 'cable-ctx-popup', minWidth: 220 })
                .setLatLng(latlng)
                .setContent(`
                    <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px;">📏 Cáp ${_esc(parentName)} — ${_esc(childName)}</div>
                    <label style="display:flex;align-items:center;gap:6px;">
                        <input id="_cableLenInput" type="number" inputmode="decimal" min="0.1" max="${CL_MAX_LEN}" step="0.1" value="${_esc(cur)}"
                            style="width:90px;min-height:40px;padding:4px 8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:16px;text-align:right;"> m
                    </label>
                    <div style="font-size:11px;color:#64748b;margin:6px 0;">Hiện đo trên bản đồ: ${isFinite(geo) ? geo.toFixed(1) + ' m' : '—'}<br>
                        📌 <b>${_esc(anchor)}</b> đứng yên — nhánh phía xa dời theo.</div>
                    <button id="_cableLenApply" style="width:100%;min-height:40px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-weight:800;cursor:pointer;">Áp dụng</button>
                `)
                .openOn(map);
            setTimeout(() => {
                const inp = document.getElementById('_cableLenInput');
                const btn = document.getElementById('_cableLenApply');
                const go = () => _applyCableLength(childName, inp ? inp.value : '');
                if (inp) { inp.focus(); inp.select(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
                if (btn) btn.addEventListener('click', go);
            }, 0);
        }

        async function _applyCableLength(childName, value) {
            if (!canDrag()) return;
            const L_ = parseFloat(String(value).replace(',', '.'));
            const rows = _raAllRows();
            const plan = _clPlanLength(rows, childName, L_, _cableAnchor);
            const msg = {
                len: `Số mét phải lớn hơn 0 và không quá ${CL_MAX_LEN} m.`,
                no_row: 'Không tìm thấy trụ ' + childName + '.',
                no_parent: 'Trụ ' + childName + ' chưa có cáp nối (Marker gốc).',
                cycle: 'Cáp có vòng lặp quanh ' + childName + ' — sửa Marker gốc trước.',
                same: 'Hai trụ trùng toạ độ — không xác định được hướng để dời.',
                bad_coord: 'Có trụ trong nhánh bị lỗi toạ độ — không dời được.',
                dup: 'Có trụ trùng tên ở 2 vị trí khác nhau (' + (plan.names || []).slice(0, 5).join(', ') + ') — đổi tên trước khi sửa cáp, nếu không sẽ dời nhầm trụ.'
            };
            if (plan.error) { displayError(msg[plan.error] || plan.error); return; }
            if (plan.moving.length > 30 && !confirm(`Sẽ dời ${plan.moving.length} trụ (cả nhánh phía ${plan.head}). Tiếp tục?`)) return;
            map.closePopup();
            _raClose();   // panel căn tuyến (nếu đang mở) sẽ bị thanh hoàn tác thay chỗ
            const L_r = plan.length;   // đã làm tròn 0.1m
            // Snapshot nguyên văn để hoàn tác: các dòng bị dời + dòng của đoạn cáp vừa sửa
            const edgeRows = plan.edgeRows;
            const affected = new Set([...plan.moves.map(m => m.row), ...edgeRows]);
            const snaps = [...affected].map(r => ({ row: r, vals: _RA_SNAP_COLS.map(c => r[c]) }));
            const tsNow = new Date().toLocaleString('vi-VN');
            plan.moves.forEach(m => {
                const r = m.row;
                r[2] = m.lat; r[3] = m.lon; r[13] = tsNow;
                const vn = convertLatLonToVn2000(m.lat, m.lon);
                r[19] = Math.round(vn.x); r[20] = Math.round(vn.y);
                dirtyMovedRows.add(r);
                _invalidatePopupCacheForRow(r);
                _raMoveMarker(r, m.lat, m.lon);
            });
            // Nhánh tịnh tiến nguyên khối → các đoạn trong nhánh giữ số mét; chỉ đoạn vừa sửa đổi
            edgeRows.forEach(r => { r[15] = L_r; r[13] = tsNow; dirtyMovedRows.add(r); _invalidatePopupCacheForRow(r); });
            updateDirtyMovedBadge();
            _raUndo = { snaps, applied: new Map(plan.moves.map(m => [m.row, [m.row[2], m.row[3]]])) };
            if (_cableVisible) _rebuildCableLines();
            const res = await pushMovedMarkersToSheet();
            const failed = res && res.failed;
            _raShowUndoBar(failed
                ? `Đã dời ${plan.moving.length} trụ trên app, nhưng ${failed} dòng chưa lên được sheet — bấm "Cập nhật" để thử lại.`
                : `Cáp ${childName} = ${L_r} m — đã dời ${plan.moving.length} trụ (${plan.fixed} đứng yên).`, !!failed);
        }

        function _deleteCableSegment(childName) {
            if (!Array.isArray(loadedData)) return;
            const row = loadedData.slice(1).find(r => String(r[1] || '').trim() === childName);
            if (!row) return;
            row[14] = ''; row[15] = '';
            syncRowToGAS(row, { silent: true });
            _rebuildCableLines();
            displaySuccess('Đã xóa đoạn cáp: ' + childName);
        }

        function _pickParentMode(childName) {
            if (_pickParentActive) return;
            _pickParentActive = true;
            displayInfo('Click vào trụ/tủ để đặt làm điểm gốc cáp cho ' + childName + '. Nhấn ESC để hủy.');
            map.getContainer().style.cursor = 'crosshair';
            const onMapClick = function(e) {
                let nearest = null, nearestDist = Infinity;
                const q = map.latLngToContainerPoint(e.latlng);
                // Tìm trong markersCluster (marker không nằm trực tiếp trên map)
                (markersCluster ? markersCluster.getLayers() : []).forEach(function(layer) {
                    if (layer instanceof L.Marker && layer._rowRef) {
                        const p = map.latLngToContainerPoint(layer.getLatLng());
                        const d = Math.hypot(p.x - q.x, p.y - q.y);
                        if (d < 40 && d < nearestDist) { nearest = layer; nearestDist = d; }
                    }
                });
                map.off('click', onMapClick);
                document.removeEventListener('keydown', onEsc);
                _pickParentActive = false;
                map.getContainer().style.cursor = '';
                if (!nearest) { displayError('Không tìm thấy trụ/tủ tại vị trí đó.'); return; }
                const newParentName = String(nearest._rowRef[1] || '').trim();
                if (!newParentName || newParentName === childName) return;
                const row = (loadedData || []).slice(1).find(r => String(r[1] || '').trim() === childName);
                if (!row) return;
                const pLat = parseCoord(nearest._rowRef[2]), pLon = parseCoord(nearest._rowRef[3]);
                const cLat = parseCoord(row[2]), cLon = parseCoord(row[3]);
                row[14] = newParentName;
                row[15] = (Number.isFinite(pLat) && Number.isFinite(cLat))
                    ? haversineM(cLat, cLon, pLat, pLon) : '';
                syncRowToGAS(row, { silent: true });
                _rebuildCableLines();
                displaySuccess('Đã đổi điểm gốc: ' + childName + ' ← ' + newParentName);
            };
            const onEsc = function(e) {
                if (e.key !== 'Escape') return;
                map.off('click', onMapClick);
                document.removeEventListener('keydown', onEsc);
                _pickParentActive = false;
                map.getContainer().style.cursor = '';
            };
            map.on('click', onMapClick);
            document.addEventListener('keydown', onEsc);
        }

        function _rebuildCableLines() {
            _buildCableLines(_getFilteredRows());
        }

        let _cableVisible = false;

        let _selectedTus = null;

        let _cableEditMode = false;

        let _pickParentActive = false;

        let _drawCableMode = false;

        let _cableDrawChild = null; // { name, lat, lon, row }

        function toggleDrawCableMode() {
            _drawCableMode = !_drawCableMode;
            _cableDrawChild = null;
            const btn = document.getElementById('btnDrawCable');
            if (btn) {
                btn.classList.toggle('active', _drawCableMode);
                btn.innerHTML = _drawCableMode
                    ? '<i class="fa fa-times-circle"></i> Hủy vẽ'
                    : '<i class="fa fa-plus-circle"></i> Vẽ cáp';
            }
            if (_drawCableMode) {
                displayError('Chế độ vẽ cáp: click vào trụ CON trước, sau đó click vào trụ/tủ GỐC');
            }
        }

        function setCableChild() {
            const row = _currentPopupRow;
            if (!row) return;
            const lat = parseCoord(row[2]), lon = parseCoord(row[3]);
            _cableDrawChild = { name: String(row[1] || ''), lat, lon, row };
            map.closePopup();
            displayError('Đã chọn trụ con: ' + _cableDrawChild.name + ' — click vào trụ/tủ GỐC để nối cáp');
        }

        async function setCableParent() {
            if (!_cableDrawChild) return;
            const row = _currentPopupRow;
            if (!row) return;
            const parentName = String(row[1] || '');
            if (parentName === _cableDrawChild.name) { displayError('Không thể nối trụ vào chính nó.'); return; }
            const parentLat = parseCoord(row[2]), parentLon = parseCoord(row[3]);
            const dist = haversineM(_cableDrawChild.lat, _cableDrawChild.lon, parentLat, parentLon);
            const childRow = _cableDrawChild.row;
            childRow[14] = parentName;
            childRow[15] = String(dist);
            map.closePopup();
            const ok = await syncRowToGAS(childRow, { silent: false });
            if (ok !== false && _cableVisible) _rebuildCableLines();
            displayError('✓ Nối cáp: ' + _cableDrawChild.name + ' → ' + parentName + ' (' + dist + 'm)');
            _cableDrawChild = null;
            // Giữ chế độ để vẽ tiếp, không tự thoát
        }

        function _setCableToolbar(visible) {
            const tb = document.getElementById('cableToolbar');
            if (tb) tb.style.display = visible ? 'grid' : 'none';
            if (!visible && _drawCableMode) toggleDrawCableMode();
        }

        function toggleCableLayer() {
            if (_cableVisible) {
                _cableVisible = false;
                _removeCableLines();
                const btn = document.getElementById('btnToggleCable');
                if (btn) btn.classList.remove('active');
                _setCableToolbar(false);
                return;
            }
            // Cables OFF → vẽ ngay theo bộ lọc hiện tại
            const rows = _getFilteredRows();
            if (!rows.length) { displayError('Bộ lọc hiện tại không có dữ liệu để vẽ sơ đồ cáp.'); return; }
            _buildCableLines(rows);
            _cableVisible = true;
            const btn = document.getElementById('btnToggleCable');
            if (btn) btn.classList.add('active');
            _setCableToolbar(true);
        }

        function _onOutsideCableDropdown(e) {
            const dd = document.getElementById('cableDropdown');
            if (!dd) return;
            if (!dd.contains(e.target) && e.target.id !== 'btnToggleCable') {
                dd.style.display = 'none';
            } else {
                document.addEventListener('click', _onOutsideCableDropdown, { capture: true, once: true });
            }
        }

        function toggleAllTuCbs(checked) {
            document.querySelectorAll('.cb-tu').forEach(cb => cb.checked = checked);
        }

        function onTuCbChange() {
            const all = [...document.querySelectorAll('.cb-tu')].every(cb => cb.checked);
            const cbAll = document.getElementById('cbAllTus');
            if (cbAll) cbAll.checked = all;
        }

        function drawSelectedCables() {
            _buildCableLines(_getFilteredRows());
            _cableVisible = true;
            const btn = document.getElementById('btnToggleCable');
            if (btn) btn.classList.add('active');
            _setCableToolbar(true);
        }

        function toggleCableEditMode() {
            _cableEditMode = !_cableEditMode;
            const btn = document.getElementById('btnCableEdit');
            if (btn) {
                btn.classList.toggle('active', _cableEditMode);
                btn.innerHTML = _cableEditMode
                    ? '<i class="fa fa-pencil"></i> Đang sửa cáp'
                    : '<i class="fa fa-pencil"></i> Sửa cáp';
            }
            _rebuildCableLines();
        }
