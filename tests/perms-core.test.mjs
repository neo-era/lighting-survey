// Phân quyền v211 — lõi thuần src/core/perms.js (@@PERMS) + khớp bản trong gas-khaosat.js
// Chạy: node tests/perms-core.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const block = src => (src.match(/\/\/ @@PERMS_START([\s\S]*?)\/\/ @@PERMS_END/) || [])[1];
const cli = block(fs.readFileSync(path.join(ROOT, 'src/core/perms.js'), 'utf8'));
const gas = block(fs.readFileSync(path.join(ROOT, 'gas-khaosat.js'), 'utf8'));
ok('khối @@PERMS có trong src/core/perms.js', !!cli);
ok('khối @@PERMS trong gas-khaosat.js giống hệt bản app', !!gas && gas === cli);

const C = { JSON, Date, Math, Object, Array, String, Number };
vm.createContext(C); vm.runInContext(cli, C);
const has = (arr, ...ks) => ks.every(k => arr.includes(k));

// ── Danh mục & vai trò hệ thống ───────────────────────────
ok('18 quyền, khoá không trùng', C.PERM_KEYS.length === 18 && new Set(C.PERM_KEYS).size === 18);
const P = r => C._pmEffPerms(r, {});
ok('admin = tất cả quyền', P('admin').length === 18);
// Tương đương hành vi cũ: canEdit = admin|user|user1, canDelete/canDrag = admin|user, github = admin
const canEdit = r => P(r).includes('them_sua'), canDel = r => P(r).includes('xoa'), canDrag = r => P(r).includes('di_chuyen'), gh = r => P(r).includes('github');
ok('canEdit cũ giữ nguyên', canEdit('admin') && canEdit('user') && canEdit('user1') && !canEdit('demo'));
ok('canDelete cũ giữ nguyên', canDel('admin') && canDel('user') && !canDel('user1') && !canDel('demo'));
ok('canDrag cũ giữ nguyên', canDrag('admin') && canDrag('user') && !canDrag('user1') && !canDrag('demo'));
ok('GitHub chỉ admin', gh('admin') && !gh('user') && !gh('user1') && !gh('demo'));
ok('mọi vai trò đăng nhập vẫn xuất dữ liệu (như cũ)', ['user', 'user1', 'demo'].every(r => has(P(r), 'xuat_du_lieu', 'xuat_toan_bo')));
ok('vai trò không tồn tại → chỉ xem', JSON.stringify(P('khong_co')) === '["xem"]');
ok('vai trò tự định nghĩa: quyền lạ bị bỏ, luôn có xem', JSON.stringify(C._pmEffPerms('gs', { gs: { quyen: 'them_sua,abc' } })) === '["xem","them_sua"]');
ok('hoa/thường mã vai trò', P('ADMIN').length === 18);

// ── Mọi lệnh trong doPost đều có luật; lệnh xoá dòng cần "xoa" ──
const gasSrc = fs.readFileSync(path.join(ROOT, 'gas-khaosat.js'), 'utf8');
const dp = gasSrc.slice(gasSrc.indexOf('function doPost('), gasSrc.indexOf('// ── KIỂM TRA KẾT NỐI SHEET'));
const acts = [...new Set([...dp.matchAll(/data\.action === '([a-z_]+)'/g)].map(m => m[1]))];
const missing = acts.filter(a => !C.ACTION_RULES[a]);
ok('mọi action trong doPost đều có trong ACTION_RULES (' + acts.length + ')', acts.length > 40 && missing.length === 0, missing);
ok('lệnh xoá dòng cần quyền xoa', ['delete_row', 'purge_no_gps'].every(a => (C.ACTION_RULES[a].all || []).includes('xoa')));
ok('lệnh quản trị luôn chặn thật (strict)', ['list_users', 'create_user', 'set_auth_mode', 'backup_now', 'restore_backup_sheet', 'create_dia_ban', 'save_role'].every(a => C.ACTION_RULES[a].strict));

// ── Địa bàn hiệu lực (mặc định từ chối) ──────────────────
const G = { XN1: { diaBan: 'Quan1,Quan3' }, XN2: { diaBan: 'Quan8' }, ALL: { diaBan: '*' }, EMPTY: { diaBan: '' }, OFF: { diaBan: 'Quan5', trangThai: 'ngung' } };
const D = (v, g, a) => C._pmEffDistricts(v, g, G, a);
ok('vùng trống + không nhóm → không địa bàn nào', D('', '', false).all === false && D('', '', false).list.length === 0);
ok('"*" → tất cả', D('*', '', false).all === true);
ok('vùng trống + nhóm Quan1,Quan3 → chỉ 2 quận (không phải tất cả)', !D('', 'XN1', false).all && D('', 'XN1', false).list.join() === 'Quan1,Quan3');
ok('hợp vùng riêng ∪ nhóm, ghi nguồn', (() => { const d = D('Quan10', 'XN1,XN2', false); return d.list.length === 4 && d.sources.Quan10[0] === 'riêng' && d.sources.Quan8[0] === 'nhóm XN2'; })());
ok('nhóm có địa bàn trống → không cấp gì', D('', 'EMPTY', false).list.length === 0 && !D('', 'EMPTY', false).all);
ok('nhóm "*" → tất cả', D('', 'ALL', false).all);
ok('nhóm ngừng hoạt động / không tồn tại → bỏ qua', D('', 'OFF,NOPE', false).list.length === 0);
ok('admin → tất cả', D('', '', true).all);
ok('kiểm tab theo địa bàn', C._pmCanWriteTab(D('', 'XN1', false), 'Quan1') && !C._pmCanWriteTab(D('', 'XN1', false), 'Quan8'));

