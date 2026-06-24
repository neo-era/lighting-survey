// Google Apps Script — Quản lý dữ liệu khảo sát chiếu sáng (index.html)
// ══════════════════════════════════════════════════════════════════════════
// HƯỚNG DẪN TRIỂN KHAI:
//   1. Mở Google Sheet mới (đặt tên tùy ý, khác "khaosat")
//   2. Tạo tab đầu tiên, đặt tên: DanhSachTru
//   3. Hàng 1 phải là header đúng thứ tự (xem HEADER bên dưới)
//   4. Vào Extensions → Apps Script → dán toàn bộ file này vào
//   5. Deploy → New deployment → Web App:
//        Execute as: Me
//        Who has access: Anyone
//   6. Copy URL → dán vào KHAOSAT_GAS_URL trong index.html
//   7. Publish Google Sheet dưới dạng CSV:
//        File → Share → Publish to web → Sheet: DanhSachTru → CSV → Publish
//   8. Copy URL CSV → dán vào KHAOSAT_CSV_URL trong index.html
//   9. Vào Script Properties (⚙️ Project Settings → Script Properties):
//        Key: GITHUB_TOKEN   Value: ghp_xxxxxxxxxxxx (PAT với scope contents:write)
// ══════════════════════════════════════════════════════════════════════════

const SHEET_NAME = 'DanhSachTru'; // ← Tên tab trong Google Sheet

// Header khớp chính xác với Google Sheet thực tế
const HEADER = [
  'ID', 'Tên trụ', 'Lat', 'Lon', 'Ghi chú', 'Người KS',
  'Loại', 'Tủ điều khiển', 'Loại trụ', 'Loại cần', 'Loại đèn',
  'Công suất', 'Ảnh', 'Thời gian cập nhật', 'Marker gốc', 'Khoảng cách (m)', 'Mã PE', 'Đường', 'Phường/ Xã',
  'VN2000-X', 'VN2000-Y', 'Số lượng đèn', 'Loại cáp',
  'Độ chính xác (m)', 'Chế độ GPS', 'Label offset'
];

// Map key payload JS → tên cột trong Sheet
const FIELD_MAP = {
  'id':          'ID',
  'tenTru':      'Tên trụ',
  'lat':         'Lat',
  'lon':         'Lon',
  'ghiChu':      'Ghi chú',
  'nguoiKS':     'Người KS',
  'loai':        'Loại',
  'tuDieuKhien': 'Tủ điều khiển',
  'loaiTru':     'Loại trụ',
  'loaiCan':     'Loại cần',
  'loaiDen':     'Loại đèn',
  'congSuat':    'Công suất',
  'hinhAnh':     'Ảnh',
  'capNhat':     'Thời gian cập nhật',
  'markerGoc':   'Marker gốc',
  'khoangCach':  'Khoảng cách (m)',
  'maPE':        'Mã PE',
  'duong':       'Đường',
  'phuongXa':    'Phường/ Xã',
  'vn2000x':     'VN2000-X',
  'vn2000y':     'VN2000-Y',
  'soLuongDen':  'Số lượng đèn',
  'loaiCap':     'Loại cáp',
  'accuracy':     'Độ chính xác (m)',
  'gpsMode':      'Chế độ GPS',
  'labelOffset':  'Label offset',
};

// ── UTILS ──────────────────────────────────────────────────────────────────

// Map sheet name → Spreadsheet ID (cho các địa bàn nằm ở file Google Sheet khác).
// Để trống cho các địa bàn nằm cùng file với GAS này.
// Cách lấy ID: mở file đó → URL có dạng /spreadsheets/d/<ID>/edit → copy <ID>.
// ⚠️ Tài khoản deploy GAS phải có quyền EDIT trên file ngoài.
const EXTERNAL_SPREADSHEET_IDS = {
  CanGiuoc: '1u1KIDPX5INt-9bI6EDK-K6VKSCJAoey7drElKW3rLS0',  // ← TODO: dán Spreadsheet ID của file CanGiuoc vào đây
};

