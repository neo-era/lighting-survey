// Tải sẵn nền OSM khi mở modal Xuất CAD — để lúc bấm xuất trúng cache, không chờ mạng.
//
// _fetchOsmBasemap bổ sung (v183):
//  - Cache bộ nhớ tra theo BAO CHỨA: khung đã tải bao trọn khung cần + đủ lớp → dùng luôn.
//    (Khớp đúng key là không đủ: bật "loại điểm ngoại lai" hoặc xuất nhiều tờ thì khung lúc xuất
//     NHỎ HƠN khung tải sẵn → key khác → trượt cache.)
//  - Dùng chung request đang chạy: bấm xuất khi tải sẵn chưa xong thì chờ chính request đó
//    (không gọi lại, không dính rate-limit 5s).
//  - Bên nào bấm "bỏ qua" chỉ THÔI CHỜ; request dùng chung vẫn chạy tiếp để lấp cache cho lần sau.
//  - extra.quiet: tải sẵn im lặng, không hiện toast.
// Xem docs/design-fix-cad-export-slow.md
// Run: node tests/osm-prefetch-cache.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (c || x === undefined ? '' : ' → ' + JSON.stringify(x))); };
const sb = loadAppSandbox();
ok('sandbox nạp không lỗi', sb.errors.length === 0, sb.errors);

const ELEMS = { elements: [{ type: 'way', tags: { highway: 'primary', name: 'X' }, geometry: [{ lat: 10.76, lon: 106.66 }, { lat: 10.761, lon: 106.661 }] }] };
let calls = 0, gate = null;
// fetch giả: nếu gate có, request chờ gate mở (mô phỏng mạng chậm)
sb.ctx.fetch = async () => {
    calls++;
    if (gate) await gate.promise;
    return { ok: true, status: 200, json: async () => ELEMS };
};
const store = new Map();
sb.ctx._idbGet = async k => store.get(k);
sb.ctx._idbSet = async (k, v) => { store.set(k, v); };
let infos = [];
sb.ctx.displayInfo = m => infos.push(m);
sb.ctx.AbortController = AbortController;
// Sandbox thay setTimeout bằng hàm rỗng — ca chờ rate-limit cần hẹn giờ thật
sb.ctx.setTimeout = setTimeout; sb.ctx.clearTimeout = clearTimeout;

