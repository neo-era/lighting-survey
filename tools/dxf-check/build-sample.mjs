// Dựng DXF mặt bằng (trụ + block đèn xoay theo đường + đường OSM theo lớp) từ dữ liệu THẬT,
// dùng chính hàm trong index.html. Xem README.md.
import fs from 'fs';
import { loadIndexFunctions, fetchSheetCsv, fetchOverpassRoads } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = name => args.includes('--' + name);
if (flag('help') || !opt('filter')) {
    console.log(`Dùng: node tools/dxf-check/build-sample.mjs --filter "^J3\\.3" [tùy chọn]
  --sheet DanhSachTru     tên tab (mặc định DanhSachTru)
  --filter REGEX          lọc theo tên trụ (cột 1) — bắt buộc
  --out sample.dxf        file DXF ra (mặc định tools/dxf-check/out/sample.dxf)
  --cm 105.75             kinh tuyến trục
  --no-center --no-edge --no-name   tắt lớp tim / mép / tên đường
  --other                 bật lớp OSM_DUONG_KHAC
  --no-orient             trụ đứng thẳng (không xoay theo đường)
  --refresh               bỏ cache CSV/Overpass`);
    process.exit(flag('help') ? 0 : 1);
}

const F = await loadIndexFunctions();
const sheet = opt('sheet', 'DanhSachTru');
const re = new RegExp(opt('filter'));
const cm = parseFloat(opt('cm', '105.75'));
const k0 = Math.abs(cm - 105.0) < 0.01 ? 0.9996 : 0.9999;   // như generator
const pcd = v => parseFloat(String(v).replace(',', '.'));
const refresh = flag('refresh');

const rows = F.parseCSVText(await fetchSheetCsv(F, sheet, { refresh })).slice(1)
    .filter(r => re.test(String(r[1] || '').trim()) && isFinite(pcd(r[2])) && isFinite(pcd(r[3])));
if (!rows.length) { console.error('Không có trụ nào khớp bộ lọc'); process.exit(1); }

let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
for (const r of rows) { const la = pcd(r[2]), lo = pcd(r[3]);
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la); minLon = Math.min(minLon, lo); maxLon = Math.max(maxLon, lo); }
const json = await fetchOverpassRoads({ minLat: minLat - 0.001, maxLat: maxLat + 0.001, minLon: minLon - 0.001, maxLon: maxLon + 0.001 }, { refresh });
const osmData = { roads: json.elements.filter(e => e.type === 'way' && e.geometry)
    .map(e => ({ coords: e.geometry.map(g => [g.lon, g.lat]), tags: e.tags || {} })), buildings: [], water: [], admin: [] };

// Chỉ mục đường xe chạy cho hướng block (như _generateCadDrawing)
const segs = [];
for (const w of osmData.roads) {
    if (!F._rlIsDrivable(w.tags)) continue;
    const p = w.coords.map(([lo, la]) => F.convertLatLonToVn2000(la, lo, cm, k0));
    for (let i = 1; i < p.length; i++) segs.push({ x1: p[i-1].x, y1: p[i-1].y, x2: p[i].x, y2: p[i].y });
}
const idx = F._rlBuildIndex(segs, 50);

const L = []; const push = (...a) => a.forEach(v => L.push(String(v)));
push('0','SECTION','2','HEADER','0','ENDSEC','0','SECTION','2','TABLES');
F.writeTables(push);
push('0','TABLE','2','STYLE','70','1','0','STYLE','2','STANDARD','70','0','40','0','41','1','50','0','71','0','42','2.5','3','times.ttf','4','',
     '0','ENDTAB','0','ENDSEC','0','SECTION','2','BLOCKS');
for (let n = 1; n <= 4; n++) {
    const bn = 'SYM_POLE_LAMP' + n;
    push('0','BLOCK','8','0','2',bn,'70','0','10','0','20','0','30','0','3',bn);
    F._rlDrawLampBlock(push, 0, 0, n, 1);
    push('0','ENDBLK','8','0');
}
push('0','ENDSEC','0','SECTION','2','ENTITIES');
const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
const stats = { road: 0, none: 0 };
for (const r of rows) {
    const v = F.convertLatLonToVn2000(pcd(r[2]), pcd(r[3]), cm, k0);
    const n = Math.min(4, Math.max(1, parseInt(r[21]) || 1));
    const near = flag('no-orient') ? null : F._rlNearest(v.x, v.y, idx, 40);
    stats[near ? 'road' : 'none']++;
    const rot = near ? F._rlRotation(v.x, v.y, n, near, null) : 0;
    push('0','INSERT','8','0','2','SYM_POLE_LAMP' + n,'10',v.x.toFixed(3),'20',v.y.toFixed(3),'30','0','50',rot.toFixed(2));
    push('0','TEXT','8','0','10',(v.x + 3).toFixed(3),'20',(v.y - 1).toFixed(3),'30','0','40','2.0','1',F._dxfEscape(r[1]));
    b.minX = Math.min(b.minX, v.x - 5); b.minY = Math.min(b.minY, v.y - 5); b.maxX = Math.max(b.maxX, v.x + 5); b.maxY = Math.max(b.maxY, v.y + 5);
}
const clip = { minX: b.minX - 30, minY: b.minY - 30, maxX: b.maxX + 30, maxY: b.maxY + 30 };
const t0 = Date.now();
const st = F._drawOsmBasemapInDxf(push, osmData, cm, 0, 0, clip, k0, {
    center: !flag('no-center'), edge: !flag('no-edge'), name: !flag('no-name'), other: flag('other'), widths: null, textHeight: 3 });
const ms = Date.now() - t0;
push('0','ENDSEC','0','EOF');

const out = opt('out', 'tools/dxf-check/out/sample.dxf');
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(out, L.join('\r\n'));
const cnt = (layer, ent) => L.filter((v, i) => v === ent && L[i-1] === '0' && L[i+1] === '8' && L[i+2] === layer).length;
console.log(`Trụ: ${rows.length} (bám đường ${stats.road}, không đường ${stats.none})`);
console.log(`OSM: tim ${cnt('OSM_TIM_DUONG','POLYLINE')} · mép ${cnt('OSM_MEP_DUONG','POLYLINE')} · tên ${cnt('OSM_TEN_DUONG','TEXT')} · khác ${cnt('OSM_DUONG_KHAC','POLYLINE')} polyline — vẽ ${ms} ms`);
console.log('Ghi:', out, `(${st.entityCount} entity OSM)`);
