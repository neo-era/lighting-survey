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

---

## TÍNH NĂNG 3: In bản vẽ sơ đồ tuyến trạm đèn

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

## TÍNH NĂNG 6: Sửa lỗi & cải tiến form chỉnh sửa marker

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

## TÍNH NĂNG 7: Đa địa bàn — nhiều sheet theo quận/huyện/xã

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

## TÍNH NĂNG: Xoay bản đồ tương tác (Compass + MapTools)

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

## TÍNH NĂNG 8: Tối ưu mobile

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
8.1 → index.html: isMobile + makeLampIconMobile() + shared icons     ⬜
8.2 → index.html: markerCluster chunkedLoading + mobile thresholds   ⬜
8.3 → index.html: labelZoomThreshold theo mobile/desktop             ⬜
8.4 → index.html: tắt Leaflet animation trên mobile                  ⬜
8.5 → index.html: loading="lazy" + max-height cho ảnh popup          ⬜
8.6 → index.html: debounce moveend/zoomend                           ⬜
8.7 → index.html: CSS media query tắt transition + ẩn nút desktop    ⬜
```
