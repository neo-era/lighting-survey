// Panel Căn thẳng tuyến — tab "Chọn trụ": chọn hàng loạt (Tất cả/Bỏ hết/Đảo/Hàng/Dời ≤/Bỏ cảnh báo/Shift dải) (v171).
// Run: node tests/align-pick.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);
const B = sb.ctx._raBulkSelect;

// 8 trụ: 0-3 hàng 0, 4-7 hàng 1; #2 far (không dời được), #3 RTK, #5 big, #6 cross
const mk = () => [
    { group: 0, move: 0.5, flag: null }, { group: 0, move: 1.8, flag: null }, { group: 0, move: 0, flag: 'far' }, { group: 0, move: 0.3, flag: null, rtk: true },
    { group: 1, move: 2.5, flag: null }, { group: 1, move: 12, flag: 'big' }, { group: 1, move: 3, flag: 'cross' }, { group: 1, move: 0.1, flag: null },
].map((it, i) => ({ idx: i, row: ['', 'P' + i], item: Object.assign({ checked: false, dist: 5 }, it) }));
const on = es => es.map((e, i) => e.item.checked ? i : -1).filter(i => i >= 0).join(',');

let E = mk();
B(E, 'all');
ok('Tất cả: chọn mọi trụ dời được, trừ far và RTK', on(E) === '0,1,4,5,6,7');
B(E, 'none');
ok('Bỏ hết: không còn trụ nào', on(E) === '');
E[3].item.checked = true;   // RTK tick tay
B(E, 'invert');
ok('Đảo: đảo trụ dời được (RTK đang tick → bỏ), far không đụng', on(E) === '0,1,4,5,6,7');
E = mk(); E[0].item.checked = true;
B(E, 'group', 0);
ok('Hàng 1 chưa đủ → chọn cả hàng (gồm RTK, trừ far)', on(E) === '0,1,3');
B(E, 'group', 0);
ok('Hàng 1 đã đủ → bỏ cả hàng', on(E) === '');
E = mk();
B(E, 'maxMove', 2);
ok('Chỉ dời ≤ 2 m: chọn đúng trụ dời ≤ 2 (trừ RTK), bỏ trụ khác', on(E) === '0,1,7');
E = mk(); B(E, 'all');
const ch = B(E, 'noWarn');
ok('Bỏ trụ cảnh báo: bỏ big + cross, giữ trụ thường', on(E) === '0,1,4,7' && ch.join(',') === '5,6');
E = mk();
B(E, 'range', { from: 4, to: 1, on: true });
ok('Dải 1↔4 (ngược chiều) chọn hết, bỏ qua far', on(E) === '1,3,4');
ok('trả về danh sách thay đổi đúng', B(E, 'range', { from: 0, to: 0, on: true }).join(',') === '0');
ok('dải vượt biên không lỗi', B(mk(), 'range', { from: -5, to: 99, on: true }).length === 7);

// ── Render panel: tab Chọn trụ mặc định + thanh chọn nhanh ──
let html = '';
const panel = { id: 'alignRoutePanel', style: {}, set innerHTML(v) { html = v; }, get innerHTML() { return html; },
    querySelector: () => null, setAttribute() {}, remove() {} };
sb.ctx.document = Object.assign(sb.ctx.document || {}, { getElementById: id => id === 'alignRoutePanel' ? panel : null });
sb.ctx.__E = mk();
sb.run(`_raState = { entries: __E, base: 'dt743a_1', roadKey: 'Đường tỉnh 743A', dual: null, width: 7, osmWidth: 7,
    groups: [{ offset: 9.1, count: 4, compassPos: 'Bắc', compassNeg: 'Nam' }, { offset: -4.6, count: 4, compassPos: 'Bắc', compassNeg: 'Nam' }],
    cfg: [{ ref: 'tim', side: -1, value: 9.1 }, { ref: 'tim', side: 1, value: 4.6 }], manual: new Map(), layer: { clearLayers() {} } };`);
sb.ctx._raRenderPreview = () => {};
sb.ctx._raBulk('all');
ok('render: mặc định tab Chọn trụ, có thanh chọn nhanh', /role="tab" aria-selected="true"[^>]*_raSetTab\('pick'\)/.test(html) && /Bỏ hết/.test(html) && /Đảo/.test(html));
ok('render: đếm "Đã chọn 6/7" + nút Áp dụng (6 trụ)', /Đã chọn 6\/7/.test(html) && /Áp dụng \(6 trụ\)/.test(html));
ok('render: có RTK → nút "Tất cả (trừ RTK)"', /Tất cả \(trừ RTK\)/.test(html));
ok('render: chip Hàng 1 2/3 (RTK chưa chọn), Hàng 2 4/4', /Hàng 1 <span[^>]*>2\/3/.test(html) && /Hàng 2 <span[^>]*>4\/4/.test(html));
ok('render: cảnh báo đang chọn 2 trụ có cảnh báo', /⚠ 2 trụ có cảnh báo/.test(html));
ok('render: tóm tắt cấu hình 2 hàng', /Hàng 1: Tim · Nam · 9.1 m/.test(html) && /Hàng 2: Tim · Bắc · 4.6 m/.test(html));
ok('render: ô tick tiêu đề + cột Hàng', /data-ra-all/.test(html) && />Hàng<\/th>/.test(html));
sb.ctx._raSetTab('cfg');
ok('tab Cấu hình: hiện form Mốc/Phía, ẩn bảng trụ', /Mép đường/.test(html) && !/data-ra-scroll/.test(html));

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
