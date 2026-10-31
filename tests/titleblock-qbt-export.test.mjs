// Xuất CAD mẫu khung tên QBT (templateId 'knop12'): khung tên + tiêu đề đầu tờ + bảng ký hiệu 13 dòng có số lượng,
// đúng kích thước theo tỉ lệ, không đè trụ/tủ, block khai báo đủ. Run: node tests/titleblock-qbt-export.test.mjs
// Ghi DXF mẫu ra thư mục tạm khi có biến môi trường QBT_DXF_OUT (dùng để soát bằng ezdxf/ảnh).
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };

const sb = loadAppSandbox();
ok('sandbox nạp app (có cad-titleblock-qbt.js) không lỗi', sb.errors.length === 0, sb.errors.slice(0, 3));

const row = (o) => { const r = new Array(30).fill(''); for (const k in o) r[k] = String(o[k]); return r; };
const data = [new Array(30).fill('h'), row({ 0: 'T1', 1: 'BẠCH ĐẰNG-2-BT-15', 2: 10.8530, 3: 106.6720, 6: 5, 7: 'BẠCH ĐẰNG-2-BT-15', 17: 'Bạch Đằng' })];
// tuyến 14 trụ chạy về phía Đông-Bắc, đi qua góc dưới phải (nơi đặt bảng ký hiệu)
for (let i = 1; i <= 14; i++) {
    data.push(row({ 0: 'P' + i, 1: 'BD_BD-4_' + i, 2: 10.8530 + i * 0.00012 * (i % 3 === 0 ? -1 : 1), 3: 106.6720 + i * 0.00030,
        6: i % 4 === 0 ? 3 : 1, 7: 'BẠCH ĐẰNG-2-BT-15', 10: i % 5 === 0 ? 'HPS 150W' : 'LED 100W', 21: i === 2 ? 2 : 1,
        14: i === 1 ? 'BẠCH ĐẰNG-2-BT-15' : 'BD_BD-4_' + (i - 1), 15: '30', 17: 'Bạch Đằng', 22: i > 10 ? 'ngam' : 'noi' }));
}
sb.ctx.__rows = data;
sb.run('loadedData = __rows;');
const MD = { NV_TT_QLGT: 'LÊ TIẾN DŨNG', NV_CTCP: 'MẠCH NGỌC HUY', NGUOI_LAP: 'LÊ HỒNG PHÚC', SHBV_PATTERN: '22-TLBC-03-07-XX' };
const opts = (extra) => Object.assign({ templateId: 'knop12', metadata: { ...MD }, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
    outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75, realBlocks: true }, extra || {});

function parse(dxf) {
    const L = dxf.split('\r\n'), P = [];
    for (let i = 0; i + 1 < L.length; i += 2) P.push([L[i].trim(), L[i + 1]]);
    const ents = [], blocks = new Map();
    let blk = null, sec = null;
    for (let i = 0; i < P.length; i++) {
        if (P[i][0] !== '0') continue;
        const e = { t: P[i][1], g: {} };
        for (let j = i + 1; j < P.length && P[j][0] !== '0'; j++) (e.g[P[j][0]] = e.g[P[j][0]] || []).push(P[j][1]);
        if (e.t === 'SECTION') { sec = e.g['2'][0]; continue; }
        if (e.t === 'BLOCK') { blk = e.g['2'][0]; blocks.set(blk, []); continue; }
        if (e.t === 'ENDBLK') { blk = null; continue; }
        e.blk = blk; e.sec = sec;
        if (blk) blocks.get(blk).push(e); else ents.push(e);
    }
    return { ents, blocks };
}
const n = (e, c) => parseFloat(e.g[c][0]);
const dec = s => String(s).replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const txt = e => dec(e.g['1'][0]);

