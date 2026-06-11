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

### Service Worker (sw.js) — hiện tại v3

| Cache name      | Chiến lược   | Nội dung                                          |
|-----------------|--------------|---------------------------------------------------|
| `lighting-survey-v3` | Network-first | `index.html`, `.html` (luôn lấy code mới)   |
| `lighting-survey-v3` | Cache-first  | Icon/ảnh tĩnh (pre-cache khi install)             |
| `map-tiles-v1`  | Cache-first  | Tile bản đồ OSM/Google/CartoDB (tối đa 300 tile)  |
| `cdn-libs-v1`   | Cache-first  | Toàn bộ CDN JS/CSS/fonts (jQuery, Leaflet, v.v.)  |

- Google Sheets CSV + GAS URL: **luôn fetch mới**, không cache
- **Bump cache name** (`v3` → `v4`, v.v.) mỗi khi cần xóa cache cũ hoàn toàn
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
| Nominatim (OSM)           | —         | Fetch on-demand     | Reverse geocoding (tiếng Việt)  |
| OSRM                      | —         | Fetch on-demand     | Chỉ đường xe máy                |

> **Lưu ý tải thư viện:** jQuery + Bootstrap chuyển xuống cuối `<body>` (không còn ở `<head>`) để HTML render ngay. ExcelJS lazy-load qua `_loadExcelJS()` — chỉ tải khi user gọi `saveMarkerData()`, `updateGitHubExcel()`, hoặc `exportReport()`.

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

### 3. In bản vẽ sơ đồ tuyến trạm đèn (chưa implement)

**Mục tiêu:** Xuất bản vẽ kỹ thuật PDF chuẩn (A3/A4) từ dữ liệu khảo sát, gồm:
- Nền bản đồ thực (OpenStreetMap/CartoDB)
- Ký hiệu trụ/tủ đúng chuẩn (SVG icon đã có)
- Đường cáp nối giữa các trụ + khoảng cách
- Bảng ký hiệu (legend) bên trái
- Khung bản vẽ (title block) phía dưới

**Thách thức kỹ thuật chính — CORS tiles:**
- `html2canvas` không capture được tile OSM tiêu chuẩn (không có header CORS)
- **Giải pháp**: khi chuẩn bị in, tạm chuyển tile layer sang **CartoDB Voyager** (có CORS) với `crossOrigin: 'anonymous'`, capture bằng `html2canvas({ useCORS: true, allowTaint: false })`, rồi khôi phục tile gốc
- Tile URL CartoDB: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`

**Thư viện cần thêm (lazy-load):**
| Thư viện  | CDN                                                              | Mục đích               |
|-----------|------------------------------------------------------------------|------------------------|
| jsPDF     | `cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`  | Tạo file PDF           |
| html2canvas | `cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` | Chụp map canvas |

**Nguồn dữ liệu đường cáp:**
- `row[14]` = `Marker gốc` — tên trụ cha (điểm kết nối cáp)
- `row[15]` = `Khoảng cách (m)` — khoảng cách đến trụ cha
- Dựng graph: mỗi trụ → trụ cha → vẽ polyline + label khoảng cách ở giữa đoạn

**Cấu trúc bản vẽ (mô phỏng mẫu KNỞ P12 Trần Thiện Chánh):**
```
┌─────────────────────────────────────────────────────────────────┐
│ BẢNG KÝ HIỆU │                                                  │
│               │         BẢN ĐỒ (nền CartoDB)                    │
│ 1. Đèn LED    │       + ký hiệu SVG trụ/tủ                      │
│ 2. Trụ STK    │       + đường cáp + khoảng cách                 │
│ 3. Tủ CS nổi  │                                                  │
│ ...           │                                                  │
├───────────────┴──────────────────────────────────────────────────┤
│ KHUNG BẢN VẼ: Tên tủ | Khu vực | Tỉ lệ | Ngày | Số bản vẽ      │
└─────────────────────────────────────────────────────────────────┘
```

**Tỉ lệ bản vẽ:**
- Preset cho user chọn: 1:500 / 1:1000 / 1:2000 / 1:5000
- Auto-zoom map đến zoom tương ứng khi chọn tỉ lệ
- Tính zoom từ tỉ lệ: `zoom = log2(559082264.028 / scale / (DPI/96))`

**Khung bản vẽ (title block) — các trường nhập:**
| Trường              | Nguồn dữ liệu              |
|---------------------|----------------------------|
| Tên tủ điều khiển   | Chọn từ dữ liệu khảo sát   |
| Phường/Xã, Quận     | Tự động từ dữ liệu marker  |
| Tỉ lệ               | User chọn                  |
| Ngày lập            | Mặc định hôm nay           |
| Người lập           | `currentUser.displayName`  |
| Số bản vẽ           | Tự động hoặc nhập tay      |

**Luồng xuất PDF:**
1. User mở modal "In bản vẽ" → nhập thông tin title block, chọn tỉ lệ, chọn khổ giấy (A3/A4)
2. App tạm chuyển tile sang CartoDB, zoom map đến tỉ lệ phù hợp
3. Vẽ đường cáp lên `L.polyline` với className riêng
4. Đợi tiles load xong (`map.on('load')` hoặc timeout 2s)
5. `html2canvas(mapContainer, { useCORS: true })` → imageData
6. Dùng jsPDF: đặt hình map vào vùng chính, vẽ legend trái, title block dưới bằng jsPDF text/rect API
7. `doc.save('banve-[tenTu]-[ngay].pdf')`
8. Khôi phục tile layer gốc, xóa polyline cáp tạm

**File liên quan:**
- `index.html` — thêm modal `#printDrawingModal`, hàm `exportDrawingPDF()`, `_buildCableLines()`, `_buildLegend()`, `_buildTitleBlock()`
- `sw.js` — thêm `cdnjs.cloudflare.com` vào CDN_HOSTS (đã có)

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
