// Xuất CAD bằng block thật (bản vẽ mẫu): INSERT đúng block theo thuộc tính, layer theo trạng thái,
// định nghĩa block lồng đủ + mỗi block 1 lần, tỉ lệ theo bản vẽ, legend dùng block thật, tắt → ký hiệu cũ.
// Run: node tests/cad-real-blocks.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const sb = loadAppSandbox();
ok('sandbox nạp index.html + cad-symlib không lỗi', sb.errors.length === 0);

// [0]id [1]tên [2]lat [3]lon [4]ghi chú [6]loại [7]tủ [10]loại đèn [14]gốc [21]số bóng [29]trạng thái
const row = (o) => { const r = new Array(30).fill(''); for (const k in o) r[k] = String(o[k]); return r; };
sb.ctx.__rows = [new Array(30).fill('h'),
    row({ 0: 'T1', 1: 'TU KNTT 1', 2: 10.8530, 3: 106.6720, 6: 5, 7: 'TU KNTT 1' }),
    row({ 0: 'T2', 1: 'VTS_H23', 2: 10.8560, 3: 106.6760, 6: 6, 7: 'VTS_H23', 29: 'thu' }),
    row({ 0: 'P1', 1: 'P1', 2: 10.8531, 3: 106.6723, 6: 1, 7: 'TU KNTT 1', 10: 'LED 100W', 14: 'TU KNTT 1' }),
    row({ 0: 'P2', 1: 'P2', 2: 10.8532, 3: 106.6726, 6: 3, 7: 'TU KNTT 1', 10: 'HPS 150W', 14: 'P1', 29: 'thu' }),
    row({ 0: 'P3', 1: 'P3', 2: 10.8533, 3: 106.6729, 6: 4, 7: 'TU KNTT 1', 10: 'LED', 21: 2, 14: 'P2', 29: 'moi_led' }),
    row({ 0: 'P4', 1: 'P4', 2: 10.8534, 3: 106.6732, 6: 1, 7: 'TU KNTT 1', 10: 'MH 250W', 14: 'P3' }),
    row({ 0: 'P5', 1: 'P5', 2: 10.8561, 3: 106.6763, 6: 2, 7: 'VTS_H23', 10: 'LED', 14: 'VTS_H23', 29: 'thao_lap' }),
    row({ 0: 'P6', 1: 'P6', 2: 10.8562, 3: 106.6766, 6: 1, 7: 'VTS_H23', 10: 'LED', 14: 'P5' }),
    row({ 0: 'P7', 1: 'P7', 2: 10.8563, 3: 106.6769, 6: 3, 7: 'VTS_H23', 10: 'HPS', 14: 'P6', 29: 'thu_can' }),
    row({ 0: 'P8', 1: 'P8', 2: 10.8564, 3: 106.6772, 6: 1, 7: 'VTS_H23', 10: 'LED', 14: 'P7', 29: 'moi_led_thay' })];
sb.run('loadedData = __rows;');
const opts = (id, extra) => Object.assign({ templateId: id, metadata: {}, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
    outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75 }, extra || {});

function parse(dxf) {
    const L = dxf.split('\r\n'), P = [];
    for (let i = 0; i + 1 < L.length; i += 2) P.push([L[i].trim(), L[i + 1]]);
    const ents = [], blocks = [];
    let blk = null, sec = null;
    for (let i = 0; i < P.length; i++) {
        if (P[i][0] !== '0') continue;
        const e = { t: P[i][1], g: {} };
        for (let j = i + 1; j < P.length && P[j][0] !== '0'; j++) if (!(P[j][0] in e.g)) e.g[P[j][0]] = P[j][1];
        if (e.t === 'SECTION') { sec = e.g['2']; continue; }
        if (e.t === 'BLOCK') { blk = e.g['2']; blocks.push(blk); continue; }
        if (e.t === 'ENDBLK') { blk = null; continue; }
        e.blk = blk; e.sec = sec;
        ents.push(e);
    }
    return { ents, blocks };
}

