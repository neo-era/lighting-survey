// "Chọn trên bản đồ" khi thêm/sửa marker: dấu ngắm ⊕ cố định giữa bản đồ, kéo bản đồ rồi bấm "Chọn" (v213).
// Run: node tests/pick-crosshair.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); };
const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0, sb.errors);
const W = sb.ctx;

// DOM giả tối thiểu
const els = {};
const mkEl = id => ({ id, style: {}, textContent: '', innerHTML: '', value: '', children: [],
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); els[c.id] = c; return c; } });
['markerPopupForm', 'pickOnMapHint', 'pickOnMapCoords', 'markerCoordsText'].forEach(id => els[id] = mkEl(id));
W.document = Object.assign(W.document, {
    getElementById: id => els[id] || null,
    createElement: () => mkEl(''),
});
// Bản đồ giả
let center = { lat: 10.76, lng: 106.66 }, zoom = 16;
const handlers = {}, views = [];
const container = mkEl('mapContainer');
W.__fakeMap = {
    getCenter: () => center, getZoom: () => zoom, getContainer: () => container,
    setView: (c, z) => { center = { lat: c[0], lng: c[1] }; zoom = z; views.push([c[0], c[1], z]); },
    on: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); },
    off: (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); },
};
sb.run('map = __fakeMap;');
const geo = [];
W.fillGeoFields = (a, b) => { geo.push([a, b]); };
W.displayError = () => {}; W.displayInfo = () => {};
const fire = ev => (handlers[ev] || []).slice().forEach(f => f());

ok('có hàm bấm "Chọn" lấy tâm bản đồ', typeof W.confirmPickOnMap === 'function');

// 1. Vào chế độ chọn: hiện dấu ngắm + đưa bản đồ tới vị trí đang có (zoom ≥ 18 cho dễ ngắm)
sb.run('markerPopupLocation = [10.77, 106.67];');
W.setMarkerToPickOnMap();
const ch = els.pickCrosshair;
ok('tạo dấu ngắm giữa bản đồ', !!ch && container.children.includes(ch));
ok('dấu ngắm hiện', ch && ch.style.display === 'block');
ok('ẩn form, hiện thanh hướng dẫn', els.markerPopupForm.style.display === 'none' && els.pickOnMapHint.style.display === 'flex');
ok('đưa tâm bản đồ tới vị trí đang có, zoom ≥ 18', views.length === 1 && views[0][0] === 10.77 && views[0][2] >= 18, views);
ok('đang ở chế độ chọn', sb.run('pickMarkerMode') === true);

// 2. Kéo bản đồ → toạ độ tâm cập nhật trên thanh hướng dẫn
center = { lat: 10.7712345, lng: 106.6798765 };
fire('move');
ok('kéo bản đồ: hiện toạ độ tâm', /10\.771235/.test(els.pickOnMapCoords.textContent) && /106\.679877/.test(els.pickOnMapCoords.textContent), els.pickOnMapCoords.textContent);

// 3. Bấm "Chọn" → lấy đúng tâm bản đồ
W.confirmPickOnMap();
const loc = sb.run('markerPopupLocation');
ok('lấy vị trí = tâm bản đồ', loc[0] === 10.7712345 && loc[1] === 106.6798765, loc);
ok('pendingMarkerLocation = tâm bản đồ', sb.run('pendingMarkerLocation')[0] === 10.7712345);
ok('điền Đường/Phường theo tâm', geo.length === 1 && geo[0][0] === 10.7712345);
ok('thoát chế độ chọn, ẩn dấu ngắm, hiện lại form', sb.run('pickMarkerMode') === false && ch.style.display === 'none'
    && els.markerPopupForm.style.display === 'flex' && els.pickOnMapHint.style.display === 'none');
ok('gỡ lắng nghe kéo bản đồ', (handlers.move || []).length === 0);
const n = geo.length; fire('move');
ok('sau khi chọn, kéo bản đồ không đổi toạ độ', geo.length === n);

// 4. Chạm thẳng vào bản đồ vẫn chọn được (điểm chạm)
W.setMarkerToPickOnMap();
W._finishPickOnMap(10.5, 106.5);
ok('chạm bản đồ: lấy điểm chạm', sb.run('markerPopupLocation')[0] === 10.5 && ch.style.display === 'none');

// 5. Hủy → ẩn dấu ngắm
W.setMarkerToPickOnMap();
W.cancelPickOnMap();
ok('hủy: ẩn dấu ngắm, giữ vị trí cũ', ch.style.display === 'none' && sb.run('markerPopupLocation')[0] === 10.5 && (handlers.move || []).length === 0);
ok('chỉ tạo 1 dấu ngắm dù vào nhiều lần', container.children.filter(c => c.id === 'pickCrosshair').length === 1);

// 6. Sự kiện click trên bản đồ gọi hàm chung
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
ok('click bản đồ dùng _finishPickOnMap', /if \(pickMarkerMode\) \{\s*_finishPickOnMap\(e\.latlng\.lat, e\.latlng\.lng\);/.test(src));
ok('thanh hướng dẫn có nút Chọn', /onclick="confirmPickOnMap\(\)"/.test(src));

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail) process.exit(1);
