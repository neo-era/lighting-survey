// Khung tên mẫu QBT 2026–2029 — hàm thuần giữa mốc @@QBTTITLE_START/END (src/core/cad-titleblock-qbt.js)
// Số đo đối chiếu đọc thẳng từ "Bản vẽ bố trí 2026-2029.QBT.dwg" (tờ BẠCH ĐẰNG-2-BT-15). Run: node tests/titleblock-qbt.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();
    const sym = src.match(/\/\/ @@CADSYMLIB_START([\s\S]*?)\/\/ @@CADSYMLIB_END/);
    const m = src.match(/\/\/ @@QBTTITLE_START([\s\S]*?)\/\/ @@QBTTITLE_END/);
    if (!m) throw new Error('Chưa có block @@QBTTITLE_START/END');
    return new Function((sym ? sym[1] : '') + m[1] + '\nreturn { QBT_FORM, _qbtTextW, _qbtFit, _qbtDrawTitleBlock, _qbtDrawHeader, _qbtLegendRows, _qbtLegendSize, _qbtDrawLegendTable, _qbtLegendClear, _qbtFitFrame, _csBlockBBox };')();
}
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }

// Gom mảng group-code → danh sách entity {type, g:{code:[values]}}
function parse(arr) {
    const ents = [];
    let cur = null;
    for (let i = 0; i + 1 < arr.length; i += 2) {
        const c = String(arr[i]), v = String(arr[i + 1]);
        if (c === '0') { cur = { type: v, g: {} }; ents.push(cur); continue; }
        if (cur) (cur.g[c] = cur.g[c] || []).push(v);
    }
    return ents;
}
const num = (e, c) => parseFloat(e.g[c][0]);
const near = (a, b, t) => Math.abs(a - b) <= (t || 0.02);
const draw = (fn) => { const a = []; const push = (...x) => { for (const v of x) a.push(String(v)); }; const r = fn(push); return { ents: parse(a), raw: a, r }; };
const esc = s => s;   // test giữ nguyên chữ
const lines = es => es.filter(e => e.type === 'LINE').map(e => [num(e, '10'), num(e, '20'), num(e, '11'), num(e, '21')]);
const texts = es => es.filter(e => e.type === 'TEXT').map(e => ({ x: num(e, '10'), y: num(e, '20'), h: num(e, '40'), s: e.g['1'][0], center: !!e.g['72'] }));
const hasH = (L, y, x1, x2) => L.some(l => near(l[1], y) && near(l[3], y) && near(Math.min(l[0], l[2]), x1) && near(Math.max(l[0], l[2]), x2));
const hasV = (L, x, y1, y2) => L.some(l => near(l[0], x) && near(l[2], x) && near(Math.min(l[1], l[3]), y1) && near(Math.max(l[1], l[3]), y2));
const findT = (T, s) => T.find(t => t.s === s);

const MD = {
    TT_QLGT_NAME: 'TT QUẢN LÝ HẠ TẦNG\nKỸ THUẬT TP.HCM', CTCP_NAME: 'CÔNG TY CỔ PHẦN\nCHIẾU SÁNG CÔNG CỘNG TP.HCM',
    CV_PHU_TRACH: 'CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN', NV_TT_QLGT: 'LÊ TIẾN DŨNG',
    CS_KHU_VUC: 'CHIẾU SÁNG KHU VỰC TRUNG TÂM', NV_CTCP: 'MẠCH NGỌC HUY', NGUOI_LAP: 'LÊ HỒNG PHÚC',
    TEN_BAN_VE: 'BẠCH ĐẰNG-2-BT-15', DIA_CHI: 'BẠCH ĐẰNG', SHBV_PATTERN: '', NGAY: '26/10/2026',
};

