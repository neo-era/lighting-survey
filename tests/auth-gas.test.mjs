// Phân quyền v211 — test tích hợp: chạy nguyên gas-khaosat.js (đăng nhập, token, kiểm quyền, người dùng/nhóm/vai trò)
// Chạy: node tests/auth-gas.test.mjs
import { makeWorld } from './helpers/gas-world.mjs';

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const TK = ['Tên đăng nhập', 'Mật khẩu', 'Họ tên', 'Vai trò', 'Vùng'];
const H = ['ID', 'Tên trụ', 'Lat', 'Lon', 'Thời gian cập nhật'];
const NV = ['ID', 'Người giao', 'Người nhận', 'Mô tả', 'Khu vực', 'Deadline', 'Trạng thái', 'Kết quả', 'Thời gian đóng'];
const world = (props = {}) => makeWorld({
    stubAuth: false, props,
    mainTabs: {
        // Tài khoản kiểu cũ (5 cột, mật khẩu chưa băm) — kiểm cả chuyển đổi
        TaiKhoan: [TK, ['admin', 'admin123', 'Mai Vũ Lâm', 'admin', ''], ['boss', 'boss123', 'Phó GĐ', 'admin', ''],
            ['hung', 'hung123', 'Hùng', 'user', 'Quan1'], ['lam', 'lam123', 'Lâm', 'user1', ''], ['xem', 'xem123', 'Demo', 'demo', 'Quan8']],
        DanhSachTru: [H, ['TQ_1', 'A', '10,7', '106,6', '']],
        Quan1: [H, ['Q1_1', 'P1', '10,75', '106,7', '']],
        Quan8: [H, ['Q8_1', 'P8', '10,74', '106,65', '']],
        NhiemVu: [NV, ['NV1', 'admin', 'lam', 'Khảo sát Q1', 'Quan1', '', 'assigned', '', '']]
    }
});
const login = (w, u, p) => w.post({ action: 'login', username: u, password: p });

