# Thiết kế — Xuất CAD dùng block thật từ bản vẽ mẫu

> Nguồn: `Bản vẽ bố trí 2026-2029.QBT.dwg` (AutoCAD 2018). Trích các block đèn / trụ / tủ thành thư viện ký hiệu.
> Khi xuất CAD, mỗi trụ/tủ được chèn **đúng block thật** theo thuộc tính (loại marker + loại đèn), tên block giữ
> nguyên như bản vẽ gốc (`HPS - BETON`, `LED - STK`, `Den HPS`, `Tru BTLT`, `TDK_hienhuu`…).
> Trạng thái cải tạo → **layer + màu riêng** (chốt 1).

## Bước 0 — Tiêu chí đạt

| # | Tiêu chí | Đo được |
|---|---|---|
| 1 | Mỗi trụ/tủ xuất ra là INSERT của block đúng tên bản vẽ gốc theo bảng ánh xạ | Đọc DXF: tên block ở INSERT |
| 2 | Định nghĩa block nằm trong DXF xuất (mở độc lập không thiếu block), giữ cấu trúc lồng (combo = Đèn + Trụ) | DXF có BLOCK `HPS - BETON` chứa INSERT `Den HPS` + `Tru BTLT` |
| 3 | Hình học ký hiệu khớp bản gốc (đối chiếu ảnh xem trước + mở AutoCAD) | Ảnh `cad-real-blocks-preview.png` |
| 4 | Trạng thái → layer riêng, màu theo layer; tắt/bật layer trong AutoCAD | LAYER table + INSERT trên layer trạng thái |
| 5 | Tỉ lệ chèn theo bản vẽ gốc (combo 0.8 @1:1000), tự co theo tỉ lệ bản vẽ (1:500 → 0.4, 1:2000 → 1.6) | group 41/42 của INSERT |
| 6 | Xoay theo hướng đường (tuỳ chọn có sẵn "xoay theo đường") áp lên block thật | group 50 |
| 7 | Chú thích (legend) tự động dùng chính block thật + số lượng | Legend có INSERT block thật |
| 8 | DXF vẫn mở được AutoCAD 2021 (R12, không entity mới) | Chỉ LINE/ARC/CIRCLE/SOLID/TEXT/INSERT |
| 9 | Có tuỳ chọn quay về ký hiệu cũ (checkbox trong modal xuất) | Tắt → DXF như trước |

**Ca xấu:** loại đèn trống/lạ → HPS mặc định · marker loại 2 (trang trí) không có thông tin đèn · trụ nhiều bóng (2–4) ·
tên block có dấu cách/gạch (`HPS - BETON`) phải hợp lệ trong DXF · tủ thiếu trạng thái → hiện hữu.

## Thư viện ký hiệu (đã trích — xem `docs/cad-real-blocks-preview.png`)

| Block | Hình | Tỉ lệ chèn gốc | Số lượt trong bản vẽ gốc |
|---|---|---|---|
| `HPS - BETON` | Tru BTLT (tròn đặc) + Den HPS (elip rỗng) | 0.8 | 460 |
| `LED - BETON` | Tru BTLT + Den LED (elip tô nửa) | 0.8 | 245 |
| `HPS - STK` | Tru STK (vuông + tròn) + Den HPS | 0.8 | 206 |
| `LED - STK` | Tru STK + Den LED | 0.8 | 199 |
| `Den MH` | tam giác | 1.0 | 77 |
| `Den trang tri` | lục giác sao | 1.0 | 139 |
| `Tru trang tri` | vuông | 1.0 | 68 |
| `TTC` | tròn đặc + chữ TTC | 1.0 | 61 |
| `Tu dk KNTT` | chữ nhật 6×3 | 1.0 | 62 |
| `Tu dieu khien thuong` | chữ nhật gạch chéo | 1.0 | 61 |
| `TDK_hienhuu` | chữ nhật 4.8×2.7 | 1.49 | 50 |
| `TDK CS` | chữ nhật 4.8×2.7 | 1.30 | 8 |

Combo neo tại **tâm trụ (0,0)**, đầu đèn hướng +X → xoay theo đường bằng group 50.

## Bảng ánh xạ (ĐÃ CHỐT)

Tên block trong DXF chuẩn hoá R12 (không dấu cách, in hoa): `HPS - BETON` → `HPS-BETON`, `Den HPS` → `DEN_HPS`,
`Tru BTLT` → `TRU_BTLT`, `TDK_hienhuu` → `TDK_HIENHUU`, `Tu dk KNTT` → `TU_DK_KNTT`.

