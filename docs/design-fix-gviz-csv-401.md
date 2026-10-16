# Sửa lỗi "Failed to fetch" khi tải địa bàn tạo động

## Bối cảnh

App v1.0.126, địa bàn `Quan5-Hung` (tab `Hung`) báo **"Không tải được dữ liệu: Failed to fetch"**.
15 địa bàn hardcode trong `DISTRICT_PAGES` vẫn chạy bình thường.

## Nguyên nhân gốc (đã kiểm chứng bằng gọi API thật)

GAS `create_dia_ban` sinh URL dạng **gviz** qua `_buildGvizUrl`:

```
https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=<tab>
```

| URL | HTTP | Content-Type |
|---|---|---|
| `Quan5-Hung` (gviz) | **401** | `text/html` — trang đăng nhập |
| `Quan1` (publish-to-web `/pub?output=csv`) | 200 | `text/csv`, 1.29 MB |

gviz **yêu cầu đăng nhập**. Trình duyệt gọi ẩn danh → 401 → redirect sang trang login khác
origin → CORS chặn → `fetch` ném `TypeError: Failed to fetch` (không có status để hiển thị).

## Vì sao validator không bắt được — 2 khiếm khuyết

`_testGvizUrl` (gas-khaosat.js:3488) có 2 lỗi độc lập:

1. **Kiểm tra nội dung quá yếu**
   ```js
   if (body.indexOf(',') === -1 && body.indexOf('"') === -1) return { ok:false };
   return { ok:true };
   ```
   Trang HTML đăng nhập **có cả dấu phẩy lẫn dấu nháy** → lọt qua, báo `ok:true`.
   Thêm `followRedirects:true` nên 401 có thể kết thúc ở trang 200 HTML.

2. **Kết quả test không chặn việc tạo** (gas-khaosat.js:3759)
   ```js
   var csvMethod = testRes.ok ? 'gviz' : 'gviz-untested';   // fail vẫn appendRow
   ```
   Chỉ ghi chú vào `hint`, địa bàn vẫn được tạo như bình thường.

## Hướng đã chốt với người dùng

**Chia sẻ sheet công khai thủ công** — giữ URL gviz (tải trực tiếp từ Google, nhanh),
người dùng tự vào Share → Anyone with the link → Viewer.

Vì thao tác là thủ công nên validator **bắt buộc phải phát hiện được**, nếu không lỗi sẽ
tái diễn âm thầm mỗi lần tạo địa bàn.

## Tiêu chí đạt

| # | Tiêu chí | Đo bằng |
|---|---|---|
| 1 | `_testGvizUrl` phân biệt CSV thật với trang HTML đăng nhập | `node tests/gviz-url-check.test.mjs` |
| 2 | HTTP ≠ 200 → báo fail kèm mã lỗi | Test tự động |
| 3 | CSV thiếu cột "Tên trụ" → báo fail | Test tự động |
| 4 | Sheet chưa công khai → tạo địa bàn vẫn xong nhưng cảnh báo **rõ, có hướng dẫn** | Kiểm tay |
| 5 | Lỗi tải lúc chạy nêu được nguyên nhân khả dĩ, không chỉ "Failed to fetch" | Kiểm tay |
| 6 | 15 địa bàn hardcode không bị ảnh hưởng | Test hồi quy |

### Ca biên phải chịu được
- Body rỗng · Content-Type thiếu · Chỉ có dòng tiêu đề (địa bàn mới, hợp lệ) ·
  `UrlFetchApp` ném exception · Redirect sang trang 200 HTML

## Phạm vi sửa

| File | Thay đổi |
|---|---|
| `gas-khaosat.js` | Viết lại `_testGvizUrl` (kiểm Content-Type + loại HTML + bắt buộc có cột "Tên trụ"); `create_dia_ban` thêm `SpreadsheetApp.flush()` trước khi test + cảnh báo nêu đúng lý do (vẫn tạo địa bàn, không chặn) |
| `index.html` | Thông báo lỗi tải dữ liệu nêu nguyên nhân khả dĩ + cách xử lý |
| `CLAUDE.md` | Sửa ví dụ `csvUrl` đang ghi dạng gviz (gây hiểu nhầm) |
| `tests/gviz-url-check.test.mjs` | Test mới, trích hàm thật từ `gas-khaosat.js` |

**Không đụng**: `DISTRICT_PAGES` hardcode, luồng `loadFromCSVWithCache` (chỉ đổi text lỗi).

## Việc người dùng phải làm

1. Mở Google Sheet chứa tab `Hung` → **Share → Anyone with the link → Viewer**
2. Redeploy GAS **New version** (bắt buộc, vì sửa `gas-khaosat.js`)

---

## Kết quả kiểm chứng (2026-10-16)

| Tiêu chí | Kết quả |
|---|---|
| 1. Phân biệt CSV thật / trang HTML đăng nhập | ✅ 15/15 test pass |
| 2. HTTP ≠ 200 → fail kèm mã lỗi | ✅ |
| 3. CSV thiếu cột "Tên trụ" → fail | ✅ (kể cả NFD) |
| 4. Cảnh báo khi tạo địa bàn | ✅ nêu đúng lý do, hướng dẫn theo từng loại lỗi |
| 5. Lỗi lúc chạy nêu nguyên nhân khả dĩ | ✅ phủ `Failed to fetch`, `NetworkError`, `Load failed`, `access control`, `HTTP 401/403`, `Dữ liệu rỗng` |
| 6. 15 địa bàn hardcode không ảnh hưởng | ✅ 148 assertion hồi quy pass |

Hồi quy: `empty-district` 17/0 · `create-dia-ban` 29/0 · `archive-delete-dia-ban` 24/0 ·
`parseCSV` 15/0 · `module-split` 63/0 · vitest `tests/unit` 47/0.

### Phát hiện trong lúc review độc lập

1. **gviz trả về sheet đầu tiên khi tên tab sai** — kiểm bằng curl thật: HTTP 200 + CSV của
   sheet 1, **không** trả envelope lỗi. Vì sheet 1 (`DanhSachTru`) có cột "Tên trụ" nên
   validator không phân biệt được → đã thêm `SpreadsheetApp.flush()` để tab kịp commit
   trước khi test.
2. **Regex NFC không khớp header NFD** — đã chuyển sang dùng `norm()` có sẵn trong GAS.
3. **Regex nhận diện lỗi phía client bỏ sót `HTTP 401` và `Dữ liệu rỗng`** — đúng 2 ca mà
   bản sửa này nhắm tới. Đã bổ sung.
4. **Test thiếu `norm()` trong sandbox** → `ReferenceError` bị `catch` nuốt, happy-path fail.
   Bài học: khi trích hàm từ GAS để test, phải trích kèm mọi hàm toàn cục nó phụ thuộc.

### Hạn chế còn lại (chưa làm)

- Cảnh báo hiển thị bằng toast 4 giây, có thể bị toast khác ghi đè trước khi đọc xong.
  Muốn chắc chắn thì đưa vào modal — chưa làm vì ngoài phạm vi sửa lỗi này.
- Trạng thái "chưa công khai" không lưu vào sheet `DiaBan`, đóng toast là mất.
- `tests/gviz-url-check.test.mjs` chạy bằng `node`, chưa nằm trong `npm test`
  (đúng quy ước sẵn có của các `tests/*.test.mjs` khác).
