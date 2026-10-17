// Xuất tổng hợp tuyến theo 2 mẫu Excel (CT5 / WebDialux) — v179. Run: node tests/route-summary.test.mjs
// Phần ghi Excel cần exceljs: đặt EXCELJS_PATH=<thư mục chứa node_modules/exceljs> hoặc cài exceljs; thiếu thì bỏ qua phần đó.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
const W = sb.ctx;
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const row = o => { const r = new Array(30).fill(''); for (const k in o) r[k] = o[k]; return r; };
const S = (lat, lon) => [String(lat).replace('.', ','), String(lon).replace('.', ',')];
const data = [new Array(30).fill('h')];
// Tủ T1 ở đầu tây; 6 trụ 1 bên đường A (phía bắc ~9 m), cáp nối chuỗi 33 m
data.push(row({ 0: 'C1', 1: 'T1', 2: '10,9001', 3: '106,7002', 6: 5, 7: 'T1' }));
for (let i = 0; i < 6; i++) {
    const [la, lo] = S(10.90008, +(106.7008 + i * 0.0003).toFixed(6));
    data.push(row({ 0: 'A' + i, 1: 'AA_AA_' + (i + 1), 2: la, 3: lo, 6: 1, 7: 'T1', 8: 'Trụ STK', 10: 'HPS', 11: '250',
        14: i ? 'AA_AA_' + i : 'T1', 15: i ? '33' : '12', 17: 'Đường A', 18: 'Phường X', 21: i === 2 ? '2' : '1', 27: '8' }));
}
// Tủ T2: 6 trụ 2 bên so le, không cáp → đo dọc; loại HTLT (bê tông), LED; 1 trụ không toạ độ
for (let i = 0; i < 6; i++) {
    const side = i % 2 ? -0.00009 : 0.00009;
    const [la, lo] = S(+(10.9 + side).toFixed(6), +(106.7032 + i * 0.00015).toFixed(6));
    data.push(row({ 0: 'B' + i, 1: 'BB_' + (i + 1), 2: la, 3: lo, 6: 3, 7: 'T2', 10: 'LED', 17: 'Đường A', 18: 'Phường X' }));
}
data.push(row({ 0: 'B9', 1: 'BB_9', 6: 3, 7: 'T2' }));
W.__rows = data; sb.run('loadedData = __rows; currentSheet = "BauBang";');
const all = data.slice(1);

// ── Gom tuyến ──
let g = W._rsGroup(all, 'tu');
ok('gom theo tủ: 2 tuyến (T1, T2), tủ không tính là trụ', g.groups.length === 2 && g.groups.map(x => x.poles.length).join(',') === '6,6');
ok('trụ không toạ độ: bỏ qua + đếm', g.skipped === 1);
ok('gom theo tên tuyến: AA_AA và BB tách riêng', W._rsGroup(all, 'ten').groups.length === 2);
ok('gom Đường + Tủ: 2 nhóm', W._rsGroup(all, 'duong_tu').groups.length === 2);

