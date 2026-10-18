// Xuất TỔNG HỢP TUYẾN theo 2 mẫu Excel: "Tổng hợp tuyến khảo sát" (CT5) và "Dữ liệu WebDialux-CS" (v179).
// Classic script, nạp TRƯỚC khối <script> chính — lúc nạp chỉ khai báo hàm/hằng + gắn window; mọi tham chiếu sang
// hàm của script khác (_raLocalFrame, _raRoadLines, _raNearestOnLines, _raAxis, _raFetchRoads, _loadExcelJS,
// _saveBlob, convertLatLonToVn2000…) đều nằm trong thân hàm.
// Khung Excel: assets/templates/mau-tonghop-tuyen.xlsx, assets/templates/mau-webdialux.xlsx (dựng từ file mẫu của anh Lâm,
// giữ tiêu đề / ô gộp / màu / chú thích / danh sách chọn). Ô tô vàng = giá trị đoán từ OSM hoặc còn trống cần điền.

// @@ROUTESUM_START
const RS_YELLOW = 'FFFFF2CC';
const RS_MODES = { tu: 'Theo tủ', duong_tu: 'Đường + Tủ', ten: 'Tên tuyến' };

function _rsMost(values) {
    const m = new Map();
    for (const v of values) { const k = String(v == null ? '' : v).trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }
    let best = '', n = 0;
    m.forEach((c, k) => { if (c > n) { best = k; n = c; } });
    return best;
}
function _rsMedian(nums) {
    const a = nums.filter(v => isFinite(v)).sort((x, y) => x - y);
    if (!a.length) return null;
    return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}
const _rsNum = v => parseFloat(String(v == null ? '' : v).replace(',', '.'));
const _rsIsPole = r => { const t = parseInt(r[6]); return t >= 1 && t <= 4; };
const _rsIsCab = r => { const t = parseInt(r[6]); return t === 5 || t === 6; };
// Tên tuyến từ tên trụ, GIỮ dấu (normalizeMarkerBaseName bỏ dấu → chỉ dùng làm khoá gom)
const _rsRawBase = n => String(n || '').trim().replace(/\s*\([^()]*\)$/, '').replace(/[_\s\-]*\d+$/, '') || String(n || '').trim();
// Bỏ toạ độ 0,0 / ngoài Việt Nam (GPS lỗi) — 1 điểm sai làm lệch cả khung toạ độ tuyến
const _rsHasXY = r => { const la = parseCoord(r[2]), lo = parseCoord(r[3]); return isFinite(la) && isFinite(lo) && la > 5 && la < 25 && lo > 100 && lo < 112; };

// Khoá gom tuyến của 1 trụ
function _rsGroupKey(r, mode) {
    const tu = String(r[7] || '').trim();
    const bn = normalizeMarkerBaseName(String(r[1] || '').trim());
    const duong = String(r[17] || '').trim();
    if (mode === 'ten') return 'ten:' + bn;
    if (mode === 'duong_tu') return 'dt:' + (duong || '?') + '|' + (tu || ('ten:' + bn));
    return tu ? 'tu:' + tu : 'ten:' + bn;
}
// Gom trụ đèn thành tuyến. Trả { groups: [{key, poles}], skipped } — skipped = số trụ không toạ độ
function _rsGroup(rows, mode) {
    const map = new Map();
    let skipped = 0;
    for (const r of rows) {
        if (!_rsIsPole(r)) continue;
        if (!_rsHasXY(r)) { skipped++; continue; }
        const k = _rsGroupKey(r, mode);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
    }
    const groups = [...map].map(([key, poles]) => ({ key, poles }))
        .sort((a, b) => a.key.localeCompare(b.key, 'vi', { numeric: true }));
    return { groups, skipped };
}

// Loại trụ: HTLT/TTLT (ly tâm) / chữ "bê tông" → bê tông; STK / trang trí / kim loại / thép → kim loại
function _rsPoleMaterial(r) {
    const t = String(r[8] || '').toLowerCase();
    if (/bê tông|be tong|ly tâm|htlt|ttlt/.test(t)) return 'betong';
    if (/kim loại|kim loai|thép|thep|stk|sắt|trang trí/.test(t)) return 'kimloai';
    const ty = parseInt(r[6]);
    if (ty === 3 || ty === 4) return 'betong';
    if (ty === 1 || ty === 2) return 'kimloai';
    return '';
}
function _rsLampKind(r) {
    const t = String(r[10] || '').toUpperCase();
    if (/HPS|SON|NATRI|SODIUM|CAO ÁP|CAO AP/.test(t)) return 'hps';
    if (/LED/.test(t)) return 'led';
    return t.trim() ? 'other' : 'unknown';
}

