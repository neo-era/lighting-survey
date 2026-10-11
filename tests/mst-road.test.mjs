// Auto MST — cáp đi dọc tuyến, hạn chế băng qua tim đường OSM (v176). Run: node tests/mst-road.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);
const W = sb.ctx;
const drivable = t => !!t.highway && t.highway !== 'footway';

// ── Hình học: đường ngang lat=10.0 ──
const road = (lat, lon0 = 106.0, lon1 = 106.01, hw = 'primary', name = 'Võ Văn Kiệt') => ({ coords: [[lon0, lat], [lon1, lat]], tags: { highway: hw, name } });
// Hẻm đâm ngang (bắc–nam) tại kinh độ lon, từ lat 10.0 lên phía bắc
const hem = (lon, name = 'Hẻm 980') => ({ coords: [[lon, 10.0], [lon, 10.003]], tags: { highway: 'service', name } });
const P = (name, lat, lon) => ({ name, lat, lon });
let cnt = W._mstRoadCrossCounter([road(10.0)], drivable);
ok('đoạn cắt tim đường → 1', cnt(P('a', 10.0002, 106.001), P('b', 9.9998, 106.001)) === 1);
ok('đoạn cùng một bên → 0', cnt(P('a', 10.0002, 106.001), P('b', 10.0003, 106.003)) === 0);
ok('đoạn ngoài phạm vi đường (vượt đầu mút) → 0', cnt(P('a', 10.0002, 106.02), P('b', 9.9998, 106.02)) === 0);
ok('trụ nằm ngay trên tim (chạm đầu mút) → 0', cnt(P('a', 10.0, 106.001), P('b', 10.0003, 106.001)) === 0);
cnt = W._mstRoadCrossCounter([road(10.0), road(10.0001)], drivable);
ok('đường đôi (2 tim) → 2', cnt(P('a', 10.0003, 106.001), P('b', 9.9997, 106.001)) === 2);
cnt = W._mstRoadCrossCounter([road(10.0, 106.0, 106.001), road(10.0, 106.001, 106.002)], drivable);
ok('cắt đúng nút nối 2 way → gộp 1', cnt(P('a', 10.0002, 106.001), P('b', 9.9998, 106.001)) === 1);
cnt = W._mstRoadCrossCounter([road(10.0, 106.0, 106.01, 'footway')], drivable);
ok('đường đi bộ (không phải xe chạy) → 0', cnt(P('a', 10.0002, 106.001), P('b', 9.9998, 106.001)) === 0);
ok('không có đường → luôn 0', W._mstRoadCrossCounter([], drivable)(P('a', 1, 1), P('b', 2, 2)) === 0);
// Quy tắc "đường đi dọc": chỉ phạt khi băng qua đường gần trụ nhất (gom theo tên)
cnt = W._mstRoadCrossCounter([road(10.0), hem(106.002)], drivable);
ok('đi dọc 1 bên, cắt qua hẻm đâm ngang → 0 (không phạt)', cnt(P('a', 10.0002, 106.0015), P('b', 10.0002, 106.0025)) === 0);
ok('băng qua chính đường đang đi dọc → 1', cnt(P('a', 10.0002, 106.0015), P('b', 9.9998, 106.0015)) === 1);
cnt = W._mstRoadCrossCounter([road(10.0, 106.0, 106.01, 'primary', 'Đường Võ Văn Kiệt'), road(10.0001, 106.0, 106.01, 'trunk', 'võ văn kiệt')], drivable);
ok('2 làn tên "Đường Võ Văn Kiệt" / "võ văn kiệt" là 1 đường → băng cả 2 = 2', cnt(P('a', 10.0003, 106.001), P('b', 9.9997, 106.001)) === 2);
cnt = W._mstRoadCrossCounter([road(10.0)], drivable);
ok('trụ cách mọi đường > 40 m → không phạt', cnt(P('a', 10.001, 106.001), P('b', 10.0012, 106.003)) === 0);

