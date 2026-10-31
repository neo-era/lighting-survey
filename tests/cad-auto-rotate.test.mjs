// v203 — Tự xoay bản vẽ cho vừa khung + địa chỉ tủ (Số nhà) trong khung tên QBT.
// Run: node tests/cad-auto-rotate.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const sb = loadAppSandbox();
ok('sandbox nạp app (có cad-rotate.js) không lỗi', sb.errors.length === 0, sb.errors.slice(0, 3));

const row = (o) => { const r = new Array(31).fill(''); for (const k in o) r[k] = String(o[k]); return r; };
// Tuyến DỌC ~470 m (An Dương Vương - 1): tủ ở đáy, 14 trụ đi lên phía Bắc
const VERT = [new Array(31).fill('h'), row({ 0: 'T1', 1: 'An Dương Vương - 1', 2: 10.7500, 3: 106.6300, 6: 5, 7: 'An Dương Vương - 1',
    17: 'An Dương Vương', 18: 'Phường 16', 30: '123' })];
for (let i = 1; i <= 14; i++) VERT.push(row({ 0: 'P' + i, 1: 'ADV_' + i, 2: 10.7500 + i * 0.0003, 3: 106.6300 + (i % 2) * 0.00004,
    6: 1, 7: 'An Dương Vương - 1', 10: 'LED', 14: i === 1 ? 'An Dương Vương - 1' : 'ADV_' + (i - 1), 15: '33', 17: 'An Dương Vương', 18: 'Phường 16' }));
// Tuyến NGANG
const HOR = [new Array(31).fill('h'), row({ 0: 'T1', 1: 'TU-N', 2: 10.75, 3: 106.63, 6: 5, 7: 'TU-N', 17: 'Đường X', 18: 'Phường 1' })];
for (let i = 1; i <= 14; i++) HOR.push(row({ 0: 'Q' + i, 1: 'Q' + i, 2: 10.75 + (i % 2) * 0.00004, 3: 106.63 + i * 0.0003, 6: 1, 7: 'TU-N', 10: 'LED', 14: i === 1 ? 'TU-N' : 'Q' + (i - 1) }));

const setData = d => { sb.ctx.__rows = d; sb.run('loadedData = __rows;'); };
const opts = (extra) => Object.assign({ templateId: 'knop12', metadata: { NGAY: '31/10/2026' }, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
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
        e.blk = blk; e.sec = sec;
        if (blk) blocks.get(blk).push(e); else if (sec === 'ENTITIES') ents.push(e);
    }
    return { ents, blocks };
}
const n = (e, c) => parseFloat(e.g[c][0]);
const dec = s => String(s).replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const txt = e => dec(e.g['1'][0]);
const marks = p => p.ents.filter(e => e.t === 'INSERT' && /^CS_/.test((e.g['8'] || [''])[0]));
const titleW = p => Math.max(...(p.blocks.get('TITLE_KNOP12') || []).filter(e => e.t === 'LINE').map(e => Math.max(n(e, '10'), n(e, '11'))));

// ── 1. Tắt (mặc định) → y hệt khi không truyền tuỳ chọn ──
setData(VERT);
const offA = await sb.ctx._generateCadDrawing(opts());
const oOff = opts({ autoRotate: false });
const offB = await sb.ctx._generateCadDrawing(oOff);
ok('tắt tự xoay → file giống hệt khi không có tuỳ chọn', offA === offB);
ok('tắt → góc xoay 0', oOff.__rotDeg === 0);

