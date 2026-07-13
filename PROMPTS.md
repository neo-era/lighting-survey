# Bộ Prompt Thực Hiện Tính Năng Mới
# Lighting Survey — neo-era/lighting-survey

Chạy từng prompt theo thứ tự. Mỗi prompt độc lập, tự đủ ngữ cảnh.

---

## 📊 Trạng thái implement (cập nhật 2026-06-17)

| Group | Prompt | Status | Note |
|---|---|---|---|
| **Tính năng 1** — Log lịch sử thao tác | 1.1, 1.2, 1.3, 1.4 | ✅ DONE | Sheet `LichSu` + admin role |
| **Tính năng 2** — Version auto-bump | 2.1, 2.2 | ✅ DONE | Đã chuyển sang GitHub Action workflow |
| **Tính năng 3** — In bản vẽ PDF | 3.1 → 3.8 | ✅ DONE | Layout + cable + export PDF |
| **Tính năng 4** — Cải tiến bản vẽ | 4.1 → 4.8 | ✅ DONE | Preview, persist, cycle detect, distance auto |
| **Tính năng 5** — Cable + Rotation | 5.1 → 5.6 | ✅ DONE | Multi-select tủ, edit cable, xoay map |
| **Tính năng 6** — Edit marker fixes | 6.1, 6.2, 6.3 | ✅ DONE | `_editingRow`, baseSelect, cable label |
| **Tính năng 7** — Đa địa bàn | 7.1 → 7.6 | ✅ DONE | + ext `EXTERNAL_SPREADSHEET_IDS` cho CanGiuoc |
| **Tính năng 8** — Mobile optimization | 8.1 → 8.7 | ✅ DONE | isMobile + shared icons + cluster + label threshold + animations off + lazy img + media query (verified 2026-06-17) |
| **Tính năng 9** — Load optimization | 9.1 → 9.5 | ✅ DONE | IndexedDB + lazy popup + chunked + VN2000 + zoom-tier progressive (2026-06-17). Không có 9.6. |
| **Tính năng 10** — Filter tủ | — | ✅ DONE | Multi-select + search |
| **P1 → P8** — Print drawing optimize | (2026-06-16) | ✅ DONE | Audit fixes: bug, cleanup, perf, scale chính xác |
| **P9** — Tách footer & ký hiệu hở | (mục 4.9) | ✅ DONE | CSS gap 16px giữa 2 khối + border 4 cạnh + radius (2026-06-17) |
| **P10** — Hiển thị tất cả đối tượng | (mục 4.10) | ✅ DONE | Auto-fit footer height + compact icons khi N>8 (2026-06-17) |
| **P11** — Cáp ngầm vs cáp nổi | (mục 4.11) | ✅ DONE | Col 22 + CABLE_STYLE + UI + legend 2 dòng (2026-06-17). ⚠ Cần redeploy GAS! |
| **P12** — TỔNG P9+P10+P11 | — | ✅ DONE | 3 mục con đã chạy riêng (2026-06-17); P9 partial: title block giữ vị trí gốc theo yêu cầu user |
| **P13a** — GPS modes Foundation | (Tính năng 11) | ✅ DONE | `GPS_MODES` + helpers + Toggle UI + GAS schema 25 cột (2026-06-17). ⚠ Cần redeploy GAS! |
| **P13b** — GPS pipeline + UX | (Tính năng 11) | ✅ DONE | `getBestFix` + floating bar + auto-accept 3s + 6 refactored + 1 quickMode (2026-06-17) |
| **P13c** — GPS polish + docs | (Tính năng 11) | ✅ DONE | Precision conditional + popup badge + warn RTK + startTracking sync (2026-06-17) |
| **P13** — TỔNG P13a+b+c | — | ✅ DONE | 3 phase đã chạy riêng (2026-06-17) |

**Legend:** ✅ DONE (đã implement & verified) · 🟡 PARTIAL (làm một phần) · ⏳ TODO (chưa làm) · ❌ DROPPED (bỏ)

---

## TÍNH NĂNG 1: Log lịch sử thao tác ✅

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

## TÍNH NĂNG 2: Version tự động tăng khi push GitHub ✅

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

---

## TÍNH NĂNG 3: In bản vẽ sơ đồ tuyến trạm đèn ✅

Xuất PDF A3/A4 landscape: nền CartoDB + ký hiệu SVG + đường cáp + khoảng cách + bảng ký hiệu + khung bản vẽ.
Thực hiện theo thứ tự 3.1 → 3.2 → 3.3 → 3.4 → 3.5.

---

### PROMPT 3.1 — Nút entry point + lazy-load jsPDF & html2canvas

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Controls modal có section "Xuất dữ liệu" chứa 2 nút:
  <button onclick="showReportModal()" class="ctrl-btn primary" style="margin-bottom:8px">
      <i class="fa fa-bar-chart"></i> Xuất báo cáo
  </button>
  <button onclick="showExportCadModal()" class="ctrl-btn dark">
      <i class="fa fa-file-code-o"></i> Export to CAD
  </button>
- _loadExcelJS() là pattern lazy-load singleton đã có trong file (tham khảo để làm tương tự)

Nhiệm vụ: 2 thay đổi.

**Thay đổi 1 — Thêm nút "In bản vẽ" sau nút "Export to CAD":**
```html
<button onclick="openPrintDrawingModal()" class="ctrl-btn outline" style="margin-top:8px;">
    <i class="fa fa-print"></i> In bản vẽ sơ đồ tuyến
</button>
```

**Thay đổi 2 — Thêm hàm lazy-load vào JS (đặt ngay sau hàm _loadExcelJS()):**
```javascript
let _printLibsPromise = null;
function _loadPrintLibs() {
    if (typeof window.jspdf !== 'undefined' && typeof window.html2canvas !== 'undefined') return Promise.resolve();
    if (_printLibsPromise) return _printLibsPromise;
    _printLibsPromise = new Promise((resolve, reject) => {
        let loaded = 0;
        const check = () => { if (++loaded === 2) resolve(); };
        const fail  = () => { _printLibsPromise = null; reject(new Error('Không tải được thư viện in')); };
        const s1 = document.createElement('script');
        s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s1.onload = check; s1.onerror = fail; document.head.appendChild(s1);
        const s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s2.onload = check; s2.onerror = fail; document.head.appendChild(s2);
    });
    return _printLibsPromise;
}
```

Không thay đổi gì khác.
```

---

### PROMPT 3.2 — Modal "In bản vẽ": HTML + CSS + openPrintDrawingModal()

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- loadedData[0] = header row, loadedData.slice(1) = data rows
- row[7] = tên tủ điều khiển (tuDieuKhien)
- currentUser.displayName — tên người đăng nhập
- Có sẵn Bootstrap modal system (jQuery), pattern giống các modal khác trong file

Nhiệm vụ: Thêm modal + hàm mở modal.

**Thêm CSS vào <style> (sau các CSS modal hiện có):**
```css
/* ── PRINT DRAWING MODAL ── */
#printDrawingModal .pd-row { display:flex; gap:8px; margin-bottom:10px; }
#printDrawingModal .pd-row .pd-item { flex:1; }
#printDrawingModal .pd-label { font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.4px; margin-bottom:3px; }
#printDrawingModal .pd-ctrl { width:100%; padding:8px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:14px; font-family:inherit; outline:none; }
#printDrawingModal .pd-ctrl:focus { border-color:#2563eb; }
#printDrawingModal .pd-hint { font-size:12px; color:#6b7280; margin-top:6px; line-height:1.5; }
```

**Thêm HTML modal (đặt trước <!-- ═══ TOAST ═══ --> comment):**
```html
<!-- ═══ MODAL IN BẢN VẼ ═══ -->
<div class="modal fade" id="printDrawingModal" tabindex="-1" role="dialog">
  <div class="modal-dialog modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header" style="background:#0f172a;color:white;border-radius:8px 8px 0 0;">
        <h5 class="modal-title"><i class="fa fa-print"></i> In bản vẽ sơ đồ tuyến trạm đèn</h5>
        <button type="button" class="close" data-dismiss="modal" style="color:white;opacity:.7;"><span>&times;</span></button>
      </div>
      <div class="modal-body">
        <div class="pd-row">
          <div class="pd-item" style="flex:2">
            <div class="pd-label">Tủ điều khiển</div>
            <select id="pdTuSelect" class="pd-ctrl"></select>
          </div>
          <div class="pd-item">
            <div class="pd-label">Tỉ lệ</div>
            <select id="pdScale" class="pd-ctrl">
              <option value="500">1 : 500</option>
              <option value="1000" selected>1 : 1000</option>
              <option value="2000">1 : 2000</option>
              <option value="5000">1 : 5000</option>
            </select>
          </div>
          <div class="pd-item">
            <div class="pd-label">Khổ giấy</div>
            <select id="pdPaper" class="pd-ctrl">
              <option value="a3" selected>A3 (ngang)</option>
              <option value="a4">A4 (ngang)</option>
            </select>
          </div>
        </div>
        <div class="pd-row">
          <div class="pd-item" style="flex:2">
            <div class="pd-label">Tên bản vẽ / Khu vực</div>
            <input id="pdTenTu" class="pd-ctrl" type="text" placeholder="VD: KNỞ P12 Trần Thiện Chánh">
          </div>
          <div class="pd-item">
            <div class="pd-label">Số bản vẽ</div>
            <input id="pdSoBanVe" class="pd-ctrl" type="text" placeholder="VD: 001">
          </div>
        </div>
        <div class="pd-row">
          <div class="pd-item">
            <div class="pd-label">Người lập</div>
            <input id="pdNguoiLap" class="pd-ctrl" type="text">
          </div>
          <div class="pd-item">
            <div class="pd-label">Ngày</div>
            <input id="pdNgay" class="pd-ctrl" type="date">
          </div>
        </div>
        <p class="pd-hint">⚠️ Trước khi xuất: căn chỉnh bản đồ đến vùng cần in, chọn đúng tủ điều khiển. App sẽ tự chuyển sang nền CartoDB (hỗ trợ xuất ảnh) và vẽ đường cáp kết nối các trụ.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Đóng</button>
        <button type="button" class="btn btn-primary" id="pdExportBtn" onclick="exportDrawingPDF()">
          <i class="fa fa-file-pdf-o"></i> Xuất PDF
        </button>
      </div>
    </div>
  </div>
</div>
```

**Thêm hàm JS (đặt gần các hàm show modal khác):**
```javascript
function openPrintDrawingModal() {
    // Điền danh sách tủ điều khiển
    const sel = document.getElementById('pdTuSelect');
    if (sel && Array.isArray(loadedData) && loadedData.length > 1) {
        const tuSet = new Set();
        loadedData.slice(1).forEach(r => { if (r[7]) tuSet.add(String(r[7])); });
        sel.innerHTML = '<option value="">-- Tất cả --</option>' +
            [...tuSet].sort().map(t => `<option value="${t}">${t}</option>`).join('');
    }
    // Điền người lập + ngày mặc định
    const nguoiEl = document.getElementById('pdNguoiLap');
    if (nguoiEl && !nguoiEl.value && currentUser) nguoiEl.value = currentUser.displayName || currentUser.username || '';
    const ngayEl = document.getElementById('pdNgay');
    if (ngayEl && !ngayEl.value) ngayEl.value = new Date().toISOString().slice(0,10);
    $('#printDrawingModal').modal('show');
}
```

Không thay đổi gì khác.
```

---

### PROMPT 3.3 — Cable lines: `_buildCableLines()` + `_removeCableLines()` + helpers

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh quan trọng:
- `map` — biến Leaflet map global
- `loadedData` — array, [0]=header, [1..]=data
- `parseCoord(v)` — hàm đã có, parse số từ string/number
- row[1]=tên trụ, row[2]=lat, row[3]=lon, row[7]=tuDieuKhien, row[14]=markerGoc, row[15]=khoangCach

Nhiệm vụ: Thêm 3 hàm JS + CSS cho cable label (đặt sau hàm _removeCableLines hoặc cuối phần helper).

**Thêm CSS vào <style>:**
```css
.cable-line { /* style qua Leaflet options, không cần CSS riêng */ }
.cable-label { background:none; border:none; }
.cable-label span {
    background:rgba(255,255,255,.88); border:1px solid #1e40af;
    border-radius:4px; padding:1px 5px;
    font-size:11px; font-weight:700; color:#1e40af;
    white-space:nowrap; pointer-events:none;
}
```

**Thêm 3 hàm JS:**
```javascript
// ── CABLE LINES (dùng khi in bản vẽ) ─────────────────────────────
let _cableLayerGroup = null;

function _filterRowsByTu(tuName) {
    if (!Array.isArray(loadedData) || loadedData.length < 2) return [];
    const rows = loadedData.slice(1);
    if (!tuName) return rows;
    return rows.filter(r => String(r[7] || '') === tuName);
}

function _buildCableLines(rows) {
    _removeCableLines();
    _cableLayerGroup = L.layerGroup().addTo(map);
    // Build name → position index
    const posIdx = {};
    rows.forEach(r => {
        const name = String(r[1] || '').trim();
        const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
        if (name && Number.isFinite(lat) && Number.isFinite(lon)) posIdx[name] = [lat, lon];
    });
    rows.forEach(r => {
        const parent = String(r[14] || '').trim();
        if (!parent || !posIdx[parent]) return;
        const child = String(r[1] || '').trim();
        if (!child || !posIdx[child] || child === parent) return;
        const from = posIdx[parent], to = posIdx[child];
        L.polyline([from, to], {
            color: '#1e40af', weight: 2.5, dashArray: '7 5', opacity: 0.8
        }).addTo(_cableLayerGroup);
        const dist = String(r[15] || '').trim();
        if (dist) {
            const mid = [(from[0]+to[0])/2, (from[1]+to[1])/2];
            L.marker(mid, {
                icon: L.divIcon({ className:'cable-label', html:`<span>${dist}m</span>`, iconSize:null, iconAnchor:[20,10] }),
                interactive: false, keyboard: false
            }).addTo(_cableLayerGroup);
        }
    });
}

function _removeCableLines() {
    if (_cableLayerGroup) { map.removeLayer(_cableLayerGroup); _cableLayerGroup = null; }
}
```

Không thay đổi gì khác.
```

---

### PROMPT 3.4 — Tile switch + zoom-to-fit + print overlay HTML

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- `map` — Leaflet map global, được khởi tạo trong initializeMap()
- Các tile layer (osm, googleMap, v.v.) là biến local bên trong initializeMap() — không truy cập được từ ngoài
- TYPE_CONFIG đã có: { 1:{label:'Trụ STK',color:'#0ea5e9',shape:'pole'}, ...6 loại... }
- _makeCabinetIconSvg(color) đã có — trả về raw SVG string (mini, 14×16)
- Cần thêm _makeLampIconSvg(color) tương tự

Nhiệm vụ: Thêm 6 hàm JS.

**Thêm ngay sau hàm _makeCabinetIconSvg():**
```javascript
function _makeLampIconSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="20" viewBox="0 0 26 42">
        <rect x="10" y="18" width="4" height="24" rx="2" fill="${color}"/>
        <path d="M12 18 C12 12 15 7 22 5" stroke="${color}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
        <rect x="16" y="1.5" width="10" height="7" rx="3.5" fill="${color}"/>
        <rect x="17.5" y="3" width="7" height="4" rx="2" fill="white" opacity="0.82"/>
    </svg>`;
}
```

**Thêm các hàm tile + overlay (đặt sau _removeCableLines()):**
```javascript
// ── TILE SWITCHING (khi in) ───────────────────────────────────────
let _savedBaseLayers = [];
let _printCartoLayer = null;

function _switchToPrintTile() {
    _savedBaseLayers = [];
    map.eachLayer(l => {
        // Lưu tất cả TileLayer gốc (bỏ qua shadowPane — streetLabels)
        if (l instanceof L.TileLayer && l.options.pane !== 'shadowPane') {
            _savedBaseLayers.push(l);
            map.removeLayer(l);
        }
    });
    _printCartoLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, attribution: '© CartoDB', crossOrigin: 'anonymous' }
    );
    _printCartoLayer.addTo(map);
}

function _restoreOriginalTiles() {
    if (_printCartoLayer) { map.removeLayer(_printCartoLayer); _printCartoLayer = null; }
    _savedBaseLayers.forEach(l => l.addTo(map));
    _savedBaseLayers = [];
}

function _fitMapToRows(rows) {
    const pts = rows
        .map(r => [parseCoord(r[2]), parseCoord(r[3])])
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 17 });
}

// ── PRINT OVERLAY (legend + title block) ─────────────────────────
function _showPrintOverlay(opts) {
    _hidePrintOverlay();
    const { rows, tenTu, scale, ngay, nguoiLap, soBanVe } = opts;

    // Tìm các loại marker có trong data
    const usedTypes = [...new Set(rows.map(r => parseInt(r[6])).filter(t => TYPE_CONFIG[t]))];

    const legendItems = usedTypes.map(t => {
        const cfg = TYPE_CONFIG[t];
        const svgHtml = cfg.shape === 'cabinet' ? _makeCabinetIconSvg(cfg.color) : _makeLampIconSvg(cfg.color);
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <div style="width:20px;text-align:center;flex-shrink:0;">${svgHtml}</div>
            <span style="font-size:11px;color:#1e293b;">${cfg.label}</span>
        </div>`;
    }).join('');

    // Thêm ký hiệu đường cáp
    const cableLegend = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;margin-top:4px;">
        <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#1e40af" stroke-width="2" stroke-dasharray="5 3"/></svg>
        <span style="font-size:11px;color:#1e293b;">Cáp nguồn</span>
    </div>`;

    const overlay = document.createElement('div');
    overlay.id = 'printOverlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:8000;pointer-events:none;font-family:Inter,sans-serif;';
    overlay.innerHTML = `
        <!-- Legend panel -->
        <div style="position:absolute;left:0;top:0;bottom:64px;width:150px;
                    background:white;border-right:2px solid #1e293b;padding:10px 10px 10px 12px;overflow:hidden;">
            <div style="font-size:10px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;">
                Bảng ký hiệu
            </div>
            ${legendItems}${cableLegend}
        </div>
        <!-- Title block -->
        <div style="position:absolute;left:0;right:0;bottom:0;height:64px;
                    background:white;border-top:3px solid #1e293b;display:grid;
                    grid-template-columns:1fr auto auto auto auto;align-items:stretch;">
            <div style="padding:4px 10px;border-right:1px solid #ccc;display:flex;flex-direction:column;justify-content:center;">
                <div style="font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;">BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN — HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ</div>
                <div style="font-size:15px;font-weight:800;color:#0f172a;margin-top:2px;">${tenTu || ''}</div>
            </div>
            <div style="padding:4px 12px;border-right:1px solid #ccc;display:flex;flex-direction:column;justify-content:center;min-width:90px;">
                <div style="font-size:9px;color:#6b7280;">TỈ LỆ</div>
                <div style="font-size:13px;font-weight:700;">1 : ${parseInt(scale).toLocaleString()}</div>
            </div>
            <div style="padding:4px 12px;border-right:1px solid #ccc;display:flex;flex-direction:column;justify-content:center;min-width:110px;">
                <div style="font-size:9px;color:#6b7280;">NGƯỜI LẬP</div>
                <div style="font-size:12px;font-weight:600;">${nguoiLap || ''}</div>
            </div>
            <div style="padding:4px 12px;border-right:1px solid #ccc;display:flex;flex-direction:column;justify-content:center;min-width:90px;">
                <div style="font-size:9px;color:#6b7280;">NGÀY</div>
                <div style="font-size:12px;font-weight:600;">${ngay || ''}</div>
            </div>
            <div style="padding:4px 12px;display:flex;flex-direction:column;justify-content:center;min-width:70px;">
                <div style="font-size:9px;color:#6b7280;">SỐ BV</div>
                <div style="font-size:12px;font-weight:600;">${soBanVe || ''}</div>
            </div>
        </div>`;

    document.getElementById('map').appendChild(overlay);
}

function _hidePrintOverlay() {
    const el = document.getElementById('printOverlay');
    if (el) el.remove();
}
```

