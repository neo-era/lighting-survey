// Ký hiệu tủ điều khiển khi xuất CAD: chữ nhật ngang 1.55:1 + đường chéo (dưới-trái → trên-phải)
// + tam giác trên-trái GẠCH CHÉO bằng LINE (DXF R12 không có HATCH). Mọi tủ dùng chung block SYM_CAB.
// Run: node tests/cabinet-block.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const row = (id, name, lat, lon, type, tu, parent, state) => {
    const r = new Array(30).fill('');
    Object.assign(r, { 0: id, 1: name, 2: String(lat), 3: String(lon), 6: String(type), 7: tu, 14: parent, 29: state || '' });
    return r;
};
sb.ctx.__rows = [new Array(30).fill('h'),
    row('T0', 'TU1', 10.853, 106.672, 5, 'TU1', '', 'thu'),
    row('T9', 'TU2', 10.856, 106.676, 6, 'TU2', '', 'moi_led'),
    row('T8', 'TU3', 10.851, 106.670, 5, 'TU3', '', ''),
    row('T1', 'P1', 10.8531, 106.6723, 1, 'TU1', 'TU1'),
    row('T2', 'P2', 10.8532, 106.6726, 1, 'TU1', 'P1'),
    row('T3', 'Q1', 10.8561, 106.6763, 1, 'TU2', 'TU2')];
sb.run('loadedData = __rows;');
const opts = id => ({ templateId: id, metadata: {}, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
    outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75 });

function parse(dxf) {
    const L = dxf.split('\r\n'), P = [];
    for (let i = 0; i + 1 < L.length; i += 2) P.push([L[i].trim(), L[i + 1]]);
    const ents = [];
    let blk = null;
    for (let i = 0; i < P.length; i++) {
        if (P[i][0] !== '0') continue;
        const e = { t: P[i][1], g: {} };
        for (let j = i + 1; j < P.length && P[j][0] !== '0'; j++) if (!(P[j][0] in e.g)) e.g[P[j][0]] = P[j][1];
        if (e.t === 'BLOCK') { blk = e.g['2']; continue; }
        if (e.t === 'ENDBLK') { blk = null; continue; }
        e.blk = blk;
        ents.push(e);
    }
    return ents;
}
const seg = e => [+e.g['10'], +e.g['20'], +e.g['11'], +e.g['21']];
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t;

// Kiểm hình học 1 tủ (tâm cx,cy, cao h) trong tập LINE; trả { frame, diag, hatch, hatchInside }
function checkCabinet(lines, cx, cy, h) {
    const w = h * 1.55, x1 = cx - w / 2, x2 = cx + w / 2, y1 = cy - h / 2, y2 = cy + h / 2;
    const has = (ax, ay, bx, by) => lines.some(l => { const [p, q, r, s] = seg(l);
        return (near(p, ax) && near(q, ay) && near(r, bx) && near(s, by)) || (near(p, bx) && near(q, by) && near(r, ax) && near(s, ay)); });
    const frame = has(x1, y1, x2, y1) && has(x2, y1, x2, y2) && has(x2, y2, x1, y2) && has(x1, y2, x1, y1);
    const diag = has(x1, y1, x2, y2);
    const inTri = (x, y) => x >= x1 - 1e-3 && y <= y2 + 1e-3 && (y - y1) * w >= (x - x1) * h - 1e-3 * w;
    const hatch = lines.filter(l => { const [p, q, r, s] = seg(l);
        const dx = r - p, dy = s - q; return Math.hypot(dx, dy) > 1e-6 && near(dx, dy, 1e-3 * Math.max(1, Math.abs(dx))) &&
            Math.min(p, r) >= x1 - 1e-3 && Math.max(p, r) <= x2 + 1e-3 && Math.min(q, s) >= y1 - 1e-3 && Math.max(q, s) <= y2 + 1e-3; });
    const hatchInside = hatch.every(l => { const [p, q, r, s] = seg(l); return inTri(p, q) && inTri(r, s); });
    // Mỗi đường gạch phải chạm 2 cạnh tam giác (không cụt giữa chừng)
    const onEdge = (x, y) => near(x, x1) || near(y, y2) || near((y - y1) * w, (x - x1) * h, 1e-3 * w);
    const hatchTouch = hatch.every(l => { const [p, q, r, s] = seg(l); return onEdge(p, q) && onEdge(r, s); });
    return { frame, diag, hatch: hatch.length, hatchInside, hatchTouch };
}