// ── 2. Bật, tuyến dọc → xoay ±90°, khung nhỏ đi ──
const oOn = opts({ autoRotate: true });
const on = await sb.ctx._generateCadDrawing(oOn);
if (process.env.ROT_DXF_OUT) { fs.writeFileSync(process.env.ROT_DXF_OUT + '/rot-on.dxf', on); fs.writeFileSync(process.env.ROT_DXF_OUT + '/rot-off.dxf', offA); }
ok('bật, tuyến dọc → xoay ±90°', Math.abs(oOn.__rotDeg) === 90, oOn.__rotDeg);
const pOff = parse(offA), pOn = parse(on);
ok('khung nhỏ lại (khung tên hẹp hơn = tờ nhỏ hơn → in A3 ra to hơn)', titleW(pOn) < titleW(pOff) * 0.9, { off: titleW(pOff), on: titleW(pOn) });
// khoảng cách giữa các trụ giữ nguyên
const mOff = marks(pOff).map(e => [n(e, '10'), n(e, '20')]), mOn = marks(pOn).map(e => [n(e, '10'), n(e, '20')]);
const dist = (A, i, j) => Math.hypot(A[i][0] - A[j][0], A[i][1] - A[j][1]);
let maxErr = 0;
for (let i = 0; i < mOff.length; i++) for (let j = i + 1; j < mOff.length; j++) maxErr = Math.max(maxErr, Math.abs(dist(mOff, i, j) - dist(mOn, i, j)));
ok('đủ 15 ký hiệu, khoảng cách giữa các trụ giữ nguyên (sai < 1 mm)', mOff.length === 15 && mOn.length === 15 && maxErr < 0.001, maxErr);
// tuyến nằm ngang sau xoay
const spanX = A => Math.max(...A.map(p => p[0])) - Math.min(...A.map(p => p[0])), spanY = A => Math.max(...A.map(p => p[1])) - Math.min(...A.map(p => p[1]));
ok('tuyến nằm ngang sau xoay (rộng > cao)', spanX(mOn) > spanY(mOn) * 5 && spanY(mOff) > spanX(mOff) * 5);
// block xoay cùng (góc 50 = ±90 khi không bật xoay theo đường)
ok('block trụ/tủ xoay theo góc tự xoay', marks(pOn).every(e => Math.abs(n(e, '50') - oOn.__rotDeg) < 1e-6), marks(pOn).slice(0, 2).map(e => e.g['50']));
// nhãn tên trụ vẫn đứng thẳng
const lbl = pOn.ents.filter(e => e.t === 'TEXT' && /^ADV_\d+$/.test(txt(e)));
ok('nhãn tên trụ đứng thẳng (không xoay chữ)', lbl.length === 14 && lbl.every(e => !e.g['50'] || Math.abs(n(e, '50')) < 1e-6));
// cáp nối đúng tâm trụ sau xoay
const cab = pOn.ents.filter(e => e.t === 'LINE' && (e.g['8'] || [''])[0] === 'LIGHTING_CABLE');
const onPt = (x, y) => mOn.some(p => Math.hypot(p[0] - x, p[1] - y) < 1e-3);
ok('cáp nối đúng tâm trụ sau xoay', cab.length >= 14 && cab.every(e => onPt(n(e, '10'), n(e, '20')) && onPt(n(e, '11'), n(e, '21'))), cab.length);
// mũi tên Bắc: thân mũi tên hướng theo góc xoay (Bắc thật)
const stem = pOn.ents.filter(e => e.t === 'LINE' && (e.g['8'] || [''])[0] === '0').find(e => {
    const L = Math.hypot(n(e, '11') - n(e, '10'), n(e, '21') - n(e, '20')); return Math.abs(L - 16) < 1e-3;
});
const stemAng = stem ? Math.atan2(n(stem, '21') - n(stem, '20'), n(stem, '11') - n(stem, '10')) * 180 / Math.PI : NaN;
// thân vẽ từ mũi (trên) xuống đuôi → hướng chưa xoay = -90°; sau xoay = -90 + θ
const wantAng = ((-90 + oOn.__rotDeg + 540) % 360) - 180;
ok('mũi tên Bắc xoay theo (chỉ đúng Bắc thật)', stem && Math.abs(stemAng - wantAng) < 1e-3, { stemAng, wantAng });
// khung tên vẫn nằm ngang
const tbIns = pOn.ents.find(e => e.t === 'INSERT' && e.g['2'][0] === 'TITLE_KNOP12');
ok('khung tên vẫn nằm ngang (INSERT không xoay)', tbIns && !tbIns.g['50']);

// ── 3. Tuyến ngang → không xoay ──
setData(HOR);
const oH = opts({ autoRotate: true });
const horOn = await sb.ctx._generateCadDrawing(oH);
const horOff = await sb.ctx._generateCadDrawing(opts());
ok('tuyến ngang → không xoay, file giống hệt khi tắt', oH.__rotDeg === 0 && horOn === horOff);