// ── Trạng thái tài khoản ─────────────────────────────────
const now = Date.parse('2026-11-04T10:00:00+07:00');
ok('đang hoạt động', C._pmUserState('hoat_dong', '', now) === 'hoat_dong' && C._pmUserState('', '', now) === 'hoat_dong');
ok('khoá', C._pmUserState('khoa', '', now) === 'khoa');
ok('hết hạn hôm qua', C._pmUserState('hoat_dong', '2026-11-03', now) === 'het_han');
ok('hạn hôm nay vẫn dùng được đến hết ngày', C._pmUserState('hoat_dong', '2026-11-04', now) === 'hoat_dong');

// ── Chỉ dời vị trí ───────────────────────────────────────
ok('full_update chỉ toạ độ → dời vị trí', C._pmIsMoveOnly('full_update', { action: 'full_update', sheet: 'Quan1', id: 'x', lat: 1, lon: 2, vn2000x: 3, capNhat: 't', token: 'k' }));
ok('full_update đổi tên trụ → không phải dời', !C._pmIsMoveOnly('full_update', { id: 'x', lat: 1, loaiDen: 'LED' }));
ok('batch_match_update chỉ cáp → dời', C._pmIsMoveOnly('batch_match_update', { records: [{ tenTru: 'A', markerGoc: 'B', khoangCach: 30 }] }));
ok('batch_match_update có cột khác → không', !C._pmIsMoveOnly('batch_match_update', { records: [{ tenTru: 'A', lat: 1 }, { tenTru: 'B', congSuat: 100 }] }));

// ── Quyết định cho/chặn ───────────────────────────────────
const user = (role, dv = '*', state = 'hoat_dong') => ({ username: 'u', state, perms: P(role), districts: D(dv, '', role === 'admin') });
const dec = (action, data, o = {}) => C._pmDecide(Object.assign({ action, data, mode: 'on', tokenState: 'valid', user: user('user'), tabKnown: true }, o));
ok('ping/login công khai', dec('login', {}, { tokenState: 'none', user: null }).allow);
ok('user sửa trụ Quan1 → cho', dec('full_update', { sheet: 'Quan1', loaiDen: 'LED' }).allow);
ok('user1 xoá → chặn (forbidden)', dec('delete_row', { sheet: 'Quan1' }, { user: user('user1') }).code === 'forbidden');
ok('demo sửa → chặn', !dec('full_update', { sheet: 'Quan1', loaiDen: 'x' }, { user: user('demo') }).allow);
ok('ghi ngoài địa bàn → chặn', dec('full_update', { sheet: 'Quan8', loaiDen: 'x' }, { user: user('user', 'Quan1') }).code === 'forbidden');
ok('ghi vào tab TaiKhoan → luôn chặn (kể cả chưa đăng nhập, chế độ log)', dec('full_update', { sheet: 'TaiKhoan' }, { mode: 'log', tokenState: 'none', user: null }).code === 'bad_tab');
ok('ghi vào tab LichSu / tab _ẩn → chặn', dec('delete_row', { sheet: 'LichSu' }).code === 'bad_tab' && dec('delete_row', { sheet: '_TruocKP_x' }).code === 'bad_tab');
ok('tab không có trong danh mục địa bàn → chặn', dec('full_update', { sheet: 'Quan99' }, { tabKnown: false }).code === 'bad_tab');
ok('chế độ log + app cũ không token → cho qua nhưng ghi vi phạm', (() => { const r = dec('full_update', { sheet: 'Quan1' }, { mode: 'log', tokenState: 'none', user: null }); return r.allow && r.violation; })());
ok('chế độ on + không token → chặn auth_required', dec('full_update', { sheet: 'Quan1' }, { tokenState: 'none', user: null }).code === 'auth_required');
ok('chế độ log + lệnh quản trị không token → vẫn chặn', !dec('delete_user', {}, { mode: 'log', tokenState: 'none', user: null }).allow);
ok('chế độ log + token hết hạn → chặn (đăng nhập lại)', !dec('full_update', { sheet: 'Quan1' }, { mode: 'log', tokenState: 'invalid', user: null }).allow);
ok('tài khoản bị khoá có token → chặn', dec('full_update', { sheet: 'Quan1' }, { user: user('user', '*', 'khoa') }).code === 'auth_required');
ok('chỉ có di_chuyen: dời toạ độ → cho; sửa loại đèn → chặn', (() => {
    const u = { username: 'm', state: 'hoat_dong', perms: ['xem', 'di_chuyen'], districts: { all: true, list: [] } };
    return dec('full_update', { sheet: 'Quan1', lat: 1, lon: 2 }, { user: u }).allow && !dec('full_update', { sheet: 'Quan1', loaiDen: 'x' }, { user: u }).allow;
})());
ok('purge_no_gps cần cả xoa + nhap_hang_loat', !dec('purge_no_gps', { sheet: 'Quan1' }, { user: { username: 'n', state: 'hoat_dong', perms: ['xem', 'nhap_hang_loat'], districts: { all: true, list: [] } } }).allow);
ok('upload_image: có su_co là đủ', dec('upload_image', {}, { user: { username: 's', state: 'hoat_dong', perms: ['xem', 'su_co'], districts: { all: false, list: [] } } }).allow);
ok('lệnh lạ → chặn', dec('hack', {}).code === 'unknown_action');