const EXPECT = {   // tên trụ → [block, layer]
    'TU KNTT 1': ['TU_DK_KNTT', 'CS_HIEN_HUU'], VTS_H23: ['TDK_HIENHUU', 'CS_THU_HOI'],
    P1: ['LED-STK', 'CS_HIEN_HUU'], P2: ['HPS-BETON', 'CS_THU_HOI'], P3: ['LED-BETON_X2', 'CS_LAP_MOI'],
    P4: ['MH-STK', 'CS_HIEN_HUU'], P5: ['DEN_TRANG_TRI', 'CS_THAO_LAP'], P6: ['LED-STK', 'CS_HIEN_HUU'],
    P7: ['HPS-BETON', 'CS_THU_CAN_UDC'], P8: ['LED-STK', 'CS_THAY_DEN'],
};

// ── 1. Bật block thật, không khung tên ──
{
    const o = opts('none', { realBlocks: true });
    const dxf = await sb.ctx._generateCadDrawing(o);
    const { ents, blocks } = parse(dxf);
    const ins = ents.filter(e => e.sec === 'ENTITIES' && !e.blk && e.t === 'INSERT');
    const insBlk = ins.filter(e => /^(TU_DK_KNTT|TDK_HIENHUU|LED-|HPS-|MH-|DEN_TRANG_TRI)/.test(e.g['2']));
    ok('10 đối tượng → 10 INSERT block thật', insBlk.length === 10);
    const texts = ents.filter(e => e.sec === 'ENTITIES' && !e.blk && e.t === 'TEXT');
    // ghép INSERT với nhãn tên gần nhất
    let match = 0;
    for (const [name, [bn, ly]] of Object.entries(EXPECT)) {
        const t = texts.find(x => x.g['1'] === name);
        if (!t) continue;
        const tx = +t.g['10'] + 0.6 * name.length, ty = +t.g['20'] + 1;   // tâm nhãn (chữ cao 2, căn giữa theo bề rộng)
        const cand = insBlk.filter(e => e.g['2'] === bn && e.g['8'] === ly && Math.hypot(+e.g['10'] - tx, +e.g['20'] - ty) < 6);
        if (cand.length) match++; else console.log('   thiếu:', name, bn, ly);
    }
    ok('mỗi đối tượng đúng block + đúng layer trạng thái (10/10)', match === 10);
    // nhãn tên nằm DƯỚI tâm trụ (không xoay → đầu đèn hướng +X), không đè ký hiệu
    const tP1 = texts.find(x => x.g['1'] === 'P1'), iP1 = insBlk.find(e => e.g['2'] === 'LED-STK' && e.g['8'] === 'CS_HIEN_HUU');
    ok('nhãn P1 dưới tâm trụ ≥ 2.5m', tP1 && iP1 && (+iP1.g['20']) - (+tP1.g['20']) >= 2.5 && Math.abs((+tP1.g['10']) - (+iP1.g['10'])) < 3);

    const layers = ents.filter(e => e.t === 'LAYER').map(e => [e.g['2'], e.g['62']]);
    const L = Object.fromEntries(layers);
    ok('LAYER: 6 layer trạng thái đúng màu', L.CS_HIEN_HUU === '7' && L.CS_THU_HOI === '1' && L.CS_THU_CAN_UDC === '4' && L.CS_LAP_MOI === '3' && L.CS_THAY_DEN === '5' && L.CS_THAO_LAP === '30');

    const need = ['TU_DK_KNTT', 'TDK_HIENHUU', 'LED-STK', 'HPS-BETON', 'LED-BETON_X2', 'MH-STK', 'DEN_TRANG_TRI',
        'DEN_LED', 'DEN_HPS', 'DEN_MH', 'TRU_STK', 'TRU_BTLT'];
    ok('định nghĩa đủ block (cả block con lồng)', need.every(b => blocks.includes(b)));
    ok('mỗi block định nghĩa đúng 1 lần', need.every(b => blocks.filter(x => x === b).length === 1));
    ok('combo LED-STK = INSERT DEN_LED + TRU_STK', ['DEN_LED', 'TRU_STK'].every(c => ents.some(e => e.blk === 'LED-STK' && e.t === 'INSERT' && e.g['2'] === c)));
    ok('X2 có 2 đầu đèn', ents.filter(e => e.blk === 'LED-BETON_X2' && e.t === 'INSERT' && e.g['2'] === 'DEN_LED').length === 2);
    const R12 = new Set(['LINE', 'ARC', 'CIRCLE', 'SOLID', 'TEXT', 'INSERT']);
    ok('block thật chỉ chứa entity R12', ents.filter(e => need.includes(e.blk)).every(e => R12.has(e.t)));
    ok('entity trong block thật nằm layer 0 (thừa kế màu)', ents.filter(e => need.includes(e.blk)).every(e => e.g['8'] === '0'));
    const p1 = insBlk.find(e => e.g['2'] === 'LED-STK');
    ok('tỉ lệ chèn combo @1:1000 = 0.8', p1 && Math.abs(+p1.g['41'] - 0.8) < 1e-6 && Math.abs(+p1.g['42'] - 0.8) < 1e-6);
    const tdk = insBlk.find(e => e.g['2'] === 'TDK_HIENHUU');
    ok('tỉ lệ chèn TDK = 1.4901', tdk && Math.abs(+tdk.g['41'] - 1.4901) < 1e-4);
    ok('không xoay theo đường → góc 0', insBlk.every(e => Math.abs(+e.g['50']) < 1e-6));
    ok('không còn block ký hiệu cũ SYM_POLE_* cho trụ', !blocks.some(b => /^SYM_POLE/.test(b)));
    const rb = o.__legendCounts && o.__legendCounts.realBlocks;
    ok('dữ liệu chú thích: 9 dòng (block × layer)', rb && rb.length === 9);
    ok('chú thích tủ ghi nổi/ngầm', rb && rb.some(x => /Tủ điều khiển kết nối trung tâm \(KNTT\) nổi/.test(x.label)) && rb.some(x => /Tủ điều khiển chiếu sáng ngầm/.test(x.label)));
    const ledStk = rb && rb.find(x => x.block === 'LED-STK');
    ok('chú thích LED-STK đếm 2 trụ, nhãn tiếng Việt', ledStk && ledStk.count === 2 && /Trụ thép STK \+ đèn LED/.test(ledStk.label));
    // BLOCK/ENDBLK cân
    const nB = (dxf.match(/\r\nBLOCK\r\n/g) || []).length, nE = (dxf.match(/\r\nENDBLK\r\n/g) || []).length;
    ok('BLOCK = ENDBLK', nB === nE && nB > 0);
}

