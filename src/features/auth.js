// Phân quyền phía app (v211) — xem docs/design-user-groups-roles.md
// Classic script, nạp TRƯỚC khối <script> chính, SAU src/core/perms.js và backup.js:
// lúc nạp chỉ khai báo hàm/hằng + bọc window.fetch (gắn token phiên vào mọi lệnh gửi GAS).
//
// Phiên đăng nhập: currentUser.token (lưu cùng ks_user). Quyền: currentUser.perms (GAS trả khi login/whoami).
// ⚠ Quyền ở app chỉ để ẩn/hiện nút — GAS mới là nơi chặn thật (_authorize trong doPost).

const _AUTH_NO_TOKEN_ACTIONS = ['login', 'ping'];
let _authReloginPending = false;     // đang chờ đăng nhập lại giữa phiên (token hết hạn / bị thu hồi)
let _authForceChange = false;        // bắt buộc đổi mật khẩu (mật khẩu tạm do quản trị đặt)
let _authStatus = null;              // tình trạng chế độ kiểm quyền (chỉ người có quan_tri)
let _authLastNotice = 0;

// ── Thuần: quyền ──
// Người dùng cũ còn cache (chưa có perms) → suy từ vai trò hệ thống (_pmEffPerms, vai trò lạ → chỉ xem)
function _authPermsOf(user) {
    if (!user) return [];
    if (Array.isArray(user.perms)) return user.perms;
    return (typeof _pmEffPerms === 'function') ? _pmEffPerms(user.role, {}) : [];
}
function hasPerm(k, user) {
    const u = user === undefined ? (typeof currentUser !== 'undefined' ? currentUser : null) : user;
    return _authPermsOf(u).indexOf(k) >= 0;
}
function hasAnyPerm(keys, user) { return (keys || []).some(k => hasPerm(k, user)); }

// Địa bàn ghi được. Trả { all, list }. Người dùng cũ: vung [] = tất cả (nghĩa cũ)
function _authDistrictsOf(user) {
    if (!user) return { all: false, list: [] };
    const d = user.districts;
    if (d && typeof d === 'object') return { all: !!d.all, list: Array.isArray(d.list) ? d.list : [] };
    const v = Array.isArray(user.vung) ? user.vung : [];
    return v.length ? { all: false, list: v } : { all: true, list: [] };
}
function _authCanWriteSheet(sheet, user) {
    const u = user === undefined ? (typeof currentUser !== 'undefined' ? currentUser : null) : user;
    const d = _authDistrictsOf(u);
    return d.all || d.list.indexOf(String(sheet || '')) >= 0;
}
// Ghi dữ liệu trên địa bàn đang xem: cần quyền + địa bàn
function _authCanWriteHere(perm, user) {
    const sh = (typeof currentSheet !== 'undefined') ? currentSheet : 'DanhSachTru';
    return hasPerm(perm, user) && _authCanWriteSheet(sh, user);
}
// Xuất: xuat_toan_bo → mọi địa bàn; xuat_du_lieu → chỉ địa bàn được giao
function _authCanExport(sheet, user) {
    if (hasPerm('xuat_toan_bo', user)) return true;
    return hasPerm('xuat_du_lieu', user) && _authCanWriteSheet(sheet, user);
}

// Gắn token vào body JSON (không ghi đè token đã có; login/ping không gắn)
function _authAttachToken(body, token) {
    if (!token || typeof body !== 'string' || body.charAt(0) !== '{') return body;
    let d;
    try { d = JSON.parse(body); } catch (e) { return body; }
    if (!d || typeof d !== 'object' || !d.action || _AUTH_NO_TOKEN_ACTIONS.indexOf(d.action) >= 0) return body;
    if (d.token) return body;
    d.token = token;
    return JSON.stringify(d);
}

// Lưu hồ sơ trả về từ login/whoami/change_credentials, giữ token cũ nếu lần này không cấp mới
function _authMergeProfile(oldUser, resp) {
    const user = Object.assign({}, resp && resp.user ? resp.user : {});
    user.token = (resp && resp.token) || (oldUser && oldUser.token) || '';
    return user;
}

