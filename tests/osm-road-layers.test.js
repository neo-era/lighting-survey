// Đường OSM theo lớp — helpers giữa marker @@OSMROAD_START/END trong index.html
// Run: node tests/osm-road-layers.test.js
const fs = require('fs');
const path = require('path');

function load() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const m = html.match(/\/\/ @@OSMROAD_START([\s\S]*?)\/\/ @@OSMROAD_END/);
    if (!m) throw new Error('Chưa có block @@OSMROAD_START/END trong index.html');
    return new Function(m[1] + '\nreturn { OSM_ROAD_WIDTH_DEFAULTS, _osmRoadWidth, _offsetPolyline, _roadLabelPlacement, _labelTooClose, _chainRuns, _osmRoadIsOther, _mergeRoadChains, _corridorIndex, _trimEdgeRun, _osmRoadLayer };')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== Result: 0 pass / 1 fail ==='); process.exit(1); }

const D = { major: 14, secondary: 10, residential: 6, service: 4 };
// === Bề rộng ===
ok('mặc định có đủ 4 cấp', ['major', 'secondary', 'residential', 'service'].every(k => H.OSM_ROAD_WIDTH_DEFAULTS[k] > 0));
ok('width tag số', H._osmRoadWidth({ highway: 'primary', width: '12' }, D) === 12);
ok('width "8 m"', H._osmRoadWidth({ highway: 'residential', width: '8 m' }, D) === 8);
ok('width "7,5" dấu phẩy', H._osmRoadWidth({ highway: 'residential', width: '7,5' }, D) === 7.5);
ok('width rác → bỏ qua, dùng lanes', H._osmRoadWidth({ highway: 'primary', width: 'abc', lanes: '4' }, D) === 14);
ok('width 0 → bỏ qua', H._osmRoadWidth({ highway: 'service', width: '0' }, D) === 4);
ok('width 500 → bỏ qua', H._osmRoadWidth({ highway: 'service', width: '500' }, D) === 4);
ok('lanes 2 → 7m', H._osmRoadWidth({ highway: 'primary', lanes: '2' }, D) === 7);
ok('lanes 30 → bỏ qua', H._osmRoadWidth({ highway: 'primary', lanes: '30' }, D) === 14);
ok('primary → major', H._osmRoadWidth({ highway: 'primary' }, D) === 14);
ok('trunk → major', H._osmRoadWidth({ highway: 'trunk' }, D) === 14);
ok('tertiary → secondary', H._osmRoadWidth({ highway: 'tertiary' }, D) === 10);
ok('residential → 6', H._osmRoadWidth({ highway: 'residential' }, D) === 6);
ok('service → 4', H._osmRoadWidth({ highway: 'service' }, D) === 4);
ok('primary_link → residential', H._osmRoadWidth({ highway: 'primary_link' }, D) === 6);
ok('construction=primary → major', H._osmRoadWidth({ highway: 'construction', construction: 'primary' }, D) === 14);
ok('construction không ghi cấp → residential', H._osmRoadWidth({ highway: 'construction' }, D) === 6);
ok('defaults thiếu → dùng mặc định hệ thống', H._osmRoadWidth({ highway: 'primary' }, null) === H.OSM_ROAD_WIDTH_DEFAULTS.major);

// === Dời song song ===
const straight = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
const L = H._offsetPolyline(straight, 3), R = H._offsetPolyline(straight, -3);
ok('thẳng: trái y=+3', L.length === 2 && near(L[0].y, 3) && near(L[1].y, 3) && near(L[1].x, 10));
ok('thẳng: phải y=-3', near(R[0].y, -3) && near(R[1].y, -3));
// Góc vuông (0,0)→(10,0)→(10,10): mép trái đi qua (7,3) — miter
const corner = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
const Lc = H._offsetPolyline(corner, 3);
ok('góc vuông: 3 điểm', Lc.length === 3);
ok('góc vuông: điểm góc miter (7,3)', near(Lc[1].x, 7) && near(Lc[1].y, 3));
ok('góc vuông: điểm cuối (7,10)', near(Lc[2].x, 7) && near(Lc[2].y, 10));
// Mọi điểm của mép cách tim đúng 3m (với đoạn tương ứng)
const dSeg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const curve = [{ x: 0, y: 0 }, { x: 20, y: 2 }, { x: 40, y: 10 }, { x: 55, y: 25 }];
const Lcur = H._offsetPolyline(curve, 4);
ok('đường cong: điểm mép cách tim ≈ 4m', Lcur.every(p => { const d = Math.min(...curve.slice(1).map((b, i) => dSeg(p, curve[i], b))); return d > 3.9 && d < 4.6; }));
// Góc gắt (quay đầu ~170°) → không bắn xa
const hairpin = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }];
const Lh = H._offsetPolyline(hairpin, 3);
ok('góc gắt: điểm mép không xa tim quá 4×d', Lh.every(p => Math.hypot(p.x - 5, p.y) < 20));
// Điểm trùng liên tiếp
const dup = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }];
const Ld = H._offsetPolyline(dup, 2);
ok('bỏ điểm trùng: 2 điểm, y=+2', Ld.length === 2 && near(Ld[0].y, 2));
ok('1 điểm → rỗng', H._offsetPolyline([{ x: 1, y: 1 }], 2).length === 0);

