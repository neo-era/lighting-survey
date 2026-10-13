// Mở địa bàn mới tạo chưa có trụ (vd "Binh Duong" = sheet goi_CT5): không báo lỗi giả, không giữ dữ liệu
// địa bàn cũ, đưa bản đồ về tâm địa bàn (v177). Run: node tests/empty-district.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);
const W = sb.ctx;

const HEADER = '"ID","Tên trụ","Lat","Lon","Ghi chú","Người KS","Loại","Tủ điều khiển"';
const OLD = [['ID', 'Tên trụ', 'Lat', 'Lon'], ['Q5_1', 'VVK_1', '10,75', '106,67'], ['Q5_2', 'VVK_2', '10,751', '106,671']];
let resp = { ok: true, status: 200, text: HEADER + '\n' };
W.fetch = async () => ({ ok: resp.ok, status: resp.status, text: async () => resp.text });
const idb = new Map();
W._idbGet = async k => idb.get(k); W._idbSet = async (k, v) => { idb.set(k, v); };
let rendered = []; W.addMarkersToMap = d => { rendered.push(d.length); };
let views = []; W.__fakeMap = { setView: (c, z) => { views.push([c, z]); }, getZoom: () => 15 }; sb.run('map = __fakeMap;');
let infos = [], errs = []; W.displayInfo = m => infos.push(m); W.displayError = m => { if (m) errs.push(m); };
W._loadCachedCad = async () => {};
const els = {}; W.document = Object.assign(W.document || {}, { getElementById: id => els[id] || (els[id] = { style: {}, textContent: '', value: '' }) });
sb.run("currentUser = { role: 'admin', username: 'a' }");
sb.run(`DISTRICT_PAGES.push({ label: 'Binh Duong', sheet: 'goi_CT5', csvUrl: 'https://x/gviz?sheet=goi_CT5', region: 'BinhDuong', centerLat: null, centerLon: null });`);
sb.run(`DISTRICT_PAGES.push({ label: 'Có tâm', sheet: 'coTam', csvUrl: 'https://x/coTam', region: 'TPHCM', centerLat: 10.5, centerLon: 106.5 });`);

// ── 1. Địa bàn rỗng (chỉ dòng tiêu đề) ──
W.__old = OLD; sb.run('loadedData = __old; currentSheet = "Quan5";');
await W.switchDistrict('goi_CT5');
const ld = sb.run('loadedData');
ok('rỗng: KHÔNG báo "Không tải được dữ liệu"', !errs.some(m => /Không tải được/.test(m)));
ok('rỗng: báo "chưa có trụ nào"', infos.some(m => /chưa có trụ nào/.test(m)));
ok('rỗng: loadedData chỉ còn dòng tiêu đề của sheet mới (không còn dữ liệu Quận 5)', ld.length === 1 && ld[0][1] === 'Tên trụ' && !JSON.stringify(ld).includes('VVK_1'));
ok('rỗng: currentSheet = goi_CT5', sb.run('currentSheet') === 'goi_CT5');
ok('rỗng: bản đồ không còn marker', rendered[rendered.length - 1] === 0);
ok('rỗng: lưu cache header (lần sau mở nhanh)', idb.has('goi_CT5') && idb.get('goi_CT5').data.length === 1);
const v = views[views.length - 1];
ok('rỗng + không có tâm: đưa bản đồ về tâm vùng Bình Dương, zoom 12', v && Math.abs(v[0][0] - 10.98) < 0.3 && Math.abs(v[0][1] - 106.65) < 0.3 && v[1] === 12);

// ── 2. Địa bàn có tâm lưu sẵn ──
views = [];
await W.switchDistrict('coTam');
ok('rỗng + có tâm: setView đúng tâm lưu trong DiaBan', views.length && views[views.length - 1][0][0] === 10.5 && views[views.length - 1][0][1] === 106.5);

// ── 3. Tải lỗi (HTTP 500) không cache → báo lỗi + KHÔNG giữ dữ liệu địa bàn cũ ──
W.__old = OLD; sb.run('loadedData = __old; currentSheet = "Quan5";');
idb.clear(); errs = []; resp = { ok: false, status: 500, text: '' };
await W.switchDistrict('goi_CT5');
const ld3 = sb.run('loadedData');
ok('lỗi mạng: vẫn báo lỗi', errs.some(m => /Không tải được dữ liệu/.test(m)));
ok('lỗi mạng: không còn dữ liệu Quận 5 trong loadedData', !JSON.stringify(ld3).includes('VVK_1'));

// ── 4. Trả về trang HTML (sheet chưa share) → vẫn là lỗi, không coi là rỗng ──
errs = []; infos = []; resp = { ok: true, status: 200, text: '<!DOCTYPE html><html><body>Sign in</body></html>' };
await W.switchDistrict('goi_CT5');
ok('trang HTML (chưa share): báo lỗi, không báo "chưa có trụ"', errs.some(m => /Không tải được/.test(m)) && !infos.some(m => /chưa có trụ nào/.test(m)));

// ── 5. Địa bàn có dữ liệu: hành vi cũ ──
errs = []; resp = { ok: true, status: 200, text: HEADER + '\n"BD_1","T1","11,0","106,6","","","1","TU"\n' };
idb.clear(); rendered = [];
await W.switchDistrict('goi_CT5');
ok('có dữ liệu: nạp 1 trụ, không báo lỗi', sb.run('loadedData').length === 2 && rendered[rendered.length - 1] === 1 && !errs.length);

// ── 6. Luồng thật: danh sách DiaBan từ GAS → gộp vào DISTRICT_PAGES phải giữ vùng + tâm ──
W.fetch = async () => ({ ok: true, json: async () => ({ status: 'ok', items: [
    { sheet: 'goi_CT5', label: 'Binh Duong', csvUrl: 'https://x/gviz?sheet=goi_CT5', prefix: 'BD', region: 'BinhDuong', centerLat: null, centerLon: null },
    { sheet: 'moi2', label: 'Mới 2', csvUrl: 'https://x/moi2', prefix: 'M2', region: 'LongAn', centerLat: 10.6, centerLon: 106.4 }] }) });
await W._loadDynamicDistricts();
const pg = sb.run("DISTRICT_PAGES.find(p => p.sheet === 'goi_CT5')"), pg2 = sb.run("DISTRICT_PAGES.find(p => p.sheet === 'moi2')");
ok('gộp DiaBan: giữ region của "Binh Duong"', pg && pg.region === 'BinhDuong');
ok('gộp DiaBan: giữ centerLat/centerLon', pg2 && pg2.centerLat === 10.6 && pg2.centerLon === 106.4);
ok('tâm "Binh Duong" (không có tâm riêng) → tâm vùng Bình Dương zoom 12', (c => !!c && c.zoom === 12 && Math.abs(c.lat - 10.98) < 0.3)(W._districtCenter(pg)));
ok('tâm "Mới 2" → tâm lưu riêng zoom 14', (c => !!c && c.lat === 10.6 && c.zoom === 14)(W._districtCenter(pg2)));

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
