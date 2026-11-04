// Phân quyền v211 — test phía app: hasPerm, địa bàn ghi, quyền xuất, gắn token vào lệnh gửi GAS,
// xử lý phản hồi auth_required / must_change_password / forbidden, lưu token sau đăng nhập/đổi MK, lọc người dùng.
// Chạy: node tests/auth-client.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PERMS = read('src/core/perms.js'), AUTH = read('src/features/auth.js'), UA = read('src/features/user-admin.js');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const tick = () => new Promise(r => setTimeout(r, 0));

function load(reply, user) {
    const sent = [], errs = [], infos = [], els = {};
    const el = id => els[id] || (els[id] = { id, value: '', textContent: '', style: {}, classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); } }, focus() {} });
    const fakeFetch = async (url, init) => {
        sent.push({ url, body: init && init.body });
        const j = typeof reply === 'function' ? reply(JSON.parse(init.body)) : reply;
        const txt = JSON.stringify(j);
        const res = { json: async () => JSON.parse(txt), clone: () => res };
        return res;
    };
    const window = { fetch: fakeFetch };
    const store = {};
    const ctx = {
        window, console, JSON, Date, Object, Array, String, Number, Math, Promise, Set,
        KHAOSAT_GAS_URL: 'https://gas', currentSheet: 'Quan1', currentUser: user === undefined ? null : user,
        displayError: m => errs.push(m), displayInfo: m => infos.push(m),
        document: { getElementById: el, body: { classList: { add() {}, remove() {} } } },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        $: () => ({ modal() {}, removeClass() {}, remove() {}, data() { return null; } }),
        setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {},
        _applyRoleUI() { ctx._applied = (ctx._applied || 0) + 1; },
        openChangeCredentials() { ctx._ccOpened = (ctx._ccOpened || 0) + 1; },
        DISTRICT_PAGES: [{ sheet: 'Quan1', label: 'Quận 1' }],
    };
    ctx.fetch = (...a) => window.fetch(...a);
    vm.createContext(ctx);
    vm.runInContext(PERMS + '\n' + AUTH + '\n' + UA, ctx);
    return { ctx, sent, errs, infos, el, store };
}