// Thứ tự trụ dọc tuyến (chiếu lên trục chính) + đầu/cuối. Đầu = đầu gần tủ hơn (nếu có toạ độ tủ).
function _rsOrder(poles, frame, cabXY) {
    const P = poles.map(r => ({ r, ...frame.toXY(parseCoord(r[2]), parseCoord(r[3])) }));
    const cx = P.reduce((s, p) => s + p.x, 0) / P.length, cy = P.reduce((s, p) => s + p.y, 0) / P.length;
    let sxx = 0, syy = 0, sxy = 0;
    P.forEach(p => { const dx = p.x - cx, dy = p.y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    P.forEach(p => { p.t = (p.x - cx) * ux + (p.y - cy) * uy; });
    P.sort((a, b) => a.t - b.t);
    if (cabXY && P.length > 1) {
        const d0 = Math.hypot(P[0].x - cabXY.x, P[0].y - cabXY.y);
        const d1 = Math.hypot(P[P.length - 1].x - cabXY.x, P[P.length - 1].y - cabXY.y);
        if (d1 < d0) P.reverse();
    }
    return P;
}

// Chiều dài tuyến: tổng mét cáp nếu cáp phủ đủ (≥ n−1 đoạn trong tuyến), không thì khoảng cách 2 đầu theo trục tuyến
function _rsLength(ordered, allRows, tuName) {
    const inRoute = new Set(ordered.map(p => p.r));
    const idx = _rowIndex(allRows, ordered.map(p => p.r));
    let sum = 0, n = 0;
    for (const p of ordered) {
        const par = _resolveParent(p.r, idx), m = _rsNum(p.r[15]);
        if (par && (inRoute.has(par) || (tuName && String(par[1] || '').trim() === tuName)) && m > 0) { sum += m; n++; }
    }
    if (ordered.length > 1 && n >= ordered.length - 1) return { length: Math.round(sum), src: 'cap' };
    // Đo theo trục tuyến (không đi zig-zag qua lại 2 bên đường)
    if (ordered.length < 2) return { length: null, src: 'do' };
    const span = Math.abs(ordered[ordered.length - 1].t - ordered[0].t);
    return { length: span < 1 ? null : Math.round(span), src: 'do' };   // các trụ trùng 1 điểm → không đo được
}

const RS_HW_LOAI = {
    motorway: 'Đường cao tốc đô thị', trunk: 'Đường trục chính đô thị', primary: 'Đường trục chính đô thị',
    secondary: 'Đường chính khu vực', tertiary: 'Đường khu vực', unclassified: 'Đường phân khu vực',
    residential: 'Đường phân khu vực', living_street: 'Ngõ, hẻm', service: 'Ngõ, hẻm'
};

// So khớp tên đường bỏ hoa thường/dấu/chữ "đường" ở đầu ('Đường 13 tháng 3' = 'Đường 13 Tháng 3')
const _rsRoadNorm = n => normalizeTextSearchable(String(n || '').replace(/^\s*đường\s+/i, ''));
// Thông tin OSM của tuyến (đều là ĐOÁN — tô vàng): tên đường, bề rộng, số làn, dải phân cách, loại tuyến,
// cách bố trí trụ, tên đường cắt ngang ở 2 đầu. roads = osm.roads ([{coords:[[lon,lat]…], tags}]).
function _rsOsmInfo(ordered, roads, frame, extraSame) {
    const lines = _raRoadLines(roads, frame);
    if (!lines.length) return null;
    const tagsOfKey = new Map();
    (roads || []).forEach((r, i) => {
        if (!r || !r.tags || !_rlIsDrivable(r.tags)) return;
        const k = r.tags.name || ('way#' + i);
        if (!tagsOfKey.has(k)) tagsOfKey.set(k, r.tags);
    });
    const near = ordered.map(p => ({ p, n: _raNearestOnLines(p.x, p.y, lines, null) })).filter(o => o.n && o.n.dist <= 40);
    if (!near.length) return null;
    const key = _rsMost(near.map(o => o.n.key));
    const tags = tagsOfKey.get(key) || {};
    const onKey = ordered.map(p => ({ p, n: _raNearestOnLines(p.x, p.y, lines, key) })).filter(o => o.n && o.n.dist <= 40);
    const axes = onKey.map(o => ({ p: o.p, a: _raAxis(o.p.x, o.p.y, o.n, lines, key) }));
    const dualN = axes.filter(o => o.a.gap > 0).length;
    const dual = dualN > axes.length / 2;
    const gap = dual ? _rsMedian(axes.filter(o => o.a.gap > 0).map(o => o.a.gap)) : 0;
    const w1 = _rsMedian(lines.filter(l => l.key === key).map(l => l.width)) || null;
    const width = w1 == null ? null : +(dual ? 2 * w1 : w1).toFixed(1);
    let lanes = parseInt(tags.lanes);
    lanes = lanes >= 1 ? (dual ? 2 * lanes : lanes) : (width ? Math.max(1, Math.round(width / 3.5)) : null);
    const median = dual && gap ? Math.max(0, +(gap - w1).toFixed(1)) : null;   // bề rộng dải phân cách ≈ khoảng 2 tim − 1 chiều xe
    // Cách bố trí
    const s = axes.map(o => o.a.signed);
    let layout = '';
    if (s.length) {
        const mid = s.filter(v => Math.abs(v) <= 2).length, L = s.filter(v => v > 2).length, R = s.filter(v => v < -2).length;
        if (dual && mid >= s.length * 0.6) layout = 'giua';
        else if (Math.min(L, R) >= Math.max(1, s.length * 0.2)) {
            const tL = axes.filter(o => o.a.signed > 2).map(o => o.p.t), tR = axes.filter(o => o.a.signed < -2).map(o => o.p.t);
            const sp = ordered.length > 1 ? Math.abs(ordered[ordered.length - 1].t - ordered[0].t) / (ordered.length - 1) * 2 : 30;
            const paired = tL.filter(t => tR.some(u => Math.abs(u - t) <= sp * 0.3)).length;
            layout = paired >= tL.length * 0.6 ? 'doixung' : 'sole';
        } else layout = '1ben';
    }
    // Tên đường cắt ngang gần 2 đầu (≤ 30 m, khác đường chính, có tên)
    const sameRoad = (a, b) => _rsRoadNorm(a) === _rsRoadNorm(b);
    const crossAt = p => {
        let best = null;
        for (const l of lines) {
            if (l.key === key || String(l.key).startsWith('way#') || sameRoad(l.key, key) || (extraSame && sameRoad(l.key, extraSame))) continue;
            const n = _raNearestOnLines(p.x, p.y, [l], null);
            if (n && n.dist <= 30 && (!best || n.dist < best.dist)) best = { name: l.key, dist: n.dist };
        }
        return best ? best.name : '';
    };
    const hw = String(tags.highway || '').replace(/_link$/, '');
    return {
        roadName: String(key).startsWith('way#') ? '' : key,
        width, lanes, dual, median, layout,
        loaiTuyen: RS_HW_LOAI[hw] || '',
        crossStart: crossAt(ordered[0]), crossEnd: crossAt(ordered[ordered.length - 1])
    };
}

// Tổng hợp 1 tuyến. osmRoads = null → không điền phần OSM.
function _rsSummarize(group, allRows, osmRoads) {
    const poles = group.poles;
    const lat0 = poles.reduce((s, r) => s + parseCoord(r[2]), 0) / poles.length;
    const lon0 = poles.reduce((s, r) => s + parseCoord(r[3]), 0) / poles.length;
    const frame = _raLocalFrame(lat0, lon0);
    const tu = _rsMost(poles.map(r => r[7]));
    const cab = tu ? allRows.find(r => _rsIsCab(r) && _rsHasXY(r) &&
        (String(r[1] || '').trim() === tu || String(r[7] || '').trim() === tu)) : null;
    const cabXY = cab ? frame.toXY(parseCoord(cab[2]), parseCoord(cab[3])) : null;
    const ordered = _rsOrder(poles, frame, cabXY);
    const len = _rsLength(ordered, allRows, tu);
    let hps = 0, led = 0, other = 0;
    const perPole = [];
    const kindW = new Map();
    for (const r of poles) {
        const n = parseInt(r[21]) >= 1 ? parseInt(r[21]) : 1;
        perPole.push(n);
        const k = _rsLampKind(r);
        if (k === 'hps') hps += n; else if (k === 'led') led += n; else other += n;
        const lbl = k === 'hps' ? 'HPS' : k === 'led' ? 'LED' : (String(r[10] || '').trim() || 'Chưa rõ');
        const w = String(r[11] || '').trim().replace(/[Ww]$/, '');
        const kk = lbl + (w ? ' ' + w + 'W' : '');
        kindW.set(kk, (kindW.get(kk) || 0) + n);
    }
    const mats = poles.map(_rsPoleMaterial).filter(Boolean);
    const betong = mats.filter(m => m === 'betong').length, kimloai = mats.filter(m => m === 'kimloai').length;
    const end = p => {
        const lat = parseCoord(p.r[2]), lon = parseCoord(p.r[3]);
        const vn = convertLatLonToVn2000(lat, lon);
        return { name: String(p.r[1] || '').trim(), lat: +lat.toFixed(7), lon: +lon.toFixed(7), x: Math.round(vn.x), y: Math.round(vn.y) };
    };
    let osm = null;
    const duong = _rsMost(poles.map(r => r[17]));
    if (osmRoads) {
        // Chỉ đường có khung bao giao khung tuyến + ~150 m (truy vấn theo lô trả đường của cả 10 tuyến).
        // So KHUNG BAO, không so điểm: đường dài 2 đỉnh ở xa vẫn có thể chạy ngang qua tuyến.
        const la = poles.map(r => parseCoord(r[2])), lo = poles.map(r => parseCoord(r[3])), P = 0.0015;
        const a0 = Math.min(...la) - P, a1 = Math.max(...la) + P, o0 = Math.min(...lo) - P, o1 = Math.max(...lo) + P;
        const near = osmRoads.filter(r => {
            if (!r || !Array.isArray(r.coords) || !r.coords.length) return false;
            let ra0 = Infinity, ra1 = -Infinity, ro0 = Infinity, ro1 = -Infinity;
            for (const c of r.coords) { if (c[1] < ra0) ra0 = c[1]; if (c[1] > ra1) ra1 = c[1]; if (c[0] < ro0) ro0 = c[0]; if (c[0] > ro1) ro1 = c[0]; }
            return ra1 >= a0 && ra0 <= a1 && ro1 >= o0 && ro0 <= o1;
        });
        try { osm = _rsOsmInfo(ordered, near, frame, duong); } catch (e) { osm = null; }
    }
    return {
        key: group.key,
        tuyen: duong || (osm && osm.roadName) || _rsRawBase(poles[0][1]),
        tuyenFromOsm: !duong && !!(osm && osm.roadName),
        phuong: _rsMost(poles.map(r => r[18])),
        tu,
        nPoles: poles.length,
        start: end(ordered[0]), end: end(ordered[ordered.length - 1]),
        length: len.length, lengthSrc: len.src,
        spacing: len.length && poles.length > 1 ? +(len.length / (poles.length - 1)).toFixed(1) : null,
        hps, led, other, lamps: hps + led + other,
        lampText: [...kindW].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(' + '),
        lampsPerPole: perPole.length ? +_rsMost(perPole) : null,
        material: betong || kimloai ? (betong > kimloai ? 'betong' : 'kimloai') : '',
        height: _rsMedian(poles.map(r => _rsNum(r[27]))),
        osm
    };
}
// @@ROUTESUM_END

const RS_LAYOUT_CT5 = { '1ben': '1 bên', doixung: '2 bên', sole: '2 bên', giua: 'Giữa' };
const RS_LAYOUT_WDX = { '1ben': '1 bên', doixung: 'đối xứng', sole: 'so le', giua: 'giữa' };
const RS_TEMPLATES = {
    ct5: { file: 'assets/templates/mau-tonghop-tuyen.xlsx', label: 'Tổng hợp tuyến khảo sát (CT5)', out: 'Tong hop tuyen khao sat' },
    wdx: { file: 'assets/templates/mau-webdialux.xlsx', label: 'Dữ liệu WebDialux-CS', out: 'DATA_WEBDIALUX' }
};

// Ghi 1 dòng: copy kiểu dòng khuôn, ô trong `yellow` tô vàng
// Kiểu dòng khuôn chụp TRƯỚC khi ghi dòng nào: dòng khuôn cũng là dòng dữ liệu đầu — clone trực tiếp thì
// ô tô vàng của dòng đầu lan sang mọi dòng sau
function _rsSnapStyles(ws, styleRowNo, nCols) {
    const tpl = ws.getRow(styleRowNo), out = [];
    for (let c = 1; c <= nCols; c++) out[c] = JSON.stringify(tpl.getCell(c).style || {});
    return out;
}
function _rsPutRow(ws, rowNo, baseStyles, values, yellow, nCols) {
    const row = ws.getRow(rowNo);
    for (let c = 1; c <= nCols; c++) {
        const cell = row.getCell(c);
        cell.style = JSON.parse(baseStyles[c]);
        const v = values[c];
        cell.value = (v === '' || v === undefined) ? null : v;
        if (yellow.has(c)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RS_YELLOW } };
    }
    row.commit && row.commit();
}

function _rsFillCt5(wb, sums, opts) {
    const ws = wb.worksheets[0];
    if (opts.title) ws.getCell('A1').value = opts.title;
    const N = 24, base = _rsSnapStyles(ws, 4, N);
    sums.forEach((s, i) => {
        const o = s.osm || {};
        const v = {}, y = new Set();
        v[1] = i + 1; v[2] = s.tuyen; if (s.tuyenFromOsm) y.add(2);
        v[3] = s.phuong;
        v[4] = o.crossStart || s.start.name; if (o.crossStart) y.add(4);
        v[5] = o.crossEnd || s.end.name; if (o.crossEnd) y.add(5);
        v[6] = s.length; if (s.length == null) y.add(6);
        y.add(7); y.add(8);                                     // vỉa hè: app không có
        if (s.osm) { v[9] = o.dual ? 'Có' : 'Không'; v[10] = o.width; y.add(9); y.add(10); } else { y.add(9); y.add(10); }
        v[11] = s.height; if (s.height == null) y.add(11);
        v[12] = RS_LAYOUT_CT5[o.layout] || ''; y.add(12);
        v[13] = s.hps || null; v[14] = s.led || null;
        if (s.material === 'betong') v[15] = 'X'; else if (s.material === 'kimloai') v[16] = 'X'; else { y.add(15); y.add(16); }
        v[17] = s.start.lat; v[18] = s.start.lon; v[19] = s.end.lat; v[20] = s.end.lon;
        v[21] = s.start.x; v[22] = s.start.y; v[23] = s.end.x; v[24] = s.end.y;
        _rsPutRow(ws, 4 + i, base, v, y, N);
    });
    const last = 3 + sums.length, tot = last + 1;
    ws.mergeCells(`A${tot}:L${tot}`);
    ws.getCell(`A${tot}`).value = 'TỔNG CỘNG';
    ws.getCell(`M${tot}`).value = { formula: `SUM(M4:M${last})`, result: sums.reduce((a, s) => a + s.hps, 0) };
    ws.getCell(`N${tot}`).value = { formula: `SUM(N4:N${last})`, result: sums.reduce((a, s) => a + s.led, 0) };
    ['A', 'M', 'N'].forEach(c => {
        const cell = ws.getCell(`${c}${tot}`);
        cell.font = { bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    let r = tot + 2;
    const note = t => { ws.mergeCells(`A${r}:P${r}`); const c = ws.getCell(`A${r}`); c.value = t; c.alignment = { wrapText: true, vertical: 'top' }; r++; };
    note('GHI CHÚ (xuất tự động từ app Khảo sát chiếu sáng):');
    (opts.notes || []).forEach(t => note('• ' + t));
}

function _rsFillWdx(wb, sums) {
    const ws = wb.getWorksheet('DU LIEU TUYEN');
    const N = 38, base = _rsSnapStyles(ws, 2, N);
    sums.forEach((s, i) => {
        const o = s.osm || {};
        const v = {}, y = new Set();
        v[1] = i + 1; v[2] = s.tuyen; if (s.tuyenFromOsm) y.add(2);
        v[3] = s.phuong; v[5] = s.tu;
        v[6] = o.crossStart || s.start.name; if (o.crossStart) y.add(6);
        v[7] = o.crossEnd || s.end.name; if (o.crossEnd) y.add(7);
        v[8] = s.length; if (s.length == null) y.add(8);
        v[10] = s.lamps || null; v[11] = s.lampText;
        if (o.loaiTuyen) { v[15] = o.loaiTuyen; y.add(15); }
        v[18] = s.height; y.add(18);                            // bắt buộc — luôn rà
        if (s.osm) { v[21] = o.width; v[22] = o.lanes; v[27] = o.dual ? 'có' : 'không'; if (o.dual && o.median) v[28] = o.median; }
        [21, 22, 27, 28].forEach(c => y.add(c));
        v[23] = s.spacing; if (s.spacing == null) y.add(23);
        v[26] = RS_LAYOUT_WDX[o.layout] || ''; y.add(26);
        v[31] = s.lampsPerPole;
        _rsPutRow(ws, 2 + i, base, v, y, N);
    });
}

// ── Xuất ──
async function _rsLoadTemplate(id) {
    await _loadExcelJS();
    const res = await fetch(RS_TEMPLATES[id].file);
    if (!res.ok) throw new Error('Không tải được file khung ' + RS_TEMPLATES[id].file + ' (HTTP ' + res.status + ')');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    return wb;
}

// Câu truy vấn Overpass: đường xe chạy trong RS_AROUND m quanh từng tuyến (polyline qua các trụ đã sắp, tối đa
// RS_AROUND_PTS điểm/tuyến) — 1 request cho cả địa bàn, chỉ lấy dải hẹp quanh trụ nên nhẹ dù địa bàn rộng.
const RS_AROUND = 60, RS_AROUND_PTS = 40, RS_AROUND_GAP = 100;
function _rsAroundQuery(groups) {
    const parts = groups.map(g => {
        const lat0 = g.poles.reduce((s, r) => s + parseCoord(r[2]), 0) / g.poles.length;
        const lon0 = g.poles.reduce((s, r) => s + parseCoord(r[3]), 0) / g.poles.length;
        const ord = _rsOrder(g.poles, _raLocalFrame(lat0, lon0), null);
        const step = Math.max(1, Math.ceil(ord.length / RS_AROUND_PTS));
        const pick = ord.filter((p, i) => i % step === 0 || i === ord.length - 1);
        // Ngắt polyline khi 2 điểm liên tiếp cách > RS_AROUND_GAP m (tuyến theo tủ hay trải 2 dãy phố song song —
        // nối thẳng thì dải quét cắt chéo qua cả khối nhà, kéo về hàng trăm hẻm → Overpass quá tải)
        const runs = [[pick[0]]];
        for (let i = 1; i < pick.length; i++) {
            if (Math.hypot(pick[i].x - pick[i - 1].x, pick[i].y - pick[i - 1].y) > RS_AROUND_GAP) runs.push([]);
            runs[runs.length - 1].push(pick[i]);
        }
        return runs.map(run => {
            const pts = run.map(p => parseCoord(p.r[2]).toFixed(6) + ',' + parseCoord(p.r[3]).toFixed(6));
            if (pts.length === 1) pts.push(pts[0]);
            return `way["highway"](around:${RS_AROUND},${pts.join(',')});`;
        }).join('');
    });
    return `[out:json][timeout:60];(${parts.join('')});out geom;`;
}
// Tải đường OSM theo lô RS_OSM_BATCH tuyến / truy vấn (mỗi truy vấn nhẹ, máy chủ ít quá tải).
// Mỗi lô: cache IndexedDB 30 ngày theo nội dung truy vấn → xuất lại chỉ tải lô còn thiếu. Lô lỗi: thử lại ngay 1 lần,
// rồi thử thêm 1 lượt sau khi chạy hết các lô khác (Overpass công cộng hay quá tải từng đợt).
// Trả { roadsByKey: Map(group.key → roads), failed: số tuyến không có OSM }.
const RS_OSM_BATCH = 10, RS_OSM_TTL_MS = 30 * 864e5;
function _rsHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + '_' + str.length;
}
async function _rsFetchBatch(q) {
    const key = 'rsosm_' + _rsHash(q);
    try {
        const c = typeof _idbGet === 'function' ? await _idbGet(key) : null;
        if (c && Array.isArray(c.roads) && Date.now() - (c.at || 0) < RS_OSM_TTL_MS) return c.roads;
    } catch (e) { /* cache hỏng → tải mới */ }
    const json = await _overpassFetch(q, null, { timeoutMs: 45000 });
    const roads = [];
    (json.elements || []).forEach(el => {
        if (el.type !== 'way' || !el.geometry || !el.tags || !el.tags.highway) return;
        roads.push({ coords: el.geometry.map(g => [g.lon, g.lat]), tags: el.tags });
    });
    try { if (typeof _idbSet === 'function') await _idbSet(key, { roads, at: Date.now() }); } catch (e) { /* bỏ qua */ }
    return roads;
}
async function _rsFetchOsm(groups, onProgress) {
    const roadsByKey = new Map();
    const batches = [];
    for (let i = 0; i < groups.length; i += RS_OSM_BATCH) batches.push(groups.slice(i, i + RS_OSM_BATCH));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const run = async (batch, tries) => {
        for (let t = 0; t < tries; t++) {
            try { const roads = await _rsFetchBatch(_rsAroundQuery(batch)); batch.forEach(g => roadsByKey.set(g.key, roads)); return true; }
            catch (e) { console.warn('[RouteSummary] OSM lô lỗi:', e && e.message); if (t < tries - 1) await sleep(3000); }
        }
        return false;
    };
    const failedBatches = [];
    for (let b = 0; b < batches.length && !_rsCancel; b++) {
        onProgress && onProgress(b, batches.length);
        if (b) await sleep(1000);   // nghỉ giữa các lô — tránh 429 từ Overpass
        if (!(await run(batches[b], 2))) failedBatches.push(batches[b]);
    }
    for (let k = 0; k < failedBatches.length && !_rsCancel; k++) {   // lượt cuối cho các lô lỗi
        onProgress && onProgress(k, failedBatches.length, true);
        await sleep(3000);
        await run(failedBatches[k], 1);
    }
    return { roadsByKey, failed: groups.filter(g => !roadsByKey.has(g.key)).length };
}

function _rsSelectedRows() {
    const rows = (loadedData || []).slice(1);
    const sel = document.getElementById('rsTu');
    const tu = sel ? sel.value : '';
    return tu ? rows.filter(r => String(r[7] || '').trim() === tu) : rows;
}
function _rsCurrentMode() {
    const el = document.querySelector('input[name="rsMode"]:checked');
    return el ? el.value : 'tu';
}
function _rsUpdateInfo() {
    const info = document.getElementById('rsInfo');
    if (!info) return;
    const { groups, skipped } = _rsGroup(_rsSelectedRows(), _rsCurrentMode());
    const nP = groups.reduce((s, g) => s + g.poles.length, 0);
    info.textContent = groups.length ? `${groups.length} tuyến · ${nP} trụ` + (skipped ? ` · ${skipped} trụ không toạ độ (bỏ qua)` : '') : 'Không có trụ đèn nào để xuất';
    const tpl = (document.querySelector('input[name="rsTpl"]:checked') || {}).value;
    const tw = document.getElementById('rsTitleWrap');
    if (tw) tw.style.display = tpl === 'wdx' ? 'none' : '';
}
function _openRouteSummary() {
    if (!Array.isArray(loadedData) || loadedData.length < 2) { displayError && displayError('Địa bàn chưa có dữ liệu để xuất.'); return; }
    const m = document.getElementById('routeSummaryModal');
    if (!m) return;
    const sel = document.getElementById('rsTu');
    const tus = [...new Set((loadedData || []).slice(1).map(r => String(r[7] || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
    sel.innerHTML = '<option value="">Tất cả tủ</option>' + tus.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join('');
    const page = (typeof DISTRICT_PAGES !== 'undefined' ? DISTRICT_PAGES : []).find(p => p.sheet === currentSheet);
    const ti = document.getElementById('rsTitle');
    if (ti && !ti.value) ti.value = 'TỔNG HỢP TUYẾN KHẢO SÁT CHIẾU SÁNG – ' + (page ? page.label : currentSheet).toUpperCase();
    _rsUpdateInfo();
    m.style.display = 'flex';
    if (typeof closeControlsModal === 'function') closeControlsModal();
}
let _rsCancel = false;   // đóng modal khi đang tải OSM → dừng các lô còn lại, không xuất file
function _closeRouteSummary() { if (_rsBusy) _rsCancel = true; const m = document.getElementById('routeSummaryModal'); if (m) m.style.display = 'none'; }

let _rsBusy = false;
async function _exportRouteSummary() {
    if (_rsBusy) return;
    const tpl = (document.querySelector('input[name="rsTpl"]:checked') || {}).value || 'ct5';
    const mode = _rsCurrentMode();
    const useOsm = !!(document.getElementById('rsOsm') || {}).checked;
    // Chốt dữ liệu + địa bàn NGAY khi bấm — đổi địa bàn lúc đang tải OSM không làm lẫn dữ liệu
    const sheet = currentSheet;
    const all = (loadedData || []).slice(1);
    const rows = _rsSelectedRows();
    const { groups, skipped } = _rsGroup(rows, mode);
    if (!groups.length) { displayError && displayError('Không có trụ đèn nào (có toạ độ) để xuất.'); return; }
    const btn = document.getElementById('rsBtn');
    const orig = btn ? btn.textContent : '';
    const say = t => { if (btn) btn.textContent = t; };
    _rsBusy = true; _rsCancel = false; if (btn) btn.disabled = true;
    try {
        say('⏳ Tải khung Excel…');
        const wb = await _rsLoadTemplate(tpl);
        let osm = { roadsByKey: new Map(), failed: 0 };
        if (useOsm) osm = await _rsFetchOsm(groups, (i, n, again) => say(`⏳ ${again ? 'Thử lại' : 'Tải'} đường OSM ${n > 1 ? (i + 1) + '/' + n + ' ' : ''}…`));
        if (_rsCancel) { displayInfo && displayInfo('Đã huỷ xuất tổng hợp tuyến.'); return; }
        const sums = [];
        for (let i = 0; i < groups.length; i++) {
            if (i % 5 === 0) { say(`⏳ Tính tổng hợp ${i + 1}/${groups.length}…`); await new Promise(r => setTimeout(r, 0)); }
            sums.push(_rsSummarize(groups[i], all, osm.roadsByKey.get(groups[i].key) || null));
        }
        const notes = [
            `Gom tuyến: ${RS_MODES[mode]} · ${sums.length} tuyến · ${sums.reduce((a, s) => a + s.nPoles, 0)} trụ · địa bàn ${sheet}.`,
            'Ô TÔ VÀNG = giá trị đoán từ bản đồ OSM (bề rộng, dải phân cách, cách bố trí, lý trình…) hoặc app chưa có dữ liệu (vỉa hè, độ cao…) — rà lại trước khi dùng.',
            'Chiều dài tuyến = tổng mét cáp khi cáp đủ; thiếu cáp thì đo khoảng cách 2 đầu theo trục tuyến. Đèn HPS/LED = tổng số bóng theo loại đèn.'
        ];
        if (skipped) notes.push(`${skipped} trụ không có toạ độ — không tính vào bảng.`);
        if (useOsm && osm.failed) notes.push(`Không tải được bản đồ OSM cho ${osm.failed}/${sums.length} tuyến — các ô OSM của các tuyến đó để trống.`);
        if (tpl === 'ct5') _rsFillCt5(wb, sums, { title: (document.getElementById('rsTitle') || {}).value, notes });
        else _rsFillWdx(wb, sums);
        const buf = await wb.xlsx.writeBuffer();
        const name = `${RS_TEMPLATES[tpl].out} - ${sheet} (${_dateStamp()}).xlsx`;
        _saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
        displayInfo && displayInfo(`✅ Đã xuất ${sums.length} tuyến — ${RS_TEMPLATES[tpl].label}` + (useOsm && osm.failed ? ` · OSM lỗi ${osm.failed} tuyến (ô OSM để trống)` : ''));
        _closeRouteSummary();
    } catch (e) {
        console.error('[RouteSummary]', e);
        displayError && displayError('Lỗi xuất tổng hợp tuyến: ' + e.message);
    } finally {
        _rsBusy = false; _rsCancel = false; if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}
Object.assign(window, { _openRouteSummary, _closeRouteSummary, _exportRouteSummary, _rsUpdateInfo });