// Đường khép kín (vòng xuyến): điểm đầu = cuối, mép không bị khấc ở chỗ nối
const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
const Ls = H._offsetPolyline(sq, 2);
ok('khép kín: điểm đầu = điểm cuối', Ls.length >= 2 && near(Ls[0].x, Ls[Ls.length - 1].x) && near(Ls[0].y, Ls[Ls.length - 1].y));
ok('khép kín: góc nối được miter (2,2)', near(Ls[0].x, 2) && near(Ls[0].y, 2));

// === Tách chuỗi đoạn liên tục (để ghi POLYLINE, nét CENTER chạy liền) ===
const runs = H._chainRuns([
    { x1: 0, y1: 0, x2: 5, y2: 0 }, { x1: 5, y1: 0, x2: 9, y2: 3 },   // liền
    null,                                                             // bị cắt khỏi khung
    { x1: 20, y1: 0, x2: 25, y2: 0 }, { x1: 26, y1: 0, x2: 30, y2: 0 }  // đứt (25 ≠ 26)
]);
ok('chuỗi: 3 run', runs.length === 3);
ok('chuỗi: run 1 có 3 điểm nối liền', runs[0].length === 3 && near(runs[0][2].x, 9));
ok('chuỗi: run 2 bắt đầu sau đoạn bị cắt', near(runs[1][0].x, 20) && runs[1].length === 2);
ok('chuỗi: rỗng → []', H._chainRuns([]).length === 0 && H._chainRuns([null, null]).length === 0);

// === Vị trí nhãn: giữa chiều dài cả đường ===
const lp = H._roadLabelPlacement([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 60 }], 30);
ok('nhãn ở giữa chiều dài (tổng 65 → điểm (5,27.5))', lp && near(lp.x, 5) && near(lp.y, 27.5));
ok('nhãn đoạn dọc → rot 90', lp && near(lp.rot, 90));
// Đường nhiều nút ngắn (mỗi đoạn 8m, tổng 80m) vẫn có nhãn
const dense = []; for (let i = 0; i <= 10; i++) dense.push({ x: i * 8, y: 0 });
const lpd = H._roadLabelPlacement(dense, 30);
ok('đường nhiều nút ngắn vẫn có nhãn ở giữa (40,0)', lpd && near(lpd.x, 40) && near(lpd.y, 0));
const lp2 = H._roadLabelPlacement([{ x: 100, y: 0 }, { x: 0, y: 0 }], 30);
ok('đường hướng Tây → chữ không lộn ngược (rot 0)', lp2 && near(lp2.rot, 0));
const lp3 = H._roadLabelPlacement([{ x: 0, y: 100 }, { x: 0, y: 0 }], 30);
ok('đường hướng Nam → rot 90 (không -90)', lp3 && near(lp3.rot, 90));
const lp4 = H._roadLabelPlacement([{ x: 50, y: 50 }, { x: 0, y: 0 }], 30);
ok('đường hướng Tây Nam → rot 45', lp4 && near(lp4.rot, 45));
ok('đường ngắn hơn minLen → null', H._roadLabelPlacement([{ x: 0, y: 0 }, { x: 10, y: 0 }], 30) === null);

// === Chống lặp nhãn ===
const placed = [{ name: 'Lê Văn Quới', x: 0, y: 0 }];
ok('cùng tên trong 100m → quá gần', H._labelTooClose(placed, 'Lê Văn Quới', 50, 0, 100));
ok('cùng tên ngoài 100m → được đặt', !H._labelTooClose(placed, 'Lê Văn Quới', 150, 0, 100));
ok('khác tên gần → được đặt', !H._labelTooClose(placed, 'Tân Kỳ Tân Quý', 10, 0, 100));

