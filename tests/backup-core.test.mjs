// Sao lưu dữ liệu (v210) — test lõi thuần trong gas-khaosat.js (khối @@BACKUP_PURE)
// Chạy: node tests/backup-core.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gas = fs.readFileSync(path.join(ROOT, 'gas-khaosat.js'), 'utf8');
const m = gas.match(/\/\/ @@BACKUP_PURE_START([\s\S]*?)\/\/ @@BACKUP_PURE_END/);
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name); } }
if (!m) { console.log('✗ không tìm thấy khối @@BACKUP_PURE trong gas-khaosat.js'); process.exit(1); }

const ctx = { norm: s => String(s || '').normalize('NFC').trim().toLowerCase(), JSON, Date, Math, Object, Array, String, Number, isFinite, parseInt };
vm.createContext(ctx);
vm.runInContext(m[1], ctx);
const C = ctx;
const DAY = 86400000;
const HDR = ['ID', 'Tên trụ', 'Lat', 'Lon', 'Ghi chú'];

// ── Tên & meta ───────────────────────────────────────────
ok('tên tự động', C._bkName('Khảo sát', '2026-11-04 01-05', 'auto', '') === 'Khảo sát — backup 2026-11-04 01-05 (tự động)');
ok('tên tay', C._bkName('KS', '2026-11-04 10-00', 'manual', 'admin') === 'KS — backup 2026-11-04 10-00 (tay: admin)');
ok('tên trước khôi phục', /\(trước khôi phục: lam\)$/.test(C._bkName('KS', 's', 'pre_restore', 'lam')));
ok('tên trước nhập', /\(trước nhập: hung\)$/.test(C._bkName('KS', 's', 'pre_import', 'hung')));
const meta = C._bkMeta({ src: 'ABC', kind: 'auto', by: '', at: '2026-11-04T01:05:00Z', rows: { Quan1: 10 } });
const pm = C._bkParseMeta(meta);
ok('meta vòng tròn', pm && pm.src === 'ABC' && pm.kind === 'auto' && pm.v === 1 && pm.rows.Quan1 === 10);
ok('meta hỏng → null', C._bkParseMeta('{oops') === null);
ok('meta rỗng → null', C._bkParseMeta('') === null && C._bkParseMeta(null) === null);
ok('meta app khác → null', C._bkParseMeta(JSON.stringify({ app: 'khac', v: 1, src: 'A', kind: 'auto' })) === null);
ok('meta kind lạ → null', C._bkParseMeta(JSON.stringify({ app: 'lighting-survey-backup', v: 1, src: 'A', kind: 'xx' })) === null);

// ── Giữ bản / bỏ Thùng rác ─────────────────────────────────
const now = Date.UTC(2026, 10, 4, 0, 0);
const autos = [];
for (let i = 0; i < 400; i++) autos.push({ id: 'a' + i, src: 'S', kind: 'auto', atMs: now - i * DAY });
const trash = C._bkPickToTrash(autos);
const kept = autos.filter(x => !trash.includes(x.id));
ok('tự động: 30 ngày gần nhất giữ hết', autos.slice(0, 30).every(x => !trash.includes(x.id)));
ok('tự động: giữ không quá 30+8+12', kept.length <= 50 && kept.length >= 40);
ok('tự động: bản cũ ~11 tháng vẫn còn 1 bản', kept.some(x => now - x.atMs > 300 * DAY));
ok('tự động: bản 400 ngày bị bỏ', trash.includes('a399'));
const old = kept.filter(x => now - x.atMs > 100 * DAY);
const oldMonths = new Set(old.map(x => new Date(x.atMs + 7 * 3600e3).toISOString().slice(0, 7)));
ok('tự động: bản cũ >100 ngày chỉ 1 bản mỗi tháng', old.length === oldMonths.size && old.length >= 6);
const mans = []; for (let i = 0; i < 25; i++) mans.push({ id: 'm' + i, src: 'S', kind: 'manual', atMs: now - i * 3600e3 });
const pres = []; for (let i = 0; i < 5; i++) pres.push({ id: 'p' + i, src: 'S', kind: 'pre_restore', atMs: now - i });
const t2 = C._bkPickToTrash(mans.concat(pres));
ok('tay: giữ 20 mới nhất, bỏ 5', t2.length === 5 && ['m20', 'm21', 'm22', 'm23', 'm24'].every(id => t2.includes(id)));
ok('nhóm trước khôi phục tách riêng, không đẩy bản tay', !t2.some(id => id.startsWith('p')));
const two = [{ id: 'x1', src: 'A', kind: 'manual', atMs: 1 }];
for (let i = 0; i < 21; i++) two.push({ id: 'y' + i, src: 'B', kind: 'manual', atMs: 100 + i });
const t3 = C._bkPickToTrash(two);
ok('đếm theo từng nguồn', !t3.includes('x1') && t3.length === 1 && t3[0] === 'y0');
ok('danh sách rỗng', C._bkPickToTrash([]).length === 0);

// ── Chống bấm liên tục ─────────────────────────────────────
ok('<5 phút → quá sớm', C._bkTooSoon(now - 60e3, now, 5 * 60e3) === true);
ok('>5 phút → được', C._bkTooSoon(now - 6 * 60e3, now, 5 * 60e3) === false);
ok('chưa từng → được', C._bkTooSoon(0, now, 5 * 60e3) === false && C._bkTooSoon(NaN, now, 5 * 60e3) === false);

