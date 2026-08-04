# KẾ HOẠCH TRIỂN KHAI HỒ SƠ ĐĂNG KÝ QUYỀN TÁC GIẢ

**Phần mềm**: Lighting Survey System v1.0
**Tác giả**: Mai Vũ Lâm (cá nhân)
**Chủ sở hữu**: Công ty TNHH Kỹ Nghệ Lâm Việt Phát (Lavipco)

---

## 📅 TỔNG QUAN THỜI GIAN

```
Tuần 1 (7 ngày)      → Chuẩn bị giấy tờ + soạn hợp đồng
Tuần 2 (7 ngày)      → Ký công chứng + đóng quyển mã nguồn
Tuần 3 (1 ngày)      → Nộp hồ sơ tại Cục Bản quyền
Tuần 4-8 (25-30 ngày)→ Cục thẩm định
Tuần 8-9 (5-7 ngày)  → Nhận Giấy chứng nhận

TỔNG: 40-50 ngày làm việc
CHI PHÍ: ~2.500.000 - 4.000.000 VNĐ
```

---

## 🎯 CHECKLIST 4 GIAI ĐOẠN

### GIAI ĐOẠN 1 — CHUẨN BỊ (Tuần 1)

#### ☐ Ngày 1-2: Thu thập giấy tờ pháp lý

**Của Mai Vũ Lâm:**
- [ ] Chụp/scan CCCD 2 mặt (định dạng PDF, đen trắng, ≥300dpi)
- [ ] Đến UBND xã/phường công chứng bản sao CCCD — phí ~10.000đ/bản
- [ ] Chuẩn bị 3 bản công chứng (dự phòng)

**Của Lavipco (nhờ kế toán/nhân sự lấy):**
- [ ] Bản sao Giấy chứng nhận Đăng ký kinh doanh — công chứng ≤ 6 tháng
- [ ] CCCD Bà Nguyễn Kim Thúy Quỳnh — công chứng
- [ ] Con dấu công ty (chuẩn bị sẵn để đóng lên tờ khai)
- [ ] Điều lệ công ty (nếu công chứng viên yêu cầu chứng minh thẩm quyền GĐ)

#### ☐ Ngày 3-4: Soạn Hợp đồng chuyển giao