function getSheet(name) {
  const target = name || SHEET_NAME;
  let ss;
  // Sheet ở file ngoài → mở bằng openById
  const extId = EXTERNAL_SPREADSHEET_IDS[target];
  if (extId) {
    try {
      ss = SpreadsheetApp.openById(extId);
    } catch (e) {
      // Không mở được file ngoài → fallback active để không crash
      Logger.log('openById failed for ' + target + ': ' + e.message);
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  let sheet = ss.getSheetByName(target);
  if (!sheet) {
    // Sheet chưa tồn tại → fallback về DanhSachTru ở active spreadsheet
    const active = SpreadsheetApp.getActiveSpreadsheet();
    sheet = active.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = active.insertSheet(SHEET_NAME);
  }
  return sheet;
}

// Tự động tạo header nếu trống, hoặc bổ sung cột còn thiếu ở cuối
function ensureHeader(sheet) {
  if (!sheet) sheet = getSheet();
  const lastCol = sheet.getLastColumn();

  if (lastCol === 0) {
    // Sheet hoàn toàn trống — ghi toàn bộ header
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    _formatHeader(sheet, 1, HEADER.length);
    sheet.setFrozenRows(1);
    return;
  }

  // Đọc header hiện tại
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v).trim());

  // Tìm cột còn thiếu (so sánh theo tên chuẩn hóa)
  const existingNorm = existing.map(h => norm(h));
  const missing = HEADER.filter(h => !existingNorm.includes(norm(h)));

  if (missing.length > 0) {
    const startCol = lastCol + 1;
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    _formatHeader(sheet, startCol, missing.length);
    sheet.autoResizeColumns(startCol, missing.length);
  }
}

function _formatHeader(sheet, startCol, numCols) {
  sheet.getRange(1, startCol, 1, numCols)
       .setFontWeight('bold')
       .setBackground('#cfe2f3')
       .setHorizontalAlignment('center')
       .setWrap(false);
}

function norm(s) {
  return String(s || '').normalize('NFC').trim().toLowerCase();
}

function buildHeaderIndex(headers) {
  const idx = {};
  headers.forEach((h, i) => { idx[norm(h)] = i; });
  return idx;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── UPLOAD ẢNH LÊN GITHUB (lưu vào thư mục images/ gốc của repo) ──────────

function handleImageUpload(imageBase64, soTru, ext) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    return jsonResponse({ status: 'error', message: 'GITHUB_TOKEN chưa được cài trong Script Properties.' });
  }

  const ts = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH-mm-ss") + 'Z';
  const safeName = (soTru || 'img').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const fileName  = safeName + '-' + ts + '.' + (ext || 'jpg');
  const filePath  = 'images/' + fileName; // ← lưu vào thư mục images/ gốc

  const apiUrl = 'https://api.github.com/repos/neo-era/lighting-survey/contents/'
    + filePath.split('/').map(encodeURIComponent).join('/');

  const res = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      message: 'Upload ảnh khảo sát: ' + fileName,
      content: imageBase64,
      branch: 'main'
    }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    return jsonResponse({ status: 'error', message: 'GitHub API lỗi ' + code + ': ' + res.getContentText().slice(0, 300) });
  }
  const absoluteUrl = 'https://raw.githubusercontent.com/neo-era/lighting-survey/main/images/' + fileName;
  return jsonResponse({ status: 'ok', path: absoluteUrl });
}

// ── UPLOAD FILE LÊN GITHUB (proxy — dùng token lưu trong Script Properties) ─

function handleGitHubUpload(filePath, contentBase64, message) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return jsonResponse({ status: 'error', message: 'GITHUB_TOKEN chưa cài trong Script Properties.' });
  if (!filePath) return jsonResponse({ status: 'error', message: 'Thiếu đường dẫn file (path).' });

  const apiUrl = 'https://api.github.com/repos/neo-era/lighting-survey/contents/'
    + filePath.split('/').map(encodeURIComponent).join('/');
  const headers = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  // Lấy SHA nếu file đã tồn tại
  let sha;
  try {
    const r = UrlFetchApp.fetch(apiUrl, { method: 'get', headers: headers, muteHttpExceptions: true });
    if (r.getResponseCode() === 200) sha = JSON.parse(r.getContentText()).sha;
  } catch (e) {}

  const body = { message: message, content: contentBase64, branch: 'main' };
  if (sha) body.sha = sha;

  const res = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    return jsonResponse({ status: 'error', message: 'GitHub API lỗi ' + code + ': ' + res.getContentText().slice(0, 300) });
  }
  return jsonResponse({ status: 'ok' });
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────

