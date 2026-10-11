// DXF mở ra phải ZOOM thẳng tới nội dung: có bảng VPORT *ACTIVE với tâm/chiều cao theo nội dung
// (AutoCAD dùng VPORT *ACTIVE khi mở; thiếu → mặc định tâm (0,0) cao 1000 → màn hình trống vì toạ độ VN-2000 ~600k/1.2M)
// Run: node tests/dxf-view.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);
const row = (id, name, lat, lon, type, tu, parent) => {
    const r = new Array(30).fill('');
    Object.assign(r, { 0: id, 1: name, 2: String(lat), 3: String(lon), 6: String(type), 7: tu, 14: parent });
    return r;
};
sb.ctx.__rows = [new Array(30).fill('h'),
    row('T0', 'TU', 10.853, 106.672, 5, 'TU', ''), row('T1', 'P1', 10.8531, 106.6723, 1, 'TU', 'TU'),
    row('T2', 'P2', 10.8532, 106.6726, 1, 'TU', 'P1'), row('T3', 'P3', 10.8533, 106.6729, 1, 'TU', 'P2')];
sb.run('loadedData = __rows;');
const opts = id => ({ templateId: id, metadata: {}, filters: { tus: [], basenames: [], nguoiKS: [], phuongXa: [] },
    outputOffset: { dE: 0, dN: 0 }, paper: 'a3', scale: 1000, cm: 105.75 });

// Đọc bảng VPORT *ACTIVE + toạ độ INSERT (vị trí trụ)
function inspect(dxf) {
    const L = dxf.split('\r\n');
    const pairs = []; for (let i = 0; i + 1 < L.length; i += 2) pairs.push([L[i].trim(), L[i + 1]]);
    let vp = null, inserts = [];
    for (let i = 0; i < pairs.length; i++) {
        if (pairs[i][0] === '0' && pairs[i][1] === 'VPORT') {
            const ent = {}; let j = i + 1;
            for (; j < pairs.length && pairs[j][0] !== '0'; j++) ent[pairs[j][0]] = pairs[j][1];
            if ((ent['2'] || '').toUpperCase() === '*ACTIVE') vp = ent;
        }
        // Vị trí nội dung = chữ tên trụ/tủ (có ở cả 3 loại bản vẽ; nguyên lý/tổng thể không dùng INSERT)
        if (pairs[i][0] === '0' && pairs[i][1] === 'TEXT') {
            const ent = {}; for (let j = i + 1; j < pairs.length && pairs[j][0] !== '0'; j++) ent[pairs[j][0]] = pairs[j][1];
            if (/^(TU|P[123])$/.test(ent['1'] || '')) inserts.push([+ent['10'], +ent['20']]);
        }
    }
    const tablesIdx = pairs.findIndex(p => p[0] === '2' && p[1] === 'TABLES');
    const vportTableIdx = pairs.findIndex(p => p[0] === '2' && p[1] === 'VPORT');
    const entitiesIdx = pairs.findIndex(p => p[0] === '2' && p[1] === 'ENTITIES');
    return { vp, inserts, order: tablesIdx >= 0 && tablesIdx < vportTableIdx && vportTableIdx < entitiesIdx };
}

for (const [fn, label] of [['_generateCadDrawing', 'mặt bằng'], ['_generateSingleLineDrawing', 'nguyên lý'], ['_generateOverviewDrawing', 'tổng thể']]) {
    for (const tpl of ['state', 'none']) {
        let dxf; try { dxf = await sb.ctx[fn](opts(tpl)); } catch (e) { ok(`${label}/${tpl}: chạy được (${e.message})`, false); continue; }
        const { vp, inserts, order } = inspect(dxf);
        ok(`${label}/${tpl}: có VPORT *ACTIVE trong TABLES (trước ENTITIES)`, !!vp && order);
        if (!vp) continue;
        const cx = +vp['12'], cy = +vp['22'], h = +vp['40'], asp = +vp['41'];
        ok(`${label}/${tpl}: tâm & chiều cao hợp lệ (h>0, tỉ lệ ~1.4–2)`, isFinite(cx) && isFinite(cy) && h > 0 && asp >= 1.3 && asp <= 2.1);
        // Mọi trụ (INSERT) nằm trong khung nhìn ban đầu
        const halfH = h / 2, halfW = h * asp / 2;
        const pts = inserts.length ? inserts : [];
        ok(`${label}/${tpl}: mọi trụ nằm trong khung nhìn khi mở`, pts.length > 0 && pts.every(([x, y]) => Math.abs(x - cx) <= halfW && Math.abs(y - cy) <= halfH));
        ok(`${label}/${tpl}: tâm khung nhìn KHÔNG ở gốc (0,0)`, Math.hypot(cx, cy) > 1000 || label === 'nguyên lý');
    }
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
