// Đường tự vẽ (custom roads) — helpers thuần giữa mốc @@CUSTOMROADS_START/END (custom-roads.js)
// Run: node tests/custom-roads.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();   // index.html + src/*.js
    const m = src.match(/\/\/ @@CUSTOMROADS_START([\s\S]*?)\/\/ @@CUSTOMROADS_END/);
    if (!m) throw new Error('Chưa có block @@CUSTOMROADS_START/END');
    return new Function(m[1] + '\nreturn { _crCoordValid, _crRecordValid, _crEncodeGeom, _crDecodeGeom, _crToRoad, _crNearBounds, _crActive, _crNextId, _crRoadsForBounds, _crMergeInto };')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }

// === _crCoordValid ===
ok('coord hợp lệ (HCM)', H._crCoordValid([106.7, 10.77]));
ok('coord [lon,lat] đảo (lat ở [0]) → loại', !H._crCoordValid([10.77, 106.7]));
ok('coord NaN → loại', !H._crCoordValid([NaN, 10.77]));
ok('coord thiếu phần tử → loại', !H._crCoordValid([106.7]));
ok('coord ngoài VN → loại', !H._crCoordValid([0, 0]));

// === _crRecordValid ===
ok('record ≥2 điểm hợp lệ', H._crRecordValid({ coords: [[106.70, 10.77], [106.71, 10.78]] }));
ok('record 1 điểm → loại', !H._crRecordValid({ coords: [[106.70, 10.77]] }));
ok('record 0 điểm → loại', !H._crRecordValid({ coords: [] }));
ok('record có điểm rác → loại', !H._crRecordValid({ coords: [[106.70, 10.77], [999, 999]] }));
ok('record null → loại', !H._crRecordValid(null));

// === _crEncodeGeom / _crDecodeGeom (round-trip, làm tròn 6 số lẻ) ===
const g = [[106.700001234, 10.779999876], [106.71, 10.78]];
const enc = H._crEncodeGeom(g);
const dec = H._crDecodeGeom(enc);
ok('encode làm tròn 6 số lẻ', enc.indexOf('106.700001') >= 0 && enc.indexOf('1234') < 0);
ok('decode round-trip độ dài', dec.length === 2);
ok('decode round-trip giá trị', dec[1][0] === 106.71 && dec[1][1] === 10.78);
ok('decode JSON hỏng → []', Array.isArray(H._crDecodeGeom('{bad')) && H._crDecodeGeom('{bad').length === 0);
ok('decode lọc điểm rác', H._crDecodeGeom('[[0,0],[106.7,10.77]]').length === 1);

// === _crToRoad ===
const rd = H._crToRoad({ coords: [[106.7, 10.77]], tags: { highway: 'residential', name: 'Hẻm 124' } });
ok('toRoad giữ highway', rd.tags.highway === 'residential');
ok('toRoad giữ name', rd.tags.name === 'Hẻm 124');
ok('toRoad đánh dấu _custom', rd.tags._custom === true);
const rd2 = H._crToRoad({ coords: [[106.7, 10.77]] });
ok('toRoad mặc định highway=service', rd2.tags.highway === 'service');
ok('toRoad không tên → không field name', !('name' in rd2.tags));

// === _crNearBounds (clip) ===
const bounds = { minLat: 10.75, minLon: 106.65, maxLat: 10.76, maxLon: 106.66 };
ok('đường có đỉnh trong bounds → giữ', H._crNearBounds([[106.655, 10.755], [107.0, 11.0]], bounds, 0));
ok('đường ngoài bounds (margin 0) → bỏ', !H._crNearBounds([[106.70, 10.80]], bounds, 0));
ok('đường gần bounds trong margin → giữ', H._crNearBounds([[106.6505, 10.7505]], bounds, 0.002));

// === _crActive (lọc sheet + soft delete) ===
const recs = [
    { id: 'CR_Quan5_001', sheet: 'Quan5', status: '', coords: [[106.7, 10.77]] },
    { id: 'CR_Quan5_002', sheet: 'Quan5', status: 'xoa', coords: [[106.7, 10.77]] },
    { id: 'CR_Quan1_001', sheet: 'Quan1', status: '', coords: [[106.7, 10.77]] },
];
ok('active lọc đúng sheet + bỏ đã xóa', H._crActive(recs, 'Quan5').length === 1 && H._crActive(recs, 'Quan5')[0].id === 'CR_Quan5_001');
ok('active sheet rỗng → tất cả chưa xóa', H._crActive(recs, '').length === 2);
ok('active không phải mảng → []', H._crActive(null, 'Quan5').length === 0);

// === _crNextId ===
ok('nextId đầu tiên', H._crNextId('Quan5', []) === 'CR_Quan5_001');
ok('nextId tránh trùng', H._crNextId('Quan5', ['CR_Quan5_001', 'CR_Quan5_002']) === 'CR_Quan5_003');
ok('nextId điền khoảng trống', H._crNextId('Quan5', ['CR_Quan5_001', 'CR_Quan5_003']) === 'CR_Quan5_002');

// === _crRoadsForBounds (tích hợp active + clip + toRoad) ===
const recs2 = [
    { id: 'A', sheet: 'Quan5', status: '', coords: [[106.655, 10.755], [106.656, 10.756]], tags: { highway: 'service' } },
    { id: 'B', sheet: 'Quan5', status: 'xoa', coords: [[106.655, 10.755]], tags: {} },
    { id: 'C', sheet: 'Quan5', status: '', coords: [[107.5, 11.4]], tags: {} },  // xa bounds
    { id: 'D', sheet: 'Quan1', status: '', coords: [[106.655, 10.755]], tags: {} }, // khác sheet
];
const res = H._crRoadsForBounds(recs2, 'Quan5', bounds, 0.001);
ok('roadsForBounds chỉ còn A (active+đúng sheet+trong bounds)', res.roads.length === 1);
ok('roadsForBounds trả shape {roads:[{coords,tags}]}', Array.isArray(res.roads) && res.roads[0].coords.length === 2 && res.roads[0].tags.highway === 'service');

// === _crMergeInto ===
const base = { roads: [{ coords: [[1, 1]], tags: {} }], buildings: [] };
const merged = H._crMergeInto(base, [{ coords: [[2, 2]], tags: { _custom: true } }]);
ok('merge nối custom vào roads', merged.roads.length === 2 && merged.roads[1].tags._custom === true);
ok('merge giữ field khác (buildings)', Array.isArray(merged.buildings));
const merged2 = H._crMergeInto(null, [{ coords: [[2, 2]], tags: {} }]);
ok('merge result null → tạo mảng roads', merged2.roads.length === 1);
ok('merge custom rỗng → giữ nguyên', H._crMergeInto({ roads: [{ a: 1 }] }, []).roads.length === 1);

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
