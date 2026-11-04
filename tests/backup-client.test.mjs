// Sao lưu dữ liệu (v210) — test phía app: gắn clientLoadedAt, phát hiện stale, sao lưu trước thao tác hàng loạt
// Chạy: node tests/backup-client.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src/features/backup.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function load(reply) {
    const sent = [], confirms = [], infos = [], errs = [];
    const fakeFetch = async (url, init) => {
        sent.push({ url, body: init && init.body });
        const j = typeof reply === 'function' ? reply(JSON.parse(init.body)) : reply;
        if (j instanceof Error) throw j;
        const txt = JSON.stringify(j);
        const res = { json: async () => JSON.parse(txt), clone: () => res };
        return res;
    };
    const window = { fetch: fakeFetch };
    const ctx = {
        window, console, JSON, Date, Object, Array, String, Number, Math, Promise,
        KHAOSAT_GAS_URL: 'https://gas', currentSheet: 'Quan1', currentUser: { username: 'hung' },
        confirm: m => { confirms.push(m); return ctx._confirmAnswer; }, _confirmAnswer: true,
        displayInfo: m => infos.push(m), displayError: m => errs.push(m),
        _idbSet: async () => {}, dirtyMovedRows: new Set([1]), updateDirtyMovedBadge() {},
        switchDistrict: async () => { ctx._reloaded = true; }, document: { getElementById: () => null },
        localStorage: (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })(),
        _timers: [], clearTimeout() {},
    };
    ctx.fetch = (...a) => window.fetch(...a);
    ctx.setTimeout = (fn, ms) => { ctx._timers.push({ fn, ms }); return 1; };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { ctx, window, sent, confirms, infos, errs };
}

