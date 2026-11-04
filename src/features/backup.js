// ══════════════════════════════════════════════════════════════════════════
// Sao lưu dữ liệu (v210) — xem docs/design-backup.md
// Classic script, nạp TRƯỚC khối <script> chính: lúc nạp chỉ khai báo hàm/hằng + bọc window.fetch.
// ══════════════════════════════════════════════════════════════════════════

// Mốc khôi phục (giờ máy chủ) mà máy này đã tải lại dữ liệu SAU đó, theo tab — gửi kèm lệnh ghi
// (clientEpochSeen) để GAS chặn máy còn giữ dữ liệu cũ. Lưu localStorage để qua được lần tải lại trang.
// CSV "Publish to web" có độ trễ vài phút → chỉ ghi nhận khi tải lại ≥ _BK_PUBLISH_DELAY_MS sau mốc.
const _BK_PUBLISH_DELAY_MS = 6 * 60000;
const _BK_SEEN_KEY = 'bk_epoch_seen';
let _bkReloadTimer = null;
const _BK_WRITE_ACTIONS = ['full_update', 'delete_row', 'batch_import', 'batch_match_update', 'assign_phases',
    'fill_marker_goc', 'fill_marker_goc_chain', 'normalize_coords', 'fix_loai', 'purge_no_gps'];
const _BK_KIND_LABEL = { auto: 'Tự động', manual: 'Tay', pre_restore: 'Trước khôi phục', pre_import: 'Trước nhập' };
const _BK_SYS_TABS = ['taikhoan', 'lichsu', 'diaban', 'phanquyen', 'offsetpresets', 'suco', 'baotri', 'nhiemvu'];
let _bkStaleShownAt = 0;
let _bkHealthAt = 0;
let _bkItems = [];

