# Lighting Survey — CLAUDE.md

## Tổng quan dự án
PWA khảo sát hệ thống chiếu sáng công cộng. Single-page app + GAS backend.
- Repo: `neo-era/lighting-survey` — deploy tại `https://neo-era.github.io/lighting-survey/`
- Tác giả: Mai Vũ Lâm — maivulam2020@gmail.com

## Cấu trúc file

```
index.html          ← toàn bộ app (HTML + CSS + JS gộp 1 file)
gas-khaosat.js      ← dán vào Google Apps Script, deploy Web App
manifest.json       ← PWA manifest (start_url, icons, theme_color)
sw.js               ← Service Worker (cache offline, map tiles)
huongdan.html       ← trang hướng dẫn sử dụng (tiếng Việt)
images/             ← icon PWA + ảnh khảo sát upload từ GAS
data/               ← file Excel backup (khaosat.xlsx)
```

## Kiến trúc & luồng dữ liệu

```
[Người dùng nhập marker]
        ↓
[index.html — saveMarkerPopup()]
        ↓ POST action=full_update
[GAS Web App — doPost()]
        ↓
[Google Sheet: DanhSachTru]
        ↓ (publish CSV)
[KHAOSAT_CSV_URL] ← loadFromCSV() đọc khi load app

[Nút GitHub] → tải CSV → tạo Excel → POST action=upload_to_github → GAS → GitHub API
[Ảnh]        → POST action=upload_image → GAS → GitHub API → images/<name>.jpg
```

## Cấu hình trong index.html

```javascript
const KHAOSAT_GAS_URL = '...';   // URL Web App đã deploy (doPost endpoint)
const KHAOSAT_CSV_URL = '...';   // URL publish CSV của Google Sheet (DanhSachTru)
```

## Cấu trúc cột Google Sheet (DanhSachTru) — 21 cột

| Index | Tên cột            | Key payload JS  | Ghi chú                        |
|-------|--------------------|-----------------|--------------------------------|
| [0]   | ID                 | id              |                                |
| [1]   | Tên trụ            | tenTru          |                                |
| [2]   | Lat                | lat             |                                |
| [3]   | Lon                | lon             |                                |
| [4]   | Ghi chú            | ghiChu          |                                |
| [5]   | Người KS           | nguoiKS         |                                |
| [6]   | Loại               | loai            |                                |
| [7]   | Tủ điều khiển      | tuDieuKhien     |                                |
| [8]   | Loại trụ           | loaiTru         |                                |
| [9]   | Loại cần           | loaiCan         |                                |
| [10]  | Loại đèn           | loaiDen         |                                |
| [11]  | Công suất          | congSuat        |                                |
| [12]  | Ảnh                | hinhAnh         |                                |
| [13]  | Thời gian cập nhật | capNhat         |                                |
| [14]  | Marker gốc         | markerGoc       |                                |
| [15]  | Khoảng cách (m)    | khoangCach      |                                |
| [16]  | Mã PE              | maPE            |                                |
| [17]  | Đường              | duong           |                                |
| [18]  | Phường/ Xã         | phuongXa        |                                |
| [19]  | VN2000-X           | vn2000x         | Tự tính từ Lat/Lon (integer m) |
| [20]  | VN2000-Y           | vn2000y         | Tự tính từ Lat/Lon (integer m) |

**VN2000**: Tọa độ phẳng Gauss-Krüger, múi 6°, ellipsoid GRS80 (hàm `convertLatLonToVn2000(lat,lon)` → `{x, y, zone}`).
Tự động cập nhật tại 2 điểm: `saveMarkerPopup()` (thêm/sửa marker) và `updateMarkerCoordinatesInData()` (kéo marker).

## 6 loại marker (TYPE_CONFIG)

