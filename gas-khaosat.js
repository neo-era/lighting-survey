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

// P22: Header sheet BaoTri (lịch bảo trì định kỳ) — 10 cột khớp client
const HEADER_BAOTRI = [
  'ID', 'Tên trụ', 'Loại bảo trì', 'Chu kỳ (tháng)',
  'Lần cuối', 'Lần tới', 'Nhân sự phụ trách',
  'Trạng thái', 'Ghi chú', 'Ảnh sau bảo trì'
];

// P23: Header sheet NhiemVu (giao nhiệm vụ) — 9 cột khớp client
const HEADER_NHIEMVU = [
  'ID', 'Người giao', 'Người nhận', 'Mô tả',
  'Khu vực', 'Deadline', 'Trạng thái',
  'Kết quả', 'Thời gian đóng'
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

// Folder ID cụ thể trên Google Drive để lưu ảnh khảo sát.
// Cách lấy: mở folder → URL /folders/<ID> → copy ID.
// ⚠ Tài khoản deploy GAS phải có quyền EDIT trên folder này.
const DRIVE_IMAGE_FOLDER_ID = '1i32dWpWSSoW61MIUD1qDJZne2FBiofOr';

function handleImageUpload(imageBase64, soTru, ext) {
  try {
    if (!imageBase64) return jsonResponse({ status: 'error', message: 'Thiếu dữ liệu ảnh (imageBase64).' });

    const ts = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', "yyyyMMdd'T'HHmmss");
    const safeName = (soTru || 'img').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const fileName = safeName + '-' + ts + '.' + (ext || 'jpg');

    // Lấy folder cố định theo ID (chính xác hơn getFoldersByName — không lỗi khi có 2 folder cùng tên)
    let folder;
    try {
      folder = DriveApp.getFolderById(DRIVE_IMAGE_FOLDER_ID);
    } catch (e) {
      return jsonResponse({
        status: 'error',
        message: 'Không mở được folder Drive (ID: ' + DRIVE_IMAGE_FOLDER_ID + '). Kiểm tra ID + quyền truy cập. ' + e.message
      });
    }

    // Giải mã base64 → Blob → tạo file
    const mimeType = (ext === 'png') ? 'image/png' : 'image/jpeg';
    const blob = Utilities.newBlob(Utilities.base64Decode(imageBase64), mimeType, fileName);
    const file = folder.createFile(blob);

    // Cho phép bất kỳ ai có link xem được (không cần đăng nhập)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // URL dùng cho thẻ <img> — googleusercontent.com/d/ hoạt động ổn định hơn drive.google.com/uc
    // (Google Drive không còn phản hồi /uc?export=view cho public images từ 2024).
    const fileId = file.getId();
    const viewUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    return jsonResponse({ status: 'ok', path: viewUrl, fileId: fileId });
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

// ══════════════════════════════════════════════════════════════════════════
// ── BẢO MẬT: Password hashing (PBKDF2-SHA256) + Rate limiting ──────────
// ══════════════════════════════════════════════════════════════════════════
// Format hash lưu trong sheet: pbkdf2sha256$50000$<salt>$<hash_base64>
// Backward compat: nếu password chưa có "$" → plaintext (auto-migrate lần login đầu)

const PASSWORD_ALGO = 'pbkdf2sha256';
// 10000 iterations = ~0.2s/hash trên GAS. Giảm từ 50000 do timeout khi migrate nhiều user.
// Format hash tự lưu iterations → mỗi user có thể khác value mà vẫn verify được.
const PBKDF_ITERATIONS = 10000;
const LOGIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;  // 5 phút
const LOGIN_ATTEMPT_MAX = 10;                    // 10 attempts / 5 phút / user

// Pepper — secret shared trong Script Properties (tùy chọn, bảo mật thêm 1 lớp)
function _getPepper() {
  return PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER') || '';
}

// Generate salt bảo mật dùng Utilities.getUuid (backed by Java SecureRandom)
function _generateSalt() {
  var uuid1 = Utilities.getUuid().replace(/-/g, '');
  var uuid2 = Utilities.getUuid().replace(/-/g, '');
  return (uuid1 + uuid2).slice(0, 16);
}

// Iterated SHA-256 (PBKDF2-like)
function _hashPassword(password, salt, iterations) {
  iterations = iterations || PBKDF_ITERATIONS;
  var pepper = _getPepper();
  var current = String(password) + pepper + String(salt);
  for (var i = 0; i < iterations; i++) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, current);
    current = Utilities.base64Encode(bytes);
  }
  return current;
}

function _encodePasswordHash(password) {
  var salt = _generateSalt();
  var hash = _hashPassword(password, salt);
  return PASSWORD_ALGO + '$' + PBKDF_ITERATIONS + '$' + salt + '$' + hash;
}

function _verifyPassword(password, storedHash) {
  if (!storedHash) return { ok: false, needsMigration: false };
  // Backward compat — nếu password chưa hash (không có "$")
  if (String(storedHash).indexOf('$') === -1) {
    var isMatch = String(password) === String(storedHash);
    return { ok: isMatch, needsMigration: isMatch };
  }
  var parts = String(storedHash).split('$');
  if (parts.length !== 4 || parts[0] !== PASSWORD_ALGO) {
    return { ok: false, needsMigration: false };
  }
  var iterations = parseInt(parts[1]) || PBKDF_ITERATIONS;
  var salt = parts[2];
  var expectedHash = parts[3];
  var computedHash = _hashPassword(password, salt, iterations);
  var ok = computedHash === expectedHash;
  // Downgrade-on-verify: nếu hash cũ dùng iterations cao (50000) → re-hash với PBKDF_ITERATIONS mới (10000)
  // → lần login kế tiếp nhanh hơn 5×
  var needsRehash = ok && iterations > PBKDF_ITERATIONS;
  return { ok: ok, needsMigration: false, needsRehash: needsRehash };
}

// Rate limiting — chống brute force login (cache in-memory, reset khi GAS cold start)
var _loginAttempts = {};
function _checkLoginRateLimit(username) {
  var key = String(username || '').toLowerCase();
  var now = Date.now();
  if (!_loginAttempts[key]) _loginAttempts[key] = [];
  // Xóa attempts cũ
  _loginAttempts[key] = _loginAttempts[key].filter(function(ts) {
    return (now - ts) < LOGIN_ATTEMPT_WINDOW_MS;
  });
  if (_loginAttempts[key].length >= LOGIN_ATTEMPT_MAX) {
    return { allowed: false, remainingSec: Math.ceil((LOGIN_ATTEMPT_WINDOW_MS - (now - _loginAttempts[key][0])) / 1000) };
  }
  return { allowed: true };
}

function _recordLoginAttempt(username) {
  var key = String(username || '').toLowerCase();
  if (!_loginAttempts[key]) _loginAttempts[key] = [];
  _loginAttempts[key].push(Date.now());
}

function _clearLoginAttempts(username) {
  var key = String(username || '').toLowerCase();
  delete _loginAttempts[key];
}

/**
 * Migrate password plaintext → PBKDF2 hash.
 * ⚡ SAFE: Có timeout guard 5 phút. Chạy lại khi bị dừng — tự động resume từ hàng chưa migrate.
 * Password đã hash tự động skip.
 *
 * Cách chạy: chọn hàm này → ▶ Run → xem log
 *   → nếu vẫn còn user chưa migrate → chạy lại lần nữa
 */
function migrateAllPasswords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) { Logger.log('❌ Sheet TaiKhoan không tồn tại'); return; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('❌ TaiKhoan trống'); return; }

  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var migrated = 0, skipped = 0, empty = 0, remaining = 0;
  var startTime = new Date().getTime();
  var TIMEOUT_MS = 5 * 60 * 1000;  // Dừng sau 5 phút để tránh GAS kill (limit 6 phút)

  Logger.log('═══ Bắt đầu migrate password ═══');
  Logger.log('Iterations: ' + PBKDF_ITERATIONS);
  Logger.log('Pepper: ' + (_getPepper() ? 'CÓ' : 'CHƯA SET'));
  Logger.log('Timeout guard: 5 phút — chạy lại lần nữa nếu còn user chưa xong');
  Logger.log('');

  for (var i = 0; i < rows.length; i++) {
    var username = String(rows[i][0] || '').trim();
    var password = String(rows[i][1] || '').trim();
    if (!username) continue;
    if (!password) { Logger.log('⏭  ' + username + ': password trống, skip'); empty++; continue; }
    if (password.indexOf('$') !== -1 && password.indexOf(PASSWORD_ALGO) === 0) {
      // Đã hash — skip (không log để đỡ dài)
      skipped++;
      continue;
    }

    // Check timeout — dừng SỚM để có thời gian flush log
    var elapsed = new Date().getTime() - startTime;
    if (elapsed > TIMEOUT_MS) {
      remaining = rows.length - i;
      Logger.log('');
      Logger.log('⏱ Dừng do gần timeout. Còn ' + remaining + ' user chưa migrate.');
      Logger.log('👉 Chạy lại migrateAllPasswords() để tiếp tục.');
      break;
    }

    var iterStart = new Date().getTime();
    var hashed = _encodePasswordHash(password);
    sheet.getRange(i + 2, 2).setValue(hashed);
    var iterMs = new Date().getTime() - iterStart;
    Logger.log('✓ ' + username + ': migrated (' + iterMs + 'ms)');
    migrated++;
  }

  Logger.log('');
  Logger.log('═══════════════════════════');
  Logger.log('Kết quả: ' + migrated + ' migrated, ' + skipped + ' skipped (đã hash), ' + empty + ' rỗng');
  if (remaining > 0) {
    Logger.log('⚠ Còn ' + remaining + ' user — CHẠY LẠI hàm này');
  } else {
    Logger.log('✅ HOÀN TẤT — tất cả user đã có hash. Test login với password cũ để verify.');
  }
}

/**
 * ⚡ RESET tất cả password về value mặc định "Lavipco@2025" với hash 10000 iterations.
 *
 * Dùng khi: user cũ đã hash với 50000 iterations → login mỗi lần chờ 50s → cần reset toàn bộ.
 *
 * ⚠ TẤT CẢ password cũ sẽ bị mất — user PHẢI login với password mặc định rồi tự đổi.
 *
 * Cách chạy: chọn hàm này → ▶ Run → xem log
 */
function resetAllPasswordsToDefault() {
  var DEFAULT_PASSWORD = 'Lavipco@2025';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) { Logger.log('❌ Sheet TaiKhoan không tồn tại'); return; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('❌ TaiKhoan trống'); return; }

  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var reset = 0, empty = 0;
  var startTime = new Date().getTime();
  var TIMEOUT_MS = 5 * 60 * 1000;

  Logger.log('═══ Reset tất cả password về mặc định ═══');
  Logger.log('Password mặc định: "' + DEFAULT_PASSWORD + '"');
  Logger.log('Iterations mới: ' + PBKDF_ITERATIONS);
  Logger.log('');

  // Hash 1 lần dùng cho tất cả (mỗi user vẫn có salt riêng nên hash cuối vẫn unique)
  for (var i = 0; i < rows.length; i++) {
    var username = String(rows[i][0] || '').trim();
    if (!username) { empty++; continue; }

    var elapsed = new Date().getTime() - startTime;
    if (elapsed > TIMEOUT_MS) {
      Logger.log('⏱ Dừng do gần timeout. Còn ' + (rows.length - i) + ' user. Chạy lại để tiếp tục.');
      break;
    }

    var hashed = _encodePasswordHash(DEFAULT_PASSWORD);
    sheet.getRange(i + 2, 2).setValue(hashed);
    Logger.log('✓ ' + username + ': reset');
    reset++;
  }

  Logger.log('');
  Logger.log('═══════════════════════════');
  Logger.log('✅ Đã reset ' + reset + ' user về password: "' + DEFAULT_PASSWORD + '"');
  Logger.log('👉 Gửi thông báo cho user login với password này rồi tự đổi qua UI.');
}

