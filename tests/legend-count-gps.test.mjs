// Bảng ký hiệu chỉ đếm cái được VẼ: bỏ dòng không toạ độ (import chưa khảo sát) + trụ chưa ghi loại đèn không đếm đèn.
// Tái hiện tủ "Trịnh Quang Nghị - 4" (Quan8): 12 trụ HPS + 4 trụ H97 chưa ghi đèn + 12 dòng trùng tên KHÔNG toạ độ.
// Trước sửa: STK 12 · BTLT 16 · HPS 28. Đúng: STK – · BTLT 16 · HPS 12. Run: node tests/legend-count-gps.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); };
const sb = loadAppSandbox();
const row = o => { const r = new Array(31).fill(''); for (const k in o) r[k] = String(o[k]); return r; };
const TU = 'Trịnh Quang Nghị - 4';
const d = [new Array(31).fill('h'), row({ 0: 'TU', 1: TU, 2: '10,70618', 3: '106,62597', 6: 5, 7: TU })];
for (let i = 1; i <= 12; i++) d.push(row({ 0: 'A' + i, 1: `TQN_TQN_4_${i}`, 2: String(10.70662 - i * 0.00009).replace('.', ','), 3: String(106.62476 + i * 0.0002).replace('.', ','), 6: 3, 7: TU, 10: 'HPS', 11: 150, 21: 1, 14: 'TU', 15: 30 }));
for (let i = 1; i <= 4; i++) d.push(row({ 0: 'H' + i, 1: `H97TQN_TQN4_${i}`, 2: String(10.70552 - i * 0.0004).replace('.', ','), 3: '106,6265', 6: 3, 7: TU, 21: 1 }));
for (let i = 1; i <= 12; i++) d.push(row({ 0: 'Q8_' + i, 1: `TQN_TQN_4_${i}`, 6: 1, 7: TU, 10: 'HPS', 11: 150, 21: 1 }));   // không toạ độ
sb.ctx.__rows = d; sb.run('loadedData = __rows;');
const filters = { tus: [TU], basenames: [], nguoiKS: [], phuongXa: [] };
const base = { metadata: {}, filters, outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75 };

// 1. Hàm thuần đếm
sb.ctx.__lr = d.slice(1); sb.run('__out = _qbtLegendRows(__lr.filter(_cgHasCoord), new Map(), true);');
const L = Object.fromEntries(sb.ctx.__out.map(x => [x.label, x.qty]));
ok('Trụ BTLT = 16 trụ', L['Trụ BTLT'] === '16 trụ', L);
ok('Trụ STK = – (12 dòng STK không toạ độ không đếm)', L['Trụ STK'] === '–', L);
ok('Đèn HPS = 12 bộ (4 trụ H97 chưa ghi đèn không đếm)', L['Đèn HPS'] === '12 bộ', L);
ok('Tủ điều khiển thường = 1 tủ', L['Tủ điều khiển thường'] === '1 tủ', L);

// 2. DXF thật: mẫu QBT + A.K.T
for (const [tid, real] of [['knop12', true], ['knop12', false], ['akt', true]]) {
    const dxf = String(await sb.ctx._generateCadDrawing(Object.assign({}, base, { templateId: tid, realBlocks: real })));
    const txt = dxf.replace(/\\U\+([0-9A-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    ok(`${tid}${real ? '' : ' (ký hiệu cũ)'}: bảng ký hiệu có "12 bộ" + "16 trụ", không có "28"`, /\b12 bộ/.test(txt) && /\b16 trụ/.test(txt) && !/\b28 (bộ|trụ)/.test(txt));
    ok(`${tid}${real ? '' : ' (ký hiệu cũ)'}: không còn "12 trụ" (STK ảo)`, !/\n12 trụ\r?\n/.test(txt));
}
// 3. Cảnh báo dòng thiếu toạ độ
sb.ctx.__f = filters; sb.run('__note = _cgNoGpsNote(__f);');
ok('Cảnh báo: "12 dòng không có toạ độ"', /12 dòng không có toạ độ/.test(sb.ctx.__note), sb.ctx.__note);
sb.ctx.__f2 = { tus: ['Không có'], basenames: [], nguoiKS: [], phuongXa: [] }; sb.run('__note2 = _cgNoGpsNote(__f2);');
ok('Không có dòng thiếu → không cảnh báo', sb.ctx.__note2 === '');
console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
