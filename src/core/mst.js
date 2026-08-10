// Lighting Survey — Minimum Spanning Tree cable algorithms (T22)
// - Prim: optimal — tổng cable ngắn nhất
// - Nearest-neighbor chain: approximate, tuyến tự nhiên hơn cho khảo sát đường phố
//
// Input: nodes = [{name, lat, lon, isRoot}]
// Output: edges = [{from: name, to: name, dist: meters}]
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

    // Prim MST — greedy edge min từ tree ra outside. O(V*E).
    // Root: node có isRoot=true (thường là tủ điều khiển). Fallback nodes[0].
    function _mstPrim(nodes) {
        if (!Array.isArray(nodes) || nodes.length < 2) return [];
        const root = nodes.find(n => n.isRoot) || nodes[0];
        const inTree = new Set([root.name]);
        const edges = [];
        while (inTree.size < nodes.length) {
            let minEdge = null;
            for (const cand of nodes) {
                if (inTree.has(cand.name)) continue;
                for (const t of nodes) {
                    if (!inTree.has(t.name)) continue;
                    const d = _haversineM(t.lat, t.lon, cand.lat, cand.lon);
                    if (!minEdge || d < minEdge.dist) {
                        minEdge = { from: t.name, to: cand.name, dist: d };
                    }
                }
            }
            if (!minEdge) break;  // Disconnected
            edges.push(minEdge);
            inTree.add(minEdge.to);
        }
        return edges;
    }

    // Nearest-neighbor chain — greedy chuỗi tuyến từ root.
    // Đơn giản hơn, kết quả không tối ưu tuyệt đối nhưng tuyến "tự nhiên" hơn cho khảo sát đường phố.
    function _mstNearestChain(nodes) {
        if (!Array.isArray(nodes) || nodes.length < 2) return [];
        const root = nodes.find(n => n.isRoot) || nodes[0];
        const remaining = nodes.filter(n => n.name !== root.name);
        const edges = [];
        let current = root;
        while (remaining.length > 0) {
            let nearestIdx = 0;
            let minDist = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const d = _haversineM(current.lat, current.lon, remaining[i].lat, remaining[i].lon);
                if (d < minDist) { minDist = d; nearestIdx = i; }
            }
            const next = remaining[nearestIdx];
            edges.push({ from: current.name, to: next.name, dist: minDist });
            current = next;
            remaining.splice(nearestIdx, 1);
        }
        return edges;
    }

    // Expose namespace + backward-compat globals
    const ns = window.__LS = window.__LS || {};
    ns.mst = { _mstPrim, _mstNearestChain };

    window._mstPrim = _mstPrim;
    window._mstNearestChain = _mstNearestChain;
})();