// ── hasPerm / tương thích người dùng cũ ──
{
    const { ctx } = load({ status: 'ok' }, { username: 'a', role: 'user1' });
    ok('user cũ (chưa có perms) → suy từ vai trò hệ thống: user1 có them_sua', ctx.hasPerm('them_sua'));
    ok('user1 không có xoa', !ctx.hasPerm('xoa'));
    ctx.currentUser = { username: 'a', role: 'lạ' };
    ok('vai trò lạ → chỉ xem', ctx.hasPerm('xem') && !ctx.hasPerm('them_sua'));
    ctx.currentUser = { username: 'a', role: 'demo', perms: ['xem', 'quan_tri'] };
    ok('có perms từ GAS → dùng perms (không suy từ role)', ctx.hasPerm('quan_tri'));
    ctx.currentUser = null;
    ok('chưa đăng nhập → không có quyền', !ctx.hasPerm('xem'));
}
// ── Địa bàn ghi ──
{
    const { ctx } = load({}, { username: 'a', role: 'user', perms: ['xem', 'them_sua', 'xoa'], districts: { all: false, list: ['Quan5'] } });
    ok('ghi được địa bàn trong danh sách', ctx._authCanWriteSheet('Quan5'));
    ok('không ghi được địa bàn ngoài danh sách', !ctx._authCanWriteSheet('Quan1'));
    ok('canEdit trên địa bàn đang mở (Quan1) → false', !ctx._authCanWriteHere('them_sua'));
    ctx.currentSheet = 'Quan5';
    ok('đổi sang Quan5 → canEdit true', ctx._authCanWriteHere('them_sua'));
    ctx.currentUser = { username: 'b', role: 'user', vung: [] };
    ok('user cũ vung [] = tất cả (nghĩa cũ)', ctx._authCanWriteSheet('Bat_Ky'));
    ctx.currentUser = { username: 'b', role: 'user', vung: ['Quan1'] };
    ok('user cũ vung [Quan1] → chỉ Quan1', ctx._authCanWriteSheet('Quan1') && !ctx._authCanWriteSheet('Quan3'));
    ctx.currentUser = { username: 'c', role: 'demo', perms: ['xem'], districts: { all: false, list: [] } };
    ok('không địa bàn → không ghi được đâu', !ctx._authCanWriteSheet('Quan1'));
}
// ── Quyền xuất ──
{
    const { ctx, sent, errs } = load({ status: 'ok' }, { username: 'x', role: 'tu_van', perms: ['xem', 'xuat_du_lieu'], districts: { all: false, list: ['Quan5'] }, token: 'T' });
    ok('xuat_du_lieu: xuất được địa bàn của mình', ctx._authCanExport('Quan5'));
    ok('xuat_du_lieu: không xuất địa bàn khác', !ctx._authCanExport('Quan1'));
    ok('gate từ chối + báo lỗi + không ghi nhật ký', ctx._authExportGate('cad', 10) === false && errs.length === 1 && sent.length === 0);
    ctx.currentSheet = 'Quan5';
    ok('gate cho phép + gửi log_export', ctx._authExportGate('cad', 10) === true && sent.length === 1);
    const b = JSON.parse(sent[0].body);
    ok('log_export có sheet/kind/count/scope + token', b.action === 'log_export' && b.sheet === 'Quan5' && b.kind === 'cad' && b.count === 10 && b.scope === 'dia_ban' && b.token === 'T', b);
    ctx.currentUser.perms.push('xuat_toan_bo');
    ok('xuat_toan_bo: xuất mọi địa bàn', ctx._authCanExport('Quan1'));
}
// ── Gắn token ──
{
    const { ctx, sent } = load({ status: 'ok' }, { username: 'a', role: 'user', token: 'TOK1' });
    ok('gắn token vào body JSON', JSON.parse(ctx._authAttachToken('{"action":"full_update"}', 'TOK1')).token === 'TOK1');
    ok('login không gắn token', ctx._authAttachToken('{"action":"login"}', 'TOK1') === '{"action":"login"}');
    ok('không ghi đè token có sẵn', JSON.parse(ctx._authAttachToken('{"action":"x","token":"OLD"}', 'TOK1')).token === 'OLD');
    ok('body không phải JSON → giữ nguyên', ctx._authAttachToken('abc', 'TOK1') === 'abc');
    ok('chưa có token → giữ nguyên', ctx._authAttachToken('{"action":"x"}', '') === '{"action":"x"}');
    await ctx.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'delete_row', id: '1' }) });
    ok('lớp bọc fetch gắn token khi gửi tới GAS', JSON.parse(sent[0].body).token === 'TOK1');
    await ctx.fetch('https://khac.example', { method: 'POST', body: JSON.stringify({ action: 'x' }) });
    ok('URL khác → không gắn token', JSON.parse(sent[1].body).token === undefined);
}
// ── Phản hồi từ chối ──
{
    const { ctx, el } = load({ status: 'auth_required', message: 'Phiên hết hạn' }, { username: 'hung', role: 'user', token: 'OLD' });
    await ctx.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'full_update' }) });
    await tick(); await tick();
    ok('auth_required → hiện màn đăng nhập', el('loginOverlay').classList.contains('visible'));
    ok('điền sẵn tên đăng nhập + thông báo', el('lUsername').value === 'hung' && el('loginError').textContent === 'Phiên hết hạn');
    ok('giữ phiên làm việc (currentUser không bị xoá)', ctx.currentUser && ctx.currentUser.username === 'hung');
    // đăng nhập lại cùng người → tiếp tục, không mở lại app
    const resumed = ctx._authAfterLogin({ status: 'ok', token: 'NEW', user: { username: 'hung', role: 'user', perms: ['xem', 'them_sua'] } });
    ok('đăng nhập lại cùng tài khoản → tiếp tục phiên', resumed === true && !el('loginOverlay').classList.contains('visible'));
    ok('token mới được lưu', ctx.currentUser.token === 'NEW' && JSON.parse(ctx.localStorage.getItem('ks_user')).token === 'NEW');
    ok('UI quyền được áp lại', ctx._applied >= 1);
}
{
    const { ctx } = load({}, null);
    const resumed = ctx._authAfterLogin({ status: 'ok', token: 'T', user: { username: 'lan', role: 'user1' } });
    ok('đăng nhập bình thường → mở app (không phải tiếp tục)', resumed === false && ctx.currentUser.token === 'T');
    ok('không còn giữ mật khẩu admin trong bộ nhớ', ctx.window._adminAuth === null);
}
{
    const { ctx, el } = load({ status: 'must_change_password' }, { username: 'a', role: 'user', token: 'T' });
    await ctx.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'full_update' }) });
    await tick(); await tick();
    ok('must_change_password → mở hộp đổi mật khẩu bắt buộc', ctx._ccOpened === 1 && el('changeCredentialsModal').classList.contains('cc-forced'));
    ctx._authChangeDone({ status: 'ok', token: 'T2', user: { username: 'a', role: 'user', mustChangePassword: false } });
    ok('đổi MK xong → lưu token mới, bỏ bắt buộc', ctx.currentUser.token === 'T2' && !el('changeCredentialsModal').classList.contains('cc-forced'));
}
{
    const { ctx, errs } = load({ status: 'forbidden', message: 'Không có quyền xoá' }, { username: 'a', role: 'user1', token: 'T' });
    await ctx.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'delete_row' }) });
    await tick(); await tick();
    ok('forbidden → báo lỗi', errs.some(e => e.includes('Không có quyền xoá')));
}
// ── whoami khi mở app ──
{
    const { ctx, sent } = load({ status: 'ok', user: { username: 'a', role: 'user', perms: ['xem'], districts: { all: true, list: [] } }, authMode: 'log' },
        { username: 'a', role: 'user', perms: ['xem', 'xoa'], token: 'T' });
    await ctx._authWhoami();
    ok('whoami gửi token', JSON.parse(sent[0].body).token === 'T');
    ok('quyền thay đổi → cập nhật hồ sơ + áp lại UI, giữ token cũ khi không cấp mới', !ctx.hasPerm('xoa') && ctx._applied === 1 && ctx.currentUser.token === 'T');
}
{
    const { ctx } = load({ status: 'ok', token: 'RENEW', user: { username: 'a', role: 'user', perms: ['xem'] } }, { username: 'a', role: 'user', perms: ['xem'], token: 'T' });
    await ctx._authWhoami();
    ok('gia hạn trượt: whoami cấp token mới → lưu', ctx.currentUser.token === 'RENEW');
}
// ── Banner ──
{
    const { ctx } = load({});
    ok('banner chỉ hiện ở chế độ log', ctx._authBannerText({ mode: 'on' }) === '' && ctx._authBannerText({ mode: 'log', tokenless7d: 3, daysInMode: 2 }).includes('3 lệnh'));
}
// ── Lọc người dùng (quản trị) ──
{
    const { ctx } = load({});
    const us = [
        { username: 'hungnt', displayName: 'Nguyễn Thanh Hùng', state: 'hoat_dong', idleDays: 1, daysLeft: null, nhom: ['XN2'] },
        { username: 'lan', displayName: 'Trần Lan', state: 'khoa', idleDays: 3, daysLeft: null, nhom: [] },
        { username: 'tv', displayName: 'Tư vấn A', state: 'hoat_dong', idleDays: 120, daysLeft: 5, nhom: [] },
        { username: 'old', displayName: 'Cũ', state: 'het_han', idleDays: null, daysLeft: -2, nhom: [] }
    ];
    ok('lọc đã khoá', ctx._uaFilterUsers(us, 'locked', '').map(u => u.username).join() === 'lan');
    ok('lọc sắp/đã hết hạn', ctx._uaFilterUsers(us, 'expiring', '').map(u => u.username).join() === 'tv,old');
    ok('lọc > 90 ngày', ctx._uaFilterUsers(us, 'idle', '').map(u => u.username).join() === 'tv');
    ok('tìm theo nhóm', ctx._uaFilterUsers(us, 'all', 'xn2').map(u => u.username).join() === 'hungnt');
    ok('mật khẩu tạm 10 ký tự', ctx._uaTempPassword().length === 10);
}