/**
 * ⚡ Rehash password từ 50000 iterations → 10000 iterations DÙNG PASSWORD ĐÃ BIẾT.
 *
 * Trick: nếu bạn nhớ password của user, có thể verify hash cũ (chậm 50s) → rehash 10000 (nhanh 200ms).
 * KHÔNG cần user tự login.
 *
 * Chỉ dùng khi admin quen thân với user và biết password của họ.
 * Cách dùng: sửa mảng KNOWN_PASSWORDS bên dưới → chạy hàm này.
 */
function rehashKnownPasswords() {
  // ⚠ EDIT array này với danh sách { username, password } bạn nhớ
  var KNOWN_PASSWORDS = [
    // { username: 'admin', password: 'Lavipco@2025' },
    // { username: 'lamvt', password: 'password_cua_lam' },
  ];

  if (KNOWN_PASSWORDS.length === 0) {
    Logger.log('❌ KNOWN_PASSWORDS trống. Edit array trong hàm này trước khi chạy.');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) { Logger.log('❌ Sheet TaiKhoan không tồn tại'); return; }
  var lastRow = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

  var ok = 0, wrongPassword = 0, notFound = 0;

  KNOWN_PASSWORDS.forEach(function(entry) {
    var idx = -1;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim().toLowerCase() === entry.username.toLowerCase()) { idx = i; break; }
    }
    if (idx === -1) { Logger.log('❌ ' + entry.username + ': không tìm thấy'); notFound++; return; }

    var storedHash = String(rows[idx][1] || '').trim();
    var v = _verifyPassword(entry.password, storedHash);
    if (!v.ok) { Logger.log('❌ ' + entry.username + ': password sai (không match hash hiện tại)'); wrongPassword++; return; }

    var newHash = _encodePasswordHash(entry.password);
    sheet.getRange(idx + 2, 2).setValue(newHash);
    Logger.log('✓ ' + entry.username + ': rehashed');
    ok++;
  });

  Logger.log('');
  Logger.log('═══════════════════════════');
  Logger.log('Kết quả: ' + ok + ' rehashed, ' + wrongPassword + ' sai password, ' + notFound + ' không tìm thấy');
}

/**
 * Đếm số user chưa được hash (dùng để check trước/sau migrate).
 */
function countUnhashedPasswords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet || sheet.getLastRow() < 2) { Logger.log('TaiKhoan trống'); return; }
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var byIters = {}, plain = 0, empty = 0, plainList = [], slowList = [];
  rows.forEach(function(r) {
    var u = String(r[0] || '').trim();
    var p = String(r[1] || '').trim();
    if (!u) return;
    if (!p) { empty++; return; }
    if (p.indexOf(PASSWORD_ALGO) === 0) {
      var parts = p.split('$');
      var iters = parseInt(parts[1]) || 0;
      byIters[iters] = (byIters[iters] || 0) + 1;
      if (iters > PBKDF_ITERATIONS) slowList.push(u + ' (' + iters + ')');
    } else { plain++; plainList.push(u); }
  });
  Logger.log('═══ Password status ═══');
  Object.keys(byIters).sort().forEach(function(k) {
    Logger.log('🔒 Hashed ' + k + ' iters: ' + byIters[k] + (parseInt(k) > PBKDF_ITERATIONS ? ' ⚠ SLOW' : ' ✓ FAST'));
  });
  Logger.log('⚠ Plaintext: ' + plain + (plainList.length ? ' (' + plainList.join(', ') + ')' : ''));
  Logger.log('❌ Trống: ' + empty);
  Logger.log('Target iterations: ' + PBKDF_ITERATIONS);
  if (slowList.length > 0) {
    Logger.log('');
    Logger.log('👉 User cần rehash (login lần đầu sẽ chậm 5-10s, sau đó nhanh):');
    slowList.forEach(function(u) { Logger.log('   - ' + u); });
    Logger.log('   HOẶC: chạy resetAllPasswordsToDefault() để reset toàn bộ nhanh.');
  }
}

/**
 * Tạo pepper mới (chỉ chạy 1 lần khi setup ban đầu).
 * ⚠ QUAN TRỌNG: Nếu đổi pepper sau khi đã có user → toàn bộ password bị invalid.
 *   Phải chạy lại migrateAllPasswords() (nhưng plaintext cũ đã mất — không thể revert).
 *
 * Cách chạy: chọn hàm này → ▶ Run 1 LẦN DUY NHẤT khi setup mới.
 */
function generateAndSavePepper() {
  var existing = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  if (existing) {
    Logger.log('⚠ PASSWORD_PEPPER đã tồn tại — KHÔNG override để tránh vô hiệu password.');
    Logger.log('  Nếu muốn reset, xóa Property "PASSWORD_PEPPER" trong Script Properties trước.');
    return;
  }
  var pepper = _generateSalt() + _generateSalt();
  PropertiesService.getScriptProperties().setProperty('PASSWORD_PEPPER', pepper);
  Logger.log('✓ PASSWORD_PEPPER đã lưu vào Script Properties');
  Logger.log('  Bước tiếp: chạy migrateAllPasswords() để hash password hiện có');
}

// ══════════════════════════════════════════════════════════════════════════
// ── QUẢN LÝ TÀI KHOẢN (admin only) ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

// Helper: verify admin credentials trong request
function _requireAdmin(data) {
  var adminAuth = data.adminAuth || {};
  var adminUser = String(adminAuth.username || '').trim();
  var adminPass = String(adminAuth.password || '');
  if (!adminUser || !adminPass) {
    return { ok: false, error: 'Thiếu adminAuth' };
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet || sheet.getLastRow() < 2) return { ok: false, error: 'TaiKhoan trống' };
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  for (var i = 0; i < rows.length; i++) {
    var dn = String(rows[i][0] || '').trim();
    var storedHash = String(rows[i][1] || '').trim();
    if (dn.toLowerCase() !== adminUser.toLowerCase()) continue;
    var v = _verifyPassword(adminPass, storedHash);
    if (!v.ok) return { ok: false, error: 'Password admin sai' };
    var role = String(rows[i][3] || '').trim().toLowerCase();
    if (role !== 'admin') return { ok: false, error: 'Cần quyền admin (hiện là ' + role + ')' };
    return { ok: true, adminUser: dn };
  }
  return { ok: false, error: 'Không tìm thấy admin user' };
}

function handleListUsers(data) {
  var auth = _requireAdmin(data);
  if (!auth.ok) return jsonResponse({ status: 'error', message: auth.error });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ status: 'ok', users: [] });

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var users = rows.map(function(r) {
    var hashStr = String(r[1] || '').trim();
    return {
      username:    String(r[0] || '').trim(),
      hasPassword: !!hashStr,
      isHashed:    hashStr.indexOf(PASSWORD_ALGO) === 0,   // true nếu đã hash
      displayName: String(r[2] || '').trim(),
      role:        String(r[3] || 'user').trim(),
      vung:        String(r[4] || '').trim()
    };
  }).filter(function(u) { return u.username; });
  return jsonResponse({ status: 'ok', count: users.length, users: users });
}

function handleCreateUser(data) {
  var auth = _requireAdmin(data);
  if (!auth.ok) return jsonResponse({ status: 'error', message: auth.error });

  var newUser = data.newUser || {};
  var username    = String(newUser.username    || '').trim();
  var password    = String(newUser.password    || '');
  var displayName = String(newUser.displayName || '').trim();
  var role        = String(newUser.role        || 'user').trim().toLowerCase();
  var vung        = String(newUser.vung        || '').trim();

  if (!username) return jsonResponse({ status: 'error', message: 'Thiếu username' });
  if (!password) return jsonResponse({ status: 'error', message: 'Thiếu password' });
  if (password.length < 6) return jsonResponse({ status: 'error', message: 'Password ≥ 6 ký tự' });
  if (!['admin','user','user1','demo'].includes(role)) {
    return jsonResponse({ status: 'error', message: 'Role không hợp lệ (admin/user/user1/demo)' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet TaiKhoan không tồn tại' });

  // Check duplicate username
  if (sheet.getLastRow() >= 2) {
    var existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).trim().toLowerCase() === username.toLowerCase()) {
        return jsonResponse({ status: 'error', message: 'Username đã tồn tại: ' + username });
      }
    }
  }

  sheet.appendRow([
    username,
    _encodePasswordHash(password),
    displayName || username,
    role,
    vung
  ]);

  // Log
  try {
    var logSheet = ss.getSheetByName('LichSu');
    if (logSheet) {
      logSheet.appendRow([
        new Date().toISOString(), auth.adminUser, 'create_user',
        username, displayName, 'role=' + role + ', vung=' + (vung || 'all')
      ]);
    }
  } catch (_) {}

  return jsonResponse({ status: 'ok', username: username });
}

function handleUpdateUser(data) {
  var auth = _requireAdmin(data);
  if (!auth.ok) return jsonResponse({ status: 'error', message: auth.error });

  var target = String(data.targetUsername || '').trim();
  if (!target) return jsonResponse({ status: 'error', message: 'Thiếu targetUsername' });

  var updates = data.updates || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet TaiKhoan không tồn tại' });

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() !== target.toLowerCase()) continue;
    var rowNum = i + 2;
    var changes = [];
    if (updates.displayName !== undefined) {
      sheet.getRange(rowNum, 3).setValue(String(updates.displayName).trim());
      changes.push('displayName');
    }
    if (updates.role !== undefined) {
      var role = String(updates.role).trim().toLowerCase();
      if (!['admin','user','user1','demo'].includes(role)) {
        return jsonResponse({ status: 'error', message: 'Role không hợp lệ' });
      }
      // Không cho phép admin tự demote chính mình (avoid lockout)
      if (target.toLowerCase() === auth.adminUser.toLowerCase() && role !== 'admin') {
        return jsonResponse({ status: 'error', message: 'Không thể tự demote chính mình' });
      }
      sheet.getRange(rowNum, 4).setValue(role);
      changes.push('role→' + role);
    }
    if (updates.vung !== undefined) {
      sheet.getRange(rowNum, 5).setValue(String(updates.vung).trim());
      changes.push('vung');
    }

    // Log
    try {
      var logSheet = ss.getSheetByName('LichSu');
      if (logSheet) {
        logSheet.appendRow([
          new Date().toISOString(), auth.adminUser, 'update_user',
          target, String(rows[i][2] || ''), changes.join(', ')
        ]);
      }
    } catch (_) {}

    return jsonResponse({ status: 'ok', changes: changes });
  }
  return jsonResponse({ status: 'error', message: 'Không tìm thấy user: ' + target });
}

