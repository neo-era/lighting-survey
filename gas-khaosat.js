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

// Header sheet SuCo (báo sự cố)
const HEADER_SUCO = [
  'ID', 'Thời gian', 'Tên trụ', 'ID trụ', 'Lat', 'Lon',
  'Tủ điều khiển', 'Đường', 'Phường/Xã',
  'Loại sự cố', 'Mức độ', 'Mô tả', 'Ảnh', 'Người báo cáo',
  'Trạng thái', 'Người xử lý', 'Ghi chú xử lý'
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

// ── UPLOAD ẢNH LÊN GOOGLE DRIVE ───────────────────────────────────────────
// Lưu vào thư mục "KhaoSatAnh" trong Drive của tài khoản deploy GAS.
// Trả về URL dạng https://drive.google.com/uc?export=view&id=FILE_ID
// — dùng trực tiếp trong thẻ <img> mà không cần xác thực.

function handleImageUpload(imageBase64, soTru, ext) {
  try {
    const ts = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', "yyyyMMdd'T'HHmmss");
    const safeName = (soTru || 'img').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const fileName = safeName + '-' + ts + '.' + (ext || 'jpg');

    // Lấy hoặc tạo thư mục KhaoSatAnh
    const folderIter = DriveApp.getFoldersByName('KhaoSatAnh');
    const folder = folderIter.hasNext() ? folderIter.next() : DriveApp.createFolder('KhaoSatAnh');

    // Giải mã base64 → Blob → tạo file
    const mimeType = (ext === 'png') ? 'image/png' : 'image/jpeg';
    const blob = Utilities.newBlob(Utilities.base64Decode(imageBase64), mimeType, fileName);
    const file = folder.createFile(blob);

    // Cho phép bất kỳ ai có link xem được (không cần đăng nhập)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const viewUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    return jsonResponse({ status: 'ok', path: viewUrl });
  } catch (e) {
    return jsonResponse({ status: 'error', message: 'Drive upload lỗi: ' + e.message });
  }
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

    if (data.action === 'purge_no_gps') {
      return handlePurgeNoGps(data.sheet || 'DanhSachTru');
    }

    if (data.action === 'batch_match_update') {
      return handleBatchMatchUpdate(data.sheet, data.records || []);
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

    if (data.action === 'report_suco')  return handleReportSuCo(data);
    if (data.action === 'update_suco')  return handleUpdateSuCo(data);

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

// ── PURGE IMPORTED ROWS WITHOUT GPS ──────────────────────────────────────────
// Xóa hàng có Người KS = 'import' VÀ Lat rỗng (dọn dẹp import nhầm từ Excel)
function handlePurgeNoGps(sheetName) {
  var sheet = getSheet(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet không tồn tại: ' + sheetName });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', deleted: 0, total: 0 });

  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hIdx     = buildHeaderIndex(headers);
  var latCol   = hIdx[norm('Lat')];
  var nguoiCol = hIdx[norm('Người KS')];
  if (latCol === undefined) return jsonResponse({ status: 'error', message: 'Không tìm thấy cột Lat' });

  var allData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var toDelete = [];
  for (var i = 0; i < allData.length; i++) {
    var lat   = String(allData[i][latCol]   || '').trim();
    var nguoi = nguoiCol !== undefined ? String(allData[i][nguoiCol] || '').trim().toLowerCase() : '';
    if (!lat && nguoi === 'import') toDelete.push(i + 2);
  }
  for (var j = toDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(toDelete[j]);
  }
  return jsonResponse({ status: 'ok', deleted: toDelete.length, total: allData.length, sheet: sheetName });
}

// ── BATCH MATCH UPDATE (chỉ update, không insert) ────────────────────────────
// records: [{tenTru, loaiDen, congSuat, soLuongDen, tuDieuKhien, ...}]
// Tìm hàng theo Tên trụ → update field, bỏ qua nếu không tìm thấy
function handleBatchMatchUpdate(sheetName, records) {
  var sheet = getSheet(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet không tồn tại: ' + sheetName });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', updated: 0, notFound: records.length });

  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hIdx     = buildHeaderIndex(headers);
  // Tìm cột Tên trụ: thử theo tên trước, fallback index cứng 1 (cột B)
  var nameCol = hIdx[norm('Tên trụ')];
  if (nameCol === undefined) {
    // Fallback: scan headers tìm bất kỳ header nào có 'tr' (tên trụ, ten tru, ...)
    for (var hi = 0; hi < headers.length; hi++) {
      var hn = norm(headers[hi]);
      if (hn.indexOf('tr') !== -1 && hn.indexOf('t') === 0) { nameCol = hi; break; }
    }
  }
  if (nameCol === undefined) nameCol = 1; // hardcode cột B nếu không tìm thấy
  if (headers.length < 2) return jsonResponse({ status: 'error', message: 'Sheet không có đủ cột' });

  var allData   = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var nameToRow = {};
  for (var i = 0; i < allData.length; i++) {
    var nm = norm(String(allData[i][nameCol] || ''));
    if (nm && !nameToRow[nm]) nameToRow[nm] = i + 2;
  }

  var updated = 0, notFound = 0;
  for (var k = 0; k < records.length; k++) {
    var rec    = records[k];
    var rnm    = norm(String(rec.tenTru || ''));
    var rowNum = nameToRow[rnm];
    if (rowNum) {
      updateRowFields(sheet, hIdx, rowNum, buildFieldValues(rec));
      updated++;
    } else {
      notFound++;
    }
  }
  return jsonResponse({ status: 'ok', updated: updated, notFound: notFound, sheet: sheetName });
}

// ── BÁO SỰ CỐ ────────────────────────────────────────────────────────────────

function ensureHeaderSuCo(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0 || sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER_SUCO);
    sheet.getRange(1, 1, 1, HEADER_SUCO.length)
      .setFontWeight('bold').setBackground('#fef3c7').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h); });
  var toAdd = [];
  HEADER_SUCO.forEach(function(h) { if (existing.indexOf(h) === -1) toAdd.push(h); });
  if (toAdd.length > 0) {
    toAdd.forEach(function(h) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(h).setFontWeight('bold').setBackground('#fef3c7');
    });
  }
}