// ── 1:1000, block thật ──
const dxf = await sb.ctx._generateCadDrawing(opts());
if (process.env.QBT_DXF_OUT) fs.writeFileSync(process.env.QBT_DXF_OUT + '/qbt-1000.dxf', dxf);
const { ents, blocks } = parse(dxf);
const top = ents.filter(e => e.sec === 'ENTITIES');
ok('có block TITLE_KNOP12 + INSERT', blocks.has('TITLE_KNOP12') && top.some(e => e.t === 'INSERT' && e.g['2'][0] === 'TITLE_KNOP12'));
const ttl = blocks.get('TITLE_KNOP12') || [];
const tbIns = top.find(e => e.t === 'INSERT' && e.g['2'][0] === 'TITLE_KNOP12');
const tLines = ttl.filter(e => e.t === 'LINE');
const tW = Math.max(...tLines.map(e => Math.max(n(e, '10'), n(e, '11'))));
const tH = Math.max(...tLines.map(e => Math.max(n(e, '20'), n(e, '21'))));
const kk = tW / 384.65;   // khung tự co giãn: cả tờ nhân cùng hệ số so với mẫu
ok('khung tên rộng ≥ 384,65 (= khung trong, kk ≥ 1)', kk >= 1 - 1e-6, tW);
ok('khung tên cao = 52,9 × kk (đúng tỉ lệ mẫu, không kéo dẹt)', Math.abs(tH - 52.9 * kk) < 0.01, { tH, kk });
const tTexts = ttl.filter(e => e.t === 'TEXT').map(e => ({ s: txt(e), h: n(e, '40') }));
const has = (s, h) => tTexts.some(t => t.s === s && (h === undefined || Math.abs(t.h - h * kk) < 0.01));
ok('chữ đúng mẫu: TT 4,24 / CTCP 4,24 / nhãn 2,83 / BẢN VẼ 3,54',
    has('TT QUẢN LÝ HẠ TẦNG', 4.24) && has('KỸ THUẬT TP.HCM', 4.24) && has('CÔNG TY CỔ PHẦN', 4.24) && has('NGƯỜI LẬP', 2.83) && has('BẢN VẼ', 3.54), tTexts.slice(0, 8));
ok('tên tủ tự lấy từ dữ liệu (1 tủ) vào ô BẢN VẼ', has('BẠCH ĐẰNG-2-BT-15', 3.54));
ok('tên đường tự lấy (đường nhiều nhất, in hoa)', has('BẠCH ĐẰNG', 2.83));
ok('người ký điền đúng', has('LÊ TIẾN DŨNG') && has('MẠCH NGỌC HUY') && has('LÊ HỒNG PHÚC'));
ok('SHBV tờ 01', tTexts.some(t => t.s === '22-TLBC-03-07-01'));

// Khung trong (4 LINE, layer 0) — lấy biên trái/phải/trên/dưới từ đường nằm ngang dài nhất
const tx = top.filter(e => e.t === 'TEXT');
const header = tx.filter(e => /^BẢN VẼ SƠ ĐỒ TUYẾN|^TỦ ĐIỀU KHIỂN/.test(txt(e)));
ok('tiêu đề đầu tờ: 2 dòng (4,25 / 3,54 × kk)', header.length === 2 && Math.abs(n(header[0], '40') - 4.25 * kk) < 0.01 && Math.abs(n(header[1], '40') - 3.54 * kk) < 0.01, header.map(e => [txt(e), n(e, '40')]));
ok('tiêu đề dòng 2 = "TỦ ĐIỀU KHIỂN - BẠCH ĐẰNG-2-BT-15"', header.some(e => txt(e) === 'TỦ ĐIỀU KHIỂN - BẠCH ĐẰNG-2-BT-15'));
const tbx = n(tbIns, '10'), tby = n(tbIns, '20');
const innerTop = Math.max(...top.filter(e => e.t === 'LINE' && Math.abs(n(e, '20') - n(e, '21')) < 1e-6 && Math.abs(n(e, '10') - n(e, '11')) > 300).map(e => n(e, '20')).filter(y => y < 1e12));
ok('tiêu đề đầu tờ nằm trong khung', header.every(e => n(e, '20') + n(e, '40') <= innerTop + 25));

