// Thư viện ký hiệu block thật (trích từ DWG mẫu) — helpers thuần giữa mốc @@CADSYMLIB_START/END (src/core/cad-symlib.js)
// Run: node tests/cad-symlib.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();
    const m = src.match(/\/\/ @@CADSYMLIB_START([\s\S]*?)\/\/ @@CADSYMLIB_END/);
    if (!m) throw new Error('Chưa có block @@CADSYMLIB_START/END');
    return new Function(m[1] + '\nreturn { CAD_SYMLIB, _csDxfName, _csLampKind, _csPickBlock, _csStateLayer, _csBlockDxf, _csInsertScale, _csBlockBBox, _csRealRot, _csLabel, CS_LAYERS, _csLabelPos, _csDef };')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }

// row helper: [id, ten, lat, lon, ghiChu, nguoiKS, loai, tu, loaiTru, loaiCan, loaiDen, congSuat, ..., soLuongDen(21), ..., trangThai(29)]
const row = (o) => { const r = new Array(30).fill(''); for (const k in o) r[k] = o[k]; return r; };

// === thư viện ===
ok('thư viện có 4 combo gốc', ['HPS - BETON', 'LED - BETON', 'HPS - STK', 'LED - STK'].every(n => H.CAD_SYMLIB[n]));
ok('combo = 2 INSERT (đèn + trụ)', H.CAD_SYMLIB['HPS - BETON'].prims.filter(p => p[0] === 'I').length === 2);
ok('Den LED có tô đặc (SOLID)', H.CAD_SYMLIB['Den LED'].prims.some(p => p[0] === 'S'));
ok('Tru BTLT = tròn + tô đặc', H.CAD_SYMLIB['Tru BTLT'].prims.some(p => p[0] === 'C') && H.CAD_SYMLIB['Tru BTLT'].prims.some(p => p[0] === 'S'));
ok('tỉ lệ chèn gốc combo = 0.8', H.CAD_SYMLIB['LED - STK'].default_scale === 0.8);

// === _csDxfName (R12: không dấu cách) ===
ok('dxfName combo', H._csDxfName('HPS - BETON') === 'HPS-BETON');
ok('dxfName có dấu cách → _', H._csDxfName('Den trang tri') === 'DEN_TRANG_TRI');
ok('dxfName giữ _', H._csDxfName('TDK_hienhuu') === 'TDK_HIENHUU');
ok('dxfName hợp lệ R12', ['Tu dk KNTT', 'LED - STK', 'Den HPS'].every(n => /^[A-Z0-9_$-]+$/.test(H._csDxfName(n))));

// === _csLampKind ===
ok('lamp LED', H._csLampKind('LED 100W') === 'LED');
ok('lamp led thường', H._csLampKind('đèn led') === 'LED');
ok('lamp HPS', H._csLampKind('HPS 150W') === 'HPS');
ok('lamp Sodium → HPS', H._csLampKind('Cao áp Sodium') === 'HPS');
ok('lamp MH', H._csLampKind('MH 250W') === 'MH');
ok('lamp Metal halide → MH', H._csLampKind('Metal Halide') === 'MH');
ok('lamp trống → HPS', H._csLampKind('') === 'HPS');

// === _csPickBlock ===
ok('STK + LED', H._csPickBlock(row({ 6: '1', 10: 'LED' })) === 'LED-STK');
ok('STK + trống → HPS', H._csPickBlock(row({ 6: '1' })) === 'HPS-STK');
ok('HTLT + LED → BETON', H._csPickBlock(row({ 6: '3', 10: 'LED 120W' })) === 'LED-BETON');
ok('TTLT + HPS → BETON', H._csPickBlock(row({ 6: '4', 10: 'HPS' })) === 'HPS-BETON');
ok('STK + MH', H._csPickBlock(row({ 6: '1', 10: 'MH 250W' })) === 'MH-STK');
ok('BETON + MH', H._csPickBlock(row({ 6: '3', 10: 'Metal halide' })) === 'MH-BETON');
ok('2 bóng → _X2', H._csPickBlock(row({ 6: '1', 10: 'LED', 21: '2' })) === 'LED-STK_X2');
ok('5 bóng → kẹp _X4', H._csPickBlock(row({ 6: '3', 10: 'LED', 21: '5' })) === 'LED-BETON_X4');
ok('trang trí', H._csPickBlock(row({ 6: '2', 10: 'LED' })) === 'DEN_TRANG_TRI');
ok('tủ tên KNTT', H._csPickBlock(row({ 6: '5', 1: 'Tủ KNTT P12' })) === 'TU_DK_KNTT');
ok('tủ ghi chú kntt', H._csPickBlock(row({ 6: '6', 1: 'VTS_H23', 4: 'tủ kết nối kntt' })) === 'TU_DK_KNTT');
ok('tủ ghi chú "không KNTT" → TDK_HIENHUU', H._csPickBlock(row({ 6: '5', 1: 'VTS', 4: 'không KNTT' })) === 'TDK_HIENHUU');
ok('tủ ghi chú "chưa có KNTT" → TDK_HIENHUU', H._csPickBlock(row({ 6: '5', 1: 'VTS', 4: 'chưa có KNTT' })) === 'TDK_HIENHUU');
ok('tủ thường → TDK_HIENHUU', H._csPickBlock(row({ 6: '5', 1: 'VTS_H23' })) === 'TDK_HIENHUU');
ok('loại lạ → null', H._csPickBlock(row({ 6: '9' })) === null);