Không thay đổi gì khác.
```

---

### PROMPT 3.5 — `exportDrawingPDF()`: hàm xuất PDF chính

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh — các hàm đã có sau PROMPT 3.1–3.4:
- _loadPrintLibs()           — lazy-load jsPDF + html2canvas
- _filterRowsByTu(tuName)    — lọc rows theo tủ điều khiển
- _buildCableLines(rows)     — vẽ polyline cáp lên map
- _removeCableLines()        — xóa polyline cáp
- _fitMapToRows(rows)        — fitBounds map đến tập rows
- _switchToPrintTile()       — chuyển tile sang CartoDB (CORS), lưu layers gốc
- _restoreOriginalTiles()    — khôi phục tile gốc
- _showPrintOverlay(opts)    — inject legend + title block HTML vào #map
- _hidePrintOverlay()        — xóa overlay
- displayError(msg)          — toast notification
- window.jspdf.jsPDF         — sau khi _loadPrintLibs() resolve
- window.html2canvas         — sau khi _loadPrintLibs() resolve

Form inputs trong #printDrawingModal:
  pdTuSelect, pdScale, pdPaper, pdTenTu, pdSoBanVe, pdNguoiLap, pdNgay

Nhiệm vụ: Thêm hàm `exportDrawingPDF()` vào JS.

```javascript
async function exportDrawingPDF() {
    const exportBtn = document.getElementById('pdExportBtn');
    if (exportBtn) { exportBtn.disabled = true; exportBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Đang xử lý...'; }
    try {
        displayError('Đang tải thư viện in...');
        await _loadPrintLibs();

        const tuName    = (document.getElementById('pdTuSelect')  || {}).value || '';
        const scale     = parseInt((document.getElementById('pdScale')  || {}).value) || 1000;
        const paper     = (document.getElementById('pdPaper')     || {}).value || 'a3';
        const tenTu     = (document.getElementById('pdTenTu')     || {}).value.trim();
        const soBanVe   = (document.getElementById('pdSoBanVe')   || {}).value.trim();
        const nguoiLap  = (document.getElementById('pdNguoiLap')  || {}).value.trim();
        const ngay      = (document.getElementById('pdNgay')      || {}).value;

        const rows = _filterRowsByTu(tuName);
        if (rows.length === 0) { displayError('Không có dữ liệu để in.'); return; }

        // 1. Vẽ đường cáp
        _buildCableLines(rows);

        // 2. Fit map + switch tile sang CartoDB
        _fitMapToRows(rows);
        _switchToPrintTile();

        // 3. Đợi tiles tải (CartoDB cần ~2-3s)
        displayError('Đang chờ bản đồ tải...');
        await new Promise(r => setTimeout(r, 3000));

        // 4. Hiện overlay legend + title block
        _showPrintOverlay({ rows, tenTu: tenTu || tuName, scale, ngay, nguoiLap, soBanVe });
        await new Promise(r => setTimeout(r, 200));

        // 5. Capture map (bao gồm cả overlay bên trong #map)
        displayError('Đang chụp bản vẽ...');
        const mapEl = document.getElementById('map');
        const canvas = await window.html2canvas(mapEl, {
            useCORS: true,
            allowTaint: false,
            scale: 2,
            logging: false,
            ignoreElements: el =>
                el.classList && (
                    el.classList.contains('leaflet-control-container') ||
                    el.id === 'bottomActionBar' ||
                    el.id === 'topBar' ||
                    el.id === 'filterOverlay' ||
                    el.id === 'error'
                )
        });

        // 6. Tạo PDF với jsPDF
        displayError('Đang tạo file PDF...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: paper });
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const imgData = canvas.toDataURL('image/jpeg', 0.93);
        doc.addImage(imgData, 'JPEG', 0, 0, pw, ph);

        // 7. Lưu file
        const safeName = (tenTu || tuName || 'banve').replace(/[^a-zA-Z0-9À-ɏḀ-ỿ\s_-]/g,'').trim().replace(/\s+/g,'-') || 'banve';
        const fileName = `${safeName}-${ngay || new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(fileName);
        displayError(`Đã xuất: ${fileName}`, 'success');

    } catch (err) {
        console.error('exportDrawingPDF:', err);
        displayError('Lỗi xuất PDF: ' + (err.message || err));
    } finally {
        _hidePrintOverlay();
        _removeCableLines();
        _restoreOriginalTiles();
        if (exportBtn) { exportBtn.disabled = false; exportBtn.innerHTML = '<i class="fa fa-file-pdf-o"></i> Xuất PDF'; }
    }
}
```

Không thay đổi gì khác.
```

---

### PROMPT 3.6 — Zoom tự động theo tỉ lệ khi xuất PDF

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- `map` — Leaflet map global
- `exportDrawingPDF()` đã có, lấy `scale` từ `pdScale` (500/1000/2000/5000)
- Người dùng muốn: chọn tỉ lệ 1:1000 → app tự zoom map tới zoom level tương ứng
- Công thức tính zoom từ tỉ lệ (tại latitude trung bình):
    zoom = log2(40075016.686 * cos(lat_rad) * 96 / (25.4 * scale))
    Trong đó lat_rad = map.getCenter().lat * Math.PI / 180
- Sau khi setZoom, không fitBounds — chỉ zoom tại center hiện tại

Nhiệm vụ: Thêm hàm `_zoomToScale(scale)` và gọi nó trong `exportDrawingPDF()`.

**Thêm hàm (đặt ngay sau `_fitMapToRows()`):**
```javascript
function _zoomToScale(scale) {
    const lat = map.getCenter().lat;
    const latRad = lat * Math.PI / 180;
    const zoom = Math.log2(40075016.686 * Math.cos(latRad) * 96 / (25.4 * scale));
    map.setZoom(Math.round(zoom));
}
```

**Sửa `exportDrawingPDF()`** — thêm ngay sau `_switchToPrintTile()`:
```javascript
// 2b. Zoom theo tỉ lệ
_zoomToScale(scale);
```

Không thay đổi gì khác.
```

---

### PROMPT 3.7 — Tổng số trụ + tổng chiều dài cáp trong overlay

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- `_showPrintOverlay(opts)` đã có, nhận `{ rows, tenTu, scale, ngay, nguoiLap, soBanVe }`
- `rows` là mảng data (mỗi row = 1 trụ): row[15] = khoangCach (string, đơn vị m)
- Muốn hiển thị thêm "Tổng: N trụ — X m cáp" ở góc dưới phải bên trong bản đồ
  (bên trên title block, ngoài vùng bảng ký hiệu)

Nhiệm vụ: Trong `_showPrintOverlay()`, thêm 1 div thống kê góc dưới-phải bên trong map.

**Thêm vào `overlay.innerHTML` (trước thẻ đóng `</div>` cuối của print-frame, trước title block):**
```javascript
// Tính tổng
const totalTru = rows.length;
const totalCap = rows.reduce((s, r) => {
    const v = parseFloat(String(r[15]).replace(',', '.'));
    return s + (Number.isFinite(v) ? v : 0);
}, 0);
const statsHtml = `<div style="position:absolute;right:12px;bottom:100px;
    background:rgba(255,255,255,.92);border:1.5px solid #1e293b;border-radius:3px;
    padding:5px 10px;font-size:9px;font-weight:700;color:#0f172a;font-family:Arial,sans-serif;
    text-align:right;white-space:nowrap;">
    Tổng: ${totalTru} trụ<br>
    Tổng cáp: ${totalCap.toFixed(0)} m
</div>`;
```

**Chèn `${statsHtml}` vào bên trong div print-frame**, ngay trước div khung tên (title block).

Không thay đổi gì khác.
```

---

### PROMPT 3.8 — Mở rộng modal: Người kiểm tra + Đơn vị

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Modal #printDrawingModal đã có các field: pdTuSelect, pdScale, pdPaper, pdTenTu, pdSoBanVe, pdNguoiLap, pdNgay
- _showPrintOverlay(opts) nhận { rows, tenTu, scale, ngay, nguoiLap, soBanVe }
- Title block hiện có hàng "CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN" và "CHIẾU SÁNG KHU VỰC TRUNG TÂM" — tên người trống
- Muốn: thêm 2 field nhập tên người vào modal + điền vào 2 ô đó trong title block

Nhiệm vụ: 3 thay đổi nhỏ.

**Thay đổi 1 — Thêm vào modal body (sau pd-row người lập/ngày):**
```html
<div class="pd-row">
  <div class="pd-item">
    <div class="pd-label">Chuyên viên phụ trách địa bàn</div>
    <input id="pdCVPhuTrach" class="pd-ctrl" type="text" placeholder="Tên chuyên viên">
  </div>
  <div class="pd-item">
    <div class="pd-label">Chiếu sáng khu vực</div>
    <input id="pdCSKhuVuc" class="pd-ctrl" type="text" placeholder="Tên phụ trách khu vực">
  </div>
</div>
```

**Thay đổi 2 — Trong `exportDrawingPDF()`**, thêm đọc 2 field mới:
```javascript
const cvPhuTrach = (document.getElementById('pdCVPhuTrach') || {}).value?.trim() || '';
const csKhuVuc   = (document.getElementById('pdCSKhuVuc')  || {}).value?.trim() || '';
```
Và truyền vào `_showPrintOverlay({ ..., cvPhuTrach, csKhuVuc })`.

**Thay đổi 3 — Trong `_showPrintOverlay(opts)`**, thêm `cvPhuTrach, csKhuVuc` vào destructure và điền vào 2 ô `tb-name-val` trống trong hàng 4 của title block:
```javascript
const { rows, tenTu, scale, ngay, nguoiLap, soBanVe, cvPhuTrach = '', csKhuVuc = '' } = opts;
// 2 td tên người (hàng 4, cột 1 và 2):
<td ...>${cvPhuTrach}</td>
<td ...>${csKhuVuc}</td>
```

Không thay đổi gì khác.
```

---

---

### PROMPT 4.1 — Khung tên 1/2 chiều rộng

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- `_showPrintOverlay()` có title block: `position:absolute;left:0;right:0;bottom:0;height:110px`
- Stats div: `position:absolute;right:12px;bottom:122px`
- Muốn: title block thu 50% chiều rộng, đặt góc dưới-phải

Nhiệm vụ: 2 thay đổi trong `_showPrintOverlay()`.

1. Title block div: đổi `left:0;right:0` → `right:0;width:50%`
2. Stats div: đổi `right:12px;bottom:122px` → `right:calc(50% + 12px);bottom:122px`

Không thay đổi gì khác.
```

---

### PROMPT 4.2 — Xem trước bản vẽ trước khi xuất PDF

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Modal #printDrawingModal có nút "Xuất PDF" (id="pdExportBtn")
- _showPrintOverlay(), _switchToPrintTile(), _zoomToScale(), _buildCableLines() đã có
- Muốn: nút "Xem trước" → hiện overlay trên bản đồ → kiểm tra rồi mới xuất

Nhiệm vụ: 3 thay đổi.

**1. Thêm biến state + 2 hàm mới (sau _hidePrintOverlay):**
```javascript
let _previewMode = false;

async function openPrintPreview() {
    const tuName     = (document.getElementById('pdTuSelect')   || {}).value || '';
    const scale      = parseInt((document.getElementById('pdScale') || {}).value) || 1000;
    const tenTu      = (document.getElementById('pdTenTu')      || {}).value?.trim() || '';
    const soBanVe    = (document.getElementById('pdSoBanVe')    || {}).value?.trim() || '';
    const nguoiLap   = (document.getElementById('pdNguoiLap')   || {}).value?.trim() || '';
    const ngay       = (document.getElementById('pdNgay')       || {}).value;
    const cvPhuTrach = (document.getElementById('pdCVPhuTrach') || {}).value?.trim() || '';
    const csKhuVuc   = (document.getElementById('pdCSKhuVuc')   || {}).value?.trim() || '';
    const rows = _filterRowsByTu(tuName);
    if (!rows.length) { displayError('Không có dữ liệu.'); return; }
    $('#printDrawingModal').modal('hide');
    _buildCableLines(rows);
    _switchToPrintTile();
    _zoomToScale(scale);
    await new Promise(r => setTimeout(r, 2000));
    _showPrintOverlay({ rows, tenTu: tenTu || tuName, scale, ngay, nguoiLap, soBanVe, cvPhuTrach, csKhuVuc });
    _previewMode = true;
    document.getElementById('printPreviewBar').style.display = 'flex';
}

function closePrintPreview() {
    _previewMode = false;
    _hidePrintOverlay();
    _removeCableLines();
    _restoreOriginalTiles();
    document.getElementById('printPreviewBar').style.display = 'none';
}
```

**2. Thanh nổi HTML (ngay sau thẻ mở `<div id="map"`):**
```html
<div id="printPreviewBar" style="display:none;position:absolute;top:12px;left:50%;
  transform:translateX(-50%);z-index:9000;background:#1e293b;color:white;
  border-radius:8px;padding:8px 16px;gap:10px;align-items:center;
  font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.4);">
  <span><i class="fa fa-eye"></i> Xem trước bản vẽ</span>
  <button onclick="exportDrawingPDF()" style="background:#2563eb;color:white;border:none;
    border-radius:5px;padding:5px 12px;cursor:pointer;font-weight:700;">
    <i class="fa fa-file-pdf-o"></i> Xuất PDF
  </button>
  <button onclick="closePrintPreview()" style="background:#475569;color:white;border:none;
    border-radius:5px;padding:5px 10px;cursor:pointer;">Đóng</button>
</div>
```

**3. Nút "Xem trước" vào modal footer (trước nút Xuất PDF):**
```html
<button type="button" class="btn btn-outline-secondary" onclick="openPrintPreview()">
  <i class="fa fa-eye"></i> Xem trước
</button>
```

**4. Sửa `exportDrawingPDF()`:** nếu `_previewMode === true`, bỏ qua build cables + switch tile + zoom + showOverlay (đã có), capture ngay.
```javascript
if (!_previewMode) {
    _buildCableLines(rows);
    _switchToPrintTile();
    _zoomToScale(scale);
    await new Promise(r => setTimeout(r, 3000));
    _showPrintOverlay({ ... });
    await new Promise(r => setTimeout(r, 200));
}
```
```

---

### PROMPT 4.3 — Capture đúng tỉ lệ landscape

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- exportDrawingPDF() dùng html2canvas capture #map
- Trên mobile, #map cao hơn rộng → PDF landscape bị méo tỉ lệ

Nhiệm vụ: Trong exportDrawingPDF(), ngay trước html2canvas, thêm:
```javascript
// Force landscape ratio
const mapEl = document.getElementById('map');
const origStyleW = mapEl.style.width;
const mmW = paper === 'a3' ? 420 : 297;
const mmH = paper === 'a3' ? 297 : 210;
const targetW = Math.round(mapEl.offsetHeight * mmW / mmH);
let resized = false;
if (mapEl.offsetWidth < targetW) {
    mapEl.style.width = targetW + 'px';
    map.invalidateSize({ animate: false });
    await new Promise(r => setTimeout(r, 500));
    resized = true;
}
```

Trong `finally`, sau `_restoreOriginalTiles()`:
```javascript
if (resized) {
    mapEl.style.width = origStyleW;
    map.invalidateSize({ animate: false });
}
```

Không thay đổi gì khác.
```

---

### PROMPT 4.4 — Toggle đường cáp trên bản đồ chính

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- _buildCableLines(rows) và _removeCableLines() đã có
- _filterRowsByTu(tuName): tuName=null/''/undefined trả về tất cả rows

Nhiệm vụ: 2 thay đổi.

**1. Thêm biến + hàm toggle (sau _removeCableLines):**
```javascript
let _cableVisible = false;
function toggleCableLayer() {
    _cableVisible = !_cableVisible;
    const btn = document.getElementById('btnToggleCable');
    if (_cableVisible) {
        _buildCableLines(_filterRowsByTu(null));
        if (btn) btn.classList.add('active');
    } else {
        _removeCableLines();
        if (btn) btn.classList.remove('active');
    }
}
```

**2. Nút trong controls panel (sau nút "In bản vẽ"):**
```html
<button id="btnToggleCable" onclick="toggleCableLayer()" class="ctrl-btn outline" style="margin-top:4px;">
  <i class="fa fa-share-alt"></i> Sơ đồ cáp
</button>
```

**3. Reset trong loadFromCSV() và loadFromExcel()** (sau dirtyMovedRows.clear()):
```javascript
if (_cableVisible) { _removeCableLines(); _cableVisible = false;
    const btn = document.getElementById('btnToggleCable');
    if (btn) btn.classList.remove('active');
}
```

Không thay đổi gì khác.
```

---

### PROMPT 4.5 — Tự động tính khoảng cách cáp khi chọn Marker gốc

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Popup chỉnh sửa marker có input "Marker gốc" (tên trụ cha) và input "Khoảng cách (m)"
- loadedData chứa tất cả rows, mỗi row: row[1]=tên, row[2]=lat, row[3]=lon
- Muốn: khi người dùng thay đổi Marker gốc → tự tính khoảng cách Haversine → điền vào ô Khoảng cách

Nhiệm vụ: 2 thay đổi nhỏ.

**1. Thêm hàm Haversine (đặt gần các hàm utility):**
```javascript
function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLon/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
```

**2. Trong HTML popup** (input Marker gốc), thêm handler `oninput` hoặc `onchange`:
```javascript
function onMarkerGocChange(parentName, childLat, childLon, distInputId) {
    if (!parentName || !Array.isArray(loadedData)) return;
    const pRow = loadedData.slice(1).find(r => String(r[1]).trim() === parentName.trim());
    if (!pRow) return;
    const pLat = parseCoord(pRow[2]), pLon = parseCoord(pRow[3]);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return;
    const dist = haversineM(childLat, childLon, pLat, pLon);
    const el = document.getElementById(distInputId);
    if (el && !el.value) el.value = dist; // chỉ điền nếu còn trống
}
```
Gọi từ `onchange` của input Marker gốc, truyền lat/lon của marker hiện tại.

Không thay đổi gì khác.
```

---

### PROMPT 4.6 — Nhớ field modal bằng localStorage

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- openPrintDrawingModal() điền pdNguoiLap từ currentUser nếu còn trống
- Muốn: pdCVPhuTrach, pdCSKhuVuc, pdNguoiLap được nhớ sau mỗi lần xuất/preview
- localStorage keys: 'pd_cvPhuTrach', 'pd_csKhuVuc', 'pd_nguoiLap'

Nhiệm vụ: 2 điểm sửa.

**1. Trong openPrintDrawingModal()** — sau khi điền nguoiLap từ currentUser, đọc localStorage:
```javascript
['pdCVPhuTrach','pdCSKhuVuc','pdNguoiLap'].forEach(id => {
    const el = document.getElementById(id);
    const key = 'pd_' + id;
    if (el && !el.value) el.value = localStorage.getItem(key) || '';
});
```

**2. Trong exportDrawingPDF() và openPrintPreview()** — sau khi đọc các field, lưu vào localStorage:
```javascript
if (cvPhuTrach) localStorage.setItem('pd_pdCVPhuTrach', cvPhuTrach);
if (csKhuVuc)   localStorage.setItem('pd_pdCSKhuVuc',   csKhuVuc);
if (nguoiLap)   localStorage.setItem('pd_pdNguoiLap',   nguoiLap);
```

Không thay đổi gì khác.
```

---

### PROMPT 4.7 — Sync banve-mau.html với overlay thực tế

```
Dự án: PWA khảo sát chiếu sáng — banve-mau.html.

Ngữ cảnh:
- banve-mau.html là file preview tĩnh, hiện đang lệch so với _showPrintOverlay() trong index.html
- Các thay đổi cần sync:
  1. Thêm dải tiêu đề (title header strip) ở top:0 bên trong .print-frame
     - Dòng 1: "BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ" (12px, bold)
     - Dòng 2: "TỦ ĐIỀU KHIỂN - [tên tủ mẫu]   TL: 1 : 1 000" (9px)
  2. Title block: cập nhật thành 4 hàng mới (hàng 1 = label gộp, hàng 2–3 trống, hàng 4 = tên)
  3. Stats div: góc dưới phải, "Tổng: N trụ / X m cáp"
  4. Height title block: 110px thay vì giá trị cũ

Nhiệm vụ: Rewrite banve-mau.html để visual match với _showPrintOverlay().
Giữ nguyên: .paper > .print-frame structure, map-bg background, legend-float, cable SVG lines.
Thay thế: title block HTML + thêm header strip + thêm stats div.
```

---

### PROMPT 4.8 — Phát hiện vòng lặp cáp trước khi vẽ

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- _buildCableLines(rows) vẽ polyline từ row[14] (tên cha) → row[1] (tên con)
- Nếu A.markerGoc=B và B.markerGoc=A → vẽ được nhưng sơ đồ sai (không báo lỗi)

Nhiệm vụ: Thêm hàm detect cycle + gọi trong _buildCableLines().

**Thêm hàm (đặt ngay trước _buildCableLines):**
```javascript
function _detectCableCycle(rows) {
    const parent = {};
    rows.forEach(r => {
        const name = String(r[1] || '').trim();
        const par  = String(r[14] || '').trim();
        if (name && par && name !== par) parent[name] = par;
    });
    for (const start of Object.keys(parent)) {
        const visited = new Set();
        let cur = start;
        while (cur && parent[cur]) {
            if (visited.has(cur)) return true;
            visited.add(cur); cur = parent[cur];
        }
    }
    return false;
}
```

**Đầu _buildCableLines(rows)**, thêm:
```javascript
if (_detectCableCycle(rows)) {
    displayError('⚠ Phát hiện vòng lặp Marker gốc — kiểm tra lại dữ liệu trước khi vẽ cáp.');
    return;
}
```

Không thay đổi gì khác.
```

---

### PROMPT 5.1 — Dropdown chọn tủ khi bật Sơ đồ cáp (multi-select)

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Nút "Sơ đồ cáp": id="btnToggleCable", onclick="toggleCableLayer()", line ~942
- toggleCableLayer() hiện tại gọi _buildCableLines(_filterRowsByTu(null)) — vẽ tất cả ngay
- Yêu cầu: khi click nút lần đầu (cables OFF) → mở dropdown chọn tủ trước khi vẽ
  Khi cables ON → click nút = tắt cáp ngay (không mở dropdown)

Nhiệm vụ:

**1. Thêm HTML dropdown** — đặt ngay sau thẻ `</div>` đóng controls panel cuối (trước `</div><!--/controlsModal-->`),
   hoặc đặt vào cuối `<body>` như modal (dùng `position:fixed`):
```html
<div id="cableDropdown" style="display:none;position:fixed;z-index:9500;
    background:white;border:1.5px solid #1e293b;border-radius:8px;
    padding:12px;min-width:220px;box-shadow:0 6px 24px rgba(0,0,0,.25);">
  <div style="font-size:11px;font-weight:800;color:#0f172a;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">
    Chọn tủ điều khiển
  </div>
  <div id="cableTuList" style="max-height:180px;overflow-y:auto;margin-bottom:10px;"></div>
  <div style="display:flex;gap:8px;">
    <button onclick="drawSelectedCables()" class="ctrl-btn" style="flex:1;font-size:12px;">
      <i class="fa fa-share-alt"></i> Vẽ sơ đồ cáp
    </button>
    <button onclick="document.getElementById('cableDropdown').style.display='none'"
            class="ctrl-btn outline" style="font-size:12px;padding:0 10px;">Đóng</button>
  </div>
</div>
```

**2. Thêm biến state** ngay sau `let _cableVisible = false;`:
```javascript
let _selectedTus = null; // null = tất cả; Set<string> = tủ đã chọn
```

**3. Thay thế `toggleCableLayer()`** bằng:
```javascript
function toggleCableLayer() {
    if (_cableVisible) {
        _cableVisible = false;
        _removeCableLines();
        const btn = document.getElementById('btnToggleCable');
        if (btn) btn.classList.remove('active');
        const editBtn = document.getElementById('btnCableEdit');
        if (editBtn) editBtn.style.display = 'none';
        return;
    }
    // Cables đang OFF → mở dropdown chọn tủ
    const dd = document.getElementById('cableDropdown');
    // Populate danh sách tủ
    const tus = [...new Set(
        (loadedData || []).slice(1)
            .map(r => String(r[7] || '').trim())
            .filter(Boolean)
    )].sort();
    const list = document.getElementById('cableTuList');
    list.innerHTML = `
        <label style="display:flex;align-items:center;gap:7px;font-size:11px;padding:3px 0;cursor:pointer;font-weight:700;">
          <input type="checkbox" id="cbAllTus" onchange="toggleAllTuCbs(this.checked)" checked>
          Tất cả tủ
        </label>
        <hr style="margin:4px 0;border:none;border-top:1px solid #e2e8f0;">
        ${tus.map(t => `
          <label style="display:flex;align-items:center;gap:7px;font-size:11px;padding:2px 0;cursor:pointer;">
            <input type="checkbox" class="cb-tu" value="${t.replace(/"/g,'&quot;')}" checked
                   onchange="onTuCbChange()"> ${t}
          </label>`).join('')}
        ${tus.length === 0 ? '<div style="font-size:11px;color:#94a3b8;">Không có dữ liệu tủ</div>' : ''}
    `;
    // Vị trí dropdown theo nút bấm
    const btn = document.getElementById('btnToggleCable');
    const rect = btn.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 6) + 'px';
    dd.style.left = rect.left + 'px';
    dd.style.display = 'block';
    setTimeout(() => {
        document.addEventListener('click', _onOutsideCableDropdown, { capture: true, once: true });
    }, 0);
}

function _onOutsideCableDropdown(e) {
    const dd = document.getElementById('cableDropdown');
    if (!dd) return;
    if (!dd.contains(e.target) && e.target.id !== 'btnToggleCable') {
        dd.style.display = 'none';
    } else if (dd.contains(e.target)) {
        // click bên trong → đăng ký lại lần sau
        document.addEventListener('click', _onOutsideCableDropdown, { capture: true, once: true });
    }
}

function toggleAllTuCbs(checked) {
    document.querySelectorAll('.cb-tu').forEach(cb => cb.checked = checked);
}

function onTuCbChange() {
    const all = [...document.querySelectorAll('.cb-tu')].every(cb => cb.checked);
    const cbAll = document.getElementById('cbAllTus');
    if (cbAll) cbAll.checked = all;
}

function drawSelectedCables() {
    document.getElementById('cableDropdown').style.display = 'none';
    const cbAll = document.getElementById('cbAllTus');
    const allChecked = cbAll && cbAll.checked;
    if (allChecked) {
        _selectedTus = null;
    } else {
        _selectedTus = new Set(
            [...document.querySelectorAll('.cb-tu:checked')].map(cb => cb.value)
        );
    }
    const rows = _selectedTus
        ? (loadedData || []).slice(1).filter(r => _selectedTus.has(String(r[7] || '').trim()))
        : (loadedData || []).slice(1);
    _buildCableLines(rows);
    _cableVisible = true;
    const btn = document.getElementById('btnToggleCable');
    if (btn) btn.classList.add('active');
    const editBtn = document.getElementById('btnCableEdit');
    if (editBtn) editBtn.style.display = '';
}
```

**4. Thêm nút "Sửa cáp"** vào HTML, ngay sau `btnToggleCable` button (ẩn mặc định):
```html
<button id="btnCableEdit" onclick="toggleCableEditMode()" class="ctrl-btn outline"
        style="margin-top:4px;display:none;">
    <i class="fa fa-pencil"></i> Sửa cáp
</button>
```

Không thay đổi gì khác.
```

---

### PROMPT 5.2 — Chế độ chỉnh sửa cáp trực tiếp trên bản đồ

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Sau PROMPT 5.1: `btnCableEdit` đã có trong HTML (display:none)
- _buildCableLines() đã có, mỗi L.polyline vẽ 1 đoạn cáp từ row[14]→row[1]
- Yêu cầu: chế độ "Sửa cáp" cho phép click vào đường cáp → xóa hoặc đổi trụ cha
  Thay đổi phải sync về GAS (syncRowToGAS đã có)

Nhiệm vụ:

**1. Thêm state** ngay sau `let _selectedTus = null;`:
```javascript
let _cableEditMode = false;
let _pickParentActive = false; // đang chờ user click trụ cha mới
```

**2. Thêm hàm `toggleCableEditMode()`** ngay sau `drawSelectedCables()`:
```javascript
function toggleCableEditMode() {
    _cableEditMode = !_cableEditMode;
    const btn = document.getElementById('btnCableEdit');
    if (btn) {
        btn.classList.toggle('active', _cableEditMode);
        btn.innerHTML = _cableEditMode
            ? '<i class="fa fa-pencil"></i> Đang sửa cáp'
            : '<i class="fa fa-pencil"></i> Sửa cáp';
    }
    // Redraw để attach / detach handlers
    const rows = _selectedTus
        ? (loadedData || []).slice(1).filter(r => _selectedTus.has(String(r[7] || '').trim()))
        : (loadedData || []).slice(1);
    _buildCableLines(rows);
}
```

**3. Sửa `_buildCableLines()`** — sau dòng `L.polyline([from, to], {...}).addTo(_cableLayerGroup)`:
Hiện tại:
```javascript
                L.polyline([from, to], {
                    color: '#1e40af', weight: 2.5, dashArray: '7 5', opacity: 0.8
                }).addTo(_cableLayerGroup);
                cableCount++;
```
Thay bằng:
```javascript
                const line = L.polyline([from, to], {
                    color: '#1e40af', weight: 2.5, dashArray: '7 5', opacity: 0.8
                });
                line._cableRow = r;
                line.addTo(_cableLayerGroup);
                if (_cableEditMode) _attachCableEditHandler(line);
                cableCount++;
```