// === v156: Đường khác ===
ok('footway là đường khác', H._osmRoadIsOther({ highway: 'footway' }));
ok('steps là đường khác', H._osmRoadIsOther({ highway: 'steps' }));
ok('service=parking_aisle là đường khác', H._osmRoadIsOther({ highway: 'service', service: 'parking_aisle' }));
ok('service thường KHÔNG phải đường khác', !H._osmRoadIsOther({ highway: 'service' }));
ok('residential KHÔNG phải đường khác', !H._osmRoadIsOther({ highway: 'residential' }));
ok('proposed KHÔNG vẽ', !H._osmRoadIsOther({ highway: 'proposed' }));
ok('construction KHÔNG phải đường khác', !H._osmRoadIsOther({ highway: 'construction' }));

// === v156: Ghép đoạn nối tiếp ===
const P = (x, y) => ({ x, y });
let mg = H._mergeRoadChains([
    { pts: [P(0, 0), P(10, 0)], width: 6 },
    { pts: [P(10, 0), P(20, 5)], width: 6 }
]);
ok('ghép: 2 way nối tiếp → 1 chuỗi 3 điểm', mg.length === 1 && mg[0].pts.length === 3 && near(mg[0].pts[2].x, 20));
mg = H._mergeRoadChains([
    { pts: [P(0, 0), P(10, 0)], width: 6 },
    { pts: [P(20, 5), P(10, 0)], width: 6 }   // ngược chiều
]);
ok('ghép: way ngược chiều vẫn ghép đúng thứ tự', mg.length === 1 && mg[0].pts.length === 3 &&
    ((near(mg[0].pts[0].x, 0) && near(mg[0].pts[2].x, 20)) || (near(mg[0].pts[0].x, 20) && near(mg[0].pts[2].x, 0))) && near(mg[0].pts[1].x, 10));
mg = H._mergeRoadChains([
    { pts: [P(0, 0), P(10, 0)], width: 6 },
    { pts: [P(10, 0), P(20, 0)], width: 6 },
    { pts: [P(10, 0), P(10, 10)], width: 6 }   // ngã ba tại (10,0)
]);
ok('ghép: ngã ba (3 đầu way) → không ghép', mg.length === 3);
mg = H._mergeRoadChains([
    { pts: [P(0, 0), P(10, 0)], width: 6 },
    { pts: [P(10, 0), P(20, 0)], width: 10 }
]);
ok('ghép: khác bề rộng → không ghép', mg.length === 2);
mg = H._mergeRoadChains([
    { pts: [P(0, 0), P(10, 0), P(10, 10)], width: 6 },
    { pts: [P(10, 10), P(0, 10), P(0, 0)], width: 6 }   // vòng kín 2 way
]);
ok('ghép: vòng kín 2 way → 1 chuỗi, không lặp vô hạn', mg.length === 1 && mg[0].pts.length === 5);
mg = H._mergeRoadChains([
    { pts: [P(0, 0), P(10, 0)], width: 6 }, { pts: [P(10, 0), P(20, 0)], width: 6 },
    { pts: [P(20, 0), P(30, 0)], width: 6 }, { pts: [P(30, 0), P(40, 0)], width: 6 }
]);
ok('ghép: 4 way nối tiếp → 1 chuỗi 5 điểm', mg.length === 1 && mg[0].pts.length === 5);

// === v156: Cắt mép trong lòng tuyến khác ===
// Ngã ba: A trục X (-50..50, rộng 6), B từ (0,0) lên (0,50) (rộng 6)
const corr = H._corridorIndex([
    { pts: [P(-50, 0), P(50, 0)], hw: 3, id: 'A' },
    { pts: [P(0, 0), P(0, 50)], hw: 3, id: 'B' }
], 20);
const runsBL = H._trimEdgeRun([P(-3, 0), P(-3, 50)], corr, 'B');
ok('ngã ba: mép trái B bắt đầu tại mép A (y≈3)', runsBL.length === 1 && Math.abs(Math.min(runsBL[0][0].y, runsBL[0][runsBL[0].length - 1].y) - 3) <= 0.06);
const runsAT = H._trimEdgeRun([P(-50, 3), P(50, 3)], corr, 'A');
ok('ngã ba: mép trên A bị mở ở chỗ B nhập vào → 2 đoạn', runsAT.length === 2);
const xs = runsAT.flat().map(p => p.x).sort((a, b) => a - b);
ok('ngã ba: khe hở mép trên A từ x≈-3 đến x≈3', xs.some(x => Math.abs(x + 3) <= 0.06) && xs.some(x => Math.abs(x - 3) <= 0.06) && !xs.some(x => x > -2.9 && x < 2.9));
const runsAB = H._trimEdgeRun([P(-50, -3), P(50, -3)], corr, 'A');
ok('ngã ba: mép dưới A không bị cắt (1 đoạn đủ dài)', runsAB.length === 1 && Math.abs(runsAB[0][0].x - runsAB[0][runsAB[0].length - 1].x) > 99.9);
// Ngã tư: thêm C từ (0,0) xuống (0,-50)
const corr4 = H._corridorIndex([
    { pts: [P(-50, 0), P(50, 0)], hw: 3, id: 'A' },
    { pts: [P(0, -50), P(0, 50)], hw: 3, id: 'B' }
], 20);
ok('ngã tư: cả 2 mép A đều mở → 2 đoạn mỗi mép',
    H._trimEdgeRun([P(-50, 3), P(50, 3)], corr4, 'A').length === 2 && H._trimEdgeRun([P(-50, -3), P(50, -3)], corr4, 'A').length === 2);