function reset() {
    calls = 0; gate = null; infos = []; store.clear();
    sb.run('_osmFetchLastMs = 0; _osmMem.length = 0; _osmInflight.length = 0;');
}
function openGate() { let r; const p = new Promise(x => { r = x; }); gate = { promise: p, open: r }; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BIG   = { minLat: 10.750, minLon: 106.650, maxLat: 10.770, maxLon: 106.670 };
const INNER = { minLat: 10.755, minLon: 106.655, maxLat: 10.765, maxLon: 106.665 };   // nằm trọn trong BIG
const OUTSIDE = { minLat: 10.780, minLon: 106.680, maxLat: 10.790, maxLon: 106.690 };
const ROADS = { roads: true, buildings: false };

// 1. Bao chứa: tải khung lớn rồi xin khung con → không gọi mạng lần 2
reset();
const d1 = await sb.ctx._fetchOsmBasemap(BIG, ROADS);
sb.run('_osmFetchLastMs = Date.now()');   // nếu lỡ gọi mạng sẽ dính rate-limit → lộ ra
const d2 = await sb.ctx._fetchOsmBasemap(INNER, ROADS);
ok('khung con nằm trong khung đã tải → dùng cache, không gọi mạng', calls === 1 && d2.roads.length === d1.roads.length, { calls });
ok('trả MẢNG MỚI, không phải mảng của cache (nơi gọi lỡ sửa không làm hỏng cache)', d2.roads !== d1.roads);

// 2. Khung ngoài → phải tải
reset();
await sb.ctx._fetchOsmBasemap(BIG, ROADS);
sb.run('_osmFetchLastMs = 0');
await sb.ctx._fetchOsmBasemap(OUTSIDE, ROADS);
ok('khung nằm ngoài → tải mới', calls === 2, { calls });

// 3. Thiếu lớp → phải tải
reset();
await sb.ctx._fetchOsmBasemap(BIG, ROADS);
sb.run('_osmFetchLastMs = 0');
await sb.ctx._fetchOsmBasemap(INNER, { roads: true, buildings: true });
ok('cache chỉ có đường, cần thêm nhà → tải mới', calls === 2, { calls });

// 4. Cache bộ nhớ hết hạn → không dùng
reset();
await sb.ctx._fetchOsmBasemap(BIG, ROADS);
sb.run('_osmMem[0].fetchedAt = 0; _osmFetchLastMs = 0');
await sb.ctx._fetchOsmBasemap(INNER, ROADS);
ok('cache bộ nhớ hết hạn → tải mới', calls === 2, { calls });

// 5. Dùng chung request đang chạy — không gọi lại, không dính rate-limit
reset(); openGate();
const pPre = sb.ctx._fetchOsmBasemap(BIG, ROADS, undefined, { quiet: true });   // tải sẵn
await sleep(10);
const pExp = sb.ctx._fetchOsmBasemap(INNER, ROADS);                          // bấm xuất khi chưa xong
let expErr = null;
pExp.catch(e => { expErr = e; });
gate.open();
const [rPre, rExp] = await Promise.all([pPre, pExp]);
ok('bấm xuất khi tải sẵn chưa xong → chờ chính request đó (1 lần gọi mạng)', calls === 1 && rPre.roads.length === rExp.roads.length, { calls });
ok('không dính lỗi rate-limit 5s', expErr === null, expErr && expErr.message);

// 6. Bên chờ bấm bỏ qua → chỉ bên đó thôi chờ; request vẫn chạy và lấp cache
reset(); openGate();
const pShared = sb.ctx._fetchOsmBasemap(BIG, ROADS, undefined, { quiet: true });
await sleep(10);
const ctl = new AbortController();
const pWaiter = sb.ctx._fetchOsmBasemap(INNER, ROADS, ctl.signal);
setTimeout(() => ctl.abort(), 20);
let wErr = null; const t0 = Date.now();
try { await pWaiter; } catch (e) { wErr = e; }
ok('bên bấm bỏ qua → thôi chờ ngay (AbortError)', !!wErr && wErr.name === 'AbortError' && Date.now() - t0 < 300, { err: wErr && wErr.message });
gate.open();
await pShared;
sb.run('_osmFetchLastMs = Date.now()');
const callsBefore = calls;
const again = await sb.ctx._fetchOsmBasemap(INNER, ROADS);
ok('request dùng chung vẫn chạy tiếp → lần sau trúng cache, không gọi mạng', calls === callsBefore && !!again, { calls, callsBefore });

// 7. Tải sẵn im lặng
reset();
await sb.ctx._fetchOsmBasemap(BIG, ROADS, undefined, { quiet: true });
ok('tải sẵn (quiet) không hiện toast', infos.length === 0, infos);
reset();
await sb.ctx._fetchOsmBasemap(BIG, ROADS);
ok('tải thường vẫn hiện toast "Đang tải nền OSM…"', infos.some(m => /Đang tải nền OSM/.test(m)), infos);

// 8. Request lỗi → không kẹt trong danh sách đang chạy
reset();
sb.ctx.fetch = async () => { calls++; return { ok: false, status: 504, json: async () => ({}) }; };
let e8 = null; try { await sb.ctx._fetchOsmBasemap(BIG, ROADS, undefined, { quiet: true }); } catch (e) { e8 = e; }
ok('mọi máy lỗi → ném lỗi', !!e8);
ok('request lỗi được gỡ khỏi danh sách đang chạy', sb.run('_osmInflight.length') === 0);
ok('request lỗi không vào cache bộ nhớ', sb.run('_osmMem.length') === 0);

// 9. Cache bộ nhớ có trần (không phình RAM)
reset();
sb.ctx.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => ELEMS }; };
for (let i = 0; i < 6; i++) {
    sb.run('_osmFetchLastMs = 0');
    await sb.ctx._fetchOsmBasemap({ minLat: 10 + i, minLon: 106, maxLat: 10.01 + i, maxLon: 106.01 }, ROADS);
}
ok('cache bộ nhớ giữ tối đa ' + sb.run('_OSM_MEM_MAX') + ' vùng', sb.run('_osmMem.length') <= sb.run('_OSM_MEM_MAX'), sb.run('_osmMem.length'));

// ── Các ca từ review vòng 3 ──
const WAYS = { elements: [
    { type: 'way', tags: { highway: 'primary' }, geometry: [{ lat: 10.756, lon: 106.656 }, { lat: 10.757, lon: 106.657 }] },   // trong INNER
    { type: 'way', tags: { highway: 'service' }, geometry: [{ lat: 10.751, lon: 106.651 }, { lat: 10.752, lon: 106.652 }] },   // ngoài INNER, trong BIG
    { type: 'way', tags: { building: 'yes' },    geometry: [{ lat: 10.756, lon: 106.656 }, { lat: 10.7561, lon: 106.6561 }, { lat: 10.7561, lon: 106.656 }, { lat: 10.756, lon: 106.656 }] }
] };

