// Lighting Survey — Minimum Spanning Tree cable algorithms (T22)
// - Prim: optimal — tổng cable ngắn nhất
// - Nearest-neighbor chain: approximate, tuyến tự nhiên hơn cho khảo sát đường phố
//
// Input: nodes = [{name, lat, lon, isRoot}]
// Output: edges = [{from: name, to: name, dist: meters, cross: số lần băng đường}]
// opts (tuỳ chọn): { cross(a,b), penalty } — phạt đoạn băng qua tim đường để cáp đi dọc tuyến (v176)
//
// Dependency: window.haversineM (từ src/core/utils.js — load trước)
// Namespace: window.__LS.mst
(function () {
    'use strict';

    // Fallback nếu utils.js chưa load
    function _haversineM(lat1, lon1, lat2, lon2) {
        if (typeof window.haversineM === 'function') return window.haversineM(lat1, lon1, lat2, lon2);
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    // v176 — chi phí chọn đoạn nối: khoảng cách + phí mỗi lần băng qua tim đường (cáp đi dọc tuyến).
    // opts = { cross(a, b) → số lần đoạn a–b cắt tim đường xe chạy, penalty: m mỗi lần } — không có → chỉ khoảng cách.
    // Số mét trả về (edge.dist) LUÔN là khoảng cách thật; phí chỉ dùng để chọn.
    function _edgeCoster(opts) {
        const cache = new Map();
        const useCross = !!(opts && typeof opts.cross === 'function' && opts.penalty > 0);
        return (a, b) => {
            const k = a.name < b.name ? a.name + '\u0000' + b.name : b.name + '\u0000' + a.name;
            let v = cache.get(k);
            if (!v) {
                const d = _haversineM(a.lat, a.lon, b.lat, b.lon);
                const cross = useCross ? opts.cross(a, b) : 0;
                v = { d, cross, cost: d + cross * (useCross ? opts.penalty : 0) };
                cache.set(k, v);
            }
            return v;
        };
    }

    // Prim MST — greedy edge min (theo chi phí) từ tree ra outside. O(V^3) lần tra (có cache cặp).
    // Root: node có isRoot=true (thường là tủ điều khiển). Fallback nodes[0].
    function _mstPrim(nodes, opts) {
        if (!Array.isArray(nodes) || nodes.length < 2) return [];
        const root = nodes.find(n => n.isRoot) || nodes[0];
        const coster = _edgeCoster(opts);
        const inTree = new Set([root.name]);
        const edges = [];
        while (inTree.size < nodes.length) {
            let minEdge = null, minCost = Infinity;
            for (const cand of nodes) {
                if (inTree.has(cand.name)) continue;
                for (const t of nodes) {
                    if (!inTree.has(t.name)) continue;
                    const c = coster(t, cand);
                    if (!minEdge || c.cost < minCost) {
                        minEdge = { from: t.name, to: cand.name, dist: c.d, cross: c.cross };
                        minCost = c.cost;
                    }
                }
            }
            if (!minEdge) break;  // Disconnected
            edges.push(minEdge);
            inTree.add(minEdge.to);
        }
        return edges;
    }

    // Nearest-neighbor chain — greedy chuỗi tuyến từ root (theo chi phí).
    // Đơn giản hơn, kết quả không tối ưu tuyệt đối nhưng tuyến "tự nhiên" hơn cho khảo sát đường phố.
    function _mstNearestChain(nodes, opts) {
        if (!Array.isArray(nodes) || nodes.length < 2) return [];
        const root = nodes.find(n => n.isRoot) || nodes[0];
        const coster = _edgeCoster(opts);
        const remaining = nodes.filter(n => n.name !== root.name);
        const edges = [];
        let current = root;
        while (remaining.length > 0) {
            let nearestIdx = 0, best = null;
            for (let i = 0; i < remaining.length; i++) {
                const c = coster(current, remaining[i]);
                if (!best || c.cost < best.cost) { best = c; nearestIdx = i; }
            }
            const next = remaining[nearestIdx];
            edges.push({ from: current.name, to: next.name, dist: best.d, cross: best.cross });
            current = next;
            remaining.splice(nearestIdx, 1);
        }
        return edges;
    }

    // Bộ đếm số lần đoạn cáp (2 trụ lat/lon) băng qua CON ĐƯỜNG MÀ TRỤ ĐANG ĐI DỌC.
    // "Đường đi dọc" của 1 trụ = đường xe chạy gần nhất (≤ ROUTE_MAX_DIST m), gom theo tên (bỏ tiền tố "Đường",
    // không phân biệt hoa thường) → các làn + đường gom cùng tên (đại lộ nhiều làn) là 1 đường; way không tên theo id.
    // Chỉ đếm khi cắt qua way thuộc đường đi dọc của 1 trong 2 trụ — cắt qua hẻm / đường nhánh đâm ngang
    // (bắt buộc khi đi dọc tuyến) KHÔNG tính.
    // roads = [{coords: [[lon, lat], …], tags}] (như _fetchOsmBasemap trả về); isDrivable(tags) lọc đường xe chạy.
    // Mỗi way là 1 tim (đường đôi = 2 way → 2 lần). Chạm sát đầu mút cáp (trụ nằm trên tim) không tính;
    // nhiều điểm cắt cách nhau < 0.5 m (nút nối 2 way) gộp làm 1.
    const ROUTE_MAX_DIST = 40;
    const _roadKey = (tags, id) => {
        const n = String((tags && tags.name) || '').trim().toLowerCase().replace(/^đường\s+/, '');
        return n || ('#' + id);
    };
    function _mstRoadCrossCounter(roads, isDrivable) {
        const ways = [];
        let lat0 = null;
        (roads || []).forEach((r, id) => {
            if (!r || !Array.isArray(r.coords) || r.coords.length < 2) return;
            if (isDrivable && !isDrivable(r.tags || {})) return;
            if (lat0 == null) lat0 = r.coords[0][1];
            ways.push({ key: _roadKey(r.tags, id), coords: r.coords });
        });
        if (!ways.length) return () => 0;
        const ky = 111320, kx = 111320 * Math.cos(lat0 * Math.PI / 180);
        const P = (lon, lat) => ({ x: lon * kx, y: lat * ky });
        const S = [];
        for (const w of ways) for (let i = 0; i + 1 < w.coords.length; i++) {
            const A = P(w.coords[i][0], w.coords[i][1]), B = P(w.coords[i + 1][0], w.coords[i + 1][1]);
            S.push({ key: w.key, A, B, x0: Math.min(A.x, B.x), x1: Math.max(A.x, B.x), y0: Math.min(A.y, B.y), y1: Math.max(A.y, B.y) });
        }
        // Đường đi dọc của 1 trụ (cache theo tên)
        const routeCache = new Map();
        const routeOf = n => {
            const ck = n.name != null ? n.name : n.lat + ',' + n.lon;
            if (routeCache.has(ck)) return routeCache.get(ck);
            const Q = P(n.lon, n.lat);
            let best = null, bd = ROUTE_MAX_DIST;
            for (const s of S) {
                if (Q.x < s.x0 - bd || Q.x > s.x1 + bd || Q.y < s.y0 - bd || Q.y > s.y1 + bd) continue;
                const ex = s.B.x - s.A.x, ey = s.B.y - s.A.y, l2 = ex * ex + ey * ey;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((Q.x - s.A.x) * ex + (Q.y - s.A.y) * ey) / l2)) : 0;
                const d = Math.hypot(Q.x - (s.A.x + t * ex), Q.y - (s.A.y + t * ey));
                if (d < bd) { bd = d; best = s.key; }
            }
            routeCache.set(ck, best);
            return best;
        };
        const EPS_END = 0.3;   // m — điểm cắt cách đầu mút cáp < 0.3 m coi như chạm (không tính)
        return (a, b) => {
            const keys = new Set([routeOf(a), routeOf(b)].filter(k => k != null));
            if (!keys.size) return 0;
            const C = P(a.lon, a.lat), D = P(b.lon, b.lat);
            const dx = D.x - C.x, dy = D.y - C.y, len = Math.hypot(dx, dy);
            if (len < 1e-6) return 0;
            const bx0 = Math.min(C.x, D.x), bx1 = Math.max(C.x, D.x), by0 = Math.min(C.y, D.y), by1 = Math.max(C.y, D.y);
            const hits = [];
            for (const s of S) {
                if (!keys.has(s.key)) continue;
                if (s.x1 < bx0 || s.x0 > bx1 || s.y1 < by0 || s.y0 > by1) continue;
                const ex = s.B.x - s.A.x, ey = s.B.y - s.A.y;
                const den = dx * ey - dy * ex;
                if (Math.abs(den) < 1e-12) continue;   // song song
                const t = ((s.A.x - C.x) * ey - (s.A.y - C.y) * ex) / den;   // vị trí trên đoạn cáp
                const u = ((s.A.x - C.x) * dy - (s.A.y - C.y) * dx) / den;   // vị trí trên đoạn tim
                if (u < -1e-9 || u > 1 + 1e-9) continue;
                if (t * len <= EPS_END || (1 - t) * len <= EPS_END) continue;
                hits.push(t * len);
            }
            hits.sort((x, y) => x - y);
            let n = 0, last = -Infinity;
            for (const h of hits) { if (h - last > 0.5) n++; last = h; }
            return n;
        };
    }

    // Expose namespace + backward-compat globals
    const ns = window.__LS = window.__LS || {};
    ns.mst = { _mstPrim, _mstNearestChain, _mstRoadCrossCounter };

    window._mstPrim = _mstPrim;
    window._mstNearestChain = _mstNearestChain;
    window._mstRoadCrossCounter = _mstRoadCrossCounter;
})();