// ═══ 1. Khung tên ở tỉ lệ mẫu (1:1000, rộng 384,65) — đường kẻ đúng toạ độ bản gốc ═══
const T1 = draw(p => H._qbtDrawTitleBlock(p, esc, MD, 0, 0, 384.65, 1, 1));
const L1 = lines(T1.ents);
ok('trả về cao 52,9', near(T1.r.h, 52.9));
ok('khung dưới + trên hết bề rộng', hasH(L1, 0, 0, 384.65) && hasH(L1, 52.9, 0, 384.65));
ok('ngăn tầng y=31,11 hết bề rộng', hasH(L1, 31.11, 0, 384.65));
ok('ranh cột 75,83 suốt chiều cao', hasV(L1, 75.83, 0, 52.9));
ok('ranh cột 227,5 suốt chiều cao', hasV(L1, 227.5, 0, 52.9));
ok('ranh cột 349,85 suốt chiều cao', hasV(L1, 349.85, 0, 52.9));
ok('ranh 151,13 chỉ tầng dưới (0→31,11)', hasV(L1, 151.13, 0, 31.11) && !L1.some(l => near(l[0], 151.13) && Math.max(l[1], l[3]) > 31.2));
ok('ô SHBV chia y=41,71 và 16,97', hasH(L1, 41.71, 349.85, 384.65) && hasH(L1, 16.97, 349.85, 384.65));
ok('không có ranh cột nào khác trong khung (đúng 5 cột dọc + 2 biên)',
    new Set(L1.filter(l => near(l[0], l[2]) && Math.abs(l[1] - l[3]) > 10).map(l => l[0].toFixed(2))).size === 6);

// ═══ 2. Cỡ chữ + vị trí chữ đúng mẫu ═══
const X1 = texts(T1.ents);
const tt1 = findT(X1, 'TT QUẢN LÝ HẠ TẦNG'), tt2 = findT(X1, 'KỸ THUẬT TP.HCM');
ok('TT QLHTKT: 2 dòng cao 4,24', tt1 && tt2 && near(tt1.h, 4.24) && near(tt2.h, 4.24), [tt1, tt2]);
ok('TT QLHTKT: chân dòng 43,62 / 36,55 (giãn 7,07)', tt1 && near(tt1.y, 43.62, 0.03) && near(tt2.y, 36.55, 0.03), [tt1 && tt1.y, tt2 && tt2.y]);
ok('TT QLHTKT: giữa ô (x=37,9) căn giữa', tt1 && near(tt1.x, 37.915) && tt1.center);
const ct1 = findT(X1, 'CÔNG TY CỔ PHẦN'), ct2 = findT(X1, 'CHIẾU SÁNG CÔNG CỘNG TP.HCM');
ok('CTCP: 2 dòng cao 4,24 tại x=159,49', ct1 && ct2 && near(ct1.h, 4.24) && near(ct2.h, 4.24) && near(ct1.x, 159.49), [ct1, ct2]);
ok('CTCP: chữ không đè logo (mép trái > 98,3)', ct2 && ct2.x - H._qbtTextW(ct2.s, ct2.h) / 2 > 98.3);
const titleT = X1.filter(t => t.center && near(t.x, 285.26));
ok('tên bản vẽ cao 4,25 (3,54 × 1,2), tâm x=285,26', titleT.length >= 1 && titleT.every(t => near(t.h, 4.25)), titleT);
ok('tên bản vẽ ngắt 2 dòng theo bề rộng MText 109,6', titleT.length === 2 && titleT.every(t => H._qbtTextW(t.s, t.h) <= 109.6 + 0.01), titleT.map(t => t.s));
ok('tên bản vẽ đủ chữ', titleT.map(t => t.s).join(' ') === 'BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ');
ok('tên bản vẽ nằm trong ô trên (31,11–52,9)', titleT.every(t => t.y > 31.11 + 1 && t.y + t.h < 52.9 - 0.5), titleT.map(t => t.y));
ok('logo: vòng tròn ngoài r=9,158 tâm (89,136;42,036)', T1.ents.some(e => e.type === 'CIRCLE' && near(num(e, '40'), 9.158) && near(num(e, '10'), 89.136) && near(num(e, '20'), 42.036)));
ok('logo: chữ TP. HO CHI MINH chạy theo cung (có góc xoay)', X1.filter(t => t.h < 1.3).length === 11 && T1.ents.some(e => e.type === 'TEXT' && e.g['50']));
const lab = s => findT(X1, s);
ok('nhãn tầng dưới cao 2,83, chân 25,39',
    ['CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN', 'CHIẾU SÁNG KHU VỰC TRUNG TÂM', 'NGƯỜI LẬP'].every(s => lab(s) && near(lab(s).h, 2.83) && near(lab(s).y, 25.39)));