// ── ĐỔI THÔNG TIN TÀI KHOẢN ───────────────────────────────────────────────

function handleChangeCredentials(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet TaiKhoan chưa được tạo' });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'Không tìm thấy tài khoản' });

  const username = String(data.username || '').trim();
  const currentPassword = String(data.currentPassword || '');
  const newUsername = String(data.newUsername || '').trim();
  const newPassword = String(data.newPassword || '');

  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    var dn = String(rows[i][0] || '').trim();
    var mk = String(rows[i][1] || '').trim();
    if (dn.toLowerCase() === username.toLowerCase() && mk === currentPassword) {
      var rowNum = i + 2;
      if (newUsername && newUsername !== dn) {
        sheet.getRange(rowNum, 1).setValue(newUsername);
      }
      if (newPassword) {
        sheet.getRange(rowNum, 2).setValue(newPassword);
      }
      return jsonResponse({ status: 'ok', newUsername: newUsername || dn });
    }
  }
  return jsonResponse({ status: 'error', message: 'Mật khẩu hiện tại không đúng' });
}

// ── ĐĂNG NHẬP ──────────────────────────────────────────────────────────────

function handleLogin(username, password) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet TaiKhoan chưa được tạo' });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'Sai tên đăng nhập hoặc mật khẩu' });

  const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  // Cột: A=tenDangNhap, B=matKhau, C=hoTen, D=vaiTro, E=vung (phân tách bằng dấu phẩy)
  for (const row of rows) {
    const dn = String(row[0] || '').trim();
    const mk = String(row[1] || '').trim();
    if (dn.toLowerCase() === username.toLowerCase() && mk === password) {
      const vungRaw = String(row[4] || '').trim();
      const vung = vungRaw ? vungRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
      return jsonResponse({
        status: 'ok',
        user: {
          username:    dn,
          displayName: String(row[2] || dn).trim(),
          role:        String(row[3] || 'user').trim(),
          vung:        vung   // [] = được phép tất cả địa bàn
        }
      });
    }
  }
  return jsonResponse({ status: 'error', message: 'Sai tên đăng nhập hoặc mật khẩu' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'login') {
      return handleLogin((data.username || '').trim(), data.password || '');
    }

    if (data.action === 'change_credentials') {
      return handleChangeCredentials(data);
    }

    if (data.action === 'log_action') {
      return handleLogAction(data);
    }

    if (data.action === 'upload_image') {
      return handleImageUpload(data.imageBase64 || '', data.soTru || '', data.ext || 'jpg');
    }

    if (data.action === 'upload_to_github') {
      return handleGitHubUpload(data.path || '', data.content || '', data.message || 'Đồng bộ dữ liệu khảo sát');
    }

    if (data.action === 'full_update') {
      const sheet = getSheet(data.sheet);
      ensureHeader(sheet);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const hIdx    = buildHeaderIndex(headers);

      const rowNum = findRowNum(sheet, headers, hIdx, data);
      if (rowNum > 0) {
        updateRow(sheet, hIdx, rowNum, data);
      } else {
        appendRow(sheet, headers, hIdx, data);
      }
      return jsonResponse({ status: 'ok' });
    }

    if (data.action === 'delete_row') {
      const sheet = getSheet(data.sheet);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const hIdx    = buildHeaderIndex(headers);
      const rowNum  = findRowNum(sheet, headers, hIdx, data);
      if (rowNum > 0) {
        sheet.deleteRow(rowNum);
        return jsonResponse({ status: 'ok' });
      }
      return jsonResponse({ status: 'error', message: 'Không tìm thấy hàng để xóa.' });
    }

    if (data.action === 'batch_import') {
      return handleBatchImport(data.sheet, data.rows || [], data.clearFirst === true);
    }

    if (data.action === 'normalize_coords') {
      return handleNormalizeCoords(data.sheet || 'DanhSachTru');
    }

    if (data.action === 'fix_loai') {
      return handleFixLoai(data.sheet || 'DanhSachTru');
    }

    if (data.action === 'fill_marker_goc') {
      return handleFillMarkerGoc(data.sheet || 'DanhSachTru', data.overwrite === true);
    }

    if (data.action === 'fill_marker_goc_chain') {
      return handleFillMarkerGocChain(data.sheet || 'DanhSachTru', data.overwrite === true);
    }

    return jsonResponse({ status: 'error', message: 'action không hợp lệ: ' + data.action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ── BATCH IMPORT (nhập hàng loạt từ Excel) ────────────────────────────────

function handleBatchImport(sheetName, rows, clearFirst) {
  const sheet = getSheet(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet không tồn tại: ' + sheetName });

  // Ensure header row exists
  ensureHeader(sheet);

  if (clearFirst) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
  }

  if (rows.length > 0) {
    const startRow = clearFirst ? 2 : (Math.max(sheet.getLastRow(), 1) + 1);
    const numCols  = rows[0].length;
    sheet.getRange(startRow, 1, rows.length, numCols).setValues(rows);
  }

  return jsonResponse({ status: 'ok', count: rows.length, sheet: sheetName });
}

// ── LOG LỊCH SỬ THAO TÁC ──────────────────────────────────────────────────

function handleLogAction(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName('LichSu');
  if (!sheet) {
    sheet = ss.insertSheet('LichSu');
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 6).setValues([['Thời gian', 'Người thực hiện', 'Thao tác', 'ID', 'Tên trụ', 'Chi tiết']]);
    sheet.getRange(1, 1, 1, 6)
         .setFontWeight('bold')
         .setBackground('#1e293b')
         .setFontColor('#ffffff')
         .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 6);
  }
  sheet.appendRow([
    data.thoiGian     || '',
    data.nguoiThucHien || '',
    data.loaiThaoTac  || '',
    data.id           || '',
    data.tenTru       || '',
    data.chiTiet      || ''
  ]);
  return jsonResponse({ status: 'ok' });
}

// ── ROW CRUD ───────────────────────────────────────────────────────────────

function findRowNum(sheet, headers, hIdx, data) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const idCol    = hIdx[norm('ID')];
  const nameCol  = hIdx[norm('Tên trụ')];
  const searchId = norm(data.id || '');
  const searchNm = norm(data.oldTenTru || data.tenTru || '');
  if (!searchId && !searchNm) return -1;

  const allData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < allData.length; i++) {
    const rowId  = idCol   !== undefined ? norm(allData[i][idCol])   : '';
    const rowNm  = nameCol !== undefined ? norm(allData[i][nameCol]) : '';
    if ((searchId && rowId && rowId === searchId) ||
        (searchNm && rowNm && rowNm === searchNm)) {
      return i + 2;
    }
  }
  return -1;
}