**File template**: xem [PL6 trong HO-SO-SO-HUU-TRI-TUE.md](HO-SO-SO-HUU-TRI-TUE.md#pl6-mẫu-hợp-đồng-chuyển-giao-quyền-tác-giả)

**Cần quyết định trước khi soạn:**

1. **Giá chuyển giao** (Điều 4):
   - Nếu Mai Vũ Lâm là **cổ đông/nhân viên Lavipco** → có thể ghi giá **tượng trưng** (VD: 1.000.000đ) hoặc "0đ — chuyển giao theo Nghị quyết HĐTV/Quyết định giao nhiệm vụ"
   - Nếu **KHÔNG có quan hệ lao động** → nên ghi giá thị trường (khuyến nghị **50-150 triệu VNĐ** cho phần mềm quản lý B2B như thế này)
   - Giá càng cao → thuế TNCN càng cao (10% trên phần vượt 10 triệu)

2. **Phương thức thanh toán** (Điều 4.2):
   - Nếu có quan hệ lao động → tick "Trả thù lao/lương"
   - Nếu là hợp đồng độc lập → tick "Chuyển khoản 1 lần" hoặc "Theo tiến độ"

3. **Số hợp đồng**: Đặt số ví dụ `01/2026/HĐCG-LAVIPCO`

**Thao tác**:
```bash
# Copy PL6 ra file riêng
copy HO-SO-SO-HUU-TRI-TUE.md HOP-DONG-CHUYEN-GIAO.docx
# Mở Word → sửa lại phần trong ...
# In 4 bản để công chứng
```

#### ☐ Ngày 5-6: Soạn Tờ khai đăng ký (Mẫu 01)

**Tải mẫu**: https://cov.gov.vn/mau-to-khai → "Mẫu số 01 - Tờ khai đăng ký quyền tác giả"

**Điền chính xác các mục:**

```
KÍNH GỬI: Cục Bản quyền tác giả

1. Người nộp hồ sơ:
   ☑ Chủ sở hữu quyền tác giả
   Tên: Công ty TNHH Kỹ Nghệ Lâm Việt Phát (Lavipco)
   Địa chỉ: 63/23A, Liên Khu 16-18, P. Bình Trị Đông, Q. Bình Tân, TP.HCM
   Người đại diện: Nguyễn Kim Thúy Quỳnh — Giám đốc
   MST: [điền]
   Điện thoại: [điền]

2. Tác phẩm đăng ký:
   Tên tác phẩm:  HỆ THỐNG KHẢO SÁT CHIẾU SÁNG CÔNG CỘNG
                  (LIGHTING SURVEY SYSTEM v1.0)
   Loại hình:     Chương trình máy tính
   Ngôn ngữ:      JavaScript, HTML5, CSS3, Google Apps Script
   Thời gian sáng tạo: 2024 - 2026
   Ngày công bố:  [điền — thường lấy ngày commit đầu tiên trên GitHub]
   Nơi công bố:   Việt Nam
   Hình thức công bố: Web application

3. Tác giả:
   Họ tên:        MAI VŨ LÂM
   Ngày sinh:     [điền]
   Quốc tịch:     Việt Nam
   CCCD số:       [điền]
   Địa chỉ:       [điền]

4. Chủ sở hữu:
   ☑ Công ty TNHH Kỹ Nghệ Lâm Việt Phát
   Cơ sở phát sinh quyền: Hợp đồng chuyển giao quyền tác giả
                          số 01/2026/HĐCG-LAVIPCO ngày ___/___/2026

5. Tình trạng đã đăng ký: Chưa từng đăng ký

6. Cam đoan: [chọn theo mẫu]

Ngày ___/___/2026

Người nộp hồ sơ                        Xác nhận tác giả
(Chủ sở hữu ký + đóng dấu)             (Tác giả ký tay)


NGUYỄN KIM THÚY QUỲNH                  MAI VŨ LÂM
(Giám đốc Lavipco)
```

**Lưu ý**: Tờ khai 1 mặt A4, không được scan-in — phải điền tay hoặc đánh máy rồi in ra ký sống.

#### ☐ Ngày 7: Chuẩn bị mã nguồn

**Bước 1** — Tạo tag Git:
```bash
cd c:\Users\maivu\Documents\GitHub\lighting-survey
git tag v1.0-copyright-registration
git push --tags
```

**Bước 2** — Xóa secrets:
```bash
# Tạo bản CLEAN để nộp
mkdir ..\lighting-survey-clean
cd ..\lighting-survey-clean
git clone c:\Users\maivu\Documents\GitHub\lighting-survey .
git checkout v1.0-copyright-registration
```

Trong bản clean, thay các chuỗi sau bằng `<REDACTED>`:
- `GITHUB_TOKEN` trong Script Properties references
- `PASSWORD_PEPPER` (nếu có)
- URL webhook cụ thể (`KHAOSAT_GAS_URL`, `KHAOSAT_CSV_URL`)
- Folder ID Drive: `1i32dWpWSSoW61MIUD1qDJZne2FBiofOr`
- Spreadsheet ID: `1u1KIDPX5INt-9bI6EDK-K6VKSCJAoey7drElKW3rLS0`

**Bước 3** — Đóng gói:
```bash
# ZIP toàn bộ
7z a lighting-survey-v1.0-source.zip . -x!.git -x!node_modules -x!screenshots

# Tính SHA-256
certutil -hashfile lighting-survey-v1.0-source.zip SHA256 > CHECKSUM.txt

# Đếm dòng code
Get-ChildItem -Recurse -Include *.html,*.js,*.md,*.json -Exclude node_modules | Measure-Object -Line
```

**Bước 4** — In hoặc ghi USB:

**Phương án A — In giấy (khuyến nghị cho hồ sơ đẹp):**
- In 2 bản `index.html` + `gas-khaosat.js` (~13.500 dòng)
- Ước lượng: 250-300 trang A4/bản → 500-600 trang tổng
- Đóng quyển bìa cứng, gáy nâu, ghi tên phần mềm
- Chi phí in + đóng: ~800.000đ/bản × 2 = ~1.600.000đ

**Phương án B — USB (rẻ hơn, khuyến nghị):**
- Mua 2 USB kim loại 32GB (~150.000đ/cái)
- Copy: `lighting-survey-v1.0-source.zip` + `CHECKSUM.txt` + `MANIFEST.txt`
- Kèm 20-30 trang in giấy chứng minh: bìa + mục lục + 10 trang đầu code + 10 trang cuối code
- Chi phí: ~500.000đ tổng cộng

---

### GIAI ĐOẠN 2 — CÔNG CHỨNG (Tuần 2)

#### ☐ Ngày 8-9: Ký Hợp đồng chuyển giao

**Thao tác:**
1. In **4 bản** Hợp đồng chuyển giao đã soạn ở giai đoạn 1
2. Cả 2 bên (Mai Vũ Lâm + Bà Nguyễn Kim Thúy Quỳnh) ký sống lên **tất cả 4 bản**
3. Lavipco đóng dấu công ty lên chữ ký của bà Quỳnh

**Chưa được sử dụng — cần công chứng trước!**

#### ☐ Ngày 10-11: Công chứng tại Văn phòng công chứng

**Địa chỉ VP công chứng gần Lavipco (Q. Bình Tân):**

| Tên | Địa chỉ | Điện thoại | Phí ước tính |
|---|---|---|---|
| VP Công chứng Bình Tân | 435 Kinh Dương Vương, P. An Lạc, Q. Bình Tân | 028.3752.9639 | 300k-500k |
| VP Công chứng Ánh Sáng | 179 Tân Kỳ Tân Quý, Q. Tân Phú | 028.3810.6161 | 300k-500k |
| VP Công chứng Đông Sài Gòn | 88 Phú Định, P. 16, Q. 8 | 028.3859.4568 | 300k-500k |

**Cần mang theo:**
- 4 bản Hợp đồng chuyển giao đã ký sống
- CCCD gốc của Mai Vũ Lâm
- CCCD gốc của Bà Nguyễn Kim Thúy Quỳnh
- Giấy CN ĐKKD gốc của Lavipco
- Con dấu công ty
- Tiền phí công chứng (~300k-500k)

**Kết quả**: 4 bản hợp đồng có dấu công chứng
- Mai Vũ Lâm giữ 1 bản
- Lavipco giữ 2 bản
- VP công chứng lưu 1 bản
- Trong 2 bản Lavipco → **1 bản nộp Cục Bản quyền**

#### ☐ Ngày 12-13: Nộp lệ phí

**Cách 1 — Chuyển khoản (khuyến nghị):**
```
Số tài khoản:  [tra cứu tại https://cov.gov.vn]
Ngân hàng:     [thường là Kho bạc Nhà nước]
Số tiền:       1.100.000 VNĐ
Nội dung:      "Le phi dang ky QTG phan mem Lighting Survey - Lavipco - Mai Vu Lam"
```

**Cách 2 — Nộp tiền mặt tại Cục:**
- Đến quầy Kế toán, Cục Bản quyền chi nhánh TP.HCM (170 Nguyễn Đình Chiểu, Q.3)
- Nhận biên lai đóng dấu đỏ

**Cách 3 — Nộp online qua Cổng Dịch vụ công:**
- Truy cập https://dichvucong.bvhttdl.gov.vn/
- Đăng ký tài khoản Lavipco → chọn "Đăng ký quyền tác giả" → thanh toán trực tuyến qua VNPay/thẻ ATM

#### ☐ Ngày 14: Đóng gói hồ sơ cuối cùng

**Sắp xếp bìa cứng theo thứ tự:**

```
┌──────────────────────────────────────┐
│ HỒ SƠ ĐĂNG KÝ QUYỀN TÁC GIẢ           │
│ Phần mềm: LIGHTING SURVEY v1.0        │
│ Tác giả:  Mai Vũ Lâm                 │
│ Chủ SH:   Lavipco                    │
├──────────────────────────────────────┤
│ 01. Tờ khai đăng ký (Mẫu 01) — 1 bản │
│ 02. Hợp đồng chuyển giao (công chứng)│
│     — 1 bản gốc                       │
│ 03. CCCD Mai Vũ Lâm (công chứng)      │
│ 04. CCCD Bà Nguyễn Kim Thúy Quỳnh     │
│     (công chứng)                      │
│ 05. GCN ĐKKD Lavipco (công chứng)     │
│ 06. Biên lai lệ phí 1.100.000đ        │
│ 07. Tài liệu mô tả phần mềm — 2 bản   │
│     (HO-SO-SO-HUU-TRI-TUE.md in PDF)  │
│ 08. Mã nguồn — 2 bản                  │
│     (USB × 2 hoặc quyển in × 2)       │
│ 09. Screenshot 10 màn hình chính      │
│     (in màu, khổ A4)                  │
└──────────────────────────────────────┘
```

---

### GIAI ĐOẠN 3 — NỘP HỒ SƠ (1 ngày)

#### ☐ Ngày 15: Nộp trực tiếp

**Chi nhánh TP.HCM (khuyến nghị vì Lavipco ở HCM):**

```
📍 CỤC BẢN QUYỀN TÁC GIẢ — CHI NHÁNH TP.HCM
   170 Nguyễn Đình Chiểu, Phường 6, Quận 3, TP.HCM
   ☎  028.3930.3378
   📧 phianam.cov@bvhttdl.gov.vn

Giờ làm việc: Thứ 2 - Thứ 6, 8:00-11:30, 13:30-16:30
```

**Ai đi nộp?**
- Ưu tiên: **Bà Nguyễn Kim Thúy Quỳnh** đi nộp (chủ sở hữu)
- Hoặc: Mai Vũ Lâm đi thay với **Giấy ủy quyền công chứng**

**Tại quầy:**
1. Xuất trình CCCD gốc
2. Đưa toàn bộ hồ sơ cho cán bộ tiếp nhận
3. Cán bộ kiểm tra sơ bộ:
   - Thiếu tài liệu → yêu cầu bổ sung ngay
   - Đủ → cấp **Biên nhận** có Số hồ sơ (ghi vào sổ theo dõi)
4. **Chụp lại biên nhận** — số hồ sơ này dùng để tra cứu tiến độ

**Thay vì đi trực tiếp — Nộp online:**

```
https://dichvucong.bvhttdl.gov.vn/

Bước 1: Đăng ký tài khoản DVCTT của Lavipco (dùng MST)
Bước 2: Chọn "Cấp Giấy chứng nhận đăng ký quyền tác giả"
Bước 3: Điền form online (giống Mẫu 01)
Bước 4: Upload PDF các tài liệu (scan chất lượng cao ≥300dpi)
Bước 5: Thanh toán trực tuyến (VNPay/thẻ ATM)
Bước 6: Nhận mã hồ sơ qua email

Thời gian: 1-2 giờ điền form + upload
Ưu điểm: không phải đi lại, có tracking online
Nhược điểm: file phải rõ nét, đúng định dạng — nếu bị trả về sửa mất thời gian
```

---

### GIAI ĐOẠN 4 — CHỜ THẨM ĐỊNH & NHẬN GIẤY (Tuần 4-9)

#### ☐ Ngày 16-45: Cục thẩm định

**Cục Bản quyền có 15 ngày làm việc** để:
- Kiểm tra hồ sơ có hợp lệ không
- Kiểm tra tên phần mềm có trùng với hồ sơ đã đăng ký không
- Yêu cầu bổ sung nếu thiếu

**Tra cứu tiến độ:**
```
https://cov.gov.vn/tra-cuu-ho-so
→ Nhập số hồ sơ + MST Lavipco
→ Xem trạng thái: "Đang thẩm định" | "Yêu cầu bổ sung" | "Đã hoàn tất"
```

**Nếu bị yêu cầu bổ sung (10-15% khả năng):**
- Cục gửi công văn qua bưu điện + email
- Có 30 ngày để bổ sung, tính từ ngày nhận công văn
- Bổ sung xong, thời gian thẩm định reset về đầu

**Common issues:**
| Lỗi | Cách sửa |
|---|---|
| CCCD hết hạn | Đổi CCCD mới + công chứng lại |
| Hợp đồng chuyển giao thiếu công chứng | Đem ra VP công chứng đóng dấu |
| Tên phần mềm trùng | Đổi tên (VD: "Lighting Survey Pro" hoặc "Lavipco Lighting Manager") |
| Screenshot mờ | In lại chất lượng cao ≥300dpi |
| Mã nguồn thiếu file | Bổ sung + tạo MANIFEST mới |

#### ☐ Ngày 45-50: Nhận Giấy chứng nhận

**Nhận trực tiếp:**
- Đến Cục Bản quyền chi nhánh TP.HCM
- Xuất trình CCCD + Biên nhận
- Ký nhận + mang về

**Nhận qua bưu điện:**
- Ghi rõ trong tờ khai "Gửi qua bưu điện" + địa chỉ Lavipco
- Phí bưu điện: ~50.000đ

**Giấy chứng nhận có 4 phần:**
1. Số Giấy CN (VD: `1234/2026/QTG`)
2. Thông tin tác giả + chủ sở hữu
3. Tên tác phẩm + loại hình
4. Ngày cấp + có hiệu lực vĩnh viễn

**Chụp/scan lưu 3 nơi:**
- Bản gốc: két Lavipco
- PDF: Google Drive Lavipco
- PDF: Google Drive cá nhân Mai Vũ Lâm

---

## 💰 BẢNG DỰ TOÁN CHI PHÍ

| Khoản mục | Số tiền | Ghi chú |
|---|---:|---|
| Lệ phí đăng ký (tổ chức) | 1.100.000 | Cục Bản quyền |
| Công chứng CCCD Mai Vũ Lâm × 3 | 30.000 | 10k/bản |
| Công chứng CCCD Bà Quỳnh × 2 | 20.000 | 10k/bản |
| Công chứng GCN ĐKKD Lavipco × 2 | 100.000 | ~50k/bản (giấy A3) |
| Công chứng Hợp đồng chuyển giao | 500.000 | VP công chứng |
| In + đóng quyển mã nguồn × 2 | 1.600.000 | Nếu chọn phương án A |
| Hoặc: 2 USB kim loại + in bìa | 500.000 | Nếu chọn phương án B (rẻ hơn) |
| In tờ khai + tài liệu mô tả | 100.000 | Màu A4 |
| Photo + chuyển phát nhanh | 100.000 | Dự phòng |
| Thuế TNCN tác giả (nếu có) | Tùy giá | 10% trên phần vượt 10 triệu |
| **Tổng (phương án A)** | **~3.550.000** | |
| **Tổng (phương án B — USB)** | **~2.450.000** | Khuyến nghị |

---

## 🚨 CẢNH BÁO — CÁC LỖI THƯỜNG GẶP

### ❌ Lỗi 1: Đăng ký khi chưa có Hợp đồng chuyển giao công chứng
**Hậu quả**: Cục từ chối vì không xác định được chủ sở hữu.
**Cách tránh**: Ký + công chứng hợp đồng **trước** khi nộp hồ sơ.

### ❌ Lỗi 2: Không tách quyền nhân thân vs quyền tài sản
**Hậu quả**: Cục nghi ngờ tính hợp pháp của việc chuyển giao.
**Cách tránh**: Điều 1.3 hợp đồng ghi rõ "Bên A giữ nguyên quyền nhân thân theo Điều 19 Luật SHTT".

### ❌ Lỗi 3: Nộp mã nguồn chứa secrets
**Hậu quả**: Rò rỉ token, admin có thể chiếm quyền GitHub/Drive.
**Cách tránh**: Chạy grep tìm secrets trước khi nộp:
```bash
grep -r "ghp_" ./
grep -r "PASSWORD_PEPPER" ./
grep -r "1i32dWpWSSoW61MIUD1qDJZne2FBiofOr" ./
```

### ❌ Lỗi 4: Ngày sáng tạo trước ngày thành lập Lavipco
**Hậu quả**: Cục nghi ngờ tính hợp lệ của chủ sở hữu.
**Cách sửa**: Ghi rõ trong tờ khai:
> "Phần mềm được Mai Vũ Lâm sáng tạo từ [ngày], sau đó chuyển giao cho Lavipco theo Hợp đồng số 01/2026/HĐCG ngày [ngày ký hợp đồng]."

### ❌ Lỗi 5: Tên phần mềm trùng lặp
**Hậu quả**: Bị từ chối ngay từ khâu tiếp nhận.
**Cách tránh**: Tra cứu trước tại https://cov.gov.vn/tra-cuu
- "Lighting Survey" — có thể trùng với sản phẩm nước ngoài
- Nên đổi thành **"Lighting Survey by Lavipco"** hoặc **"Hệ thống khảo sát chiếu sáng Lavipco v1.0"**

### ❌ Lỗi 6: Screenshot mã nguồn không rõ ràng
**Hậu quả**: Cục yêu cầu in lại — mất thêm 15-30 ngày.
**Cách tránh**: In ở tiệm in laser màu chuyên nghiệp, giấy 120gsm.

### ❌ Lỗi 7: Không quản lý phiên bản
**Hậu quả**: Sau đăng ký, code tiếp tục update → khó chứng minh v1.0.
**Cách tránh**:
```bash
git tag -a v1.0-copyright-registration -m "Version đăng ký bản quyền số [xxx]/2026"
git push --tags
```

---

## 📋 CHECKLIST CUỐI CÙNG TRƯỚC KHI NỘP

### Tác giả Mai Vũ Lâm:
- [ ] CCCD gốc còn hạn
- [ ] 3 bản CCCD công chứng
- [ ] Chữ ký sống trên Tờ khai Mẫu 01
- [ ] Chữ ký sống trên 4 bản Hợp đồng chuyển giao (đã công chứng)
- [ ] Chữ ký sống trên phần Cam đoan mục 6.1

### Chủ sở hữu Lavipco:
- [ ] Giấy CN ĐKKD gốc còn hiệu lực
- [ ] Bản sao GCN ĐKKD công chứng ≤ 6 tháng
- [ ] CCCD Bà Nguyễn Kim Thúy Quỳnh còn hạn + 2 bản công chứng
- [ ] Con dấu công ty đóng lên Tờ khai + Hợp đồng + Cam đoan mục 6.2
- [ ] Chữ ký sống của Bà Quỳnh tại 3 chỗ trên
- [ ] Biên lai chuyển khoản 1.100.000đ

### Tài liệu kỹ thuật:
- [ ] File `HO-SO-SO-HUU-TRI-TUE.md` → in PDF 2 bản
- [ ] Mã nguồn v1.0-copyright-registration → 2 bản (in giấy hoặc USB)
- [ ] Đã xóa secrets khỏi mã nguồn nộp
- [ ] 10 screenshot màn hình chính, in màu A4
- [ ] File CHECKSUM.txt trên USB

### Thủ tục:
- [ ] Tra cứu tên "Lighting Survey" không trùng: https://cov.gov.vn/tra-cuu
- [ ] Nộp đúng chi nhánh (TP.HCM cho Lavipco): 170 Nguyễn Đình Chiểu, Q.3
- [ ] Chụp lại Biên nhận có số hồ sơ
- [ ] Lưu số hồ sơ + ngày nộp vào file Excel theo dõi

---

## 🎁 SAU KHI CÓ GIẤY CHỨNG NHẬN

### 1. Ghi bản quyền trên phần mềm

**Trong `index.html`** (đầu file `<head>`):
```html
<meta name="copyright" content="© 2026 Công ty Lavipco. Đã đăng ký bản quyền số [xxx]/2026/QTG tại Cục Bản quyền tác giả VN. Tác giả: Mai Vũ Lâm">
```

**Trong footer trang login**:
```html
<div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px;">
  © 2026 Lavipco — Bản quyền số [xxx]/2026/QTG<br>
  Tác giả: Mai Vũ Lâm
</div>
```

**Trong `manifest.json`**:
```json
{
  "name": "Lighting Survey Lavipco",
  "author": "Mai Vũ Lâm",
  "copyright": "© 2026 Lavipco — Reg. No. [xxx]/2026/QTG"
}
```

### 2. Đăng ký thương hiệu (tùy chọn)

**Nếu muốn bảo vệ TÊN "Lighting Survey Lavipco"**:
- Nộp hồ sơ tại **Cục Sở hữu trí tuệ** (khác với Cục Bản quyền!)
- Địa chỉ: 386 Nguyễn Trãi, Thanh Xuân, Hà Nội
- Chi nhánh HCM: 27B Nguyễn Thông, P.7, Q.3
- Phí: ~2-5 triệu VNĐ/nhãn hiệu
- Thời gian: 12-18 tháng

### 3. Sử dụng Giấy CN trong kinh doanh

**Đấu thầu gói phần mềm nhà nước:**
- Đính kèm bản photo GCN vào hồ sơ dự thầu
- Tăng điểm kỹ thuật (thường +5-10 điểm)

**Chuyển nhượng/cấp phép:**
- GCN là bằng chứng pháp lý để ký hợp đồng cấp phép với khách hàng
- Có thể định giá và hạch toán tài sản trí tuệ vào bảng cân đối kế toán Lavipco

**Chống vi phạm:**
- Nếu ai copy phần mềm → dùng GCN kiện tại Tòa
- Yêu cầu bồi thường (Điều 205 Luật SHTT): 500 triệu - 5 tỷ VNĐ tùy mức độ

### 4. Cập nhật phiên bản mới

**Khi ra v2.0 với thay đổi lớn (>30% code):**
- Đăng ký lại theo cùng quy trình
- Ghi trong tờ khai: "Phiên bản mới của phần mềm số [xxx]/2026/QTG"
- Giảm 30% lệ phí (theo Thông tư 04/2023)

**Khi ra patch nhỏ (v1.0.61 → v1.0.62):**
- KHÔNG cần đăng ký lại
- Giấy CN vẫn có hiệu lực

---

## 📞 HỖ TRỢ

**Cục Bản quyền tác giả — Chi nhánh TP.HCM**
- Địa chỉ: 170 Nguyễn Đình Chiểu, P.6, Q.3
- ☎  028.3930.3378
- 📧 phianam.cov@bvhttdl.gov.vn
- 🕐 Thứ 2-6, 8:00-16:30

**Nếu cần luật sư/dịch vụ trọn gói** (giá ~5-10 triệu VNĐ):
- Vietnam Copyright Law Firm: 028.3822.5678
- Baker McKenzie Vietnam: 028.3520.2555
- Sim Fisher Copyright: 028.3822.9955

**Nếu tự làm, gặp khó khăn**:
- Hotline Cục Bản quyền: **1800.599.955** (miễn phí)
- Facebook Cục Bản quyền: https://facebook.com/cucbanquyentacgia

---

## 📊 TÓM TẮT NGẮN GỌN

Nếu chỉ đọc 10 dòng này:

1. **Tuần 1**: Thu thập CCCD/GCN ĐKKD/con dấu → soạn Hợp đồng chuyển giao (giá + hình thức thanh toán)
2. **Tuần 2**: In + ký sống 4 bản Hợp đồng → công chứng tại VP công chứng Q. Bình Tân → chi ~500k
3. **Tuần 2 tiếp**: Chuẩn bị mã nguồn (xóa secrets, tag v1.0) → 2 USB kim loại (~500k)
4. **Tuần 2 tiếp**: Chuyển khoản lệ phí **1.100.000đ** cho Kho bạc NN
5. **Tuần 3**: Bà Nguyễn Kim Thúy Quỳnh mang hồ sơ đến **170 Nguyễn Đình Chiểu, Q.3** nộp
6. **Tuần 3-8**: Chờ 25-30 ngày, có thể bổ sung nếu Cục yêu cầu
7. **Tuần 9**: Nhận Giấy chứng nhận số `[xxx]/2026/QTG`
8. **Tổng chi phí**: ~2.5-3.5 triệu VNĐ
9. **Sau đó**: Ghi © vào code, dùng đấu thầu, chuyển nhượng
10. **Hiệu lực**: Vĩnh viễn với quyền nhân thân, 75 năm với quyền tài sản

---

*File này được lập ngày 12/07/2026 để hỗ trợ triển khai hồ sơ đăng ký bản quyền phần mềm Lighting Survey của Lavipco.*

*Tài liệu tham khảo — cần rà soát pháp lý trước khi thực hiện.*