// H1. Cache có nhà, lần sau KHÔNG xin nhà → không được trả nhà
reset();
sb.ctx.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => WAYS }; };
const withBld = await sb.ctx._fetchOsmBasemap(BIG, { roads: true, buildings: true }, undefined, { quiet: true });
const noBld = await sb.ctx._fetchOsmBasemap(BIG, { roads: true, buildings: false });
ok('H1: dữ liệu mẫu có nhà', withBld.buildings.length === 1, withBld.buildings.length);
ok('H1: tải sẵn có nhà, xuất bỏ tick nhà → KHÔNG có nhà', calls === 1 && noBld.buildings.length === 0 && noBld.roads.length === 2, { calls, b: noBld.buildings.length, r: noBld.roads.length });

// M2. Cache cả vùng, xin khung nhỏ → chỉ nhận way chạm khung nhỏ
const small = await sb.ctx._fetchOsmBasemap(INNER, { roads: true, buildings: false });
ok('M2: khung nhỏ chỉ nhận way chạm khung', small.roads.length === 1 && calls === 1, { r: small.roads.length, calls });

// H2. Tải sẵn vừa chiếm lượt 5s, bấm xuất với lớp khác → CHỜ rồi tải, không mất nền
reset();
sb.ctx.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => WAYS }; };
await sb.ctx._fetchOsmBasemap(BIG, { roads: true, buildings: false }, undefined, { quiet: true });
sb.run('_osmFetchLastMs = Date.now() - 4800');   // còn ~200ms mới hết 5s
let h2err = null, h2 = null;
try { h2 = await sb.ctx._fetchOsmBasemap(BIG, { roads: true, buildings: true }); } catch (e) { h2err = e; }
ok('H2: dính rate-limit → CHỜ rồi tải, không ném lỗi', !h2err && !!h2 && h2.buildings.length === 1 && calls === 2, { err: h2err && h2err.message, calls });

// H2b. Đang chờ rate-limit mà bấm bỏ qua → thôi chờ ngay
reset();
sb.run('_osmFetchLastMs = Date.now()');
const ctl2 = new AbortController(); setTimeout(() => ctl2.abort(), 30);
let h2b = null; const t2 = Date.now();
try { await sb.ctx._fetchOsmBasemap(BIG, ROADS, ctl2.signal); } catch (e) { h2b = e; }
ok('H2b: đang chờ rate-limit, bấm bỏ qua → dừng ngay', !!h2b && h2b.name === 'AbortError' && Date.now() - t2 < 500, { ms: Date.now() - t2, err: h2b && h2b.message });

// H2c. Tải sẵn (quiet) gặp rate-limit → nhường ngay
reset();
sb.run('_osmFetchLastMs = Date.now()');
let h2c = null; const t3 = Date.now();
try { await sb.ctx._fetchOsmBasemap(BIG, ROADS, undefined, { quiet: true }); } catch (e) { h2c = e; }
ok('H2c: tải sẵn gặp rate-limit → nhường ngay, không chờ', !!h2c && /Đợi 5s/.test(h2c.message) && Date.now() - t3 < 100);

// M1. Chờ chung request bị lỗi, mình có bản cũ đúng khung → dùng bản cũ
reset(); openGate();
sb.ctx.fetch = async () => { calls++; await gate.promise; return { ok: false, status: 504, json: async () => ({}) }; };
const oldData = { roads: [{ coords: [[106.656, 10.756], [106.657, 10.757]], tags: { name: 'bản cũ' } }], buildings: [], water: [], admin: [] };
store.set(sb.ctx._osmBoundsKey(INNER), { data: oldData, fetchedAt: Date.now() - 40 * 864e5, bounds: INNER, opts: { roads: true } });
const pBig = sb.ctx._fetchOsmBasemap(BIG, ROADS, undefined, { quiet: true });
pBig.catch(() => {});
await sleep(10);
const pMine = sb.ctx._fetchOsmBasemap(INNER, ROADS);
gate.open();
let m1 = null, m1err = null;
try { m1 = await pMine; } catch (e) { m1err = e; }
ok('M1: request chung lỗi → dùng bản cũ của mình, không mất nền', !m1err && !!m1 && m1.roads.length === 1 && m1.roads[0].tags.name === 'bản cũ', { err: m1err && m1err.message, calls });

// L1. _idbSet treo → kết quả vẫn trả về
reset();
sb.ctx.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => WAYS }; };
const realSet = sb.ctx._idbSet;
sb.ctx._idbSet = () => new Promise(() => {});
const race = await Promise.race([sb.ctx._fetchOsmBasemap(BIG, ROADS).then(() => 'ok'), sleep(500).then(() => 'treo')]);
sb.ctx._idbSet = realSet;
ok('L1: ghi IndexedDB treo không làm treo kết quả', race === 'ok', race);
ok('L1: request không kẹt trong danh sách đang chạy', sb.run('_osmInflight.length') === 0);

// M3. Giải phóng cache bộ nhớ
sb.ctx._osmClearMem();
ok('M3: _osmClearMem xoá cache bộ nhớ', sb.run('_osmMem.length') === 0);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