| Loại | Label               | Shape   | Màu     | Icon function      |
|------|---------------------|---------|---------|--------------------|
| 1    | Trụ STK             | pole    | #0ea5e9 | makeLampIcon()     |
| 2    | Trụ trang trí       | pole    | #ec4899 | makeLampIcon()     |
| 3    | Trụ HTLT            | pole    | #10b981 | makeLampIcon()     |
| 4    | Trụ TTLT            | pole    | #f97316 | makeLampIcon()     |
| 5    | Tủ chiếu sáng nổi  | cabinet | #2563eb | makeCabinetIcon()  |
| 6    | Tủ chiếu sáng ngầm | cabinet | #334155 | makeCabinetIcon()  |

### Hiển thị marker
- `L.markerClusterGroup({ disableClusteringAtZoom: 15, maxClusterRadius: 60 })`
- Zoom < 15 → cluster; zoom ≥ 15 → icon riêng lẻ
- Zoom ≥ 17 → hiện nhãn tên (`labelLayerGroup`, iconAnchor `[40, -4]` = bên dưới icon)

### Icon SVG (L.divIcon, className: '')
- `makeLampIcon(color)` — cột + cần + đèn, 26×42px, iconAnchor [12, 42]
- `makeCabinetIcon(color)` — hình chữ nhật tủ điện, 24×28px, iconAnchor [12, 28]
- Anchor đặt ở đáy icon → tọa độ địa lý = chân cột/tủ

## GAS — Script Properties

| Key          | Value                           |
|--------------|---------------------------------|
| GITHUB_TOKEN | ghp_xxx (scope: contents:write) |

## GAS actions (doPost)

| action           | Mô tả                                                         |
|------------------|---------------------------------------------------------------|
| login            | Xác thực từ sheet `TaiKhoan` (cột A=user, B=pass, C=tên, D=role) |
| full_update      | Upsert 1 hàng vào `DanhSachTru` (tìm theo ID rồi Tên trụ)   |
| delete_row       | Xóa 1 hàng khỏi `DanhSachTru` (tìm theo ID hoặc Tên trụ)    |
| upload_image     | Upload ảnh base64 → `images/<name>.<ext>` trên GitHub        |
| upload_to_github | Nhận Excel base64 từ client → upload file lên GitHub repo    |

### Lưu ý GAS
- Mỗi lần sửa `gas-khaosat.js` phải **redeploy New version** (không tạo deployment mới — sẽ đổi URL)
- `norm()` chuẩn hóa tên cột: lowercase + NFC → khớp header dù có/không dấu
- `findRowNum()` tìm hàng theo ID trước, fallback tên trụ

## Quy trình deploy GAS

1. Mở Google Sheet → Extensions → Apps Script
2. Dán toàn bộ `gas-khaosat.js`
3. Deploy → Manage deployments → chọn deployment → ✏️ Edit → Version: **New version** → Deploy
4. Copy URL → dán vào `KHAOSAT_GAS_URL` trong `index.html`

## PWA

| File          | Vai trò                                                   |
|---------------|-----------------------------------------------------------|
| manifest.json | Metadata app: tên, icon, theme_color, start_url, scope   |
| sw.js         | Service Worker: cache offline, map tile cache (≤300 tile) |

### Cấu hình manifest
```json
{
  "start_url": "/lighting-survey/",
  "scope":     "/lighting-survey/",
  "display":   "standalone",
  "theme_color": "#2563eb"
}
```

### Service Worker (sw.js) — hiện tại v5

| Cache name      | Chiến lược   | Nội dung                                          |
|-----------------|--------------|---------------------------------------------------|
| `lighting-survey-v5` | Network-first | `index.html`, `.html` (luôn lấy code mới)   |
| `lighting-survey-v5` | Cache-first  | Icon/ảnh tĩnh (pre-cache khi install)             |
| `map-tiles-v1`  | Cache-first  | Tile bản đồ OSM/Google/CartoDB (tối đa 300 tile)  |
| `cdn-libs-v1`   | Cache-first  | Toàn bộ CDN JS/CSS/fonts (jQuery, Leaflet, v.v.)  |

- Google Sheets CSV + GAS URL: **luôn fetch mới**, không cache
- **Bump cache name** (`v5` → `v6`, v.v.) mỗi khi cần xóa cache cũ hoàn toàn
- Đăng ký trong `index.html` (cuối body):
```javascript
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
```