// ── 1. Mặt bằng: block SYM_CAB ──
{
    const dxf = await sb.ctx._generateCadDrawing(opts('none'));
    const E = parse(dxf);
    const cabBlocks = [...new Set(E.filter(e => e.blk && /^SYM_CAB/.test(e.blk)).map(e => e.blk))];
    ok('mặt bằng: chỉ 1 block tủ, tên SYM_CAB', cabBlocks.length === 1 && cabBlocks[0] === 'SYM_CAB');
    const ins = E.filter(e => !e.blk && e.t === 'INSERT' && e.g['2'] === 'SYM_CAB');
    ok('mặt bằng: 3 tủ (thu / moi_led / trống) đều INSERT SYM_CAB', ins.length === 3);
    const blkLines = E.filter(e => e.blk === 'SYM_CAB' && e.t === 'LINE');
    const c = checkCabinet(blkLines, 0, 0, 4);
    ok('block SYM_CAB: khung 6.2 × 4 m tâm (0,0)', c.frame);
    ok('block SYM_CAB: đường chéo dưới-trái → trên-phải', c.diag);
    ok('block SYM_CAB: có ≥ 10 đường gạch chéo 45°', c.hatch >= 10);
    ok('block SYM_CAB: gạch nằm trọn tam giác trên-trái', c.hatchInside);
    ok('block SYM_CAB: mỗi đường gạch chạm cạnh tam giác 2 đầu', c.hatchTouch);
    ok('block SYM_CAB: không còn SOLID tô đặc', !E.some(e => e.blk === 'SYM_CAB' && e.t === 'SOLID'));
    ok('block SYM_CAB: gạch cách nhau 0.25 m (≈ 17 đường)', c.hatch >= 15 && c.hatch <= 20);
    const tuText = E.find(e => !e.blk && e.t === 'TEXT' && e.g['1'] === 'TU1');
    const tuIns = ins[0];
    ok('mặt bằng: nhãn tên tủ không đè lên khung (x ≥ tâm + 3.1)', tuText && tuIns && +tuText.g['10'] >= +tuIns.g['10'] + 3.1);
}

// ── 2. Chú thích: 1 dòng tủ, vẽ đúng hình mới ──
{
    const dxf = await sb.ctx._generateCadDrawing(Object.assign(opts('state'), {}));
    const E = parse(dxf);
    const dec = t => t.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const texts = E.filter(e => e.t === 'TEXT').map(e => dec(e.g['1'] || ''));
    const legendCab = texts.filter(t => /Tủ điều khiển chiếu sáng|TĐK/.test(t));
    ok('chú thích: đúng 1 dòng tủ "Tủ điều khiển chiếu sáng"', legendCab.length === 1 && /Tủ điều khiển chiếu sáng/.test(legendCab[0]));
    ok('chú thích: không còn nhãn tủ theo trạng thái cũ', !texts.some(t => /TĐK chiếu sáng (thu hồi|lắp mới)/.test(t)));
    // Ký hiệu tủ trong chú thích + BẢNG KÝ HIỆU (ngoài block) cũng là hình mới: ≥ 2 đường chéo 1.55:1 ngoài block
    const outDiag = E.filter(e => !e.blk && e.t === 'LINE').filter(l => { const [p, q, r, s] = seg(l); const dx = r - p;
        return dx !== 0 && near((s - q) / dx, 1 / 1.55, 1e-3); });
    ok('chú thích + bảng ký hiệu: ký hiệu tủ vẽ hình mới (≥ 2 đường chéo 1.55:1)', outDiag.length >= 2);
    ok('không còn SOLID tô đặc nào cho tủ trong bản vẽ', !E.some(e => e.t === 'SOLID' && !e.blk));
}

// ── 3. Sơ đồ nguyên lý + 4. Tổng thể: cùng hình, không SOLID ở tủ ──
for (const [fn, label] of [['_generateSingleLineDrawing', 'nguyên lý'], ['_generateOverviewDrawing', 'tổng thể']]) {
    const dxf = await sb.ctx[fn](opts('none'));
    const E = parse(dxf).filter(e => !e.blk);
    const lines = E.filter(e => e.t === 'LINE');
    // Tìm tâm/cao tủ từ đường chéo: LINE dương có |dy/dx| = 1/1.55
    const diags = lines.filter(l => { const [p, q, r, s] = seg(l); const dx = r - p, dy = s - q;
        return dx !== 0 && near(dy / dx, 1 / 1.55, 1e-3) && Math.abs(dx) > 1; });
    ok(`${label}: có đường chéo tủ tỉ lệ 1.55:1`, diags.length >= 1);
    let allOk = diags.length > 0;
    for (const d of diags) {
        const [p, q, r, s] = seg(d);
        const c = checkCabinet(lines, (p + r) / 2, (q + s) / 2, Math.abs(s - q));
        allOk = allOk && c.frame && c.diag && c.hatch >= 10 && c.hatchInside && c.hatchTouch;
    }
    ok(`${label}: mọi tủ có khung + chéo + gạch trong tam giác trên-trái`, allOk);
    if (label === 'nguyên lý') {
        const dec = t => t.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        const E2 = parse(await sb.ctx[fn](opts('state')));   // chú thích chỉ vẽ khi có khung tên
        ok('nguyên lý: chú thích có dòng "Tủ điều khiển chiếu sáng"',
            E2.some(e => e.t === 'TEXT' && /Tủ điều khiển chiếu sáng/.test(dec(e.g['1'] || ''))));
    }
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