function updateRow(sheet, hIdx, rowNum, data) {
  updateRowFields(sheet, hIdx, rowNum, buildFieldValues(data));
}

function updateRowFields(sheet, hIdx, rowNum, fieldValues) {
  for (const [header, value] of Object.entries(fieldValues)) {
    const col = hIdx[norm(header)];
    if (col !== undefined && value !== undefined) {
      sheet.getRange(rowNum, col + 1).setValue(value === null ? '' : value);
    }
  }
}

function appendRow(sheet, headers, hIdx, data) {
  const fieldValues = buildFieldValues(data);
  const row = headers.map(h => fieldValues[h] !== undefined ? fieldValues[h] : '');
  sheet.appendRow(row);
}

function buildFieldValues(data) {
  const result = {};
  const skip = new Set(['action', 'sheet', 'oldTenTru']);
  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key)) continue;
    const header = FIELD_MAP[key] || key;
    if (value !== undefined && value !== null) {
      result[header] = value; // allow '' to clear cells
    }
  }
  return result;
}

// ── HEALTH CHECK ───────────────────────────────────────────────────────────

function doGet(e) {
  ensureHeader(getSheet());
  return jsonResponse({ status: 'ok', message: 'KhaoSat GAS v2 — login ready, header ensured' });
}

// ── CHUẨN HÓA TỌA ĐỘ ─────────────────────────────────────────────────────