function _bkSeenAll() {
    try { const o = JSON.parse(localStorage.getItem(_BK_SEEN_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
}
function _bkMarkSeen(tab, epoch) {
    if (!tab || !(epoch > 0)) return;
    const o = _bkSeenAll();
    if (!(o[tab] >= epoch)) o[tab] = epoch;
    try { localStorage.setItem(_BK_SEEN_KEY, JSON.stringify(o)); } catch (e) { /* silent */ }
}

// Gắn clientEpochSeen vào body JSON của lệnh ghi (không đổi lệnh đã tự gửi giá trị).
// ⚠ Chỉ áp cho fetch có URL ĐÚNG BẰNG KHAOSAT_GAS_URL (mọi chỗ gọi hiện tại đều vậy).
function _bkAttachEpoch(body) {
    if (typeof body !== 'string' || body.charAt(0) !== '{') return { body, write: false };
    let d;
    try { d = JSON.parse(body); } catch (e) { return { body, write: false }; }
    if (!d || _BK_WRITE_ACTIONS.indexOf(d.action) < 0) return { body, write: false };
    if (d.clientEpochSeen === undefined) d.clientEpochSeen = _bkSeenAll()[d.sheet || 'DanhSachTru'] || 0;
    return { body: JSON.stringify(d), write: true };
}

(function _bkWrapFetch() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.fetch._bkWrapped) return;
    const orig = window.fetch.bind(window);
    const wrapped = async function (input, init) {
        let write = false;
        try {
            if (typeof KHAOSAT_GAS_URL !== 'undefined' && KHAOSAT_GAS_URL && input === KHAOSAT_GAS_URL && init && init.body) {
                const r = _bkAttachEpoch(init.body);
                if (r.write) { write = true; init = Object.assign({}, init, { body: r.body }); }
            }
        } catch (e) { /* không chặn lệnh gốc */ }
        const res = await orig(input, init);
        if (write) {
            try {
                res.clone().json().then(j => { if (j && j.status === 'stale') _bkOnStale(j); }).catch(() => {});
            } catch (e) { /* silent */ }
        }
        return res;
    };
    wrapped._bkWrapped = true;
    window.fetch = wrapped;
})();

// Còn bao lâu (ms) thì dữ liệu công khai (CSV publish) chắc chắn đã có bản khôi phục — tính theo giờ máy chủ
function _bkWaitMs(restoredAt, serverNow) {
    return Math.max(0, Number(restoredAt) + _BK_PUBLISH_DELAY_MS - Number(serverNow));
}

// Tải lại tab rồi mới ghi nhận đã thấy mốc khôi phục
async function _bkReloadAndMark(tab, epoch) {
    try { if (typeof _idbSet === 'function' && tab) await _idbSet(tab, null); } catch (e) { /* silent */ }
    if (typeof dirtyMovedRows !== 'undefined' && dirtyMovedRows && dirtyMovedRows.clear) {
        dirtyMovedRows.clear();
        if (typeof updateDirtyMovedBadge === 'function') updateDirtyMovedBadge();
    }
    if (typeof currentSheet !== 'undefined' && tab === currentSheet) await _bkReloadCurrent();
    _bkMarkSeen(tab, epoch);   // tab khác: cache đã xoá, lần mở sau sẽ tải mới
}

// Hẹn tải lại khi dữ liệu công khai đã cập nhật (hoặc làm ngay nếu đã đủ thời gian)
function _bkScheduleReload(tab, epoch, serverNow, askFirst) {
    const wait = _bkWaitMs(epoch, serverNow);
    if (_bkReloadTimer) clearTimeout(_bkReloadTimer);
    if (wait > 0) {
        const min = Math.ceil(wait / 60000);
        if (typeof displayError === 'function') displayError('⏳ Địa bàn ' + tab + ' vừa được khôi phục — Google cần khoảng ' + min +
            ' phút để cập nhật dữ liệu công khai. App sẽ tự tải lại sau đó; tạm thời chưa lưu được thay đổi cho địa bàn này.');
        _bkReloadTimer = setTimeout(() => { _bkReloadAndMark(tab, epoch).then(() => {
            if (typeof displayInfo === 'function') displayInfo('✅ Đã tải lại dữ liệu khôi phục của ' + tab);
        }); }, wait + 5000);
        return;
    }
    if (!askFirst || confirm('Địa bàn ' + tab + ' đã được khôi phục từ bản sao — máy này đang giữ dữ liệu cũ.\n\nTải lại địa bàn ngay?')) {
        _bkReloadAndMark(tab, epoch);
    } else if (typeof displayError === 'function') {
        displayError('Địa bàn ' + tab + ' đã được khôi phục — cần tải lại trước khi lưu thay đổi.');
    }
}

// Máy đang giữ dữ liệu cũ sau khi admin khôi phục
async function _bkOnStale(j) {
    const now = Date.now();
    if (now - _bkStaleShownAt < 10000) return;
    _bkStaleShownAt = now;
    const tab = j.sheet || '';
    if (!tab || !(j.restoredAt > 0)) return;
    _bkScheduleReload(tab, Number(j.restoredAt), Number(j.serverNow) || Number(j.restoredAt), true);
}

async function _bkReloadCurrent() {
    try {
        if (typeof switchDistrict === 'function' && typeof currentSheet !== 'undefined') {
            await switchDistrict(currentSheet, { keepView: true });
        } else {
            location.reload();
        }
    } catch (e) { location.reload(); }
}

async function _bkPost(payload) {
    const res = await fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    return res.json();
}

async function _bkAdminPost(payload) {
    const auth = (typeof _getAdminAuth === 'function') ? await _getAdminAuth() : null;
    if (!auth) return { status: 'error', message: 'Cần mật khẩu admin' };
    const j = await _bkPost(Object.assign({ adminAuth: auth }, payload));
    if (j && j.status === 'error' && /password admin sai|thiếu adminauth/i.test(j.message || '')) {
        try { _adminAuthCached = null; } catch (e) { /* silent */ }
    }
    return j;
}

// ── Sao lưu trước thao tác hàng loạt ────────────────────────────────────
// Trả true = được tiếp tục. Lỗi sao lưu → hỏi người dùng có làm tiếp không.
async function _bkPreBatch(label) {
    if (typeof KHAOSAT_GAS_URL === 'undefined' || !KHAOSAT_GAS_URL) return true;
    try {
        if (typeof displayInfo === 'function') displayInfo('🗄 Đang sao lưu dữ liệu trước khi ' + label + '...');
        const j = await _bkPost({ action: 'backup_pre_import', sheet: (typeof currentSheet !== 'undefined' ? currentSheet : ''),
            by: (typeof currentUser !== 'undefined' && currentUser ? currentUser.username : '') });
        if (j && j.status === 'ok') return true;
        return confirm('Không sao lưu được trước khi ' + label + ' (' + ((j && j.message) || 'lỗi không rõ') + ').\nVẫn tiếp tục?');
    } catch (e) {
        return confirm('Không sao lưu được trước khi ' + label + ' (' + (e.message || e) + ').\nVẫn tiếp tục?');
    }
}

// ── Mục ☰: tình trạng + 2 nút ──────────────────────────────────────────
function _bkAgeText(iso) {
    const ms = Date.parse(iso || '');
    if (!(ms > 0)) return { text: 'chưa có bản tự động nào', bad: true };
    const h = (Date.now() - ms) / 3600000;
    const text = h < 1 ? Math.max(1, Math.round(h * 60)) + ' phút trước' : h < 48 ? Math.round(h) + ' giờ trước' : Math.round(h / 24) + ' ngày trước';
    return { text, bad: h > 36 };
}

function _bkRenderHealth(h) {
    const el = document.getElementById('bkHealth');
    if (!el) return;
    if (!h) { el.textContent = ''; return; }
    const a = _bkAgeText(h.lastAutoAt);
    const warn = !h.hasTrigger ? ' — ⚠ chưa bật sao lưu tự động (chạy setupDailyBackupTrigger trong Apps Script)' : '';
    el.className = 'bk-health' + (a.bad || !h.hasTrigger ? ' bad' : '');
    el.textContent = 'Bản tự động gần nhất: ' + a.text + warn;
}

async function _bkRefreshHealth(force) {
    if (!force && Date.now() - _bkHealthAt < 10 * 60000) return;
    _bkHealthAt = Date.now();
    try {
        const j = await _bkPost({ action: 'backup_health' });
        if (j && j.status === 'ok') _bkRenderHealth(j.health);
    } catch (e) { /* silent */ }
}

async function _bkBackupNow() {
    const btn = document.getElementById('bkBtnNow');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang sao lưu...'; }
    try {
        const j = await _bkAdminPost({ action: 'backup_now' });
        if (j.status === 'ok') {
            const failed = (j.failed || []).map(f => f.tab || f.src).join(', ');
            displayInfo('✅ Đã sao lưu ' + j.ok.length + ' file lên Drive' + (failed ? ' — ⚠ lỗi: ' + failed : ''));
            _bkRefreshHealth(true);
        } else {
            displayError('Sao lưu: ' + (j.message || 'lỗi'));
        }
    } catch (e) {
        displayError('Sao lưu lỗi mạng: ' + (e.message || e));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🗄 Sao lưu ngay'; }
    }
}

// ── Hộp danh sách bản sao + khôi phục ─────────────────────────────────
function _bkEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _bkEnsureModal() {
    let m = document.getElementById('bkModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'bkModal';
    m.className = 'bk-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'bkModalTitle');
    m.innerHTML = `
        <div class="bk-card">
            <div class="bk-head">
                <h5 id="bkModalTitle">🗄 Bản sao dữ liệu</h5>
                <button type="button" class="bk-x" aria-label="Đóng" onclick="_bkCloseModal()">✕</button>
            </div>
            <div class="bk-body" id="bkBody"></div>
        </div>`;
    m.addEventListener('click', e => { if (e.target === m) _bkCloseModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('open')) _bkCloseModal(); });
    document.body.appendChild(m);
    return m;
}

function _bkCloseModal() {
    const m = document.getElementById('bkModal');
    if (m) m.classList.remove('open');
}

async function _bkOpenList() {
    if (typeof closeControlsModal === 'function') closeControlsModal();
    const m = _bkEnsureModal();
    m.classList.add('open');
    const body = document.getElementById('bkBody');
    body.innerHTML = '<div class="bk-empty">⏳ Đang tải danh sách bản sao...</div>';
    let j;
    try { j = await _bkAdminPost({ action: 'list_backups' }); }
    catch (e) { j = { status: 'error', message: e.message || String(e) }; }
    if (!j || j.status !== 'ok') {
        body.innerHTML = '<div class="bk-empty bad">Không tải được: ' + _bkEsc(j && j.message) + '</div>';
        return;
    }
    _bkItems = j.items || [];
    _bkRenderHealth(j.health);
    const ip = j.restoreInProgress;
    const ipHtml = ip ? `<div class="bk-empty bad">⚠ Lần khôi phục tab ${_bkEsc(ip.tab)} lúc ${_bkEsc(ip.at)} chưa kết thúc (có thể bị cắt do quá 6 phút). Kiểm tra tab ${_bkEsc(ip.tab)}; dữ liệu trước khôi phục nằm ở tab ẩn ${_bkEsc(ip.snapTab)}.</div>` : '';
    const a = _bkAgeText(j.health && j.health.lastAutoAt);
    const rows = _bkItems.map((it, i) => `
        <tr>
            <td class="bk-time">${_bkEsc(it.atText)}</td>
            <td><span class="bk-kind k-${_bkEsc(it.kind)}">${_bkEsc(_BK_KIND_LABEL[it.kind] || it.kind)}</span>${it.by ? '<div class="bk-by">' + _bkEsc(it.by) + '</div>' : ''}</td>
            <td class="bk-src">${_bkEsc(it.srcName)}</td>
            <td class="bk-act">
                <a href="${_bkEsc(it.url)}" target="_blank" rel="noopener" class="bk-btn">Mở</a>
                <a href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(it.id)}/export?format=xlsx" target="_blank" rel="noopener" class="bk-btn">Excel</a>
                <button type="button" class="bk-btn warn" onclick="_bkStartRestore(${i})">Khôi phục</button>
            </td>
        </tr>`).join('');
    body.innerHTML = `
        <div class="bk-health${a.bad ? ' bad' : ''}">Bản tự động gần nhất: ${_bkEsc(a.text)}${j.health && !j.health.hasTrigger ? ' — ⚠ chưa bật sao lưu tự động' : ''}</div>
        <div class="bk-note">Bản sao nằm trong <a href="${_bkEsc(j.folderUrl)}" target="_blank" rel="noopener">thư mục LightingSurvey_Backup</a> trên Google Drive (chỉ chủ tài khoản xem được). Nút <b>Mở/Excel</b> cần đăng nhập đúng tài khoản Google đó.</div>
        ${ipHtml}
        <div id="bkRestorePanel"></div>
        ${_bkItems.length ? `<div class="bk-table-wrap"><table class="bk-table">
            <thead><tr><th>Thời gian</th><th>Loại</th><th>File</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table></div>` : '<div class="bk-empty">Chưa có bản sao nào — bấm "Sao lưu ngay".</div>'}`;
}

function _bkRestorableTabs(item) {
    return Object.keys(item.rows || {}).filter(t => t && t.charAt(0) !== '_' && _BK_SYS_TABS.indexOf(String(t).toLowerCase()) < 0);
}

function _bkStartRestore(i) {
    const it = _bkItems[i];
    const panel = document.getElementById('bkRestorePanel');
    if (!it || !panel) return;
    const tabs = _bkRestorableTabs(it);
    if (!tabs.length) { panel.innerHTML = '<div class="bk-empty bad">Bản sao này không có tab dữ liệu trụ.</div>'; return; }
    const cur = (typeof currentSheet !== 'undefined' && tabs.indexOf(currentSheet) >= 0) ? currentSheet : tabs[0];
    panel.innerHTML = `
        <div class="bk-restore">
            <div class="bk-restore-title">Khôi phục từ bản ${_bkEsc(it.atText)} (${_bkEsc(_BK_KIND_LABEL[it.kind] || it.kind)})</div>
            <label class="bk-lbl">Địa bàn (tab)
                <select id="bkTab" class="ctrl-input" onchange="_bkPreview(${i})">
                    ${tabs.map(t => `<option value="${_bkEsc(t)}"${t === cur ? ' selected' : ''}>${_bkEsc(t)} (${Number(it.rows[t]) || 0} dòng)</option>`).join('')}
                </select>
            </label>
            <div id="bkPreview" class="bk-preview">⏳ Đang so sánh...</div>
        </div>`;
    panel.scrollIntoView({ block: 'nearest' });
    _bkPreview(i);
}

async function _bkPreview(i) {
    const it = _bkItems[i];
    const tab = document.getElementById('bkTab').value;
    const box = document.getElementById('bkPreview');
    box.innerHTML = '⏳ Đang so sánh với dữ liệu hiện tại...';
    let j;
    try { j = await _bkAdminPost({ action: 'restore_preview', backupId: it.id, tab }); }
    catch (e) { j = { status: 'error', message: e.message || String(e) }; }
    if (!j || j.status !== 'ok') { box.innerHTML = '<div class="bad">❌ ' + _bkEsc(j && j.message) + '</div>'; return; }
    const c = j.counts;
    const risky = c.onlyCurrent > 0 || c.changedAfter > 0;
    box.innerHTML = `
        <ul class="bk-counts">
            <li>Hiện tại: <b>${c.current}</b> trụ/tủ — trong bản sao: <b>${c.backup}</b></li>
            <li${c.onlyCurrent ? ' class="bad"' : ''}>Có ở hiện tại nhưng không có trong bản sao (sẽ mất): <b>${c.onlyCurrent}</b></li>
            <li${c.changedAfter ? ' class="bad"' : ''}>Sửa sau giờ sao lưu (sẽ quay về cũ): <b>${c.changedAfter}</b></li>
            <li>Có trong bản sao nhưng hiện không còn (sẽ có lại): <b>${c.onlyBackup}</b></li>
        </ul>
        <div class="bk-warn">${risky ? '⚠ Dữ liệu khảo sát nhập/sửa sau ' + _bkEsc(j.backupAtText) + ' sẽ bị ghi đè. ' : ''}Trước khi ghi đè, app tự sao lưu cả file và giữ nguyên tab hiện tại thành tab ẩn <code>_TruocKP_${_bkEsc(tab)}_…</code> để lấy lại. Nên làm ngoài giờ khảo sát; các máy đang mở địa bàn này sẽ phải tải lại.</div>
        <label class="bk-lbl">Lý do khôi phục <input id="bkReason" class="ctrl-input" maxlength="200" placeholder="vd: nhập CSV sai tọa độ"></label>
        <label class="bk-lbl">Gõ <b>${_bkEsc(tab)}</b> để xác nhận <input id="bkConfirm" class="ctrl-input" autocomplete="off" spellcheck="false"></label>
        <div class="bk-row">
            <button type="button" class="bk-btn" onclick="document.getElementById('bkRestorePanel').innerHTML=''">Huỷ</button>
            <button type="button" class="bk-btn danger" id="bkDoRestore" onclick="_bkDoRestore(${i})">Khôi phục ${_bkEsc(tab)}</button>
        </div>`;
}

async function _bkDoRestore(i) {
    const it = _bkItems[i];
    const tab = document.getElementById('bkTab').value;
    const reason = (document.getElementById('bkReason').value || '').trim();
    const conf = (document.getElementById('bkConfirm').value || '').trim();
    if (reason.length < 3) { displayError('Cần ghi lý do khôi phục'); return; }
    if (conf !== tab) { displayError('Gõ đúng "' + tab + '" để xác nhận'); return; }
    const btn = document.getElementById('bkDoRestore');
    btn.disabled = true; btn.textContent = '⏳ Đang khôi phục (sao lưu trước rồi ghi đè)...';
    let j;
    try { j = await _bkAdminPost({ action: 'restore_backup_sheet', backupId: it.id, tab, confirm: conf, reason }); }
    catch (e) { j = { status: 'error', message: e.message || String(e) }; }
    if (!j || j.status !== 'ok') {
        btn.disabled = false; btn.textContent = 'Khôi phục ' + tab;
        displayError('Khôi phục: ' + ((j && j.message) || 'lỗi'));
        return;
    }
    displayInfo('✅ Đã khôi phục ' + tab + ': ' + j.rowsBefore + ' → ' + j.rowsAfter + ' dòng. Dữ liệu trước đó ở tab ẩn ' + j.snapTab);
    _bkCloseModal();
    // Máy admin cũng phải chờ dữ liệu công khai cập nhật rồi mới tải lại (tránh ghi đè bằng dữ liệu cũ)
    _bkScheduleReload(tab, Number(j.restoredAt), Number(j.serverNow) || Number(j.restoredAt), false);
}

window._bkBackupNow = _bkBackupNow;
window._bkOpenList = _bkOpenList;
window._bkCloseModal = _bkCloseModal;
window._bkStartRestore = _bkStartRestore;
window._bkPreview = _bkPreview;
window._bkDoRestore = _bkDoRestore;
window._bkPreBatch = _bkPreBatch;