**4. Thêm các hàm edit** ngay sau `_removeCableLines()`:
```javascript
function _attachCableEditHandler(line) {
    line.setStyle({ weight: 4, opacity: 1, cursor: 'pointer' });
    line.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        _showCableContextMenu(e.latlng, line._cableRow);
    });
}

function _showCableContextMenu(latlng, row) {
    const childName  = String(row[1]  || '').trim();
    const parentName = String(row[14] || '').trim();
    const dist       = String(row[15] || '').trim();
    const popup = L.popup({ closeButton: true, className: 'cable-ctx-popup' })
        .setLatLng(latlng)
        .setContent(`
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;">
                Cáp: <span style="color:#1e40af;">${childName}</span>
                ← ${parentName}${dist ? ' <span style="color:#64748b;">('+dist+'m)</span>' : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <button onclick="_deleteCableSegment(${JSON.stringify(childName)}); map.closePopup();"
                    style="background:#ef4444;color:white;border:none;border-radius:5px;
                           padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">
                    🗑 Xóa đoạn cáp này
                </button>
                <button onclick="map.closePopup(); _pickParentMode(${JSON.stringify(childName)});"
                    style="background:#1e40af;color:white;border:none;border-radius:5px;
                           padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">
                    ↩ Đổi điểm gốc (trụ cha)
                </button>
            </div>
        `)
        .openOn(map);
}

function _deleteCableSegment(childName) {
    if (!Array.isArray(loadedData)) return;
    const row = loadedData.slice(1).find(r => String(r[1] || '').trim() === childName);
    if (!row) return;
    row[14] = '';
    row[15] = '';
    syncRowToGAS(row, { silent: true });
    _rebuildCableLines();
    displaySuccess('Đã xóa đoạn cáp: ' + childName);
}

function _pickParentMode(childName) {
    if (_pickParentActive) return;
    _pickParentActive = true;
    displayInfo('Click vào trụ/tủ để đặt làm điểm gốc cáp cho ' + childName + '. Nhấn ESC để hủy.');
    map.getContainer().style.cursor = 'crosshair';
    const onMapClick = function(e) {
        // Tìm marker gần nhất trong bán kính 40px
        let nearest = null, nearestDist = Infinity;
        map.eachLayer(function(layer) {
            if (layer instanceof L.Marker && layer._rowRef) {
                const p = map.latLngToContainerPoint(layer.getLatLng());
                const q = map.latLngToContainerPoint(e.latlng);
                const d = Math.hypot(p.x - q.x, p.y - q.y);
                if (d < 40 && d < nearestDist) { nearest = layer; nearestDist = d; }
            }
        });
        map.off('click', onMapClick);
        document.removeEventListener('keydown', onEsc);
        _pickParentActive = false;
        map.getContainer().style.cursor = '';
        if (!nearest) { displayError('Không tìm thấy trụ/tủ tại vị trí đó.'); return; }
        const newParentName = String(nearest._rowRef[1] || '').trim();
        if (!newParentName || newParentName === childName) return;
        const row = (loadedData || []).slice(1).find(r => String(r[1] || '').trim() === childName);
        if (!row) return;
        const pLat = parseCoord(nearest._rowRef[2]), pLon = parseCoord(nearest._rowRef[3]);
        const cLat = parseCoord(row[2]), cLon = parseCoord(row[3]);
        row[14] = newParentName;
        row[15] = (Number.isFinite(pLat) && Number.isFinite(cLat))
            ? haversineM(cLat, cLon, pLat, pLon) : '';
        syncRowToGAS(row, { silent: true });
        _rebuildCableLines();
        displaySuccess('Đã đổi điểm gốc: ' + childName + ' ← ' + newParentName);
    };
    const onEsc = function(e) {
        if (e.key !== 'Escape') return;
        map.off('click', onMapClick);
        document.removeEventListener('keydown', onEsc);
        _pickParentActive = false;
        map.getContainer().style.cursor = '';
    };
    map.on('click', onMapClick);
    document.addEventListener('keydown', onEsc);
}

function _rebuildCableLines() {
    const rows = _selectedTus
        ? (loadedData || []).slice(1).filter(r => _selectedTus.has(String(r[7] || '').trim()))
        : (loadedData || []).slice(1);
    _buildCableLines(rows);
}
```

**5. Thêm CSS** cho popup context cáp, vào phần `<style>`:
```css
.cable-ctx-popup .leaflet-popup-content-wrapper {
    border-radius: 8px; border: 1.5px solid #1e293b; padding: 0;
}
.cable-ctx-popup .leaflet-popup-content { margin: 12px; }
```

Lưu ý:
- `syncRowToGAS(row, {silent:true})` đã tồn tại trong codebase
- `displaySuccess()` / `displayError()` / `displayInfo()` đã tồn tại
- `layer._rowRef` cần được gán khi tạo marker trong `addMarkerRowToMap()` — kiểm tra xem đã có chưa;
  nếu chưa thì tìm nơi tạo `L.marker(...)` trong `addMarkerRowToMap()` và thêm `marker._rowRef = row;`
- `parseCoord()` và `haversineM()` đã tồn tại

Không thay đổi gì khác.
```

---

### PROMPT 5.3 — Xoay bản đồ khi xuất PDF

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- exportDrawingPDF() dùng html2canvas để chụp #map rồi đưa vào jsPDF
- Người dùng cần xoay góc nhìn bản đồ để đường phố chạy ngang tờ giấy
- Yêu cầu: xoay chỉ phần nội dung bản đồ (tile + marker + cáp), KHÔNG xoay title block / legend
  → Rotate .leaflet-map-pane (chứa toàn bộ Leaflet layer) trước khi capture, restore sau
- preview mode (openPrintPreview) cũng cần apply rotation

Cấu trúc DOM trong #map:
  #map
    ├── .leaflet-pane .leaflet-map-pane   ← ROTATE ĐÂY
    │      ├── .leaflet-tile-pane
    │      ├── .leaflet-overlay-pane      (cáp polyline)
    │      └── .leaflet-marker-pane
    └── #printOverlay                     ← KHÔNG rotate (title block, legend)

Nhiệm vụ:

**1. Thêm slider vào modal** — sau row Ngày (`pdNgay`), trước row `pdCVPhuTrach`:
```html
<div class="pd-row">
  <div class="pd-item" style="flex:1;">
    <div class="pd-label">Xoay bản đồ</div>
    <div style="display:flex;align-items:center;gap:10px;">
      <input id="pdRotation" type="range" min="-60" max="60" value="0" step="1"
             style="flex:1;"
             oninput="document.getElementById('pdRotationVal').textContent=this.value+'°'">
      <span id="pdRotationVal"
            style="font-size:12px;font-weight:700;color:#1e293b;min-width:34px;text-align:right;">0°</span>
    </div>
  </div>
</div>
```

**2. Thêm 2 hàm** ngay trước `_switchToPrintTile()`:
```javascript
function _applyMapRotation(angle) {
    if (!angle) return;
    const mapEl = document.getElementById('map');
    const pane  = mapEl && mapEl.querySelector('.leaflet-map-pane');
    if (!pane) return;
    // transform-origin = center of #map viewport, relative to pane's top-left
    const mapRect  = mapEl.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    const ox = mapRect.left + mapRect.width  / 2 - paneRect.left;
    const oy = mapRect.top  + mapRect.height / 2 - paneRect.top;
    const base = (pane.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
    pane.style.transformOrigin = `${ox}px ${oy}px`;
    pane.style.transform = base + ` rotate(${angle}deg)`;
}

function _clearMapRotation() {
    const pane = document.querySelector('#map .leaflet-map-pane');
    if (!pane) return;
    pane.style.transform = (pane.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
    pane.style.transformOrigin = '';
}
```

**3. Trong `exportDrawingPDF()`** — đọc rotation và apply sau `_switchToPrintTile()` / sau `_showPrintOverlay()`:

Tìm đoạn:
```javascript
        if (!_previewMode) {
            _buildCableLines(rows);
            _switchToPrintTile();
            _zoomToScale(scale);
            await new Promise(r => setTimeout(r, 3000));
            _showPrintOverlay({
```
Thêm `const rotation` trước `if (!_previewMode)` và `_applyMapRotation` sau `_showPrintOverlay(...)`:
```javascript
        const rotation = parseFloat(document.getElementById('pdRotation')?.value) || 0;
        if (!_previewMode) {
            _buildCableLines(rows);
            _switchToPrintTile();
            _zoomToScale(scale);
            await new Promise(r => setTimeout(r, 3000));
            _showPrintOverlay({ ... });        // (giữ nguyên nội dung)
            _applyMapRotation(rotation);
            await new Promise(r => setTimeout(r, 300));
        }
```

Trong `finally` block của `exportDrawingPDF()`, thêm `_clearMapRotation()`:
```javascript
        } finally {
            _clearMapRotation();
            _hidePrintOverlay();
            // ... (các dòng restore khác giữ nguyên)
        }
```

**4. Trong `openPrintPreview()`** — apply rotation sau `_showPrintOverlay(...)`:
Tìm dòng gọi `_showPrintOverlay(...)` trong `openPrintPreview()` và thêm ngay sau:
```javascript
    _applyMapRotation(parseFloat(document.getElementById('pdRotation')?.value) || 0);
```

Trong `closePrintPreview()`, thêm `_clearMapRotation()` trước `_hidePrintOverlay()`:
```javascript
function closePrintPreview() {
    _previewMode = false;
    _clearMapRotation();
    _hidePrintOverlay();
    // ... giữ nguyên
}
```

**5. Reset slider khi mở modal** — trong `openPrintDrawingModal()`, thêm:
```javascript
    const rotEl = document.getElementById('pdRotation');
    if (rotEl) { rotEl.value = 0; document.getElementById('pdRotationVal').textContent = '0°'; }
```

Không thay đổi gì khác.
```

---

---

## TÍNH NĂNG 6: Sửa lỗi & cải tiến form chỉnh sửa marker ✅

---

### PROMPT 6.1 — Fix chế độ Edit marker (`_editingRow`)

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề hiện tại:
- saveMarkerPopup() luôn tạo marker MỚI dù đang sửa marker cũ → dữ liệu bị nhân đôi
- Khi đổi tên marker khi sửa → GAS không tìm được row cũ (ID bị mất)
- Nút Lưu bị gọi 2 lần do có cả onclick attribute lẫn addEventListener

Nhiệm vụ: 4 thay đổi.

**1. Thêm biến state** ngay sau `let _currentPopupRow = null;`:
```javascript
let _editingRow = null; // row đang sửa (null = thêm mới)
```

**2. `openEditMarker()`** — set `_editingRow = row` TRƯỚC khi gọi `showMarkerPopupAt()`:
```javascript
_editingRow = row;
...
showMarkerPopupAt(lat, lon);
// Hủy geocoding — dùng dữ liệu từ row
_pendingGeocodePromise = Promise.resolve(null);
```

Trong setTimeout (80ms), điền đầy đủ field từ row (cabinet trước, name sau + dispatch input),
khôi phục ảnh cũ vào `#markerImagePreview`, khôi phục placeholder Đường/Phường.

**3. `hideMarkerPopup()`** — thêm `_editingRow = null;` sau `markerPopupLocation = null;`

**4. `saveMarkerPopup()`** — tách 2 nhánh sau khi build `newRow`:

```javascript
if (_editingRow) {
    // EDIT: giữ ID, xóa marker cũ, update row in-place, tạo marker mới
    const existingId = _editingRow[0];
    // Xóa marker cũ khỏi map + labelLayerGroup
    // Cập nhật _editingRow[] in-place (giữ id, tất cả field khác ghi đè)
    const rowRef = _editingRow; // lưu trước hideMarkerPopup() reset về null
    hideMarkerPopup();
    syncRowToGAS(rowRef);
    _logAction('edit', rowRef, {...});
    displayError('Đã cập nhật marker...');
} else {
    // ADD: logic cũ
    loadedData.push(newRow); newMarkerRows.push(newRow);
    ...
}
```

**5. Xóa addEventListener trùng** — bỏ đoạn:
```javascript
if (saveBtn) saveBtn.addEventListener('click', saveMarkerPopup);
if (cancelBtn) cancelBtn.addEventListener('click', cancelMarkerPopup);
```
(onclick đã khai báo trong HTML)

Không thay đổi gì khác.
```

---

### PROMPT 6.2 — Cải tiến dropdown Marker gốc (baseSelect)

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề hiện tại:
- Regex normalizeMarkerBaseName dùng /[\s\-]*\d+$/ → không strip dấu _ → VTS_H232VTS_19 cho basename VTS_H232VTS_ (thừa _), không khớp với tủ VTS_H232VTS
- Tủ điều khiển không xuất hiện trong baseSelect
- Chọn option trong baseSelect không cập nhật markerGocInput → khi lưu dùng giá trị cũ

Nhiệm vụ: 3 thay đổi.

**1. Sửa regex** trong `normalizeMarkerBaseName()`:
```javascript
const base = (name || '').toString().trim().replace(/[_\s\-]*\d+$/, '');
```
(thêm `_` vào character class)

**2. Trong `showMarkerPopupAt()`**, thay `baseSelect.onchange = updateBaseDistanceInfo` bằng hàm `_fillBaseSelect()` mới:
- Luôn thêm tủ (từ `cabinetInput.value`) vào đầu list với nhãn `[tủ]`
- Sau đó các marker cùng basename
- Gọi `_fillBaseSelect` từ `oninput` của cả `nameInput` và `cabinetInput`

**3. `baseSelect.onchange`** — ngoài `updateBaseDistanceInfo`, cũng sync sang `markerGocInput` và `markerKhoangCachInput`:
```javascript
const bm = markers[parseInt(baseSelect.value, 10)];
if (bm) {
    gocEl.value = bm.name;
    kEl.value = Math.round(getDistanceMeters(bm.lat, bm.lon, markerPopupLocation[0], markerPopupLocation[1]));
}
```

**4. `openEditMarker()` setTimeout** — sau khi set cabinet + name + dispatch input, pre-select option khớp `row[14]`:
```javascript
const matchOpt = Array.from(bsel.options).find(o => {
    const m = markers[parseInt(o.value, 10)];
    return m && m.name.trim() === linkedGoc;
});
if (matchOpt) { bsel.value = matchOpt.value; bsel.dispatchEvent(new Event('change')); }
```

Không thay đổi gì khác.
```

---

### PROMPT 6.3 — Nhãn khoảng cách cáp luôn hiển thị

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề: nhãn số mét chỉ hiện khi row[15] có giá trị. Nếu trống → không có nhãn.

Nhiệm vụ: Trong `_buildCableLines()`, luôn vẽ nhãn — dùng row[15] nếu có, tính Haversine nếu không:

```javascript
const distVal = String(r[15] || '').trim();
const distLabel = distVal || String(haversineM(from[0], from[1], to[0], to[1]));
const mid = [(from[0]+to[0])/2, (from[1]+to[1])/2];
L.marker(mid, {
    icon: L.divIcon({ className:'cable-label', html:`<span>${distLabel}m</span>`, iconSize:null, iconAnchor:[20,10] }),
    interactive: false, keyboard: false
}).addTo(_cableLayerGroup);
```

Không thay đổi gì khác.
```

---

## THỨ TỰ CHẠY KHUYẾN NGHỊ

```
1.1 → gas-khaosat.js: thêm log_action              ✅ done
1.2 → index.html: thêm _logAction() + hook 3 điểm  ✅ done
1.3 → lichsu.html: tạo trang mới                   ✅ done
1.4 → index.html: hiện option Lịch sử cho admin    ✅ done

2.1 → index.html: logic push version.json           ✅ done
2.2 → index.html: badge version trong topbar        ✅ done

3.1 → index.html: nút In bản vẽ + _loadPrintLibs() ✅ done
3.2 → index.html: modal HTML + openPrintDrawingModal() ✅ done
3.3 → index.html: _buildCableLines() + helpers      ✅ done
3.4 → index.html: tile switch + overlay legend/titleblock ✅ done
3.5 → index.html: exportDrawingPDF() main function  ✅ done
3.6 → index.html: _zoomToScale()                   ✅ done
3.7 → index.html: stats trụ/cáp trong overlay      ✅ done
3.8 → index.html: field cvPhuTrach + csKhuVuc       ✅ done

4.1 → index.html: title block 62.5% chiều rộng                    ✅ done
4.2 → index.html: nút Xem trước + preview bar                      ✅ done
4.3 → index.html: force landscape ratio trước capture              ✅ done
4.4 → index.html: toggle đường cáp trên bản đồ chính              ✅ done
4.5 → index.html: tự động tính khoảng cách Haversine              ✅ done
4.6 → index.html: localStorage nhớ field modal                     ✅ done
4.7 → banve-mau.html: sync lại với _showPrintOverlay()             ✅ done
4.8 → index.html: cycle detection trước _buildCableLines()         ✅ done

5.1 → index.html: dropdown chọn tủ khi bật sơ đồ cáp (multi-select)    ✅ done
5.2 → index.html: chế độ sửa cáp — xóa đoạn, đổi điểm gốc trực tiếp    ✅ done
5.3 → index.html: xoay bản đồ khi xuất PDF (slider -60°→+60°)          ✅ done

6.1 → index.html: fix edit marker (_editingRow, double-listener, rowRef) ✅ done
6.2 → index.html: cải tiến baseSelect (tủ luôn hiện, sync markerGocInput) ✅ done
6.3 → index.html: nhãn khoảng cách cáp luôn hiển thị (Haversine fallback) ✅ done
```

⚠️ Việc cần làm TRƯỚC KHI CHẠY 5.x:
→ Redeploy GAS New version (header VN2000 từ session trước)

7.1 → index.html: DISTRICT_PAGES config + currentSheet + _buildDistrictOptions()   ⬜
7.2 → index.html: switchDistrict() + #pages onchange integration                   ⬜
7.3 → index.html: syncRowToGAS / deleteMarker / _logAction thêm sheet param        ⬜
7.4 → gas-khaosat.js: getSheet() helper + findRowNum nhận sheet param              ⬜
7.5 → index.html: generateId() prefix theo địa bàn + Excel filename theo sheet     ⬜
7.6 → gas-khaosat.js: setupDistrictSheets() + sw.js bump + hướng dẫn publish CSV  ⬜
```

---

## TÍNH NĂNG 7: Đa địa bàn — nhiều sheet theo quận/huyện/xã ✅

Mục tiêu: Mỗi địa bàn hành chính (quận, huyện, xã, phường) lưu trên 1 tab sheet riêng trong
cùng 1 Google Spreadsheet. Người dùng chuyển địa bàn qua dropdown "Chọn trang". Thực hiện
theo thứ tự 7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6.

---

### PROMPT 7.1 — Config DISTRICT_PAGES + state currentSheet + render dropdown

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Toàn bộ app trong 1 file index.html (HTML+CSS+JS).
- KHAOSAT_CSV_URL và KHAOSAT_GAS_URL đã khai báo ở đầu JS (const).
- Dropdown #pages (trong controlsModal) hiện có các option tĩnh (index.html, lichsu.html, v.v.).
- Hàm _applyRoleUI() gọi sau đăng nhập để ẩn/hiện UI theo role.
- Hiện tại chỉ có 1 sheet DanhSachTru — mọi thao tác đọc/ghi đều hướng về đó.

Nhiệm vụ: 3 thay đổi trong index.html.

**Thay đổi 1 — Thêm config array ngay sau khai báo KHAOSAT_CSV_URL:**
```javascript
const DISTRICT_PAGES = [
    { label: 'Tổng quan',       sheet: 'DanhSachTru', csvUrl: KHAOSAT_CSV_URL },
    { label: 'Quận 1',          sheet: 'Quan1',       csvUrl: '' },
    { label: 'Quận 3',          sheet: 'Quan3',       csvUrl: '' },
    { label: 'Quận 5',          sheet: 'Quan5',       csvUrl: '' },
    { label: 'Quận 8',          sheet: 'Quan8',       csvUrl: '' },
    { label: 'Quận 10',         sheet: 'Quan10',      csvUrl: '' },
    { label: 'Quận 11',         sheet: 'Quan11',      csvUrl: '' },
    { label: 'Phú Nhuận',       sheet: 'PhuNhuan',    csvUrl: '' },
    { label: 'Bình Thạnh',      sheet: 'BinhThanh',   csvUrl: '' },
    { label: 'Tân Bình',        sheet: 'TanBinh',     csvUrl: '' },
    { label: 'Tân Phú',         sheet: 'TanPhu',      csvUrl: '' },
    { label: 'Xã Bàu Bàng',     sheet: 'BauBang',     csvUrl: '' },
    { label: 'Xã Trừ Văn Thố',  sheet: 'TruVanTho',   csvUrl: '' },
    { label: 'Phường Bến Cát',  sheet: 'BenCat',      csvUrl: '' },
];

let currentSheet = 'DanhSachTru'; // sheet địa bàn đang hiển thị
```

Ghi chú: Người dùng sẽ điền csvUrl sau khi publish từng tab trong Google Sheet.

**Thay đổi 2 — Thêm hàm `_buildDistrictOptions()` vào JS (đặt gần _applyRoleUI):**
```javascript
function _buildDistrictOptions() {
    const sel = document.getElementById('pages');
    if (!sel) return;
    // Xóa các option địa bàn cũ (value bắt đầu bằng "district_")
    [...sel.options].filter(o => o.value.startsWith('district_')).forEach(o => o.remove());
    // Thêm optgroup địa bàn vào đầu select (trước option "Trang khảo sát")
    const firstOpt = sel.querySelector('option');
    DISTRICT_PAGES.forEach(page => {
        const opt = document.createElement('option');
        opt.value = 'district_' + page.sheet;
        opt.textContent = page.label;
        if (page.sheet === currentSheet) opt.selected = true;
        sel.insertBefore(opt, firstOpt);
    });
}
```

**Thay đổi 3 — Gọi `_buildDistrictOptions()` trong `_applyRoleUI()`:**
Tìm hàm `_applyRoleUI()`, thêm vào cuối thân hàm:
```javascript
_buildDistrictOptions();
```

Không thay đổi gì khác.
```

---

### PROMPT 7.2 — Hàm switchDistrict() + hook vào #pages onchange

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh sau PROMPT 7.1:
- DISTRICT_PAGES array và currentSheet đã khai báo.
- _buildDistrictOptions() đã tồn tại, render option có value="district_<sheetName>".
- Dropdown #pages có onchange="navigateToPage()" — hàm hiện tại dùng window.location.href
  để điều hướng tới URL. Cần mở rộng để xử lý riêng các option địa bàn (không navigate URL).
- Hàm loadFromCSV(url) đã có: tải CSV, parse, gọi addMarkerRowToMap(), cập nhật map.
- Hàm clearAllMarkers() đã có: xóa toàn bộ marker khỏi map + reset loadedData.
  (Nếu chưa có tên này, tìm đoạn code xóa marker tương đương và dùng đó.)
- displayError(msg, type) đã có — toast notification.
- Element hiển thị tên địa bàn hiện tại: cần thêm mới (xem bên dưới).

Nhiệm vụ:

**1. Thêm hàm `switchDistrict(sheetName)` vào JS (đặt gần loadFromCSV):**
```javascript
async function switchDistrict(sheetName) {
    const page = DISTRICT_PAGES.find(p => p.sheet === sheetName);
    if (!page) return;
    if (!page.csvUrl) {
        displayError('Địa bàn "' + page.label + '" chưa có URL dữ liệu. Vui lòng cấu hình csvUrl trong DISTRICT_PAGES.');
        return;
    }
    currentSheet = sheetName;
    // Xóa toàn bộ marker + data hiện tại
    clearAllMarkers();
    // Tải CSV của địa bàn mới
    displayError('Đang tải dữ liệu ' + page.label + '...');
    await loadFromCSV(page.csvUrl);
    // Cập nhật nhãn địa bàn hiện tại trong UI
    const lbl = document.getElementById('currentDistrictLabel');
    if (lbl) lbl.textContent = page.label;
    // Sync lại dropdown
    const sel = document.getElementById('pages');
    if (sel) sel.value = 'district_' + sheetName;
}
```

**2. Sửa hàm `navigateToPage()`** — thêm xử lý option địa bàn TRƯỚC logic navigate URL:
```javascript
function navigateToPage() {
    const sel = document.getElementById('pages');
    const val = sel ? sel.value : '';
    if (val.startsWith('district_')) {
        const sheetName = val.replace('district_', '');
        switchDistrict(sheetName);
        return; // không navigate URL
    }
    // Logic cũ giữ nguyên (window.location.href = val)
    if (val && val !== window.location.pathname.split('/').pop()) {
        window.location.href = val;
    }
}
```

**3. Thêm nhãn địa bàn hiện tại vào HTML** — trong topbar (sau chip user hoặc sau nút hamburger),
thêm element hiển thị tên địa bàn:
```html
<span id="currentDistrictLabel"
      style="font-size:11px;font-weight:700;color:rgba(255,255,255,.75);
             background:rgba(255,255,255,.12);border-radius:999px;
             padding:2px 9px;flex-shrink:0;display:none;">
</span>
```
Trong `switchDistrict()` sau khi set textContent, thêm:
```javascript
if (lbl) lbl.style.display = sheetName === 'DanhSachTru' ? 'none' : 'inline';
```

Không thay đổi gì khác.
```

---

### PROMPT 7.3 — Client: thêm sheet param vào syncRowToGAS, deleteMarker, _logAction

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh sau PROMPT 7.1–7.2:
- `currentSheet` là biến global, lưu tên sheet đang hiển thị (mặc định 'DanhSachTru').
- GAS action `full_update` ghi vào sheet DanhSachTru cứng trong code GAS.
  → Cần truyền thêm field `sheet` để GAS biết ghi vào tab nào.
- Tương tự `delete_row` và `log_action`.

Nhiệm vụ: 3 thay đổi nhỏ, chỉ thêm 1 field vào payload.

**1. Hàm `syncRowToGAS(row, opts)` (hoặc tên tương đương gửi action=full_update):**
Tìm đoạn build payload gửi GAS, thêm field `sheet`:
```javascript
// Tìm object payload có action: 'full_update', thêm:
sheet: currentSheet,
```
Ví dụ: nếu payload là `const payload = { action: 'full_update', id: ..., tenTru: ... }`,
thêm `, sheet: currentSheet` vào sau action.

**2. Hàm `deleteMarker()` (hoặc nơi gửi action=delete_row):**
Tìm object payload gửi delete_row, thêm:
```javascript
sheet: currentSheet,
```

**3. Hàm `_logAction(loaiThaoTac, row, chiTiet)` (gửi action=log_action):**
Tìm object payload gửi log_action, thêm:
```javascript
sheet: currentSheet,
```

Lưu ý: Chỉ thêm 1 field vào payload, KHÔNG sửa gì khác. GAS sẽ đọc `data.sheet` để
chọn đúng tab — implement phía GAS ở PROMPT 7.4.

Không thay đổi gì khác.
```

---

### PROMPT 7.4 — GAS: getSheet() helper + findRowNum nhận sheet làm tham số

```
Dự án: PWA khảo sát chiếu sáng — gas-khaosat.js (Google Apps Script).

Ngữ cảnh:
- Hiện tại doPost() hardcode: `const sheet = ss.getSheetByName('DanhSachTru');`
- Client sau PROMPT 7.3 gửi thêm field `data.sheet` (tên tab sheet) trong mọi action ghi.
- Cần GAS route đúng tab theo `data.sheet`, fallback về 'DanhSachTru' nếu rỗng/không tồn tại.

Nhiệm vụ:

**1. Thêm hàm helper `getSheet(name)` vào gas-khaosat.js** (đặt trước doPost()):
```javascript
function getSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(name || 'DanhSachTru') || ss.getSheetByName('DanhSachTru');
}
```

**2. Thay thế tất cả** `ss.getSheetByName('DanhSachTru')` trong doPost() và các hàm được
doPost() gọi (handleFullUpdate, handleDeleteRow, findRowNum, ensureHeader, v.v.) bằng
`getSheet(data.sheet)` (hoặc truyền sheet qua tham số).

Pattern tìm-thay:
- `const sheet = ss.getSheetByName('DanhSachTru');`
  → `const sheet = getSheet(data.sheet);`
- Nếu các hàm con (handleFullUpdate(data), handleDeleteRow(data)) nhận `data` làm tham số,
  chúng đã truy cập được `data.sheet` → chỉ cần đổi dòng getSheetByName bên trong chúng.

**3. Hàm `ensureHeader(sheet)`** hiện tại có thể hardcode header hoặc copy từ DanhSachTru.
Không thay đổi logic ensureHeader — chỉ đảm bảo nó nhận `sheet` object làm tham số
(không gọi getSheetByName bên trong nếu đã có sheet object).

**4. Hàm `log_action` (handleLogAction)** ghi vào sheet 'LichSu' — KHÔNG thay đổi,
log luôn vào LichSu bất kể địa bàn nào.

**5. Hàm `login`** đọc từ sheet 'TaiKhoan' — KHÔNG thay đổi.

Sau khi sửa: Redeploy GAS New version (không tạo deployment mới — URL giữ nguyên).

Không thay đổi gì khác.
```

---

### PROMPT 7.5 — generateId() prefix theo địa bàn + Excel filename theo sheet

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh sau PROMPT 7.1–7.3:
- currentSheet lưu tên sheet hiện tại (vd: 'Quan1', 'BauBang', 'DanhSachTru').
- Khi thêm marker mới, ID được sinh tự động.
  Hiện tại: ID dạng 'TQ_001', 'TQ_002'... (hoặc format khác tuỳ code hiện tại).
  Yêu cầu: prefix thay đổi theo currentSheet để tránh trùng ID giữa các địa bàn.
- updateGitHubExcel() push Excel lên GitHub với tên file cố định 'data/khaosat.xlsx'.
  Yêu cầu: tên file thay đổi theo currentSheet.

Nhiệm vụ:

**1. Thêm mapping prefix** ngay sau khai báo DISTRICT_PAGES:
```javascript
const SHEET_ID_PREFIX = {
    DanhSachTru: 'TQ',
    Quan1: 'Q1', Quan3: 'Q3', Quan5: 'Q5', Quan8: 'Q8',
    Quan10: 'Q10', Quan11: 'Q11',
    PhuNhuan: 'PN', BinhThanh: 'BT', TanBinh: 'TB', TanPhu: 'TP',
    BauBang: 'BB', TruVanTho: 'TVT', BenCat: 'BC'
};
```

**2. Tìm hàm sinh ID tự động khi thêm marker mới** (tìm đoạn tạo ID dạng 'TQ_001' hay
'ID_001' hay tương đương trong saveMarkerPopup() hoặc generateId()). Thay thế/bổ sung:

```javascript
function generateId() {
    const prefix = SHEET_ID_PREFIX[currentSheet] || 'XX';
    const existing = Array.isArray(loadedData)
        ? loadedData.slice(1).map(r => String(r[0] || ''))
        : [];
    let n = existing.length + 1;
    let candidate = `${prefix}_${String(n).padStart(3, '0')}`;
    while (existing.includes(candidate)) {
        n++;
        candidate = `${prefix}_${String(n).padStart(3, '0')}`;
    }
    return candidate;
}
```

Gọi `generateId()` ở nơi trước đây sinh ID khi thêm marker mới.

**3. Trong `updateGitHubExcel()`** (hoặc hàm sync GitHub), tìm dòng khai báo path file Excel:
```javascript
// Hiện tại có thể là:
const path = 'data/khaosat.xlsx';
// Thay bằng:
const path = currentSheet === 'DanhSachTru'
    ? 'data/khaosat.xlsx'
    : `data/khaosat_${currentSheet}.xlsx`;
```

Không thay đổi gì khác.
```

---

### PROMPT 7.6 — GAS: setupDistrictSheets() + sw.js bump v7 + hướng dẫn publish CSV

```
Dự án: PWA khảo sát chiếu sáng — 2 file: gas-khaosat.js và sw.js.

Ngữ cảnh:
- Google Sheet hiện chỉ có sheet DanhSachTru (21 cột).
- Cần tạo 13 tab sheet mới cùng cấu trúc.
- sw.js hiện cache name 'lighting-survey-v6' — cần bump lên v7 để xóa cache cũ
  (do thêm nhiều thay đổi từ PROMPT 7.1–7.5).

Nhiệm vụ:

**File gas-khaosat.js — thêm hàm `setupDistrictSheets()`** (đặt cuối file, sau doPost()):
```javascript
/**
 * Chạy 1 lần từ Apps Script Editor để tạo tất cả sheet địa bàn.
 * Sau khi chạy: publish từng tab ra CSV và điền URL vào DISTRICT_PAGES trong index.html.
 */
function setupDistrictSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const source = ss.getSheetByName('DanhSachTru');
    if (!source) { Logger.log('Không tìm thấy sheet DanhSachTru'); return; }
    const header = source.getRange(1, 1, 1, 21).getValues();
    const sheetNames = [
        'Quan1', 'Quan3', 'Quan5', 'Quan8', 'Quan10', 'Quan11',
        'PhuNhuan', 'BinhThanh', 'TanBinh', 'TanPhu',
        'BauBang', 'TruVanTho', 'BenCat'
    ];
    sheetNames.forEach(name => {
        let sh = ss.getSheetByName(name);
        if (!sh) {
            sh = ss.insertSheet(name);
            sh.getRange(1, 1, 1, 21).setValues(header);
            sh.getRange(1, 1, 1, 21).setFontWeight('bold');
            sh.setFrozenRows(1);
            Logger.log('Đã tạo sheet: ' + name);
        } else {
            Logger.log('Sheet đã tồn tại: ' + name);
        }
    });
    Logger.log('Hoàn tất. Tiếp theo: publish từng tab thành CSV và điền URL vào DISTRICT_PAGES.');
}
```

**File sw.js — bump cache name từ v6 → v7:**
Tìm tất cả chỗ có 'lighting-survey-v6' trong sw.js và thay bằng 'lighting-survey-v7'.
(Thường có ở: khai báo const CACHE_NAME, mảng CACHE_URLS, và event 'activate' xóa cache cũ.)

Không thay đổi gì khác trong 2 file này.

---

Hướng dẫn hoàn tất sau khi chạy các prompt:

1. Vào Apps Script Editor → chọn hàm `setupDistrictSheets` → Run (chạy 1 lần duy nhất)
   → 13 tab sheet mới được tạo tự động trong Google Sheet.

2. Publish từng tab thành CSV (lặp lại cho mỗi tab):
   Google Sheet → tab Quan1 → File → Share → Publish to web
   → Chọn: "Quan1" / "Comma-separated values (.csv)" → Publish → Copy link

3. Điền URL vào DISTRICT_PAGES trong index.html:
   ```javascript
   { label: 'Quận 1', sheet: 'Quan1', csvUrl: '<URL vừa copy>' },
   ```

4. Redeploy GAS New version (không tạo deployment mới):
   Apps Script → Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy

5. Commit + push index.html, gas-khaosat.js, sw.js lên GitHub.
   → GitHub Pages tự deploy — app cập nhật sau vài phút.
```

---

---

## TÍNH NĂNG: Xoay bản đồ tương tác (Compass + MapTools) ✅

Mục tiêu: Cho phép người dùng xoay góc nhìn bản đồ trực tiếp (không chỉ khi xuất PDF) bằng
nút ↺↻, bàn phím `[` `]` `\`, và cử chỉ hai ngón tay. Cửa sổ hướng la bàn hiển thị góc xoay
và cho phép reset về hướng Bắc. Đồng thời gộp ZoomDisplay + Compass thành 1 control `L.Control.MapTools`.

---

### PROMPT 5.4 — Control MapTools: gộp ZoomDisplay + Compass + ↺↻ buttons

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh:
- Hiện tại có 2 custom Leaflet control riêng: L.Control.ZoomDisplay (hiển thị zoom) và
  L.Control.RotationCompass (la bàn). Cần gộp thành 1 control duy nhất `L.Control.MapTools`
  đặt ở topright, gồm: dòng zoom ở trên + la bàn + nút ↺↻ + nhãn góc xoay phía dưới.
- Biến global: `let _currentMapRotation = 0;`

Nhiệm vụ: Thay thế cả 2 control cũ bằng L.Control.MapTools mới.

**1. Thêm biến state** ngay trong phần khai báo biến toàn cục JS:
```javascript
let _currentMapRotation = 0;
```

**2. Thêm hàm `_updateCompassUI()`** (đặt trước hoặc gần `_applyMapRotation`):
```javascript
function _updateCompassUI() {
    const rotated = _currentMapRotation !== 0;
    const label = document.getElementById('compassAngleLabel');
    if (label) {
        label.textContent = Math.round(_currentMapRotation) + '°';
        label.style.color = rotated ? '#2563eb' : '#64748b';
    }
    const needle = document.getElementById('compassNeedle');
    if (needle) needle.style.transform = `rotate(${-_currentMapRotation}deg)`;
    const resetBtn = document.getElementById('mapRotReset');
    if (resetBtn) {
        resetBtn.style.background = rotated ? 'rgba(219,234,254,.7)' : 'none';
        resetBtn.title = rotated
            ? `Hướng Bắc (${Math.round(_currentMapRotation)}°) — click để reset`
            : 'Hướng Bắc';
    }
    const zoomEl = document.getElementById('mapZoomDisplay');
    if (zoomEl) zoomEl.style.background = rotated ? '#eff6ff' : '#f8fafc';
}
```

**3. Thêm 4 hàm rotation** (đặt sau `_updateCompassUI`):
```javascript
function _applyMapRotation(angle) {
    const mapEl = document.getElementById('map');
    const pane  = mapEl && mapEl.querySelector('.leaflet-map-pane');
    if (!angle) {
        if (pane) {
            pane.style.transform = (pane.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
            pane.style.transformOrigin = '';
        }
        _updateCompassUI();
        return;
    }
    if (!pane) { _updateCompassUI(); return; }
    const mapRect  = mapEl.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    const ox = mapRect.left + mapRect.width  / 2 - paneRect.left;
    const oy = mapRect.top  + mapRect.height / 2 - paneRect.top;
    const base = (pane.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
    pane.style.transformOrigin = `${ox}px ${oy}px`;
    pane.style.transform = base + ` rotate(${angle}deg)`;
    _updateCompassUI();
}

function _clearMapRotation() {
    _currentMapRotation = 0;
    const pane = document.querySelector('#map .leaflet-map-pane');
    if (pane) {
        pane.style.transform = (pane.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
        pane.style.transformOrigin = '';
    }
    _updateCompassUI();
}

function _rotateMapFree(delta) {
    _currentMapRotation = ((_currentMapRotation + delta) % 360 + 360) % 360;
    if (_currentMapRotation > 180) _currentMapRotation -= 360;
    _applyMapRotation(_currentMapRotation);
}

function _resetMapRotation() {
    _currentMapRotation = 0;
    _clearMapRotation();
}
```

**4. Thay thế 2 control cũ** bằng L.Control.MapTools mới (tìm nơi `new L.Control.ZoomDisplay().addTo(map)` và tương tự, thay toàn bộ bằng):
```javascript
L.Control.MapTools = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function(m) {
        const c = L.DomUtil.create('div');
        L.DomEvent.disableClickPropagation(c);
        L.DomEvent.disableScrollPropagation(c);
        c.style.cssText = 'background:white;border:2px solid rgba(0,0,0,.2);border-radius:8px;' +
            'box-shadow:0 2px 6px rgba(0,0,0,.3);overflow:hidden;text-align:center;min-width:72px;';
        c.innerHTML = `
            <div id="mapZoomDisplay" style="padding:5px 8px 4px;font-size:12px;font-weight:700;
                color:#1e293b;font-family:monospace;border-bottom:1px solid #e2e8f0;
                background:#f8fafc;letter-spacing:.5px;">Z&thinsp;${m.getZoom()}</div>
            <div style="padding:5px 6px 5px;">
                <button id="mapRotReset" onclick="_resetMapRotation()" title="Hướng Bắc — click để reset"
                    style="display:block;margin:0 auto 4px;background:none;border:none;cursor:pointer;
                           padding:2px;border-radius:50%;line-height:0;">
                    <svg id="compassNeedle" viewBox="0 0 32 32" width="34" height="34"
                        style="display:block;transition:transform .2s cubic-bezier(.4,0,.2,1);
                               filter:drop-shadow(0 1px 2px rgba(0,0,0,.15));">
                        <polygon points="16,3 20,16 16,14 12,16" fill="#dc2626"/>
                        <polygon points="16,29 20,16 16,18 12,16" fill="#94a3b8"/>
                        <circle cx="16" cy="16" r="3" fill="white" stroke="#e2e8f0" stroke-width="1"/>
                        <text x="16" y="8" text-anchor="middle" font-size="5" font-weight="700"
                            fill="#dc2626" font-family="Arial,sans-serif">N</text>
                    </svg>
                </button>
                <div style="display:flex;align-items:center;justify-content:center;gap:2px;">
                    <button id="mapRotLeft" onclick="_rotateMapFree(-5)" title="Xoay trái 5° ([)"
                        style="background:none;border:none;cursor:pointer;padding:2px 5px;
                               border-radius:4px;font-size:14px;color:#475569;line-height:1;">↺</button>
                    <span id="compassAngleLabel"
                        style="font-size:10px;font-weight:700;color:#64748b;min-width:26px;
                               text-align:center;font-family:monospace;">0°</span>
                    <button id="mapRotRight" onclick="_rotateMapFree(5)" title="Xoay phải 5° (])"
                        style="background:none;border:none;cursor:pointer;padding:2px 5px;
                               border-radius:4px;font-size:14px;color:#475569;line-height:1;">↻</button>
                </div>
            </div>`;
        m.on('zoomend', () => {
            const el = document.getElementById('mapZoomDisplay');
            if (el) el.innerHTML = 'Z&thinsp;' + m.getZoom();
        });
        return c;
    }
});
new L.Control.MapTools().addTo(map);
```

**5. Thêm CSS** vào phần `<style>`:
```css
#mapRotLeft:hover, #mapRotRight:hover {
    background: #dbeafe !important; color: #1d4ed8 !important;
}
#mapRotReset:hover svg {
    filter: drop-shadow(0 2px 4px rgba(37,99,235,.3)) !important;
}
```

Không thay đổi gì khác. Keyboard shortcuts và touch sẽ thêm ở PROMPT 5.5.
```

---

### PROMPT 5.5 — Keyboard shortcuts + hai ngón tay xoay bản đồ

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh sau PROMPT 5.4:
- `_rotateMapFree(delta)` và `_resetMapRotation()` đã tồn tại.
- Cần: phím `[` xoay trái 5°, `]` xoay phải 5°, `\` reset về Bắc.
- Cần: hai ngón tay trên màn hình cảm ứng xoay bản đồ (twist gesture).
  → Phân biệt twist vs pinch-zoom bằng angular delta > 3° vs radial delta > 10px.

Nhiệm vụ:

**1. Thêm keyboard listener** (đặt trong `initializeMap()` hoặc cuối phần init JS):
```javascript
document.addEventListener('keydown', function(e) {
    const tag = (e.target || {}).tagName || '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (e.key === '[' || e.key === 'BracketLeft')  { _rotateMapFree(-5); e.preventDefault(); }
    if (e.key === ']' || e.key === 'BracketRight') { _rotateMapFree(5);  e.preventDefault(); }
    if (e.key === '\\' || e.key === 'Backslash')   { _resetMapRotation(); e.preventDefault(); }
});
```

**2. Thêm two-finger touch rotation** (đặt trong `initializeMap()`, sau khi `map` được khởi tạo):
```javascript
let _tfStart = null;

function _tfAngle(t0, t1) {
    return Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * 180 / Math.PI;
}
function _tfDist(t0, t1) {
    const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

const mc = map.getContainer();
mc.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
        _tfStart = {
            angle: _tfAngle(e.touches[0], e.touches[1]),
            dist:  _tfDist(e.touches[0], e.touches[1]),
            baseRot: _currentMapRotation
        };
    } else {
        _tfStart = null;
    }
}, { passive: true });

mc.addEventListener('touchmove', function(e) {
    if (e.touches.length !== 2 || !_tfStart) return;
    const curDist  = _tfDist(e.touches[0], e.touches[1]);
    const distDelta = Math.abs(curDist - _tfStart.dist);
    const curAngle = _tfAngle(e.touches[0], e.touches[1]);
    const rotDelta  = Math.abs(curAngle - _tfStart.angle);
    // Nếu ngón tay đang zoom (radial >> angular) thì bỏ qua
    if (rotDelta < 3 && distDelta > 10) return;
    _currentMapRotation = _tfStart.baseRot + (curAngle - _tfStart.angle);
    _applyMapRotation(_currentMapRotation);
}, { passive: true });

mc.addEventListener('touchend', function(e) {
    if (e.touches.length < 2) _tfStart = null;
}, { passive: true });
```

Lưu ý:
- `{ passive: true }` để không block Leaflet pan/zoom mặc định
- Slight zoom change khi xoay là chấp nhận được
- `_currentMapRotation` và `_applyMapRotation` đã có từ PROMPT 5.4

Không thay đổi gì khác.
```

---

### PROMPT 5.6 — Fix đường cáp PDF khi bản đồ bị xoay (pre-rotated SVG)

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề:
- `_buildPrintCableSvg(rows)` tạo SVG với tọa độ từ `map.latLngToContainerPoint()` —
  hàm này trả về tọa độ container CHƯA xoay (unrotated).
- Khi bản đồ đang xoay, CSS `rotate(θdeg)` trên `.leaflet-map-pane` xoay marker/tile,
  nhưng SVG cable nằm ngoài pane → không tự xoay theo → đường cáp lệch vị trí trong PDF.
- Giải pháp: tính toán tọa độ đã xoay bằng ma trận rotation TRƯỚC khi ghi vào SVG (không dùng CSS transform trên SVG).

Công thức pre-rotation (Y-down, khớp với CSS rotate):
```
x' = cx + (x-cx)·cos(θ) - (y-cy)·sin(θ)
y' = cy + (x-cx)·sin(θ) + (y-cy)·cos(θ)
```
với `cx = W/2, cy = H/2` (tâm của #map container).

Nhiệm vụ: Thay thế hàm `_buildPrintCableSvg(rows)` bằng phiên bản nhận thêm `rotationDeg`:

```javascript
function _buildPrintCableSvg(rows, rotationDeg) {
    _removePrintCableSvg();
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    const W = mapEl.offsetWidth, H = mapEl.offsetHeight;
    const cx = W / 2, cy = H / 2;
    const θ = (rotationDeg || 0) * Math.PI / 180;
    const cosθ = Math.cos(θ), sinθ = Math.sin(θ);

    function rotPt(pt) {
        if (!rotationDeg) return pt;
        const dx = pt.x - cx, dy = pt.y - cy;
        return { x: cx + dx * cosθ - dy * sinθ, y: cy + dx * sinθ + dy * cosθ };
    }

    // Build name → [lat, lon] index từ toàn bộ loadedData
    const posIdx = {};
    ((loadedData || []).slice(1)).forEach(r => {
        const name = String(r[1] || '').trim();
        const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
        if (name && Number.isFinite(lat) && Number.isFinite(lon)) posIdx[name] = [lat, lon];
    });

    let markup = '';
    rows.forEach(r => {
        const parentName = String(r[14] || '').trim();
        if (!parentName) return;
        const childName = String(r[1] || '').trim();
        if (!childName || childName === parentName || !posIdx[childName] || !posIdx[parentName]) return;

        const from = rotPt(map.latLngToContainerPoint(posIdx[parentName]));
        const to   = rotPt(map.latLngToContainerPoint(posIdx[childName]));
        const distVal = String(r[15] || '').trim() ||
            String(haversineM(posIdx[childName][0], posIdx[childName][1],
                              posIdx[parentName][0], posIdx[parentName][1]));
        const mx = ((from.x + to.x) / 2).toFixed(1);
        const my = ((from.y + to.y) / 2).toFixed(1);
        markup +=
            `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}"` +
            ` x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"` +
            ` stroke="#1e40af" stroke-width="2.5" stroke-dasharray="7 5" opacity="0.85"/>` +
            `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle"` +
            ` font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="#1e40af"` +
            ` paint-order="stroke" stroke="white" stroke-width="3"` +
            ` stroke-linejoin="round">${distVal}m</text>`;
    });

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = '_printCableSvg';
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450;overflow:visible;';
    // KHÔNG set CSS transform — tọa độ đã pre-rotated
    svg.innerHTML = markup;
    mapEl.appendChild(svg);
}
```

**Cập nhật nơi gọi** trong `exportDrawingPDF()`:
Tìm dòng `_buildPrintCableSvg(rows)` và thêm tham số rotation:
```javascript
const rotation = parseFloat(document.getElementById('pdRotation')?.value) || _currentMapRotation || 0;
_buildPrintCableSvg(rows, rotation);
```

Lưu ý:
- SVG KHÔNG có CSS transform — tọa độ đã khớp với vị trí pixel của marker trong CSS-rotated pane
- `parseCoord()` và `haversineM()` đã có trong codebase
- `_removePrintCableSvg()` đã có trong codebase

Không thay đổi gì khác.
```