// ── 1. Chuyển đổi + đăng nhập ─────────────────────────────
{
    const w = world();
    const r = login(w, 'hung', 'hung123');
    ok('đăng nhập trả token + quyền + địa bàn', r.status === 'ok' && r.token && r.user.perms.includes('xoa') && r.user.districts.list.join() === 'Quan1', r);
    const tk = w.active.getSheetByName('TaiKhoan');
    ok('chuyển đổi: thêm đủ 12 cột', tk.data[0].length >= 12 && tk.data[0][11] === 'Đổi MK');
    ok('chuyển đổi: vùng trống (nghĩa cũ = tất cả) → "*"', tk.data[1][4] === '*' && tk.data[4][4] === '*');
    ok('chuyển đổi: mỗi người có UID + phiên 1', tk.data.slice(1).every(r => r[10] && Number(r[9]) === 1));
    ok('chuyển đổi chỉ chạy 1 lần (cờ AUTH_SCHEMA)', w.props.AUTH_SCHEMA === '1');
    const l = login(w, 'lam', 'lam123');
    ok('app cũ: vùng "*" trả về [] (nghĩa cũ = tất cả)', Array.isArray(l.user.vung) && l.user.vung.length === 0 && l.user.districts.all);
    ok('mật khẩu cũ chưa băm → tự băm sau đăng nhập', String(tk.data[3][1]).startsWith('pbkdf2sha256$'));
    ok('ghi "đăng nhập cuối"', !!tk.data[3][8]);
    ok('ghi LichSu đăng nhập', w.active.getSheetByName('LichSu').data.some(r => r[2] === 'login' && r[1] === 'hung'));
}
// ── 2. Chống dò mật khẩu ──────────────────────────────────
{
    const w = world();
    for (let i = 0; i < 5; i++) login(w, 'hung', 'sai');
    ok('sai 5 lần → khoá đăng nhập kể cả đúng mật khẩu', /15 phút/.test(login(w, 'hung', 'hung123').message));
    w.tick(16 * 60e3);
    ok('sau 15 phút đăng nhập lại được', login(w, 'hung', 'hung123').status === 'ok');
    ok('sai mật khẩu ghi LichSu login_fail', w.active.getSheetByName('LichSu').data.some(r => r[2] === 'login_fail'));
}
// ── 3. Kiểm quyền lệnh ghi ────────────────────────────────
{
    const w = world();
    const tH = login(w, 'hung', 'hung123').token, tL = login(w, 'lam', 'lam123').token, tX = login(w, 'xem', 'xem123').token;
    ok('mặc định chế độ log', login(w, 'hung', 'hung123').authMode === 'log');
    ok('user sửa trụ Quan1 → được', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', ghiChu: 'x', token: tH }).status === 'ok');
    const r1 = w.post({ action: 'full_update', sheet: 'Quan8', id: 'Q8_1', tenTru: 'P8', ghiChu: 'x', token: tH });
    ok('user ghi ngoài địa bàn (Quan8) → chặn', r1.status === 'forbidden', r1);
    ok('user1 xoá → chặn', w.post({ action: 'delete_row', sheet: 'Quan1', id: 'Q1_1', token: tL }).status === 'forbidden');
    ok('demo sửa → chặn', w.post({ action: 'full_update', sheet: 'Quan8', id: 'Q8_1', tenTru: 'P8', ghiChu: 'y', token: tX }).status === 'forbidden');
    const before = JSON.stringify(w.active.getSheetByName('TaiKhoan').data);
    const r2 = w.post({ action: 'full_update', sheet: 'TaiKhoan', id: 'x', tenTru: 'admin', vaiTro: 'admin' });
    ok('ghi vào tab TaiKhoan (không token) → chặn, sheet không đổi', r2.status === 'forbidden' && r2.code === 'bad_tab' && JSON.stringify(w.active.getSheetByName('TaiKhoan').data) === before, r2);
    ok('ghi vào tab lạ → chặn (không rơi về DanhSachTru)', w.post({ action: 'full_update', sheet: 'Quan99', id: 'x', tenTru: 'z', token: tH }).code === 'bad_tab');
    const r3 = w.post({ action: 'full_update', sheet: 'Quan8', id: 'Q8_1', tenTru: 'P8', ghiChu: 'cũ' });
    ok('chế độ log: app cũ không token → vẫn ghi được', r3.status === 'ok', r3);
    const st = w.post({ action: 'auth_status', token: login(w, 'admin', 'admin123').token });
    ok('vi phạm không token được đếm cho điều kiện bật "on"', st.status === 'ok' && st.auth.tokenless7d >= 1 && !st.auth.canTurnOn, st);
    ok('lệnh quản trị không token (chế độ log) → vẫn chặn', w.post({ action: 'list_users' }).status === 'auth_required');
    ok('lệnh quản trị bằng mật khẩu admin (app cũ) → được', w.post({ action: 'list_users', adminAuth: { username: 'admin', password: 'admin123' } }).status === 'ok');
    ok('lệnh quản trị với token user → chặn', w.post({ action: 'list_users', token: tH }).status === 'forbidden');
    ok('token giả (sửa nội dung) → auth_required', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', token: 'x' + tH }).status === 'auth_required');
    ok('log_action lấy người thực hiện từ token, bỏ qua giá trị app gửi', w.post({ action: 'log_action', loaiThaoTac: 'edit', nguoiThucHien: 'admin', token: tL }).status === 'ok'
        && w.active.getSheetByName('LichSu').data.some(r => r[2] === 'edit' && r[1] === 'lam'));
}
// ── 4. Bật chế độ chặn ────────────────────────────────────
{
    const w = world();
    const tA = login(w, 'admin', 'admin123').token;
    w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', ghiChu: 'cũ', nguoiThucHien: 'thao' });
    const r = w.post({ action: 'set_auth_mode', mode: 'on', token: tA });
    ok('còn vi phạm → không cho bật "on", nêu người', r.status === 'error' && r.code === 'has_violations' && r.auth.byUser.thao === 1, r);
    ok('không cho đặt "off" qua app', w.post({ action: 'set_auth_mode', mode: 'off', token: tA }).status === 'error');
    ok('bật cưỡng bức → được, ghi LichSu', w.post({ action: 'set_auth_mode', mode: 'on', force: true, token: tA }).status === 'ok' && w.active.getSheetByName('LichSu').data.some(r => r[2] === 'auth_mode'));
    ok('chế độ on: app cũ không token → auth_required', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1' }).status === 'auth_required');
}
// ── 5. Khoá / thu hồi phiên / buộc đổi mật khẩu ────────────
{
    const w = world();
    const tA = login(w, 'admin', 'admin123').token, tL = login(w, 'lam', 'lam123').token;
    ok('tự khoá chính mình → không', /chính mình/.test(w.post({ action: 'lock_user', targetUsername: 'admin', token: tA }).message));
    const pv = w.post({ action: 'lock_user', targetUsername: 'lam', preview: true, token: tA });
    ok('khoá: xem trước số việc đang mở (1 nhiệm vụ)', pv.preview && pv.nhiemVu === 1, pv);
    const lk = w.post({ action: 'lock_user', targetUsername: 'lam', transferTo: 'hung', reason: 'nghỉ việc', token: tA });
    ok('khoá + bàn giao nhiệm vụ cho hung', lk.status === 'ok' && lk.moved === 1 && w.active.getSheetByName('NhiemVu').data[1][2] === 'hung', lk);
    ok('token của người bị khoá hết hiệu lực ngay', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', token: tL }).status === 'auth_required');
    ok('người bị khoá không đăng nhập được', /khoá/.test(login(w, 'lam', 'lam123').message));
    ok('mở khoá → đăng nhập lại được', w.post({ action: 'unlock_user', targetUsername: 'lam', token: tA }).status === 'ok' && login(w, 'lam', 'lam123').status === 'ok');
    const tH = login(w, 'hung', 'hung123').token;
    ok('đặt lại mật khẩu → token cũ mất hiệu lực', w.post({ action: 'reset_password', targetUsername: 'hung', newPassword: 'tam123', token: tA }).status === 'ok'
        && w.post({ action: 'whoami', token: tH }).status === 'auth_required');
    const r = login(w, 'hung', 'tam123');
    ok('đăng nhập bằng mật khẩu tạm → mustChangePassword', r.status === 'ok' && r.user.mustChangePassword);
    ok('chưa đổi mật khẩu → lệnh ghi bị chặn', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', token: r.token }).status === 'must_change_password');
    const cc = w.post({ action: 'change_credentials', username: 'hung', currentPassword: 'tam123', newPassword: 'moi123' });
    ok('đổi mật khẩu → trả token mới, bỏ cờ', cc.status === 'ok' && cc.token && !cc.user.mustChangePassword, cc);
    ok('token mới ghi được', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', ghiChu: 'ok', token: cc.token }).status === 'ok');
    ok('đổi tên trùng người khác → từ chối', /đã có/.test(w.post({ action: 'change_credentials', username: 'hung', currentPassword: 'moi123', newUsername: 'admin' }).message));
    ok('đăng xuất mọi máy → token mất hiệu lực', w.post({ action: 'revoke_sessions', targetUsername: 'hung', token: tA }).status === 'ok'
        && w.post({ action: 'whoami', token: cc.token }).status === 'auth_required');
    ok('xoá tài khoản đã từng đăng nhập → từ chối (khoá thay)', /KHOÁ/.test(w.post({ action: 'delete_user', targetUsername: 'hung', token: tA }).message));
    ok('xoá tài khoản chưa từng đăng nhập → được', w.post({ action: 'delete_user', targetUsername: 'boss', token: tA }).status === 'ok');
    ok('hạ quyền admin cuối cùng của chính mình → không', w.post({ action: 'update_user', targetUsername: 'admin', updates: { role: 'user' }, token: tA }).status === 'error');
}
// ── 6. Vai trò tự định nghĩa + nhóm ───────────────────────
{
    const w = world();
    const tA = login(w, 'admin', 'admin123').token;
    ok('không sửa vai trò hệ thống', w.post({ action: 'save_role', isNew: true, role: { ma: 'user', ten: 'x', quyen: ['xem'] }, token: tA }).status === 'error');
    ok('tạo vai trò "giam_doi" (có sẵn vai trò mẫu giam_sat)', w.post({ action: 'list_roles', token: tA }).roles.some(r => r.ma === 'giam_sat')
        && w.post({ action: 'save_role', isNew: true, role: { ma: 'doi_truong', ten: 'Đội trưởng', quyen: ['them_sua', 'xoa'] }, token: tA }).status === 'ok');
    ok('nhóm: địa bàn lạ → từ chối', w.post({ action: 'save_group', isNew: true, group: { ma: 'XN2', ten: 'XN 2', diaBan: 'Quan99' }, token: tA }).status === 'error');
    ok('tạo nhóm XN2 = Quan8', w.post({ action: 'save_group', isNew: true, group: { ma: 'XN2', ten: 'Xí nghiệp 2', diaBan: 'Quan8' }, token: tA }).status === 'ok');
    ok('tạo người ngoài không hạn → từ chối', w.post({ action: 'create_user', newUser: { username: 'akt', password: 'akt123', role: 'tu_van', vung: 'Quan8' }, token: tA }).status === 'error');
    const cu = w.post({ action: 'create_user', newUser: { username: 'thao', password: 'thao123', displayName: 'Thảo', role: 'doi_truong', nhom: 'XN2', vung: '' }, token: tA });
    ok('tạo người: vai trò mới + nhóm XN2, vùng riêng trống', cu.status === 'ok' && cu.user.districts.list.join() === 'Quan8' && !cu.user.districts.all, cu);
    const cc = w.post({ action: 'change_credentials', username: 'thao', currentPassword: 'thao123', newPassword: 'thao456' });
    const tT = cc.token;
    ok('thành viên nhóm ghi được địa bàn nhóm', w.post({ action: 'delete_row', sheet: 'Quan8', id: 'Q8_1', tenTru: 'P8', token: tT }).status === 'ok');
    ok('… nhưng không ghi địa bàn khác', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', token: tT }).status === 'forbidden');
    w.post({ action: 'save_group', group: { ma: 'XN2', ten: 'Xí nghiệp 2', diaBan: 'Quan8,Quan1' }, token: tA });
    ok('đổi địa bàn nhóm có hiệu lực ngay (không chờ cache)', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', ghiChu: 'z', token: tT }).status === 'ok');
    w.post({ action: 'save_role', role: { ma: 'doi_truong', ten: 'Đội trưởng', quyen: ['them_sua'] }, token: tA });
    ok('bỏ quyền xoa khỏi vai trò → có hiệu lực ngay', w.post({ action: 'delete_row', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', token: tT }).status === 'forbidden');
    ok('xoá nhóm còn thành viên → từ chối', w.post({ action: 'delete_group', ma: 'XN2', token: tA }).status === 'error');
    const dr = w.post({ action: 'delete_role', ma: 'doi_truong', token: tA });
    ok('xoá vai trò đang dùng → đòi vai trò thay thế', dr.code === 'need_replace' && dr.count === 1, dr);
    ok('xoá vai trò + chuyển người sang user1', w.post({ action: 'delete_role', ma: 'doi_truong', replaceWith: 'user1', token: tA }).status === 'ok'
        && w.post({ action: 'list_users', token: tA }).users.find(u => u.username === 'thao').role === 'user1');
    const lu = w.post({ action: 'list_users', token: tA });
    ok('list_users trả kèm vai trò, nhóm, danh mục quyền, tab địa bàn, trạng thái kiểm quyền', lu.roles.length >= 6 && lu.groups.length === 1 && lu.catalog.length === 18 && lu.dataTabs.includes('Quan8') && lu.auth.mode === 'log');
}
// ── 7. whoami + gia hạn trượt + hết hạn tài khoản ─────────
{
    const w = world();
    const tA = login(w, 'admin', 'admin123').token;
    const r = w.post({ action: 'whoami', token: tA });
    ok('whoami: hồ sơ mới nhất, chưa cấp token mới khi còn hạn dài', r.status === 'ok' && r.user.username === 'admin' && !r.token && r.authStatus);
    w.tick(25 * 86400e3);
    const r2 = w.post({ action: 'whoami', token: tA });
    ok('còn < 7 ngày → cấp token mới', r2.status === 'ok' && !!r2.token);
    w.tick(6 * 86400e3);
    ok('token cũ hết hạn → auth_required; token mới vẫn dùng được', w.post({ action: 'whoami', token: tA }).status === 'auth_required' && w.post({ action: 'whoami', token: r2.token }).status === 'ok');
    w.post({ action: 'create_user', newUser: { username: 'akt', password: 'akt123', role: 'tu_van', vung: 'Quan8', hetHan: '2026-12-01', mustChange: false }, token: r2.token });
    ok('tài khoản bên ngoài hết hạn → không đăng nhập được', /hết hạn/.test(login(w, 'akt', 'akt123').message));
}
// ── 8. Nhiệm vụ: người được giao tự cập nhật ───────────────
{
    const w = world();
    const tL = login(w, 'lam', 'lam123').token, tH = login(w, 'hung', 'hung123').token;
    ok('người được giao chuyển sang đang làm → được', w.post({ action: 'update_nhiem_vu_status', id: 'NV1', newStatus: 'in_progress', token: tL }).status === 'ok');
    ok('người khác (không quyền nhiem_vu) → chặn', w.post({ action: 'update_nhiem_vu_status', id: 'NV1', newStatus: 'submitted', token: tH }).status === 'forbidden');
}

// ── Chốt 2 — vá bảo mật ──────────────────────────────────
{
    const w = world();
    const tA = login(w, 'admin', 'admin123').token;
    for (let i = 0; i < 5; i++) w.post({ action: 'list_users', adminAuth: { username: 'admin', password: 'sai' } });
    ok('mật khẩu admin kiểu cũ: sai 5 lần → khoá dò (kể cả đúng)', w.post({ action: 'list_users', adminAuth: { username: 'admin', password: 'admin123' } }).status !== 'ok');
    w.tick(16 * 60e3);
    w.post({ action: 'set_auth_mode', mode: 'on', force: true, token: tA });
    ok('chế độ on: không nhận mật khẩu admin kiểu cũ', w.post({ action: 'list_users', adminAuth: { username: 'admin', password: 'admin123' } }).status !== 'ok');
    ok('chế độ on: token vẫn dùng được', w.post({ action: 'list_users', token: tA }).status === 'ok');
}
{
    const w = world();
    const tA = login(w, 'admin', 'admin123').token;
    // vai trò chỉ được dời
    w.post({ action: 'save_role', isNew: true, role: { ma: 'doi', ten: 'Chỉ dời', quyen: ['xem', 'di_chuyen'] }, token: tA });
    w.post({ action: 'update_user', targetUsername: 'lam', updates: { role: 'doi' }, token: tA });
    const tL = login(w, 'lam', 'lam123').token;
    const q1 = () => w.active.getSheetByName('Quan1').data;
    const r1 = w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'TEN_MOI', lat: '10,8', lon: '106,8', token: tL });
    ok('chỉ dời: cập nhật toạ độ được', r1.status === 'ok' && q1()[1][2] === '10,8', r1);
    ok('chỉ dời: KHÔNG đổi được tên trụ', q1()[1][1] === 'P1', q1()[1]);
    const n0 = q1().length;
    const r2 = w.post({ action: 'full_update', sheet: 'Quan1', id: 'KHONG_CO', tenTru: 'MOI', lat: '10,9', lon: '106,9', token: tL });
    ok('chỉ dời: không tạo được trụ mới', r2.status === 'forbidden' && q1().length === n0, r2);
    ok('client gửi _moveOnly/_authUser giả → bị bỏ', w.post({ action: 'list_users', _authUser: { username: 'admin', perms: ['quan_tri'] } }).status === 'auth_required');
}
{
    const w = world({ GITHUB_TOKEN: 'ghp_test' });
    const tA = login(w, 'admin', 'admin123').token;
    w.post({ action: 'update_user', targetUsername: 'boss', updates: { role: 'user' }, token: tA });
    const r = w.post({ action: 'update_user', targetUsername: 'admin', updates: { hetHan: '2020-01-01' }, token: tA });
    ok('không tự đặt hết hạn quá khứ cho quản trị cuối', r.status === 'error', r);
    const gh = w.post({ action: 'upload_to_github', path: 'index.html', content: 'eA==', token: tA });
    ok('đẩy GitHub: chặn đường dẫn ngoài data/*.xlsx', gh.status === 'error' && /data\//.test(gh.message), gh);
    const tH = login(w, 'hung', 'hung123').token;
    w.post({ action: 'lock_user', targetUsername: 'hung', token: tA });
    const cc = w.post({ action: 'change_credentials', username: 'hung', currentPassword: 'hung123', newUsername: 'hung2' });
    ok('tài khoản đã khoá không đổi tên/mật khẩu được', cc.status === 'error' && /khoá|hết hạn/.test(cc.message), cc);
    const cc2 = w.post({ action: 'change_credentials', username: 'lam', currentPassword: 'lam123', newUsername: 'tên có dấu' });
    ok('đổi tên đăng nhập: kiểm định dạng', cc2.status === 'error', cc2);
}

{
    const w = world();
    login(w, 'admin', 'admin123');   // chuyển đổi xong
    const tk = w.active.getSheetByName('TaiKhoan');
    const row = tk.data[0].map(() => ''); row[0] = 'tay'; row[1] = 'tay123'; row[2] = 'Thêm tay'; row[3] = 'user1'; row[4] = '*';
    tk.data.push(row);
    w.ctx._AX.users = null;   // GAS thật: mỗi lượt chạy là biến toàn cục mới
    const r = login(w, 'tay', 'tay123');
    ok('dòng thêm tay sau chuyển đổi → đăng nhập + token dùng được', r.status === 'ok' && w.post({ action: 'whoami', token: r.token }).status === 'ok', r);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
