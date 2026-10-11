// Căn thẳng tuyến đèn theo tim đường OSM — hàm thuần giữa @@ROADALIGN_START/END (cần @@ROADLAMP cho _rlIsDrivable)
// Run: node tests/align-poles-road.test.js
const fs = require('fs');
const path = require('path');

function load() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const lamp = html.match(/\/\/ @@ROADLAMP_START([\s\S]*?)\/\/ @@ROADLAMP_END/);
    const ra = html.match(/\/\/ @@ROADALIGN_START([\s\S]*?)\/\/ @@ROADALIGN_END/);
    if (!lamp) throw new Error('Thiếu block @@ROADLAMP');
    if (!ra) throw new Error('Chưa có block @@ROADALIGN_START/END trong index.html');
    return new Function(lamp[1] + ra[1] + '\nreturn { _raLocalFrame, _raRoadLines, _raPlanAlign, _raNearestOnLines };')();
}

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '✓ ' : '✗ ') + name); };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== Result: 0 pass / 1 fail ==='); process.exit(1); }

const F = H._raLocalFrame(10.78, 106.69);
// Dựng đường OSM từ toạ độ mét → định dạng _fetchOsmBasemap: { coords: [[lon,lat]...], tags }
const road = (ptsXY, tags) => ({ coords: ptsXY.map(([x, y]) => { const ll = F.toLL(x, y); return [ll.lon, ll.lat]; }), tags });
const lines = roads => H._raRoadLines(roads, F);
// Khoảng cách điểm → polyline (mét) và tham số dọc tuyến
function distAlong(px, py, pts) {
    let best = { d: Infinity, s: 0 }, acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L2));
        const d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
        if (d < best.d) best = { d, s: acc + t * L };
        acc += L;
    }
    return best;
}

// === Phép chiếu cục bộ ===
{
    const p = F.toXY(10.781, 106.692);
    const back = F.toLL(p.x, p.y);
    ok('toLL(toXY) trả đúng toạ độ (< 1e-9 độ)', Math.abs(back.lat - 10.781) < 1e-9 && Math.abs(back.lon - 106.692) < 1e-9);
    // Đối chiếu VN2000 (TM trên ellipsoid, k≈1 quanh TPHCM) — haversine dùng cầu nên lệch ~0.5% ở vĩ độ này
    const vnSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'vn2000.js'), 'utf8').replace(/^export /gm, '');
    const { convertLatLonToVn2000 } = new Function(vnSrc + '\nreturn { convertLatLonToVn2000 };')();
    const q = F.toXY(10.7835, 106.6935);
    const v1 = convertLatLonToVn2000(10.781, 106.692, 106.69, 1), v2 = convertLatLonToVn2000(10.7835, 106.6935, 106.69, 1);
    const dPlan = Math.hypot(q.x - p.x, q.y - p.y), dRef = Math.hypot(v2.x - v1.x, v2.y - v1.y);
    ok('khoảng cách phẳng lệch VN2000 (k0=1) < 0.05%', Math.abs(dPlan - dRef) / dRef < 0.0005);
}

// === Lọc đường ===
{
    const L = lines([road([[0, 0], [100, 0]], { highway: 'footway', name: 'Lối đi' }), road([[0, 0], [100, 0]], { highway: 'residential', name: 'A' })]);
    ok('bỏ footway, giữ residential', L.length === 1 && L[0].key === 'A');
}

// === Đường thẳng, 1 bên ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'residential', name: 'A' })];
    const poles = [[0, 5.2], [40, 4.6], [80, 5.5], [120, 4.9]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R1));
    ok('đường thẳng: không lỗi, chọn đường A', !plan.error && plan.roadKey === 'A');
    const D = (4.9 + 5.2) / 2;   // trung vị của 4.6, 4.9, 5.2, 5.5
    ok('đường thẳng: mọi trụ cách tim = trung vị 5.05 (±5cm)', plan.items.every(it => near(it.y, D)));
    ok('đường thẳng: x (dọc đường) giữ nguyên', plan.items.every((it, i) => near(it.x, poles[i].x)));
    ok('đường thẳng: mọi trụ được tick', plan.items.every(it => it.checked && it.flag === 'ok'));
    ok('đường thẳng: move đúng', near(plan.items[1].move, Math.abs(D - 4.6)));
}

// === Hai bên đường: căn riêng từng bên, không đẩy sang bên kia ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'residential', name: 'A' })];
    const poles = [[0, 5], [40, 6], [80, 5.5], [20, -4], [60, -5], [100, -4.4]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R1));
    const left = plan.items.slice(0, 3), right = plan.items.slice(3);
    ok('2 bên: bên trái về 5.5', left.every(it => near(it.y, 5.5)));
    ok('2 bên: bên phải về -4.4', right.every(it => near(it.y, -4.4)));
}

// === Trụ vắt qua tim do nhiễu GPS (dữ liệu thật BTX_BTX1) → vẫn là 1 hàng, không tách 2 bên ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'tertiary', name: 'A' })];
    const ys = [-5, -6, 0.5, -4, 0.8, -5.5, -2.4];
    const poles = ys.map((y, i) => ({ x: i * 30, y }));
    const plan = H._raPlanAlign(poles, lines(R1));
    ok('vắt qua tim: 1 hàng duy nhất', plan.groups.length === 1);
    ok('vắt qua tim: mọi trụ về y = trung vị có dấu (-4)', plan.items.every(it => near(it.y, -4)));
    ok('vắt qua tim: x giữ nguyên', plan.items.every((it, i) => near(it.x, i * 30)));
}

