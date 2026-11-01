// Khung tên mẫu A.K.T (Thay LED CT1) — hàm thuần @@AKTTITLE (src/core/cad-titleblock-akt.js)
// Số đo đối chiếu đọc từ "Thay_Led_CT1_khung_ten_danh_muc…dxf" (tờ Nguyễn Khuyến). Run: node tests/titleblock-akt.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();
    const sym = src.match(/\/\/ @@CADSYMLIB_START([\s\S]*?)\/\/ @@CADSYMLIB_END/);
    const q = src.match(/\/\/ @@QBTTITLE_START([\s\S]*?)\/\/ @@QBTTITLE_END/);
    const a = src.match(/\/\/ @@AKTTITLE_START([\s\S]*?)\/\/ @@AKTTITLE_END/);
    if (!a) throw new Error('Chưa có block @@AKTTITLE_START/END');
    return new Function((sym ? sym[1] : '') + q[1] + a[1] + '\nreturn { AKT_FORM, AKT_DEFAULTS, AKT_LOGO_PRIMS, AKT_AK_PRIMS, _qbtTextW, _qbtFitFrame, _qbtLegendClear, _qbtLegendSize, _aktDrawTitleBlock, _aktDrawHeader, _aktLegendItems, _aktLegendSize, _aktDrawLegend };')();
}
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }

function parse(arr) {
    const ents = []; let cur = null;
    for (let i = 0; i + 1 < arr.length; i += 2) {
        const c = String(arr[i]), v = String(arr[i + 1]);
        if (c === '0') { cur = { type: v, g: {} }; ents.push(cur); continue; }
        if (cur) (cur.g[c] = cur.g[c] || []).push(v);
    }
    return ents;
}
const num = (e, c) => parseFloat(e.g[c][0]);
const near = (a, b, t) => Math.abs(a - b) <= (t || 0.05);
const draw = fn => { const a = []; const push = (...x) => { for (const v of x) a.push(String(v)); }; const r = fn(push); return { ents: parse(a), r }; };
const esc = s => s;
const lines = es => es.filter(e => e.type === 'LINE').map(e => [num(e, '10'), num(e, '20'), num(e, '11'), num(e, '21')]);
const texts = es => es.filter(e => e.type === 'TEXT').map(e => ({ x: num(e, '10'), y: num(e, '20'), h: num(e, '40'), s: e.g['1'][0], center: !!e.g['72'], wf: e.g['41'] ? num(e, '41') : 1 }));
const hasH = (L, y, x1, x2) => L.some(l => near(l[1], y) && near(l[3], y) && near(Math.min(l[0], l[2]), x1) && near(Math.max(l[0], l[2]), x2));
const hasV = (L, x, y1, y2) => L.some(l => near(l[0], x) && near(l[2], x) && near(Math.min(l[1], l[3]), y1) && near(Math.max(l[1], l[3]), y2));
const T = (X, s) => X.find(t => t.s === s);

const MD = { AKT_TEN_BV: 'BẢN VẼ MẶT BẰNG ĐƯỜNG NGUYỄN KHUYẾN\nĐOẠN TỪ ĐƯỜNG TÂN HIỆP 17 ĐẾN ĐƯỜNG ĐT 746\nPHƯỜNG TÂN HIỆP', AKT_NAM: '2026', AKT_KY_HIEU: 'CS1-04-02', AKT_TONG_SO: '02' };

// ═══ 1. Khổ giấy ═══
const F = H.AKT_FORM;
ok('khung trong 397,93 × 281,36; khung tên cao 41,83', near(F.W, 397.93, 1e-9) && near(F.innerH, 281.36, 1e-9) && near(F.H, 41.83, 1e-9));
ok('lề giấy A3: trái 16,61 · phải 5,46 · trên 6,93 · dưới 8,71 → đủ 420 × 297',
    near(F.paperMargin[0] + F.W + F.paperMargin[1], 420, 0.01) && near(F.paperMargin[2] + F.innerH + F.paperMargin[3], 297, 0.01), F.paperMargin);