// Bảng ký hiệu
const legendLabels = ['Đèn LED', 'Đèn HPS', 'Đèn MH', 'Đèn trang trí', 'Trụ STK', 'Trụ BTLT', 'Trụ treo cáp - TTC', 'Trụ trang trí', 'Điểm dừng lưới', 'Tủ điều khiển KNTT', 'Tủ điều khiển thường', 'Cáp nguồn nổi', 'Cáp nguồn ngầm'];
ok('bảng ký hiệu đủ 13 dòng', legendLabels.every(l => tx.some(e => txt(e) === l)));
const q = s => tx.some(e => txt(e) === s);
// 14 trụ: loại 3 ở i=4,8,12 (BTLT), còn lại STK=11; LED: i không chia hết 5 → 12 trụ, i=2 có 2 bóng → 13 bộ; HPS: i=5,10 → 2 bộ
ok('số lượng: LED 13 bộ, HPS 2 bộ, STK 11 trụ, BTLT 3 trụ, tủ thường 1', q('13 bộ') && q('2 bộ') && q('11 trụ') && q('3 trụ') && q('1 tủ'), tx.map(txt).filter(s => / (bộ|trụ|tủ|m)$/.test(s)));
ok('số lượng cáp nổi 10×30 = 300 m, ngầm 4×30 = 120 m', q('300 m') && q('120 m'));
const lgHead = tx.filter(e => txt(e) === 'Số lượng');
ok('cột Số lượng có tiêu đề ở 2 nhóm (trong khung)', lgHead.filter(e => n(e, '20') > tby).length === 2, lgHead.map(e => n(e, '20') - tby));
const lgIns = top.filter(e => e.t === 'INSERT' && ['DEN_LED', 'DEN_HPS', 'DEN_MH', 'TRU_STK', 'TRU_BTLT', 'TTC', 'TRU_TRANG_TRI', 'TU_DK_KNTT'].includes(e.g['2'][0]));
ok('cột Áp dụng chèn block thật (đèn/trụ/TTC/tủ KNTT)', lgIns.length >= 8, lgIns.map(e => e.g['2'][0]));
ok('mọi INSERT đều có BLOCK khai báo', top.concat([...blocks.values()].flat()).filter(e => e.t === 'INSERT').every(e => blocks.has(e.g['2'][0])),
    [...new Set(top.concat([...blocks.values()].flat()).filter(e => e.t === 'INSERT' && !blocks.has(e.g['2'][0])).map(e => e.g['2'][0]))]);
ok('bảng BẢNG KÝ HIỆU cũ không còn', !tx.some(e => txt(e) === 'BẢNG KÝ HIỆU'));

// Bảng không đè ký hiệu trụ/tủ: ô bảng = từ đỉnh khung tên lên 73,51, từ mép phải trái 167,68
const lgLeft = tbx + tW - 167.68 * kk, lgBot = tby + 52.9 * kk, lgTop = lgBot + 73.51 * kk;
const frameH = top.filter(e => e.t === 'LINE' && Math.abs(n(e, '10') - n(e, '11')) < 1e-6 && Math.abs(n(e, '10') - tbx) < 1e-3).map(e => Math.abs(n(e, '21') - n(e, '20')));
ok('khung trong đúng tỉ lệ tờ mẫu 384,65 : 281,84', frameH.some(h => Math.abs(tW / h - 384.65 / 281.84) < 1e-3), { tW, frameH });
const marks = top.filter(e => e.t === 'INSERT' && e.g['8'] && /^CS_/.test(e.g['8'][0]) && n(e, '20') > tby - 1);   // bỏ bảng CHÚ THÍCH ngoài khung
ok('có ký hiệu trụ/tủ trên bản vẽ', marks.length === 15, marks.length);
ok('không trụ/tủ nào nằm trong vùng bảng ký hiệu', marks.every(e => !(n(e, '10') >= lgLeft && n(e, '20') >= lgBot && n(e, '20') <= lgTop)),
    marks.filter(e => n(e, '10') >= lgLeft && n(e, '20') <= lgTop).map(e => [n(e, '10') - lgLeft, n(e, '20') - lgBot]));
