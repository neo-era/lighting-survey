// Quản lý người dùng · nhóm · vai trò (v211, phương án B: danh sách + chi tiết) — docs/design-user-groups-roles.md
// Classic script, nạp TRƯỚC khối <script> chính: lúc nạp chỉ khai báo hàm/hằng. Mở bằng openUserAdmin(tab).
// Mọi lệnh gửi GAS đi qua lớp bọc fetch của auth.js (tự gắn token). GAS kiểm quyền quan_tri (strict).

const _UA = {
    data: null, tab: 'users', sel: null, creating: false, dirty: false,
    filter: 'all', q: '', compare: false, busy: false, lastPw: null
};
const _UA_GROUP_ORDER = ['Cơ bản', 'Dữ liệu', 'Vận hành', 'Quản trị'];

function _uaEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _uaJs(s) { return _uaEsc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
function _uaList(v) {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
    return String(v == null ? '' : v).split(',').map(x => x.trim()).filter(Boolean);
}
function _uaTabLabel(t) {
    if (t === '*') return 'Tất cả địa bàn';
    const p = (typeof DISTRICT_PAGES !== 'undefined') ? DISTRICT_PAGES.find(x => x.sheet === t) : null;
    return p ? p.label : t;
}
function _uaRolesMap() {
    const m = {};
    ((_UA.data && _UA.data.roles) || []).forEach(r => { m[r.ma] = { ten: r.ten, quyen: r.quyen, he: r.he, benNgoai: r.benNgoai }; });
    return m;
}
function _uaGroupsMap() {
    const m = {};
    ((_UA.data && _UA.data.groups) || []).forEach(g => { m[g.ma] = { ten: g.ten, diaBan: g.diaBan, trangThai: g.trangThai }; });
    return m;
}
function _uaCatalog() {
    const c = (_UA.data && _UA.data.catalog) || (typeof PERM_CATALOG !== 'undefined' ? PERM_CATALOG : []);
    return c.map(x => Array.isArray(x) ? { key: x[0], label: x[1], group: x[2] } : x);
}
function _uaIdleText(u) {
    if (!u.lastLogin) return 'chưa đăng nhập';
    const d = u.idleDays;
    if (d === 0) return 'đăng nhập hôm nay';
    return 'đăng nhập ' + d + ' ngày trước';
}
// Lọc danh sách người dùng (thuần — có test)
function _uaFilterUsers(users, filter, q) {
    const nq = (typeof normalizeTextSearchable === 'function') ? normalizeTextSearchable(q || '') : String(q || '').toLowerCase();
    return (users || []).filter(u => {
        if (filter === 'locked' && u.state !== 'khoa') return false;
        if (filter === 'expiring' && !(u.state === 'het_han' || (u.daysLeft != null && u.daysLeft <= 14))) return false;
        if (filter === 'idle' && !(u.idleDays != null && u.idleDays > 90)) return false;
        if (!nq) return true;
        const hay = [u.username, u.displayName, u.roleName, (u.nhom || []).join(' ')].join(' ');
        const nh = (typeof normalizeTextSearchable === 'function') ? normalizeTextSearchable(hay) : hay.toLowerCase();
        return nh.indexOf(nq) >= 0;
    });
}
function _uaTempPassword() {
    const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    const buf = new Uint32Array(10);
    try { crypto.getRandomValues(buf); } catch (e) { for (let i = 0; i < 10; i++) buf[i] = Math.floor(Math.random() * 1e9); }
    for (let i = 0; i < 10; i++) s += a[buf[i] % a.length];
    return s;
}

async function _uaPost(payload) {
    const res = await fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    const j = await res.json();
    if (!j || j.status !== 'ok') {
        const err = new Error((j && j.message) || 'Lỗi không xác định');
        err.resp = j; throw err;
    }
    return j;
}

// ── Mở / đóng ──
async function openUserAdmin(tab) {
    if (!hasPerm('quan_tri')) { displayError('Bạn không có quyền quản lý người dùng.'); return; }
    if (typeof closeControlsModal === 'function') try { closeControlsModal(); } catch (e) { /* silent */ }
    _uaEnsureDom();
    _UA.tab = tab || 'users'; _UA.sel = null; _UA.creating = false; _UA.dirty = false; _UA.lastPw = null;
    document.getElementById('uaOverlay').classList.add('on');
    document.body.classList.add('ua-open');
    _uaRender();
    await _uaReload();
}
function closeUserAdmin(force) {
    if (!force && _UA.dirty && !confirm('Bỏ các thay đổi chưa lưu?')) return;
    _UA.dirty = false;
    const ov = document.getElementById('uaOverlay');
    if (ov) {
        const hadDet = ov.classList.contains('ua-show-det');
        ov.classList.remove('on', 'ua-show-det');
        // bỏ mục lịch sử đã thêm khi vào chi tiết (điện thoại) → nút Back không phải bấm 2 lần
        if (hadDet) try { if (history.state && history.state.ua) history.back(); } catch (e) { /* silent */ }
    }
    document.body.classList.remove('ua-open');
}
async function _uaReload(keepSel) {
    const box = document.getElementById('uaMain');
    if (!_UA.data && box) box.innerHTML = '<div class="ua-empty">Đang tải…</div>';
    try {
        _UA.data = await _uaPost({ action: 'list_users' });
        if (!keepSel) { _UA.sel = null; }
        _uaRender();
    } catch (e) {
        if (box) box.innerHTML = '<div class="ua-empty">⚠ ' + _uaEsc(e.message) + '</div>';
    }
}

function _uaEnsureDom() {
    if (document.getElementById('uaOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'uaOverlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'uaTitle');
    ov.innerHTML = '<div class="ua-sheet">' +
        '<div class="ua-hd"><button class="ua-x ua-back" type="button" aria-label="Về danh sách" onclick="_uaBack()">‹</button>' +
        '<span aria-hidden="true" style="font-size:20px">👥</span><h2 id="uaTitle">Quản lý người dùng</h2>' +
        '<button class="ua-x" type="button" aria-label="Đóng" onclick="closeUserAdmin()">✕</button></div>' +
        '<div class="ua-tabs" id="uaTabs" role="tablist"></div>' +
        '<div id="uaBanner"></div>' +
        '<div class="ua-split" id="uaMain"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('input', e => { if (e.target.closest('.ua-det [data-dirty]')) _uaMarkDirty(); });
    ov.addEventListener('change', e => { if (e.target.closest('.ua-det [data-dirty]')) _uaMarkDirty(); });
    window.addEventListener('popstate', () => {
        const o = document.getElementById('uaOverlay');
        if (o && o.classList.contains('on') && o.classList.contains('ua-show-det')) _uaBack(true);
    });
    document.addEventListener('keydown', e => {
        const o = document.getElementById('uaOverlay');
        if (e.key === 'Escape' && o && o.classList.contains('on')) closeUserAdmin();
    });
}
function _uaMarkDirty() {
    if (_UA.dirty) return;
    _UA.dirty = true;
    const b = document.getElementById('uaSaveBtn');
    if (b) b.classList.add('ua-pulse');
}
function _uaConfirmLeave() {
    if (!_UA.dirty) return true;
    if (!confirm('Bỏ các thay đổi chưa lưu?')) return false;
    _UA.dirty = false;
    return true;
}
function _uaIsNarrow() { return window.matchMedia('(max-width:720px)').matches; }
function _uaShowDetail() {
    const o = document.getElementById('uaOverlay');
    if (!o) return;
    if (_uaIsNarrow() && !o.classList.contains('ua-show-det')) {
        o.classList.add('ua-show-det');
        try { history.pushState({ ua: 1 }, ''); } catch (e) { /* silent */ }
    }
}
function _uaBack(fromPop) {
    if (!_uaConfirmLeave()) { if (fromPop) try { history.pushState({ ua: 1 }, ''); } catch (e) { /* silent */ } return; }
    const o = document.getElementById('uaOverlay');
    if (o) o.classList.remove('ua-show-det');
    _UA.sel = null; _UA.creating = false;
    if (!fromPop) try { if (history.state && history.state.ua) history.back(); } catch (e) { /* silent */ }
    _uaRender();
}

function _uaSetTab(t) {
    if (t === _UA.tab) return;
    if (!_uaConfirmLeave()) return;
    _UA.tab = t; _UA.sel = null; _UA.creating = false; _UA.compare = false;
    const o = document.getElementById('uaOverlay');
    if (o) o.classList.remove('ua-show-det');
    _uaRender();
}
function _uaSelect(key) {
    if (key === _UA.sel && !_UA.creating) { _uaShowDetail(); return; }
    if (!_uaConfirmLeave()) return;
    _UA.sel = key; _UA.creating = false; _UA.lastPw = null; _UA.compare = false;
    _uaRender();
    _uaShowDetail();
}
function _uaNew() {
    if (!_uaConfirmLeave()) return;
    _UA.sel = null; _UA.creating = true; _UA.lastPw = null; _UA.compare = false;
    _uaRender();
    _uaShowDetail();
}

// ── Vẽ ──
function _uaRender() {
    const d = _UA.data || { users: [], roles: [], groups: [] };
    const tabs = document.getElementById('uaTabs');
    if (!tabs) return;
    const T = [['users', 'Người dùng', d.users.length], ['groups', 'Nhóm', d.groups.length], ['roles', 'Vai trò', d.roles.length], ['auth', 'Kiểm quyền', null]];
    tabs.innerHTML = T.map(([k, l, n]) => '<button type="button" role="tab" aria-selected="' + (k === _UA.tab) + '" class="ua-tab' + (k === _UA.tab ? ' on' : '') +
        '" onclick="_uaSetTab(\'' + k + '\')">' + l + (n != null ? '<span class="c">' + n + '</span>' : '') + '</button>').join('');
    const st = d.auth || (typeof _authStatus !== 'undefined' ? _authStatus : null);
    const bn = document.getElementById('uaBanner');
    const bt = (typeof _authBannerText === 'function') ? _authBannerText(st) : '';
    bn.innerHTML = (bt && _UA.tab !== 'auth') ? '<div class="ua-banner"><span>' + _uaEsc(bt) + '</span><button type="button" class="ua-btn sm" onclick="_uaSetTab(\'auth\')">Xem</button></div>' : '';
    const m = document.getElementById('uaMain');
    if (!_UA.data) return;
    if (_UA.tab === 'users') m.innerHTML = _uaUsersList() + '<div class="ua-det">' + (_UA.creating ? _uaUserNewForm() : _uaUserDetail()) + '</div>';
    else if (_UA.tab === 'groups') m.innerHTML = _uaGroupsList() + '<div class="ua-det">' + _uaGroupDetail() + '</div>';
    else if (_UA.tab === 'roles') m.innerHTML = _uaRolesList() + '<div class="ua-det">' + (_UA.compare ? _uaRoleCompare() : _uaRoleDetail()) + '</div>';
    else m.innerHTML = '<div class="ua-det ua-full">' + _uaAuthPanel() + '</div>';
    const sb = document.getElementById('uaSaveBtn');
    if (sb && _UA.dirty) sb.classList.add('ua-pulse');
}

// Người dùng — danh sách
function _uaUsersList() {
    const us = _UA.data.users;
    const cnt = {
        locked: _uaFilterUsers(us, 'locked', '').length,
        expiring: _uaFilterUsers(us, 'expiring', '').length,
        idle: _uaFilterUsers(us, 'idle', '').length
    };
    const chip = (k, l, n) => '<button type="button" class="ua-chip' + (_UA.filter === k ? ' r' : '') + '" onclick="_uaFilter(\'' + k + '\')">' + l + (n != null ? ' ' + n : '') + '</button>';
    const list = _uaFilterUsers(us, _UA.filter, _UA.q);
    return '<div class="ua-list"><div class="ua-sticky"><input class="ua-in" type="search" placeholder="🔍 Tìm tên, tài khoản, nhóm…" value="' + _uaEsc(_UA.q) +
        '" oninput="_uaSearch(this.value)" aria-label="Tìm người dùng"><div class="ua-chips">' +
        chip('all', 'Tất cả') + chip('locked', 'Đã khoá', cnt.locked) + chip('expiring', 'Sắp/đã hết hạn', cnt.expiring) + chip('idle', '> 90 ngày', cnt.idle) +
        '</div></div><div id="uaListItems">' + _uaUserItems(list) + '</div>' +
        '<button type="button" class="ua-btn p wide" onclick="_uaNew()">＋ Thêm người dùng</button></div>';
}
function _uaUserItems(list) {
    if (!list.length) return '<div class="ua-empty sm">Không có người dùng phù hợp</div>';
    return list.map(u => {
        const badge = u.state === 'khoa' ? ' <span title="Đã khoá">🔒</span>' : u.state === 'het_han' ? ' <span title="Hết hạn">⌛</span>' : '';
        const ini = String(u.displayName || u.username).trim().split(/\s+/).pop().charAt(0).toUpperCase();
        return '<button type="button" class="ua-it' + (u.username === _UA.sel ? ' on' : '') + '" onclick="_uaSelect(\'' + _uaJs(u.username) + '\')">' +
            '<span class="ua-av">' + _uaEsc(ini) + '</span><span class="ua-it-t">' + _uaEsc(u.displayName || u.username) + badge +
            '<small>' + _uaEsc(u.roleName || u.role) + ' · ' + _uaEsc((u.nhom && u.nhom[0]) || u.username) + '</small></span></button>';
    }).join('');
}
function _uaFilter(k) { _UA.filter = k; _uaRender(); }
function _uaSearch(v) {
    _UA.q = v;
    const box = document.getElementById('uaListItems');
    if (box) box.innerHTML = _uaUserItems(_uaFilterUsers(_UA.data.users, _UA.filter, _UA.q));
}

// Người dùng — chi tiết
function _uaRoleOptions(sel) {
    return _UA.data.roles.map(r => '<option value="' + _uaEsc(r.ma) + '"' + (r.ma === sel ? ' selected' : '') + '>' + _uaEsc(r.ten) +
        (r.benNgoai ? ' (bên ngoài)' : '') + ' — ' + r.quyen.length + '/' + _uaCatalog().length + ' quyền</option>').join('');
}
function _uaPermChips(roleCode) {
    const perms = _pmEffPerms(roleCode, _uaRolesMap());
    const cat = _uaCatalog();
    return '<div class="ua-sum">' + perms.length + '/' + cat.length + ' quyền</div><div class="ua-chips">' +
        cat.filter(p => perms.indexOf(p.key) >= 0).map(p => '<span class="ua-chip">✓ ' + _uaEsc(p.label) + '</span>').join('') + '</div>';
}
function _uaGroupChecks(selected, name) {
    const gs = _UA.data.groups;
    if (!gs.length) return '<div class="ua-muted">Chưa có nhóm nào — tạo ở thẻ Nhóm.</div>';
    return '<div class="ua-checks">' + gs.map(g => '<label class="ua-ck' + (g.trangThai === 'ngung' ? ' off' : '') + '"><input type="checkbox" data-dirty name="' + name + '" value="' + _uaEsc(g.ma) + '"' +
        (selected.indexOf(g.ma) >= 0 ? ' checked' : '') + ' onchange="_uaPreviewDistricts()"><span class="ua-ck-t">' + _uaEsc(g.ten) +
        '<small>' + _uaEsc(_uaList(g.diaBan).map(_uaTabLabel).join(', ') || 'không địa bàn') + (g.trangThai === 'ngung' ? ' · ngừng' : '') + '</small></span></label>').join('') + '</div>';
}
function _uaTabChecks(selected, name, onchange) {
    const tabs = ['*'].concat(_UA.data.dataTabs || []);
    return '<div class="ua-checks">' + tabs.map(t => '<label class="ua-ck"><input type="checkbox" data-dirty name="' + name + '" value="' + _uaEsc(t) + '"' +
        (selected.indexOf(t) >= 0 ? ' checked' : '') + (onchange ? ' onchange="' + onchange + '"' : '') + '> ' + _uaEsc(_uaTabLabel(t)) + '</label>').join('') + '</div>';
}
function _uaChecked(name) {
    return [...document.querySelectorAll('#uaMain input[name="' + name + '"]:checked')].map(i => i.value);
}
function _uaDistrictText(eff) {
    if (eff.all) return '<b>Tất cả địa bàn</b>';
    if (!eff.list.length) return '<b>Không địa bàn nào</b> <span class="ua-muted">(chỉ xem)</span>';
    return eff.list.map(t => '<b>' + _uaEsc(_uaTabLabel(t)) + '</b> <small class="ua-muted">(' + _uaEsc((eff.sources[t] || []).join(', ')) + ')</small>').join(', ');
}
function _uaPreviewDistricts() {
    const box = document.getElementById('uaEffD');
    if (!box) return;
    const role = (document.getElementById('uaRole') || {}).value;
    const r = _uaRolesMap()[role];
    const eff = _pmEffDistricts(_uaChecked('uaVung'), _uaChecked('uaNhom'), _uaGroupsMap(), role === 'admin');
    box.innerHTML = 'Ghi được: ' + _uaDistrictText(eff) + ' <span class="ua-muted">· xem: tất cả (dữ liệu công khai)</span>';
    const pc = document.getElementById('uaPermChips');
    if (pc && role) pc.innerHTML = _uaPermChips(role);
    const hn = document.getElementById('uaHetHanNote');
    if (hn) hn.style.display = (r && r.benNgoai) ? '' : 'none';
}
function _uaStateChip(u) {
    if (u.state === 'khoa') return '<span class="ua-chip bad">● Đã khoá</span>';
    if (u.state === 'het_han') return '<span class="ua-chip warn">● Hết hạn</span>';
    if (u.daysLeft != null && u.daysLeft <= 14) return '<span class="ua-chip warn">● Còn ' + u.daysLeft + ' ngày</span>';
    return '<span class="ua-chip ok">● Hoạt động</span>';
}
function _uaUserDetail() {
    const u = _UA.data.users.find(x => x.username === _UA.sel);
    if (!u) return '<div class="ua-empty">Chọn một người dùng ở danh sách bên trái, hoặc bấm “＋ Thêm người dùng”.</div>';
    const me = currentUser && currentUser.username === u.username;
    const pw = _UA.lastPw && _UA.lastPw.user === u.username ? '<div class="ua-sec ua-pw">🔑 Mật khẩu tạm của <b>' + _uaEsc(u.username) + '</b>: <code id="uaPwVal">' + _uaEsc(_UA.lastPw.pw) +
        '</code> <button type="button" class="ua-btn sm" onclick="_uaCopyPw()">Sao chép</button><div class="ua-muted">Chỉ hiện một lần. Người dùng phải đổi mật khẩu ở lần đăng nhập tới.</div></div>' : '';
    return '<div class="ua-dhd"><span class="ua-av lg">' + _uaEsc(String(u.displayName || u.username).trim().split(/\s+/).pop().charAt(0).toUpperCase()) + '</span>' +
        '<div class="ua-dt"><div class="ua-name">' + _uaEsc(u.displayName || u.username) + (me ? ' <small class="ua-muted">(bạn)</small>' : '') + '</div>' +
        '<div class="ua-muted">' + _uaEsc(u.username) + ' · ' + _uaStateChip(u) + ' · ' + _uaIdleText(u) + '</div></div>' +
        '<button type="button" id="uaSaveBtn" class="ua-btn p" onclick="_uaSaveUser()">💾 Lưu</button></div>' + pw +
        '<div class="ua-sec"><h4>Thông tin</h4><div class="ua-row"><label class="ua-f">Họ tên<input id="uaTen" class="ua-in" data-dirty value="' + _uaEsc(u.displayName) + '"></label>' +
        '<label class="ua-f">Hết hạn tài khoản<input id="uaHetHan" type="date" class="ua-in" data-dirty value="' + _uaEsc(u.hetHan || '') + '"><small id="uaHetHanNote" class="ua-muted"' + (u.benNgoai ? '' : ' style="display:none"') + '>Bắt buộc với tài khoản bên ngoài</small></label></div></div>' +
        '<div class="ua-sec"><h4>Vai trò &amp; quyền</h4><label class="ua-f">Vai trò<select id="uaRole" class="ua-in" data-dirty onchange="_uaPreviewDistricts()">' + _uaRoleOptions(u.role) + '</select></label>' +
        (u.roleMissing ? '<div class="ua-chip warn" style="margin-top:6px">Vai trò “' + _uaEsc(u.role) + '” không còn — đang chỉ được xem</div>' : '') +
        '<div id="uaPermChips" style="margin-top:8px">' + _uaPermChips(u.role) + '</div></div>' +
        '<div class="ua-sec"><h4>Nhóm &amp; địa bàn</h4><div class="ua-sub">Nhóm</div>' + _uaGroupChecks(u.nhom || [], 'uaNhom') +
        '<details class="ua-more"' + (_uaList(u.vung).length ? ' open' : '') + '><summary>Địa bàn riêng (ngoài nhóm)</summary>' + _uaTabChecks(_uaList(u.vung), 'uaVung', '_uaPreviewDistricts()') + '</details>' +
        '<div id="uaEffD" class="ua-eff">Ghi được: ' + _uaDistrictText(u.districts || { all: false, list: [], sources: {} }) + ' <span class="ua-muted">· xem: tất cả (dữ liệu công khai)</span></div></div>' +
        '<div class="ua-sec"><h4>Bảo mật</h4><div class="ua-acts">' +
        '<button type="button" class="ua-btn" onclick="_uaResetPw()">🔑 Đặt lại mật khẩu</button>' +
        '<button type="button" class="ua-btn" onclick="_uaRevoke()">⎋ Đăng xuất mọi máy</button>' +
        (u.state === 'khoa' || u.state === 'het_han'
            ? '<button type="button" class="ua-btn" onclick="_uaUnlock()">🔓 Mở khoá' + (u.state === 'het_han' ? ' / gia hạn' : '') + '</button>'
            : '<button type="button" class="ua-btn d" onclick="_uaLock()"' + (me ? ' disabled title="Không tự khoá chính mình"' : '') + '>🔒 Khoá &amp; bàn giao…</button>') +
        (!u.lastLogin && !me ? '<button type="button" class="ua-btn d" onclick="_uaDeleteUser()">🗑 Xoá (chưa từng đăng nhập)</button>' : '') +
        '</div><div id="uaLockBox"></div></div>';
}
function _uaUserNewForm() {
    const pw = _uaTempPassword();
    return '<div class="ua-dhd"><span class="ua-av lg">＋</span><div class="ua-dt"><div class="ua-name">Người dùng mới</div><div class="ua-muted">Mật khẩu tạm — người dùng phải đổi khi đăng nhập lần đầu</div></div>' +
        '<button type="button" id="uaSaveBtn" class="ua-btn p" onclick="_uaCreateUser()">💾 Tạo</button></div>' +
        '<div class="ua-sec"><h4>Tài khoản</h4><div class="ua-row"><label class="ua-f">Tên đăng nhập<input id="uaNewUser" class="ua-in" data-dirty autocomplete="off" autocapitalize="none" placeholder="vd: hungnt"></label>' +
        '<label class="ua-f">Mật khẩu tạm<input id="uaNewPw" class="ua-in" data-dirty value="' + _uaEsc(pw) + '" autocomplete="off"></label></div>' +
        '<div class="ua-row"><label class="ua-f">Họ tên<input id="uaTen" class="ua-in" data-dirty placeholder="Nguyễn Văn A"></label>' +
        '<label class="ua-f">Hết hạn tài khoản<input id="uaHetHan" type="date" class="ua-in" data-dirty><small id="uaHetHanNote" class="ua-muted" style="display:none">Bắt buộc với tài khoản bên ngoài</small></label></div></div>' +
        '<div class="ua-sec"><h4>Vai trò &amp; quyền</h4><label class="ua-f">Vai trò<select id="uaRole" class="ua-in" data-dirty onchange="_uaPreviewDistricts()">' + _uaRoleOptions('user1') + '</select></label>' +
        '<div id="uaPermChips" style="margin-top:8px">' + _uaPermChips('user1') + '</div></div>' +
        '<div class="ua-sec"><h4>Nhóm &amp; địa bàn</h4><div class="ua-sub">Nhóm</div>' + _uaGroupChecks([], 'uaNhom') +
        '<details class="ua-more"><summary>Địa bàn riêng (ngoài nhóm)</summary>' + _uaTabChecks([], 'uaVung', '_uaPreviewDistricts()') + '</details>' +
        '<div id="uaEffD" class="ua-eff">Ghi được: <b>Không địa bàn nào</b> <span class="ua-muted">(chỉ xem)</span></div></div>';
}

async function _uaRun(btn, fn) {
    if (_UA.busy) return;
    _UA.busy = true;
    const b = typeof btn === 'string' ? document.getElementById(btn) : btn;
    const old = b ? b.innerHTML : '';
    if (b) { b.disabled = true; b.innerHTML = '⏳ Đang lưu…'; }
    try { await fn(); }
    catch (e) { displayError('⚠ ' + e.message); }
    finally { _UA.busy = false; if (b && document.body.contains(b)) { b.disabled = false; b.innerHTML = old; } }
}
function _uaVal(id) { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }

async function _uaSaveUser() {
    const u = _UA.data.users.find(x => x.username === _UA.sel);
    if (!u) return;
    const updates = { displayName: _uaVal('uaTen'), role: _uaVal('uaRole'), hetHan: _uaVal('uaHetHan'), nhom: _uaChecked('uaNhom').join(','), vung: _uaChecked('uaVung').join(',') };
    await _uaRun('uaSaveBtn', async () => {
        await _uaPost({ action: 'update_user', targetUsername: u.username, updates });
        _UA.dirty = false;
        displayInfo('Đã lưu ' + u.username + ' — áp dụng ngay ở lần thao tác tới của người dùng.');
        if (currentUser && u.username === currentUser.username && typeof _authWhoami === 'function') _authWhoami();
        await _uaReload(true);
    });
}
async function _uaCreateUser() {
    const nu = { username: _uaVal('uaNewUser'), password: _uaVal('uaNewPw'), displayName: _uaVal('uaTen'), role: _uaVal('uaRole'),
        hetHan: _uaVal('uaHetHan'), nhom: _uaChecked('uaNhom').join(','), vung: _uaChecked('uaVung').join(',') };
    if (!nu.username) { displayError('Nhập tên đăng nhập'); return; }
    await _uaRun('uaSaveBtn', async () => {
        await _uaPost({ action: 'create_user', newUser: nu });
        _UA.dirty = false; _UA.creating = false; _UA.sel = nu.username;
        _UA.lastPw = { user: nu.username, pw: nu.password };
        await _uaReload(true);
    });
}
function _uaCopyPw() {
    const v = _UA.lastPw ? _UA.lastPw.pw : '';
    try { navigator.clipboard.writeText(v).then(() => displayInfo('Đã sao chép mật khẩu tạm')); } catch (e) { /* silent */ }
}
async function _uaResetPw() {
    const name = _UA.sel;
    if (!confirm('Đặt lại mật khẩu cho ' + name + '?\n\nNgười dùng bị đăng xuất mọi máy và phải đổi mật khẩu khi đăng nhập lại.')) return;
    const pw = _uaTempPassword();
    await _uaRun(null, async () => {
        await _uaPost({ action: 'reset_password', targetUsername: name, newPassword: pw });
        _UA.lastPw = { user: name, pw };
        await _uaReload(true);
    });
}
async function _uaRevoke() {
    const name = _UA.sel;
    if (!confirm('Đăng xuất ' + name + ' khỏi mọi máy?\n\nHọ sẽ phải đăng nhập lại.')) return;
    await _uaRun(null, async () => {
        await _uaPost({ action: 'revoke_sessions', targetUsername: name });
        displayInfo('Đã đăng xuất ' + name + ' khỏi mọi máy.');
    });
}
async function _uaLock() {
    const name = _UA.sel;
    if (!confirm('Khoá tài khoản ' + name + '?\n\nNgười dùng bị đăng xuất mọi máy ngay. Có thể mở khoá lại sau.')) return;
    await _uaRun(null, async () => {
        const j = await _uaPost({ action: 'lock_user', targetUsername: name, preview: true });
        if (j.preview) { _uaShowHandover(name, j.nhiemVu, j.suCo); return; }
        displayInfo('Đã khoá ' + name + '.');
        await _uaReload(true);
    });
}
function _uaShowHandover(name, nv, sc) {
    const box = document.getElementById('uaLockBox');
    if (!box) return;
    const others = _UA.data.users.filter(x => x.username !== name && x.state === 'hoat_dong');
    box.innerHTML = '<div class="ua-handover"><div><b>' + _uaEsc(name) + '</b> còn <b>' + nv + '</b> nhiệm vụ và <b>' + sc + '</b> sự cố đang mở.</div>' +
        '<label class="ua-f">Bàn giao cho<select id="uaTransferTo" class="ua-in"><option value="">— Không bàn giao (để nguyên) —</option>' +
        others.map(o => '<option value="' + _uaEsc(o.username) + '">' + _uaEsc(o.displayName || o.username) + ' (' + _uaEsc(o.username) + ')</option>').join('') + '</select></label>' +
        '<label class="ua-f">Lý do (ghi nhật ký)<input id="uaLockReason" class="ua-in" placeholder="vd: nghỉ việc"></label>' +
        '<div class="ua-acts"><button type="button" class="ua-btn d" id="uaLockGo" onclick="_uaLockConfirm()">🔒 Khoá</button><button type="button" class="ua-btn" onclick="document.getElementById(\'uaLockBox\').innerHTML=\'\'">Huỷ</button></div></div>';
}
async function _uaLockConfirm() {
    const name = _UA.sel, to = _uaVal('uaTransferTo'), reason = _uaVal('uaLockReason');
    await _uaRun('uaLockGo', async () => {
        const j = await _uaPost({ action: 'lock_user', targetUsername: name, transferTo: to, reason });
        displayInfo('Đã khoá ' + name + (j.moved ? ' · bàn giao ' + j.moved + ' việc cho ' + to : ''));
        await _uaReload(true);
    });
}
async function _uaUnlock() {
    const u = _UA.data.users.find(x => x.username === _UA.sel);
    if (!u) return;
    const payload = { action: 'unlock_user', targetUsername: u.username };
    if (u.state === 'het_han' || u.benNgoai) {
        const hh = prompt('Ngày hết hạn mới (yyyy-mm-dd)' + (u.benNgoai ? '' : ', để trống = không giới hạn') + ':', u.hetHan || '');
        if (hh === null) return;
        payload.hetHan = hh.trim();
    } else if (!confirm('Mở khoá ' + u.username + '?')) return;
    await _uaRun(null, async () => { await _uaPost(payload); displayInfo('Đã mở khoá ' + u.username); await _uaReload(true); });
}
async function _uaDeleteUser() {
    const name = _UA.sel;
    if (!confirm('Xoá hẳn tài khoản ' + name + '?\n\nChỉ xoá được tài khoản chưa từng đăng nhập.')) return;
    await _uaRun(null, async () => { await _uaPost({ action: 'delete_user', targetUsername: name }); _UA.sel = null; await _uaReload(); });
}

// ── Nhóm ──
function _uaGroupsList() {
    return '<div class="ua-list">' + _UA.data.groups.map(g => '<button type="button" class="ua-it' + (g.ma === _UA.sel ? ' on' : '') + '" onclick="_uaSelect(\'' + _uaJs(g.ma) + '\')">' +
        '<span class="ua-it-t">' + _uaEsc(g.ten) + (g.trangThai === 'ngung' ? ' <span class="ua-chip">ngừng</span>' : '') +
        '<small>' + _uaEsc(g.ma) + ' · ' + g.soNguoi + ' người · ' + _uaEsc(_uaList(g.diaBan).map(_uaTabLabel).join(', ') || 'không địa bàn') + '</small></span></button>').join('') +
        (_UA.data.groups.length ? '' : '<div class="ua-empty sm">Chưa có nhóm. Nhóm = đơn vị/tổ đội, mang địa bàn được ghi.</div>') +
        '<button type="button" class="ua-btn p wide" onclick="_uaNew()">＋ Nhóm mới</button></div>';
}
function _uaGroupDetail() {
    const g = _UA.creating ? { ma: '', ten: '', diaBan: '', ghiChu: '', trangThai: 'hoat_dong', soNguoi: 0 } : _UA.data.groups.find(x => x.ma === _UA.sel);
    if (!g) return '<div class="ua-empty">Chọn một nhóm, hoặc bấm “＋ Nhóm mới”.</div>';
    const members = _UA.data.users.filter(u => (u.nhom || []).indexOf(g.ma) >= 0);
    return '<div class="ua-dhd"><div class="ua-dt"><div class="ua-name">' + (_UA.creating ? 'Nhóm mới' : _uaEsc(g.ten)) + '</div><div class="ua-muted">' + (g.soNguoi || 0) + ' thành viên</div></div>' +
        (!_UA.creating ? '<button type="button" class="ua-btn d" onclick="_uaDeleteGroup()"' + (members.length ? ' disabled title="Còn thành viên — chuyển họ sang nhóm khác trước"' : '') + '>Xoá</button>' : '') +
        '<button type="button" id="uaSaveBtn" class="ua-btn p" onclick="_uaSaveGroup()">💾 ' + (_UA.creating ? 'Tạo' : 'Lưu') + '</button></div>' +
        '<div class="ua-sec"><h4>Thông tin</h4><div class="ua-row"><label class="ua-f">Mã nhóm<input id="uaGMa" class="ua-in" data-dirty value="' + _uaEsc(g.ma) + '"' + (_UA.creating ? ' placeholder="vd: XN2"' : ' readonly') + '></label>' +
        '<label class="ua-f">Tên nhóm<input id="uaGTen" class="ua-in" data-dirty value="' + _uaEsc(g.ten) + '" placeholder="Xí nghiệp chiếu sáng 2"></label></div>' +
        '<label class="ua-f">Ghi chú<input id="uaGGhiChu" class="ua-in" data-dirty value="' + _uaEsc(g.ghiChu) + '"></label>' +
        '<label class="ua-ck" style="margin-top:8px"><input type="checkbox" id="uaGNgung" data-dirty' + (g.trangThai === 'ngung' ? ' checked' : '') + '> Ngừng hoạt động (thành viên mất địa bàn của nhóm)</label></div>' +
        '<div class="ua-sec"><h4>Địa bàn được ghi</h4>' + _uaTabChecks(_uaList(g.diaBan), 'uaGDiaBan') + '</div>' +
        (members.length ? '<div class="ua-sec"><h4>Thành viên</h4><div class="ua-chips">' + members.map(u => '<span class="ua-chip">' + _uaEsc(u.displayName || u.username) + '</span>').join('') + '</div></div>' : '');
}
async function _uaSaveGroup() {
    const group = { ma: _uaVal('uaGMa'), ten: _uaVal('uaGTen'), ghiChu: _uaVal('uaGGhiChu'), diaBan: _uaChecked('uaGDiaBan').join(','),
        trangThai: document.getElementById('uaGNgung').checked ? 'ngung' : 'hoat_dong' };
    const isNew = _UA.creating;
    await _uaRun('uaSaveBtn', async () => {
        await _uaPost({ action: 'save_group', group, isNew });
        _UA.dirty = false; _UA.creating = false; _UA.sel = group.ma;
        displayInfo('Đã lưu nhóm ' + group.ma);
        await _uaReload(true);
    });
}
async function _uaDeleteGroup() {
    if (!confirm('Xoá nhóm ' + _UA.sel + '?')) return;
    await _uaRun(null, async () => { await _uaPost({ action: 'delete_group', ma: _UA.sel }); _UA.sel = null; await _uaReload(); });
}

// ── Vai trò ──
function _uaRolesList() {
    return '<div class="ua-list">' + _UA.data.roles.map(r => '<button type="button" class="ua-it' + (r.ma === _UA.sel && !_UA.compare ? ' on' : '') + '" onclick="_uaSelect(\'' + _uaJs(r.ma) + '\')">' +
        '<span class="ua-it-t">' + _uaEsc(r.ten) + (r.he ? ' <span title="Vai trò hệ thống">🔒</span>' : '') +
        '<small>' + r.quyen.length + '/' + _uaCatalog().length + ' quyền · ' + (r.benNgoai ? 'bên ngoài · ' : '') + r.soNguoi + ' người</small></span></button>').join('') +
        '<button type="button" class="ua-btn wide ua-cmp" onclick="_uaCompare()">⇆ So sánh vai trò</button>' +
        '<button type="button" class="ua-btn p wide" onclick="_uaNew()">＋ Vai trò mới</button></div>';
}
function _uaCompare() { if (!_uaConfirmLeave()) return; _UA.compare = true; _UA.sel = null; _UA.creating = false; _uaRender(); _uaShowDetail(); }
function _uaRoleCompare() {
    const roles = _UA.data.roles, cat = _uaCatalog();
    return '<div class="ua-dhd"><div class="ua-dt"><div class="ua-name">So sánh vai trò</div></div></div><div class="ua-matrix"><table><thead><tr><th>Quyền</th>' +
        roles.map(r => '<th>' + _uaEsc(r.ten) + '</th>').join('') + '</tr></thead><tbody>' +
        _UA_GROUP_ORDER.map(gr => '<tr class="g"><td colspan="' + (roles.length + 1) + '">' + gr + '</td></tr>' +
            cat.filter(p => p.group === gr).map(p => '<tr><td>' + _uaEsc(p.label) + '</td>' + roles.map(r => '<td>' + (r.quyen.indexOf(p.key) >= 0 ? '✓' : '') + '</td>').join('') + '</tr>').join('')).join('') +
        '</tbody></table></div>';
}
function _uaRoleDetail() {
    const r = _UA.creating ? { ma: '', ten: '', quyen: ['xem'], he: false, benNgoai: false, ghiChu: '', soNguoi: 0 } : _UA.data.roles.find(x => x.ma === _UA.sel);
    if (!r) return '<div class="ua-empty">Chọn một vai trò, hoặc bấm “＋ Vai trò mới”.</div>';
    const ro = r.he ? ' disabled' : '';
    const cat = _uaCatalog();
    return '<div class="ua-dhd"><div class="ua-dt"><div class="ua-name">' + (_UA.creating ? 'Vai trò mới' : _uaEsc(r.ten)) + '</div><div class="ua-muted">' +
        (r.he ? 'Vai trò hệ thống — không sửa/xoá được' : (r.soNguoi || 0) + ' người dùng') + '</div></div>' +
        (!_UA.creating && !r.he ? '<button type="button" class="ua-btn d" onclick="_uaDeleteRole()">Xoá</button>' : '') +
        (r.he ? '' : '<button type="button" id="uaSaveBtn" class="ua-btn p" onclick="_uaSaveRole()">💾 ' + (_UA.creating ? 'Tạo' : 'Lưu') + '</button>') + '</div>' +
        '<div id="uaRoleDelBox"></div>' +
        '<div class="ua-sec"><h4>Thông tin</h4><div class="ua-row"><label class="ua-f">Mã vai trò<input id="uaRMa" class="ua-in" data-dirty value="' + _uaEsc(r.ma) + '"' + (_UA.creating ? ' placeholder="vd: to_truong"' : ' readonly') + '></label>' +
        '<label class="ua-f">Tên hiển thị<input id="uaRTen" class="ua-in" data-dirty value="' + _uaEsc(r.ten) + '"' + ro + '></label></div>' +
        '<label class="ua-f">Ghi chú<input id="uaRGhiChu" class="ua-in" data-dirty value="' + _uaEsc(r.ghiChu) + '"' + ro + '></label></div>' +
        '<div class="ua-sec"><h4>Quyền <span id="uaRSum" class="ua-muted">' + r.quyen.length + '/' + cat.length + '</span></h4>' +
        _UA_GROUP_ORDER.map(gr => '<div class="ua-pg"><div class="ua-sub">' + gr + '</div><div class="ua-pgrid">' +
            cat.filter(p => p.group === gr).map(p => '<label class="ua-ck"><input type="checkbox" data-dirty name="uaRQ" value="' + p.key + '"' +
                (r.quyen.indexOf(p.key) >= 0 ? ' checked' : '') + (r.he || p.key === 'xem' ? ' disabled' : '') + ' onchange="_uaRoleSum()"> ' + _uaEsc(p.label) + '</label>').join('') +
            '</div></div>').join('') + '</div>' +
        '<div class="ua-sec"><h4>Tuỳ chọn</h4><label class="ua-ck"><input type="checkbox" id="uaRNgoai" data-dirty' + (r.benNgoai ? ' checked' : '') + ro +
        '> Tài khoản bên ngoài (bắt buộc có ngày hết hạn, phiên 7 ngày)</label></div>';
}
function _uaRoleSum() {
    const el = document.getElementById('uaRSum');
    if (el) el.textContent = (_uaChecked('uaRQ').length + 1) + '/' + _uaCatalog().length;
}
async function _uaSaveRole() {
    const role = { ma: _uaVal('uaRMa'), ten: _uaVal('uaRTen'), ghiChu: _uaVal('uaRGhiChu'), quyen: ['xem'].concat(_uaChecked('uaRQ')).join(','),
        benNgoai: document.getElementById('uaRNgoai').checked };
    const isNew = _UA.creating;
    await _uaRun('uaSaveBtn', async () => {
        await _uaPost({ action: 'save_role', role, isNew });
        _UA.dirty = false; _UA.creating = false; _UA.sel = role.ma.toLowerCase();
        displayInfo('Đã lưu vai trò ' + role.ten + ' — áp dụng ngay cho người đang dùng vai trò này.');
        if (typeof _authWhoami === 'function') _authWhoami();
        await _uaReload(true);
    });
}
async function _uaDeleteRole(replaceWith) {
    const r = _UA.data.roles.find(x => x.ma === _UA.sel);
    if (!r) return;
    if (!replaceWith && !confirm('Xoá vai trò ' + r.ten + '?')) return;
    await _uaRun(null, async () => {
        try {
            await _uaPost({ action: 'delete_role', ma: r.ma, replaceWith: replaceWith || '' });
        } catch (e) {
            if (e.resp && e.resp.code === 'need_replace') { _uaRoleReplaceBox(r, e.resp.count); return; }
            throw e;
        }
        _UA.sel = null; displayInfo('Đã xoá vai trò ' + r.ten);
        await _uaReload();
    });
}
function _uaRoleReplaceBox(r, n) {
    const box = document.getElementById('uaRoleDelBox');
    if (!box) return;
    box.innerHTML = '<div class="ua-handover"><div><b>' + n + '</b> người đang dùng vai trò này. Chọn vai trò thay thế:</div>' +
        '<select id="uaRoleRepl" class="ua-in">' + _UA.data.roles.filter(x => x.ma !== r.ma).map(x => '<option value="' + _uaEsc(x.ma) + '">' + _uaEsc(x.ten) + '</option>').join('') + '</select>' +
        '<div class="ua-acts"><button type="button" class="ua-btn d" onclick="_uaDeleteRole(document.getElementById(\'uaRoleRepl\').value)">Chuyển &amp; xoá</button>' +
        '<button type="button" class="ua-btn" onclick="document.getElementById(\'uaRoleDelBox\').innerHTML=\'\'">Huỷ</button></div></div>';
}

// ── Chế độ kiểm quyền ──
function _uaAuthPanel() {
    const st = _UA.data.auth || {};
    const users = Object.keys(st.byUser || {}).sort((a, b) => st.byUser[b] - st.byUser[a]);
    const on = st.mode === 'on';
    return '<div class="ua-dhd"><div class="ua-dt"><div class="ua-name">Chế độ kiểm quyền: ' + (on ? '<span class="ua-chip ok">Đang chặn</span>' : st.mode === 'off' ? '<span class="ua-chip bad">Tắt</span>' : '<span class="ua-chip warn">Ghi nhận (chưa chặn)</span>') + '</div>' +
        '<div class="ua-muted">' + (st.daysInMode != null ? 'Đã ở chế độ này ' + st.daysInMode + ' ngày · ' : '') + 'Thao tác quản trị luôn bị chặn thật ở mọi chế độ.</div></div></div>' +
        '<div class="ua-sec"><h4>7 ngày qua</h4><div>' + (st.tokenless7d ? '<b>' + st.tokenless7d + '</b> lệnh ghi không có phiên đăng nhập (máy chưa cập nhật app hoặc chưa đăng nhập lại).' : '✓ Không còn lệnh ghi nào thiếu phiên đăng nhập.') + '</div>' +
        (users.length ? '<table class="ua-tbl"><thead><tr><th>Người dùng / máy</th><th>Số lệnh</th></tr></thead><tbody>' + users.map(k => '<tr><td>' + _uaEsc(k) + '</td><td>' + st.byUser[k] + '</td></tr>').join('') + '</tbody></table>' : '') + '</div>' +
        '<div class="ua-sec"><h4>Chuyển chế độ</h4><div class="ua-muted" style="margin-bottom:8px">Bật chặn khi mọi máy đã đăng nhập lại bằng bản app mới. Máy còn bản cũ sẽ không ghi được cho tới khi tải lại trang và đăng nhập.</div><div class="ua-acts">' +
        (on ? '<button type="button" class="ua-btn" onclick="_uaSetMode(\'log\')">Về chế độ ghi nhận</button>'
            : '<button type="button" class="ua-btn p" onclick="_uaSetMode(\'on\')"' + (st.canTurnOn ? '' : ' title="Còn lệnh thiếu phiên — sẽ hỏi xác nhận"') + '>🛡 Bật chặn</button>') + '</div></div>';
}
async function _uaSetMode(mode) {
    const st = _UA.data.auth || {};
    let force = false;
    if (mode === 'on' && !st.canTurnOn) {
        if (!confirm('Vẫn còn ' + (st.tokenless7d || 0) + ' lệnh ghi thiếu phiên trong 7 ngày.\nBật chặn bây giờ thì các máy đó sẽ không ghi được cho tới khi đăng nhập lại. Tiếp tục?')) return;
        force = true;
    } else if (!confirm(mode === 'on' ? 'Bật chặn: mọi lệnh ghi phải có phiên đăng nhập hợp lệ. Tiếp tục?' : 'Về chế độ ghi nhận (không chặn lệnh thiếu phiên)?')) return;
    await _uaRun(null, async () => {
        await _uaPost({ action: 'set_auth_mode', mode, force });
        displayInfo(mode === 'on' ? 'Đã bật chặn.' : 'Đã về chế độ ghi nhận.');
        await _uaReload(true);
        if (typeof _authStatus !== 'undefined') { _authStatus = _UA.data.auth; if (typeof _authRenderBanner === 'function') _authRenderBanner(); }
    });
}

if (typeof window !== 'undefined') {
    window.openUserAdmin = openUserAdmin;
    window.closeUserAdmin = closeUserAdmin;
}
