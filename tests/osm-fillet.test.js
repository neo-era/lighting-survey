// Bo góc mép đường tại giao lộ (DXF ARC) — hàm thuần trong @@OSMROAD. Run: node tests/osm-fillet.test.js
const fs = require('fs');
const path = require('path');

function load() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const m = html.match(/\/\/ @@OSMROAD_START([\s\S]*?)\/\/ @@OSMROAD_END/);
    if (!m) throw new Error('Thiếu block @@OSMROAD');
    const names = ['_offsetPolyline', '_corridorIndex', '_trimEdgeRun', '_osmRoadClass', '_filletCorners', 'OSM_CORNER_RADIUS_DEFAULTS'];
    return new Function(m[1] + '\nreturn {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : null`).join(',') + '};')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const near = (a, b, t = 0.05) => Math.abs(a - b) <= t;
const H = load();
if (!H._filletCorners || !H._osmRoadClass) { console.log('✗ chưa có _filletCorners / _osmRoadClass'); console.log('\n=== Result: 0 pass / 1 fail ==='); process.exit(1); }

const R = { major: 12, secondary: 10, residential: 6, service: 3 };
ok('mặc định bán kính có đủ 4 cấp', ['major', 'secondary', 'residential', 'service'].every(k => H.OSM_CORNER_RADIUS_DEFAULTS[k] >= 0));
ok('cấp đường: primary→major, tertiary→secondary, residential, service, construction theo tag construction',
    H._osmRoadClass({ highway: 'primary' }) === 'major' && H._osmRoadClass({ highway: 'tertiary' }) === 'secondary'
    && H._osmRoadClass({ highway: 'unclassified' }) === 'residential' && H._osmRoadClass({ highway: 'service' }) === 'service'
    && H._osmRoadClass({ highway: 'construction', construction: 'primary' }) === 'major');

// Dựng mép đường đã cắt nút giao giống _drawOsmBasemapInDxf
function edgeRuns(chains) {
    const corr = H._corridorIndex(chains.map((c, i) => ({ pts: c.pts, hw: c.width / 2, id: i, layer: 0 })), 25);
    const runs = [];
    chains.forEach((c, i) => [1, -1].forEach(side => {
        H._trimEdgeRun(H._offsetPolyline(c.pts, side * c.width / 2), corr, i, 0).forEach(pts => runs.push({ pts, chain: i, cls: c.cls }));
    }));
    return runs;
}
const P = (x, y) => ({ x, y });
// Distance from point to infinite line through segment ab
const lineDist = (p, a, b) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);