// ── Đường OSM giả: Đường A (đông–tây, lat 10.9, primary, 4 làn) + Đường B cắt dọc gần đầu T1 ──
const roads = [
    { coords: [[106.699, 10.9], [106.71, 10.9]], tags: { highway: 'primary', name: 'Đường A', lanes: '4' } },
    { coords: [[106.7006, 10.899], [106.7006, 10.902]], tags: { highway: 'residential', name: 'Đường B' } },
    { coords: [[106.7042, 10.899], [106.7042, 10.902]], tags: { highway: 'residential', name: 'Đường C' } }
];
const s1 = W._rsSummarize(g.groups[0], all, roads), s2 = W._rsSummarize(g.groups[1], all, roads);
ok('T1: đầu tuyến = trụ gần tủ (AA_AA_1), cuối = AA_AA_6', s1.start.name === 'AA_AA_1' && s1.end.name === 'AA_AA_6');
ok('T1: chiều dài = tổng cáp 12 + 5×33 = 177 m (nguồn cáp)', s1.length === 177 && s1.lengthSrc === 'cap');
ok('T1: khoảng cách trụ TB = 177/5', Math.abs(s1.spacing - 35.4) < 0.01);
ok('T1: HPS = 7 bóng (1 trụ 2 bóng), LED 0', s1.hps === 7 && s1.led === 0 && s1.lamps === 7);
ok('T1: bộ đèn hiện hữu "HPS 250W ×7"', s1.lampText === 'HPS 250W ×7');
ok('T1: loại trụ kim loại (STK), cao 8 m, 1 bóng/trụ', s1.material === 'kimloai' && s1.height === 8 && s1.lampsPerPole === 1);
ok('T1: VN2000 điểm đầu là số nguyên hợp lệ', Number.isInteger(s1.start.x) && s1.start.x > 500000 && s1.start.y > 1000000);
ok('T1 OSM: đường A, 4 làn, rộng 14 m, không dải phân cách', s1.osm && s1.osm.roadName === 'Đường A' && s1.osm.lanes === 4 && s1.osm.width === 14 && !s1.osm.dual);
ok('T1 OSM: bố trí 1 bên, loại tuyến trục chính', s1.osm.layout === '1ben' && s1.osm.loaiTuyen === 'Đường trục chính đô thị');
ok('T1 OSM: lý trình điểm đầu = Đường B (cắt ngang gần trụ đầu)', s1.osm.crossStart === 'Đường B');
ok('T2: không cáp → đo theo trục tuyến ≈ 5×16.4 m (không zig-zag)', s2.lengthSrc === 'do' && Math.abs(s2.length - 82) <= 2);
ok('T2: LED 6, bê tông (HTLT)', s2.led === 6 && s2.hps === 0 && s2.material === 'betong');
ok('T2 OSM: 2 bên so le', s2.osm && s2.osm.layout === 'sole');
ok('không OSM → osm null, vẫn tính phần còn lại', W._rsSummarize(g.groups[0], all, null).osm === null);
ok('OSM rỗng → osm null', W._rsSummarize(g.groups[0], all, []).osm === null);
// 1 trụ
const one = W._rsSummarize({ key: 'x', poles: [g.groups[0].poles[0]] }, all, null);
ok('tuyến 1 trụ: chiều dài + khoảng cách trụ trống, đầu = cuối', one.length === null && one.spacing === null && one.start.name === one.end.name);

// Lý trình không lấy trùng chính đường đang đi (khác hoa thường / chữ "Đường")
const roads2 = roads.concat([{ coords: [[106.7006, 10.9], [106.7006, 10.9003]], tags: { highway: 'primary', name: 'đường a' } }]);
const s1b = W._rsSummarize(g.groups[0], all, roads2);
ok('lý trình bỏ đường trùng tên với đường chính ("đường a" = "Đường A")', s1b.osm.crossStart === 'Đường B');
// Tên tuyến giữ dấu khi không có tên đường + không OSM
const noName = all.filter(r => r[7] === 'T2').map(r => { const c = r.slice(); c[17] = ''; c[1] = String(c[1]).replace('BB', 'ĐB'); return c; });
const sNo = W._rsSummarize({ key: 'k', poles: noName.filter(r => r[2]) }, all, null);
ok('tên tuyến từ tên trụ giữ dấu ("ĐB")', sNo.tuyen === 'ĐB');
// Gom > 10 tuyến → chia lô truy vấn OSM
const many = Array.from({ length: 23 }, (_, i) => ({ key: 'g' + i, poles: g.groups[0].poles }));
W._idbGet = async () => null; W._idbSet = async () => {};
W.setTimeout = f => setTimeout(f, 0);   // bỏ các khoảng chờ giữa lô OSM
let nQ = 0; const keep = W._overpassFetch;
W._overpassFetch = async () => { nQ++; return { elements: [] }; };
const fr = await W._rsFetchOsm(many);
ok('23 tuyến → 3 truy vấn OSM (lô 10), mọi tuyến có kết quả', nQ === 3 && fr.roadsByKey.size === 23 && fr.failed === 0);
// Cache IndexedDB: xuất lại không gọi Overpass cho lô đã có
const idb = new Map(); W._idbGet = async k => idb.get(k); W._idbSet = async (k, v) => { idb.set(k, v); };
nQ = 0; W._overpassFetch = async () => { nQ++; return { elements: [] }; };
await W._rsFetchOsm(many); const n1 = nQ; await W._rsFetchOsm(many);
ok('cache OSM: lần 2 không gọi Overpass', n1 >= 1 && nQ === n1);
// Lô lỗi được thử thêm lượt cuối → thành công
idb.clear(); let fails = 2; nQ = 0;
W._overpassFetch = async () => { nQ++; if (fails-- > 0) throw new Error('504'); return { elements: [] }; };
W.setTimeout = f => setTimeout(f, 0);
const fr2 = await W._rsFetchOsm(many.slice(0, 5));
ok('lô lỗi 2 lần → lượt cuối tải được, không tuyến nào thiếu OSM', fr2.failed === 0 && nQ === 3);
W._idbGet = async () => null; W._idbSet = async () => {};
W._overpassFetch = keep;

