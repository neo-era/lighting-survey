// ══════════════════════════════════════════════════════════════════════════
// Phân quyền (v211) — lõi thuần dùng chung app + GAS. Xem docs/design-user-groups-roles.md
// Khối @@PERMS được chép NGUYÊN VĂN vào gas-khaosat.js (test tests/perms-core.test.mjs so khớp).
// Viết ES5 + arrow-free để chạy giống nhau trên trình duyệt và Apps Script V8.
// ══════════════════════════════════════════════════════════════════════════
// @@PERMS_START
var PERM_CATALOG = [
  ['xem', 'Xem bản đồ', 'Cơ bản'],
  ['xuat_du_lieu', 'Xuất dữ liệu trong địa bàn', 'Cơ bản'],
  ['xuat_toan_bo', 'Xuất toàn bộ dữ liệu', 'Cơ bản'],
  ['them_sua', 'Thêm / sửa trụ, tủ', 'Dữ liệu'],
  ['di_chuyen', 'Dời vị trí, sửa cáp', 'Dữ liệu'],
  ['xoa', 'Xoá trụ, tủ', 'Dữ liệu'],
  ['nhap_hang_loat', 'Nhập CSV/Excel, công cụ hàng loạt', 'Dữ liệu'],
  ['su_co', 'Báo / cập nhật sự cố', 'Vận hành'],
  ['bao_tri', 'Quản lý bảo trì', 'Vận hành'],
  ['nhiem_vu', 'Giao / duyệt nhiệm vụ', 'Vận hành'],
  ['giam_sat', 'Xem camera, đèn tắt', 'Vận hành'],
  ['lich_su', 'Xem nhật ký thao tác', 'Quản trị'],
  ['chia_se', 'Tạo link chia sẻ công khai', 'Quản trị'],
  ['github', 'Đồng bộ GitHub', 'Quản trị'],
  ['dia_ban', 'Quản lý địa bàn, preset toạ độ', 'Quản trị'],
  ['sao_luu', 'Sao lưu & khôi phục', 'Quản trị'],
  ['bao_cao', 'Gửi báo cáo ngày/tháng', 'Quản trị'],
  ['quan_tri', 'Quản lý người dùng, nhóm, vai trò', 'Quản trị']
];
var PERM_KEYS = PERM_CATALOG.map(function (p) { return p[0]; });

// Vai trò hệ thống: tương đương hành vi trước v211 (canEdit/canDelete/canDrag/canGithubSync/isAdmin)
var SYSTEM_ROLES = {
  admin: { ten: 'Quản trị', quyen: ['*'] },
  user:  { ten: 'Đầy đủ', quyen: ['xem', 'xuat_du_lieu', 'xuat_toan_bo', 'them_sua', 'di_chuyen', 'xoa', 'nhap_hang_loat', 'su_co'] },
  user1: { ten: 'Khảo sát viên', quyen: ['xem', 'xuat_du_lieu', 'xuat_toan_bo', 'them_sua', 'su_co'] },
  demo:  { ten: 'Chỉ xem', quyen: ['xem', 'xuat_du_lieu', 'xuat_toan_bo'] }
};
// Vai trò mẫu gieo lần đầu (sửa/xoá được)
var SAMPLE_ROLES = {
  giam_sat: { ten: 'Giám sát / Trưởng XN', quyen: ['xem', 'xuat_du_lieu', 'them_sua', 'di_chuyen', 'su_co', 'bao_tri', 'nhiem_vu', 'lich_su'] },
  tu_van:   { ten: 'Tư vấn / Nhà thầu', quyen: ['xem', 'xuat_du_lieu'], benNgoai: true }
};

