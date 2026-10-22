// Nền OSM đường DỰNG SẴN (prebuilt) — toàn TP.HCM, chia ô .json.gz trong data/osm-roads/
// Không gọi Overpass live: nạp index 1 lần, fetch tile theo khung nhìn/khung xuất, giải nén gzip
// bằng DecompressionStream, trả đúng shape {roads:[{coords:[[lon,lat]],tags:{...}}]} như _fetchOsmBasemap.
// Classic script (nạp qua <script src>), hàm thuần đặt trong mốc @@OSMPREBUILT_START/END để test trích được.
// Xem docs/design-osm-prebuilt-hcm.md.

        // ─────────────────────────────────────────────────────────────
        // Phần thuần (không phụ thuộc trình duyệt) — test trích qua @@OSMPREBUILT
        // ─────────────────────────────────────────────────────────────
        // @@OSMPREBUILT_START
        const PB_BASE = 'data/osm-roads/';
        // Map khóa ngắn trong tile -> tag OSM đầy đủ (giữ nguyên tên để _drawOsmBasemapInDxf/_rlRoadSegments dùng lại)
        const PB_TAG_MAP = { h: 'highway', n: 'name', w: 'width', ln: 'lanes', ly: 'layer',
                             br: 'bridge', tn: 'tunnel', ow: 'oneway', co: 'construction', sv: 'service', rf: 'ref' };

        // 1 record tile {h,n,w,...,c:[[lon,lat]]} -> {coords:[[lon,lat]], tags:{highway,name,...}}
        function _pbRecordToRoad(rec) {
            const tags = {};
            for (const k in PB_TAG_MAP) if (rec[k] != null) tags[PB_TAG_MAP[k]] = rec[k];
            return { coords: rec.c || [], tags };
        }

        // Khóa các ô (tile) giao với bounds, mở rộng pad ô mỗi phía (bắt đường có điểm-giữa ở ô kế bên).
        // index = {bbox:{minLon,minLat,maxLon,maxLat}, tileDeg, tiles:{ "<col>_<row>":... }}
        // bounds = {minLat,minLon,maxLat,maxLon}. Chỉ trả khóa CÓ trong index.tiles.
        function _pbTileKeysForBounds(index, bounds, pad) {
            if (!index || !index.tiles || !bounds) return [];
            const p = (pad == null) ? 1 : pad;
            const bb = index.bbox, deg = index.tileDeg;
            const colOf = lon => Math.floor((lon - bb.minLon) / deg);
            const rowOf = lat => Math.floor((lat - bb.minLat) / deg);
            let c0 = colOf(bounds.minLon) - p, c1 = colOf(bounds.maxLon) + p;
            let r0 = rowOf(bounds.minLat) - p, r1 = rowOf(bounds.maxLat) + p;
            const keys = [];
            for (let c = c0; c <= c1; c++)
                for (let r = r0; r <= r1; r++) {
                    const k = c + '_' + r;
                    if (index.tiles[k]) keys.push(k);
                }
            return keys;
        }

        // Giữ đường nếu CÓ đỉnh nằm trong bounds mở rộng margin (độ). Ô prebuilt thô 0.1° chứa cả nghìn
        // đường; hàm này cắt về quanh vùng hỏi (giống Overpass way[highway](bbox) chỉ trả đường cắt bbox),
        // tránh trả vài chục nghìn đường làm nghẽn align/overlay. coords dạng [[lon,lat],...].
        function _pbRoadNearBounds(coords, bounds, margin) {
            if (!coords || !bounds) return false;
            const m = margin || 0;
            const minLat = bounds.minLat - m, maxLat = bounds.maxLat + m;
            const minLon = bounds.minLon - m, maxLon = bounds.maxLon + m;
            for (let i = 0; i < coords.length; i++) {
                const c = coords[i];
                if (c[1] >= minLat && c[1] <= maxLat && c[0] >= minLon && c[0] <= maxLon) return true;
            }
            return false;
        }
        // @@OSMPREBUILT_END

        // ─────────────────────────────────────────────────────────────
        // Phần runtime trình duyệt: fetch + giải nén + cache + overlay bản đồ
        // ─────────────────────────────────────────────────────────────
        let _pbIndexPromise = null;
        const _pbTileCache = new Map();     // key -> Promise<road[]>  (LRU trong RAM phiên này)
        const PB_TILE_CACHE_MAX = 40;       // giới hạn số ô giữ trong RAM (pan quanh TP không phình bộ nhớ)

        function _pbSupported() { return typeof DecompressionStream !== 'undefined'; }

        async function _pbGunzip(arrayBuf) {
            const stream = new Response(arrayBuf).body.pipeThrough(new DecompressionStream('gzip'));
            return await new Response(stream).text();
        }

        function _pbLoadIndex() {
            if (_pbIndexPromise) return _pbIndexPromise;
            _pbIndexPromise = (async () => {
                const res = await fetch(PB_BASE + 'index.json.gz', { cache: 'force-cache' });
                if (!res.ok) throw new Error('index HTTP ' + res.status);
                return JSON.parse(await _pbGunzip(await res.arrayBuffer()));
            })().catch(e => { _pbIndexPromise = null; throw e; });
            return _pbIndexPromise;
        }
        window._pbLoadIndex = _pbLoadIndex;

        function _pbFetchTile(key) {
            if (_pbTileCache.has(key)) return _pbTileCache.get(key);
            const p = (async () => {
                const res = await fetch(PB_BASE + 'tile_' + key + '.json.gz', { cache: 'force-cache' });
                if (!res.ok) throw new Error('tile ' + key + ' HTTP ' + res.status);
                const recs = JSON.parse(await _pbGunzip(await res.arrayBuffer()));
                return recs.map(_pbRecordToRoad);
            })().catch(e => { _pbTileCache.delete(key); throw e; });
            _pbTileCache.set(key, p);
            // LRU: quá hạn mức → bỏ ô cũ nhất (Map giữ thứ tự chèn)
            while (_pbTileCache.size > PB_TILE_CACHE_MAX) {
                const oldest = _pbTileCache.keys().next().value;
                if (oldest === key) break;
                _pbTileCache.delete(oldest);
            }
            return p;
        }

        // API chính: trả {roads:[{coords,tags}]} cho 1 bbox {minLat,minLon,maxLat,maxLon}.
        // Không có tile nào trong vùng -> roads rỗng (bên gọi tự quyết fallback). pad ô mặc định 1.
        async function _pbGetRoads(bounds, opts) {
            if (!_pbSupported()) throw new Error('Trình duyệt không hỗ trợ DecompressionStream — không giải nén được nền dựng sẵn.');
            const pad = opts && opts.pad != null ? opts.pad : 1;
            const index = await _pbLoadIndex();
            const keys = _pbTileKeysForBounds(index, bounds, pad);
            if (!keys.length) return { roads: [], buildings: [], water: [], admin: [], _prebuilt: true, _empty: true };
            const parts = await Promise.all(keys.map(k => _pbFetchTile(k).catch(() => [])));
            // Cắt về quanh bounds + lề (mặc định ~165m) — không trả cả vạn đường của 9 ô (nghẽn main thread).
            const margin = (opts && opts.marginDeg != null) ? opts.marginDeg : 0.0015;
            const roads = [];
            for (const arr of parts) for (const r of arr) if (_pbRoadNearBounds(r.coords, bounds, margin)) roads.push(r);
            return { roads, buildings: [], water: [], admin: [], _prebuilt: true };
        }
        window._pbGetRoads = _pbGetRoads;

        // ── Overlay đường OSM dựng sẵn trên bản đồ live (toggle qua Leaflet layers control) ──
        const PB_OVERLAY_MIN_ZOOM = 14;   // dưới ngưỡng này không vẽ (tránh ôm cả thành phố)
        const PB_OVERLAY_MAX_LINES = 9000;
        let _pbOverlayToken = 0;

        async function _refreshOsmRoadsOverlay(announce) {
            // _osmRoadsOn / _osmRoadsLayer / map khai báo trong index.html (dùng chung global lexical env)
            if (!_osmRoadsOn || !map || !_osmRoadsLayer) return;
            const layer = _osmRoadsLayer;
            const token = ++_pbOverlayToken;
            if (map.getZoom() < PB_OVERLAY_MIN_ZOOM) {
                layer.clearLayers();
                // Chỉ báo khi vừa bật lớp (announce), không spam mỗi lần pan
                if (announce && typeof displayInfo === 'function') displayInfo('🛣 Phóng to (≥ Z' + PB_OVERLAY_MIN_ZOOM + ') để xem nền đường OSM dựng sẵn.');
                return;
            }
            const b = map.getBounds();
            const bounds = { minLat: b.getSouth(), minLon: b.getWest(), maxLat: b.getNorth(), maxLon: b.getEast() };
            let data;
            try { data = await _pbGetRoads(bounds, { pad: 1 }); }
            catch (e) { if (typeof displayError === 'function') displayError('🛣 Lỗi nền OSM dựng sẵn: ' + e.message); return; }
            if (token !== _pbOverlayToken) return;   // đã có lần refresh mới hơn
            layer.clearLayers();
            let n = 0;
            for (const rd of data.roads) {
                if (n >= PB_OVERLAY_MAX_LINES) break;
                const latlngs = rd.coords.map(c => [c[1], c[0]]);   // [lon,lat] -> [lat,lon]
                if (latlngs.length < 2) continue;
                L.polyline(latlngs, { color: '#6b7280', weight: 1.5, opacity: 0.85, interactive: false }).addTo(layer);
                n++;
            }
        }
        window._refreshOsmRoadsOverlay = _refreshOsmRoadsOverlay;