ok('không trụ/tủ nào nằm trong khung tên', marks.every(e => n(e, '20') > lgBot));

// ── A3 chuẩn 1:1000: khung tên đúng kích thước mẫu tuyệt đối ──
{
    const pa = parse(await sb.ctx._generateCadDrawing(opts({ frameMode: 'a3-standard' })));
    const tl = (pa.blocks.get('TITLE_KNOP12') || []).filter(e => e.t === 'LINE');
    const h = Math.max(...tl.map(e => Math.max(n(e, '20'), n(e, '21')))), w = Math.max(...tl.map(e => Math.max(n(e, '10'), n(e, '11'))));
    ok('A3 chuẩn 1:1000: khung tên đúng 384,65 × 52,9', Math.abs(h - 52.9) < 0.01 && Math.abs(w - 384.65) < 0.01, { w, h });
    // Viền ngoài = mép giấy A3 420 × 297
    const hz = pa.ents.filter(e => e.t === 'LINE' && Math.abs(n(e, '20') - n(e, '21')) < 1e-6).map(e => Math.abs(n(e, '11') - n(e, '10')));
    const vt = pa.ents.filter(e => e.t === 'LINE' && Math.abs(n(e, '10') - n(e, '11')) < 1e-6).map(e => Math.abs(n(e, '21') - n(e, '20')));
    ok('A3 chuẩn 1:1000: viền ngoài 420 × 297, khung trong 384,65 × 281,84',
        hz.some(v => Math.abs(v - 420) < 0.01) && vt.some(v => Math.abs(v - 297) < 0.05) && hz.some(v => Math.abs(v - 384.65) < 0.01) && vt.some(v => Math.abs(v - 281.84) < 0.01));
    ok('A3 chuẩn 1:1000: chữ TT 4,24', (pa.blocks.get('TITLE_KNOP12') || []).some(e => e.t === 'TEXT' && txt(e) === 'TT QUẢN LÝ HẠ TẦNG' && Math.abs(n(e, '40') - 4.24) < 0.01));
}

// ── A3 chuẩn: trụ ở góc dưới phải → bảng dời sang trái / không đè trụ (tình huống review: 301 × 161 m, tờ 1/2) ──
{
    const rows2 = [new Array(30).fill('h'), row({ 0: 'T1', 1: 'TU-A', 2: 10.8545, 3: 106.6720, 6: 5, 7: 'TU-A' })];
    for (let i = 1; i <= 10; i++) rows2.push(row({ 0: 'Q' + i, 1: 'Q' + i, 2: 10.8545 - (i === 10 ? 0.00145 : (i % 2) * 0.0004), 3: 106.6720 + i * 0.000275,
        6: 1, 7: 'TU-A', 10: 'LED', 14: i === 1 ? 'TU-A' : 'Q' + (i - 1) }));
    sb.ctx.__rows = rows2; sb.run('loadedData = __rows;');
    const pa = parse(await sb.ctx._generateCadDrawing(opts({ frameMode: 'a3-standard', metadata: { ...MD, TEN_BAN_VE: 'TU-A' } })));
    const ins = pa.ents.filter(e => e.t === 'INSERT' && e.g['2'][0] === 'TITLE_KNOP12')[0];
    const bx = n(ins, '10'), by = n(ins, '20');
    const heads = pa.ents.filter(e => e.t === 'TEXT' && txt(e) === 'Tên ký hiệu').map(e => n(e, '10'));
    const lgMinX = Math.min(...heads) - 8.78 - 33.14 / 2, lgMaxX = lgMinX + 167.68;
    const mk = pa.ents.filter(e => e.t === 'INSERT' && e.g['8'] && /^CS_/.test(e.g['8'][0]) && n(e, '20') > by - 1);
    const bad = mk.filter(e => n(e, '10') + 12 >= lgMinX && n(e, '10') - 12 <= lgMaxX && n(e, '20') <= by + 52.9 + 73.51 + 8);
    ok('A3 chuẩn, trụ ở góc dưới phải: bảng ký hiệu không đè trụ (kể cả nhãn)', mk.length === 11 && bad.length === 0, { n: mk.length, bad: bad.map(e => [n(e, '10') - bx, n(e, '20') - by]), lg: [lgMinX - bx, lgMaxX - bx] });
    ok('… và bảng được dời sang trái', lgMinX - bx < 10, lgMinX - bx);
    sb.ctx.__rows = data; sb.run('loadedData = __rows;');
}