// === Ngã tư vuông: A ngang rộng 10 (secondary), B dọc rộng 6 (residential) ===
{
    const chains = [{ pts: [P(-100, 0), P(100, 0)], width: 10, cls: 'secondary' }, { pts: [P(0, -100), P(0, 100)], width: 6, cls: 'residential' }];
    const runs = edgeRuns(chains);
    ok('ngã tư: 8 đoạn mép sau cắt nút giao', runs.length === 8);
    const res = H._filletCorners(runs, R);
    ok('ngã tư: 4 cung bo góc', res.arcs.length === 4);
    ok('bán kính = cấp lớn hơn (secondary 10)', res.arcs.every(a => near(a.r, 10)));
    ok('góc vuông → mỗi cung quét 90°', res.arcs.every(a => near(((a.end - a.start + 360) % 360), 90, 0.5)));
    // Tâm cung cách 2 mép đúng R: mép A ở y=±5, mép B ở x=±3 → tâm (±13, ±15)
    ok('tâm cung cách mép A và mép B đúng R (±5cm)', res.arcs.every(a => near(Math.abs(a.cy) - 5, 10) && near(Math.abs(a.cx) - 3, 10)));
    // Đầu mút đoạn mép trùng điểm tiếp xúc của cung (không hở, không chồng)
    const ends = res.runs.flatMap(r => [r.pts[0], r.pts[r.pts.length - 1]]);
    const arcEnds = res.arcs.flatMap(a => [a.start, a.end].map(d => P(a.cx + a.r * Math.cos(d * Math.PI / 180), a.cy + a.r * Math.sin(d * Math.PI / 180))));
    ok('mọi đầu cung trùng 1 đầu đoạn mép (±1cm)', arcEnds.every(q => ends.some(e => Math.hypot(e.x - q.x, e.y - q.y) < 0.01)));
    ok('đoạn mép A rút ngắn đúng R+3 tính từ tim B: đầu mút ở |x| = 13', res.runs.filter(r => r.chain === 0).every(r => [r.pts[0], r.pts[r.pts.length - 1]].some(p => near(Math.abs(p.x), 13)) ));
}
// === Bán kính cấp lớn hơn = 0 → không bo ===
{
    const chains = [{ pts: [P(-100, 0), P(100, 0)], width: 10, cls: 'secondary' }, { pts: [P(0, -100), P(0, 100)], width: 6, cls: 'residential' }];
    const runs = edgeRuns(chains);
    const res = H._filletCorners(runs, Object.assign({}, R, { secondary: 0 }));
    ok('cấp lớn hơn đặt 0 → không có cung, đoạn mép giữ nguyên', res.arcs.length === 0 && res.runs.length === runs.length
        && res.runs.every((r, i) => r.pts.length === runs[i].pts.length));
}
// === Góc xiên 45° ===
{
    const d = 100 / Math.SQRT2;
    const chains = [{ pts: [P(-100, 0), P(100, 0)], width: 8, cls: 'residential' }, { pts: [P(-d, -d), P(d, d)], width: 8, cls: 'residential' }];
    const res = H._filletCorners(edgeRuns(chains), R);
    ok('ngã tư xiên: 4 cung, bán kính 6', res.arcs.length === 4 && res.arcs.every(a => near(a.r, 6)));
    const sweeps = res.arcs.map(a => Math.round(((a.end - a.start + 360) % 360))).sort((a, b) => a - b);
    ok('góc nhọn 45° → cung quét 135°; góc tù 135° → quét 45°', sweeps.join() === '45,45,135,135');
}
// === Đoạn mép quá ngắn → tự giảm bán kính cho vừa ===
{
    // Hai đường nhánh song song sát nhau cắt đường chính: đoạn mép đường chính giữa 2 nhánh chỉ dài ~4m
    const chains = [{ pts: [P(-100, 0), P(100, 0)], width: 10, cls: 'major' },
                    { pts: [P(-5, 0), P(-5, 100)], width: 6, cls: 'residential' }, { pts: [P(5, 0), P(5, 100)], width: 6, cls: 'residential' }];
    const res = H._filletCorners(edgeRuns(chains), R);
    ok('đoạn mép ngắn: vẫn bo nhưng giảm bán kính (≤ 4m), không chồng nhau', res.arcs.length >= 2 && res.arcs.filter(a => Math.abs(a.cx) < 5).every(a => a.r <= 4 + 1e-6));
    ok('không còn đoạn mép độ dài âm / đảo chiều', res.runs.every(r => r.pts.length >= 2));
}
// === OSM có nút sát giao lộ (đoạn cuối 1m, các đoạn sau thẳng hàng) → vẫn bo đủ bán kính ===
{
    const runs = [{ pts: [P(-60, 0), P(-30, 0.3), P(-1, 0), P(0, 0)], chain: 0, cls: 'major' },
                  { pts: [P(0, 0), P(0, 1.2), P(0.2, 60)], chain: 1, cls: 'major' }];
    const res = H._filletCorners(runs, R);
    ok('nút OSM sát góc: vẫn bo R≈12 (đi qua đoạn gần thẳng hàng)', res.arcs.length === 1 && near(res.arcs[0].r, 12, 0.3));
    ok('các đỉnh nằm trong phần bị bo đã bỏ, đầu mép = điểm tiếp xúc', res.runs[0].pts.every(p => p.x <= -11.5) && res.runs[1].pts.every(p => p.y >= 11.5));
}
// === Review v161 ===
{
    // Đường bẻ 25° tại nút chia chuỗi, CÙNG TÊN → không phải giao lộ, không bo
    const runs = [{ pts: [P(-50, 0), P(0, 0)], chain: 0, cls: 'major', name: 'Lê Duẩn' },
                  { pts: [P(0, 0), P(45, 21)], chain: 1, cls: 'major', name: 'Lê Duẩn' }];
    ok('cùng tên đường (chỗ bẻ tại nút chia chuỗi) → không bo', H._filletCorners(runs, R).arcs.length === 0);
    // Đầu mút do cắt KHUNG bản vẽ → không ghép
    const clip = { minX: -100, maxX: 0, minY: -100, maxY: 100 };
    const runs2 = [{ pts: [P(-50, 0), P(0, 0)], chain: 0, cls: 'major' }, { pts: [P(0, 0.2), P(-40, 30)], chain: 1, cls: 'major' }];
    ok('đầu mút nằm trên mép khung → không bo', H._filletCorners(runs2, R, 0.5, clip).arcs.length === 0);
    // 3 đầu mút gần nhau: cặp gần nhất không hợp lệ (song song) không được chiếm chỗ cặp đúng
    const runs3 = [{ pts: [P(-50, 0), P(0, 0)], chain: 0, cls: 'major' },
                   { pts: [P(0.1, 0), P(50, 0)], chain: 1, cls: 'major' },          // thẳng hàng với run 0, gần nhất nhưng không bo được
                   { pts: [P(0, 0.3), P(0, 50)], chain: 2, cls: 'major' }];        // vuông góc — cặp đúng với run 0
    const r3 = H._filletCorners(runs3, R);
    ok('3 đầu mút gần nhau: vẫn bo được cặp vuông góc', r3.arcs.length === 1 && near(r3.arcs[0].r, 12, 0.3));
    // Hiệu năng: 4000 đầu mút rải rác < 300ms
    const many = []; for (let i = 0; i < 2000; i++) many.push({ pts: [P(i * 7, (i % 13) * 9), P(i * 7 + 3, (i % 13) * 9 + 4)], chain: i, cls: 'residential' });
    const t0 = Date.now(); H._filletCorners(many, R); const dt = Date.now() - t0;
    ok('2000 đoạn mép: ghép cặp nhanh (< 300ms, thực tế ' + dt + 'ms)', dt < 300);
}
// === Gần thẳng hàng (> 170°) → không bo ===
{
    const runs = [{ pts: [P(-50, 0), P(0, 0)], chain: 0, cls: 'major' }, { pts: [P(0, 0), P(50, 2)], chain: 1, cls: 'major' }];
    ok('2 mép gần thẳng hàng → không bo', H._filletCorners(runs, R).arcs.length === 0);
}
// === Cùng 1 chuỗi (2 mép của chính nó) → không ghép ===
{
    const runs = [{ pts: [P(-50, 0), P(0, 0)], chain: 0, cls: 'major' }, { pts: [P(0, 0), P(0, 50)], chain: 0, cls: 'major' }];
    ok('2 đầu mút cùng chuỗi → không bo', H._filletCorners(runs, R).arcs.length === 0);
}
// === Không làm thay đổi mảng đầu vào ===
{
    const runs = [{ pts: [P(-50, 0), P(0, 0)], chain: 0, cls: 'major' }, { pts: [P(0, 0), P(0, 50)], chain: 1, cls: 'major' }];
    const before = JSON.stringify(runs);
    const res = H._filletCorners(runs, R);
    ok('góc vuông đơn: 1 cung R=12', res.arcs.length === 1 && near(res.arcs[0].r, 12));
    ok('không sửa mảng đầu vào', JSON.stringify(runs) === before);
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
