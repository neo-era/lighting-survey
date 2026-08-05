// VN-2000 Coordinate Conversion Library
// Chuẩn QĐ 05/2007/QĐ-BTNMT (Bursa-Wolf 7-parameter + Transverse Mercator)
// Default: TPHCM/Bình Dương/Long An (múi 3°, CM=105.75°, k0=0.9999)
// Vũng Tàu (sau sáp nhập 2025): truyền lon0Deg=107.75
// Convention: return {x: Easting, y: Northing} theo quy ước app (không phải VN chính thức)

const VN2000_A = 6378137.0;
const VN2000_F = 1 / 298.257223563;
const VN2000_E2 = 2 * VN2000_F - VN2000_F * VN2000_F;

const VN2000_HELMERT = {
    dx: -191.90441429,
    dy: -39.30318279,
    dz: -111.45032835,
    rx: (-0.00928836) * Math.PI / (180 * 3600),
    ry: (0.01975479) * Math.PI / (180 * 3600),
    rz: (-0.00427372) * Math.PI / (180 * 3600),
    ds: 0.252906 / 1e6
};
const VN2000_LON0_DEFAULT = 105.75;
const VN2000_K0_DEFAULT = 0.9999;

function _blhToXyz(latDeg, lonDeg, h) {
    const phi = latDeg * Math.PI / 180;
    const lam = lonDeg * Math.PI / 180;
    const sP = Math.sin(phi), cP = Math.cos(phi);
    const N = VN2000_A / Math.sqrt(1 - VN2000_E2 * sP * sP);
    return {
        X: (N + h) * cP * Math.cos(lam),
        Y: (N + h) * cP * Math.sin(lam),
        Z: (N * (1 - VN2000_E2) + h) * sP
    };
}

function _xyzToBlh(X, Y, Z) {
    const a = VN2000_A;
    const b = a * Math.sqrt(1 - VN2000_E2);
    const ep2 = (a * a - b * b) / (b * b);
    const p = Math.sqrt(X * X + Y * Y);
    const theta = Math.atan2(Z * a, p * b);
    const sT = Math.sin(theta), cT = Math.cos(theta);
    const lat = Math.atan2(Z + ep2 * b * sT * sT * sT, p - VN2000_E2 * a * cT * cT * cT);
    const lon = Math.atan2(Y, X);
    const sinLat = Math.sin(lat);
    const N = a / Math.sqrt(1 - VN2000_E2 * sinLat * sinLat);
    const h = p / Math.cos(lat) - N;
    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI, h: h };
}

function _helmertForward(X, Y, Z) {
    const p = VN2000_HELMERT;
    const k = 1 + p.ds;
    return {
        X: p.dx + k * (X + p.rz * Y - p.ry * Z),
        Y: p.dy + k * (-p.rz * X + Y + p.rx * Z),
        Z: p.dz + k * (p.ry * X - p.rx * Y + Z)
    };
}

function _helmertReverse(X, Y, Z) {
    const p = VN2000_HELMERT;
    const k = 1 / (1 + p.ds);
    const dx = X - p.dx, dy = Y - p.dy, dz = Z - p.dz;
    return {
        X: k * (dx - p.rz * dy + p.ry * dz),
        Y: k * (p.rz * dx + dy - p.rx * dz),
        Z: k * (-p.ry * dx + p.rx * dy + dz)
    };
}

function _tmForward(latDeg, lonDeg, lon0Deg, k0) {
    const a = VN2000_A, e2 = VN2000_E2;
    const ep2 = e2 / (1 - e2);
    const lon0 = lon0Deg * Math.PI / 180;
    const phi = latDeg * Math.PI / 180;
    const lam = lonDeg * Math.PI / 180;
    const sP = Math.sin(phi), cP = Math.cos(phi), tP = Math.tan(phi);
    const N = a / Math.sqrt(1 - e2 * sP * sP);
    const T = tP * tP;
    const C = ep2 * cP * cP;
    const A = (lam - lon0) * cP;
    const M = a * (
        (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256) * phi
        - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * phi)
        + (15 * e2 * e2 / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * phi)
        - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * phi)
    );
    const E = 500000 + k0 * N * (
        A
        + (1 - T + C) * Math.pow(A, 3) / 6
        + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120
    );
    const NN = k0 * (
        M + N * tP * (
            A * A / 2
            + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
            + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720
        )
    );
    return { E: E, N: NN };
}

function _tmReverse(E, N, lon0Deg, k0) {
    const a = VN2000_A, e2 = VN2000_E2;
    const ep2 = e2 / (1 - e2);
    const lon0 = lon0Deg * Math.PI / 180;
    const xF = E - 500000;
    const M = N / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const phi1 = mu
        + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
        + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu)
        + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
    const sP1 = Math.sin(phi1), cP1 = Math.cos(phi1), tP1 = Math.tan(phi1);
    const N1 = a / Math.sqrt(1 - e2 * sP1 * sP1);
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * sP1 * sP1, 1.5);
    const T1 = tP1 * tP1;
    const C1 = ep2 * cP1 * cP1;
    const D = xF / (N1 * k0);
    const lat = phi1 - (N1 * tP1 / R1) * (
        D * D / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720
    );
    const lon = lon0 + (
        D
        - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120
    ) / cP1;
    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
}

export function convertLatLonToVn2000(lat, lon, lon0Deg, k0) {
    lon0Deg = lon0Deg != null ? lon0Deg : VN2000_LON0_DEFAULT;
    k0 = k0 != null ? k0 : VN2000_K0_DEFAULT;
    const p1 = _blhToXyz(lat, lon, 0);
    const p2 = _helmertForward(p1.X, p1.Y, p1.Z);
    const blh = _xyzToBlh(p2.X, p2.Y, p2.Z);
    const tm = _tmForward(blh.lat, blh.lon, lon0Deg, k0);
    return { x: tm.E, y: tm.N, zone: Math.floor((lon + 180) / 6) + 1 };
}

export function convertVn2000ToLatLon(x, y, lon0Deg, k0) {
    lon0Deg = lon0Deg != null ? lon0Deg : VN2000_LON0_DEFAULT;
    k0 = k0 != null ? k0 : VN2000_K0_DEFAULT;
    const blh1 = _tmReverse(x, y, lon0Deg, k0);
    const p1 = _blhToXyz(blh1.lat, blh1.lon, 0);
    const p2 = _helmertReverse(p1.X, p1.Y, p1.Z);
    const blh2 = _xyzToBlh(p2.X, p2.Y, p2.Z);
    return { lat: blh2.lat, lon: blh2.lon };
}

export function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
