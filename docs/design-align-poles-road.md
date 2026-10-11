# Thiết kế: Căn thẳng tuyến đèn theo tim đường OSM (v158)

## Mục tiêu
Trụ đo GPS bị lệch zigzag quanh tuyến (ví dụ `BTX_BTX1_4..9` dọc Bùi Thị Xuân). Bấm 1 trụ để căn cả tuyến:
mọi trụ cùng bên đường sẽ cách tim đường OSM một khoảng bằng nhau.

## Luồng
1. Popup trụ → nút **📏 Căn thẳng tuyến**. Chỉ hiện khi `canDrag()` và trụ thuộc loại 1–4.
2. `openAlignRoute()` gom trụ cùng `normalizeMarkerBaseName(row[1])`, loại 1–4, có tọa độ.
3. Tải đường OSM bằng `_fetchOsmBasemap(bounds ±60 m, {roads only})`, có cache IndexedDB.
4. `_raPlanAlign` tính kế hoạch. Modal `#alignRouteModal` hiện bảng (tick / tên / cách tim / dời m / ghi chú),
   bản đồ hiện vị trí mới (chấm xanh) và mũi tên dời.
5. **Áp dụng** → `updateMarkerCoordinatesInData()` cho từng trụ đã tick (tự tính lại VN2000 và khoảng cách cáp
   của trụ đó và trụ con) → vẽ lại marker → `pushMovedMarkersToSheet()`.
6. **Hoàn tác** (1 mức) → trả tọa độ cũ theo đúng đường đó, rồi đẩy lên sheet.

## Thuật toán — khối `@@ROADALIGN` (hàm thuần, test bằng Node)
- `_raLocalFrame(lat0, lon0)`: phép chiếu phẳng cục bộ (mét) quanh tâm tuyến; `toXY` / `toLL` nghịch đảo đúng.
  Sai số khoảng cách so với haversine < 0,1 % trong phạm vi vài km, đủ cho ngưỡng 5 cm trên tuyến vài trăm mét.
- `_raRoadLines(roads, frame)`: chỉ giữ đường xe chạy (`_rlIsDrivable`). Khoá nhóm là `tags.name`,
  đường không tên thì khoá riêng theo từng way.
- **Chọn đường**: mỗi trụ bỏ phiếu cho nhóm đường gần nhất trong 30 m; nhóm được nhiều phiếu nhất thắng.
- **Hướng thống nhất**: các way cùng tên có thể vẽ ngược chiều nhau, khiến dấu "bên trái/phải" bị đảo.
  Way nào có vector (đầu→cuối) ngược chiều với way dài nhất thì bị đảo lại.
- Mỗi trụ chiếu vuông góc lên nhóm đường đã chọn → điểm chân `q`, khoảng cách `d`, bên `s = ±1`,
  pháp tuyến trái `n` của đoạn chứa `q`.
- `d > 30 m` → `far`: không tính trung vị, không dời.
- Mỗi bên tính `D = trung vị d` của các trụ không far. Vị trí mới = `q + s·D·n`. Trụ chỉ dời theo phương vuông
  góc với đoạn đường nên vị trí dọc đường giữ nguyên.
- `|dời| > 10 m` → `big`: bỏ tick sẵn để người dùng tự quyết.
- Lỗi: không có đường → `no_road`; ít hơn 2 trụ dùng được → `too_few`.

## Giới hạn
- Đường đôi có dải phân cách (2 way một chiều cùng tên): mỗi trụ chiếu lên way gần nhất, nên trụ đặt ở dải phân
  cách có thể bị tính theo 2 tim khác nhau.
- Trụ sát góc gấp của tim đường: chiếu lên đoạn gần nhất; khoảng cách tới đỉnh góc có thể khác D một chút.
- Hoàn tác chỉ giữ 1 mức (lần căn gần nhất).