---

**Cập nhật thứ tự chạy (bổ sung 5.4–5.6):**
```
5.4 → index.html: L.Control.MapTools (gộp ZoomDisplay + Compass + ↺↻)     ✅ done
5.5 → index.html: keyboard shortcuts [ ] \ + two-finger touch rotation      ✅ done
5.6 → index.html: _buildPrintCableSvg(rows, rotationDeg) pre-rotated coords ✅ done
```

---

---

## TÍNH NĂNG 8: Tối ưu mobile ✅

Mục tiêu: App chạy mượt trên thiết bị Android/iOS tầm trung (RAM 3–4 GB, màn hình 360–414px).
Thực hiện theo thứ tự 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6 → 8.7.

---

### PROMPT 8.1 — isMobile detection + icon tối giản + shared icons

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề: `makeLampIcon()` tạo SVG phức tạp (filter drop-shadow, cubic bezier arms) cho MỖI marker.
Với 500+ marker trên mobile đây là bottleneck render nghiêm trọng.

Nhiệm vụ: 3 thay đổi.

**1. Thêm hằng số `isMobile`** ngay sau khai báo map (sau `const map = L.map(...)`):
```javascript
const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
```

**2. Thêm hàm `makeLampIconMobile(color)`** ngay sau `makeLampIcon()`:
```javascript
function makeLampIconMobile(color) {
    return L.divIcon({
        className: '',
        html: `<svg width="14" height="28" viewBox="0 0 14 28" xmlns="http://www.w3.org/2000/svg">
            <rect x="5.5" y="8" width="3" height="20" rx="1.5" fill="${color}"/>
            <circle cx="7" cy="6" r="5" fill="${color}"/>
            <circle cx="7" cy="6" r="3.5" fill="white" opacity="0.8"/>
        </svg>`,
        iconSize: [14, 28],
        iconAnchor: [7, 28],
        popupAnchor: [0, -30]
    });
}
```

**3. Trong `addMarkerRowToMap(row)`** — khi quyết định icon, thêm nhánh mobile:

Tìm đoạn tạo `icon = makeLampIcon(color, loaiDen, congSuat, soLuong)`, thay bằng:
```javascript
let icon;
if (isMobile && !loaiDen && !congSuat) {
    // Shared icon theo type — tạo 1 lần, tái dùng cho tất cả marker cùng loại
    const mobileKey = 'mobile_' + loai;
    if (!customIcons[mobileKey]) customIcons[mobileKey] = makeLampIconMobile(color);
    icon = customIcons[mobileKey];
} else {
    icon = makeLampIcon(color, loaiDen, congSuat, soLuong);
}
```

(Với marker tủ điện, không thay đổi — `makeCabinetIcon()` đã nhẹ.)

Lưu ý:
- `customIcons` phải đã khai báo trước đó (kiểm tra, nếu chưa có thì thêm `const customIcons = {};`)
- Shared icon chỉ cho marker không có badge (loaiDen + congSuat đều rỗng)
- Drop-shadow `filter` trong SVG tốn GPU nhất — icon mobile bỏ hoàn toàn

Không thay đổi gì khác.
```

---

### PROMPT 8.2 — Cluster aggressively hơn trên mobile

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh sau PROMPT 8.1: `isMobile` đã khai báo.

Vấn đề: Trên mobile với màn hình nhỏ, nhiều marker icon riêng lẻ ở zoom thấp gây lag touch event.

Nhiệm vụ: 1 thay đổi — cập nhật tham số `L.markerClusterGroup`.

Tìm đoạn khởi tạo `markerCluster = L.markerClusterGroup({...})`, sửa thành:
```javascript
const markerCluster = L.markerClusterGroup({
    disableClusteringAtZoom: isMobile ? 16 : 15,  // mobile giữ cluster lâu hơn 1 zoom
    maxClusterRadius: isMobile ? 80 : 60,          // mobile bán kính cluster lớn hơn
    chunkedLoading: true,    // không block main thread khi load 500+ marker
    chunkInterval: 100,      // ms giữa mỗi chunk
    chunkDelay: 50
});
```

Lưu ý:
- `chunkedLoading: true` quan trọng nhất — tránh freeze UI khi load lần đầu
- Giá trị desktop giữ nguyên để không ảnh hưởng trải nghiệm desktop
- Nếu `markerCluster` đã có `disableClusteringAtZoom` hay `maxClusterRadius` thì ghi đè

Không thay đổi gì khác.
```

---

### PROMPT 8.3 — Ngưỡng zoom hiện nhãn tên theo mobile/desktop

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh sau PROMPT 8.1: `isMobile` đã khai báo.

Vấn đề: Trên mobile zoom ≥ 17 hiện nhãn tên tất cả marker cùng lúc → quá nhiều DOM node.

Nhiệm vụ: Tìm listener `map.on('zoomend')` xử lý `labelLayerGroup`, sửa ngưỡng zoom:

```javascript
// Desktop: hiện nhãn khi zoom ≥ 17; Mobile: zoom ≥ 18
const labelZoomThreshold = isMobile ? 18 : 17;
map.on('zoomend', function() {
    if (map.getZoom() >= labelZoomThreshold) {
        if (!map.hasLayer(labelLayerGroup)) labelLayerGroup.addTo(map);
    } else {
        if (map.hasLayer(labelLayerGroup)) map.removeLayer(labelLayerGroup);
    }
});
```

Lưu ý: Thay `17` trong điều kiện zoomend bằng `labelZoomThreshold`. Nếu đã có constant cho
ngưỡng zoom, sửa constant đó thành biểu thức `isMobile ? 18 : 17`.

Không thay đổi gì khác.
```

---

### PROMPT 8.4 — Tắt animation Leaflet trên mobile

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Ngữ cảnh sau PROMPT 8.1: `isMobile` đã khai báo, `map` đã khởi tạo.

Vấn đề: Leaflet zoom/marker/fade animation gây jank rõ rệt trên thiết bị tầm trung.

Nhiệm vụ: Thêm đoạn này ngay SAU khi `map` được khởi tạo (sau `const map = L.map(...)`):
```javascript
if (isMobile) {
    map.options.zoomAnimation    = false;
    map.options.markerZoomAnimation = false;
    map.options.fadeAnimation    = false;
}
```

Lưu ý:
- Phải đặt SAU khi map được tạo, TRƯỚC khi add layer đầu tiên
- Không ảnh hưởng desktop vì có guard `isMobile`
- Tắt animation không ảnh hưởng chức năng, chỉ bỏ hiệu ứng chuyển động

Không thay đổi gì khác.
```

---

### PROMPT 8.5 — Lazy load ảnh trong popup marker

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề: Popup render `<img src="...">` ngay khi mở. Trên mobile với ảnh 1–3 MB → lag popup.

Nhiệm vụ: Tìm trong `createMarkerPopupContent()` (hoặc hàm tạo HTML popup) đoạn tạo thẻ `<img>`:

Tìm (đại loại):
```javascript
`<img src="${imgUrl}" ...>`
```

Thêm `loading="lazy"` và giới hạn kích thước hiển thị:
```javascript
`<img src="${imgUrl}" loading="lazy"
      style="max-width:100%;max-height:200px;object-fit:cover;border-radius:6px;"
      crossorigin="anonymous">`
```

Nếu có nhiều chỗ tạo `<img>` trong popup, sửa tất cả.

Lưu ý:
- `loading="lazy"` được hỗ trợ trên Chrome/Safari/Firefox hiện đại (Android 8+ và iOS 15.4+)
- `crossorigin="anonymous"` cần thiết nếu ảnh từ GitHub Pages (khác origin)
- `max-height:200px` tránh ảnh full HD chiếm hết màn hình

Không thay đổi gì khác.
```

---

### PROMPT 8.6 — Debounce sự kiện map moveend / zoomend

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề: Pan/zoom nhanh trên mobile kích hoạt moveend/zoomend liên tục → nhiều lần rerender
không cần thiết (cập nhật nhãn, stats, v.v.).

Nhiệm vụ: Thêm hàm debounce + wrap các listener nặng.

**1. Thêm hàm `debounce`** ngay trong phần JS utilities:
```javascript
function debounce(fn, ms) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}
```

**2. Wrap listener moveend/zoomend** (nếu có xử lý nặng trong đó):

Tìm `map.on('moveend', ...)` hoặc `map.on('zoomend', ...)` xử lý nhiều logic (không phải
listener nhẹ như cập nhật zoom display) — wrap hàm handler bằng debounce:
```javascript
// Thay:
map.on('moveend', onMapMoveEnd);
// Thành:
map.on('moveend', debounce(onMapMoveEnd, 150));

map.on('zoomend', debounce(onMapZoomEnd, 150));
```

Lưu ý: Chỉ wrap các handler thực sự nặng (render label, tính toán, cập nhật stats).
Handler nhẹ (cập nhật mapZoomDisplay, updateCompassUI) KHÔNG wrap để vẫn responsive.
Nếu không có hàm `onMapMoveEnd` / `onMapZoomEnd` riêng, không cần thêm debounce.

Không thay đổi gì khác.
```

---

### PROMPT 8.7 — CSS media query tối ưu mobile

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Vấn đề: Transition CSS + animation gây jank trên mobile. Popup quá rộng trên màn hình nhỏ.
Nút in bản vẽ / CAD không cần thiết trên mobile (chức năng desktop chính).

Nhiệm vụ: Thêm media query vào phần `<style>` (cuối phần CSS):
```css
@media (max-width: 768px) {
    /* Tắt transition nặng */
    * {
        transition: none !important;
        animation: none !important;
    }

    /* Popup gọn hơn */
    .marker-popup-card {
        max-width: 92vw;
        font-size: 13px;
    }

    /* Bottom action bar: 1 hàng, scroll ngang nếu tràn */
    #bottomActionBar {
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    /* Ẩn nút ít dùng trên mobile */
    #btnExportCad,
    #btnPrintDrawing {
        display: none !important;
    }
}
```

Lưu ý:
- `transition: none !important` ảnh hưởng tất cả element trong viewport — đây là đánh đổi
  có chủ đích: ưu tiên performance hơn animation
- Kiểm tra id `btnExportCad` và `btnPrintDrawing` khớp với id thực trong HTML (tìm trước khi thay)
- `.marker-popup-card` là class của popup card — kiểm tra tên class thực trong codebase

Không thay đổi gì khác.
```

---

**Thứ tự chạy Tính năng 8:**
```
8.1 → index.html: isMobile + makeLampIconMobile() + shared icons     ✅ done
8.2 → index.html: markerCluster chunkedLoading + mobile thresholds   ✅ done
8.3 → index.html: labelZoomThreshold theo mobile/desktop             ✅ done
8.4 → index.html: tắt Leaflet animation trên mobile                  ✅ done
8.5 → index.html: loading="lazy" + max-height cho ảnh popup          ✅ done
8.6 → index.html: debounce moveend/zoomend                           ✅ done
8.7 → index.html: CSS media query tắt transition + ẩn nút desktop    ✅ done
```

---

---

## TÍNH NĂNG 9: Tối ưu load dữ liệu lớn ✅ (9.1 → 9.5 done)

Bối cảnh: Mỗi sheet địa bàn có ~1,000–1,200 hàng (đo thực tế từ sheet Quận 1). Với 14 địa bàn,
tổng dữ liệu có thể lên đến 14,000+ marker. Thực hiện theo thứ tự 9.1 → 9.2 → 9.3 → 9.4.

---

### PROMPT 9.1 — IndexedDB cache CSV (stale-while-revalidate)

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Bối cảnh:
- `loadFromCSV(url)` hiện tại fetch CSV từ Google Sheets mỗi lần load app (~150–300 KB, 1,000+ hàng).
- Không có cache nào → load lần 2 vẫn mất 3–5s như lần 1.
- Mục tiêu: Load lần 2 < 0.3s bằng cách cache vào IndexedDB, fetch mới ở background.

Chiến lược "stale-while-revalidate":
1. Mở app → đọc cache từ IndexedDB ngay lập tức → render marker (gần như tức thì)
2. Đồng thời fetch CSV mới ở background
3. Nếu dữ liệu mới khác cache → cập nhật cache + reload markers

Nhiệm vụ: 3 thay đổi trong index.html.

**1. Thêm 3 hàm IndexedDB helper** ngay sau hàm `debounce()`:
```javascript
function _idbOpen() {
    return new Promise((res, rej) => {
        const r = indexedDB.open('lighting-survey-db', 1);
        r.onupgradeneeded = e => e.target.result.createObjectStore('csv-cache');
        r.onsuccess = e => res(e.target.result);
        r.onerror = rej;
    });
}
async function _idbGet(key) {
    try {
        const db = await _idbOpen();
        return await new Promise((res, rej) => {
            const r = db.transaction('csv-cache', 'readonly').objectStore('csv-cache').get(key);
            r.onsuccess = () => res(r.result);
            r.onerror = rej;
        });
    } catch { return null; }
}
async function _idbSet(key, val) {
    try {
        const db = await _idbOpen();
        await new Promise((res, rej) => {
            const tx = db.transaction('csv-cache', 'readwrite');
            tx.objectStore('csv-cache').put(val, key);
            tx.oncomplete = res; tx.onerror = rej;
        });
    } catch { /* ignore IDB errors silently */ }
}
```

**2. Thêm hàm `loadFromCSVWithCache(sheetName, csvUrl)`** ngay sau `loadFromCSV()`:
```javascript
async function loadFromCSVWithCache(sheetName, csvUrl) {
    // 1. Render từ cache ngay lập tức (nếu có)
    const cached = await _idbGet(sheetName);
    let renderedFromCache = false;
    if (cached && Array.isArray(cached.data) && cached.data.length > 1) {
        loadedData = cached.data;
        dirtyMovedRows.clear();
        updateDirtyMovedBadge();
        addMarkersToMap(loadedData.slice(1));
        renderedFromCache = true;
    }
    // 2. Fetch mới ở background
    try {
        const res = await fetch(csvUrl, { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        // Parse CSV (dùng hàm parse đã có trong loadFromCSV)
        const lines = text.split('\n').filter(l => l.trim());
        const parsed = lines.map(line => {
            const arr = []; let cur = '', inQ = false;
            for (const ch of line) {
                if (ch === '"') { inQ = !inQ; }
                else if (ch === ',' && !inQ) { arr.push(cur.trim()); cur = ''; }
                else { cur += ch; }
            }
            arr.push(cur.trim());
            return arr;
        });
        // So sánh với cache
        const newHash = parsed.length + '|' + (parsed[1] ? parsed[1][0] : '');
        const oldHash = cached ? (cached.data.length + '|' + (cached.data[1] ? cached.data[1][0] : '')) : '';
        if (!renderedFromCache || newHash !== oldHash) {
            loadedData = parsed;
            dirtyMovedRows.clear();
            updateDirtyMovedBadge();
            addMarkersToMap(loadedData.slice(1));
        }
        // Cập nhật cache
        await _idbSet(sheetName, { data: parsed, fetchedAt: new Date().toISOString() });
    } catch (err) {
        if (!renderedFromCache) displayError('Lỗi tải dữ liệu: ' + err.message);
    }
}
```

**3. Trong `switchDistrict(sheetName)` và nơi gọi `loadFromCSV()` ban đầu khi app khởi động:**
Thay `loadFromCSV(page.csvUrl)` bằng `loadFromCSVWithCache(sheetName, page.csvUrl)`.

Tìm nơi app gọi `loadFromCSV(KHAOSAT_CSV_URL)` lúc khởi động (thường ở cuối script hoặc
trong `initializeApp()`), thay bằng:
```javascript
loadFromCSVWithCache('DanhSachTru', KHAOSAT_CSV_URL);
```

Lưu ý:
- `addMarkersToMap()`, `dirtyMovedRows`, `updateDirtyMovedBadge()` đã có trong codebase
- `loadFromCSV()` giữ nguyên — dùng làm fallback khi không cần cache
- IndexedDB không cần xóa thủ công — dữ liệu tự ghi đè mỗi lần fetch thành công

Không thay đổi gì khác.
```

---

### PROMPT 9.2 — Lazy popup content

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Bối cảnh:
- `addMarkerRowToMap(row)` gọi `marker.bindPopup(createMarkerPopupContent(row))` cho mỗi marker.
- Với 1,000+ marker, `createMarkerPopupContent()` được gọi 1,000+ lần khi load dù popup chưa mở.
- Hàm này sinh HTML phức tạp (ảnh, nút, bảng) → bottleneck khi load.
- Mục tiêu: chỉ gọi `createMarkerPopupContent()` khi user thực sự click mở popup.

Nhiệm vụ: Sửa `addMarkerRowToMap()` — 1 thay đổi duy nhất.

Tìm đoạn trong `addMarkerRowToMap(row)`:
```javascript
marker.bindPopup(createMarkerPopupContent(row));
marker.on('popupopen', function() {
    _currentPopupRow = row;
    marker.setPopupContent(createMarkerPopupContent(row));
    setTimeout(function() {
        // ... attach avatar click handler
    }, 0);
});
```

Thay bằng:
```javascript
// Bind popup rỗng — nội dung chỉ sinh khi user mở
marker.bindPopup('', { minWidth: 280 });
marker.on('popupopen', function() {
    _currentPopupRow = row;
    // Sinh content lần đầu, hoặc refresh khi đã có (sau drag/edit)
    marker.setPopupContent(createMarkerPopupContent(row));
    setTimeout(function() {
        const popup = marker.getPopup();
        if (!popup) return;
        const el = popup.getElement();
        if (!el) return;
        const avatar = el.querySelector('.pc-avatar');
        if (avatar) avatar.addEventListener('click', function() { openImageLightbox(avatar.src); });
    }, 0);
});
```

Lưu ý:
- `minWidth: 280` trong bindPopup options để popup không bị quá hẹp khi mới mở lần đầu
- `marker.setPopupContent()` trong `popupopen` vẫn giữ nguyên — refresh content mỗi lần mở
  (cần thiết sau khi edit hoặc drag marker)
- Bỏ dòng `marker.setPopupContent(createMarkerPopupContent(row))` thứ 2 trong setTimeout nếu có

Không thay đổi gì khác.
```

---

### PROMPT 9.3 — Chunked marker insertion + progress bar

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Bối cảnh:
- `addMarkersToMap(data)` gọi `data.forEach(row => addMarkerRowToMap(row))` đồng bộ.
- Với 1,000+ marker, vòng lặp này block main thread 2–4s → UI freeze trên mobile.
- `chunkedLoading: true` trong markerCluster chỉ chia khi VẼ cluster, không chia khi INSERT.
- Mục tiêu: chia nhỏ vòng lặp, yield cho main thread, hiển thị progress bar.

Nhiệm vụ: 2 thay đổi.

**1. Thêm progress bar HTML** vào cuối `<body>` (trước `</body>`):
```html
<div id="loadProgressBar"
     style="display:none;position:fixed;top:0;left:0;height:3px;background:#2563eb;
            width:0;z-index:99999;pointer-events:none;border-radius:0 2px 2px 0;
            transition:width .08s linear;"></div>
```

**2. Thêm hàm `_setLoadProgress(pct)`** ngay sau `debounce()`:
```javascript
function _setLoadProgress(pct) {
    const el = document.getElementById('loadProgressBar');
    if (!el) return;
    if (pct === null) {
        el.style.transition = 'none';
        setTimeout(() => { el.style.display = 'none'; el.style.width = '0'; }, 300);
        return;
    }
    el.style.display = 'block';
    el.style.transition = 'width .08s linear';
    el.style.width = Math.min(pct, 98) + '%'; // dừng ở 98% cho đến khi done
}
```

**3. Thay thế `addMarkersToMap(data)`** bằng phiên bản async chunked:
```javascript
async function addMarkersToMap(data) {
    markersCluster.clearLayers();
    labelLayerGroup.clearLayers();
    markers = [];
    const rows = data.slice(1); // bỏ header
    const total = rows.length;
    if (total === 0) return;

    const CHUNK = isMobile ? 80 : 150; // chunk nhỏ hơn trên mobile
    for (let i = 0; i < total; i += CHUNK) {
        rows.slice(i, i + CHUNK).forEach(row => addMarkerRowToMap(row));
        _setLoadProgress(Math.round((i + CHUNK) / total * 100));
        await new Promise(r => setTimeout(r, 0)); // yield main thread
    }
    _setLoadProgress(null);
    if (markers.length > 0) {
        try { map.fitBounds(markersCluster.getBounds().pad(0.1)); } catch {}
    }
    if (map.getZoom() < labelZoomThreshold) map.removeLayer(labelLayerGroup);
    else map.addLayer(labelLayerGroup);
}
```

Lưu ý:
- Hàm trở thành `async` — các nơi `await loadFromCSV()` hoặc `await loadFromCSVWithCache()`
  đã await đúng nếu `addMarkersToMap` được await bên trong.
- `isMobile` và `labelZoomThreshold` đã khai báo từ PROMPT 8.1 + 8.3.
- `markers`, `markersCluster`, `labelLayerGroup` là biến global đã có.
- Dòng gọi `addMarkersToMap(loadedData.slice(1))` ở nơi khác: cần đổi thành
  `addMarkersToMap(loadedData)` (hàm mới tự slice(1) bên trong).

Không thay đổi gì khác.
```

---

### PROMPT 9.4 — Xác nhận VN2000 không gọi khi render

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Bối cảnh:
- `convertLatLonToVn2000(lat, lon)` là phép toán Gauss-Krüger tốn CPU, chứa nhiều trig.
- Nếu hàm này được gọi trong `addMarkerRowToMap()` hoặc vòng lặp render → bottleneck nặng
  với 1,000+ marker.
- Theo thiết kế trong CLAUDE.md, VN2000 chỉ được tính tại 2 điểm:
  1. `saveMarkerPopup()` — khi lưu marker mới/sửa
  2. `updateMarkerCoordinatesInData()` — khi kéo marker

Nhiệm vụ: Kiểm tra và sửa (nếu cần).

**Tìm kiếm trong codebase:**
Grep `convertLatLonToVn2000` trong index.html. Kiểm tra từng nơi gọi:
- Nếu nằm trong `addMarkerRowToMap()` → XÓA
- Nếu nằm trong `addMarkersToMap()` hoặc vòng `forEach(row => ...)` khi load → XÓA
- Nếu chỉ ở `saveMarkerPopup()` và `updateMarkerCoordinatesInData()` → KHÔNG thay đổi (đúng thiết kế)

Không thêm gì mới, chỉ xác nhận hoặc xóa các lời gọi sai chỗ.

Không thay đổi gì khác.
```

---

**Thứ tự chạy Tính năng 9:**
```
9.1 → index.html: IndexedDB helper + loadFromCSVWithCache()              ✅ done
9.2 → index.html: lazy popup — bindPopup('') + generate on popupopen     ✅ done
9.3 → index.html: async chunked addMarkersToMap() + progress bar         ✅ done
9.4 → index.html: xác nhận convertLatLonToVn2000 không gọi khi render    ✅ done
9.5 → index.html: zoom-level progressive loading (cabinet-only ở zoom thấp) ⬜
```

---

### PROMPT 9.5 — Zoom-level progressive loading ✅ DONE

```
Dự án: PWA khảo sát chiếu sáng — index.html.

Bối cảnh:
- Khi có dữ liệu nhiều địa bàn ("Tổng quan" gộp nhiều quận), tổng marker có thể lên đến
  14,000+. Dù đã có chunked loading (9.3), việc giữ 14,000 marker trong markerCluster
  vẫn tốn RAM và CPU khi pan/zoom.
- Ở zoom tổng quan (< 12), các marker trụ đèn riêng lẻ không có giá trị nhìn — chỉ cần
  thấy vị trí các tủ điều khiển (~50–200 điểm) là đủ để định hướng.
- Khi user zoom vào (≥ 12), mới cần render toàn bộ marker của khu vực đó.
- Phương án này không gây UX confusing vì: tủ hiển thị liên tục, trụ chỉ xuất hiện khi
  zoom đủ gần — hành vi tự nhiên, giống Google Maps.

Định nghĩa zoom tier:
- tier "cabinet": zoom < 12 → chỉ render loại 5, 6 (tủ chiếu sáng nổi + ngầm)
- tier "all":     zoom ≥ 12 → render tất cả loại 1–6

Nhiệm vụ: 3 thay đổi trong index.html.

**1. Thêm biến state** ngay sau khai báo `let loadedData = []`:
```javascript
let _zoomTier = 'all'; // 'cabinet' | 'all'
```

**2. Thêm hàm `_applyZoomTier()`** (đặt gần các hàm filter, sau `_getFilteredRows`):
```javascript
function _applyZoomTier() {
    const z = map.getZoom();
    const newTier = z < 12 ? 'cabinet' : 'all';
    if (newTier === _zoomTier) return; // không đổi tier → không re-render
    _zoomTier = newTier;

    const baseRows = _activeFilters && (
        _activeFilters.types.length || _activeFilters.nguoiKS ||
        _activeFilters.phuongXa || _activeFilters.duong
    ) ? _getFilteredRows() : (Array.isArray(loadedData) ? loadedData.slice(1) : []);

    if (_zoomTier === 'cabinet') {
        // Chỉ giữ lại tủ điều khiển (loại 5 và 6)
        addMarkersToMap(baseRows.filter(r => [5, 6].includes(Number(r[6]))));
    } else {
        addMarkersToMap(baseRows);
    }
}
```

**3. Đăng ký `_applyZoomTier` vào zoomend listener** — tìm `map.on('zoomend', function() {`
trong `initializeMap()` và thêm lời gọi vào cuối handler:

```javascript
map.on('zoomend', function() {
    // ... (code cũ: add/remove labelLayerGroup)
    if (map.getZoom() < labelZoomThreshold) map.removeLayer(labelLayerGroup);
    else map.addLayer(labelLayerGroup);
    // Thêm dòng này:
    _applyZoomTier();
});
```

Lưu ý quan trọng:
- `_applyZoomTier()` chỉ re-render khi tier THỰC SỰ thay đổi (`_zoomTier !== newTier`).
  Pan trong cùng tier không trigger re-render.
- `_activeFilters` đã tồn tại trong codebase (`{ types, nguoiKS, phuongXa, duong }`).
  Nếu chưa tồn tại, thay condition bằng `false`.
- Khi `loadFromCSVWithCache()` hoặc `loadFromCSV()` hoàn thành và gọi `addMarkersToMap()`,
  cần reset `_zoomTier` về `'all'` trước để tier được tính lại đúng:
  ```javascript
  // Thêm 1 dòng trước mỗi lần gọi addMarkersToMap trong loadFromCSV/loadFromCSVWithCache:
  _zoomTier = 'all';
  ```
  Sau đó `_applyZoomTier()` sẽ tự điều chỉnh dựa trên zoom hiện tại của map.

- Ngưỡng zoom 12 có thể điều chỉnh tùy mật độ dữ liệu:
  - Dữ liệu 1 quận (~1,000 marker): không cần bật tính năng này (overhead lớn hơn lợi ích)
  - Dữ liệu đa quận (> 5,000 marker): ngưỡng 12 hợp lý
  - Cân nhắc thêm hằng số: `const ZOOM_TIER_THRESHOLD = 12;` cho dễ chỉnh

- `_applyZoomTier()` KHÔNG gọi khi init — chỉ gọi khi zoom thay đổi. Lần load đầu
  `addMarkersToMap()` render bình thường, sau đó zoom tier mới bắt đầu quản lý.

Không thay đổi gì khác.
```

---

# 📐 Bộ Prompt — Tối ưu "In bản vẽ sơ đồ tuyến trạm đèn" (audit 2026-06-16)

Thứ tự ưu tiên: 🔴 Cao → 🟡 Trung bình → 🟢 Thấp.

---

## 🔴 PROMPT P1 — Fix bug `tuName` undefined

```
Trong file index.html, hàm exportDrawingPDF() (khoảng line 2123-2244)
có 2 chỗ dùng biến `tuName` chưa khai báo (line ~2190 và ~2221),
dẫn đến tên file PDF có thể là "banve-undefined-...pdf" khi
pdTenTu trống.

Đọc kỹ scope của hàm, tìm xem `tuName` đáng lẽ phải là biến nào
(có thể là `tuFilter` hoặc `pdTuSelect.value`). Sửa lại 2 chỗ
fallback cho đúng, kèm default value an toàn nếu cả 2 đều trống
(vd: 'sodotuyen').

Sau khi sửa, verify không còn reference đến `tuName` chưa khai báo
bằng grep.
```

---

## 🔴 PROMPT P2 — Force cleanup state khi export fail

```
Trong file index.html, hàm exportDrawingPDF() có khối finally
(khoảng line 2229-2244) reset _previewMode = false nhưng chưa đảm
bảo:
1. Modal #printDrawingModal đóng nếu vẫn open
2. Overlay #printOverlay được hide
3. SVG cable #_printCableSvg removed
4. Tiles gốc đã restore (nếu CartoDB switch fail giữa chừng)
5. Map size restore (origStyleW/origStyleH)
6. Nút "Xuất PDF" enable lại để user retry

Bao tất cả cleanup trong finally bằng try/catch riêng cho mỗi step
(nếu 1 step fail, các step khác vẫn chạy). Thêm guard: nếu
_previewMode đang true thì gọi closePrintPreview() trước.

Test: throw Error giả ở giữa exportDrawingPDF (vd ngay sau
_switchToPrintTile) → kiểm tra UI có về trạng thái sạch không.
```

---

## 🔴 PROMPT P3 — Cleanup script tag leak trong `_loadPrintLibs`

```
Trong file index.html, _loadPrintLibs() (khoảng line 2511-2525)
append 2 <script> tag (jsPDF + html2canvas) vào <head> nhưng không
remove khi load fail/cancel. Mỗi lần retry sẽ append trùng.

Sửa lại:
1. Kiểm tra typeof window.jspdf/jsPDF/html2canvas trước khi append
   — nếu đã load thì resolve ngay (giống _loadExcelJS).
2. Trong onerror: remove script tag, reject promise, reset
   _printLibsPromise = null để retry sạch.
3. Thêm timeout 15s — nếu chưa load xong thì abort + cleanup.

Tham khảo pattern của _loadExcelJS() (khoảng line 1300-1320) — đã
có guard `_excelJsPromise` cached, làm theo style đó.
```

---

## 🟡 PROMPT P4 — Thay hard-coded sleep bằng tile `load` event

````
Trong file index.html, exportDrawingPDF() có nhiều setTimeout chờ
tile/map sẵn sàng:
- Line ~2158: setTimeout 3000ms sau _switchToPrintTile()
- Line ~2174, 2180, 2186: setTimeout 200/600/2000ms khác

Thay 3000ms (chờ CartoDB tile) bằng tile layer load event:
```js
await new Promise(resolve => {
    const layer = _printCartoLayer; // tile layer vừa thêm
    let resolved = false;
    layer.once('load', () => { if (!resolved) { resolved = true; resolve(); } });
    setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 5000); // fallback
});
```

Các setTimeout 200/600ms khác — đánh giá có thể bỏ không, hoặc
giảm xuống <100ms (chỉ chờ next frame:
`await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`).

Test với mạng chậm: throttling Slow 3G trong DevTools, đảm bảo PDF
vẫn capture đầy đủ tile.
````

---

## 🟡 PROMPT P5 — Extract `_preparePrintLayout()` chung

```
Trong file index.html, hàm openPrintPreview() (~line 2085-2105) và
exportDrawingPDF() (~line 2123-2244) có duplicate logic:
1. _filterRowsByTu(tuFilter)
2. _switchToPrintTile()
3. _zoomToScale(scale)
4. _buildCableLines(rows) hoặc _buildPrintCableSvg(rows, rotation)
5. _showPrintOverlay({...})

Extract thành async function _preparePrintLayout(opts) trong đó
opts = { tuFilter, scale, rotation, modeSvgCable, overlayOpts }.
Return { rows, cleanup } — cleanup là function gọi
_hidePrintOverlay + _removePrintCableSvg + _removeCableLines +
_restoreOriginalTiles.

Cả openPrintPreview và exportDrawingPDF đều gọi
_preparePrintLayout, rồi:
- preview: lưu cleanup vào _previewCleanup, gắn vào nút "Đóng xem trước"
- export: gọi cleanup() trong finally

Đảm bảo logic capture html2canvas trong exportDrawingPDF không bị
ảnh hưởng. Test cả 2 flow.
```

---

## 🟡 PROMPT P6 — Persist toàn bộ form field qua localStorage

````
Trong file index.html, modal #printDrawingModal có các field:
- pdTuSelect, pdScale, pdPaper, pdRotation
- pdTenTu, pdSoBanVe
- pdNguoiLap, pdNgay
- pdCVPhuTrach, pdCSKhuVuc

Hiện chỉ pdNguoiLap/pdCVPhuTrach/pdCSKhuVuc được save vào
localStorage (key 'pd_nl', 'pd_cv', 'pd_ks'). pdTenTu, pdSoBanVe,
pdScale, pdPaper, pdRotation chưa save.

Tạo helper:
```js
const _PD_FIELDS = ['pdTuSelect','pdScale','pdPaper','pdRotation','pdTenTu','pdSoBanVe','pdNguoiLap','pdCVPhuTrach','pdCSKhuVuc'];
function _savePdFields() {
    _PD_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) localStorage.setItem('pd_' + id, el.value);
    });
}
function _restorePdFields() {
    _PD_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        const v = localStorage.getItem('pd_' + id);
        if (el && v && !el.value) el.value = v;
    });
}
```

Gọi _restorePdFields() trong openPrintDrawingModal() sau khi
populate defaults, và _savePdFields() ở đầu exportDrawingPDF() +
openPrintPreview() trước khi đọc value.

pdNgay không persist (luôn lấy ngày hôm nay). pdTuSelect có thể
không restore được nếu data đã đổi → bọc try/catch verify option
còn tồn tại.
````

---

## 🟢 PROMPT P7 — Tách `displayInfo()` cho progress

```
Trong file index.html, hàm displayError() (tìm vị trí bằng grep)
được dùng cho cả thông báo lỗi (đỏ) lẫn progress ("Đang tải...",
"Đang capture..."). Toast màu đỏ làm user nhầm progress = lỗi.