// Không có tuyến khác → giữ nguyên
const corr1 = H._corridorIndex([{ pts: [P(-50, 0), P(50, 0)], hw: 3, id: 'A' }], 20);
const solo = H._trimEdgeRun([P(-50, 3), P(0, 3), P(50, 3)], corr1, 'A');
ok('không tuyến khác: giữ nguyên điểm gốc', solo.length === 1 && solo[0].length === 3);
ok('đầu vào < 2 điểm → []', H._trimEdgeRun([P(0, 0)], corr1, 'A').length === 0);
// Tuyến RỘNG (hw 7) đâm vào tuyến hẹp (hw 3): mép xa của tuyến hẹp KHÔNG bị khoét (đầu mút bằng, không tròn)
const corrW = H._corridorIndex([
    { pts: [P(-50, 0), P(50, 0)], hw: 3, id: 'A' },
    { pts: [P(0, 0), P(0, 50)], hw: 7, id: 'B' }
], 20);
const farA = H._trimEdgeRun([P(-50, -3), P(50, -3)], corrW, 'A');
ok('tuyến rộng đâm vào: mép xa không bị khoét (1 đoạn)', farA.length === 1);
const nearA = H._trimEdgeRun([P(-50, 3), P(50, 3)], corrW, 'A');
ok('tuyến rộng đâm vào: mép gần mở đúng bề rộng nhánh (±7)', nearA.length === 2 &&
    nearA.flat().some(p => Math.abs(p.x + 7) <= 0.06) && nearA.flat().some(p => Math.abs(p.x - 7) <= 0.06));
// Nối đầu-đuôi 2 tuyến khác bề rộng: mép tuyến hẹp không bị kéo lùi vào "đầu tròn" của tuyến rộng
const corrS = H._corridorIndex([
    { pts: [P(-50, 0), P(0, 0)], hw: 7, id: 'W' },
    { pts: [P(0, 0), P(50, 0)], hw: 3, id: 'N' }
], 20);
const nEdge = H._trimEdgeRun([P(0, 3), P(50, 3)], corrS, 'N');
ok('đổi bề rộng đầu-đuôi: mép tuyến hẹp giữ nguyên từ x=0', nEdge.length === 1 && Math.abs(Math.min(nEdge[0][0].x, nEdge[0][nEdge[0].length - 1].x)) <= 0.01);
// Cầu vượt: 2 tuyến khác tầng giao nhau không có nút chung → không cắt
const corrL = H._corridorIndex([
    { pts: [P(-50, 0), P(50, 0)], hw: 3, id: 'A', layer: 0 },
    { pts: [P(0, -50), P(0, 50)], hw: 3, id: 'Bridge', layer: 1 }
], 20);
ok('cầu vượt khác tầng: mép không bị cắt', H._trimEdgeRun([P(-50, 3), P(50, 3)], corrL, 'A', 0).length === 1);
ok('cùng tầng vẫn cắt bình thường', H._trimEdgeRun([P(-50, 3), P(50, 3)], H._corridorIndex([
    { pts: [P(-50, 0), P(50, 0)], hw: 3, id: 'A', layer: 1 }, { pts: [P(0, -50), P(0, 50)], hw: 3, id: 'B', layer: 1 }], 20), 'A', 1).length === 2);
// Ghép đoạn không nối qua 2 tầng khác nhau (đầu cầu)
ok('ghép: khác tầng → không ghép', H._mergeRoadChains([
    { pts: [P(0, 0), P(10, 0)], width: 6, layer: 0 }, { pts: [P(10, 0), P(20, 0)], width: 6, layer: 1 }]).length === 2);
ok('tầng từ tag: bridge=yes không ghi layer → 1, tunnel → -1, thường → 0',
    H._osmRoadLayer({ bridge: 'yes' }) === 1 && H._osmRoadLayer({ tunnel: 'yes' }) === -1 && H._osmRoadLayer({}) === 0 && H._osmRoadLayer({ layer: '2', bridge: 'yes' }) === 2);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