ok('nhãn giữa ô: 37,9 / 113,48 / 189,3', near(lab('CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN').x, 37.915) && near(lab('CHIẾU SÁNG KHU VỰC TRUNG TÂM').x, 113.48) && near(lab('NGƯỜI LẬP').x, 189.315));
ok('tên người ký cao 2,83, chân 2,0, đúng ô',
    near(lab('LÊ TIẾN DŨNG').h, 2.83) && near(lab('LÊ TIẾN DŨNG').y, 2.0) && near(lab('MẠCH NGỌC HUY').x, 113.48) && near(lab('LÊ HỒNG PHÚC').x, 189.315));
ok('ô BẢN VẼ: "BẢN VẼ" 3,54 chân 25,06', lab('BẢN VẼ') && near(lab('BẢN VẼ').h, 3.54) && near(lab('BẢN VẼ').y, 25.06) && near(lab('BẢN VẼ').x, 288.675));
ok('ô BẢN VẼ: tên tủ 3,54 chân 18,86', lab('BẠCH ĐẰNG-2-BT-15') && near(lab('BẠCH ĐẰNG-2-BT-15').h, 3.54) && near(lab('BẠCH ĐẰNG-2-BT-15').y, 18.86));
ok('ô BẢN VẼ: tên đường 2,83 chân 6,49', lab('BẠCH ĐẰNG') && near(lab('BẠCH ĐẰNG').h, 2.83) && near(lab('BẠCH ĐẰNG').y, 6.49));
ok('SHBV: 4 nhãn cao 2,83 tại x=351,0, chân 45,43/35,19/21,9/7,31',
    [['SHBV:', 45.43], ['Số soát xét:', 35.19], ['Bản vẽ số:', 21.9], ['Ngày:', 7.31]].every(([s, y]) => lab(s) && near(lab(s).x, 351.0) && near(lab(s).y, y) && near(lab(s).h, 2.83)));
ok('Ngày: giá trị cùng dòng, trong ô', lab('26/10/2026') && near(lab('26/10/2026').y, 7.31) && lab('26/10/2026').x + H._qbtTextW('26/10/2026', 2.83) <= 384.65);
ok('mọi chữ căn giữa nằm trong khung tên', X1.filter(t => t.center).every(t => {
    const w = H._qbtTextW(t.s, t.h); return t.x - w / 2 >= 0 && t.x + w / 2 <= 384.65 && t.y >= 0 && t.y + t.h <= 52.9; }));
ok('chỉ entity R12 (LINE/ARC/CIRCLE/TEXT)', T1.ents.every(e => ['LINE', 'ARC', 'CIRCLE', 'TEXT'].includes(e.type)));

// ═══ 3. SHBV số tờ + giá trị dài ═══
const T2 = draw(p => H._qbtDrawTitleBlock(p, esc, { ...MD, SHBV_PATTERN: '22-TLBC-03-07-XX', BAN_VE_SO: '5', SO_SOAT_XET: '01' }, 0, 0, 384.65, 1, 3));
const X2 = texts(T2.ents);
const shbv = X2.find(t => /22-TLBC/.test(t.s));
ok('SHBV: XX → số tờ 03', shbv && shbv.s === '22-TLBC-03-07-03');
ok('SHBV dài → xuống dòng dưới nhãn, vẫn trong ô (41,71–52,9) và trong bề rộng',
    shbv && shbv.y >= 41.71 && shbv.y + shbv.h <= 52.9 && shbv.x + H._qbtTextW(shbv.s, shbv.h) <= 384.65 + 0.01, shbv);
