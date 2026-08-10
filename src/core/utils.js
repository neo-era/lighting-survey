// Lighting Survey — Core utils (browser IIFE, no bundler)
// Extract từ index.html để giảm tech debt monolithic (Sprint 2 refactor).
// Namespace: window.__LS.utils = { haversineM, parseCoord, formatCoordVN }
// Backward-compat: expose globals cùng tên (window.haversineM, etc.)
(function () {
    'use strict';

    // Distance haversine — trả về mét (integer, rounded)
    function haversineM(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    // Parse số — hỗ trợ dấu phẩy VN ("10,7592" → 10.7592) hoặc dấu chấm ("10.7592")
    function parseCoord(val) {
        return parseFloat(typeof val === 'string' ? val.replace(',', '.') : val);
    }

    // Format số dạng VN (dấu phẩy decimal) — dùng khi lưu vào Google Sheet locale VN
    // VD: formatCoordVN(10.7606005, 7) → "10,7606005"
    function formatCoordVN(num, decimals) {
        if (!isFinite(num)) return '';
        const d = decimals != null ? decimals : 7;
        return Number(num).toFixed(d).replace('.', ',');
    }

    // Distance haversine — trả về mét (double, không round). Dùng cho tính chính xác cao.
    function getDistanceMeters(lat1, lon1, lat2, lon2) {
        const toRad = x => x * Math.PI / 180;
        const R = 6371e3;
        const phi1 = toRad(lat1), phi2 = toRad(lat2);
        const dPhi = toRad(lat2 - lat1), dLambda = toRad(lon2 - lon1);
        const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Expose namespace + backward-compat globals
    const ns = window.__LS = window.__LS || {};
    ns.utils = { haversineM, parseCoord, formatCoordVN, getDistanceMeters };

    // Backward-compat: inline code trong index.html gọi trực tiếp `haversineM(...)`
    window.haversineM = haversineM;
    window.parseCoord = parseCoord;
    window.formatCoordVN = formatCoordVN;
    window.getDistanceMeters = getDistanceMeters;
})();
