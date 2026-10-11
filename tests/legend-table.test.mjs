// Chú thích CAD: ký hiệu = đúng nét của block xuất (không thu nhỏ) + cột ĐVT + cột Số lượng.
// Run: node tests/legend-table.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const row = (id, name, lat, lon, type, tu, parent, dist, nLamp, loaiCap) => {
    const r = new Array(30).fill('');
    Object.assign(r, { 0: id, 1: name, 2: String(lat), 3: String(lon), 6: String(type), 7: tu, 14: parent,
        15: dist == null ? '' : String(dist), 21: nLamp ? String(nLamp) : '', 22: loaiCap || '' });
    return r;
};
sb.ctx.__rows = [new Array(30).fill('h'),
    row('T0', 'TU1', 10.853, 106.672, 5, 'TU1', ''),
    row('T9', 'TU2', 10.8545, 106.6745, 6, 'TU2', ''),
    row('T1', 'P1', 10.8531, 106.6723, 1, 'TU1', 'TU1', '1200', 1, 'noi'),
    row('T2', 'P2', 10.8532, 106.6726, 1, 'TU1', 'P1', '1015,5', 1, 'noi'),   // dấu phẩy thập phân
    row('T3', 'P3', 10.8533, 106.6729, 1, 'TU1', 'P2', '2000', 2, 'noi'),
    row('T4', 'Q1', 10.8546, 106.6748, 1, 'TU2', 'TU2', '40', 1, 'ngam'),
    row('T5', 'Q2', 10.8547, 106.6751, 1, 'TU2', 'Q1', null, 1, 'ngam')];   // chưa ghi số mét → đo
sb.run('loadedData = __rows;');
const opts = (id, extra) => Object.assign({ templateId: id, metadata: {}, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
    outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75 }, extra || {});

const dec = t => t.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
function parse(dxf) {
    const L = dxf.split('\r\n'), P = [];
    for (let i = 0; i + 1 < L.length; i += 2) P.push([L[i].trim(), L[i + 1]]);
    const ents = []; let blk = null;
    for (let i = 0; i < P.length; i++) {
        if (P[i][0] !== '0') continue;
        const e = { t: P[i][1], g: {} };
        for (let j = i + 1; j < P.length && P[j][0] !== '0'; j++) if (!(P[j][0] in e.g)) e.g[P[j][0]] = P[j][1];
        if (e.t === 'BLOCK') { blk = e.g['2']; continue; }
        if (e.t === 'ENDBLK') { blk = null; continue; }
        e.blk = blk; ents.push(e);
    }
    return ents;
}
// So khớp copy trong chú thích với block: mọi entity của block (dời dx,dy) có entity cùng loại trùng toạ độ (±1e-3)
const KEYS = { LINE: ['10', '20', '11', '21'], CIRCLE: ['10', '20', '40'], SOLID: ['10', '20', '11', '21', '12', '22', '13', '23'] };
const same = (b, m, dx, dy) => b.t === m.t && KEYS[b.t].every(k => {
    const vb = +b.g[k] + (k === '40' ? 0 : (k[0] === '1' ? dx : dy));
    return Math.abs(vb - +m.g[k]) <= 1e-3;
});
function findCopy(ents, blockName) {
    const B = ents.filter(e => e.blk === blockName && KEYS[e.t]);
    const M = ents.filter(e => !e.blk && KEYS[e.t]);
    if (!B.length) return null;
    const a = B.find(e => e.t === 'LINE') || B[0];
    for (const m of M) {
        if (m.t !== a.t) continue;
        const dx = +m.g['10'] - +a.g['10'], dy = +m.g['20'] - +a.g['20'];
        if (B.every(b => M.some(mm => same(b, mm, dx, dy)))) {
            const xs = [], ys = [];
            B.forEach(b => { for (const k of KEYS[b.t]) if (k !== '40') (k[0] === '1' ? xs : ys).push(+b.g[k] + (k[0] === '1' ? dx : dy)); });
            return { dx, dy, minY: Math.min(...ys), maxY: Math.max(...ys), minX: Math.min(...xs), maxX: Math.max(...xs) };
        }
    }
    return null;
}
const texts = E => E.filter(e => !e.blk && e.t === 'TEXT').map(e => ({ s: dec(e.g['1'] || ''), x: +e.g['10'], y: +e.g['20'] }));
const rowOf = (T, label) => {
    const t = T.find(t => t.s === label);
    if (!t) return null;
    const same = T.filter(o => Math.abs(o.y - t.y) < 0.6 && o.x > t.x).sort((a, b) => a.x - b.x);
    return { t, unit: same[0] && same[0].s, qty: same[1] && same[1].s };
};