const T2b = draw(p => H._qbtDrawTitleBlock(p, esc, { ...MD, BAN_VE_SO: '' }, 0, 0, 384.65, 1, 2, 3));
ok('chia 3 tờ, Bản vẽ số trống → "(tờ 02/03)"', texts(T2b.ents).some(t => t.s === '(tờ 02/03)'));
const T2c = draw(p => H._qbtDrawTitleBlock(p, esc, { ...MD, BAN_VE_SO: 'BV-XX' }, 0, 0, 384.65, 1, 2, 3));
ok('Bản vẽ số có XX → thay số tờ', texts(T2c.ents).some(t => t.s === 'BV-02'));
ok('Bản vẽ số + Số soát xét: giá trị ngắn cùng dòng nhãn', findT(X2, '5') && near(findT(X2, '5').y, 21.9) && findT(X2, '01') && near(findT(X2, '01').y, 35.19));

// ═══ 4. Tỉ lệ 1:500 (k=0,5) + khung rộng hơn mẫu ═══
const T3 = draw(p => H._qbtDrawTitleBlock(p, esc, MD, 100, 200, 250, 0.5, 1));
const L3 = lines(T3.ents), X3 = texts(T3.ents);
ok('k=0,5: cao 26,45', near(T3.r.h, 26.45));
ok('k=0,5: ngăn tầng tại 200 + 15,555', hasH(L3, 200 + 15.555, 100, 350));
ok('k=0,5 + rộng 250: cột co giãn theo tỉ lệ 250/192,325', hasV(L3, 100 + 75.83 * 0.5 * (250 / 192.325), 200, 226.45));
ok('k=0,5: chữ tên đơn vị cao 2,12', findT(X3, 'TT QUẢN LÝ HẠ TẦNG') && near(findT(X3, 'TT QUẢN LÝ HẠ TẦNG').h, 2.12));
ok('k=0,5: nhãn cao 1,415', findT(X3, 'NGƯỜI LẬP') && near(findT(X3, 'NGƯỜI LẬP').h, 1.415));

// ═══ 5. Tên dài → thu nhỏ cho vừa ô, không tràn ═══
const T4 = draw(p => H._qbtDrawTitleBlock(p, esc, { ...MD, NV_CTCP: 'NGUYỄN THỊ THANH HƯƠNG PHƯƠNG THẢO MAI ANH ĐOÀN NGỌC', TEN_BAN_VE: 'NGUYỄN HỮU CẢNH - TÔN ĐỨC THẮNG - 12-BT-99-KHU-VỰC' }, 0, 0, 384.65, 1, 1));
const X4 = texts(T4.ents);
const longN = X4.find(t => /THANH HƯƠNG/.test(t.s));
ok('tên người ký dài: thu nhỏ, vẫn trong ô 75,83–151,13', longN && longN.h < 2.83 && longN.x - H._qbtTextW(longN.s, longN.h) / 2 >= 75.83 && longN.x + H._qbtTextW(longN.s, longN.h) / 2 <= 151.13, longN);
const longT = X4.find(t => /TÔN ĐỨC THẮNG/.test(t.s));
ok('không mất chữ khi thu nhỏ', longN && /ĐOÀN NGỌC$/.test(longN.s));
ok('tên tủ dài: thu nhỏ trong ô 227,5–349,85', longT && longT.x + H._qbtTextW(longT.s, longT.h) / 2 <= 349.85, longT);

// ═══ 6. Tiêu đề đầu tờ ═══
const Hd = draw(p => H._qbtDrawHeader(p, esc, 0, 384.65, 281.84, { TEN_BAN_VE: 'BẠCH ĐẰNG-2-BT-15' }, 1));
const XH = texts(Hd.ents);
ok('đầu tờ dòng 1: tên bản vẽ cao 4,25, chân = đỉnh − 10,87, giữa khung',
    XH[0] && XH[0].s === 'BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ' && near(XH[0].h, 4.25) && near(XH[0].y, 281.84 - 10.87) && near(XH[0].x, 192.325), XH[0]);