function _authSave() {
    try { localStorage.setItem('ks_user', JSON.stringify(currentUser)); } catch (e) { /* silent */ }
}

// ── Lớp bọc fetch: gắn token + xử lý phản hồi từ chối ──
(function _authWrapFetch() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.fetch._authWrapped) return;
    const orig = window.fetch;
    const wrapped = async function (input, init) {
        let mine = false;
        try {
            if (typeof KHAOSAT_GAS_URL !== 'undefined' && KHAOSAT_GAS_URL && input === KHAOSAT_GAS_URL && init && init.body) {
                mine = true;
                const tok = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.token : '';
                const nb = _authAttachToken(init.body, tok);
                if (nb !== init.body) init = Object.assign({}, init, { body: nb });
            }
        } catch (e) { /* không chặn lệnh gốc */ }
        const res = await orig(input, init);
        if (mine) {
            try { res.clone().json().then(_authOnResponse).catch(() => {}); } catch (e) { /* silent */ }
        }
        return res;
    };
    wrapped._authWrapped = true;
    wrapped._bkWrapped = !!orig._bkWrapped;
    window.fetch = wrapped;
})();

function _authOnResponse(j) {
    if (!j || typeof j !== 'object') return;
    if (j.status === 'must_change_password') { _authRequireChange(); return; }
    if (j.status === 'auth_required') { _authRequireLogin(j.message); return; }
    if (j.status === 'forbidden') {
        const now = Date.now();
        if (now - _authLastNotice > 3000 && typeof displayError === 'function') displayError('⛔ ' + (j.message || 'Bạn không có quyền thực hiện thao tác này.'));
        _authLastNotice = now;
    }
}

// ── Đăng nhập lại giữa phiên: giữ nguyên bản đồ & dữ liệu chưa lưu ──
function _authRequireLogin(msg) {
    if (_authReloginPending) return;
    if (typeof currentUser === 'undefined' || !currentUser) return;
    _authReloginPending = true;
    const ov = document.getElementById('loginOverlay');
    if (!ov) return;
    try { $('.modal').modal('hide'); $('body').removeClass('modal-open'); $('.modal-backdrop').remove(); } catch (e) { /* silent */ }
    ov.classList.add('visible');
    const un = document.getElementById('lUsername');
    if (un) un.value = currentUser.username || '';
    const pw = document.getElementById('lPassword');
    if (pw) { pw.value = ''; setTimeout(() => { try { pw.focus(); } catch (e) { /* silent */ } }, 150); }
    const err = document.getElementById('loginError');
    if (err) { err.classList.remove('info'); err.textContent = msg || 'Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại.'; }
}

// Gọi từ doLogin khi thành công. true = đã xử lý (tiếp tục phiên cũ), false = mở app như bình thường
function _authAfterLogin(data) {
    const prev = (typeof currentUser !== 'undefined') ? currentUser : null;
    currentUser = _authMergeProfile(null, data);
    _authSave();
    window._adminAuth = null;
    if (typeof _adminAuthCached !== 'undefined') _adminAuthCached = null;
    const resumed = _authReloginPending && prev && prev.username === currentUser.username;
    _authReloginPending = false;
    if (resumed) {
        document.getElementById('loginOverlay').classList.remove('visible');
        _authRefreshUi();
        if (typeof displayInfo === 'function') displayInfo('Đã đăng nhập lại — tiếp tục làm việc.');
        if (!currentUser.mustChangePassword) _authFlushRetry();
    }
    if (currentUser.mustChangePassword) setTimeout(_authRequireChange, resumed ? 0 : 800);
    if (data.authMode) _authStatus = Object.assign({}, _authStatus || {}, { mode: data.authMode });
    return resumed;
}

function _authRefreshUi() {
    try { if (typeof _invalidatePopupCacheAll === 'function') _invalidatePopupCacheAll(); } catch (e) { /* silent */ }
    try { if (typeof _applyRoleUI === 'function') _applyRoleUI(); } catch (e) { console.warn('[auth] applyRoleUI', e); }
    _authRenderBanner();
}

