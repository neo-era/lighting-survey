import { describe, it, expect } from 'vitest';
import { convertLatLonToVn2000, convertVn2000ToLatLon, haversineM } from '../../lib/vn2000.js';

describe('VN-2000 conversion (QĐ 05/2007/QĐ-BTNMT — Helmert + TM)', () => {
    // Reference point cung cấp bởi kỹ sư trắc địa
    // Nhà thờ Đức Bà (10.779783 N, 106.699018 E) → X=1,192,036.460m (Bắc), Y=603,981.861m (Đông)
    // App convention: {x=Easting, y=Northing}
    it('Nhà thờ Đức Bà — kiểm chứng chuẩn nhà nước', () => {
        const r = convertLatLonToVn2000(10.779783, 106.699018);
        // Easting theo VN convention (Y=Đông) = 603981.861
        expect(r.x).toBeCloseTo(603981.861, 0); // tolerance ± 1m (đủ chính xác cho khảo sát)
        // Northing theo VN convention (X=Bắc) = 1192036.460
        expect(r.y).toBeCloseTo(1192036.460, 0);
    });

    it('roundtrip Nhà thờ Đức Bà — sai lệch dưới 0.01mm', () => {
        const orig = { lat: 10.779783, lon: 106.699018 };
        const { x, y } = convertLatLonToVn2000(orig.lat, orig.lon);
        const back = convertVn2000ToLatLon(x, y);
        // Lat/lon degrees: 1e-9 độ ~ 0.1mm
        expect(back.lat).toBeCloseTo(orig.lat, 8);
        expect(back.lon).toBeCloseTo(orig.lon, 8);
    });

    it('roundtrip Cần Giuộc', () => {
        const orig = { lat: 10.601, lon: 106.664 };
        const { x, y } = convertLatLonToVn2000(orig.lat, orig.lon);
        const back = convertVn2000ToLatLon(x, y);
        expect(back.lat).toBeCloseTo(orig.lat, 6);
        expect(back.lon).toBeCloseTo(orig.lon, 6);
    });

    it('trả về Easting trong dải hợp lý cho HCM/BD/LA', () => {
        const { x, y } = convertLatLonToVn2000(10.7769, 106.7009);
        // Easting ~ 500000 + delta (multi trục HCM)
        expect(x).toBeGreaterThan(400000);
        expect(x).toBeLessThan(700000);
        // Northing ~ 1.19 triệu (vĩ độ 10-11)
        expect(y).toBeGreaterThan(1100000);
        expect(y).toBeLessThan(1300000);
    });

    it('override zone params cho vùng khác (VD Vũng Tàu CM=107.75)', () => {
        // Cùng lat/lon nhưng lon0 khác → Easting khác
        const rHCM = convertLatLonToVn2000(10.5, 107.0, 105.75, 0.9999);
        const rVT  = convertLatLonToVn2000(10.5, 107.0, 107.75, 0.9999);
        expect(rHCM.x).not.toBeCloseTo(rVT.x, 0);
        // Vũng Tàu: điểm càng gần CM → Easting càng gần 500000
        expect(Math.abs(rVT.x - 500000)).toBeLessThan(Math.abs(rHCM.x - 500000));
    });
});

// ═══════════════════════════════════════════════════════════════════
// 3 điểm chuẩn user (kỹ sư trắc địa) cung cấp — VN convention (X=Bắc, Y=Đông)
// App convention: convertVn2000ToLatLon(x=Easting, y=Northing) → hoán đổi param
// ═══════════════════════════════════════════════════════════════════
const REFERENCE_POINTS = [
    { name: 'Nhà thờ Đức Bà',   X: 1192036.460, Y: 603981.861, lat: 10.77978300, lon: 106.69901800 },
    { name: 'Điểm chuẩn 2',     X: 1190000.000, Y: 600000.000, lat: 10.76148223, lon: 106.66255585 },
    { name: 'Điểm chuẩn 3',     X: 1210000.000, Y: 610000.000, lat: 10.94199939, lon: 106.75458454 }
];

describe('VN-2000 → WGS-84 (chiều nghịch — chuẩn nhà nước)', () => {
    REFERENCE_POINTS.forEach(p => {
        it(`${p.name} — sai lệch mặt đất < 1cm`, () => {
            // App convention: x=Easting (Y_VN), y=Northing (X_VN) — hoán đổi param
            const back = convertVn2000ToLatLon(p.Y, p.X);
            expect(back.lat).toBeCloseTo(p.lat, 7);   // 7 decimals ≈ 0.01m ≈ 1cm
            expect(back.lon).toBeCloseTo(p.lon, 7);
        });

        it(`${p.name} — roundtrip < 1mm`, () => {
            const vn = convertLatLonToVn2000(p.lat, p.lon);
            const back = convertVn2000ToLatLon(vn.x, vn.y);
            expect(back.lat).toBeCloseTo(p.lat, 8);   // 8 decimals ≈ 1mm
            expect(back.lon).toBeCloseTo(p.lon, 8);
        });

        it(`${p.name} — forward khớp chuẩn Helmert + TM`, () => {
            const vn = convertLatLonToVn2000(p.lat, p.lon);
            expect(vn.x).toBeCloseTo(p.Y, 1);   // Easting ≈ Y_VN, tolerance 0.1m
            expect(vn.y).toBeCloseTo(p.X, 1);   // Northing ≈ X_VN
        });
    });
});

describe('haversineM', () => {
    it('returns 0 for same point', () => {
        expect(haversineM(10.601, 106.664, 10.601, 106.664)).toBeCloseTo(0, 5);
    });

    it('computes ~111km for 1 degree of latitude at equator', () => {
        expect(haversineM(0, 0, 1, 0)).toBeCloseTo(111195, -3);
    });

    it('computes distance HCM to Cần Giuộc ~20km', () => {
        const d = haversineM(10.7769, 106.7009, 10.601, 106.664);
        expect(d).toBeGreaterThan(15000);
        expect(d).toBeLessThan(30000);
    });

    it('symmetric: d(A→B) = d(B→A)', () => {
        const d1 = haversineM(10.0, 106.0, 11.0, 107.0);
        const d2 = haversineM(11.0, 107.0, 10.0, 106.0);
        expect(d1).toBeCloseTo(d2, 3);
    });
});
