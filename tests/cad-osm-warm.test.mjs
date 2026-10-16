// Tải sẵn nền OSM khi mở modal Xuất CAD (_cgWarmOsm / _cgScheduleWarmOsm / _cgOsmBboxForFilters).
// Xem docs/design-fix-cad-export-slow.md
// Run: node tests/cad-osm-warm.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (c || x === undefined ? '' : ' → ' + JSON.stringify(x))); };
const sb = loadAppSandbox();
ok('sandbox nạp không lỗi', sb.errors.length === 0, sb.errors);
// Sandbox thay setTimeout bằng hàm rỗng (chặn hẹn giờ lúc nạp app) — debounce cần hẹn giờ thật
sb.ctx.setTimeout = setTimeout; sb.ctx.clearTimeout = clearTimeout;

// --- DOM tối thiểu ---
const els = {
    cadGeneratorModal: { style: { display: 'flex' } },
    cgOrientByRoad: { checked: false }
};
const realGet = sb.ctx.document.getElementById;
sb.ctx.document.getElementById = id => els[id] || (realGet ? realGet.call(sb.ctx.document, id) : null);

// --- Dữ liệu: 3 trụ, 1 trụ ngoại lai ở xa ---
const ROWS = [
    ['1', 'A', '10.760', '106.660'],
    ['2', 'B', '10.761', '106.661'],
    ['3', 'OUT', '10.900', '106.800']
];
sb.ctx._filterRowsForCadExport = () => ROWS;

let osmOn = true;
sb.ctx._cgCollectOsmOpts = () => (osmOn ? { roads: true, buildings: false, water: false, admin: false } : null);
const fetched = [];
sb.ctx._fetchOsmBasemap = (bbox, opts, signal, extra) => { fetched.push({ bbox, opts, signal, extra }); return Promise.resolve({ roads: [] }); };
sb.run('_osmFetchLastMs = 0');

// 1. Khung tải sẵn bao chứa khung lúc xuất khi bỏ điểm ngoại lai (khung con)
const full = sb.ctx._cgOsmBboxForFilters({});
sb.ctx._filterRowsForCadExport = () => ROWS.slice(0, 2);   // mô phỏng đã loại 'OUT'
const sub = sb.ctx._cgOsmBboxForFilters({});
sb.ctx._filterRowsForCadExport = () => ROWS;
const contains = full.minLat <= sub.minLat && full.maxLat >= sub.maxLat && full.minLon <= sub.minLon && full.maxLon >= sub.maxLon;
ok('khung tải sẵn BAO CHỨA khung lúc xuất khi loại điểm ngoại lai', contains, { full, sub });
ok('khung đệm ±0.001° như lúc xuất', Math.abs(full.minLat - (10.760 - 0.001)) < 1e-9 && Math.abs(full.maxLon - (106.800 + 0.001)) < 1e-9, full);

// 2. Bật OSM → tải sẵn im lặng, không truyền signal
fetched.length = 0;
sb.ctx._cgWarmOsm();
ok('bật nền OSM → gọi tải sẵn 1 lần', fetched.length === 1, fetched.length);
ok('tải sẵn chạy im lặng (quiet), không gắn signal', fetched[0] && fetched[0].extra && fetched[0].extra.quiet === true && fetched[0].signal === undefined);
ok('tải đúng lớp đường', fetched[0] && fetched[0].opts.roads === true && fetched[0].opts.buildings === false, fetched[0] && fetched[0].opts);

// 3. Tắt OSM, tắt hướng theo đường → không tải
fetched.length = 0; osmOn = false; els.cgOrientByRoad.checked = false;
sb.ctx._cgWarmOsm();
ok('không dùng OSM → không tải gì', fetched.length === 0, fetched.length);

// 4. Chỉ bật hướng theo đường → vẫn cần đường
fetched.length = 0; els.cgOrientByRoad.checked = true;
sb.ctx._cgWarmOsm();
ok('chỉ bật hướng theo đường → vẫn tải sẵn đường', fetched.length === 1 && fetched[0].opts.roads === true);
els.cgOrientByRoad.checked = false; osmOn = true;

// 5. Modal đã đóng → không tải
fetched.length = 0; els.cadGeneratorModal.style.display = 'none';
sb.ctx._cgWarmOsm();
ok('modal đã đóng → không tải', fetched.length === 0);
els.cadGeneratorModal.style.display = 'flex';

// 6. Vừa có request trong 5s → KHÔNG gọi (tránh lỗi rate-limit), hẹn lại
fetched.length = 0;
sb.run('_osmFetchLastMs = Date.now()');
sb.ctx._cgWarmOsm();
ok('vừa có request <5s → chưa gọi, tránh dính rate-limit', fetched.length === 0);
ok('…và hẹn tải lại sau', sb.run('_cgWarmTimer') !== null);
sb.run('clearTimeout(_cgWarmTimer); _cgWarmTimer = null; _osmFetchLastMs = 0');

// 7. Debounce: nhiều thay đổi liên tiếp → chỉ tải 1 lần
fetched.length = 0;
for (let i = 0; i < 5; i++) sb.ctx._cgScheduleWarmOsm(40);
await new Promise(r => setTimeout(r, 120));
ok('5 thay đổi liên tiếp → chỉ tải 1 lần (debounce)', fetched.length === 1, fetched.length);

// L3. Đang xuất → không tải sẵn chen vào
fetched.length = 0;
sb.run('_cgExportBusy = true');
sb.ctx._cgWarmOsm();
ok('đang xuất → không tải sẵn chen vào', fetched.length === 0, fetched.length);
sb.run('_cgExportBusy = false');

// L4. Vừa tải sẵn lỗi → nghỉ 30s
fetched.length = 0;
sb.run('_cgWarmFailAt = Date.now()');
sb.ctx._cgWarmOsm();
ok('vừa tải sẵn lỗi → nghỉ, không bắn lại ngay', fetched.length === 0, fetched.length);
sb.run('_cgWarmFailAt = 0');

// L4b. Lỗi mạng → ghi nhận để nghỉ
sb.ctx._fetchOsmBasemap = () => Promise.reject(new Error('Overpass: 504'));
sb.ctx._cgWarmOsm();
await new Promise(r => setTimeout(r, 10));
ok('tải sẵn lỗi mạng → ghi nhận thời điểm lỗi', sb.run('_cgWarmFailAt') > 0);
sb.run('_cgWarmFailAt = 0');

// M3. Đóng modal → bỏ hẹn + nhả RAM
let cleared = 0;
sb.ctx._osmClearMem = () => { cleared++; };
sb.ctx._cgScheduleWarmOsm(5000);
sb.ctx._closeCadGenerator();
ok('đóng modal → nhả cache OSM bộ nhớ', cleared === 1);
ok('đóng modal → bỏ hẹn tải sẵn', sb.run('_cgWarmTimer') === null);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
