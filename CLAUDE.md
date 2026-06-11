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

**Bảng ký hiệu legend** (floating inside map, `position:absolute; top:12px; left:12px`):
- `background:rgba(255,255,255,.94); border:1.5px solid #1e293b; border-radius:3px; padding:7px 10px`
- Chỉ hiện loại marker thực sự xuất hiện trong data + ký hiệu cáp nguồn (nét đứt xanh)
- Dùng `_makeLampIconSvg(color)` / `_makeCabinetIconSvg(color)` — SVG mini 14×16~20px

**Thống kê** (stats div, `position:absolute; right:12px; bottom:122px`):
- Tổng số trụ + tổng chiều dài cáp (Σ `row[15]`, bỏ qua rỗng/NaN)
- `background:rgba(255,255,255,.92); border:1.5px solid #1e293b; font-size:9px; font-weight:700`

**Khung tên (title block)** (cao **110px**, table 4 hàng × 6 cột):
```
Col:  16%               4%   16%               10%        34%               20%
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
- `pdTuSelect` — tủ điều khiển, `pdScale` — tỉ lệ, `pdPaper` — khổ giấy
- `pdTenTu` — tên bản vẽ, `pdSoBanVe` — số bản vẽ
- `pdNguoiLap` — người lập, `pdNgay` — ngày
- `pdCVPhuTrach` — chuyên viên phụ trách địa bàn, `pdCSKhuVuc` — chiếu sáng khu vực

**File `banve-mau.html`** — preview tĩnh layout bản vẽ (không cần đăng nhập):
- Cấu trúc: `.paper` (padding:14px) → `.print-frame` (border:2px) → `.map-wrap` + `.title-block`
- Legend `.legend-float` + cable SVG inline + title header strip

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
4. `_switchToPrintTile()` chuyển sang CartoDB
5. `_zoomToScale(scale)` — zoom map theo tỉ lệ đã chọn (giữ nguyên center)
6. Đợi 3s để CartoDB tiles tải
7. `_showPrintOverlay(opts)` inject tiêu đề + legend + stats + title block vào `#map`
8. `html2canvas(#map, { useCORS:true, scale:2, ignoreElements: controls/toast })`
9. `new jsPDF({ orientation:'landscape', format:'a3'/'a4' })` → `addImage` full trang
10. `doc.save('tên-ngày.pdf')`
11. `finally`: `_hidePrintOverlay()`, `_removeCableLines()`, `_restoreOriginalTiles()`

---

#### Các hàm đã implement (index.html)

| Hàm | Mô tả |
|-----|-------|
| `openPrintDrawingModal()` | Mở modal, điền tủ/người lập/ngày mặc định |
| `_filterRowsByTu(tuName)` | Lọc loadedData theo row[7] (tủ điều khiển) |
| `_buildCableLines(rows)` | Vẽ polyline cáp nét đứt + nhãn m lên `_cableLayerGroup` |
| `_removeCableLines()` | Xóa `_cableLayerGroup` khỏi map |
| `_switchToPrintTile()` | Lưu tiles gốc, bật CartoDB CORS |
| `_restoreOriginalTiles()` | Restore tiles gốc sau khi capture |
| `_zoomToScale(scale)` | Tính zoom từ tỉ lệ (công thức DPI 96) → `map.setZoom()` |
| `_makeLampIconSvg(color)` | SVG đèn đường mini 14×20px cho legend |
| `_makeCabinetIconSvg(color)` | SVG tủ điện mini 14×16px cho legend |
| `_showPrintOverlay(opts)` | Inject tiêu đề + legend + stats + title block vào #map |
| `_hidePrintOverlay()` | Xóa `#printOverlay` |
| `exportDrawingPDF()` | Hàm chính — orchestrate toàn bộ luồng |
| `_loadPrintLibs()` | Lazy-load jsPDF 2.5.1 + html2canvas 1.4.1 |

**`_showPrintOverlay(opts)` nhận:**
```javascript
{ rows, tenTu, scale, ngay, nguoiLap, soBanVe, cvPhuTrach, csKhuVuc }
```

**`_zoomToScale(scale)` — công thức:**
```javascript
const latRad = map.getCenter().lat * Math.PI / 180;
const zoom = Math.log2(40075016.686 * Math.cos(latRad) * 96 / (25.4 * scale));
map.setZoom(Math.round(zoom));
```

#### Tất cả cải tiến đã hoàn thành ✅

