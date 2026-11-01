// Kiểu chữ STANDARD phải mang tên phông "Times New Roman" (XDATA ACAD) — thiếu thì AutoCAD hiện đúng trên
// màn hình nhưng khi IN lùi về txt.shx, chữ Việt thành "?" (v207). Run: node tests/dxf-font-style.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
const row = (o) => { const r = new Array(31).fill(''); for (const k in o) r[k] = String(o[k]); return r; };
const d = [new Array(31).fill('h'), row({ 0: 'T1', 1: 'TU-1', 2: 10.75, 3: 106.63, 6: 5, 7: 'TU-1' })];
for (let i = 1; i <= 4; i++) d.push(row({ 0: 'P' + i, 1: 'P_' + i, 2: 10.75 + i * 0.0003, 3: 106.63, 6: 1, 7: 'TU-1', 14: i === 1 ? 'TU-1' : 'P_' + (i - 1), 15: '30' }));
sb.ctx.__rows = d; sb.run('loadedData = __rows;');
const base = { metadata: {}, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] }, outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75 };
for (const [fn, ex] of [['_generateCadDrawing', { templateId: 'knop12', realBlocks: true }], ['_generateCadDrawing', { templateId: 'akt', realBlocks: false }],
                        ['_generateSingleLineDrawing', { templateId: 'knop12' }], ['_generateOverviewDrawing', { templateId: 'knop12' }]]) {
    const L = String(await sb.ctx[fn](Object.assign({}, base, ex))).split('\r\n');
    const st = L.indexOf('STYLE', L.indexOf('STYLE') + 1);   // bản ghi STYLE (sau TABLE STYLE)
    const seg = L.slice(st, L.indexOf('ENDTAB', st));
    const name = ex.templateId + ' ' + fn;
    ok(name + ': STANDARD = times.ttf + XDATA ACAD "Times New Roman"',
        seg.includes('times.ttf') && seg[seg.indexOf('1001') + 1] === 'ACAD' && seg[seg.indexOf('1000') + 1] === 'Times New Roman');
    const ap = L.indexOf('APPID');
    ok(name + ': có bảng APPID đăng ký ACAD, trước ENDSEC của TABLES', ap > 0 && L[L.indexOf('APPID', ap + 1) + 2] === 'ACAD' &&
        ap < L.indexOf('ENTITIES'));
}
console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
