// Căn thẳng tuyến đèn theo đường OSM — giao diện + áp dụng/hoàn tác (hàm tính thuần vẫn ở @@ROADALIGN trong index.html)
// Tách từ index.html (đợt 1 module hoá, v173) — chỉ cắt/dán, KHÔNG đổi logic.
// Classic script (không phải ES module): hàm + let/const cấp cao nhất là toàn cục, dùng chung với các script khác;
// các onclick="..." trong index.html gọi thẳng các hàm này. Nạp TRƯỚC khối <script> chính (xem index.html).
// Khi nạp chỉ khai báo hàm/hằng + gắn window — mọi tham chiếu sang biến của script chính đều nằm trong thân hàm.

        // ─── v158: Căn thẳng tuyến đèn theo tim đường OSM — docs/design-align-poles-road.md ───
        let _raState = null;   // { rows, poles, lines, frame, order, base, offsets, manual, layer, groups, entries }
        let _raUndo = null;    // { snaps: [{row, vals}], applied: Map(row → [lat, lon]) } — 1 mức hoàn tác
        let _raToken = 0;      // lần mở mới nhất — chống 2 lần mở chồng nhau khi tải OSM chậm
        const _RA_SNAP_COLS = [2, 3, 13, 15, 19, 20];   // lat, lon, cập nhật, khoảng cách cáp, VN2000 X/Y

        const _raKeyOf = r => [String(r[0] || '').trim(), String(r[1] || '').trim()].filter(Boolean);
        function _raAllRows() {
            const seen = new Set();
            return [...(loadedData || []).slice(1), ...(newMarkerRows || [])]
                .filter(r => Array.isArray(r) && !seen.has(r) && seen.add(r));
        }

        // Overpass chặn 2 request cách nhau < 5s (dùng chung với xuất CAD) → tự chờ rồi thử lại 1 lần
        async function _raFetchRoads(bounds) {
            try {
                return await _fetchOsmBasemap(bounds, { roads: true, buildings: false });
            } catch (e) {
                if (!/5s/.test(String(e && e.message))) throw e;
                displayInfo('Chờ vài giây để tải bản đồ đường...');
                await new Promise(r => setTimeout(r, 5200));
                return await _fetchOsmBasemap(bounds, { roads: true, buildings: false });
            }
        }

        async function openAlignRoute() {
            const row = _currentPopupRow;
            if (!row) return;
            if (!canDrag()) { displayError('Tài khoản hiện tại không có quyền dời marker.'); return; }
            const base = normalizeMarkerBaseName(String(row[1] || '').trim());
            const rows = _raAllRows().filter(r => [1, 2, 3, 4].includes(parseInt(r[6]))
                && normalizeMarkerBaseName(String(r[1] || '').trim()) === base
                && isFinite(parseCoord(r[2])) && isFinite(parseCoord(r[3])));
            if (rows.length < 2) { displayError(`Tuyến "${base}" cần ít nhất 2 trụ đèn để căn thẳng.`); return; }
            map.closePopup();
            _raClose();
            const token = ++_raToken;

            const lats = rows.map(r => parseCoord(r[2])), lons = rows.map(r => parseCoord(r[3]));
            const PAD = 0.0006;   // ~65m — đủ lấy đường dù trụ cách tim tới 30m
            const bounds = { minLat: Math.min(...lats) - PAD, maxLat: Math.max(...lats) + PAD,
                             minLon: Math.min(...lons) - PAD, maxLon: Math.max(...lons) + PAD };
            displayInfo('Đang tải đường OSM quanh tuyến ' + base + '...');
            let osm;
            try {
                osm = await _raFetchRoads(bounds);
            } catch (e) {
                if (token === _raToken) displayError('Không tải được bản đồ đường OSM — các máy chủ đều bận hoặc mất mạng (' + e.message + '). Thử lại sau ít phút.');
                return;
            }
            if (token !== _raToken) return;   // người dùng đã mở tuyến khác trong lúc chờ
            const frame = _raLocalFrame((bounds.minLat + bounds.maxLat) / 2, (bounds.minLon + bounds.maxLon) / 2);
            const poles = rows.map(r => frame.toXY(parseCoord(r[2]), parseCoord(r[3])));
            const lines = _raRoadLines(osm.roads, frame);
            // v164 — tuyến qua nhiều đường: căn theo đường gần trụ người dùng vừa bấm
            const clickXY = frame.toXY(parseCoord(row[2]), parseCoord(row[3]));
            const clickNear = _raNearestOnLines(clickXY.x, clickXY.y, lines, null);
            const roadKey = clickNear && clickNear.dist <= 30 ? clickNear.key : null;
            const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
            const order = rows.map((_, i) => i).sort((a, b) => collator.compare(String(rows[a][1] || ''), String(rows[b][1] || '')));
            _raState = { rows, poles, lines, frame, order, base, roadKey, cfg: null, width: null, manual: new Map(),
                         layer: L.layerGroup().addTo(map) };
            _raRecompute();
            if (!_raState) return;
            // Chừa chỗ cho panel: bên phải trên màn rộng, phía dưới trên điện thoại
            const pad = window.innerWidth > 900 ? [480, 40] : [20, Math.round(window.innerHeight * 0.62)];
            try { map.fitBounds(L.latLngBounds(rows.map(r => [parseCoord(r[2]), parseCoord(r[3])])).pad(0.1), { paddingTopLeft: [20, 20], paddingBottomRight: pad }); } catch (_) {}
        }
        window.openAlignRoute = openAlignRoute;

        // v159: mốc căn (mép/tim) + phía + khoảng cách mỗi hàng; bề rộng đường chung cả tuyến. Nhớ lần dùng gần nhất.
        const _RA_CFG_KEY = 'ra_align_cfg';
        const _raIsObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
        function _raLoadCfg() {
            let c = {};
            try { c = JSON.parse(localStorage.getItem(_RA_CFG_KEY) || '{}'); } catch (_) { /* hỏng → bỏ */ }
            if (!_raIsObj(c)) c = {};
            if (!_raIsObj(c.widths)) c.widths = {};
            return c;
        }
        function _raSaveCfg(st) {
            try {
                const saved = _raLoadCfg(), c = st.cfg && st.cfg[0];
                if (c) { saved.ref = c.ref; if (c.ref === 'mep') saved.mepValue = c.value; }
                // Chỉ nhớ bề rộng người dùng ĐÃ SỬA, và chỉ cho đường có tên (khoá 'way#' đổi theo mỗi lần tải OSM)
                if (!String(st.roadKey).startsWith('way#')) {
                    if (st.width !== st.osmWidth) saved.widths[st.roadKey] = st.width;
                    else delete saved.widths[st.roadKey];
                }
                localStorage.setItem(_RA_CFG_KEY, JSON.stringify(saved));
            } catch (_) { /* localStorage có thể bị chặn — không ảnh hưởng căn */ }
        }
        function _raDefaultCfg(ref, g, saved, width) {
            const c = ref === 'tim'
                ? { ref, side: Math.sign(g.median) || g.sidePref, value: +Math.abs(g.median).toFixed(1) }
                : { ref: 'mep', side: g.sidePref, value: Number.isFinite(saved.mepValue) ? saved.mepValue : 0.5 };
            return _raFitCfg(c, width);   // giá trị nhớ từ đường khác có thể không hợp lệ ở đường này
        }
        const _RA_COMPASS = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
        function _raCompass(vx, vy) {
            if (Math.hypot(vx, vy) < 1e-6) return '';   // tuyến chữ U: các hướng triệt tiêu
            const deg = (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360;   // 0 = Bắc, theo chiều kim đồng hồ
            return _RA_COMPASS[Math.round(deg / 45) % 8];
        }

        // Tính lại kế hoạch theo mốc/phía/khoảng cách người dùng chọn; giữ tick người dùng đã đổi tay
        function _raRecompute() {
            const st = _raState;
            if (!st) return;
            const base = _raPlanAlign(st.poles, st.lines, { roadKey: st.roadKey });   // hàng + trung vị + phía nhiều trụ (không phụ thuộc mốc)
            if (base.error) {
                _raClose();
                displayError(base.error === 'no_road'
                    ? 'Không tìm thấy đường xe chạy OSM trong vòng 30m quanh tuyến.'
                    : 'Chỉ có 1 trụ nằm dọc đường — cần ít nhất 2 trụ để căn.');
                return;
            }
            st.roadKey = base.roadKey;
            if (st.width == null) {
                const sw = _raLoadCfg().widths[st.roadKey];
                // OSM có thể cho tới 99m (tag width) → kẹp về khoảng hợp lệ
                st.osmWidth = +Math.min(RA_MAX_WIDTH, Math.max(0.5, _raRoadWidth(st.lines, st.roadKey))).toFixed(1);
                st.width = (Number.isFinite(sw) && sw > 0 && sw <= RA_MAX_WIDTH) ? sw : st.osmWidth;
            }
            if (!st.cfg || st.cfg.length !== base.groups.length) {
                const saved = _raLoadCfg();
                st.cfg = base.groups.map(g => _raDefaultCfg(saved.ref === 'tim' ? 'tim' : 'mep', g, saved, st.width));
                st.lastMep = st.cfg.map(c => (c.ref === 'mep' ? c.value : null));
            }
            // Mốc tim → khoảng cách có dấu tới tim/trục giữa. Mốc mép → để hàm tính dùng ½ bề rộng CỦA TỪNG TRỤ
            // (đường đôi: ½ khoảng 2 tim + ½ bề rộng 1 chiều), nên không quy đổi sẵn ra 1 offset chung ở đây.
            const offsets = st.cfg.map(c => (c.ref === 'tim' ? (c.side < 0 ? -1 : 1) * c.value : null));
            const edge = st.cfg.map(c => (c.ref === 'mep' ? { side: c.side, value: c.value } : null));
            const plan = _raPlanAlign(st.poles, st.lines, {
                offsets, edge, crossMin: 2, roadKey: st.roadKey,
                width: st.width !== st.osmWidth ? st.width : null   // chưa sửa → mỗi đoạn dùng bề rộng OSM của chính nó
            });
            st.groups = plan.groups;
            st.dual = plan.dual;
            st.entries = st.order.map(i => {
                const item = plan.items[i], row = st.rows[i];
                item.rtk = String(row[24] || '').trim() === 'rtk';
                const movable = item.flag !== 'far' && item.flag !== 'end';
                // Trụ đo RTK (cm) chính xác hơn tim đường OSM (m) → mặc định không dời
                if (movable && item.rtk) item.checked = false;
                if (movable && st.manual.has(i)) item.checked = st.manual.get(i);
                return { idx: i, row, item, ll: st.frame.toLL(item.x, item.y) };
            });
            // Nhãn la bàn 2 phía của mỗi hàng (tổng pháp tuyến trái) — dễ hiểu hơn "trái/phải hướng way OSM"
            st.groups.forEach((g, gi) => {
                const mem = st.entries.filter(e => e.item.group === gi && e.item.nx != null);
                const vx = mem.reduce((s, e) => s + e.item.nx, 0), vy = mem.reduce((s, e) => s + e.item.ny, 0);
                g.compassPos = _raCompass(vx, vy) || 'trái hướng đường';
                g.compassNeg = _raCompass(-vx, -vy) || 'phải hướng đường';
            });
            _raRenderPanel();
            _raRenderPreview();
        }

        function _raCfgError(err, cfg, width) {
            if (err === 'width') return `Bề rộng đường phải lớn hơn 0 và không quá ${RA_MAX_WIDTH} m.`;
            if (err === 'inside') return `Vào lòng đường tối đa ½ bề rộng (${(width / 2).toFixed(1)} m) — quá nữa là sang bên kia tim.`;
            return cfg.ref === 'tim' ? `Khoảng cách tới tim phải từ 0 đến ${RA_MAX_DIST} m.`
                                     : `Khoảng cách không hợp lệ (vị trí mới phải cách tim không quá ${RA_MAX_DIST} m).`;
        }
        // Đổi cấu hình 1 hàng — kiểm hợp lệ trước khi nhận; sai thì báo và trả ô nhập về giá trị đang dùng
        function _raUpdateCfg(g, patch) {
            const st = _raState;
            if (!st || !st.cfg || !st.cfg[g]) return;
            const next = Object.assign({}, st.cfg[g], patch);
            const t = _raTargetOffset(Object.assign({}, next, { width: st.width }));
            if (t.error) { displayError(_raCfgError(t.error, next, st.width)); _raRenderPanel(); return; }
            st.cfg[g] = next;
            _raRecompute();
        }
        function _raSetRef(g, ref) {
            const st = _raState;
            if (!st || !st.groups || !st.groups[g] || !st.cfg[g] || st.cfg[g].ref === ref) return;
            if (st.cfg[g].ref === 'mep') st.lastMep[g] = st.cfg[g].value;   // quay lại mép → lấy giá trị vừa sửa trong phiên
            const d = _raDefaultCfg(ref, st.groups[g], _raLoadCfg(), st.width);
            const value = (ref === 'mep' && Number.isFinite(st.lastMep[g])) ? _raFitCfg({ ref, value: st.lastMep[g] }, st.width).value : d.value;
            _raUpdateCfg(g, { ref: d.ref, value });   // giữ phía đang chọn
        }
        function _raSetSide(g, s) { _raUpdateCfg(g, { side: s < 0 ? -1 : 1 }); }
        function _raSetValue(g, v) { _raUpdateCfg(g, { value: parseFloat(String(v).replace(',', '.')) }); }
        function _raSetWidth(v) {
            const st = _raState;
            if (!st) return;
            const w = parseFloat(String(v).replace(',', '.'));
            for (const c of st.cfg) {
                const t = _raTargetOffset(Object.assign({}, c, { ref: 'mep', width: w }));
                if (t.error === 'width' || (c.ref === 'mep' && t.error)) { displayError(_raCfgError(t.error, c, w)); _raRenderPanel(); return; }
            }
            st.width = w;
            _raRecompute();
        }
        Object.assign(window, { _raSetRef, _raSetSide, _raSetValue, _raSetWidth });

        function _raRenderPreview() {
            if (!_raState) return;
            _raState.layer.clearLayers();
            _raState.entries.forEach(e => {
                if (e.item.flag === 'far' || e.item.flag === 'end') return;
                const from = [parseCoord(e.row[2]), parseCoord(e.row[3])], to = [e.ll.lat, e.ll.lon];
                const on = e.item.checked;
                L.polyline([from, to], { color: on ? '#f59e0b' : '#94a3b8', weight: 2, dashArray: '4 3', interactive: false }).addTo(_raState.layer);
                const pos = _raState.entries.indexOf(e);
                L.circleMarker(to, { radius: 7, color: '#fff', weight: 2, fillColor: on ? '#16a34a' : '#94a3b8', fillOpacity: 1, interactive: true, bubblingMouseEvents: false })
                    .bindTooltip(_esc(e.row[1] || '') + (on ? ' — bấm để bỏ' : ' — bấm để chọn'), { direction: 'top' })
                    .on('click', () => _raToggle(pos, !e.item.checked))
                    .addTo(_raState.layer);
            });
        }

        const _RA_FLAG_NOTE = {
            far:      ['#64748b', 'xa đường', 'Cách tim đường được chọn hơn 30 m'],
            end:      ['#64748b', 'quá đầu đường', 'Trụ nằm ngoài đầu mút đường trên OSM — dời sẽ trượt dọc tuyến'],
            big:      ['#dc2626', 'dời lớn', 'Cần dời hơn 10 m'],
            cross:    ['#dc2626', 'bên kia đường', 'Trụ nằm ở phía bên kia tim, khác phần còn lại của hàng'],
            straddle: ['#b45309', 'vắt qua tim', 'Trụ ở phía kia tim 2m trở lên — có thể GPS lệch hoặc trụ thật bên kia đường; kiểm tra rồi tick nếu đúng'],
            junction: ['#b45309', 'gần nút giao', 'Vị trí mới gần nhánh khác của đường (đường đôi / nút giao)']
        };

        function _panelEl() {
            let el = document.getElementById('alignRoutePanel');
            if (!el) {
                el = document.createElement('div');
                el.id = 'alignRoutePanel';
                el.setAttribute('role', 'dialog');
                el.setAttribute('aria-label', 'Căn thẳng tuyến đèn');
                // Màn hẹp (điện thoại): panel cao hơn để bảng trụ còn chỗ dưới phần cấu hình
                el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:1040;width:min(440px,calc(100vw - 32px));max-height:' + (window.innerWidth < 600 ? '75vh' : '60vh') + ';display:flex;flex-direction:column;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,.25);font-size:13px;color:#1e293b;';
                document.body.appendChild(el);
            }
            return el;
        }

        // v171 — chọn hàng loạt trong bảng trụ. Chỉ đụng trụ dời được (không far/end).
        // mode: 'all' (trừ RTK) | 'none' | 'invert' | 'group' (arg = chỉ số hàng; cả hàng đã chọn → bỏ, ngược lại chọn)
        //       'maxMove' (arg = m: chỉ chọn trụ dời ≤ m, trừ RTK) | 'noWarn' (bỏ trụ có cảnh báo)
        //       'range' (arg = { from, to, on }: vị trí trong bảng, gồm 2 đầu)
        // Trả danh sách vị trí đã đổi trạng thái.
        const _RA_WARN_FLAGS = new Set(['big', 'cross', 'straddle', 'junction']);
        function _raBulkSelect(entries, mode, arg) {
            const movable = e => e.item.flag !== 'far' && e.item.flag !== 'end';
            let target;   // i → true/false
            if (mode === 'group') {
                const mem = entries.map((e, i) => i).filter(i => movable(entries[i]) && entries[i].item.group === arg);
                const allOn = mem.length > 0 && mem.every(i => entries[i].item.checked);
                target = new Map(mem.map(i => [i, !allOn]));
            } else if (mode === 'range') {
                const lo = Math.max(0, Math.min(arg.from, arg.to)), hi = Math.min(entries.length - 1, Math.max(arg.from, arg.to));
                target = new Map();
                for (let i = lo; i <= hi; i++) if (movable(entries[i])) target.set(i, !!arg.on);
            } else {
                target = new Map();
                entries.forEach((e, i) => {
                    if (!movable(e)) return;
                    if (mode === 'all') { if (!e.item.rtk) target.set(i, true); }
                    else if (mode === 'none') target.set(i, false);
                    else if (mode === 'invert') target.set(i, !e.item.checked);
                    else if (mode === 'maxMove') target.set(i, !e.item.rtk && e.item.move <= arg + 1e-9);
                    else if (mode === 'noWarn') { if (_RA_WARN_FLAGS.has(e.item.flag)) target.set(i, false); }
                });
            }
            const changed = [];
            for (const [i, on] of target) if (entries[i].item.checked !== on) { entries[i].item.checked = on; changed.push(i); }
            return changed;
        }
        function _raBulk(mode, arg) {
            const st = _raState;
            if (!st) return;
            if (mode === 'maxMove') {
                const v = parseFloat(String(arg).replace(',', '.'));
                if (!(v >= 0)) { displayError('Nhập số mét dời tối đa ≥ 0.'); return; }
                st.maxMove = v; arg = v;
            }
            const changed = _raBulkSelect(st.entries, mode, arg);
            changed.forEach(i => st.manual.set(st.entries[i].idx, st.entries[i].item.checked));
            _raRenderPanel();
            _raRenderPreview();
        }
        function _raSetTab(t) { if (_raState) { _raState.tab = t; _raRenderPanel(); } }
        Object.assign(window, { _raBulk, _raSetTab });

        function _raRenderPanel() {
            const st = _raState;
            if (!st) return;
            const el = _panelEl();
            const box = el.querySelector ? el.querySelector('[data-ra-scroll]') : null;
            const scrollTop = box ? box.scrollTop : 0;   // tick/đổi số không làm bảng nhảy về đầu
            const nSel = st.entries.filter(e => e.item.checked).length;
            const multi = st.groups.length > 1;
            const movableN = st.entries.filter(e => e.item.flag !== 'far' && e.item.flag !== 'end').length;
            const tab = st.tab || 'pick';
            const note = it => {
                const f = _RA_FLAG_NOTE[it.flag];
                const parts = f ? [`<span style="color:${f[0]};font-weight:700" title="${f[2]}">${f[1]}</span>`] : [];
                if (it.rtk) parts.push('<span style="color:#0369a1" title="Toạ độ đo RTK (cm) — mặc định không dời">đo RTK</span>');
                return parts.join(' · ');
            };
            const rowsHtml = st.entries.map((e, i) => {
                const fixed = e.item.flag === 'far' || e.item.flag === 'end';
                const warn = e.item.flag === 'big' || e.item.flag === 'cross';
                return `<tr style="border-top:1px solid #e2e8f0;${warn ? 'background:#fef2f2;' : ''}">
                <td style="padding:0 4px;"><label style="display:flex;align-items:center;gap:8px;min-height:44px;cursor:${fixed ? 'default' : 'pointer'};">
                    <input type="checkbox" ${e.item.checked ? 'checked' : ''} ${fixed ? 'disabled' : ''}
                        onclick="_raToggle(${i}, this.checked, event.shiftKey)" style="width:20px;height:20px;flex:none;">
                    <span style="font-weight:600;">${_esc(e.row[1] || '')}</span></label></td>
                <td style="padding:0 4px;text-align:center;color:#64748b;">${multi && !fixed && e.item.group != null ? e.item.group + 1 : ''}</td>
                <td style="padding:0 4px;text-align:right;white-space:nowrap;">${e.item.dist.toFixed(1)} m</td>
                <td style="padding:0 4px;text-align:right;font-weight:700;white-space:nowrap;">${fixed ? '—' : e.item.move.toFixed(2) + ' m'}</td>
                <td style="padding:0 4px;font-size:12px;">${note(e.item)}</td></tr>`;
            }).join('');
            const roadName = String(st.roadKey).startsWith('way#') ? 'không tên' : st.roadKey;
            const seg = (on, onclick, label, aria) => `<button type="button" onclick="${onclick}" aria-pressed="${on}" ${aria ? `aria-label="${aria}"` : ''}
                style="flex:1;min-height:44px;padding:0 8px;border:1.5px solid ${on ? '#2563eb' : '#cbd5e1'};background:${on ? '#eff6ff' : '#fff'};color:${on ? '#1d4ed8' : '#334155'};border-radius:8px;font-weight:${on ? 800 : 600};font-size:13px;cursor:pointer;">${label}</button>`;
            const numInput = (val, onchange, aria, min, max) => `<input type="number" inputmode="decimal" ${min != null ? `min="${min}"` : ''} max="${max}" step="0.1" value="${val}"
                onchange="${onchange}" aria-label="${aria}" style="width:80px;min-height:44px;padding:4px 8px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:16px;text-align:right;">`;
            const anyMep = st.cfg.some(c => c.ref === 'mep');
            const groupsHtml = st.groups.map((g, gi) => {
                const c = st.cfg[gi];
                const dist = Math.abs(g.offset);
                return `<div style="margin-top:10px;${st.groups.length > 1 ? 'padding-top:8px;border-top:1px dashed #e2e8f0;' : ''}">
                    ${st.groups.length > 1 ? `<div style="font-weight:700;margin-bottom:4px;">Hàng ${gi + 1} <span style="color:#94a3b8;font-weight:400;">(${g.count} trụ)</span></div>` : ''}
                    <div style="display:flex;gap:6px;align-items:center;"><span style="width:56px;color:#64748b;">Mốc</span>
                        ${seg(c.ref === 'mep', `_raSetRef(${gi},'mep')`, 'Mép đường')}${seg(c.ref === 'tim', `_raSetRef(${gi},'tim')`, 'Tim đường')}</div>
                    <div style="display:flex;gap:6px;align-items:center;margin-top:6px;"><span style="width:56px;color:#64748b;">Phía</span>
                        ${seg(c.side > 0, `_raSetSide(${gi},1)`, _esc(g.compassPos), 'Phía ' + _esc(g.compassPos))}${seg(c.side < 0, `_raSetSide(${gi},-1)`, _esc(g.compassNeg), 'Phía ' + _esc(g.compassNeg))}</div>
                    <label style="display:flex;gap:6px;align-items:center;margin-top:6px;"><span style="width:56px;color:#64748b;">Cách</span>
                        ${numInput(+c.value.toFixed(2), `_raSetValue(${gi}, this.value)`, c.ref === 'mep' ? 'Khoảng cách từ mép đường (m)' : 'Khoảng cách từ tim đường (m)',
                            c.ref === 'mep' ? -st.width / 2 : 0, c.ref === 'mep' ? RA_MAX_DIST - st.width / 2 : RA_MAX_DIST)}
                        <span style="flex:1;color:#64748b;font-size:12px;">m ${c.ref === 'mep' ? 'từ mép (+ ra vỉa hè, − vào lòng đường)' : 'từ tim'}
                            → <b style="color:#1e293b;">cách ${st.dual ? 'trục giữa' : 'tim'} ${dist.toFixed(1)} m</b></span></label>
                </div>`;
            }).join('');
            const tabBtn = (id, label) => `<button type="button" role="tab" aria-selected="${tab === id}" onclick="_raSetTab('${id}')"
                style="flex:1;min-height:40px;border:none;border-bottom:3px solid ${tab === id ? '#2563eb' : 'transparent'};background:none;color:${tab === id ? '#1d4ed8' : '#64748b'};font-weight:${tab === id ? 800 : 600};font-size:13px;cursor:pointer;">${label}</button>`;
            const chip = (onclick, label, title) => `<button type="button" onclick="${onclick}" ${title ? `title="${title}"` : ''}
                style="min-height:36px;padding:0 10px;border:1.5px solid #cbd5e1;background:#fff;color:#334155;border-radius:999px;font-weight:600;font-size:12px;cursor:pointer;white-space:nowrap;">${label}</button>`;
            const hasRtk = st.entries.some(e => e.item.rtk && e.item.flag !== 'far' && e.item.flag !== 'end');
            const nWarn = st.entries.filter(e => e.item.checked && _RA_WARN_FLAGS.has(e.item.flag)).length;
            const maxMove = st.maxMove != null ? st.maxMove : 2;
            const groupChips = multi ? st.groups.map((g, gi) => {
                const mem = st.entries.filter(e => e.item.group === gi && e.item.flag !== 'far' && e.item.flag !== 'end');
                const on = mem.filter(e => e.item.checked).length;
                return chip(`_raBulk('group',${gi})`, `Hàng ${gi + 1} <span style="color:#64748b;font-weight:400;">${on}/${mem.length}</span>`,
                    on === mem.length ? 'Bỏ chọn cả hàng' : 'Chọn cả hàng');
            }).join('') : '';
            const pickBar = `
                <div style="padding:8px 14px;border-bottom:1px solid #e2e8f0;flex:none;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span aria-live="polite"><b>Đã chọn ${nSel}/${movableN}</b>${st.entries.length > movableN ? ` <span style="color:#94a3b8;font-size:12px;">(${st.entries.length - movableN} không dời được)</span>` : ''}</span>
                        ${nWarn ? `<span style="color:#dc2626;font-size:12px;font-weight:700;">⚠ ${nWarn} trụ có cảnh báo</span>` : ''}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">
                        ${chip(`_raBulk('all')`, hasRtk ? '☑ Tất cả (trừ RTK)' : '☑ Tất cả', hasRtk ? 'Trụ đo RTK chính xác hơn tim OSM — tick tay nếu muốn dời' : '')}
                        ${chip(`_raBulk('none')`, '☐ Bỏ hết')}
                        ${chip(`_raBulk('invert')`, '⇄ Đảo')}
                        ${groupChips}
                        <span style="display:inline-flex;align-items:center;gap:4px;border:1.5px solid #cbd5e1;border-radius:999px;padding:0 4px 0 10px;min-height:36px;">
                            <button type="button" onclick="_raBulk('maxMove', document.getElementById('raMaxMove').value)" style="border:none;background:none;font-weight:600;font-size:12px;color:#334155;cursor:pointer;padding:0;">Chỉ dời ≤</button>
                            <input id="raMaxMove" type="number" inputmode="decimal" min="0" step="0.5" value="${maxMove}" aria-label="Số mét dời tối đa"
                                onkeydown="if(event.key==='Enter')_raBulk('maxMove', this.value)" style="width:56px;min-height:30px;border:1px solid #e2e8f0;border-radius:6px;font-size:16px;text-align:right;padding:0 4px;"> m</span>
                        ${chip(`_raBulk('noWarn')`, '⚠ Bỏ trụ cảnh báo', 'Bỏ chọn trụ dời lớn / bên kia đường / vắt tim / gần nút giao')}
                    </div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:4px;">Giữ Shift khi tick để chọn cả dải · bấm chấm trên bản đồ để chọn/bỏ</div>
                </div>`;
            const cfgSummary = st.groups.map((g, gi) => {
                const c = st.cfg[gi];
                return `${multi ? `Hàng ${gi + 1}: ` : ''}${c.ref === 'mep' ? 'Mép' : 'Tim'} · ${_esc(c.side > 0 ? g.compassPos : g.compassNeg)} · ${(+c.value).toFixed(1)} m`;
            }).join(' &nbsp;|&nbsp; ');
            el.innerHTML = `
                <div style="padding:12px 14px 0;flex:none;">
                    <div style="font-weight:800;font-size:14px;">📏 Căn thẳng tuyến ${_esc(st.base)}</div>
                    <div style="color:#64748b;margin-top:2px;">Theo đường <b>${_esc(roadName)}</b> — mỗi trụ chỉ dời vuông góc với đường.</div>
                    <div role="tablist" style="display:flex;margin-top:6px;border-bottom:1px solid #e2e8f0;">
                        ${tabBtn('cfg', '⚙ Cấu hình')}${tabBtn('pick', `☑ Chọn trụ (${nSel}/${movableN})`)}
                    </div>
                </div>
                ${tab === 'cfg' ? `
                <div data-ra-cfg style="padding:4px 14px 10px;overflow:auto;flex:1;">
                    ${st.dual ? `<div style="margin-top:6px;padding:6px 8px;background:#eff6ff;border-radius:8px;color:#1e40af;font-size:12px;">
                        🛣 <b>Đường đôi</b> — 2 tim 2 chiều xe cách nhau ~${st.dual.gap.toFixed(1)} m. Căn theo <b>trục giữa</b>; mép = mép ngoài cả con đường.</div>` : ''}
                    ${anyMep ? `<label style="display:flex;gap:6px;align-items:center;margin-top:8px;"><span style="flex:1;color:#64748b;">${st.dual ? 'Bề rộng 1 chiều xe' : 'Bề rộng mặt đường'}
                        <span style="font-size:12px;">(OSM: ${st.osmWidth.toFixed(1)} m)</span></span>
                        ${numInput(st.width, '_raSetWidth(this.value)', 'Bề rộng mặt đường (m)', 0.5, RA_MAX_WIDTH)} m</label>` : ''}
                    ${groupsHtml}
                </div>` : `
                <div style="padding:6px 14px 0;color:#64748b;font-size:12px;flex:none;">⚙ ${cfgSummary}</div>
                ${pickBar}
                <div data-ra-scroll style="overflow:auto;flex:1;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead style="position:sticky;top:0;background:#fff;z-index:1;"><tr style="color:#64748b;font-size:11px;text-align:left;">
                            <th style="padding:6px 4px;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                                <input type="checkbox" data-ra-all aria-label="Chọn / bỏ tất cả" ${nSel && nSel === movableN ? 'checked' : ''}
                                    onclick="_raBulk(this.checked ? 'all' : 'none')" style="width:20px;height:20px;">Trụ</label></th>
                            <th style="padding:6px 4px;text-align:center;">${multi ? 'Hàng' : ''}</th>
                            <th style="padding:6px 4px;text-align:right;">Cách tim</th><th style="padding:6px 4px;text-align:right;">Dời</th><th></th></tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>`}
                <div style="display:flex;gap:8px;padding:10px 14px;border-top:1px solid #e2e8f0;flex:none;">
                    <button onclick="_raClose()" style="flex:1;min-height:44px;border:1.5px solid #cbd5e1;background:#fff;border-radius:8px;font-weight:700;cursor:pointer;">Hủy</button>
                    <button onclick="_raApply()" ${nSel ? '' : 'disabled'} style="flex:2;min-height:44px;border:none;background:${nSel ? '#2563eb' : '#94a3b8'};color:#fff;border-radius:8px;font-weight:800;cursor:${nSel ? 'pointer' : 'default'};">Áp dụng (${nSel} trụ)</button>
                </div>`;
            const allBox = el.querySelector ? el.querySelector('[data-ra-all]') : null;
            if (allBox) allBox.indeterminate = nSel > 0 && nSel < movableN;
            const box2 = el.querySelector ? el.querySelector('[data-ra-scroll]') : null;
            if (box2) box2.scrollTop = scrollTop;
        }

        function _raToggle(i, on, shift) {
            const st = _raState;
            const e = st && st.entries[i];
            if (!e || e.item.flag === 'far' || e.item.flag === 'end') return;
            if (shift && Number.isInteger(st.lastClick) && st.lastClick !== i) {
                // Shift+click: cả dải từ ô bấm trước tới ô này nhận cùng trạng thái
                _raBulkSelect(st.entries, 'range', { from: st.lastClick, to: i, on: !!on })
                    .forEach(k => st.manual.set(st.entries[k].idx, st.entries[k].item.checked));
            }
            e.item.checked = !!on;
            st.manual.set(e.idx, !!on);
            st.lastClick = i;
            _raRenderPanel();
            _raRenderPreview();
        }
        window._raToggle = _raToggle;

        function _raClose() {
            if (_raState && _raState.layer) map.removeLayer(_raState.layer);
            _raState = null;
            const el = document.getElementById('alignRoutePanel');
            if (el) el.remove();
        }
        window._raClose = _raClose;

        // Dời marker + nhãn trên bản đồ. Marker trong cluster phải gỡ ra/thêm lại để lưới cluster cập nhật.
        function _raMoveMarker(row, lat, lon) {
            const m = markers.find(x => x.marker && x.marker._rowRef === row);
            if (m) {
                m.lat = lat; m.lon = lon;
                const inCluster = markersCluster.hasLayer(m.marker);
                if (inCluster) markersCluster.removeLayer(m.marker);
                m.marker.setLatLng([lat, lon]);
                if (inCluster) markersCluster.addLayer(m.marker);
            }
            const rid = String(row[0] || row[1] || '');
            const lbl = _lblMarkers.get(rid);
            if (lbl) {
                const off = _labelOffsets[rid] || { dlat: 0, dlon: 0 };
                lbl.setLatLng([lat + off.dlat, lon + off.dlon]);
                lbl._poleLatlng = L.latLng(lat, lon);
            }
        }

        // Như updateMarkerCoordinatesInData nhưng thao tác ĐÚNG dòng được truyền vào (không tìm theo tên/ID —
        // sheet có thể có dòng trùng tên): toạ độ, VN2000, khoảng cách cáp tới trụ cha + của các trụ con.
        function _raSetRowCoords(row, lat, lon) {
            const tsNow = new Date().toLocaleString('vi-VN');
            row[2] = lat; row[3] = lon; row[13] = tsNow;
            const vn = convertLatLonToVn2000(lat, lon);
            row[19] = Math.round(vn.x); row[20] = Math.round(vn.y);
            dirtyMovedRows.add(row);
            const all = _raAllRows();
            const pName = String(row[14] || '').trim();
            if (pName) {
                const p = all.find(r => r !== row && _raKeyOf(r).includes(pName));
                if (p && isFinite(parseCoord(p[2])) && isFinite(parseCoord(p[3]))) {
                    row[15] = Math.round(getDistanceMeters(lat, lon, parseCoord(p[2]), parseCoord(p[3])));
                }
            }
            const keys = _raKeyOf(row);
            all.forEach(c => {
                if (c === row || !keys.includes(String(c[14] || '').trim())) return;
                const cl = parseCoord(c[2]), co = parseCoord(c[3]);
                if (!isFinite(cl) || !isFinite(co)) return;
                c[15] = Math.round(getDistanceMeters(cl, co, lat, lon));
                c[13] = tsNow;
                dirtyMovedRows.add(c);
                _invalidatePopupCacheForRow(c);
            });
            _invalidatePopupCacheForRow(row);
            _raMoveMarker(row, lat, lon);
        }

        async function _raApply() {
            if (!_raState) return;
            if (!canDrag()) { _raClose(); displayError('Tài khoản hiện tại không có quyền dời marker.'); return; }
            const sel = _raState.entries.filter(e => e.item.checked && e.item.flag !== 'far' && e.item.flag !== 'end');
            if (!sel.length) return;
            // Snapshot nguyên văn trụ được dời + trụ con (khoảng cách cáp đổi theo) để hoàn tác chính xác
            const selKeys = new Set(sel.flatMap(e => _raKeyOf(e.row)));
            const affected = new Set(sel.map(e => e.row));
            _raAllRows().forEach(r => { if (selKeys.has(String(r[14] || '').trim())) affected.add(r); });
            const snaps = [...affected].map(r => ({ row: r, vals: _RA_SNAP_COLS.map(c => r[c]) }));
            sel.forEach(e => _raSetRowCoords(e.row, e.ll.lat, e.ll.lon));
            updateDirtyMovedBadge();
            _raUndo = { snaps, applied: new Map(sel.map(e => [e.row, [e.row[2], e.row[3]]])) };
            const base = _raState.base;
            _raSaveCfg(_raState);   // nhớ mốc / khoảng cách mép / bề rộng đường cho lần căn sau
            _raClose();
            if (_cableVisible) _rebuildCableLines();
            const res = await pushMovedMarkersToSheet();
            const failed = res && res.failed;
            _raShowUndoBar(failed
                ? `Đã căn ${sel.length} trụ tuyến ${base} trên app, nhưng ${failed} dòng chưa lên được sheet — bấm "Cập nhật" để thử lại.`
                : `Đã căn ${sel.length} trụ tuyến ${base}.`, !!failed);
        }
        window._raApply = _raApply;

        function _raShowUndoBar(msg, isWarn) {
            const el = _panelEl();
            el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;">
                <div style="flex:1;${isWarn ? 'color:#b45309;' : ''}">${isWarn ? '⚠' : '✅'} ${_esc(msg)}</div>
                <button onclick="_raUndoAlign()" style="min-height:44px;padding:0 14px;border:1.5px solid #f59e0b;background:#fffbeb;color:#b45309;border-radius:8px;font-weight:700;cursor:pointer;">↩ Hoàn tác</button>
                <button onclick="_raClose()" aria-label="Đóng" style="min-height:44px;min-width:44px;border:none;background:none;font-size:18px;cursor:pointer;">✕</button></div>`;
        }

        async function _raUndoAlign() {
            if (!_raUndo) return;
            if (!canDrag()) { _raClose(); _raUndo = null; displayError('Tài khoản hiện tại không có quyền dời marker.'); return; }
            const u = _raUndo;
            _raUndo = null;
            const live = new Set(_raAllRows());
            if (![...u.applied.keys()].every(r => live.has(r))) {
                _raClose();
                displayError('Dữ liệu đã được tải lại sau khi căn — không hoàn tác được nữa.');
                return;
            }
            const movedAgain = [...u.applied].filter(([r, ll]) => r[2] !== ll[0] || r[3] !== ll[1]).map(([r]) => String(r[1] || r[0]));
            if (movedAgain.length && !confirm(`${movedAgain.length} trụ đã bị dời tiếp sau khi căn (${movedAgain.slice(0, 5).join(', ')}${movedAgain.length > 5 ? '…' : ''}).\nHoàn tác sẽ đưa cả các trụ này về vị trí trước khi căn. Tiếp tục?`)) {
                _raUndo = u;
                return;
            }
            u.snaps.forEach(s => {
                _RA_SNAP_COLS.forEach((c, k) => { s.row[c] = s.vals[k]; });
                dirtyMovedRows.add(s.row);
                _invalidatePopupCacheForRow(s.row);
                _raMoveMarker(s.row, parseCoord(s.row[2]), parseCoord(s.row[3]));
            });
            updateDirtyMovedBadge();
            _raClose();
            if (_cableVisible) _rebuildCableLines();
            await pushMovedMarkersToSheet();
        }
        window._raUndoAlign = _raUndoAlign;