// Trường được phép đổi khi chỉ có quyền "di_chuyen" (dời vị trí, sửa cáp)
var MOVE_FIELDS = ['lat', 'lon', 'vn2000x', 'vn2000y', 'markerGoc', 'khoangCach', 'capNhat', 'labelOffset', 'loaiCap'];
// Trường định danh/điều khiển trong payload — không tính là "đổi dữ liệu"
var META_FIELDS = ['action', 'sheet', 'id', 'tenTru', 'oldTenTru', 'token', 'adminAuth', 'clientEpochSeen', 'nguoiThucHien', 'fields'];

// Luật từng lệnh:
//  pub  : không cần đăng nhập
//  login: chỉ cần đăng nhập (mọi quyền)
//  all  : cần ĐỦ các quyền   · any: cần ÍT NHẤT 1 quyền
//  tab  : có ghi vào tab địa bàn (data.sheet) → kiểm danh sách tab + địa bàn hiệu lực
//  strict: luôn chặn thật kể cả AUTH_MODE = log
//  move : quyền di_chuyen thay được them_sua nếu chỉ đổi MOVE_FIELDS
//  self : handler tự kiểm thêm (vd chủ nhiệm vụ)
var ACTION_RULES = {
  ping: { pub: 1 }, login: { pub: 1 }, whoami: { pub: 1 }, change_credentials: { pub: 1 },
  backup_health: { pub: 1 }, list_presets: { pub: 1 }, list_roads: { pub: 1 }, list_dia_ban: { pub: 1 },
  check_sheet: { login: 1 }, get_daily_report: { login: 1 }, log_action: { login: 1 }, log_export: { any: ['xuat_du_lieu', 'xuat_toan_bo'] },
  full_update: { all: ['them_sua'], tab: 1, move: 1 },
  batch_match_update: { all: ['them_sua'], tab: 1, move: 1 },
  delete_row: { all: ['xoa'], tab: 1 },
  batch_import: { all: ['them_sua', 'nhap_hang_loat'], tab: 1 },
  assign_phases: { all: ['them_sua'], tab: 1 },
  fill_marker_goc: { all: ['nhap_hang_loat'], tab: 1 },
  fill_marker_goc_chain: { all: ['nhap_hang_loat'], tab: 1 },
  normalize_coords: { all: ['nhap_hang_loat'], tab: 1 },
  fix_loai: { all: ['nhap_hang_loat'], tab: 1 },
  purge_no_gps: { all: ['xoa', 'nhap_hang_loat'], tab: 1 },
  backup_pre_import: { any: ['nhap_hang_loat', 'them_sua', 'xoa', 'di_chuyen'], tab: 1 },
  upload_image: { any: ['them_sua', 'su_co'] },
  save_road: { all: ['them_sua'] }, delete_road: { all: ['them_sua'] },
  report_suco: { all: ['su_co'] }, update_suco: { all: ['su_co'] },
  create_bao_tri: { all: ['bao_tri'] }, complete_bao_tri: { all: ['bao_tri'] },
  create_nhiem_vu: { all: ['nhiem_vu'] }, update_nhiem_vu_status: { login: 1, self: 1 },
  upload_to_github: { all: ['github'], strict: 1 },
  save_preset: { all: ['dia_ban'], strict: 1 }, delete_preset: { all: ['dia_ban'], strict: 1 },
  create_dia_ban: { all: ['dia_ban'], strict: 1 }, archive_dia_ban: { all: ['dia_ban'], strict: 1 },
  restore_dia_ban: { all: ['dia_ban'], strict: 1 }, delete_dia_ban: { all: ['dia_ban'], strict: 1 },
  backup_now: { all: ['sao_luu'], strict: 1 }, list_backups: { all: ['sao_luu'], strict: 1 },
  restore_preview: { all: ['sao_luu'], strict: 1 }, restore_backup_sheet: { all: ['sao_luu'], strict: 1 },
  send_monthly_report: { all: ['bao_cao'], strict: 1 }, send_daily_report: { all: ['bao_cao'], strict: 1 },
  list_users: { all: ['quan_tri'], strict: 1 }, create_user: { all: ['quan_tri'], strict: 1 },
  update_user: { all: ['quan_tri'], strict: 1 }, reset_password: { all: ['quan_tri'], strict: 1 },
  delete_user: { all: ['quan_tri'], strict: 1 }, lock_user: { all: ['quan_tri'], strict: 1 },
  unlock_user: { all: ['quan_tri'], strict: 1 }, revoke_sessions: { all: ['quan_tri'], strict: 1 },
  list_roles: { all: ['quan_tri'], strict: 1 }, save_role: { all: ['quan_tri'], strict: 1 },
  delete_role: { all: ['quan_tri'], strict: 1 }, list_groups: { all: ['quan_tri'], strict: 1 },
  save_group: { all: ['quan_tri'], strict: 1 }, delete_group: { all: ['quan_tri'], strict: 1 },
  set_auth_mode: { all: ['quan_tri'], strict: 1 }, auth_status: { all: ['quan_tri'], strict: 1 }
};