## Thư viện client

| Thư viện                  | Phiên bản | Tải khi nào         | Dùng cho                        |
|---------------------------|-----------|---------------------|---------------------------------|
| Leaflet                   | 1.9.4     | Luôn (cuối body)    | Bản đồ                          |
| leaflet.markercluster     | 1.5.3     | Luôn (cuối body)    | Gộp marker theo zoom            |
| Bootstrap                 | 4.6.2     | Luôn (cuối body)    | Layout, modal                   |
| jQuery                    | 3.7.1     | Luôn (cuối body)    | Bootstrap dependency            |
| XLSX.js                   | 0.18.5    | Luôn (cuối body)    | Đọc/ghi Excel (fallback)        |
| ExcelJS                   | 4.3.1     | **Lazy** — khi cần  | Ghi Excel có hình ảnh (primary) |
| jsPDF                     | 2.5.1     | **Lazy** — khi in   | Tạo file PDF bản vẽ             |
| html2canvas               | 1.4.1     | **Lazy** — khi in   | Chụp map canvas → image         |
| Nominatim (OSM)           | —         | Fetch on-demand     | Reverse geocoding (tiếng Việt)  |
| OSRM                      | —         | Fetch on-demand     | Chỉ đường xe máy                |

> **Lưu ý tải thư viện:** jQuery + Bootstrap chuyển xuống cuối `<body>` (không còn ở `<head>`) để HTML render ngay. ExcelJS lazy-load qua `_loadExcelJS()` — chỉ tải khi user gọi `saveMarkerData()`, `updateGitHubExcel()`, hoặc `exportReport()`. jsPDF + html2canvas lazy-load qua `_loadPrintLibs()` — chỉ tải khi user bấm "Xuất PDF" trong modal In bản vẽ.

## Phân quyền người dùng

Dữ liệu tài khoản đọc từ sheet `TaiKhoan` (cột A=tenDangNhap, B=matKhau, C=hoTen, D=vaiTro).
Bảng phân quyền định nghĩa ở sheet `PhanQuyen`:

| Vai trò | Xem bản đồ | Thêm/Sửa | Xóa | Kéo marker | GitHub sync |
|---------|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user`  | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user1` | ✓ | ✓ | ✗ | ✓ | ✓ |
| `demo`  | ✓ | ✗ | ✗ | ✗ | ✗ |

**Hàm kiểm tra (index.html):**
```javascript
canEdit()   // true nếu role = admin | user | user1
canDelete() // true nếu role = admin | user
```

**Enforcement:**
- `_applyRoleUI()` — ẩn nút "Thêm marker" và "GitHub sync" với `demo`, gọi sau đăng nhập
- `createMarkerPopupContent()` — render 1/2/3 nút hành động tùy role
- `addMarkerRowToMap()` — `draggable: canEdit()`
- `startAddMarker()` — guard trả về sớm nếu `!canEdit()`

---

## Tính năng đang phát triển

### 1. Log lịch sử thao tác ✅ đã implement

**Mục tiêu:** Ghi lại mọi thao tác xóa và chỉnh sửa đối tượng để tra cứu lại sau.

**Nơi lưu:** Tab mới trong Google Sheet tên **`LichSu`**

**Cấu trúc cột sheet `LichSu`:**

| Cột | Tên            | Mô tả                              |
|-----|----------------|------------------------------------|
| A   | Thời gian      | ISO timestamp (UTC+7)              |
| B   | Người thực hiện| `currentUser.username`             |
| C   | Thao tác       | `delete` / `edit` / `move`         |
| D   | ID đối tượng   | `row[0]`                           |
| E   | Tên trụ        | `row[1]`                           |
| F   | Chi tiết       | JSON string — field nào thay đổi   |

**GAS action mới cần thêm:** `log_action`
```javascript
// Payload gửi từ client
{ action: 'log_action', loaiThaoTac, id, tenTru, nguoiThucHien, chiTiet }
// GAS append 1 hàng vào sheet LichSu
```

