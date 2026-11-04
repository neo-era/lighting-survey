// Sao lưu dữ liệu (v210) — test tích hợp: chạy nguyên gas-khaosat.js trên Drive/Sheet giả lập
// Chạy: node tests/backup-gas.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'gas-khaosat.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeWorld(opts = {}) {
    let seq = 0, clock = opts.now || Date.UTC(2026, 10, 4, 3, 0);
    const files = {}, folders = {}, props = {}, triggers = [], mails = [];
    const ME = 'owner@x.com';

    class Range {
        constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
        getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.data[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; }
        setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
        setValue(x) { this.sh.set(this.r, this.c, x); return this; }
        getValue() { return this.getValues()[0][0]; }
        clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.set(this.r + i, this.c + j, ''); return this; }
        copyTo(dest) {
            if (dest.sh.ss !== this.sh.ss) throw new Error('Range.copyTo chỉ trong cùng file');
            if (this.sh.failCopy) throw new Error('lỗi giả lập khi chép');
            this.getValues().forEach((row, i) => row.forEach((x, j) => dest.sh.set(dest.r + i, dest.c + j, x)));
        }
        setFontWeight() { return this; } setBackground() { return this; } setHorizontalAlignment() { return this; } setWrap() { return this; } setFontColor() { return this; } setNumberFormat() { return this; } setVerticalAlignment() { return this; } setFontSize() { return this; }
    }
    class Sheet {
        constructor(ss, name, data) { this.ss = ss; this.name = name; this.data = data.map(r => r.slice()); this.maxRows = Math.max(1000, data.length); this.maxCols = Math.max(26, ...data.map(r => r.length), 1); this.hidden = false; this.gid = ++seq; }
        set(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
        getName() { return this.name; } setName(n) { this.name = n; return this; }
        getSheetId() { return this.gid; }
        getLastRow() { for (let i = this.data.length - 1; i >= 0; i--) if (this.data[i].some(x => x !== '' && x != null)) return i + 1; return 0; }
        getLastColumn() { let m = 0; this.data.forEach(r => { for (let j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] != null) { m = Math.max(m, j + 1); break; } }); return m; }
        getMaxRows() { return this.maxRows; } getMaxColumns() { return this.maxCols; }
        getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
        getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
        copyTo(ss) { const s = new Sheet(ss, 'Copy of ' + this.name, this.data); ss.sheets.push(s); return s; }
        hideSheet() { this.hidden = true; }
        insertRowsAfter(a, n) { this.maxRows += n; } insertColumnsAfter(a, n) { this.maxCols += n; }
        appendRow(row) { this.data.push(row.slice()); }
        setFrozenRows() {} autoResizeColumns() {} setColumnWidth() {} insertColumnAfter() {} getFrozenRows() { return 1; }
    }
    class SS {
        constructor(id, name, tabs) { this.id = id; this.name = name; this.sheets = Object.entries(tabs).map(([n, d]) => new Sheet(this, n, d)); }
        getId() { return this.id; } getName() { return this.name; } getSheets() { return this.sheets.slice(); }
        getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
        deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
        insertSheet(n) { const s = new Sheet(this, n, []); this.sheets.push(s); return s; }
    }
    const sheets = {};
    function addFile(id, name, tabs, parent) {
        const ss = new SS(id, name, tabs); sheets[id] = ss;
        files[id] = { id, name, desc: '', trashed: false, parents: parent ? [parent] : [], owner: ME };
        return ss;
    }
    function fileObj(id) {
        const f = files[id]; if (!f) throw new Error('No file ' + id);
        return {
            getId: () => id, getName: () => f.name, getUrl: () => 'https://drive/' + id,
            getDescription: () => f.desc, setDescription: d => { f.desc = d; },
            isTrashed: () => f.trashed, setTrashed: t => { if (f.failTrash) throw new Error('không có quyền'); f.trashed = t; },
            getOwner: () => ({ getEmail: () => f.owner }),
            getParents: () => { const a = f.parents.slice(); return { hasNext: () => a.length > 0, next: () => ({ getId: () => a.shift() }) }; },
            makeCopy: (name, folder) => {
                if (f.failCopy) throw new Error('không mở được file');
                const nid = 'copy' + (++seq); const src = sheets[id];
                const c = new SS(nid, name, {}); c.sheets = src.sheets.map(s => { const t = new Sheet(c, s.name, s.data); return t; });
                sheets[nid] = c; files[nid] = { id: nid, name, desc: '', trashed: false, parents: [folder.getId()], owner: ME };
                return fileObj(nid);
            }
        };
    }
    function folderObj(id) {
        const fo = folders[id];
        return {
            getId: () => id, getUrl: () => 'https://drive/folder/' + id, isTrashed: () => fo.trashed,
            getSharingAccess: () => fo.access, setSharing: (a) => { fo.access = a; },
            getFiles: () => { const a = Object.values(files).filter(f => f.parents.includes(id)).map(f => fileObj(f.id)); return { hasNext: () => a.length > 0, next: () => a.shift() }; }
        };
    }
    const active = addFile('MAIN', 'Khảo sát', opts.mainTabs);
    if (opts.extTabs) addFile('EXT', 'CanGiuoc file', opts.extTabs);
    if (opts.extFail) files.EXT && (files.EXT.failCopy = true);

    const ctx = {
        console, JSON, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock); } static now() { return clock; } },
        Math, Object, Array, String, Number, isFinite, isNaN, parseInt, parseFloat, RegExp, Error,
        Logger: { log() {} },
        ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
        SpreadsheetApp: {
            getActiveSpreadsheet: () => active,
            openById: id => { if (!sheets[id] || (files[id] && files[id].failOpen)) throw new Error('openById lỗi ' + id); return sheets[id]; },
            flush() {}, CopyPasteType: { PASTE_NORMAL: 'n' }
        },
        DriveApp: {
            getFileById: fileObj,
            getFolderById: id => { if (!folders[id]) throw new Error('no folder'); return folderObj(id); },
            createFolder: name => { const id = 'F' + (++seq); folders[id] = { name, trashed: false, access: 'ANYONE' }; return folderObj(id); },
            Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' }
        },
        PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
        LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
        Utilities: { formatDate: (d, tz, f) => { const x = new Date(d.getTime() + 7 * 3600e3); const p = n => String(n).padStart(2, '0'); return f.replace('yyyy', x.getUTCFullYear()).replace('MM', p(x.getUTCMonth() + 1)).replace('dd', p(x.getUTCDate())).replace('HH', p(x.getUTCHours())).replace('mm', p(x.getUTCMinutes())); }, computeDigest: () => [], DigestAlgorithm: {}, Charset: {} },
        Session: { getEffectiveUser: () => ({ getEmail: () => ME }) },
        ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
            newTrigger: h => { const b = { tz: null, hour: null, timeBased() { return b; }, atHour(x) { b.hour = x; return b; }, everyDays() { return b; }, inTimezone(z) { b.tz = z; return b; }, create() { const t = { getHandlerFunction: () => h, hour: b.hour, tz: b.tz }; triggers.push(t); return t; } }; return b; } },
        GmailApp: { sendEmail: (...a) => mails.push(a) },
        MailApp: { sendEmail: (...a) => mails.push(a) },
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    // admin luôn hợp lệ trong test (đã có test riêng cho _requireAdmin)
    vm.runInContext(`_requireAdmin = function(d){ return (d.adminAuth && d.adminAuth.password==='ok') ? {ok:true, adminUser:'admin'} : {ok:false, error:'Password admin sai'}; };`, ctx);
    if (opts.ext !== false && opts.extTabs) vm.runInContext(`EXTERNAL_SPREADSHEET_IDS.CanGiuoc = 'EXT';`, ctx);
    else vm.runInContext(`delete EXTERNAL_SPREADSHEET_IDS.CanGiuoc;`, ctx);
    const post = d => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(d) } }).s);
    return { ctx, files, folders, props, triggers, mails, sheets, active, post, tick: ms => { clock += ms; }, now: () => clock };
}

