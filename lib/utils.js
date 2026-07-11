// Utility functions extracted for testing (P38)

// Normalize text: bỏ dấu + lowercase, xử lý riêng đ→d trước NFD
export function normalizeText(text) {
    if (text == null) return '';
    return String(text)
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

// Thêm bước loại bỏ mọi ký tự đặc biệt (space, _, -, #) — dùng cho search
export function normalizeTextSearchable(text) {
    return normalizeText(text).replace(/[^a-z0-9]/g, '');
}

// Strip MTEXT format codes trong DXF (P17)
export function cleanMText(text) {
    if (!text) return '';
    let s = String(text);
    // AutoCAD special chars
    s = s.replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%%/g, '%');
    s = s.replace(/%%(\d{3})/g, (_, num) => {
        const n = parseInt(num, 10);
        return n > 0 && n < 65536 ? String.fromCharCode(n) : '';
    });
    // Inline format codes
    s = s.replace(/\\[CcHWQTAFf][^;]*;/g, '');
    s = s.replace(/\\P/g, ' ');
    s = s.replace(/\\[LlOoKkNn]/g, '');
    s = s.replace(/\\S([^;]+);/g, '$1');
    s = s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    s = s.replace(/\\\\/g, '\\').replace(/\\\{/g, '{').replace(/\\\}/g, '}');
    // Group formatting
    for (let i = 0; i < 5; i++) {
        const prev = s;
        s = s.replace(/\{([^{}]*)\}/g, (m, inner) => {
            const semi = inner.lastIndexOf(';');
            return semi >= 0 ? inner.slice(semi + 1) : inner;
        });
        if (s === prev) break;
    }
    return s.trim();
}

// Compute bearing from (lat1,lon1) to (lat2,lon2), returns 0-360 degrees
export function computeBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// Migrate Google Drive URL: old /uc?export=view → new /lh3.googleusercontent
export function migrateDriveUrl(url) {
    if (!url || typeof url !== 'string') return url;
    const m = url.match(/drive\.google\.com\/uc\?export=view&id=([\w-]+)/);
    if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
    return url;
}
