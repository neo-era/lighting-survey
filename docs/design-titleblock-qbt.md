# Thiết kế — Khung tên mẫu QBT 2026–2029 (thay mẫu KNỞ P12)

Nguồn: `Bản vẽ bố trí 2026-2029.QBT.dwg` — đo trên tờ thật (tủ BẠCH ĐẰNG-2-BT-15, 64 tờ cùng form).
Đơn vị: mm giấy = m bản vẽ @1:1000. Mọi kích thước × `k = tỉ lệ/1000`.
Gốc toạ độ = góc dưới-trái khung trong (inner frame). Khung trong mẫu 384,65 × 281,84.

## Chốt 1 (anh duyệt 31/10/2026)
- Thay renderer mẫu `knop12` bằng form QBT (giữ id `knop12` → bản nháp form cũ vẫn dùng được).
- Bảng ký hiệu 13 dòng đúng thứ tự mẫu; cột "Áp dụng" chèn block thật; **thêm cột Số lượng** (theo dữ liệu tờ đó).
- HTLT/TTLT = trụ bê tông (BETON); trụ trang trí chỉ chèn DEN_TRANG_TRI (anh xác nhận).

## Khung tên đáy — cao 52,9; rộng = khung trong (cột co giãn theo tỉ lệ `sx = W / 384,65`)
| Đường | Toạ độ |
|---|---|
| Ngăn tầng trên/dưới | y = 31,11 (hết bề rộng) |
| Ranh cột suốt chiều cao | x = 75,83 · 227,5 · 349,85 |
| Ranh cột chỉ tầng dưới | x = 151,13 |
| Ô SHBV chia thêm | y = 41,71 · 16,97 (x 349,85 → phải) |

| Ô | Nội dung | Chữ (cao) | Vị trí |
|---|---|---|---|
| 0–75,83 trên | TT QUẢN LÝ HẠ TẦNG / KỸ THUẬT TP.HCM | 4,24, 2 dòng giãn 7,07 | giữa ô, chân dòng 43,62 / 36,55 |
| 75,83–227,5 trên | logo CS (vòng tròn r 9,16 tâm 89,14;42,04) + CÔNG TY CỔ PHẦN / CHIẾU SÁNG CÔNG CỘNG TP.HCM | 4,24 | tâm chữ x 159,49 |
| 227,5–349,85 trên | BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ | 4,25 (3,54×1,2) | tâm x 285,26, chân 39,87 |
| dưới (3 ô) | CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN · CHIẾU SÁNG KHU VỰC TRUNG TÂM · NGƯỜI LẬP; tên người ký | 2,83 | nhãn chân 25,39; tên chân 2,0; giữa ô |
| 227,5–349,85 dưới | BẢN VẼ / <tên tủ> / <tên đường> | 3,54 / 3,54 / 2,83 | chân 25,06 / 18,86 / 6,49 |
| SHBV | SHBV: · Số soát xét: · Bản vẽ số: · Ngày: (+ giá trị) | 2,83 | x 351,0; chân 45,43 / 35,19 / 21,9 / 7,31 |

Tiêu đề đầu tờ: dòng 1 cao 4,25 (chân = đỉnh khung trong − 10,87); dòng 2 "TỦ ĐIỀU KHIỂN - <tên tủ>" cao 3,54
(chân = đỉnh − 21,9); giữa khung trong; không kẻ ngang.

## Bảng ký hiệu — sát phải, đáy chạm đỉnh khung tên
Mỗi nhóm: STT 8,78 | Tên ký hiệu 33,14 | Áp dụng 25,92 | **Số lượng 16** (mới) → 83,84; 2 nhóm 167,68.
Hàng tiêu đề cao 10,51; hàng dữ liệu 9,0. Nhóm trái 7 dòng (1–7), nhóm phải 6 dòng (8–13) + ô trống đáy.
Chữ: tiêu đề 2,5; STT 2,5; tên 2,0 (lề trái 3,46); số lượng 2,0.

| # | Tên | Ký hiệu (block thật) | Số lượng |
|---|---|---|---|
| 1–3 | Đèn LED / HPS / MH | DEN_LED / DEN_HPS / DEN_MH | tổng bóng (row[21]) trụ loại 1/3/4 theo loại đèn — "bộ" |
| 4 | Đèn trang trí | DEN_TRANG_TRI | tổng bóng trụ loại 2 — "bộ" |
| 5 | Trụ STK | TRU_STK | số trụ loại 1 |
| 6 | Trụ BTLT | TRU_BTLT | số trụ loại 3+4 |
| 7 | Trụ treo cáp - TTC | TTC | – (chưa có dữ liệu) |
| 8 | Trụ trang trí | TRU_TRANG_TRI | số trụ loại 2 |
| 9 | Điểm dừng lưới | chữ T (trích block `Diem dung luoi`) | – |
| 10 | Tủ điều khiển KNTT | TU_DK_KNTT | số tủ KNTT |
| 11 | Tủ điều khiển thường | TDK_HIENHUU (đúng block vẽ trên bản đồ) | số tủ còn lại |
| 12 / 13 | Cáp nguồn nổi / ngầm | nét cáp nổi / ngầm | tổng mét `noi*` / `ngam*` |
Tắt "block chuẩn" → cột Áp dụng dùng ký hiệu cũ cho trụ/tủ/cáp; dòng đèn để trống.