// Tính VN2000 (Gauss-Krüger, múi 6°, GRS80) — khớp hàm convertLatLonToVn2000 trong index.html
function _convertLatLonToVn2000(lat, lon) {
  var toRad = function(x) { return x * Math.PI / 180; };
  var a = 6378137.0, f = 1/298.257222101;
  var e2 = 2*f - f*f, k0 = 0.9996;
  var zone = Math.floor((lon + 180)/6) + 1;
  var lon0 = toRad(zone*6 - 183);
  var phi = toRad(lat), lambda = toRad(lon);
  var sinPhi = Math.sin(phi), cosPhi = Math.cos(phi), tanPhi = Math.tan(phi);
  var N = a / Math.sqrt(1 - e2*sinPhi*sinPhi);
  var T = tanPhi*tanPhi, C = e2/(1-e2)*cosPhi*cosPhi;
  var A = (lambda - lon0)*cosPhi;
  var M = a * ((1-e2/4-3*Math.pow(e2,2)/64-5*Math.pow(e2,3)/256)*phi
    - (3*e2/8+3*Math.pow(e2,2)/32+45*Math.pow(e2,3)/1024)*Math.sin(2*phi)
    + (15*Math.pow(e2,2)/256+45*Math.pow(e2,3)/1024)*Math.sin(4*phi)
    - (35*Math.pow(e2,3)/3072)*Math.sin(6*phi));
  var x = k0*N*(A+(1-T+C)*Math.pow(A,3)/6+(5-18*T+T*T+72*C-58*e2/(1-e2))*Math.pow(A,5)/120);
  var y = k0*(M+N*tanPhi*(Math.pow(A,2)/2+(5-T+9*C+4*C*C)*Math.pow(A,4)/24+(61-58*T+T*T+600*C-330*e2/(1-e2))*Math.pow(A,6)/720));
  return { x: x + 500000, y: y, zone: zone };
}

function handleNormalizeCoords(sheetName) {
  var sheet = getSheet(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet không tồn tại: ' + sheetName });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', fixed: 0, total: 0 });

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hIdx    = buildHeaderIndex(headers);
  var numCols = headers.length;

  var latCol = hIdx[norm('lat')];
  var lonCol = hIdx[norm('lon')];
  var vxCol  = hIdx[norm('vn2000-x')];
  var vyCol  = hIdx[norm('vn2000-y')];

  if (latCol === undefined || lonCol === undefined) {
    return jsonResponse({ status: 'error', message: 'Không tìm thấy cột Lat/Lon trong sheet: ' + sheetName });
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var fixedCount = 0;

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    var rawLat = row[latCol];
    var rawLon = row[lonCol];

    var lat = parseFloat(String(rawLat).replace(',', '.'));
    var lon = parseFloat(String(rawLon).replace(',', '.'));

    if (!isFinite(lat) || !isFinite(lon) || lat === 0 || lon === 0) continue;

    var changed = false;

    // Chuẩn hóa string → number
    if (typeof rawLat !== 'number' || rawLat !== lat) {
      row[latCol] = lat;
      changed = true;
    }
    if (typeof rawLon !== 'number' || rawLon !== lon) {
      row[lonCol] = lon;
      changed = true;
    }

    // Tính lại VN2000
    if (vxCol !== undefined && vyCol !== undefined) {
      var vn   = _convertLatLonToVn2000(lat, lon);
      var newX = Math.round(vn.x);
      var newY = Math.round(vn.y);
      if (row[vxCol] !== newX) { row[vxCol] = newX; changed = true; }
      if (row[vyCol] !== newY) { row[vyCol] = newY; changed = true; }
    }

    if (changed) fixedCount++;
  }

  if (fixedCount > 0) {
    sheet.getRange(2, 1, allData.length, numCols).setValues(allData);
  }

  return jsonResponse({ status: 'ok', fixed: fixedCount, total: allData.length, sheet: sheetName });
}

