// VN-2000 Coordinate Conversion Library
// Extracted from index.html for unit testing (P38)

export function convertLatLonToVn2000(lat, lon) {
    const toRad = x => x * Math.PI / 180;
    const a = 6378137.0, f = 1 / 298.257222101;
    const e2 = 2 * f - f * f, k0 = 0.9996;
    const zone = Math.floor((lon + 180) / 6) + 1;
    const lon0 = toRad(zone * 6 - 183);
    const phi = toRad(lat), lambda = toRad(lon);
    const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi), tanPhi = Math.tan(phi);
    const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    const T = tanPhi * tanPhi, C = e2 / (1 - e2) * cosPhi * cosPhi;
    const A = (lambda - lon0) * cosPhi;
    const M = a * ((1 - e2 / 4 - 3 * Math.pow(e2, 2) / 64 - 5 * Math.pow(e2, 3) / 256) * phi
        - (3 * e2 / 8 + 3 * Math.pow(e2, 2) / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * phi)
        + (15 * Math.pow(e2, 2) / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * phi)
        - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * phi));
    const x = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * e2 / (1 - e2)) * Math.pow(A, 5) / 120);
    const y = k0 * (M + N * tanPhi * (Math.pow(A, 2) / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * e2 / (1 - e2)) * Math.pow(A, 6) / 720));
    return { x: x + 500000, y, zone };
}

export function convertVn2000ToLatLon(x, y, centralMeridianDeg, k0) {
    const a = 6378137.0, f = 1 / 298.257222101;
    const e2 = 2 * f - f * f;
    const ep2 = e2 / (1 - e2);
    k0 = k0 || 0.9996;
    const lon0 = centralMeridianDeg * Math.PI / 180;
    const xFalse = x - 500000;
    const M = y / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const phi1 = mu
        + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
        + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu)
        + (1097 * e1 * e1 * e1 * e1 / 512) * Math.sin(8 * mu);
    const sinP = Math.sin(phi1), cosP = Math.cos(phi1), tanP = Math.tan(phi1);
    const N1 = a / Math.sqrt(1 - e2 * sinP * sinP);
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * sinP * sinP, 1.5);
    const T1 = tanP * tanP;
    const C1 = ep2 * cosP * cosP;
    const D = xFalse / (N1 * k0);
    const lat = phi1 - (N1 * tanP / R1) * (
        D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720
    );
    const lon = lon0 + (
        D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120
    ) / cosP;
    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
}

export function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
