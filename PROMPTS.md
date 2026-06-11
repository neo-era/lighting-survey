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

4.1 → index.html: title block 50% chiều rộng
4.2 → index.html: nút Xem trước + preview bar
4.3 → index.html: force landscape ratio trước capture
4.4 → index.html: toggle đường cáp trên bản đồ chính
4.5 → index.html: tự động tính khoảng cách Haversine khi chọn Marker gốc
4.6 → index.html: localStorage nhớ field modal
4.7 → banve-mau.html: sync lại với _showPrintOverlay() thực tế
4.8 → index.html: cycle detection trước _buildCableLines()
```

⚠️ Việc cần làm TRƯỚC KHI CHẠY 4.x:
→ Bump sw.js v5 → v6 (người dùng chưa thấy thay đổi 3.x)
→ Redeploy GAS New version (header VN2000 từ session trước)
