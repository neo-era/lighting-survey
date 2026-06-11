# Bộ Prompt Thực Hiện Tính Năng Mới
# Lighting Survey — neo-era/lighting-survey

Chạy từng prompt theo thứ tự. Mỗi prompt độc lập, tự đủ ngữ cảnh.

---

## TÍNH NĂNG 1: Log lịch sử thao tác

---

### PROMPT 1.1 — Thêm `log_action` vào GAS

```
Dự án: PWA khảo sát chiếu sáng — file gas-khaosat.js là Google Apps Script backend.

Nhiệm vụ: Thêm action `log_action` vào hàm doPost() trong gas-khaosat.js.

Yêu cầu cụ thể:

1. Thêm hàm `handleLogAction(data)`:
   - Mở (hoặc tạo) sheet tên "LichSu" trong cùng Spreadsheet
   - Nếu sheet trống, tạo header hàng 1: ["Thời gian", "Người thực hiện", "Thao tác", "ID", "Tên trụ", "Chi tiết"]
   - Append 1 hàng mới với các giá trị:
     - A: data.thoiGian (string ISO đã có timezone)
     - B: data.nguoiThucHien
     - C: data.loaiThaoTac  ("delete" | "edit" | "move")
     - D: data.id
     - E: data.tenTru
     - F: data.chiTiet (JSON string)
   - Trả về jsonResponse({ status: 'ok' })

2. Trong doPost() — thêm case xử lý:
   if (data.action === 'log_action') {
     return handleLogAction(data);
   }
   Đặt case này TRƯỚC block full_update.

3. Không cần ensureHeader() trước log_action (sheet LichSu độc lập với DanhSachTru).

Không thay đổi gì khác trong file.
```

---

### PROMPT 1.2 — Thêm hàm `_logAction()` vào client + hook vào 3 điểm

```
Dự án: PWA khảo sát chiếu sáng — index.html chứa toàn bộ app (HTML+CSS+JS).

Ngữ cảnh quan trọng:
- `currentUser` — object { username, displayName, role } lưu sau đăng nhập
- `KHAOSAT_GAS_URL` — endpoint GAS Web App
- `deleteMarker()` — async, xóa marker, gọi GAS action delete_row
- `saveMarkerPopup()` — async, lưu marker mới/sửa, gọi GAS action full_update
- `pushMovedMarkersToSheet()` — batch sync marker đã kéo
- GAS không xử lý CORS preflight → KHÔNG thêm header Content-Type khi fetch GAS

Nhiệm vụ: Thêm hệ thống ghi log thao tác.

**Bước 1 — Thêm hàm `_logAction(loaiThaoTac, row, chiTiet)` vào JS:**

```javascript
function _logAction(loaiThaoTac, row, chiTiet) {
    if (!currentUser || !KHAOSAT_GAS_URL) return;
    const payload = {
        action: 'log_action',
        loaiThaoTac,
        id: String(row[0] || ''),
        tenTru: String(row[1] || ''),
        nguoiThucHien: currentUser.username || '',
        thoiGian: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(' ', 'T'),
        chiTiet: typeof chiTiet === 'string' ? chiTiet : JSON.stringify(chiTiet || {})
    };
    // fire-and-forget — không await, không block UI
    fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
}
```

Đặt hàm này ngay sau hàm `_updateFilterBadge()`.

**Bước 2 — Hook vào deleteMarker():**
Tìm đoạn sau khi GAS xác nhận xóa thành công:
```javascript
if (json.status === 'ok') {
    displayError(`Đã xóa "${name}" khỏi Google Sheet.`, 'success');
}
```
Thêm sau dòng displayError đó:
```javascript
_logAction('delete', row, { lat: row[2], lon: row[3] });
```

**Bước 3 — Hook vào saveMarkerPopup():**
Tìm nơi GAS trả về ok sau full_update. Sau dòng xác nhận lưu thành công, thêm:
```javascript
_logAction('edit', newRow, { nguoiKS: newRow[5], loai: newRow[6] });
```
(newRow là mảng dữ liệu vừa lưu)

**Bước 4 — Hook vào pushMovedMarkersToSheet():**
Tìm vòng lặp gọi syncRowToGAS cho dirtyMovedRows. Sau khi từng row sync thành công, thêm:
```javascript
_logAction('move', row, { lat: row[2], lon: row[3] });
```

Không thay đổi gì khác.
```