ok('đầu tờ dòng 2: "TỦ ĐIỀU KHIỂN - BẠCH ĐẰNG-2-BT-15" cao 3,54, chân = đỉnh − 21,9',
    XH[1] && XH[1].s === 'TỦ ĐIỀU KHIỂN - BẠCH ĐẰNG-2-BT-15' && near(XH[1].h, 3.54) && near(XH[1].y, 281.84 - 21.9), XH[1]);
ok('đầu tờ không kẻ đường ngang', !Hd.ents.some(e => e.type === 'LINE'));
const Hd2 = draw(p => H._qbtDrawHeader(p, esc, 0, 384.65, 281.84, {}, 1));
ok('đầu tờ thiếu tên tủ → "TỦ ĐIỀU KHIỂN"', texts(Hd2.ents)[1].s === 'TỦ ĐIỀU KHIỂN');

// ═══ 7. Bảng ký hiệu: 13 dòng + số lượng ═══
const row = (o) => { const r = new Array(30).fill(''); for (const k in o) r[k] = o[k]; return r; };
const rows = [
    row({ 6: '1', 10: 'LED 100W', 21: '2' }), row({ 6: '1', 10: 'LED' }), row({ 6: '3', 10: 'HPS 150W' }),
    row({ 6: '4', 10: 'MH 250W' }), row({ 6: '2', 21: '3' }), row({ 6: '5', 1: 'Tủ KNTT 1' }), row({ 6: '6', 1: 'VTS', 4: 'không KNTT' }),
];
const cab = new Map([['noi', 1234.4], ['noi_moi', 100], ['ngam', 56.2], ['ngam_thu', 10]]);
const R = H._qbtLegendRows(rows, cab, true);
ok('13 dòng đúng thứ tự mẫu', R.length === 13 && R.map(r => r.label).join('|') ===
    'Đèn LED|Đèn HPS|Đèn MH|Đèn trang trí|Trụ STK|Trụ BTLT|Trụ treo cáp - TTC|Trụ trang trí|Điểm dừng lưới|Tủ điều khiển KNTT|Tủ điều khiển thường|Cáp nguồn nổi|Cáp nguồn ngầm');
ok('STT 1..13', R.every((r, i) => r.stt === i + 1));
ok('Đèn LED = tổng bóng (2+1) = 3 bộ', R[0].qty === '3 bộ', R[0].qty);
ok('Đèn HPS 1 bộ, MH 1 bộ', R[1].qty === '1 bộ' && R[2].qty === '1 bộ');
ok('Đèn trang trí = 3 bộ, Trụ trang trí = 1 trụ', R[3].qty === '3 bộ' && R[7].qty === '1 trụ');
ok('Trụ STK 2, BTLT (HTLT+TTLT) 2', R[4].qty === '2 trụ' && R[5].qty === '2 trụ');
ok('TTC / Điểm dừng lưới chưa có dữ liệu → –', R[6].qty === '–' && R[8].qty === '–');
ok('Tủ KNTT 1, tủ thường ("không KNTT") 1', R[9].qty === '1 tủ' && R[10].qty === '1 tủ');
ok('Cáp nổi = noi + noi_moi = 1.334 m', R[11].qty === '1.334 m', R[11].qty);
ok('Cáp ngầm = ngam + ngam_thu = 66 m', R[12].qty === '66 m', R[12].qty);
ok('ký hiệu = block thật của bản vẽ', R[0].sym.blk === 'DEN_LED' && R[4].sym.blk === 'TRU_STK' && R[5].sym.blk === 'TRU_BTLT' && R[9].sym.blk === 'TU_DK_KNTT' && R[10].sym.blk === 'TDK_HIENHUU' && R[6].sym.blk === 'TTC');
ok('dữ liệu rỗng → mọi số lượng "–"', H._qbtLegendRows([], new Map(), true).every(r => r.qty === '–'));
const R0 = H._qbtLegendRows(rows, cab, false);
ok('tắt block chuẩn → dòng đèn không ký hiệu, trụ/tủ ký hiệu cũ', R0[0].sym === null && R0[4].sym.pole && R0[9].sym.cab && R0[11].sym.cable === 'noi');