// Tab hệ thống — không bao giờ được ghi qua lệnh dữ liệu
var SYSTEM_TABS = ['taikhoan', 'vaitro', 'nhomnguoidung', 'lichsu', 'diaban', 'phanquyen', 'phan quyen', 'setting',
  'offsetpresets', 'suco', 'baotri', 'nhiemvu', 'duongve', 'apikeys'];

function _pmList(s) {
  if (Array.isArray(s)) return s.map(function (x) { return String(x).trim(); }).filter(function (x) { return x; });
  return String(s == null ? '' : s).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
}

// rolesMap: { ma: {ten, quyen:[...]} } (đã gộp SYSTEM_ROLES). Vai trò không tồn tại → chỉ "xem".
function _pmEffPerms(roleCode, rolesMap) {
  var code = String(roleCode || '').trim().toLowerCase();
  var r = (rolesMap && rolesMap[code]) || SYSTEM_ROLES[code];
  if (!r) return ['xem'];
  var q = _pmList(r.quyen);
  if (q.indexOf('*') >= 0) return PERM_KEYS.slice();
  var out = [];
  q.forEach(function (k) { if (PERM_KEYS.indexOf(k) >= 0 && out.indexOf(k) < 0) out.push(k); });
  if (out.indexOf('xem') < 0) out.unshift('xem');
  return out;
}

// Địa bàn GHI hiệu lực. Mặc định từ chối: '*' = tất cả, trống = không có.
// userVung: chuỗi/mảng vùng riêng · groupCodes: mã nhóm của người · groupsMap: {ma:{diaBan, trangThai}}
// → { all: bool, list: [tab...], sources: { tab: ['riêng'|'nhóm X'] } }
function _pmEffDistricts(userVung, groupCodes, groupsMap, isAdminRole) {
  var res = { all: false, list: [], sources: {} };
  if (isAdminRole) { res.all = true; return res; }
  function add(tab, src) {
    if (tab === '*') { res.all = true; return; }
    if (res.list.indexOf(tab) < 0) res.list.push(tab);
    (res.sources[tab] = res.sources[tab] || []).push(src);
  }
  _pmList(userVung).forEach(function (t) { add(t, 'riêng'); });
  _pmList(groupCodes).forEach(function (g) {
    var G = groupsMap && groupsMap[g];
    if (!G || String(G.trangThai || 'hoat_dong') !== 'hoat_dong') return;
    _pmList(G.diaBan).forEach(function (t) { add(t, 'nhóm ' + g); });
  });
  return res;
}

function _pmCanWriteTab(eff, tab) {
  if (!eff) return false;
  if (eff.all) return true;
  return eff.list.indexOf(String(tab || '').trim()) >= 0;
}

function _pmIsSystemTab(tab) {
  var t = String(tab || '').trim().toLowerCase();
  return !t || t.charAt(0) === '_' || SYSTEM_TABS.indexOf(t) >= 0;
}