| Đối tượng app | Điều kiện | Block DXF |
|---|---|---|
| Loại 1 — Trụ STK | loại đèn chứa `LED` | `LED-STK` |
| | chứa `MH` / metal / halide | `MH-STK` (tổng hợp: TRU_STK + DEN_MH đặt đúng vị trí đèn của combo gốc) |
| | còn lại (HPS / sodium / trống) | `HPS-STK` |
| Loại 3/4 — Trụ HTLT/TTLT (bê tông ly tâm) | `LED` / `MH` / còn lại | `LED-BETON` / `MH-BETON` / `HPS-BETON` |
| Trụ 2–4 bóng (row[21]) | | thêm hậu tố `_X2`.. `_X4`: đầu đèn 0° / 180° / 270° / 90° quanh tâm trụ |
| Loại 2 — Trụ trang trí | | `DEN_TRANG_TRI` |
| Loại 5/6 — Tủ | tên (row[1]) hoặc ghi chú (row[4]) chứa `KNTT` | `TU_DK_KNTT` |
| | còn lại | `TDK_HIENHUU` |

## Layer theo trạng thái (chốt 1) — màu theo layer, block con thừa kế (BYLAYER trên layer 0)

| Layer | Trạng thái (row[29]) | Màu |
|---|---|---|
| `CS_HIEN_HUU` | `''` / `giu` | 7 (trắng/đen) |
| `CS_THU_HOI` | `thu`, `thu_can`, `thu_udc`, `thu_can_udc` | 1 (đỏ) |
| `CS_LAP_MOI` | `moi_*` | 3 (xanh lá) |
| `CS_THAO_LAP` | `thao_lap` | 30 (cam) |

## Kiến trúc

- `tools/extract-cad-blocks.py` (+ `tools/normalize-cad-blocks.py`): đọc DWG bằng aspose-cad → thư viện R12 (chạy lại khi có bản vẽ mẫu mới).
- `src/core/cad-symlib.js`: hằng `CAD_SYMLIB` (JSON đã chuẩn hoá) + hàm thuần trong `@@CADSYMLIB_START/END`:
  - `_csPickBlock(row)` → tên block theo bảng ánh xạ
  - `_csStateLayer(state)` → `{layer, color}`
  - `_csBlockDxf(name)` → mảng group code BLOCK…ENDBLK (đệ quy block con, mỗi block 1 lần)
  - `_csInsertScale(name, drawingScale)` → tỉ lệ chèn
- `cad-export.js`: khi bật "Dùng block chuẩn" → thay `_ensureSymbolBlock` bằng `_csBlockDxf` + INSERT trên layer trạng thái; LAYER table thêm 4 layer; legend dùng block thật.
- UI: 1 checkbox trong modal xuất CAD (mặc định bật).

## Cập nhật thư viện khi có bản vẽ mẫu mới
```bash
pip install --break-system-packages aspose-cad          # đọc DWG 2018 (bản dùng thử đọc được block)
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1           # .NET không cần ICU
# .NET đi kèm aspose cần OpenSSL 1.1: apt-get download libssl1.1 (nguồn focal) → dpkg-deb -x → LD_LIBRARY_PATH
python3 -I tools/cad-blocks/extract-cad-blocks.py mau.dwg symlib.json
python3 -I tools/cad-blocks/normalize-cad-blocks.py symlib.json symlib_norm.json
python3 -I tools/cad-blocks/build-cad-symlib.py symlib_norm.json    # ghi vào src/core/cad-symlib.js
node tests/cad-symlib.test.js && node tests/cad-real-blocks.test.mjs
```
Lưu ý trích: xuất DWG→DXF bằng aspose ra R12 sẽ PHÁ RÃ block (mất BLOCKS) → phải đọc block trực tiếp từ CadImage.
HATCH tô đặc → tam giác SOLID (ear clipping); hatch mẫu → nét LINE cắt theo biên; ELLIPSE → đoạn thẳng; MTEXT → TEXT.

## Rủi ro
- Tủ TTC / Tu dieu khien thuong / TDK CS có trong thư viện nhưng chưa ánh xạ (dùng khi cần mở rộng).
- Hatch mẫu ANGLE trong `Den LED` không ra nét (khoảng mẫu 6.985 > kích thước đầu đèn) — đúng như AutoCAD.
- `SPOT LIGHT LED`, `DEN NGAM` vẽ ở đơn vị khác (tỉ lệ 0.0001) — chưa đưa vào ánh xạ.
