# Thiết kế: Căn thẳng tuyến đèn theo tim đường OSM (v158)

## Mục tiêu
Trụ đo GPS bị lệch zigzag quanh tuyến (ví dụ `BTX_BTX1_*` dọc Bùi Thị Xuân, sheet `Quan1`). Bấm 1 trụ để căn
cả tuyến: các trụ cùng hàng cách tim đường OSM một khoảng bằng nhau, chỉ dời theo phương vuông góc với đường.

## Luồng
1. Popup trụ → nút **📏 Căn thẳng tuyến**. Chỉ hiện khi `canDrag()` và trụ thuộc loại 1–4.
2. `openAlignRoute()` gom trụ cùng `normalizeMarkerBaseName(row[1])`, loại 1–4, có toạ độ
   (`loadedData` + `newMarkerRows`). Cần ≥ 2 trụ.
3. Tải đường bằng `_raFetchRoads` → `_fetchOsmBasemap(bbox ±65 m, chỉ lấy đường)`. Nếu bị giới hạn 5s
   (dùng chung với xuất CAD) thì tự chờ rồi thử lại 1 lần. Token `_raToken` bỏ kết quả của lần mở cũ.
4. Panel `#alignRoutePanel` (cố định góc dưới phải) hiện:
   - Ô **cách tim (m)** cho mỗi hàng, điền sẵn trung vị, kèm hướng la bàn (vd "về phía Tây Bắc"). Người dùng chỉ
     nhập độ lớn 0–30 m; phía của hàng giữ theo dấu trung vị.
   - Bảng trụ: tick / tên / cách tim hiện tại / độ dời / ghi chú cờ.
   - Bản đồ: chấm xanh = vị trí mới, nét đứt = đường dời.
5. **Áp dụng** → snapshot nguyên văn cột `[2,3,13,15,19,20]` của trụ được dời và trụ con → `_raSetRowCoords`
   (sửa đúng dòng theo tham chiếu, không tìm theo tên/ID vì sheet có dòng trùng) → `pushMovedMarkersToSheet()`.
   Nếu đẩy lỗi, thanh kết quả báo vàng.
6. **Hoàn tác** (1 mức) trả nguyên văn snapshot. Không hoàn tác được nếu dữ liệu đã tải lại; hỏi xác nhận nếu
   trụ đã bị dời tiếp sau khi căn.

## Thuật toán — khối `@@ROADALIGN` (hàm thuần, test: `node tests/align-poles-road.test.js`)
- `_raLocalFrame(lat0, lon0)`: phép chiếu phẳng cục bộ với bán kính cong WGS84 (M, N) tại `lat0`.
  Lệch VN2000 (k0=1) < 0,05 %.
- `_raRoadLines(roads, frame)`: chỉ đường xe chạy (`_rlIsDrivable`). Nhóm theo `tags.name`.
  Way **không tên** chỉ gộp khi nối đầu–cuối tại nút có đúng 2 way (hẻm OSM hay bị cắt), không gộp qua ngã ba.
  **Hướng** đi theo liên thông đầu/cuối (đúng với tuyến chữ U, đường đôi tách–nhập); thành phần rời mới so
  vector với way dài nhất. `freeStart/freeEnd` = đầu mút không nối way cùng nhóm.
- **Chọn đường**: mỗi trụ bỏ phiếu cho nhóm gần nhất trong 30 m; nhiều phiếu nhất thắng (hoà → tổng khoảng cách nhỏ hơn).
- Mỗi trụ chiếu vuông góc lên nhóm đã chọn → chân `q`, khoảng cách **có dấu** `s` (+ = bên trái hướng đường),
  pháp tuyến trái `n`, `endOver` = phần vượt đầu mút tự do.
- **Hàng**: mặc định 1 hàng. GPS nhiễu làm trụ vắt qua tim nên không chia bên theo dấu từng trụ. Chỉ tách 2 hàng
  khi khe lớn nhất giữa các `s` đã sắp xếp ≥ 6 m và mỗi cụm ≥ 2 trụ.
- Mỗi hàng: `S = trung vị s` (hoặc `opts.offsets[g]`). Vị trí mới = `q + S·n`.
- **Cờ** (đều bỏ tick sẵn, chỉ `far`/`end` là không thể tick):

  | Cờ | Điều kiện | Tính trung vị? |
  |---|---|---|
  | `far` | cách tim > 30 m | không |
  | `end` | vượt đầu mút tự do > 1 m (dời sẽ trượt dọc tuyến) | không |
  | `big` | dời > 10 m | có |
  | `cross` | khác dấu với `S` và `|s|` > 2 m (trụ lẻ bên kia đường) | có |
  | `junction` | sau khi dời, khoảng cách tới tim lệch `|S|` > 0,5 m (đường đôi, nút giao, góc gấp) | có |
  | RTK | `row[24] === 'rtk'` — toạ độ cm chính xác hơn OSM | có |

- Lỗi: `no_road` (không đường trong 30 m), `too_few` (< 2 trụ dùng được).

## Kiểm chứng dữ liệu thật
`Quan1` / `BTX_BTX1` (23 dòng, có dòng trùng tên): đường Bùi Thị Xuân, 1 hàng, trung vị 2,43 m phía Tây Bắc.
Sau căn mọi trụ ok cách tim đúng 2,432 m; `BTX_BTX1_3` (+5,8 m bên kia tim) cờ `cross`.
Nhập tay 5,5 m: `BTX_BTX1_11/12` (đoạn Bùi Thị Xuân tách cặp way một chiều) cờ `junction`.

