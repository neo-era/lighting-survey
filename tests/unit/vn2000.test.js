import { describe, it, expect } from 'vitest';
import { convertLatLonToVn2000, convertVn2000ToLatLon, haversineM } from '../../lib/vn2000.js';

describe('VN-2000 conversion', () => {
    it('forward conversion for Cần Giuộc', () => {
        const { x, y, zone } = convertLatLonToVn2000(10.601, 106.664);
        expect(zone).toBe(48);
        expect(x).toBeGreaterThan(400000);
        expect(x).toBeLessThan(700000);
        expect(y).toBeGreaterThan(1100000);
    });

    it('forward + reverse roundtrip within 1m', () => {
        const original = { lat: 10.601, lon: 106.664 };
        const { x, y, zone } = convertLatLonToVn2000(original.lat, original.lon);
        const lon0 = zone * 6 - 183;
        const back = convertVn2000ToLatLon(x, y, lon0, 0.9996);
        expect(back.lat).toBeCloseTo(original.lat, 5);
        expect(back.lon).toBeCloseTo(original.lon, 5);
    });

    it('handles TP.HCM coordinates', () => {
        const { x, y, zone } = convertLatLonToVn2000(10.7769, 106.7009);
        expect(zone).toBe(48);
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
    });
});

describe('haversineM', () => {
    it('returns 0 for same point', () => {
        expect(haversineM(10.601, 106.664, 10.601, 106.664)).toBeCloseTo(0, 5);
    });

    it('computes ~111km for 1 degree of latitude at equator', () => {
        expect(haversineM(0, 0, 1, 0)).toBeCloseTo(111195, -3); // ~111km ± 1km
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