const H = ['ID', 'Tên trụ', 'Lat', 'Lon', 'Thời gian cập nhật'];
const ADM = { adminAuth: { username: 'admin', password: 'ok' } };
const mainTabs = () => ({
    DanhSachTru: [H, ['TQ_001', 'A', '10,7', '106,6', '']],
    Quan1: [H.concat(['Pha']), ['Q1_1', 'P1', '10,75', '106,70', '01:00:00 4/11/2026', 'A'], ['Q1_2', 'P2', '10,76', '106,71', '', 'B']],
    TaiKhoan: [['user', 'pass'], ['admin', 'hash']]
});

// ── 1. Sao lưu ngay ─────────────────────────────────────────
{
    const w = makeWorld({ mainTabs: mainTabs(), extTabs: { CanGiuoc: [H, ['CG_1', 'C1', '10,6', '106,5', '']] } });
    const r = w.post({ action: 'backup_now', ...ADM });
    ok('backup_now: chép 2 nguồn (file chính + CanGiuoc)', r.status === 'ok' && r.ok.length === 2, r);
    const copies = Object.values(w.files).filter(f => f.desc);
    ok('bản sao có tên đọc được', copies.some(f => /^Khảo sát — backup 2026-11-04 10-00 \(tay: admin\)$/.test(f.name)), copies.map(f => f.name));
    ok('meta có số dòng từng tab', JSON.parse(copies[0].desc).rows.Quan1 === 2);
    const folderId = w.props.BACKUP_FOLDER_ID;
    ok('thư mục backup được ép riêng tư', w.folders[folderId].access === 'PRIVATE');
    ok('sai mật khẩu admin → lỗi', w.post({ action: 'backup_now', adminAuth: { username: 'a', password: 'x' } }).status === 'error');
    const r2 = w.post({ action: 'backup_now', ...ADM });
    ok('bấm lại trong 5 phút → từ chối', r2.status === 'error' && /5 phút/.test(r2.message));
    w.tick(6 * 60e3);
    ok('sau 6 phút → được', w.post({ action: 'backup_now', ...ADM }).status === 'ok');
    const lich = w.active.getSheetByName('LichSu');
    ok('ghi LichSu "backup"', lich && lich.data.some(r => r[2] === 'backup'));
}
// ── 2. Một nguồn lỗi không làm hỏng nguồn khác ──────────────
{
    const w = makeWorld({ mainTabs: mainTabs(), extTabs: { CanGiuoc: [H] }, extFail: true });
    const r = w.post({ action: 'backup_now', ...ADM });
    ok('nguồn ngoài lỗi: vẫn có bản file chính, báo lỗi CanGiuoc', r.status === 'ok' && r.ok.length === 1 && r.failed.length === 1 && r.failed[0].tab === 'CanGiuoc', r);
}
// ── 3. Trigger + tự động + giữ bản ──────────────────────────
{
    const w = makeWorld({ mainTabs: mainTabs() });
    w.ctx.setupDailyBackupTrigger(); w.ctx.setupDailyBackupTrigger();
    const tr = w.triggers.filter(t => t.getHandlerFunction() === 'dailyBackup');
    ok('setup 2 lần vẫn 1 trigger, 01h giờ VN', tr.length === 1 && tr[0].hour === 1 && tr[0].tz === 'Asia/Ho_Chi_Minh');
    for (let i = 0; i < 35; i++) { w.ctx.dailyBackup(); w.tick(86400e3); }
    const live = Object.values(w.files).filter(f => f.desc && !f.trashed);
    ok('35 ngày tự động → còn ≤ 30 + tuần/tháng, phần dư vào Thùng rác (không xoá hẳn)', live.length < 35 && Object.values(w.files).filter(f => f.trashed).length === 35 - live.length, live.length);
    const st = JSON.parse(w.props.BACKUP_LAST_AUTO);
    ok('lưu trạng thái lần chạy gần nhất', st.ok === 1 && st.lastOkAt);
    // File lạ trong thư mục (không meta) không bao giờ bị đụng
    const fid = w.props.BACKUP_FOLDER_ID;
    w.files.LA = { id: 'LA', name: 'tài liệu riêng', desc: '', trashed: false, parents: [fid], owner: 'owner@x.com' };
    // File có meta nhưng chủ khác → không đụng
    w.files.KHAC = { id: 'KHAC', name: 'của người khác', desc: JSON.stringify({ app: 'lighting-survey-backup', v: 1, src: 'MAIN', kind: 'manual', at: '2020-01-01T00:00:00Z' }), trashed: false, parents: [fid], owner: 'other@x.com' };
    for (let i = 0; i < 25; i++) w.files['OLDM' + i] = { id: 'OLDM' + i, name: 'm', desc: JSON.stringify({ app: 'lighting-survey-backup', v: 1, src: 'MAIN', kind: 'manual', at: new Date(Date.UTC(2025, 0, 1 + i)).toISOString() }), trashed: false, parents: [fid], owner: 'owner@x.com' };
    w.ctx.dailyBackup();
    ok('file không có meta không bị bỏ Thùng rác', !w.files.LA.trashed);
    ok('file của chủ khác không bị bỏ Thùng rác', !w.files.KHAC.trashed);
    ok('bản tay: giữ 20, bỏ 5 cũ nhất', ['OLDM0', 'OLDM4'].every(k => w.files[k].trashed) && !w.files.OLDM5.trashed);
    const lb = w.post({ action: 'list_backups', ...ADM });
    ok('list_backups: có trigger + giờ bản tự động gần nhất', lb.status === 'ok' && lb.health.hasTrigger && lb.health.lastAutoAt && lb.items.length > 0 && lb.items.length <= 60, lb.health);
    ok('list_backups: mới nhất trước', lb.items[0].at >= lb.items[lb.items.length - 1].at);
}
// ── 4. Trigger lỗi → email + LichSu ─────────────────────────
{
    const w = makeWorld({ mainTabs: mainTabs() });
    w.files.MAIN.failCopy = true;
    w.ctx.dailyBackup();
    ok('lỗi → gửi email cho chủ script', w.mails.length === 1 && w.mails[0][0] === 'owner@x.com');
    ok('lỗi → LichSu backup_failed', w.active.getSheetByName('LichSu').data.some(r => r[2] === 'backup_failed'));
}
// ── 5. Sao lưu trước nhập (không cần admin) ────────────────
{
    const w = makeWorld({ mainTabs: mainTabs(), extTabs: { CanGiuoc: [H] } });
    const r = w.post({ action: 'backup_pre_import', sheet: 'CanGiuoc', by: 'hung' });
    const copies = Object.values(w.files).filter(f => f.desc);
    ok('trước nhập: chỉ chép file chứa tab (CanGiuoc)', r.status === 'ok' && copies.length === 1 && JSON.parse(copies[0].desc).src === 'EXT', copies.map(f => f.desc));
    ok('trước nhập: tên ghi người', /\(trước nhập: hung\)$/.test(copies[0].name));
    const r2 = w.post({ action: 'backup_pre_import', sheet: 'CanGiuoc', by: 'hung' });
    ok('trước nhập trong 15 phút → dùng lại, không chép thêm', r2.status === 'ok' && r2.reused === true && Object.values(w.files).filter(f => f.desc).length === 1);
    const r3 = w.post({ action: 'backup_pre_import', sheet: 'Quan1', by: 'hung' });
    ok('trước nhập tab file chính → chép file chính', r3.status === 'ok' && r3.reused === false);
}
// ── 6. Khôi phục ─────────────────────────────────────────────
{
    const w = makeWorld({ mainTabs: mainTabs(), extTabs: { CanGiuoc: [H, ['CG_1', 'C1', '10,6', '106,5', '']] } });
    w.post({ action: 'backup_now', ...ADM });
    const all = Object.values(w.files).filter(f => f.desc);
    const bkMain = all.find(f => JSON.parse(f.desc).src === 'MAIN').id;
    const bkExt = all.find(f => JSON.parse(f.desc).src === 'EXT').id;
    // Sau sao lưu: sửa dữ liệu (thêm cột mới, nhập sai)
    const q1 = w.active.getSheetByName('Quan1');
    const gid = q1.getSheetId();
    q1.set(1, 7, 'Số nhà');                       // cột mới thêm sau sao lưu
    q1.set(2, 2, 'SAI'); q1.set(4, 1, 'Q1_9'); q1.set(4, 2, 'mới'); q1.set(4, 5, '09:00:00 5/11/2026');
    w.tick(3600e3);
    const pv = w.post({ action: 'restore_preview', backupId: bkMain, tab: 'Quan1', ...ADM });
    ok('xem trước: 3 dòng hiện tại / 2 trong bản sao / 1 dòng chỉ có hiện tại', pv.status === 'ok' && pv.counts.current === 3 && pv.counts.backup === 2 && pv.counts.onlyCurrent === 1, pv);
    ok('xem trước: 1 dòng sửa sau giờ sao lưu', pv.counts.changedAfter === 1, pv.counts);
    ok('khôi phục gõ sai tên → từ chối, không ghi', w.post({ action: 'restore_backup_sheet', backupId: bkMain, tab: 'Quan1', confirm: 'quan1', reason: 'nhập sai', ...ADM }).status === 'error' && q1.data[1][1] === 'SAI');
    ok('khôi phục thiếu lý do → từ chối', w.post({ action: 'restore_backup_sheet', backupId: bkMain, tab: 'Quan1', confirm: 'Quan1', reason: '', ...ADM }).status === 'error');
    ok('khôi phục tab TaiKhoan → từ chối', w.post({ action: 'restore_backup_sheet', backupId: bkMain, tab: 'TaiKhoan', confirm: 'TaiKhoan', reason: 'thử lại', ...ADM }).status === 'error');
    ok('khôi phục CanGiuoc bằng bản của file chính → từ chối (sai nguồn)', w.post({ action: 'restore_backup_sheet', backupId: bkMain, tab: 'CanGiuoc', confirm: 'CanGiuoc', reason: 'thử lại', ...ADM }).status === 'error');
    const before = Object.keys(w.files).length;
    const rs = w.post({ action: 'restore_backup_sheet', backupId: bkMain, tab: 'Quan1', confirm: 'Quan1', reason: 'nhập CSV sai', ...ADM });
    ok('khôi phục: thành công', rs.status === 'ok' && rs.rowsBefore === 3 && rs.rowsAfter === 2, rs);
    ok('khôi phục: dữ liệu về như bản sao', q1.data[1][1] === 'P1' && q1.getLastRow() === 3);
    ok('khôi phục: giữ nguyên tab (gid không đổi)', w.active.getSheetByName('Quan1') === q1 && q1.getSheetId() === gid);
    ok('khôi phục: header dòng 1 giữ cột mới "Số nhà"', q1.data[0][6] === 'Số nhà' && q1.data[0][5] === 'Pha');
    ok('khôi phục: có bản "trước khôi phục" trên Drive', Object.keys(w.files).length === before + 1 && Object.values(w.files).some(f => /trước khôi phục: admin/.test(f.name)));
    const snap = w.active.sheets.find(s => s.name.startsWith('_TruocKP_Quan1_'));
    ok('khôi phục: tab ẩn chụp dữ liệu trước đó (có Q1_9)', snap && snap.hidden && snap.data.some(r => r[0] === 'Q1_9'));
    ok('khôi phục: không còn tab tạm', !w.active.sheets.some(s => s.name.startsWith('Copy of')));
    ok('khôi phục: ghi LichSu restore_backup kèm lý do', w.active.getSheetByName('LichSu').data.some(r => r[2] === 'restore_backup' && /nhập CSV sai/.test(r[5])));
    // Chặn máy giữ dữ liệu cũ
    const t0 = w.now();
    w.tick(1000);
    const st1 = w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', lat: 1, clientEpochSeen: 0 });
    ok('máy tải trước khôi phục ghi → stale', st1.status === 'stale', st1);
    ok('app cũ không gửi clientEpochSeen → stale', w.post({ action: 'delete_row', sheet: 'Quan1', id: 'Q1_1' }).status === 'stale');
    { const rr = w.post({ action: 'full_update', sheet: 'DanhSachTru', id: 'TQ_001', tenTru: 'A' }); ok('tab khác không bị chặn', rr.status === 'ok', rr); }
    ok('stale trả mốc + giờ server', st1.restoredAt === rs.restoredAt && st1.serverNow >= st1.restoredAt);
    ok('máy đã thấy mốc khôi phục → ghi được', w.post({ action: 'full_update', sheet: 'Quan1', id: 'Q1_1', tenTru: 'P1', clientEpochSeen: rs.restoredAt }).status === 'ok');
    ok('khôi phục trả serverNow', rs.serverNow >= rs.restoredAt);
    // Khôi phục tab file ngoài: ghi đúng file ngoài, KHÔNG rơi về DanhSachTru
    const ext = w.sheets.EXT.getSheetByName('CanGiuoc');
    ext.set(2, 2, 'HỎNG');
    const dsBefore = JSON.stringify(w.active.getSheetByName('DanhSachTru').data);
    const re = w.post({ action: 'restore_backup_sheet', backupId: bkExt, tab: 'CanGiuoc', confirm: 'CanGiuoc', reason: 'sửa nhầm', ...ADM });
    ok('khôi phục CanGiuoc: ghi vào file ngoài', re.status === 'ok' && ext.data[1][1] === 'C1', re);
    ok('khôi phục CanGiuoc: DanhSachTru không bị đụng', JSON.stringify(w.active.getSheetByName('DanhSachTru').data) === dsBefore);
    // File ngoài không mở được → lỗi, không ghi nhầm
    w.files.EXT.failOpen = true;
    ok('file ngoài không mở được → lỗi rõ', w.post({ action: 'restore_backup_sheet', backupId: bkExt, tab: 'CanGiuoc', confirm: 'CanGiuoc', reason: 'sửa nhầm', ...ADM }).status === 'error');
    w.files.EXT.failOpen = false;
    // Lỗi giữa chừng → trả lại dữ liệu cũ
    q1.set(2, 2, 'ĐANG SỬA');
    const tmpFail = w.ctx.SpreadsheetApp; // gắn cờ lỗi lên tab tạm qua copyTo của Sheet
    const origCopyTo = Object.getPrototypeOf(q1).copyTo;
    Object.getPrototypeOf(q1).copyTo = function (ss) { const s = origCopyTo.call(this, ss); if (this.ss !== ss || this.name !== 'Quan1' || ss.id === 'MAIN' && this.ss.id !== 'MAIN') s.failCopy = true; return s; };
    const rf = w.post({ action: 'restore_backup_sheet', backupId: bkMain, tab: 'Quan1', confirm: 'Quan1', reason: 'thử lỗi', ...ADM });
    Object.getPrototypeOf(q1).copyTo = origCopyTo;
    ok('lỗi khi chép → báo lỗi, dữ liệu tab giữ như trước', rf.status === 'error' && /đã trả lại dữ liệu cũ/.test(rf.message) && q1.data[1][1] === 'ĐANG SỬA', rf);
    // Bản sao thiếu tab
    delete w.sheets[bkMain].sheets.splice(w.sheets[bkMain].sheets.findIndex(s => s.name === 'Quan1'), 1);
    ok('bản sao không có tab → từ chối', w.post({ action: 'restore_preview', backupId: bkMain, tab: 'Quan1', ...ADM }).status === 'error');
    // File không phải bản sao của app
    ok('id file lạ → từ chối', w.post({ action: 'restore_preview', backupId: 'MAIN', tab: 'Quan1', ...ADM }).status === 'error');
}

