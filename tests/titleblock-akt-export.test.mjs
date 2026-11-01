// Mẫu A.K.T trong bộ xuất CAD (_generateCadDrawing + sơ đồ nguyên lý + bình đồ + chia tờ + tự xoay).
// Run: node tests/titleblock-akt-export.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sb = loadAppSandbox();
ok('sandbox nạp app (có cad-titleblock-akt.js) không lỗi', sb.errors.length === 0, sb.errors.slice(0, 3));

const row = (o) => { const r = new Array(31).fill(''); for (const k in o) r[k] = String(o[k]); return r; };
const mk = (vert) => {
    const d = [new Array(31).fill('h'), row({ 0: 'T1', 1: 'NK-01', 2: 10.75, 3: 106.63, 6: 5, 7: 'NK-01', 17: 'Nguyễn Khuyến', 18: 'Phường Tân Hiệp' })];
    for (let i = 1; i <= 12; i++) d.push(row({ 0: 'P' + i, 1: 'NK_' + i, 2: 10.75 + (vert ? i * 0.0003 : (i % 2) * 0.00004), 3: 106.63 + (vert ? (i % 2) * 0.00004 : i * 0.0003),
        6: i % 3 ? 1 : 3, 7: 'NK-01', 10: i % 4 ? 'LED' : 'HPS', 14: i === 1 ? 'NK-01' : 'NK_' + (i - 1), 15: '33', 17: 'Nguyễn Khuyến', 18: 'Phường Tân Hiệp' }));
    return d;
};
const setData = d => { sb.ctx.__rows = d; sb.run('loadedData = __rows;'); };
const opts = (extra) => Object.assign({ templateId: 'akt', metadata: { AKT_NAM: '2026' }, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
    outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75, realBlocks: true }, extra || {});
function parse(dxf) {
    const L = dxf.split('\r\n'), P = [];
    for (let i = 0; i + 1 < L.length; i += 2) P.push([L[i].trim(), L[i + 1]]);
    const ents = [], blocks = new Map();
    let blk = null, sec = null;
    for (let i = 0; i < P.length; i++) {
        if (P[i][0] !== '0') continue;
        const e = { t: P[i][1], g: {} };
        for (let j = i + 1; j < P.length && P[j][0] !== '0'; j++) (e.g[P[j][0]] = e.g[P[j][0]] || []).push(P[j][1]);
        if (e.t === 'SECTION') { sec = e.g['2'][0]; continue; }
        if (e.t === 'BLOCK') { blk = e.g['2'][0]; blocks.set(blk, []); continue; }
        if (e.t === 'ENDBLK') { blk = null; continue; }
        if (blk) blocks.get(blk).push(e); else if (sec === 'ENTITIES') ents.push(e);
    }
    return { ents, blocks };
}
const n = (e, c) => parseFloat(e.g[c][0]);
const dec = s => String(s).replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const txt = e => dec(e.g['1'][0]);
const near = (a, b, t) => Math.abs(a - b) <= (t || 0.01);
// Khung: các LINE ngang/dọc dài nhất ở ENTITIES = viền ngoài, kế tiếp = khung trong
function frames(p) {
    const H = p.ents.filter(e => e.t === 'LINE' && near(n(e, '20'), n(e, '21'), 1e-6)).map(e => ({ y: n(e, '20'), x1: Math.min(n(e, '10'), n(e, '11')), x2: Math.max(n(e, '10'), n(e, '11')) }));
    const len = Math.max(...H.map(h => h.x2 - h.x1));
    const outerH = H.filter(h => near(h.x2 - h.x1, len, 1e-3));
    const rest = H.filter(h => !near(h.x2 - h.x1, len, 1e-3));
    const len2 = Math.max(...rest.map(h => h.x2 - h.x1));
    const innerH = rest.filter(h => near(h.x2 - h.x1, len2, 1e-3));
    const box = hs => ({ minX: hs[0].x1, maxX: hs[0].x2, minY: Math.min(...hs.map(h => h.y)), maxY: Math.max(...hs.map(h => h.y)) });
    return { outer: box(outerH), inner: box(innerH) };
}

// ── 1. Tự co giãn (mặc định) ──
setData(mk(false));
const o1 = opts();
const p1 = parse(await sb.ctx._generateCadDrawing(o1));
const fr = frames(p1);
const iw = fr.inner.maxX - fr.inner.minX, ih = fr.inner.maxY - fr.inner.minY, kk = iw / 397.93;
ok('tự co giãn: khung trong đúng tỉ lệ 397,93 : 281,36', near(iw / ih, 397.93 / 281.36, 1e-4), { iw, ih });
ok('tự co giãn: lề giấy A.K.T × kk (trái 16,61 · phải 5,46 · trên 6,93 · dưới 8,71)',
    near(fr.inner.minX - fr.outer.minX, 16.61 * kk, 1e-3) && near(fr.outer.maxX - fr.inner.maxX, 5.46 * kk, 1e-3)
    && near(fr.outer.maxY - fr.inner.maxY, 6.93 * kk, 1e-3) && near(fr.inner.minY - fr.outer.minY, 8.71 * kk, 1e-3));