// Mở app: người dùng cache không có token → đăng nhập lại một lần; có token → whoami làm mới hồ sơ
async function _authWhoami() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    if (!currentUser.token) {
        // Chỉ bắt đăng nhập lại khi máy chủ với tới được — mất mạng thì vẫn làm việc offline bằng phiên cũ
        if (await _authServerReachable()) _authRequireLogin('Cập nhật bảo mật: vui lòng đăng nhập lại một lần.');
        else _authWaitOnline();
        return;
    }
    let j;
    try {
        const res = await fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'whoami' }) });
        j = await res.json();
    } catch (e) { return; }   // mất mạng → dùng hồ sơ cache
    if (!j || j.status !== 'ok') return;   // auth_required đã được lớp bọc fetch xử lý
    const before = JSON.stringify([currentUser.perms, currentUser.districts, currentUser.role]);
    currentUser = _authMergeProfile(currentUser, j);
    _authSave();
    if (j.authStatus) _authStatus = j.authStatus;
    else if (j.authMode) _authStatus = Object.assign({}, _authStatus || {}, { mode: j.authMode });
    if (before !== JSON.stringify([currentUser.perms, currentUser.districts, currentUser.role])) {
        _authRefreshUi();
        _authEnsureAllowedDistrict();
    } else _authRenderBanner();
    if (currentUser.mustChangePassword) _authRequireChange();
}

// ── Bắt buộc đổi mật khẩu (mật khẩu tạm) ──
function _authRequireChange() {
    if (_authForceChange) return;
    if (typeof openChangeCredentials !== 'function') return;
    _authForceChange = true;
    openChangeCredentials();
    const m = document.getElementById('changeCredentialsModal');
    if (!m) return;
    m.classList.add('cc-forced');
    try { $(m).data('bs.modal')._config.backdrop = 'static'; $(m).data('bs.modal')._config.keyboard = false; } catch (e) { /* silent */ }
    const note = document.getElementById('ccForcedNote');
    if (note) note.style.display = 'block';
}
function _authChangeDone(data) {
    if (data && data.token) {
        currentUser = _authMergeProfile(currentUser, data);
        _authSave();
    }
    if (_authForceChange) {
        _authForceChange = false;
        const m = document.getElementById('changeCredentialsModal');
        if (m) m.classList.remove('cc-forced');
        try { $(m).data('bs.modal')._config.backdrop = true; $(m).data('bs.modal')._config.keyboard = true; } catch (e) { /* silent */ }
        const note = document.getElementById('ccForcedNote');
        if (note) note.style.display = 'none';
        _authRefreshUi();
    }
    _authFlushRetry();
}

// ── Banner chế độ ghi nhận (chỉ người có quyền quan_tri) ──
function _authBannerText(st) {
    if (!st || st.mode !== 'log') return '';
    const n = Number(st.tokenless7d) || 0;
    return '⚠ Kiểm quyền đang ở chế độ ghi nhận (chưa chặn)' +
        (st.daysInMode != null ? ' ' + st.daysInMode + ' ngày' : '') +
        (n ? ' · ' + n + ' lệnh ghi không có phiên đăng nhập trong 7 ngày' : ' · 7 ngày qua không còn lệnh ghi thiếu phiên — có thể bật chặn');
}
function _authRenderBanner() {
    const el = document.getElementById('authModeBanner');
    if (!el) return;
    const txt = hasPerm('quan_tri') ? _authBannerText(_authStatus) : '';
    el.style.display = txt ? 'flex' : 'none';
    const t = document.getElementById('authModeBannerText');
    if (t) t.textContent = txt;
}

