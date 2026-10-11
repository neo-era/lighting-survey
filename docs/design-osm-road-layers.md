# Thiết kế: Xuất đường giao thông OSM ra DXF theo lớp (v154)

## Mục tiêu
Khi bật nền OSM trong modal xuất bản vẽ, đường giao thông được xuất thành 3 lớp riêng:

| Lớp | Nội dung | Nét / màu |
|---|---|---|
| `OSM_TIM_DUONG` | Tim đường (polyline OSM) | `CENTER` (gạch chấm, chu kỳ 20 m), đỏ (62=1) |
| `OSM_MEP_DUONG` | 2 nét mép, lệch ±½ bề rộng so với tim | `CONTINUOUS`, trắng (62=7) |
| `OSM_TEN_DUONG` | Tên đường (`name`) — TEXT căn giữa, xoay theo đường, luôn đọc xuôi | cao 3 m, xanh (62=3) |

Thay 2 lớp cũ `OSM_ROAD_MAJOR` / `OSM_ROAD_MINOR`.

## Bề rộng mặt đường — `_osmRoadWidth(tags, defaults)`
1. Tag `width` hợp lệ (0 < w < 100, chấp nhận "8 m", "7,5") → dùng.
2. Tag `lanes` 1–12 → `lanes × 3.5`.
3. Theo cấp (highway; nếu `construction` thì lấy tag `construction`, thiếu → khu dân cư):
   - `major`: motorway, trunk, primary (mặc định 14 m)
   - `secondary`: secondary, tertiary (10 m)
   - `service`: service (4 m)
   - còn lại (residential, unclassified, living_street, *_link…): `residential` (6 m)
Bảng mặc định sửa trong modal, lưu localStorage `cg_osm_road_widths`.

## Ghi DXF
Tim + mép đường ghi bằng **POLYLINE R12** (70=128), mỗi chuỗi đoạn liên tục sau khi cắt khung
(`_chainRuns`) là 1 polyline — nếu ghi từng LINE, nét CENTER bắt đầu lại ở mỗi nút OSM
(nút cách 5–15 m < đoạn gạch 12,5 m) và trông như nét liền.
Tên đường đặt ở **giữa chiều dài** chuỗi dài nhất trong khung (≥ 30 m); cao 3 mm giấy theo tỉ lệ.

## Hình học
- `_offsetPolyline(pts, d)`: dời song song sang trái hướng đi một đoạn d (d âm = sang phải);
  nối góc kiểu miter, giới hạn miter (góc gắt → dùng pháp tuyến đoạn sau) để không bắn ra xa.
  Bỏ điểm trùng liên tiếp.
  Đường khép kín (vòng xuyến) tính miter cả tại điểm nối đầu–cuối.
- `_roadLabelPlacement(pts, minLen)`: điểm giữa theo chiều dài, góc theo đoạn chứa điểm đó,
  chuẩn hoá (−90°, 90°]; tổng chiều dài < minLen (30 m) → không đặt nhãn.
- Không lặp nhãn: bỏ nhãn nếu đã có nhãn cùng tên trong 100 m.

## Phạm vi đường
Chỉ đường xe chạy (`_rlIsDrivable` — cùng bộ lọc với block đèn v152). Lối đi bộ/bậc thang/bãi xe bỏ.

## DXF
- Thêm bảng `LTYPE` (CONTINUOUS + CENTER) trước bảng `LAYER`; khai báo 3 lớp mới.
- Cắt theo khung bản vẽ (Liang-Barsky sẵn có). Nhãn chỉ vẽ nếu điểm đặt nằm trong khung.

## v156 — Mở rộng

### Làm sạch nút giao (luôn bật khi vẽ mép)
1. **Ghép đoạn nối tiếp** `_mergeRoadChains`: OSM hay chia 1 tuyến thành nhiều way. Tại điểm đầu/cuối
   mà **đúng 2 way gặp nhau và cùng bề rộng** → ghép thành 1 chuỗi trước khi dời mép (mép liền, không hở
   khe ở điểm nối). Ngã ba/ngã tư (≥ 3 đầu way) không ghép.
2. **Cắt phần mép nằm trong lòng tuyến khác** `_trimEdgeRun`: lấy mẫu mép mỗi ≤ 1 m, điểm nằm trong
   hành lang tuyến khác (khoảng cách tới tim < ½ bề rộng tuyến đó − 5 cm) bị bỏ; ranh giới vào/ra tìm
   bằng chia đôi tới 5 cm. Chỉ mục lưới `_corridorIndex` để tra nhanh. Tuyến tự nó không cắt chính nó.
   Thứ tự: dời mép → cắt khung bản vẽ → cắt nút giao → ghi POLYLINE.
3. **Đầu mút tuyến là đầu bằng** (không tròn): nếu tròn, tuyến rộng đâm vào tuyến hẹp sẽ khoét lỗ
   ở mép phía xa của tuyến hẹp (VD nhánh 14 m vào đường 6 m → lỗ 12,5 m). Vòng khép kín không có đầu mút.
4. **Khác tầng không cắt**: `_osmRoadLayer` (tag `layer`; cầu không ghi → 1, hầm → −1). Cầu vượt / hầm
   chui giao nhau không có nút chung → giữ nguyên mép. Ghép đoạn cũng không nối qua 2 tầng.
- Đổi bề rộng đầu–đuôi (không ghép vì khác bề rộng): mép 2 bên là 2 bậc, không có nét nối ngang.
- Giới hạn: góc giao 2 mép là góc nhọn (không bo cung). Đường đôi (2 way song song sát nhau) sẽ bị
  cắt phần chồng → thành 1 khối đường chung.

### Lớp `OSM_DUONG_KHAC` (checkbox `cgOsmRoadOther`, mặc định tắt)
`_osmRoadIsOther`: footway, path, steps, pedestrian, cycleway, track, bridleway, corridor và
service = parking_aisle / driveway / drive-through. Vẽ 1 nét liền xám (62=8), không mép, không tên.
Không vẽ `proposed`, `elevator`, `platform`.

### Sơ đồ nguyên lý (`_generateSingleLineDrawing`)
Ký hiệu trụ (nét đứng + vòng tròn) đổi thành block đèn 1–4 bóng `_rlDrawLampBlock`, đứng thẳng,
ô vuông đặt trên đường cáp ngang. Chú thích liệt kê `pole_lamp1..4` thay cho ký hiệu trạng thái
(sơ đồ này chưa bao giờ vẽ ký hiệu trạng thái).

### Công cụ kiểm tra `tools/dxf-check/`
Xem `tools/dxf-check/README.md`.

## Giới hạn
Góc giao mép đường là góc nhọn, không bo cung.
