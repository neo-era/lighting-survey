// Nền OSM dựng sẵn — helpers thuần giữa mốc @@OSMPREBUILT_START/END (osm-prebuilt.js)
// Run: node tests/osm-prebuilt.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();   // index.html + src/*.js
    const m = src.match(/\/\/ @@OSMPREBUILT_START([\s\S]*?)\/\/ @@OSMPREBUILT_END/);
    if (!m) throw new Error('Chưa có block @@OSMPREBUILT_START/END');
    return new Function(m[1] + '\nreturn { PB_TAG_MAP, _pbRecordToRoad, _pbTileKeysForBounds };')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }

// === _pbRecordToRoad ===
const r1 = H._pbRecordToRoad({ h: 'primary', n: 'Lý Tự Trọng', ln: '2', c: [[106.7, 10.77], [106.71, 10.78]] });
ok('map highway', r1.tags.highway === 'primary');
ok('map name (dấu TV)', r1.tags.name === 'Lý Tự Trọng');
ok('map lanes', r1.tags.lanes === '2');
ok('coords passthrough', r1.coords.length === 2 && r1.coords[0][0] === 106.7);
ok('key thiếu → không có tag', !('width' in r1.tags) && !('bridge' in r1.tags));
const r2 = H._pbRecordToRoad({ h: 'service', w: '4', br: 'yes', ly: '1', c: [] });
ok('map width/bridge/layer', r2.tags.width === '4' && r2.tags.bridge === 'yes' && r2.tags.layer === '1');
ok('coords rỗng → []', Array.isArray(r2.coords) && r2.coords.length === 0);

// === _pbTileKeysForBounds ===
const index = {
    bbox: { minLon: 106.25, minLat: 10.15, maxLon: 107.65, maxLat: 11.50 },
    tileDeg: 0.1,
    tiles: { '4_6': { n: 1 }, '3_6': { n: 1 }, '5_6': { n: 1 }, '4_5': { n: 1 }, '4_7': { n: 1 }, '3_5': { n: 1 }, '5_7': { n: 1 }, '3_7': { n: 1 }, '5_5': { n: 1 } }
};
const q1 = { minLat: 10.772, minLon: 106.695, maxLat: 10.782, maxLon: 106.705 };

const k0 = H._pbTileKeysForBounds(index, q1, 0);
ok('pad=0 → đúng ô 4_6', k0.length === 1 && k0[0] === '4_6');

const k1 = H._pbTileKeysForBounds(index, q1, 1);
ok('pad=1 → 9 ô quanh (đều có trong index)', k1.length === 9 && k1.includes('4_6') && k1.includes('3_5') && k1.includes('5_7'));

// chỉ trả ô CÓ trong index
const sparse = { bbox: index.bbox, tileDeg: 0.1, tiles: { '4_6': { n: 1 } } };
const kS = H._pbTileKeysForBounds(sparse, q1, 1);
ok('bỏ ô không tồn tại trong index', kS.length === 1 && kS[0] === '4_6');

// bounds trải 2 ô theo chiều lon
const span = { minLat: 10.772, minLon: 106.695, maxLat: 10.782, maxLon: 106.805 }; // col 4→5
const kSpan = H._pbTileKeysForBounds(index, span, 0);
ok('bounds trải 2 ô → 4_6 và 5_6', kSpan.includes('4_6') && kSpan.includes('5_6') && kSpan.length === 2);

// bounds ngoài bbox dữ liệu → rỗng
const far = { minLat: 20.0, minLon: 120.0, maxLat: 20.1, maxLon: 120.1 };
ok('ngoài vùng → rỗng', H._pbTileKeysForBounds(index, far, 1).length === 0);

// guard đầu vào
ok('index null → []', H._pbTileKeysForBounds(null, q1, 1).length === 0);
ok('bounds null → []', H._pbTileKeysForBounds(index, null, 1).length === 0);

console.log('\n=== ' + pass + ' pass / ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