// ── Mặt bằng, hướng block theo đường (block đèn N bóng) ──
{
    const E = parse(await sb.ctx._generateCadDrawing(opts('state', { orientByRoad: true, _osmPrefetch: { data: { roads: [], buildings: [], water: [], admin: [] }, err: null } })));
    const T = texts(E);
    ok('có tiêu đề cột "Ký hiệu", "Diễn giải", "ĐVT", "Số lượng"',
        ['Ký hiệu', 'Diễn giải', 'ĐVT', 'Số lượng'].every(h => T.some(t => t.s === h)));
    const c1 = findCopy(E, 'SYM_POLE_LAMP1'), c2 = findCopy(E, 'SYM_POLE_LAMP2'), cc = findCopy(E, 'SYM_CAB');
    ok('chú thích: ký hiệu trụ 1 bóng TRÙNG nét block SYM_POLE_LAMP1 (tỉ lệ 1:1)', !!c1);
    ok('chú thích: ký hiệu trụ 2 bóng TRÙNG nét block SYM_POLE_LAMP2', !!c2);
    ok('chú thích: ký hiệu tủ TRÙNG nét block SYM_CAB', !!cc);
    const r1 = rowOf(T, 'Trụ đèn 1 bóng'), r2 = rowOf(T, 'Trụ đèn 2 bóng'), rc = rowOf(T, 'Tủ điều khiển chiếu sáng');
    ok('dòng Trụ đèn 1 bóng: ĐVT Trụ, SL 4', r1 && r1.unit === 'Trụ' && r1.qty === '4');
    ok('dòng Trụ đèn 2 bóng: ĐVT Trụ, SL 1', r2 && r2.unit === 'Trụ' && r2.qty === '1');
    ok('dòng Tủ: ĐVT Tủ, SL 2', rc && rc.unit === 'Tủ' && rc.qty === '2');
    // Cáp nổi: 1200 + 1015.5 + 2000 = 4215.5 → 4.216 ; cáp ngầm: 40 + đo Q1→Q2 (~35 m)
    const cn = T.map(t => rowOf(T, t.s)).find(r => r && /Cáp.*nổi/i.test(r.t.s));
    ok('dòng cáp nổi: ĐVT m, SL 4.216 (dấu chấm ngàn, có số mét phẩy thập phân)', cn && cn.unit === 'm' && cn.qty === '4.216');
    const cg = T.map(t => rowOf(T, t.s)).find(r => r && /Cáp.*ngầm/i.test(r.t.s));
    const ngamM = cg && +String(cg.qty).replace(/\./g, '');
    ok('dòng cáp ngầm: ĐVT m, SL = 40 + đo đoạn chưa ghi (70–80)', cg && cg.unit === 'm' && ngamM >= 70 && ngamM <= 80);
    // Ký hiệu đặt đúng dòng, không chồng nhau
    const pairs = [[c1, r1], [c2, r2], [cc, rc]];
    ok('mỗi ký hiệu nằm cùng dòng với chữ diễn giải', pairs.every(([c, r]) => c && r && r.t.y >= c.minY - 1 && r.t.y <= c.maxY + 1));
    const boxes = [c1, c2, cc].filter(Boolean).sort((a, b) => a.minY - b.minY);
    ok('các ký hiệu không chồng nhau theo chiều cao', boxes.every((b, i) => i === 0 || boxes[i - 1].maxY < b.minY));
    ok('ký hiệu nằm bên trái chữ diễn giải', pairs.every(([c, r]) => c && r && c.maxX < r.t.x));
}

// ── Mặt bằng không hướng theo đường (ký hiệu theo trạng thái) ──
{
    const E = parse(await sb.ctx._generateCadDrawing(opts('state')));
    const T = texts(E);
    const rp = rowOf(T, 'Đèn chiếu sáng hiện hữu giữ nguyên');
    ok('ký hiệu trạng thái: dòng trụ giữ nguyên ĐVT Trụ, SL 5', rp && rp.unit === 'Trụ' && rp.qty === '5');
    ok('ký hiệu trạng thái: trùng nét block SYM_POLE_GIU', !!findCopy(E, 'SYM_POLE_GIU'));
}

// ── Sơ đồ nguyên lý ──
{
    const E = parse(await sb.ctx._generateSingleLineDrawing(opts('state')));
    const T = texts(E);
    const r1 = rowOf(T, 'Trụ đèn 1 bóng'), rc = rowOf(T, 'Tủ điều khiển chiếu sáng');
    ok('nguyên lý: Trụ đèn 1 bóng SL 4, Tủ SL 2', r1 && r1.qty === '4' && rc && rc.qty === '2');
    ok('nguyên lý: có cột ĐVT/Số lượng', T.some(t => t.s === 'ĐVT') && T.some(t => t.s === 'Số lượng'));
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