// ── chia tờ: ô Bản vẽ số ghi số tờ ──
{
    const pa = parse(await sb.ctx._generateCadDrawing(opts({ _sheetIdx: 2, _sheetTotal: 3 })));
    ok('chia tờ: "Bản vẽ số" ghi (tờ 02/03)', (pa.blocks.get('TITLE_KNOP12') || []).some(e => e.t === 'TEXT' && txt(e) === '(tờ 02/03)'));
}

// ── 1:500 (A3 chuẩn): khung tên co theo tỉ lệ ──
const dxf500 = await sb.ctx._generateCadDrawing(opts({ scale: 500, frameMode: 'a3-standard' }));
const p500 = parse(dxf500);
const t500 = (p500.blocks.get('TITLE_KNOP12') || []).filter(e => e.t === 'LINE');
const h500 = Math.max(...t500.map(e => Math.max(n(e, '20'), n(e, '21'))));
ok('1:500 → khung tên cao 26,45', Math.abs(h500 - 26.45) < 0.01, h500);
ok('1:500 → chữ tên đơn vị cao 2,12', (p500.blocks.get('TITLE_KNOP12') || []).some(e => e.t === 'TEXT' && txt(e) === 'TT QUẢN LÝ HẠ TẦNG' && Math.abs(n(e, '40') - 2.12) < 0.01));

// ── tắt block chuẩn: vẫn xuất được, bảng 13 dòng, không INSERT treo ──
const dxfOld = await sb.ctx._generateCadDrawing(opts({ realBlocks: false }));
const pOld = parse(dxfOld);
ok('tắt block chuẩn: bảng vẫn đủ 13 dòng', legendLabels.every(l => pOld.ents.some(e => e.t === 'TEXT' && txt(e) === l)));
ok('tắt block chuẩn: mọi INSERT có BLOCK', pOld.ents.concat([...pOld.blocks.values()].flat()).filter(e => e.t === 'INSERT').every(e => pOld.blocks.has(e.g['2'][0])));

// ── nhập tay tên tủ ưu tiên hơn dữ liệu ──
const dxfTay = await sb.ctx._generateCadDrawing(opts({ metadata: { ...MD, TEN_BAN_VE: 'TỦ NHẬP TAY' } }));
ok('tên tủ nhập tay ưu tiên', parse(dxfTay).ents.some(e => e.t === 'TEXT' && txt(e) === 'TỦ ĐIỀU KHIỂN - TỦ NHẬP TAY'));

// ── sơ đồ nguyên lý + bình đồ tổng thể vẫn chạy với mẫu này ──
for (const [fn, title] of [['_generateSingleLineDrawing', 'SƠ ĐỒ NGUYÊN LÝ HỆ THỐNG CHIẾU SÁNG'], ['_generateOverviewDrawing', 'BÌNH ĐỒ TỔNG THỂ HỆ THỐNG CHIẾU SÁNG']]) {
    let d = '', err = null;
    try { d = await sb.ctx[fn](opts({ cabinetName: 'BẠCH ĐẰNG-2-BT-15' })); } catch (e) { err = e.message; }
    ok(fn + ': chạy được, tên bản vẽ "' + title + '"', !err && parse(d).ents.some(e => e.t === 'TEXT' && txt(e) === title), err);
}

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