{
    const { ctx } = load({ status: 'ok' });
    ctx._bkMarkSeen('Quan1', 12345);
    const r = ctx._bkAttachEpoch(JSON.stringify({ action: 'full_update', sheet: 'Quan1' }));
    ok('lệnh ghi được gắn clientEpochSeen của tab', r.write && JSON.parse(r.body).clientEpochSeen === 12345);
    ctx._bkMarkSeen('Quan1', 100);
    ok('không lùi mốc đã thấy', ctx._bkSeenAll().Quan1 === 12345);
    const r2 = ctx._bkAttachEpoch(JSON.stringify({ action: 'login' }));
    ok('lệnh không ghi không bị đổi', !r2.write && JSON.parse(r2.body).clientEpochSeen === undefined);
    ok('tab chưa có mốc → 0', JSON.parse(ctx._bkAttachEpoch(JSON.stringify({ action: 'delete_row', sheet: 'Quan9' })).body).clientEpochSeen === 0);
    ok('body không phải JSON → giữ nguyên', ctx._bkAttachEpoch('abc').body === 'abc' && ctx._bkAttachEpoch(null).write === false);
    ok('chờ dữ liệu công khai: tính theo giờ server', ctx._bkWaitMs(1000, 1000 + 60e3) === 5 * 60e3 && ctx._bkWaitMs(1000, 1000 + 7 * 60e3) === 0);
}
{
    const t = load({ status: 'ok' });
    t.ctx._bkMarkSeen('Quan1', 999);
    await t.window.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'batch_match_update', sheet: 'Quan1' }) });
    ok('fetch bọc: gửi kèm clientEpochSeen lên GAS', JSON.parse(t.sent[0].body).clientEpochSeen === 999);
    await t.window.fetch('https://other', { method: 'POST', body: JSON.stringify({ action: 'full_update' }) });
    ok('URL khác GAS không bị đụng', JSON.parse(t.sent[1].body).clientEpochSeen === undefined);
    ok('bọc 1 lần (đánh dấu)', t.window.fetch._bkWrapped === true);
}
{
    // Khôi phục đã lâu (> 6 phút theo giờ SERVER) — đồng hồ điện thoại lệch bao nhiêu cũng không ảnh hưởng
    const R = 5_000_000;
    for (const skew of [-10 * 60e3, -3 * 60e3, 10 * 60e3]) {
        const t = load({ status: 'stale', sheet: 'Quan1', restoredAt: R, serverNow: R + 20 * 60e3, message: 'đã khôi phục' });
        const realNow = Date.now; t.ctx.Date = class extends Date { static now() { return realNow() + skew; } };
        await t.window.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'full_update', sheet: 'Quan1' }) });
        await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
        ok(`stale (đồng hồ lệch ${skew / 60e3} phút) → tải lại + ghi nhận đúng mốc server`, t.ctx._reloaded === true && t.ctx._bkSeenAll().Quan1 === R);
        ok(`  lệnh ghi kế tiếp gửi mốc = restoredAt (lệch ${skew / 60e3}')`, JSON.parse(t.ctx._bkAttachEpoch(JSON.stringify({ action: 'full_update', sheet: 'Quan1' })).body).clientEpochSeen === R);
    }
    const t = load({ status: 'stale', sheet: 'Quan1', restoredAt: R, serverNow: R + 20 * 60e3 });
    await t.window.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'full_update', sheet: 'Quan1' }) });
    await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
    ok('stale → bỏ danh sách marker kéo chờ đẩy', t.ctx.dirtyMovedRows.size === 0);
}
{
    // Vừa khôi phục 1 phút (CSV publish chưa kịp) → KHÔNG tải lại ngay, KHÔNG ghi nhận mốc; hẹn ~5 phút
    const R = 9_000_000;
    const t = load({ status: 'stale', sheet: 'Quan1', restoredAt: R, serverNow: R + 60e3 });
    await t.window.fetch('https://gas', { method: 'POST', body: JSON.stringify({ action: 'full_update', sheet: 'Quan1' }) });
    await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
    ok('khôi phục 1 phút trước → chưa tải lại, chưa ghi nhận mốc', !t.ctx._reloaded && !t.ctx._bkSeenAll().Quan1 && t.confirms.length === 0);
    ok('hẹn tải lại sau ~5 phút + báo người dùng chờ', t.ctx._timers.length === 1 && t.ctx._timers[0].ms >= 5 * 60e3 && /khoảng 5 phút/.test(t.errs[0] || ''), t.errs);
    await t.ctx._timers[0].fn(); await new Promise(r => setImmediate(r));
    ok('hết hẹn → tải lại + ghi nhận mốc', t.ctx._reloaded === true && t.ctx._bkSeenAll().Quan1 === R);
}
{
    const t = load(d => d.action === 'backup_pre_import' ? { status: 'ok' } : { status: 'ok' });
    const r = await t.ctx._bkPreBatch('nhập CSV');
    const b = JSON.parse(t.sent[0].body);
    ok('sao lưu trước nhập: gửi đúng tab + người', r === true && b.action === 'backup_pre_import' && b.sheet === 'Quan1' && b.by === 'hung');
    ok('sao lưu thành công không hỏi', t.confirms.length === 0);
}
{
    const t = load({ status: 'error', message: 'hết quota' });
    t.ctx._confirmAnswer = false;
    ok('sao lưu lỗi + người dùng chọn không → dừng', (await t.ctx._bkPreBatch('nhập CSV')) === false && /hết quota/.test(t.confirms[0]));
    t.ctx._confirmAnswer = true;
    ok('sao lưu lỗi + người dùng chọn có → tiếp tục', (await t.ctx._bkPreBatch('nhập CSV')) === true);
}
{
    const t = load(new Error('Failed to fetch'));
    t.ctx._confirmAnswer = false;
    ok('mất mạng → hỏi, chọn không → dừng', (await t.ctx._bkPreBatch('gán pha')) === false && /Failed to fetch/.test(t.confirms[0]));
}
{
    const { ctx } = load({ status: 'ok' });
    ok('tuổi bản: chưa có → đỏ', ctx._bkAgeText('').bad === true);
    ok('tuổi bản: 10 giờ → bình thường', ctx._bkAgeText(new Date(Date.now() - 10 * 3600e3).toISOString()).bad === false);
    ok('tuổi bản: 40 giờ → đỏ', ctx._bkAgeText(new Date(Date.now() - 40 * 3600e3).toISOString()).bad === true);
    ok('tab khôi phục được: bỏ tab hệ thống và tab _', JSON.stringify(ctx._bkRestorableTabs({ rows: { Quan1: 3, TaiKhoan: 2, _TruocKP_Q: 1, LichSu: 5 } })) === '["Quan1"]');
    ok('escape HTML', ctx._bkEsc('<b>"x"&') === '&lt;b&gt;&quot;x&quot;&amp;');
}

// Mọi lối ghi hàng loạt đều gọi _bkPreBatch trước khi ghi
{
    const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const body = (src, fn) => { const i = src.search(new RegExp('function\\s+' + fn + '\\s*\\(')); return i < 0 ? '' : src.slice(i, i + 4000); };
    const sites = [['index.html', '_batchSyncRowsToGAS'], ['index.html', '_autoAssignPhases'], ['src/features/csv-import.js', '_confirmCsvImport'],
        ['src/features/data-tools.js', '_batchReverseGeocode'], ['src/features/data-tools.js', '_recalcAllCableDistances'],
        ['src/features/data-tools.js', '_confirmEditExcelUpdate'], ['src/features/mst-ui.js', '_mstApplyToData'], ['src/features/cable-check.js', '_lcXoaDelete']];
    for (const [f, fn] of sites) ok(`${fn} gọi _bkPreBatch`, /_bkPreBatch\(/.test(body(rd(f), fn)));
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
