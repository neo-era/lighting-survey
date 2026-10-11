# dxf-check — kiểm tra bản vẽ DXF không cần AutoCAD

Dựng DXF mặt bằng từ **dữ liệu thật** (CSV sheet + Overpass) bằng **chính các hàm trong
`index.html`**, rồi audit + render ra PNG. Dùng khi sửa phần xuất bản vẽ hoặc khi có báo lỗi
"block xoay sai / đường lệch / nét không đúng".

## Cài đặt (1 lần)
```bash
pip install ezdxf matplotlib        # Python 3.10+
```
Node 18+ (có `fetch`). Không cần `npm install`.

## Dùng
```bash
# 1. Dựng DXF: trụ J3.2x–J3.3x sheet DanhSachTru, đủ lớp đường + lớp đường khác
node tools/dxf-check/build-sample.mjs --filter "^J3\.[23]\d$" --other --out tools/dxf-check/out/j3.dxf

# 2. Audit + render toàn cảnh, rồi phóng to quanh 1 trụ
python tools/dxf-check/render.py tools/dxf-check/out/j3.dxf tools/dxf-check/out/j3.png
python tools/dxf-check/render.py tools/dxf-check/out/j3.dxf tools/dxf-check/out/j3_zoom.png --around "J3.31" --radius 40
```
`build-sample.mjs --help` liệt kê tùy chọn (tắt tim/mép/tên, `--no-orient`, `--cm`, `--refresh`).

## Cách hoạt động
- `lib.mjs` trích các khối có marker `// @@ROADLAMP_START/END`, `// @@OSMROAD_START/END` cùng
  `_drawOsmBasemapInDxf`, `_dxfEscape`, `parseCSVText` và bảng LTYPE/LAYER của generator từ
  `index.html`. **Đổi tên/marker trong index.html → công cụ báo lỗi rõ chỗ nào.**
- VN2000 lấy từ `lib/vn2000.js`; k0 theo kinh tuyến như generator (0.9996 khi 105°).
- Cache CSV (6 giờ) và Overpass (30 ngày) ở `tools/dxf-check/.cache/` (đã gitignore).
  Overpass từ Node cần User-Agent — đã có sẵn; máy chủ chính quá tải thì tự thử 2 mirror.
- **Cần mạng khi đổi `--filter`**: cache Overpass khoá theo đúng khung toạ độ của các trụ được lọc,
  nên bộ lọc mới (khung khác) sẽ tải lại. Chạy lại đúng lệnh cũ thì dùng cache, không cần mạng.

## Đọc kết quả
- `audit errors: 0` là bắt buộc; `render.py` thoát mã 1 nếu có lỗi.
- Chữ tiếng Việt thành ô vuông trên PNG là do **máy render thiếu font**, không phải lỗi DXF.
- Không thay được AutoCAD cho kiểm tra cuối (font times.ttf, LTYPE, FILLMODE) — vẫn mở thử 1 lần.

## Giới hạn
Chỉ dựng phần trụ + đường OSM của bản vẽ mặt bằng, không có khung tên/chú thích/cáp
(phần đó phụ thuộc DOM và nhiều hàm khác của app).
