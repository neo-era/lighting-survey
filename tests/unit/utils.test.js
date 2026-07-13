import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeTextSearchable, cleanMText, computeBearing, migrateDriveUrl } from '../../lib/utils.js';

describe('normalizeText', () => {
    it('handles null/undefined', () => {
        expect(normalizeText(null)).toBe('');
        expect(normalizeText(undefined)).toBe('');
    });

    it('lowercase + strips Vietnamese diacritics', () => {
        expect(normalizeText('Đường Trần Hưng Đạo')).toBe('duong tran hung dao');
    });

    it('handles đ separately (NFD does not split it)', () => {
        expect(normalizeText('Đèn đường')).toBe('den duong');
    });
});

describe('normalizeTextSearchable', () => {
    it('strips spaces + special chars', () => {
        expect(normalizeTextSearchable('POLE_Q1_042')).toBe('poleq1042');
        expect(normalizeTextSearchable('Trụ #23 (mới)')).toBe('tru23moi');
    });

    it('handles empty', () => {
        expect(normalizeTextSearchable('')).toBe('');
    });
});

describe('cleanMText — DXF format codes', () => {
    it('strips MTEXT group formatting', () => {
        expect(cleanMText('{fTimes New Roman|b0|i0|c0|p18;\\C256;\\c0;Đ.Chùa Là}')).toBe('Đ.Chùa Là');
    });

    it('handles %%c (diameter) and %%d (degree)', () => {
        expect(cleanMText('Ø%%c 100 %%dC')).toBe('ØØ 100 °C');
    });

    it('handles %%NNN decimal codes', () => {
        expect(cleanMText('%%065%%066%%067')).toBe('ABC');
    });

    it('handles paragraph break \\P', () => {
        expect(cleanMText('Line 1\\PLine 2')).toBe('Line 1 Line 2');
    });

    it('returns empty for null/undefined', () => {
        expect(cleanMText(null)).toBe('');
        expect(cleanMText(undefined)).toBe('');
    });
});

describe('computeBearing', () => {
    it('due north = 0°', () => {
        expect(computeBearing(0, 0, 1, 0)).toBeCloseTo(0, 1);
    });

    it('due east = 90°', () => {
        expect(computeBearing(0, 0, 0, 1)).toBeCloseTo(90, 1);
    });

    it('due south = 180°', () => {
        expect(computeBearing(1, 0, 0, 0)).toBeCloseTo(180, 1);
    });

    it('due west = 270°', () => {
        expect(computeBearing(0, 1, 0, 0)).toBeCloseTo(270, 1);
    });
});

describe('migrateDriveUrl', () => {
    it('migrates old /uc?export=view URL', () => {
        expect(migrateDriveUrl('https://drive.google.com/uc?export=view&id=ABC123'))
            .toBe('https://lh3.googleusercontent.com/d/ABC123');
    });

    it('passes through new URL unchanged', () => {
        expect(migrateDriveUrl('https://lh3.googleusercontent.com/d/XYZ'))
            .toBe('https://lh3.googleusercontent.com/d/XYZ');
    });

    it('handles null/empty', () => {
        expect(migrateDriveUrl(null)).toBe(null);
        expect(migrateDriveUrl('')).toBe('');
    });
});