// === Sửa khoảng cách bằng tay (opts.offsets) ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'tertiary', name: 'A' })];
    const poles = [[0, 2], [40, 3], [80, 2.4]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R1), { offsets: [6] });
    ok('offsets [6]: mọi trụ về y = 6', plan.items.every(it => near(it.y, 6)));
    ok('offsets [6]: trả lại offset đã dùng', near(plan.groups[0].offset, 6));
    const plan2 = H._raPlanAlign([[0, 5], [40, 6], [20, -4], [60, -5]].map(([x, y]) => ({ x, y })), lines(R1), { offsets: [-7, null] });
    ok('2 hàng, chỉ sửa hàng 1 (phải): hàng 1 về -7, hàng 2 giữ trung vị 5.5',
        near(plan2.items[2].y, -7) && near(plan2.items[3].y, -7) && near(plan2.items[0].y, 5.5));
}

// === Đoạn đường đôi / nút giao: vị trí mới gần nhánh khác hơn → cờ 'junction', bỏ tick sẵn ===
{
    const R = [road([[-50, 0], [300, 0]], { highway: 'tertiary', name: 'A' }),
               road([[60, 8], [100, 8]], { highway: 'tertiary', name: 'A', oneway: 'yes' })];   // nhánh tách song song
    const poles = [[0, 3], [40, 3], [80, 3], [140, 3]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R), { offsets: [6] });
    ok('đường đôi: trụ x=80 bị cờ junction, không tick', plan.items[2].flag === 'junction' && !plan.items[2].checked);
    ok('đường đôi: trụ khác vẫn ok, y=6', [0, 1, 3].every(i => plan.items[i].flag === 'ok' && near(plan.items[i].y, 6)));
}

// === Đường cong (cung tròn R=200) ===
{
    const arc = []; for (let a = -0.6; a <= 0.6001; a += 0.02) arc.push([200 * Math.sin(a), 200 - 200 * Math.cos(a)]);
    const R1 = [road(arc, { highway: 'primary', name: 'Cong' })];
    // trụ phía ngoài cung (y âm phía tâm ngược) — lệch 6 ± noise
    const noise = [0.4, -0.3, 0.6, -0.5, 0.1, 0.2, -0.4];
    const poles = noise.map((nz, i) => {
        const a = -0.45 + i * 0.15, r = 200 + 6 + nz;
        return { x: r * Math.sin(a), y: 200 - r * Math.cos(a) };
    });
    const plan = H._raPlanAlign(poles, lines(R1));
    const before = poles.map(p => distAlong(p.x, p.y, arc));
    const after = plan.items.map(it => distAlong(it.x, it.y, arc));
    const D = after[0].d;
    ok('đường cong: mọi trụ cách tim bằng nhau (±5cm)', after.every(a => near(a.d, D)));
    ok('đường cong: D = trung vị 6.1', near(D, 6.1, 0.06));
    ok('đường cong: vị trí dọc tuyến giữ nguyên (±5cm)', after.every((a, i) => near(a.s, before[i].s)));
}

// === Trụ xa đường (>30m) + trụ dời lớn (>10m) ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'residential', name: 'A' })];
    const poles = [[0, 5], [40, 5.4], [80, 4.8], [120, 40], [160, 22]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R1));
    const far = plan.items[3], big = plan.items[4];
    ok('trụ 40m: flag far, không tick, không dời', far.flag === 'far' && !far.checked && far.x === 0 + 120 && far.y === 40);
    ok('trụ dời >10m: flag big, bỏ tick sẵn', big.flag === 'big' && !big.checked);
    ok('trụ far không kéo lệch trung vị (D vẫn = 5.2 với 4 trụ không far)', near(plan.items[0].y, (5 + 5.4) / 2));
}

// === Lỗi ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'residential', name: 'A' })];
    ok('chỉ 1 trụ dùng được → too_few', H._raPlanAlign([{ x: 0, y: 5 }, { x: 50, y: 60 }], lines(R1)).error === 'too_few');
    ok('không có đường → no_road', H._raPlanAlign([{ x: 0, y: 5 }, { x: 50, y: 5 }], []).error === 'no_road');
    ok('đường quá xa (>30m) → no_road', H._raPlanAlign([{ x: 0, y: 50 }, { x: 50, y: 50 }], lines(R1)).error === 'no_road');
}

// === 2 way cùng tên vẽ ngược chiều → bên đường vẫn nhất quán ===
{
    const R2 = [road([[0, 0], [100, 0]], { highway: 'residential', name: 'A' }),
                road([[200, 0], [100, 0]], { highway: 'residential', name: 'A' })];   // ngược chiều
    const poles = [[20, 5], [60, 5.6], [140, 4.6], [180, 5.2]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R2));
    ok('way ngược chiều: 4 trụ cùng 1 bên, cùng D', plan.items.every(it => near(it.y, (5 + 5.2) / 2)));
}

// === Chọn đường theo đa số; trụ gần đường khác vẫn chiếu lên đường được chọn ===
{
    const R = [road([[-50, 0], [300, 0]], { highway: 'residential', name: 'A' }),
               road([[100, -50], [100, 50]], { highway: 'residential', name: 'B' })];   // đường cắt ngang
    const poles = [[0, 5], [40, 5], [96, 6], [160, 5]].map(([x, y]) => ({ x, y }));   // trụ 3 gần B hơn (4m) nhưng thuộc tuyến A
    const plan = H._raPlanAlign(poles, lines(R));
    ok('đa số chọn A', plan.roadKey === 'A');
    ok('trụ gần đường B vẫn căn theo A', near(plan.items[2].y, 5) && near(plan.items[2].x, 96));
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