// ═══ 2. Đường kẻ khung tên (tỉ lệ mẫu) ═══
const T1 = draw(p => H._aktDrawTitleBlock(p, esc, MD, 0, 0, 397.93, 1, 1, 1, '1/1000'));
const L1 = lines(T1.ents);
ok('trả về cao 41,83', near(T1.r.h, 41.83));
ok('khung ngoài khung tên', hasH(L1, 0, 0, 397.93) && hasH(L1, 41.83, 0, 397.93) && hasV(L1, 0, 0, 41.83) && hasV(L1, 397.93, 0, 41.83));
ok('6 ranh cột suốt chiều cao 82,18 · 143,69 · 176,9 · 203,5 · 231,41 · 255,84', [82.18, 143.69, 176.9, 203.5, 231.41, 255.84].every(x => hasV(L1, x, 0, 41.83)));
ok('ô Đơn vị TK: ngăn tiêu đề y=34,69', hasH(L1, 34.69, 82.18, 143.69));
ok('bảng ký: 3 ngăn 30,83 · 20,55 · 10,28', [30.83, 20.55, 10.28].every(y => hasH(L1, y, 176.9, 255.84)));
ok('phần phải: ngăn Tên bản vẽ y=27', hasH(L1, 27, 255.84, 397.93));
ok('phần phải dưới: ranh 288,81 · 371,29 (0 → 27)', hasV(L1, 288.81, 0, 27) && hasV(L1, 371.29, 0, 27));
ok('ô ký hiệu: ngăn y=9 · 18', hasH(L1, 9, 371.29, 397.93) && hasH(L1, 18, 371.29, 397.93));
ok('không có ranh dọc thừa (2 biên + 6 cột suốt + 2 cột dưới)', new Set(L1.filter(l => near(l[0], l[2]) && Math.abs(l[1] - l[3]) > 20).map(l => l[0].toFixed(2))).size === 10);

// ═══ 3. Chữ: cỡ + vị trí ═══
const X1 = texts(T1.ents);
const ct = T(X1, 'CÔNG TRÌNH :');
ok('"CÔNG TRÌNH :" cao 2, tâm 41,09, chân 36,84', ct && near(ct.h, 2) && near(ct.x, 41.09) && near(ct.y, 36.84) && ct.center, ct);
const body = X1.filter(t => t.center && near(t.x, 41.09) && t.y < 34);
ok('tên công trình: đủ chữ, mỗi dòng ≤ 80, cách 1 dòng trống dưới nhãn', body.length >= 3 && body.every(t => H._qbtTextW(t.s, t.h) <= 82.18 - 1.2 + 1e-6)
    && body.map(t => t.s).join(' ') === H.AKT_DEFAULTS.AKT_CONG_TRINH && near(body[0].y, 36.84 - 2 * 2 * 5 / 3), body.map(t => t.s));
const dv = T(X1, 'ĐƠN VỊ THIẾT KẾ');
ok('"ĐƠN VỊ THIẾT KẾ" cao 2,6, giữa (110,82; 37,91)', dv && near(dv.h, 2.6) && near(dv.x, 110.82) && near(dv.y + dv.h / 2, 37.91));
const cty = T(X1, 'CÔNG TY TNHH TƯ VẤN XÂY DỰNG');
ok('tên đơn vị: cao 2,488 (giữ cỡ, ép ngang ≤ 0,75 cho rộng bằng bản gốc 45,14), tâm 119,75, chân 28,55', cty && near(cty.h, 2.488) && cty.wf <= 0.75 && cty.wf >= 0.6
    && H._qbtTextW(cty.s, cty.h) * cty.wf <= 45.14 + 0.01 && near(cty.x, 119.75) && near(cty.y, 28.55), cty);
const ad = X1.filter(t => near(t.x, 112.64) && t.y < 15);
ok('trụ sở / ĐT / Email: 4 dòng cao 2,132 ép 0,8, giữa khối tại y 8,67', ad.length === 4 && ad.every(t => near(t.h, 2.132) && near(t.wf, 0.8))
    && near((ad[0].y + 2.132 + ad[3].y) / 2, 8.67, 0.06), ad.map(t => [t.s, t.y]));
