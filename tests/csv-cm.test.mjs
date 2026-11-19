// v215 — Nhập CSV VN-2000: chọn được kinh tuyến trục theo tỉnh (trước chỉ có 105°45' và 105°).
// Ca thật 19/11/2026: ToaDo_TruDen_TanKhai_VN2000-10615_NTT.csv (Tân Khai — Bình Phước cũ, KTT 106°15')
// đổi bằng 105°45' + offset Tham Lương → toạ độ lệch ~50 km. Run: node tests/csv-cm.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); };
const sb = loadAppSandbox();
ok('sandbox nạp không lỗi', sb.errors.length === 0, sb.errors);
const W = sb.ctx;

// 1. Nhận kinh tuyến trục từ tên file
ok('có hàm _csvCmFromFileName', typeof W._csvCmFromFileName === 'function');
const f = n => W._csvCmFromFileName(n);
ok('"…VN2000-10615_NTT.csv" → 106.25', f('ToaDo_TruDen_TanKhai_VN2000-10615_NTT.csv') === 106.25);
ok('"KTT 105°45\'" → 105.75', f("ToaDo KTT 105°45'.csv") === 105.75);
ok('"vn2000_10545.csv" → 105.75', f('vn2000_10545.csv') === 105.75);
ok('"_107-45" → 107.75', f('Dongnai_107-45.csv') === 107.75);
ok('không có → null', f('toa_do_tru.csv') === null);
ok('số lạ (10699) → null', f('lo_10699.csv') === null);
ok('ngày tháng 20261119 không bị nhận nhầm', f('khaosat_20261119.csv') === null);

// 2. Danh sách KTT có 106°15' và chọn được
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sel = (html.match(/<select[^>]*id="csvCm"[\s\S]*?<\/select>/) || [''])[0];
ok('modal có ô chọn kinh tuyến trục #csvCm', !!sel);
['104.5', '105', '105.5', '105.75', '106', '106.25', '106.5', '107', '107.25', '107.5', '107.75', '108', '108.25', '108.5'].forEach(v =>
    ok('có KTT ' + v, new RegExp('value="' + v.replace('.', '\\.') + '"').test(sel)));
ok('có tuỳ chọn múi 6° (k0 0,9996)', /value="6zone"/.test(sel));

// 3. _getCsvZoneParams đọc ô chọn
const els = { csvCm: { value: '106.25' } };
W.document.getElementById = id => els[id] || null;
W.document.querySelector = () => null;
let p = W._getCsvZoneParams();
ok('chọn 106.25 → cm 106.25, k0 0.9999', p.cm === 106.25 && p.k0 === 0.9999, p);
els.csvCm.value = '6zone'; p = W._getCsvZoneParams();
ok('chọn múi 6° → cm 105, k0 0.9996', p.cm === 105 && p.k0 === 0.9996, p);

// 3b. Mở file "…10615…" khi đang nhớ offset Tham Lương → tự chọn 106.25 + đặt offset về 0
{
    const opt = v => ({ value: v });
    const cm = { value: '105.75', options: ['104.5','105.75','106.25','6zone'].map(opt) };
    const E = { value: '-391.75' }, N = { value: '223.86' }, hint = { innerHTML: '' };
    const m = { csvCm: cm, csvOffsetE: E, csvOffsetN: N, csvCmHint: hint };
    W.document.getElementById = id => m[id] || null;
    W._restoreCsvCm('ToaDo_TruDen_TanKhai_VN2000-10615_NTT.csv');
    ok('tên file 10615 → chọn 106.25', cm.value === '106.25');
    ok('offset Tham Lương bị đặt về 0', Number(E.value) === 0 && Number(N.value) === 0);
    E.value = '-391.75'; N.value = '223.86';
    W._restoreCsvCm('ThamLuong_VN2000-10545.csv');
    ok('file 10545 (Tham Lương) → giữ offset', cm.value === '105.75' && E.value === '-391.75');
    W.document.getElementById = id => els[id] || null;
}

// 4. Đổi toạ độ thật: điểm ở Tân Khai (11.553, 106.598) → VN2000 KTT 106°15' → đổi ngược đúng
const vn = W.convertLatLonToVn2000(11.553, 106.598, 106.25, 0.9999);
const back = W.convertVn2000ToLatLon(vn.x, vn.y, 106.25, 0.9999);
ok('đổi xuôi/ngược KTT 106.25 khớp < 1 mm', Math.abs(back.lat - 11.553) < 1e-8 && Math.abs(back.lon - 106.598) < 1e-8, { vn, back });
const wrong = W.convertVn2000ToLatLon(vn.x + 391.75, vn.y - 223.86, 105.75, 0.9999);   // cách cũ: KTT 105°45' + offset Tham Lương
ok('dùng nhầm 105°45\' → lệch xa (> 40 km) — đúng hiện tượng anh thấy', Math.abs(wrong.lon - 106.598) * 109000 > 40000, wrong);

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail) process.exit(1);