/**
 * Chạy 1 lần từ Apps Script Editor để tạo tất cả sheet địa bàn.
 * Sau khi chạy: publish từng tab ra CSV và điền URL vào DISTRICT_PAGES trong index.html.
 * Cách chạy: Apps Script Editor → chọn hàm này → nhấn Run (▶)
 */
function setupDistrictSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName('DanhSachTru');
  if (!source) { Logger.log('Không tìm thấy sheet DanhSachTru'); return; }
  const numCols = HEADER.length;
  const header = source.getRange(1, 1, 1, numCols).getValues();
  const sheetNames = [
    'Quan1', 'Quan3', 'Quan5', 'Quan8', 'Quan10', 'Quan11',
    'PhuNhuan', 'BinhThanh', 'TanBinh', 'TanPhu',
    'BauBang', 'TruVanTho', 'BenCat', 'CanGiuoc'
  ];
  sheetNames.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, numCols).setValues(header);
      sh.getRange(1, 1, 1, numCols).setFontWeight('bold')
        .setBackground('#cfe2f3')
        .setHorizontalAlignment('center');
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, numCols);
      Logger.log('Đã tạo sheet: ' + name);
    } else {
      Logger.log('Sheet đã tồn tại (bỏ qua): ' + name);
    }
  });
  Logger.log('Hoàn tất. Tiếp theo: publish từng tab thành CSV và điền URL vào DISTRICT_PAGES trong index.html.');
}

/**
 * Chạy từ Apps Script Editor để cập nhật HEADER cho TẤT CẢ sheet địa bàn
 * (kể cả sheet ngoài qua EXTERNAL_SPREADSHEET_IDS).
 *
 * Dùng khi thêm cột mới vào HEADER (vd 'Loại cáp', 'Độ chính xác (m)'...)
 * — ensureHeader() tự động chèn cột còn thiếu ở cuối, không xóa data hiện có.
 *
 * Cách chạy: Apps Script Editor → chọn hàm này → nhấn Run (▶)
 */
function updateAllSheetsHeader() {
  // Tất cả tên sheet cần update (kể cả DanhSachTru gốc + sheet ngoài)
  const allSheets = [
    'DanhSachTru',
    'Quan1', 'Quan3', 'Quan5', 'Quan8', 'Quan10', 'Quan11',
    'PhuNhuan', 'BinhThanh', 'TanBinh', 'TanPhu',
    'BauBang', 'TruVanTho', 'BenCat', 'CanGiuoc'
  ];
  let ok = 0, missing = 0, failed = 0;
  allSheets.forEach(function(name) {
    try {
      const sheet = getSheet(name);
      if (!sheet) {
        Logger.log('⚠ Không tìm thấy sheet: ' + name);
        missing++;
        return;
      }
      const before = sheet.getLastColumn();
      ensureHeader(sheet);
      const after = sheet.getLastColumn();
      const added = after - before;
      const loc = EXTERNAL_SPREADSHEET_IDS[name] ? '[ngoài]' : '[active]';
      Logger.log('✓ ' + loc + ' ' + name + ' — ' + (added > 0 ? 'thêm ' + added + ' cột' : 'đã đủ HEADER'));
      ok++;
    } catch (e) {
      Logger.log('❌ ' + name + ' lỗi: ' + e.message);
      failed++;
    }
  });
  Logger.log('═══════════════════════════════');
  Logger.log('Hoàn tất: ' + ok + ' sheet OK, ' + missing + ' không tìm thấy, ' + failed + ' lỗi');
  Logger.log('HEADER hiện tại: ' + HEADER.length + ' cột — ' + HEADER.join(' | '));
}