// ── Không tự khoá ────────────────────────────────────────
const U = [{ username: 'admin', role: 'admin', state: 'hoat_dong' }, { username: 'boss', role: 'admin', state: 'hoat_dong' }, { username: 'hung', role: 'user', state: 'hoat_dong' }];
ok('khoá người khác → được', C._pmLockoutCheck(U, {}, { target: 'hung', state: 'khoa' }, 'admin').ok);
ok('tự khoá mình → không', !C._pmLockoutCheck(U, {}, { target: 'admin', state: 'khoa' }, 'admin').ok);
ok('tự hạ vai trò mình → không', !C._pmLockoutCheck(U, {}, { target: 'Admin', role: 'user' }, 'admin').ok);
ok('tự xoá mình → không', !C._pmLockoutCheck(U, {}, { target: 'admin', remove: true }, 'admin').ok);
ok('khoá admin cuối cùng còn lại → không', !C._pmLockoutCheck([U[0], { username: 'boss', role: 'admin', state: 'khoa' }], {}, { target: 'admin', role: 'user' }, 'boss').ok);
ok('hạ admin kia khi còn mình → được', C._pmLockoutCheck(U, {}, { target: 'boss', role: 'user' }, 'admin').ok);
ok('vai trò tự định nghĩa có quan_tri tính là quản trị', C._pmLockoutCheck([{ username: 'a', role: 'qt', state: 'hoat_dong' }, { username: 'b', role: 'admin', state: 'hoat_dong' }], { qt: { quyen: ['quan_tri'] } }, { target: 'b', state: 'khoa' }, 'a').ok);

// ── Kiểm vai trò ─────────────────────────────────────────
ok('mã vai trò hợp lệ', C._pmValidateRole('giam_sat', 'Giám sát', 'xem,them_sua').ok);
ok('không sửa vai trò hệ thống', !C._pmValidateRole('admin', 'X', 'xem').ok && !C._pmValidateRole('user1', 'X', 'xem').ok);
ok('mã sai định dạng', !C._pmValidateRole('Giám sát', 'x', '').ok && !C._pmValidateRole('1abc', 'x', '').ok);
ok('quyền lạ → từ chối', !C._pmValidateRole('gs', 'x', 'xem,bay').ok);
ok('thiếu tên → từ chối', !C._pmValidateRole('gs', ' ', 'xem').ok);

// ── Token ────────────────────────────────────────────────
const KEY = 'k-bi-mat';
const b64e = s => Buffer.from(s, 'utf8').toString('base64url');
const b64d = s => Buffer.from(s, 'base64url').toString('utf8');
const sign = s => crypto.createHmac('sha256', KEY).update(s).digest('base64url');
const tok = C._pmTokMake({ uid: 'U1', sv: 3, iat: now, exp: now + 86400e3 }, sign, b64e);
const pr = C._pmTokParse(tok, sign, b64d, now + 1000);
ok('token hợp lệ đọc lại đúng', pr.ok && pr.payload.uid === 'U1' && pr.payload.sv === 3);
ok('sai chữ ký (khoá khác) → sig', C._pmTokParse(tok, s => crypto.createHmac('sha256', 'khac').update(s).digest('base64url'), b64d, now).err === 'sig');
const [body, sig] = tok.split('.');
const forged = b64e(JSON.stringify({ uid: 'ADMIN', sv: 3, iat: now, exp: now + 86400e3 })) + '.' + sig;
ok('sửa nội dung giữ chữ ký cũ → sig', C._pmTokParse(forged, sign, b64d, now).err === 'sig');
ok('hết hạn → expired', C._pmTokParse(tok, sign, b64d, now + 2 * 86400e3).err === 'expired');
ok('rác / rỗng / nhiều dấu chấm → format', ['', 'abc', 'a.b.c', null].every(t => C._pmTokParse(t, sign, b64d, now).err === 'format' || C._pmTokParse(t, sign, b64d, now).err === 'sig'));
ok('so chữ ký: khác độ dài → khác', !C._pmTokEq('abc', 'abcd') && C._pmTokEq('abc', 'abc'));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