// Toạ độ 0,0 bị bỏ
ok('toạ độ 0,0 (GPS lỗi) không tính', W._rsGroup([row({ 0: 'Z', 1: 'Z_1', 2: '0', 3: '0', 6: 1, 7: 'T9' })], 'tu').skipped === 1);
// Truy vấn ngắt đoạn khi 2 trụ cách > 100 m
const far = [row({ 1: 'F_1', 2: '10,9', 3: '106,7', 6: 1, 7: 'TF' }), row({ 1: 'F_2', 2: '10,9', 3: '106,7003', 6: 1, 7: 'TF' }), row({ 1: 'F_3', 2: '10,9', 3: '106,705', 6: 1, 7: 'TF' })];
ok('truy vấn OSM ngắt đoạn khi 2 trụ cách > 100 m (2 mệnh đề around)', (W._rsAroundQuery([{ key: 'f', poles: far }]).match(/around:/g) || []).length === 2);
// Trụ trùng 1 điểm, không cáp → chiều dài trống
const same = [row({ 1: 'S_1', 2: '10,9', 3: '106,7', 6: 1, 7: 'TS' }), row({ 1: 'S_2', 2: '10,9', 3: '106,7', 6: 1, 7: 'TS' })];
ok('các trụ trùng 1 điểm → chiều dài trống (không ghi 0)', W._rsSummarize({ key: 's', poles: same }, same, null).length === null);

