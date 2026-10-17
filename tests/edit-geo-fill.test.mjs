// Sửa trụ: tự điền Đường / Phường-Xã khi ô đang TRỐNG (v186). Run: node tests/edit-geo-fill.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
const W = sb.ctx;
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const els = { markerStreetInput: { value: '', placeholder: '' }, markerWardInput: { value: '', placeholder: '' } };
W.document = Object.assign(W.document || {}, { getElementById: id => els[id] || null });
let calls = 0, release;
const ADDR = { road: 'Đường tỉnh 744', suburb: 'Xã Bàu Bàng' };
W.reverseGeocode = () => { calls++; return new Promise(r => { release = () => r(ADDR); }); };
const flush = () => new Promise(r => setImmediate(r));
const row = ['', 'P1'], row2 = ['', 'P2'];
const reset = (st, wd) => { els.markerStreetInput.value = st; els.markerWardInput.value = wd; calls = 0; };

// 1. Cả 2 trống → điền cả 2, Lưu chờ được promise
reset('', ''); sb.run('_editingRow = null'); W.__row = row; sb.run('_editingRow = __row');
let p = W._fillEmptyGeoFieldsForEdit(row, 10.9, 106.7);
ok('2 ô trống: gọi tra cứu 1 lần, ô hiện "Đang tra cứu..."', calls === 1 && els.markerStreetInput.placeholder === 'Đang tra cứu...');
ok('Lưu chờ được tra cứu (_pendingGeocodePromise đang có)', !!sb.run('_pendingGeocodePromise'));
release(); await p; await flush();
ok('điền Đường + Phường', els.markerStreetInput.value === 'Đường tỉnh 744' && els.markerWardInput.value === 'Xã Bàu Bàng');
ok('xong: trả placeholder + xoá promise chờ', els.markerStreetInput.placeholder === 'Tên đường...' && !sb.run('_pendingGeocodePromise'));

// 2. Đã có đủ → không tra
reset('Hùng Vương', 'Phường 3');
await W._fillEmptyGeoFieldsForEdit(row, 10.9, 106.7);
ok('đã đủ 2 ô: không tra cứu, giữ nguyên', calls === 0 && els.markerStreetInput.value === 'Hùng Vương' && els.markerWardInput.value === 'Phường 3');

// 3. Chỉ thiếu Phường → chỉ điền Phường, Đường giữ
reset('Hùng Vương', '');
p = W._fillEmptyGeoFieldsForEdit(row, 10.9, 106.7); release(); await p;
ok('thiếu Phường: chỉ điền Phường, Đường giữ nguyên', els.markerStreetInput.value === 'Hùng Vương' && els.markerWardInput.value === 'Xã Bàu Bàng');

// 4. Người dùng gõ trong lúc chờ → không ghi đè
reset('', '');
p = W._fillEmptyGeoFieldsForEdit(row, 10.9, 106.7);
els.markerStreetInput.value = 'Tự gõ';
release(); await p;
ok('người dùng gõ Đường lúc chờ → giữ chữ đã gõ, vẫn điền Phường', els.markerStreetInput.value === 'Tự gõ' && els.markerWardInput.value === 'Xã Bàu Bàng');

// 5. Đã chuyển sang sửa trụ khác → bỏ kết quả
reset('', '');
p = W._fillEmptyGeoFieldsForEdit(row, 10.9, 106.7);
W.__row2 = row2; sb.run('_editingRow = __row2');
release(); await p;
ok('đã mở trụ khác → không điền kết quả cũ', els.markerStreetInput.value === '' && els.markerWardInput.value === '');

// 6. Không có toạ độ → không tra
reset('', '');
await W._fillEmptyGeoFieldsForEdit(row2, NaN, 106.7);
ok('không toạ độ: không tra cứu', calls === 0);

// 7. Mất mạng (reverseGeocode trả null) → giữ trống, không lỗi
reset('', ''); sb.run('_editingRow = __row');
W.reverseGeocode = async () => { calls++; return null; };
await W._fillEmptyGeoFieldsForEdit(row, 10.9, 106.7);
ok('mất mạng: ô vẫn trống, placeholder trả về bình thường', els.markerStreetInput.value === '' && els.markerStreetInput.placeholder === 'Tên đường...');

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
