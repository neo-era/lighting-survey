// Tự xoay bản vẽ cho vừa khung — hàm thuần @@CADROTATE (src/core/cad-rotate.js)
// Run: node tests/cad-rotate.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();
    const m = src.match(/\/\/ @@CADROTATE_START([\s\S]*?)\/\/ @@CADROTATE_END/);
    const q = src.match(/\/\/ @@QBTTITLE_START([\s\S]*?)\/\/ @@QBTTITLE_END/);
    if (!m) throw new Error('Chưa có block @@CADROTATE_START/END');
    return new Function(m[1] + (q ? q[1] : '') + '\nreturn { _rotMake, _rotTextAngle, _rotBounds, _rotBestAngle, _rotScoreA3, _qbtFitFrame, _qbtLegendSize };')();
}
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-6);

// ── phép xoay ──
const r90 = H._rotMake(0, 0, 90);
ok('xoay 90°: (1,0) → (0,1)', near(r90.xf(1, 0)[0], 0) && near(r90.xf(1, 0)[1], 1));
const rc = H._rotMake(10, 20, 180);
ok('xoay 180° quanh (10,20): (11,20) → (9,20)', near(rc.xf(11, 20)[0], 9) && near(rc.xf(11, 20)[1], 20));
const r0 = H._rotMake(5, 5, 0);
ok('0° = đồng nhất (trả đúng toạ độ cũ)', r0.xf(123.456, 789.012)[0] === 123.456 && r0.xf(123.456, 789.012)[1] === 789.012);
const r37 = H._rotMake(3, -2, 37);
const a = r37.xf(10, 4), b = r37.xf(-6, 15);
ok('giữ nguyên khoảng cách', near(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(16, 11), 1e-9));

// ── góc chữ đọc được ──
ok('chữ 0° xoay 90° → 90°', H._rotTextAngle(0, 90) === 90);
ok('chữ 30° xoay 90° → -60° (không lộn ngược)', near(H._rotTextAngle(30, 90), -60));
ok('chữ 80° xoay -90° → -10°', near(H._rotTextAngle(80, -90), -10));
ok('chữ 0° xoay 180° → 0°', H._rotTextAngle(0, 180) === 0);
ok('luôn trong (-90, 90]', [[45, 120], [-89, -5], [90, 0], [170, 15]].every(([x, d]) => { const v = H._rotTextAngle(x, d); return v > -90 && v <= 90; }));

// ── chọn góc ──
const score = H._rotScoreA3(0, 0);
const line = (dx, dy, n) => Array.from({ length: n }, (_, i) => ({ x: 600000 + i * dx, y: 1190000 + i * dy }));
const vert = line(0.5, 30, 15);   // tuyến dọc ~420 m
const rv = H._rotBestAngle(vert, score, { pad: 5 });
ok('tuyến dọc → xoay ±90°', Math.abs(rv.deg) === 90, rv);
ok('… và lợi hơn 10%', rv.gain > 1.1, rv);
const hor = line(30, 0.5, 15);
ok('tuyến ngang → giữ nguyên 0°', H._rotBestAngle(hor, score, { pad: 5 }).deg === 0);
const diag = line(25, 25, 15);
ok('tuyến chéo 45° vừa khung A3 sẵn (xoay không lợi 10%) → giữ 0°', H._rotBestAngle(diag, score, { pad: 5 }).deg === 0);
const steep = line(11, 30, 15);   // dốc ~70°
const rs = H._rotBestAngle(steep, score, { pad: 5 });
ok('tuyến dốc ~70° → xoay về nằm ngang (≈ -70°), không đặt chéo tờ', Math.abs(rs.deg + 70) <= 2, rs);
// cụm gần vuông: xoay không lợi đủ 10% → giữ nguyên
const blob = [];
for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) blob.push({ x: 600000 + i * 40 + (j % 2) * 3, y: 1190000 + j * 40 });
ok('cụm gần vuông (lợi < 10%) → giữ 0°', H._rotBestAngle(blob, score, { pad: 5 }).deg === 0);
// gần dọc 80° → ưu tiên tròn 90° nếu chỉ kém ≤ 3%
const nearV = line(5, 30, 15);
const rn = H._rotBestAngle(nearV, score, { pad: 5 });
ok('tuyến lệch dọc ~9° → góc tốt nhất hoặc ±90 (không quá 3% kém)', rn.deg !== 0 && rn.gain > 1.1, rn);
ok('điểm < 2 → không xoay', H._rotBestAngle([{ x: 1, y: 2 }], score).deg === 0 && H._rotBestAngle([], score).deg === 0);
ok('bỏ điểm NaN', H._rotBestAngle([{ x: NaN, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 400 }], score, { pad: 5 }).deg !== 0);

// ── mẫu QBT: thước đo = hệ số khung kk ──
const qscore = (b, ptsR) => H._qbtFitFrame(b, ptsR, 1, 15).kk;
const rq = H._rotBestAngle(vert, qscore, { pad: 5 });
const kk0 = H._qbtFitFrame(H._rotBounds(vert, H._rotMake(0, 0, 0), 5), vert, 1, 15).kk;
ok('QBT: tuyến dọc 420 m → xoay ±90°, khung nhỏ lại', Math.abs(rq.deg) === 90 && rq.gain > 1.1, { rq, kk0 });

// ── căn giữa theo chiều dọc (opts.center) ──
{
    const flat = line(30, 0, 15).map(p => ({ x: p.x, y: p.y }));   // tuyến ngang 420 m
    const b0 = { minX: 600000 - 5, maxX: 600000 + 425, minY: 1190000 - 5, maxY: 1190000 + 5 };
    const A = H._qbtFitFrame(Object.assign({}, b0), flat, 1, 15);
    const C = H._qbtFitFrame(Object.assign({}, b0), flat, 1, 15, { center: true });
    ok('center: cùng kk (khung không to ra)', near(A.kk, C.kk, 1e-9), [A.kk, C.kk]);
    ok('center: khung dời lên (nội dung không còn dính sát đỉnh)', C.bounds.maxY > A.bounds.maxY + 1, [A.bounds.maxY, C.bounds.maxY]);
    const shift = C.bounds.maxY - A.bounds.maxY;                  // khung dời lên
    const tbTopC = (C.bounds.minY - 15) + 52.9 * C.kk;              // đỉnh khung tên sau căn
    const lg = H._qbtLegendSize(C.kk), lgLeft = C.bounds.maxX + 15 - lg.w, lgTop = tbTopC + lg.h + 8 * C.kk;
    let rest = (b0.minY - 15) - tbTopC;                              // trống còn lại phía dưới (ràng buộc chặt nhất)
    for (const p of flat) if (p.x + 12 * C.kk >= lgLeft) rest = Math.min(rest, p.y - lgTop);
    ok('center: phần dư chia đôi (dời lên = trống còn dưới, tính cả bảng ký hiệu)', shift > 1 && rest >= 0 && near(shift, rest, 1e-6), { shift, rest });
    const D = H._qbtFitFrame(Object.assign({}, b0), flat, 1, 15, { center: false });
    ok('center tắt → giống hệt bản cũ', JSON.stringify(D) === JSON.stringify(A));
}

// ── khung bao sau xoay ──
const bb = H._rotBounds([{ x: 0, y: 0 }, { x: 0, y: 100 }], H._rotMake(0, 50, 90), 5);
ok('khung bao tuyến dọc sau xoay 90° nằm ngang (rộng 110, cao 10)', near(bb.maxX - bb.minX, 110) && near(bb.maxY - bb.minY, 10), bb);

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
