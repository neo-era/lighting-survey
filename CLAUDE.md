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

## Cấu trúc cột Google Sheet (DanhSachTru) — 25 cột

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
| [21]  | Số lượng đèn       | soLuongDen      | Số bóng đèn trên 1 trụ (integer) |
| [22]  | Loại cáp           | loaiCap         | `'noi'` (default) hoặc `'ngam'` |
| [23]  | Độ chính xác (m)   | accuracy        | Raw `pos.coords.accuracy` (vd `0.018`) |
| [24]  | Chế độ GPS         | gpsMode         | `'phone'` hoặc `'rtk'` |

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
- Zoom ≥ 17 → hiện nhãn tên (`labelLayerGroup`, iconAnchor `[40, -20]`)

### Icon SVG (L.divIcon, className: '')
- `makeLampIcon(color, loaiDen, congSuat, soLuong)` — icon **động** theo số bóng đèn:
  - `soLuong=1` → 1 cần phải, 26×42px, iconAnchor [12, 42]
  - `soLuong=2` → 2 cần đối xứng, 32×42px, iconAnchor [15, 42]
  - `soLuong=3` → 3 cần (trái+thẳng+phải), 40×42px, iconAnchor [19, 42]
  - `soLuong=4` → 4 cần, 46×42px, iconAnchor [22, 42]
  - Badge compact bên dưới icon: `2L100` = 2 bóng LED 100W
- `makeCabinetIcon(color)` — hình chữ nhật tủ điện, 24×28px, iconAnchor [12, 28]
- Anchor đặt ở đáy icon → tọa độ địa lý = chân cột/tủ
- `addMarkerRowToMap(row)` tạo icon **per-marker** với loaiDen/congSuat/soLuong từ `row[10]/[11]/[21]`

## GAS — Script Properties

| Key          | Value                           |
|--------------|---------------------------------|
| GITHUB_TOKEN | ghp_xxx (scope: contents:write) |

## GAS actions (doPost)

| action           | Mô tả                                                         |
|------------------|---------------------------------------------------------------|
| login            | Xác thực từ sheet `TaiKhoan` (cột A=user, B=pass, C=tên, D=role, E=vung) |
| full_update      | Upsert 1 hàng vào `DanhSachTru` (tìm theo ID rồi Tên trụ)   |
| delete_row       | Xóa 1 hàng khỏi `DanhSachTru` (tìm theo ID hoặc Tên trụ)    |
| upload_image     | Upload ảnh base64 → `images/<name>.<ext>` trên GitHub        |
| upload_to_github | Nhận Excel base64 từ client → upload file lên GitHub repo    |

### Lưu ý GAS
- Mỗi lần sửa `gas-khaosat.js` phải **redeploy New version** (không tạo deployment mới — sẽ đổi URL)
- `norm()` chuẩn hóa tên cột: lowercase + NFC → khớp header dù có/không dấu
- `findRowNum()` tìm hàng theo ID trước, fallback `oldTenTru` (tên cũ trước khi edit), fallback `tenTru` — đảm bảo sửa tên trụ không tạo row mới
- `buildFieldValues()` **cho phép empty string** (`''`) — để clear cell khi xóa cáp (`row[14]=''`, `row[15]=''`); skip `oldTenTru` (không ghi vào sheet)
- `updateRowFields()` dùng `setValue('')` khi value là `null` hoặc `''` → xóa nội dung cell

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

### Service Worker (sw.js) — hiện tại v6

| Cache name      | Chiến lược   | Nội dung                                          |
|-----------------|--------------|---------------------------------------------------|
| `lighting-survey-v6` | Network-first | `index.html`, `.html` (luôn lấy code mới)   |
| `lighting-survey-v6` | Cache-first  | Icon/ảnh tĩnh (pre-cache khi install)             |
| `map-tiles-v1`  | Cache-first  | Tile bản đồ OSM/Google/CartoDB (tối đa 300 tile)  |
| `cdn-libs-v1`   | Cache-first  | Toàn bộ CDN JS/CSS/fonts (jQuery, Leaflet, v.v.)  |

- Google Sheets CSV + GAS URL: **luôn fetch mới**, không cache
- **Bump cache name** (`v6` → `v7`, v.v.) mỗi khi cần xóa cache cũ hoàn toàn
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

Dữ liệu tài khoản đọc từ sheet `TaiKhoan` (cột A=tenDangNhap, B=matKhau, C=hoTen, D=vaiTro, **E=vung**).
Bảng phân quyền định nghĩa ở sheet `PhanQuyen`:

| Vai trò | Xem bản đồ | Thêm/Sửa | Xóa | Kéo marker | GitHub sync |
|---------|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user`  | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user1` | ✓ | ✓ | ✗ | ✓ | ✓ |
| `demo`  | ✓ | ✗ | ✗ | ✗ | ✗ |

**Cột E — `vung` (phân vùng địa bàn):**

Danh sách tên sheet được phép, phân tách bằng dấu phẩy. Trống = được phép tất cả.

```
| tenDangNhap | matKhau | hoTen | vaiTro | vung                    |
| lamvt       | ***     | Lâm   | user   | Quan1,Quan3             |
| hungnt      | ***     | Hùng  | user   | Quan5,Quan8,Quan10      |
| admin       | ***     | Admin | admin  |          ← trống = tất cả |
```

GAS trả về `vung: ['Quan1','Quan3']` trong login response. Client lưu vào `currentUser.vung`.

**Hàm kiểm tra (index.html):**
```javascript
canEdit()        // true nếu role = admin | user | user1
canDelete()      // true nếu role = admin | user
_allowedPages()  // admin luôn thấy tất cả; role khác lọc theo currentUser.vung ([] = tất cả)
```

**⚠ Admin bypass vung filter:** `_allowedPages()` check `role === 'admin'` trước `vung` — admin luôn thấy đủ 15 địa bàn dù cột `vung` trong sheet TaiKhoan có gõ gì. Điều này tránh việc admin bị mất access do gõ nhầm sheet trong `vung`.

**Enforcement:**
- `_applyRoleUI()` → `_buildDistrictOptions()` — chỉ render district options trong `_allowedPages()`
- `_showApp()` — sau login, tự động load địa bàn đầu tiên được phép (nếu default không nằm trong vùng)
- `switchDistrict()` — guard: từ chối nếu sheet không có trong `_allowedPages()`
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

### 2. Version tự động tăng mỗi commit push ✅ đã implement

**Mục tiêu:** `data/version.json` tự bump `patch` mỗi khi có commit push lên `main` (kể cả push code thường lẫn upload từ app qua GAS) — không bump trong JS app nữa.

**Cơ chế:** GitHub Action `.github/workflows/bump-version.yml`
- Trigger: `on: push` to `main`, **`paths-ignore: data/version.json`** (tránh loop vô hạn)
- Đọc `data/version.json` → `patch + 1` → ghi lại với `updated` (UTC ISO) + `by` (github.actor)
- Commit message: `chore: bump version to vX.Y.Z [skip ci]`
- Dùng `GITHUB_TOKEN` mặc định, không cần PAT

**Thiết kế:**
- Hằng số trong `index.html`: `const DATA_VERSION = { major: 1, minor: 0, patch: 0 };`
- Title tab + pill (nếu có) hiển thị `Lighting System V<major>.<minor>.<patch>`
- App không tự tăng version. `updateGitHubExcel()` chỉ upload Excel — workflow lo phần version
- Sau khi user bấm "GitHub" trong app, `setTimeout(_loadDataVersion, 15000)` refresh version sau 15s để bắt kịp workflow

**File `data/version.json`:**
```json
{ "major": 1, "minor": 0, "patch": 42, "updated": "2026-06-11T08:30:00Z", "by": "lavipco" }
```

**Major/minor**: sửa tay file `data/version.json` rồi commit — workflow chỉ tự bump `patch`.

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

#### Layout bản vẽ — `_showPrintOverlay()`

**Bố cục tổng thể** (inject HTML vào `#map`, `position:absolute; inset:0`):
```
┌──────────────────────── #printOverlay (inset:0) ───────────────────────┐
│  ╔══════════════════ print-frame (inset:14px) ═══════════════════════╗  │
│  ║  ┌──────── TIÊU ĐỀ (top:0, border-bottom) ────────────────────┐  ║  │
│  ║  │  BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ  │  ║  │
│  ║  │  TỦ ĐIỀU KHIỂN - [tenTu]          TL: 1 : [scale]          │  ║  │
│  ║  └────────────────────────────────────────────────────────────┘  ║  │
│  ║  ┌──────────────────────────────────────────────────────────┐    ║  │
│  ║  │ [BẢNG KÝ HIỆU]  BẢN ĐỒ CartoDB toàn màn hình           │    ║  │
│  ║  │ (float top-left) + marker SVG + đường cáp nét đứt        │    ║  │
│  ║  │ [THỐNG KÊ: N trụ / X m cáp] — góc dưới phải             │    ║  │
│  ║  └──────────────────────────────────────────────────────────┘    ║  │
│  ║  ┌──────────────────── title block (110px) ──────────────────┐   ║  │
│  ║  │ TT QLGT + CV PHỤ TRÁCH │ ⚙ │ CTCP + CS KV │ NGƯỜI LẬP │ BV │ SHBV│║  │
│  ║  │ (trống ký tên)          │   │ (trống ký tên)│ (trống)   │ tên│ SX: │║  │
│  ║  │ (trống)                 │   │ (trống)       │ (trống)   │ tỉlệ│ BVS:│║  │
│  ║  │ [cvPhuTrach]            │   │ [csKhuVuc]    │[nguoiLap] │    │Ngày:│║  │
│  ║  └──────────────────────────────────────────────────────────┘   ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
└────────────────────────────────────────────────────────────────────────┘
                    ↑ margin trắng 14px mỗi cạnh ↑
```

**Print frame:** `position:absolute; inset:14px; border:2px solid #1e293b` — tạo margin in + khung viền kỹ thuật

**Tiêu đề bản vẽ** (top header strip, `position:absolute; top:0`):
- Dòng 1 (12px, bold, uppercase): **BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ**
- Dòng 2 (9px): **TỦ ĐIỀU KHIỂN - [tenTu]** &emsp; **TL: 1 : [scale]**
- Nền `rgba(255,255,255,.96)`, border-bottom phân tách với bản đồ

**Footer bottom-left (gộp legend + stats)** — `position:absolute; left:0; bottom:0; width:37.5%; height:110px`:
- Đối xứng với title block (62.5%, bottom-right) tạo footer thống nhất dưới đáy bản vẽ
- `<table>` 3 cột: **Bảng ký hiệu** (60%) | **Số lượng** (22%) | **Đơn vị** (18%)
- Mỗi row có `border-bottom: 1px solid #94a3b8` (line gạch dưới phân tách)
- Header row nền `#f1f5f9`, border-bottom đậm `1.5px solid #1e293b`
- Icon size khớp map: lamp 24×38px, cabinet 22×26px (xem `_makeLampIconSvg` / `_makeCabinetIconSvg`)
- Mỗi loại marker → row với count tương ứng (`countByType[t]`), đơn vị `trụ`/`tủ`
- Row cáp nguồn ở cuối: tổng `m` cáp (logic Haversine fallback)

**Tổng cáp** (`totalCap`) — chỉ cộng rows có Marker gốc (`r[14]`):
- Nếu `r[15]` (Khoảng cách) hợp lệ → dùng
- Ngược lại → `haversineM(parent_lat, parent_lon, child_lat, child_lon)` từ `posIdx` build từ toàn bộ markers

**Khung tên (title block)** (cao **110px**, table 4 hàng × 5 cột):
```
Col:  18%               18%   18%        34%               12%
      ┌─────────────────┬────┬──────────────────┬──────────┬─────────────────┬──────────┐
R1:   │ TT QLGT...      │    │ CTCP CSCC...     │ NGƯỜI LẬP│ BẢN VẼ SƠ ĐỒ   │ SHBV:    │
      │ CHUYÊN VIÊN     │ ⚙  │ CHIẾU SÁNG KHU  │ (nhãn)   │ TUYẾN TRẠM ĐÈN  │          │
      │ PHỤ TRÁCH ĐB    │    │ VỰC TRUNG TÂM   │          │ (rowspan=2)     │          │
      ├─────────────────┤    ├──────────────────┼──────────┤                 ├──────────┤
R2:   │ (trống ký tên)  │    │ (trống ký tên)   │ (trống)  │                 │ Soát xét:│
      ├─────────────────┤    ├──────────────────┼──────────┼─────────────────┼──────────┤
R3:   │ (trống)         │    │ (trống)          │ (trống)  │ BẢN VẼ: [tenTu] │ Bản vẽ số│
      │                 │    │                  │          │ Tỉ lệ: 1:...    │(rowspan=2)│
      ├─────────────────┤    ├──────────────────┼──────────┤                 ├──────────┤
R4:   │ [cvPhuTrach]    │    │ [csKhuVuc]       │[nguoiLap]│                 │ Ngày:    │
      └─────────────────┴────┴──────────────────┴──────────┴─────────────────┴──────────┘
```
- **Hàng 1**: tên tổ chức + nhãn vai trò gộp 1 ô (2 dòng text stacked) + NGƯỜI LẬP label + BV title + SHBV
- **Hàng 2–3**: để trống cho ký tên (in ra rồi ký tay)
- **Hàng 4**: tên thực tế — `cvPhuTrach`, `csKhuVuc`, `nguoiLap` (bottom-align) + Ngày