**Điểm gọi trong client:**
- `deleteMarker()` → sau khi GAS xác nhận xóa thành công
- `saveMarkerPopup()` → sau khi GAS xác nhận lưu thành công (diff field cũ/mới)
- `pushMovedMarkersToSheet()` → ghi loại `move` cho từng marker đã kéo

**Quyền xem log:** Chỉ `admin` — sau khi đăng nhập, nếu `currentUser.role === 'admin'` thì hiển thị mục **"Lịch sử thao tác"** trong dropdown "Chọn trang" của controls panel (`#pages` select trong `controlsModal`). Các role khác không thấy option này.

---

### 2. Version tự động tăng khi push GitHub ✅ đã implement

**Mục tiêu:** Mỗi lần `updateGitHubExcel()` đồng bộ dữ liệu lên GitHub thành công, số version của data tăng lên, hiển thị trong app để biết dữ liệu đang ở bản nào.

**Thiết kế:**
- Hằng số trong `index.html`: `const DATA_VERSION = { major: 1, minor: 0, patch: 0 };`
- Mỗi lần sync thành công: `patch++` (hoặc tăng theo ngày: `YYYY.MM.DD.n`)
- Version lưu vào file `data/version.json` trên GitHub repo (cùng lúc push Excel)
- Hiển thị ở topbar hoặc trong controls modal: **"Dữ liệu v1.0.42"**

**File `data/version.json`:**
```json
{ "version": "1.0.42", "updated": "2026-06-11T08:30:00Z", "by": "admin" }
```

**Luồng:**
1. `updateGitHubExcel()` tải xong dữ liệu → đọc `data/version.json` từ GitHub API để lấy số hiện tại
2. Tăng patch: `patch + 1`
3. Gửi 2 file lên GitHub cùng một commit: `data/khaosat.xlsx` + `data/version.json`
4. Cập nhật UI hiển thị version mới

**Lưu ý:** Dùng GAS action `upload_to_github` hai lần liên tiếp (xlsx rồi version.json), hoặc mở rộng GAS để nhận mảng file.

---

### 3. In bản vẽ sơ đồ tuyến trạm đèn ✅ đã implement

**Mục tiêu:** Xuất bản vẽ kỹ thuật PDF (A3/A4 ngang) từ dữ liệu khảo sát, mô phỏng mẫu bản vẽ KNỞ P12 Trần Thiện Chánh:
- Nền bản đồ thực (CartoDB Voyager — có CORS)
- Ký hiệu trụ/tủ SVG đúng chuẩn
- **Đường cáp nối giữa các trụ + nhãn khoảng cách (m)**
- Bảng ký hiệu (legend) bên trái
- **Khung bản vẽ (title block) phía dưới theo chuẩn bản vẽ kỹ thuật**

---

#### Đường cáp (cable lines) — `_buildCableLines(rows)`

**Nguồn dữ liệu:**
- `row[14]` = `Marker gốc` — tên trụ cha (điểm nguồn cáp)
- `row[15]` = `Khoảng cách (m)` — chiều dài đoạn cáp đến trụ cha

**Cách vẽ:**
```
Mỗi trụ có row[14] → tìm tọa độ trụ cha → vẽ polyline nét đứt
Nhãn khoảng cách đặt tại midpoint của đoạn cáp
```

**Thông số Leaflet:**
```javascript
L.polyline([from, to], {
    color: '#1e40af', weight: 2.5, dashArray: '7 5', opacity: 0.8
})
// Nhãn midpoint:
L.divIcon({ className:'cable-label', html:`<span>${dist}m</span>` })
// CSS: nền trắng semi-transparent, viền xanh #1e40af, font 11px bold
```

**Cách nhập dữ liệu cáp vào khảo sát:**
- Trụ đầu tuyến (gần tủ nhất): `Marker gốc` = tên tủ điều khiển, `Khoảng cách` = khoảng cách thực tế
- Trụ tiếp theo: `Marker gốc` = tên trụ trước, `Khoảng cách` = khoảng cách đến trụ trước
- → App tự vẽ chuỗi đoạn cáp liên tiếp tạo thành sơ đồ tuyến

