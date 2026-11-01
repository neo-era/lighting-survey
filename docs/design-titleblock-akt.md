# Thiết kế — Khung tên mẫu A.K.T (Thay LED CT1)

Nguồn: `Thay_Led_CT1_khung_ten_danh_muc__da_sua_ten_CT-dia_diem.dxf` — 25 tờ cùng form; đo trên tờ
"BẢN VẼ MẶT BẰNG ĐƯỜNG NGUYỄN KHUYẾN" (khung giấy tại 19329,11; 3306,19).
Đơn vị: mm giấy = m bản vẽ @1:1000; mọi kích thước × k (k = hệ số khung). Gốc = góc dưới-trái khung trong.

## Chốt 1 (anh duyệt 01/11/2026)
- Thêm mẫu thứ 2 cạnh mẫu QBT: id `akt`, nhãn "🏢 A.K.T – Thay LED". Mẫu QBT giữ nguyên (DXF giống từng byte).
- Ô GHI CHÚ kiểu A.K.T **có thêm cột số lượng**; chỉ liệt kê ký hiệu có trong tờ.
- Mọi ô sửa được trong form (nhớ bản nháp); tự điền Tỷ lệ, Tên bản vẽ, Năm, Ký hiệu/Tổng số bản vẽ khi chia tờ.
- Dùng chung khung tự co giãn / A3 chuẩn / tự xoay của mẫu QBT.

## Khổ giấy
A3 420 × 297. Khung trong 397,93 × 281,36; lề trái 16,61 · phải 5,46 · trên 6,93 · dưới 8,71.
Tiêu đề đầu tờ "BẢN VẼ MẶT BẰNG BỐ TRÍ ĐÈN CHIẾU SÁNG" cao 4,5, tâm x 198,29, đỉnh chữ cách đỉnh khung trong 3,66.

## Khung tên đáy — cao 41,83, hết bề rộng
| Đường | Toạ độ |
|---|---|
| Ranh cột suốt chiều cao | x = 82,18 · 143,69 · 176,9 · 203,5 · 231,41 · 255,84 |
| Ô Đơn vị TK: ngăn tiêu đề | y = 34,69 (x 82,18 → 143,69) |
| Bảng ký (x 176,9 → 255,84) | y = 30,83 · 20,55 · 10,28 |
| Phần phải: ngăn Tên bản vẽ | y = 27 (x 255,84 → 397,93) |
| Phần phải dưới | x = 288,81 · 371,29 (y 0 → 27); ô ký hiệu y = 9 · 18 (x 371,29 → 397,93) |

| Ô | Nội dung (mặc định tờ mẫu) | Chữ | Vị trí |
|---|---|---|---|
| Công trình | "CÔNG TRÌNH :" + (trống 1 dòng) + tên công trình | 2,0, giãn 3,33 | tâm 41,09; đỉnh 38,84; rộng 80 |
| Đơn vị TK | "ĐƠN VỊ THIẾT KẾ" | 2,6 | giữa (110,82; 37,91) |
| | logo vuông "AK" + "A.K.T design" | 1,264 ×0,8 | ô 83,5–94,88 × 20,76–32,13 |
| | "CÔNG TY TNHH TƯ VẤN XÂY DỰNG" | 2,488 ×0,75 | tâm 119,75; chân 28,55 |
| | logo chữ "A.K.T" (khối akt-Logo AKT ×0,01228) | — | góc (101,64; 20,76) |
| | Trụ sở / ĐT / Email (4 dòng) | 2,132 ×0,8 | giữa (112,64; 8,67) |
| Phó GĐ | "PHÓ GIÁM ĐỐC" / tên ở đáy | 2,0 | tâm 160,3; đỉnh 38,17 / 5,61 |
| Bảng ký | CHỨC DANH · HỌ VÀ TÊN · CHỮ KÝ; Chủ trì TK · Thiết kế · Kiểm | 2,0 | chức danh tâm 190,2; tên trái 204,3 |
| Tên bản vẽ | nhãn gạch chân "Tên bản vẽ:" + nội dung (3 dòng) | 2,5 ×0,8 / 2,0 | nhãn trái 261,83 đỉnh 40,04; nội dung tâm 328,15 |
| Giai đoạn | "Giai đoạn thực hiện :" / Báo cáo / Kinh Tế - Kỹ Thuật / … / "Tỷ lệ : 1/…" | 2,0 | tâm 272,61; đỉnh 23,29 |
| Địa điểm | "ĐỊA ĐIỂM XÂY DỰNG :" + (trống) + nội dung | 2,0 | tâm 330,93; đỉnh 25,39; rộng 78 |
| Ký hiệu | "Ký hiệu bản vẽ :" / giá trị · "Tổng số bản vẽ : nn" · "Năm thực hiện : yyyy" | 2,0 | tâm 381,46 / 383,11 / 384,69 |

## Ô GHI CHÚ (+ cột số lượng)
Sát phải, đáy chạm đỉnh khung tên. Rộng 55,61 + cột số lượng 14 = 69,61.
"GHI CHÚ:" gạch chân cao 2,5 ×0,8, cách trái 2,01, đỉnh cách đỉnh ô 1,39. Dòng đầu: đỉnh chữ cách đỉnh ô 7,84; mỗi dòng 10,18;
cao ô = 7,84 + (n−1)·10,18 + 7,88. Ký hiệu tâm x +11,7; chữ ": <tên>" căn giữa tâm +33,68 rộng 37,4 (≤ 2 dòng);
số lượng tâm cột +62,61. Dòng lấy từ `_qbtLegendRows` (bỏ dòng số lượng "–").

## Tỷ lệ ghi trên khung tên
A3 chuẩn: 1/(tỉ lệ xuất). Tự co giãn: khung phóng theo kk → in vừa A3 tỷ lệ thật là 1/(kk·1000) — ghi đúng số đó
(làm tròn đơn vị). Người dùng gõ tay thì giữ nguyên.

## Sơ đồ nguyên lý / bình đồ / xuất hàng loạt
- Sơ đồ nguyên lý, bình đồ: ô Tên bản vẽ trống → tên loại bản vẽ (+ tủ); tiêu đề đầu tờ = tên loại bản vẽ.
- Xuất hàng loạt theo tủ: Tên bản vẽ tự điền từng tủ; Ký hiệu "XX" = số thứ tự tủ, Tổng số = số tủ.
- Tờ không có ký hiệu đếm được → không vẽ ô GHI CHÚ.

## Kiến trúc
- `src/core/cad-titleblock-akt.js` (`@@AKTTITLE`): `AKT_FORM`, `AKT_LOGO_PRIMS`, `AKT_AK_PRIMS`, `AKT_DEFAULTS`,
  `_aktDrawTitleBlock`, `_aktDrawHeader`, `_aktLegendItems`, `_aktLegendSize`, `_aktDrawLegend`.
- `_qbtPrims` thêm prim `S` (SOLID tam giác); `_qbtDrawSym` tách từ bảng QBT để dùng chung.
- `_qbtFitFrame` / `_qbtLegendClear` nhận thêm `form` ({W, innerH, H, headerH, legendSize}) — mặc định QBT.
- `cad-export.js`: `_cgSheetForm(templateId, rows, real)` → mô tả mẫu khổ giấy cố định (QBT | A.K.T); mọi chỗ trước kia
  kiểm `type === 'knop12'` dùng mô tả này.