const tb = p1.blocks.get('TITLE_AKT');
ok('khung tên = block TITLE_AKT, INSERT tại góc dưới-trái khung trong', tb && p1.ents.some(e => e.t === 'INSERT' && e.g['2'][0] === 'TITLE_AKT'
    && near(n(e, '10'), fr.inner.minX, 1e-3) && near(n(e, '20'), fr.inner.minY, 1e-3)));
ok('không còn block khung QBT', !p1.blocks.has('TITLE_KNOP12'));
const tbT = (tb || []).filter(e => e.t === 'TEXT').map(txt);
ok('tên bản vẽ tự điền theo dữ liệu (đường / tủ / phường)', ['BẢN VẼ MẶT BẰNG ĐƯỜNG NGUYỄN KHUYẾN', 'TỦ ĐIỀU KHIỂN NK-01', 'PHƯỜNG TÂN HIỆP'].every(s => tbT.includes(s)), tbT.filter(s => /BẢN VẼ|TỦ|PHƯỜNG/.test(s)));
ok('tỷ lệ ghi đúng tỷ lệ in A3 = 1/(kk·1000)', tbT.includes('Tỷ lệ : 1/' + Math.round(kk * 1000)), { kk, t: tbT.filter(s => /Tỷ lệ/.test(s)) });
ok('ký hiệu 1 tờ: CS1-04-01, tổng số 01, năm 2026', tbT.includes('CS1-04-01') && tbT.includes('Tổng số bản vẽ : 01') && tbT.includes('Năm thực hiện : 2026'));
ok('logo A.K.T tô đặc (SOLID) trong block', (tb || []).filter(e => e.t === 'SOLID').length > 100);
const top = p1.ents.filter(e => e.t === 'TEXT').map(e => ({ s: txt(e), y: n(e, '20'), h: n(e, '40') }));
const hd = top.find(t => t.s === 'BẢN VẼ MẶT BẰNG BỐ TRÍ ĐÈN CHIẾU SÁNG');
ok('tiêu đề đầu tờ ở đỉnh khung trong (cách 3,66·kk)', hd && near(hd.y + hd.h, fr.inner.maxY - 3.66 * kk, 1e-3), hd);
const gc = top.filter(t => /^: /.test(t.s)).map(t => t.s);
ok('ô GHI CHÚ: liệt kê ký hiệu có trong tờ', ['GHI CHÚ:', ': Đèn LED', ': Đèn HPS', ': Trụ STK', ': Trụ BTLT', ': Tủ điều khiển thường'].every(s => top.some(t => t.s.replace('%%u', '') === s)), gc);
const q = top.map(t => t.s);
ok('ô GHI CHÚ: số lượng đúng (LED 9 · HPS 3 · STK 8 · BTLT 4 · tủ 1)', ['9 bộ', '3 bộ', '8 trụ', '4 trụ', '1 tủ'].every(s => q.includes(s)), q.filter(s => /bộ|trụ|tủ|m$/.test(s)));
ok('không có bảng 13 dòng QBT / thước tỉ lệ / CHÚ THÍCH ngoài khung', !q.includes('Tên ký hiệu') && !q.some(s => /^Tỉ lệ 1:/.test(s)) && !q.includes('CHÚ THÍCH'));
const marks = p1.ents.filter(e => e.t === 'INSERT' && /^CS_/.test((e.g['8'] || [''])[0]));
ok('trụ/tủ nằm trong khung trong, trên khung tên', marks.length === 13 && marks.every(e => n(e, '10') > fr.inner.minX && n(e, '10') < fr.inner.maxX && n(e, '20') > fr.inner.minY + 41.83 * kk));

// ── 2. A3 chuẩn ──
const o2 = opts({ frameMode: 'a3-standard' });
const p2 = parse(await sb.ctx._generateCadDrawing(o2));
const f2 = frames(p2);
ok('A3 chuẩn: khung trong 397,93 × 281,36, giấy 420 × 297', near(f2.inner.maxX - f2.inner.minX, 397.93, 1e-3) && near(f2.inner.maxY - f2.inner.minY, 281.36, 1e-3)
    && near(f2.outer.maxX - f2.outer.minX, 420, 1e-2) && near(f2.outer.maxY - f2.outer.minY, 297, 1e-2), f2);
ok('A3 chuẩn: tỷ lệ 1/1000', (p2.blocks.get('TITLE_AKT') || []).some(e => e.t === 'TEXT' && txt(e) === 'Tỷ lệ : 1/1000'));