ok('logo "A.K.T design" cao 1,264', X1.some(t => t.s === 'A.K.T design' && near(t.h, 1.264)));
const pgd = T(X1, 'PHÓ GIÁM ĐỐC'), pgn = T(X1, 'NGUYỄN HUY HÙNG');
ok('"PHÓ GIÁM ĐỐC" + tên ở đáy, tâm 160,3', pgd && pgn && near(pgd.x, 160.3) && near(pgn.x, 160.3) && near(pgd.y, 36.17) && near(pgn.y, 3.61));
ok('bảng ký: CHỨC DANH / HỌ VÀ TÊN / CHỮ KÝ cao 2', ['CHỨC DANH', 'HỌ VÀ TÊN', 'CHỮ KÝ'].every(s => T(X1, s) && near(T(X1, s).h, 2)));
ok('bảng ký: 3 chức danh tâm 190,2', ['CHỦ TRÌ THIẾT KẾ', 'THIẾT KẾ', 'KIỂM'].every(s => T(X1, s) && near(T(X1, s).x, 190.2)));
const kim = X1.filter(t => t.s === 'KS.Nguyễn Ngọc Kim'), minh = T(X1, 'KS.Trần Doãn Minh');
ok('bảng ký: tên trái 204,3 cao 2 (ép ngang nếu dài), đúng hàng (Kim ×2, Minh)', kim.length === 2 && minh && [...kim, minh].every(t => near(t.x, 204.3) && !t.center && near(t.h, 2) && H._qbtTextW(t.s, t.h) * t.wf <= 231.41 - 204.3 - 0.1)
    && near(minh.y, 15.44) && kim.some(t => near(t.y, 25.71)) && kim.some(t => near(t.y, 5.16)));
const lab = T(X1, '%%uTên bản vẽ:');
ok('nhãn "Tên bản vẽ:" gạch chân, cao 2,5 ép 0,8, trái 261,83', lab && near(lab.h, 2.5) && near(lab.wf, 0.8) && near(lab.x, 261.83) && !lab.center);
const tbv = X1.filter(t => t.center && near(t.x, 328.15));
ok('tên bản vẽ: 3 dòng tâm 328,15 nằm trong ô (27 → 41,83)', tbv.length === 3 && tbv.every(t => t.y > 27 && t.y + t.h < 41.83), tbv.map(t => [t.s, t.y]));
ok('giai đoạn: "Giai đoạn thực hiện :" / Báo cáo / Kinh Tế - Kỹ Thuật / Tỷ lệ : 1/1000',
    ['Giai đoạn thực hiện :', 'Báo cáo', 'Kinh Tế - Kỹ Thuật', 'Tỷ lệ : 1/1000'].every(s => T(X1, s) && near(T(X1, s).x, 272.33, 0.3)));
ok('địa điểm: nhãn + nội dung trong ô 288,81–371,29', T(X1, 'ĐỊA ĐIỂM XÂY DỰNG :') && X1.filter(t => t.center && near(t.x, 330.05, 0.3) && t.y < 22).length >= 2);
ok('ký hiệu / tổng số / năm', T(X1, 'Ký hiệu bản vẽ :') && T(X1, 'CS1-04-02') && T(X1, 'Tổng số bản vẽ : 02') && T(X1, 'Năm thực hiện : 2026'));
ok('mọi chữ nằm trong khung tên (0–41,83 × 0–397,93)', X1.every(t => t.y >= 0 && t.y + t.h <= 41.83 + 0.01));
ok('không chữ nào tràn ô (chữ căn giữa ≤ bề rộng ô của nó)', X1.filter(t => t.center).every(t => {
    const C = [0, 82.18, 143.69, 176.9, 203.5, 231.41, 255.84, 288.81, 371.29, 397.93];
    const w = H._qbtTextW(t.s, t.h) * t.wf;
    return t.x - w / 2 >= -0.01 && t.x + w / 2 <= 397.93 + 0.01;
}));

