import { describe, it, expect } from 'vitest';
import { dxfColorToHex, addMonthsIso, computeDxfBounds } from '../../lib/dxf.js';

describe('dxfColorToHex', () => {
    it('returns #333 for BYLAYER (256)', () => {
        expect(dxfColorToHex(256)).toBe('#333');
    });

    it('returns #333 for null/undefined', () => {
        expect(dxfColorToHex(null)).toBe('#333');
        expect(dxfColorToHex(undefined)).toBe('#333');
    });

    it('returns red for index 1', () => {
        expect(dxfColorToHex(1)).toBe('#ff0000');
    });

    it('returns yellow for index 2', () => {
        expect(dxfColorToHex(2)).toBe('#ffff00');
    });

    it('returns fallback for out-of-range', () => {
        expect(dxfColorToHex(255)).toBe('#666');
    });
});

describe('addMonthsIso', () => {
    it('adds 12 months (1 year)', () => {
        expect(addMonthsIso('2026-01-15', 12)).toBe('2027-01-15');
    });

    it('adds 6 months across year', () => {
        expect(addMonthsIso('2026-11-30', 6)).toBe('2027-05-30');
    });

    it('handles single-digit month padding', () => {
        expect(addMonthsIso('2026-01-05', 1)).toBe('2026-02-05');
    });

    it('adds 24 months', () => {
        expect(addMonthsIso('2026-06-15', 24)).toBe('2028-06-15');
    });
});

describe('computeDxfBounds', () => {
    it('returns null for empty', () => {
        expect(computeDxfBounds([])).toBe(null);
    });

    it('computes bounds for lines', () => {
        const entities = [
            { type: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 20 }] },
            { type: 'line', points: [{ x: -5, y: 100 }, { x: 30, y: 5 }] }
        ];
        const b = computeDxfBounds(entities);
        expect(b.minX).toBe(-5);
        expect(b.maxX).toBe(30);
        expect(b.minY).toBe(0);
        expect(b.maxY).toBe(100);
    });

    it('handles circles + text', () => {
        const entities = [
            { type: 'circle', center: { x: 50, y: 50 }, radius: 10 },
            { type: 'text', position: { x: 20, y: 80 }, text: 'A' }
        ];
        const b = computeDxfBounds(entities);
        expect(b).toEqual({ minX: 20, maxX: 50, minY: 50, maxY: 80 });
    });
});