Tạo hàm displayInfo(msg) tương tự displayError nhưng style xanh
dương (#2563eb hoặc #1e40af). Có thể reuse element #error với
class .toast-info vs .toast-error.

Refactor mọi chỗ trong exportDrawingPDF(), openPrintPreview(),
_loadPrintLibs(), updateGitHubExcel() đang dùng displayError cho
progress message → chuyển sang displayInfo. Giữ displayError chỉ
cho lỗi thật.

Grep keyword 'displayError(\'Đang ' và 'displayError(\'Đã ' để tìm
candidates.
```

---

## 🟢 PROMPT P8 — Constants cho paper size + magic numbers

````
Trong file index.html, code in bản vẽ có nhiều magic numbers:
- 110px (title block height) — line ~2009
- 14px (print frame inset) — line ~1983
- 420/297 (A3 mm), 297/210 (A4 mm) — line ~2163-2164
- 80px (search results offset), 26x42 (lamp icon size) — rải rác

Tạo block constants ở đầu script:
```js
const PRINT_CONFIG = {
    paper: {
        a3: { mmW: 420, mmH: 297 },
        a4: { mmW: 297, mmH: 210 }
    },
    titleBlockHeight: 110,
    frameInset: 14,
    legend: { top: 12, left: 12 },
    stats: { right: 12, bottomOffset: 122 },
    captureScale: 2,
    jpegQuality: 0.93
};
```

Refactor mọi nơi dùng số literal → PRINT_CONFIG.<field>. Lý do
mỗi constant (vd "120 = 110 title block + 12 padding") nên ghi
comment ngay tại object definition.
````

---

## 🎯 PROMPT P9 — TỔNG (chạy 1-shot 6 việc ưu tiên)

```
Theo audit chức năng "In bản vẽ sơ đồ tuyến trạm đèn" trong file
index.html, thực hiện tuần tự 3 fix ưu tiên cao + 3 cải thiện
trung bình:

🔴 Cao (làm trước):
1. Sửa bug biến `tuName` undefined ở exportDrawingPDF (line
   ~2190, 2221) — tìm scope đúng hoặc default 'sodotuyen'.
2. Bao toàn bộ cleanup trong finally{} của exportDrawingPDF bằng
   try/catch riêng cho mỗi step (modal close, overlay hide, SVG
   remove, tiles restore, map size restore, button enable). Thêm
   guard _previewMode → closePrintPreview() trước.
3. _loadPrintLibs (line ~2511-2525): check `typeof window.jspdf`
   trước append, onerror remove script tag + reject + reset
   promise cache, timeout 15s fallback.

🟡 Trung bình:
4. Thay setTimeout 3000ms ở line ~2158 bằng tile layer 'load'
   event với fallback 5s timeout.
5. Extract _preparePrintLayout(opts) → return {rows, cleanup},
   dùng trong cả openPrintPreview + exportDrawingPDF.
6. Persist toàn bộ field pd* qua localStorage (helper
   _savePdFields + _restorePdFields), gọi restore trong
   openPrintDrawingModal, save trong export/preview.

Sau mỗi fix, hard reload local test golden path (bấm "Xuất PDF"
→ verify PDF tải xuống đúng tên + nội dung). Nếu fail bất kỳ
bước nào, dừng và báo cáo trước khi tiếp.
```

---

## Tóm tắt audit (cho reference)

**Vấn đề nghiêm trọng:**
- Bug biến `tuName` không khai báo → tên file PDF có thể là `banve-undefined-...pdf`
- Script tag CDN bị leak (append vào `<head>` nhưng không remove khi cancel)
- State không cleanup khi export fail (race condition trong `_switchToPrintTile`)

**Performance:**
- Hard-coded sleep 3000ms chờ CartoDB tile — chậm và không đảm bảo
- SVG cable rebuild dùng string concat thay DOM API (chậm với >500 trụ)

**UX:**
- Form không nhớ `pdTenTu`/`pdSoBanVe`/`pdScale`/`pdPaper`/`pdRotation` — user gõ lại mỗi lần
- Toast `displayError` dùng cho cả progress lẫn lỗi → màu đỏ gây nhầm
- Không có canvas preview trước khi export

**Code smell:**
- Magic numbers rải rác (110px, 14px, 420/297mm…)
- Duplicate logic giữa `openPrintPreview()` ↔ `exportDrawingPDF()`
- HTML inline style >120 dòng string trong `_showPrintOverlay()`

---

# 🎨 Bộ Prompt — Cải tiến bố cục & ký hiệu bản vẽ (kế hoạch 4.9 - 4.11)

Theo CLAUDE.md mục "Tính năng đang phát triển" số 4.9, 4.10, 4.11.
Ưu tiên đề xuất: **P10 → P9 → P11** (P10 fix bug user thấy, P9 cosmetic nhỏ, P11 cần đụng data model + GAS deploy).

---

## 🟡 PROMPT P9 — Tách khung tên và khung ký hiệu hở ra (mục 4.9) ✅ DONE

```
Trong file index.html, hàm _showPrintOverlay() (~line 2049-2160) hiện
vẽ 2 khung chạm sát nhau:
- Footer (legend + stats): left:0; bottom:0; width:37.5%; height:110px;
  border-top:2px; border-right:2px (border-left/border-bottom inherit từ frame)
- Title block: right:0; bottom:0; width:62.5%; height:110px;
  border-top:2px; border-left:2px

Đổi sang layout TÁCH RỜI có gap 16px giữa 2 khung + 8px margin với frame:

footer:  left:8px;  bottom:8px; width:calc(37.5% - 16px); height:110px
title:   right:8px; bottom:8px; width:calc(62.5% - 16px); height:110px
→ gap giữa 2 khung = 100% - 37.5% - 62.5% + 16px×2 = 16px nền trắng lộ ra

Yêu cầu:
1. Sửa style position của 2 khối — left/right/width như trên
2. Đảm bảo cả 2 khối có border đầy đủ 4 cạnh (2px solid #1e293b),
   không kế thừa từ print-frame nữa
3. Thêm border-radius: 3px cho mềm mại
4. Test với cả A3 + A4 — tỷ lệ vẫn đúng (footerWidth + gap + titleWidth ≈
   100% của print frame area)

Sau khi sửa, "Xem trước" verify 2 khung tách rời rõ ràng, mỗi khung có viền
4 cạnh đầy đủ. Hard reload trước test.
```

---

## 🔴 PROMPT P10 — Hiển thị tất cả đối tượng trong bảng ký hiệu (mục 4.10) ✅ DONE

````
Trong file index.html, footer bảng ký hiệu hiện FIXED 110px (overflow:hidden)
nên với 6 loại marker + 1 cáp = 7 rows × ~26px = 182px → bị clip 4-5 hàng.
User chỉ thấy 2-3 loại đầu.

Implement auto-fit height (cách A):

1. Đếm rows cần hiển thị:
   ```js
   const N = usedTypes.length + 1; // +1 cho cáp nguồn
   const HEADER_H = 24, ROW_H = 26, PADDING_V = 6;
   const neededH = HEADER_H + N * ROW_H + PADDING_V;
   const footerH = Math.max(110, Math.min(neededH, 220)); // clamp 110-220px
   ```

2. Áp footerH cho cả 2 khối (footer + title block) — đối xứng chiều cao,
   căn dưới cùng:
   ```html
   <div style="...; bottom:0; height:${footerH}px;">  <!-- footer -->
   <div style="...; bottom:0; height:${footerH}px;">  <!-- title block -->
   ```

3. Title block 4 hàng hiện chia đều — khi height tăng cần adjust:
   - Hàng 1 (logo tổ chức): height auto
   - Hàng 2-3 (chữ ký): chia đều phần còn lại
   - Hàng 4 (tên người): fixed ~22px bottom
   → Dùng table rules đã có, height giãn tự động.

4. Fallback compact icons (cách C) — nếu N > 8:
   - Icon lamp: 14×20 (thay 24×38)
   - Icon cabinet: 12×14 (thay 22×26)
   - ROW_H giảm còn 18px
   - footerH tối đa = 200px

5. Update _showPrintOverlay opts — không cần thay đổi API, chỉ tính footerH
   nội bộ rồi inject vào style.

Lưu ý: stats nằm sát đáy print frame — nếu footerH tăng, vẫn căn bottom:0
nên 2 khối vẫn dính đáy như cũ, chỉ kéo dài LÊN TRÊN, không xuống.

Test với data có 1, 3, 5, 7 loại marker — verify tất cả hiện hết, không bị clip.
````

---

## 🔴 PROMPT P11 — Phân loại cáp (cáp ngầm vs cáp nổi) (mục 4.11) ✅ DONE

````
Thêm cột "Loại cáp" (column index 22) vào sheet DanhSachTru — value
'noi' / 'ngam' / '' (default 'noi'). Mỗi marker có row[14] (Marker gốc)
sẽ dùng row[22] để chọn style cáp khi vẽ.

🔧 Phần 1 — Update GAS (gas-khaosat.js):

1. Thêm 'Loại cáp' vào HEADER array (sau 'Số lượng đèn'):
   ```js
   const HEADER = [..., 'Số lượng đèn', 'Loại cáp'];
   ```

2. Thêm vào FIELD_MAP:
   ```js
   'loaiCap': 'Loại cáp',
   ```

3. Redeploy GAS (New version) — bắt buộc.

🔧 Phần 2 — Update index.html (UI nhập liệu):

1. Trong popup marker, thêm <select> "Loại cáp" cùng hàng với "Khoảng cách":
   ```html
   <div class="form-row">
     <div class="form-group w3">
       <label>Cáp Trụ/tủ gốc</label>
       <select id="markerBaseSelect">...</select>
     </div>
     <div class="form-group w2">
       <label>Cách (m)</label>
       <input id="markerKhoangCachInput" type="number">
     </div>
     <div class="form-group w2">
       <label>Loại cáp</label>
       <select id="markerLoaiCapInput">
         <option value="noi">Cáp nổi</option>
         <option value="ngam">Cáp ngầm</option>
       </select>
     </div>
   </div>
   ```

2. saveMarkerPopup() đọc value: `const loaiCap = (document.getElementById('markerLoaiCapInput')||{}).value || 'noi';`
   Push vào newRow ở index 22.

3. openEditMarker() restore: `markerLoaiCapInput.value = row[22] || 'noi';`

4. syncRowToGAS() payload thêm: `loaiCap: row[22] || 'noi'`

🔧 Phần 3 — Update vẽ cáp:

1. Constants CABLE_STYLE ở đầu print section:
   ```js
   const CABLE_STYLE = {
     noi:  { color: '#1e40af', dashArray: '10 4',    label: 'Cáp nổi'  },
     ngam: { color: '#dc2626', dashArray: '2 3 8 3', label: 'Cáp ngầm' }
   };
   ```

2. _buildCableLines(rows): mỗi polyline dùng style theo r[22]:
   ```js
   const cableType = String(r[22] || 'noi');
   const style = CABLE_STYLE[cableType] || CABLE_STYLE.noi;
   const line = L.polyline([from, to], {
     color: style.color, weight: 2.5,
     dashArray: style.dashArray, opacity: 0.8
   });
   ```

3. _buildPrintCableSvg(rows) tương tự — set stroke + stroke-dasharray theo style.

🔧 Phần 4 — Update legend + stats footer:

1. Tách count + tổng cáp theo loại:
   ```js
   let cnNoi = 0, cnNgam = 0, lenNoi = 0, lenNgam = 0;
   rows.forEach(r => {
     if (!r[14]) return;
     const type = String(r[22] || 'noi');
     const len = computeLength(r); // logic Haversine fallback như cũ
     if (type === 'ngam') { cnNgam++; lenNgam += len; }
     else                 { cnNoi++;  lenNoi  += len; }
   });
   ```

2. Footer table thêm 2 row riêng (thay 1 row "Cáp nguồn"):
   - Row "Cáp nổi": SVG dashArray='10 4' xanh + count + tổng m
   - Row "Cáp ngầm": SVG dashArray='2 3 8 3' đỏ + count + tổng m
   - Nếu lenNgam == 0 → ẩn row cáp ngầm, ngược lại

🔧 Phần 5 — Migration safety:

- Marker cũ không có row[22] → default 'noi' (vẽ như cũ, không break)
- Sheet địa bàn cũ chưa có cột "Loại cáp" → ensureHeader() trong GAS tự thêm

🔧 Phần 6 — CLAUDE.md update:

- Đổi "Cấu trúc cột (DanhSachTru) — 22 cột" → 23 cột
- Thêm row [22] | Loại cáp | loaiCap | 'noi'/'ngam' (default 'noi')

Test:
1. Thêm marker mới, chọn "Cáp ngầm" → verify lưu Sheet OK
2. Reload data → vẽ cáp với dashArray + color khác
3. In PDF → legend hiện 2 dòng "Cáp nổi" + "Cáp ngầm" với count đúng
4. Marker cũ vẽ vẫn xanh nét đứt (default 'noi')
````

---

## 🎯 PROMPT P12 — TỔNG (cả 3 cải tiến 1-shot) ✅ DONE (qua P9+P10+P11)

```
Theo CLAUDE.md mục 4.9-4.11, implement tuần tự 3 cải tiến bản vẽ:

1. (4.10) **Auto-fit footer height** — fix bug bảng ký hiệu bị clip
   chỉ hiện 2-3 hàng. Tính footerH theo số loại marker, clamp 110-220px,
   apply cho cả footer lẫn title block (đối xứng). Fallback compact icons
   khi N > 8.

2. (4.9) **Tách footer & title block** — đổi position từ dính sát sang
   left:8px / right:8px / width:calc(... - 16px), gap 16px giữa 2 khung,
   border 4 cạnh đầy đủ, border-radius:3px.

3. (4.11) **Phân loại cáp ngầm/nổi**:
   - GAS: HEADER + FIELD_MAP thêm 'Loại cáp', redeploy New version
   - UI popup: <select> Loại cáp cùng hàng với Khoảng cách
   - saveMarkerPopup / openEditMarker / syncRowToGAS đọc/ghi row[22]
   - CABLE_STYLE constants — noi: '10 4' xanh, ngam: '2 3 8 3' đỏ
   - _buildCableLines + _buildPrintCableSvg apply style theo r[22]
   - Legend bottom-left: tách 2 row "Cáp nổi" + "Cáp ngầm" với count & length riêng
   - Migration: row cũ default 'noi', sheet cũ ensureHeader tự thêm cột
   - CLAUDE.md: cập nhật 22 → 23 cột

Sau mỗi mục, hard reload + test:
- 4.10: data có 1, 3, 5, 7 loại — không bị clip
- 4.9: 2 khung tách rời, gap rõ, viền 4 cạnh
- 4.11: thêm marker cáp ngầm, in PDF, verify dashArray + màu + legend

Báo cáo sau từng mục, dừng nếu test fail.
```

---

# 📡 Bộ Prompt — Chế độ GPS Phone + RTK Tersus Luka (Tính năng 11)

Theo CLAUDE.md "Tính năng 11: Chế độ GPS với hỗ trợ RTK Tersus Luka" (mục 11.1 - 11.11).
Tách thành 3 phase: **P13a (foundation)** → **P13b (pipeline + UX)** → **P13c (polish + docs)**.

⚠ **P13a cần redeploy GAS** (HEADER mở rộng 22 → 24 cột). Đảm bảo bạn có quyền edit GAS trước khi chạy.

---

## 🔴 PROMPT P13a — Foundation: GPS_MODES config + Toggle UI + Sheet schema ✅ DONE

````
Implement nền tảng cho hệ thống chế độ GPS theo CLAUDE.md mục 11.1, 11.2,
11.3, 11.8. KHÔNG động vào các call site getCurrentPosition cũ (để P13b lo)
— chỉ build infrastructure.

🔧 Phần 1 — Constants + state

Trong index.html, gần TYPE_CONFIG (~line 1539), thêm:
```js
const GPS_MODES = {
    phone: {
        label: '📱 Phone GPS', emoji: '📱',
        targetAccuracy: 5.0, maxWaitMs: 30000,
        useAveraging: true, averageSamples: 8,
        coordPrecision: 6, vn2000Precision: 0,
        statusBadge: false
    },
    rtk: {
        label: '🛰 RTK', emoji: '🛰',
        targetAccuracy: 0.05, maxWaitMs: 60000,
        useAveraging: false,
        coordPrecision: 8, vn2000Precision: 3,
        statusBadge: true
    }
};
let currentGpsMode = localStorage.getItem('gpsMode') || 'phone';
```

🔧 Phần 2 — Helpers (gần các helper khác)

```js
function formatAccuracy(meters) {
    if (meters < 1)   return `±${(meters * 100).toFixed(1)} cm`;
    if (meters < 10)  return `±${meters.toFixed(2)} m`;
    return `±${meters.toFixed(0)} m`;
}

function rtkStatus(acc) {
    if (acc <= 0.05) return { label: 'RTK FIXED', color: '#10b981', emoji: '🟢' };
    if (acc <= 0.50) return { label: 'RTK FLOAT', color: '#f59e0b', emoji: '🟡' };
    if (acc <= 5.00) return { label: 'DGPS',      color: '#3b82f6', emoji: '🔵' };
    return                   { label: 'SPS',       color: '#6b7280', emoji: '⚪' };
}

function formatCoord(value, mode) {
    const cfg = GPS_MODES[mode || currentGpsMode];
    return Number(value).toFixed(cfg.coordPrecision);
}

function formatVn2000(value, mode) {
    const cfg = GPS_MODES[mode || currentGpsMode];
    return Number(value).toFixed(cfg.vn2000Precision);
}
```

🔧 Phần 3 — Toggle UI trong ☰ Settings

Trong modal #controlsModal, thêm section MỚI giữa "Điều hướng" và
"Chỉnh vị trí & Đồng bộ":
```html
<div class="ctrl-divider"></div>
<div class="ctrl-section">
    <div class="ctrl-title">Thiết bị GPS</div>
    <label class="ctrl-radio">
        <input type="radio" name="gpsMode" value="phone" onchange="switchGpsMode('phone')">
        <span>📱 Phone GPS <span class="hint">(mặc định, ±3-10m)</span></span>
    </label>
    <label class="ctrl-radio">
        <input type="radio" name="gpsMode" value="rtk" onchange="switchGpsMode('rtk')">
        <span>🛰 RTK Tersus Luka <span class="hint">(±cm, cần setup mock location)</span></span>
    </label>
    <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">
        <a href="huongdan.html#s15" target="_blank">📖 Hướng dẫn setup RTK</a>
    </div>
</div>
```

Hàm switchGpsMode:
```js
function switchGpsMode(newMode) {
    if (!GPS_MODES[newMode]) return;
    // Auto-discard ongoing GPS tracking (P13b sẽ implement _hideGpsTrackingBar)
    if (typeof _hideGpsTrackingBar === 'function') _hideGpsTrackingBar();
    currentGpsMode = newMode;
    localStorage.setItem('gpsMode', newMode);
    displayInfo(`Đã chuyển sang chế độ ${GPS_MODES[newMode].label}`);
    _syncGpsModeRadio();
}

function _syncGpsModeRadio() {
    document.querySelectorAll('input[name="gpsMode"]').forEach(r => {
        r.checked = r.value === currentGpsMode;
    });
}
// Gọi _syncGpsModeRadio() khi modal #controlsModal mở (sau _applyRoleUI)
```

CSS .ctrl-radio (gần .ctrl-btn):
```css
.ctrl-radio { display:flex; align-items:center; gap:8px; padding:8px 10px;
              border-radius:8px; cursor:pointer; font-size:14px; }
.ctrl-radio:hover { background:#f9fafb; }
.ctrl-radio input { margin:0; }
.ctrl-radio .hint { color:var(--text-muted); font-size:12px; }
```

🔧 Phần 4 — GAS HEADER mở rộng (gas-khaosat.js)

Thay HEADER array thêm 2 cột cuối:
```js
const HEADER = [
    'ID', 'Tên trụ', 'Lat', 'Lon', 'Ghi chú', 'Người KS',
    'Loại', 'Tủ điều khiển', 'Loại trụ', 'Loại cần', 'Loại đèn',
    'Công suất', 'Ảnh', 'Thời gian cập nhật', 'Marker gốc', 'Khoảng cách (m)',
    'Mã PE', 'Đường', 'Phường/ Xã', 'VN2000-X', 'VN2000-Y', 'Số lượng đèn',
    'Độ chính xác (m)', 'Chế độ GPS'  // ← MỚI cột 22, 23
];
```

Thêm vào FIELD_MAP:
```js
'accuracy': 'Độ chính xác (m)',
'gpsMode':  'Chế độ GPS',
```

ensureHeader() đã handle missing columns — sẽ tự auto-append cho mọi sheet
địa bàn lần POST đầu sau redeploy.

🔧 Phần 5 — syncRowToGAS update payload

Trong syncRowToGAS, payload JSON thêm:
```js
accuracy: row[22] != null ? String(row[22]) : '',
gpsMode:  row[23] != null ? String(row[23]) : ''
```

🔧 Phần 6 — Redeploy GAS

Sau khi sửa gas-khaosat.js:
1. Mở Apps Script
2. Deploy → Manage deployments → Edit ✏️
3. Version: New version
4. Deploy (giữ nguyên URL)

🧪 Test:

1. Hard reload app
2. Mở ☰ → thấy section "Thiết bị GPS" với 2 radio button
3. Chuyển sang RTK → reload page → vẫn nhớ RTK (localStorage)
4. Trong Apps Script Editor: chạy ensureHeader() thủ công cho sheet
   DanhSachTru → verify 2 cột mới "Độ chính xác (m)" và "Chế độ GPS"
   được tạo
5. Vẫn thêm/sửa marker bình thường — không break gì
6. KHÔNG cần test mock location ở phase này (P13b)

Báo cáo: số dòng index.html tăng, số dòng gas-khaosat.js tăng, URL GAS
sau redeploy (giữ nguyên).
````

---

## 🔴 PROMPT P13b — Pipeline: getBestFix + Tracking Bar UX + Refactor call sites ✅ DONE

````
Implement GPS pipeline thống nhất theo CLAUDE.md mục 11.4, 11.5, 11.6,
11.10. Yêu cầu P13a đã xong (constants GPS_MODES + helpers tồn tại).

🔧 Phần 1 — Floating tracking bar HTML

Trong index.html, gần các overlay khác (vd #pickOnMapHint), thêm:
```html
<div id="gpsTrackingBar" style="display:none;position:fixed;left:12px;right:12px;
     bottom:calc(var(--bottombar-h) + var(--safe-bottom) + 20px);z-index:5000;
     background:white;border:2px solid #94a3b8;border-radius:12px;padding:12px;
     box-shadow:0 4px 20px rgba(0,0,0,.25);transition:border-color .3s, transform .2s;
     font-family:var(--font);">
    <div style="display:flex;align-items:center;gap:12px;">
        <div id="gpsStatusIcon" style="font-size:24px;flex-shrink:0;">🛰</div>
        <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span id="gpsStatusLabel" style="font-size:13px;font-weight:700;color:#0f172a;">Đang tìm tín hiệu...</span>
                <span id="gpsStatusBadge" style="display:none;font-size:10px;font-weight:800;
                    padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#374151;"></span>
            </div>
            <div id="gpsAccuracyText" style="font-size:20px;font-weight:800;color:#0f172a;line-height:1.1;margin-top:2px;">— —</div>
            <div id="gpsProgressText" style="font-size:11px;color:#64748b;margin-top:2px;">Đang lấy GPS...</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
            <button id="gpsAcceptBtn" style="background:#10b981;color:white;border:none;border-radius:8px;
                padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;">✓ Dùng</button>
            <button id="gpsCancelBtn" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;
                border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer;">✗ Hủy</button>
        </div>
    </div>
    <div id="gpsCountdownBar" style="display:none;margin-top:10px;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
        <div id="gpsCountdownFill" style="width:100%;height:100%;background:#10b981;transition:width 1s linear;"></div>
    </div>
    <div id="gpsWaitBetterBtn" style="display:none;text-align:center;margin-top:6px;">
        <button onclick="_gpsWaitBetter()" style="background:none;border:none;color:#3b82f6;
            font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;">⏸ Đợi tốt hơn</button>
    </div>
</div>
```

🔧 Phần 2 — Tracking bar JS controller

```js
let _gpsTrackingState = null;

function _showGpsTrackingBar({ mode }) {
    const cfg = GPS_MODES[mode];
    const bar = document.getElementById('gpsTrackingBar');
    bar.style.display = 'block';
    bar.style.borderColor = '#94a3b8';
    document.getElementById('gpsCountdownBar').style.display = 'none';
    document.getElementById('gpsWaitBetterBtn').style.display = 'none';
    document.getElementById('gpsStatusIcon').textContent = cfg.emoji;
    document.getElementById('gpsStatusLabel').textContent = `${cfg.label}: tìm tín hiệu...`;
    document.getElementById('gpsStatusBadge').style.display = 'none';
    document.getElementById('gpsAccuracyText').textContent = '— —';
    document.getElementById('gpsProgressText').textContent = `Mục tiêu: ${formatAccuracy(cfg.targetAccuracy)}`;

    const state = {
        startTime: Date.now(),
        cfg,
        autoAcceptTimer: null,
        autoAcceptCb: null,
        onAcceptCb: null,
        onCancelCb: null
    };
    _gpsTrackingState = state;

    document.getElementById('gpsAcceptBtn').onclick = () => state.onAcceptCb && state.onAcceptCb();
    document.getElementById('gpsCancelBtn').onclick = () => state.onCancelCb && state.onCancelCb();

    return {
        startTime: state.startTime,
        update: (info) => _gpsUpdateBar(info),
        startAutoAccept: (ms, cb) => _gpsStartAutoAccept(ms, cb),
        onAccept: (cb) => { state.onAcceptCb = cb; },
        onCancel: (cb) => { state.onCancelCb = cb; },
        hide: () => _hideGpsTrackingBar(),
        showWarning: (opts) => _gpsShowWarning(opts),
        dismissWarning: () => _gpsDismissWarning()
    };
}

function _gpsUpdateBar({ accuracy, status, samples, elapsed }) {
    const s = _gpsTrackingState;
    if (!s) return;
    document.getElementById('gpsAccuracyText').textContent = formatAccuracy(accuracy);
    const elapsedS = (elapsed / 1000).toFixed(1);
    const maxS = (s.cfg.maxWaitMs / 1000).toFixed(0);
    let progText = `${elapsedS}s / ${maxS}s`;
    if (s.cfg.useAveraging) progText += ` · ${samples}/${s.cfg.averageSamples} mẫu`;
    document.getElementById('gpsProgressText').textContent = progText;
    const badge = document.getElementById('gpsStatusBadge');
    if (status) {
        badge.style.display = 'inline-block';
        badge.textContent = status.label;
        badge.style.background = status.color;
        badge.style.color = 'white';
    } else {
        badge.style.display = 'none';
    }
    // Đổi border color theo accuracy
    const bar = document.getElementById('gpsTrackingBar');
    if (accuracy <= s.cfg.targetAccuracy) bar.style.borderColor = '#10b981';
    else if (accuracy <= s.cfg.targetAccuracy * 3) bar.style.borderColor = '#f59e0b';
    else bar.style.borderColor = '#94a3b8';
}

function _gpsStartAutoAccept(ms, cb) {
    const s = _gpsTrackingState;
    if (!s) return;
    // Cancel countdown cũ nếu có (vd: accuracy improve, reset)
    if (s.autoAcceptTimer) clearTimeout(s.autoAcceptTimer);
    s.autoAcceptCb = cb;
    document.getElementById('gpsCountdownBar').style.display = 'block';
    document.getElementById('gpsWaitBetterBtn').style.display = 'block';
    const fill = document.getElementById('gpsCountdownFill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    void fill.offsetWidth; // force reflow
    fill.style.transition = `width ${ms}ms linear`;
    fill.style.width = '0%';
    s.autoAcceptTimer = setTimeout(() => {
        if (s.autoAcceptCb) s.autoAcceptCb();
    }, ms);
}

function _gpsWaitBetter() {
    const s = _gpsTrackingState;
    if (!s) return;
    if (s.autoAcceptTimer) clearTimeout(s.autoAcceptTimer);
    s.autoAcceptTimer = null;
    s.autoAcceptCb = null;
    document.getElementById('gpsCountdownBar').style.display = 'none';
    document.getElementById('gpsWaitBetterBtn').style.display = 'none';
}

function _hideGpsTrackingBar() {
    const s = _gpsTrackingState;
    if (s && s.autoAcceptTimer) clearTimeout(s.autoAcceptTimer);
    _gpsTrackingState = null;
    document.getElementById('gpsTrackingBar').style.display = 'none';
}
```

🔧 Phần 3 — getBestFix(opts) unified

API: `getBestFix(opts)` — opts hỗ trợ:
- `forceMode`: 'phone' | 'rtk' — override currentGpsMode tạm thời
- `quickMode`: true — chế độ silent fast cho luồng cần fix nhanh (vd routing).
  Không hiện tracking bar, timeout ngắn (~8s), nhận fix đầu tiên có accuracy
  hợp lý (không chờ <5m / <5cm).

```js
async function getBestFix(opts = {}) {
    const mode = opts.forceMode || currentGpsMode;
    const cfg  = GPS_MODES[mode];

    // ── QUICK MODE — silent, fast, dùng cho routing fallback ──
    if (opts.quickMode) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                pos => resolve(pos),
                err => reject(err),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
            );
        });
    }

    // ── INTERACTIVE MODE — có tracking bar, threshold check, averaging ──
    const bar  = _showGpsTrackingBar({ mode });

    let bestFix = null;
    let samples = [];

    return new Promise((resolve, reject) => {
        const finish = (result) => {
            navigator.geolocation.clearWatch(watchId);
            bar.hide();
            resolve(result);
        };
        const fail = (err) => {
            navigator.geolocation.clearWatch(watchId);
            bar.hide();
            reject(err);
        };

        const watchId = navigator.geolocation.watchPosition(
            pos => {
                const acc = pos.coords.accuracy;
                if (!bestFix || acc < bestFix.coords.accuracy) bestFix = pos;
                if (cfg.useAveraging && acc < cfg.targetAccuracy * 3) samples.push(pos);

                bar.update({
                    accuracy: acc,
                    status: cfg.statusBadge ? rtkStatus(acc) : null,
                    samples: samples.length,
                    elapsed: Date.now() - bar.startTime
                });

                const reachedTarget = (acc <= cfg.targetAccuracy);
                const enoughSamples = cfg.useAveraging && samples.length >= cfg.averageSamples;

                if (reachedTarget && !cfg.useAveraging) {
                    bar.startAutoAccept(3000, () => finish(bestFix));
                } else if (enoughSamples) {
                    finish(averageFixes(samples));
                } else if (reachedTarget && cfg.useAveraging && samples.length >= 3) {
                    // Mode phone đạt target sớm với ≥3 samples → cũng auto-accept
                    bar.startAutoAccept(3000, () => finish(averageFixes(samples)));
                }
            },
            err => fail(err),
            { enableHighAccuracy: true, maximumAge: 0, timeout: cfg.maxWaitMs }
        );

        setTimeout(() => {
            if (bestFix) finish(cfg.useAveraging && samples.length > 0 ? averageFixes(samples) : bestFix);
            else fail(new Error('Không lấy được GPS — quá thời gian chờ'));
        }, cfg.maxWaitMs);

        bar.onAccept(() => {
            if (bestFix) finish(cfg.useAveraging && samples.length > 0 ? averageFixes(samples) : bestFix);
            else fail(new Error('Chưa có fix nào'));
        });
        bar.onCancel(() => fail(new Error('User đã hủy')));
    });
}

