// Auto MST tuyến cáp — modal chọn tủ, xem trước, áp dụng diff, rollback
// Tách từ index.html (đợt 3 module hoá, v175) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ ("</script><script src=…><script>") nên thứ tự chạy lúc nạp giữ nguyên.
// Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau. Thêm code CHẠY LÚC NẠP phải rà lại.

        // ═══════════════════════════════════════════════════════════════════
        // T22 — Auto-generate tuyến cáp MST (Minimum Spanning Tree)
        // ═══════════════════════════════════════════════════════════════════

        let _mstResult = null;       // { edges: [{fromRow, toRow, dist}], nodes, warnings }
        let _mstPreviewLayer = null; // L.layerGroup của preview trên map

        // v185 — Gom node theo TỦ (cột Tủ điều khiển) hoặc theo TÊN TUYẾN (tên trụ bỏ số) — dữ liệu chưa gán tủ cho trụ
        // (vd Bàu Bàng: chỉ dòng tủ có cột Tủ) thì gom theo tủ mỗi tủ chỉ 1 node → không chạy được.
        // Giá trị option chế độ tên tuyến: 'ten:<basename chuẩn hoá>'.
        let _mstGroupBy = 'tu';
        const _mstIsPoleRow = r => { const t = parseInt(r[6]); return t >= 1 && t <= 4; };
        const _mstRawBase = n => String(n || '').trim().replace(/\s*\([^()]*\)$/, '').replace(/[_\s\-]*\d+$/, '') || String(n || '').trim();
        function _mstRouteOptions() {
            const m = new Map();   // basename chuẩn hoá → { label, n }
            for (const r of (loadedData || []).slice(1)) {
                if (!_mstIsPoleRow(r) || !isFinite(parseCoord(r[2])) || !isFinite(parseCoord(r[3]))) continue;
                const nb = normalizeMarkerBaseName(String(r[1] || '').trim());
                if (!nb) continue;
                if (!m.has(nb)) m.set(nb, { label: _mstRawBase(r[1]), n: 0 });
                m.get(nb).n++;
            }
            return [...m].map(([nb, v]) => ({ value: 'ten:' + nb, label: `${v.label} (${v.n} trụ)`, n: v.n }))
                .sort((a, b) => a.label.localeCompare(b.label, 'vi', { numeric: true }));
        }
        function _mstFillSelect() {
            const sel = document.getElementById('mstTuSelect');
            if (!sel) return 0;
            let opts;
            if (_mstGroupBy === 'ten') opts = _mstRouteOptions();
            else opts = _getUniqueCabinets().map(t => ({ value: t, label: t }));
            sel.innerHTML = opts.map(o => `<option value="${_esc(o.value)}">${_esc(o.label)}</option>`).join('');
            if (sel.options.length > 0) sel.options[0].selected = true;
            document.querySelectorAll('input[name="mstGroupBy"]').forEach(el => { el.checked = el.value === _mstGroupBy; });
            const lbl = document.getElementById('mstTuLabel');
            if (lbl) lbl.textContent = _mstGroupBy === 'ten' ? 'Chọn tuyến' : 'Chọn tủ điều khiển';
            return opts.length;
        }
        function _mstSetGroupBy(v) {
            _mstGroupBy = v === 'ten' ? 'ten' : 'tu';
            try { localStorage.setItem('mst_group_by', _mstGroupBy); } catch (e) { _swallow(e); }
            _mstFillSelect();
            _onMstTuChange();
        }
        window._mstSetGroupBy = _mstSetGroupBy;

        // forceMode: 'tu' khi mở từ Kiểm tra sơ đồ cáp (chọn sẵn theo tên tủ)
        function _openAutoMstModal(forceMode) {
            const modal = document.getElementById('autoMstModal');
            if (!modal) return;
            let saved = null;
            try { saved = localStorage.getItem('mst_group_by'); } catch (e) { _swallow(e); }
            _mstGroupBy = forceMode || (saved === 'ten' ? 'ten' : 'tu');
            // Theo tủ mà không tủ nào có ≥ 2 node (trụ chưa gán tủ) → tự chuyển sang theo tên tuyến
            if (!forceMode && _mstGroupBy === 'tu' && !_getUniqueCabinets().some(t => _mstGetNodesForTu(t).length >= 2)) {
                _mstGroupBy = 'ten';
                displayInfo && displayInfo('Trụ chưa gán tủ điều khiển — chuyển sang gom theo tên tuyến.');
            }
            if (!_mstFillSelect()) {
                displayError && displayError(_mstGroupBy === 'ten' ? 'Không có trụ đèn nào có toạ độ' : 'Không có tủ điều khiển nào trong dữ liệu');
                return;
            }
            _mstResult = null;
            _mstRestoreRoadOpts();
            document.getElementById('mstBtnApply').disabled = true;
            _onMstTuChange();
            modal.style.display = 'flex';
            if (typeof closeControlsModal === 'function') closeControlsModal();
        }
        window._openAutoMstModal = _openAutoMstModal;

        function _closeAutoMstModal() {
            const modal = document.getElementById('autoMstModal');
            if (modal) modal.style.display = 'none';
            _mstRemovePreview();
        }
        window._closeAutoMstModal = _closeAutoMstModal;

        // P3: helper multi-select tủ
        function _mstGetSelectedTus() {
            const sel = document.getElementById('mstTuSelect');
            if (!sel) return [];
            return Array.from(sel.selectedOptions).map(o => o.value);
        }
        window._mstGetSelectedTus = _mstGetSelectedTus;

        function _mstSelectAllTus(sel) {
            const el = document.getElementById('mstTuSelect');
            if (!el) return;
            Array.from(el.options).forEach(o => { o.selected = !!sel; });
            _onMstTuChange();
        }
        window._mstSelectAllTus = _mstSelectAllTus;

        function _mstRemovePreview() {
            if (_mstPreviewLayer) {
                try { map.removeLayer(_mstPreviewLayer); } catch(e){_swallow(e);}
                _mstPreviewLayer = null;
            }
        }

        function _onMstTuChange() {
            _mstResult = null;
            _mstRemovePreview();
            // P1: Reset diff summary + disable Apply buttons
            const diffDiv = document.getElementById('mstDiffSummary');
            if (diffDiv) diffDiv.style.display = 'none';
            ['mstBtnApply', 'mstBtnApplyDiff'].forEach(id => {
                const b = document.getElementById(id);
                if (b) b.disabled = true;
            });
            // P3: Multi-select aggregate
            const tus = _mstGetSelectedTus();
            const preview = document.getElementById('mstPreview');
            if (tus.length === 0) {
                preview.innerHTML = '<span style="color:#94a3b8;">Chưa chọn tủ nào...</span>';
                return;
            }
            let totalNodes = 0, totalWithParent = 0, totalEmpty = 0;
            const lines = [];
            for (const tu of tus) {
                const nodes = _mstGetNodesForTu(tu);
                if (!nodes.length) {
                    totalEmpty++;
                    if (tus.length <= 8) lines.push(`<span style="color:#dc2626;">✗ ${_esc(tu)}: không có node</span>`);
                    continue;
                }
                totalNodes += nodes.length;
                totalWithParent += nodes.filter(n => n.parent).length;
                if (tus.length <= 8) lines.push(`<span style="color:#059669;">✓ ${_esc(tu)}: ${nodes.length} nodes</span>`);
            }
            preview.innerHTML = `
                <b>${tus.length}</b> ${_mstGroupBy === 'ten' ? 'tuyến' : 'tủ'} đã chọn · <b>${totalNodes}</b> trụ+tủ tổng<br>
                <span style="color:#64748b;font-size:11px;">Trong đó ${totalWithParent} đã có Marker gốc.${totalEmpty ? ' ' + totalEmpty + (_mstGroupBy === 'ten' ? ' tuyến' : ' tủ') + ' trống.' : ''}</span>
                ${tus.length <= 8 && lines.length ? '<div style="margin-top:6px;font-size:11px;line-height:1.6;">' + lines.join('<br>') + '</div>' : ''}
            `;
        }
        window._onMstTuChange = _onMstTuChange;

        // Lấy trụ + tủ root trong cùng cabinet name.
        // Root = tủ điều khiển (type 5/6 có name = tuName).
        // KHÔNG include tủ khác (type 5/6 có name != tuName) → tránh edge tủ-tủ trong MST.
        function _mstGetNodesForTu(tuName) {
            if (String(tuName).startsWith('ten:')) return _mstGetNodesForRoute(String(tuName).slice(4));
            const rows = (loadedData || []).slice(1);
            const inTu = rows.filter(r => String(r[7] || '').trim() === tuName);
            const nodes = [];
            for (const r of inTu) {
                const lat = parseCoord(r[2]);
                const lon = parseCoord(r[3]);
                if (!isFinite(lat) || !isFinite(lon)) continue;
                const type = parseInt(r[6]);
                const isCabinet = (type === 5 || type === 6);
                const name = String(r[1] || '').trim();
                const isRoot = isCabinet && name === tuName;
                // Skip tủ khác (không phải root của tủ này) → không nối tủ-tủ
                if (isCabinet && !isRoot) continue;
                nodes.push({
                    row: r, name, lat, lon, isRoot,
                    parent: String(r[14] || '').trim(),
                    dist: parseFloat(r[15]) || 0
                });
            }
            return nodes;
        }

        // Theo tên tuyến: trụ cùng basename. Gốc = tủ (loại 5/6) cùng basename gần trụ nhất (≤ 500 m); không có thì
        // trụ đầu tuyến (tên xếp tự nhiên nhỏ nhất). Tủ trùng TÊN với 1 trụ trong tuyến bị bỏ (áp dụng ghi theo tên → nhầm dòng).
        function _mstGetNodesForRoute(nb) {
            const rows = (loadedData || []).slice(1);
            const hasXY = r => isFinite(parseCoord(r[2])) && isFinite(parseCoord(r[3]));
            const poles = rows.filter(r => _mstIsPoleRow(r) && hasXY(r) && normalizeMarkerBaseName(String(r[1] || '').trim()) === nb);
            if (!poles.length) return [];
            const node = (r, isRoot) => ({ row: r, name: String(r[1] || '').trim(), lat: parseCoord(r[2]), lon: parseCoord(r[3]), isRoot,
                parent: String(r[14] || '').trim(), dist: parseFloat(r[15]) || 0 });
            const poleNames = new Set(poles.map(r => String(r[1] || '').trim()));
            const cabs = rows.filter(r => { const t = parseInt(r[6]); return (t === 5 || t === 6) && hasXY(r) &&
                !poleNames.has(String(r[1] || '').trim()) &&
                (normalizeMarkerBaseName(String(r[1] || '').trim()) === nb || normalizeMarkerBaseName(String(r[7] || '').trim()) === nb); });
            let root = null, best = 500;
            for (const c of cabs) {
                const cl = parseCoord(c[2]), co = parseCoord(c[3]);
                const d = Math.min(...poles.map(p => haversineM(cl, co, parseCoord(p[2]), parseCoord(p[3]))));
                if (d <= best) { best = d; root = c; }
            }
            const coll = new Intl.Collator('vi', { numeric: true });
            const sorted = poles.slice().sort((a, b) => coll.compare(String(a[1] || ''), String(b[1] || '')));
            const nodes = sorted.map((r, i) => node(r, !root && i === 0));
            if (root) nodes.unshift(node(root, true));
            return nodes;
        }

        // _mstPrim, _mstNearestChain → src/core/mst.js

        // P4: Auto-suggest threshold = median × 3 từ MST hiện tại
        function _mstAutoThreshold() {
            const tu = document.getElementById('mstTuSelect').value;
            const algo = document.getElementById('mstAlgo').value;
            const nodes = _mstGetNodesForTu(tu);
            if (nodes.length < 2) {
                displayError && displayError('Chọn tủ có ≥2 marker để tự tính');
                return;
            }
            const edges = algo === 'nearest' ? _mstNearestChain(nodes) : _mstPrim(nodes);
            if (edges.length === 0) return;
            const dists = edges.map(e => e.dist).sort((a, b) => a - b);
            const median = dists[Math.floor(dists.length / 2)];
            // Threshold = max(median × 3, 50m) — round to nearest 10
            const suggested = Math.max(50, Math.round(median * 3 / 10) * 10);
            const p95 = dists[Math.floor(dists.length * 0.95)];
            document.getElementById('mstMaxSegment').value = suggested;
            displayInfo && displayInfo(`🎯 Đề xuất ngưỡng: ${suggested}m (median=${Math.round(median)}m × 3, max thực tế=${Math.round(dists[dists.length - 1])}m, P95=${Math.round(p95)}m)`);
        }
        window._mstAutoThreshold = _mstAutoThreshold;

        // P1: Diff MST vs sheet — return {same, changed, added, removed} edge lists
        function _mstDiff(mstEdges, tuName) {
            // Build sheet map: {childName: parentName} cho các row trong tủ này
            const rowsInTu = _mstGetNodesForTu(tuName).map(n => n.row);
            const sheetMap = new Map();  // child → parent
            rowsInTu.forEach(r => {
                const child = String(r[1] || '').trim();
                const parent = String(r[14] || '').trim();
                if (child && parent) sheetMap.set(child, parent);
            });
            const mstMap = new Map();
            mstEdges.forEach(e => mstMap.set(e.to, e.from));

            const same = [], changed = [], added = [], removed = [];
            mstMap.forEach((mstParent, child) => {
                if (!sheetMap.has(child)) {
                    added.push({ from: mstParent, to: child, isNew: true });
                } else if (sheetMap.get(child) === mstParent) {
                    same.push({ from: mstParent, to: child });
                } else {
                    changed.push({ from: mstParent, to: child, oldParent: sheetMap.get(child) });
                }
            });
            sheetMap.forEach((sheetParent, child) => {
                if (!mstMap.has(child)) {
                    removed.push({ from: sheetParent, to: child });
                }
            });
            return { same, changed, added, removed };
        }
        window._mstDiff = _mstDiff;

        // v176 — tuỳ chọn tránh băng qua đường (nhớ trong localStorage)
        function _mstSaveRoadOpts() {
            try {
                localStorage.setItem('mst_avoid_road', document.getElementById('mstAvoidRoad').checked ? '1' : '0');
                localStorage.setItem('mst_cross_penalty', String(document.getElementById('mstCrossPenalty').value || ''));
            } catch (e) { _swallow(e); }
        }
        function _mstRestoreRoadOpts() {
            try {
                const a = localStorage.getItem('mst_avoid_road'), p = localStorage.getItem('mst_cross_penalty');
                const cb = document.getElementById('mstAvoidRoad'), inp = document.getElementById('mstCrossPenalty');
                if (cb && a != null) cb.checked = a === '1';
                if (inp && p) inp.value = p;
            } catch (e) { _swallow(e); }
        }
        window._mstSaveRoadOpts = _mstSaveRoadOpts;
        // Tải đường OSM quanh các trụ của các tủ đã chọn → bộ đếm băng đường; lỗi → null (tính như cũ)
        async function _mstLoadCrossCounter(tus) {
            const pts = [];
            for (const tu of tus) for (const n of _mstGetNodesForTu(tu)) pts.push(n);
            if (pts.length < 2) return null;
            const lats = pts.map(n => n.lat), lons = pts.map(n => n.lon);
            const PAD = 0.0006;   // ~65 m
            const bounds = { minLat: Math.min(...lats) - PAD, maxLat: Math.max(...lats) + PAD,
                             minLon: Math.min(...lons) - PAD, maxLon: Math.max(...lons) + PAD };
            const osm = typeof _raFetchRoads === 'function' ? await _raFetchRoads(bounds)
                : await _fetchOsmBasemap(bounds, { roads: true, buildings: false });
            return _mstRoadCrossCounter(osm && osm.roads, typeof _rlIsDrivable === 'function' ? _rlIsDrivable : null);
        }

        async function _mstDoPreview() {
            if (_mstDoPreview._busy) return;
            const tus0 = _mstGetSelectedTus();
            const avoidEl = document.getElementById('mstAvoidRoad');
            const avoid = !!(avoidEl && avoidEl.checked);
            const penalty = Math.max(0, parseFloat((document.getElementById('mstCrossPenalty') || {}).value) || 0);
            let crossFn = null;
            if (avoid && penalty > 0 && tus0.length) {
                const btn = document.getElementById('mstBtnPreview');
                const orig = btn ? btn.textContent : '';
                _mstDoPreview._busy = true;
                if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải đường OSM…'; }
                try { crossFn = await _mstLoadCrossCounter(tus0); }
                catch (e) { displayError && displayError('Không tải được đường OSM (' + e.message + ') — tính tuyến theo khoảng cách như cũ.'); }
                finally { _mstDoPreview._busy = false; if (btn) { btn.disabled = false; btn.textContent = orig; } }
            }
            _mstDoPreviewRun(crossFn ? { cross: crossFn, penalty } : null);
        }

        function _mstDoPreviewRun(mstOpts) {
            const tus = _mstGetSelectedTus();
            const algo = document.getElementById('mstAlgo').value;
            const maxSeg = parseFloat(document.getElementById('mstMaxSegment').value) || 200;
            if (tus.length === 0) {
                displayError && displayError('Chưa chọn tủ nào');
                return;
            }

            // P3: Chạy MST độc lập cho từng tủ (không mix nodes → không có edge tủ-tủ)
            const perTu = [];
            const allEdges = [];
            const allNodes = [];
            let totalSame = 0, totalChanged = 0, totalAdded = 0, totalRemoved = 0, totalWarnings = 0;

            for (const tu of tus) {
                const nodes = _mstGetNodesForTu(tu);
                if (nodes.length < 2) {
                    perTu.push({ tu, skipped: true, nodes: nodes.length });
                    continue;
                }
                const edges = algo === 'nearest' ? _mstNearestChain(nodes, mstOpts) : _mstPrim(nodes, mstOpts);
                edges.forEach(e => { e._tu = tu; });
                nodes.forEach(n => { n._tu = tu; });
                const diff = _mstDiff(edges, tu);
                const warnings = edges.filter(e => e.dist > maxSeg).length;
                totalSame += diff.same.length;
                totalChanged += diff.changed.length;
                totalAdded += diff.added.length;
                totalRemoved += diff.removed.length;
                totalWarnings += warnings;
                perTu.push({ tu, skipped: false, nodes, edges, diff, warnings });
                allEdges.push(...edges);
                allNodes.push(...nodes);
            }

            if (allEdges.length === 0) {
                displayError && displayError('Không tủ nào có đủ ≥2 node để tính MST');
                return;
            }

            // Số đoạn băng đường: MST mới vs cáp đang có trong sheet (cùng các tủ)
            let crossNew = 0, crossOld = 0;
            if (mstOpts) {
                crossNew = allEdges.reduce((n, e) => n + (e.cross > 0 ? 1 : 0), 0);
                for (const pt of perTu) {
                    if (pt.skipped) continue;
                    const pos = new Map(pt.nodes.map(n => [n.name, n]));
                    for (const n of pt.nodes) {
                        const p = n.parent && pos.get(n.parent);
                        if (p && mstOpts.cross(n, p) > 0) crossOld++;
                    }
                }
            }
            const okTus = perTu.filter(p => !p.skipped).length;
            const skipTus = perTu.filter(p => p.skipped).length;
            _mstResult = { tuList: tus, algo, edges: allEdges, nodes: allNodes, perTu, maxSeg };

            // P5: Node lookup theo (_tu|name) — tránh conflict tên giữa 2 tủ
            const nodeByKey = new Map(allNodes.map(n => [`${n._tu}|${n.name}`, n]));

            // Vẽ preview map — 4 color coding từng edge dựa trên diff của tủ tương ứng
            _mstRemovePreview();
            _mstPreviewLayer = L.layerGroup().addTo(map);

            // P5: Trước tiên vẽ CÁP SHEET CŨ mờ để user thấy state trước MST
            for (const pt of perTu) {
                if (pt.skipped) continue;
                const rowsInTu = pt.nodes.map(n => n.row);
                const nodePos = new Map(pt.nodes.map(n => [n.name, {lat: n.lat, lon: n.lon}]));
                for (const r of rowsInTu) {
                    const child = String(r[1]||'').trim();
                    const parent = String(r[14]||'').trim();
                    if (!child || !parent) continue;
                    const c = nodePos.get(child), p = nodePos.get(parent);
                    if (!c || !p) continue;
                    L.polyline([[c.lat, c.lon], [p.lat, p.lon]], {
                        color: '#6b7280', weight: 1.5, opacity: 0.25   // Xám rất mờ = cáp cũ sheet
                    }).addTo(_mstPreviewLayer);
                }
            }

            // Sau đó vẽ MST edges với 4 color diff coding overlaid
            for (const pt of perTu) {
                if (pt.skipped) continue;
                const diffKeys = {
                    same: new Set(pt.diff.same.map(e => `${e.from}|${e.to}`)),
                    changed: new Set(pt.diff.changed.map(e => `${e.from}|${e.to}`)),
                    added: new Set(pt.diff.added.map(e => `${e.from}|${e.to}`))
                };
                for (const e of pt.edges) {
                    const f = nodeByKey.get(`${e._tu}|${e.from}`);
                    const t = nodeByKey.get(`${e._tu}|${e.to}`);
                    if (!f || !t) continue;
                    const key = `${e.from}|${e.to}`;
                    let color, label = '', weight = 3, dashArray = '8 5', opacity = 0.85;
                    if (diffKeys.same.has(key)) {
                        color = '#94a3b8'; label = '='; weight = 2; opacity = 0.6;   // Xám: giữ nguyên
                    } else if (diffKeys.changed.has(key)) {
                        color = '#f59e0b'; label = '~'; weight = 4;                    // Cam: sẽ đổi (đậm)
                    } else if (diffKeys.added.has(key)) {
                        color = '#10b981'; label = '+'; weight = 4;                    // Xanh lá: sẽ thêm (đậm)
                    } else {
                        color = e.dist > maxSeg ? '#dc2626' : '#059669';
                    }
                    if (e.dist > maxSeg) { color = '#dc2626'; weight = 5; }
                    if (e.cross > 0) { color = '#be123c'; weight = 5; dashArray = '2 5'; label = '🛣' + label; }   // v176 — băng qua đường
                    L.polyline([[f.lat, f.lon], [t.lat, t.lon]], {
                        color, weight, dashArray, opacity
                    }).addTo(_mstPreviewLayer);
                    const mx = (f.lat + t.lat) / 2, my = (f.lon + t.lon) / 2;
                    L.marker([mx, my], {
                        icon: L.divIcon({
                            className: '', iconAnchor: [15, 8],
                            html: `<div style="background:#fff;padding:1px 5px;border:1px solid ${color};border-radius:3px;font-size:10px;font-weight:700;color:${color};white-space:nowrap;">${label}${Math.round(e.dist)}m</div>`
                        }),
                        interactive: false
                    }).addTo(_mstPreviewLayer);
                }
                // Cáp sheet sẽ bị mất (removed) — đỏ đứt
                for (const e of pt.diff.removed) {
                    const f = nodeByKey.get(`${e._tu || pt.tu}|${e.from}`);
                    const t = nodeByKey.get(`${e._tu || pt.tu}|${e.to}`);
                    if (!f || !t) continue;
                    L.polyline([[f.lat, f.lon], [t.lat, t.lon]], {
                        color: '#dc2626', weight: 2, dashArray: '3 6', opacity: 0.7
                    }).addTo(_mstPreviewLayer);
                }
            }

            try { map.fitBounds(_mstPreviewLayer.getBounds().pad(0.15)); } catch(e){_swallow(e);}

            const totalLen = allEdges.reduce((s, e) => s + e.dist, 0);
            const warnMsg = totalWarnings
                ? ` <span style="color:#dc2626;font-weight:700;">⚠ ${totalWarnings} đoạn > ${maxSeg}m</span>`
                : '';
            document.getElementById('mstPreview').innerHTML = `
                ✅ MST xong: <b>${okTus}</b> tủ · <b>${allEdges.length}</b> đoạn cáp · Tổng <b>${Math.round(totalLen)}m</b>${warnMsg}
                ${mstOpts ? `<br>🛣 <b style="color:${crossNew ? '#be123c' : '#15803d'};">${crossNew} đoạn băng qua đường</b> <span style="color:#64748b;">(cáp hiện tại: ${crossOld})</span>` : ''}
                ${skipTus ? `<br><span style="color:#dc2626;font-size:11px;">⚠ ${skipTus} tủ bị skip (không đủ node)</span>` : ''}
                <br><span style="color:#64748b;font-size:11px;">P5: cáp sheet cũ mờ xám → MST overlay 4 màu. Chọn chế độ Áp dụng.</span>
            `;

            // Diff summary aggregated
            const diffDiv = document.getElementById('mstDiffSummary');
            const diffContent = document.getElementById('mstDiffContent');
            if (diffDiv && diffContent) {
                diffDiv.style.display = 'block';
                const changesTotal = totalChanged + totalAdded;
                diffContent.innerHTML = `
                    <span style="color:#94a3b8;">▪</span> <b>${totalSame}</b> edges giữ nguyên (trùng MST)<br>
                    <span style="color:#f59e0b;">▪</span> <b>${totalChanged}</b> edges SẼ ĐỔI parent (khác MST)<br>
                    <span style="color:#10b981;">▪</span> <b>${totalAdded}</b> edges SẼ THÊM (trụ chưa có parent)<br>
                    ${totalRemoved > 0 ? `<span style="color:#dc2626;">▪</span> <b>${totalRemoved}</b> edges sheet sẽ BỊ XÓA (không có trong MST)<br>` : ''}
                    <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #fde68a;">
                        <b style="color:#f59e0b;">🎯 Diff:</b> chỉ ${changesTotal} edge cần sync ·
                        <b style="color:#059669;">✓ Toàn bộ:</b> ${allEdges.length} edge sync (ghi đè cả trùng)
                    </div>
                `;
            }

            document.getElementById('mstBtnApply').disabled = false;
            const diffBtn = document.getElementById('mstBtnApplyDiff');
            if (diffBtn) diffBtn.disabled = (totalChanged + totalAdded) === 0;
        }
        window._mstDoPreview = _mstDoPreview;
        window._mstDoPreviewRun = _mstDoPreviewRun;

        async function _mstApplyToData(diffOnly) {
            if (!_mstResult) return;
            const btnDiff = document.getElementById('mstBtnApplyDiff');
            const btnAll = document.getElementById('mstBtnApply');
            const activeBtn = diffOnly ? btnDiff : btnAll;
            const originalText = activeBtn ? activeBtn.textContent : '';
            [btnDiff, btnAll].forEach(b => b && (b.disabled = true));
            if (activeBtn) activeBtn.textContent = '⏳ Đang sync...';

            // v168 — trùng tên: lấy dòng CÓ toạ độ (trước đây lấy dòng cuối = dòng import trống toạ độ)
            const rowByName = _rowMapByNamePreferCoord((loadedData || []).slice(1));

            // P3: Collect target edges từ all tủ (multi-select)
            // P1: Nếu diffOnly → chỉ include edges thuộc diff.changed + diff.added của TỪNG tủ
            let targetEdges = [];
            if (_mstResult.perTu && _mstResult.perTu.length) {
                for (const pt of _mstResult.perTu) {
                    if (pt.skipped) continue;
                    if (diffOnly) {
                        const diffKeys = new Set([
                            ...pt.diff.changed.map(e => `${e.from}|${e.to}`),
                            ...pt.diff.added.map(e => `${e.from}|${e.to}`)
                        ]);
                        targetEdges.push(...pt.edges.filter(e => diffKeys.has(`${e.from}|${e.to}`)));
                    } else {
                        targetEdges.push(...pt.edges);
                    }
                }
            } else {
                targetEdges = _mstResult.edges;
            }

            let updated = 0, synced = 0, failed = 0;
            const toSync = [];
            // P6: Snapshot cho rollback — lưu {rowRef, oldParent, oldDist, oldCapNhat} trước khi ghi đè
            const undoSnapshot = [];

            for (const e of targetEdges) {
                const targetRow = rowByName.get(e.to);
                if (!targetRow) continue;
                const oldParent = String(targetRow[14] || '').trim();
                const oldDist = parseFloat(targetRow[15]) || 0;
                const newDist = Math.round(e.dist);
                if (oldParent === e.from && Math.abs(oldDist - newDist) < 1) continue;
                // Snapshot old values (chỉ tên trụ + parent + dist, không lưu ref → survive reload)
                undoSnapshot.push({
                    tenTru: String(targetRow[1] || '').trim(),
                    oldParent: String(targetRow[14] || ''),
                    oldDist: String(targetRow[15] || ''),
                    oldCapNhat: String(targetRow[13] || '')
                });
                targetRow[14] = e.from;
                targetRow[15] = newDist;
                targetRow[13] = new Date().toISOString();
                updated++;
                toSync.push(targetRow);
            }

            // Sync GAS — dùng BATCH nếu ≥20 rows (nhanh ~100×), single nếu ít
            const totalSync = toSync.length;
            if (totalSync >= 20 && typeof _batchSyncRowsToGAS === 'function') {
                // BATCH mode: chỉ sync 3 fields cần thiết (markerGoc/khoangCach/capNhat)
                const result = await _batchSyncRowsToGAS(
                    toSync,
                    ['markerGoc', 'khoangCach', 'capNhat'],
                    (done, total, chunk, chunkTotal) => {
                        if (activeBtn) {
                            activeBtn.textContent = `⚡ Batch ${chunk}/${chunkTotal} (${done}/${total} rows)...`;
                        }
                    }
                );
                synced = result.updated;
                failed = result.failed + result.notFound;
            } else {
                // SINGLE mode cho batch nhỏ
                for (let i = 0; i < totalSync; i++) {
                    const row = toSync[i];
                    if (activeBtn) {
                        const failStr = failed > 0 ? ` (⚠${failed})` : '';
                        activeBtn.textContent = `⏳ Sync ${i + 1}/${totalSync}${failStr}...`;
                    }
                    try {
                        if (typeof syncRowToGAS === 'function') {
                            const ok = await syncRowToGAS(row, { silent: true });
                            if (ok) synced++; else failed++;
                        }
                    } catch (err) {
                        console.error('[MST sync]', err);
                        failed++;
                    }
                }
            }

            // P6: Persist snapshot cho rollback (TTL 5 phút)
            if (undoSnapshot.length > 0) {
                try {
                    const undoKey = 'mst_undo_' + (typeof currentSheet !== 'undefined' ? currentSheet : 'default');
                    localStorage.setItem(undoKey, JSON.stringify({
                        snapshot: undoSnapshot,
                        appliedAt: Date.now(),
                        tuList: _mstResult.tuList || [],
                        mode: diffOnly ? 'diff' : 'all'
                    }));
                    // Show rollback button trong 5 phút
                    _showMstRollbackBtn(undoSnapshot.length, diffOnly ? 'Diff' : 'Toàn bộ');
                } catch(e){_swallow(e);}
            }

            // Log
            try {
                if (typeof _logAction === 'function') {
                    _logAction('mst_apply', '', (_mstResult.tuList || []).join(', '), JSON.stringify({
                        tus: _mstResult.tuList,
                        edges: targetEdges.length,
                        algo: _mstResult.algo,
                        mode: diffOnly ? 'diff' : 'all',
                        updated, synced, failed
                    }));
                }
            } catch(e){_swallow(e);}

            [btnDiff, btnAll].forEach(b => b && (b.disabled = false));
            if (activeBtn) activeBtn.textContent = originalText;
            _mstRemovePreview();
            _closeAutoMstModal();

            const modeLabel = diffOnly ? '🎯 Diff' : '✓ Toàn bộ';
            displayInfo && displayInfo(`✅ MST ${modeLabel}: ${updated} trụ (${(_mstResult.tuList||[]).length} tủ) · Sync GAS ${synced}/${toSync.length}${failed ? ` · Lỗi ${failed}` : ''}`);

            if (_cableVisible && typeof _rebuildCableLines === 'function') {
                _rebuildCableLines();
            }
        }
        window._mstApplyToData = _mstApplyToData;

        // P6: Rollback MST Apply — restore snapshot trong 5 phút
        const MST_UNDO_TTL_MS = 5 * 60 * 1000;

        function _showMstRollbackBtn(count, modeLabel) {
            // Remove existing
            const old = document.getElementById('mstRollbackBar');
            if (old) old.remove();
            const bar = document.createElement('div');
            bar.id = 'mstRollbackBar';
            bar.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:10000;background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:10px 14px;box-shadow:0 4px 15px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px;font-size:13px;';
            bar.innerHTML = `
                <span>✅ MST ${modeLabel}: đã sửa <b>${count}</b> trụ.</span>
                <button onclick="_mstRollback()" style="padding:6px 14px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;">↺ Hoàn tác</button>
                <button onclick="document.getElementById('mstRollbackBar').remove()" style="padding:6px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;">Đóng</button>
                <span id="mstUndoTimer" style="font-size:11px;color:#78350f;font-family:monospace;">5:00</span>
            `;
            document.body.appendChild(bar);
            // Countdown 5 phút
            let secs = 300;
            const tick = setInterval(() => {
                secs--;
                const el = document.getElementById('mstUndoTimer');
                if (!el || secs <= 0) {
                    clearInterval(tick);
                    const b = document.getElementById('mstRollbackBar');
                    if (b) b.remove();
                    return;
                }
                el.textContent = `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
            }, 1000);
        }
        window._showMstRollbackBtn = _showMstRollbackBtn;

        async function _mstRollback() {
            const undoKey = 'mst_undo_' + (typeof currentSheet !== 'undefined' ? currentSheet : 'default');
            let undo;
            try { undo = JSON.parse(localStorage.getItem(undoKey) || 'null'); } catch(e){_swallow(e);}
            if (!undo || !undo.snapshot || !undo.snapshot.length) {
                displayError && displayError('Không có snapshot rollback');
                return;
            }
            if (Date.now() - undo.appliedAt > MST_UNDO_TTL_MS) {
                displayError && displayError('Snapshot đã hết hạn (>5 phút)');
                localStorage.removeItem(undoKey);
                return;
            }
            if (!confirm(`Rollback ${undo.snapshot.length} trụ về trạng thái trước MST?`)) return;

            const bar = document.getElementById('mstRollbackBar');
            if (bar) bar.innerHTML = '<span id="rollbackProgress">⏳ Rollback 0/' + undo.snapshot.length + '...</span>';

            // v168 — trùng tên: lấy dòng CÓ toạ độ (trước đây lấy dòng cuối = dòng import trống toạ độ)
            const rowByName = _rowMapByNamePreferCoord((loadedData || []).slice(1));

            let restored = 0, synced = 0, failed = 0;
            const total = undo.snapshot.length;
            // Trước tiên restore in-memory
            const toSync = [];
            for (const snap of undo.snapshot) {
                const row = rowByName.get(snap.tenTru);
                if (!row) continue;
                row[14] = snap.oldParent;
                row[15] = snap.oldDist;
                row[13] = snap.oldCapNhat || new Date().toISOString();
                restored++;
                toSync.push(row);
            }
            // Sync GAS — batch nếu ≥20, single nếu ít
            if (toSync.length >= 20 && typeof _batchSyncRowsToGAS === 'function') {
                const result = await _batchSyncRowsToGAS(
                    toSync,
                    ['markerGoc', 'khoangCach', 'capNhat'],
                    (done, tot, chunk, chunkTot) => {
                        const p = document.getElementById('rollbackProgress');
                        if (p) p.textContent = `⚡ Batch ${chunk}/${chunkTot} (${done}/${tot} rows)...`;
                    }
                );
                synced = result.updated;
                failed = result.failed + result.notFound;
            } else {
                for (let i = 0; i < toSync.length; i++) {
                    const row = toSync[i];
                    const p = document.getElementById('rollbackProgress');
                    if (p) {
                        const failStr = failed > 0 ? ` (⚠${failed})` : '';
                        p.textContent = `⏳ Rollback ${i + 1}/${toSync.length}${failStr}...`;
                    }
                    try {
                        if (typeof syncRowToGAS === 'function') {
                            const ok = await syncRowToGAS(row, { silent: true });
                            if (ok) synced++; else failed++;
                        }
                    } catch (_) { failed++; }
                }
            }
            // Log
            try {
                if (typeof _logAction === 'function') {
                    _logAction('mst_rollback', '', (undo.tuList || []).join(', '), JSON.stringify({
                        restored, synced, failed, mode: undo.mode
                    }));
                }
            } catch(e){_swallow(e);}
            // Clear snapshot
            localStorage.removeItem(undoKey);
            if (bar) bar.remove();
            displayInfo && displayInfo(`↺ Rollback: khôi phục ${restored} trụ · Sync GAS ${synced}/${restored}${failed ? ` · Lỗi ${failed}` : ''}`);
            if (_cableVisible && typeof _rebuildCableLines === 'function') _rebuildCableLines();
        }
        window._mstRollback = _mstRollback;

        // ═══════════════════════════════════════════════════════════════════
        // (End T22 Auto-cable MST)
        // ═══════════════════════════════════════════════════════════════════
