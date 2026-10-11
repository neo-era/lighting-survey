// Căn thẳng tuyến đèn theo tim đường OSM — hàm thuần giữa @@ROADALIGN_START/END (cần @@ROADLAMP cho _rlIsDrivable)
// Run: node tests/align-poles-road.test.js
const fs = require('fs');
const path = require('path');

function load() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const lamp = html.match(/\/\/ @@ROADLAMP_START([\s\S]*?)\/\/ @@ROADLAMP_END/);
    const ra = html.match(/\/\/ @@ROADALIGN_START([\s\S]*?)\/\/ @@ROADALIGN_END/);
    const osm = html.match(/\/\/ @@OSMROAD_START([\s\S]*?)\/\/ @@OSMROAD_END/);
    if (!lamp || !osm) throw new Error('Thiếu block @@ROADLAMP / @@OSMROAD');
    if (!ra) throw new Error('Chưa có block @@ROADALIGN_START/END trong index.html');
    const names = ['_raLocalFrame', '_raRoadLines', '_raPlanAlign', '_raNearestOnLines', '_raRoadWidth', '_raTargetOffset', '_raFitCfg'];
    return new Function(lamp[1] + osm[1] + ra[1] + '\nreturn {' + names.map(n => `${n}: typeof ${n} === 'function' ? ${n} : null`).join(',') + '};')();
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
    // v162: nhánh cùng tên song song cách 8m = đoạn đường đôi → trụ ở đó căn theo TRỤC GIỮA (y=4) + 6 = 10
    ok('đoạn có nhánh song song cùng tên (đường đôi): trụ x=80 căn theo trục giữa → y = 10', near(plan.items[2].y, 10) && plan.items[2].dual);
    ok('đường đôi: trụ khác vẫn ok, y=6', [0, 1, 3].every(i => plan.items[i].flag === 'ok' && near(plan.items[i].y, 6)));
}

// === Review v158: trụ ngoài đầu mút đường cụt → cờ 'end', không dời dọc, không tính trung vị ===
{
    const R1 = [road([[0, 0], [100, 0]], { highway: 'residential', name: 'A' })];
    const poles = [[10, 5], [50, 5.4], [90, 4.8], [106, 5]].map(([x, y]) => ({ x, y }));   // trụ cuối vượt đầu mút 6m
    const plan = H._raPlanAlign(poles, lines(R1));
    ok('đầu mút: trụ x=106 cờ end, không tick, giữ nguyên', plan.items[3].flag === 'end' && !plan.items[3].checked && plan.items[3].x === 106);
    ok('đầu mút: trung vị chỉ tính 3 trụ (5.0)', plan.items.slice(0, 3).every(it => near(it.y, 5)));
}

// === Hẻm không tên cắt nhiều way nối tiếp → coi là 1 tuyến ===
{
    const R = [road([[0, 0], [60, 0]], { highway: 'service' }), road([[60, 0], [130, 0]], { highway: 'service' }),
               road([[130, 0], [200, 0]], { highway: 'service' })];
    const poles = [[10, 3], [50, 3.4], [90, 2.6], [120, 3.2], [170, 2.8]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R));
    ok('hẻm không tên 3 way: mọi trụ căn, không trụ nào cờ end/far', plan.items.every(it => it.flag === 'ok'));
    ok('hẻm không tên: x giữ nguyên, y = 3.0', plan.items.every((it, i) => near(it.x, poles[i].x) && near(it.y, 3)));
}
// Hẻm không tên có nhánh rẽ (nút bậc 3) → không gộp qua ngã ba, nhánh vuông góc vẫn tách riêng
{
    const L3 = lines([road([[0, 0], [60, 0]], { highway: 'service' }), road([[60, 0], [120, 0]], { highway: 'service' }),
                      road([[60, 0], [60, 80]], { highway: 'service' })]);
    ok('hẻm có ngã ba: không gộp 3 way thành 1', new Set(L3.map(l => l.key)).size === 3);
}

// === Đường chữ U ghép 3 way nối tiếp cùng chiều → bên đường nhất quán theo liên thông ===
{
    const a = [[0, 0], [200, 0]], b = [[200, 0], [220, 20], [200, 40]], c = [[200, 40], [0, 40]];   // c ngược chiều way dài nhất
    const R = [road(a, { highway: 'residential', name: 'U' }), road(b, { highway: 'residential', name: 'U' }), road(c, { highway: 'residential', name: 'U' })];
    // trụ ở phía NGOÀI chữ U: dưới nhánh a (y<0) và trên nhánh c (y>40) — cùng 1 phía so với chiều đi
    const poles = [[50, -5], [120, -5.5], [60, 45], [140, 44.6]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R));
    ok('chữ U: 1 hàng (không tách nhầm 2 phía)', plan.groups.length === 1);
    ok('chữ U: nhánh dưới về y=-5, nhánh trên về y=45 (cùng phía ngoài, trung vị 5)',
        near(plan.items[0].y, -5) && near(plan.items[1].y, -5) && near(plan.items[2].y, 45) && near(plan.items[3].y, 45));
}

