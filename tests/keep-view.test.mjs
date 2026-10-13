// Tải lại trang vẫn giữ địa bàn + vị trí/zoom bản đồ (v178). Run: node tests/keep-view.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);
const W = sb.ctx;

// localStorage giả
const store = new Map();
W.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
// Bản đồ giả: ghi lại setView / fitBounds, phát 'moveend'
let center = { lat: 10.7626, lng: 106.6602 }, zoom = 13;
const handlers = {};
const calls = [];
W.__fakeMap = {
    setView: (c, z) => { center = { lat: c[0], lng: c[1] }; zoom = z; calls.push(['setView', c[0], c[1], z]); },
    fitBounds: () => { calls.push(['fitBounds']); },
    getCenter: () => center, getZoom: () => zoom,
    on: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); },
    removeLayer() {}, addLayer() {}, hasLayer: () => false,
};
sb.run('map = __fakeMap;');
const fire = ev => (handlers[ev] || []).forEach(f => f());
// Tải dữ liệu giả: ghi lại sheet + fitView
const loads = [];
W.loadFromCSVWithCache = async (sheet, url, opts) => { loads.push({ sheet, fitView: !(opts && opts.fitView === false) }); };
W._loadCachedCad = async () => {}; W._loadSuCoData = () => {}; W._loadBaoTriData = () => {}; W._loadNhiemVuData = () => {};
W._startNotifPolling = () => {}; W._loadDataVersion = () => {}; W._syncSharedPresets = async () => {};
W._applyRoleUI = () => {};
let dynLoaded = 0;
W._loadDynamicDistricts = async () => { dynLoaded++; sb.run(`if (!DISTRICT_PAGES.some(p => p.sheet === 'goi_CT5')) DISTRICT_PAGES.push({ label: 'Binh Duong', sheet: 'goi_CT5', csvUrl: 'https://x/goi_CT5', region: 'BinhDuong' });`); };
const els = {}; W.document = Object.assign(W.document || {}, { getElementById: id => els[id] || (els[id] = { style: {}, textContent: '', value: '', classList: { remove() {}, add() {} } }) });
const settle = () => new Promise(r => setTimeout(r, 30));

ok('có hàm gắn lưu vị trí vào bản đồ', typeof W._installViewPersistence === 'function');
W._installViewPersistence && W._installViewPersistence();

// ── 1. Lần đầu (chưa lưu gì) → mặc định như cũ ──
sb.run("currentUser = { role: 'admin', username: 'lam' }");
W._showApp(); await settle();
ok('lần đầu: mở địa bàn mặc định DanhSachTru, có fitView', loads.length === 1 && loads[0].sheet === 'DanhSachTru' && loads[0].fitView);

// ── 2. Đổi địa bàn + kéo/zoom → lưu ──
sb.run("currentSheet = 'Quan5';");
center = { lat: 10.7551, lng: 106.6706 }; zoom = 18; fire('moveend');
await new Promise(r => setTimeout(r, 700));
const saved = JSON.parse(store.get('map_last_view') || 'null');
ok('kéo/zoom: lưu {user, sheet, lat, lon, zoom}', saved && saved.user === 'lam' && saved.sheet === 'Quan5' && saved.lat === 10.7551 && saved.lon === 106.6706 && saved.zoom === 18);

// ── 3. Refresh → mở đúng Quận 5 + đúng tâm/zoom, KHÔNG fitBounds ──
loads.length = 0; calls.length = 0; center = { lat: 10.76, lng: 106.66 }; zoom = 13;
W._showApp(); await settle();
ok('refresh: mở lại Quận 5', loads.length === 1 && loads[0].sheet === 'Quan5');
ok('refresh: tải dữ liệu với fitView = false (không tự zoom vừa dữ liệu)', loads[0] && loads[0].fitView === false);
ok('refresh: đặt đúng tâm + zoom đã lưu', calls.some(c => c[0] === 'setView' && c[1] === 10.7551 && c[2] === 106.6706 && c[3] === 18));
ok('refresh: không gọi fitBounds', !calls.some(c => c[0] === 'fitBounds'));
ok('refresh: currentSheet = Quan5', sb.run('currentSheet') === 'Quan5');

// ── 4. Địa bàn tạo động (chưa có trong danh sách lúc mở) → đợi tải danh sách rồi mở ──
store.set('map_last_view', JSON.stringify({ user: 'lam', sheet: 'goi_CT5', lat: 10.98, lon: 106.65, zoom: 15 }));
loads.length = 0; dynLoaded = 0;
W._showApp(); await settle();
ok('địa bàn tạo động: tải danh sách DiaBan rồi mở goi_CT5', dynLoaded >= 1 && loads.length === 1 && loads[0].sheet === 'goi_CT5' && !loads[0].fitView);

// ── 5. Các ca quay về mặc định ──
const fallback = async (val, label, expect = 'DanhSachTru') => {
    store.set('map_last_view', typeof val === 'string' ? val : JSON.stringify(val));
    loads.length = 0;
    W._showApp(); await settle();
    ok(label, loads.length === 1 && loads[0].sheet === expect && loads[0].fitView);
};
await fallback({ user: 'khac', sheet: 'Quan5', lat: 10.75, lon: 106.67, zoom: 18 }, 'tài khoản khác → mặc định');
await fallback({ user: 'lam', sheet: 'KhongTonTai', lat: 10.75, lon: 106.67, zoom: 18 }, 'địa bàn không còn (xoá/lưu trữ) → mặc định');
await fallback('{hỏng', 'dữ liệu lưu hỏng → mặc định');
await fallback({ user: 'lam', sheet: 'Quan5', lat: 'abc', lon: 106.67, zoom: 18 }, 'toạ độ không hợp lệ → mặc định');
sb.run("currentUser = { role: 'user', username: 'lam', vung: ['Quan1'] }");
await fallback({ user: 'lam', sheet: 'Quan5', lat: 10.75, lon: 106.67, zoom: 18 }, 'không còn quyền xem địa bàn (vùng) → địa bàn được phép đầu tiên (Quan1)', 'Quan1');
sb.run("currentUser = { role: 'admin', username: 'lam' }");

// ── 6. Không lưu đè trước khi khôi phục xong (bản đồ phát moveend lúc khởi động) ──
store.set('map_last_view', JSON.stringify({ user: 'lam', sheet: 'Quan5', lat: 10.7551, lon: 106.6706, zoom: 18 }));
sb.run('_viewRestoreDone = false;');
center = { lat: 10.76, lng: 106.66 }; zoom = 13; fire('moveend');
await new Promise(r => setTimeout(r, 700));
ok('moveend trước khi khôi phục không ghi đè vị trí đã lưu', JSON.parse(store.get('map_last_view')).zoom === 18);

// ── 7. localStorage bị chặn → không lỗi ──
W.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
loads.length = 0; let threw = null;
try { W._showApp(); await settle(); fire('moveend'); await new Promise(r => setTimeout(r, 700)); } catch (e) { threw = e; }
ok('localStorage bị chặn: không lỗi, mở mặc định', !threw && loads.length === 1 && loads[0].sheet === 'DanhSachTru');

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
