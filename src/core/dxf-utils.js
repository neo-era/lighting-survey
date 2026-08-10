// Lighting Survey — DXF text parsing utilities
// Extract 1 BLOCK...ENDBLK definition từ file DXF (raw text) + parse ATTDEF list.
// Namespace: window.__LS.dxfUtils
(function () {
    'use strict';

    // Extract 1 BLOCK...ENDBLK definition (raw DXF text) từ file nguồn.
    // Return text bắt đầu bằng "  0\nBLOCK..." kết thúc "  0\nENDBLK\n  8\n0"
    // để inject vào BLOCKS section của output DXF.
    // Return null nếu không tìm thấy block với tên đó.
    function _extractDxfBlock(dxfText, blockName) {
        const target = String(blockName).toUpperCase().trim();
        const lines = dxfText.split(/\r?\n/);
        const n = lines.length;
        for (let i = 0; i < n - 1; i++) {
            if (lines[i].trim() !== '0' || lines[i + 1].trim() !== 'BLOCK') continue;
            // Found BLOCK marker. Find name (group 2) + ENDBLK.
            let name = null, end = -1;
            for (let j = i + 2; j < n - 1; j++) {
                const c = lines[j].trim();
                const v = lines[j + 1].trim();
                if (c === '2' && !name) name = v.toUpperCase();
                if (c === '0' && v === 'ENDBLK') {
                    // Include ENDBLK + trailing layer code (4 lines: "0","ENDBLK","8","<layer>")
                    // Bug fix: was j+3 which excluded layer value when it equals '0' (default layer)
                    end = j + 4;
                    while (end < n && lines[end].trim() !== '0') end++;
                    break;
                }
            }
            if (name === target && end > 0) {
                return lines.slice(i, end).join('\n').trimEnd();
            }
            if (end > 0) i = end;
        }
        return null;
    }

    // Extract ATTDEF definitions từ raw block text.
    // Return array [{tag, defaultVal, x, y, height}]
    function _extractAttdefs(blockText) {
        const lines = blockText.split(/\r?\n/);
        const attdefs = [];
        for (let i = 0; i < lines.length - 1; i++) {
            if (lines[i].trim() !== '0' || lines[i + 1].trim() !== 'ATTDEF') continue;
            let tag = null, defaultVal = '', x = 0, y = 0, height = 2.5;
            for (let j = i + 2; j < lines.length - 1 && lines[j].trim() !== '0'; j += 2) {
                const c = lines[j].trim();
                const v = lines[j + 1];
                if (c === '2' && !tag) tag = v.trim();
                else if (c === '1' && !defaultVal) defaultVal = v;
                else if (c === '10') x = parseFloat(v);
                else if (c === '20') y = parseFloat(v);
                else if (c === '40') height = parseFloat(v);
            }
            if (tag) attdefs.push({ tag, defaultVal, x, y, height });
        }
        return attdefs;
    }

    // Expose namespace + backward-compat globals
    const ns = window.__LS = window.__LS || {};
    ns.dxfUtils = { _extractDxfBlock, _extractAttdefs };

    window._extractDxfBlock = _extractDxfBlock;
    window._extractAttdefs = _extractAttdefs;
})();