function handleResetPassword(data) {
  var auth = _requireAdmin(data);
  if (!auth.ok) return jsonResponse({ status: 'error', message: auth.error });

  var target = String(data.targetUsername || '').trim();
  var newPassword = String(data.newPassword || '');
  if (!target) return jsonResponse({ status: 'error', message: 'Thiếu targetUsername' });
  if (!newPassword) return jsonResponse({ status: 'error', message: 'Thiếu newPassword' });
  if (newPassword.length < 6) return jsonResponse({ status: 'error', message: 'Password ≥ 6 ký tự' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet TaiKhoan không tồn tại' });

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() !== target.toLowerCase()) continue;
    sheet.getRange(i + 2, 2).setValue(_encodePasswordHash(newPassword));
    // Clear login attempts
    _clearLoginAttempts(target);
    // Log
    try {
      var logSheet = ss.getSheetByName('LichSu');
      if (logSheet) {
        logSheet.appendRow([
          new Date().toISOString(), auth.adminUser, 'reset_password',
          target, '', 'admin reset'
        ]);
      }
    } catch (_) {}
    return jsonResponse({ status: 'ok' });
  }
  return jsonResponse({ status: 'error', message: 'Không tìm thấy user: ' + target });
}

function handleDeleteUser(data) {
  var auth = _requireAdmin(data);
  if (!auth.ok) return jsonResponse({ status: 'error', message: auth.error });

  var target = String(data.targetUsername || '').trim();
  if (!target) return jsonResponse({ status: 'error', message: 'Thiếu targetUsername' });
  if (target.toLowerCase() === auth.adminUser.toLowerCase()) {
    return jsonResponse({ status: 'error', message: 'Không thể tự xóa chính mình' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet TaiKhoan không tồn tại' });

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() !== target.toLowerCase()) continue;
    var displayName = String(rows[i][2] || '');
    sheet.deleteRow(i + 2);
    _clearLoginAttempts(target);
    // Log
    try {
      var logSheet = ss.getSheetByName('LichSu');
      if (logSheet) {
        logSheet.appendRow([
          new Date().toISOString(), auth.adminUser, 'delete_user',
          target, displayName, 'admin xóa'
        ]);
      }
    } catch (_) {}
    return jsonResponse({ status: 'ok' });
  }
  return jsonResponse({ status: 'error', message: 'Không tìm thấy user: ' + target });
}

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

  if (newPassword && newPassword.length < 6) {
    return jsonResponse({ status: 'error', message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    var dn = String(rows[i][0] || '').trim();
    var storedHash = String(rows[i][1] || '').trim();
    if (dn.toLowerCase() !== username.toLowerCase()) continue;

    var verifyResult = _verifyPassword(currentPassword, storedHash);
    if (!verifyResult.ok) {
      return jsonResponse({ status: 'error', message: 'Mật khẩu hiện tại không đúng' });
    }

    var rowNum = i + 2;
    if (newUsername && newUsername !== dn) {
      sheet.getRange(rowNum, 1).setValue(newUsername);
    }
    if (newPassword) {
      sheet.getRange(rowNum, 2).setValue(_encodePasswordHash(newPassword));
    }
    return jsonResponse({ status: 'ok', newUsername: newUsername || dn });
  }
  return jsonResponse({ status: 'error', message: 'Không tìm thấy tài khoản' });
}

// ── ĐĂNG NHẬP ──────────────────────────────────────────────────────────────

function handleLogin(username, password) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('TaiKhoan');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet TaiKhoan chưa được tạo' });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'Sai tên đăng nhập hoặc mật khẩu' });

  // Rate limiting — chống brute force
  var rateCheck = _checkLoginRateLimit(username);
  if (!rateCheck.allowed) {
    return jsonResponse({
      status: 'error',
      message: 'Quá nhiều lần thử. Đợi ' + rateCheck.remainingSec + ' giây rồi thử lại.'
    });
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  // Cột: A=tenDangNhap, B=matKhau (hoặc hash), C=hoTen, D=vaiTro, E=vung
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dn = String(row[0] || '').trim();
    const storedHash = String(row[1] || '').trim();
    if (dn.toLowerCase() !== username.toLowerCase()) continue;

    var verifyResult = _verifyPassword(password, storedHash);
    if (!verifyResult.ok) {
      _recordLoginAttempt(username);
      break; // username đúng nhưng password sai → don't leak "user exists"
    }

    // Login thành công — clear attempts
    _clearLoginAttempts(username);

    // Auto-migrate plaintext password → hash sau login đầu tiên
    // HOẶC downgrade hash iterations cao (50000) → PBKDF_ITERATIONS mới (10000) để login nhanh hơn
    if (verifyResult.needsMigration || verifyResult.needsRehash) {
      try {
        var newHash = _encodePasswordHash(password);
        sheet.getRange(i + 2, 2).setValue(newHash);
        Logger.log(
          (verifyResult.needsMigration ? 'Auto-migrated' : 'Auto-rehashed')
          + ' password cho user: ' + dn
        );
      } catch (e) {
        Logger.log('Auto-rehash lỗi cho ' + dn + ': ' + e.message);
      }
    }

    const vungRaw = String(row[4] || '').trim();
    const vung = vungRaw ? vungRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
    return jsonResponse({
      status: 'ok',
      user: {
        username:    dn,
        displayName: String(row[2] || dn).trim(),
        role:        String(row[3] || 'user').trim(),
        vung:        vung
      }
    });
  }
  // Password sai hoặc user không tồn tại — trả về cùng message để không leak
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

    // P22: Lịch bảo trì
    if (data.action === 'create_bao_tri')   return handleCreateBaoTri(data);
    if (data.action === 'complete_bao_tri') return handleCompleteBaoTri(data);

    // P23: Nhiệm vụ
    if (data.action === 'create_nhiem_vu')        return handleCreateNhiemVu(data);
    if (data.action === 'update_nhiem_vu_status') return handleUpdateNhiemVuStatus(data);

    // P27: Email báo cáo định kỳ (test manual)
    if (data.action === 'send_monthly_report') return handleSendMonthlyReport(data);
    if (data.action === 'send_daily_report')   return handleSendDailyReport(data);
    if (data.action === 'get_daily_report')    return handleGetDailyReport(data);

    // Quản lý tài khoản (admin only)
    if (data.action === 'list_users')       return handleListUsers(data);
    if (data.action === 'create_user')      return handleCreateUser(data);
    if (data.action === 'update_user')      return handleUpdateUser(data);
    if (data.action === 'reset_password')   return handleResetPassword(data);
    if (data.action === 'delete_user')      return handleDeleteUser(data);

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
    // Nếu có ID: chỉ match theo ID (tránh ghi đè marker trùng tên nhưng khác ID)
    // Nếu không có ID (dữ liệu cũ): fallback match theo tên
    const idMatch   = searchId && rowId && rowId === searchId;
    const nameMatch = !searchId && searchNm && rowNm && rowNm === searchNm;
    if (idMatch || nameMatch) {
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
  var params = (e && e.parameter) || {};
  // P30: REST API endpoint — nếu request có api_key thì route qua handleApiCall
  if (params.api_key) return handleApiCall(params);
  ensureHeader(getSheet());
  return jsonResponse({ status: 'ok', message: 'KhaoSat GAS v3 — login + API ready' });
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

// ══════════════════════════════════════════════════════════════════════════
// ── P22: LỊCH BẢO TRÌ (sheet BaoTri) ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

function ensureHeaderBaoTri(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0 || sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER_BAOTRI);
    sheet.getRange(1, 1, 1, HEADER_BAOTRI.length)
      .setFontWeight('bold').setBackground('#dbeafe').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h); });
  HEADER_BAOTRI.forEach(function(h) {
    if (existing.indexOf(h) === -1) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(h).setFontWeight('bold').setBackground('#dbeafe');
    }
  });
}

function getBaoTriSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('BaoTri');
  if (!sheet) sheet = ss.insertSheet('BaoTri');
  ensureHeaderBaoTri(sheet);
  return sheet;
}

/**
 * Chạy 1 lần từ Apps Script Editor để khởi tạo sheet BaoTri với header.
 * Sau khi chạy: File → Share → Publish to web → chọn sheet BaoTri → CSV → Publish
 *               → copy URL → paste vào BAOTRI_CSV_URL trong index.html
 * Cách chạy: chọn hàm này → nhấn Run (▶)
 */
function initBaoTriSheet() {
  var sheet = getBaoTriSheet();
  Logger.log('✓ Sheet BaoTri đã sẵn sàng với ' + HEADER_BAOTRI.length + ' cột');
  Logger.log('  URL sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '#gid=' + sheet.getSheetId());
  Logger.log('  Bước tiếp: File → Share → Publish to web → chọn BaoTri → CSV → copy URL → paste vào BAOTRI_CSV_URL trong index.html');
}

// Cộng N tháng vào 1 ISO date (YYYY-MM-DD) → trả về YYYY-MM-DD
function _addMonthsIso(isoDate, months) {
  var d = new Date(isoDate);
  d.setMonth(d.getMonth() + parseInt(months, 10));
  var y = d.getFullYear(),
      m = String(d.getMonth() + 1).padStart(2, '0'),
      day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function handleCreateBaoTri(data) {
  try {
    var sheet = getBaoTriSheet();
    var year = new Date().getFullYear();
    // Sinh ID: BT_YYYY_NNN (auto-increment theo số hàng)
    var nextNum = String(sheet.getLastRow()).padStart(3, '0');
    var id = 'BT_' + year + '_' + nextNum;

    // Nếu lanToi client chưa gửi hoặc rỗng → tự tính từ lanCuoi + chuKy
    var lanToi = data.lanToi;
    if (!lanToi && data.lanCuoi && data.chuKy) {
      lanToi = _addMonthsIso(data.lanCuoi, data.chuKy);
    }

    sheet.appendRow([
      id,
      data.tenTru      || '',
      data.loai        || '',
      data.chuKy       || 12,
      data.lanCuoi     || '',
      lanToi           || '',
      data.phuTrach    || '',
      data.trangThai   || 'cho',
      data.ghiChu      || '',
      ''  // Ảnh sau bảo trì — chưa có khi tạo
    ]);
    return jsonResponse({ status: 'ok', id: id, lanToi: lanToi });
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'BaoTri create lỗi: ' + err.message });
  }
}

