// Lighting Survey — tham chiếu Marker gốc (row[14]) theo ID hoặc tên (v187)
// Tên trụ có thể trùng (vd Bàu Bàng: 153 nhóm tên trùng là các trụ khác nhau thật) → tra theo tên
// lấy dòng đầu sẽ nối cáp nhầm trụ. Quy ước:
//   Đọc: row[14] khớp ID → đúng dòng đó; khớp tên duy nhất → dòng đó; tên trùng → dòng trùng tên GẦN trụ con nhất.
//   Ghi: tên trụ cha duy nhất → ghi tên (sheet dễ đọc); tên trùng → ghi ID.
// Globals: _rowIndex, _resolveParent, _parentRefFor, _parentNameOf, _isParentOf, _rowsWithSameName, _findStackedRows
(function () {
    'use strict';

    const _s = v => String(v == null ? '' : v).trim();
    const _pc = v => parseFloat(typeof v === 'string' ? v.replace(',', '.') : v);

    // rows: mảng dòng (không gồm header) hoặc nhiều mảng — bỏ phần tử không phải mảng
    function _rowIndex(...lists) {
        const byId = new Map(), byName = new Map();
        for (const list of lists) {
            if (!Array.isArray(list)) continue;
            for (const r of list) {
                if (!Array.isArray(r)) continue;
                const id = _s(r[0]), nm = _s(r[1]);
                if (id && !byId.has(id)) byId.set(id, r);
                if (nm) { const a = byName.get(nm); if (a) { if (!a.includes(r)) a.push(r); } else byName.set(nm, [r]); }
            }
        }
        return { byId, byName };
    }

    function _nearest(cands, child) {
        if (cands.length === 1) return cands[0];
        const la = _pc(child && child[2]), lo = _pc(child && child[3]);
        if (!isFinite(la) || !isFinite(lo)) return cands[0];
        let best = cands[0], bd = Infinity;
        const cosL = Math.cos(la * Math.PI / 180);
        for (const c of cands) {
            const cl = _pc(c[2]), co = _pc(c[3]);
            if (!isFinite(cl) || !isFinite(co)) continue;
            const d = (cl - la) ** 2 + ((co - lo) * cosL) ** 2;
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    }

    // Dòng trụ cha của child (hoặc null). ref: mặc định child[14]
    function _resolveParent(child, idx, ref) {
        const key = _s(ref !== undefined ? ref : child && child[14]);
        if (!key || !idx) return null;
        const byId = idx.byId.get(key);
        if (byId && byId !== child) return byId;
        if (child && key === _s(child[1])) return null;   // trỏ chính tên mình → tự tham chiếu (không nối sang trụ trùng tên)
        const cands = (idx.byName.get(key) || []).filter(r => r !== child);
        if (!cands.length) return null;
        return _nearest(cands, child);
    }

    // Giá trị ghi vào row[14] để trỏ tới parentRow
    function _parentRefFor(parentRow, idx) {
        if (!Array.isArray(parentRow)) return '';
        const nm = _s(parentRow[1]), id = _s(parentRow[0]);
        if (!nm) return id;
        const same = idx && idx.byName.get(nm);
        // Tên trùng → ID (nếu dòng chưa có ID — vừa thêm, chưa reload — đành ghi tên)
        if (same && same.length > 1 && id) return id;
        return nm;
    }

    // Tên hiển thị của Marker gốc (không lộ ID ra giao diện)
    function _parentNameOf(child, idx) {
        const p = _resolveParent(child, idx);
        return p ? _s(p[1]) || _s(p[0]) : _s(child && child[14]);
    }

    function _isParentOf(child, parentRow, idx) {
        return !!parentRow && _resolveParent(child, idx) === parentRow;
    }

    function _rowsWithSameName(row, idx) {
        const nm = _s(row && row[1]);
        return nm && idx ? (idx.byName.get(nm) || []) : [];
    }

    // Cặp dòng nằm chồng nhau (cách nhau < tolM mét) — dấu vết lỗi kéo trụ trùng tên cũ
    function _findStackedRows(rows, tolM) {
        const tol = tolM == null ? 0.5 : tolM;
        const cell = new Map(), out = [];
        const g = 1e-5;   // ~1.1 m — ô lưới đủ lớn so với tol mặc định
        for (const r of rows || []) {
            if (!Array.isArray(r)) continue;
            const la = _pc(r[2]), lo = _pc(r[3]);
            if (!isFinite(la) || !isFinite(lo)) continue;
            const cx = Math.floor(la / g), cy = Math.floor(lo / g);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                for (const o of cell.get((cx + dx) + ':' + (cy + dy)) || []) {
                    const d = haversineMeters(la, lo, o.la, o.lo);
                    if (d < tol) out.push({ a: o.r, b: r, dist: d });
                }
            }
            const k = cx + ':' + cy;
            (cell.get(k) || cell.set(k, []).get(k)).push({ r, la, lo });
        }
        return out;
    }

    function haversineMeters(la1, lo1, la2, lo2) {
        const t = Math.PI / 180, dLa = (la2 - la1) * t, dLo = (lo2 - lo1) * t;
        const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * t) * Math.cos(la2 * t) * Math.sin(dLo / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    Object.assign(window, { _rowIndex, _resolveParent, _parentRefFor, _parentNameOf, _isParentOf, _rowsWithSameName, _findStackedRows });
})();
