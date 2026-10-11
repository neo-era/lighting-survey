// Overpass tự chuyển máy chủ dự phòng khi lỗi (504/429/mạng/JSON hỏng), nhớ máy chạy được, cache cũ làm phao (v169).
// Run: node tests/overpass-failover.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);
const URLS = sb.run('OVERPASS_URLS');
ok('có ≥ 2 máy chủ, máy đầu là overpass-api.de', URLS.length >= 2 && /overpass-api\.de/.test(URLS[0]));

const ELEMS = { elements: [{ type: 'way', tags: { highway: 'primary', name: 'X' }, geometry: [{ lat: 10, lon: 106 }, { lat: 10.001, lon: 106.001 }] }] };
let calls = [];
const mk = plan => async (url) => {
    calls.push(url);
    const host = url.split('/')[2];
    const b = plan[host] || plan['*'];
    if (b === 'net') throw new TypeError('Failed to fetch');
    if (b === 'badjson') return { ok: true, status: 200, json: async () => ({ foo: 1 }) };
    if (typeof b === 'number') return { ok: false, status: b, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ELEMS };
};
const h = i => URLS[i].split('/')[2];

// 1. Máy đầu 504 → máy 2 thành công
calls = []; sb.ctx.fetch = mk({ [h(0)]: 504 });
let j = await sb.ctx._overpassFetch('q');
ok('504 ở máy chính → lấy từ máy dự phòng', j && j.elements.length === 1 && calls.length === 2 && calls[1] === URLS[1]);
// 2. Lần sau thử máy đã chạy được trước
calls = []; sb.ctx.fetch = mk({});
await sb.ctx._overpassFetch('q');
ok('nhớ máy chạy được: lần sau gọi máy dự phòng trước', calls[0] === URLS[1] && calls.length === 1);
// 3. Lỗi mạng + 429 + JSON hỏng → máy cuối thành công
sb.run('_overpassGoodIdx = 0');
calls = []; sb.ctx.fetch = mk({ [h(0)]: 'net', [h(1)]: 429, [h(2)]: 'badjson' });
j = await sb.ctx._overpassFetch('q');
ok('lỗi mạng / 429 / JSON hỏng đều chuyển máy kế', j && calls.length === 4);
// 4. Tất cả lỗi → ném lỗi gom đủ máy
sb.run('_overpassGoodIdx = 0');
calls = []; sb.ctx.fetch = mk({ '*': 504 });
let err = null; try { await sb.ctx._overpassFetch('q'); } catch (e) { err = e; }
ok('tất cả lỗi → ném lỗi, thử đủ mọi máy đúng 1 lần', err && calls.length === URLS.length);
ok('thông báo lỗi nêu từng máy', err && URLS.every(u => err.message.includes(u.split('/')[2])) && /504/.test(err.message));

// 5. _fetchOsmBasemap: mọi máy lỗi nhưng có cache hết hạn đủ lớp → dùng cache cũ
const store = new Map();
sb.ctx._idbGet = async k => store.get(k);
sb.ctx._idbSet = async (k, v) => { store.set(k, v); };
const infos = []; sb.ctx.displayInfo = m => infos.push(m);
const bounds = { minLat: 10, minLon: 106, maxLat: 10.01, maxLon: 106.01 };
const key = sb.ctx._osmBoundsKey(bounds);
const old = { roads: [{ name: 'cũ' }], buildings: [], water: [], admin: [] };
store.set(key, { data: old, fetchedAt: Date.now() - 40 * 864e5, bounds, opts: { roads: true } });
sb.run('_osmFetchLastMs = 0');
const got = await sb.ctx._fetchOsmBasemap(bounds, { roads: true, buildings: false });
ok('mọi máy lỗi + có cache cũ đủ lớp → trả cache cũ', got === old);
ok('báo người dùng đang dùng bản đã lưu', infos.some(m => /đã lưu/.test(m)));
// 6. Không có cache → ném lỗi
store.clear(); sb.run('_osmFetchLastMs = 0');
err = null; try { await sb.ctx._fetchOsmBasemap(bounds, { roads: true, buildings: false }); } catch (e) { err = e; }
ok('mọi máy lỗi + không cache → ném lỗi', !!err);
// 7. Thành công qua máy dự phòng → ghi cache
sb.run('_osmFetchLastMs = 0; _overpassGoodIdx = 0');
sb.ctx.fetch = mk({ [h(0)]: 504 });
const fresh = await sb.ctx._fetchOsmBasemap(bounds, { roads: true, buildings: false });
ok('máy dự phòng thành công → có đường + ghi cache', fresh.roads.length === 1 && store.has(key));

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