function averageFixes(fixes) {
    const lats = fixes.map(f => f.coords.latitude).sort();
    const lons = fixes.map(f => f.coords.longitude).sort();
    const medLat = lats[Math.floor(lats.length / 2)];
    const medLon = lons[Math.floor(lons.length / 2)];
    const inliers = fixes.filter(f => {
        const dLat = Math.abs(f.coords.latitude - medLat);
        const dLon = Math.abs(f.coords.longitude - medLon);
        return dLat < 0.00005 && dLon < 0.00005;
    });
    const avgLat = inliers.reduce((s, f) => s + f.coords.latitude, 0) / inliers.length;
    const avgLon = inliers.reduce((s, f) => s + f.coords.longitude, 0) / inliers.length;
    const avgAcc = inliers.reduce((s, f) => s + f.coords.accuracy, 0) / inliers.length;
    return {
        coords: {
            latitude: avgLat, longitude: avgLon,
            accuracy: avgAcc / Math.sqrt(inliers.length)
        }
    };
}
```

🔧 Phần 4 — Refactor 6 call sites + 1 quick mode

Thay `navigator.geolocation.getCurrentPosition(success, error, opts)` bằng:
```js
try {
    const fix = await getBestFix();
    success(fix);
} catch(err) {
    error(err);
}
```

Các vị trí cần thay (interactive mode — có tracking bar):
- ~line 3766: startAddMarker GPS auto
- ~line 4834: centerOnUserLocation
- ~line 4853: "Vị trí hiện tại" button in form
- ~line 5247: Geocode lat/lon
- ~line 5305: "Định vị" marker popup

Vị trí dùng **quickMode** (silent, không tracking bar):
- ~line 5235: routing fallback — cần fix nhanh để bắt đầu tính tuyến
  ```js
  try {
      const fix = await getBestFix({ quickMode: true });
      success(fix);
  } catch(err) {
      error(err);
  }
  ```

Giữ NGUYÊN (watchPosition liên tục, không phải single fix):
- ~line 4732: startTrackingCurrentLocation — live location tracking, P13c sẽ
  update options để đọc GPS_MODES config

🔧 Phần 5 — Accuracy circle với màu theo status

Tìm hàm tạo currentLocationAccuracyCircle. Thay color hardcode bằng:
```js
const color = rtkStatus(acc).color;
L.circle([lat, lon], { radius: acc, color, fillColor: color, fillOpacity: 0.15, weight: 1 });
```

🧪 Test:

1. Hard reload, chế độ phone GPS, bấm "Vị trí hiện tại"
   → Tracking bar hiện, accuracy realtime, samples counter tăng
   → Đạt 8 samples HOẶC accuracy <5m → auto-accept 3s countdown
   → Bấm "Đợi tốt hơn" → countdown dừng, vẫn track
   → Bấm "Dùng" → finish ngay với best so far
2. Bấm "Thêm marker" → tracking bar → đặt được marker tự động
3. Bấm "Hủy" giữa chừng → bar đóng, không đặt marker
4. **Test quickMode**: Bấm "Chỉ đường" trong popup marker
   → **KHÔNG có tracking bar** (silent mode)
   → Routing bắt đầu trong <8s với fix đầu tiên
   → Console log fix với accuracy không cần <5m
5. Chuyển sang RTK mode (chưa setup mock) → bấm vị trí
   → Bar hiện 60s timeout, accuracy ~5m, không Fixed
   → Hết 60s → dùng best fix có sẵn
6. Verify accuracy circle đổi màu: xanh (Fixed) / vàng (Float) / xám (Phone)

Báo cáo: 6 interactive call sites + 1 quickMode call site đã refactor,
edge case nào gặp.
````

---

## 🟡 PROMPT P13c — Polish: Precision tọa độ + Warn RTK + Docs ✅ DONE

````
Finalize chế độ GPS theo CLAUDE.md mục 11.7, 11.9, 11.11. Yêu cầu
P13a và P13b đã chạy xong.

🔧 Phần 1 — Precision tọa độ conditional khi LƯU & HIỂN THỊ

1. saveMarkerPopup (và mọi nơi push vào loadedData):
```js
const lat = formatCoord(rawLat);  // toFixed(6) hoặc toFixed(8) tùy mode
const lon = formatCoord(rawLon);
// Lưu STRING vào row[2], row[3] để giữ trailing zeros
row[2] = lat; row[3] = lon;
// Lưu accuracy + mode vào cột mới
row[22] = String(rawAccuracy);
row[23] = currentGpsMode;
```

2. VN2000 calculation conditional:
```js
const {x, y} = convertLatLonToVn2000(lat, lon);
row[19] = formatVn2000(x);  // integer hoặc 3 decimal
row[20] = formatVn2000(y);
```

3. Marker popup display tọa độ:
Tìm các nơi `lat.toFixed(6)` thay bằng:
```js
formatCoord(lat, row[23])  // dùng mode đã lưu trong row, không phải currentGpsMode
```

🔧 Phần 2 — Hiển thị accuracy + mode badge trong popup

Trong createMarkerPopupContent, thêm dòng dưới tọa độ:
```js
const acc = parseFloat(row[22]);
const mode = String(row[23] || '');
const accInfo = Number.isFinite(acc) ? formatAccuracy(acc) : '—';
const modeEmoji = mode === 'rtk' ? '🛰' : (mode === 'phone' ? '📱' : '');
const statusBadge = Number.isFinite(acc) && mode === 'rtk' ?
    `<span style="background:${rtkStatus(acc).color};color:white;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;">${rtkStatus(acc).label}</span>` : '';
// Inject vào HTML: ${modeEmoji} ${accInfo} ${statusBadge}
```

🔧 Phần 3 — Warn khi RTK không Fixed sau 30s

Trong getBestFix watchPosition callback, sau khi update bar:
```js
const elapsed = Date.now() - bar.startTime;
if (mode === 'rtk' && elapsed > 30000 && acc > 0.5 && !s._warnShown) {
    s._warnShown = true;
    bar.showWarning({
        title: '⚠ Chế độ RTK nhưng accuracy ' + formatAccuracy(acc),
        body: 'Bạn có thể chưa setup mock location đúng. Kiểm tra Nuwa đã connect Luka chưa, NTRIP đang Fixed chưa.',
        actions: [
            { label: '📖 Hướng dẫn', onClick: () => window.open('huongdan.html#s15', '_blank') },
            { label: 'Tiếp tục đợi', onClick: () => bar.dismissWarning() }
        ]
    });
}
```

Implement _gpsShowWarning trong tracking bar controller:
- Thêm sub-div trong bar HTML để hiển thị warning (yellow background)
- showWarning render content + actions buttons
- dismissWarning hide sub-div, set s._warnShown = true để không re-show

🔧 Phần 4 — Sync với startTrackingCurrentLocation

startTrackingCurrentLocation (watchPosition liên tục) cần đọc GPS_MODES
cho options:
```js
const cfg = GPS_MODES[currentGpsMode];
navigator.geolocation.watchPosition(
    pos => updateCurrentLocationMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    err => displayError('Không thể lấy vị trí: ' + err.message),
    {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: cfg.maxWaitMs
    }
);
```

updateCurrentLocationMarker cũng dùng _updateAccuracyCircle (đổi màu theo status).

🔧 Phần 5 — CSS cảnh báo trong bar

```css
#gpsTrackingBar.has-warning { border-color: #f59e0b; }
.gps-warning-box { background:#fef3c7; border:1px solid #f59e0b; border-radius:8px;
    padding:8px 10px; margin-top:8px; font-size:12px; color:#92400e; }
.gps-warning-box .gw-title { font-weight:700; margin-bottom:4px; }
.gps-warning-box .gw-actions { display:flex; gap:8px; margin-top:6px; }
.gps-warning-box button { background:white; border:1px solid #d97706; color:#92400e;
    border-radius:6px; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer; }
```

🔧 Phần 6 — Cập nhật MEMORY và CLAUDE

CLAUDE.md đã có Tính năng 11 từ trước — chỉ cần đánh dấu các checkbox đã
implement xong (✅).

🧪 Test:

1. Marker mới với chế độ phone → row[22] có accuracy (vd "3.8"),
   row[23] = "phone", lat/lon dạng 10.123456
2. Marker mới với RTK mock (nếu có hardware) → lat/lon 10.12345678 (8 chữ số),
   accuracy ~0.02, mode "rtk"
3. Popup marker hiển thị "📱 ±3.8 m" hoặc "🛰 ±2.1 cm  RTK FIXED"
4. Chuyển sang RTK, đứng 35s với accuracy ~5m (chưa setup mock) → warning
   hiện màu vàng kèm nút "Hướng dẫn" (mở huongdan.html#s15)
5. Bấm "Tiếp tục đợi" → warning đóng, vẫn track
6. Accuracy circle đổi màu khi tracking liên tục (Phone vs RTK)

Báo cáo: confirm precision lưu sheet đúng format, popup hiển thị badge,
warning hoạt động đúng.
````

---

## 🎯 PROMPT P13 — TỔNG (cả 3 phase 1-shot, dùng cho dev nhanh) ✅ DONE (qua P13a+b+c)

```
Implement toàn bộ Tính năng 11 (Chế độ GPS Phone + RTK) trong CLAUDE.md
theo thứ tự P13a → P13b → P13c. Sau mỗi phase hard reload + test sanity
trước khi sang phase tiếp.

P13a (Foundation, ~1 giờ):
- GPS_MODES config + currentGpsMode state + helpers
- Toggle UI radio trong ☰ Settings
- GAS HEADER 22→24 cột (Độ chính xác, Chế độ GPS), redeploy
- syncRowToGAS payload thêm 2 field

P13b (Pipeline + UX, ~2 giờ):
- Floating tracking bar HTML + controller
- getBestFix(opts) unified function với auto-accept countdown 3s
- averageFixes với MAD outlier filter
- Refactor 5 call sites (Vị trí hiện tại, Thêm marker, Định vị popup, v.v.)
- Accuracy circle màu theo rtkStatus

P13c (Polish + Docs, ~1 giờ):
- Precision tọa độ conditional (formatCoord/formatVn2000)
- Popup hiển thị accuracy + mode badge
- Warn khi RTK >30s không Fixed + nút "Hướng dẫn"
- startTrackingCurrentLocation đọc GPS_MODES config

Sau khi xong:
- Mark các checkbox trong CLAUDE.md mục 11 thành ✅
- Test phone GPS: track → đạt target 5m → auto-accept
- Test RTK (nếu có hardware): track → Fixed → 3s countdown → accept
- Test switching mode giữa chừng → ongoing track auto-discard
- Test cancel button → dismiss bar, không tạo marker

Báo cáo lỗi sau mỗi phase, dừng nếu test fail.
```

---

## Session 2026-07-11 — Rotation + PDF sharpness + Drive URL migration

### P14 — Bật lại xoay bản đồ 2D ✅

**Trạng thái**: đã implement, đang thử nghiệm.

**Đã làm**:
- Thêm section "Xoay bản đồ" vào ☰ panel (slider 0-359° + 4 nút quick B/Đ/N/T + reset)
- Wire `_onRotSliderChange`, `_setRotation`, `_resetRotSlider`
- Rewrite `_applyMapRotation` để dùng `L.DomUtil.getPosition(pane)` thay `getBoundingClientRect()` — fix bug xoay lệch tâm
- Thêm `_installRotationHook()` hook `map.on('move viewreset zoomanim')` re-apply rotation — Leaflet ghi đè transform khi pan/zoom sẽ bị wipe
- Thêm `_setRotationTileBuffer(active)` monkey-patch `L.GridLayer.prototype._pxBoundsToTileRange` mở rộng bounds 60% khi rotate → fix tam giác trắng 4 góc chéo
- Sync slider ↔ `_currentMapRotation` khi mở ☰ modal

**Limitation đã biết** (chưa fix):
- Click bản đồ để thêm marker → tọa độ lệch vì `containerPointToLatLng` không tính rotation
- Kéo marker → drop tại vị trí sai so với con trỏ
- Label tên tủ ở zoom cao → chữ bị xoay theo, khó đọc

Nếu limitation trở thành vấn đề thực tế, cần patch `map.mouseEventToContainerPoint` để bù rotation.

---

### P15 — Chữ PDF bể → sắc nét ✅

**Nguyên nhân**: html2canvas capture ở `captureScale=2` (~2400×1700px), jsPDF stretch lên A3 300 DPI (~4960×3508) = **2.07× upscale** → text mờ/bể.

**Fix**:
1. `PRINT_CONFIG.captureScale: 2 → 3` (capture 3600×2400, stretch chỉ 1.38×)
2. `PRINT_CONFIG.jpegQuality: 0.93 → 0.95` (giữ cho code khác nếu có, PDF đã đổi PNG)
3. `canvas.toDataURL('image/jpeg') → 'image/png'` — JPEG chroma subsampling tạo halo mờ quanh text
4. `doc.addImage(imgData, 'PNG', 0, 0, pw, ph, undefined, 'FAST')` — PNG lossless
5. `#printOverlay` thêm CSS `text-rendering:geometricPrecision`, `-webkit-font-smoothing:antialiased`, `-moz-osx-font-smoothing:grayscale`

**Trade-off**:
| | Trước | Sau |
|---|---|---|
| Chất lượng chữ | Bể, halo mờ | Sắc, không halo |
| Kích thước PDF | ~3 MB | ~8-10 MB |
| Thời gian export | ~5s | ~10-15s |
| Memory peak | ~40 MB | ~90 MB (mobile cũ có thể fail) |

**TODO nếu cần**: detect `isMobile` → dùng scale 2 trên mobile, scale 3 desktop.

---

### P16 — Drive URL migration ✅

**Nguyên nhân**: Google đã deprecate `https://drive.google.com/uc?export=view&id=<ID>` từ 2024. Tag `<img>` không load được → placeholder.

**Fix**: Thêm helper global `_migrateDriveUrl(url)`:
```js
function _migrateDriveUrl(url) {
    if (!url || typeof url !== 'string') return url;
    const m = url.match(/drive\.google\.com\/uc\?export=view&id=([\w-]+)/);
    if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
    return url;
}
```

**Áp dụng**:
| Vị trí | Mô tả |
|---|---|
| `createMarkerPopupContent` | Split `imageValue` bằng `;` rồi map qua `_migrateDriveUrl` — avatar + strip ảnh phụ |
| `openEditMarker` | Split `row[12]` rồi map qua `_migrateDriveUrl` — restore 3 slot khi Sửa |

Data trong sheet KHÔNG bị sửa — migrate transparent lúc render. Nếu Google đổi format tiếp, chỉ cần sửa `_migrateDriveUrl`.

---

### SW cache: v7 → v8

Bump `sw.js` cache name để force clients re-fetch code mới (rotation UI + print PNG + drive URL migration).

---

## Tính năng 12 — Overlay bản vẽ CAD (DXF) lên bản đồ (giống Nuwa)

Mục tiêu: cho phép user tải bản vẽ AutoCAD (DXF) lên → hiển thị đúng vị trí trên Leaflet, toggle layer, snap marker về đỉnh CAD, stake-out điều hướng RTK.

Chia 4 phase độc lập — chạy tuần tự P17 → P18 → P19 → P20. Mỗi phase có deliverable dùng được.

---

### P17 — Phase 1: MVP hiển thị DXF overlay (3-5 ngày)

```
Task: Thêm chức năng tải và hiển thị bản vẽ DXF trên Leaflet map, đúng vị trí theo tọa độ VN-2000.

## Prerequisites
- File index.html đã có convertLatLonToVn2000() và IndexedDB cache helpers (idbGet/idbSet/idbOpen)
- Leaflet + L.SVG đã load

## 1. Thêm thư viện dxf-parser

Load lazy khi user click nút "Tải bản vẽ" (không add vào bundle chính):
```js
async function _loadDxfParser() {
    if (window.DxfParser) return;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/parser.js';
        s.onload = resolve;
        s.onerror = () => { s.remove(); reject(new Error('Không tải được dxf-parser')); };
        setTimeout(() => reject(new Error('Timeout tải dxf-parser')), 15000);
        document.head.appendChild(s);
    });
}
```

## 2. Thêm helper convertVn2000ToLatLon (đảo ngược công thức Gauss-Krüger)

Hiện app đã có convertLatLonToVn2000 (múi 6°, ellipsoid GRS80). Viết reverse dùng công thức Redfearn hoặc iterative:
```js
function convertVn2000ToLatLon(x, y, centralMeridianDeg) {
    // Input: x=Northing (m), y=Easting (m), centralMeridianDeg (105/105.5/105.75)
    // Output: {lat, lon} degrees
    // Iterative approach: bắt đầu guess lat/lon từ zone → convertLatLonToVn2000 → so sánh → Newton refine
    // Đủ tolerance 1cm sau ~5 iterations
}
```
Test: chọn 1 marker có VN-2000 trong sheet → convert ngược → so sánh lat/lon gốc, sai số < 0.5m.

## 3. State + IndexedDB store

```js
let _cadLayer = null;           // L.LayerGroup chứa SVG overlay
let _cadEntities = [];          // parsed entities từ DXF
let _cadMeta = null;            // {filename, uploadedAt, zone, layers, bounds}
let _cadVisible = true;

// IndexedDB store mới: 'cad-drawings' — key: sheetName, value: {dxfText, meta}
```

## 4. UI trong ☰ panel

Thêm section mới sau "Xuất dữ liệu":
```html
<div class="ctrl-section">
    <div class="ctrl-title">Bản vẽ CAD</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <button class="ctrl-btn" onclick="_openCadUpload()">📐 Tải DXF</button>
        <button class="ctrl-btn outline" onclick="_toggleCad()" id="btnCadToggle" disabled>👁 Ẩn/Hiện</button>
    </div>
    <div id="cadInfoBox" style="display:none;margin-top:6px;font-size:11px;color:var(--text-muted);">
        <div id="cadFilename"></div>
        <div id="cadEntityCount"></div>
        <button class="ctrl-btn outline" onclick="_removeCad()" style="width:100%;margin-top:4px;">🗑 Gỡ bản vẽ</button>
    </div>
</div>
```

## 5. Upload modal — chọn file + zone

Modal đơn giản với:
- Input file accept=".dxf"
- Select "Kinh tuyến trung tâm" (105° / 105.5° / 105.75°) — default theo currentSheet:
  - HCM (Quan*/PhuNhuan/BinhThanh/TanBinh/TanPhu): 105°
  - Bình Dương (BauBang/TruVanTho/BenCat): 105.5°
  - Long An (CanGiuoc): 105.75°
- Nút "Tải lên"

## 6. Parse DXF → entities

```js
async function _uploadCad(file, centralMeridianDeg) {
    displayInfo('Đang phân tích DXF...');
    await _loadDxfParser();
    const text = await file.text();
    const parser = new DxfParser();
    const dxf = parser.parseSync(text);
    
    // Extract entities: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT
    const entities = [];
    (dxf.entities || []).forEach(e => {
        if (e.type === 'LINE') entities.push({
            type: 'line', layer: e.layer, color: e.color,
            points: [{x:e.vertices[0].x, y:e.vertices[0].y}, {x:e.vertices[1].x, y:e.vertices[1].y}]
        });
        else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') entities.push({
            type: 'polyline', layer: e.layer, color: e.color,
            points: e.vertices.map(v => ({x:v.x, y:v.y}))
        });
        else if (e.type === 'CIRCLE') entities.push({
            type: 'circle', layer: e.layer, color: e.color,
            center: {x:e.center.x, y:e.center.y}, radius: e.radius
        });
        else if (e.type === 'TEXT' || e.type === 'MTEXT') entities.push({
            type: 'text', layer: e.layer, color: e.color,
            position: {x:e.position.x, y:e.position.y},
            text: e.text || e.string || '', height: e.textHeight || 2.5
        });
        // Skip ARC, HATCH, BLOCK cho MVP
    });
    
    _cadEntities = entities;
    _cadMeta = {
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        zone: centralMeridianDeg,
        layers: [...new Set(entities.map(e => e.layer))],
        entityCount: entities.length
    };
    
    // Cache
    await idbSet('cad-drawings', currentSheet, { dxfText: text, entities, meta: _cadMeta });
    
    _renderCadLayer();
    displayInfo(`Đã tải ${entities.length} đối tượng CAD`);
}
```

## 7. Render entities → SVG overlay

Convert VN-2000 XY → lat/lon → L.polyline / L.circle / L.marker (text as divIcon):
```js
function _renderCadLayer() {
    if (_cadLayer) map.removeLayer(_cadLayer);
    _cadLayer = L.layerGroup();
    
    const zone = _cadMeta.zone;
    _cadEntities.forEach(e => {
        const dxfColor = _dxfColorToHex(e.color);
        if (e.type === 'line' || e.type === 'polyline') {
            const latlngs = e.points.map(p => {
                const { lat, lon } = convertVn2000ToLatLon(p.x, p.y, zone);
                return [lat, lon];
            });
            L.polyline(latlngs, { color: dxfColor, weight: 1.5, opacity: 0.8, interactive: false })
                .addTo(_cadLayer);
        } else if (e.type === 'circle') {
            const { lat, lon } = convertVn2000ToLatLon(e.center.x, e.center.y, zone);
            L.circle([lat, lon], { radius: e.radius, color: dxfColor, weight: 1, fillOpacity: 0.1 })
                .addTo(_cadLayer);
        } else if (e.type === 'text') {
            const { lat, lon } = convertVn2000ToLatLon(e.position.x, e.position.y, zone);
            const icon = L.divIcon({
                className: 'cad-text-label',
                html: `<span style="color:${dxfColor};font-size:10px;white-space:nowrap;">${e.text}</span>`,
                iconAnchor: [0, 0]
            });
            L.marker([lat, lon], { icon, interactive: false }).addTo(_cadLayer);
        }
    });
    
    if (_cadVisible) _cadLayer.addTo(map);
    
    // Fit view lên bounds CAD nếu là lần đầu load
    if (_cadEntities.length > 0) {
        // Compute bounds từ mọi entity
        // map.fitBounds(bounds.pad(0.05));
    }
    
    // UI update
    document.getElementById('btnCadToggle').disabled = false;
    document.getElementById('cadInfoBox').style.display = 'block';
    document.getElementById('cadFilename').textContent = _cadMeta.filename;
    document.getElementById('cadEntityCount').textContent = `${_cadMeta.entityCount} đối tượng`;
}
```

## 8. DXF color index → hex

DXF dùng bảng màu 256 index. Bảng gần đúng cho ~16 màu đầu (1=red, 2=yellow, 3=green, 4=cyan, 5=blue, 6=magenta, 7=white/black, ...):
```js
const _DXF_COLORS = ['#000000','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#000000','#808080','#c0c0c0'];
function _dxfColorToHex(idx) { return _DXF_COLORS[idx] || '#333'; }
```

## 9. Load từ cache khi switchDistrict

Trong `switchDistrict()`, sau khi load CSV:
```js
const cached = await idbGet('cad-drawings', sheetName);
if (cached) {
    _cadEntities = cached.entities;
    _cadMeta = cached.meta;
    _renderCadLayer();
} else {
    _cadLayer = null;
    _cadEntities = [];
    _cadMeta = null;
    document.getElementById('cadInfoBox').style.display = 'none';
    document.getElementById('btnCadToggle').disabled = true;
}
```

## 10. Toggle + Remove

```js
function _toggleCad() {
    if (!_cadLayer) return;
    _cadVisible = !_cadVisible;
    if (_cadVisible) _cadLayer.addTo(map); else map.removeLayer(_cadLayer);
}
async function _removeCad() {
    if (!confirm('Gỡ bản vẽ CAD khỏi bản đồ?')) return;
    if (_cadLayer) map.removeLayer(_cadLayer);
    await idbDel('cad-drawings', currentSheet);
    _cadLayer = null; _cadEntities = []; _cadMeta = null;
    document.getElementById('cadInfoBox').style.display = 'none';
    document.getElementById('btnCadToggle').disabled = true;
}
```

## Testing checklist

- [ ] Upload 1 file DXF nhỏ (< 1MB) từ CAD lighting → hiển thị đúng vị trí trên Google Maps overlay
- [ ] Verify convertVn2000ToLatLon: pick 1 pole trong sheet → convert VN-2000 back → sai số < 0.5m
- [ ] Zoom in / out → SVG scale mượt, không blur
- [ ] Toggle ẩn/hiện → layer add/remove khỏi map
- [ ] Refresh app → bản vẽ tự load từ cache IndexedDB
- [ ] Switch district → bản vẽ đúng tương ứng với sheet
- [ ] File 5MB (~5k entity): parse < 3s, render < 1s
- [ ] File > 10MB: dùng Web Worker cho parse (nếu block UI > 2s)

## Deliverable

User có thể:
1. Tải file DXF từ máy tính
2. Chọn kinh tuyến trung tâm
3. Xem bản vẽ overlay đúng vị trí trên bản đồ
4. Ẩn/hiện overlay
5. Bản vẽ persist qua session (IndexedDB)
```

