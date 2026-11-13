// Cột chữ (Tên trụ, Marker gốc…) phải lưu dạng VĂN BẢN THUẦN.
// Lỗi thật 13/11/2026 (tab Hung): tên trụ "1","2"… bị Sheets đổi thành SỐ → link CSV gviz đoán cột là số
// → các tên chữ ("H535/59-3") trả về RỖNG → bản đồ hiện ID thay tên.
// Chạy: node tests/text-cols-gas.test.mjs
import { makeWorld } from './helpers/gas-world.mjs';

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const H = ['ID', 'Tên trụ', 'Lat', 'Lon', 'Marker gốc', 'Khoảng cách (m)', 'Mã PE', 'Thời gian cập nhật'];
const mk = () => makeWorld({
    stubAuth: true,
    mainTabs: {
        DanhSachTru: [H],
        Hung: [H, ['Q_1', 1, '10,8', '106,6', '', 5, 12, ''], ['Q_2', 'H535/59-3', '10,8', '106,6', 1, 7, 'PE1', ''], ['Q_3', 2, '10,8', '106,6', 'H535/59-3', 9, '', '']]
    }
});
const tab = (w, n) => w.active.getSheetByName(n);
const cell = (w, n, id, col) => { const sh = tab(w, n); const r = sh.data.find(x => x[0] === id); return r ? r[H.indexOf(col)] : undefined; };

{
    const w = mk();
    w.post({ action: 'full_update', sheet: 'Hung', id: 'Q_9', tenTru: '3', lat: '10,81', lon: '106,61', markerGoc: '2', khoangCach: '12' });
    ok('thêm mới: tên trụ "3" giữ là CHỮ (không thành số 3)', cell(w, 'Hung', 'Q_9', 'Tên trụ') === '3', cell(w, 'Hung', 'Q_9', 'Tên trụ'));
    ok('thêm mới: Marker gốc "2" giữ là chữ', cell(w, 'Hung', 'Q_9', 'Marker gốc') === '2');
    ok('cột số (Khoảng cách) vẫn là số', cell(w, 'Hung', 'Q_9', 'Khoảng cách (m)') === 12);
    w.post({ action: 'full_update', sheet: 'Hung', id: 'Q_2', tenTru: '4', maPE: '15' });
    ok('sửa: tên trụ "4" giữ là chữ', cell(w, 'Hung', 'Q_2', 'Tên trụ') === '4');
    ok('sửa: Mã PE "15" giữ là chữ', cell(w, 'Hung', 'Q_2', 'Mã PE') === '15');
}
{
    const w = mk();
    const r = w.ctx.suaCotChuGviz();
    ok('sửa dữ liệu cũ: tên trụ số 1 → chữ "1"', cell(w, 'Hung', 'Q_1', 'Tên trụ') === '1', r);
    ok('sửa dữ liệu cũ: Marker gốc số 1 → chữ "1"', cell(w, 'Hung', 'Q_2', 'Marker gốc') === '1');
    ok('sửa dữ liệu cũ: Mã PE 12 → "12"', cell(w, 'Hung', 'Q_1', 'Mã PE') === '12');
    ok('tên chữ giữ nguyên', cell(w, 'Hung', 'Q_2', 'Tên trụ') === 'H535/59-3');
    ok('ô trống giữ trống', cell(w, 'Hung', 'Q_3', 'Mã PE') === '');
    ok('cột số không đụng (Khoảng cách)', cell(w, 'Hung', 'Q_1', 'Khoảng cách (m)') === 5);
    ok('cột chữ định dạng văn bản thuần → ghi tiếp số vẫn là chữ', (tab(w, 'Hung').set(3, 2, '7'), tab(w, 'Hung').data[2][1] === '7'));
}

{
    const w = mk();
    const r = w.post({ action: 'batch_import', sheet: 'Hung', rows: [['Q_50', '5', '10,8', '106,6', '4', 3, '20', '']], clearFirst: false });
    ok('nhập hàng loạt: tên "5" + Marker gốc "4" + Mã PE "20" giữ là chữ', cell(w, 'Hung', 'Q_50', 'Tên trụ') === '5' && cell(w, 'Hung', 'Q_50', 'Marker gốc') === '4' && cell(w, 'Hung', 'Q_50', 'Mã PE') === '20', r);
}

{
    // Bảng (Tables) Google Sheets: cột định kiểu ném lỗi khi đặt định dạng — không được làm hỏng lệnh ghi / hàm sửa
    const w = mk();
    const sh = tab(w, 'Hung');
    const proto = Object.getPrototypeOf(sh.getRange(1, 1));
    const orig = proto.setNumberFormat;
    proto.setNumberFormat = function () { throw new Error("You can't set the number format of cells in a typed column."); };
    sh.getRangeList = () => ({ setNumberFormat() { throw new Error('typed column'); } });
    const r1 = w.post({ action: 'full_update', sheet: 'Hung', id: 'Q_2', tenTru: 'H9' });
    ok('cột định kiểu: sửa trụ vẫn thành công', r1.status === 'ok' && cell(w, 'Hung', 'Q_2', 'Tên trụ') === 'H9', r1);
    const r2 = w.post({ action: 'full_update', sheet: 'Hung', id: 'Q_77', tenTru: 'H10', lat: '10,8', lon: '106,6' });
    ok('cột định kiểu: thêm trụ vẫn thành công', r2.status === 'ok' && cell(w, 'Hung', 'Q_77', 'Tên trụ') === 'H10', r2);
    let threw = false, log;
    try { log = w.ctx.suaCotChuGviz(); } catch (e) { threw = true; }
    ok('cột định kiểu: hàm sửa không dừng giữa chừng', !threw, log);
    proto.setNumberFormat = orig;
}

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail) process.exit(1);