function handleCompleteBaoTri(data) {
  try {
    var sheet = getBaoTriSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonResponse({ status: 'error', message: 'Sheet BaoTri trống' });

    var idCol = 0, chuKyCol = 3, lanCuoiCol = 4, lanToiCol = 5, statusCol = 7;
    var allData = sheet.getRange(2, 1, lastRow - 1, HEADER_BAOTRI.length).getValues();

    for (var i = 0; i < allData.length; i++) {
      if (String(allData[i][idCol]) !== String(data.id)) continue;
      var rowNum = i + 2;
      var lanCuoi = data.lanCuoi || new Date().toISOString().slice(0, 10);
      var chuKy = parseInt(allData[i][chuKyCol]) || 12;
      var nextLanToi = _addMonthsIso(lanCuoi, chuKy);

      sheet.getRange(rowNum, lanCuoiCol + 1).setValue(lanCuoi);
      sheet.getRange(rowNum, lanToiCol + 1).setValue(nextLanToi);
      // Trạng thái reset về "cho" cho chu kỳ tiếp theo (KHÔNG dùng 'hoan_thanh'
      // để lịch tiếp tục xuất hiện trong list bảo trì định kỳ)
      sheet.getRange(rowNum, statusCol + 1).setValue('cho');

      // Log lịch sử (optional, nếu có nguoiHoanThanh)
      if (data.nguoiHoanThanh) {
        try {
          var ss = SpreadsheetApp.getActiveSpreadsheet();
          var logSheet = ss.getSheetByName('LichSu');
          if (logSheet) {
            logSheet.appendRow([
              data.thoiGianHoanThanh || new Date().toISOString(),
              data.nguoiHoanThanh,
              'complete_bao_tri',
              String(data.id),
              String(allData[i][1] || ''),  // Tên trụ
              'Bảo trì hoàn thành, chu kỳ tiếp: ' + nextLanToi
            ]);
          }
        } catch (_) {}
      }
      return jsonResponse({ status: 'ok', nextLanToi: nextLanToi });
    }
    return jsonResponse({ status: 'error', message: 'Không tìm thấy BaoTri ID: ' + data.id });
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'BaoTri complete lỗi: ' + err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ── P23: NHIỆM VỤ (sheet NhiemVu) ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

function ensureHeaderNhiemVu(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0 || sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER_NHIEMVU);
    sheet.getRange(1, 1, 1, HEADER_NHIEMVU.length)
      .setFontWeight('bold').setBackground('#ede9fe').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h); });
  HEADER_NHIEMVU.forEach(function(h) {
    if (existing.indexOf(h) === -1) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(h).setFontWeight('bold').setBackground('#ede9fe');
    }
  });
}

function getNhiemVuSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('NhiemVu');
  if (!sheet) sheet = ss.insertSheet('NhiemVu');
  ensureHeaderNhiemVu(sheet);
  return sheet;
}

/**
 * Chạy 1 lần từ Apps Script Editor để khởi tạo sheet NhiemVu với header.
 * Sau khi chạy: publish CSV → paste URL vào NHIEMVU_CSV_URL trong index.html
 */
function initNhiemVuSheet() {
  var sheet = getNhiemVuSheet();
  Logger.log('✓ Sheet NhiemVu đã sẵn sàng với ' + HEADER_NHIEMVU.length + ' cột');
  Logger.log('  URL sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '#gid=' + sheet.getSheetId());
  Logger.log('  Bước tiếp: File → Share → Publish to web → chọn NhiemVu → CSV → copy URL → paste vào NHIEMVU_CSV_URL trong index.html');
}

/**
 * Chạy 1 lần để khởi tạo CẢ 2 sheet BaoTri + NhiemVu + SuCo cùng lúc.
 * Sau khi chạy → publish 3 CSV URL → paste vào 3 constant trong index.html.
 */
function initAllOperationSheets() {
  Logger.log('═══ Khởi tạo sheet vận hành ═══');
  try { getBaoTriSheet(); Logger.log('✓ BaoTri (P22)'); } catch (e) { Logger.log('❌ BaoTri: ' + e.message); }
  try { getNhiemVuSheet(); Logger.log('✓ NhiemVu (P23)'); } catch (e) { Logger.log('❌ NhiemVu: ' + e.message); }
  // SuCo đã tạo tự động qua handleReportSuCo, nhưng init trước cho gọn
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sc = ss.getSheetByName('SuCo');
    if (!sc) { sc = ss.insertSheet('SuCo'); }
    ensureHeaderSuCo(sc);
    Logger.log('✓ SuCo (P21)');
  } catch (e) { Logger.log('❌ SuCo: ' + e.message); }
  Logger.log('═══════════════════════════════');
  Logger.log('Hoàn tất. Tiếp theo: publish 3 CSV → paste vào SUCO_CSV_URL / BAOTRI_CSV_URL / NHIEMVU_CSV_URL trong index.html');
}

// Validate status transition: from → to (chỉ cho phép các bước hợp lệ)
function _validateNvTransition(fromStatus, toStatus) {
  var allowed = {
    'draft':       ['assigned'],
    'assigned':    ['in_progress'],
    'in_progress': ['submitted'],
    'submitted':   ['approved', 'rejected'],
    'approved':    ['closed'],
    'rejected':    ['submitted', 'closed'],  // Cho phép nộp lại HOẶC đóng
    'closed':      []
  };
  var validTargets = allowed[fromStatus] || [];
  return validTargets.indexOf(toStatus) !== -1;
}

function handleCreateNhiemVu(data) {
  try {
    var sheet = getNhiemVuSheet();
    var year = new Date().getFullYear();
    var nextNum = String(sheet.getLastRow()).padStart(3, '0');
    var id = 'NV_' + year + '_' + nextNum;

    sheet.appendRow([
      id,
      data.nguoiGiao   || '',
      data.nguoiNhan   || '',
      data.moTa        || '',
      data.khuVuc      || '',
      data.deadline    || '',
      data.status      || 'assigned',
      '',   // Kết quả — chưa có khi tạo
      ''    // Thời gian đóng
    ]);

    // Log
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var logSheet = ss.getSheetByName('LichSu');
      if (logSheet) {
        logSheet.appendRow([
          data.thoiGianTao || new Date().toISOString(),
          data.nguoiGiao || '',
          'create_nhiem_vu',
          id,
          data.nguoiNhan || '',
          'Giao cho: ' + (data.nguoiNhan || '') + ' · Deadline: ' + (data.deadline || '')
        ]);
      }
    } catch (_) {}

    return jsonResponse({ status: 'ok', id: id });
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'NhiemVu create lỗi: ' + err.message });
  }
}

function handleUpdateNhiemVuStatus(data) {
  try {
    var sheet = getNhiemVuSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonResponse({ status: 'error', message: 'Sheet NhiemVu trống' });

    var idCol = 0, statusCol = 6, ketQuaCol = 7, closeTimeCol = 8;
    var allData = sheet.getRange(2, 1, lastRow - 1, HEADER_NHIEMVU.length).getValues();

    for (var i = 0; i < allData.length; i++) {
      if (String(allData[i][idCol]) !== String(data.id)) continue;
      var rowNum = i + 2;
      var currentStatus = String(allData[i][statusCol] || '').trim();
      var newStatus = String(data.newStatus || '').trim();

      // Validate transition (bảo mật server-side — client không được bypass)
      if (!_validateNvTransition(currentStatus, newStatus)) {
        return jsonResponse({
          status: 'error',
          message: 'Không thể chuyển từ "' + currentStatus + '" sang "' + newStatus + '"'
        });
      }

      // Update status
      sheet.getRange(rowNum, statusCol + 1).setValue(newStatus);

      // Update kết quả nếu client gửi (khi user submit hoặc admin duyệt/từ chối)
      if (data.ketQua !== undefined && data.ketQua !== '') {
        sheet.getRange(rowNum, ketQuaCol + 1).setValue(data.ketQua);
      }
      // Ghi chú duyệt (nếu có) — append vào kết quả với dấu ngăn cách
      if (data.ghiChuDuyet !== undefined && data.ghiChuDuyet !== '') {
        var currentKQ = String(allData[i][ketQuaCol] || '');
        var newKQ = currentKQ +
          (currentKQ ? '\n' : '') +
          '[' + newStatus + ' by ' + (data.nguoiDuyet || '?') + '] ' + data.ghiChuDuyet;
        sheet.getRange(rowNum, ketQuaCol + 1).setValue(newKQ);
      }
      // Thời gian đóng — chỉ set khi status = closed
      if (newStatus === 'closed') {
        sheet.getRange(rowNum, closeTimeCol + 1).setValue(data.thoiGian || new Date().toISOString());
      }

      // Log
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var logSheet = ss.getSheetByName('LichSu');
        if (logSheet) {
          logSheet.appendRow([
            data.thoiGian || new Date().toISOString(),
            data.nguoiDuyet || allData[i][2] || '',
            'update_nhiem_vu',
            String(data.id),
            String(allData[i][2] || ''),  // Người nhận
            currentStatus + ' → ' + newStatus
          ]);
        }
      } catch (_) {}

      return jsonResponse({ status: 'ok', newStatus: newStatus });
    }
    return jsonResponse({ status: 'error', message: 'Không tìm thấy NhiemVu ID: ' + data.id });
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'NhiemVu update lỗi: ' + err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ── P27: EMAIL REPORT ĐỊNH KỲ (cron mỗi tháng) ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════

const HEADER_SETTING = ['Key', 'Value', 'Ghi chú'];

const DEFAULT_SETTINGS = {
  'email_recipients':  { value: 'admin@example.com,truongphong@example.com', note: 'Email nhận báo cáo (cách nhau bằng dấu phẩy)' },
  'email_enabled':     { value: 'true',                                       note: 'true = bật gửi tự động, false = tắt' },
  'daily_report_enabled': { value: 'true',  note: 'true = bật báo cáo ngày tự động, false = tắt' },
  'daily_report_hour':    { value: '18',    note: 'Giờ gửi báo cáo ngày (0-23, múi giờ Asia/Ho_Chi_Minh)' },
  'donvi_name':        { value: 'Huyện Cần Giuộc',                            note: 'Tên đơn vị hành chính' },
  'phong_name':        { value: 'Phòng Kinh tế và Hạ tầng',                  note: 'Tên phòng ban' },
  'nguoi_ky':          { value: 'Nguyễn Văn A',                              note: 'Tên người ký duyệt' },
  'chuc_vu':           { value: 'Trưởng phòng',                              note: 'Chức vụ người ký' }
};

function initSettingSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Setting');
  if (!sheet) {
    sheet = ss.insertSheet('Setting');
    sheet.appendRow(HEADER_SETTING);
    sheet.getRange(1, 1, 1, HEADER_SETTING.length)
      .setFontWeight('bold').setBackground('#fbbf24').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  // Bổ sung default nếu key chưa có
  var lastRow = sheet.getLastRow();
  var existing = new Set();
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    data.forEach(function(r) { if (r[0]) existing.add(String(r[0]).trim()); });
  }
  Object.keys(DEFAULT_SETTINGS).forEach(function(key) {
    if (!existing.has(key)) {
      var cfg = DEFAULT_SETTINGS[key];
      sheet.appendRow([key, cfg.value, cfg.note]);
    }
  });
  sheet.autoResizeColumns(1, 3);
  return sheet;
}

function getSetting(key) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Setting');
  if (!sheet || sheet.getLastRow() < 2) {
    var def = DEFAULT_SETTINGS[key];
    return def ? def.value : '';
  }
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) return String(data[i][1] || '').trim();
  }
  var d = DEFAULT_SETTINGS[key];
  return d ? d.value : '';
}