// === 5 trụ 1 bên + 1 trụ lẻ bên kia (không đủ 2 để tách hàng) → cờ cross, không tự kéo qua tim ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'residential', name: 'A' })];
    const poles = [[0, 4], [40, 4.2], [80, 3.8], [120, 4.1], [160, -4], [200, 3.9]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R1));
    ok('trụ lẻ bên kia: cờ cross, bỏ tick', plan.items[4].flag === 'cross' && !plan.items[4].checked);
    ok('trụ lẻ bên kia: các trụ khác vẫn ok', [0, 1, 2, 3, 5].every(i => plan.items[i].flag === 'ok'));
}

// === offsets không hợp lệ ===
{
    const R1 = [road([[-50, 0], [300, 0]], { highway: 'residential', name: 'A' })];
    const poles = [[0, 2], [40, 3], [80, 2.4]].map(([x, y]) => ({ x, y }));
    let e1 = null; try { H._raPlanAlign(poles, lines(R1), { offsets: null }); } catch (e) { e1 = e; }
    ok('offsets: null không crash', !e1);
    ok('offsets: [NaN] → dùng trung vị', near(H._raPlanAlign(poles, lines(R1), { offsets: [NaN] }).items[0].y, 2.4));
    ok('offsets: [0] → về đúng tim', near(H._raPlanAlign(poles, lines(R1), { offsets: [0] }).items[0].y, 0));
}

// === v159: Mốc căn — mép đường / tim đường, phía, bề rộng ===
{
    const has = H._raRoadWidth && H._raTargetOffset;
    ok('có _raRoadWidth + _raTargetOffset', !!has);
    if (has) {
        // Bề rộng: tag width → lanes → cấp đường (tertiary = 10m); trung vị theo chiều dài
        const Lw = lines([road([[0, 0], [100, 0]], { highway: 'tertiary', name: 'A' }),
                          road([[100, 0], [120, 0]], { highway: 'tertiary', name: 'A', width: '6 m' })]);
        ok('bề rộng line lấy từ OSM (tertiary 10, width "6 m")', Lw[0].width === 10 && Lw[1].width === 6);
        ok('bề rộng tuyến = trung vị theo chiều dài (10)', H._raRoadWidth(Lw, 'A') === 10);
        ok('bề rộng: lanes=3 → 10.5', lines([road([[0, 0], [50, 0]], { highway: 'residential', name: 'B', lanes: '3' })])[0].width === 10.5);

        const T = H._raTargetOffset;
        ok('mép +0.5, phía -1, rộng 10 → -5.5', near(T({ ref: 'mep', side: -1, value: 0.5, width: 10 }).offset, -5.5));
        ok('mép -1 (vào lòng đường), phía +1, rộng 10 → 4', near(T({ ref: 'mep', side: 1, value: -1, width: 10 }).offset, 4));
        ok('tim 3, phía +1 → 3', near(T({ ref: 'tim', side: 1, value: 3, width: 10 }).offset, 3));
        ok('tim 0 → 0 (đúng tim)', near(T({ ref: 'tim', side: -1, value: 0, width: 10 }).offset, 0));
        ok('lỗi: bề rộng 0', T({ ref: 'mep', side: 1, value: 0.5, width: 0 }).error === 'width');
        ok('lỗi: bề rộng 70', T({ ref: 'mep', side: 1, value: 0.5, width: 70 }).error === 'width');
        ok('lỗi: mép -6 với đường 10 (vượt qua tim)', T({ ref: 'mep', side: 1, value: -6, width: 10 }).error === 'inside');
        ok('lỗi: tim âm', T({ ref: 'tim', side: 1, value: -1, width: 10 }).error === 'value');
        ok('lỗi: khoảng cách không phải số', T({ ref: 'mep', side: 1, value: NaN, width: 10 }).error === 'value');

        // Tuyến vắt qua tim (dữ liệu thật BTX_BTX1) → mép +0.5 phía -1 → mọi trụ cách tim 5.5 cùng phía
        const R1 = [road([[-50, 0], [400, 0]], { highway: 'tertiary', name: 'A' })];
        const ys = [-5, -6, 0.5, -4, 0.8, -5.5, -2.4, 5.84];
        const poles = ys.map((y, i) => ({ x: i * 30, y }));
        const base = H._raPlanAlign(poles, lines(R1));
        ok('phía mặc định = phía nhiều trụ hơn (-1)', base.groups[0].sidePref === -1);
        const S = T({ ref: 'mep', side: -1, value: 0.5, width: 10 }).offset;
        const plan = H._raPlanAlign(poles, lines(R1), { offsets: [S], crossMin: 5 });
        const okItems = plan.items.filter(it => it.flag === 'ok');
        ok('mép: các trụ ok đều ở y=-5.5', okItems.length >= 6 && okItems.every(it => near(it.y, -5.5)));
        ok('mép: trụ +0.8 sát tim vẫn được kéo về vỉa hè (không cross)', plan.items[4].flag === 'ok' && near(plan.items[4].y, -5.5));
        ok('mép: trụ +5.84 (hẳn bên kia, > ½ rộng) cờ cross', plan.items[7].flag === 'cross' && !plan.items[7].checked);
    }
}

