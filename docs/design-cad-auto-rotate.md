# Thiết kế — Tự xoay bản vẽ cho vừa khung + địa chỉ tủ (v203)

## Chốt 1 (anh duyệt 31/10/2026)
- Modal Xuất bản vẽ CAD có ô **"↻ Tự xoay cho vừa khung"**, **mặc định tắt** (nhớ lựa chọn trong `localStorage cg_auto_rotate`).
- Bật → xoay **toàn bộ nội dung** (trụ, tủ, cáp, nhãn, nền OSM, nền CAD) quanh tâm tuyến; khung tên, tiêu đề, bảng ký hiệu giữ nằm ngang;
  mũi tên Bắc xoay theo để vẫn chỉ đúng Bắc thật. Toạ độ DXF khi đó không còn là VN-2000 thật (như bản vẽ QBT gốc).
- Dòng dưới cùng ô "BẢN VẼ" (mẫu QBT) = địa chỉ tủ: `<SỐ NHÀ> <TÊN ĐƯỜNG>, <PHƯỜNG>` (viết hoa).
- Thêm cột sheet **[30] Số nhà** — ô nhập chỉ hiện khi marker là tủ (loại 5/6), cùng hàng Đường / Phường.

## Chọn góc — `_rotBestAngle` (src/core/cad-rotate.js, `@@CADROTATE`)
1. Góc "nằm ngang": thử −89…90° bước 1°, lấy góc làm bề dọc khung bao nhỏ nhất (hoà → góc gần 0).
   Không chọn góc đặt tuyến theo đường chéo tờ giấy.
2. Gần ±90° (≤ 5°) và ±90° kém không quá 3% → dùng ±90° cho tròn.
3. Chỉ xoay khi khung nhỏ đi ≥ 10% so với không xoay; ngược lại giữ 0° (file y hệt khi tắt).
- Thước đo: mẫu QBT = hệ số khung `kk` của `_qbtFitFrame`; mẫu khác = khổ A3 ngang cần (`_rotScoreA3`, cộng phần khung tên).

## Áp phép xoay
| Thành phần | Cách |
|---|---|
| Trụ/tủ, cáp, nhãn | `[x, y] = _rot.xf(x_thật, y_thật)` tại vòng lặp marker |
| Góc block | góc cũ + θ (block thật: `_csRealRot(...)` hoặc θ) |
| Nhãn tên trụ | vị trí xoay, chữ luôn đứng thẳng |
| Tìm đường (xoay theo đường) | dùng toạ độ THẬT, góc đường + θ |
| Nền OSM | `roadOpts.xform` trong `_drawOsmBasemapInDxf` (trước khi cắt khung); tên đường tính góc theo đường đã xoay |
| Nền CAD | tham số thứ 7 `xform` của `_drawCadBaseInDxf` |
| Mũi tên Bắc | xoay θ quanh chân mũi tên |
| Khung tên / tiêu đề / bảng ký hiệu | không xoay |

## Căn giữa trong vùng trống
`_qbtFitFrame(b, pts, k, MI, { center: true })` — chỉ bật khi có xoay (giữ bố cục bản không xoay đã duyệt):
khung cao dư (do giữ tỉ lệ 384,65 : 281,84) chia đôi trên/dưới thay vì dồn hết xuống đáy. Phía dưới bị chặn bởi
đỉnh khung tên, và với trụ nằm trên cột bảng ký hiệu thì bởi đỉnh bảng ký hiệu.

## Địa chỉ tủ — `_qbtCabinetAddress(row)`
Số nhà `row[30]` + Đường `row[17]` + Phường `row[18]`, viết hoa. Luôn ghép đủ số nhà, không bỏ khi tên đường bắt đầu bằng số (khử trùng sẽ làm mất số nhà ở đường "3 Tháng 2", "19 Tháng 5").
Ưu tiên địa chỉ gõ tay trong form; trống → tìm hàng tủ (loại 5/6, tên = tên tủ); không có → đường xuất hiện nhiều nhất.

## Kết quả mẫu
Tuyến dọc 470 m, 15 ký hiệu: khung 1.006 m → 534 m (in A3 to gấp ~1,9 lần).

## Đã biết / chưa làm
- Bản vẽ chia nhiều tờ: bỏ qua tự xoay để các tờ ghép khớp theo toạ độ thật.
- Đồng bộ: hàng chưa có cột 30 (cache / CSV cũ) không gửi `soNha` → không xoá Số nhà trên sheet.
- Tắt xoay: DXF giống từng byte v202 (đã so 32 cấu hình: 4 mẫu × block thật/cũ × tự co/A3 chuẩn × tuyến dọc/ngang).
- Bật xoay khi chế độ "A3 chuẩn": khung cố định, phần căn giữa chưa áp dụng.
- Xoay có hiệu lực cho mặt bằng; sơ đồ nguyên lý / bình đồ tổng thể không xoay.
- Cần **redeploy GAS (New version)** để sheet có cột "Số nhà".