// ── Ghi Excel (cần exceljs) ──
let ExcelJS = null;
try {
    const base = process.env.EXCELJS_PATH ? path.join(process.env.EXCELJS_PATH, 'x.js') : import.meta.url;
    ExcelJS = createRequire(base)('exceljs');
} catch (e) { /* bỏ qua */ }
if (!ExcelJS) {
    console.log('… bỏ qua phần ghi Excel (không có exceljs — đặt EXCELJS_PATH)');
} else {
    const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
    W.ExcelJS = ExcelJS;
    W._loadExcelJS = async () => {};
    W.fetch = async u => ({ ok: true, arrayBuffer: async () => { const b = fs.readFileSync(path.join(REPO, u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
    const saved = [];
    W._saveBlob = (blob, name) => saved.push({ blob, name });
    W.Blob = class { constructor(parts) { this.buf = Buffer.from(parts[0]); } };
    W.setTimeout = (f) => setTimeout(f, 0);   // bỏ chờ 3s giữa 2 lần thử OSM
    let ovCalls = 0, ovQuery = '', ovFail = false;
    W._overpassFetch = async q => { ovCalls++; ovQuery = q; if (ovFail) throw new Error('504');
        return { elements: roads.map((r, i) => ({ type: 'way', id: i, tags: r.tags, geometry: r.coords.map(c => ({ lon: c[0], lat: c[1] })) })) }; };
    const els = {
        rsTu: { value: '' }, rsOsm: { checked: true }, rsTitle: { value: 'TỔNG HỢP TEST' }, rsBtn: { textContent: '', disabled: false },
        routeSummaryModal: { style: {} }
    };
    let tplVal = 'ct5';
    W.document = Object.assign(W.document || {}, {
        getElementById: id => els[id] || null,
        querySelector: sel => sel.includes('rsTpl') ? { value: tplVal } : sel.includes('rsMode') ? { value: 'tu' } : null
    });
    W.displayInfo = () => {}; W.displayError = m => { throw new Error(m); };
    const outDir = process.env.RS_OUT || null;
    for (const t of ['ct5', 'wdx']) {
        tplVal = t; saved.length = 0;
        await W._exportRouteSummary();
        ok(`${t}: xuất ra 1 file .xlsx`, saved.length === 1 && /\.xlsx$/.test(saved[0].name));
        if (!saved.length) continue;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(saved[0].blob.buf);
        if (outDir) fs.writeFileSync(path.join(outDir, t + '.xlsx'), saved[0].blob.buf);
        if (t === 'ct5') {
            const ws = wb.worksheets[0];
            ok('ct5: tiêu đề A1 theo ô nhập', ws.getCell('A1').value === 'TỔNG HỢP TEST');
            ok('ct5: giữ tiêu đề cột (B2 Tuyến đường, Q2 Điểm đầu - Lat)', ws.getCell('B2').value === 'Tuyến đường' && ws.getCell('Q2').value === 'Điểm đầu - Lat');
            ok('ct5: dòng 4 = T1: Đường A, 177 m, HPS 7, kim loại X', ws.getCell('B4').value === 'Đường A' && ws.getCell('F4').value === 177 && ws.getCell('M4').value === 7 && ws.getCell('P4').value === 'X');
            ok('ct5: ô vàng dòng 1 KHÔNG lan sang dòng 2 (P5 trống, không vàng)', !(ws.getCell('P5').fill && ws.getCell('P5').fill.fgColor && ws.getCell('P5').fill.fgColor.argb === 'FFFFF2CC'));
            ok('ct5: dòng 5 = T2: LED 6, bê tông X, bố trí 2 bên', ws.getCell('N5').value === 6 && ws.getCell('O5').value === 'X' && ws.getCell('L5').value === '2 bên');
            ok('ct5: lý trình điểm đầu T1 = Đường B, tô vàng', ws.getCell('D4').value === 'Đường B' && ws.getCell('D4').fill && ws.getCell('D4').fill.fgColor.argb === 'FFFFF2CC');
            ok('ct5: vỉa hè trống + tô vàng', ws.getCell('G4').value === null && ws.getCell('G4').fill.fgColor.argb === 'FFFFF2CC');
            ok('ct5: dòng TỔNG CỘNG + SUM HPS', ws.getCell('A6').value === 'TỔNG CỘNG' && /SUM\(M4:M5\)/.test(ws.getCell('M6').formula || (ws.getCell('M6').value || {}).formula));
            ok('ct5: có ghi chú (1 trụ không toạ độ)', [8, 9, 10, 11, 12].some(r => /không có toạ độ/.test(String(ws.getCell('A' + r).value || ''))));
        } else {
            const ws = wb.getWorksheet('DU LIEU TUYEN');
            ok('wdx: đủ 3 sheet, tên sheet giữ nguyên', wb.worksheets.map(w => w.name).join('|') === 'DU LIEU TUYEN|CAP DUONG QCVN07-7-23|HUONG DAN');
            ok('wdx: tiêu đề cột giữ nguyên (R1 Độ cao bộ đèn, W1 Khoảng cách trụ TB)', ws.getCell('R1').value === 'Độ cao bộ đèn (m)' && ws.getCell('W1').value === 'Khoảng cách trụ TB (m)');
            ok('wdx: dòng 2 = T1: tủ T1, 177 m, 7 bộ, "HPS 250W ×7"', ws.getCell('E2').value === 'T1' && ws.getCell('H2').value === 177 && ws.getCell('J2').value === 7 && ws.getCell('K2').value === 'HPS 250W ×7');
            ok('wdx: hình học: cao 8, rộng 14, 4 làn, KC trụ 35.4, 1 bên, không dải', ws.getCell('R2').value === 8 && ws.getCell('U2').value === 14 && ws.getCell('V2').value === 4 && ws.getCell('W2').value === 35.4 && ws.getCell('Z2').value === '1 bên' && ws.getCell('AA2').value === 'không');
            ok('wdx: loại tuyến OSM tô vàng', ws.getCell('O2').value === 'Đường trục chính đô thị' && ws.getCell('O2').fill.fgColor.argb === 'FFFFF2CC');
            ok('wdx: T2 bố trí "so le"', ws.getCell('Z3').value === 'so le');
            ok('wdx: giữ danh sách chọn (Z: 1 bên/đối xứng/so le/giữa)', JSON.stringify(ws.dataValidations.model || {}).includes('so le'));
        }
    }
    // OSM: đúng 1 truy vấn cho mọi tuyến, dạng around quanh trụ
    ok('OSM: 1 truy vấn Overpass cho cả lô 2 tuyến (không tải từng tuyến)', ovCalls === 2 /* ct5 + wdx */ && (ovQuery.match(/around:60,/g) || []).length === 2);
    // OSM lỗi → vẫn xuất, ô OSM trống + ghi chú
    ovFail = true; tplVal = 'ct5'; saved.length = 0; ovCalls = 0;
    await W._exportRouteSummary();
    ok('OSM lỗi: thử 2 lần + 1 lượt cuối (3 lần gọi)', ovCalls === 3);
    if (saved.length) {
        const wb = new ExcelJS.Workbook(); await wb.xlsx.load(saved[0].blob.buf); const ws = wb.worksheets[0];
        ok('OSM lỗi: vẫn xuất file, rộng lòng đường trống + tô vàng', ws.getCell('J4').value === null && ws.getCell('J4').fill.fgColor.argb === 'FFFFF2CC');
        ok('OSM lỗi: lý trình điểm đầu = tên trụ đầu', ws.getCell('D4').value === 'AA_AA_1');
        ok('OSM lỗi: ghi chú báo không tải được OSM', [8, 9, 10, 11, 12, 13].some(r => /Không tải được bản đồ OSM/.test(String(ws.getCell('A' + r).value || ''))));
    } else ok('OSM lỗi: vẫn xuất file', false);
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