// Aggregate data từ tất cả sheet cho báo cáo tháng
function _aggregateMonthlyReport(from, to) {
  var fromDate = new Date(from);
  var toDate = new Date(to);
  toDate.setHours(23, 59, 59);

  var districts = ['DanhSachTru', 'Quan1', 'Quan3', 'Quan5', 'Quan8', 'Quan10', 'Quan11',
                    'PhuNhuan', 'BinhThanh', 'TanBinh', 'TanPhu',
                    'BauBang', 'TruVanTho', 'BenCat', 'CanGiuoc'];

  var totalMarkers = 0, totalWithImage = 0;
  var byDistrict = [];
  var byType = {};

  districts.forEach(function(d) {
    try {
      var sheet = getSheet(d);
      if (!sheet || sheet.getLastRow() < 2) return;
      var lastCol = Math.min(sheet.getLastColumn(), 22);
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
      var districtCount = 0, districtWithImage = 0;
      data.forEach(function(r) {
        if (!r[1]) return;
        totalMarkers++; districtCount++;
        if (r[12] && String(r[12]).trim()) { totalWithImage++; districtWithImage++; }
        var type = parseInt(r[6]) || 0;
        byType[type] = (byType[type] || 0) + 1;
      });
      if (districtCount > 0) byDistrict.push({
        name: d, count: districtCount, withImage: districtWithImage
      });
    } catch (_) {}
  });

  // SuCo trong kỳ (Thời gian phát sinh trong from-to)
  var suCoInMonth = [];
  try {
    var suCoSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SuCo');
    if (suCoSheet && suCoSheet.getLastRow() >= 2) {
      var suCoData = suCoSheet.getRange(2, 1, suCoSheet.getLastRow() - 1, 17).getValues();
      suCoData.forEach(function(r) {
        var tg = new Date(r[1]);
        if (isNaN(tg.getTime())) return;
        if (tg < fromDate || tg > toDate) return;
        suCoInMonth.push({
          id: r[0], time: String(r[1]).slice(0, 16).replace('T', ' '),
          tenTru: r[2], loai: r[9], mucDo: r[10], trangThai: r[14]
        });
      });
    }
  } catch (_) {}

  // BaoTri hoàn thành trong kỳ (Lần cuối trong from-to)
  var baoTriInMonth = [];
  try {
    var btSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BaoTri');
    if (btSheet && btSheet.getLastRow() >= 2) {
      var btData = btSheet.getRange(2, 1, btSheet.getLastRow() - 1, 10).getValues();
      btData.forEach(function(r) {
        var lc = new Date(r[4]);
        if (isNaN(lc.getTime())) return;
        if (lc < fromDate || lc > toDate) return;
        baoTriInMonth.push({
          id: r[0], tenTru: r[1], loai: r[2],
          chuKy: r[3], lanCuoi: r[4], phuTrach: r[6]
        });
      });
    }
  } catch (_) {}

  // NhiemVu closed/approved trong kỳ
  var nhiemVuInMonth = [];
  try {
    var nvSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NhiemVu');
    if (nvSheet && nvSheet.getLastRow() >= 2) {
      var nvData = nvSheet.getRange(2, 1, nvSheet.getLastRow() - 1, 9).getValues();
      nvData.forEach(function(r) {
        var status = String(r[6] || '');
        if (status !== 'closed' && status !== 'approved') return;
        var closeTime = r[8] ? new Date(r[8]) : null;
        if (!closeTime || isNaN(closeTime.getTime())) return;
        if (closeTime < fromDate || closeTime > toDate) return;
        nhiemVuInMonth.push({
          id: r[0], nguoiNhan: r[2], moTa: r[3], status: status
        });
      });
    }
  } catch (_) {}

  return {
    totalMarkers: totalMarkers,
    totalWithImage: totalWithImage,
    byDistrict: byDistrict,
    byType: byType,
    suCo: suCoInMonth,
    baoTri: baoTriInMonth,
    nhiemVu: nhiemVuInMonth
  };
}

