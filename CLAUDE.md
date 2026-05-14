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

## Cấu trúc cột Google Sheet (DanhSachTru) — 19 cột

| Index | Tên cột            | Key payload JS  |
|-------|--------------------|-----------------|
| [0]   | ID                 | id              |
| [1]   | Tên trụ            | tenTru          |
| [2]   | Lat                | lat             |
| [3]   | Lon                | lon             |
| [4]   | Ghi chú            | ghiChu          |
| [5]   | Người KS           | nguoiKS         |
| [6]   | Loại               | loai            |
| [7]   | Tủ điều khiển      | tuDieuKhien     |
| [8]   | Loại trụ           | loaiTru         |
| [9]   | Loại cần           | loaiCan         |
| [10]  | Loại đèn           | loaiDen         |
| [11]  | Công suất          | congSuat        |
| [12]  | Ảnh                | hinhAnh         |
| [13]  | Thời gian cập nhật | capNhat         |
| [14]  | Marker gốc         | markerGoc       |
| [15]  | Khoảng cách (m)    | khoangCach      |
| [16]  | Mã PE              | maPE            |
| [17]  | Đường              | duong           |
| [18]  | Phường/ Xã         | phuongXa        |

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

### Service Worker (sw.js)
- Cache tĩnh: `index.html`, icons, `data/khaosat.xlsx` (cache-first)
- Map tiles OSM / Google: cache-first, tối đa 300 tile (`map-tiles-v1`)
- Google Sheets CSV + GAS URL: **luôn fetch mới** (bỏ qua cache)
- Đăng ký trong `index.html` (cuối body):
```javascript
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
```

## Thư viện client

| Thư viện                  | Phiên bản | Dùng cho                        |
|---------------------------|-----------|---------------------------------|
| Leaflet                   | 1.9.4     | Bản đồ                          |
| leaflet.markercluster     | 1.5.3     | Gộp marker theo zoom            |
| Bootstrap                 | 4.6.2     | Layout, modal                   |
| jQuery                    | 3.7.1     | Bootstrap dependency            |
| XLSX.js                   | 0.18.5    | Đọc/ghi Excel (fallback)        |
| ExcelJS                   | 4.3.1     | Ghi Excel có hình ảnh (primary) |
| Nominatim (OSM)           | —         | Reverse geocoding (tiếng Việt)  |
| OSRM                      | —         | Chỉ đường xe máy                |

## Các pattern quan trọng

### Reverse geocoding không đồng bộ
```javascript
// _pendingGeocodePromise — tránh race condition khi drag marker liên tục
_pendingGeocodePromise = reverseGeocode(lat, lon);
// saveMarkerPopup() await promise này nếu vẫn còn pending
if (_pendingGeocodePromise) await _pendingGeocodePromise;
```

### GitHub sync qua GAS proxy
Client không giữ token. Luồng:
1. Client tải CSV từ `KHAOSAT_CSV_URL`
2. Client tạo Excel base64 (ExcelJS → fallback XLSX.js)
3. Client POST `{ action: 'upload_to_github', path, content }` lên GAS
4. GAS đọc `GITHUB_TOKEN` từ Script Properties → gọi GitHub API

### Tìm kiếm
`searchMarkers()` tìm theo tên (bỏ dấu), ID, và tọa độ `lat,lon`.

### Xuất CAD
DXF tọa độ VN-2000 múi 3°, kinh tuyến trục 105°. Hàm `toVN2000()`.

### Excel xuất báo cáo
2 sheet: **Chi tiết** (filtered rows) + **Tổng hợp** (count theo loại).