// Payload chỉ đổi các trường "dời vị trí" (full_update: các key; batch_match_update: records[].*)
function _pmIsMoveOnly(action, data) {
  function onlyMove(obj) {
    var ks = Object.keys(obj || {});
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (META_FIELDS.indexOf(k) >= 0) continue;
      if (MOVE_FIELDS.indexOf(k) < 0) return false;
    }
    return true;
  }
  if (action === 'batch_match_update') {
    var recs = (data && data.records) || [];
    for (var j = 0; j < recs.length; j++) if (!onlyMove(recs[j])) return false;
    return true;
  }
  return onlyMove(data);
}

// Trạng thái tài khoản lúc nowMs: 'hoat_dong' | 'khoa' | 'het_han'
function _pmUserState(trangThai, hetHan, nowMs) {
  if (String(trangThai || 'hoat_dong').trim() === 'khoa') return 'khoa';
  var h = String(hetHan || '').trim();
  if (h) {
    var ms = /^\d{4}-\d{2}-\d{2}$/.test(h) ? Date.parse(h + 'T23:59:59+07:00') : Date.parse(h);
    if (ms > 0 && nowMs > ms) return 'het_han';
  }
  return 'hoat_dong';
}

// Quyết định cho/chặn 1 lệnh.
// ctx: { action, data, mode: 'log'|'on'|'off', tokenState: 'none'|'valid'|'invalid',
//        user: null | { username, state, perms:[], districts:{all,list} }, tabKnown: bool (tab có thật trong danh mục địa bàn) }
// → { allow, violation (ghi nhật ký), code: 'ok'|'auth_required'|'forbidden'|'bad_tab'|'unknown_action', message }
function _pmDecide(ctx) {
  var rule = ACTION_RULES[ctx.action];
  if (!rule) return { allow: false, violation: false, code: 'unknown_action', message: 'Lệnh không hợp lệ: ' + ctx.action };
  var data = ctx.data || {};
  // B2 — luôn chặn ghi vào tab hệ thống / tab lạ (kể cả khi chưa bật kiểm quyền)
  if (rule.tab) {
    var tab = String(data.sheet || 'DanhSachTru');
    if (_pmIsSystemTab(tab) || ctx.tabKnown === false) {
      return { allow: false, violation: true, code: 'bad_tab', message: 'Không được ghi vào tab "' + tab + '"' };
    }
  }
  if (rule.pub) return { allow: true, violation: false, code: 'ok' };
  var mode = ctx.mode || 'log';
  var u = ctx.user;
  // Không có phiên hợp lệ
  if (ctx.tokenState !== 'valid' || !u) {
    var msg = ctx.tokenState === 'invalid' ? 'Phiên đăng nhập hết hạn hoặc không hợp lệ — đăng nhập lại.' : 'Cần đăng nhập (cập nhật app lên bản mới).';
    if (mode === 'off' && !rule.strict) return { allow: true, violation: false, code: 'ok' };
    if (!rule.strict && mode !== 'on' && ctx.tokenState === 'none') return { allow: true, violation: true, code: 'auth_required', message: msg };
    return { allow: false, violation: true, code: 'auth_required', message: msg };
  }
  if (u.state !== 'hoat_dong') {
    return { allow: false, violation: true, code: 'auth_required', message: u.state === 'khoa' ? 'Tài khoản đã bị khoá — liên hệ quản trị.' : 'Tài khoản đã hết hạn — liên hệ quản trị.' };
  }
  var perms = u.perms || [];
  var has = function (k) { return perms.indexOf(k) >= 0; };
  var ok = true;
  if (rule.all) ok = rule.all.every(has);
  if (rule.any) ok = ok && rule.any.some(has);
  if (!ok && rule.move && has('di_chuyen') && _pmIsMoveOnly(ctx.action, data)) ok = true;
  if (!ok) return { allow: false, violation: true, code: 'forbidden', message: 'Tài khoản không có quyền thực hiện thao tác này.' };
  if (rule.tab && !_pmCanWriteTab(u.districts, data.sheet || 'DanhSachTru')) {
    return { allow: false, violation: true, code: 'forbidden', message: 'Địa bàn "' + (data.sheet || 'DanhSachTru') + '" không thuộc phạm vi được giao.' };
  }
  return { allow: true, violation: false, code: 'ok' };
}

