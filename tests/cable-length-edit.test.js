// Sửa số mét cáp → dời trụ về đúng khoảng cách, nhánh phía sau tịnh tiến theo, trụ gốc đứng yên
// Hàm thuần giữa @@CABLELEN_START/END trong index.html. Run: node tests/cable-length-edit.test.js
const fs = require('fs');
const path = require('path');

function load() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const m = html.match(/\/\/ @@CABLELEN_START([\s\S]*?)\/\/ @@CABLELEN_END/);
    if (!m) throw new Error('Chưa có block @@CABLELEN_START/END trong index.html');
    return new Function(m[1] + '\nreturn { _clPlanLength, _clDist, _clRootOf };')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const near = (a, b, t = 0.05) => Math.abs(a - b) <= t;

let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== Result: 0 pass / 1 fail ==='); process.exit(1); }

// Dữ liệu: dựng trụ theo mét quanh (10.78, 106.69) — 1e-5 độ ≈ 1.1m
const LAT0 = 10.78, LON0 = 106.69, R = 6371000, rad = Math.PI / 180;
const at = (e, n) => [LAT0 + n / (R * rad), LON0 + e / (R * rad * Math.cos(LAT0 * rad))];
const row = (name, e, n, parent, id) => { const r = new Array(30).fill(''); const [la, lo] = at(e, n); Object.assign(r, { 0: id || '', 1: name, 2: la, 3: lo, 6: name.startsWith('TU') ? '5' : '1', 14: parent || '' }); return r; };
const apply = (rows, plan) => { const copy = rows.map(r => r.slice()); plan.moves.forEach(m => { const r = copy[rows.indexOf(m.row)]; r[2] = m.lat; r[3] = m.lon; }); return copy; };
const pos = (rows, name) => { const r = rows.find(x => x[1] === name); return [Number(r[2]), Number(r[3])]; };
const D = (rows, a, b) => { const p = pos(rows, a), q = pos(rows, b); return H._clDist(p[0], p[1], q[0], q[1]); };

// Tuyến thẳng hướng Đông: TU — P1 (21m) — P2 (+46m) — P3 (+35m)
const line = () => [row('TU', 0, 0), row('P1', 21, 0.5, 'TU'), row('P2', 67, -0.4, 'P1'), row('P3', 102, 0.3, 'P2')];