const sz = H._qbtLegendSize(1);
ok('bảng rộng 2 × (8,78+33,14+25,92+16) = 167,68; cao 10,51 + 7×9 = 73,51', near(sz.w, 167.68) && near(sz.h, 73.51), sz);
const calls = { cable: 0 };
const LT = draw(p => H._qbtDrawLegendTable(p, esc, 384.65, 52.9, 1, R, { cable: () => calls.cable++ }));
const LL = lines(LT.ents), LX = texts(LT.ents);
const x0 = 384.65 - 167.68;
ok('khung bảng: đáy chạm đỉnh khung tên (52,9), mép phải 384,65', hasH(LL, 52.9, x0, 384.65) && hasV(LL, 384.65, 52.9, 126.41));
ok('hàng tiêu đề cao 10,51', hasH(LL, 126.41 - 10.51, x0, 384.65));
ok('ranh giữa 2 nhóm suốt chiều cao', hasV(LL, x0 + 83.84, 52.9, 126.41));
ok('cột nhóm trái: 8,78 | 33,14 | 25,92 | 16', [8.78, 41.92, 67.84].every(d => LL.some(l => near(l[0], x0 + d) && near(l[2], x0 + d))));
ok('tiêu đề cột: Tên ký hiệu / Áp dụng / Số lượng × 2', ['Tên ký hiệu', 'Áp dụng', 'Số lượng'].every(s => LX.filter(t => t.s === s).length === 2));
ok('tên ký hiệu cao 2,0, STT cao 2,5', near(findT(LX, 'Đèn LED').h, 2.0) && near(findT(LX, '13').h, 2.5));
ok('dòng 8 nằm đầu nhóm phải', findT(LX, '8') && near(findT(LX, '8').x, x0 + 83.84 + 4.39) && near(findT(LX, '8').y, findT(LX, '1').y));
ok('số lượng ghi trong cột Số lượng', findT(LX, '3 bộ') && findT(LX, '3 bộ').x > x0 + 67.84 && findT(LX, '3 bộ').x < x0 + 83.84);
const ins = LT.ents.filter(e => e.type === 'INSERT');
ok('chèn block thật cho 10 ký hiệu, khai báo tên block', ins.length === 10 && LT.r.blocks.length === 10, LT.r.blocks);
ok('block nằm gọn trong ô Áp dụng', ins.every(e => {
    const s = num(e, '41'), bb = H._csBlockBBox(e.g['2'][0], s), x = num(e, '10'), y = num(e, '20');
    const inLeft = x + bb.x0 >= x0 + 41.92 - 0.01 && x + bb.x1 <= x0 + 67.84 + 0.01;
    const inRight = x + bb.x0 >= x0 + 83.84 + 41.92 - 0.01 && x + bb.x1 <= x0 + 83.84 + 67.84 + 0.01;
    return (inLeft || inRight) && y + bb.y0 >= 52.9 && y + bb.y1 <= 126.41; }));
ok('ký hiệu cáp nổi + ngầm vẽ qua hàm cáp', calls.cable === 2);
ok('Điểm dừng lưới vẽ hình chữ T (2 nét)', LL.some(l => near(l[1], l[3]) && near(Math.abs(l[2] - l[0]), 3.025 * 1.6)));

