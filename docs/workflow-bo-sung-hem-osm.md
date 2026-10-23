# Quy trình bổ sung hẻm còn thiếu (OSM) cho app lighting-survey

Nền đường trong app lấy từ OpenStreetMap (OSM) — dữ liệu cộng đồng, đôi khi thiếu hẻm nhỏ so với Google.
Khi khảo sát 1 hẻm mà app chưa có, làm theo các bước sau.

## 1. Kiểm tra hẻm đã có trong OSM chưa
- Trong app, bật lớp **🛣 Đường OSM (dựng sẵn)** (góc trên-phải), phóng to ≥ Z14 tới khu đó.
- Hoặc mở thẳng `https://www.openstreetmap.org` tới vị trí, xem hẻm đã được vẽ chưa.

## 2. Nếu CHƯA có → vẽ bổ sung lên OSM
- Trong app, mở ☰ → mục **🛣 Nền OSM / Hẻm** → bấm **✏️ Vẽ hẻm trên OSM (tại đây)**.
  (Mở trình soạn iD của OpenStreetMap ngay tại vị trí bản đồ đang xem.)
- Đăng nhập tài khoản OSM của anh → vẽ đường (Line) cho hẻm → gắn tag:
  - `highway = service` (hẻm xe máy/ô tô vào được) **hoặc** `highway = footway`/`path` (hẻm đi bộ)
  - `name = Hẻm 123 Tên đường` (nếu có số/tên)
- **Save** (Lưu). Hẻm vào OSM công khai; Overpass thường có sau **vài phút–1 giờ**.

## 3. Thấy hẻm mới trong app NGAY (không cần rebuild)
- ☰ → **🛣 Nền OSM / Hẻm** → bật **🛰 Dùng OSM trực tiếp (live)**.
- Từ lúc này, **căn thẳng tuyến / overlay / xuất CAD** cho khu đang xem lấy đường từ OSM mới nhất (Overpass)
  → thấy hẻm vừa vẽ. Cần mạng; chỉ dùng cho khu đang khảo sát.
- Khảo sát xong có thể **tắt** lại để về nền dựng sẵn (offline, nhanh).

## 4. Định kỳ: đưa hẻm mới vào nền dựng sẵn (offline)
Để bên offline (nền dựng sẵn) cũng đầy đủ, rebuild lại định kỳ (vd hằng tháng):
- Nhờ Claude "cập nhật nền OSM / rebuild hẻm" — Claude sẽ:
  1. Tải bản trích OSM mới (Geofabrik Vietnam `.osm.pbf`, đã có các hẻm mới vẽ — Geofabrik cập nhật hằng ngày).
  2. Chạy `python3 tools/build-osm-roads.py <vietnam.osm.pbf>` (network_type=all, gồm hẻm).
  3. Commit + push `data/osm-roads`.
- Sau đó cập nhật app → bên offline có đủ hẻm, không cần bật "OSM trực tiếp" nữa.

## Ghi chú kỹ thuật
- Cờ "OSM trực tiếp" lưu ở `localStorage.osm_live_mode` (`'1'` = bật). Hàm chung `window._osmPreferLive()`.
  Các luồng dùng: `_raFetchRoads` (căn thẳng), `_cgUsePrebuilt`/`_cgFetchOsm` (xuất CAD), overlay (`_osmRoadsForBounds`).
- Overpass có thể chậm/lỗi lúc tải; nếu vậy chờ vài phút thử lại (app tự xoay vòng nhiều máy chủ).
- `tools/build-osm-roads.py` dùng `network_type="all"` (gồm service/footway/path/pedestrian = hẻm), loại steps/cycleway/busway/track.