// === Review v159: kẹp cấu hình về hợp lệ + cờ straddle + crossMin theo từng hàng ===
{
    const Fit = H._raFitCfg;
    ok('có _raFitCfg', !!Fit);
    if (Fit) {
        ok('mép -4 nhớ từ đường 10m, mở trên đường 6m → kẹp -3', Fit({ ref: 'mep', side: 1, value: -4 }, 6).value === -3);
        ok('mép 28 trên đường 10m (5+28 > 30) → kẹp 25', Fit({ ref: 'mep', side: 1, value: 28 }, 10).value === 25);
        ok('value null/không phải số → mặc định 0.5 (mép)', Fit({ ref: 'mep', side: 1, value: null }, 10).value === 0.5);
        ok('tim -2 → 0; tim 40 → 30', Fit({ ref: 'tim', side: 1, value: -2 }, 10).value === 0 && Fit({ ref: 'tim', side: 1, value: 40 }, 10).value === 30);
        ok('cfg hợp lệ giữ nguyên', Fit({ ref: 'mep', side: -1, value: 0.5 }, 10).value === 0.5);
        ok('kết quả kẹp luôn hợp lệ với _raTargetOffset', !H._raTargetOffset(Object.assign(Fit({ ref: 'mep', side: 1, value: -9 }, 6), { width: 6 })).error);
    }
    // Trụ khác phía cách tim 2..crossMin: không tự kéo qua — cờ straddle (bỏ tick, vẫn tick tay được)
    const R1 = [road([[-50, 0], [400, 0]], { highway: 'residential', name: 'A' })];
    const poles = [[0, -4], [30, -4.5], [60, 3.6], [90, -4.2], [120, 0.8]].map(([x, y]) => ({ x, y }));
    const plan = H._raPlanAlign(poles, lines(R1), { offsets: [-4.5], crossMin: 4 });
    ok('straddle: trụ +3.6 (2 < 3.6 ≤ 4) cờ straddle, bỏ tick', plan.items[2].flag === 'straddle' && !plan.items[2].checked);
    ok('straddle: trụ +0.8 sát tim vẫn ok', plan.items[4].flag === 'ok');
    // crossMin theo từng hàng
    const two = [[0, 6], [40, 6.5], [20, -6], [60, -6.4], [80, -6.2], [100, 3]].map(([x, y]) => ({ x, y }));
    const p2 = H._raPlanAlign(two, lines(R1), { crossMin: [2, 2] });
    ok('crossMin dạng mảng không crash, 2 hàng', p2.groups.length === 2);
}