// ── 3. Chia tờ ──
const p3 = parse(await sb.ctx._generateCadDrawing(opts({ _sheetIdx: 2, _sheetTotal: 3 })));
const t3 = (p3.blocks.get('TITLE_AKT') || []).filter(e => e.t === 'TEXT').map(txt);
ok('chia tờ 2/3: ký hiệu CS1-04-02, tổng số 03', t3.includes('CS1-04-02') && t3.includes('Tổng số bản vẽ : 03'), t3.filter(s => /CS1|Tổng/.test(s)));
const parts = sb.ctx._computeSheetPartitions({ minX: 0, minY: 0, maxX: 2000, maxY: 300 }, 1000, 'a3', 0.1, 'akt');
const partsQ = sb.ctx._computeSheetPartitions({ minX: 0, minY: 0, maxX: 2000, maxY: 300 }, 1000, 'a3', 0.1, 'knop12');
ok('chia tờ: vùng vẽ theo khổ A.K.T (rộng 397,93 − 50 = 347,93 m)', parts.length > 0 && near(parts[0].bounds ? parts[0].bounds.maxX - parts[0].bounds.minX : (parts[0].maxX - parts[0].minX), 347.93, 0.05) && partsQ.length > 0,
    parts[0]);

// ── 4. Tự xoay ──
setData(mk(true));
const o4 = opts({ autoRotate: true });
await sb.ctx._generateCadDrawing(o4);
ok('tự xoay dùng được với mẫu A.K.T (tuyến dọc → ±90°)', Math.abs(o4.__rotDeg) === 90, o4.__rotDeg);

// ── 5. Sơ đồ nguyên lý + bình đồ ──
setData(mk(false));
for (const [fn, title] of [['_generateSingleLineDrawing', 'SƠ ĐỒ NGUYÊN LÝ HỆ THỐNG CHIẾU SÁNG'], ['_generateOverviewDrawing', 'BÌNH ĐỒ TỔNG THỂ HỆ THỐNG CHIẾU SÁNG']]) {
    let err = null, p = null;
    try { p = parse(await sb.ctx[fn](opts())); } catch (e) { err = e.message; }
    const ts = p ? p.ents.filter(e => e.t === 'TEXT').map(txt) : [];
    ok(fn + ': có khung tên A.K.T + tiêu đề "' + title + '"', !err && ts.includes(title) && ts.includes('ĐƠN VỊ THIẾT KẾ') && p.ents.some(e => e.t === 'SOLID'), err || ts.slice(0, 5));
    ok(fn + ': ô "Tên bản vẽ" tự điền tên loại bản vẽ (không để trống)', !err && ts.filter(s => s === title).length >= 2, ts.filter(s => s === title).length);
}

// ── 6. Giao diện / cấu hình ──
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
ok('modal: có lựa chọn mẫu "🏢 A.K.T – Thay LED"', /<option value="akt">🏢 A\.K\.T – Thay LED<\/option>/.test(html));
sb.run('__tplAkt = TITLE_TEMPLATES.akt;'); const tpl = sb.ctx.__tplAkt;
const keys = tpl ? tpl.fields.map(f => f.key) : [];
ok('form mẫu A.K.T: đủ ô sửa được', ['AKT_CONG_TRINH', 'AKT_DV_TEN', 'AKT_DV_DIA_CHI', 'AKT_PGD', 'AKT_CHU_TRI', 'AKT_THIET_KE', 'AKT_KIEM', 'AKT_TEN_BV', 'AKT_GIAI_DOAN', 'AKT_TY_LE', 'AKT_DIA_DIEM', 'AKT_KY_HIEU', 'AKT_TONG_SO', 'AKT_NAM', 'AKT_TIEU_DE'].every(k => keys.includes(k)), keys);
const def = k => { const f = tpl.fields.find(x => x.key === k); return typeof f.default === 'function' ? f.default() : f.default; };
ok('form mẫu A.K.T: mặc định = tờ mẫu', def('AKT_PGD') === 'NGUYỄN HUY HÙNG' && def('AKT_KY_HIEU') === 'CS1-04-XX' && def('AKT_NAM') === String(new Date().getFullYear()));
const cad = fs.readFileSync(path.join(REPO, 'src/features/cad-export.js'), 'utf8');
ok('xuất hàng loạt theo tủ: tên bản vẽ A.K.T tự điền lại từng tủ, ký hiệu XX = số thứ tự tủ, tổng số = số tủ',
    /baseOpts\.templateId === 'akt' \? \{\s*AKT_TEN_BV: '',/.test(cad) && /\.replace\(\/XX\/g, String\(i \+ 1\)\.padStart\(2, '0'\)\)/.test(cad) && /String\(allTus\.length\)\.padStart\(2, '0'\)/.test(cad));

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
