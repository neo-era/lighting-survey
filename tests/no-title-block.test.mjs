// "Không xuất khung tên" (templateId = 'none') — gọi 3 bộ vẽ DXF THẬT trong sandbox Node
// Run: node tests/no-title-block.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

// Dữ liệu mẫu: 1 tủ + 3 trụ nối cáp tuần tự (cột theo schema DanhSachTru)
const row = (id, name, lat, lon, type, tu, parent, soLuong) => {
    const r = new Array(30).fill('');
    Object.assign(r, { 0: id, 1: name, 2: String(lat), 3: String(lon), 6: String(type), 7: tu, 14: parent, 21: String(soLuong || '') });
    return r;
};
sb.ctx.__rows = [
    new Array(30).fill('h'),
    row('T0', 'TU_TEST', 10.85300, 106.67200, 5, 'TU_TEST', '', ''),
    row('T1', 'P1', 10.85310, 106.67230, 1, 'TU_TEST', 'TU_TEST', 1),
    row('T2', 'P2', 10.85320, 106.67260, 1, 'TU_TEST', 'P1', 2),
    row('T3', 'P3', 10.85330, 106.67290, 1, 'TU_TEST', 'P2', 1),
];
sb.run('loadedData = __rows;');

const baseOpts = id => ({ templateId: id, metadata: {}, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
    outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75 });
const texts = dxf => { const L = dxf.split('\r\n'); const out = [];
    for (let i = 0; i < L.length - 1; i++) if (L[i] === 'TEXT' && L[i - 1] === '0') {
        for (let j = i + 1; j < L.length - 1 && L[j] !== '0'; j += 2) if (L[j] === '1') out.push(L[j + 1]); }
    return out; };
const has = (dxf, s) => dxf.includes(sb.ctx._dxfEscape(s));
const run = async (fn, id) => { try { return await sb.ctx[fn](baseOpts(id)); } catch (e) { return 'ERR: ' + e.message; } };

// === Mặt bằng ===
const planState = await run('_generateCadDrawing', 'state');
const planNone = await run('_generateCadDrawing', 'none');
ok('mặt bằng state: chạy được, có "Chú Thích"', !planState.startsWith('ERR') && has(planState, 'Chú Thích:'));
ok('mặt bằng none: chạy được', !planNone.startsWith('ERR'));
ok('mặt bằng none: KHÔNG có chú thích', !planNone.startsWith('ERR') && !has(planNone, 'Chú Thích:'));
ok('mặt bằng none: chỉ còn chữ là tên trụ/tủ hoặc khoảng cách cáp',
    !planNone.startsWith('ERR') && texts(planNone).every(t => /^(TU_TEST|P[123])$/.test(t) || /^\d+(\.\d+)?m$/.test(t)));
ok('mặt bằng none: vẫn có 4 ký hiệu INSERT (trụ + tủ)', !planNone.startsWith('ERR') && (planNone.match(/\r\nINSERT\r\n/g) || []).length === 4);
ok('mặt bằng none: vẫn có cáp (lớp LIGHTING_CABLE)', !planNone.startsWith('ERR') && /\r\n8\r\nLIGHTING_CABLE\r\n/.test(planNone));
ok('mặt bằng none: DXF kết thúc EOF', !planNone.startsWith('ERR') && planNone.trimEnd().endsWith('EOF'));

// === Sơ đồ nguyên lý ===
const slState = await run('_generateSingleLineDrawing', 'state');
const slNone = await run('_generateSingleLineDrawing', 'none');
// Tiêu đề trong khung tên bị ngắt dòng → dò từ khoá "NGUYÊN LÝ" trong bất kỳ TEXT nào
const hasTitleWord = dxf => texts(dxf).some(t => t.includes(sb.ctx._dxfEscape('NGUYÊN LÝ')));
ok('nguyên lý state: có tiêu đề nội dung bản vẽ', !slState.startsWith('ERR') && hasTitleWord(slState));
ok('nguyên lý none: chạy được', !slNone.startsWith('ERR'));
ok('nguyên lý none: KHÔNG có khung tên', !slNone.startsWith('ERR') && !hasTitleWord(slNone));
ok('nguyên lý none: KHÔNG có chú thích', !slNone.startsWith('ERR') && !has(slNone, 'Chú Thích:'));
ok('nguyên lý none: vẫn có tên trụ P1..P3 và tủ', !slNone.startsWith('ERR') && ['P1', 'P2', 'P3', 'TU_TEST'].every(n => texts(slNone).includes(n)));

// === Tổng thể ===
const ovState = await run('_generateOverviewDrawing', 'state');
const ovNone = await run('_generateOverviewDrawing', 'none');
ok('tổng thể none: chạy được', !ovNone.startsWith('ERR'));
ok('tổng thể none: ít chữ hơn bản state (không khung tên/chú thích)',
    !ovNone.startsWith('ERR') && !ovState.startsWith('ERR') && texts(ovNone).length < texts(ovState).length);
ok('tổng thể none: vẫn có tên tủ', !ovNone.startsWith('ERR') && texts(ovNone).includes('TU_TEST'));

// === Thu thập metadata khi không có khung tên ===
sb.ctx.document = { getElementById: id => (id === 'cgTemplateId' ? { value: 'none' } : null) };
let md, mdErr = null;
try { md = sb.run('_collectMetadata()'); } catch (e) { mdErr = e.message; }
ok('_collectMetadata với none: không crash, trả {}', !mdErr && md && Object.keys(md).length === 0);
ok('_cgIsNoTitle nhận diện none', sb.run("typeof _cgIsNoTitle === 'function' && _cgIsNoTitle('none') && !_cgIsNoTitle('state')"));

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