function handleReportSuCo(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('SuCo');
  if (!sheet) {
    sheet = ss.insertSheet('SuCo');
  }
  ensureHeaderSuCo(sheet);

  var now = new Date();
  var thoiGian = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', "yyyy-MM-dd'T'HH:mm:ss'+07:00'");

  // Tìm sự cố chưa xử lý của cùng trụ + cùng loại → cập nhật thay vì tạo mới
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var allData = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
    for (var i = 0; i < allData.length; i++) {
      var r = allData[i];
      var sameTru   = String(r[2] || '').trim() === String(data.tenTru || '').trim();
      var sameLoai  = String(r[9] || '').trim() === String(data.loaiSuCo || '').trim();
      var notDone   = String(r[14] || '').trim() !== 'Đã xử lý';
      if (sameTru && sameLoai && notDone) {
        // Cập nhật các trường có thể thay đổi (giữ nguyên Thời gian phát hiện ban đầu)
        var rowNum = i + 2; // +1 header +1 vì i bắt đầu từ 0
        sheet.getRange(rowNum, 11).setValue(data.mucDo || 'Bình thường'); // Mức độ
        sheet.getRange(rowNum, 12).setValue(data.moTa || '');             // Mô tả
        if (data.anh) sheet.getRange(rowNum, 13).setValue(data.anh);      // Ảnh (chỉ ghi đè nếu có ảnh mới)
        sheet.getRange(rowNum, 14).setValue(data.nguoiBaoCao || '');      // Người báo cáo
        var existingId = String(r[0] || '');
        return jsonResponse({ status: 'ok', id: existingId, updated: true });
      }
    }
  }

  // Không tìm thấy → tạo mới
  var n    = lastRow < 1 ? 1 : lastRow;
  var scId = 'SC_' + String(n).padStart(3, '0');

  sheet.appendRow([
    scId,
    thoiGian,
    data.tenTru      || '',
    data.idTru       || '',
    data.lat         || '',
    data.lon         || '',
    data.tuDieuKhien || '',
    data.duong       || '',
    data.phuongXa    || '',
    data.loaiSuCo    || '',
    data.mucDo       || 'Bình thường',
    data.moTa        || '',
    data.anh         || '',
    data.nguoiBaoCao || '',
    'Chờ xử lý',
    '',
    ''
  ]);
  return jsonResponse({ status: 'ok', id: scId, updated: false });
}