---

### P18 — Phase 2: Layer control (1-2 ngày) ✅ DONE 2026-07-12

```
Task: Cho phép user toggle bật/tắt từng layer trong bản vẽ CAD, đổi màu/độ dày, filter theo pattern.

## Prerequisites
- P17 (Phase 1) đã xong: _cadEntities có field .layer

## 1. State layers

```js
let _cadLayerVisibility = {};  // { 'LAYER_NAME': true/false }
let _cadLayerStyle = {};       // { 'LAYER_NAME': { color, weight, opacity } }
```

Load state từ localStorage khi restore cache: `cad_layers_<sheetName>`.

## 2. Panel layer control

Modal mới (mở từ nút mới "Lớp CAD" trong info box):
```
┌─ Lớp CAD (VD: 12 lớp) ─────────┐
│ 🔍 [Tìm layer name______]      │
│ ─────────────────────────────  │
│ ☑ POLE           [🎨 red]  245│
│ ☑ CABLE_UNDER    [🎨 blue]  87│
│ ☐ GRID           [🎨 gray]  50│
│ ☑ TEXT_LABEL     [🎨 —  ]   14│
│ ...                            │
│ [Chọn tất cả] [Bỏ chọn tất cả]│
│ [Áp dụng]                     │
└─────────────────────────────────┘
```

Mỗi row: checkbox + tên layer + swatch màu (click → color picker) + count entity + optional weight slider.

## 3. Render layer với style riêng

Sửa `_renderCadLayer()` để check visibility + apply style:
```js
_cadEntities.forEach(e => {
    if (_cadLayerVisibility[e.layer] === false) return;
    const style = _cadLayerStyle[e.layer] || {};
    const color = style.color || _dxfColorToHex(e.color);
    const weight = style.weight || 1.5;
    const opacity = style.opacity ?? 0.8;
    // ... render với color/weight/opacity mới
});
```

## 4. Filter search

Ô search filter theo pattern (normalized):
```js
function _filterCadLayers(query) {
    const rows = document.querySelectorAll('#cadLayerPanel .layer-row');
    const q = normalizeTextSearchable(query);
    rows.forEach(r => {
        const name = normalizeTextSearchable(r.dataset.layer);
        r.style.display = name.includes(q) ? '' : 'none';
    });
}
```

## 5. Preset filter

Nút quick preset: "Chỉ hiện Trụ", "Chỉ hiện Cáp", "Ẩn TEXT" — match layer name pattern định sẵn (regex):
```js
const CAD_PRESETS = {
    poles:   { showRegex: /POLE|TRU|LAMP/i, hideRegex: /GRID|BORDER/i },
    cables:  { showRegex: /CABLE|CAP|WIRE/i },
    hideText:{ hideRegex: /TEXT|LABEL|DIM/i },
};
```

## 6. Persist selection

Sau mỗi thay đổi: `localStorage.setItem('cad_layers_' + currentSheet, JSON.stringify({visibility, style}))`.
Restore trong `_renderCadLayer` init.

## Testing checklist

- [ ] Panel layer hiện đầy đủ list từ `_cadMeta.layers`, số entity đúng
- [ ] Uncheck 1 layer → entities layer đó biến mất, không render
- [ ] Đổi màu 1 layer → tất cả entity thuộc layer đó đổi màu
- [ ] Filter search → hiện đúng subset row
- [ ] Preset "Chỉ Trụ" → chỉ layer match regex hiện
- [ ] Refresh app → visibility state khôi phục đúng
- [ ] Layer count đúng khi có > 20 layer

## Deliverable

User có thể:
1. Xem danh sách tất cả layer trong bản vẽ
2. Ẩn/hiện từng layer
3. Đổi màu + độ dày từng layer
4. Filter theo pattern
5. Áp dụng preset nhanh
6. State persist qua session
```

---

### P19 — Phase 3: Calibration + Snap to CAD vertex (2-3 ngày) ✅ DONE 2026-07-12

```
Task: Cho phép calibrate bản vẽ CAD chưa có tọa độ đúng (align 2 điểm map vs CAD), và snap marker mới về đỉnh CAD gần nhất.

## Prerequisites
- P17 (Phase 1) đã xong
- Đã có helper `haversineM(lat1,lon1,lat2,lon2)` trong index.html

## 1. Calibration mode

**Vấn đề**: file CAD từ khảo sát cũ có thể ở tọa độ local (0,0 nội bộ) hoặc lệch zone. Cần map 2 điểm CAD ↔ 2 điểm real-world để tính affine transform.

**UI flow**:
1. Nút "🎯 Calibrate" trong info box (chỉ hiện khi loaded)
2. Modal hướng dẫn: "Click 2 điểm trên bản đồ + nhập tọa độ CAD tương ứng"
3. User click point A trên map → nhập X_cad, Y_cad point A
4. User click point B trên map → nhập X_cad, Y_cad point B
5. App tính affine (scale + rotate + translate) → apply lên toàn bộ entities

**Tính affine 2D từ 2 điểm** (tương tự Helmert transformation):
```js
function _computeAffine2D(cad1, cad2, real1, real2) {
    // cad = {x, y}, real = {lat, lon} → chuyển real về VN-2000
    const r1 = convertLatLonToVn2000(real1.lat, real1.lon);
    const r2 = convertLatLonToVn2000(real2.lat, real2.lon);
    const dCadX = cad2.x - cad1.x, dCadY = cad2.y - cad1.y;
    const dRealX = r2.x - r1.x,    dRealY = r2.y - r1.y;
    const cadLen = Math.hypot(dCadX, dCadY);
    const realLen = Math.hypot(dRealX, dRealY);
    const scale = realLen / cadLen;
    const angleCad = Math.atan2(dCadY, dCadX);
    const angleReal = Math.atan2(dRealY, dRealX);
    const rotate = angleReal - angleCad;
    // Translate: after scale+rotate cad1 → real1
    const cos = Math.cos(rotate), sin = Math.sin(rotate);
    const tx = r1.x - scale * (cos*cad1.x - sin*cad1.y);
    const ty = r1.y - scale * (sin*cad1.x + cos*cad1.y);
    return { scale, rotate, tx, ty };
}

function _applyAffine(cadPoint, affine) {
    const { scale, rotate, tx, ty } = affine;
    const cos = Math.cos(rotate), sin = Math.sin(rotate);
    return {
        x: scale * (cos*cadPoint.x - sin*cadPoint.y) + tx,
        y: scale * (sin*cadPoint.x + cos*cadPoint.y) + ty
    };
}
```

Sau calibration → lưu `_cadMeta.affine = {...}` → mỗi lần convert cần apply affine trước khi chạy convertVn2000ToLatLon.

## 2. Snap to CAD vertex

**Mục đích**: khi user click Thêm marker gần 1 đỉnh CAD (< 5m), marker tự dịch về đỉnh đó → độ chính xác 1cm.

**Preprocess**: build spatial index từ tất cả vertex CAD:
```js
let _cadVertexIndex = [];  // [{lat, lon, layer, entityIdx}]

function _buildVertexIndex() {
    _cadVertexIndex = [];
    _cadEntities.forEach((e, i) => {
        const points = e.points || (e.center ? [e.center] : []) || (e.position ? [e.position] : []);
        points.forEach(p => {
            const { lat, lon } = convertVn2000ToLatLon(p.x, p.y, _cadMeta.zone);
            _cadVertexIndex.push({ lat, lon, layer: e.layer, entityIdx: i });
        });
    });
}
```

Gọi sau `_renderCadLayer()`.

**Snap trong luồng thêm marker**:
```js
function _snapToNearestCadVertex(lat, lon, maxDistM = 5) {
    if (!_cadVertexIndex.length) return null;
    let best = null, bestDist = maxDistM;
    for (const v of _cadVertexIndex) {
        const d = haversineM(lat, lon, v.lat, v.lon);
        if (d < bestDist) { best = v; bestDist = d; }
    }
    return best ? { lat: best.lat, lon: best.lon, distM: bestDist } : null;
}
```

Trong `saveMarkerPopup()` hoặc `showMarkerPopupAt()`:
```js
const snap = _snapToNearestCadVertex(lat, lon);
if (snap) {
    // Toast: "Đã snap về đỉnh CAD (cách 0.3m). [Hoàn tác]"
    lat = snap.lat; lon = snap.lon;
}
```

## 3. UI snap toggle

Trong ☰ panel, thêm checkbox "Snap về đỉnh CAD (5m)":
```html
<label class="ctrl-radio">
    <input type="checkbox" id="cadSnapToggle" onchange="_toggleCadSnap(this.checked)">
    <span>Snap về đỉnh CAD gần nhất (≤ 5m)</span>
</label>
```

State: `_cadSnapEnabled = false` (default off), persist localStorage.
Slider chỉnh khoảng cách max (1-20m).

## 4. Visualization snap

Khi snap active + hover chuột gần đỉnh CAD → highlight đỉnh đó với marker tạm (chấm tím pulse). Optional cho polish.

## Testing checklist

- [ ] Calibration: pick 2 điểm → toàn bộ CAD dịch chuyển đúng, không lệch scale
- [ ] Verify affine: 1 vertex CAD gần trụ đã đo → khoảng cách sau calibrate < 5cm
- [ ] Vertex index build: 5000 entity → < 500ms
- [ ] Snap khi thêm marker: click cách đỉnh 3m → tọa độ marker khớp đỉnh chính xác
- [ ] Snap ngoài phạm vi 5m → không snap, marker giữ tọa độ user click
- [ ] Toggle snap off → thêm marker bình thường
- [ ] Slider maxDist: 20m thấy snap sang đỉnh xa hơn

## Deliverable

User có thể:
1. Calibrate bản vẽ CAD lệch/chưa georef bằng 2 điểm
2. Bật/tắt snap về đỉnh CAD khi thêm marker
3. Chỉnh khoảng cách snap max
4. Thêm marker chính xác 1cm khi đứng gần đỉnh CAD (với RTK)
```

---

### P20 — Phase 4: Stake-out điều hướng RTK (3-5 ngày, tùy chọn) ✅ DONE 2026-07-12

```
Task: Chọn 1 đỉnh CAD làm target → hiển thị mũi tên + khoảng cách + góc bearing từ vị trí RTK hiện tại đến đỉnh đó (realtime), tự trigger create marker khi đứng đúng vị trí.

## Prerequisites
- P17 + P18 + P19 (Phase 1-3) đã xong
- Feature 11 (GPS_MODES + getBestFix) đã có
- User đang dùng RTK Tersus Luka (Phase 4 không đáng làm cho phone GPS)

## 1. State stake-out

```js
let _stakeoutTarget = null;     // {lat, lon, cadEntity} — đỉnh CAD đang target
let _stakeoutWatchId = null;    // watchPosition ID
let _stakeoutMinDistM = 0.05;   // ngưỡng auto-create marker (5cm cho RTK Fixed)
```

## 2. Kích hoạt stake-out

**Luồng chọn target**:
1. User bật mode "Stake-out" từ ☰ panel → toast "Click 1 đỉnh CAD để làm target"
2. Cursor crosshair trên map
3. User click gần đỉnh CAD → snap về đỉnh gần nhất → set `_stakeoutTarget`
4. UI floating bar hiện đè lên bản đồ

```html
<div id="stakeoutBar" style="position:fixed;top:60px;left:50%;transform:translateX(-50%);
    background:rgba(30,41,59,.95);color:#fff;padding:10px 16px;border-radius:12px;
    display:flex;gap:16px;align-items:center;z-index:9500;box-shadow:0 4px 12px rgba(0,0,0,.3);">
    <div id="stakeoutArrow" style="font-size:32px;">↑</div>
    <div>
        <div id="stakeoutDist" style="font-size:20px;font-weight:800;">— m</div>
        <div id="stakeoutBearing" style="font-size:12px;opacity:.7;">Đi hướng ...</div>
    </div>
    <button onclick="_stopStakeout()" style="background:#dc2626;color:#fff;border:none;
        padding:6px 12px;border-radius:6px;cursor:pointer;">✗ Dừng</button>
</div>
```

## 3. Realtime tracking

Dùng `navigator.geolocation.watchPosition` với GPS_MODES config hiện tại:
```js
function _startStakeout(target) {
    _stakeoutTarget = target;
    const cfg = GPS_MODES[currentGpsMode];
    _stakeoutWatchId = navigator.geolocation.watchPosition(
        pos => _updateStakeout(pos, target),
        err => console.error('stakeout err', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: cfg.maxWaitMs }
    );
    document.getElementById('stakeoutBar').style.display = 'flex';
}

function _updateStakeout(pos, target) {
    const dist = haversineM(pos.coords.latitude, pos.coords.longitude, target.lat, target.lon);
    const bearing = _computeBearing(pos.coords.latitude, pos.coords.longitude, target.lat, target.lon);
    
    // UI update
    document.getElementById('stakeoutDist').textContent = 
        dist < 1 ? `${(dist*100).toFixed(1)} cm` : `${dist.toFixed(2)} m`;
    document.getElementById('stakeoutBearing').textContent = _bearingLabel(bearing);
    
    // Xoay mũi tên theo bearing (compass-relative — user hướng lên = 0° device compass)
    // Tạm dùng bearing absolute, sau này cần device orientation:
    document.getElementById('stakeoutArrow').style.transform = `rotate(${bearing}deg)`;
    
    // Ngưỡng đạt → rung + toast + optional auto-create marker
    if (dist <= _stakeoutMinDistM) {
        _onStakeoutReached(target, pos);
    }
}

function _computeBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
    const Δλ = (lon2 - lon1) * Math.PI/180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180/Math.PI) + 360) % 360;
}

function _bearingLabel(deg) {
    const dirs = ['B','ĐB','Đ','ĐN','N','TN','T','TB'];
    return `${dirs[Math.round(deg/45) % 8]} (${Math.round(deg)}°)`;
}
```

## 4. Rung + âm thanh khi đạt

```js
function _onStakeoutReached(target, pos) {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    displayInfo(`Đã đến đích! Sai số ${(haversineM(...) * 100).toFixed(1)} cm`);
    // Beep: mini audio hoặc SpeechSynthesisUtterance
    if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance('Đã đến vị trí');
        u.lang = 'vi-VN';
        speechSynthesis.speak(u);
    }
    // Optional: auto-open thêm marker popup với tọa độ target đã fill sẵn
    // hoặc chờ user manual confirm
}
```

## 5. Danh sách target hàng loạt (batch stake-out)

Cho phép user chọn N đỉnh cùng lúc → xong 1 tự next sang cái tiếp theo:
```js
let _stakeoutQueue = [];  // [{lat, lon, label}]
let _stakeoutCurrentIdx = 0;
```

UI: sau khi đạt target hiện tại → toast "3/12 xong. [Next] [Skip] [Dừng]".

Filter target: từ layer CAD nào (vd chỉ layer POLE) → skip TEXT.

## 6. Device orientation (compass) — optional advanced

Mũi tên hiện xoay theo bearing absolute (Bắc = 0°). Để chỉ đúng hướng đi so với **hướng điện thoại đang nhìn**, cần trừ đi `deviceOrientation.alpha`:

```js
window.addEventListener('deviceorientationabsolute', (e) => {
    _deviceHeading = e.alpha; // 0 = user quay Bắc
}, true);

// Trong _updateStakeout:
const relativeBearing = (bearing - _deviceHeading + 360) % 360;
document.getElementById('stakeoutArrow').style.transform = `rotate(${relativeBearing}deg)`;
```

Chỉ hoạt động khi permission granted (iOS 13+ cần requestPermission).

## 7. Cleanup

```js
function _stopStakeout() {
    if (_stakeoutWatchId !== null) navigator.geolocation.clearWatch(_stakeoutWatchId);
    _stakeoutWatchId = null;
    _stakeoutTarget = null;
    document.getElementById('stakeoutBar').style.display = 'none';
}
```

Auto-cleanup khi user đổi tab, đóng popup, hoặc switchDistrict.

## Testing checklist

- [ ] Chọn target: click gần đỉnh CAD → snap chính xác về đỉnh
- [ ] Realtime dist cập nhật < 1s khi user di chuyển (RTK Fixed cần)
- [ ] Bearing chỉ đúng hướng: đứng phía Nam target 5m, mũi tên chỉ Bắc
- [ ] Ngưỡng 5cm → rung + toast "đã đến"
- [ ] Auto-open form thêm marker với tọa độ đúng
- [ ] Test batch queue 5 target → next tự động
- [ ] Test compass mode (nếu device support)
- [ ] Test dừng giữa chừng → cleanup sạch
- [ ] Phone GPS mode: ngưỡng auto lên 3m (không phải 5cm)

## Deliverable

User có thể:
1. Chọn 1 đỉnh CAD làm target stake-out
2. Xem realtime khoảng cách + hướng đi
3. Rung + âm báo khi đạt đúng vị trí
4. Auto-tạo marker mới tại vị trí target
5. Batch stake-out nhiều target liên tiếp
6. Compass mode chỉ hướng theo device orientation

**Lưu ý**: Phase 4 chỉ đáng làm nếu user thực sự dùng RTK trong field. Với phone GPS 3m accuracy, stake-out không có ý nghĩa thực tế (không phân biệt được đỉnh CAD kế nhau).
```

---

### Ước tính công sức tổng thể

| Phase | Deliverable | Effort | Blocker |
|---|---|---|---|
| P17 | Overlay DXF cơ bản | 3-5 ngày | — |
| P18 | Layer control | 1-2 ngày | Cần P17 xong |
| P19 | Calibration + Snap | 2-3 ngày | Cần P17 xong (P18 optional) |
| P20 | Stake-out RTK | 3-5 ngày | Cần P17-P19 xong |
| **Total** | Full CAD workflow | **10-15 ngày** | Không |

**Alternative đơn giản hơn**: nếu chỉ cần hiển thị bản vẽ (không snap, không stake-out), pre-convert DXF → GeoJSON offline bằng QGIS → dùng `L.geoJson()` — **1 ngày code**. Đánh đổi: user không tự upload được, phải qua QGIS.

Chọn phù hợp workflow thực tế: P17 alone nếu chỉ để tham khảo trực quan, đủ P17+P19 nếu cần chính xác cao, làm hết P17-P20 nếu dùng RTK để stake-out thực sự.
```

---

# Session Tính năng 13-18 — Roadmap 2026

Bộ 22 prompt (P21-P42) implement 6 nhóm tính năng còn thiếu. Xem `CLAUDE.md` § "Roadmap 2026" cho design docs.

---

## Nhóm 13 — Quản lý vận hành

### P21 — Ticketing sự cố ✅ DONE 2026-07-12 (core từ trước + polish admin panel)

```
Task: Thêm chức năng báo cáo & xử lý sự cố trên trụ đèn / tủ điện.

## Data model

Tạo sheet mới `SuCo` với 12 cột (xem CLAUDE.md § 13.1 for schema chi tiết).
GAS `getSheet('SuCo')` — nếu chưa có thì tạo mới với header.

## UI Client

### 1. Nút báo sự cố trong popup marker

Trong `createMarkerPopupContent(row)`, thêm nút:
```html
<button onclick="_openSuCoForm('${row[0]}', '${row[1]}')" class="pc-btn pc-btn-danger">
    🚨 Báo sự cố
</button>
```

### 2. Modal báo sự cố `#suCoForm`

Fields:
- Loại sự cố (radio): 💡 Chảy bóng / 🌑 Tối đèn / ⚡ Nghiêng trụ / 💥 Gãy trụ / 🔌 Mất cáp / ❓ Khác
- Mức độ (segmented): 🔴 Khẩn / 🟠 Cao / 🟡 Trung / 🟢 Thấp
- Mô tả (textarea)
- Chụp ảnh (3 slot, reuse `handleMarkerImageFile`)
- Nút "Gửi" / "Hủy"

### 3. Sync GAS

```js
async function _submitSuCo(data) {
    const payload = {
        action: 'create_su_co',
        sheet: currentSheet,
        markerId: data.markerId,
        loai: data.loai,
        mucDo: data.mucDo,
        moTa: data.moTa,
        anh: data.anhUrls.join(';'),
        nguoiBao: currentUser.username,
        thoiGianTao: new Date().toISOString()
    };
    return fetch(KHAOSAT_GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
}
```

### 4. GAS handler

```js
function handleCreateSuCo(data) {
    const sheet = getSuCoSheet();  // auto-create with header nếu chưa có
    const id = 'SC_' + new Date().getFullYear() + '_' + String(sheet.getLastRow()).padStart(3, '0');
    sheet.appendRow([id, data.markerId, data.loai, data.mucDo, data.moTa, data.anh,
                     data.nguoiBao, '', 'moi', data.thoiGianTao, '', '']);
    return { ok: true, id };
}
```

### 5. Hiển thị sự cố trên marker

Trong `addMarkerRowToMap`, check nếu marker có sự cố `moi`/`dang_xu_ly` → thêm CSS class `has-issue` cho icon (glow đỏ).

Load danh sách sự cố khi load app (from CSV publish của sheet SuCo). Store trong `_suCoByMarkerId` map.

### 6. Trang admin quản lý

Section mới trong ☰ panel "Sự cố" (chỉ admin) → mở overlay list:
- Filter theo status/loại/địa bàn
- Click row → mở chi tiết + assign nhân sự + chuyển status
- Nút "Đóng sự cố" khi hoàn thành

### 7. Badge topbar

Query GAS count `su_co` với status = 'moi' → hiện badge số trên nút ☰ nếu có mới.

## Testing checklist

- [ ] Sheet SuCo tự động tạo lần đầu gọi
- [ ] Báo sự cố từ popup → GAS tạo row đúng ID format `SC_2026_001`
- [ ] Marker glow đỏ nếu có sự cố chưa xử lý
- [ ] Admin thấy list + có thể assign + chuyển status
- [ ] Badge count update sau reload
- [ ] User thường không thấy option "Đóng sự cố" (chỉ admin)

## Deliverable

User có thể báo sự cố với 1 click, admin có dashboard xử lý tập trung.
```

---

### P22 — Lịch bảo trì định kỳ ✅ DONE 2026-07-12 (client-side, cần GAS + BAOTRI_CSV_URL)

```
Task: Thêm chức năng lên lịch bảo trì và nhắc nhở tự động.

## Data model

Sheet `BaoTri` (xem CLAUDE.md § 13.2).

## UI

### 1. Tạo lịch bảo trì (admin)

Popup marker → tab "Bảo trì" (chỉ admin thấy) → form:
- Loại bảo trì (dropdown)
- Chu kỳ (số tháng)
- Lần cuối thực hiện (date)
- Nhân sự phụ trách (dropdown users)

### 2. Auto tính "Lần tới"

Client-side: `lanToi = lanCuoi + chuKy tháng`.
Save vào GAS via `create_bao_tri` action.

### 3. GAS cron trigger

```js
// Chạy 06:00 mỗi ngày
function checkMaintenanceSchedule() {
    const sheet = getSheet('BaoTri');
    const rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 10).getValues();
    const today = new Date();
    const alerts = [];
    rows.forEach((r, i) => {
        const lanToi = new Date(r[5]);
        const daysToGo = (lanToi - today) / 86400000;
        if (daysToGo < 0 && r[7] !== 'xong') {
            // Trễ
            sheet.getRange(i+2, 8).setValue('trễ');
            alerts.push({ id: r[0], marker: r[1], phuTrach: r[6], daysLate: Math.abs(daysToGo) });
        } else if (daysToGo < 7 && r[7] === 'chờ') {
            alerts.push({ id: r[0], marker: r[1], phuTrach: r[6], daysToGo });
        }
    });
    if (alerts.length) sendMaintenanceEmail(alerts);
}
```

Setup trigger: `Extensions → Apps Script → Triggers → Add → checkMaintenanceSchedule → time-driven → day → 6am`.

### 4. Hiển thị lịch bảo trì

Trang `/admin/bao-tri` list + calendar view (dùng FullCalendar.js hoặc simple table).

Marker có lịch bảo trì sắp đến → icon overlay 🔧 nhỏ.

### 5. Mark done

Sau khi bảo trì, admin click "Hoàn thành" → update `Lần cuối = today`, `Lần tới = today + chuKy tháng`, `Status = xong` → sau đó reset về `chờ` cho chu kỳ mới.

## Testing checklist

- [ ] Tạo lịch → Lần tới tính đúng
- [ ] GAS trigger chạy 6am hàng ngày (kiểm tra Executions log)
- [ ] Marker trễ hạn có status `trễ` sau 1 ngày trôi qua
- [ ] Email alert gửi đúng danh sách nhân sự phụ trách
- [ ] Icon 🔧 hiện trên marker có lịch < 7 ngày

## Deliverable

Admin không cần nhớ lịch bảo trì thủ công. Trễ hạn tự alert.
```

---

### P23 — Assign task + Workflow duyệt ✅ DONE 2026-07-12 (client-side, cần GAS + NHIEMVU_CSV_URL)

```
Task: Admin gán nhiệm vụ cho user, user submit → admin approve.

## Data model

Sheet `NhiemVu` 9 cột: ID, người giao, người nhận, mô tả, khu vực, deadline, status, kết quả, thời gian đóng.

Status: draft → assigned → in_progress → submitted → approved / rejected → closed.

## UI

### 1. Admin trang "Nhiệm vụ"

Trong ☰ panel (admin only) → nút "Quản lý nhiệm vụ" → overlay:
- Danh sách nhiệm vụ + filter theo status/người nhận
- Nút "+ Tạo nhiệm vụ" → modal form: mô tả, khu vực (polygon từ tính năng 16.3 hoặc list địa bàn), deadline, người nhận
- Click row → chi tiết + timeline change status

### 2. User section "Nhiệm vụ của tôi"

Trong ☰ panel → section mới hiện chỉ khi user có nhiệm vụ:
- List 3 nhiệm vụ active
- Nút "Xem tất cả" → overlay
- Nút "Bắt đầu" (assigned → in_progress)
- Nút "Nộp báo cáo" (in_progress → submitted) với textarea kết quả + ảnh

### 3. GAS actions

- `create_nhiem_vu`
- `update_nhiem_vu_status` (validate transitions)
- `approve_nhiem_vu` / `reject_nhiem_vu` (chỉ admin)

### 4. Notification

Khi assign → notify user (dùng 13.4).
Khi user submit → notify admin.

## Testing checklist

- [ ] Admin tạo nhiệm vụ, user thấy trong section của mình
- [ ] User bắt đầu → status thay đổi
- [ ] User submit kết quả → admin approve/reject
- [ ] Rejected nhiệm vụ quay về `in_progress` cho user làm lại
- [ ] Log history transitions

## Deliverable

Workflow phân công công việc rõ ràng, tracking được.
```

---

### P24 — Notification Push ✅ DONE 2026-07-12 (polling + in-app; browser push future)

```
Task: Notify user khi có sự cố / task / bảo trì mới.

## 3 kênh

### 1. Browser Push (Chrome/Edge/Safari 16+)

```js
async function _subscribePush() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY
    });
    await fetch(GAS_URL, { method:'POST', body: JSON.stringify({
        action: 'register_push', endpoint: JSON.stringify(sub), user: currentUser.username
    })});
}
```

VAPID keys: sinh 1 lần bằng `web-push` npm (`npx web-push generate-vapid-keys`), lưu vào GAS Script Properties.

GAS gửi push qua `UrlFetchApp.fetch(sub.endpoint, ...)` với payload + VAPID auth.

### 2. Polling fallback

Chrome iOS chưa support push → poll `GAS getNotifications(user)` mỗi 60s khi tab visible.

Nếu có notification mới → hiện toast + đánh chuông (Audio API play file `.mp3` ngắn 500ms).

### 3. Zalo OA (integrated ở P29)

Nếu user đã link Zalo với account → gửi qua Zalo message.

## Testing checklist

- [ ] Grant permission → subscribe → GAS lưu endpoint
- [ ] Admin trigger notification → push đến user trong 5s
- [ ] Fallback polling: notification xuất hiện trong 60s
- [ ] Notification click → mở đúng trang (sự cố / task / bảo trì)
- [ ] Test trên Android Chrome + iOS Safari

## Deliverable

User không cần refresh liên tục để check task.
```

---

## Nhóm 14 — Analytics & Báo cáo

### P25 — Dashboard KPI ✅ DONE 2026-07-12

```
Task: Trang dashboard với 5 KPI + biểu đồ.

## UI

Trang `/admin/dashboard` (mới), chỉ admin. Nút "Dashboard" trong ☰ panel.

### Layout

```
┌─────────────────────────────────────┐
│  📊 DASHBOARD LAVIPCO — 2026-Q1     │
│                                      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ 1234│ │ 12  │ │ 45  │ │ 78% │   │  ← 4 tile số
│  │ Trụ │ │Tủ  │ │ SC  │ │ Done│   │
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                      │
│  ┌───────────────────────────────┐ │
│  │ Bar chart: Trụ theo địa bàn   │ │  ← Chart 1
│  └───────────────────────────────┘ │
│                                      │
│  ┌─────────────┐ ┌─────────────┐   │
│  │Donut % done │ │Bar SC 30days│   │  ← Chart 2+3
│  └─────────────┘ └─────────────┘   │
│                                      │
│  ┌───────────────────────────────┐ │
│  │Bar: Hiệu suất user (top 10)   │ │  ← Chart 4
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Data

Aggregate client-side từ `loadedData` (all districts) + fetch `SuCo`, `BaoTri`, `NhiemVu`.

## Chart.js setup

Lazy load Chart.js UMD từ CDN (~150KB):
```js
async function _loadChartJs() {
    if (window.Chart) return;
    await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
    });
}
```

## Testing checklist

- [ ] 4 tile số update realtime từ data hiện tại
- [ ] Bar chart địa bàn correct count
- [ ] Donut % done = (số trụ có ảnh) / total
- [ ] SC 30 ngày lấy đúng từ sheet SuCo
- [ ] Top 10 user tính từ `Người KS` column
- [ ] Charts responsive trên mobile

## Deliverable

Admin thấy tổng quan trong 5 giây, không cần phân tích thủ công.
```

---