// ── 2. Tỉ lệ 1:500 ──
{
    const dxf = await sb.ctx._generateCadDrawing(opts('none', { realBlocks: true, scale: 500 }));
    const p = parse(dxf).ents.find(e => !e.blk && e.t === 'INSERT' && e.g['2'] === 'LED-STK');
    ok('1:500 → tỉ lệ chèn 0.4', p && Math.abs(+p.g['41'] - 0.4) < 1e-6);
    const dxf2 = await sb.ctx._generateCadDrawing(opts('none', { realBlocks: true, scale: 2000 }));
    const E2 = parse(dxf2).ents;
    const p2 = E2.find(e => !e.blk && e.t === 'INSERT' && e.g['2'] === 'LED-STK');
    const t2 = E2.find(e => !e.blk && e.t === 'TEXT' && e.g['1'] === 'P1');
    ok('1:2000 → tỉ lệ 1.6, nhãn lùi xa hơn (≥ 7m dưới tâm)', p2 && Math.abs(+p2.g['41'] - 1.6) < 1e-6 && t2 && (+p2.g['20']) - (+t2.g['20']) >= 7);
}

// ── 3. Có khung tên → legend CHÚ THÍCH chèn block thật (mẫu 'dienluc'; mẫu QBT bỏ CHÚ THÍCH ngoài khung — xem titleblock-qbt-export) ──
{
    const o = opts('dienluc', { realBlocks: true });
    const dxf = await sb.ctx._generateCadDrawing(o);
    const { ents } = parse(dxf);
    const ins = ents.filter(e => !e.blk && e.t === 'INSERT' && e.g['2'] === 'LED-STK');
    const lgRows = o.__legendCounts.realBlocks.filter(x => x.block === 'LED-STK').length;
    ok('dienluc: LED-STK = 3 trụ + ' + lgRows + ' dòng chú thích (hiện hữu, thay đèn)', lgRows === 2 && ins.length === 3 + lgRows);
    const dec = s => String(s || '').replace(/\\U\+([0-9A-F]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));  // _dxfEscape → \U+XXXX
    const lg = ents.some(e => !e.blk && e.t === 'TEXT' && /Trụ BTLT \+ đèn HPS — thu hồi/.test(dec(e.g['1'])));
    ok('dienluc: chú thích có nhãn "Trụ BTLT + đèn HPS — thu hồi"', lg);
}