// ── 4. Mẫu khác + ký hiệu cũ + A3 chuẩn ──
setData(VERT);
for (const [label, ex] of [['mẫu "Tư vấn điện lực"', { templateId: 'dienluc' }], ['chỉ dữ liệu (không khung)', { templateId: 'none' }],
    ['ký hiệu cũ', { realBlocks: false }], ['A3 chuẩn', { frameMode: 'a3-standard' }], ['xoay theo đường (OSM cấp sẵn)', { orientByRoad: true, _osmPrefetch: { data: { roads: [{ tags: { highway: 'primary', name: 'An Dương Vương' }, coords: [[106.6300, 10.7495], [106.6300, 10.7550]] }], buildings: [], water: [], admin: [] }, err: null } }]]) {
    const o = opts(Object.assign({ autoRotate: true }, ex));
    let err = null, p = null;
    try { p = parse(await sb.ctx._generateCadDrawing(o)); } catch (e) { err = e.message; }
    ok(label + ': xoay ±90° và xuất được', !err && Math.abs(o.__rotDeg) === 90 && p.ents.length > 20, err || o.__rotDeg);
}

// ── 5. Nền OSM xoay cùng (hook xform) ──
{
    const osm = { roads: [{ tags: { highway: 'primary', name: 'An Dương Vương' }, coords: [[106.6300, 10.7500], [106.6300, 10.7550]] }], buildings: [], water: [], admin: [] };
    const out = []; const push = (...a) => { for (const v of a) out.push(String(v)); };
    const xf = (x, y) => [y, -x];   // xoay -90° quanh gốc
    sb.ctx.__osm = osm; sb.ctx.__push = push; sb.ctx.__xf = xf;
    sb.run('__osmStats = _drawOsmBasemapInDxf(__push, __osm, 105.75, 0, 0, null, 0.9999, { center: true, name: true, xform: __xf });');
    const p = parse(['0', 'SECTION', '2', 'ENTITIES', ...out, '0', 'ENDSEC', '0', 'EOF'].join('\r\n'));
    const verts = p.ents.filter(e => e.t === 'VERTEX').map(e => [n(e, '10'), n(e, '20')]);
    const v = sb.ctx.convertLatLonToVn2000(10.7500, 106.6300, 105.75, 0.9999);
    ok('OSM: toạ độ đường đi qua phép xoay', verts.length >= 2 && Math.abs(verts[0][0] - v.y) < 1e-3 && Math.abs(verts[0][1] + v.x) < 1e-3, verts[0]);
    const nm = p.ents.find(e => e.t === 'TEXT');
    ok('OSM: tên đường theo hướng đường đã xoay (đường dọc → nằm ngang)', nm && Math.abs(n(nm, '50')) < 1, nm && nm.g['50']);
}

// ── 6. Địa chỉ tủ (Số nhà) trong ô BẢN VẼ ──
setData(VERT);
const pA = parse(await sb.ctx._generateCadDrawing(opts()));
const tTexts = (pA.blocks.get('TITLE_KNOP12') || []).filter(e => e.t === 'TEXT').map(txt);
ok('ô BẢN VẼ: "123 AN DƯƠNG VƯƠNG, PHƯỜNG 16"', tTexts.includes('123 AN DƯƠNG VƯƠNG, PHƯỜNG 16'), tTexts.filter(t => /DƯƠNG/.test(t)));
const V2 = VERT.map((r, i) => i === 1 ? Object.assign([...r], { 30: '' }) : r);
setData(V2);
const pB = parse(await sb.ctx._generateCadDrawing(opts()));
ok('tủ chưa có số nhà → "AN DƯƠNG VƯƠNG, PHƯỜNG 16"', (pB.blocks.get('TITLE_KNOP12') || []).some(e => e.t === 'TEXT' && txt(e) === 'AN DƯƠNG VƯƠNG, PHƯỜNG 16'));
const pC = parse(await sb.ctx._generateCadDrawing(opts({ metadata: { NGAY: '31/10/2026', DIA_CHI: 'GÕ TAY' } })));
ok('địa chỉ gõ tay được ưu tiên', (pC.blocks.get('TITLE_KNOP12') || []).some(e => e.t === 'TEXT' && txt(e) === 'GÕ TAY'));