// ── ĐIỀN MARKER GỐC = TỦ ĐIỀU KHIỂN cho mỗi trụ ─────────────────────────
// Chỉ điền khi Marker gốc đang trống (hoặc overwrite=true).
// Bỏ qua hàng tủ (Loại trụ trống).
function handleFillMarkerGoc(sheetName, overwrite) {
  var sheet = getSheet(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet không tồn tại: ' + sheetName });
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', fixed: 0, total: 0 });

  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hIdx     = buildHeaderIndex(headers);
  var tuCol    = hIdx[norm('tủ điều khiển')];
  var gocCol   = hIdx[norm('marker gốc')];
  var loaiTruCol = hIdx[norm('loại trụ')];

  if (tuCol === undefined || gocCol === undefined) {
    return jsonResponse({ status: 'error', message: 'Không tìm thấy cột Tủ điều khiển / Marker gốc: ' + sheetName });
  }

  var numCols = headers.length;
  var allData = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var fixedCount = 0;

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    // Bỏ qua hàng tủ (Loại trụ trống)
    if (loaiTruCol !== undefined && !String(row[loaiTruCol] || '').trim()) continue;
    var tu  = String(row[tuCol]  || '').trim();
    var goc = String(row[gocCol] || '').trim();
    if (!tu) continue;
    if (!overwrite && goc) continue; // đã có, không ghi đè
    if (row[gocCol] !== tu) {
      row[gocCol] = tu;
      fixedCount++;
    }
  }

  if (fixedCount > 0) {
    sheet.getRange(2, 1, allData.length, numCols).setValues(allData);
  }
  return jsonResponse({ status: 'ok', fixed: fixedCount, total: allData.length, sheet: sheetName });
}