---

### PROMPT 1.3 — Tạo trang lichsu.html

```
Dự án: PWA khảo sát chiếu sáng — repo neo-era/lighting-survey.

Nhiệm vụ: Tạo file lichsu.html — trang xem lịch sử thao tác dành riêng cho admin.

Ngữ cảnh:
- Dữ liệu lấy từ Google Sheet tab "LichSu" qua GAS URL
- GAS URL và CSV URL khai báo giống index.html:
  const KHAOSAT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxPFn7lnJZYdjUg5WlVq1P1JGI5O3rvcry_IVE3bhF5foDmbgT6KwBU4xFxHNwKruHRvQ/exec';
- GAS chưa có action đọc LichSu — cần thêm action `get_logs` trả về toàn bộ sheet LichSu dưới dạng JSON array
- Hoặc đơn giản hơn: publish sheet LichSu thành CSV riêng và đọc trực tiếp (người dùng sẽ cung cấp URL sau)
- Thiết kế phải khớp với style của index.html: font Inter, màu --primary #2563eb, dark navy topbar

Yêu cầu trang lichsu.html:

1. Topbar: tiêu đề "Lịch sử thao tác", nút "← Quay lại" về index.html
2. Thanh lọc: dropdown Thao tác (Tất cả / Xóa / Sửa / Di chuyển), input tìm theo Tên trụ, input lọc theo Người thực hiện
3. Bảng hiển thị log: cột Thời gian, Người thực hiện, Thao tác (badge màu), Tên trụ, ID, Chi tiết (có thể expand)
   - delete → badge đỏ
   - edit → badge xanh dương  
   - move → badge cam
4. Dữ liệu: khai báo const LICHSU_CSV_URL = ''; (để trống, người dùng điền sau), fetch CSV, parse, render bảng
5. Nếu LICHSU_CSV_URL rỗng: hiển thị hướng dẫn "Vào Google Sheet → File → Share → Publish to web → Sheet: LichSu → CSV → copy URL → điền vào LICHSU_CSV_URL"
6. Sắp xếp mặc định: mới nhất lên đầu
7. Nút "Tải lại" để refresh dữ liệu
8. Responsive mobile

Tạo file lichsu.html mới, không sửa file nào khác.
```

---

### PROMPT 1.4 — Hiện mục "Lịch sử thao tác" trong controls panel cho admin

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- controls panel (controlsModal) có dropdown #pages để điều hướng trang:
  <select id="pages" class="ctrl-input" onchange="navigateToPage()">
      <option value="index.html">Trang khảo sát</option>
      <option value="https://neo-era.github.io/camera/">Quản lý camera</option>
      <option value="https://neo-era.github.io/dentat/dentat.html">Quan lý đèn tắt/sự cố</option>
      <option value="https://neo-era.github.io/lighting-survey/huongdan.html">Hướng dẫn sử dụng</option>
  </select>
- currentUser.role — role của người dùng đã đăng nhập
- Hàm _applyRoleUI() được gọi sau đăng nhập để ẩn/hiện UI theo quyền

Nhiệm vụ: Chỉ role `admin` mới thấy mục "Lịch sử thao tác" trong dropdown #pages.

Thực hiện 2 thay đổi:

1. Thêm option vào select #pages (THÊM VÀO HTML, sau option "Hướng dẫn sử dụng"):
   <option value="lichsu.html" id="pageOptLichSu" style="display:none">Lịch sử thao tác</option>

2. Trong hàm _applyRoleUI() — thêm logic hiện/ẩn option này:
   const optLichSu = document.getElementById('pageOptLichSu');
   if (optLichSu) optLichSu.style.display = (currentUser && currentUser.role === 'admin') ? '' : 'none';