## v159 — Mốc căn: mép đường / tim đường
Bản v158 lấy trung vị khoảng cách có dấu. Với BTX_BTX1, nhiễu GPS làm giá trị này còn 2,4 m, tức **nằm giữa lòng
đường** (Bùi Thị Xuân rộng 10 m). Từ v159, mỗi hàng có 3 điều khiển, bề rộng đường dùng chung cho cả tuyến:

| Điều khiển | Giá trị | Mặc định |
|---|---|---|
| Mốc | `mep` (mép đường) / `tim` (tim đường) | `mep` (hoặc mốc dùng lần trước) |
| Phía | 2 nút nhãn la bàn (`compassPos` / `compassNeg` từ tổng pháp tuyến hàng) | `sidePref` = phía có nhiều trụ hơn |
| Cách (m) | mép: từ mép ra ngoài (âm = vào lòng đường, tối thiểu −½ bề rộng); tim: 0–30 | mép +0,5 (hoặc lần trước); tim: \|trung vị\| |
| Bề rộng mặt đường | `_raRoadWidth` = trung vị theo chiều dài của `_osmRoadWidth` các way (tag width → lanes×3,5 → cấp đường) | OSM, hoặc giá trị đã nhớ cho tên đường đó |

- `_raTargetOffset({ref, side, value, width})` → khoảng cách có dấu `S` tới tim:
  mép: `side·(width/2 + value)`; tim: `side·value`. Lỗi: `width` (≤0 hoặc >60), `inside` (< −½ bề rộng), `value`.
- Mốc mép dùng `crossMin = ½ bề rộng`: trụ vắt qua tim vì GPS (≤ ½ bề rộng) vẫn được kéo về vỉa hè đã chọn; chỉ trụ
  ở hẳn phía kia mặt đường mới bị cờ `cross`. Cờ `cross` được ưu tiên hơn `big`.
- Trụ khác phía, cách tim 2 m..`crossMin` → cờ `straddle` "vắt qua tim" (bỏ tick, tick tay được): có thể GPS lệch,
  cũng có thể là trụ thật bên kia một con đường hẹp. `crossMin` tính theo từng hàng (mỗi hàng chọn mốc riêng).
- `_raFitCfg` kẹp cấu hình nhớ từ đường khác về khoảng hợp lệ của đường này (mép: [−½ rộng, 30 − ½ rộng]; tim: [0, 30]).
  Bề rộng OSM kẹp về (0,5; 60].
- Nhớ cấu hình: localStorage `ra_align_cfg` = `{ref, mepValue, widths: {tên đường: bề rộng}}`, ghi khi bấm Áp dụng.
  Chỉ nhớ bề rộng **người dùng đã sửa** và chỉ cho đường có tên (khoá `way#` đổi mỗi lần tải OSM). Giá trị hỏng → bỏ qua.

Kiểm chứng `Quan1/BTX_BTX1`: mặc định mép +0,5 m phía Tây Bắc; mép +1 m → mọi trụ được tick cách tim đúng 6,000 m,
cùng một phía. Cờ: `BTX_BTX1_3` cross; `_11`/`_12` junction (đoạn tách cặp way một chiều gần Cống Quỳnh).

## v162 — Đường đôi (2 tim 1 chiều song song cùng tên)
Nguyễn Thị Minh Khai (`Quan1/NTMK_NTMK 10`): OSM vẽ 2 way `oneway=yes` 2 làn (7 m) cách nhau ~7,4 m; trụ đặt trên
dải phân cách → mỗi trụ bám tim gần nhất (lúc chiều đi, lúc chiều về) → căn gãy khúc.
- `_raAxis(px, py, n, lines, key)`: từ chân đường q bắn tia theo pháp tuyến; gặp đoạn **cùng tên, song song (≤ 20°)**
  cách 2..40 m → chiều còn lại → **trục giữa** = trung điểm 2 chân đường. Khoảng cách có dấu và vị trí mới tính theo trục.
- Mốc mép (`opts.edge[g] = {side, value}`): mỗi trụ dùng ½ bề rộng CỦA CHÍNH NÓ = ½ khoảng 2 tim + ½ bề rộng 1 chiều
  (OSM, hoặc `opts.width` nếu người dùng sửa). Đoạn 1 tim nối đoạn đường đôi → mép mỗi đoạn theo hình dạng của nó.
- `crossMin` mốc mép = ½ bề rộng cả con đường tại trụ đó. Kết quả `plan.dual = {count, gap}`; panel ghi "🛣 Đường đôi".
- Kiểm chứng NTMK: 18/18 trụ nhận đường đôi; trụ ok lệch khỏi đường thẳng khớp nhất ≤ 0,17 m (mốc tim) / 0,38 m (mốc mép
  — do khoảng 2 tim thay đổi dọc tuyến); 10_10/11/12/18 ở hẳn phía kia trục → cờ, không kéo qua.

## Giới hạn
- Đường đôi có dải phân cách: trụ gần đoạn tách làn được cờ `junction`, phải căn tay.
- Hoàn tác chỉ giữ 1 mức (lần căn gần nhất), mất khi tải lại dữ liệu hoặc đăng xuất.
- `pushMovedMarkersToSheet` đẩy luôn các trụ đã kéo tay trước đó còn chờ cập nhật.