// Build HTML email body
function _buildReportHtmlEmail(report, from, to, monthLabel) {
  var donVi = getSetting('donvi_name');
  var phong = getSetting('phong_name');
  var nguoi = getSetting('nguoi_ky');
  var chucVu = getSetting('chuc_vu');
  var coveragePct = report.totalMarkers > 0
    ? ((report.totalWithImage / report.totalMarkers) * 100).toFixed(1) : '0';

  var html = '<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1e293b;">';
  html += '<div style="text-align:center;margin-bottom:8px;font-weight:bold;font-size:13px;">' + donVi.toUpperCase() + '</div>';
  html += '<div style="text-align:center;margin-bottom:20px;font-weight:bold;font-size:13px;">' + phong.toUpperCase() + '</div>';
  html += '<h2 style="text-align:center;color:#1e40af;margin:0;">BÁO CÁO CHIẾU SÁNG CÔNG CỘNG</h2>';
  html += '<div style="text-align:center;font-style:italic;color:#64748b;margin:6px 0 24px;">Kỳ báo cáo: ' + from + ' → ' + to + '</div>';

  // 4 tile số
  html += '<table width="100%" cellpadding="0" cellspacing="8" style="border-collapse:separate;margin-bottom:20px;"><tr>';
  html += _htmlTile('💡', report.totalMarkers, 'Tổng trụ / tủ', '#2563eb');
  html += _htmlTile('📷', report.totalWithImage, 'Có ảnh (' + coveragePct + '%)', '#10b981');
  html += _htmlTile('⚠️', report.suCo.length, 'Sự cố phát sinh', '#dc2626');
  html += _htmlTile('🔧', report.baoTri.length, 'Bảo trì thực hiện', '#f59e0b');
  html += '</tr></table>';

  // Bảng theo địa bàn
  html += '<h3 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:4px;">1. Số lượng theo địa bàn</h3>';
  html += '<table width="100%" style="border-collapse:collapse;font-size:13px;"><thead><tr style="background:#e0e7ff;">';
  ['Địa bàn', 'Số trụ/tủ', 'Có ảnh', 'Tỷ lệ'].forEach(function(h) {
    html += '<th style="border:1px solid #94a3b8;padding:6px;">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';
  report.byDistrict.forEach(function(d) {
    var pct = d.count > 0 ? ((d.withImage / d.count) * 100).toFixed(1) : '0';
    html += '<tr>';
    html += '<td style="border:1px solid #cbd5e1;padding:5px;"><b>' + d.name + '</b></td>';
    html += '<td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">' + d.count + '</td>';
    html += '<td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">' + d.withImage + '</td>';
    html += '<td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">' + pct + '%</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';

  // Sự cố
  if (report.suCo.length > 0) {
    html += '<h3 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:4px;">2. Sự cố phát sinh trong kỳ (' + report.suCo.length + ')</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#fee2e2;">';
    ['ID', 'Thời gian', 'Tên trụ', 'Loại', 'Mức độ', 'Trạng thái'].forEach(function(h) {
      html += '<th style="border:1px solid #94a3b8;padding:4px;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    report.suCo.slice(0, 50).forEach(function(sc) {
      html += '<tr>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;font-family:monospace;font-size:10px;">' + sc.id + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;font-size:11px;">' + sc.time + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;"><b>' + sc.tenTru + '</b></td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;">' + sc.loai + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;">' + (sc.mucDo === 'Khẩn cấp' ? '<b style="color:#dc2626">⚡ Khẩn cấp</b>' : sc.mucDo) + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;">' + sc.trangThai + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (report.suCo.length > 50) html += '<div style="font-style:italic;font-size:11px;color:#64748b;margin-top:4px;">... và ' + (report.suCo.length - 50) + ' sự cố nữa (xem chi tiết trong app)</div>';
  }

  // Bảo trì
  if (report.baoTri.length > 0) {
    html += '<h3 style="color:#f59e0b;border-bottom:2px solid #f59e0b;padding-bottom:4px;">3. Bảo trì thực hiện trong kỳ (' + report.baoTri.length + ')</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#fef3c7;">';
    ['ID', 'Tên trụ', 'Loại BT', 'Chu kỳ', 'Ngày TH', 'Nhân sự'].forEach(function(h) {
      html += '<th style="border:1px solid #94a3b8;padding:4px;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    report.baoTri.slice(0, 50).forEach(function(bt) {
      html += '<tr>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;font-family:monospace;font-size:10px;">' + bt.id + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;"><b>' + bt.tenTru + '</b></td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;">' + bt.loai + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;text-align:center;">' + bt.chuKy + 't</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;font-family:monospace;font-size:11px;">' + bt.lanCuoi + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;">' + bt.phuTrach + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  // Nhiệm vụ
  if (report.nhiemVu.length > 0) {
    html += '<h3 style="color:#8b5cf6;border-bottom:2px solid #8b5cf6;padding-bottom:4px;">4. Nhiệm vụ hoàn thành trong kỳ (' + report.nhiemVu.length + ')</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#ede9fe;">';
    ['ID', 'Người nhận', 'Mô tả', 'Trạng thái'].forEach(function(h) {
      html += '<th style="border:1px solid #94a3b8;padding:4px;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    report.nhiemVu.slice(0, 30).forEach(function(nv) {
      html += '<tr>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;font-family:monospace;font-size:10px;">' + nv.id + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;"><b>' + nv.nguoiNhan + '</b></td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;">' + String(nv.moTa).slice(0, 100) + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:3px;">' + (nv.status === 'approved' ? '✅ Duyệt' : '🔒 Đóng') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  // Ký duyệt
  html += '<div style="margin-top:40px;text-align:right;">';
  html += '<div style="font-style:italic;">' + donVi + ', ngày ' + to.slice(8, 10) + ' tháng ' + to.slice(5, 7) + ' năm ' + to.slice(0, 4) + '</div>';
  html += '<div style="font-weight:bold;margin-top:12px;">' + chucVu.toUpperCase() + '</div>';
  html += '<div style="font-style:italic;font-size:11px;">(Ký, ghi rõ họ tên, đóng dấu)</div>';
  html += '<div style="height:60px;"></div>';
  html += '<div style="font-weight:bold;font-size:13px;">' + nguoi + '</div>';
  html += '</div>';

  html += '<div style="text-align:center;margin-top:30px;padding:10px;background:#f1f5f9;border-radius:6px;font-size:11px;color:#94a3b8;">📧 Báo cáo tự động tạo bởi <b>Lighting Survey</b> — Không cần trả lời email này</div>';
  html += '</div>';
  return html;
}

function _htmlTile(icon, value, label, color) {
  return '<td style="padding:14px;border-left:4px solid ' + color + ';background:#f8fafc;border-radius:6px;text-align:center;width:25%;vertical-align:middle;">'
    + '<div style="font-size:28px;">' + icon + '</div>'
    + '<div style="font-size:26px;font-weight:900;color:' + color + ';font-family:monospace;line-height:1;margin-top:4px;">' + value + '</div>'
    + '<div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:600;">' + label + '</div>'
    + '</td>';
}

/**
 * Main entry — gọi từ cron trigger 6am ngày 1 hàng tháng.
 * Có thể chạy tay để test.
 */
function sendMonthlyReport() {
  try {
    initSettingSheet();
    var enabled = getSetting('email_enabled').toLowerCase();
    if (enabled !== 'true' && enabled !== '1') {
      Logger.log('❌ Email disabled trong Setting (email_enabled = ' + enabled + ')');
      return { status: 'skipped', reason: 'disabled' };
    }
    var recipients = getSetting('email_recipients');
    if (!recipients) {
      Logger.log('❌ Không có email_recipients trong Setting');
      return { status: 'error', reason: 'no_recipients' };
    }

    // Kỳ báo cáo = tháng trước
    var now = new Date();
    var lastMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var lastMonthLast = new Date(now.getFullYear(), now.getMonth(), 0);
    var from = Utilities.formatDate(lastMonthFirst, 'GMT+7', 'yyyy-MM-dd');
    var to = Utilities.formatDate(lastMonthLast, 'GMT+7', 'yyyy-MM-dd');
    var monthLabel = Utilities.formatDate(lastMonthFirst, 'GMT+7', 'MM/yyyy');

    Logger.log('Aggregating data từ ' + from + ' đến ' + to);
    var report = _aggregateMonthlyReport(from, to);

    var html = _buildReportHtmlEmail(report, from, to, monthLabel);
    var subject = 'Báo cáo chiếu sáng tháng ' + monthLabel + ' — ' + getSetting('donvi_name');

    GmailApp.sendEmail(
      recipients,
      subject,
      'Vui lòng bật HTML email để xem báo cáo đầy đủ.\n\nTóm tắt:\n' +
        '- Tổng trụ/tủ: ' + report.totalMarkers + '\n' +
        '- Sự cố phát sinh: ' + report.suCo.length + '\n' +
        '- Bảo trì thực hiện: ' + report.baoTri.length + '\n' +
        '- Nhiệm vụ hoàn thành: ' + report.nhiemVu.length,
      {
        htmlBody: html,
        name: getSetting('phong_name')
      }
    );

    Logger.log('✓ Đã gửi báo cáo tháng ' + monthLabel + ' đến: ' + recipients);
    return { status: 'ok', recipients: recipients, monthLabel: monthLabel };
  } catch (err) {
    Logger.log('❌ Lỗi gửi báo cáo: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

/**
 * Test ngay — không đợi ngày 1. Chạy tay từ Editor.
 */
function sendMonthlyReportNow() {
  var result = sendMonthlyReport();
  Logger.log('Kết quả: ' + JSON.stringify(result));
  return result;
}

/**
 * Setup cron trigger 6am ngày 1 hàng tháng.
 * Chạy 1 lần từ Editor — sau đó GAS tự chạy hàng tháng.
 */
function setupMonthlyReportTrigger() {
  // Xóa trigger cũ (nếu có) để tránh duplicate
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'sendMonthlyReport') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  // Tạo trigger mới
  ScriptApp.newTrigger('sendMonthlyReport')
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .create();
  Logger.log('✓ Trigger đã setup — sendMonthlyReport chạy 6:00 sáng ngày 1 hàng tháng');
  if (removed > 0) Logger.log('  (đã xóa ' + removed + ' trigger cũ)');
  Logger.log('  Danh sách trigger hiện tại:');
  ScriptApp.getProjectTriggers().forEach(function(t, i) {
    Logger.log('  ' + (i + 1) + '. ' + t.getHandlerFunction() + ' — ' + t.getEventType());
  });
}

/**
 * Xóa trigger email report (nếu muốn tắt hoàn toàn).
 */
function removeMonthlyReportTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'sendMonthlyReport') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log('✓ Đã xóa ' + removed + ' trigger sendMonthlyReport');
}

// Handler cho client call test email
function handleSendMonthlyReport(data) {
  var result = sendMonthlyReport();
  return jsonResponse(result);
}

// ══════════════════════════════════════════════════════════════════════════
// ── P30: REST API cho hệ thống bên ngoài ────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

const HEADER_APIKEYS = ['API Key', 'Tên client', 'Permissions', 'Trạng thái', 'Rate limit (req/phút)', 'Tạo lúc'];

function initApiKeysSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ApiKeys');
  if (!sheet) {
    sheet = ss.insertSheet('ApiKeys');
    sheet.appendRow(HEADER_APIKEYS);
    sheet.getRange(1, 1, 1, HEADER_APIKEYS.length)
      .setFontWeight('bold').setBackground('#f97316').setFontColor('#fff').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    // Insert sample row (deactivated by default)
    var sampleKey = 'ls_' + Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    sheet.appendRow([sampleKey, 'sample_client', 'read', 'inactive', 60, new Date().toISOString()]);
  }
  return sheet;
}

// Rotate 1 API key mới cho client
function generateApiKey(clientName, permissions, rateLimit) {
  var sheet = initApiKeysSheet();
  var key = 'ls_' + Utilities.getUuid().replace(/-/g, '').slice(0, 24);
  sheet.appendRow([
    key, clientName || 'anonymous',
    permissions || 'read',
    'active', rateLimit || 60,
    new Date().toISOString()
  ]);
  Logger.log('✓ Đã tạo API key: ' + key + ' cho client: ' + clientName);
  return key;
}

// Validate API key + return { permissions, client, rateLimit } hoặc null
function _checkApiKey(key) {
  if (!key) return null;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ApiKeys');
  if (!sheet || sheet.getLastRow() < 2) return null;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADER_APIKEYS.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key.trim() && String(data[i][3]).trim() === 'active') {
      return {
        key: data[i][0], client: data[i][1],
        permissions: String(data[i][2] || '').split(',').map(function(p){ return p.trim(); }),
        rateLimit: parseInt(data[i][4]) || 60
      };
    }
  }
  return null;
}

// Simple rate limiting với cache 60s
var _rateCache = {};
function _checkRateLimit(apiKey, limit) {
  var now = Date.now();
  var window = 60000; // 1 phút
  if (!_rateCache[apiKey]) _rateCache[apiKey] = [];
  // Xóa timestamps cũ
  _rateCache[apiKey] = _rateCache[apiKey].filter(function(ts) { return (now - ts) < window; });
  if (_rateCache[apiKey].length >= limit) return false;
  _rateCache[apiKey].push(now);
  return true;
}

// Main API handler — gọi từ doGet(?api_key=...&action=...)
function handleApiCall(params) {
  var apiKey = params.api_key;
  var apiAction = String(params.api_action || '').trim();
  if (!apiKey) return jsonResponse({ error: 'Missing api_key' }, 401);
  var auth = _checkApiKey(apiKey);
  if (!auth) return jsonResponse({ error: 'Invalid or inactive API key' }, 401);
  if (!_checkRateLimit(apiKey, auth.rateLimit)) {
    return jsonResponse({ error: 'Rate limit exceeded (' + auth.rateLimit + ' req/min)' }, 429);
  }

  try {
    switch (apiAction) {
      case 'list_markers': {
        if (!auth.permissions.includes('read') && !auth.permissions.includes('*')) {
          return jsonResponse({ error: 'Permission denied: needs read' }, 403);
        }
        var district = String(params.district || 'DanhSachTru').trim();
        var limit = Math.min(parseInt(params.limit) || 100, 500);
        var sheet = getSheet(district);
        if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ status: 'ok', count: 0, markers: [] });
        var data = sheet.getRange(2, 1, Math.min(sheet.getLastRow() - 1, limit), 22).getValues();
        var markers = data.map(function(r) {
          return {
            id: r[0], tenTru: r[1], lat: r[2], lon: r[3],
            loai: r[6], tuDieuKhien: r[7],
            loaiDen: r[10], congSuat: r[11],
            duong: r[17], phuongXa: r[18]
          };
        }).filter(function(m) { return m.tenTru; });
        return jsonResponse({ status: 'ok', district: district, count: markers.length, markers: markers });
      }

      case 'get_marker': {
        if (!auth.permissions.includes('read') && !auth.permissions.includes('*')) {
          return jsonResponse({ error: 'Permission denied' }, 403);
        }
        var district2 = String(params.district || 'DanhSachTru').trim();
        var mid = String(params.id || params.tenTru || '').trim();
        if (!mid) return jsonResponse({ error: 'Missing id or tenTru' }, 400);
        var sheet2 = getSheet(district2);
        if (!sheet2 || sheet2.getLastRow() < 2) return jsonResponse({ status: 'ok', marker: null });
        var data2 = sheet2.getRange(2, 1, sheet2.getLastRow() - 1, 22).getValues();
        for (var i = 0; i < data2.length; i++) {
          if (String(data2[i][0]) === mid || String(data2[i][1]) === mid) {
            var r = data2[i];
            return jsonResponse({ status: 'ok', marker: {
              id: r[0], tenTru: r[1], lat: r[2], lon: r[3], loai: r[6],
              tuDieuKhien: r[7], loaiTru: r[8], loaiCan: r[9], loaiDen: r[10],
              congSuat: r[11], hinhAnh: r[12], capNhat: r[13],
              maPE: r[16], duong: r[17], phuongXa: r[18]
            } });
          }
        }
        return jsonResponse({ status: 'ok', marker: null });
      }

      case 'list_su_co': {
        if (!auth.permissions.includes('read') && !auth.permissions.includes('*')) {
          return jsonResponse({ error: 'Permission denied' }, 403);
        }
        var statusFilter = String(params.status || '').trim();
        var scSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SuCo');
        if (!scSheet || scSheet.getLastRow() < 2) return jsonResponse({ status: 'ok', count: 0, incidents: [] });
        var scData = scSheet.getRange(2, 1, scSheet.getLastRow() - 1, 17).getValues();
        var incidents = scData.map(function(r) {
          return { id: r[0], thoiGian: r[1], tenTru: r[2], loai: r[9], mucDo: r[10], trangThai: r[14] };
        }).filter(function(sc) { return !statusFilter || sc.trangThai === statusFilter; });
        return jsonResponse({ status: 'ok', count: incidents.length, incidents: incidents });
      }

      case 'stats': {
        if (!auth.permissions.includes('read') && !auth.permissions.includes('*')) {
          return jsonResponse({ error: 'Permission denied' }, 403);
        }
        var districts = ['DanhSachTru', 'Quan1', 'Quan3', 'Quan5', 'Quan8', 'Quan10', 'Quan11',
                          'PhuNhuan', 'BinhThanh', 'TanBinh', 'TanPhu',
                          'BauBang', 'TruVanTho', 'BenCat', 'CanGiuoc'];
        var totalStats = { totalMarkers: 0, byDistrict: {} };
        districts.forEach(function(d) {
          try {
            var s = getSheet(d);
            if (s && s.getLastRow() > 1) {
              var cnt = s.getLastRow() - 1;
              totalStats.totalMarkers += cnt;
              totalStats.byDistrict[d] = cnt;
            }
          } catch (_) {}
        });
        return jsonResponse({ status: 'ok', stats: totalStats });
      }

      default:
        return jsonResponse({ error: 'Unknown api_action: ' + apiAction + '. Available: list_markers, get_marker, list_su_co, stats' }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: 'API error: ' + err.message }, 500);
  }
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

// ══════════════════════════════════════════════════════════════════════════
// ── BÁO CÁO KHẢO SÁT HÀNG NGÀY ──────────────────────────────────────────
// Tổng hợp tất cả marker được thêm/sửa trong ngày, gửi email lúc 18:00.
// ══════════════════════════════════════════════════════════════════════════

var ALL_DISTRICT_SHEETS = [
  'DanhSachTru', 'Quan1', 'Quan3', 'Quan5', 'Quan8', 'Quan10', 'Quan11',
  'PhuNhuan', 'BinhThanh', 'TanBinh', 'TanPhu',
  'BauBang', 'TruVanTho', 'BenCat', 'CanGiuoc'
];

/**
 * Tổng hợp dữ liệu khảo sát trong ngày dateStr (YYYY-MM-DD, Asia/Ho_Chi_Minh).
 * Trả về object: { bySheet, bySurveyor, byType, rows, suCoToday, lichSuToday, total }
 */
function _aggregateDailyReport(dateStr) {
  var bySheet    = {};   // sheetName → count
  var bySurveyor = {};   // nguoiKS → { count, sheets: Set }
  var byType     = {};   // loai (int) → count
  var rows       = [];   // top-100 row records for detail table

  ALL_DISTRICT_SHEETS.forEach(function(sheetName) {
    try {
      var sheet = getSheet(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;

      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var hIdx    = buildHeaderIndex(headers);
      var numCols = Math.min(headers.length, 22);
      var allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).getValues();

      var capNhatCol  = hIdx[norm('Thời gian cập nhật')];
      var nguoiKSCol  = hIdx[norm('Người KS')];
      var tenTruCol   = hIdx[norm('Tên trụ')];
      var loaiCol     = hIdx[norm('Loại')];
      var tuCol       = hIdx[norm('Tủ điều khiển')];
      var duongCol    = hIdx[norm('Đường')];
      var pxCol       = hIdx[norm('Phường/ Xã')];
      var hinhAnhCol  = hIdx[norm('Ảnh')];

      var sheetCount = 0;

      allData.forEach(function(r) {
        if (!r[tenTruCol !== undefined ? tenTruCol : 1]) return;
        var capNhat = String(r[capNhatCol !== undefined ? capNhatCol : 13] || '');
        // Đối chiếu dateStr với phần ngày của timestamp (dd/MM/yyyy hoặc ISO)
        var matchDate = false;
        if (capNhat.indexOf(dateStr) !== -1) {
          matchDate = true;
        } else if (capNhat.indexOf('/') !== -1) {
          // Định dạng dd/MM/yyyy HH:mm:ss → chuyển sang YYYY-MM-DD
          var parts = capNhat.split(/[\s\/]/);
          // parts[0]=dd, parts[1]=MM, parts[2]=yyyy
          if (parts.length >= 3) {
            var isoDay = parts[2] + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0');
            matchDate = (isoDay === dateStr);
          }
        }
        if (!matchDate) return;

        sheetCount++;
        var tenTru   = String(r[tenTruCol  !== undefined ? tenTruCol  : 1]  || '');
        var nguoiKS  = String(r[nguoiKSCol !== undefined ? nguoiKSCol : 5]  || '') || '—';
        var loai     = parseInt(r[loaiCol  !== undefined ? loaiCol    : 6])  || 0;
        var tu       = String(r[tuCol      !== undefined ? tuCol      : 7]  || '');
        var duong    = String(r[duongCol   !== undefined ? duongCol   : 17] || '');
        var px       = String(r[pxCol      !== undefined ? pxCol      : 18] || '');
        var hasAnh   = !!(r[hinhAnhCol !== undefined ? hinhAnhCol : 12] && String(r[hinhAnhCol !== undefined ? hinhAnhCol : 12]).trim());

        byType[loai] = (byType[loai] || 0) + 1;

        if (!bySurveyor[nguoiKS]) bySurveyor[nguoiKS] = { count: 0, sheets: {} };
        bySurveyor[nguoiKS].count++;
        bySurveyor[nguoiKS].sheets[sheetName] = (bySurveyor[nguoiKS].sheets[sheetName] || 0) + 1;

        if (rows.length < 200) {
          rows.push({
            sheet: sheetName, tenTru: tenTru, nguoiKS: nguoiKS,
            loai: loai, tu: tu, duong: duong, px: px,
            capNhat: capNhat, hasAnh: hasAnh
          });
        }
      });

      if (sheetCount > 0) bySheet[sheetName] = sheetCount;
    } catch (e) {
      Logger.log('Daily report lỗi sheet ' + sheetName + ': ' + e.message);
    }
  });

  // LichSu hôm nay (delete / edit / move)
  var lichSuToday = [];
  try {
    var lsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LichSu');
    if (lsSheet && lsSheet.getLastRow() >= 2) {
      var lsData = lsSheet.getRange(2, 1, lsSheet.getLastRow() - 1, 6).getValues();
      lsData.forEach(function(r) {
        var tg = String(r[0] || '');
        if (tg.indexOf(dateStr) !== -1) {
          lichSuToday.push({ thoiGian: tg, nguoi: r[1], thaoTac: r[2], id: r[3], tenTru: r[4], chiTiet: r[5] });
        }
      });
    }
  } catch (_) {}

  // SuCo hôm nay
  var suCoToday = [];
  try {
    var scSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SuCo');
    if (scSheet && scSheet.getLastRow() >= 2) {
      var scData = scSheet.getRange(2, 1, scSheet.getLastRow() - 1, 15).getValues();
      scData.forEach(function(r) {
        var tg = String(r[1] || '');
        if (tg.indexOf(dateStr) !== -1) {
          suCoToday.push({ id: r[0], thoiGian: tg.slice(0,16).replace('T',' '), tenTru: r[2], loai: r[9], mucDo: r[10], trangThai: r[14] });
        }
      });
    }
  } catch (_) {}

  var total = rows.length;
  return { bySheet: bySheet, bySurveyor: bySurveyor, byType: byType,
           rows: rows, suCoToday: suCoToday, lichSuToday: lichSuToday, total: total };
}

var TYPE_LABEL = { 1: 'Trụ STK', 2: 'Trụ trang trí', 3: 'Trụ HTLT', 4: 'Trụ TTLT', 5: 'Tủ CS nổi', 6: 'Tủ CS ngầm' };
var THAO_TAC_LABEL = { 'edit': '✏️ Sửa', 'delete': '🗑 Xóa', 'move': '📍 Di chuyển', 'create_nhiem_vu': '📋 Giao việc', 'complete_bao_tri': '🔧 BT hoàn thành' };

/**
 * Build HTML email cho báo cáo ngày.
 */
function _buildDailyReportHtml(report, dateStr) {
  var donVi   = getSetting('donvi_name');
  var phong   = getSetting('phong_name');

  // Format date display: YYYY-MM-DD → DD/MM/YYYY
  var dp = dateStr.split('-');
  var dateDisplay = dp[2] + '/' + dp[1] + '/' + dp[0];

  var withAnh = report.rows.filter(function(r){ return r.hasAnh; }).length;
  var anhPct  = report.total > 0 ? ((withAnh / report.total) * 100).toFixed(0) : 0;

  var html = '<div style="font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:20px;color:#1e293b;">';

  // Header
  html += '<div style="text-align:center;font-weight:bold;font-size:12px;margin-bottom:4px;">' + donVi.toUpperCase() + ' — ' + phong.toUpperCase() + '</div>';
  html += '<div style="background:linear-gradient(135deg,#1e40af,#2563eb);border-radius:10px;padding:18px 24px;margin-bottom:20px;color:#fff;text-align:center;">';
  html += '<div style="font-size:18px;font-weight:900;letter-spacing:1px;">BÁO CÁO KHẢO SÁT NGÀY</div>';
  html += '<div style="font-size:13px;margin-top:6px;opacity:.85;">📅 ' + dateDisplay + '</div>';
  html += '</div>';

  // 4 tiles
  html += '<table width="100%" cellpadding="6" cellspacing="8" style="border-collapse:separate;margin-bottom:20px;"><tr>';
  html += _htmlTile('📍', report.total,              'Marker khảo sát',      '#2563eb');
  html += _htmlTile('👷', Object.keys(report.bySurveyor).length, 'Người khảo sát', '#10b981');
  html += _htmlTile('📷', withAnh + ' (' + anhPct + '%)', 'Có ảnh',          '#8b5cf6');
  html += _htmlTile('⚠️', report.suCoToday.length,   'Sự cố phát sinh',      '#dc2626');
  html += '</tr></table>';

  if (report.total === 0 && report.suCoToday.length === 0 && report.lichSuToday.length === 0) {
    html += '<div style="text-align:center;padding:40px;background:#f8fafc;border-radius:8px;color:#94a3b8;font-size:14px;">🌙 Hôm nay không có hoạt động khảo sát nào được ghi nhận.</div>';
    html += '</div>';
    return html;
  }

  // 1. Theo người khảo sát
  if (Object.keys(report.bySurveyor).length > 0) {
    html += '<h3 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:4px;margin-top:0;">1. Theo người khảo sát</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="background:#dbeafe;">';
    ['Người KS', 'Tổng marker', 'Địa bàn'].forEach(function(h) {
      html += '<th style="border:1px solid #93c5fd;padding:6px;text-align:left;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    var surveyors = Object.keys(report.bySurveyor).sort(function(a,b){
      return report.bySurveyor[b].count - report.bySurveyor[a].count;
    });
    surveyors.forEach(function(name, idx) {
      var sv = report.bySurveyor[name];
      var sheetList = Object.keys(sv.sheets).map(function(s){ return s + ' (' + sv.sheets[s] + ')'; }).join(', ');
      var bg = idx % 2 === 0 ? '#fff' : '#f0f7ff';
      html += '<tr style="background:' + bg + ';">';
      html += '<td style="border:1px solid #bfdbfe;padding:5px;font-weight:bold;">' + name + '</td>';
      html += '<td style="border:1px solid #bfdbfe;padding:5px;text-align:center;font-size:16px;font-weight:900;color:#2563eb;">' + sv.count + '</td>';
      html += '<td style="border:1px solid #bfdbfe;padding:5px;font-size:12px;color:#475569;">' + sheetList + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  // 2. Theo địa bàn
  if (Object.keys(report.bySheet).length > 0) {
    html += '<h3 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:4px;">2. Theo địa bàn</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="background:#dbeafe;"><th style="border:1px solid #93c5fd;padding:6px;text-align:left;">Địa bàn</th><th style="border:1px solid #93c5fd;padding:6px;text-align:center;">Số marker</th></tr></thead><tbody>';
    Object.keys(report.bySheet).sort().forEach(function(s, idx) {
      var bg = idx % 2 === 0 ? '#fff' : '#f0f7ff';
      html += '<tr style="background:' + bg + '">';
      html += '<td style="border:1px solid #bfdbfe;padding:5px;">' + s + '</td>';
      html += '<td style="border:1px solid #bfdbfe;padding:5px;text-align:center;font-weight:bold;">' + report.bySheet[s] + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  // 3. Theo loại marker
  if (Object.keys(report.byType).length > 0) {
    html += '<h3 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:4px;">3. Theo loại đối tượng</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="background:#dbeafe;"><th style="border:1px solid #93c5fd;padding:6px;text-align:left;">Loại</th><th style="border:1px solid #93c5fd;padding:6px;text-align:center;">Số lượng</th></tr></thead><tbody>';
    Object.keys(report.byType).sort(function(a,b){ return parseInt(a)-parseInt(b); }).forEach(function(t, idx) {
      var bg = idx % 2 === 0 ? '#fff' : '#f0f7ff';
      html += '<tr style="background:' + bg + '">';
      html += '<td style="border:1px solid #bfdbfe;padding:5px;">' + (TYPE_LABEL[parseInt(t)] || 'Loại ' + t) + '</td>';
      html += '<td style="border:1px solid #bfdbfe;padding:5px;text-align:center;font-weight:bold;">' + report.byType[t] + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  // 4. Danh sách chi tiết marker (top 100)
  if (report.rows.length > 0) {
    html += '<h3 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:4px;">4. Chi tiết marker đã khảo sát' + (report.rows.length >= 200 ? ' (hiển thị 200 đầu)' : '') + '</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="background:#dbeafe;">';
    ['Tên trụ/tủ', 'Địa bàn', 'Người KS', 'Tủ ĐK', 'Đường', 'Phường/Xã', 'Ảnh', 'Giờ cập nhật'].forEach(function(h) {
      html += '<th style="border:1px solid #93c5fd;padding:4px;font-size:11px;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    report.rows.slice(0, 100).forEach(function(row, idx) {
      var bg = idx % 2 === 0 ? '#fff' : '#f8fafc';
      var gioCN = String(row.capNhat || '');
      // Lấy phần giờ: ISO có T, dd/MM/yyyy có space
      if (gioCN.indexOf('T') !== -1) gioCN = gioCN.slice(11, 16);
      else if (gioCN.indexOf(' ') !== -1) gioCN = gioCN.split(' ')[1] || '';
      html += '<tr style="background:' + bg + '">';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;font-weight:600;">' + row.tenTru + '</td>';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:11px;color:#64748b;">' + row.sheet + '</td>';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;">' + row.nguoiKS + '</td>';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:11px;">' + row.tu + '</td>';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:11px;">' + row.duong + '</td>';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;font-size:11px;">' + row.px + '</td>';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;text-align:center;">' + (row.hasAnh ? '✅' : '—') + '</td>';
      html += '<td style="border:1px solid #e2e8f0;padding:3px 5px;font-family:monospace;font-size:11px;">' + gioCN + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (report.rows.length > 100) {
      html += '<div style="font-size:11px;color:#94a3b8;margin-top:4px;font-style:italic;">... và ' + (report.rows.length - 100) + ' marker nữa (xem đầy đủ trong app)</div>';
    }
  }

  // 5. Sự cố hôm nay
  if (report.suCoToday.length > 0) {
    html += '<h3 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:4px;">5. Sự cố phát sinh hôm nay (' + report.suCoToday.length + ')</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="background:#fee2e2;">';
    ['ID', 'Giờ', 'Tên trụ', 'Loại SC', 'Mức độ', 'Trạng thái'].forEach(function(h) {
      html += '<th style="border:1px solid #fca5a5;padding:4px;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    report.suCoToday.forEach(function(sc, idx) {
      var bg = idx % 2 === 0 ? '#fff' : '#fff5f5';
      var gio = String(sc.thoiGian || '').slice(-5);
      html += '<tr style="background:' + bg + '">';
      html += '<td style="border:1px solid #fecaca;padding:3px;font-family:monospace;font-size:10px;">' + sc.id + '</td>';
      html += '<td style="border:1px solid #fecaca;padding:3px;font-family:monospace;">' + gio + '</td>';
      html += '<td style="border:1px solid #fecaca;padding:3px;font-weight:bold;">' + sc.tenTru + '</td>';
      html += '<td style="border:1px solid #fecaca;padding:3px;">' + sc.loai + '</td>';
      html += '<td style="border:1px solid #fecaca;padding:3px;">' + (sc.mucDo === 'Khẩn cấp' ? '<b style="color:#dc2626">⚡ Khẩn cấp</b>' : sc.mucDo) + '</td>';
      html += '<td style="border:1px solid #fecaca;padding:3px;">' + sc.trangThai + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  // 6. Lịch sử thao tác (xóa/sửa/di chuyển)
  var editLogs = report.lichSuToday.filter(function(r){ return r.thaoTac === 'edit' || r.thaoTac === 'delete' || r.thaoTac === 'move'; });
  if (editLogs.length > 0) {
    html += '<h3 style="color:#f59e0b;border-bottom:2px solid #f59e0b;padding-bottom:4px;">6. Thao tác chỉnh sửa / xóa hôm nay (' + editLogs.length + ')</h3>';
    html += '<table width="100%" style="border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="background:#fef3c7;">';
    ['Giờ', 'Người thực hiện', 'Thao tác', 'Tên trụ', 'Chi tiết'].forEach(function(h) {
      html += '<th style="border:1px solid #fcd34d;padding:4px;">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    editLogs.slice(0, 50).forEach(function(log, idx) {
      var bg = idx % 2 === 0 ? '#fff' : '#fffbeb';
      var gio = String(log.thoiGian || '').slice(11, 16);
      var label = THAO_TAC_LABEL[log.thaoTac] || log.thaoTac;
      html += '<tr style="background:' + bg + '">';
      html += '<td style="border:1px solid #fde68a;padding:3px;font-family:monospace;font-size:11px;">' + gio + '</td>';
      html += '<td style="border:1px solid #fde68a;padding:3px;">' + log.nguoi + '</td>';
      html += '<td style="border:1px solid #fde68a;padding:3px;">' + label + '</td>';
      html += '<td style="border:1px solid #fde68a;padding:3px;font-weight:bold;">' + log.tenTru + '</td>';
      html += '<td style="border:1px solid #fde68a;padding:3px;font-size:11px;color:#64748b;">' + String(log.chiTiet || '').slice(0, 120) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  html += '<div style="text-align:center;margin-top:28px;padding:10px;background:#f1f5f9;border-radius:6px;font-size:11px;color:#94a3b8;">📧 Báo cáo ngày tự động tạo bởi <b>Lighting Survey</b> lúc 18:00 — Không cần trả lời</div>';
  html += '</div>';
  return html;
}

/**
 * Hàm chính gửi báo cáo ngày.
 * @param {string} [dateStr] — YYYY-MM-DD, mặc định hôm nay (Asia/Ho_Chi_Minh)
 */
function sendDailyReport(dateStr) {
  try {
    initSettingSheet();
    var enabled = getSetting('daily_report_enabled').toLowerCase();
    if (enabled !== 'true' && enabled !== '1') {
      Logger.log('❌ Báo cáo ngày bị tắt (daily_report_enabled = ' + enabled + ')');
      return { status: 'skipped', reason: 'disabled' };
    }
    var recipients = getSetting('email_recipients');
    if (!recipients) {
      Logger.log('❌ Không có email_recipients trong Setting');
      return { status: 'error', reason: 'no_recipients' };
    }

    if (!dateStr) {
      dateStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    }

    Logger.log('═══ Báo cáo ngày ' + dateStr + ' ═══');
    var report = _aggregateDailyReport(dateStr);
    Logger.log('Tổng marker: ' + report.total + ' | Sự cố: ' + report.suCoToday.length + ' | Thao tác: ' + report.lichSuToday.length);

    var dp = dateStr.split('-');
    var dateDisplay = dp[2] + '/' + dp[1] + '/' + dp[0];
    var subject = '[Lighting Survey] Báo cáo khảo sát ngày ' + dateDisplay + ' — ' + report.total + ' marker';

    var html = _buildDailyReportHtml(report, dateStr);
    var plain = 'Báo cáo khảo sát ngày ' + dateDisplay + ':\n'
      + '- Tổng marker: ' + report.total + '\n'
      + '- Người khảo sát: ' + Object.keys(report.bySurveyor).length + '\n'
      + '- Sự cố: ' + report.suCoToday.length + '\n'
      + 'Vui lòng bật HTML để xem chi tiết.';

    GmailApp.sendEmail(recipients, subject, plain, {
      htmlBody: html,
      name: getSetting('phong_name') || 'Lighting Survey'
    });

    Logger.log('✓ Đã gửi báo cáo ngày ' + dateDisplay + ' đến: ' + recipients);
    return { status: 'ok', date: dateStr, total: report.total, recipients: recipients };
  } catch (err) {
    Logger.log('❌ Lỗi gửi báo cáo ngày: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

/**
 * Test ngay — chạy tay từ Editor để gửi báo cáo hôm nay.
 */
function sendDailyReportNow() {
  var result = sendDailyReport();
  Logger.log('Kết quả: ' + JSON.stringify(result));
  return result;
}

/**
 * Gửi báo cáo cho ngày cụ thể (dùng khi cần gửi lại báo cáo ngày đã qua).
 * Sửa dateStr trước rồi chạy.
 */
function sendDailyReportForDate() {
  var dateStr = '2026-07-13'; // ← sửa ngày cần gửi (YYYY-MM-DD)
  var result = sendDailyReport(dateStr);
  Logger.log('Kết quả: ' + JSON.stringify(result));
}

/**
 * Setup trigger gửi báo cáo ngày lúc 18:00 (Asia/Ho_Chi_Minh).
 * Chạy 1 lần từ Editor — GAS tự chạy hàng ngày sau đó.
 */
function setupDailyReportTrigger() {
  // Xóa trigger cũ tránh duplicate
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'sendDailyReport') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });

  var hour = parseInt(getSetting('daily_report_hour') || '18');

  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();

  Logger.log('✓ Trigger đã setup — sendDailyReport chạy ' + hour + ':00 mỗi ngày');
  if (removed > 0) Logger.log('  (đã xóa ' + removed + ' trigger cũ)');
  Logger.log('  Trigger hiện tại:');
  ScriptApp.getProjectTriggers().forEach(function(t, i) {
    Logger.log('  ' + (i + 1) + '. ' + t.getHandlerFunction() + ' — ' + t.getEventType());
  });
}

/**
 * Xóa trigger báo cáo ngày.
 */
function removeDailyReportTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'sendDailyReport') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log('✓ Đã xóa ' + removed + ' trigger sendDailyReport');
}

// Handler cho client call (doPost action: send_daily_report)
function handleSendDailyReport(data) {
  var dateStr = String(data.date || '').trim() || undefined;
  var result = sendDailyReport(dateStr);
  return jsonResponse(result);
}

/**
 * Trả về dữ liệu báo cáo ngày dạng JSON cho client hiển thị trong app.
 * doPost action: get_daily_report
 * Request: { action, date: 'YYYY-MM-DD' }  (date mặc định hôm nay nếu bỏ trống)
 */
function handleGetDailyReport(data) {
  try {
    var dateStr = String(data.date || '').trim();
    if (!dateStr) {
      dateStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    }
    var report = _aggregateDailyReport(dateStr);
    return jsonResponse({ status: 'ok', date: dateStr, report: report });
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'get_daily_report lỗi: ' + err.message });
  }
}