function handleUpdateSuCo(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('SuCo');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet SuCo không tồn tại' });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'Không có dữ liệu' });

  var idCol        = 0; // cột A = ID
  var trangThaiCol = 14;
  var nguoiXuLyCol = 15;
  var ghiChuCol    = 16;

  var allData = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  for (var i = 0; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var rowNum = i + 2;
      if (data.trangThai   !== undefined) sheet.getRange(rowNum, trangThaiCol + 1).setValue(data.trangThai);
      if (data.nguoiXuLy   !== undefined) sheet.getRange(rowNum, nguoiXuLyCol + 1).setValue(data.nguoiXuLy);
      if (data.ghiChuXuLy  !== undefined) sheet.getRange(rowNum, ghiChuCol + 1).setValue(data.ghiChuXuLy);
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Không tìm thấy sự cố ID: ' + data.id });
}

// ── IMPORT MÃ PE TỪ FILE PHÂN CẤP BC-BB-TVT ────────────────────────────────
// Chạy 1 lần: Apps Script Editor → chọn importMaPE → ▶ Run
// Source: sheet "Tổng" — Phân cấp BC-BB-TVT (update 22.6.2026).xlsx
// Match:  Mã QR tủ điều khiển (col 3) ↔ cột Tủ điều khiển (Sheet)
//         → điền Mã PE (col 7) vào cột Mã PE
//
function importMaPE() {
  // QR code tủ → Mã PE (đọc từ sheet "Tổng", 241 tủ, loại bỏ "Không tìm thấy mã")
  var PE_MAP = {"100651000":"PB04090037431","100887000":"PB.92238","100888000":"PB.95519","100937000":"PB.99685","100938000":"PB.94765","100939000":"PB.04010094672","100941000":"PB.04010095585","100944000":"PB.04010021634","100946000":"PB04090037423","100948000":"PE19000001517","100949000":"PB04090037428","100950000":"PB04090037430","100953000":"PB04090012785","100954000":"PB04090029034","100955000":"PB04090016715","100956000":"PB04090024881","100957000":"PB04090024898","100958000":"PB04090023115","100959000":"PB04090029040","100960000":"PB04090034462","101121000":"PB04090023085","101122000":"PB04090023074","101123000":"PB04090023084","101124000":"PB04090024994","101129900":"PB04090010501","101144000":"PB04090034474","101145000":"PB04090032538","101147000":"PB04090032536","101148000":"PB04090032541","101149000":"PB04090032540","101150000":"PB04090032539","101151000":"PB04090024991","101153000":"PB04090029010","101154000":"PB04090024992","101156000":"PB04090029014","101157000":"PE19000004487","101170000":"PB04090024873","101173000":"PB04090027228","101176000":"PB04090024996","101179000":"PB04090034563","101182000":"PB04090029019","101185000":"PB04090029011","101206000":"PB04090034475","101240000":"PB04090027231","101241000":"PB04090027230","101242000":"PB04090027232","101243000":"PB04090029021","101244000":"PB04090027235","101245000":"PB04090029020","101246000":"PB04090024995","101247000":"PB04090024993","101248000":"PB04090032542","101249000":"PB04090032530","101250000":"PB04090027238","101251000":"PB04090032535","101252000":"PB04090034564","101253000":"PB04090027241","101254000":"PB.27244","101267000":"PB04090029023","101268000":"PB04090029022","101269000":"PB04090025376","101273000":"PB04040086057","101274000":"PB04090032512","101275000":"PB04090029018","101276000":"PB04090032511","101279000":"PB.04040069605","101280000":"PB04090032505","101281000":"PB04090029017","101283000":"PB.04010011349","101284000":"PB04090029016","101285000":"PB.04010032508","101288000":"PB04090010364","101290000":"PB04090025371","101291000":"PB04090025374","101292000":"PB04090025373","101293000":"PB04090025372","101294000":"PB04090027246","101295000":"PB04090027245","101298000":"PE19000004495","101300000":"PB04090029012","101302000":"PE19000004486","101304000":"PB04090038137","101313000":"PB04090023077","101315000":"PB04090027442","101316000":"PB04090024990","101317000":"PE19000004465","101696000":"PB04090027445","101697000":"PB04090029247","101698000":"PB04090029248","101699000":"PB04090024871","101701000":"PB04090027444","101702000":"PB04090023076","101704000":"PB04090029029","101705000":"PB04090029030","101711000":"PB04090032450","101712000":"PB04090026172","101714000":"PB04090024792","101716000":"PB04090024998","101717000":"PB04090032446","101719000":"PB04090032445","101731000":"PB04090028725","101732000":"PB04090028734","101736000":"PB04090029027","101738000":"PB04090032451","101739000":"PB04090022910","101740000":"PB04090022911","101741000":"PB04090024999","101742000":"PB04090032444","101743000":"PB04090028730","101744000":"PB04090032447","101745000":"PB04090032448","101746000":"PB04090028736","101747000":"PB04090028735","101748000":"PB04090032449","101749000":"PB04090028732","101750000":"PB04090028731","101751000":"PB04090030089","101752000":"PB04090032443","101753000":"PB04090032442","101754000":"PB04090028721","101755000":"PB04090028733","101756000":"PB04090032441","101791000":"PB04090028737","102001000":"PB04090007061","102053000":"PE19000001520","102056000":"PB04090029037","102057000":"PB04090027206","102058000":"PB04090027208","102059000":"PB04090027211","102060000":"PB04090037429","102061000":"PE19000001516","102062000":"PE19000001524","102063000":"PB04090029039","102064000":"PB04090032549","102065000":"PB04090032547","102066000":"PB04090032548","102067000":"PB04090032550","102068000":"PB04090032551","102069000":"PB04090027207","102070000":"PB04090032694","102071000":"PB04090037425","102118000":"PB04090010363","102153000":"PB.99681","102155000":"PB.80823","102156000":"PB.1249","102157000":"PB.88018","102158000":"PB.80818","102159000":"PE19000001246","102160000":"PB04040086058","102161000":"PB.81709","102162000":"PB04040080816","102163000":"PB.100870","102164000":"PB.04010080814","102167000":"PB.04010070959","102202000":"PB04090010499","102231000":"PB04090012784","102232000":"PB.04010031340","102233000":"PB04040074043","102234000":"PB04040074044","102235000":"PB.04010096804","102264000":"PB04090004498","102265000":"PB04090023071","102266000":"PB04090027247","102269000":"PB04090029246","102271000":"PB04090039556","102272000":"PB04090026172","102273000":"PB04090032438","102274000":"PB04090032437","102275000":"PB04090029026","102276000":"PB04090028729","102277000":"PB04090032453","102278000":"PB04090032452","102279000":"PB04090030087","102280000":"PB04090028722","102281000":"PB04090028728","102283000":"PB04090032440","102284000":"PB04090032439","102407000":"PB04090037424","102477000":"PB.06433","102669000":"PB04040076707","102670000":"PB04040071448","102697000":"PB04090022908","102698000":"PB04090022906","102699000":"PB04090022907","102700000":"PB04090027214","102701000":"PB04090007937","102704000":"PB04090023096","102707000":"PB04090023099","102708000":"PB04090034463","102709000":"PB04090029035","102710000":"PB04090032545","102711000":"PB04090024940","102712000":"PB04090024944","102713000":"PB04090029036","102714000":"PB04090024941","102715000":"PB04090024942","102730000":"PB.25901719","102731000":"PB.86060","102732000":"PB.007290","102734000":"PB.95518","102736000":"PB.95517","102742000":"PB.74045","102743000":"PB.97680","102744000":"PB.04010080815","102745000":"PB.04010099684","102746000":"PB.04010080819","102747000":"PB.04010092236","102749000":"PB.04010092254","102752000":"PB04090032513","103001000":"PB04090034471","103002000":"PE19000001522","103264000":"PB04090032510","103265000":"PB04090028720","103267000":"PB04090028718","103288000":"PB04090024889","103289000":"PB04090024876","103290000":"PB04090037434","103293000":"PB04090034457","103294000":"PE19000001521","103295000":"PB04090034459","103296000":"PB04090034460","103297000":"PB04090023111","103298000":"PB04090023112","103299000":"PE19000001525","103300000":"PB04090023113","103301000":"PB04090023110","103302000":"PB04090039579","103303000":"PE19000001523","103304000":"PE19000001515","103305000":"PB04090027212","103306000":"PB04090027213","103307000":"PB04090032546","103308000":"PB04090014587","103309000":"PB04090014585","103310000":"PB04090024939","109314000":"PB04090023075","100.947.00":"PB04090037426"};

  var TARGET_SHEETS = ['DanhSachTru', 'BenCat', 'BauBang', 'TruVanTho'];
  var totalUpdated = 0;
  var summary = [];

  for (var si = 0; si < TARGET_SHEETS.length; si++) {
    var sheetName = TARGET_SHEETS[si];
    var peMap = PE_MAP; // tất cả sheet dùng chung 1 map từ sheet Tổng
    var sheet;
    try { sheet = getSheet(sheetName); } catch(e) { summary.push(sheetName + ': lỗi - ' + e.message); continue; }
    if (!sheet) { summary.push(sheetName + ': không tồn tại'); continue; }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) { summary.push(sheetName + ': trống'); continue; }
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var hIdx = buildHeaderIndex(headers);
    var colTuSheet = hIdx[norm('Tủ điều khiển')];
    var colPESheet = hIdx[norm('Mã PE')];

    if (colTuSheet === undefined || colPESheet === undefined) {
      summary.push(sheetName + ': thiếu cột Tủ điều khiển hoặc Mã PE');
      continue;
    }

    var tuRange = sheet.getRange(2, colTuSheet + 1, lastRow - 1, 1).getValues();
    var peRange = sheet.getRange(2, colPESheet + 1, lastRow - 1, 1).getValues();

    var updated = 0;
    var peUpdates = peRange.map(function(r, i) {
      var tenTu = String(tuRange[i][0] || '').trim();
      var maPE  = peMap[tenTu];
      if (maPE !== undefined && maPE !== String(r[0] || '').trim()) {
        updated++;
        return [maPE];
      }
      return r;
    });

    if (updated > 0)
      sheet.getRange(2, colPESheet + 1, lastRow - 1, 1).setValues(peUpdates);

    totalUpdated += updated;
    summary.push(sheetName + ': ' + updated + '/' + (lastRow - 1) + ' hàng cập nhật');
  }

  var msg = 'Hoàn thành! ' + totalUpdated + ' hàng cập nhật Mã PE.\n\n' + summary.join('\n');
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}
