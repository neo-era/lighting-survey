// Mô hình Google (Sheet/Drive/Properties/Cache/Utilities) chạy nguyên gas-khaosat.js — dùng chung cho các test GAS
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'gas-khaosat.js'), 'utf8');

export function makeWorld(opts = {}) {
    let seq = 0, clock = opts.now || Date.UTC(2026, 10, 4, 3, 0);
    const files = {}, folders = {}, props = Object.assign({}, opts.props || {}), triggers = [], mails = [], cache = {};
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
        deleteRow(r) { this.data.splice(r - 1, 1); }
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
        PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, getProperties: () => Object.assign({}, props), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
        CacheService: { getScriptCache: () => ({ get: k => { const e = cache[k]; return e && e.exp > clock ? e.v : null; }, put: (k, v, sec) => { cache[k] = { v: String(v), exp: clock + (sec || 600) * 1000 }; }, remove: k => { delete cache[k]; } }) },
        LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
        Utilities: { getUuid: () => crypto.randomUUID(), Charset: { UTF_8: 'utf8' },
            base64EncodeWebSafe: (x) => Buffer.from(typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map(b => b & 255))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
            base64DecodeWebSafe: s => [...Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
            computeHmacSha256Signature: (v, k) => [...crypto.createHmac('sha256', k).update(v).digest()],
            computeDigest: (a, v) => [...crypto.createHash('sha256').update(String(v)).digest()], DigestAlgorithm: { SHA_256: 'sha256' },
            base64Encode: b => Buffer.from(b.map(x => x & 255)).toString('base64'),
            newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
            formatDate: (d, tz, f) => { const x = new Date(d.getTime() + 7 * 3600e3); const p = n => String(n).padStart(2, '0'); return f.replace('yyyy', x.getUTCFullYear()).replace('MM', p(x.getUTCMonth() + 1)).replace('dd', p(x.getUTCDate())).replace('HH', p(x.getUTCHours())).replace('mm', p(x.getUTCMinutes())); } },
        Session: { getEffectiveUser: () => ({ getEmail: () => ME }) },
        ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
            newTrigger: h => { const b = { tz: null, hour: null, timeBased() { return b; }, atHour(x) { b.hour = x; return b; }, everyDays() { return b; }, inTimezone(z) { b.tz = z; return b; }, create() { const t = { getHandlerFunction: () => h, hour: b.hour, tz: b.tz }; triggers.push(t); return t; } }; return b; } },
        GmailApp: { sendEmail: (...a) => mails.push(a) },
        MailApp: { sendEmail: (...a) => mails.push(a) },
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    if (opts.stubAuth !== false) vm.runInContext(`_authorize = function(){ return null; };`, ctx);
    // admin luôn hợp lệ trong test (đã có test riêng cho _requireAdmin)
    if (opts.stubAuth !== false) vm.runInContext(`_requireAdmin = function(d){ return (d.adminAuth && d.adminAuth.password==='ok') ? {ok:true, adminUser:'admin'} : {ok:false, error:'Password admin sai'}; };`, ctx);
    if (opts.ext !== false && opts.extTabs) vm.runInContext(`EXTERNAL_SPREADSHEET_IDS.CanGiuoc = 'EXT';`, ctx);
    else vm.runInContext(`delete EXTERNAL_SPREADSHEET_IDS.CanGiuoc;`, ctx);
    const post = d => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(d) } }).s);
    return { ctx, files, folders, props, triggers, mails, sheets, active, post, tick: ms => { clock += ms; }, now: () => clock };
}