// ── Kiểm điều kiện khôi phục ───────────────────────────────
const base = { tab: 'Quan1', confirm: 'Quan1', reason: 'nhập CSV sai', backupHeader: HDR, currentHeader: HDR.concat(['Pha']), metaSrc: 'S', targetSrc: 'S' };
ok('hợp lệ', C._bkValidateRestore(base).ok === true);
ok('gõ sai tên', C._bkValidateRestore({ ...base, confirm: 'quan1' }).ok === false);
ok('gõ có khoảng trắng vẫn nhận', C._bkValidateRestore({ ...base, confirm: ' Quan1 ' }).ok === true);
ok('thiếu lý do', C._bkValidateRestore({ ...base, reason: '  ' }).ok === false);
ok('bản sao của file khác', C._bkValidateRestore({ ...base, metaSrc: 'X' }).ok === false);
ok('tab hệ thống TaiKhoan', C._bkValidateRestore({ ...base, tab: 'TaiKhoan', confirm: 'TaiKhoan' }).ok === false);
ok('tab ẩn _', C._bkValidateRestore({ ...base, tab: '_TruocKP_x', confirm: '_TruocKP_x' }).ok === false);
ok('tab hiện tại không có "Tên trụ"', C._bkValidateRestore({ ...base, currentHeader: ['A', 'B'] }).ok === false);
ok('bản sao thiếu cột lõi Lon', C._bkValidateRestore({ ...base, backupHeader: ['ID', 'Tên trụ', 'Lat'] }).ok === false);
ok('bản sao khác thứ tự cột', C._bkValidateRestore({ ...base, backupHeader: ['Tên trụ', 'ID', 'Lat', 'Lon'] }).ok === false);
ok('bản sao nhiều cột hơn hiện tại', C._bkValidateRestore({ ...base, currentHeader: HDR.slice(0, 4) }).ok === false);
ok('header khác dấu/hoa (norm) vẫn khớp', C._bkValidateRestore({ ...base, backupHeader: ['id', 'TÊN TRỤ', 'lat', 'Lon', ' Ghi chú '] }).ok === true);
ok('cột rỗng cuối bản sao bỏ qua', C._bkValidateRestore({ ...base, backupHeader: HDR.concat(['', '']) }).ok === true);

// ── Chặn máy giữ dữ liệu cũ (so giờ server với giờ server) ──
const ep = now - DAY;
ok('không có mốc → cho ghi', C._bkIsStale(0, 0, now) === false);
ok('máy chưa thấy mốc → chặn', C._bkIsStale(ep, 0, now) === true);
ok('máy thấy mốc cũ hơn (lần khôi phục trước) → chặn', C._bkIsStale(ep, ep - 1, now) === true);
ok('máy đã thấy đúng mốc → cho', C._bkIsStale(ep, ep, now) === false);
ok('app cũ không gửi → chặn', C._bkIsStale(ep, undefined, now) === true);
ok('mốc quá 30 ngày → bỏ qua', C._bkIsStale(now - 31 * DAY, 0, now) === false);
ok('danh sách action ghi có full_update/batch_match_update', C._bkWriteActions.includes('full_update') && C._bkWriteActions.includes('batch_match_update') && !C._bkWriteActions.includes('login'));

// ── Thời gian cập nhật & xem trước ────────────────────────
const vnMs = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 7, mi);
ok('parse "16:29:05 4/11/2026"', C._bkParseTs('16:29:05 4/11/2026') === vnMs(2026, 11, 4, 16, 29) + 5000);
ok('parse "4/11/2026 16:29:05"', C._bkParseTs('4/11/2026 16:29:05') === vnMs(2026, 11, 4, 16, 29) + 5000);
ok('parse ISO', C._bkParseTs('2026-11-04T09:29:05.000Z') === Date.UTC(2026, 10, 4, 9, 29, 5));
ok('parse Date', C._bkParseTs(new Date(5000)) === 5000);
ok('rác → NaN', isNaN(C._bkParseTs('abc')) && isNaN(C._bkParseTs('')));
const bAt = vnMs(2026, 11, 3, 1, 0);
const cur = [HDR, ['Q1_1', 'A1', '', '', ''], ['Q1_2', 'A2', '', '', ''], ['', 'A3', '', '', ''], ['Q1_9', 'A9', '', '', '']];
cur.forEach((r, i) => { if (i) r.push(i === 2 ? '10:00:00 3/11/2026' : '00:30:00 3/11/2026'); });
cur[0] = HDR.concat(['Thời gian cập nhật']);
const bak = [HDR, ['Q1_1', 'A1'], ['Q1_2', 'A2'], ['', 'A3'], ['Q1_5', 'A5']];
const pv = C._bkPreviewCounts(cur, bak, bAt);
ok('xem trước: số dòng', pv.current === 4 && pv.backup === 4);
ok('xem trước: chỉ có ở hiện tại (Q1_9)', pv.onlyCurrent === 1);
ok('xem trước: chỉ có ở bản sao (Q1_5)', pv.onlyBackup === 1);
ok('xem trước: sửa sau giờ sao lưu (Q1_2)', pv.changedAfter === 1);
ok('xem trước: không có cột thời gian → 0', C._bkPreviewCounts([HDR, ['a', 'b']], [HDR], bAt).changedAfter === 0);
ok('xem trước: bỏ dòng trống', C._bkPreviewCounts([HDR, ['', '']], [HDR, ['', '']], bAt).current === 0);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