## Bố trí trong bản vẽ mặt bằng
- Chừa đáy 52,9k cho khung tên, đỉnh 25k cho tiêu đề; bề rộng tối thiểu = 384,65k − 30.
- **Khung tự co giãn** (mặc định): khung trong luôn đúng tỉ lệ 384,65 : 281,84; mọi kích thước khung tên/chữ/bảng nhân
  `kk = bề rộng khung trong / 384,65` (≥ tỉ lệ/1000) → in vừa A3 là ra đúng mẫu (`_qbtFitFrame`). Trụ/tủ vướng góc bảng
  (lề né 12·kk ngang, 8·kk dọc — tính cả nhãn tên) → khung cao thêm.
- **A3 chuẩn**: khung trong đúng 384,65·k × 281,84·k, viền ngoài = mép giấy 420 × 297 với lề bản gốc (trái 28,28 · phải 7,07 ·
  trên 8,05 · dưới 7,08). Góc phải vướng → dời bảng sang góc TRÁI; cả 2 vướng → hạ đáy (giữ đáy, phần thừa tràn lên — có cảnh báo chia tờ).
- Chia tờ tự động với mẫu này: vùng vẽ mỗi tờ = (384,65 − 50) × (281,84 − 30 − 25 − 52,9) × k.
- "Bản vẽ số": có `XX` → thay số tờ; chia nhiều tờ mà không có `XX` → thêm "(tờ i/n)".
- Có ô con dấu: tiêu đề đầu tờ đặt trên ô con dấu.
- Bảng "BẢNG KÝ HIỆU" cũ ngoài khung bỏ với mẫu này (đã thay bằng bảng 13 dòng).

## Kiến trúc
`src/core/cad-titleblock-qbt.js` (classic script, hàm thuần trong `@@QBTTITLE_START/END`):
`QBT_FORM`, `QBT_LOGO_PRIMS`, `_qbtTextW`, `_qbtFit`, `_qbtDrawTitleBlock`, `_qbtDrawHeader`,
`_qbtLegendRows`, `_qbtLegendSize`, `_qbtDrawLegendTable`.
`cad-export.js`: `_drawTitleBlockKnop12` / `_drawKnop12TitleStrip` gọi sang hàm mới; bản vẽ mặt bằng thêm bảng ký hiệu.

## v204 — sửa theo góp ý
- Tên TT QLGT và tên Công ty **luôn cùng cỡ chữ** (mẫu 4,24). Tên dài ngắt **cân dòng**, tối đa 3 dòng (giãn 6,6):
  "TT QUẢN LÝ GIAO / THÔNG VÀ HẠ TẦNG / KỸ THUẬT TP.HCM". Giữ xuống dòng người dùng gõ; đoạn quá rộng thì ngắt cân trong đoạn.
  Chỉ khi 3 dòng vẫn không vừa mới thu nhỏ — và bên kia thu theo (`_qbtFitOrg`).
- Logo: thêm vòng chữ trên **"CÔNG TY CỔ PHẦN CHIẾU SÁNG"** (`_qbtArcTextTop`, cỡ 1,238 như vòng dưới, chân chữ r 7,2,
  từ 201° → −10°, không chạm 2 ngôi sao 211,7° / −31,7°). Bản vẽ gốc dùng ARCTEXT (proxy) nên không trích được — dựng lại bằng TEXT từng ký tự.

## Đã biết / chưa làm
- Đường cáp + nhãn mét, nền OSM vẫn có thể đi xuyên qua bảng ký hiệu (bản gốc cũng vậy) — chỉ né ký hiệu trụ/tủ.
- Tắt "block chuẩn": ký hiệu cũ trong cột Áp dụng không co theo kk.
- Bình đồ tổng thể: ô GHI CHÚ vẫn đặt sát đáy khung (chồng khung tên — có từ trước).
- Thước tỉ lệ + bảng "CHÚ THÍCH" ngoài khung: BỎ với mẫu QBT (v202) — bản vẽ chỉ còn phần trong khung.