// ── MST: trụ 2 bên đại lộ, ngang 30 m < dọc 44 m ──
const N = [{ name: 'TU', lat: 10.000135, lon: 106.0001, isRoot: true }];
for (let i = 1; i <= 8; i++) {
    N.push({ name: 'A' + i, lat: 10.000135, lon: 106.0001 + i * 0.0004 + (i % 2) * 0.00005 });
    N.push({ name: 'B' + i, lat: 9.999865, lon: 106.0001 + i * 0.0004 - 0.0001 });
}
cnt = W._mstRoadCrossCounter([road(10.0)], drivable);
const by = n => N.find(x => x.name === n);
const crossOf = es => es.reduce((s, e) => s + cnt(by(e.from), by(e.to)), 0);
for (const algo of ['_mstPrim', '_mstNearestChain']) {
    const plain = W[algo](N), road1 = W[algo](N, { cross: cnt, penalty: 200 });
    ok(`${algo}: không phạt → băng đường nhiều lần (${crossOf(plain)})`, crossOf(plain) >= 5);
    ok(`${algo}: phạt 200 m → chỉ băng 1 lần`, crossOf(road1) === 1 && road1.filter(e => e.cross > 0).length === 1);
    ok(`${algo}: vẫn nối đủ ${N.length - 1} đoạn`, road1.length === N.length - 1 && new Set(road1.map(e => e.to)).size === N.length - 1);
    ok(`${algo}: số mét = khoảng cách thật (không cộng phí)`, road1.every(e => e.dist === W.haversineM(by(e.from).lat, by(e.from).lon, by(e.to).lat, by(e.to).lon)));
    ok(`${algo}: phí 0 / không opts → kết quả như cũ`, JSON.stringify(W[algo](N, { cross: cnt, penalty: 0 }).map(e => e.to)) === JSON.stringify(plain.map(e => e.to)));
}
ok('phạt nhỏ (5 m) không đủ → vẫn băng nhiều', crossOf(W._mstPrim(N, { cross: cnt, penalty: 5 })) > 1);

// ── Luồng xem trước trong modal ──
const row = (id, name, lat, lon, type, tu, parent) => { const r = new Array(30).fill(''); Object.assign(r, { 0: id, 1: name, 2: String(lat), 3: String(lon), 6: String(type), 7: tu, 14: parent || '' }); return r; };
W.__rows = [new Array(30).fill('h'), ...N.map((n, i) => row('X' + i, n.name, n.lat, n.lon, n.isRoot ? 5 : 1, 'TU', n.isRoot ? '' : 'TU'))];
sb.run('loadedData = __rows;');
const els = {};
const el = id => els[id] || (els[id] = { id, value: '', checked: false, textContent: '', innerHTML: '', disabled: false, style: {} });
el('mstAvoidRoad').checked = true; el('mstCrossPenalty').value = '200'; el('mstAlgo').value = 'prim'; el('mstMaxSegment').value = '200';
els.mstTuSelect = { selectedOptions: [{ value: 'TU' }], options: [] };
W.document = Object.assign(W.document || {}, { getElementById: el });
let fetched = 0;
W._raFetchRoads = async () => { fetched++; return { roads: [road(10.0)] }; };
const layer = { addTo() { return this; }, getBounds() { return { pad() { return this; } }; } };
W.L = { layerGroup: () => layer, polyline: () => layer, marker: () => layer, divIcon: () => ({}) };
W.map = { fitBounds() {}, removeLayer() {} };
await W._mstDoPreview();
const res = sb.run('_mstResult');
ok('xem trước: tải đường OSM 1 lần', fetched === 1);
ok('xem trước: MST mới chỉ 1 đoạn băng đường', res && res.edges.filter(e => e.cross > 0).length === 1);
ok('xem trước: báo "1 đoạn băng qua đường (cáp hiện tại: 8)"', /1 đoạn băng qua đường/.test(els.mstPreview.innerHTML) && /cáp hiện tại: 8/.test(els.mstPreview.innerHTML));
// OSM lỗi → báo + tính như cũ
W._raFetchRoads = async () => { throw new Error('Overpass HTTP 504'); };
let errMsg = ''; W.displayError = m => { errMsg = m; };
await W._mstDoPreview();
const res2 = sb.run('_mstResult');
ok('OSM lỗi: báo lỗi + vẫn ra MST theo khoảng cách', /Không tải được đường OSM/.test(errMsg) && res2.edges.length === N.length - 1 && !/băng qua đường/.test(els.mstPreview.innerHTML));
// Tắt tuỳ chọn → không tải OSM
fetched = 0; W._raFetchRoads = async () => { fetched++; return { roads: [road(10.0)] }; };
el('mstAvoidRoad').checked = false;
await W._mstDoPreview();
ok('tắt "Tránh băng qua đường": không tải OSM', fetched === 0);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
