// Nền OSM — Overpass (máy chủ dự phòng + cache IndexedDB), đường theo lớp tim/mép/tên, bo góc giao lộ, vẽ OSM trong DXF
// Tách từ index.html (đợt 2 module hoá, v174) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ: khối <script> chính được ngắt thành "</script><script src=…><script>"
// nên thứ tự chạy lúc nạp giữ nguyên. Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau
// (hàm ở file sau không còn được hoist cho file trước). Thêm code CHẠY LÚC NẠP ở đây phải rà lại điều này.

        // ─────────────────────────────────────────────────────────────
        // P65: Overpass API — fetch OSM basemap (roads/buildings/water/admin)
        // Cache trong IndexedDB (TTL 30 ngày)
        // ─────────────────────────────────────────────────────────────
        const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
        // v169 — máy chủ dự phòng: overpass-api.de hay 504/429 khi quá tải → tự chuyển máy khác.
        // Chỉ giữ máy chủ trả CORS (Access-Control-Allow-Origin) để trình duyệt đọc được.
        const OVERPASS_URLS = [
            OVERPASS_URL,
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter'
        ];
        // Timeout MỖI request theo diện tích vùng tải (xem _overpassTimeoutFor): vùng vài trụ trả trong 1–3s
        // nên quá 8s gần như chắc là máy treo; bản vẽ lớn có nhà cửa thì cần tới 30s.
        const OVERPASS_TIMEOUT_MIN_MS = 8000;
        const OVERPASS_TIMEOUT_MS = 30000;      // trần
        const OVERPASS_HEDGE_MS = 2000;         // máy đang gọi chưa trả sau chừng này → gọi thêm máy kế
        let _overpassGoodIdx = 0;               // máy thắng gần nhất — chỉ để log, KHÔNG quyết định thứ tự gọi

        function _overpassTimeoutFor(bounds, opts) {
            if (!bounds) return OVERPASS_TIMEOUT_MS;
            const midLat = (bounds.minLat + bounds.maxLat) / 2;
            const km2 = Math.abs(bounds.maxLat - bounds.minLat) * 111.32
                      * Math.abs(bounds.maxLon - bounds.minLon) * 111.32 * Math.cos(midLat * Math.PI / 180);
            const perKm2 = (opts && opts.buildings) ? 3000 : 1500;   // nhà cửa nặng gấp đôi đường
            return Math.round(Math.min(OVERPASS_TIMEOUT_MS, Math.max(OVERPASS_TIMEOUT_MIN_MS, OVERPASS_TIMEOUT_MIN_MS + perKm2 * km2)));
        }

        // Hedged request: gọi máy 1 trước; máy lỗi → gọi NGAY máy kế; máy chưa trả sau OVERPASS_HEDGE_MS → gọi THÊM
        // máy kế (chạy song song). Máy trả JSON hợp lệ đầu tiên thắng, các request còn lại bị huỷ.
        //
        // ⚠ Không quay lại kiểu tuần tự chờ timeout: bản cũ thử lần lượt 4 máy × 45s → tối đa 180s chặn xuất CAD
        // (đo thật: maps.mail.ru TREO 51s), lại "nhớ máy thắng lần trước để gọi đầu tiên" nên máy treo từng thắng
        // làm MỌI lần xuất sau ăn trọn timeout.
        // ⚠ Cũng không bắn cả 4 máy cùng lúc: máy chủ Overpass công cộng tính quota theo thời gian chạy query và
        // ngắt kết nối phía trình duyệt KHÔNG dừng query phía máy chủ → bắn 4 = ăn quota 4 máy mỗi lần, dễ 429.
        //
        // opts.signal   — AbortSignal: nút xuất đang bận bấm lần nữa → dừng toàn bộ (bỏ qua nền OSM).
        // opts.timeoutMs — timeout mỗi request (mặc định OVERPASS_TIMEOUT_MS). Hẹn giờ ĐỘC LẬP với AbortController,
        //                  nên trình duyệt cũ không có AbortController cũng không treo vĩnh viễn.
        // opts.hedgeMs  — mặc định OVERPASS_HEDGE_MS (test truyền nhỏ để chạy nhanh).
        function _overpassFetch(q, onTry, opts) {
            const ext = opts && opts.signal;
            const timeoutMs = (opts && opts.timeoutMs) || OVERPASS_TIMEOUT_MS;
            const hedgeMs = (opts && opts.hedgeMs != null) ? opts.hedgeMs : OVERPASS_HEDGE_MS;
            const n = OVERPASS_URLS.length;
            const hasAC = typeof AbortController !== 'undefined';
            const ctls = [], timers = [], errs = [];
            let settled = false, launched = 0, finished = 0, hedgeTimer = null;

            return new Promise((resolve, reject) => {
                const cleanup = () => {
                    timers.forEach(t => clearTimeout(t));
                    if (hedgeTimer) clearTimeout(hedgeTimer);
                    ctls.forEach(c => { try { c.abort(); } catch (_) { /* đã xong */ } });
                    if (ext) ext.removeEventListener('abort', onExtAbort);
                };
                const finish = (fn, val) => { if (settled) return; settled = true; cleanup(); fn(val); };
                function onExtAbort() {
                    const e = new Error('Đã huỷ tải nền OSM');
                    e.name = 'AbortError';
                    finish(reject, e);
                }
                const maybeAllFailed = () => {
                    if (!settled && launched === n && finished === n) finish(reject, new Error('Overpass: ' + errs.join(' · ')));
                };
                const armHedge = () => {
                    if (hedgeTimer) clearTimeout(hedgeTimer);
                    if (launched < n) hedgeTimer = setTimeout(launch, hedgeMs);
                };

                function launch() {
                    if (settled || launched >= n) return;
                    const idx = launched++;
                    const url = OVERPASS_URLS[idx];
                    const host = url.replace(/^https?:\/\//, '').split('/')[0];
                    if (onTry) { try { onTry(host, idx); } catch (_) { /* UI lỗi không được làm hỏng tải */ } }
                    const ctl = hasAC ? new AbortController() : null;
                    if (ctl) ctls.push(ctl);
                    let done = false;
                    const fail = (why) => {
                        if (done) return;
                        done = true; finished++;
                        if (settled) return;
                        errs.push(host + ' ' + why);
                        launch();            // máy này hỏng → gọi ngay máy kế, không đợi hedge
                        maybeAllFailed();
                    };
                    timers.push(setTimeout(() => {
                        if (ctl) { try { ctl.abort(); } catch (_) { /* bỏ qua */ } }
                        fail('quá thời gian');
                    }, timeoutMs));
                    armHedge();

                    Promise.resolve()
                        .then(() => fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: 'data=' + encodeURIComponent(q),
                            signal: ctl ? ctl.signal : undefined
                        }))
                        .then(res => {
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            return res.json();
                        })
                        .then(json => {
                            if (!json || !Array.isArray(json.elements)) throw new Error('dữ liệu hỏng');
                            if (done) return;
                            done = true; finished++;
                            _overpassGoodIdx = idx;
                            finish(resolve, json);
                        })
                        .catch(e => {
                            fail((e && e.name === 'AbortError') ? 'đã huỷ'
                                : (e && /^HTTP |dữ liệu hỏng/.test(e.message) ? e.message : 'lỗi mạng'));
                        });
                }

                if (ext) {
                    if (ext.aborted) { onExtAbort(); return; }
                    ext.addEventListener('abort', onExtAbort);
                }
                launch();
            });
        }
        const OSM_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 ngày
        let _osmFetchLastMs = 0;

        function _osmBoundsKey(bounds) {
            const round = (v, p) => Math.round(v * p) / p;
            // v2: đổi prefix để invalidate cache cũ (query admin_level 9|10 trả rỗng ở VN)
            return `osm2_${round(bounds.minLat, 1000)}_${round(bounds.minLon, 1000)}_${round(bounds.maxLat, 1000)}_${round(bounds.maxLon, 1000)}`;
        }

        function _cgUpdateOsmInfo() {
            const cb = document.getElementById('cgIncludeOsm');
            const opts = document.getElementById('cgOsmOptions');
            if (opts) opts.style.display = (cb && cb.checked) ? 'block' : 'none';
        }
        window._cgUpdateOsmInfo = _cgUpdateOsmInfo;

        function _cgCollectOsmOpts() {
            const cb = document.getElementById('cgIncludeOsm');
            if (!cb || !cb.checked) return null;
            const chk = id => !!(document.getElementById(id) || {}).checked;
            const roadCenter = chk('cgOsmRoadCenter'), roadEdge = chk('cgOsmRoadEdge'), roadName = chk('cgOsmRoadName');
            const roadOther = chk('cgOsmRoadOther');
            return {
                roads:     roadCenter || roadEdge || roadName || roadOther,   // cần fetch đường không
                roadCenter, roadEdge, roadName, roadOther,
                roadWidths: _cgReadRoadWidths(),
                cornerRadii: _cgReadCornerRadii(),
                buildings: (document.getElementById('cgOsmBuildings') || {}).checked || false,
                water:     (document.getElementById('cgOsmWater')     || {}).checked || false,
                admin:     (document.getElementById('cgOsmAdmin')     || {}).checked || false
            };
        }
        window._cgCollectOsmOpts = _cgCollectOsmOpts;

        // v154 — bảng bề rộng mặt đường mặc định (m), lưu localStorage
        const _CG_ROAD_W_IDS = { major: 'cgOsmWMajor', secondary: 'cgOsmWSecondary', residential: 'cgOsmWResidential', service: 'cgOsmWService' };
        function _cgReadRoadWidths() {
            const w = {};
            for (const [k, id] of Object.entries(_CG_ROAD_W_IDS)) {
                const v = parseFloat((document.getElementById(id) || {}).value);
                w[k] = (isFinite(v) && v > 0 && v < 100) ? v : OSM_ROAD_WIDTH_DEFAULTS[k];
            }
            return w;
        }
        // v161 — bán kính bo góc giao lộ theo cấp đường (0 = không bo)
        const _CG_CORNER_R_IDS = { major: 'cgOsmRMajor', secondary: 'cgOsmRSecondary', residential: 'cgOsmRResidential', service: 'cgOsmRService' };
        function _cgReadCornerRadii() {
            const r = {};
            for (const [k, id] of Object.entries(_CG_CORNER_R_IDS)) {
                const v = parseFloat((document.getElementById(id) || {}).value);
                r[k] = (isFinite(v) && v >= 0 && v <= 50) ? v : OSM_CORNER_RADIUS_DEFAULTS[k];
            }
            return r;
        }
        const _CG_ROAD_LAYER_IDS = { center: 'cgOsmRoadCenter', edge: 'cgOsmRoadEdge', name: 'cgOsmRoadName', other: 'cgOsmRoadOther' };
        function _cgSaveRoadWidths() {
            const layers = {};
            for (const [k, id] of Object.entries(_CG_ROAD_LAYER_IDS)) layers[k] = !!(document.getElementById(id) || {}).checked;
            try { localStorage.setItem('cg_osm_road_widths', JSON.stringify(Object.assign(_cgReadRoadWidths(), { layers, radii: _cgReadCornerRadii() }))); } catch(e){_swallow(e);}
        }
        function _cgRestoreRoadWidths() {
            let saved = null;
            try { saved = JSON.parse(localStorage.getItem('cg_osm_road_widths') || 'null'); } catch(e){_swallow(e);}
            if (!saved) return;
            for (const [k, id] of Object.entries(_CG_ROAD_W_IDS)) {
                const el = document.getElementById(id);
                if (el && isFinite(saved[k])) el.value = saved[k];
            }
            for (const [k, id] of Object.entries(_CG_ROAD_LAYER_IDS)) {
                const el = document.getElementById(id);
                if (el && saved.layers && typeof saved.layers[k] === 'boolean') el.checked = saved.layers[k];
            }
            for (const [k, id] of Object.entries(_CG_CORNER_R_IDS)) {
                const el = document.getElementById(id);
                if (el && saved.radii && Number.isFinite(saved.radii[k])) el.value = saved.radii[k];
            }
        }
        window._cgSaveRoadWidths = _cgSaveRoadWidths;

        // ── Cache bộ nhớ + dùng chung request (v183, phục vụ tải sẵn khi mở modal Xuất CAD) ──
        // IndexedDB khoá theo ĐÚNG khung → bật "loại điểm ngoại lai" hoặc xuất nhiều tờ (khung lúc xuất nhỏ hơn
        // khung tải sẵn) là trượt. Cache bộ nhớ tra theo BAO CHỨA nên khung con luôn trúng.
        const _OSM_MEM_MAX = 3;      // vài vùng gần nhất — dữ liệu 1 quận có thể vài MB, không giữ nhiều
        const _osmMem = [];          // [{ bounds, opts, data, fetchedAt }] — mới nhất ở đầu
        const _osmInflight = [];     // [{ bounds, opts, promise }] — request đang chạy, cho bên khác chờ chung
        const _OSM_LAYERS = ['roads', 'buildings', 'water', 'admin'];
        function _osmBoxContains(o, i) {
            return !!o && !!i && o.minLat <= i.minLat && o.maxLat >= i.maxLat && o.minLon <= i.minLon && o.maxLon >= i.maxLon;
        }
        function _osmLayersCover(had, want) { return _OSM_LAYERS.every(k => !want[k] || (had && had[k])); }
        // Lát cắt trả cho bên gọi: CHỈ các lớp được xin, CHỈ các way chạm khung xin, luôn là MẢNG MỚI.
        // Vì cache có thể giàu hơn yêu cầu (tải sẵn có nhà → người dùng bỏ tick nhà; tải sẵn cả quận → MST xin
        // khung ±65m): không cắt thì hàm vẽ vẽ luôn lớp đã tắt, và MST/căn tuyến duyệt cả quận → UI đơ.
        // Mảng mới cũng cách ly dữ liệu dùng chung khỏi nơi gọi lỡ sửa tại chỗ.
        function _osmWayTouches(coords, b) {
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (const c of coords || []) {
                if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
                if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
            }
            return x1 >= b.minLon && x0 <= b.maxLon && y1 >= b.minLat && y0 <= b.maxLat;   // coords = [lon, lat]
        }
        function _osmView(data, bounds, opts) {
            const out = {};
            for (const k of _OSM_LAYERS) {
                const arr = (opts[k] && data && Array.isArray(data[k])) ? data[k] : [];
                out[k] = bounds ? arr.filter(w => _osmWayTouches(w.coords, bounds)) : arr.slice();
            }
            return out;
        }
        function _osmSleep(ms, signal) {
            return new Promise((resolve, reject) => {
                const t = setTimeout(() => { if (signal) signal.removeEventListener('abort', onAbort); resolve(); }, ms);
                function onAbort() { clearTimeout(t); const e = new Error('Đã huỷ tải nền OSM'); e.name = 'AbortError'; reject(e); }
                if (signal) { if (signal.aborted) return onAbort(); signal.addEventListener('abort', onAbort); }
            });
        }
        // Chờ promise nhưng thôi chờ khi signal huỷ — KHÔNG huỷ bản thân promise (request dùng chung chạy tiếp)
        function _osmAwait(promise, signal) {
            if (!signal) return promise;
            const abortErr = () => { const e = new Error('Đã huỷ tải nền OSM'); e.name = 'AbortError'; return e; };
            if (signal.aborted) return Promise.reject(abortErr());
            return new Promise((resolve, reject) => {
                const onAbort = () => reject(abortErr());
                signal.addEventListener('abort', onAbort);
                promise.then(v => { signal.removeEventListener('abort', onAbort); resolve(v); },
                             e => { signal.removeEventListener('abort', onAbort); reject(e); });
            });
        }

        // Xoá cache bộ nhớ — gọi khi đóng modal Xuất CAD. Dữ liệu có nhà của cả quận có thể vài chục MB;
        // IndexedDB vẫn giữ nên mở lại modal với cùng bộ lọc vẫn nhanh.
        function _osmClearMem() { _osmMem.length = 0; }
        window._osmClearMem = _osmClearMem;

        // signal (tuỳ chọn): AbortSignal — bên gọi THÔI CHỜ khi huỷ; request dùng chung vẫn chạy tiếp để lấp cache.
        //   Cố ý KHÔNG đặt trong `options` vì `options` được lưu IndexedDB — AbortSignal không clone được.
        // extra.quiet: không hiện toast (tải sẵn chạy ngầm).
        async function _fetchOsmBasemap(bounds, options, signal, extra) {
            const opts = Object.assign({ roads: true, buildings: true, water: false, admin: false }, options || {});
            const quiet = !!(extra && extra.quiet);
            const cacheKey = _osmBoundsKey(bounds);

            // 1. Cache bộ nhớ — bao chứa + đủ lớp + còn hạn
            const nowMs0 = Date.now();
            for (const m of _osmMem) {
                if (_osmBoxContains(m.bounds, bounds) && _osmLayersCover(m.opts, opts) && nowMs0 - m.fetchedAt < OSM_CACHE_TTL_MS) return _osmView(m.data, bounds, opts);
            }

            // 2. IndexedDB — khớp đúng khung
            let staleCovered = null;   // cache hết hạn nhưng đủ lớp — dùng khi mọi máy chủ Overpass đều lỗi
            try {
                const cached = await _idbGet(cacheKey);
                // Cache cũ (trước v152) không lưu opts → không biết đã có lớp nào → fetch lại 1 lần.
                const had = (cached && cached.opts) || {};
                const covers = _osmLayersCover(had, opts);
                if (cached && covers && cached.fetchedAt && (Date.now() - cached.fetchedAt) < OSM_CACHE_TTL_MS) {
                    return _osmView(cached.data, bounds, opts);
                }
                if (cached && covers && cached.data) staleCovered = cached.data;
            } catch(e) { /* silent */ }

            // 3. Đang có request bao chứa chạy dở (vd tải sẵn) → chờ chung, không gọi lại, không dính rate-limit
            for (const f of _osmInflight) {
                if (_osmBoxContains(f.bounds, bounds) && _osmLayersCover(f.opts, opts)) {
                    return _osmAwait(f.promise, signal).then(d => _osmView(d, bounds, opts), e => {
                        if (staleCovered && !(e && e.name === 'AbortError')) {
                            if (!quiet && typeof displayInfo === 'function') displayInfo('⚠ Không tải được OSM mới — dùng bản đường đã lưu trước đó.');
                            return _osmView(staleCovered, bounds, opts);
                        }
                        throw e;
                    });
                }
            }

            // Rate limit — 5s giữa các request.
            // Bên chủ động (bấm xuất) CHỜ hết phần còn lại rồi thử lại từ đầu (lúc đó có thể đã có cache / request
            // chung bao chứa). Trước đây ném lỗi → tải sẵn vừa chạy là lần xuất mất nền. Tải sẵn (quiet) thì nhường.
            const waitMs = 5000 - (Date.now() - _osmFetchLastMs);
            if (waitMs > 0) {
                if (quiet) throw new Error('Đợi 5s giữa các request Overpass API để tránh rate limit.');
                await _osmSleep(waitMs + 20, signal);
                return _fetchOsmBasemap(bounds, options, signal, extra);
            }
            _osmFetchLastMs = Date.now();

            const entry = { bounds, opts, promise: null };
            entry.promise = (async () => {
                // Build query
                const bbox = `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}`;
                const queries = [];
                if (opts.roads) queries.push(`way["highway"](${bbox});`);
                if (opts.buildings) queries.push(`way["building"](${bbox});`);
                if (opts.water) queries.push(`way["waterway"](${bbox});`);
                // VN: sau sáp nhập 2025, phường/xã map ở admin_level=6 (168 phường/xã TPHCM).
                // Tên nằm ở relation, không ở way → phải query relation.
                if (opts.admin) queries.push(`relation["boundary"="administrative"]["admin_level"~"^(6|8)$"](${bbox});`);
                const q = `[out:json][timeout:30];(${queries.join('')});out geom;`;

                // Fetch — hedged qua các máy chủ; hết máy → dùng cache cũ nếu có.
                // KHÔNG truyền signal của bên gọi: request này có thể đang được nhiều bên chờ chung.
                let json;
                try {
                    json = await _overpassFetch(q, (host, k) => {
                        if (!quiet && typeof displayInfo === 'function') displayInfo(k === 0 ? '🌐 Đang tải nền OSM…' : '🌐 Máy chủ OSM chậm/lỗi — thử thêm ' + host + '…');
                    }, { timeoutMs: _overpassTimeoutFor(bounds, opts) });
                } catch (e) {
                    if (staleCovered) {
                        if (!quiet && typeof displayInfo === 'function') displayInfo('⚠ Không tải được OSM mới — dùng bản đường đã lưu trước đó.');
                        return staleCovered;   // bên gọi cắt lát ở dưới (_osmAwait(...).then(_osmView))
                    }
                    throw e;
                }

                // Parse elements → GeoJSON-like features
                const data = { roads: [], buildings: [], water: [], admin: [] };
                (json.elements || []).forEach(el => {
                    const tags = el.tags || {};
                    // Ranh hành chính = relation; geometry nằm ở members role='outer'
                    if (el.type === 'relation' && tags.boundary === 'administrative') {
                        const segTags = { boundary: 'administrative', admin_level: tags.admin_level };
                        let sumLon = 0, sumLat = 0, n = 0;
                        (el.members || []).forEach(m => {
                            if (m.type !== 'way' || m.role !== 'outer' || !m.geometry) return;
                            const coords = m.geometry.map(g => [g.lon, g.lat]);
                            coords.forEach(c => { sumLon += c[0]; sumLat += c[1]; n++; });
                            data.admin.push({ coords, tags: segTags }); // đoạn ranh — không nhãn
                        });
                        // 1 entry nhãn duy nhất tại centroid (coords 1 điểm → không vẽ line)
                        if (n > 0 && tags.name) data.admin.push({ coords: [[sumLon / n, sumLat / n]], tags });
                        return;
                    }
                    if (el.type !== 'way' || !el.geometry) return;
                    const coords = el.geometry.map(g => [g.lon, g.lat]);
                    if (tags.highway) data.roads.push({ coords, tags });
                    else if (tags.building) data.buildings.push({ coords, tags });
                    else if (tags.waterway) data.water.push({ coords, tags });
                    else if (tags.boundary === 'administrative') data.admin.push({ coords, tags });
                });

                // Cache — bộ nhớ (bao chứa) + IndexedDB (đúng khung, sống qua lần mở app sau)
                _osmMem.unshift({ bounds, opts, data, fetchedAt: Date.now() });
                if (_osmMem.length > _OSM_MEM_MAX) _osmMem.length = _OSM_MEM_MAX;
                // KHÔNG await: _idbSet không bắt tx.onabort (vd hết dung lượng) → có thể treo vĩnh viễn và kẹt
                // mọi bên đang chờ chung request này. Ghi ngầm, lỗi thì thôi (đã có cache bộ nhớ).
                try { Promise.resolve(_idbSet(cacheKey, { data, fetchedAt: Date.now(), bounds, opts })).catch(() => {}); } catch(e) { /* silent */ }

                return data;
            })();
            _osmInflight.push(entry);
            const unregister = () => { const i = _osmInflight.indexOf(entry); if (i >= 0) _osmInflight.splice(i, 1); };
            entry.promise.then(unregister, unregister);
            return _osmAwait(entry.promise, signal).then(d => _osmView(d, bounds, opts));
        }
        window._fetchOsmBasemap = _fetchOsmBasemap;

        // ─────────────────────────────────────────────────────────────
        // P66+P67: Render OSM basemap + ranh giới hành chính trong DXF
        // Layers: OSM_TIM_DUONG / OSM_MEP_DUONG / OSM_TEN_DUONG (v154) /
        //         OSM_BUILDING / OSM_WATER / ADMIN_BOUNDARY
        // ─────────────────────────────────────────────────────────────
        // ─── v154: Đường OSM theo lớp (tim / mép / tên) — docs/design-osm-road-layers.md ───
        // Marker @@OSMROAD_* để tests/osm-road-layers.test.js trích các hàm thuần này ra chạy bằng Node.
        // @@OSMROAD_START
        const OSM_ROAD_WIDTH_DEFAULTS = { major: 14, secondary: 10, residential: 6, service: 4 };
        function _osmRoadWidth(tags, defaults) {
            const d = Object.assign({}, OSM_ROAD_WIDTH_DEFAULTS, defaults || {});
            const w = parseFloat(String((tags && tags.width) || '').replace(',', '.'));
            if (isFinite(w) && w > 0 && w < 100) return w;
            const lanes = parseInt(tags && tags.lanes);
            if (lanes >= 1 && lanes <= 12) return lanes * 3.5;
            let hw = String((tags && tags.highway) || '');
            if (hw === 'construction') hw = String(tags.construction || 'residential');
            if (['motorway', 'trunk', 'primary'].includes(hw)) return d.major;
            if (['secondary', 'tertiary'].includes(hw)) return d.secondary;
            if (hw === 'service') return d.service;
            return d.residential;
        }
        // Dời song song sang TRÁI hướng đi một đoạn d (d âm = sang phải). Nối miter; góc gắt → vát (bevel).
        function _offsetPolyline(pts, d) {
            const p = [];
            for (const q of pts) {
                const last = p[p.length - 1];
                if (!last || Math.hypot(q.x - last.x, q.y - last.y) > 1e-6) p.push(q);
            }
            if (p.length < 2) return [];
            const nrm = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); return { x: -dy / l, y: dx / l }; };
            const joint = (out, c, n1, n2) => {
                const k = 1 + n1.x * n2.x + n1.y * n2.y;   // = 1 + cos(góc giữa 2 pháp tuyến)
                if (k < 0.25) {   // gần quay đầu → miter bắn rất xa, dùng 2 điểm vát
                    out.push({ x: c.x + d * n1.x, y: c.y + d * n1.y });
                    out.push({ x: c.x + d * n2.x, y: c.y + d * n2.y });
                } else {
                    out.push({ x: c.x + d * (n1.x + n2.x) / k, y: c.y + d * (n1.y + n2.y) / k });
                }
            };
            // Vòng khép kín (vòng xuyến): điểm nối đầu-cuối cũng cần miter, nếu không mép bị khấc
            const closed = p.length >= 4 && Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) < 1e-6;
            const out = [];
            const n0 = nrm(p[0], p[1]);
            if (closed) joint(out, p[0], nrm(p[p.length - 2], p[p.length - 1]), n0);
            else out.push({ x: p[0].x + d * n0.x, y: p[0].y + d * n0.y });
            for (let i = 1; i < p.length - 1; i++) joint(out, p[i], nrm(p[i - 1], p[i]), nrm(p[i], p[i + 1]));
            if (closed) out.push({ x: out[0].x, y: out[0].y });
            else {
                const nl = nrm(p[p.length - 2], p[p.length - 1]);
                out.push({ x: p[p.length - 1].x + d * nl.x, y: p[p.length - 1].y + d * nl.y });
            }
            return out;
        }
        // Gom các đoạn đã cắt khung (null = bị loại) thành chuỗi điểm liền nhau → ghi 1 POLYLINE/chuỗi
        // để nét CENTER chạy liên tục thay vì bắt đầu lại ở mỗi nút OSM.
        function _chainRuns(segs) {
            const runs = [];
            let cur = null;
            for (const s of segs) {
                if (!s) { cur = null; continue; }
                const last = cur && cur[cur.length - 1];
                if (last && Math.hypot(last.x - s.x1, last.y - s.y1) < 1e-6) cur.push({ x: s.x2, y: s.y2 });
                else { cur = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]; runs.push(cur); }
            }
            return runs;
        }
        // Điểm đặt tên đường: giữa chiều dài cả chuỗi, góc theo đoạn chứa điểm đó, luôn đọc xuôi (-90°, 90°]
        function _roadLabelPlacement(pts, minLen) {
            let total = 0;
            for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (!(total >= minLen)) return null;
            let acc = 0;
            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1], b = pts[i];
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                if (acc + len >= total / 2 && len > 0) {
                    const t = (total / 2 - acc) / len;
                    let rot = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
                    rot = ((rot % 180) + 180) % 180;
                    if (rot > 90) rot -= 180;
                    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), rot, len: total };
                }
                acc += len;
            }
            return null;
        }
        function _labelTooClose(placed, name, x, y, minDist) {
            return placed.some(p => p.name === name && Math.hypot(p.x - x, p.y - y) < minDist);
        }
        // v156 — Lối đi bộ / bãi xe… → lớp OSM_DUONG_KHAC (không vẽ proposed/elevator/platform)
        const _OSM_OTHER_HW = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'track', 'bridleway', 'corridor']);
        function _osmRoadIsOther(tags) {
            const h = tags && tags.highway;
            if (!h) return false;
            if (_OSM_OTHER_HW.has(h)) return true;
            return h === 'service' && ['parking_aisle', 'driveway', 'drive-through'].includes(tags.service);
        }
        // v156 — Ghép các way nối tiếp (đúng 2 đầu way gặp nhau, cùng bề rộng) thành 1 chuỗi để mép
        // đường chạy liền qua điểm OSM chia way. Ngã ba/ngã tư (≥3 đầu way) giữ nguyên.
        function _mergeRoadChains(roads) {
            const key = p => p.x.toFixed(2) + ',' + p.y.toFixed(2);
            const ends = new Map();
            roads.forEach((r, i) => {
                if (!r.pts || r.pts.length < 2) return;
                [[r.pts[0], true], [r.pts[r.pts.length - 1], false]].forEach(([p, atStart]) => {
                    const k = key(p);
                    if (!ends.has(k)) ends.set(k, []);
                    ends.get(k).push({ i, atStart });
                });
            });
            const visited = new Array(roads.length).fill(false);
            // Không ghép qua 2 tầng khác nhau (đầu cầu/hầm) để giữ tầng riêng cho bước cắt nút giao
            const nextAt = (p, width, layer) => {
                const list = ends.get(key(p));
                if (!list || list.length !== 2) return null;
                const o = list.find(e => !visited[e.i]);
                return (o && roads[o.i].width === width && (roads[o.i].layer || 0) === (layer || 0)) ? o : null;
            };
            const out = [];
            const build = i => {
                const r = roads[i];
                visited[i] = true;
                const pts = r.pts.slice();
                for (let o; (o = nextAt(pts[pts.length - 1], r.width, r.layer)); ) {   // nối về phía cuối
                    visited[o.i] = true;
                    const q = roads[o.i].pts;
                    pts.push(...(o.atStart ? q.slice(1) : q.slice(0, -1).reverse()));
                }
                for (let o; (o = nextAt(pts[0], r.width, r.layer)); ) {               // nối về phía đầu
                    visited[o.i] = true;
                    const q = roads[o.i].pts;
                    pts.unshift(...(o.atStart ? q.slice(1).reverse() : q.slice(0, -1)));
                }
                out.push(Object.assign({}, r, { pts }));
            };
            // Bắt đầu từ way có đầu mút "cụt" hoặc ở nút giao để chuỗi không bị cắt giữa; còn lại (vòng kín) sau
            const isChainEnd = p => { const l = ends.get(key(p)); return !l || l.length !== 2; };
            roads.forEach((r, i) => { if (!visited[i] && r.pts && r.pts.length >= 2 && (isChainEnd(r.pts[0]) || isChainEnd(r.pts[r.pts.length - 1]))) build(i); });
            roads.forEach((r, i) => { if (!visited[i] && r.pts && r.pts.length >= 2) build(i); });
            return out;
        }
        // Tầng OSM: layer ghi rõ → dùng; cầu không ghi layer → 1; hầm → -1; còn lại 0
        function _osmRoadLayer(tags) {
            const l = parseInt(tags && tags.layer);
            if (isFinite(l)) return l;
            if (tags && tags.bridge && tags.bridge !== 'no') return 1;
            if (tags && tags.tunnel && tags.tunnel !== 'no') return -1;
            return 0;
        }
        // v156 — Chỉ mục hành lang mặt đường (tim ± hw) theo lưới để tra "điểm nằm trong lòng tuyến khác".
        // Đầu mút tuyến (không khép kín) là đầu BẰNG: đánh dấu capStart/capEnd để không "khoét tròn"
        // mép đường bên kia khi tuyến rộng đâm vào tuyến hẹp.
        function _corridorIndex(corridors, cell) {
            const grid = new Map();
            corridors.forEach(c => {
                const n = (c.pts || []).length;
                const closed = n >= 3 && Math.hypot(c.pts[0].x - c.pts[n - 1].x, c.pts[0].y - c.pts[n - 1].y) < 1e-6;
                for (let i = 1; i < n; i++) {
                    const s = { x1: c.pts[i - 1].x, y1: c.pts[i - 1].y, x2: c.pts[i].x, y2: c.pts[i].y, hw: c.hw, id: c.id,
                                layer: c.layer || 0, capStart: !closed && i === 1, capEnd: !closed && i === n - 1 };
                    const i0 = Math.floor((Math.min(s.x1, s.x2) - s.hw) / cell), i1 = Math.floor((Math.max(s.x1, s.x2) + s.hw) / cell);
                    const j0 = Math.floor((Math.min(s.y1, s.y2) - s.hw) / cell), j1 = Math.floor((Math.max(s.y1, s.y2) + s.hw) / cell);
                    for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) {
                        const k = a + ',' + b;
                        if (!grid.has(k)) grid.set(k, []);
                        grid.get(k).push(s);
                    }
                }
            });
            return { grid, cell };
        }
        function _insideOtherCorridor(x, y, idx, selfId, eps, selfLayer) {
            const list = idx.grid.get(Math.floor(x / idx.cell) + ',' + Math.floor(y / idx.cell));
            if (!list) return false;
            for (const s of list) {
                if (s.id === selfId) continue;
                if (s.layer !== (selfLayer || 0)) continue;   // cầu vượt / hầm chui: không giao thật
                const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
                const raw = l2 < 1e-12 ? 0 : ((x - s.x1) * dx + (y - s.y1) * dy) / l2;
                if ((raw < 0 && s.capStart) || (raw > 1 && s.capEnd)) continue;   // đầu bằng ở đầu mút tuyến
                const t = Math.max(0, Math.min(1, raw));
                if (Math.hypot(x - s.x1 - t * dx, y - s.y1 - t * dy) < s.hw - eps) return true;
            }
            return false;
        }
        // v156 — Cắt bỏ phần mép đường nằm trong lòng tuyến khác (nút giao). Trả về các chuỗi điểm còn lại.
        // Lấy mẫu ≤1m/bước, ranh giới vào/ra tìm bằng chia đôi (~mm); chỉ giữ đỉnh gốc + điểm cắt.
        function _trimEdgeRun(pts, idx, selfId, selfLayer) {
            const EPS = 0.05;
            if (!pts || pts.length < 2) return [];
            const inside = p => _insideOtherCorridor(p.x, p.y, idx, selfId, EPS, selfLayer);
            const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            const runs = [];
            let cur = null;
            if (!inside(pts[0])) { cur = [pts[0]]; runs.push(cur); }
            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1], b = pts[i];
                const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.0));
                let tPrev = 0, inPrev = inside(a);
                for (let k = 1; k <= n; k++) {
                    const t = k / n, inNow = inside(lerp(a, b, t));
                    if (inNow !== inPrev) {
                        let lo = tPrev, hi = t;   // lo cùng trạng thái inPrev
                        for (let it = 0; it < 14; it++) {
                            const mid = (lo + hi) / 2;
                            if (inside(lerp(a, b, mid)) === inPrev) lo = mid; else hi = mid;
                        }
                        const q = lerp(a, b, inPrev ? hi : lo);
                        if (inPrev) { cur = [q]; runs.push(cur); }   // ra khỏi lòng đường khác
                        else { cur.push(q); cur = null; }            // đi vào lòng đường khác
                    }
                    if (k === n && !inNow) cur.push(b);
                    tPrev = t; inPrev = inNow;
                }
            }
            const pathLen = r => { let s = 0; for (let i = 1; i < r.length; i++) s += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y); return s; };
            return runs.filter(r => r.length >= 2 && pathLen(r) > 0.01);
        }
        // v161 — Bo góc giao lộ. Bán kính theo cấp đường LỚN HƠN trong 2 đường gặp nhau (0 = không bo).
        const OSM_CORNER_RADIUS_DEFAULTS = { major: 12, secondary: 10, residential: 6, service: 3 };
        const _OSM_CLASS_RANK = { service: 0, residential: 1, secondary: 2, major: 3 };
        // Cấp đường — cùng cách phân nhóm với _osmRoadWidth
        function _osmRoadClass(tags) {
            let hw = String((tags && tags.highway) || '');
            if (hw === 'construction') hw = String(tags.construction || 'residential');
            if (['motorway', 'trunk', 'primary'].includes(hw)) return 'major';
            if (['secondary', 'tertiary'].includes(hw)) return 'secondary';
            if (hw === 'service') return 'service';
            return 'residential';
        }
        // runs: [{pts, chain, cls}] — mép đường SAU khi cắt nút giao (_trimEdgeRun). Tại góc giao lộ, 2 đầu mút của 2 chuỗi
        // khác nhau gần trùng nhau (< tol) → thay góc nhọn bằng cung tròn tiếp xúc 2 mép, rút ngắn 2 mép tới điểm tiếp xúc.
        // Trả về { runs (bản sao đã rút), arcs: [{cx, cy, r, start, end}] } — góc độ, cung đi NGƯỢC chiều kim đồng hồ start→end.
        // clip (tuỳ chọn): khung bản vẽ — đầu mút nằm trên mép khung là do CẮT KHUNG, không phải góc giao lộ.
        function _filletCorners(runs, radii, tol, clip) {
            tol = tol || 0.5;
            const rad = Object.assign({}, OSM_CORNER_RADIUS_DEFAULTS, radii || {});
            const out = runs.map(r => Object.assign({}, r, { pts: r.pts.map(p => ({ x: p.x, y: p.y })) }));
            const ends = [];
            out.forEach((r, k) => {
                const n = r.pts.length;
                if (n < 2) return;
                ends.push({ k, atStart: true }, { k, atStart: false });
            });
            const endPt = e => (e.atStart ? out[e.k].pts[0] : out[e.k].pts[out[e.k].pts.length - 1]);
            const nextPt = e => (e.atStart ? out[e.k].pts[1] : out[e.k].pts[out[e.k].pts.length - 2]);
            const onClip = p => !!clip && [p.x - clip.minX, clip.maxX - p.x, p.y - clip.minY, clip.maxY - p.y].some(d => Math.abs(d) < 0.01);
            // Hình học của 1 cặp đầu mút: góc C, hướng vào 2 mép u1/u2, góc giao θ, bán kính theo cấp lớn hơn. null = không bo.
            const geom = (a, b) => {
                const ra = out[a.k], rb = out[b.k];
                if (ra.name && ra.name === rb.name) return null;   // cùng tên đường: chỗ bẻ tại nút chia chuỗi, không phải giao lộ
                const p1 = endPt(a), q1 = nextPt(a), p2 = endPt(b), q2 = nextPt(b);
                const l1 = Math.hypot(q1.x - p1.x, q1.y - p1.y), l2 = Math.hypot(q2.x - p2.x, q2.y - p2.y);
                if (l1 < 1e-6 || l2 < 1e-6) return null;
                const u1 = { x: (q1.x - p1.x) / l1, y: (q1.y - p1.y) / l1 }, u2 = { x: (q2.x - p2.x) / l2, y: (q2.y - p2.y) / l2 };
                const cr = u1.x * u2.y - u1.y * u2.x;
                if (Math.abs(cr) < 1e-9) return null;
                // Góc thật = giao 2 đường thẳng chứa đoạn cuối (đầu mút cắt nút giao lệch ~5cm khỏi mép bên kia)
                const s = ((p2.x - p1.x) * u2.y - (p2.y - p1.y) * u2.x) / cr;
                const C = { x: p1.x + u1.x * s, y: p1.y + u1.y * s };
                if (Math.hypot(C.x - p1.x, C.y - p1.y) > 2 * tol) return null;
                const theta = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
                const deg = theta * 180 / Math.PI;
                if (deg < 10 || deg > 170) return null;
                const big = (_OSM_CLASS_RANK[ra.cls] || 0) >= (_OSM_CLASS_RANK[rb.cls] || 0) ? ra.cls : rb.cls;
                const R = Number(rad[big]);
                return R > 0 ? { C, u1, u2, theta, R } : null;
            };
            // Ghép cặp: chỉ cặp HỢP LỆ, gần nhất trước, mỗi đầu mút 1 lần. Lưới ô = tol để không phải so N².
            const cell = p => Math.floor(p.x / tol) + ',' + Math.floor(p.y / tol);
            const grid = new Map();
            ends.forEach((e, i) => {
                const p = endPt(e);
                if (onClip(p)) return;
                const k = cell(p);
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(i);
            });
            const cand = [];
            grid.forEach((list, key) => {
                const [cx, cy] = key.split(',').map(Number);
                const near = [];
                for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) (grid.get((cx + dx) + ',' + (cy + dy)) || []).forEach(j => near.push(j));
                list.forEach(i => near.forEach(j => {
                    if (j <= i) return;
                    const a = ends[i], b = ends[j];
                    if (a.k === b.k || out[a.k].chain === out[b.k].chain) return;
                    const pa = endPt(a), pb = endPt(b), d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
                    if (d >= tol) return;
                    const g = geom(a, b);
                    if (g) cand.push({ a, b, d, g });
                }));
            });
            cand.sort((x, y) => x.d - y.d);
            const used = new Set(), pairs = [];
            const id = e => e.k + (e.atStart ? 's' : 'e');
            for (const c of cand) if (!used.has(id(c.a)) && !used.has(id(c.b))) { used.add(id(c.a)); used.add(id(c.b)); pairs.push(c); }
            const filleted = new Map();   // run k → số đầu mút được bo (2 đầu → mỗi đầu chỉ dùng ½ chiều dài)
            pairs.forEach(c => [c.a, c.b].forEach(e => filleted.set(e.k, (filleted.get(e.k) || 0) + 1)));
            // Đỉnh của run tính từ đầu mút e đi vào trong
            const inward = e => (e.atStart ? out[e.k].pts.slice() : out[e.k].pts.slice().reverse());
            // Chiều dài phần GẦN THẲNG (lệch ≤ 5° so với u) tính từ góc C — OSM hay có nút sát giao lộ,
            // nếu chỉ dùng đoạn cuối thì bán kính bị ép rất nhỏ
            const COS5 = Math.cos(5 * Math.PI / 180);
            const straightLen = (e, C, u) => {
                const p = inward(e);
                let len = 0, prev = C;
                for (let i = 1; i < p.length; i++) {
                    const dx = p[i].x - prev.x, dy = p[i].y - prev.y, l = Math.hypot(dx, dy);
                    if (l < 1e-9) continue;
                    if ((dx * u.x + dy * u.y) / l < COS5) break;
                    len += l; prev = p[i];
                }
                return len;
            };
            const totalLen = e => { const p = out[e.k].pts; let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return s; };
            // Các đỉnh còn lại sau khi bỏ phần run cách C dưới t (dọc theo run), đầu mút mới = T. null = không còn đủ 2 điểm.
            const cutRun = (e, C, t, T) => {
                const p = inward(e), keep = [T];
                let acc = 0, prev = C;
                for (let i = 1; i < p.length; i++) {
                    acc += Math.hypot(p[i].x - prev.x, p[i].y - prev.y); prev = p[i];
                    if (acc > t + 1e-6) keep.push(p[i]);
                }
                if (keep.length < 2) return null;
                return e.atStart ? keep : keep.reverse();
            };
            const arcs = [];
            for (const { a, b, g } of pairs) {
                const { C, u1, u2, theta } = g;
                let R = g.R;
                let t = R / Math.tan(theta / 2);
                // Run bị bo cả 2 đầu → mỗi đầu dùng tối đa ½ chiều dài để 2 cung không chồng nhau
                const avail = (e, u) => Math.min(straightLen(e, C, u), filleted.get(e.k) === 2 ? totalLen(e) / 2 : Infinity);
                const tMax = Math.min(avail(a, u1), avail(b, u2)) * 0.999;
                if (t > tMax) { t = tMax; R = t * Math.tan(theta / 2); }
                if (R < 0.1) continue;
                const T1 = { x: C.x + u1.x * t, y: C.y + u1.y * t }, T2 = { x: C.x + u2.x * t, y: C.y + u2.y * t };
                const bx = u1.x + u2.x, by = u1.y + u2.y, bl = Math.hypot(bx, by);
                const h = R / Math.sin(theta / 2);
                const O = { x: C.x + bx / bl * h, y: C.y + by / bl * h };
                // Rút 2 mép về điểm tiếp xúc (bỏ các đỉnh nằm trong phần bị bo); không cắt được gọn → bỏ góc này
                const ka = cutRun(a, C, t, T1), kb = cutRun(b, C, t, T2);
                if (!ka || !kb) continue;
                out[a.k].pts = ka;
                out[b.k].pts = kb;
                const ang = P => (Math.atan2(P.y - O.y, P.x - O.x) * 180 / Math.PI + 360) % 360;
                let st = ang(T1), en = ang(T2);
                if ((en - st + 360) % 360 > 180) [st, en] = [en, st];   // cung ngắn (quét 180° − góc giao)
                arcs.push({ cx: O.x, cy: O.y, r: R, start: st, end: en });
            }
            return { runs: out, arcs };
        }
        // @@OSMROAD_END

        function _drawOsmBasemapInDxf(push, osmData, cm, outDE, outDN, clipBounds, k0, roadOpts) {
            if (!osmData) return { entityCount: 0 };
            let entityCount = 0, skipped = 0;
            const hasClip = clipBounds && isFinite(clipBounds.minX) && isFinite(clipBounds.maxX);
            // Liang-Barsky line clip vào AABB clipBounds. Return {x1,y1,x2,y2} đã clip hoặc null.
            const clipSeg = (x1, y1, x2, y2) => {
                if (!hasClip) return { x1, y1, x2, y2 };
                let t0 = 0, t1 = 1;
                const dx = x2 - x1, dy = y2 - y1;
                const p = [-dx, dx, -dy, dy];
                const q = [x1 - clipBounds.minX, clipBounds.maxX - x1,
                           y1 - clipBounds.minY, clipBounds.maxY - y1];
                for (let i = 0; i < 4; i++) {
                    if (p[i] === 0) { if (q[i] < 0) return null; }
                    else {
                        const t = q[i] / p[i];
                        if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
                        else          { if (t < t0) return null; if (t < t1) t1 = t; }
                    }
                }
                return { x1: x1 + t0 * dx, y1: y1 + t0 * dy,
                         x2: x1 + t1 * dx, y2: y1 + t1 * dy };
            };
            // Convert GeoJSON [lon, lat] → VN2000 + apply offset
            const convert = (coords) => coords.map(([lon, lat]) => {
                const vn = convertLatLonToVn2000(lat, lon, cm, k0);  // k0 phải khớp marker, nếu không lệch ~357m khi CM=105°
                return { x: vn.x + outDE, y: vn.y + outDN };
            });
            const drawPolyline = (pts, layer) => {
                for (let i = 1; i < pts.length; i++) {
                    const s = clipSeg(pts[i-1].x, pts[i-1].y, pts[i].x, pts[i].y);
                    if (!s) { skipped++; continue; }
                    push('0', 'LINE', '8', layer,
                        '10', s.x1.toFixed(4), '20', s.y1.toFixed(4), '30', '0',
                        '11', s.x2.toFixed(4), '21', s.y2.toFixed(4), '31', '0');
                    entityCount++;
                }
            };
            // v154 — Đường xe chạy: tim / mép / tên, mỗi loại 1 lớp
            const ro = Object.assign({ center: true, edge: false, name: false, other: false, widths: null, textHeight: 3 }, roadOpts || {});
            const placedLabels = [];
            // Cắt khung rồi gom thành chuỗi liền → 1 POLYLINE R12/chuỗi (70=128: nét gạch chạy liên tục qua các nút)
            const clippedRuns = pts => {
                const segs = [];
                for (let i = 1; i < pts.length; i++) {
                    const s = clipSeg(pts[i-1].x, pts[i-1].y, pts[i].x, pts[i].y);
                    if (!s) skipped++;
                    segs.push(s);
                }
                return _chainRuns(segs);
            };
            const writePolylines = (runs, layer) => {
                for (const run of runs) {
                    push('0', 'POLYLINE', '8', layer, '66', '1', '10', '0', '20', '0', '30', '0', '70', '128');
                    for (const v of run) push('0', 'VERTEX', '8', layer, '10', v.x.toFixed(4), '20', v.y.toFixed(4), '30', '0');
                    push('0', 'SEQEND', '8', layer);
                    entityCount++;
                }
            };
            const drivable = [];   // { pts, width } — dùng cho mép đường sau vòng lặp
            (osmData.roads || []).forEach(w => {
                if (!w.coords || w.coords.length < 2) return;
                if (!_rlIsDrivable(w.tags)) {
                    // v156 — lối đi bộ / bãi xe: 1 nét trên lớp riêng, chỉ khi user bật
                    if (ro.other && _osmRoadIsOther(w.tags)) writePolylines(clippedRuns(convert(w.coords)), 'OSM_DUONG_KHAC');
                    return;
                }
                const pts = convert(w.coords);
                const centerRuns = clippedRuns(pts);
                if (ro.center) writePolylines(centerRuns, 'OSM_TIM_DUONG');
                if (ro.edge) drivable.push({ pts, width: _osmRoadWidth(w.tags, ro.widths), layer: _osmRoadLayer(w.tags), cls: _osmRoadClass(w.tags), name: (w.tags && w.tags.name) || '' });
                const name = w.tags && w.tags.name;
                if (ro.name && name) {
                    // Đặt nhãn ở giữa chiều dài của chuỗi dài nhất nằm trong khung
                    let lp = null;
                    for (const run of centerRuns) {
                        const c = _roadLabelPlacement(run, 30);
                        if (c && (!lp || c.len > lp.len)) lp = c;
                    }
                    if (lp && !_labelTooClose(placedLabels, name, lp.x, lp.y, 100)) {
                        placedLabels.push({ name, x: lp.x, y: lp.y });
                        push('0', 'TEXT', '8', 'OSM_TEN_DUONG',
                            '10', lp.x.toFixed(4), '20', lp.y.toFixed(4), '30', '0',
                            '40', ro.textHeight.toFixed(2), '1', _dxfEscape(name), '50', lp.rot.toFixed(2),
                            '72', '1', '11', lp.x.toFixed(4), '21', lp.y.toFixed(4), '31', '0', '73', '2');
                        entityCount++;
                    }
                }
            });
            // v156 — Mép đường: ghép way nối tiếp → dời ±½ bề rộng → cắt khung → cắt phần nằm trong lòng tuyến khác
            if (ro.edge && drivable.length) {
                const chains = _mergeRoadChains(drivable);
                const corr = _corridorIndex(chains.map((c, i) => ({ pts: c.pts, hw: c.width / 2, id: i, layer: c.layer })), 25);
                const edgeRuns = [];
                chains.forEach((c, i) => {
                    for (const side of [1, -1]) {
                        for (const run of clippedRuns(_offsetPolyline(c.pts, side * c.width / 2))) {
                            _trimEdgeRun(run, corr, i, c.layer).forEach(pts => edgeRuns.push({ pts, chain: i, cls: c.cls, name: c.name }));
                        }
                    }
                });
                // v161 — bo góc giao lộ (ARC tiếp xúc 2 mép). Khác tầng không có góc chung vì mép không bị cắt ở đó.
                const fil = _filletCorners(edgeRuns, ro.radii, 0.5, hasClip ? clipBounds : null);
                writePolylines(fil.runs.map(r => r.pts), 'OSM_MEP_DUONG');
                fil.arcs.forEach(a => {
                    push('0', 'ARC', '8', 'OSM_MEP_DUONG', '10', a.cx.toFixed(4), '20', a.cy.toFixed(4), '30', '0',
                        '40', a.r.toFixed(4), '50', a.start.toFixed(4), '51', a.end.toFixed(4));
                    entityCount++;
                });
            }
            // Buildings — outline only
            (osmData.buildings || []).forEach(w => {
                drawPolyline(convert(w.coords), 'OSM_BUILDING');
            });
            // Water
            (osmData.water || []).forEach(w => {
                drawPolyline(convert(w.coords), 'OSM_WATER');
            });
            // Admin boundaries — P67
            (osmData.admin || []).forEach(w => {
                const pts = convert(w.coords);
                drawPolyline(pts, 'ADMIN_BOUNDARY');
                // Label at centroid — chỉ vẽ nếu centroid trong clipBounds
                if (pts.length > 0 && w.tags.name) {
                    let cx = 0, cy = 0;
                    pts.forEach(p => { cx += p.x; cy += p.y; });
                    cx /= pts.length; cy /= pts.length;
                    const inClip = !hasClip || (cx >= clipBounds.minX && cx <= clipBounds.maxX
                                             && cy >= clipBounds.minY && cy <= clipBounds.maxY);
                    if (inClip) {
                        push('0', 'TEXT', '8', 'ADMIN_BOUNDARY');
                        push('10', cx.toFixed(4), '20', cy.toFixed(4), '30', '0');
                        push('40', '4.0');
                        push('1', _dxfEscape(w.tags.name));
                        entityCount++;
                    }
                }
            });
            return { entityCount, skipped };
        }
        window._drawOsmBasemapInDxf = _drawOsmBasemapInDxf;
