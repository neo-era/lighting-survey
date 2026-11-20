// v216 — "📤 Cập nhật Excel": lỗi ghi từng dòng bị nuốt (silent) → người dùng chỉ thấy "Đã cập nhật 0/N" không biết vì sao.
// Ca thật 20/11/2026: dulieu_chinh_sua_Hung_2026-11-20_3.xlsx (361 dòng, 223 tên trụ trùng nhau giữa các tủ: T1, T2…).
// Run: node tests/edit-excel-errors.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); };
const sb = loadAppSandbox();
ok('sandbox nạp không lỗi', sb.errors.length === 0, sb.errors);
const W = sb.ctx;

const H = ['ID', 'Tên trụ', 'Lat', 'Lon'];
const mkData = () => [H, ['A1', 'T1', '10,1', '106,1'], ['B1', 'T1', '10,2', '106,2'], ['A2', 'T2', '10,3', '106,3']];
const msgs = [];
W.displayError = m => msgs.push(String(m)); W.displayInfo = m => msgs.push(String(m));
W.confirm = () => true; W.alert = m => msgs.push(String(m));
W.$ = () => ({ modal() {} });
const redrawn = [], removed = [];
W.addMarkerRowToMap = r => redrawn.push(r[0]);
W._invalidatePopupCacheForRow = () => {};
sb.run(`markersCluster = { removeLayer: m => __removed.push(m._id), hasLayer: () => false };
        labelLayerGroup = { hasLayer: () => false, removeLayer() {} };`);
W.__removed = removed;
const setMarkers = () => sb.run(`markers = [ {name:'T1', id:'A1', marker:{_id:'A1'}}, {name:'T1', id:'B1', marker:{_id:'B1'}}, {name:'T2', id:'A2', marker:{_id:'A2'}} ];`);
W._bkPreBatch = async () => true;

// 1. GAS từ chối ghi (không có quyền địa bàn) → báo rõ lý do, dừng sớm, không chạy hết N dòng
{
    sb.run('loadedData = ' + JSON.stringify(mkData()) + '; currentSheet = "Hung";');
    setMarkers(); msgs.length = 0;
    let calls = 0;
    W.fetch = async (u, o) => { calls++; return { json: async () => ({ status: 'forbidden', message: 'Tài khoản chưa được giao ghi địa bàn "Hung"' }) }; };
    const rows = [1, 2, 3].map(i => sb.run('loadedData[' + i + ']'));
    const changed = [];
    for (let i = 0; i < 6; i++) changed.push({ origRow: rows[i % 3], xlRow: [rows[i % 3][0], rows[i % 3][1], '10,9', '106,9'] });
    sb.run('_editExcelPending = null');
    W.__pend = { changed, added: [] };
    sb.run('_editExcelPending = __pend');
    await W._confirmEditExcelUpdate();
    const all = msgs.join('\n');
    ok('báo lý do lỗi từ GAS (không có quyền)', /chưa được giao ghi địa bàn/.test(all), msgs);
    ok('báo số dòng chưa lưu được', /chưa lưu được/i.test(all), msgs);
    ok('dừng sớm khi lỗi giống nhau liên tiếp (không gửi đủ 6 lệnh)', calls <= 3, calls);
}

// 2. Thành công: vẽ lại đúng marker theo ID (tên T1 trùng ở 2 tủ)
{
    sb.run('loadedData = ' + JSON.stringify(mkData()));
    setMarkers(); msgs.length = 0; redrawn.length = 0; removed.length = 0;
    W.fetch = async () => ({ json: async () => ({ status: 'ok' }) });
    const r = sb.run('loadedData[2]');            // B1 — tên T1, tủ thứ 2
    W.__pend = { changed: [{ origRow: r, xlRow: ['B1', 'T1', '10,5', '106,5'] }], added: [] };
    sb.run('_editExcelPending = __pend');
    await W._confirmEditExcelUpdate();
    ok('gỡ đúng marker B1 (không gỡ nhầm A1 cùng tên T1)', removed.length === 1 && removed[0] === 'B1', removed);
    ok('vẽ lại B1', redrawn.join() === 'B1', redrawn);
    ok('báo 1/1 thành công', msgs.some(m => /1\/1/.test(m)), msgs);
}

// 3. Phiên hết hạn → nói rõ phải đăng nhập lại
{
    sb.run('loadedData = ' + JSON.stringify(mkData()));
    setMarkers(); msgs.length = 0;
    W._authQueueRetry = () => {};
    W.fetch = async () => ({ json: async () => ({ status: 'auth_required' }) });
    const r = sb.run('loadedData[1]');
    W.__pend = { changed: [{ origRow: r, xlRow: ['A1', 'T1', '10,7', '106,7'] }], added: [] };
    sb.run('_editExcelPending = __pend');
    await W._confirmEditExcelUpdate();
    ok('phiên hết hạn → báo đăng nhập lại', /đăng nhập/i.test(msgs.join('\n')), msgs);
}

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail) process.exit(1);