**Modal fields** (`#printDrawingModal`):
- `pdTuSelect` — tủ điều khiển, `pdScale` — tỉ lệ, `pdPaper` — khổ giấy, `pdRotation` — xoay map
- `pdTenTu` — tên bản vẽ, `pdSoBanVe` — số bản vẽ
- `pdNguoiLap` — người lập, `pdNgay` — ngày (luôn lấy hôm nay, không persist)
- `pdCVPhuTrach` — chuyên viên phụ trách địa bàn, `pdCSKhuVuc` — chiếu sáng khu vực

**Persistence** (`_PD_FIELDS` + `_savePdFields()` / `_restorePdFields()`):
- Tất cả pd* field (trừ `pdNgay`) lưu vào localStorage key `pd_<id>`
- `_restorePdFields()` gọi trong `openPrintDrawingModal` (chỉ ghi nếu input đang trống)
- `_savePdFields()` gọi trong `_preparePrintLayout` (chạy mỗi lần preview hoặc export)
- `<select>` chỉ restore nếu option còn tồn tại (handle data đổi)

**Fallback tên bản vẽ** trong `exportDrawingPDF`:
- Ưu tiên `pdTenTu` → fallback `activeTu` (chỉ khi filter overlay đang lọc đúng 1 tủ) → default `'sodotuyen'`
- File PDF: `<safeName>-<ngay>.pdf`

**File `banve-mau.html`** — preview tĩnh layout bản vẽ (không cần đăng nhập):
- Cấu trúc: `.paper` (padding:14px) → `.print-frame` (border:2px) → `.map-wrap` + `.title-block`
- Legend `.legend-float` + cable SVG inline + title header strip

---

#### CORS tiles — giải pháp

- `html2canvas` không capture được tile OSM/Google (không có CORS header)
- **Giải pháp**: `_switchToPrintTile()` dùng `map.eachLayer()` lưu + xóa tất cả `L.TileLayer`, thêm CartoDB Voyager với `crossOrigin: 'anonymous'`
- `_restoreOriginalTiles()` restore lại sau khi capture
- **Wait**: `_waitForTileLoad(_printCartoLayer, 5000)` — chờ event `'load'` của layer (fallback 5s timeout)
- Tile URL CartoDB: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`

---

#### Tỷ lệ in PDF chính xác — `_zoomToScale()` + fractional zoom

**Math đúng** (sau fix 2026-06-16):

Pipeline: map screen → html2canvas (scale 2) → addImage stretch lên (paperMmW × paperMmH).
Image bị **stretch** lên kích thước giấy, KHÔNG phụ thuộc DPI screen.

```
ground_per_screen_px = (paperMmH × scale) / (1000 × H_screen) [m/px]
Leaflet: ground_per_px = earthCirc × cos(lat) / (256 × 2^Z)
→ 2^Z = earthCirc × cos(lat) × 1000 × H_screen / (256 × paperMmH × scale)
```

**Implementation `_zoomToScale(scale, paperMmW, paperMmH)`:**
- Dùng `H_screen` + `mmH` vì height không đổi qua resize aspect ratio
- Gọi `map.setZoom(zoomExact)` — **fractional zoom** (không round)
- Cần `map.options.zoomSnap = 0` để Leaflet chấp nhận fractional → set trong `_preparePrintLayout`, restore trong cleanup (3 path: helper cleanup, `closePrintPreview`, export `finally`)

**Bug cũ:** dùng `96 / 25.4` (DPI screen) — sai 2-3× zoom level vì image bị stretch lên paper, không in 1:1 từ pixel screen.

**Widget chọn tỷ lệ** (`_applyMapScale(scale)`) — dropdown **trong ☰ panel** (đã chuyển từ MapTools widget bên phải):
- Options 1:200, 500, 1000, 2000, 5000, 10000, 25000 với reference A3
- Section "Tỷ lệ bản đồ (A3)" với badge `Z <zoom>` (xanh) + dropdown + display badge "Đang áp dụng 1:N" (gradient xanh, chỉ hiện khi chọn)
- onChange → bật zoomSnap=0, gọi `_zoomToScale`, restore zoomSnap sau 200ms
- `_applyMapScale._inProgress` flag để zoomend listener không reset dropdown
- Zoomend listener sync `#panelZoomDisplay` + reset dropdown/display khi user zoom thủ công
- Modal open (controlsBtn click) sync `#panelZoomDisplay` với `map.getZoom()` hiện tại

---

#### PRINT_CONFIG — constants tập trung