### P26 — Báo cáo theo mẫu Nhà nước (TT06/2016) ✅ DONE 2026-07-12

```
Task: Xuất báo cáo Excel đúng mẫu TT06/2016 của Bộ Xây dựng.

## 3 mẫu

### Mẫu 1: Báo cáo tháng (BC-CHIEUSANG-M-2026-01.xlsx)

Header: logo huyện + tên phòng + tháng + năm.
5 sheet:
1. Tổng hợp — số trụ theo loại
2. Sự cố — list SC trong tháng
3. Bảo trì — list BT thực hiện
4. Nhân sự — hiệu suất
5. Ký duyệt — chỗ ký lãnh đạo

### Mẫu 2: Báo cáo TT06/2016 (BC-TT06-2026-Q1.xlsx)

Theo phụ lục Thông tư 06/2016/TT-BXD:
- Danh sách hệ thống chiếu sáng đô thị theo cấp đường
- Chỉ tiêu kỹ thuật (độ rọi, độ đồng đều)
- Tình trạng vận hành

### Mẫu 3: Danh mục thiết bị (DM-TCVN7722.xlsx)

Theo TCVN 7722-1:2007 và TT39/2009/TT-BXD:
- Danh sách trụ, loại, công suất, năm lắp đặt
- Chứng nhận xuất xưởng
- Bảo hành + bảo trì

## Code

```js
async function exportBaoCaoTT06(from, to) {
    const template = await fetch('templates/bc_tt06.xlsx').then(r => r.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(template);
    
    // Fill cells
    const ws = wb.getWorksheet(1);
    ws.getCell('B3').value = getSetting('company_name');
    ws.getCell('B4').value = `Từ ${from} đến ${to}`;
    // ... fill data rows
    
    const buf = await wb.xlsx.writeBuffer();
    // Save file
}
```

Templates lưu trong repo `/templates/*.xlsx` — thiết kế 1 lần trong Excel với style, header, footer.

## UI

Section mới "Báo cáo chính thức" trong ☰ panel admin:
- Dropdown chọn mẫu
- Chọn khoảng thời gian
- Nút "Tạo báo cáo" → download file

## Testing checklist

- [ ] Templates load được (fetch OK)
- [ ] Fill data đúng cells
- [ ] Excel mở trong Word/Excel không lỗi format
- [ ] Header/footer preserved
- [ ] Ký duyệt sheet có sẵn chỗ trống ký

## Deliverable

Admin xuất báo cáo hành chính chỉ với vài click, đúng mẫu Nhà nước.
```

---

### P27 — Email report định kỳ ✅ DONE 2026-07-12

```
Task: GAS tự gửi báo cáo tháng qua email vào ngày 1 tháng sau.

## GAS setup

### 1. Cron trigger

Extensions → Apps Script → Triggers:
- Function: `sendMonthlyReport`
- Type: Time-driven
- Day of month: 1
- Time: 6am

### 2. Function `sendMonthlyReport()`

```js
function sendMonthlyReport() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const from = Utilities.formatDate(lastMonth, 'GMT+7', 'yyyy-MM-dd');
    const to = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), 0), 'GMT+7', 'yyyy-MM-dd');
    
    // Aggregate data
    const data = aggregateMonthlyData(from, to);
    
    // Generate PDF (server-side dùng Google Doc API hoặc HTML → PDF via UrlFetchApp)
    const pdfBlob = generateReportPdf(data);
    
    // Get recipient list from Setting sheet
    const recipients = getSetting('email_recipients').split(',');
    
    GmailApp.sendEmail(
        recipients.join(','),
        `Báo cáo chiếu sáng tháng ${from} - ${to}`,
        `Báo cáo đính kèm.`,
        { attachments: [pdfBlob.setName(`BC-CS-${from}.pdf`)] }
    );
}
```

### 3. Cấu hình recipients

Trong sheet `Setting`:
```
email_recipients | admin@abc.gov.vn,truongphong@xyz.gov.vn
```

## Testing checklist

- [ ] Run manual `sendMonthlyReport()` → email đến đúng list
- [ ] PDF attachment mở được, format đúng
- [ ] Cron trigger fire đúng ngày 1
- [ ] Log Executions không error

## Deliverable

Lãnh đạo tự động nhận báo cáo tháng vào ngày 1, không cần request thủ công.
```

---

### P28 — Chữ ký số PDF

```
Task: Ký PDF bản vẽ bằng chứng thư số (VNPT-CA / BKAV-CA / FPT-CA).

## Cơ chế

Client-side ký PDF là bất khả thi (private key phải trong USB token / cloud CA). Solution:

### Option A: USB Token

User dùng phần mềm VNPT-CA Signer / Foxit → mở PDF exported → ký tay → save.
→ App không can thiệp, chỉ xuất PDF sẵn có ô ký.

### Option B: Cloud CA (khuyến nghị)

Tích hợp API của VNPT eSign / BKAV Cloud Sign:
```js
async function signPdfViaCloud(pdfBlob) {
    const uploadRes = await fetch('https://api.vnpt-esign.com/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CLIENT_SECRET}` },
        body: pdfBlob
    });
    const { fileId } = await uploadRes.json();
    // User authenticate via SMS OTP
    // Return signed PDF URL
    return signedPdfUrl;
}
```

Chi phí: ~2000-5000 VND/lần ký. Cần đăng ký doanh nghiệp với CA.

### Option C: PDF-lib client-side signature (visual only)

Không phải chữ ký số pháp lý, chỉ là hình chữ ký insert. Dùng khi không cần compliance.

## Recommendation

Option A cho MVP (không code gì), Option B cho enterprise (60h implement).

## Testing checklist

- [ ] Option A: PDF export có ô trống ký + tên chức vụ
- [ ] Option B: sign flow end-to-end, verify chữ ký trong Adobe Reader

## Deliverable

Bản vẽ có chữ ký hợp lệ để lưu hồ sơ chính thức.
```

---

## Nhóm 15 — Tích hợp bên ngoài

### P29 — Zalo Official Account integration

```
Task: Cho phép dân báo sự cố qua Zalo OA → auto-tạo ticket.

## Setup Zalo OA

1. Đăng ký OA tại https://oa.zalo.me
2. Xác thực doanh nghiệp
3. Lấy `oa_id` + `access_token`

## Webhook Zalo → GAS

Config webhook URL trong Zalo Developer: `<GAS_WEB_APP_URL>?action=zalo_webhook`

GAS `doPost` handler:
```js
function handleZaloWebhook(payload) {
    if (payload.event_name === 'user_send_text') {
        // User gửi tin nhắn — trigger menu button "Báo sự cố"
    }
    if (payload.event_name === 'user_submit_form') {
        // Form data: description, image, location
        const suCoRow = createSuCoFromZalo(payload);
        replyZaloUser(payload.user_id, `Đã ghi nhận sự cố ${suCoRow.id}. Cảm ơn bạn!`);
    }
    return { ok: true };
}
```

## Zalo template menu

Tạo template trong OA Console:
- Button "🚨 Báo sự cố" → mở form nhập
- Form có: mô tả, ảnh upload, geolocation

## Reply mechanism

```js
function replyZaloUser(userId, text) {
    UrlFetchApp.fetch('https://openapi.zalo.me/v2.0/oa/message', {
        method: 'POST',
        headers: { 'access_token': ZALO_TOKEN },
        payload: JSON.stringify({
            recipient: { user_id: userId },
            message: { text }
        })
    });
}
```

## Testing checklist

- [ ] Webhook nhận event khi user gửi tin
- [ ] Form submit tạo row trong SuCo với `nguoiBao = 'zalo_' + user_id`
- [ ] Reply message về user
- [ ] Admin nhận notification sự cố mới có source = Zalo

## Deliverable

Dân chỉ cần Zalo, không cần cài app. Sự cố tự động vào hệ thống.
```

---

### P30 — REST API cho hệ thống ngoài ✅ DONE 2026-07-12

```
Task: Expose REST API cho SCADA / ERP đọc/ghi data.

## GAS endpoints

Extend `doGet` + `doPost`:

```
GET  ?action=api_list_markers&district=Quan1&api_key=xxx
GET  ?action=api_get_marker&id=Q1_001&api_key=xxx
POST ?action=api_create_marker + payload
GET  ?action=api_list_su_co&status=moi
POST ?action=api_reports_monthly
```

## Auth

Sheet `ApiKeys`: 4 cột (key, tên client, permissions, active).

Middleware:
```js
function checkApiKey(key) {
    const sheet = getSheet('ApiKeys');
    const rows = sheet.getDataRange().getValues();
    const row = rows.find(r => r[0] === key && r[3] === 'active');
    if (!row) throw new Error('Invalid API key');
    return { client: row[1], permissions: row[2].split(',') };
}
```

## Rate limit

Simple: sheet log requests, count last 60s per key. Deny if > 60 req/min.

## Docs

Tạo file `api-docs.html` — swagger-like doc với examples curl.

## Testing checklist

- [ ] curl GET list_markers → JSON valid
- [ ] Invalid API key → 401
- [ ] Rate limit exceed → 429
- [ ] POST create_marker → row appear trong sheet
- [ ] Postman collection test all endpoints

## Deliverable

Bên thứ 3 có thể query/write data programmatically.
```

---

## Nhóm 16 — Field Survey nâng cao

### P31 — Voice note trên marker ✅ DONE 2026-07-12

```
Task: Ghi âm ghi chú, đính vào marker.

## Data model

Thêm cột 26: `Ghi âm` — URL Google Drive.

## UI popup marker

Button 🎙 "Ghi âm" → hiển thị recorder:
- Nút to `● Rec` (max 60s)
- Đếm timer
- Nút `⏹ Dừng` → auto upload

## Code

```js
let _mediaRecorder = null, _audioChunks = [];

async function _startVoiceRecord() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    _audioChunks = [];
    _mediaRecorder.ondataavailable = e => _audioChunks.push(e.data);
    _mediaRecorder.onstop = async () => {
        const blob = new Blob(_audioChunks, { type: 'audio/webm' });
        const dataUrl = await blobToDataUrl(blob);
        const url = await uploadAudioToDrive(dataUrl);
        // Save to row[25]
    };
    _mediaRecorder.start();
    setTimeout(() => _mediaRecorder.state === 'recording' && _mediaRecorder.stop(), 60000);
}
```

GAS `handleAudioUpload` tương tự `handleImageUpload` nhưng ext `.webm`.

## Playback

Popup marker có audio nếu `row[25]`:
```html
<audio controls src="${row[25]}" style="width:100%;height:32px;"></audio>
```

## Testing checklist

- [ ] Grant mic permission → record 3s → playback ok
- [ ] Upload lên Drive, URL public accessible
- [ ] Playback trên mobile Safari/Chrome
- [ ] Max 60s auto stop
- [ ] Size < 500KB cho 60s (webm codec)

## Deliverable

Khảo sát viên ghi note nhanh không cần gõ.
```

---

### P32 — QR/Barcode scan ✅ DONE 2026-07-12

```
Task: Scan tag QR/barcode trên trụ để nhập nhanh ID.

## Thư viện

`html5-qrcode` (30KB, lazy load):
```js
async function _loadQrLib() {
    if (window.Html5Qrcode) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
    await new Promise((r, e) => { s.onload = r; s.onerror = e; document.head.appendChild(s); });
}
```

## UI

Trong marker form, nút "📷 Scan QR" cạnh field "Tên trụ":
```js
async function _startQrScan(inputEl) {
    await _loadQrLib();
    document.getElementById('qrScannerContainer').style.display = 'block';
    const scanner = new Html5Qrcode('qrScanner');
    await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            inputEl.value = decodedText;
            scanner.stop();
            document.getElementById('qrScannerContainer').style.display = 'none';
        },
        (err) => {} // ignore no-scan
    );
}
```

## Testing checklist

- [ ] Grant camera permission
- [ ] Scan QR code từ ảnh in → decode đúng
- [ ] Scan barcode Code128 → decode đúng
- [ ] Auto-stop sau khi scan thành công
- [ ] Test trên iOS Safari + Android Chrome

## Deliverable

Nhập tên trụ nhanh gấp 3-5 lần, không nhầm.
```

---

### P33 — Vẽ vùng polygon ✅ DONE 2026-07-12

```
Task: Vẽ polygon "khu vực đã khảo sát" hoặc "cụm dân cư".

## Thư viện

Leaflet.Draw (chuẩn):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.css">
<script src="https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
```

## Data model

Sheet `Vung` — 6 cột: ID, tên, loại (`da_khao_sat`/`cum_dan_cu`/`khac`), GeoJSON polygon, người tạo, thời gian.

## UI

Section trong ☰ panel "Vẽ vùng":
- Nút "+ Vẽ vùng mới" → activate Leaflet.Draw polygon tool
- User click các điểm → hoàn thành → prompt name + type
- Save vào sheet
- Danh sách vùng đã vẽ → toggle visible

## Code

```js
const drawnItems = new L.FeatureGroup().addTo(map);
const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: { polygon: true, marker: false, circle: false, rectangle: false, polyline: false }
});

map.on(L.Draw.Event.CREATED, async (e) => {
    const layer = e.layer;
    drawnItems.addLayer(layer);
    const geojson = layer.toGeoJSON();
    const name = prompt('Tên vùng:');
    if (name) await saveVungToGas({ name, geojson });
});
```

## Testing checklist

- [ ] Vẽ polygon 4-5 điểm → complete
- [ ] Save GeoJSON vào sheet Vung
- [ ] Reload → polygon restore đúng vị trí
- [ ] Toggle visible → add/remove khỏi map
- [ ] Sửa polygon (edit mode) → update GAS

## Deliverable

Admin có thể đánh dấu vùng địa lý rõ ràng.
```

---

### P34 — Đo khoảng cách trên bản đồ ✅ DONE 2026-07-12

```
Task: Click 2 điểm → hiện khoảng cách + đường thẳng.

## UI

Nút "📏 Đo" trong ☰ panel → activate mode:
- Cursor crosshair
- Click 1 → điểm A với marker tạm
- Click 2 → điểm B, vẽ polyline, hiện distance tooltip
- Click tiếp → reset cặp mới
- Click nút "Đo" lần nữa hoặc ESC → tắt mode

## Code

```js
let _measureMode = false, _measurePoints = [], _measureLine = null, _measureLabel = null;

function _toggleMeasureMode() {
    _measureMode = !_measureMode;
    document.getElementById('btnMeasure').classList.toggle('active', _measureMode);
    map.getContainer().style.cursor = _measureMode ? 'crosshair' : '';
    if (!_measureMode) _clearMeasure();
}

map.on('click', (e) => {
    if (!_measureMode) return;
    _measurePoints.push(e.latlng);
    if (_measurePoints.length === 2) {
        const [a, b] = _measurePoints;
        const dist = haversineM(a.lat, a.lng, b.lat, b.lng);
        if (_measureLine) map.removeLayer(_measureLine);
        _measureLine = L.polyline([a, b], { color:'#dc2626', weight: 3 }).addTo(map);
        const midLat = (a.lat + b.lat) / 2, midLon = (a.lng + b.lng) / 2;
        _measureLabel = L.marker([midLat, midLon], {
            icon: L.divIcon({
                className: 'measure-label',
                html: `<div style="background:#fff;border:1px solid #dc2626;padding:2px 6px;border-radius:4px;font-weight:700;color:#dc2626;">${dist < 1000 ? dist.toFixed(1)+'m' : (dist/1000).toFixed(2)+'km'}</div>`
            })
        }).addTo(map);
        _measurePoints = [];
    }
});
```

## Testing checklist

- [ ] Click 2 điểm → hiện line + label distance
- [ ] Distance < 1000m dùng đơn vị mét
- [ ] Distance >= 1000m dùng km với 2 chữ số
- [ ] ESC hoặc click nút tắt mode
- [ ] Reset khi click cặp mới

## Deliverable

Đo khoảng cách nhanh không cần công cụ ngoài.
```

---

## Nhóm 17 — DevOps & Quality

### P35 — Smoke tests với Playwright ✅ DONE 2026-07-12

```
Task: Setup Playwright + 5 test critical flow + CI GitHub Actions.

## Setup

```bash
npm init -y
npm i -D @playwright/test
npx playwright install chromium
```

`playwright.config.ts`:
```ts
export default {
    testDir: './tests',
    use: {
        baseURL: 'http://localhost:5500',
        headless: true,
        screenshot: 'only-on-failure'
    },
    webServer: {
        command: 'npx live-server --port=5500',
        port: 5500
    }
};
```

## Test files

### `tests/auth.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('admin login', async ({ page }) => {
    await page.goto('/');
    await page.fill('#lUsername', 'admin');
    await page.fill('#lPassword', 'ADMIN_PASSWORD');
    await page.click('#loginBtn');
    await expect(page.locator('#topbarUserName')).toContainText('Admin');
});

test('user login + role restrictions', async ({ page }) => {
    // Login user
    // Check no admin buttons visible
});
```

### `tests/marker.spec.ts`

Add marker + edit + delete flow.

### `tests/print.spec.ts`

Export PDF drawing.

### `tests/district.spec.ts`

Switch district + verify markers reload.

### `tests/cad.spec.ts`

Load DXF overlay + toggle.

## GitHub Actions

`.github/workflows/test.yml`:
```yaml
on: [push, pull_request]
jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
            - run: npm ci
            - run: npx playwright install --with-deps chromium
            - run: npx playwright test
            - uses: actions/upload-artifact@v4
                if: failure()
                with:
                    name: playwright-report
                    path: playwright-report/
```

## Testing checklist

- [ ] `npm test` local pass
- [ ] Push PR → GitHub Actions run tự động
- [ ] Fail case → screenshot uploaded làm artifact
- [ ] Timeout hợp lý (không quá 5 phút)

## Deliverable

Regression bug giảm 70%, tự tin refactor.
```

---

### P36 — Sentry monitoring

```
Task: Track lỗi production real-time.

## Setup

Sign up sentry.io free tier (5k errors/tháng).

Add snippet vào `<head>` của index.html:
```html
<script src="https://browser.sentry-cdn.com/7.100.0/bundle.min.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
<script>
Sentry.init({
    dsn: 'https://YOUR_DSN@sentry.io/xxx',
    tracesSampleRate: 0.1,
    environment: location.hostname === 'neo-era.github.io' ? 'production' : 'dev',
    ignoreErrors: [
        'ResizeObserver loop',
        'Non-Error promise rejection captured',
        /extension\/\//
    ]
});
</script>
```

## Instrument key operations

```js
try {
    await syncRowToGAS(row);
} catch (err) {
    Sentry.captureException(err, {
        extra: { row: row.slice(0, 5), currentSheet }
    });
    throw err;
}
```

## Filter noise

- Adblock errors
- Extension conflicts
- Network offline (expected)

## Testing checklist

- [ ] Trigger error test → Sentry dashboard shows
- [ ] Stack trace symbolicated (source maps)
- [ ] Environment tag đúng
- [ ] Free tier không vượt quota

## Deliverable

Bug production được phát hiện trong phút chứ không phải tuần.
```

---

### P37 — Progressive module extraction ✅ DONE 2026-07-12 (partial: lib/vn2000, utils, dxf)

```
Task: Chia index.html 7000 dòng thành modules.

## Thứ tự extract (theo priority)

### Wave 1: Pure utility (không phụ thuộc DOM)

Files: `lib/vn2000.js`, `lib/utils.js`, `lib/dxf.js`

```js
// lib/vn2000.js
export function convertLatLonToVn2000(lat, lon) { ... }
export function convertVn2000ToLatLon(x, y, mer, k0) { ... }
```

Trong index.html:
```html
<script type="module">
import { convertLatLonToVn2000 } from './lib/vn2000.js';
window.convertLatLonToVn2000 = convertLatLonToVn2000; // expose global tạm cho code cũ
</script>
```

### Wave 2: Feature modules (có state)

Files: `modules/print.js`, `modules/cable.js`, `modules/cad.js`, `modules/excel.js`

Mỗi module export `init(mapInstance)` function + hooks.

### Wave 3: UI components

Files: `components/markerPopup.js`, `components/searchBar.js`

## Không dùng build tool ban đầu

ES modules native đủ. Nếu sau muốn optimize → chuyển sang Vite (2 giờ setup).

## Testing checklist

- [ ] Sau extract từng module, chức năng giữ nguyên
- [ ] Console không error import
- [ ] `sw.js` cache tất cả modules
- [ ] Load time không tăng > 20%

## Deliverable

Codebase dễ maintain, mỗi module < 500 dòng.
```

---

### P38 — Unit tests với Vitest ✅ DONE 2026-07-12

```
Task: Test coverage 80% pure functions.

## Setup

```bash
npm i -D vitest
```

`vitest.config.js`:
```js
export default {
    test: {
        environment: 'jsdom',
        coverage: { provider: 'v8', reporter: ['text', 'html'] }
    }
};
```

## Test cases

### `tests/unit/vn2000.test.js`

```js
import { describe, it, expect } from 'vitest';
import { convertLatLonToVn2000, convertVn2000ToLatLon } from '../lib/vn2000.js';

describe('VN-2000 conversion', () => {
    it('forward + reverse roundtrip', () => {
        const original = { lat: 10.601, lon: 106.664 };
        const { x, y } = convertLatLonToVn2000(original.lat, original.lon);
        const back = convertVn2000ToLatLon(x, y, 105, 0.9996);
        expect(back.lat).toBeCloseTo(original.lat, 5);
        expect(back.lon).toBeCloseTo(original.lon, 5);
    });
});
```

### `tests/unit/utils.test.js`

- `haversineM(a, b, c, d)` — 5 test cases
- `_cleanMText(text)` — 10 case: MTEXT groups, %%c, %%NNN
- `normalizeTextSearchable(text)` — accent removal, đ→d

### `tests/unit/gps.test.js`

- `averageFixes(fixes)` — MAD outlier filter

## GitHub Actions

Add to existing `test.yml`:
```yaml
- run: npm run test:unit
- uses: codecov/codecov-action@v4
```

## Testing checklist

- [ ] `npm run test:unit` local pass
- [ ] Coverage report generate
- [ ] Codecov badge trong README
- [ ] Coverage > 80% cho lib/*.js

## Deliverable

Bug math được catch ngay khi thay đổi công thức.
```

---

## Nhóm 18 — SaaS Foundation

### P39 — CLI onboarding tool

```
Task: Setup khách hàng mới trong 5 phút.

## Package

Tạo repo mới `lighting-survey-setup`, publish npm.

`bin/setup.js`:
```js
#!/usr/bin/env node
import { prompt } from 'inquirer';
import { google } from 'googleapis';
import { Octokit } from '@octokit/rest';

const answers = await prompt([
    { name: 'name', message: 'Tên khách hàng:' },
    { name: 'email', message: 'Google admin account:' },
    { name: 'districts', type: 'checkbox', choices: DISTRICTS },
    { name: 'githubOrg', message: 'GitHub org (optional):' }
]);

// 1. Google OAuth flow
const auth = await googleAuth();

// 2. Tạo Spreadsheet + share
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheet = await sheets.spreadsheets.create({
    requestBody: { properties: { title: `LightingSurvey_${answers.name}` } }
});
await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheet.data.spreadsheetId,
    requestBody: {
        requests: answers.districts.map(d => ({ addSheet: { properties: { title: d } } }))
    }
});

// 3. Deploy GAS
// Google Apps Script API - deployment.create()

// 4. Tạo GitHub repo + Pages
const octokit = new Octokit({ auth: GITHUB_TOKEN });
await octokit.repos.createForAuthenticatedUser({
    name: `lighting-survey-${answers.name.toLowerCase()}`,
    homepage: `https://${answers.githubOrg}.github.io/lighting-survey-${answers.name.toLowerCase()}/`
});

// 5. Push template code + update config
// git clone template → sed replace URLs → git push

// 6. Enable GitHub Pages
await octokit.repos.createPagesSite({ ... });

// 7. Email hướng dẫn
console.log('✓ Setup xong! URL: https://...');
```

## Testing checklist

- [ ] End-to-end setup 1 khách mới thành công
- [ ] Thời gian < 5 phút
- [ ] Có thể re-run nếu step fail (idempotent)
- [ ] Rollback khi lỗi giữa chừng

## Deliverable

Onboard khách hàng mới 5 phút thay 4-8 giờ.
```

---

### P40 — Multi-tenant Supabase

```
Task: Chuyển từ Google Sheets → Supabase PostgreSQL, multi-tenant.

## Schema

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants,
    email TEXT UNIQUE,
    role TEXT,
    displayed_name TEXT,
    vung TEXT[]  -- array of allowed sheet names
);

CREATE TABLE markers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants,
    district TEXT,
    ten_tru TEXT,
    lat FLOAT8,
    lon FLOAT8,
    -- ... 22 cột còn lại của schema
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_markers_tenant_district ON markers(tenant_id, district);
```

## Row Level Security

```sql
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON markers
    USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);
```

## Auth

Supabase Auth (email + password).

## Client rewrite

Thay `syncRowToGAS` bằng:
```js
const { data, error } = await supabase.from('markers').upsert(row).select();
```

## Migration

Script chuyển data từ Google Sheet → Supabase:
```js
// migrate.js
const rows = await fetchAllRowsFromGoogleSheet();
for (const row of rows) {
    await supabase.from('markers').insert({ ...row, tenant_id: TENANT_ID });
}
```

## Testing checklist

- [ ] Insert marker isolated theo tenant
- [ ] Query cross-tenant fail (RLS)
- [ ] Auth flow email + password work
- [ ] Migration 1000 rows < 5 phút
- [ ] Realtime subscribe update markers

## Deliverable

Multi-tenant true SaaS, scale > 100 tenants dễ dàng.
```

---

### P41 — Billing với Payos

```
Task: Subscription tự động.

## Setup Payos

1. Đăng ký tài khoản business payos.vn
2. Get API key + partner code
3. Config webhook URL

## 3 Tier

Sheet `plans`:
| id | name | price_vnd | max_users | max_markers | features |
|---|---|---|---|---|---|
| free | Free | 0 | 2 | 200 | basic |
| pro | Pro | 500000 | 10 | unlimited | +cad,+api |
| enterprise | Enterprise | 1500000 | -1 | unlimited | +signature,+custom |

## Flow

1. Tenant upgrade → chọn plan → tạo Payos payment link
2. Redirect user đến Payos → thanh toán VNPay/Momo/thẻ
3. Payos webhook → update tenant plan
4. Enforce limits client-side + server-side

## Client

```js
async function upgradePlan(planId) {
    const res = await fetch('/api/upgrade', { method:'POST', body: JSON.stringify({ planId }) });
    const { paymentUrl } = await res.json();
    window.location.href = paymentUrl;
}
```

## Server

```js
// Create Payos link
const link = await payos.createPaymentLink({
    orderCode: Date.now(),
    amount: plan.price_vnd,
    description: `Upgrade ${plan.name}`,
    returnUrl: 'https://app.com/billing/success',
    cancelUrl: 'https://app.com/billing/cancel'
});
return { paymentUrl: link.checkoutUrl };

// Webhook
if (payload.success) {
    await db.tenants.update({ where: { id: tenantId }, data: { plan: planId } });
}
```

## Testing checklist

- [ ] Tạo link → redirect Payos
- [ ] Thanh toán test success → webhook fire → plan update
- [ ] Cancel → tenant giữ plan cũ
- [ ] Enforce limits: free tenant thêm marker 201 → deny
- [ ] Invoice email tự động

## Deliverable

SaaS auto revenue, không cần bill thủ công.
```

---

### P42 — Vertical expansion — Đèn tín hiệu giao thông ✅ DONE 2026-07-12 (config template)

```
Task: Extend product sang khảo sát đèn tín hiệu giao thông (traffic lights).

## Concept

Tận dụng 80% architecture hiện có, chỉ thay:
- `TYPE_CONFIG` mới (6 loại đèn tín hiệu)
- Custom form fields
- Custom template báo cáo

## New TYPE_CONFIG

```js
const TRAFFIC_LIGHT_TYPES = {
    1: { label: 'Đèn tín hiệu chính (3 màu)', color: '#ef4444' },
    2: { label: 'Đèn xoay 4 hướng', color: '#f59e0b' },
    3: { label: 'Đèn cho người đi bộ', color: '#10b981' },
    4: { label: 'Đèn cảnh báo (vàng nhấp nháy)', color: '#eab308' },
    5: { label: 'Tủ điều khiển tín hiệu', color: '#2563eb' },
    6: { label: 'Camera giám sát giao thông', color: '#8b5cf6' }
};
```

## New fields trong sheet

- Chu kỳ đèn (giây)
- Kiểu đồng bộ (fixed/adaptive/vehicle-actuated)
- Kết nối với TCC (Trung tâm điều khiển)
- Model camera nếu có

## Product variant

Tạo repo `neo-era/traffic-light-survey` fork từ lighting-survey:
- Change TYPE_CONFIG
- Change UI labels
- Change báo cáo template
- Same auth + map + PDF export code

## Marketing

Target: Sở GTVT, ban ATGT, phòng CSGT

## Testing checklist

- [ ] Fork repo build được
- [ ] All existing flow (add, edit, export) work với new types
- [ ] Report template có logo ban ATGT
- [ ] Deploy demo lên GitHub Pages riêng

## Deliverable

Mở market thứ 2 với effort 40h thay vì build từ đầu 500h.
```

---

## Ước tính effort tổng

| Prompt | Effort | Priority |
|---|---|:---:|
| P21 Ticketing | 40h | 🔴 |
| P22 Bảo trì | 25h | 🔴 |
| P23 Task workflow | 30h | 🟠 |
| P24 Notification | 20h | 🟠 |
| P25 Dashboard | 30h | 🟠 |
| P26 Báo cáo NN | 40h | 🔴 |
| P27 Email report | 15h | 🟠 |
| P28 Chữ ký số | 40h | 🟢 |
| P29 Zalo OA | 50h | 🟠 |
| P30 REST API | 30h | 🟠 |
| P31 Voice note | 15h | 🟢 |
| P32 QR scan | 10h | 🟢 |
| P33 Polygon | 15h | 🟢 |
| P34 Đo khoảng cách | 8h | 🟢 |
| P35 Playwright tests | 40h | 🔴 |
| P36 Sentry | 15h | 🟠 |
| P37 Module extraction | 60h | 🟠 |
| P38 Unit tests | 25h | 🟠 |
| P39 CLI onboarding | 50h | 🟢 |
| P40 Multi-tenant | 250h | 🟢 |
| P41 Billing | 80h | 🟢 |
| P42 Vertical | 40h | 🟢 |
| **TỔNG** | **~930h** | **~23 tuần** |

## Thứ tự thực hiện đề xuất

**Q1 2026 (2 tháng)** — Hoàn thiện quản lý vận hành:
- P35 Tests → P21 Ticketing → P22 Bảo trì → P36 Sentry

**Q2 2026 (2 tháng)** — Báo cáo + Analytics:
- P25 Dashboard → P26 Báo cáo NN → P27 Email → P24 Notification

**Q3 2026 (2 tháng)** — Tích hợp + Field:
- P29 Zalo → P30 API → P32 QR → P34 Đo → P31 Voice

**Q4 2026 (3 tháng)** — SaaS foundation:
- P37 Modularize → P39 CLI → P28 Chữ ký → P40 Multi-tenant (nếu đủ khách) → P41 Billing

**2027+** — Vertical:
- P42 → mở rộng đèn tín hiệu → nước → viễn thông