**Ký hiệu trong legend:**
```
───── ─────   Cáp nguồn  (đường đứt nét xanh đậm)
```

---

#### Khung tên bản vẽ (title block) — `_showPrintOverlay()`

**Bố cục tổng thể** (inject HTML vào `#map`, `position:absolute; inset:0`):
```
┌────────────────────────────────────────────────────────────────────────┐
│ BẢNG KÝ   │                                                            │
│ HIỆU      │          BẢN ĐỒ (CartoDB + marker SVG + đường cáp)        │
│ (150px)   │                                                            │
│ icon + tên│                                                            │
│ từng loại │                                                            │
│ ──── cáp  │                                                            │
├───────────┴────────────────────────┬──────────┬───────────┬──────┬────┤
│ BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN       │ TỈ LỆ    │ NGƯỜI LẬP │ NGÀY │ SBV│
│ HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ        │          │           │      │    │
│ [Tên bản vẽ / khu vực — to, đậm]  │ 1:1000   │ Nguyễn... │ ... │ 001│
└────────────────────────────────────┴──────────┴───────────┴──────┴────┘
  ←──────────────────── flex:1 ──────────────────→  ←── cố định ──────→
                                                     (90 / 110 / 90 / 70px)
```

**Cấu trúc HTML title block** (grid 5 cột, cao 64px, viền top 3px #1e293b):
| Cột | Nội dung | Min-width |
|-----|----------|-----------|
| 1 (flex:1) | Tiêu đề nhỏ "BẢN VẼ SƠ ĐỒ..." + tên bản vẽ lớn bên dưới | — |
| 2 | TỈ LỆ / `1 : 1000` | 90px |
| 3 | NGƯỜI LẬP / `currentUser.displayName` | 110px |
| 4 | NGÀY / `pdNgay` | 90px |
| 5 | SỐ BV / `pdSoBanVe` | 70px |

**Bảng ký hiệu legend** (trái, rộng 150px, cao = map - 64px, viền phải 2px):
- Header: "Bảng ký hiệu" (10px, uppercase, bold)
- Mỗi loại marker có trong tủ được chọn: SVG icon + tên loại
- Cuối cùng: ký hiệu đường cáp (nét đứt xanh + label "Cáp nguồn")
- Dùng `_makeLampIconSvg(color)` / `_makeCabinetIconSvg(color)` — SVG mini 14×16~20px

---

#### CORS tiles — giải pháp

- `html2canvas` không capture được tile OSM/Google (không có CORS header)
- **Giải pháp**: `_switchToPrintTile()` dùng `map.eachLayer()` lưu + xóa tất cả `L.TileLayer`, thêm CartoDB Voyager với `crossOrigin: 'anonymous'`
- `_restoreOriginalTiles()` restore lại sau khi capture
- Đợi 3 giây sau khi switch để CartoDB load xong
- Tile URL CartoDB: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`

---

#### Luồng xuất PDF (`exportDrawingPDF()`)

1. Lazy-load jsPDF + html2canvas (`_loadPrintLibs()`)
2. `_filterRowsByTu(tuName)` lọc rows theo tủ điều khiển
3. `_buildCableLines(rows)` vẽ đường cáp lên map
4. `_switchToPrintTile()` chuyển sang CartoDB (giữ nguyên góc nhìn — không auto-zoom)
5. Đợi 3s để tiles tải
6. `_showPrintOverlay(opts)` inject legend + title block vào `#map`
7. `html2canvas(#map, { useCORS:true, scale:2, ignoreElements: controls/toast })`
8. `new jsPDF({ orientation:'landscape', format:'a3'/'a4' })` → `addImage` full trang
9. `doc.save('tên-ngày.pdf')`
10. `finally`: `_hidePrintOverlay()`, `_removeCableLines()`, `_restoreOriginalTiles()`

---

#### Các hàm đã implement (index.html)

| Hàm | Vị trí | Mô tả |
|-----|--------|-------|
| `openPrintDrawingModal()` | ~line 1246 | Mở modal, điền tủ/người lập/ngày mặc định |
| `_filterRowsByTu(tuName)` | ~line 1263 | Lọc loadedData theo row[7] |
| `_buildCableLines(rows)` | ~line 1269 | Vẽ polyline cáp + nhãn m lên `_cableLayerGroup` |
| `_removeCableLines()` | ~line 1308 | Xóa `_cableLayerGroup` khỏi map |
| `_switchToPrintTile()` | ~line 1315 | Lưu tiles gốc, bật CartoDB CORS |
| `_restoreOriginalTiles()` | ~line 1323 | Restore tiles gốc |
| `_makeLampIconSvg(color)` | ~line 1910 | SVG đèn đường mini 14×20px |
| `_makeCabinetIconSvg(color)` | ~line 1893 | SVG tủ điện mini 14×16px |
| `_showPrintOverlay(opts)` | ~line 1332 | Inject legend + title block vào #map |
| `_hidePrintOverlay()` | ~line 1399 | Xóa `#printOverlay` |
| `exportDrawingPDF()` | ~line 1404 | Hàm chính — orchestrate toàn bộ luồng |
| `_loadPrintLibs()` | ~line 1490 | Lazy-load jsPDF 2.5.1 + html2canvas 1.4.1 |

#### Cải tiến cần làm (TODO)

- [ ] **Khung tên đúng chuẩn hơn**: thêm hàng "Chủ đầu tư / Đơn vị tư vấn / Người kiểm tra" như bản vẽ kỹ thuật thực tế
- [ ] **Số liệu tổng hợp trong title block**: tổng số trụ, tổng chiều dài cáp (tính từ khoangCach)
- [ ] **Zoom tự động theo tỉ lệ**: tính zoom từ `scale` → `map.setZoom()` trước khi capture
- [ ] **Đường cáp thể hiện loại cáp**: màu khác nhau theo loại cáp (nếu có trường dữ liệu)
- [ ] **Xuất nhiều trang** nếu tuyến dài không vừa 1 tờ

---

## Các pattern quan trọng

### Reverse geocoding không đồng bộ
```javascript
// _pendingGeocodePromise — tránh race condition khi drag marker liên tục
_pendingGeocodePromise = reverseGeocode(lat, lon);
// saveMarkerPopup() await promise này nếu vẫn còn pending
if (_pendingGeocodePromise) await _pendingGeocodePromise;
```

### Đồng bộ marker đã kéo — `dirtyMovedRows`
`marker.on('dragend')` không gọi GAS ngay. Thay vào đó:
1. `updateMarkerCoordinatesInData()` cập nhật `row[2]`, `row[3]`, `row[13]` (capNhat) và `dirtyMovedRows.add(row)`
2. Nút **Cập nhật** trong modal → `pushMovedMarkersToSheet()` loop gọi `syncRowToGAS(row, {silent:true})` cho từng row, hiện badge số marker chờ + tiến độ "Đang cập nhật i/N..."
3. `dirtyMovedRows.clear()` mỗi khi reload data (CSV / Excel) để tránh stale references
4. `syncRowToGAS(row, opts)` nhận `opts.silent` để tắt toast khi batch + trả về `boolean`

### GitHub sync qua GAS proxy
Client không giữ token. Luồng:
1. Client tải CSV từ `KHAOSAT_CSV_URL`
2. Client tạo Excel base64 (ExcelJS → fallback XLSX.js)
3. Client POST `{ action: 'upload_to_github', path, content }` lên GAS
4. GAS đọc `GITHUB_TOKEN` từ Script Properties → gọi GitHub API

### Tìm kiếm
`searchMarkers()` tìm theo tên (bỏ dấu), ID, và tọa độ `lat,lon`.

### Xuất CAD
DXF tọa độ VN-2000. Hàm `convertLatLonToVn2000(lat, lon)` → `{ x, y, zone }` (Gauss-Krüger, múi 6°, ellipsoid GRS80).
Cùng hàm này được dùng để tính cột `VN2000-X`, `VN2000-Y` khi lưu marker.

### Excel xuất báo cáo
2 sheet: **Chi tiết** (filtered rows) + **Tổng hợp** (count theo loại).
