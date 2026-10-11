// Block đèn xoay theo hướng đường — pure helpers giữa marker @@ROADLAMP_START/END trong index.html
// Run: node tests/road-lamp-block.test.js
const fs = require('fs');
const path = require('path');

function load() {
    const html = require('../tools/app-source.cjs').appSource();   // index.html + src/*.js (module hoá)
    const m = html.match(/\/\/ @@ROADLAMP_START([\s\S]*?)\/\/ @@ROADLAMP_END/);
    if (!m) throw new Error('Chưa có block @@ROADLAMP_START/END trong index.html');
    return new Function(m[1] + '\nreturn { _rlIsDrivable, _rlBuildIndex, _rlNearest, _rlRotation, _rlLampDirs, _rlDrawLampBlock };')();
}

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '✓ ' : '✗ ') + name); };
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const angNear = (a, b, tol = 0.5) => { let d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d) <= tol; };

let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== Result: 0 pass / 1 fail ==='); process.exit(1); }

// === Lọc highway ===
ok('primary là đường xe', H._rlIsDrivable({ highway: 'primary' }));
ok('residential là đường xe', H._rlIsDrivable({ highway: 'residential' }));
ok('footway bị loại', !H._rlIsDrivable({ highway: 'footway' }));
ok('steps bị loại', !H._rlIsDrivable({ highway: 'steps' }));
ok('construction (đường đang thi công) là đường xe', H._rlIsDrivable({ highway: 'construction', construction: 'residential' }));
ok('proposed (chỉ quy hoạch) bị loại', !H._rlIsDrivable({ highway: 'proposed' }));
ok('không có tag highway bị loại', !H._rlIsDrivable({}));
ok('service (hẻm) giữ lại', H._rlIsDrivable({ highway: 'service' }));
ok('service=parking_aisle bị loại', !H._rlIsDrivable({ highway: 'service', service: 'parking_aisle' }));
ok('service=driveway bị loại', !H._rlIsDrivable({ highway: 'service', service: 'driveway' }));

// === Nearest segment ===
// Đường ngang trục X từ (0,0) đến (100,0); đường dọc x=200
const segs = [
    { x1: 0, y1: 0, x2: 100, y2: 0 },
    { x1: 200, y1: -50, x2: 200, y2: 50 }
];
const idx = H._rlBuildIndex(segs, 50);
let n1 = H._rlNearest(50, -5, idx, 40);
ok('nearest: tìm được đoạn ngang', n1 && near(n1.dist, 5) && near(n1.qx, 50) && near(n1.qy, 0));
ok('nearest: góc đoạn ngang ≈ 0°/180°', n1 && (angNear(n1.ang, 0) || angNear(n1.ang, 180)));
let n2 = H._rlNearest(195, 10, idx, 40);
ok('nearest: chọn đường dọc gần hơn', n2 && near(n2.dist, 5) && near(n2.qx, 200));
ok('nearest: ngoài 40m → null', H._rlNearest(50, -80, idx, 40) === null);
ok('nearest: index rỗng → null', H._rlNearest(0, 0, H._rlBuildIndex([], 50), 40) === null);

