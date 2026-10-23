// Đường tự vẽ (custom roads) — offline-first (IndexedDB) + đồng bộ GAS sheet "DuongVe".
// User chạm các điểm dọc hẻm → tạo đường → lưu offline + sync; căn tuyến / overlay / xuất CAD / MST
// nhận đường này y như nền OSM dựng sẵn (hợp nhất tại _osmRoadsForBounds / _raFetchRoads / _cgFetchOsm).
// KHÔNG đẩy lên OpenStreetMap.org. UI: FAB + bottom-sheet (phương án C). Classic script (nạp qua <script src>).
// Hàm thuần đặt trong mốc @@CUSTOMROADS_START/END để test trích. Xem docs/design-custom-roads-offline.md.

        // ─────────────────────────────────────────────────────────────
        // Phần thuần (không phụ thuộc trình duyệt/map) — test trích qua @@CUSTOMROADS
        // ─────────────────────────────────────────────────────────────
        // @@CUSTOMROADS_START
        const CR_LON_MIN = 101, CR_LON_MAX = 110, CR_LAT_MIN = 8, CR_LAT_MAX = 24; // hộp VN thô — loại toạ độ rác

        // 1 điểm [lon,lat] hợp lệ? (đúng thứ tự lon trước, trong hộp VN)
        function _crCoordValid(c) {
            return Array.isArray(c) && c.length >= 2 &&
                Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
                c[0] >= CR_LON_MIN && c[0] <= CR_LON_MAX &&
                c[1] >= CR_LAT_MIN && c[1] <= CR_LAT_MAX;
        }
        // record hợp lệ? (≥2 điểm, mọi điểm hợp lệ)
        function _crRecordValid(rec) {
            if (!rec || !Array.isArray(rec.coords) || rec.coords.length < 2) return false;
            for (let i = 0; i < rec.coords.length; i++) if (!_crCoordValid(rec.coords[i])) return false;
            return true;
        }
        function _crRound(n) { return Math.round(n * 1e6) / 1e6; }   // 6 số lẻ ~ 0.11m
        // coords -> JSON gọn (làm tròn) để lưu 1 ô sheet
        function _crEncodeGeom(coords) {
            return JSON.stringify((coords || []).map(c => [_crRound(c[0]), _crRound(c[1])]));
        }
        // JSON -> coords, lọc điểm rác, không ném lỗi
        function _crDecodeGeom(str) {
            try { const a = JSON.parse(str); return Array.isArray(a) ? a.filter(_crCoordValid) : []; }
            catch (e) { return []; }
        }
        // record nội bộ -> {coords, tags} (cùng shape nền OSM; đánh dấu _custom để style riêng)
        function _crToRoad(rec) {
            const tags = { highway: (rec.tags && rec.tags.highway) || rec.highway || 'service' };
            const nm = (rec.tags && rec.tags.name) || rec.name;
            if (nm) tags.name = nm;
            tags._custom = true;
            return { coords: rec.coords || [], tags };
        }
        // giữ đường nếu có đỉnh trong bounds mở rộng margin (giống _pbRoadNearBounds). coords [[lon,lat]].
        function _crNearBounds(coords, bounds, margin) {
            if (!coords || !bounds) return false;
            const m = margin || 0;
            const a = bounds.minLat - m, b = bounds.maxLat + m, c = bounds.minLon - m, d = bounds.maxLon + m;
            for (let i = 0; i < coords.length; i++) {
                const p = coords[i];
                if (p[1] >= a && p[1] <= b && p[0] >= c && p[0] <= d) return true;
            }
            return false;
        }
        // lọc active: đúng sheet (hoặc không lọc nếu sheet rỗng) + chưa soft-delete
        function _crActive(recs, sheet) {
            if (!Array.isArray(recs)) return [];
            return recs.filter(r => r && r.status !== 'xoa' && (!sheet || String(r.sheet || '') === String(sheet)));
        }
        // sinh id kế tiếp CR_<sheet>_<nnn> không trùng
        function _crNextId(sheet, existingIds) {
            const pref = 'CR_' + (sheet || 'X') + '_';
            const used = new Set((existingIds || []).map(String));
            let n = 1; while (used.has(pref + String(n).padStart(3, '0'))) n++;
            return pref + String(n).padStart(3, '0');
        }
        // {roads:[...]} cho bounds từ danh sách recs (active + clip + toRoad)
        function _crRoadsForBounds(recs, sheet, bounds, margin) {
            const out = [];
            const act = _crActive(recs, sheet);
            const m = (margin == null) ? 0.0015 : margin;
            for (const r of act) if (_crNearBounds(r.coords, bounds, m)) out.push(_crToRoad(r));
            return { roads: out, _custom: true };
        }
        // nối custom roads vào kết quả fetch đường (giữ nguyên các field khác: buildings, water…)
        function _crMergeInto(result, customRoads) {
            if (!result) return { roads: (customRoads || []).slice() };
            if (!Array.isArray(result.roads)) result.roads = [];
            if (customRoads && customRoads.length) result.roads = result.roads.concat(customRoads);
            return result;
        }
        // @@CUSTOMROADS_END

        // ─────────────────────────────────────────────────────────────
        // Runtime (trình duyệt): IndexedDB + sync GAS + vẽ trên map + UI FAB/bottom-sheet
        // ─────────────────────────────────────────────────────────────
        let _crAll = [];              // toàn bộ record (RAM) — nguồn truy vấn đồng bộ cho _customRoadsForBounds
        let _crVisible = true;        // bật/tắt hiển thị + hợp nhất
        let _crLayer = null;          // L.layerGroup vẽ đường đã lưu
        let _crDrawLayer = null;      // L.layerGroup preview khi đang vẽ
        let _crDrawing = false;       // đang ở chế độ vẽ?
        let _crPts = [];              // điểm đang vẽ [[lon,lat]]
        let _crBooted = false;
        const CR_SNAP_PX = 14;        // bán kính snap điểm đầu/cuối vào đường/nút gần (px)

        try { _crVisible = localStorage.getItem('cr_visible') !== '0'; } catch (e) {}

        function _crToast(msg, err) {
            if (err && typeof displayError === 'function') return displayError(msg);
            if (typeof displayInfo === 'function') return displayInfo(msg);
        }
        function _crCanEdit() { return typeof canEdit !== 'function' || canEdit(); }
        function _crSheet() { return (typeof currentSheet !== 'undefined' && currentSheet) ? currentSheet : 'DanhSachTru'; }
        function _crUser() { try { return (currentUser && currentUser.username) || ''; } catch (e) { return ''; } }

        // ── IndexedDB store 'custom-roads' (DB 'lighting-survey-db' v3 — tạo ở _idbOpen trong index.html) ──
        async function _crIdbAll() {
            try {
                const db = await _idbOpen();
                if (!db.objectStoreNames.contains('custom-roads')) return [];
                return await new Promise((res) => {
                    const r = db.transaction('custom-roads', 'readonly').objectStore('custom-roads').getAll();
                    r.onsuccess = () => res(r.result || []);
                    r.onerror = () => res([]);
                });
            } catch (e) { return []; }
        }
        async function _crIdbPut(rec) {
            try {
                const db = await _idbOpen();
                if (!db.objectStoreNames.contains('custom-roads')) return;
                await new Promise((res) => {
                    const tx = db.transaction('custom-roads', 'readwrite');
                    tx.objectStore('custom-roads').put(rec, rec.id);
                    tx.oncomplete = res; tx.onerror = res;
                });
            } catch (e) {}
        }

        async function _crLoadAll() {
            _crAll = await _crIdbAll();
            _crRedraw();
            _crRenderList();
        }

        // ── Hợp nhất đường tự vẽ vào luồng đường (gọi bởi overlay/align/CAD) ──
        function _customRoadsForBounds(bounds, margin) {
            if (!_crVisible) return { roads: [], _custom: true };
            return _crRoadsForBounds(_crAll, _crSheet(), bounds, margin);
        }
        window._customRoadsForBounds = _customRoadsForBounds;

        // nối custom vào result road fetch; bounds suy từ chính result nếu không truyền
        function _withCustomRoads(result, bounds) {
            try {
                if (!_crVisible || !_crAll.length) return result;
                let bb = bounds;
                if (!bb && result && Array.isArray(result.roads)) {
                    // suy bounds từ đường trả về để clip custom cho khớp vùng
                    let a = 90, b = -90, c = 180, d = -180, any = false;
                    for (const rd of result.roads) for (const p of (rd.coords || [])) {
                        if (p[1] < a) a = p[1]; if (p[1] > b) b = p[1];
                        if (p[0] < c) c = p[0]; if (p[0] > d) d = p[0]; any = true;
                    }
                    bb = any ? { minLat: a, maxLat: b, minLon: c, maxLon: d } : null;
                }
                if (!bb) return result;
                const cr = _crRoadsForBounds(_crAll, _crSheet(), bb, 0.0015);
                return _crMergeInto(result, cr.roads);
            } catch (e) { return result; }
        }
        window._withCustomRoads = _withCustomRoads;

        // ── Vẽ đường đã lưu lên map ──
        function _crRedraw() {
            if (!_crLayer || typeof L === 'undefined') return;
            _crLayer.clearLayers();
            if (!_crVisible) return;
            const act = _crActive(_crAll, _crSheet());
            for (const rec of act) {
                if (!rec.coords || rec.coords.length < 2) continue;
                const latlngs = rec.coords.map(c => [c[1], c[0]]);
                L.polyline(latlngs, { color: '#7c3aed', weight: 3, opacity: .9, dashArray: '1 6', lineCap: 'round' })
                    .bindTooltip((rec.name || 'Đường tự vẽ') + ((rec._dirty) ? ' • chờ đồng bộ' : ''), { sticky: true })
                    .addTo(_crLayer);
            }
        }

        // ── Snap 1 điểm chạm vào đỉnh đường/nút gần nhất trong CR_SNAP_PX ──
        function _crSnap(latlng) {
            try {
                const p0 = map.latLngToContainerPoint(latlng);
                let best = null, bestD = CR_SNAP_PX;
                const consider = (lat, lon) => {
                    const p = map.latLngToContainerPoint([lat, lon]);
                    const d = Math.hypot(p.x - p0.x, p.y - p0.y);
                    if (d < bestD) { bestD = d; best = [lon, lat]; }
                };
                // nút trụ/tủ đang hiển thị
                if (Array.isArray(loadedData)) for (const r of loadedData.slice(1)) {
                    const la = parseCoord(r[2]), lo = parseCoord(r[3]);
                    if (Number.isFinite(la) && Number.isFinite(lo)) consider(la, lo);
                }
                // đỉnh đường tự vẽ gần
                for (const rec of _crActive(_crAll, _crSheet())) for (const c of (rec.coords || [])) consider(c[1], c[0]);
                return best || [latlng.lng, latlng.lat];
            } catch (e) { return [latlng.lng, latlng.lat]; }
        }

        function _crDrawPreview() {
            if (!_crDrawLayer) return;
            _crDrawLayer.clearLayers();
            if (_crPts.length >= 2) {
                L.polyline(_crPts.map(c => [c[1], c[0]]), { color: '#2563eb', weight: 3, dashArray: '6 5', opacity: .95 }).addTo(_crDrawLayer);
            }
            _crPts.forEach((c, i) => {
                L.circleMarker([c[1], c[0]], {
                    radius: 5, color: '#2563eb', weight: 2,
                    fillColor: i === _crPts.length - 1 ? '#2563eb' : '#fff', fillOpacity: 1
                }).addTo(_crDrawLayer);
            });
            _crUpdateSheetUI();
        }

        function _crOnMapClick(e) {
            if (!_crDrawing) return;
            const snapped = _crSnap(e.latlng);
            _crPts.push(snapped);
            _crDrawPreview();
        }

        function _crStartDraw() {
            if (!_crCanEdit()) { _crToast('Bạn không có quyền sửa dữ liệu.', true); return; }
            _crDrawing = true; _crPts = [];
            if (_crDrawLayer) _crDrawLayer.clearLayers();
            try { map.getContainer().style.cursor = 'crosshair'; } catch (e) {}
            map.on('click', _crOnMapClick);
            _crToast('Chạm các điểm dọc hẻm, rồi bấm “Xong”.');
            _crUpdateSheetUI();
        }
        function _crUndoPoint() { if (_crPts.length) { _crPts.pop(); _crDrawPreview(); } }
        function _crCancelDraw() {
            _crDrawing = false; _crPts = [];
            try { map.off('click', _crOnMapClick); map.getContainer().style.cursor = ''; } catch (e) {}
            if (_crDrawLayer) _crDrawLayer.clearLayers();
            _crUpdateSheetUI();
        }

        async function _crFinishDraw() {
            if (_crPts.length < 2) { _crToast('Cần ít nhất 2 điểm để tạo đường.', true); return; }
            const pts = _crPts.slice();
            const sheet = _crSheet();
            const id = _crNextId(sheet, _crAll.map(r => r.id));
            const name = (prompt('Tên đường/hẻm (bỏ trống nếu không có):', '') || '').trim();
            const rec = {
                id, sheet, coords: pts,
                tags: { highway: 'service', name: name || undefined },
                name: name || '', highway: 'service',
                author: _crUser(), ts: new Date().toISOString(),
                status: '', _dirty: true
            };
            if (!_crRecordValid(rec)) { _crToast('Toạ độ không hợp lệ.', true); return; }
            _crAll.push(rec);
            await _crIdbPut(rec);
            _crCancelDraw();
            _crRedraw(); _crRenderList();
            _crToast('Đã lưu đường (offline). Đang đồng bộ…');
            _crSyncOne(rec);                 // đẩy lên sheet nếu có mạng
            if (typeof _refreshOsmRoadsOverlay === 'function' && typeof _osmRoadsOn !== 'undefined' && _osmRoadsOn)
                _refreshOsmRoadsOverlay();
        }

        async function _crDeleteRec(id) {
            const rec = _crAll.find(r => r.id === id);
            if (!rec) return;
            if (!confirm('Xoá đường “' + (rec.name || id) + '”?')) return;
            rec.status = 'xoa'; rec._dirty = true; rec.ts = new Date().toISOString();
            await _crIdbPut(rec);
            _crRedraw(); _crRenderList();
            _crSyncOne(rec);
        }

        // ── Sync GAS (POST text/plain tránh preflight) ──
        async function _crGasPost(payload) {
            if (typeof KHAOSAT_GAS_URL !== 'string' || !KHAOSAT_GAS_URL) throw new Error('no GAS');
            const res = await fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
            return await res.json().catch(() => ({}));
        }
        // đẩy 1 record (save hoặc delete) — thất bại thì giữ _dirty, thử lại sau
        async function _crSyncOne(rec) {
            if (!navigator.onLine) return;
            try {
                const action = rec.status === 'xoa' ? 'delete_road' : 'save_road';
                const r = await _crGasPost({
                    action, id: rec.id, sheet: rec.sheet, highway: rec.highway || 'service',
                    name: rec.name || '', geom: _crEncodeGeom(rec.coords),
                    author: rec.author || '', ts: rec.ts || '', status: rec.status || ''
                });
                if (r && r.status !== 'error' && r.success !== false) { rec._dirty = false; await _crIdbPut(rec); _crRenderList(); }
            } catch (e) { /* offline/timeout → giữ _dirty */ }
        }
        async function _crSyncPush() {
            const dirty = _crAll.filter(r => r._dirty);
            for (const r of dirty) await _crSyncOne(r);
            _crToast(dirty.length ? ('Đã đồng bộ ' + dirty.length + ' đường.') : 'Không có đường chờ đồng bộ.');
        }
        // kéo từ sheet về, hợp nhất theo ts (last-write-wins), bỏ qua record local dirty mới hơn
        async function _crSyncPull() {
            if (!navigator.onLine) return;
            let rows = null;
            try {
                const r = await _crGasPost({ action: 'list_roads', sheet: _crSheet() });
                rows = (r && (r.roads || r.data)) || null;
            } catch (e) { return; }
            if (!Array.isArray(rows)) return;
            const byId = new Map(_crAll.map(r => [r.id, r]));
            for (const row of rows) {
                const rec = {
                    id: row.id, sheet: row.sheet || _crSheet(),
                    coords: _crDecodeGeom(row.geom || row.coords || '[]'),
                    tags: { highway: row.highway || 'service', name: row.name || undefined },
                    name: row.name || '', highway: row.highway || 'service',
                    author: row.author || '', ts: row.ts || '', status: row.status || '', _dirty: false
                };
                if (!rec.id) continue;
                const cur = byId.get(rec.id);
                if (cur && cur._dirty && String(cur.ts) >= String(rec.ts)) continue; // local mới hơn → giữ
                byId.set(rec.id, rec);
                await _crIdbPut(rec);
            }
            _crAll = Array.from(byId.values());
            _crRedraw(); _crRenderList();
        }
        window._crSyncPull = _crSyncPull;

        function _crToggleVisible(on) {
            _crVisible = !!on;
            try { localStorage.setItem('cr_visible', _crVisible ? '1' : '0'); } catch (e) {}
            _crRedraw();
            if (typeof _refreshOsmRoadsOverlay === 'function' && typeof _osmRoadsOn !== 'undefined' && _osmRoadsOn)
                _refreshOsmRoadsOverlay();
        }

        // ── Xuất .osc (OSM change) để user tự upload OSM thật (tùy chọn) ──
        function _crExportOsc() {
            const act = _crActive(_crAll, _crSheet());
            if (!act.length) { _crToast('Chưa có đường nào để xuất.', true); return; }
            let nid = -1, wid = -1, nodes = '', ways = '';
            for (const rec of act) {
                const refs = [];
                for (const c of rec.coords) { nodes += `<node id="${nid}" lon="${_crRound(c[0])}" lat="${_crRound(c[1])}" version="0"/>`; refs.push(nid); nid--; }
                ways += `<way id="${wid}" version="0">` + refs.map(r => `<nd ref="${r}"/>`).join('') +
                    `<tag k="highway" v="${rec.highway || 'service'}"/>` + (rec.name ? `<tag k="name" v="${String(rec.name).replace(/"/g, '&quot;')}"/>` : '') + `</way>`;
                wid--;
            }
            const osc = `<osmChange version="0.6" generator="lighting-survey"><create>${nodes}${ways}</create></osmChange>`;
            const blob = new Blob([osc], { type: 'application/xml' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'duong-tu-ve-' + _crSheet() + '.osc';
            document.body.appendChild(a); a.click(); a.remove();
            _crToast('Đã xuất .osc — mở trong JOSM/iD để kiểm tra rồi upload OSM.');
        }

        // ─────────────────────────────────────────────────────────────
        // UI — FAB + bottom-sheet (phương án C)
        // ─────────────────────────────────────────────────────────────
        let _crTab = 'draw';
        function _crInjectUI() {
            if (document.getElementById('crFab')) return;
            const css = document.createElement('style');
            css.textContent = `
              #crFab{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:900;
                width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;color:#fff;font-size:22px;
                background:#7c3aed;box-shadow:0 6px 20px rgba(124,58,237,.45);display:flex;align-items:center;justify-content:center}
              #crFab.off{background:#64748b;box-shadow:0 4px 14px rgba(0,0,0,.3)}
              #crSheet{position:fixed;left:8px;right:8px;bottom:8px;z-index:901;display:none;
                background:var(--panel,#fff);color:var(--ink,#0f172a);border:1px solid var(--line,#e2e8f0);
                border-radius:16px 16px 12px 12px;box-shadow:0 -6px 30px rgba(0,0,0,.25);
                padding:10px 12px calc(12px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto}
              #crSheet.show{display:block}
              #crSheet .grip{width:40px;height:4px;border-radius:999px;background:var(--line,#cbd5e1);margin:2px auto 10px}
              #crSheet .hd{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;margin-bottom:9px}
              #crSheet .hd .x{margin-left:auto;border:none;background:transparent;font-size:18px;cursor:pointer;color:var(--muted,#64748b)}
              #crSeg{display:flex;gap:6px;margin-bottom:10px}
              #crSeg button{flex:1;border:1px solid var(--line,#e2e8f0);background:var(--bg,#f1f5f9);color:inherit;
                border-radius:9px;padding:8px;font-size:12.5px;cursor:pointer;min-height:40px}
              #crSeg button.on{background:#7c3aed;color:#fff;border-color:#7c3aed}
              #crSheet .pane{font-size:13px}
              #crSheet .row{display:flex;gap:8px}
              #crSheet .pill{flex:1;justify-content:center;border:none;border-radius:10px;padding:11px;font-weight:600;
                font-size:13px;cursor:pointer;display:inline-flex;gap:6px;align-items:center;min-height:44px}
              #crSheet .pill.go{background:#2563eb;color:#fff}
              #crSheet .pill.ghost{background:transparent;color:inherit;border:1px solid var(--line,#e2e8f0)}
              #crSheet .pill.danger{background:transparent;color:#dc2626;border:1px solid var(--line,#e2e8f0)}
              #crSheet .cnt{font-size:12px;color:var(--muted,#64748b);text-align:center;margin:2px 0 8px}
              #crList{max-height:38vh;overflow:auto}
              #crList .lr{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:8px 2px;border-top:1px dashed var(--line,#e2e8f0)}
              #crList .lr .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
              #crList .lr .d{color:#d97706;font-size:11px}
              #crList .lr .mini{border:none;background:transparent;cursor:pointer;font-size:14px;padding:4px;color:var(--muted,#64748b)}
              #crList .empty{color:var(--muted,#64748b);text-align:center;padding:16px 0;font-size:12.5px}
              #crVis{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;margin-bottom:9px;gap:8px}
            `;
            document.head.appendChild(css);

            const fab = document.createElement('button');
            fab.id = 'crFab'; fab.title = 'Đường tự vẽ'; fab.textContent = '🛣';
            fab.onclick = _crOpenSheet;
            document.body.appendChild(fab);

            const sh = document.createElement('div');
            sh.id = 'crSheet';
            sh.innerHTML =
                '<div class="grip"></div>' +
                '<div class="hd">🛣 Đường tự vẽ<button class="x" title="Đóng">×</button></div>' +
                '<div id="crVis"><span>Hiện trên bản đồ</span>' +
                  '<label class="switch"><input type="checkbox" id="crVisChk"></label></div>' +
                '<div id="crSeg">' +
                  '<button data-t="draw" class="on">✏️ Vẽ</button>' +
                  '<button data-t="list">📋 Danh sách</button>' +
                  '<button data-t="sync">🔄 Đồng bộ</button>' +
                '</div>' +
                '<div class="pane" id="crPane"></div>';
            document.body.appendChild(sh);
            sh.querySelector('.x').onclick = _crCloseSheet;
            sh.querySelectorAll('#crSeg button').forEach(b => b.onclick = () => { _crTab = b.dataset.t; _crUpdateSheetUI(); });
            const vc = sh.querySelector('#crVisChk');
            vc.checked = _crVisible;
            vc.onchange = () => _crToggleVisible(vc.checked);
        }

        function _crOpenSheet() { _crInjectUI(); document.getElementById('crSheet').classList.add('show'); _crUpdateSheetUI(); }
        function _crCloseSheet() { const s = document.getElementById('crSheet'); if (s) s.classList.remove('show'); }

        function _crRenderList() {
            const pane = document.getElementById('crPane');
            if (!pane || _crTab !== 'list') return;
            const act = _crActive(_crAll, _crSheet());
            if (!act.length) { pane.querySelector('#crList') && (pane.querySelector('#crList').innerHTML = '<div class="empty">Chưa có đường nào ở địa bàn này.</div>'); }
            _crUpdateSheetUI();
        }

        function _crUpdateSheetUI() {
            const pane = document.getElementById('crPane');
            if (!pane) return;
            const fab = document.getElementById('crFab');
            if (fab && fab.classList) fab.classList.toggle('off', !_crVisible);
            if (_crTab === 'draw') {
                pane.innerHTML =
                    '<div class="cnt">' + (_crDrawing ? ('Đang vẽ — ' + _crPts.length + ' điểm') : 'Bấm “Bắt đầu vẽ”, rồi chạm các điểm dọc hẻm.') + '</div>' +
                    (_crDrawing
                        ? '<div class="row" style="margin-bottom:8px"><button class="pill ghost" id="crUndo">↶ Hoàn tác điểm</button>' +
                          '<button class="pill go" id="crDone">✓ Xong</button></div>' +
                          '<div class="row"><button class="pill danger" id="crCancel">✕ Huỷ</button></div>'
                        : '<div class="row"><button class="pill go" id="crStart">✏️ Bắt đầu vẽ</button></div>');
                const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
                bind('crStart', _crStartDraw); bind('crUndo', _crUndoPoint); bind('crDone', _crFinishDraw); bind('crCancel', _crCancelDraw);
            } else if (_crTab === 'list') {
                const act = _crActive(_crAll, _crSheet());
                let html = '<div id="crList">';
                if (!act.length) html += '<div class="empty">Chưa có đường nào ở địa bàn này.</div>';
                else for (const r of act) html +=
                    '<div class="lr"><span class="nm">' + (r.name ? _crEsc(r.name) : '<i>(không tên)</i>') + '</span>' +
                    (r._dirty ? '<span class="d">● chờ sync</span>' : '') +
                    '<button class="mini" data-go="' + r.id + '" title="Xem">🔍</button>' +
                    '<button class="mini" data-del="' + r.id + '" title="Xoá">🗑</button></div>';
                html += '</div>';
                pane.innerHTML = html;
                pane.querySelectorAll('[data-del]').forEach(b => b.onclick = () => _crDeleteRec(b.dataset.del));
                pane.querySelectorAll('[data-go]').forEach(b => b.onclick = () => _crFlyTo(b.dataset.go));
            } else { // sync
                const dirty = _crAll.filter(r => r._dirty).length;
                pane.innerHTML =
                    '<div class="cnt">' + (dirty ? (dirty + ' đường chờ đồng bộ') : 'Đã đồng bộ hết') + (navigator.onLine ? '' : ' • đang offline') + '</div>' +
                    '<div class="row" style="margin-bottom:8px"><button class="pill go" id="crPush">⬆️ Đẩy lên sheet</button>' +
                    '<button class="pill ghost" id="crPull">⬇️ Tải về</button></div>' +
                    '<div class="row"><button class="pill ghost" id="crOsc">📄 Xuất .osc (OSM)</button></div>';
                const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
                bind('crPush', async () => { await _crSyncPush(); _crUpdateSheetUI(); });
                bind('crPull', async () => { _crToast('Đang tải…'); await _crSyncPull(); _crUpdateSheetUI(); });
                bind('crOsc', _crExportOsc);
            }
        }
        function _crEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
        function _crFlyTo(id) {
            const r = _crAll.find(x => x.id === id);
            if (!r || !r.coords || !r.coords.length || typeof map === 'undefined') return;
            const latlngs = r.coords.map(c => [c[1], c[0]]);
            try { map.fitBounds(L.latLngBounds(latlngs).pad(0.4)); } catch (e) {}
            _crCloseSheet();
        }

        // reset khi đổi địa bàn (đường của sheet nào chỉ hiện ở sheet đó; kéo dữ liệu sheet mới)
        function _crOnDistrictChange() { if (!_crBooted) return; _crCancelDraw(); _crRedraw(); _crRenderList(); _crSyncPull(); }
        window._crOnDistrictChange = _crOnDistrictChange;

        // ── Boot: sau khi map sẵn sàng ──
        async function _crBoot() {
            if (_crBooted || typeof map === 'undefined' || !map) return;
            _crBooted = true;
            _crLayer = L.layerGroup().addTo(map);
            _crDrawLayer = L.layerGroup().addTo(map);
            _crInjectUI();
            await _crLoadAll();
            _crSyncPull();
            window.addEventListener('online', () => { _crSyncPush(); });
        }
        window._crBoot = _crBoot;
        // tự boot khi map có mặt (không cần sửa trình tự init của index.html)
        (function _crWait() {
            if (typeof map !== 'undefined' && map && typeof L !== 'undefined') { _crBoot(); return; }
            let n = 0; const t = setInterval(() => {
                if ((typeof map !== 'undefined' && map && typeof L !== 'undefined') || ++n > 100) {
                    clearInterval(t);
                    if (typeof map !== 'undefined' && map) _crBoot();
                }
            }, 150);
        })();