- [x] Legend float inside map (không che map, semi-transparent)
- [x] Print frame `inset:14px` — margin trắng xung quanh
- [x] Title header strip ở đầu bản vẽ (tên BV + tủ + tỉ lệ)
- [x] Thống kê tổng trụ + tổng cáp (góc dưới phải)
- [x] Zoom tự động theo tỉ lệ (`_zoomToScale`)
- [x] Title block 110px, 4 hàng: hàng 1 = label, hàng 2–3 = trống ký tên, hàng 4 = tên người
- [x] Modal có đủ field: `pdCVPhuTrach` (chuyên viên), `pdCSKhuVuc` (khu vực)

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

#### 4.3 — Capture đúng tỉ lệ landscape

**Mục tiêu:** Đảm bảo bản vẽ xuất PDF luôn theo chiều ngang tờ giấy, bất kể orientation màn hình người dùng.

**Vấn đề hiện tại:** `html2canvas` capture `#map` theo kích thước DOM thực tế. Nếu màn hình dọc (mobile), canvas sẽ portrait → jsPDF landscape sẽ scale méo.

**Giải pháp:**
```javascript
// Trước capture: force #map sang tỉ lệ landscape
const mapEl = document.getElementById('map');
const origW = mapEl.style.width, origH = mapEl.style.height;
const pw = paper === 'a3' ? 420 : 297; // mm
const ph = paper === 'a3' ? 297 : 210;
const targetW = mapEl.offsetHeight * (pw / ph); // width để đạt tỉ lệ landscape
mapEl.style.width = targetW + 'px';
map.invalidateSize();
await new Promise(r => setTimeout(r, 500)); // chờ Leaflet rerender
// ... capture ...
// Sau capture: restore
mapEl.style.width = origW;
map.invalidateSize();
```

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

#### Lưu ý vận hành quan trọng

| Việc cần làm | Lý do | Ưu tiên |
|---|---|---|
| ~~Bump sw.js v5 → v6~~ | ✅ Đã bump lên v6 | — |
| **Redeploy GAS New version** | Header sheet DanhSachTru mở rộng VN2000 từ session trước | 🔴 Cao |
| ~~Sync banve-mau.html~~ | ✅ Đã rewrite đồng bộ với `_showPrintOverlay()` | — |
| ~~Implement 4.4.1 + 4.4.2~~ | ✅ Đã implement (PROMPT 5.1 + 5.2) | — |
| ~~Fix edit marker mode~~ | ✅ `_editingRow` state, double-listener, geocode cancel | — |

---

## Các pattern quan trọng

### Chỉnh sửa marker — `_editingRow`

`saveMarkerPopup()` dùng biến `_editingRow` để phân biệt chế độ:
- **`_editingRow = null`** → thêm mới: `loadedData.push(newRow)`, tạo marker mới trên map
- **`_editingRow = row`** → sửa: cập nhật row in-place (giữ `row[0]` = ID), xóa marker cũ, tạo marker mới

`openEditMarker()`:
1. Set `_editingRow = _currentPopupRow` trước khi gọi `showMarkerPopupAt()`
2. Hủy geocoding ngay (`_pendingGeocodePromise = Promise.resolve(null)`) — dùng dữ liệu row
3. setTimeout 80ms: điền toàn bộ field từ row, khôi phục ảnh cũ, pre-select baseSelect khớp `row[14]`

`hideMarkerPopup()` reset `_editingRow = null`. Capture `const rowRef = _editingRow` trước khi gọi `hideMarkerPopup()` để tránh null reference khi gọi `syncRowToGAS`.

### Dropdown Marker gốc — `markerBaseSelect`

- `normalizeMarkerBaseName(name)`: `replace(/[_\s\-]*\d+$/, '')` — strip `_NNN` ở cuối (kể cả dấu gạch dưới) để `VTS_H232VTS_19` → basename `VTS_H232VTS` khớp với tủ `VTS_H232VTS`
- `_fillBaseSelect()`: luôn thêm tủ điều khiển (`markerCabinetInput.value`) vào đầu list gắn nhãn `[tủ]`, sau đó các trụ cùng basename
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

### Tìm kiếm
`searchMarkers()` tìm theo tên (bỏ dấu), ID, và tọa độ `lat,lon`.

### Xuất CAD
DXF tọa độ VN-2000. Hàm `convertLatLonToVn2000(lat, lon)` → `{ x, y, zone }` (Gauss-Krüger, múi 6°, ellipsoid GRS80).
Cùng hàm này được dùng để tính cột `VN2000-X`, `VN2000-Y` khi lưu marker.

### Excel xuất báo cáo
2 sheet: **Chi tiết** (filtered rows) + **Tổng hợp** (count theo loại).