// ── Chốt 2: offline, lưu lại sau đăng nhập, gửi trường dời ──
{
    const { ctx, el } = load(() => { throw new Error('offline'); }, { username: 'cu', role: 'user' });
    ctx.window.addEventListener = (ev, fn) => { ctx._onlineFn = fn; };
    ctx.addEventListener = ctx.window.addEventListener;
    ctx.window.fetch = async () => { throw new Error('offline'); };
    await ctx._authWhoami();
    ok('mất mạng + user cũ chưa token → KHÔNG bắt đăng nhập (dùng offline)', !el('loginOverlay').classList.contains('visible'));
}
{
    const { ctx, el, sent } = load({ status: 'ok', pong: 1 }, { username: 'cu', role: 'user' });
    await ctx._authWhoami();
    ok('có mạng + user cũ chưa token → bắt đăng nhập lại', el('loginOverlay').classList.contains('visible') && JSON.parse(sent[0].body).action === 'ping');
}
{
    const { ctx } = load({}, { username: 'a', role: 'user', token: 'T' });
    const calls = [];
    ctx.syncRowToGAS = async (row, opts) => { calls.push([row, opts]); return true; };
    const row = ['ID1', 'A'];
    ctx._authQueueRetry(row, { oldTenTru: 'cũ' });
    ctx._authQueueRetry(row, { oldTenTru: 'cũ' });
    vm.runInContext('_authReloginPending = true', ctx);
    ctx._authAfterLogin({ status: 'ok', token: 'N', user: { username: 'a', role: 'user' } });
    await tick(); await tick();
    ok('lưu bị từ chối vì phiên → đăng nhập lại tự lưu tiếp (1 lần/row, giữ oldTenTru)', calls.length === 1 && calls[0][0] === row && calls[0][1].oldTenTru === 'cũ', calls.length);
}
{
    const { ctx } = load({});
    const full = { action: 'full_update', sheet: 'Quan1', id: 'X', tenTru: 'A', lat: 1, lon: 2, ghiChu: 'g', markerGoc: 'T', khoangCach: '5', loaiDen: 'LED' };
    const mv = ctx._syncPayloadFor({ moveOnly: true }, full);
    ok('moveOnly: chỉ gửi id/tên + trường vị trí/cáp', mv.lat === 1 && mv.markerGoc === 'T' && mv.ghiChu === undefined && mv.loaiDen === undefined && mv.tenTru === 'A');
    ok('moveOnly payload được GAS coi là chỉ-dời', ctx._pmIsMoveOnly('full_update', mv));
    ok('không moveOnly → gửi nguyên', ctx._syncPayloadFor({}, full) === full);
}

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail) process.exit(1);