// === _csStateLayer ===
ok('trống → HIEN_HUU', H._csStateLayer('').layer === 'CS_HIEN_HUU');
ok('giu → HIEN_HUU màu 7', H._csStateLayer('giu').layer === 'CS_HIEN_HUU' && H._csStateLayer('giu').color === 7);
ok('thu → THU_HOI đỏ', H._csStateLayer('thu').layer === 'CS_THU_HOI' && H._csStateLayer('thu').color === 1);
ok('thu_can → THU_CAN_UDC (trụ giữ, không vẽ như thu cả trụ)', H._csStateLayer('thu_can').layer === 'CS_THU_CAN_UDC' && H._csStateLayer('thu_can').color === 4);
ok('thu_udc / thu_can_udc → THU_CAN_UDC', H._csStateLayer('thu_udc').layer === 'CS_THU_CAN_UDC' && H._csStateLayer('thu_can_udc').layer === 'CS_THU_CAN_UDC');
ok('moi_led_thay → THAY_DEN (trụ hiện hữu)', H._csStateLayer('moi_led_thay').layer === 'CS_THAY_DEN' && H._csStateLayer('moi_led_thay').color === 5);
ok('moi_led → LAP_MOI xanh', H._csStateLayer('moi_led').layer === 'CS_LAP_MOI' && H._csStateLayer('moi_led').color === 3);
ok('moi_stk_170w → LAP_MOI', H._csStateLayer('moi_stk_170w').layer === 'CS_LAP_MOI');
ok('thao_lap → THAO_LAP cam', H._csStateLayer('thao_lap').layer === 'CS_THAO_LAP' && H._csStateLayer('thao_lap').color === 30);
ok('lạ → HIEN_HUU', H._csStateLayer('xyz').layer === 'CS_HIEN_HUU');
ok('CS_LAYERS đủ 6 layer, tên R12 hợp lệ', H.CS_LAYERS.length === 6 && H.CS_LAYERS.every(l => /^[A-Z0-9_]+$/.test(l.layer)));

