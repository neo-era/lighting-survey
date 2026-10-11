# Thiết kế: Block đèn xoay theo hướng đường OSM (v152)

## Mục tiêu
Khi xuất bản vẽ thiết kế DXF, mỗi trụ đèn (loại 1–4) được INSERT bằng block ký hiệu
"ellipse nửa đen + cần + ô vuông chứa tròn", số ellipse = số bóng (1–4), và block
xoay **vuông góc với tim đường OSM gần nhất**.

## Block (toạ độ cục bộ, mét, gốc = vị trí trụ)
- Trục **X cục bộ = hướng đường**; đèn vươn theo **±Y** (vuông góc đường).
- Ô vuông nửa cạnh 0.9 m + tròn r = 0.6 m.
- Mỗi đèn theo hướng `d`: cần từ 0.9·d → 1.4·d; ellipse tâm (1.4+1.4)·d,
  bán trục dọc d = 1.4, ngang = 0.8; **nửa xa trụ tô đen** (SOLID tam giác quạt).
- Hướng đèn theo số bóng: 1 = +Y · 2 = ±Y · 3 = ±Y,+X · 4 = ±Y,±X.
- Tên block: `SYM_POLE_LAMP1..4` — định nghĩa 1 lần, INSERT kèm group 50 (rotation).

## Tính góc xoay
1. Lấy `way["highway"]` trong bbox (Overpass, cache IndexedDB 30 ngày), bỏ
   footway/path/steps/pedestrian/cycleway/track/bridleway/corridor/proposed và
   service=parking_aisle/driveway. **Giữ `construction`**: tuyến mới thi công chính là nơi
   lắp đèn (khu J3/J4 sheet DanhSachTru: 131/134 trụ nằm cạnh `highway=construction`).
2. Đổi node sang VN2000 + offset xuất; lập lưới 50 m → tìm đoạn gần nhất trong 40 m.
3. Góc đoạn θ = atan2(dy, dx).
   - 1 đèn: đèn hướng **về phía đường**: rot = atan2(P − trụ) − 90°
     (nếu trụ nằm sát tim < 0.3 m thì rot = θ).
   - ≥2 đèn: rot = θ chuẩn hoá về (−90°, 90°].
4. Fallback (không có đường trong 40 m / Overpass lỗi): θ = hướng trụ cha → trụ
   (tuyến cáp, `row[14]`); không có cha → 0°.

## UI
Checkbox `#cgOrientByRoad` "🧭 Block đèn xoay theo hướng đường OSM" trong modal xuất bản vẽ.
Tắt → giữ ký hiệu theo trạng thái cải tạo như cũ.

## Đánh đổi
- Khi bật, ký hiệu trạng thái cải tạo (thu hồi / lắp mới…) của trụ **được thay** bằng block đèn.
- Overpass lỗi không chặn xuất: toàn bộ trụ dùng fallback, có toast cảnh báo.