// ── 7. Thư mục backup: lỗi Drive tạm thời không được tạo thư mục mới ─
{
    const w = makeWorld({ mainTabs: mainTabs() });
    w.post({ action: 'backup_now', ...ADM });
    const fid = w.props.BACKUP_FOLDER_ID;
    const orig = w.ctx.DriveApp.getFolderById;
    w.ctx.DriveApp.getFolderById = () => { throw new Error('Service error: Drive'); };
    w.tick(6 * 60e3);
    const r = w.post({ action: 'backup_now', ...ADM });
    ok('lỗi Drive tạm thời → báo lỗi, giữ nguyên ID thư mục', r.status === 'error' && w.props.BACKUP_FOLDER_ID === fid, r);
    w.ctx.DriveApp.getFolderById = () => { throw new Error('No item with the given ID could be found'); };
    w.tick(6 * 60e3);
    w.post({ action: 'backup_now', ...ADM });
    ok('thư mục thật sự mất → tạo mới', w.props.BACKUP_FOLDER_ID !== fid);
    ok('tạo lại thư mục → báo email + LichSu', w.mails.some(m => /tạo lại thư mục/.test(m[1])) && w.active.getSheetByName('LichSu').data.some(r => r[2] === 'backup_folder_new'));
    w.ctx.DriveApp.getFolderById = orig;
}
// ── 8. Tab chụp _TruocKP_ giữ 3 bản mới nhất; cờ đang khôi phục được xoá ─
{
    const w = makeWorld({ mainTabs: mainTabs() });
    w.post({ action: 'backup_now', ...ADM });
    const bk = Object.values(w.files).find(f => f.desc).id;
    for (let i = 0; i < 5; i++) {
        w.tick(61e3);
        const r = w.post({ action: 'restore_backup_sheet', backupId: bk, tab: 'Quan1', confirm: 'Quan1', reason: 'thử ' + i, ...ADM });
        if (r.status !== 'ok') { ok('khôi phục lần ' + i, false, r); break; }
    }
    ok('5 lần khôi phục → còn 3 tab _TruocKP_Quan1_', w.active.sheets.filter(s => s.name.startsWith('_TruocKP_Quan1_')).length === 3);
    ok('cờ đang khôi phục đã xoá sau khi xong', !w.props.BK_RESTORE_INPROGRESS);
    w.props.BK_RESTORE_INPROGRESS = JSON.stringify({ tab: 'Quan1', snapTab: '_TruocKP_x', at: 'x' });
    ok('list_backups báo lần khôi phục dang dở', w.post({ action: 'list_backups', ...ADM }).restoreInProgress.tab === 'Quan1');
}
// ── 9. Danh sách lệnh ghi GAS và app khớp nhau ─
{
    const cli = fs.readFileSync(path.join(ROOT, 'src/features/backup.js'), 'utf8').match(/_BK_WRITE_ACTIONS = (\[[^\]]*\])/)[1];
    const gasL = SRC.match(/var _bkWriteActions = (\[[^\]]*\])/)[1];
    const norm = t => JSON.stringify(eval(t).slice().sort());
    ok('_bkWriteActions GAS = app', norm(cli) === norm(gasL));
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