{
    const rows = line();
    ok('_clRootOf(P3) = TU', H._clRootOf('P3', rows) === 'TU');
    const plan = H._clPlanLength(rows, 'P1', 30, null);
    const after = apply(rows, plan);
    ok('sửa TU–P1 = 30: không lỗi, trụ gốc mặc định = TU', !plan.error && plan.fixed === 'TU');
    ok('TU–P1 đúng 30m (±5cm)', near(D(after, 'TU', 'P1'), 30));
    ok('P1–P2 và P2–P3 giữ nguyên số mét', near(D(after, 'P1', 'P2'), D(rows, 'P1', 'P2'), 0.01) && near(D(after, 'P2', 'P3'), D(rows, 'P2', 'P3'), 0.01));
    ok('TU đứng yên', pos(after, 'TU')[0] === pos(rows, 'TU')[0] && pos(after, 'TU')[1] === pos(rows, 'TU')[1]);
    ok('nhánh dời = P1, P2, P3', plan.moving.sort().join() === 'P1,P2,P3');
    ok('P1 dời đúng trên đường thẳng TU→P1 (hướng giữ nguyên)', (() => {
        const a = pos(rows, 'TU'), b0 = pos(rows, 'P1'), b1 = pos(after, 'P1');
        const cross = (b0[0] - a[0]) * (b1[1] - a[1]) - (b0[1] - a[1]) * (b1[0] - a[0]);
        return Math.abs(cross) < 1e-12;
    })());
}
{
    const rows = line();
    const plan = H._clPlanLength(rows, 'P2', 50, null);
    const after = apply(rows, plan);
    ok('sửa đoạn giữa P1–P2 = 50: TU, P1 đứng yên; P2, P3 dời', plan.moving.sort().join() === 'P2,P3' && near(D(after, 'P1', 'P2'), 50));
    ok('P2–P3 giữ nguyên', near(D(after, 'P2', 'P3'), D(rows, 'P2', 'P3'), 0.01));
}
{
    // Trụ gốc chọn = P3 → sửa TU–P1: phía chứa P3 đứng yên, TU bị dời
    const rows = line();
    const plan = H._clPlanLength(rows, 'P1', 30, 'P3');
    const after = apply(rows, plan);
    ok('trụ gốc = P3: chỉ TU dời, TU–P1 = 30', plan.moving.join() === 'TU' && near(D(after, 'TU', 'P1'), 30) && plan.fixed === 'P1');
}
{
    // Rẽ nhánh: P2 có 2 con P3a, P3b → cả 2 dời theo
    const rows = [row('TU', 0, 0), row('P1', 20, 0, 'TU'), row('P2', 40, 0, 'P1'), row('P3a', 60, 5, 'P2'), row('P3b', 60, -5, 'P2')];
    const plan = H._clPlanLength(rows, 'P1', 25, null);
    const after = apply(rows, plan);
    ok('rẽ nhánh: P1, P2, P3a, P3b dời; khoảng cách trong nhánh giữ', plan.moving.length === 4 && near(D(after, 'P2', 'P3a'), D(rows, 'P2', 'P3a'), 0.01) && near(D(after, 'P2', 'P3b'), D(rows, 'P2', 'P3b'), 0.01));
}
{
    // Khoảng cách dài: khớp công thức haversine của app (R=6371000) tới cm
    const rows = [row('TU', 0, 0), row('X', 120, 80, 'TU')];
    const plan = H._clPlanLength(rows, 'X', 350.4, null);
    ok('350.4m khớp haversine (±1cm)', near(D(apply(rows, plan), 'TU', 'X'), 350.4, 0.01));
}
{
    // Dòng trùng tên → cả 2 dòng cùng dời
    const rows = [row('TU', 0, 0), row('P1', 20, 0, 'TU', 'ID1'), row('P1', 20, 0, 'TU', 'ID1b')];
    const plan = H._clPlanLength(rows, 'P1', 30, null);
    ok('dòng trùng tên: cả 2 dòng P1 được dời', plan.moves.filter(m => m.row[1] === 'P1').length === 2);
}
// Review v161
{
    // Trùng tên nhưng ở XA nhau (2 trụ khác nhau) → không dời mù, báo dup
    const rows = [row('TU', 0, 0), row('P1', 20, 0, 'TU'), row('P2', 40, 0, 'P1'), row('P2', 900, 400, 'X9')];
    const plan = H._clPlanLength(rows, 'P1', 30, null);
    ok('trùng tên ở xa nhau (>5m) → dup, không dời', plan.error === 'dup' && plan.names.includes('P2'));
    // Vòng 2 chiều A↔B
    const ab = [row('A', 0, 0, 'B'), row('B', 10, 0, 'A')];
    ok('vòng 2 chiều A↔B → cycle', H._clPlanLength(ab, 'A', 15, null).error === 'cycle');
    // Gốc khi Marker gốc trỏ tới tên không có
    const ghost = [row('P1', 0, 0, 'MAT_TICH'), row('P2', 20, 0, 'P1')];
    ok('_clRootOf dừng ở trụ cuối có thật (P1), không trả tên ma', H._clRootOf('P2', ghost) === 'P1');
    // Số mét làm tròn 0.1 trước khi dời → khớp đúng số ghi
    const r2 = line();
    const p2 = H._clPlanLength(r2, 'P1', 21.37, null);
    ok('số mét làm tròn 0.1 (21.37 → 21.4)', p2.length === 21.4 && near(D(apply(r2, p2), 'TU', 'P1'), 21.4, 0.005));
    ok('edgeRows chỉ gồm dòng có đúng cha', p2.edgeRows.length === 1 && p2.edgeRows[0][14] === 'TU');
}
// Lỗi
{
    const rows = line();
    ok('số mét 0 → len', H._clPlanLength(rows, 'P1', 0, null).error === 'len');
    ok('số mét âm → len', H._clPlanLength(rows, 'P1', -5, null).error === 'len');
    ok('số mét > 500 → len', H._clPlanLength(rows, 'P1', 600, null).error === 'len');
    ok('NaN → len', H._clPlanLength(rows, 'P1', NaN, null).error === 'len');
    ok('trụ không có cáp gốc → no_parent', H._clPlanLength(rows, 'TU', 10, null).error === 'no_parent');
    ok('tên không tồn tại → no_row', H._clPlanLength(rows, 'ZZ', 10, null).error === 'no_row');
    const cyc = [row('A', 0, 0, 'B'), row('B', 10, 0, 'C'), row('C', 20, 0, 'A')];
    ok('vòng lặp cáp → cycle', H._clPlanLength(cyc, 'A', 15, null).error === 'cycle');
    const same = [row('TU', 0, 0), row('P1', 0, 0, 'TU')];
    ok('2 trụ trùng toạ độ (không xác định hướng) → same', H._clPlanLength(same, 'P1', 10, null).error === 'same');
    ok('trụ gốc chỉ định không có thật → dùng gốc mặc định', H._clPlanLength(rows, 'P1', 30, 'KHONG_CO').fixed === 'TU');
    const bad = line(); bad[2][2] = 'abc';
    ok('toạ độ trong nhánh dời hỏng → bad_coord', H._clPlanLength(bad, 'P1', 30, null).error === 'bad_coord');
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
