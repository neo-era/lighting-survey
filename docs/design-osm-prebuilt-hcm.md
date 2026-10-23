# Thiết kế: Tiền-tải nền OSM đường toàn TP.HCM (prebuilt, bật/tắt) — v1.0.132+

## Mục tiêu
App `lighting-survey` không còn phụ thuộc Overpass live lúc xuất CAD / xem bản đồ. Dữ liệu đường
giao thông toàn TP.HCM (sau sáp nhập 2025: HCMC + Bình Dương + BR-VT) được **dựng sẵn thành file tĩnh
trong repo**, app nạp theo ô (tile) trong khung nhìn / khung xuất, cache SW + IndexedDB. Có nút **bật/tắt**
lớp nền này cả khi xem bản đồ lẫn khi xuất CAD.

## Tiêu chí đạt (Bước 0)
- Xuất CAD với nền OSM **không cần gọi Overpass** → luôn ra nền đường dù Overpass chết.
- Lớp overlay đường OSM trên bản đồ live: **bật/tắt** được từ panel ☰.
- Chỉ nạp phần dữ liệu trong khung nhìn/khung xuất (không ôm cả thành phố vào RAM 1 lúc).
- Chạy offline sau lần nạp đầu (PWA / SW cache tiles).
- Dữ liệu = **đường xe chạy** (drivable) toàn TP.HCM mới — cùng bộ lọc `_rlIsDrivable` hiện có.
- Không phá vỡ luồng Overpass cũ: nếu tile prebuilt thiếu → vẫn fallback Overpass live (tùy chọn).
- Overpass vẫn giữ làm nguồn **làm mới** thủ công (rebuild định kỳ, đường thay đổi chậm).

### Ca biên/ca xấu
- Khung xuất nằm rìa thành phố / ngoài bbox prebuilt → không có tile → fallback Overpass (hoặc báo rõ "ngoài vùng dữ liệu sẵn").
- Tile rỗng (vùng không có đường) → nạp nhanh, không lỗi.
- Nhiều tile cùng lúc (khung xuất lớn) → gộp, giới hạn RAM.
- Dữ liệu cũ (roads đổi) → cơ chế version + rebuild.

## Nguồn & build dữ liệu (offline, một lần)
1. Geofabrik **Vietnam** `.osm.pbf` (~250MB) — tải bằng Chrome về máy anh.
2. Stage vào workspace → `pyrosm` đọc, lấy `network_type="all"` (GỒM hẻm: service/footway/path/pedestrian —
   `driving` bỏ sót `service` vốn là phần lớn hẻm VN), loại steps/cycleway/busway/track…, clip bbox TP.HCM mới.
   Thực tế (v1.0.139): 464.718 đoạn, 203 ô, ~21MB gz. Ô trung tâm ~35k bản ghi/1.2MB gz — parse 9 ô pad=1 ~0.9s
   (một lần, cache sau), clip quanh bbox giữ align/overlay nhẹ (vài trăm đường).
3. **bbox TP.HCM mới** (union 3 tỉnh cũ, có đệm): lat `10.15–11.50`, lon `106.25–107.65`.
4. Trim tag về đúng thứ CAD cần: `highway, name, width, lanes, layer, bridge, tunnel, oneway, construction, service`.
5. Xuất ra **lưới ô 0.1°** (~11km), gzip sẵn: `data/osm-roads/index.json.gz` + `tile_<col>_<row>.json.gz`.
   - Khóa ngắn tiết kiệm byte: `{c:[[lon,lat]…], h, n, w, ln, ly, br, tn, ow, co, sv, rf}`.
   - Lưu `.json.gz` (repo ~16MB thay vì ~64MB); app tự giải nén bằng `DecompressionStream('gzip')`.
   - Script dựng lại: `tools/build-osm-roads.py <vietnam.osm.pbf>` (dùng pyrosm). Thực tế: 283k đoạn, 201 ô.

## Cấu trúc file sinh ra
```
data/osm-roads/
  index.json.gz          ← { version, builtAt, source, bbox, tileDeg, tiles:{ "<col>_<row>":{n:<count>} } }
  tile_<col>_<row>.json.gz  ← [ {c,h,n,w,...}, ... ]  (col theo lon, row theo lat; col có thể âm ở rìa tây)
```
Quy ước ô: `col = floor((lon - bbox.minLon)/tileDeg)`, `row = floor((lat - bbox.minLat)/tileDeg)`.

## Thay đổi code app
### 1. Lớp nạp dữ liệu prebuilt — `src/features/osm-prebuilt.js` (mới)
- Hàm thuần (test được, trong mốc `@@OSMPREBUILT_START/END`): `_pbRecordToRoad(rec)` (khóa ngắn→tag OSM),
  `_pbTileKeysForBounds(index, bounds, pad)` (khóa ô giao bounds, có trong index).
- `_pbLoadIndex()` — fetch + giải nén `index.json.gz` 1 lần, cache promise.
- `_pbFetchTile(key)` — fetch `.json.gz` → `DecompressionStream` → parse → map record. Cache **LRU ~40 ô** trong RAM
  (SW lo cache bền + offline, không cần IndexedDB riêng).
- `_pbGetRoads(bounds, {pad})` — API chính: trả `{roads:[{coords,tags}], _prebuilt, _empty}` cho 1 bbox.
  Shape khớp `_drawOsmBasemapInDxf` / `_rlRoadSegments`.

### 2. Nguồn nền OSM khi xuất CAD — sửa `osm.js` / `cad-export.js`
- `_cgFetchOsm(bbox, opts, signal)`: nếu bật "dùng nền prebuilt" (mặc định ON) → gọi `_pbGetRoads` trước.
  Thiếu tile và opts cho phép → fallback `_fetchOsmBasemap` (Overpass). Nhà/sông/ranh vẫn qua Overpass nếu bật
  (prebuilt chỉ có đường ở v1).
- Thêm checkbox trong modal xuất CAD: "Nền đường dựng sẵn (không cần mạng)" — mặc định bật.

### 3. Overlay đường trên bản đồ live — toggle trong ☰
- `L.layerGroup` vẽ polyline đường từ `_pbGetRoads(map.getBounds())`, cập nhật theo `moveend` (debounce),
  chỉ bật từ zoom ≥ ngưỡng (vd 14) để không nạp cả thành phố.
- Toggle lưu localStorage `pb_osm_overlay`.

### 4. Service Worker (v188)
- Pre-cache `data/osm-roads/index.json.gz` + `src/features/osm-prebuilt.js`; tile tải theo nhu cầu rồi
  cache-first qua handler same-origin sẵn có. Bump `CACHE` v187→v188 để đẩy code JS mới.

## Rủi ro
- Dung lượng tile tổng lớn → chỉ nạp theo ô + cache, không bundle vào index.html.
- Geofabrik Vietnam có thể chưa phản ánh ranh "TP.HCM mới" → ta clip theo bbox 3 tỉnh cũ, không theo ranh hành chính.
- Độ chính xác tọa độ: giữ 6 chữ số thập phân (~0.1m) — đủ cho nền bản vẽ.

## Kiểm chứng (Bước 5)
- Test đơn vị: `_pbTilesForBounds` (ô biên, bbox cắt nhiều ô), parse tile→shape, gộp trùng.
- Đối chiếu: 1 khu đã từng xuất bằng Overpass vs prebuilt → đường trùng khớp.
- Thử offline: tắt mạng, xuất CAD khu đã cache → vẫn ra nền.
- Lighthouse PWA vẫn đạt; SW cache tile hoạt động.