// === v162: ĐƯỜNG ĐÔI (2 tim 1 chiều song song, cùng tên) → căn theo TRỤC GIỮA ===
{
    // Chiều đi y=+6 hướng +x, chiều về y=-6 hướng -x (oneway), mỗi chiều 7m (lanes 2)
    const dual = () => [road([[-100, 6], [300, 6]], { highway: 'primary', name: 'NTMK', oneway: 'yes', lanes: '2' }),
                        road([[300, -6], [-100, -6]], { highway: 'primary', name: 'NTMK', oneway: 'yes', lanes: '2' })];
    // Trụ trên dải phân cách, lệch zigzag quanh trục y=0
    const ys = [1, -2, 0.5, -1.5, 2, -0.8];
    const poles = ys.map((y, i) => ({ x: i * 40, y }));
    const plan = H._raPlanAlign(poles, lines(dual()));
    ok('đường đôi: 1 hàng, các trụ dải phân cách thẳng hàng (cùng y ±5cm)', plan.groups.length === 1 && plan.items.every(it => near(it.y, plan.items[0].y)));
    ok('đường đôi: trục giữa y=0 → trung vị có dấu ≈ 0.25', near(plan.items[0].y, (0.5 + -0.8) / 2 + 0.4, 0.5) && Math.abs(plan.items[0].y) < 1);
    ok('đường đôi: x (dọc tuyến) giữ nguyên', plan.items.every((it, i) => near(it.x, i * 40)));
    ok('đường đôi: plan báo dual + khoảng cách 2 tim 12m', plan.dual && near(plan.dual.gap, 12, 0.1));
    // Mốc mép phía +y: ½ khoảng cách 2 tim (6) + ½ bề rộng 1 chiều (3.5) + 0.5 = 10
    const pe = H._raPlanAlign(poles, lines(dual()), { edge: [{ side: 1, value: 0.5 }] });
    ok('đường đôi + mép +0.5 phía +y → mọi trụ y = 10 (mép NGOÀI cả con đường)', pe.items.filter(it => it.flag !== 'far').every(it => near(it.y, 10)));
    const pw = H._raPlanAlign(poles, lines(dual()), { edge: [{ side: -1, value: 0.5 }], width: 8 });
    ok('đường đôi + mép phía -y, bề rộng 1 chiều sửa = 8 → y = -(6+4+0.5) = -10.5', pw.items.every(it => near(it.y, -10.5)));
}
{
    // Trụ trên vỉa hè ngoài phía +y (gần chiều đi) → vẫn căn theo trục, không cờ cross
    const dual = [road([[-100, 6], [300, 6]], { highway: 'primary', name: 'NTMK', oneway: 'yes', lanes: '2' }),
                  road([[300, -6], [-100, -6]], { highway: 'primary', name: 'NTMK', oneway: 'yes', lanes: '2' })];
    const poles = [10.5, 9.6, 11, 10.2].map((y, i) => ({ x: i * 40, y }));
    const pe = H._raPlanAlign(poles, lines(dual), { edge: [{ side: 1, value: 0.5 }] });
    ok('vỉa hè ngoài đường đôi: mọi trụ ok, y = 10', pe.items.every(it => it.flag === 'ok' && near(it.y, 10)));
}
{
    // Đoạn 1 tim (x<0, rộng 14) nối đoạn đường đôi (x>0) → mỗi đoạn mép theo hình dạng của chính nó
    const R = [road([[-200, 0], [0, 0]], { highway: 'primary', name: 'NTMK', lanes: '4' }),
               road([[0, 0], [20, 6], [300, 6]], { highway: 'primary', name: 'NTMK', oneway: 'yes', lanes: '2' }),
               road([[300, -6], [20, -6], [0, 0]], { highway: 'primary', name: 'NTMK', oneway: 'yes', lanes: '2' })];
    const poles = [[-150, 8], [-80, 7], [80, 10.5], [160, 9.5]].map(([x, y]) => ({ x, y }));
    const pe = H._raPlanAlign(poles, lines(R), { edge: [{ side: 1, value: 0.5 }] });
    ok('đoạn 1 tim: mép = 14/2 + 0.5 = 7.5', near(pe.items[0].y, 7.5) && near(pe.items[1].y, 7.5));
    ok('đoạn đường đôi: mép = 6 + 3.5 + 0.5 = 10', near(pe.items[2].y, 10) && near(pe.items[3].y, 10));
}

// === v164: tuyến chạy qua 2 đường → căn theo đường của TRỤ ĐƯỢC BẤM (opts.roadKey) ===
{
    const R = [road([[-200, 0], [0, 0]], { highway: 'secondary', name: 'Lý Tự Trọng' }),
               road([[0, 0], [0, 300]], { highway: 'secondary', name: 'Lê Thánh Tôn' })];
    // 5 trụ dọc Lý Tự Trọng (đa số), 3 trụ dọc Lê Thánh Tôn
    const poles = [[-190, 5], [-150, 4], [-110, 6], [-70, 5], [-40, 4.6], [6, 80], [5, 140], [7, 200]].map(([x, y]) => ({ x, y }));
    const def = H._raPlanAlign(poles, lines(R));
    ok('mặc định: đa số chọn Lý Tự Trọng', def.roadKey === 'Lý Tự Trọng');
    const forced = H._raPlanAlign(poles, lines(R), { roadKey: 'Lê Thánh Tôn' });
    ok('roadKey = Lê Thánh Tôn → căn 3 trụ trên Lê Thánh Tôn', forced.roadKey === 'Lê Thánh Tôn'
        && [5, 6, 7].every(i => forced.items[i].flag === 'ok' && near(forced.items[i].x, 6)));
    ok('trụ trên Lý Tự Trọng → xa đường, không dời', [0, 1, 2].every(i => forced.items[i].flag === 'far'));
    ok('roadKey không tồn tại → quay về bỏ phiếu đa số', H._raPlanAlign(poles, lines(R), { roadKey: 'KHÔNG CÓ' }).roadKey === 'Lý Tự Trọng');
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