Không thay đổi gì khác.
```

---

## TÍNH NĂNG 2: Version tự động tăng khi push GitHub

---

### PROMPT 2.1 — Đọc và push version.json khi sync GitHub

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh — hàm updateGitHubExcel() hiện tại:
- Tải CSV từ KHAOSAT_CSV_URL
- Tạo Excel buffer (ExcelJS/XLSX)
- POST { action: 'upload_to_github', path: 'data/khaosat.xlsx', content: base64 } lên KHAOSAT_GAS_URL
- GAS đọc GITHUB_TOKEN từ Script Properties → gọi GitHub API

GAS action upload_to_github đã hỗ trợ cập nhật file có sẵn (lấy SHA tự động).

Nhiệm vụ: Sau khi upload Excel thành công, tăng version và push data/version.json.

Thêm vào cuối hàm updateGitHubExcel(), SAU khi gasRes.status === 'ok' cho file Excel:

```javascript
// Đọc version hiện tại (nếu có) rồi tăng patch
let verObj = { major: 1, minor: 0, patch: 0 };
try {
    const verRes = await fetch(KHAOSAT_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'upload_to_github', path: 'data/version.json', content: '' })
    });
    // Đọc file version.json từ raw GitHub
    const rawVer = await fetch(
        'https://raw.githubusercontent.com/neo-era/lighting-survey/main/data/version.json?t=' + Date.now()
    );
    if (rawVer.ok) {
        const parsed = await rawVer.json();
        verObj = parsed;
        verObj.patch = (parseInt(verObj.patch) || 0) + 1;
    }
} catch (_) {
    verObj.patch = 1;
}
verObj.updated = new Date().toISOString();
verObj.by = currentUser ? currentUser.username : '';

const verContent = btoa(unescape(encodeURIComponent(JSON.stringify(verObj, null, 2))));
await fetch(KHAOSAT_GAS_URL, {
    method: 'POST',
    body: JSON.stringify({
        action: 'upload_to_github',
        path: 'data/version.json',
        content: verContent,
        message: `Cập nhật dữ liệu v${verObj.major}.${verObj.minor}.${verObj.patch}`
    })
});
_setDataVersion(verObj);
```

Thêm hàm `_setDataVersion(verObj)` vào JS (đặt gần _updateFilterBadge):
```javascript
function _setDataVersion(v) {
    const tag = document.getElementById('dataVersionTag');
    if (tag) tag.textContent = `v${v.major}.${v.minor}.${v.patch}`;
}
```

Gọi `_loadDataVersion()` khi app khởi động (trong _showApp()):
```javascript
async function _loadDataVersion() {
    try {
        const res = await fetch(
            'https://raw.githubusercontent.com/neo-era/lighting-survey/main/data/version.json?t=' + Date.now()
        );
        if (res.ok) _setDataVersion(await res.json());
    } catch (_) {}
}
```

Không thay đổi gì khác trong updateGitHubExcel() ngoài đoạn thêm ở trên.
```

---

### PROMPT 2.2 — Hiển thị version trong UI

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Topbar (#topBar) có: nút hamburger, thanh tìm kiếm, chip user (#topbarUser)
- Hàm _setDataVersion(v) đã có: cập nhật text cho element id="dataVersionTag"
- Hàm _loadDataVersion() đã có: fetch version.json từ GitHub khi app khởi động
- _showApp() gọi _loadDataVersion() sau login

Nhiệm vụ: Thêm badge version vào UI.

**Thay đổi 1 — HTML:** Thêm badge ngay trước #topbarUser trong #topBar:
```html
<div id="dataVersionTag"
     style="flex-shrink:0; font-size:11px; font-weight:700; color:rgba(255,255,255,.7);
            background:rgba(255,255,255,.12); border-radius:999px; padding:3px 10px;
            display:none; white-space:nowrap;">
</div>
```

**Thay đổi 2 — JS:** Trong hàm `_setDataVersion(v)`, sau khi set textContent, thêm:
```javascript
if (tag) tag.style.display = 'block';
```

Không thay đổi gì khác.
```

---

## THỨ TỰ CHẠY KHUYẾN NGHỊ

```
1.1 → gas-khaosat.js: thêm log_action
1.2 → index.html: thêm _logAction() + hook 3 điểm
1.3 → lichsu.html: tạo trang mới
1.4 → index.html: hiện option Lịch sử cho admin

2.1 → index.html: logic push version.json
2.2 → index.html: badge version trong topbar
```

Sau mỗi prompt liên quan đến GAS (1.1):
→ Redeploy GAS: Manage deployments → Edit → New version → Deploy

Sau tất cả:
→ Bump sw.js CACHE từ 'lighting-survey-v3' → 'lighting-survey-v4' để clear cache cũ
