# Thiết kế v161: Sửa số mét cáp → dời trụ, và bo góc giao lộ trong DXF

## 1. Sửa trực tiếp số mét cáp

**Luồng**: bật **✏ Sửa cáp** (thanh công cụ cáp). Nhãn số mét (`21m`) viền vàng, bấm được → popup nhập số mét → **Áp dụng**.
Cũng có trong menu khi bấm vào đường cáp: **📏 Sửa số mét (dời trụ)**. Chỉ hiện khi `canDrag()`.

**Trụ gốc** (`_cableAnchor`): đứng yên khi sửa. Mặc định `null` = gốc cây cáp (`_clRootOf` đi theo Marker gốc
tới trụ không có cha — thường là tủ). Nút **📌 Trụ gốc** chọn 1 trụ trên bản đồ; bấm lần nữa để bỏ. Ghim 📌 hiện
trên bản đồ khi đang xem sơ đồ cáp.

**Thuật toán** — khối `@@CABLELEN` (test: `node tests/cable-length-edit.test.js`):
- Đồ thị vô hướng theo tên trụ (cạnh = cáp child–Marker gốc). Cắt cạnh đang sửa → 2 thành phần.
  Child còn nối được tới parent → `cycle`.
- Phía chứa trụ gốc đứng yên (`fixed`), phía kia là nhánh dời (`moving`, đầu nhánh = `head`).
- `head` mới = điểm cách `fixed` đúng L mét theo hướng `fixed→head` (bài toán thuận trên cầu R = 6 371 000,
  **cùng công thức haversine với nhãn cáp** → nhãn hiện đúng số đã nhập).
- Cả nhánh tịnh tiến cùng (ΔLat, ΔLon) → các đoạn trong nhánh giữ số mét (sai số < 1 cm).
- Lỗi: `len` (≤0, >500, không phải số), `no_row`, `no_parent`, `cycle` (kể cả A↔B 2 chiều), `same`
  (2 trụ trùng toạ độ), `bad_coord`, `dup` (trùng tên nhưng cách nhau > 5 m — là 2 trụ khác nhau).
- Đồ thị theo **tên** (giống vẽ cáp). Dòng trùng tên **cùng chỗ** (≤ 5 m, bản sao của 1 trụ — có thật ở `Quan1`)
  được dời cùng nhau. Số mét làm tròn 0,1 m trước khi dời. `row[15]` chỉ ghi cho dòng child có đúng Marker gốc đó.
- Trụ gốc và hoàn tác bị xoá khi tải lại dữ liệu / đổi địa bàn (`_onCableDataReload`). Popup hiện trụ đứng yên
  tính đúng như lúc áp dụng (trụ gốc đã chọn ở cây khác → gốc mặc định).

**Ghi dữ liệu**: dòng bị dời → lat/lon, VN2000, thời gian, `dirtyMovedRows`; dòng của đoạn vừa sửa → `row[15] = L`.
Không tính lại `row[15]` của các đoạn trong nhánh (giữ số đo thực địa). Đẩy sheet bằng `pushMovedMarkersToSheet`
(batch 1 request). Nhánh > 30 trụ → hỏi xác nhận. Hoàn tác 1 mức dùng chung `_raUndo` / thanh hoàn tác với căn tuyến.

## 2. Bo góc mép đường tại giao lộ (DXF)

`_filletCorners(runs, radii)` trong khối `@@OSMROAD` (test: `node tests/osm-fillet.test.js`), chạy sau `_trimEdgeRun`:
- Ghép cặp đầu mút của 2 chuỗi đường **khác nhau** cách nhau < 0,5 m (lưới ô 0,5 m; chỉ cặp hợp lệ, gần nhất trước,
  mỗi đầu 1 lần). Bỏ: 2 chuỗi **cùng tên đường** (chỗ bẻ tại nút chia chuỗi, không phải giao lộ); đầu mút nằm trên
  mép khung bản vẽ (do cắt khung). Cắt mép không còn đủ 2 điểm → bỏ góc đó.
- Góc thật C = giao 2 đường thẳng chứa đoạn cuối (đầu mút cắt nút giao lệch ~5 cm).
- Góc giao θ ngoài [10°, 170°] → không bo. Bán kính theo **cấp đường lớn hơn** (`_osmRoadClass`, cùng nhóm với
  bề rộng): chính 12 / cấp 2 10 / dân cư 6 / hẻm 3 m; 0 = không bo. Sửa trong modal, nhớ trong `cg_osm_road_widths.radii`.
- t = R / tan(θ/2). Phần dùng được = đoạn **gần thẳng** (lệch ≤ 5°) tính từ C — OSM hay có nút sát giao lộ;
  run bị bo cả 2 đầu → mỗi đầu tối đa ½ chiều dài. Thiếu → giảm R cho vừa; R < 0,1 m → bỏ.
- Ghi `ARC` trên lớp `OSM_MEP_DUONG` (tâm, bán kính, góc đầu/cuối ngược chiều kim đồng hồ). Mép bị rút tới điểm tiếp xúc.
- Cầu vượt / hầm (khác tầng) không bị cắt mép → không có cặp đầu mút → không bo.

Kiểm chứng dữ liệu thật (`tools/dxf-check`, sheet `Quan1`): Lê Duẩn × Mạc Đĩnh Chi và khu Bùi Thị Xuân — audit 0 lỗi,
29 cung; góc bị kẹp giữa dải phân cách đường đôi Lương Hữu Khánh tự giảm bán kính.
