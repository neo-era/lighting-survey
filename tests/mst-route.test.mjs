// Auto MST gom theo TÊN TUYẾN khi trụ chưa gán tủ (v185). Run: node tests/mst-route.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
const W = sb.ctx;
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const row = o => { const r = new Array(30).fill(''); for (const k in o) r[k] = o[k]; return r; };
const data = [new Array(30).fill('h'),
    // Tủ "HV" (cột Tủ chỉ ở chính dòng tủ — như Bàu Bàng), trụ HV_1..4 chưa gán tủ
    row({ 1: 'HV', 2: '10,9', 3: '106,7', 6: 5, 7: 'HV' }),
    ...[1, 2, 3, 4].map(i => row({ 1: 'HV_' + i, 2: '10,9', 3: String(106.7 + i * 0.0003).replace('.', ','), 6: 1 })),
    // Tuyến "LHP" không có tủ cùng tên → gốc = trụ đầu (LHP_1 theo thứ tự tên)
    ...[3, 1, 2].map(i => row({ 1: 'LHP_' + i, 2: '10,91', 3: String(106.7 + i * 0.0003).replace('.', ','), 6: 1 })),
    // Tuyến "NCT": tủ trùng TÊN với 1 trụ (NCT_1) → không lấy tủ đó làm gốc
    row({ 1: 'NCT_1', 2: '10,92', 3: '106,7', 6: 5, 7: 'NCT_1' }),
    ...[1, 2].map(i => row({ 1: 'NCT_' + i, 2: '10,92', 3: String(106.7 + i * 0.0003).replace('.', ','), 6: 1 })),
    // Tủ cùng tên nhưng ở xa > 500 m → không làm gốc
    row({ 1: 'XA', 2: '10,95', 3: '106,7', 6: 5, 7: 'XA' }),
    ...[1, 2].map(i => row({ 1: 'XA_' + i, 2: '10,9', 3: String(106.71 + i * 0.0003).replace('.', ','), 6: 1 })),
    row({ 1: 'HV_9', 6: 1 })   // không toạ độ
];
W.__rows = data; sb.run('loadedData = __rows;');

ok('theo tủ: không tủ nào đủ 2 node (trụ chưa gán tủ)', W._getUniqueCabinets().every(t => W._mstGetNodesForTu(t).length < 2));
const opts = W._mstRouteOptions();
ok('danh sách tuyến: HV, LHP, NCT, XA (bỏ trụ không toạ độ)', opts.map(o => o.label.split(' ')[0]).join(',') === 'HV,LHP,NCT,XA');
ok('nhãn tuyến kèm số trụ', opts[0].label === 'HV (4 trụ)');
const hv = W._mstGetNodesForTu('ten:hv');
ok('HV: 5 node = tủ HV (gốc) + 4 trụ', hv.length === 5 && hv[0].isRoot && hv[0].name === 'HV' && hv.filter(n => n.isRoot).length === 1);
const edges = W._mstPrim(hv);
ok('HV: MST 4 cạnh, xuất phát từ tủ', edges.length === 4 && edges[0].from === 'HV');
const lhp = W._mstGetNodesForTu('ten:lhp');
ok('LHP: không có tủ → gốc = trụ đầu theo tên (LHP_1)', lhp.length === 3 && lhp.find(n => n.isRoot).name === 'LHP_1');
const nct = W._mstGetNodesForTu('ten:nct');
ok('NCT: tủ trùng tên trụ không làm gốc → gốc = trụ NCT_1', nct.length === 2 && nct.find(n => n.isRoot).row[6] === 1);
const xa = W._mstGetNodesForTu('ten:xa');
ok('XA: tủ cùng tên xa > 500 m không làm gốc', xa.length === 2 && xa.every(n => +n.row[6] === 1));
// Diff dùng đúng tập node của tuyến (không lọc theo cột Tủ)
data[3][14] = 'HV'; data[3][15] = '33';   // HV_2 đã có Marker gốc
const d = W._mstDiff(W._mstPrim(W._mstGetNodesForTu('ten:hv')), 'ten:hv');
ok('diff theo tuyến: 4 cạnh mới/đổi tính trên trụ chưa gán tủ', d.added.length + d.changed.length + d.same.length === 4);
// Chế độ tủ vẫn như cũ
data[2][7] = 'HV'; data[3][7] = 'HV';
ok('chế độ tủ không đổi: tủ HV giờ có 3 node', W._mstGetNodesForTu('HV').length === 3);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