// ── Xuất dữ liệu: kiểm quyền + ghi nhật ký ──
function _authExportGate(kind, count) {
    const sh = (typeof currentSheet !== 'undefined') ? currentSheet : 'DanhSachTru';
    if (!_authCanExport(sh)) {
        if (typeof displayError === 'function') displayError('⛔ Bạn không có quyền xuất dữ liệu địa bàn này.');
        return false;
    }
    _authLogExport(kind, count);
    return true;
}
function _authLogExport(kind, count) {
    try {
        if (typeof KHAOSAT_GAS_URL === 'undefined' || !KHAOSAT_GAS_URL) return;
        const sh = (typeof currentSheet !== 'undefined') ? currentSheet : 'DanhSachTru';
        fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify({
            action: 'log_export', sheet: sh, kind: String(kind || ''), count: Number(count) || 0,
            scope: hasPerm('xuat_toan_bo') ? 'toan_bo' : 'dia_ban'
        }) }).catch(() => {});
    } catch (e) { /* nhật ký không chặn việc xuất */ }
}

if (typeof window !== 'undefined') {
    window.hasPerm = hasPerm;
    window.hasAnyPerm = hasAnyPerm;
}

// Nút ghi phụ thuộc địa bàn đang mở (gọi khi đổi địa bàn)
function _authApplyWriteUi() {
    const set = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    try {
        set('addMarkerBtn', canEdit());
        set('editPositionBtn', canDrag());
        set('sec-osm-hem', canEdit());
        if (typeof _invalidatePopupCacheAll === 'function') _invalidatePopupCacheAll();
    } catch (e) { /* silent */ }
}


// ── Mất mạng lúc mở app (người dùng cũ chưa có token): chờ có mạng rồi mới hỏi đăng nhập ──
async function _authServerReachable() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    try {
        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const tid = ctrl ? setTimeout(() => ctrl.abort(), 8000) : 0;
        const res = await fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'ping' }), signal: ctrl ? ctrl.signal : undefined });
        if (tid) clearTimeout(tid);
        const j = await res.json();
        return !!j;
    } catch (e) { return false; }
}
let _authOnlineHooked = false;
function _authWaitOnline() {
    if (_authOnlineHooked || typeof window === 'undefined' || !window.addEventListener) return;
    _authOnlineHooked = true;
    window.addEventListener('online', () => { _authOnlineHooked = false; _authWhoami(); }, { once: true });
}

// Hồ sơ mới thu hẹp địa bàn → đang mở địa bàn không còn trong danh sách thì chuyển sang địa bàn đầu tiên được phép
function _authEnsureAllowedDistrict() {
    try {
        if (typeof _allowedPages !== 'function' || typeof switchDistrict !== 'function' || typeof currentSheet === 'undefined') return;
        const pages = _allowedPages();
        if (pages.length && !pages.some(p => p.sheet === currentSheet)) switchDistrict(pages[0].sheet);
    } catch (e) { /* silent */ }
}

// ── Lưu bị từ chối vì phiên (hết hạn / bị thu hồi / phải đổi MK): giữ lại, lưu tiếp sau khi đăng nhập ──
const _authRetryQueue = [];
function _authQueueRetry(row, opts) {
    if (!_authRetryQueue.some(x => x.row === row)) _authRetryQueue.push({ row, opts: opts || {} });
    if (typeof displayError === 'function') displayError('⚠ Chưa lưu được ' + _authRetryQueue.length + ' thay đổi — đăng nhập lại, app sẽ tự lưu tiếp.');
}
async function _authFlushRetry() {
    if (!_authRetryQueue.length || typeof syncRowToGAS !== 'function') return;
    const items = _authRetryQueue.splice(0);
    let ok = 0;
    for (const it of items) { if (await syncRowToGAS(it.row, Object.assign({}, it.opts, { silent: true }))) ok++; }
    if (typeof displayInfo === 'function' && ok) displayInfo('Đã lưu tiếp ' + ok + '/' + items.length + ' thay đổi đang chờ.');
}

// Lệnh chỉ dời/sửa cáp: gửi đúng các trường vị trí + cáp (người chỉ có quyền di_chuyen vẫn lưu được)
function _syncPayloadFor(opts, full) {
    if (!opts || !opts.moveOnly || typeof MOVE_FIELDS === 'undefined') return full;
    const out = { action: full.action, sheet: full.sheet, id: full.id, tenTru: full.tenTru };
    MOVE_FIELDS.forEach(k => { if (full[k] !== undefined) out[k] = full[k]; });
    return out;
}