// ── ĐIỀN MARKER GỐC THEO CHUỖI TUYẾN (tủ có thể nằm giữa) ───────────────
// Logic:
//   1. Nhóm trụ theo (Tủ điều khiển, prefix tên trụ) — cùng tuyến
//   2. Sort theo số thứ tự cuối tên (VD: ADV_2_1 → seq=1)
//   3. Tìm vị trí chèn tủ vào chuỗi bằng minimum detour cost:
//      cost(chèn giữa A-B) = dist(A,tủ) + dist(tủ,B) - dist(A,B)
//      cost(chèn đầu)      = dist(tủ, p[0])
//      cost(chèn cuối)     = dist(tủ, p[N-1])
//   4. Trụ bên trái điểm chèn → chuỗi hướng phải (→ tủ)
//      Trụ bên phải điểm chèn → chuỗi hướng trái (→ tủ)
//      Cả hai trụ sát tủ đều có Marker gốc = tên tủ
function handleFillMarkerGocChain(sheetName, overwrite) {
  var sheet = getSheet(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet không tồn tại: ' + sheetName });
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', filled: 0, total: 0 });

  var headers    = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hIdx       = buildHeaderIndex(headers);
  var numCols    = headers.length;
  var tenTruCol  = hIdx[norm('tên trụ')];
  var latCol     = hIdx[norm('lat')];
  var lonCol     = hIdx[norm('lon')];
  var tuCol      = hIdx[norm('tủ điều khiển')];
  var gocCol     = hIdx[norm('marker gốc')];
  var loaiTruCol = hIdx[norm('loại trụ')];

  if (tenTruCol===undefined||latCol===undefined||lonCol===undefined||tuCol===undefined||gocCol===undefined) {
    return jsonResponse({ status: 'error', message: 'Thiếu cột cần thiết trong sheet: ' + sheetName });
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  var posMap = {};
  allData.forEach(function(row) {
    var name = String(row[tenTruCol]||'').trim();
    var lat  = parseFloat(row[latCol]);
    var lon  = parseFloat(row[lonCol]);
    if (name && isFinite(lat) && isFinite(lon) && lat !== 0) posMap[name] = { lat: lat, lon: lon };
  });

  function haversineM(lat1,lon1,lat2,lon2) {
    var R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function parseName(name) {
    var m = name.match(/^(.+)_(\d+)$/);
    return m ? { prefix: m[1], seq: parseInt(m[2], 10) } : { prefix: name, seq: 0 };
  }

  // Nhóm trụ theo (tủ, prefix)
  var groups = {};
  var rowIdxByName = {};
  allData.forEach(function(row, i) {
    var loaiTru = loaiTruCol !== undefined ? String(row[loaiTruCol]||'').trim() : 'x';
    if (!loaiTru) return;
    var name = String(row[tenTruCol]||'').trim();
    var tu   = String(row[tuCol]||'').trim();
    if (!name || !tu) return;
    rowIdxByName[name] = i;
    var p = parseName(name);
    var key = tu + '\x00' + p.prefix;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ name: name, seq: p.seq, tu: tu });
  });

  var filledCount = 0;

  Object.keys(groups).forEach(function(key) {
    var group = groups[key];
    var tuName = group[0].tu;
    var tuPos  = posMap[tuName];
    var n = group.length;

    group.sort(function(a,b){ return a.seq - b.seq; });

    // Tìm vị trí chèn tủ tối ưu (minimum detour cost)
    var bestK = n;
    if (tuPos) {
      var minCost = Infinity;
      var p0 = posMap[group[0].name];
      if (p0) { var c = haversineM(tuPos.lat,tuPos.lon,p0.lat,p0.lon); if (c < minCost) { minCost = c; bestK = 0; } }
      var pN = posMap[group[n-1].name];
      if (pN) { var c = haversineM(tuPos.lat,tuPos.lon,pN.lat,pN.lon); if (c < minCost) { minCost = c; bestK = n; } }
      for (var i = 1; i < n; i++) {
        var posA = posMap[group[i-1].name], posB = posMap[group[i].name];
        if (!posA || !posB) continue;
        var c = haversineM(posA.lat,posA.lon,tuPos.lat,tuPos.lon)
              + haversineM(tuPos.lat,tuPos.lon,posB.lat,posB.lon)
              - haversineM(posA.lat,posA.lon,posB.lat,posB.lon);
        if (c < minCost) { minCost = c; bestK = i; }
      }
    }

    for (var i = 0; i < bestK; i++) {
      var idx = rowIdxByName[group[i].name];
      if (idx===undefined) continue;
      if (!overwrite && String(allData[idx][gocCol]||'').trim()) continue;
      allData[idx][gocCol] = (i === bestK-1) ? tuName : group[i+1].name;
      filledCount++;
    }
    for (var i = bestK; i < n; i++) {
      var idx = rowIdxByName[group[i].name];
      if (idx===undefined) continue;
      if (!overwrite && String(allData[idx][gocCol]||'').trim()) continue;
      allData[idx][gocCol] = (i === bestK) ? tuName : group[i-1].name;
      filledCount++;
    }
  });

  if (filledCount > 0) {
    sheet.getRange(2, 1, allData.length, numCols).setValues(allData);
  }
  return jsonResponse({ status: 'ok', filled: filledCount, total: allData.length, sheet: sheetName });
}

// ── SỬA CỘT LOẠI dựa theo tên Loại trụ ───────────────────────────────────
// bê tông → 3 | trang trí → 2 | kim loại / khác → 1
function handleFixLoai(sheetName) {
  var sheet = getSheet(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet không tồn tại: ' + sheetName });
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', fixed: 0, total: 0 });

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hIdx    = buildHeaderIndex(headers);
  var loaiCol    = hIdx[norm('loại')];
  var loaiTruCol = hIdx[norm('loại trụ')];
  if (loaiCol === undefined || loaiTruCol === undefined) {
    return jsonResponse({ status: 'error', message: 'Không tìm thấy cột Loại / Loại trụ: ' + sheetName });
  }

  var numCols = headers.length;
  var allData = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var fixedCount = 0;

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    var tenLoai = String(row[loaiTruCol] || '').toLowerCase();
    if (!tenLoai) continue; // tủ điều khiển — bỏ qua
    var newLoai;
    if (tenLoai.indexOf('trang tr') !== -1) newLoai = 2;
    else if (tenLoai.indexOf('bê tông') !== -1) newLoai = 3;
    else newLoai = 1;
    if (row[loaiCol] !== newLoai) {
      row[loaiCol] = newLoai;
      fixedCount++;
    }
  }

  if (fixedCount > 0) {
    sheet.getRange(2, 1, allData.length, numCols).setValues(allData);
  }
  return jsonResponse({ status: 'ok', fixed: fixedCount, total: allData.length, sheet: sheetName });
}