// ── 3b. Xoay theo đường (không OSM → theo tuyến cáp): block thật = ký hiệu cũ + 90° (cùng hướng đầu đèn) ──
{
    const sb2 = loadAppSandbox();
    sb2.ctx.__rows = [new Array(30).fill('h'),
        row({ 0: 'A', 1: 'A', 2: 10.85, 3: 106.6700, 6: 1, 10: 'LED' }),
        row({ 0: 'B', 1: 'B', 2: 10.85, 3: 106.6703, 6: 1, 10: 'LED', 14: 'A' }),
        row({ 0: 'C', 1: 'C', 2: 10.8503, 3: 106.6706, 6: 3, 10: 'HPS', 14: 'B', 21: 2 })];
    sb2.run('loadedData = __rows; _fetchOsmBasemap = async () => { throw new Error("offline"); };');
    const rotsOf = (dxf, re) => parse(dxf).ents.filter(e => !e.blk && e.t === 'INSERT' && re.test(e.g['2'])).map(e => +e.g['50']);
    const real = rotsOf(await sb2.ctx._generateCadDrawing(opts('none', { orientByRoad: true, realBlocks: true })), /^(LED|HPS)-/);
    const old = rotsOf(await sb2.ctx._generateCadDrawing(opts('none', { orientByRoad: true, realBlocks: false })), /^SYM_POLE/);
    const d = (a, b) => { const x = (((a - b - 90) % 360) + 360) % 360; return Math.min(x, 360 - x); };
    ok('xoay theo tuyến: 3 trụ, góc block thật = góc cũ + 90°', real.length === 3 && old.length === 3 && real.every((r, i) => d(r, old[i]) < 0.01));
    ok('xoay theo tuyến: có góc khác 90 (đã thật sự xoay)', real.some(r => Math.abs(r - 90) > 1));
}

// ── 4. Tắt block thật → ký hiệu cũ (tương thích ngược) ──
{
    const dxf = await sb.ctx._generateCadDrawing(opts('none', { realBlocks: false }));
    const { ents, blocks } = parse(dxf);
    ok('tắt: không có layer CS_*', !ents.some(e => e.t === 'LAYER' && /^CS_/.test(e.g['2'])));
    ok('tắt: dùng block cũ SYM_*', blocks.some(b => /^SYM_/.test(b)) && !blocks.includes('LED-STK'));
    const dxf2 = await sb.ctx._generateCadDrawing(opts('none'));
    ok('không truyền realBlocks → ký hiệu cũ', !parse(dxf2).blocks.includes('LED-STK'));
}

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