// === Rotation ===
// 1 đèn: trụ dưới đường → đèn (+Y cục bộ) hướng lên → rot 0
ok('1 đèn, trụ dưới đường ngang → rot 0°', angNear(H._rlRotation(50, -5, 1, n1, null), 0));
const nAbove = H._rlNearest(50, 5, idx, 40);
ok('1 đèn, trụ trên đường ngang → rot 180°', angNear(H._rlRotation(50, 5, 1, nAbove, null), 180));
// 1 đèn cạnh đường dọc, trụ bên trái (x=195) → đèn hướng +X → rot -90
ok('1 đèn, trụ trái đường dọc → rot -90°', angNear(H._rlRotation(195, 10, 1, n2, null), -90));
// 2 đèn: rot = góc đường, chuẩn hoá (-90, 90]
ok('2 đèn, đường ngang → rot 0°', angNear(H._rlRotation(50, -5, 2, n1, null), 0));
ok('2 đèn, đường dọc → rot 90°', angNear(H._rlRotation(195, 10, 2, n2, null), 90));
const nDiag = H._rlNearest(1, -1, H._rlBuildIndex([{ x1: 10, y1: 10, x2: 0, y2: 0 }], 50), 40);
ok('2 đèn, đường chéo 225° → chuẩn hoá 45°', angNear(H._rlRotation(1, -1, 2, nDiag, null), 45));
// Trụ nằm trên tim đường, 1 đèn → rot = góc đường
const nOn = H._rlNearest(50, 0.1, idx, 40);
ok('1 đèn, trụ trên tim (<0.3m) → rot theo góc đường', angNear(H._rlRotation(50, 0.1, 1, nOn, null), 0) || angNear(H._rlRotation(50, 0.1, 1, nOn, null), 180));
// Fallback trụ cha: cha ở (0,0), trụ ở (30,0) → tuyến cáp ngang → rot 0
ok('fallback cha: tuyến ngang → rot 0°', angNear(H._rlRotation(30, 0, 2, null, { x: 0, y: 0 }), 0));
ok('fallback cha: tuyến dọc → rot 90°', angNear(H._rlRotation(0, 30, 2, null, { x: 0, y: 0 }), 90));
ok('không đường, không cha → 0°', H._rlRotation(5, 5, 1, null, null) === 0);
ok('cha trùng vị trí → 0°', H._rlRotation(5, 5, 1, null, { x: 5, y: 5 }) === 0);

// === Hướng đèn theo số bóng ===
ok('1 bóng → 1 hướng +Y', JSON.stringify(H._rlLampDirs(1)) === JSON.stringify([[0, 1]]));
ok('2 bóng → ±Y', H._rlLampDirs(2).length === 2);
ok('3 bóng → 3 hướng', H._rlLampDirs(3).length === 3);
ok('4 bóng → 4 hướng', H._rlLampDirs(4).length === 4);
ok('0/rỗng → mặc định 1', H._rlLampDirs(0).length === 1 && H._rlLampDirs(NaN).length === 1);
ok('7 bóng → cap 4', H._rlLampDirs(7).length === 4);

// === Hình học block (DXF entities) ===
function draw(n) {
    const L = []; const push = (...a) => a.forEach(v => L.push(String(v)));
    H._rlDrawLampBlock(push, 0, 0, n, 1);
    return L;
}
const count = (L, ent) => L.filter((v, i) => v === ent && L[i - 1] === '0').length;
const b1 = draw(1), b2 = draw(2), b4 = draw(4);
ok('block có ô vuông (4 LINE trở lên)', count(b1, 'LINE') >= 4);
ok('block có tròn trong ô vuông', count(b1, 'CIRCLE') >= 1);
ok('nửa đen = SOLID', count(b1, 'SOLID') > 0);
ok('2 bóng có SOLID gấp đôi 1 bóng', count(b2, 'SOLID') === 2 * count(b1, 'SOLID'));
ok('4 bóng có SOLID gấp 4', count(b4, 'SOLID') === 4 * count(b1, 'SOLID'));
// 1 bóng: mọi điểm ellipse nằm phía +Y (y > 0.5)
const ys = []; for (let i = 0; i < b1.length - 1; i++) if (b1[i] === '20' || b1[i] === '21') ys.push(parseFloat(b1[i + 1]));
ok('1 bóng: hình học nằm trong |x|,|y| ≤ 4.5m', b1.every((v, i) => !['10', '11', '20', '21'].includes(b1[i - 1]) || Math.abs(parseFloat(v)) <= 4.5));
ok('1 bóng: có điểm xa trụ phía +Y (> 3.5m)', ys.some(y => y > 3.5) && !ys.some(y => y < -1));
ok('scale 0.5 thu nhỏ ≤ 2.3m', (() => { const L = []; H._rlDrawLampBlock((...a) => a.forEach(v => L.push(String(v))), 0, 0, 1, 0.5);
    return L.every((v, i) => !['10', '11', '20', '21'].includes(L[i - 1]) || Math.abs(parseFloat(v)) <= 2.3); })());

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