// ── 6b. Không mất số nhà khi tên đường bắt đầu bằng số ──
ok('số nhà "3" + đường "3 Tháng 2" → "3 3 THÁNG 2, PHƯỜNG 12"', sb.ctx._qbtCabinetAddress(row({ 30: '3', 17: '3 Tháng 2', 18: 'Phường 12' })) === '3 3 THÁNG 2, PHƯỜNG 12');
ok('số nhà "1" + đường "19 Tháng 5" giữ số nhà', sb.ctx._qbtCabinetAddress(row({ 30: '1', 17: '19 Tháng 5', 18: 'Phường 2' })) === '1 19 THÁNG 5, PHƯỜNG 2');
ok('thiếu phường → chỉ số nhà + đường', sb.ctx._qbtCabinetAddress(row({ 30: '45B', 17: 'Lê Lợi' })) === '45B LÊ LỢI');
ok('thiếu số nhà + đường → chỉ phường', sb.ctx._qbtCabinetAddress(row({ 18: 'Phường Bến Thành' })) === 'PHƯỜNG BẾN THÀNH');

// ── 6c. Chia nhiều tờ → không tự xoay (các tờ phải ghép khớp) ──
setData(VERT);
const oMS = opts({ autoRotate: true, _sheetIdx: 1, _sheetTotal: 2 });
await sb.ctx._generateCadDrawing(oMS);
ok('bản vẽ chia 2 tờ: bỏ qua tự xoay', oMS.__rotDeg === 0);

// ── 6d. Mũi tên Bắc đã xoay nằm trong khung ──
{
    const pts = pOn.ents.filter(e => e.t === 'LINE' && (e.g['8'] || [''])[0] === '0');
    const outer = Math.max(...pOn.ents.filter(e => e.t === 'LINE').map(e => Math.max(n(e, '10'), n(e, '11'))));
    const bT = pOn.ents.find(e => e.t === 'TEXT' && txt(e) === 'B');
    ok('chữ "B" của mũi tên Bắc nằm trong khung', bT && n(bT, '10') + 3 < outer, bT && [n(bT, '10'), outer]);
}

// ── 7. Cột Số nhà: GAS + client ──
const gas = fs.readFileSync(path.join(REPO, 'gas-khaosat.js'), 'utf8');
const hdr = gas.match(/const HEADER = \[([\s\S]*?)\];/)[1];
const hdrList = [...hdr.matchAll(/'([^']+)'/g)].map(m => m[1]);
ok('GAS: HEADER có "Số nhà" ở vị trí 31 (index 30)', hdrList.indexOf('Số nhà') === 30, hdrList.length);
ok('GAS: FIELD_MAP soNha → "Số nhà"', /'soNha':\s*'Số nhà'/.test(gas));
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
ok('client: gửi soNha = row[30] khi đồng bộ, hàng ngắn (cache cũ) thì không gửi', /row\.length > 30 \? \{ soNha: row\[30\]/.test(html));
ok('client: đồng bộ hàng loạt có cột soNha: 30', /trangThai: 29, soNha: 30/.test(html));
ok('client: ô Số nhà trong popup, mặc định ẩn', /id="markerSoNhaGroup" style="display:none/.test(html) && /id="markerSoNhaInput"/.test(html));
ok('client: lưu [30] Số nhà khi thêm + sửa', (html.match(/\/\/ \[30\] Số nhà \(v203\)/g) || []).length === 2);
ok('client: popup xem hiển thị Số nhà', /<span class="pk">Số nhà<\/span>/.test(html));
ok('modal CAD: ô "Tự xoay cho vừa khung" mặc định tắt', /id="cgAutoRotate" style=/.test(html) && !/id="cgAutoRotate" checked/.test(html));
const cad = fs.readFileSync(path.join(REPO, 'src/features/cad-export.js'), 'utf8');
ok('3 nơi gọi xuất CAD đều truyền autoRotate', (cad.match(/autoRotate: !!\(document\.getElementById\('cgAutoRotate'\)/g) || []).length === 3);

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