// ═══ 8. Đặt khung đúng tỉ lệ tờ mẫu ═══
{
    const R = 384.65 / 281.84;
    // nội dung nhỏ → khung = đúng A3 @1:1000 (kk = 1)
    const f1 = H._qbtFitFrame({ minX: 0, maxX: 100, minY: 0, maxY: 60 }, [{ x: 50, y: 30 }], 1, 15);
    const iw = b => b.maxX - b.minX + 30, ih = b => b.maxY - b.minY + 30;
    ok('nội dung nhỏ: khung trong 384,65 × 281,84 (kk = 1)', near(f1.kk, 1) && near(iw(f1.bounds), 384.65) && near(ih(f1.bounds), 281.84), f1);
    ok('nội dung nằm trong vùng trống (không đè khung tên/tiêu đề)', f1.bounds.minY <= 0 - 52.9 + 0.01 && f1.bounds.maxY >= 60 + 25 - 0.01);
    // tuyến dài 760 m → khung rộng ra, giữ đúng tỉ lệ, kk = bề rộng/384,65
    const f2 = H._qbtFitFrame({ minX: 0, maxX: 760, minY: 0, maxY: 120 }, [{ x: 0, y: 0 }, { x: 760, y: 120 }], 1, 15);
    ok('tuyến dài: tỉ lệ khung trong = 384,65/281,84', near(iw(f2.bounds) / ih(f2.bounds), R, 1e-6), iw(f2.bounds) / ih(f2.bounds));
    ok('tuyến dài: kk = rộng / 384,65 (> 1)', f2.kk > 1.9 && near(f2.kk, iw(f2.bounds) / 384.65, 1e-6), f2.kk);
    ok('tuyến dài: chứa hết nội dung', f2.bounds.minX <= 0 && f2.bounds.maxX >= 760);
    // trụ ở góc dưới phải → khung cao thêm để bảng ký hiệu nằm dưới trụ
    const pts = [{ x: 0, y: 100 }, { x: 300, y: 100 }, { x: 345, y: 0 }];
    const f3 = H._qbtFitFrame({ minX: 0, maxX: 350, minY: 0, maxY: 100 }, pts, 1, 15);
    const innerBot = f3.bounds.minY - 15, innerRight = f3.bounds.maxX + 15, lg = H._qbtLegendSize(f3.kk);
    const lgTop = innerBot + 52.9 * f3.kk + lg.h;
    ok('trụ góc dưới phải: bảng ký hiệu nằm dưới trụ (cách ≥ 8·kk, kể cả trụ lấn 12·kk)', pts.filter(p => p.x + 12 * f3.kk >= innerRight - lg.w).every(p => p.y >= lgTop + 8 * f3.kk - 1e-6), { lgTop, kk: f3.kk });
    ok('trụ góc dưới phải: vẫn giữ tỉ lệ tờ', near(iw(f3.bounds) / ih(f3.bounds), R, 1e-6));
    // A3 chuẩn: chọn phía + lượng hạ đáy
    const B = { minX: 0, maxX: 350, minY: 0, maxY: 100 };
    const c0 = H._qbtLegendClear([{ x: 0, y: 100 }], B, 1);
    ok('A3 chuẩn: góc trống → bảng bên phải (đúng mẫu), không hạ đáy', c0.side === 'right' && c0.E === 0, c0);
    const c1 = H._qbtLegendClear([{ x: 345, y: 0 }, { x: 0, y: 100 }], B, 1);
    ok('A3 chuẩn: góc phải vướng trụ, góc trái trống → dời bảng sang trái', c1.side === 'left' && c1.E === 0, c1);
    const c2 = H._qbtLegendClear([{ x: 345, y: 0 }, { x: 5, y: 10 }], B, 1);
    ok('A3 chuẩn: cả 2 góc vướng → chọn phía hạ ít hơn', c2.E > 0 && near(c2.E, Math.min(73.51 - 15 + 8 - 0, 73.51 - 15 + 8 - 10)) && c2.side === 'left', c2);
    const c3 = H._qbtLegendClear([{ x: 350 + 15 - 167.68 - 10, y: 0 }, { x: 0, y: 0 }], B, 1);
    ok('trụ sát mép trái bảng (nhãn lấn vào) cũng tính là vướng', c3.side === 'right' ? c3.E > 0 : true, c3);
}

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
