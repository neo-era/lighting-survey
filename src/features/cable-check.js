// Kiểm tra sơ đồ cáp — lỗi cáp, Theo tủ (xoá / chạy lại tối ưu), trụ tên "XÓA"
// Tách từ index.html (đợt 1 module hoá, v173) — chỉ cắt/dán, KHÔNG đổi logic.
// Classic script (không phải ES module): hàm + let/const cấp cao nhất là toàn cục, dùng chung với các script khác;
// các onclick="..." trong index.html gọi thẳng các hàm này. Nạp TRƯỚC khối <script> chính (xem index.html).
// Khi nạp chỉ khai báo hàm/hằng + gắn window — mọi tham chiếu sang biến của script chính đều nằm trong thân hàm.

        // ═══════════════════════════════════════════════════════════════════
        // Kiểm tra cáp dài vô lý
        // Xóa cáp = clear row[14] (Marker gốc) + row[15] (Khoảng cách) → sync GAS
        // ═══════════════════════════════════════════════════════════════════
        let _lcHighlightLayer = null;

        // ─── v168 — Xoá toàn bộ tuyến cáp của 1 tủ + chạy lại tối ưu (modal Kiểm tra sơ đồ cáp) ───
        // @@TUCABLE_START
        const _rowHasCoord = r => isFinite(parseCoord(r[2])) && isFinite(parseCoord(r[3]));
        // Map tên → dòng; trùng tên thì ưu tiên dòng CÓ toạ độ (dòng import trùng tên thường trống toạ độ)
        function _rowMapByNamePreferCoord(rows) {
            const m = new Map();
            for (const r of rows) {
                const k = String(r[1] || '').trim();
                if (!k) continue;
                const cur = m.get(k);
                if (!cur || (!_rowHasCoord(cur) && _rowHasCoord(r))) m.set(k, r);
            }
            return m;
        }
        // Các dòng thuộc tủ (cột Tủ điều khiển) đang có cáp (Marker gốc hoặc Khoảng cách) — gồm cả dòng trùng tên
        // tuNames: 1 tên (string) hoặc nhiều tên (Array/Set)
        function _tuCablePlan(rows, tuNames) {
            const list = (typeof tuNames === 'string' ? [tuNames] : [...(tuNames || [])]).map(t => String(t || '').trim()).filter(Boolean);
            const set = new Set(list);
            const tu = list.length === 1 ? list[0] : list.join(', ');
            const inTu = set.size ? rows.filter(r => set.has(String(r[7] || '').trim())) : [];
            const targets = inTu.filter(r => String(r[14] || '').trim() !== '' || String(r[15] || '').trim() !== '');
            const withCoord = targets.filter(_rowHasCoord).length;
            const poles = new Set(inTu.filter(r => { const t = parseInt(r[6]); return t >= 1 && t <= 4; })
                .map(r => String(r[1] || '').trim()));
            return { tu, tus: list, targets, withCoord, noCoord: targets.length - withCoord, rowCount: inTu.length, poleCount: poles.size };
        }
        // Xoá cáp tại chỗ; trả snapshot để hoàn tác (giữ tham chiếu dòng + ID)
        function _tuCableClearApply(plan, nowIso) {
            const snap = plan.targets.map(r => ({ row: r, id: String(r[0] || ''), p: r[14], d: r[15], c: r[13] }));
            for (const r of plan.targets) { r[14] = ''; r[15] = ''; r[13] = nowIso; }
            return snap;
        }
        function _tuCableUndoApply(snap) {
            for (const s of snap) { s.row[14] = s.p; s.row[15] = s.d; s.row[13] = s.c; }
            return snap.map(s => s.row);
        }
        // v172 — trụ đặt tên tạm "XÓA" (nhập liệu đánh dấu bỏ): khớp đúng cả tên, không phân biệt hoa thường/dấu
        const _isXoaName = n => normalizeText(String(n || '').trim()) === 'xoa';
        function _xoaPlan(rows) {
            const del = rows.filter(r => _isXoaName(r[1]));
            const delSet = new Set(del);
            const children = rows.filter(r => !delSet.has(r) && _isXoaName(r[14]));
            const byTu = {};
            del.forEach(r => { const t = String(r[7] || '').trim() || '(chưa gán tủ)'; byTu[t] = (byTu[t] || 0) + 1; });
            // Dòng có ID xoá trước (khớp theo ID), dòng không ID sau (GAS khớp theo tên)
            const order = del.filter(r => String(r[0] || '').trim()).concat(del.filter(r => !String(r[0] || '').trim()));
            return { del: order, children, byTu };
        }
        function _rowsToCsv(header, rows) {
            const q = v => { const t = v == null ? '' : String(v); return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
            return [header, ...rows].map(r => r.map(q).join(',')).join('\r\n');
        }
        // @@TUCABLE_END

        function _lcXoaRender() {
            const bar = document.getElementById('lcXoaBar');
            if (!bar) return;
            const plan = _xoaPlan((loadedData || []).slice(1));
            if (!plan.del.length) { bar.style.display = 'none'; return; }
            bar.style.display = 'flex';
            const tus = Object.entries(plan.byTu).map(([t, n]) => `${_esc(t)} (${n})`).join(', ');
            const info = document.getElementById('lcXoaInfo');
            if (info) info.innerHTML = `⚠ Có <b>${plan.del.length} trụ tên "XÓA"</b> — ${tus}` +
                (plan.children.length ? ` · ${plan.children.length} trụ khác đang lấy "XÓA" làm Marker gốc` : '');
            const btn = document.getElementById('lcXoaBtn');
            if (btn) {
                const admin = _lcTuIsAdmin();
                btn.disabled = !admin || _lcTuBusy;
                btn.title = admin ? '' : 'Chỉ admin được xoá dòng khỏi sheet';
                btn.textContent = `🗑 Xoá ${plan.del.length} trụ tên XÓA…`;
            }
        }
        async function _lcXoaDelete() {
            if (_lcTuBusy) return;
            if (!_lcTuIsAdmin()) { displayError && displayError('Chỉ admin được xoá dòng khỏi sheet.'); return; }
            const plan = _xoaPlan((loadedData || []).slice(1));
            if (!plan.del.length) return;
            const tus = Object.entries(plan.byTu).map(([t, n]) => `• ${t}: ${n}`).join('\n');
            const msg = `XOÁ HẲN ${plan.del.length} dòng tên "XÓA" khỏi sheet ${currentSheet || ''}?\n${tus}\n\n` +
                (plan.children.length ? `• ${plan.children.length} trụ khác đang lấy "XÓA" làm Marker gốc → xoá trống Marker gốc + Khoảng cách (không xoá trụ)\n` : '') +
                `• Tự tải file backup CSV trước khi xoá\n• KHÔNG hoàn tác trong app (khôi phục bằng Nhập CSV từ file backup)\n\nGõ XOA để xác nhận:`;
            const typed = typeof uiPrompt === 'function' ? await uiPrompt(msg, '') : prompt(msg);
            if (String(typed || '').trim().toUpperCase() !== 'XOA') {
                if (typed != null) displayError && displayError('Chưa gõ đúng "XOA" — không xoá.');
                return;
            }
            _lcTuBusy = true; _lcXoaRender(); _lcTuUpdate();
            const btn = document.getElementById('lcXoaBtn');
            let ok = 0, failed = 0;
            const deleted = [];
            try {
                // 1. Backup
                const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const csv = _rowsToCsv(loadedData[0] || [], plan.del.concat(plan.children));
                _saveBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `backup-xoa-${currentSheet || 'sheet'}-${stamp}.csv`);
                // 2. Trụ con: bỏ gốc "XÓA"
                if (plan.children.length) {
                    const now = new Date().toISOString();
                    plan.children.forEach(r => { r[14] = ''; r[15] = ''; r[13] = now; if (typeof _invalidatePopupCacheForRow === 'function') _invalidatePopupCacheForRow(r); });
                    await _batchSyncRowsToGAS(plan.children, ['markerGoc', 'khoangCach', 'capNhat']);
                }
                // 3. Xoá từng dòng (ID trước, không ID sau)
                for (let i = 0; i < plan.del.length; i++) {
                    const r = plan.del[i];
                    if (btn) btn.textContent = `⏳ Đang xoá ${i + 1}/${plan.del.length}...`;
                    try {
                        const resp = await fetch(KHAOSAT_GAS_URL, { method: 'POST',
                            body: JSON.stringify({ action: 'delete_row', sheet: currentSheet, id: String(r[0] || '').trim(), tenTru: String(r[1] || '').trim() }) });
                        const json = await resp.json();
                        if (json && json.status === 'ok') { ok++; deleted.push(r); } else failed++;
                    } catch (e) { failed++; }
                }
                // 4. Gỡ khỏi dữ liệu cục bộ (CSV publish trễ vài phút → không tải lại ngay)
                const gone = new Set(deleted);
                [loadedData, typeof newMarkerRows !== 'undefined' ? newMarkerRows : null].forEach(arr => {
                    if (!Array.isArray(arr)) return;
                    for (let k = arr.length - 1; k >= 0; k--) if (gone.has(arr[k])) arr.splice(k, 1);
                });
                if (typeof addMarkersToMap === 'function') addMarkersToMap(loadedData.slice(1), { fitView: false });
                try { _logAction && _logAction('delete_xoa_rows', '', currentSheet || '', JSON.stringify({ ok, failed, children: plan.children.length, byTu: plan.byTu })); } catch (e) { _swallow(e); }
            } finally {
                _lcTuBusy = false;
                await _lcTuAfterChange();
                _lcXoaRender();
            }
            (failed ? displayError : displayInfo)(`🗑 Đã xoá ${ok}/${plan.del.length} trụ tên "XÓA"` + (failed ? ` · lỗi ${failed} (bấm lại để thử tiếp)` : '') + ' · đã tải file backup CSV');
        }
        window._lcXoaDelete = _lcXoaDelete;

        const LC_TU_BIG = 10;          // ≥ 10 tủ (hoặc tất cả) → chỉ admin + gõ "XOA"
        const LC_TU_MST_WARN = 50;     // > 50 tủ → báo xem trước Auto MST có thể chậm
        let _lcTuUndoState = null;     // { tus, snap }
        let _lcTuBusy = false;
        const _lcTuSel = new Set();    // tủ đang chọn
        let _lcTuStatsCache = null;    // Map tủ → { poles, rows, cables }
        function _lcTuStats() {
            if (_lcTuStatsCache) return _lcTuStatsCache;
            const m = new Map();
            for (const r of (loadedData || []).slice(1)) {
                const t = String(r[7] || '').trim();
                if (!t) continue;
                if (!m.has(t)) m.set(t, { poles: new Set(), rows: 0, cables: 0 });
                const st = m.get(t);
                st.rows++;
                const ty = parseInt(r[6]);
                if (ty >= 1 && ty <= 4) st.poles.add(String(r[1] || '').trim());
                if (String(r[14] || '').trim() !== '' || String(r[15] || '').trim() !== '') st.cables++;
            }
            return (_lcTuStatsCache = m);
        }
        function _lcTuCabinets() {
            return [..._lcTuStats().keys()].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
        }
        const _lcTuIsAdmin = () => !!(typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin');
        const _lcTuIsBig = () => { const n = _lcTuCabinets().length; return _lcTuSel.size >= LC_TU_BIG || (n > 1 && _lcTuSel.size === n); };
        function _lcTuInit() {
            _lcTuStatsCache = null;
            _lcXoaRender();
            const all = new Set(_lcTuCabinets());
            for (const t of [..._lcTuSel]) if (!all.has(t)) _lcTuSel.delete(t);   // đổi địa bàn → bỏ tủ không còn
            _lcTuRenderList();
            _lcTuUpdate();
        }
        function _lcTuFiltered() {
            const inp = document.getElementById('lcTuFilter');
            const q = normalizeTextSearchable(inp ? inp.value : '');
            const all = _lcTuCabinets();
            return q ? all.filter(t => normalizeTextSearchable(t).includes(q)) : all;
        }
        function _lcTuRenderList() {
            const box = document.getElementById('lcTuListBox');
            if (!box) return;
            const stats = _lcTuStats(), list = _lcTuFiltered();
            const fi = document.getElementById('lcTuFilterInfo');
            if (fi) fi.textContent = `${list.length}/${stats.size} tủ`;
            box.innerHTML = list.length ? list.map(t => {
                const st = stats.get(t);
                const on = _lcTuSel.has(t);
                return `<label role="option" aria-selected="${on}" style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #f1f5f9;cursor:pointer;min-height:36px;">
                    <input type="checkbox" data-tu="${_esc(t)}" ${on ? 'checked' : ''} onchange="_lcTuToggle(this.dataset.tu, this.checked)" style="width:18px;height:18px;">
                    <span style="flex:1;font-weight:600;">${_esc(t)}</span>
                    <span style="font-size:11px;color:${st.cables ? '#475569' : '#94a3b8'};">${st.poles.size} trụ · ${st.cables} cáp</span></label>`;
            }).join('') : '<div style="padding:10px;color:#94a3b8;">Không có tủ khớp.</div>';
        }
        function _lcTuToggle(tu, on) {
            if (on) _lcTuSel.add(tu); else _lcTuSel.delete(tu);
            _lcTuUpdate();
        }
        function _lcTuSelectAll(on) {
            for (const t of _lcTuFiltered()) { if (on) _lcTuSel.add(t); else _lcTuSel.delete(t); }
            _lcTuRenderList();
            _lcTuUpdate();
        }
        function _lcTuTogglePanel(force) {
            const pn = document.getElementById('lcTuPanel'), tg = document.getElementById('lcTuToggle');
            if (!pn) return;
            const open = force != null ? !!force : pn.style.display === 'none';
            pn.style.display = open ? 'block' : 'none';
            if (tg && tg.setAttribute) tg.setAttribute('aria-expanded', String(open));
            if (open) { _lcTuRenderList(); const f = document.getElementById('lcTuFilter'); if (f && f.focus) f.focus(); }
        }
        // Đóng danh sách khi bấm ra ngoài / Esc
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('click', e => {
                const pn = document.getElementById('lcTuPanel'), bar = document.getElementById('lcTuBar');
                if (!e.target || e.target.isConnected === false) return;   // phần tử vừa bấm bị vẽ lại (Chọn tất cả) → không coi là bấm ra ngoài
                if (pn && pn.style.display !== 'none' && bar && e.target && !bar.contains(e.target)) _lcTuTogglePanel(false);
            });
            document.addEventListener('keydown', e => {
                const pn = document.getElementById('lcTuPanel');
                if (e.key === 'Escape' && pn && pn.style.display !== 'none') { _lcTuTogglePanel(false); e.stopPropagation(); }
            }, true);
        }
        // Cập nhật nhãn nút chọn, dòng tổng, trạng thái nút. Trả danh sách tủ đang chọn.
        function _lcTuUpdate() {
            const tus = [..._lcTuSel].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
            const n = _lcTuCabinets().length;
            const tg = document.getElementById('lcTuToggle');
            if (tg) tg.textContent = (tus.length === 0 ? 'Chọn tủ' : tus.length === 1 ? tus[0]
                : (n > 1 && tus.length === n ? `Tất cả (${n} tủ)` : `${tus.length} tủ đã chọn`)) + ' ▾';
            const info = document.getElementById('lcTuInfo');
            const plan = tus.length ? _tuCablePlan((loadedData || []).slice(1), tus) : null;
            if (info) info.textContent = plan ? `${tus.length} tủ · ${plan.poleCount} trụ · ${plan.targets.length} cáp` : '—';
            const canEdit_ = typeof canEdit !== 'function' || canEdit();
            const big = _lcTuIsBig(), adminOk = !big || _lcTuIsAdmin();
            const on = !!plan && !_lcTuBusy && canEdit_;
            const set = (id, v, tip) => { const b = document.getElementById(id); if (b) { b.disabled = !v; b.title = tip || ''; } };
            const tipBig = adminOk ? '' : `Chọn từ ${LC_TU_BIG} tủ trở lên / tất cả — chỉ admin được xoá`;
            set('lcTuBtnClear', on && plan.targets.length > 0 && adminOk, tipBig);
            set('lcTuBtnBoth', on && plan.targets.length > 0 && adminOk, tipBig);
            set('lcTuBtnRerun', on);
            return tus;
        }
        function _lcTuSet(tu) {   // bấm 📍 dòng lỗi → THÊM tủ vào lựa chọn
            if (!tu || !_lcTuStats().has(tu)) return;
            _lcTuSel.add(tu);
            _lcTuRenderList();
            _lcTuUpdate();
        }
        async function _lcTuAfterChange() {
            _lcTuStatsCache = null;
            _lcClearHighlight();
            if (_cableVisible && typeof _rebuildCableLines === 'function') _rebuildCableLines();
            _lcRefreshList();
            _lcTuRenderList();
            _lcTuUpdate();
        }
        async function _lcTuSync(rows, label) {
            if (!rows.length) return { updated: 0, failed: 0, notFound: 0 };
            const btn = document.getElementById('lcTuBtnClear');
            return await _batchSyncRowsToGAS(rows, ['markerGoc', 'khoangCach', 'capNhat'], (done, tot) => {
                if (btn) btn.textContent = `⏳ ${label} ${done}/${tot}...`;
            });
        }
        // rerunAfter = true → xoá xong mở Auto MST cho các tủ này
        async function _lcTuClear(rerunAfter) {
            if (_lcTuBusy) return;
            const tus = _lcTuUpdate();
            if (!tus.length) { displayError && displayError('Chọn ít nhất 1 tủ.'); return; }
            const big = _lcTuIsBig();
            if (big && !_lcTuIsAdmin()) { displayError && displayError(`Xoá cáp từ ${LC_TU_BIG} tủ trở lên / tất cả tủ — chỉ admin.`); return; }
            const plan = _tuCablePlan((loadedData || []).slice(1), tus);
            if (!plan.targets.length) { displayInfo && displayInfo('Các tủ đã chọn không còn cáp nào.'); if (rerunAfter) _lcTuRerun(); return; }
            const names = tus.slice(0, 10).map(t => '• ' + t).join('\n') + (tus.length > 10 ? `\n• … và ${tus.length - 10} tủ khác` : '');
            const msg = `Xoá toàn bộ cáp của ${tus.length} tủ?\n${names}\n\n• ${plan.targets.length} đoạn cáp (${plan.withCoord} dòng có toạ độ + ${plan.noCoord} dòng không toạ độ / trùng tên)\n• CLEAR "Marker gốc" + "Khoảng cách" — KHÔNG xoá trụ\n• Ghi Google Sheet ngay, có nút Hoàn tác` + (rerunAfter ? '\n\nXoá xong sẽ mở Auto MST để chạy lại tuyến tối ưu.' : '');
            let okGo;
            if (big) {
                const typed = typeof uiPrompt === 'function' ? await uiPrompt(msg + '\n\nGõ XOA để xác nhận:', '') : prompt(msg + '\n\nGõ XOA để xác nhận:');
                okGo = String(typed || '').trim().toUpperCase() === 'XOA';
                if (!okGo && typed != null) displayError && displayError('Chưa gõ đúng "XOA" — không xoá.');
            } else {
                okGo = typeof uiConfirm === 'function' ? await uiConfirm(msg) : confirm(msg);
            }
            if (!okGo) return;
            _lcTuBusy = true; _lcTuUpdate();
            const btn = document.getElementById('lcTuBtnClear');
            const orig = btn ? btn.textContent : '';
            let res = null;
            try {
                const snap = _tuCableClearApply(plan, new Date().toISOString());
                plan.targets.forEach(r => { if (typeof _invalidatePopupCacheForRow === 'function') _invalidatePopupCacheForRow(r); });
                // Bật Hoàn tác TRƯỚC khi ghi sheet — ghi lỗi giữa chừng vẫn khôi phục được
                _lcTuUndoState = { tus, snap };
                const ub = document.getElementById('lcTuBtnUndo');
                if (ub) { ub.style.display = ''; ub.textContent = `↩ Hoàn tác (${tus.length === 1 ? tus[0] : tus.length + ' tủ'})`; }
                res = await _lcTuSync(plan.targets, 'Đang xoá');
                try { _logAction && _logAction('delete_tu_cables', '', currentSheet || '', JSON.stringify({ tus, count: plan.targets.length, ids: snap.map(s => s.id) })); } catch (e) { _swallow(e); }
            } finally {
                _lcTuBusy = false;
                if (btn) btn.textContent = orig;
                await _lcTuAfterChange();
            }
            if (!res) return;   // lỗi ghi sheet đã ném ra ngoài — không báo "đã xoá"
            const bad = (res.failed || 0) + (res.notFound || 0);
            (bad ? displayError : displayInfo)(`🗑 ${tus.length} tủ: đã xoá ${plan.targets.length} cáp · ghi sheet ${res.updated || 0}/${plan.targets.length}` + (bad ? ` · lỗi ${bad}` : ''));
            if (rerunAfter) _lcTuRerun();
        }
        async function _lcTuUndo() {
            const st = _lcTuUndoState;
            if (!st || _lcTuBusy) return;
            _lcTuBusy = true;
            let res;
            try {
                const rows = _tuCableUndoApply(st.snap);
                rows.forEach(r => { if (typeof _invalidatePopupCacheForRow === 'function') _invalidatePopupCacheForRow(r); });
                res = await _lcTuSync(rows, 'Hoàn tác');
                _lcTuUndoState = null;
                const ub = document.getElementById('lcTuBtnUndo');
                if (ub) ub.style.display = 'none';
                try { _logAction && _logAction('undo_delete_tu_cables', '', currentSheet || '', JSON.stringify({ tus: st.tus, count: rows.length })); } catch (e) { _swallow(e); }
            } finally {
                _lcTuBusy = false;
                await _lcTuAfterChange();
            }
            if (res) displayInfo && displayInfo(`↩ Đã khôi phục ${st.snap.length} cáp của ${st.tus.length} tủ · ghi sheet ${res.updated || 0}`);
        }
        function _lcTuRerun() {
            const tus = _lcTuUpdate();
            if (!tus.length) return;
            if (tus.length > LC_TU_MST_WARN) displayInfo && displayInfo(`Đang tính tuyến tối ưu cho ${tus.length} tủ — xem trước có thể mất vài giây...`);
            _closeLongCableCheck();
            _openAutoMstModal('tu');
            const sel = document.getElementById('mstTuSelect');
            if (sel) {
                const want = new Set(tus);
                Array.from(sel.options).forEach(o => { o.selected = want.has(o.value); });
                _onMstTuChange();
                if (typeof _mstDoPreview === 'function') _mstDoPreview();
            }
        }
        window._lcTuClear = _lcTuClear; window._lcTuUndo = _lcTuUndo; window._lcTuRerun = _lcTuRerun;
        window._lcTuToggle = _lcTuToggle; window._lcTuSelectAll = _lcTuSelectAll;
        window._lcTuTogglePanel = _lcTuTogglePanel; window._lcTuRenderList = _lcTuRenderList;

        function _openLongCableCheck() {
            const modal = document.getElementById('longCableModal');
            if (!modal) return;
            if (!Array.isArray(loadedData) || loadedData.length < 2) {
                displayError && displayError('Chưa có dữ liệu marker');
                return;
            }
            modal.style.display = 'flex';
            if (typeof closeControlsModal === 'function') closeControlsModal();
            _lcRefreshList();
            _lcTuInit();
        }
        window._openLongCableCheck = _openLongCableCheck;

        function _closeLongCableCheck() {
            const modal = document.getElementById('longCableModal');
            if (modal) modal.style.display = 'none';
            _lcClearHighlight();
        }
        window._closeLongCableCheck = _closeLongCableCheck;

        function _lcClearHighlight() {
            if (_lcHighlightLayer) {
                try { map.removeLayer(_lcHighlightLayer); } catch(e){_swallow(e);}
                _lcHighlightLayer = null;
            }
        }

        // 9 loại vấn đề cáp
        const CABLE_ISSUE_TYPES = {
            long:       { label: '🔴 Dài',            color: '#dc2626', bg: '#fef2f2', priority: 2, actionable: true },
            haversine:  { label: '🟠 Distance',       color: '#ea580c', bg: '#fff7ed', priority: 2, actionable: true },
            cycle:      { label: '🟣 Vòng lặp',       color: '#9333ea', bg: '#faf5ff', priority: 3, actionable: true },
            self:       { label: '🔵 Trỏ chính',      color: '#2563eb', bg: '#eff6ff', priority: 3, actionable: true },
            orphan:     { label: '⚫ Cha không có',    color: '#525252', bg: '#f5f5f5', priority: 3, actionable: true },
            cross:      { label: '🟢 Khác tủ',        color: '#16a34a', bg: '#f0fdf4', priority: 1, actionable: true },
            fanout:     { label: '🟡 Fan-out',        color: '#d97706', bg: '#fffbeb', priority: 1, actionable: false },
            dup:        { label: '🟤 Trùng tên',      color: '#78350f', bg: '#fef3c7', priority: 3, actionable: false },
            suboptimal: { label: '🟪 Parent xa',      color: '#7c3aed', bg: '#f5f3ff', priority: 2, actionable: false }
        };

        // Build reverse tree: node → Set of all downstream descendants (dùng cho suboptimal check tránh cycle)
        function _buildDescendantsMap(rows) {
            const children = new Map(); // parent → [children names]
            rows.forEach(r => {
                const c = String(r[1] || '').trim();
                const p = String(r[14] || '').trim();
                if (!c || !p) return;
                if (!children.has(p)) children.set(p, []);
                children.get(p).push(c);
            });
            const cache = new Map();
            function walk(node, seen) {
                if (cache.has(node)) return cache.get(node);
                if (seen.has(node)) return new Set(); // cycle protect
                seen.add(node);
                const out = new Set();
                const kids = children.get(node) || [];
                for (const k of kids) {
                    out.add(k);
                    const sub = walk(k, seen);
                    sub.forEach(s => out.add(s));
                }
                seen.delete(node);
                cache.set(node, out);
                return out;
            }
            const result = new Map();
            children.forEach((_, node) => result.set(node, walk(node, new Set())));
            // Nodes có parent nhưng không có child → chưa được touch
            rows.forEach(r => {
                const c = String(r[1] || '').trim();
                if (c && !result.has(c)) result.set(c, new Set());
            });
            return result;
        }

        function _getCableIssues(opts) {
            const rows = (loadedData || []).slice(1);
            const posIdx = {};
            const nameToTu = {};
            const rowByName = new Map();
            const rowsByName = new Map(); // 🟤 track duplicates
            rows.forEach(r => {
                const name = String(r[1] || '').trim();
                if (!name) return;
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (Number.isFinite(lat) && Number.isFinite(lon)) posIdx[name] = [lat, lon];
                nameToTu[name] = String(r[7] || '').trim();
                rowByName.set(name, r);
                if (!rowsByName.has(name)) rowsByName.set(name, []);
                rowsByName.get(name).push(r);
            });

            // Detect cycle (reuse existing helper)
            const cycle = typeof _detectCableCycle === 'function' ? _detectCableCycle(rows) : null;
            const cycleSet = new Set(cycle || []);

            // Children per parent (for fanout)
            const childrenByParent = {};
            rows.forEach(r => {
                const p = String(r[14] || '').trim();
                if (p) {
                    if (!childrenByParent[p]) childrenByParent[p] = [];
                    childrenByParent[p].push(String(r[1] || '').trim());
                }
            });

            const results = [];
            rows.forEach(r => {
                const child = String(r[1] || '').trim();
                const parent = String(r[14] || '').trim();
                if (!child || !parent) return;

                // 1. Self-reference
                if (child === parent) {
                    results.push({
                        row: r, type: 'self', childName: child, parentName: parent,
                        distance: 0, info: 'Trỏ về chính nó',
                        from: posIdx[child], to: posIdx[child]
                    });
                    return;
                }

                // 2. Orphan (parent không tồn tại)
                if (!rowByName.has(parent)) {
                    results.push({
                        row: r, type: 'orphan', childName: child, parentName: parent,
                        distance: 0, info: `Trụ cha không tồn tại trong sheet`,
                        from: posIdx[child], to: posIdx[child]
                    });
                    return;
                }

                const fromLL = posIdx[parent];
                const toLL = posIdx[child];
                const haveGeo = fromLL && toLL;
                const havDist = haveGeo ? Math.round(haversineM(fromLL[0], fromLL[1], toLL[0], toLL[1])) : null;
                let sheetDist = parseFloat(r[15]);
                const hasSheetDist = isFinite(sheetDist) && sheetDist > 0;
                const displayDist = hasSheetDist ? Math.round(sheetDist) : (havDist || 0);

                // 3. Cycle
                if (cycleSet.has(child) && cycleSet.has(parent)) {
                    results.push({
                        row: r, type: 'cycle', childName: child, parentName: parent,
                        distance: displayDist, info: `Trong vòng: ${(cycle || []).join(' → ')}`.slice(0, 80),
                        from: fromLL, to: toLL
                    });
                    // Cycle nghiêm trọng — skip check khác cho row này
                    return;
                }

                // 4. Cáp dài
                if (displayDist > opts.thresholdLong) {
                    results.push({
                        row: r, type: 'long', childName: child, parentName: parent,
                        distance: displayDist, info: `Vượt ngưỡng ${opts.thresholdLong}m`,
                        from: fromLL, to: toLL
                    });
                }

                // 5. Distance sheet vs Haversine chênh nhiều
                if (haveGeo && hasSheetDist && havDist > 10 && sheetDist > 10) {
                    const ratio = Math.max(havDist, sheetDist) / Math.min(havDist, sheetDist);
                    if (ratio >= opts.ratioHaversine) {
                        results.push({
                            row: r, type: 'haversine', childName: child, parentName: parent,
                            distance: displayDist,
                            info: `Sheet=${Math.round(sheetDist)}m vs Thực=${havDist}m (chênh ${ratio.toFixed(1)}×)`,
                            from: fromLL, to: toLL
                        });
                    }
                }

                // 6. Cross-cabinet (parent thuộc tủ khác)
                const tuChild = nameToTu[child];
                const tuParent = nameToTu[parent];
                if (tuChild && tuParent && tuChild !== tuParent) {
                    results.push({
                        row: r, type: 'cross', childName: child, parentName: parent,
                        distance: displayDist,
                        info: `Con:${tuChild} → Cha:${tuParent}`,
                        from: fromLL, to: toLL
                    });
                }
            });

            // 7. Fan-out (parent có >N children) — chỉ 1 issue per parent
            Object.keys(childrenByParent).forEach(parent => {
                const kids = childrenByParent[parent];
                if (kids.length > opts.maxFanout) {
                    const parentRow = rowByName.get(parent);
                    if (parentRow) {
                        results.push({
                            row: parentRow, type: 'fanout',
                            childName: parent, parentName: `${kids.length} cáp con`,
                            distance: 0,
                            info: `Tỏa: ${kids.slice(0, 5).join(', ')}${kids.length > 5 ? '...' : ''}`,
                            from: posIdx[parent], to: posIdx[parent]
                        });
                    }
                }
            });

            // 8. Trùng tên — nhiều rows cùng name (data corruption / multi-parent)
            rowsByName.forEach((dupRows, name) => {
                if (dupRows.length < 2) return;
                const parents = dupRows.map(r => String(r[14] || '').trim()).filter(Boolean);
                const uniqParents = [...new Set(parents)];
                // Chỉ báo issue nếu có ≥2 parents KHÁC NHAU (=multi-parent thực sự)
                // hoặc số dupRows > 2 (duplicate rõ ràng)
                if (uniqParents.length >= 2 || dupRows.length >= 3) {
                    dupRows.forEach((r, idx) => {
                        const p = String(r[14] || '').trim();
                        results.push({
                            row: r, type: 'dup',
                            childName: name + ' (#' + (idx + 1) + ')',
                            parentName: p || '(không)',
                            distance: parseFloat(r[15]) || 0,
                            info: `${dupRows.length} rows cùng tên "${name}" — parents: ${uniqParents.slice(0,3).join(', ')}${uniqParents.length>3?'...':''}`,
                            from: posIdx[p], to: posIdx[name]
                        });
                    });
                }
            });

            // 9. Parent xa (suboptimal) — có candidate parent GẦN HƠN nhiều lần
            // Chỉ check khi user bật filter (perf — O(N × Kcandidates_in_tủ))
            const wantSubopt = (opts.enabledTypes && opts.enabledTypes.suboptimal);
            if (wantSubopt) {
                // Build set of DESCENDANTS per node để tránh suggest 1 node xuống child của nó (tạo cycle)
                const descendantsOf = _buildDescendantsMap(rows);
                // Group poles by tủ
                const polesByTu = {};
                rows.forEach(r => {
                    const nm = String(r[1] || '').trim();
                    const tu = String(r[7] || '').trim();
                    if (!nm || !tu) return;
                    if (!posIdx[nm]) return;
                    if (!polesByTu[tu]) polesByTu[tu] = [];
                    polesByTu[tu].push(nm);
                });
                const suboptRatio = opts.suboptRatio || 1.5;
                rows.forEach(r => {
                    const child = String(r[1] || '').trim();
                    const parent = String(r[14] || '').trim();
                    const tu = String(r[7] || '').trim();
                    if (!child || !parent || !tu) return;
                    if (child === parent) return; // self đã báo type=self
                    const fromLL = posIdx[parent], toLL = posIdx[child];
                    if (!fromLL || !toLL) return;
                    const curDist = haversineM(fromLL[0], fromLL[1], toLL[0], toLL[1]);
                    if (curDist < 5) return; // parent gần sát, skip
                    // Tìm candidate parent gần nhất trong cùng tủ
                    const candidates = polesByTu[tu] || [];
                    const descs = descendantsOf.get(child) || new Set();
                    let bestCand = null, bestDist = Infinity;
                    for (const cand of candidates) {
                        if (cand === child) continue;
                        if (cand === parent) continue;
                        if (descs.has(cand)) continue; // sẽ tạo cycle
                        const candLL = posIdx[cand];
                        if (!candLL) continue;
                        const d = haversineM(candLL[0], candLL[1], toLL[0], toLL[1]);
                        if (d < bestDist) { bestDist = d; bestCand = cand; }
                    }
                    if (bestCand && bestDist > 0 && (curDist / bestDist) >= suboptRatio) {
                        results.push({
                            row: r, type: 'suboptimal',
                            childName: child, parentName: parent,
                            distance: Math.round(curDist),
                            info: `Parent xa ${Math.round(curDist)}m, đề xuất "${bestCand}" ${Math.round(bestDist)}m (giảm ${Math.round((1-bestDist/curDist)*100)}%)`,
                            from: fromLL, to: toLL,
                            _suggestParent: bestCand,
                            _suggestDist: Math.round(bestDist)
                        });
                    }
                });
            }

            // Sort: priority desc → distance desc
            results.sort((a, b) => {
                const pA = CABLE_ISSUE_TYPES[a.type].priority;
                const pB = CABLE_ISSUE_TYPES[b.type].priority;
                if (pA !== pB) return pB - pA;
                return (b.distance || 0) - (a.distance || 0);
            });
            return results;
        }
        window._getCableIssues = _getCableIssues;

        function _lcRefreshList() {
            const enabledTypesObj = {};
            document.querySelectorAll('.lcTypeFilter:checked').forEach(cb => { enabledTypesObj[cb.dataset.type] = true; });
            const opts = {
                thresholdLong: parseFloat((document.getElementById('lcThreshold') || {}).value) || 200,
                ratioHaversine: parseFloat((document.getElementById('lcRatio') || {}).value) || 3,
                maxFanout: parseInt((document.getElementById('lcFanout') || {}).value) || 5,
                suboptRatio: parseFloat((document.getElementById('lcSuboptRatio') || {}).value) || 1.5,
                enabledTypes: enabledTypesObj
            };
            const enabledTypes = new Set(Object.keys(enabledTypesObj));
            const allIssues = _getCableIssues(opts);
            const list = allIssues.filter(it => enabledTypes.has(it.type));
            const tbody = document.getElementById('lcTbody');
            const empty = document.getElementById('lcEmpty');
            const summary = document.getElementById('lcSummary');
            const btnDel = document.getElementById('lcBtnDelete');
            if (!tbody) return;
            if (list.length === 0) {
                tbody.innerHTML = '';
                if (empty) empty.style.display = 'block';
                if (summary) summary.textContent = `0 vấn đề · ${allIssues.length} tổng (bao gồm filter tắt)`;
                if (btnDel) btnDel.disabled = true;
                return;
            }
            if (empty) empty.style.display = 'none';
            // Summary breakdown per type
            const byType = {};
            list.forEach(it => { byType[it.type] = (byType[it.type] || 0) + 1; });
            const parts = Object.keys(byType).map(t =>
                `<span style="color:${CABLE_ISSUE_TYPES[t].color};font-weight:700;">${CABLE_ISSUE_TYPES[t].label}: ${byType[t]}</span>`
            );
            if (summary) summary.innerHTML = `<b>${list.length}</b> vấn đề · ${parts.join(' · ')}`;
            tbody.innerHTML = list.map((it, i) => {
                const cfg = CABLE_ISSUE_TYPES[it.type];
                const canDelete = cfg.actionable;
                return `
                    <tr style="border-bottom:1px solid #f1f5f9;background:${cfg.bg};" data-child="${_esc(it.childName)}">
                        <td style="text-align:center;padding:6px 4px;">
                            ${canDelete
                                ? `<input type="checkbox" class="lcRowCheck" data-idx="${i}" onchange="_lcUpdateSelected()">`
                                : `<span title="Không xóa được — dùng Auto MST reorganize" style="color:#94a3b8;">⊗</span>`
                            }
                        </td>
                        <td style="padding:6px 4px;color:${cfg.color};font-weight:700;font-size:11px;">${cfg.label}</td>
                        <td style="padding:6px 4px;font-weight:600;">${_esc(it.childName)}</td>
                        <td style="padding:6px 4px;color:#475569;">${_esc(it.parentName)}</td>
                        <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:700;color:${cfg.color};">${it.distance ? it.distance + 'm' : '—'}</td>
                        <td style="padding:6px 4px;color:#64748b;font-size:11px;">${_esc(it.info)}</td>
                        <td style="text-align:center;padding:6px 4px;">
                            <button onclick="_focusLongCable(${i})" style="padding:3px 8px;background:#eff6ff;border:1px solid #93c5fd;border-radius:4px;font-size:11px;cursor:pointer;color:#1e40af;">📍</button>
                        </td>
                    </tr>
                `;
            }).join('');
            _lcCurrentList = list;
            _lcUpdateSelected();
        }
        window._lcRefreshList = _lcRefreshList;

        let _lcCurrentList = [];

        function _lcUpdateSelected() {
            const checks = document.querySelectorAll('.lcRowCheck:checked');
            const btnDel = document.getElementById('lcBtnDelete');
            const headerCheck = document.getElementById('lcHeaderCheck');
            if (btnDel) {
                btnDel.disabled = checks.length === 0;
                btnDel.textContent = checks.length > 0
                    ? `🗑 Xóa ${checks.length} cáp đã chọn`
                    : '🗑 Xóa các cáp đã chọn';
            }
            if (headerCheck) {
                const total = document.querySelectorAll('.lcRowCheck').length;
                headerCheck.checked = total > 0 && checks.length === total;
                headerCheck.indeterminate = checks.length > 0 && checks.length < total;
            }
        }
        window._lcUpdateSelected = _lcUpdateSelected;

        function _lcToggleAllChecks(checked) {
            document.querySelectorAll('.lcRowCheck').forEach(cb => { cb.checked = checked; });
            _lcUpdateSelected();
        }
        window._lcToggleAllChecks = _lcToggleAllChecks;

        function _lcSelectAll() {
            const headerCheck = document.getElementById('lcHeaderCheck');
            if (headerCheck) {
                headerCheck.checked = true;
                _lcToggleAllChecks(true);
            }
        }
        window._lcSelectAll = _lcSelectAll;

        function _focusLongCable(idx) {
            const it = _lcCurrentList[idx];
            if (!it) return;
            if (it.row) _lcTuSet(String(it.row[7] || '').trim());   // v168 — chọn sẵn tủ của dòng lỗi
            _lcClearHighlight();
            const cfg = CABLE_ISSUE_TYPES[it.type];
            const color = cfg.color;
            _lcHighlightLayer = L.layerGroup().addTo(map);
            // Nếu có cả 2 điểm và khác nhau → vẽ polyline
            const hasBoth = it.from && it.to && !(it.from[0] === it.to[0] && it.from[1] === it.to[1]);
            if (hasBoth) {
                L.polyline([it.from, it.to], { color, weight: 5, opacity: 0.9, dashArray: '10 6' }).addTo(_lcHighlightLayer);
                L.circleMarker(it.from, { color, radius: 8, weight: 3, fillOpacity: 0.3 }).addTo(_lcHighlightLayer);
                L.circleMarker(it.to,   { color, radius: 8, weight: 3, fillOpacity: 0.3 }).addTo(_lcHighlightLayer);
                const mid = [(it.from[0] + it.to[0]) / 2, (it.from[1] + it.to[1]) / 2];
                const labelText = it.type === 'fanout'
                    ? `${cfg.label}: ${_esc(it.parentName)}`
                    : `${cfg.label} ${it.distance ? '· ' + it.distance + 'm' : ''} · ${_esc(it.parentName)} → ${_esc(it.childName)}`;
                L.marker(mid, {
                    icon: L.divIcon({
                        className: '', iconAnchor: [80, 12],
                        html: `<div style="background:${color};color:#fff;padding:3px 8px;border-radius:4px;font-weight:700;font-size:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);">${labelText}</div>`
                    }),
                    interactive: false
                }).addTo(_lcHighlightLayer);
                try { map.fitBounds([it.from, it.to], { padding: [80, 80], maxZoom: 17 }); } catch(e){_swallow(e);}
            } else {
                // Chỉ có 1 điểm (self/orphan/fanout) → highlight point
                const pt = it.from || it.to;
                if (!pt) return;
                L.circleMarker(pt, { color, radius: 15, weight: 4, fillOpacity: 0.3 }).addTo(_lcHighlightLayer);
                L.marker(pt, {
                    icon: L.divIcon({
                        className: '', iconAnchor: [80, 30],
                        html: `<div style="background:${color};color:#fff;padding:3px 8px;border-radius:4px;font-weight:700;font-size:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);">${cfg.label} · ${_esc(it.childName)} — ${_esc(it.info)}</div>`
                    }),
                    interactive: false
                }).addTo(_lcHighlightLayer);
                try { map.setView(pt, Math.max(16, map.getZoom())); } catch(e){_swallow(e);}
            }
        }
        window._focusLongCable = _focusLongCable;

        async function _deleteLongCablesSelected() {
            const checks = Array.from(document.querySelectorAll('.lcRowCheck:checked'));
            if (checks.length === 0) return;
            const selected = checks.map(cb => _lcCurrentList[parseInt(cb.dataset.idx)])
                .filter(it => it && CABLE_ISSUE_TYPES[it.type].actionable);
            if (selected.length === 0) return;
            // Breakdown per type để confirm rõ ràng
            const byType = {};
            selected.forEach(it => { byType[it.type] = (byType[it.type] || 0) + 1; });
            const breakdown = Object.keys(byType).map(t =>
                `  ${CABLE_ISSUE_TYPES[t].label}: ${byType[t]}`
            ).join('\n');
            if (!confirm(`Xóa ${selected.length} cáp đã chọn?\n\n${breakdown}\n\nSẽ CLEAR cột "Marker gốc" + "Khoảng cách" của các trụ con — KHÔNG xóa trụ.\n\nSync lên Google Sheet ngay sau khi xóa.`)) return;

            const btn = document.getElementById('lcBtnDelete');
            const originalText = btn.textContent;
            btn.disabled = true;

            let cleared = 0, synced = 0, failed = 0;
            // v141: Clear tất cả in-memory trước, sau đó batch sync
            const toSync = [];
            for (const it of selected) {
                it.row[14] = '';
                it.row[15] = '';
                it.row[13] = new Date().toISOString();
                cleared++;
                toSync.push(it.row);
            }
            if (toSync.length >= 20 && typeof _batchSyncRowsToGAS === 'function') {
                const result = await _batchSyncRowsToGAS(
                    toSync,
                    ['markerGoc', 'khoangCach', 'capNhat'],
                    (done, tot, chunk, chunkTot) => {
                        btn.textContent = `⚡ Batch ${chunk}/${chunkTot} (${done}/${tot})...`;
                    }
                );
                synced = result.updated;
                failed = result.failed + result.notFound;
            } else {
                for (let i = 0; i < toSync.length; i++) {
                    btn.textContent = `⏳ Đang xóa ${i + 1}/${toSync.length}...`;
                    try {
                        if (typeof syncRowToGAS === 'function') {
                            const ok = await syncRowToGAS(toSync[i], { silent: true });
                            if (ok) synced++; else failed++;
                        }
                    } catch (err) { console.error(err); failed++; }
                }
            }

            // Log action
            try {
                if (typeof _logAction === 'function') {
                    _logAction('delete_long_cables', '', currentSheet || '', JSON.stringify({
                        count: cleared,
                        threshold: parseFloat((document.getElementById('lcThreshold') || {}).value) || 200,
                        cables: selected.map(x => `${x.parentName}→${x.childName}(${x.distance}m)`)
                    }));
                }
            } catch(e){_swallow(e);}

            btn.disabled = false;
            btn.textContent = originalText;

            // Refresh cable view + danh sách
            _lcClearHighlight();
            if (_cableVisible && typeof _rebuildCableLines === 'function') _rebuildCableLines();
            _lcRefreshList();

            const parts = [`✅ Đã xóa ${cleared} cáp`, `Sync GAS ${synced}/${cleared}`];
            if (failed) parts.push(`Lỗi ${failed}`);
            displayInfo && displayInfo(parts.join(' · '));
        }
        window._deleteLongCablesSelected = _deleteLongCablesSelected;