// Luật "không tự khoá mình ra ngoài": sau thay đổi phải còn ≥1 tài khoản hoạt động có quan_tri,
// và người thực hiện không tự khoá / tự bỏ quyền quan_tri của mình.
// users: [{username, role, state}] · change: {target, role?, state?, remove?} · actor: username
function _pmLockoutCheck(users, rolesMap, change, actor) {
  var tgt = String(change.target || '').toLowerCase(), me = String(actor || '').toLowerCase();
  var after = users.filter(function (u) { return !(change.remove && u.username.toLowerCase() === tgt); }).map(function (u) {
    if (u.username.toLowerCase() !== tgt) return u;
    return { username: u.username, role: change.role != null ? change.role : u.role, state: change.state != null ? change.state : u.state };
  });
  var self = null;
  after.forEach(function (u) { if (u.username.toLowerCase() === me) self = u; });
  if (tgt === me) {
    if (change.remove) return { ok: false, err: 'Không thể tự xoá chính mình' };
    if (!self || self.state !== 'hoat_dong' || _pmEffPerms(self.role, rolesMap).indexOf('quan_tri') < 0) {
      return { ok: false, err: 'Không thể tự khoá hoặc tự bỏ quyền quản trị của chính mình' };
    }
  }
  var admins = after.filter(function (u) { return u.state === 'hoat_dong' && _pmEffPerms(u.role, rolesMap).indexOf('quan_tri') >= 0; });
  if (!admins.length) return { ok: false, err: 'Phải còn ít nhất 1 tài khoản quản trị đang hoạt động' };
  return { ok: true };
}

// Kiểm vai trò trước khi lưu
function _pmValidateRole(ma, ten, quyen, isNew) {
  var code = String(ma || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,29}$/.test(code)) return { ok: false, err: 'Mã vai trò 2–30 ký tự a-z, 0-9, _ và bắt đầu bằng chữ' };
  if (SYSTEM_ROLES[code]) return { ok: false, err: 'Không sửa được vai trò hệ thống "' + code + '"' };
  if (!String(ten || '').trim()) return { ok: false, err: 'Thiếu tên vai trò' };
  var q = _pmList(quyen);
  for (var i = 0; i < q.length; i++) if (PERM_KEYS.indexOf(q[i]) < 0) return { ok: false, err: 'Quyền không hợp lệ: ' + q[i] };
  return { ok: true, code: code };
}

// ── Token phiên: payload JSON → base64 web-safe "." chữ ký. sign(str)→chuỗi base64 web-safe ──
function _pmTokMake(payload, sign, b64enc) {
  var body = b64enc(JSON.stringify(payload));
  return body + '.' + sign(body);
}
function _pmTokEq(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
// → { ok, payload, err: 'format'|'sig'|'expired' }
function _pmTokParse(tok, sign, b64dec, nowMs) {
  var s = String(tok || '');
  var i = s.indexOf('.');
  if (i <= 0 || i !== s.lastIndexOf('.')) return { ok: false, err: 'format' };
  var body = s.slice(0, i), sig = s.slice(i + 1);
  if (!_pmTokEq(sign(body), sig)) return { ok: false, err: 'sig' };
  var p;
  try { p = JSON.parse(b64dec(body)); } catch (e) { return { ok: false, err: 'format' }; }
  if (!p || !p.uid || !(p.exp > 0)) return { ok: false, err: 'format' };
  if (nowMs >= p.exp) return { ok: false, err: 'expired' };
  return { ok: true, payload: p };
}
// @@PERMS_END

if (typeof window !== 'undefined') {
  window.PERM_CATALOG = PERM_CATALOG;
  window.SYSTEM_ROLES = SYSTEM_ROLES;
}