// ═══ 4. Logo ═══
const solids = T1.ents.filter(e => e.type === 'SOLID');
ok('logo A.K.T + ô AK vẽ bằng SOLID (tô đặc)', solids.length === H.AKT_LOGO_PRIMS.filter(p => p[0] === 'S').length + H.AKT_AK_PRIMS.filter(p => p[0] === 'S').length && solids.length > 100, solids.length);
const lx = solids.map(e => num(e, '10')), ly = solids.map(e => num(e, '20'));
ok('logo nằm trong ô Đơn vị TK (82,18–143,69 × 0–34,69)', lx.every(v => v > 82.18 && v < 143.69) && ly.every(v => v > 0 && v < 34.69));

// ═══ 5. Tự điền ═══
const md2 = { AKT_KY_HIEU: 'CS1-04-XX', AKT_TONG_SO: '', AKT_NAM: '' };
const X2 = texts(draw(p => H._aktDrawTitleBlock(p, esc, md2, 0, 0, 397.93, 1, 3, 5, '1/2000')).ents);
ok('chia tờ: XX → số tờ (03), Tổng số = 05', T(X2, 'CS1-04-03') && T(X2, 'Tổng số bản vẽ : 05'));
ok('năm trống → năm hiện tại', T(X2, 'Năm thực hiện : ' + new Date().getFullYear()));
ok('tỷ lệ trống → tỷ lệ truyền vào', T(X2, 'Tỷ lệ : 1/2000'));
const X3 = texts(draw(p => H._aktDrawTitleBlock(p, esc, { AKT_KY_HIEU: 'CS1-04', AKT_TY_LE: 'Tỷ lệ : 1/500' }, 0, 0, 397.93, 1, 2, 3, '1/2000')).ents);
ok('ký hiệu không có XX + chia tờ → thêm "(2/3)"', T(X3, 'CS1-04 (2/3)'));
ok('tỷ lệ gõ tay giữ nguyên (bỏ chữ "Tỷ lệ" lặp)', T(X3, 'Tỷ lệ : 1/500'));
const X4 = texts(draw(p => H._aktDrawTitleBlock(p, esc, {}, 0, 0, 397.93, 1, 1, 1, '1/1000')).ents);
ok('form trống → nội dung mặc định tờ mẫu', T(X4, 'NGUYỄN HUY HÙNG') && T(X4, 'KS.Trần Doãn Minh') && T(X4, 'Kinh Tế - Kỹ Thuật'));

// ═══ 6. Co giãn k ═══
const T5 = draw(p => H._aktDrawTitleBlock(p, esc, MD, 100, 200, 397.93 * 2, 2, 1, 1));
const L5 = lines(T5.ents);
ok('k = 2: kích thước nhân đôi, dời gốc', hasV(L5, 100 + 82.18 * 2, 200, 200 + 41.83 * 2) && hasH(L5, 200 + 34.69 * 2, 100 + 82.18 * 2, 100 + 143.69 * 2) && near(T5.r.h, 83.66));
ok('k = 2: chữ to gấp đôi', texts(T5.ents).some(t => t.s === 'CÔNG TRÌNH :' && near(t.h, 4)));

// ═══ 7. Tiêu đề đầu tờ ═══
const Hd = texts(draw(p => H._aktDrawHeader(p, esc, 0, 397.93, 281.36, {}, 1)).ents);
ok('tiêu đề "BẢN VẼ MẶT BẰNG BỐ TRÍ ĐÈN CHIẾU SÁNG" cao 4,5, tâm 198,29, đỉnh chữ cách đỉnh khung 3,66',
    Hd.length === 1 && Hd[0].s === 'BẢN VẼ MẶT BẰNG BỐ TRÍ ĐÈN CHIẾU SÁNG' && near(Hd[0].h, 4.5) && near(Hd[0].x, 198.29) && near(Hd[0].y + 4.5, 281.36 - 3.66), Hd);

