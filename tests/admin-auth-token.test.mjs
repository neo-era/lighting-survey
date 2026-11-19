// v214 — Quản lý địa bàn (thêm / ẩn / khôi phục / xóa) bị chặn "Cần xác nhận mật khẩu admin" từ v211:
// _getAdminAuth() có token phiên chỉ trả {username} (không còn giữ mật khẩu) nhưng 4 chỗ vẫn đòi auth.password.
// Run: node tests/admin-auth-token.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); };
const src = ['index.html', ...fs.readdirSync(new URL('../src/features/', import.meta.url)).map(f => 'src/features/' + f)]
    .map(f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');

ok('không còn chỗ nào đòi auth.password sau _getAdminAuth', !/!auth\.password/.test(src));

const sb = loadAppSandbox();
ok('sandbox nạp không lỗi', sb.errors.length === 0, sb.errors);
const W = sb.ctx;
ok('có hàm _adminAuthReady', typeof W._adminAuthReady === 'function');
sb.run('currentUser = { username: "admin", role: "admin", token: "TOK" };');
ok('có token: {username} là đủ', W._adminAuthReady({ username: 'admin' }) === true);
sb.run('currentUser = { username: "admin", role: "admin" };');
ok('không token: {username} thiếu mật khẩu → chưa đủ', W._adminAuthReady({ username: 'admin' }) === false);
ok('không token: có mật khẩu → đủ', W._adminAuthReady({ username: 'admin', password: 'x' }) === true);
ok('null → chưa đủ', W._adminAuthReady(null) === false);

// Luồng thật: tạo địa bàn với token → gửi lệnh create_dia_ban (không dừng ở thông báo mật khẩu)
sb.run('currentUser = { username: "admin", role: "admin", token: "TOK", perms: ["dia_ban","quan_tri"] };');
const els = {};
const el = id => els[id] || (els[id] = { id, value: '', style: {}, textContent: '', innerHTML: '', disabled: false, checked: false });
Object.assign(el('cdbSheet'), { value: 'tankhai' }); Object.assign(el('cdbLabel'), { value: 'Phường Tân Khai' });
Object.assign(el('cdbPrefix'), { value: 'TK' }); Object.assign(el('cdbRegion'), { value: 'Khác' });
W.document.getElementById = id => el(id);
const sent = [];
W.fetch = async (url, o) => { sent.push(JSON.parse(o.body)); return { json: async () => ({ status: 'error', message: 'stop' }) }; };
const fnName = (src.match(/async function (_\w+)\(\)\s*\{[\s\S]{0,400}?cdbSheet/) || [])[1];
ok('tìm thấy hàm tạo địa bàn', !!fnName, fnName);
if (fnName) await W[fnName]();
ok('tạo địa bàn có token: đã gửi create_dia_ban', sent.length === 1 && sent[0].action === 'create_dia_ban', sent);
ok('không hiện "Cần xác nhận mật khẩu admin"', !/mật khẩu admin/.test(String(el(Object.keys(els).find(k => /Err/i.test(k)) || 'x').textContent)));

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail) process.exit(1);