`PRINT_CONFIG` object ở đầu print section ([index.html:~1867](index.html#L1867)):
```javascript
{
    paper: { a3: {mmW:420, mmH:297}, a4: {mmW:297, mmH:210} },
    aspectRatioThresholdPx: 5,       // ngưỡng resize map
    resyncDelayMs: { afterResize:600, normal:200 },
    rotationDelayMs: 150,
    svgCableDelayMs: 100,
    overlayDelayMs:  300,
    captureScale: 2,
    jpegQuality:  0.93,
    tileLoadTimeoutMs: 5000
}
```
Mọi magic number trong luồng in tham chiếu qua object này — dễ tune.

---

#### `_preparePrintLayout(opts)` — helper chung preview + export

opts: `{ scale, paper='a3', displayMsg, skipTileSetup }` → returns `{ rows, cleanup }`

Gom 4 bước common:
1. `_savePdFields()` — persist form vào localStorage
2. `_getFilteredRows()`
3. (nếu `!skipTileSetup`) `_switchToPrintTile` + `_zoomToScale` + `_waitForTileLoad`
4. Set `zoomSnap = 0` cho fractional zoom

`cleanup` bao trong `_safe()` wrapper → invoke `_hidePrintOverlay`, `_removePrintCableSvg`, `_removeCableLines`, `_restoreOriginalTiles`, `_clearMapRotation`, restore zoomSnap.

`exportDrawingPDF` truyền `skipTileSetup: _previewMode` để không double-setup khi đến từ preview.

---

#### Luồng xuất PDF (`exportDrawingPDF()`) — phiên bản hiện tại

Biến `mapEl`, `origStyleW`, `origStyleH`, `resized` khai báo **ngoài** `try` để `finally` truy cập được.

1. Lazy-load jsPDF + html2canvas (`_loadPrintLibs()`)
2. `_filterRowsByTu(tuName)` lọc rows theo tủ điều khiển
3. `_switchToPrintTile()` + `_zoomToScale(scale)` + đợi 3s (bỏ qua khi `_previewMode`)
4. **Force aspect ratio**: `targetW = offsetHeight × (mmW/mmH)` — luôn áp dụng (`Math.abs(...) > 5`), không chỉ khi hẹp hơn
5. `map.invalidateSize` + `setView({reset:true})` sau resize → đợi 600ms
6. `_buildPrintCableSvg(rows)` — vẽ cáp bằng **SVG trực tiếp trong `#map`** (không qua Leaflet pane)
7. `_showPrintOverlay(opts)` inject tiêu đề + legend + stats + title block
8. `html2canvas(#map, { useCORS:true, scale:2, ignoreElements: controls/toast })`
9. `new jsPDF({ orientation:'landscape', format:'a3'/'a4' })` → `addImage` full trang
10. `doc.save('tên-ngày.pdf')`
11. `finally`: `_hidePrintOverlay()`, `_removePrintCableSvg()`, `_removeCableLines()`, `_restoreOriginalTiles()`, restore kích thước map

**Tại sao SVG inline thay cho L.polyline (bước 6):**
- `L.polyline` nằm trong `leaflet-overlay-pane` có CSS `transform: translate3d()` do Leaflet quản lý
- html2canvas áp dụng transform sai khi pane bị offset → đường cáp lệch vị trí trong PDF
- Giải pháp: tạo `<svg id="_printCableSvg">` gắn trực tiếp vào `#map`, dùng `map.latLngToContainerPoint()` → tọa độ pixel trong container space → html2canvas capture chính xác

---

#### Các hàm đã implement (index.html)

| Hàm | Mô tả |
|-----|-------|
| `openPrintDrawingModal()` | Mở modal, restore form từ localStorage qua `_restorePdFields()` |
| `_savePdFields()` / `_restorePdFields()` | Persist 9 field `pd*` (trừ `pdNgay`) qua localStorage |
| `_preparePrintLayout(opts)` | Helper chung preview + export: tile setup + zoom + cleanup |
| `_filterRowsByTu(tuName)` | Lọc loadedData theo row[7] (tủ điều khiển) |
| `_buildCableLines(rows)` | Vẽ L.polyline cáp nét đứt — dùng cho xem trước trên màn hình |
| `_buildPrintCableSvg(rows, rotation)` | Vẽ cáp bằng SVG inline trong `#map` — dùng cho PDF capture (không lệch) |
| `_removePrintCableSvg()` | Xóa `#_printCableSvg` khỏi DOM |
| `_removeCableLines()` | Xóa `_cableLayerGroup` khỏi map |
| `_switchToPrintTile()` | Lưu tiles gốc, bật CartoDB CORS |
| `_restoreOriginalTiles()` | Restore tiles gốc sau khi capture |
| `_waitForTileLoad(layer, maxMs)` | Đợi event `'load'` của tile layer, fallback timeout |
| `_zoomToScale(scale, mmW, mmH)` | Tính fractional zoom từ tỉ lệ + paper dim → `map.setZoom(zoomExact)` |
| `_applyMapScale(scaleStr)` | Widget dropdown bên phải: set zoom map theo tỉ lệ chọn (giả định A3) |
| `_makeLampIconSvg(color)` | SVG đèn đường 24×38px khớp marker thật |
| `_makeCabinetIconSvg(color)` | SVG tủ điện 22×26px khớp marker thật |
| `_showPrintOverlay(opts)` | Inject tiêu đề + footer (legend+stats) + title block vào #map |
| `_hidePrintOverlay()` | Xóa `#printOverlay` |
| `openPrintPreview()` | Preview overlay trên map — không export PDF |
| `closePrintPreview()` | Cleanup preview state, restore zoomSnap |
| `exportDrawingPDF()` | Hàm chính — orchestrate toàn bộ luồng, finally bao `_safe(fn, label)` 8 step |
| `_loadPrintLibs()` | Lazy-load jsPDF 2.5.1 + html2canvas 1.4.1 (timeout 15s, cleanup script tag khi fail) |

**`_showPrintOverlay(opts)` nhận:**
```javascript
{ rows, tenTu, scale, ngay, nguoiLap, soBanVe, cvPhuTrach, csKhuVuc }
```

**`_zoomToScale(scale, paperMmW, paperMmH)` — công thức đúng:**
```javascript
const H = document.getElementById('map').offsetHeight;
// 2^Z = earthCirc × cos(lat) × 1000 × H / (256 × paperMmH × scale)
const zoomExact = Math.log2(40075016.686 * Math.cos(latRad) * 1000 * H / (256 * paperMmH * scale));
map.setZoom(zoomExact); // fractional zoom — cần zoomSnap=0
```

#### Tất cả cải tiến đã hoàn thành ✅

- [x] Legend float inside map (không che map, semi-transparent)
- [x] Print frame `inset:14px` — margin trắng xung quanh
- [x] Title header strip ở đầu bản vẽ (tên BV + tủ + tỉ lệ)
- [x] Thống kê tổng trụ + tổng cáp (góc dưới phải)
- [x] Zoom tự động theo tỉ lệ (`_zoomToScale`)
- [x] Title block 110px, 4 hàng: hàng 1 = label, hàng 2–3 = trống ký tên, hàng 4 = tên người
- [x] Modal có đủ field: `pdCVPhuTrach` (chuyên viên), `pdCSKhuVuc` (khu vực)
- [x] **4.3 Aspect ratio**: force `targetW = height × ratio` luôn áp dụng (không chỉ khi hẹp)
- [x] **SVG cable fix**: `_buildPrintCableSvg` thay L.polyline cho PDF — không bị lệch pane transform

#### Tối ưu 8 prompt P1-P8 (2026-06-16) — đã apply ✅

- [x] **P1** Fix bug `tuName` undefined → fallback `activeTu` (filter overlay 1 tủ) → `'sodotuyen'`
- [x] **P2** Robust cleanup trong `finally` của `exportDrawingPDF` — `_safe(fn, label)` bao 8 step
- [x] **P3** `_loadPrintLibs` cleanup script tag khi fail/timeout 15s, check libs đã load chưa
- [x] **P4** Thay `setTimeout(3000)` bằng `_waitForTileLoad(layer, 5000)` đợi event `'load'`
- [x] **P5** Extract `_preparePrintLayout(opts)` chung cho preview + export
- [x] **P6** Persist toàn bộ pd* field qua localStorage (`_savePdFields`/`_restorePdFields`)
- [x] **P7** Tách `displayInfo()` toast xanh dương cho progress (vs `displayError` đỏ)
- [x] **P8** `PRINT_CONFIG` constants cho paper size + magic numbers (delays, scale, quality)

#### Fix tỷ lệ in chính xác (2026-06-16) ✅

- [x] `_zoomToScale` công thức mới — H_screen + mmH thay vì DPI 96 (sai 2-3× zoom)
- [x] Fractional zoom — `zoomSnap=0` set trong print mode, restore qua 3 cleanup paths
- [x] Footer bottom-left mới — `<table>` 3 cột (Bảng ký hiệu | Số lượng | Đơn vị), đối xứng title block
- [x] Icon legend khớp map: lamp 24×38, cabinet 22×26
- [x] Title block column widths: Người lập 18% (=Phó GĐ), SHBV 12% (was 20%)
- [x] Widget Tỷ lệ (A3) dropdown trong MapTools control — `_applyMapScale()`

---

### 4. Cải tiến bản vẽ — kế hoạch tiếp theo

#### 4.1 — Khung tên 62.5% chiều rộng

**Mục tiêu:** Thu hẹp title block xuống còn 62.5% chiều rộng, đặt góc dưới-phải, để lại phần bên trái cho bản đồ thở.

**Thiết kế:**
- Hiện tại (đã implement): `position:absolute; right:0; bottom:0; width:62.5%; height:110px`
- Stats div: `right:calc(62.5% + 12px); bottom:122px`
- Phần bên trái bên dưới bản đồ để trống (hoặc cho phép hiện thêm thông tin)

---

#### 4.2 — Xem trước khung in (Preview mode)

**Mục tiêu:** Nút "Xem trước" trong modal hiển thị overlay bản vẽ trực tiếp trên bản đồ (không capture/export) để người dùng kiểm tra trước khi xuất PDF.

**Thiết kế:**
- Thêm nút **"Xem trước"** vào modal footer (bên cạnh "Xuất PDF")
- Click → `$('#printDrawingModal').modal('hide')` + gọi `_switchToPrintTile()` + `_zoomToScale()` + `_buildCableLines()` + `_showPrintOverlay()`
- Hiển thị thanh nổi **"Đang xem trước bản vẽ — [Xuất PDF] [Đóng xem trước]"** ở trên map
- Nút "Xuất PDF" trong thanh nổi → capture + save + cleanup
- Nút "Đóng xem trước" → `_hidePrintOverlay()` + `_removeCableLines()` + `_restoreOriginalTiles()`
- State: `let _previewMode = false` — guard để không capture khi đang preview

---

#### ~~4.3 — Capture đúng tỉ lệ landscape~~ ✅ Đã implement

Xem mô tả trong phần "Luồng xuất PDF" ở trên (bước 4 — Force aspect ratio).

---

#### 4.4 — Sơ đồ cáp nâng cao: chọn tủ + chỉnh sửa trực tiếp ✅ toggle cơ bản đã implement

##### 4.4.1 — Lọc theo tủ khi bật sơ đồ cáp (multi-select)

**Vấn đề hiện tại:** Nút "Sơ đồ cáp" vẽ tất cả dữ liệu ngay lập tức, không cho phép chọn tủ.

**Thiết kế:**
- Khi click "Sơ đồ cáp" lần đầu → mở panel nhỏ ngay bên dưới nút (dropdown, không phải modal):
  ```
  ┌─────────────────────────────┐
  │ ☑ Tất cả tủ                 │
  │ ☑ VTS_H23VTS               │
  │ ☐ P12_TTC_01               │
  │ ☐ P12_TTC_02               │
  │ [Vẽ sơ đồ cáp]             │
  └─────────────────────────────┘
  ```
- Danh sách tủ = unique values của `row[7]` (Tủ điều khiển) trong `loadedData`
- Checkbox "Tất cả" toggle toàn bộ; uncheck 1 item thì uncheck "Tất cả"
- Nút "Vẽ" → gọi `_buildCableLines(rowsFiltered)` với rows lọc theo tủ đã chọn
- Click bên ngoài dropdown → đóng mà không vẽ

**State:**
```javascript
let _selectedTus = new Set(); // tên tủ đang chọn, null = tất cả
```

**Hàm lọc mở rộng:**
```javascript
function _filterRowsByTuSet(tuSet) {
    if (!Array.isArray(loadedData) || loadedData.length < 2) return [];
    const rows = loadedData.slice(1);
    if (!tuSet || tuSet.size === 0) return rows;
    return rows.filter(r => tuSet.has(String(r[7] || '').trim()));
}
```

---

##### 4.4.2 — Chỉnh sửa đường cáp trực tiếp trên bản đồ

**Mục tiêu:** Sau khi vẽ sơ đồ cáp, người dùng có thể:
1. **Xóa đoạn cáp** → đặt `row[14] = ''` (Marker gốc) + sync GAS
2. **Dịch chuyển điểm đầu** (từ trụ cha khác) → đổi `row[14]` sang tên trụ mới + sync GAS
3. **Dịch chuyển điểm cuối** (đổi trụ con nhận cáp) → không cần (cáp là 1-chiều từ cha → con)

**Chế độ chỉnh sửa cáp (`_cableEditMode`):**

Thêm nút toggle "Sửa cáp" (chỉ hiện khi `_cableVisible = true`):
```
[ Sơ đồ cáp ✓ ] [ ✏ Sửa cáp ]
```

Khi `_cableEditMode = true`:
- Mỗi polyline cáp có `cursor: pointer` + `on('click')` handler
- Click vào đoạn cáp → hiện context popup nhỏ trên map:
  ```
  ┌──────────────────────────────────────┐
  │  Cáp: VTS_H23_4 ← VTS_H23VTS (42m)  │
  │  [🗑 Xóa đoạn này]  [↩ Đổi điểm gốc]│
  └──────────────────────────────────────┘
  ```
- **Xóa:** `row[14] = ''`, `row[15] = ''` → `syncRowToGAS(row)` → redraw
- **Đổi điểm gốc:** vào mode "chọn điểm gốc mới" — cursor crosshair, click marker khác trên bản đồ → `row[14] = newParentName` → tính lại Haversine → `syncRowToGAS(row)` → redraw

**Data binding:**
Mỗi `L.polyline` trong `_buildCableLines` cần lưu reference đến `row`:
```javascript
const line = L.polyline([from, to], { ... });
line._cableRow = r;   // reference đến row gốc trong loadedData
line.addTo(_cableLayerGroup);
if (_cableEditMode) _attachCableEditHandler(line);
```

**`_attachCableEditHandler(line)`:**
```javascript
function _attachCableEditHandler(line) {
    line.setStyle({ cursor: 'pointer', weight: 4, opacity: 1 });
    line.on('click', e => {
        L.DomEvent.stopPropagation(e);
        _showCableContextMenu(e.latlng, line._cableRow);
    });
}
```

**`_showCableContextMenu(latlng, row)`:**
```javascript
// Dùng L.popup() có HTML 2 nút: Xóa + Đổi điểm gốc
// Xóa: row[14]=''; row[15]=''; syncRowToGAS(row,{silent:true}); _rebuildCables()
// Đổi điểm gốc: đóng popup, vào pickParentMode(row)
```

**`pickParentMode(row)` — chọn trụ cha mới:**
```javascript
// Hiện toast: "Click vào trụ/tủ để đặt làm điểm gốc cáp. [Hủy]"
// map.on('click') một lần → tìm marker gần nhất trong bán kính 30px
// Nếu tìm thấy: row[14] = markerName; row[15] = haversineM(...); syncRowToGAS; _rebuildCables()
```

**`_rebuildCables()`** — redraw cáp sau mỗi thao tác edit:
```javascript
function _rebuildCables() {
    _buildCableLines(_filterRowsByTuSet(_selectedTus));
    if (_cableEditMode) {
        _cableLayerGroup.eachLayer(l => { if (l._cableRow) _attachCableEditHandler(l); });
    }
}
```

---

#### 4.5 — Tính tự động khoảng cách cáp (Haversine)

**Mục tiêu:** Khi người dùng chọn `Marker gốc` trong popup chỉnh sửa marker, tự động tính khoảng cách Haversine từ trụ con → trụ cha và điền vào ô `Khoảng cách (m)`. Giảm nhập tay, tránh sai số đo thực địa.

**Công thức Haversine:**
```javascript
function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
```

**Điểm gọi:** `onchange` của input `Marker gốc` trong popup → tìm lat/lon của trụ cha trong `loadedData` → tính haversine → điền vào input `Khoảng cách`.

---

#### 4.6 — Nhớ field modal bằng localStorage

**Mục tiêu:** `pdCVPhuTrach`, `pdCSKhuVuc`, `pdNguoiLap` không reset khi đóng/mở modal.

**Thiết kế:**
- `openPrintDrawingModal()`: sau khi điền defaults, đọc `localStorage.getItem('pd_cv')` v.v. nếu input còn trống
- `exportDrawingPDF()` / `openPrintPreview()`: lưu 3 field vào localStorage trước khi dùng
```javascript
localStorage.setItem('pd_cv', cvPhuTrach);
localStorage.setItem('pd_ks', csKhuVuc);
localStorage.setItem('pd_nl', nguoiLap);
```

---

#### 4.7 — Đồng bộ lại `banve-mau.html`

**Vấn đề:** `banve-mau.html` là bản preview tĩnh, hiện đã lệch so với `_showPrintOverlay()` thực tế:
- Thiếu dải tiêu đề top (BẢN VẼ SƠ ĐỒ TUYẾN...)
- Title block cũ (2 hàng) chưa phản ánh cấu trúc 4 hàng mới
- Thiếu stats div (tổng trụ/cáp)

**Cần làm:** Rewrite `banve-mau.html` để khớp với HTML được `_showPrintOverlay()` tạo ra.

---

#### 4.8 — Validate vòng lặp cáp (cycle detection)

**Vấn đề:** Nếu trụ A có `Marker gốc` = B và B có `Marker gốc` = A → `_buildCableLines()` vẽ 2 đoạn nhưng không lỗi, sơ đồ sai.

**Giải pháp:** Trước vòng lặp vẽ cáp, chạy DFS detect cycle:
```javascript
function _hasCycle(rows) {
    const parent = {};
    rows.forEach(r => { if (r[14]) parent[String(r[1])] = String(r[14]); });
    for (const start of Object.keys(parent)) {
        const visited = new Set();
        let cur = start;
        while (cur && parent[cur]) {
            if (visited.has(cur)) return true; // cycle
            visited.add(cur);
            cur = parent[cur];
        }
    }
    return false;
}
```
Nếu phát hiện cycle → `displayError('Phát hiện vòng lặp cáp — kiểm tra lại Marker gốc')` + không vẽ.

---

#### 4.9 — Tách footer và title block (khung chú thích & khung tên) hở ra ✅ đã implement (2026-06-17)

**Vấn đề hiện tại:** Footer (`left:0; width:37.5%`) và title block (`right:0; width:62.5%`) **chạm sát vào nhau** tại biên 37.5%/62.5% — trông như một khối liền, không có khoảng nghỉ thị giác. Bản vẽ kỹ thuật chuẩn thường tách 2 khung này bằng khoảng trắng.

**Thiết kế:**

```
┌──────────────── Print frame (inset:14px) ─────────────────────┐
│                                                                 │
│              BẢN ĐỒ + cáp + marker                             │
│                                                                 │
│ ┌── Footer ──┐                  ┌──── Title block ──────────┐ │
│ │ Bảng ký hiệu│       ← gap →    │ TT QLGT │ Phó GĐ │ ...   │ │
│ │ 💡 Trụ STK 5│      (~16-20px)  │                          │ │
│ │ ─── Cáp  60m│                  │                          │ │
│ └────────────┘                  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Implement:**
```javascript
// Hiện tại:
// footer:  left:0; bottom:0; width:37.5%
// title:   right:0; bottom:0; width:62.5%

// Sau khi tách (giả định gap 16px + margin frame 8px):
// footer:  left:8px;  bottom:8px; width:calc(37.5% - 16px);  // 8px gap left + 8px gap mid
// title:   right:8px; bottom:8px; width:calc(62.5% - 16px);  // 8px gap mid + 8px gap right
// → gap giữa 2 khung = 16px (background xám/trắng lộ ra)
```

**Lưu ý:**
- 2 khối vẫn giữ `border: 2px solid #1e293b` (không còn `border-left:none` / `border-right:none` cho cạnh trong vì giờ tách rời)
- Background giữa 2 khung = background của print frame (trắng) → thấy rõ vùng tách
- Có thể bo góc nhẹ `border-radius: 3px` cho mỗi khối thay vì khung hộp vuông

---

#### 4.10 — Hiển thị tất cả đối tượng trong bảng ký hiệu (auto-fit hoặc multi-column) ✅ đã implement (2026-06-17)

**Vấn đề hiện tại:** Footer fixed height 110px. Với 6 loại marker + 1 cáp = 7 hàng × ~26px (icon 38px tall) → **overflow:hidden** ẩn 5 hàng cuối. User chỉ thấy 2-3 loại đầu, không thấy đủ.

**3 hướng giải quyết** — chọn 1 hoặc kết hợp:

##### A. Auto-fit height (động theo số loại)

Tính số rows cần thiết → set `min-height: 110px`, cho phép cao hơn nếu cần:

```javascript
const N = usedTypes.length + 1; // +1 cho cáp
const headerH = 22, rowH = 26, paddingV = 8;
const neededH = headerH + N * rowH + paddingV;
const footerH = Math.max(110, Math.min(neededH, 220)); // clamp 110-220px
```

**Sync với title block:** title block cũng đổi `height` theo footer (đối xứng visual). Hoặc title block giữ 110px, footer mở rộng lên trên (thay vì xuống dưới).

##### B. 2-column layout khi >5 loại

Nếu N > 5 → tự động chia legend thành 2 cột bên trong cùng vùng 37.5% × 110px:

```
┌── BẢNG KÝ HIỆU ──────────────────────────────┐
│ Ký hiệu | SL | ĐV │ Ký hiệu  | SL | ĐV       │
├─────────┼────┼────┼──────────┼────┼──────────┤
│ 💡 STK  │ 5  │ trụ│ 🗄 Tủ nổi│ 1  │ tủ       │
│ 🎆 TT   │ 3  │ trụ│ 🗄 Tủ ngầm│ 2 │ tủ       │
│ 💡 HTLT │ 2  │ trụ│ ─── Cáp  │ 60 │ m        │
│ 💡 TTLT │ 4  │ trụ│           │    │          │
└────────────────────────────────────────────────┘
```

CSS: `column-count: 2` hoặc table với colspan/rowspan logic.

##### C. Compact rows (icon nhỏ hơn)

Giảm icon size còn 14×20 (gần kích thước cũ trước khi sửa) → mỗi row chỉ ~16px → 7 rows × 16 = 112px, sát fit 110px.

Trade-off: icon kém nhận diện hơn icon trên map.

**Khuyến nghị:** Kết hợp **A** (chính) + fallback **C** (nếu N > 8):
- N ≤ 5: 110px fixed, icon đầy đủ
- N 6-8: auto-fit lên 160-180px
- N > 8: ép về 180px + compact icons

---

#### 4.11 — Phân loại cáp (cáp ngầm vs cáp nổi) ✅ đã implement (2026-06-17)

**Vấn đề hiện tại:** Tất cả cáp vẽ chung 1 kiểu nét đứt xanh (`dashArray: '7 5'`). Không phân biệt cáp ngầm/nổi như bản vẽ kỹ thuật chuẩn.

**Quy ước ký hiệu (gợi ý theo TCXDVN/IEC):**

| Loại | Ký hiệu trên bản vẽ | dashArray (Leaflet) | Màu |
|---|---|---|---|
| **Cáp nổi** | Nét liền hoặc dash dài | `'10 4'` hoặc `null` (liền) | `#1e40af` xanh đậm |
| **Cáp ngầm** | Nét đứt khoảng + chấm | `'2 3 8 3'` (dash-dot) | `#dc2626` đỏ nhạt |

**Thay đổi data model:**

Thêm cột **23** vào sheet `DanhSachTru`: `Loại cáp` — value `'ngam'` / `'noi'` / `''` (default).

Update CLAUDE.md "Cấu trúc cột" thành **23 cột** + thêm vào `FIELD_MAP` của GAS:
```javascript
'loaiCap': 'Loại cáp',  // key payload JS
```

Mỗi marker khi có `row[14]` (Marker gốc) cũng có `row[22]` (Loại cáp) tương ứng — đoạn cáp NỐI giữa parent → child sẽ dùng style của child's `loaiCap`.

**UI nhập liệu:**

Trong popup marker, nhóm "Cáp Trụ/tủ gốc + Cách (m) + Loại cáp":
```html
<select id="markerLoaiCapSelect">
    <option value="">— Chọn loại cáp —</option>
    <option value="noi">Cáp nổi</option>
    <option value="ngam">Cáp ngầm</option>
</select>
```
Đặt cùng hàng với input "Khoảng cách" để compact.

**Update `_buildCableLines(rows)` và `_buildPrintCableSvg(rows)`:**

```javascript
const CABLE_STYLE = {
    noi:  { color: '#1e40af', dashArray: '10 4',    label: 'Cáp nổi'  },
    ngam: { color: '#dc2626', dashArray: '2 3 8 3', label: 'Cáp ngầm' }
};
const style = CABLE_STYLE[String(r[22] || 'noi')] || CABLE_STYLE.noi;
L.polyline([from, to], {
    color: style.color, weight: 2.5,
    dashArray: style.dashArray, opacity: 0.8
});
```

Cùng logic apply cho SVG inline (`stroke` + `stroke-dasharray`).

**Update legend:**

Tính riêng `cableCountNoi`, `cableCountNgam`, `totalCapNoi`, `totalCapNgam`:
```javascript
rows.forEach(r => {
    if (!r[14]) return;
    const type = String(r[22] || 'noi');
    const len = distance(r);  // logic Haversine fallback như cũ
    if (type === 'ngam') { cableCountNgam++; totalCapNgam += len; }
    else                 { cableCountNoi++;  totalCapNoi  += len; }
});
```

Thêm 2 hàng vào bảng ký hiệu (thay vì 1 hàng "Cáp nguồn"):
```
─── Cáp nổi    1234 m
─── Cáp ngầm    567 m   (đỏ + dash-dot)
```

**Migration:** Marker hiện có `row[14]` nhưng không có `row[22]` (cũ) → default `'noi'`. App vẽ như cũ (không break).

**Liên quan các tính năng khác:**
- **DXF export** (`createDxfForMarkers`): có thể dùng layer/linetype riêng cho mỗi loại cáp
- **Excel báo cáo**: thêm cột "Loại cáp" trong sheet Chi tiết

---

#### Lưu ý vận hành quan trọng

| Việc cần làm | Lý do | Ưu tiên |
|---|---|---|
| ~~Bump sw.js v5 → v6~~ | ✅ Đã bump lên v6 | — |
| **Redeploy GAS New version** | Fix `findRowNum` dùng `oldTenTru` + `buildFieldValues` skip `oldTenTru` — bắt buộc để sửa tên trụ không tạo row mới | 🔴 Cao |
| ~~Sync banve-mau.html~~ | ✅ Đã rewrite đồng bộ với `_showPrintOverlay()` | — |
| ~~Implement 4.4.1 + 4.4.2~~ | ✅ Đã implement | — |
| ~~Fix edit marker mode~~ | ✅ `_editingRow` state, double-listener, geocode cancel | — |
| ~~Fix SVG cable PDF offset~~ | ✅ `_buildPrintCableSvg` thay L.polyline | — |
| ~~Fix aspect ratio PDF~~ | ✅ Force `targetW` luôn áp dụng | — |

---

## Các pattern quan trọng

### UI layout — mọi control tập trung vào ☰ panel (2026-06-18)

Refactor lớn: **topbar chỉ còn nút hamburger**, gỡ hoàn toàn `#bottomActionBar` và widget MapTools bên phải bản đồ. Tất cả control tập trung vào modal `#controlsModal`.

**Thứ tự section trong ☰ panel** (từ trên xuống):
1. **User chip** — tên + nút đăng xuất + nút 🔑 đổi pass
2. **Tìm kiếm** — input `#searchInput` + nút 🔍 (chuyển từ topbar)
3. **Hành động nhanh** — [+ Thêm marker] [⏧ Lọc] (2 cột, đã gỡ nút "Lưu" duplicate)
4. **Điều hướng** — dropdown `#pages` chọn địa bàn
5. **Tỷ lệ bản đồ (A3)** — badge `Z <zoom>` + dropdown scale + display badge "Đang áp dụng 1:N"
6. **Thiết bị GPS** — 2 radio segmented horizontal (📱 Phone / 🛰 RTK)
7. **Vị trí & Đồng bộ** — [Chỉnh vị trí] [Cập nhật]
8. **Xuất dữ liệu** — 2×2 grid (Báo cáo / CAD / In bản vẽ / Sơ đồ cáp)
9. **GitHub Sync** — input path + [Lưu Excel] [Đẩy lên]

**Bootstrap modal focus trap**: nút mở overlay khác (Lọc, Thêm marker, Tìm kiếm) đều `closeControlsModal()` trước → tránh Bootstrap backdrop chặn input trong filter overlay.

**Compact CSS**: `.ctrl-section margin-bottom:8px`, `.ctrl-title margin-bottom:4px`, `.ctrl-divider margin:6px -16px`, `.ctrl-radio padding:5px 8px`.

**Đã gỡ**:
- `#bottomActionBar` (nút Vị trí + Thêm marker + Lọc + Lưu ở đáy màn hình)
- Nút "Vị trí" — user dùng widget zoom bên phải hoặc "Thêm marker" (auto get GPS)
- `--bottombar-h: 0px` để map dùng full chiều cao

### Chức năng xoay bản đồ — ĐÃ GỠ (2026-06-18)

Gỡ hoàn toàn xoay bản đồ. Còn lại chỉ là dead code an toàn để không phá print cleanup.

**Gỡ**:
- Compass SVG + nút ↺↻ + label angle trong MapTools widget
- CSS hover `#mapRotLeft/Right/Reset`
- Keyboard shortcuts `[` `]` `\`
- Slider "Xoay bản đồ" trong print modal (giữ hidden `#pdRotation=0` cho code đọc)
- Rotation buttons trong print preview bar

**Giữ (dead code an toàn)**:
- `_applyMapRotation(angle)`, `_clearMapRotation()`, `_updateCompassUI()` — có null-guard, no-op khi `_currentMapRotation=0`
- `_rotateMap`, `_rotateMapFree`, `_resetMapRotation` — không caller nhưng khai báo còn
- `_currentMapRotation` init 0, không có UI set khác

Print flow vẫn đọc `pdRotation` → luôn `0` → không apply rotation → cleanup paths gọi `_clearMapRotation` an toàn.

### Chỉnh sửa marker — `_editingRow`

`saveMarkerPopup()` dùng biến `_editingRow` để phân biệt chế độ:
- **`_editingRow = null`** → thêm mới: `loadedData.push(newRow)`, tạo marker mới trên map
- **`_editingRow = row`** → sửa: cập nhật row in-place (giữ `row[0]` = ID), xóa marker cũ, tạo marker mới

`openEditMarker()`:
1. Set `_editingRow = _currentPopupRow` trước khi gọi `showMarkerPopupAt()`
2. Hủy geocoding ngay (`_pendingGeocodePromise = Promise.resolve(null)`) — dùng dữ liệu row
3. setTimeout 80ms: điền toàn bộ field từ row, khôi phục ảnh cũ, pre-select baseSelect khớp `row[14]`

`hideMarkerPopup()` reset `_editingRow = null`. Capture `const rowRef = _editingRow` và `const editOldName = oldName` trước khi gọi `hideMarkerPopup()`, rồi gọi `syncRowToGAS(rowRef, { oldTenTru: editOldName })`.

**Bug fix — sửa tên trụ tạo row mới:** Marker vừa thêm (chưa reload CSV) có `row[0] = ''`. Nếu sửa tên, GAS không tìm được bằng ID lẫn tên mới → `appendRow`. Fix: client gửi `oldTenTru` (tên cũ), GAS dùng `data.oldTenTru || data.tenTru` cho name-fallback. `oldTenTru` được skip trong `buildFieldValues` (không ghi vào sheet).

`syncRowToGAS(row, opts)` nhận:
- `opts.silent` — tắt toast khi batch
- `opts.oldTenTru` — tên cũ trước khi sửa, để GAS tìm đúng hàng khi ID chưa có

### Dropdown Marker gốc — `markerBaseSelect`

- `normalizeMarkerBaseName(name)`: `replace(/[_\s\-]*\d+$/, '')` — strip `_NNN` ở cuối (kể cả dấu gạch dưới) để `VTS_H232VTS_19` → basename `VTS_H232VTS` khớp với tủ `VTS_H232VTS`
- `_fillBaseSelect()` thêm 3 nhóm theo thứ tự (Set `addedIdx` chống duplicate):
  1. **Tủ điều khiển** (`markerCabinetInput.value`) gắn nhãn `[tủ]`
  2. **Cùng basename** với tên đang nhập
  3. **Cùng tủ điều khiển** (khác basename) gắn nhãn `[cùng tủ]` — build từ `cabinetByName` map của `loadedData[*][1] → loadedData[*][7]`
- Khi `baseSelect` thay đổi → tự sync sang `markerGocInput` + tính khoảng cách Haversine vào `markerKhoangCachInput`
- Gọi `_fillBaseSelect()` từ `oninput` của cả `nameInput` và `cabinetInput`

### Reverse geocoding không đồng bộ
```javascript
// _pendingGeocodePromise — tránh race condition khi drag marker liên tục
_pendingGeocodePromise = reverseGeocode(lat, lon);
// saveMarkerPopup() await promise này nếu vẫn còn pending
if (_pendingGeocodePromise) await _pendingGeocodePromise;
// openEditMarker() hủy geocoding để dùng dữ liệu row thay vì tra cứu lại
_pendingGeocodePromise = Promise.resolve(null);
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

### Tìm kiếm — text normalization
`searchMarkers()` (topbar → giờ trong ☰ panel) và `_filterTuOptions()` (filter tủ) dùng chung 2 helper:

- **`normalizeText(text)`** — chuẩn hóa cơ bản:
  1. `replace(/đ/g,'d').replace(/Đ/g,'D')` — **thủ công trước NFD** (đ là base char, NFD không tách được)
  2. `.normalize('NFD').replace(/\p{Diacritic}/gu,'')` — bỏ dấu
  3. `.toLowerCase()`
- **`normalizeTextSearchable(text)`** — thêm `.replace(/[^a-z0-9]/g,'')` để bỏ mọi space + ký tự đặc biệt (`_`, `-`, `#`...).

Cả 2 hàm áp dụng cho:
- Topbar search (`searchMarkers`): tên trụ / ID / ghi chú — dùng `normalizeTextSearchable`
- Filter panel search tủ (`_filterTuOptions`): tên tủ — dùng `normalizeTextSearchable`
- Coord parse vẫn dùng `rawInput.trim()` (không normalize) để không phá tọa độ `lat,lon`.

Test: gõ `duongtranhungdao` → match `Đường Trần Hưng Đạo #5` (bỏ dấu, đ→d, bỏ space + #).

### Xuất CAD
DXF tọa độ VN-2000. Hàm `convertLatLonToVn2000(lat, lon)` → `{ x, y, zone }` (Gauss-Krüger, múi 6°, ellipsoid GRS80).
Cùng hàm này được dùng để tính cột `VN2000-X`, `VN2000-Y` khi lưu marker.

### Excel xuất báo cáo
2 sheet: **Chi tiết** (filtered rows) + **Tổng hợp** (count theo loại).

### Form nhập liệu marker — layout hiện tại

Input/select/textarea dùng `font-size: 16px` (bắt buộc — iOS auto-zoom nếu < 16px).

```css
.form-row { display: flex; gap: 8px; }
.form-row .form-group { flex: 1; }
.form-row .form-group.w2 { flex: 2; }
.form-row .form-group.w3 { flex: 3; }
```

Các nhóm field trong form:
- Loại đèn (w2) + Số lượng → 1 hàng
- Công suất (w2) + Mã PE → 1 hàng
- Đường + Phường / Xã → 1 hàng
- Cáp Trụ/tủ gốc (w3) + Cách (m) (w2) → 1 hàng

### Version hiển thị

`#dataVersionTag` — luôn visible, style pill xanh `#eff6ff / #2563eb`. Text mặc định `"Dữ liệu v—"`.
`_setDataVersion({major, minor, patch})` cập nhật text.

---

## Tính năng 8: Tối ưu mobile

### Mục tiêu

App chạy mượt trên thiết bị Android/iOS tầm trung (RAM 3–4 GB, màn hình 360–414px). Giảm DOM node, giảm repaints, giảm JS computation khi render nhiều marker.

---

### 8.1 — Icon tối giản trên mobile

**Vấn đề:** `makeLampIcon` tạo SVG phức tạp (filter drop-shadow, cubic bezier arms) cho **mỗi marker**. Với 500+ marker, đây là bottleneck khi render.

**Giải pháp — Icon mobile đơn giản hơn:**

Detect mobile: `const isMobile = window.innerWidth <= 768 || /Mobi/i.test(navigator.userAgent)`

Khi `isMobile`:
- Bỏ `filter="url(#ls)"` (drop-shadow) trong SVG — tốn GPU nhất
- Dùng icon tối giản: chỉ cột thẳng + chấm tròn thay vì cần cong + hộp đèn
- Kích thước nhỏ hơn: 18×32px (giảm DOM area)
- Không hiển thị badge `2L100` ở zoom < 16 trên mobile

```javascript
function makeLampIconMobile(color) {
    return L.divIcon({
        className: '',
        html: `<svg width="14" height="28" viewBox="0 0 14 28">
            <rect x="5.5" y="8" width="3" height="20" rx="1.5" fill="${color}"/>
            <circle cx="7" cy="6" r="5" fill="${color}"/>
            <circle cx="7" cy="6" r="3.5" fill="white" opacity="0.8"/>
        </svg>`,
        iconSize: [14, 28], iconAnchor: [7, 28], popupAnchor: [0, -30]
    });
}
```

**Shared icons:** Trên mobile, các marker cùng type + không có badge → dùng **1 icon dùng chung** (`customIcons[type]`) thay vì tạo mới mỗi marker.

```javascript
// addMarkerRowToMap: nếu mobile và không có soLuong/loaiDen
if (isMobile && !loaiDen && !congSuat) {
    icon = customIcons[`mobile_${type}`] || (customIcons[`mobile_${type}`] = makeLampIconMobile(color));
} else {
    icon = makeLampIcon(color, loaiDen, congSuat, soLuong);
}
```

---

### 8.2 — Cluster aggressively hơn trên mobile

```javascript
const isMobile = window.innerWidth <= 768;
const markerCluster = L.markerClusterGroup({
    disableClusteringAtZoom: isMobile ? 16 : 15,  // mobile: giữ cluster lâu hơn
    maxClusterRadius: isMobile ? 80 : 60,          // mobile: bán kính cluster lớn hơn
    chunkedLoading: true,                          // không block main thread khi load 500+ marker
    chunkInterval: 100,                            // ms giữa mỗi chunk
    chunkDelay: 50
});
```

---

### 8.3 — Nhãn tên chỉ hiện ở zoom cao trên mobile

```javascript
// Hiện nhãn tên: desktop zoom≥17, mobile zoom≥18
const labelZoomThreshold = isMobile ? 18 : 17;
map.on('zoomend', () => {
    if (map.getZoom() >= labelZoomThreshold) {
        labelLayerGroup.addTo(map);
    } else {
        map.removeLayer(labelLayerGroup);
    }
});
```

---

### 8.4 — Tắt animation Leaflet trên mobile

```javascript
// Sau khi khởi tạo map
if (isMobile) {
    map.options.zoomAnimation = false;
    map.options.markerZoomAnimation = false;
    map.options.fadeAnimation = false;
}
```

---

### 8.5 — Lazy load ảnh trong popup

Hiện tại popup render `<img src="...">` ngay khi mở. Trên mobile với ảnh 1–3 MB có thể lag.

**Giải pháp:** Thêm `loading="lazy"` + giới hạn kích thước hiển thị:
```html
<img src="${imgUrl}" loading="lazy" style="max-width:100%;max-height:200px;object-fit:cover;" crossorigin="anonymous">
```

---

### 8.6 — Debounce sự kiện map trên mobile

`map.on('moveend')` và `map.on('zoomend')` khi pan/zoom nhanh gây nhiều lần rerender.

```javascript
function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
map.on('moveend', debounce(onMapMoveEnd, 150));
map.on('zoomend', debounce(onMapZoomEnd, 150));
```

---

### 8.7 — CSS tối ưu mobile

```css
@media (max-width: 768px) {
    /* Tắt transition nặng */
    * { transition: none !important; animation: none !important; }

    /* Popup nhỏ hơn */
    .marker-popup-card { max-width: 92vw; font-size: 13px; }

    /* Bottom bar full-width, 1 hàng */
    #bottomActionBar { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }

    /* Ẩn các nút ít dùng trên mobile */
    #btnExportCad, #btnPrintDrawing { display: none; }
}
```

---

### Checklist implement mobile (Tính năng 8) ✅ đã verify (2026-06-17)

- [x] `isMobile` detection constant ([index.html:2931](index.html#L2931))
- [x] `makeLampIconMobile(color)` — SVG tối giản không drop-shadow ([index.html:3502](index.html#L3502))
- [x] `addMarkerRowToMap` dùng shared icon trên mobile khi không có badge ([index.html:3353](index.html#L3353))
- [x] `markerCluster` tham số khác nhau theo `isMobile` ([index.html:2935-2940](index.html#L2935))
- [x] `labelZoomThreshold` theo mobile/desktop ([index.html:2932](index.html#L2932))
- [x] `map.options.zoomAnimation = false` trên mobile ([index.html:3652](index.html#L3652))
- [x] `loading="lazy"` cho ảnh trong popup ([index.html:3155, 4982](index.html#L3155))
- [x] `debounce` helper available ([index.html:3038](index.html#L3038)) — `zoomend` handler hiện nhẹ, không cần wrap
- [x] CSS media query tắt transitions + ẩn nút print/CAD trên mobile ([index.html:766-775](index.html#L766))

---

## Tính năng 7: Đa địa bàn — nhiều sheet theo quận/huyện/xã

### Mục tiêu

Cho phép app quản lý dữ liệu nhiều địa bàn hành chính (quận, huyện, xã, phường) trên cùng 1 Google Spreadsheet. Mỗi địa bàn là 1 tab sheet riêng, cùng cấu trúc 21 cột như `DanhSachTru`. Người dùng chuyển địa bàn qua dropdown **"Chọn trang"** trong controls panel.

---

### Danh sách địa bàn & tên sheet

| Label hiển thị        | Tên sheet (tab)    | Ghi chú                       |
|-----------------------|--------------------|-------------------------------|
| Tổng quan             | `DanhSachTru`      | Sheet gốc, mặc định khi load  |
| Quận 1                | `Quan1`            | TP. Hồ Chí Minh               |
| Quận 3                | `Quan3`            |                               |
| Quận 5                | `Quan5`            |                               |
| Quận 8                | `Quan8`            |                               |
| Quận 10               | `Quan10`           |                               |
| Quận 11               | `Quan11`           |                               |
| Phú Nhuận             | `PhuNhuan`         |                               |
| Bình Thạnh            | `BinhThanh`        |                               |
| Tân Bình              | `TanBinh`          |                               |
| Tân Phú               | `TanPhu`           |                               |
| Xã Bàu Bàng           | `BauBang`          | Bình Dương                    |
| Xã Trừ Văn Thố        | `TruVanTho`        |                               |
| Phường Bến Cát        | `BenCat`           |                               |
| Cần Giuộc             | `CanGiuoc`         | Long An                       |

---

### Cấu hình trong `index.html`

```javascript
// Mỗi địa bàn cần 1 CSV URL riêng (publish từng tab trong Google Sheet)
const DISTRICT_PAGES = [
    { label: 'Tổng quan',        sheet: 'DanhSachTru', csvUrl: KHAOSAT_CSV_URL },
    { label: 'Quận 1',           sheet: 'Quan1',       csvUrl: 'https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv&sheet=Quan1' },
    { label: 'Quận 3',           sheet: 'Quan3',       csvUrl: '...' },
    { label: 'Quận 5',           sheet: 'Quan5',       csvUrl: '...' },
    { label: 'Quận 8',           sheet: 'Quan8',       csvUrl: '...' },
    { label: 'Quận 10',          sheet: 'Quan10',      csvUrl: '...' },
    { label: 'Quận 11',          sheet: 'Quan11',      csvUrl: '...' },
    { label: 'Phú Nhuận',        sheet: 'PhuNhuan',    csvUrl: '...' },
    { label: 'Bình Thạnh',       sheet: 'BinhThanh',   csvUrl: '...' },
    { label: 'Tân Bình',         sheet: 'TanBinh',     csvUrl: '...' },
    { label: 'Tân Phú',          sheet: 'TanPhu',      csvUrl: '...' },
    { label: 'Xã Bàu Bàng',      sheet: 'BauBang',     csvUrl: '...' },
    { label: 'Xã Trừ Văn Thố',   sheet: 'TruVanTho',   csvUrl: '...' },
    { label: 'Phường Bến Cát',   sheet: 'BenCat',      csvUrl: '...' },
    { label: 'Cần Giuộc',        sheet: 'CanGiuoc',    csvUrl: '...' },
];

let currentSheet = 'DanhSachTru'; // sheet đang hiển thị
```

**Cách lấy CSV URL cho từng tab:**
Google Sheet → tab `Quan1` → File → Share → Publish to web → chọn tab `Quan1` → Comma-separated values → Copy link

---

### Dropdown "Chọn trang" (`#pages`)

```
┌────────────────────────────┐
│ -- Bản đồ --               │
│ Tổng quan                  │
│ Quận 1                     │
│ Quận 3                     │
│ Quận 5                     │
│ Quận 8                     │
│ Quận 10                    │
│ Quận 11                    │
│ Phú Nhuận                  │
│ Bình Thạnh                 │
│ Tân Bình                   │
│ Tân Phú                    │
│ Xã Bàu Bàng                │
│ Xã Trừ Văn Thố             │
│ Phường Bến Cát              │
│ Cần Giuộc                  │
│ -- Khác --                 │
│ Lịch sử thao tác (admin)   │
└────────────────────────────┘
```

**Render dropdown trong `_applyRoleUI()`:**
```javascript
function _buildDistrictOptions() {
    const sel = document.getElementById('pages');
    // Xóa options địa bàn cũ (giữ options tĩnh: map, history)
    // Thêm optgroup "Bản đồ" + loop DISTRICT_PAGES → <option value="district_Quan1">Quận 1</option>
    // Option value: "district_<sheetName>" để phân biệt với "map" / "history"
}
```

---

### Luồng chuyển địa bàn (`switchDistrict(sheetName)`)

```javascript
async function switchDistrict(sheetName) {
    const page = DISTRICT_PAGES.find(p => p.sheet === sheetName);
    if (!page) return;
    currentSheet = sheetName;
    // 1. Xóa tất cả marker hiện tại khỏi map
    clearAllMarkers();
    // 2. Tải CSV mới
    await loadFromCSV(page.csvUrl);
    // 3. Cập nhật title / breadcrumb hiển thị địa bàn hiện tại
    document.getElementById('currentDistrictLabel').textContent = page.label;
}
```

Gọi `switchDistrict` từ `onchange` của `#pages` khi value bắt đầu bằng `district_`.

---

### Cập nhật GAS — thêm tham số `sheet`

Tất cả actions ghi dữ liệu cần nhận thêm field `sheet` để biết ghi vào tab nào:

```javascript
// Client gửi:
{ action: 'full_update', sheet: currentSheet, id, tenTru, lat, lon, ... }
{ action: 'delete_row',  sheet: currentSheet, id, tenTru }
{ action: 'log_action',  sheet: currentSheet, loaiThaoTac, id, tenTru, ... }
```

**GAS — `doPost()` — thêm helper `getSheet(name)`:**
```javascript
function getSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(name || 'DanhSachTru') || ss.getSheetByName('DanhSachTru');
}
// Thay thế tất cả ss.getSheetByName('DanhSachTru') bằng getSheet(data.sheet)
```

**`findRowNum(sheet, id, tenTru)`** — nhận sheet làm tham số thay vì hardcode.

### Sheet ở Google Sheet KHÁC (external spreadsheet)

Nếu 1 địa bàn (vd `CanGiuoc`) nằm ở **file Google Sheet riêng** (không phải tab trong file chứa GAS):

**index.html — `DISTRICT_PAGES`**: `csvUrl` đã trỏ thẳng tới file riêng (Publish to web từ file đó).

**gas-khaosat.js — `EXTERNAL_SPREADSHEET_IDS`**: map `sheetName → spreadsheetId`. `getSheet(name)` sẽ `openById()` thay vì `getActiveSpreadsheet()`.
```javascript
const EXTERNAL_SPREADSHEET_IDS = {
  CanGiuoc: '1xxxxx...',  // copy từ URL file CanGiuoc /spreadsheets/d/<ID>/edit
};
```

**Yêu cầu**: tài khoản deploy GAS phải có quyền **edit** trên file ngoài. Redeploy GAS New version sau khi điền ID.

---

### Tạo sheet mới trong Google Sheet

Với mỗi địa bàn mới, cần tạo tab thủ công:
1. Google Sheet → click `+` (thêm sheet)
2. Đặt tên đúng theo bảng trên (e.g. `Quan1`)
3. Copy hàng header từ `DanhSachTru` (hàng 1) sang sheet mới
4. Publish tab đó ra CSV → copy URL vào `DISTRICT_PAGES[...].csvUrl` trong `index.html`

**Header hàng 1 cần copy (21 cột):**
```
ID | Tên trụ | Lat | Lon | Ghi chú | Người KS | Loại | Tủ điều khiển | Loại trụ | Loại cần | Loại đèn | Công suất | Ảnh | Thời gian cập nhật | Marker gốc | Khoảng cách (m) | Mã PE | Đường | Phường/ Xã | VN2000-X | VN2000-Y
```

---

### Tạo script GAS tự động tạo sheet (`setupDistrictSheets`)

Thêm hàm tiện ích vào `gas-khaosat.js` để tạo tất cả sheet cùng lúc (chạy 1 lần):
```javascript
function setupDistrictSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const source = ss.getSheetByName('DanhSachTru');
    const header = source.getRange(1, 1, 1, 21).getValues();
    const sheets = ['Quan1','Quan3','Quan5','Quan8','Quan10','Quan11',
                    'PhuNhuan','BinhThanh','TanBinh','TanPhu',
                    'BauBang','TruVanTho','BenCat'];
    sheets.forEach(name => {
        if (!ss.getSheetByName(name)) {
            const sh = ss.insertSheet(name);
            sh.getRange(1, 1, 1, 21).setValues(header);
        }
    });
}
```

---

### ID tự động theo địa bàn

Khi thêm marker mới, ID cần prefix theo địa bàn để tránh trùng:
```
DanhSachTru → ID: TQ_001, TQ_002, ...
Quan1       → ID: Q1_001, Q1_002, ...
Quan3       → ID: Q3_001, ...
PhuNhuan    → ID: PN_001, ...
BauBang     → ID: BB_001, ...
TruVanTho   → ID: TVT_001, ...
BenCat      → ID: BC_001, ...
CanGiuoc    → ID: CG_001, ...
```

**Hàm sinh ID:**
```javascript
const SHEET_ID_PREFIX = {
    DanhSachTru: 'TQ', Quan1: 'Q1', Quan3: 'Q3', Quan5: 'Q5',
    Quan8: 'Q8', Quan10: 'Q10', Quan11: 'Q11',
    PhuNhuan: 'PN', BinhThanh: 'BT', TanBinh: 'TB', TanPhu: 'TP',
    BauBang: 'BB', TruVanTho: 'TVT', BenCat: 'BC', CanGiuoc: 'CG'
};
function generateId() {
    const prefix = SHEET_ID_PREFIX[currentSheet] || 'XX';
    const existing = (loadedData || []).slice(1).map(r => String(r[0]));
    let n = existing.length + 1;
    while (existing.includes(`${prefix}_${String(n).padStart(3,'0')}`)) n++;
    return `${prefix}_${String(n).padStart(3,'0')}`;
}
```

---

### Scope tìm kiếm & sơ đồ cáp

- `searchMarkers()` tìm trong `loadedData` của **địa bàn đang chọn** (không tìm chéo địa bàn)
- `_buildCableLines()` vẽ cáp của địa bàn hiện tại
- In bản vẽ (`exportDrawingPDF()`) xuất theo địa bàn hiện tại

---

### GitHub sync theo địa bàn

`updateGitHubExcel()` xuất Excel tên `data/khaosat_<sheetName>.xlsx`:
```javascript
const filename = currentSheet === 'DanhSachTru'
    ? 'data/khaosat.xlsx'
    : `data/khaosat_${currentSheet}.xlsx`;
```

---

### Checklist implement

- [ ] Thêm `DISTRICT_PAGES` config array vào `index.html`
- [ ] Thêm `currentSheet` state variable
- [ ] Hàm `_buildDistrictOptions()` render dropdown
- [ ] Hàm `switchDistrict(sheetName)` chuyển địa bàn
- [ ] Cập nhật `syncRowToGAS()` thêm `sheet: currentSheet` vào payload
- [ ] Cập nhật `deleteMarker()` thêm `sheet: currentSheet`
- [ ] Cập nhật `_logAction()` thêm `sheet: currentSheet`
- [ ] Cập nhật GAS `doPost()`: `getSheet(data.sheet)` thay vì hardcode
- [ ] Thêm hàm `setupDistrictSheets()` vào GAS (chạy 1 lần)
- [ ] Cập nhật `generateId()` dùng prefix theo `currentSheet`
- [ ] Publish từng tab CSV → điền URL vào `DISTRICT_PAGES`
- [ ] Redeploy GAS New version sau khi sửa
- [ ] Bump sw.js cache name (v6 → v7)

---

## Tính năng 9: Tối ưu load dữ liệu lớn

### Bối cảnh thực tế (đo từ sheet Quận 1)

Mỗi sheet địa bàn có khoảng **1,000–1,200 hàng** dữ liệu (đo thực tế từ sheet `Quan1`).
Cấu trúc 22 cột. Các trường thường đầy: `Tên trụ, Lat, Lon, Loại, Loại trụ, Loại đèn, Đường, Phường/Xã`.
Các trường thường rỗng: `Ghi chú, Ảnh, Mã PE, VN2000-X/Y, Số lượng đèn, Công suất`.

**Vấn đề hiện tại với 1,000+ marker:**
- DOM nặng: mỗi marker tạo 1 `<div>` divIcon SVG riêng → 1,000+ div kể cả khi cluster
- CSV parse đồng bộ: block main thread khi xử lý 1,000+ hàng
- `labelLayerGroup`: ở zoom cao có thể thêm 1,000+ label markers vào DOM cùng lúc
- VN2000 tính toán: `convertLatLonToVn2000()` gọi cho mỗi hàng khi lưu → nặng khi batch
- `createMarkerPopupContent()` sinh HTML tại `bindPopup()` dù popup chưa mở
- Không có cache: mỗi lần refresh tải lại toàn bộ CSV từ Google Sheets

---

### Giải pháp đề xuất — thứ tự ưu tiên

#### 9.1 — IndexedDB cache CSV (ưu tiên cao ✦✦✦)

**Vấn đề:** Mỗi lần load app phải fetch lại CSV 1,000+ hàng từ Google Sheets (~150–300 KB).

**Giải pháp:** Cache parsed data vào IndexedDB với timestamp. Khi load app:
1. Đọc cache từ IndexedDB → render ngay (< 50ms)
2. Fetch CSV mới ở background → so sánh với cache
3. Nếu có thay đổi → cập nhật cache + re-render chỉ các marker thay đổi

```javascript
// Schema IndexedDB
// DB: 'lighting-survey-db', version: 1
// ObjectStore: 'csv-cache'
// Key: sheetName (vd: 'Quan1')
// Value: { data: [...rows], fetchedAt: ISO timestamp, etag: string }

async function loadFromCSVWithCache(sheetName, csvUrl) {
    const cached = await idbGet('csv-cache', sheetName);
    if (cached) {
        // Render ngay từ cache
        loadedData = cached.data;
        addMarkersToMap(loadedData.slice(1));
    }
    // Fetch mới ở background (HEAD request để check ETag trước)
    const res = await fetch(csvUrl, { cache: 'no-store' });
    const etag = res.headers.get('etag') || res.headers.get('last-modified');
    if (cached && etag && etag === cached.etag) return; // không đổi
    const text = await res.text();
    const parsed = parseCSVText(text);
    await idbSet('csv-cache', sheetName, { data: parsed, fetchedAt: new Date().toISOString(), etag });
    // Re-render nếu data mới khác cache
    loadedData = parsed;
    addMarkersToMap(loadedData.slice(1));
}
```

**IndexedDB helper đơn giản:**
```javascript
function idbOpen() {
    return new Promise((res, rej) => {
        const r = indexedDB.open('lighting-survey-db', 1);
        r.onupgradeneeded = e => e.target.result.createObjectStore('csv-cache');
        r.onsuccess = e => res(e.target.result);
        r.onerror = rej;
    });
}
async function idbGet(store, key) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readonly');
        const r = tx.objectStore(store).get(key);
        r.onsuccess = () => res(r.result);
        r.onerror = rej;
    });
}
async function idbSet(store, key, val) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(val, key);
        tx.oncomplete = res; tx.onerror = rej;
    });
}
```

**Lợi ích:** Load lần 2 gần như tức thì (< 100ms vs 2–5s), hoạt động offline.

---

#### 9.2 — Lazy popup content (ưu tiên cao ✦✦✦)

**Vấn đề:** `marker.bindPopup(createMarkerPopupContent(row))` gọi `createMarkerPopupContent()`
cho TẤT CẢ 1,000+ marker khi load — dù phần lớn popup không bao giờ được mở.

**Giải pháp:** Bind popup rỗng, chỉ sinh HTML khi user thực sự mở popup:
```javascript
// Thay vì:
marker.bindPopup(createMarkerPopupContent(row));

// Dùng:
marker.bindPopup(''); // placeholder rỗng
marker.on('popupopen', function() {
    const popup = marker.getPopup();
    if (popup && !popup._contentLoaded) {
        popup.setContent(createMarkerPopupContent(row));
        popup._contentLoaded = true;
    }
    // ... rest of popupopen handler
});
```

**Lợi ích:** Tiết kiệm ~1,000 lần gọi `createMarkerPopupContent()` khi load. Tổng thời gian
load giảm đáng kể vì hàm này tạo HTML phức tạp (ảnh, nút, bảng thông tin).

---

#### 9.3 — Chunked DOM insertion + progress indicator (ưu tiên trung bình ✦✦)

**Vấn đề:** `addMarkersToMap()` gọi `addMarkerRowToMap()` 1,000+ lần đồng bộ → UI freeze
vài giây trên mobile.

**Giải pháp:** Chia thành batch 100 marker, yield cho main thread giữa mỗi batch:
```javascript
async function addMarkersToMapChunked(rows, chunkSize = 100) {
    markersCluster.clearLayers();
    labelLayerGroup.clearLayers();
    markers = [];
    const total = rows.length;
    for (let i = 0; i < total; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        chunk.forEach(row => addMarkerRowToMap(row));
        // Cập nhật progress
        _setLoadProgress(Math.round((i + chunk.length) / total * 100));
        // Yield cho main thread
        await new Promise(r => setTimeout(r, 0));
    }
    _setLoadProgress(null); // ẩn progress bar
    if (markers.length > 0) map.fitBounds(markersCluster.getBounds().pad(0.1));
    if (map.getZoom() < labelZoomThreshold) map.removeLayer(labelLayerGroup);
    else map.addLayer(labelLayerGroup);
}
```

**Progress bar đơn giản** (thêm vào topbar):
```html
<div id="loadProgressBar"
     style="display:none;position:fixed;top:0;left:0;height:3px;background:#2563eb;
            transition:width .1s;z-index:9999;pointer-events:none;"></div>
```
```javascript
function _setLoadProgress(pct) {
    const el = document.getElementById('loadProgressBar');
    if (!el) return;
    if (pct === null) { el.style.display = 'none'; el.style.width = '0'; return; }
    el.style.display = 'block';
    el.style.width = pct + '%';
}
```

---

#### 9.4 — Bỏ tính VN2000 khi load (ưu tiên trung bình ✦✦)

**Vấn đề:** Nếu `convertLatLonToVn2000()` được gọi trong vòng lặp render 1,000+ marker → nặng.

**Giải pháp:** VN2000 chỉ tính tại 2 điểm cụ thể (đã ghi trong CLAUDE.md):
- `saveMarkerPopup()` khi lưu
- `updateMarkerCoordinatesInData()` khi kéo marker

→ **Không gọi trong `addMarkerRowToMap()` hay `addMarkersToMap()`**.
Xác nhận trong code không có vòng lặp nào gọi VN2000 khi render.

---

#### 9.5 — Viewport culling (ưu tiên thấp ✦ — nếu > 2,000 marker)

**Bối cảnh:** markerCluster đã xử lý phần lớn vấn đề DOM với `chunkedLoading: true`.
Viewport culling chỉ cần thiết nếu tổng marker vượt 2,000+.

**Ý tưởng:** Chỉ thêm marker trong bounds hiện tại của map vào markerCluster, lắng nghe
`moveend` để add/remove marker khi người dùng pan.

```javascript
// State
let _allRows = []; // toàn bộ dữ liệu
let _visibleSet = new Set(); // index của marker đang hiển thị

function _refreshViewportMarkers() {
    const bounds = map.getBounds().pad(0.2); // pad 20% để tránh nhấp nháy
    _allRows.forEach((row, i) => {
        const lat = parseCoord(row[2]), lon = parseCoord(row[3]);
        const inView = bounds.contains([lat, lon]);
        const wasVisible = _visibleSet.has(i);
        if (inView && !wasVisible) {
            addMarkerRowToMap(row);
            _visibleSet.add(i);
        } else if (!inView && wasVisible) {
            removeMarkerFromMap(row[1]); // xóa theo tên
            _visibleSet.delete(i);
        }
    });
}
map.on('moveend', debounce(_refreshViewportMarkers, 200));
```

**Lưu ý:** Cách này phức tạp và có thể gây bug edge case. Chỉ implement nếu 9.1+9.2+9.3 chưa đủ.

---

#### 9.6 — Canvas renderer thay SVG divIcon (ưu tiên thấp ✦ — refactor lớn)

**Vấn đề:** 1,000+ SVG divIcon = 1,000+ DOM node, mỗi node có shadow filter.

**Giải pháp:** Dùng `L.canvas()` renderer — vẽ tất cả marker trên 1 canvas element duy nhất.
Nhưng L.canvas chỉ hỗ trợ `L.circleMarker` / `L.circle`, không hỗ trợ SVG tùy chỉnh.

→ Cần thư viện bên ngoài như **Leaflet.VirtualGrid** hoặc tự implement với HTML Canvas.
→ **Refactor rất lớn**, không khuyến nghị trừ khi performance vẫn không đạt sau 9.1–9.3.

---

### Checklist implement (theo thứ tự ưu tiên)

```
9.1 → index.html: IndexedDB cache CSV + stale-while-revalidate         ✅
9.2 → index.html: Lazy popup content (bind '' + generate on popupopen) ✅
9.3 → index.html: chunked addMarkersToMap + progress bar               ✅
9.4 → index.html: xác nhận VN2000 không gọi khi render                ✅
9.5 → index.html: zoom-tier progressive (cabinet only zoom < 12)      ✅
```

### 9.5 — Zoom-tier progressive loading (đã implement 2026-06-17)

- Const `ZOOM_TIER_THRESHOLD = 12`, state `_zoomTier: 'cabinet' | 'all'` (default `'all'`)
- Function `_applyZoomTier()` — check zoom < threshold → tier `'cabinet'` (chỉ render type 5,6); ngược lại `'all'`
- Chỉ re-render khi tier thực sự đổi (tránh render khi pan trong cùng tier)
- Base rows = filtered nếu có `_activeFilters` active, ngược lại `loadedData.slice(1)`
- Hook vào `map.on('zoomend')` sau logic labelLayerGroup add/remove

**⚠ Bug đã fix**: `addMarkersToMap(data, opts)` giờ nhận `opts.fitView` (default true). `_applyZoomTier` truyền `fitView: false` để KHÔNG `fitBounds()` khi đổi tier — giữ nguyên viewport user. Không có fix này, zoom từ 11→12 sẽ reset về ~10 do `fitBounds` recompute cho all markers.

Reset `_zoomTier = 'all'` trước mỗi `addMarkersToMap` từ data fresh (loadFromCSV, loadFromCSVWithCache) — để lần render đầu không bị stale tier.

### Ước tính cải thiện

| Giải pháp | Load lần 1 | Load lần 2+ | Mobile UX |
|-----------|-----------|-------------|-----------|
| Hiện tại  | ~3–5s     | ~3–5s       | Freeze 2–3s |
| + 9.2     | ~2–3s     | ~2–3s       | Freeze 1–2s |
| + 9.3     | ~2–3s     | ~2–3s       | Không freeze |
| + 9.1     | ~2–3s     | **< 0.3s**  | Tức thì |
| + 9.1+9.2+9.3 | ~1.5s | **< 0.3s** | Mượt |

---

## Tính năng 10: Filter theo tủ điều khiển khi xem địa bàn

### Mục tiêu

Mỗi địa bàn (sheet) có 10–30 tủ điều khiển, mỗi tủ quản lý 30–80 trụ. Khi user đang khảo sát
1 tủ cụ thể, không cần thấy 1,000 trụ của toàn địa bàn. Cho phép lọc theo 1 hoặc nhiều tủ →
chỉ hiển thị marker có `row[7]` (Tủ điều khiển) trùng với tủ đã chọn.

---

### Phương án được chọn — C + shortcut dropdown

**Phương án C**: Tích hợp vào filter panel hiện có (`filterOverlay`), thêm section "Tủ điều khiển"
với multi-select checkbox. Ngoài ra thêm 1 **shortcut dropdown** nhỏ nằm trên bản đồ để chọn tủ
nhanh mà không cần mở filter panel.

```
┌─────────────────────────────────────┐
│ 🔍 Bộ lọc đối tượng                  │
├─────────────────────────────────────┤
│ Loại marker: [☑1][☑2][☑3][☑4][☑5][☑6]│
│ Người KS: [________________]        │
│ Phường/Xã: [________________]       │
│ Đường: [________________]           │
│ ── Tủ điều khiển ──                 │  ← MỚI
│ ☑ Tất cả (N tủ)                     │
│ ☑ VTS_H232VTS  (52 trụ)             │
│ ☑ VTS_H23VTS_2 (41 trụ)             │
│ ☐ P12_TTC_01   (38 trụ)             │
│ [Bỏ chọn tất cả]                   │
│ [Xóa lọc] [Áp dụng (N)]            │
└─────────────────────────────────────┘
```

**Shortcut trên bản đồ** (chỉ hiện khi đang ở địa bàn có ≥ 2 tủ):
```
[ Tủ: Tất cả ▾ ]   ← nằm trong controlsPanel hoặc floating button
```

---

### Thiết kế kỹ thuật

#### State

```javascript
// Mảng tên tủ đang chọn để hiển thị. null/[] = tất cả.
// Độc lập với _selectedTus (chỉ dùng cho sơ đồ cáp)
let _activeFilterCabinets = [];   // [] = tất cả
```

**Phân biệt với `_selectedTus`:**
- `_selectedTus` (Set): dùng để lọc rows cho `_buildCableLines()` (vẽ sơ đồ cáp)
- `_activeFilterCabinets` (Array): dùng để lọc marker hiển thị trên bản đồ (tính năng 10)
- Hai state này **độc lập** — có thể sơ đồ cáp đang lọc 1 tủ, nhưng bản đồ hiển thị 3 tủ

#### Lấy danh sách tủ duy nhất

```javascript
function _getUniqueCabinets() {
    if (!Array.isArray(loadedData) || loadedData.length < 2) return [];
    const seen = new Set();
    const result = [];
    loadedData.slice(1).forEach(r => {
        const name = String(r[7] || '').trim();
        if (name && !seen.has(name)) { seen.add(name); result.push(name); }
    });
    return result.sort();
}
```

#### Tích hợp vào `_getFilteredRows()`

```javascript
function _getFilteredRows() {
    // ... existing filters ...
    if (_activeFilterCabinets.length > 0) {
        filtered = filtered.filter(r =>
            _activeFilterCabinets.includes(String(r[7] || '').trim())
        );
    }
    return filtered;
}
```

#### Render section trong filter panel

```javascript
function _renderCabinetFilterSection() {
    const cabinets = _getUniqueCabinets();
    if (cabinets.length === 0) return '';
    const allChecked = _activeFilterCabinets.length === 0;
    const countByTu = {}; // row count per cabinet
    (loadedData || []).slice(1).forEach(r => {
        const t = String(r[7]||'').trim();
        if (t) countByTu[t] = (countByTu[t] || 0) + 1;
    });
    return `<div class="filter-section">
        <div class="filter-section-title">Tủ điều khiển</div>
        <label class="filter-checkbox-item">
            <input type="checkbox" id="fcAllCabinets" ${allChecked ? 'checked' : ''}>
            <span>Tất cả (${cabinets.length} tủ)</span>
        </label>
        ${cabinets.map(c => `
        <label class="filter-checkbox-item">
            <input type="checkbox" class="fcCabinetItem" value="${c}"
                   ${allChecked || _activeFilterCabinets.includes(c) ? 'checked' : ''}>
            <span>${c} (${countByTu[c] || 0})</span>
        </label>`).join('')}
    </div>`;
}
```

#### Reset khi chuyển địa bàn

```javascript
async function switchDistrict(sheetName) {
    _activeFilterCabinets = [];          // reset filter tủ
    currentSheet = sheetName;
    addMarkersToMap([]);
    await loadFromCSVWithCache(sheetName, page.csvUrl);
    _rebuildCabinetFilterUI();           // rebuild UI với tủ của địa bàn mới
}
```

---

### UI: Shortcut dropdown trên bản đồ

Nằm trong `controlsPanel` (row nút bên dưới bản đồ), hoặc 1 floating button nhỏ:

```html
<div id="cabinetFilterWrap" style="display:none">
    <button id="btnCabinetFilter" class="ctrl-btn outline" onclick="_toggleCabinetDropdown()">
        Tủ: <span id="cabinetFilterLabel">Tất cả</span> ▾
    </button>
    <div id="cabinetFilterDropdown" style="display:none;...">
        <!-- Sinh động giống cableDropdown -->
    </div>
</div>
```

Label cập nhật theo selection:
- Không chọn gì / chọn tất cả → **"Tất cả"**
- Chọn 1 tủ → **"VTS_H232VTS"**
- Chọn N tủ → **"N tủ đã chọn"**

---

### Liên kết với tính năng 7 (đa địa bàn)

- Khi đang ở `DanhSachTru` (tổng quan): `cabinetFilterWrap` hiện (nhiều tủ)
- Khi đang ở địa bàn 1 tủ duy nhất: ẩn dropdown (không cần chọn)
- Khi không có tủ nào (`row[7]` trống hết): ẩn dropdown

---

### Liên kết với tính năng 9.5 (zoom-level progressive loading)

Nếu implement 9.5: `_refreshViewportMarkers()` cũng cần áp dụng `_activeFilters.tuDieuKhien`
khi quyết định add/skip 1 marker.

---

### Thiết kế đã implement ✅

**State:** `_activeFilters.tuDieuKhien: []` — array tên tủ đang lọc ([] = tất cả), nằm trong `_activeFilters` cùng với `types/nguoiKS/phuongXa/duong`.

**UI trong filter panel:**
- Ô tìm kiếm `<input id="fTuSearch">` — không phân biệt dấu/hoa thường (`normalizeText`)
- `<select multiple id="fTuDieuKhien">` (height 150px, scroll) — Ctrl/⌘+click chọn nhiều
- Tự động ẩn section này nếu chỉ có ≤ 1 tủ trong dữ liệu

**Hàm:**
- `_getUniqueCabinets()` — unique sorted values của `row[7]` từ `loadedData`
- `_filterTuOptions()` — lọc options theo ô tìm kiếm, giữ nguyên selection hiện tại
- `_getFilteredRows()` — thêm điều kiện `tuDieuKhien` vào pipeline filter

**Reset:** `_activeFilters.tuDieuKhien = []` khi `switchDistrict()` và `clearFilters()`.

---

## Tính năng 11: Chế độ GPS với hỗ trợ RTK Tersus Luka

### Mục tiêu

Cho phép user chọn giữa 2 chế độ GPS theo loại thiết bị:
- **📱 Phone GPS** (mặc định) — built-in GPS, ±3-10m, đủ cho khảo sát sơ bộ
- **🛰 RTK Tersus Luka** — GNSS Bluetooth + NTRIP, ±1-5cm khi Fixed, cho khảo sát chính xác cao

Mỗi chế độ có config riêng (threshold accuracy, sample averaging, precision hiển thị tọa độ). UX dùng floating tracking bar (non-blocking) với auto-accept countdown để tay rảnh khi cầm pole RTK.

---

### 11.1 — Cấu trúc `GPS_MODES` config

Đặt ở đầu file index.html (gần `TYPE_CONFIG`):

```javascript
const GPS_MODES = {
    phone: {
        label: '📱 Phone GPS',
        emoji: '📱',
        targetAccuracy: 5.0,     // m — chấp nhận khi accuracy ≤ giá trị này
        maxWaitMs: 30000,        // chờ tối đa 30s
        useAveraging: true,      // multi-sample averaging cho phone
        averageSamples: 8,       // 8 fixes → sai số giảm ~√8 ≈ 2.83 lần
        coordPrecision: 6,       // toFixed(6) ≈ 0.11m precision
        vn2000Precision: 0,      // integer m
        statusBadge: false       // không hiện RTK status
    },
    rtk: {
        label: '🛰 RTK',
        emoji: '🛰',
        targetAccuracy: 0.05,    // 5cm = RTK Fixed
        maxWaitMs: 60000,        // chờ tối đa 60s cho Fixed
        useAveraging: false,     // RTK 1 fix đủ chính xác
        coordPrecision: 8,       // toFixed(8) ≈ 0.0011m = 1.1mm
        vn2000Precision: 3,      // 3 decimal = mm
        statusBadge: true        // hiện FIXED/FLOAT/DGPS/SPS
    }
};

let currentGpsMode = localStorage.getItem('gpsMode') || 'phone';
```

---

### 11.2 — Toggle UI trong Bảng điều khiển (☰)

Section mới giữa "Điều hướng" và "Chỉnh vị trí & Đồng bộ":

```
┌─ THIẾT BỊ GPS ─────────────────┐
│ ⦿ 📱 Phone GPS (mặc định)      │
│ ⦾ 🛰 RTK (Tersus Luka, ±cm)    │
│ ℹ Cần setup mock location...   │
│   [Hướng dẫn] →                │
└─────────────────────────────────┘
```

`onchange` → `switchGpsMode(value)`:
- Auto-discard ongoing GPS tracking (`clearWatch` + `_hideGpsTrackingBar`)
- `localStorage.setItem('gpsMode', value)`
- Hiển thị toast info

---

### 11.3 — Helpers chung

```javascript
function formatAccuracy(meters) {
    if (meters < 1)   return `±${(meters * 100).toFixed(1)} cm`;
    if (meters < 10)  return `±${meters.toFixed(2)} m`;
    return `±${meters.toFixed(0)} m`;
}

function rtkStatus(acc) {
    if (acc <= 0.05) return { label: 'RTK FIXED', color: '#10b981', emoji: '🟢' };
    if (acc <= 0.50) return { label: 'RTK FLOAT', color: '#f59e0b', emoji: '🟡' };
    if (acc <= 5.00) return { label: 'DGPS',      color: '#3b82f6', emoji: '🔵' };
    return                   { label: 'SPS',       color: '#6b7280', emoji: '⚪' };
}

function formatCoord(value, mode) {
    const cfg = GPS_MODES[mode || currentGpsMode];
    return Number(value).toFixed(cfg.coordPrecision);
}

function formatVn2000(value, mode) {
    const cfg = GPS_MODES[mode || currentGpsMode];
    return Number(value).toFixed(cfg.vn2000Precision);
}
```

---

### 11.4 — `getBestFix(opts)` — pipeline thống nhất

Thay thế các call `getCurrentPosition` rải rác (7 chỗ) bằng 1 hàm chung.

**API**: `getBestFix(opts)` — opts hỗ trợ:
- `forceMode`: `'phone' | 'rtk'` — override currentGpsMode tạm thời (vd test)
- `quickMode`: `true` — silent fast fix (no tracking bar, timeout 8s, fix đầu tiên).
  Dùng cho luồng cần fix nhanh — vd routing fallback. KHÔNG dùng cho luồng đặt
  marker (mất tính chính xác).

```javascript
async function getBestFix(opts = {}) {
    const mode = opts.forceMode || currentGpsMode;
    const cfg  = GPS_MODES[mode];

    // Quick mode: silent fast, dùng cho routing
    if (opts.quickMode) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject,
                { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 });
        });
    }

    const bar = _showGpsTrackingBar({ mode });

    let bestFix = null;
    let samples = [];

    return new Promise((resolve, reject) => {
        const watchId = navigator.geolocation.watchPosition(
            pos => {
                const acc = pos.coords.accuracy;
                if (!bestFix || acc < bestFix.coords.accuracy) bestFix = pos;

                // Collect samples (mode phone)
                if (cfg.useAveraging && acc < cfg.targetAccuracy * 3) samples.push(pos);

                // Update bar UI realtime
                bar.update({
                    accuracy: acc,
                    status: cfg.statusBadge ? rtkStatus(acc) : null,
                    samples: samples.length,
                    targetSamples: cfg.averageSamples,
                    elapsed: Date.now() - bar.startTime
                });

                // Check accept condition
                const reachedTarget = (acc <= cfg.targetAccuracy);
                const enoughSamples = cfg.useAveraging && samples.length >= cfg.averageSamples;

                if (reachedTarget) {
                    // Start auto-accept countdown 3s (cho user chance override)
                    bar.startAutoAccept(3000, () => {
                        navigator.geolocation.clearWatch(watchId);
                        bar.hide();
                        resolve(cfg.useAveraging ? averageFixes(samples) : bestFix);
                    });
                } else if (enoughSamples) {
                    navigator.geolocation.clearWatch(watchId);
                    bar.hide();
                    resolve(averageFixes(samples));
                }
            },
            err => { bar.hide(); reject(err); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: cfg.maxWaitMs }
        );

        // Hard timeout
        setTimeout(() => {
            navigator.geolocation.clearWatch(watchId);
            bar.hide();
            if (bestFix) resolve(bestFix);
            else reject(new Error('Không lấy được GPS'));
        }, cfg.maxWaitMs);

        // User manual buttons
        bar.onAccept(() => {
            navigator.geolocation.clearWatch(watchId);
            bar.hide();
            if (bestFix) resolve(bestFix); else reject(new Error('Chưa có fix'));
        });
        bar.onCancel(() => {
            navigator.geolocation.clearWatch(watchId);
            bar.hide();
            reject(new Error('User hủy'));
        });
    });
}

function averageFixes(fixes) {
    // Median Absolute Deviation outlier rejection
    const lats = fixes.map(f => f.coords.latitude).sort();
    const lons = fixes.map(f => f.coords.longitude).sort();
    const medLat = lats[Math.floor(lats.length / 2)];
    const medLon = lons[Math.floor(lons.length / 2)];
    const inliers = fixes.filter(f => {
        const dLat = Math.abs(f.coords.latitude - medLat);
        const dLon = Math.abs(f.coords.longitude - medLon);
        return dLat < 0.00005 && dLon < 0.00005; // ~5.5m boundary
    });
    const avgLat = inliers.reduce((s, f) => s + f.coords.latitude, 0) / inliers.length;
    const avgLon = inliers.reduce((s, f) => s + f.coords.longitude, 0) / inliers.length;
    const avgAcc = inliers.reduce((s, f) => s + f.coords.accuracy, 0) / inliers.length;
    return {
        coords: {
            latitude: avgLat, longitude: avgLon,
            accuracy: avgAcc / Math.sqrt(inliers.length) // sai số giảm √N
        }
    };
}
```

---

### 11.5 — Floating tracking bar UX (Hybrid C)

Element HTML: `#gpsTrackingBar` — fixed bottom, không block map, pan/zoom được khi đợi.

```
┌─ Phase SEARCHING ──────────────────┐
│ 🛰 ⏳ RTK FLOAT    ±28 cm          │
│ Mục tiêu ±5cm  12.3s / 60s         │
│                       [✗ Hủy]      │
└────────────────────────────────────┘

┌─ Phase REACHED (auto-accept 3s) ───┐
│ 🛰 ✓ RTK FIXED    ±1.8 cm          │
│ Auto-dùng trong 3...               │
│ [✓ Dùng ngay]  [⏸ Đợi tốt hơn]    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ ← countdown │
└────────────────────────────────────┘
```

**State machine**:
- `SEARCHING` → orange/gray bar, không có countdown
- `REACHED` → green bar, countdown 3s, button "Đợi tốt hơn" reset countdown nếu user muốn

Methods của bar object:
- `update({accuracy, status, samples, elapsed})` — refresh UI
- `startAutoAccept(ms, callback)` — countdown + callback
- `onAccept(fn)`, `onCancel(fn)` — wire button clicks
- `hide()` — remove element

---

### 11.6 — Accuracy circle với màu theo status

Sửa `currentLocationAccuracyCircle` cũ:

```javascript
function _updateAccuracyCircle(lat, lon, acc) {
    if (currentLocationAccuracyCircle) map.removeLayer(currentLocationAccuracyCircle);
    const color = rtkStatus(acc).color;
    currentLocationAccuracyCircle = L.circle([lat, lon], {
        radius: acc,
        color, fillColor: color, fillOpacity: 0.15, weight: 1
    }).addTo(map);
}
```

→ FIXED: chấm xanh nhỏ xíu (~5cm bán kính); FLOAT: vàng ~30cm; DGPS: xanh dương ~3m; SPS/Phone: xám rộng ~10m.

---

### 11.7 — Warn khi RTK không Fixed sau 30s

Trong `getBestFix`, nếu `mode === 'rtk'` và sau 30s vẫn `accuracy > 0.5`:

```javascript
if (mode === 'rtk' && Date.now() - bar.startTime > 30000 && bestFix.coords.accuracy > 0.5) {
    bar.showWarning({
        title: 'Chế độ RTK đang chọn nhưng accuracy ±' + formatAccuracy(bestFix.coords.accuracy),
        body: 'Bạn có thể chưa setup mock location. Kiểm tra Nuwa app đã connect Luka chưa.',
        actions: [
            { label: 'Hướng dẫn', onClick: () => openHuongDanRtk() },
            { label: 'Tiếp tục đợi', onClick: () => bar.dismissWarning() }
        ]
    });
}
```

---

### 11.8 — Schema sheet mở rộng (22 → 24 cột)

| Index | Tên cột | Key payload JS | Ghi chú |
|---|---|---|---|
| ... | (giữ nguyên 0-21) | ... | |
| **[22]** | **Độ chính xác (m)** | **accuracy** | `pos.coords.accuracy` lưu raw, vd `0.018` |
| **[23]** | **Chế độ GPS** | **gpsMode** | `'rtk'` / `'phone'` |

**GAS update**:
```javascript
const HEADER = [..., 'Số lượng đèn', 'Độ chính xác (m)', 'Chế độ GPS'];
const FIELD_MAP = {
    ..., 'accuracy': 'Độ chính xác (m)', 'gpsMode': 'Chế độ GPS'
};
```

**Migration**: row cũ không có cột 22-23 → `ensureHeader()` tự thêm. App đọc undefined → default empty string. Sheet hiển thị OK.

**Audit trail**: sau này có thể query "marker nào đo bằng RTK?" hoặc filter Excel theo `Độ chính xác < 0.1`.

---

### 11.9 — Precision tọa độ conditional

Mọi nơi đang `lat.toFixed(6)` thay bằng `formatCoord(lat)`. Mọi `Math.round(x)` cho VN2000 thay bằng `formatVn2000(x)`.

Marker cũ (lưu integer VN2000) vẫn xem được — chỉ display chính xác hơn cho marker mới khi RTK.

---

### 11.10 — Refactor 7 call sites GPS

Toàn bộ 7 call sites dùng `getBestFix` (6 interactive + 1 quickMode), trừ 1 chỗ
watchPosition liên tục giữ nguyên cấu trúc nhưng dùng GPS_MODES config:

| Vị trí | Hàm | Đổi sang |
|---|---|---|
| [index.html:3766](index.html#L3766) | `startAddMarker` lấy GPS auto | `await getBestFix()` |
| [index.html:4732](index.html#L4732) | `startTrackingCurrentLocation` watchPosition | giữ watch, options đọc `GPS_MODES[currentGpsMode]` |
| [index.html:4834](index.html#L4834) | `centerOnUserLocation` | `await getBestFix()` |
| [index.html:4853](index.html#L4853) | "Vị trí hiện tại" trong form | `await getBestFix()` |
| [index.html:5235](index.html#L5235) | Routing fallback | **`await getBestFix({ quickMode: true })`** — silent, no tracking bar, timeout 8s |
| [index.html:5247](index.html#L5247) | Geocode lat/lon | `await getBestFix()` |
| [index.html:5305](index.html#L5305) | "Định vị" trong marker popup | `await getBestFix()` |

Tất cả 7 sites đều có `maximumAge: 0` (không stale) — quickMode chỉ khác ở
timeout ngắn (8s) + không hiện UI.

---

### 11.11 — Setup hardware cần thiết (Tersus Luka)

| Bước | Việc |
|---|---|
| 1 | Pair Luka qua Bluetooth Android |
| 2 | Cài Nuwa (APK từ tersus-gnss.com) |
| 3 | Config NTRIP trong Nuwa (VINAGEO/VRSNT) |
| 4 | Chờ RTK FIXED trong Nuwa (góc dưới hiển thị quality) |
| 5 | Enable Developer Options → Mock location app = Nuwa |
| 6 | Trong Nuwa: Device → Output → "Output to system location" ON |
| 7 | Verify: mở `https://www.maptiler.com/whereami/` → accuracy ≈ 0.02m |
| 8 | Mở app khảo sát → ☰ → Thiết bị GPS → chọn 🛰 RTK |

**NTRIP**: cần subscription. HCMC/Bình Dương/Long An phổ biến VINAGEO. Liên hệ vinageoit.com.

---

### Checklist implement

- [x] (P13a) `GPS_MODES` config + state + helpers (`formatAccuracy`, `rtkStatus`, `formatCoord`, `formatVn2000`) ✅
- [x] (P13a) Toggle UI section "Thiết bị GPS" trong ☰ Settings ✅
- [x] (P13a) GAS HEADER thêm cột 23-24 (`Độ chính xác (m)`, `Chế độ GPS`) — cần redeploy + `updateAllSheetsHeader()`
- [x] (P13a) syncRowToGAS payload thêm accuracy + gpsMode ✅
- [x] (P13b) `getBestFix(opts)` unified function — hỗ trợ `forceMode` + `quickMode` ✅
- [x] (P13b) `#gpsTrackingBar` HTML + JS state machine ✅
- [x] (P13b) Refactor 6 interactive call sites + 1 quickMode (routing fallback) ✅
- [x] (P13b) `averageFixes` với MAD filter ✅
- [x] (P13b) Auto-accept countdown 3s ✅
- [x] (P13b) Accuracy circle với màu rtkStatus ✅
- [x] (P13c) Precision tọa độ conditional (`formatCoord` trong popup + form) ✅
- [x] (P13c) VN2000 precision (lưu integer cho phone, conditional theo formatVn2000)
- [x] (P13c) Warn khi RTK không Fixed sau 30s + nút Hướng dẫn ✅
- [x] (P13c) `startTrackingCurrentLocation` dùng GPS_MODES config ✅
- [x] (P13c) huongdan.html section "Cấu hình GPS" (Phone + RTK Tersus) ✅ (đã thêm từ trước trong session)
- [x] (P13c) Update bảng schema cột sheet trong tài liệu — 25 cột ✅