// ═══ 8. Ô GHI CHÚ + số lượng ═══
const row = o => { const r = new Array(31).fill(''); for (const k in o) r[k] = String(o[k]); return r; };
const rows = [row({ 6: 1, 10: 'LED', 21: 2 }), row({ 6: 1, 10: 'LED' }), row({ 6: 3, 10: 'HPS' }), row({ 6: 5, 1: 'TU-1' })];
const cm = new Map([['noi_giu', 120.4]]);
const items = H._aktLegendItems(rows, cm, false);
ok('ghi chú: chỉ dòng có trong tờ (LED 3 bộ, HPS 1 bộ, STK 2, BTLT 1, tủ 1, cáp nổi 120 m)',
    JSON.stringify(items.map(i => [i.label, i.qty])) === JSON.stringify([[': Đèn LED', '3 bộ'], [': Đèn HPS', '1 bộ'], [': Trụ STK', '2 trụ'], [': Trụ BTLT', '1 trụ'], [': Tủ điều khiển thường', '1 tủ'], [': Cáp nguồn nổi', '120 m']]), items.map(i => [i.label, i.qty]));
ok('ghi chú: cỡ ô 3 dòng = 69,61 × 36,08 (mẫu 55,61 + cột SL 14)', near(H._aktLegendSize(1, 3).w, 69.61) && near(H._aktLegendSize(1, 3).h, 36.08));
const G = draw(p => H._aktDrawLegend(p, esc, 397.93, 41.83, 1, items, { cable: (pp, x1, y1, x2, y2) => pp('0', 'LINE', '8', 'C', '10', x1, '20', y1, '11', x2, '21', y2), pole: () => {}, cab: () => {} }));
const GX = texts(G.ents);
ok('ghi chú: "GHI CHÚ:" gạch chân cao 2,5 trái +2,01', GX.some(t => t.s === '%%uGHI CHÚ:' && near(t.h, 2.5) && near(t.x, 397.93 - 69.61 + 2.01)));
ok('ghi chú: cột SL có đủ số lượng', ['3 bộ', '1 bộ', '2 trụ', '1 trụ', '1 tủ', '120 m', 'SL'].every(s => GX.some(t => t.s === s && near(t.x, 397.93 - 7))));
ok('ghi chú: đáy chạm đỉnh khung tên, hộp trong khung', near(G.r.h, H._aktLegendSize(1, 6).h) && GX.every(t => t.y > 41.83 && t.y < 41.83 + G.r.h));
ok('ghi chú: dòng cách đều 10,18', (() => { const ys = GX.filter(t => t.s.startsWith(': ')).map(t => t.y); return ys.slice(1).every((y, i) => near(ys[i] - y, 10.18)); })());

{
    const E = draw(p => H._aktDrawLegend(p, esc, 397.93, 41.83, 1, [], {}));
    ok('ghi chú: tờ không có ký hiệu đếm được → không vẽ ô (cỡ 0)', E.ents.length === 0 && E.r.w === 0 && E.r.h === 0 && H._aktLegendSize(1, 0).h === 0);
}

// ═══ 9. Khung tự co giãn theo mẫu A.K.T ═══
const form = { W: F.W, innerH: F.innerH, H: F.H, headerH: F.headerH, legendSize: k => H._aktLegendSize(k, 3) };
const pts = Array.from({ length: 15 }, (_, i) => ({ x: 1000 + i * 30, y: 2000 + (i % 2) * 2 }));
const b = { minX: 995, maxX: 1425, minY: 1995, maxY: 2007 };
const fit = H._qbtFitFrame(Object.assign({}, b), pts, 1, 15, { form });
const iw = fit.bounds.maxX - fit.bounds.minX + 30, ih = fit.bounds.maxY - fit.bounds.minY + 30;
ok('tự co giãn: khung trong đúng tỉ lệ 397,93 : 281,36 và kk = rộng/397,93', near(iw / ih, F.W / F.innerH, 1e-6) && near(fit.kk, iw / F.W, 1e-9), { iw, ih, kk: fit.kk });
ok('tự co giãn: nội dung nằm trên khung tên + ô ghi chú', pts.every(p => p.y > fit.bounds.minY - 15 + F.H * fit.kk));

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
