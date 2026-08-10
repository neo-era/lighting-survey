// Lighting Survey — Text normalization utilities
// Namespace: window.__LS.text = { normalizeText, normalizeTextSearchable, normalizeMarkerBaseName }
(function () {
    'use strict';

    // Chuẩn hóa text bỏ dấu: đ/Đ → d/D, sau đó NFD strip diacritic, lowercase
    // Lưu ý: đ/Đ là BASE character (không phải tổ hợp như á=a+´), NFD không tách được.
    // Phải replace thủ công TRƯỚC khi NFD để 'duong' match 'Đường'.
    function normalizeText(text) {
        return (text || '').toString()
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    }

    // Strip cả khoảng trắng + ký tự đặc biệt (_, -, ., …) để search permissive hơn:
    // 'phu nhuan' / 'PHU NHUAN' / 'phunhuan' / 'phu-nhuan' đều match được 'Phú Nhuận'.
    function normalizeTextSearchable(text) {
        return normalizeText(text).replace(/[^a-z0-9]/g, '');
    }

    // Strip trailing digits + separators (_, space, -) khỏi tên marker để lấy basename.
    // VD: 'VTS_H232VTS_19' → 'vts_h232vts' | 'C1.01' → 'c1.' | 'ADV_2_1' → 'adv_2'
    // Dùng cho: dropdown "Marker gốc", filter basename trong CAD generator.
    function normalizeMarkerBaseName(name) {
        const base = (name || '').toString().trim().replace(/[_\s\-]*\d+$/, '');
        return normalizeText(base);
    }

    // Expose namespace + backward-compat globals
    const ns = window.__LS = window.__LS || {};
    ns.text = { normalizeText, normalizeTextSearchable, normalizeMarkerBaseName };

    window.normalizeText = normalizeText;
    window.normalizeTextSearchable = normalizeTextSearchable;
    window.normalizeMarkerBaseName = normalizeMarkerBaseName;
})();