// === _csBlockDxf ===
const parse = (arr) => { const ents = []; for (let i = 0; i + 1 < arr.length; i += 2) if (arr[i] === '0') ents.push({ t: arr[i + 1], i }); return ents; };
const blockNames = (arr) => { const out = []; for (let i = 0; i + 3 < arr.length; i++) if (arr[i] === '0' && arr[i + 1] === 'BLOCK') { const k = arr.indexOf('2', i); out.push(arr[k + 1]); } return out; };
const d1 = H._csBlockDxf(['LED-STK']);
const n1 = blockNames(d1);
ok('LED-STK sinh đủ 3 block', n1.length === 3 && ['DEN_LED', 'TRU_STK', 'LED-STK'].every(n => n1.includes(n)));
ok('block con định nghĩa TRƯỚC combo', n1.indexOf('LED-STK') > n1.indexOf('DEN_LED') && n1.indexOf('LED-STK') > n1.indexOf('TRU_STK'));
ok('BLOCK = ENDBLK', parse(d1).filter(e => e.t === 'BLOCK').length === parse(d1).filter(e => e.t === 'ENDBLK').length);
ok('chỉ entity R12', parse(d1).every(e => ['BLOCK', 'ENDBLK', 'LINE', 'CIRCLE', 'ARC', 'SOLID', 'TEXT', 'INSERT'].includes(e.t)));
ok('mọi giá trị là chuỗi', d1.every(v => typeof v === 'string'));
const d2 = H._csBlockDxf(['LED-STK', 'HPS-STK', 'LED-STK']);
const n2 = blockNames(d2);
ok('không trùng định nghĩa (TRU_STK 1 lần)', n2.filter(n => n === 'TRU_STK').length === 1 && n2.filter(n => n === 'LED-STK').length === 1);
const d3 = H._csBlockDxf(['MH-STK']);
ok('combo tổng hợp MH-STK có DEN_MH + TRU_STK', ['DEN_MH', 'TRU_STK', 'MH-STK'].every(n => blockNames(d3).includes(n)));
const d4 = H._csBlockDxf(['LED-STK_X2']);
const x2 = d4.slice(d4.lastIndexOf('LED-STK_X2') + 1);   // +1: bắt đầu từ mã nhóm (cặp mã/giá trị không lệch)
ok('X2 có 3 INSERT (trụ + 2 đèn)', parse(x2).filter(e => e.t === 'INSERT').length === 3);
ok('X2 đèn thứ 2 xoay 180', /'?180/.test(x2.join(',')) || x2.includes('180.0000'));
ok('tên lạ → bỏ qua, không lỗi', H._csBlockDxf(['KHONG_CO']).length === 0);

// === _csInsertScale ===
ok('scale combo 1:1000 = 0.8', Math.abs(H._csInsertScale('HPS-BETON', 1000) - 0.8) < 1e-9);
ok('scale combo 1:500 = 0.4', Math.abs(H._csInsertScale('HPS-BETON', 500) - 0.4) < 1e-9);
ok('scale X2 theo combo gốc', Math.abs(H._csInsertScale('LED-STK_X2', 1000) - 0.8) < 1e-9);
ok('scale TDK 1.4901', Math.abs(H._csInsertScale('TDK_HIENHUU', 1000) - 1.4901) < 1e-9);
ok('scale không truyền tỉ lệ → 1:1000', Math.abs(H._csInsertScale('LED-STK') - 0.8) < 1e-9);

// === _csBlockBBox ===
const bb = H._csBlockBBox('LED-STK', 0.8);
ok('bbox combo chứa gốc (tâm trụ)', bb.x0 < 0 && bb.x1 > 0 && bb.y0 < 0 && bb.y1 > 0);
ok('bbox combo ngang > dọc (đầu đèn bên phải)', (bb.x1 - bb.x0) > (bb.y1 - bb.y0) && bb.x1 > 5);
const bb2 = H._csBlockBBox('LED-STK_X2', 0.8);
ok('bbox X2 đối xứng hai bên', bb2.x0 < -5 && bb2.x1 > 5);

// === Đèn MH canh sát trụ như đèn HPS (không hở) ===
{
    const bbW = n => { const b = H._csBlockBBox(n, 1); return b; };
    const hps = H._csDef('HPS-STK').prims.find(q => q[0] === 'I' && q[1] === 'DEN_HPS');
    const mh = H._csDef('MH-STK').prims.find(q => q[0] === 'I' && q[1] === 'DEN_MH');
    const leftH = hps[2] + hps[4] * bbW('DEN_HPS').x0, leftM = mh[2] + mh[4] * bbW('DEN_MH').x0;
    ok('MH-STK: mép đèn MH trùng mép đèn HPS (sát trụ)', Math.abs(leftH - leftM) < 1e-6);
    const mh2 = H._csDef('MH-BETON_X2').prims.filter(q => q[0] === 'I' && q[1] === 'DEN_MH');
    ok('MH-BETON_X2: 2 đèn đối xứng qua tâm', mh2.length === 2 && Math.abs(mh2[0][2] + mh2[1][2]) < 1e-6);
}

// === _csLabelPos: nhãn né hướng đầu đèn ===
{
    const P = (rot, n) => H._csLabelPos(0, 0, rot, n, 1, 3);
    ok('nhãn: 1 bóng hướng +X → đặt dưới', P(0, 1).ang === 270 && P(0, 1).y < -2);
    ok('nhãn: đèn hướng xuống (270°) → đặt trên', P(270, 1).ang === 90 && P(270, 1).y > 2);
    ok('nhãn: 3 bóng (0/180/270) → đặt trên', P(0, 3).ang === 90);
    ok('nhãn: 4 bóng → góc chéo', [225, 315, 135, 45].includes(P(0, 4).ang));
    ok('nhãn: tủ (0 bóng) → dưới', P(0, 0).ang === 270);
    ok('nhãn: căn giữa theo bề rộng chữ', Math.abs(P(0, 1).x + 3 * 2 * 0.6 / 2) < 1e-9);
    ok('nhãn: khoảng cách co theo tỉ lệ', H._csLabelPos(0, 0, 0, 1, 2, 0).y < H._csLabelPos(0, 0, 0, 1, 1, 0).y);
}

// === _csRealRot / _csLabel ===
ok('xoay thật = xoay app + 90', H._csRealRot(0) === 90 && H._csRealRot(-90) === 0);
ok('nhãn chú thích combo', /BTLT/.test(H._csLabel('HPS-BETON')) && /HPS/.test(H._csLabel('HPS-BETON')));
ok('nhãn X2 có 2 bóng', /2 bóng/.test(H._csLabel('LED-STK_X2')));
ok('nhãn tủ KNTT', /KNTT/.test(H._csLabel('TU_DK_KNTT')));

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
