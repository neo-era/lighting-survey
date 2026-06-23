/**
 * import-excel.js  — Nhập dữ liệu từ file Excel vào Google Sheets qua GAS
 *
 * Cách dùng:
 *   node import-excel.js
 *
 * Yêu cầu:
 *   - GAS đã được redeploy với action batch_import
 *   - npm install xlsx  (đã có nếu chạy lần trước)
 */

const XLSX = require('xlsx');
const path = require('path');
const fs   = require('fs');

// ── CẤU HÌNH ──────────────────────────────────────────────────────────────

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPFn7lnJZYdjUg5WlVq1P1JGI5O3rvcry_IVE3bhF5foDmbgT6KwBU4xFxHNwKruHRvQ/exec';

const EXCEL_FILE = '2026-06 Định vị trụ đèn Chiếu sáng Q.5-8-10-11-BT-PN.xlsx';

// Map tên sheet Excel → tên tab Google Sheet
const SHEET_MAP = {
  'QUẬN 5':  'Quan5',
  'QUẬN 8':  'Quan8',
  'QUẬN 10': 'Quan10',
  'QUẬN 11': 'Quan11',
  'QUẬN BT': 'BinhThanh',
  'QUẬN PN': 'PhuNhuan',
};

// Gửi tối đa 2000 hàng / request (tránh timeout GAS)
const CHUNK_SIZE = 2000;

// ── MAPPING LOẠI TRỤ ──────────────────────────────────────────────────────

// Mã loại trụ từ Excel → Loại (1-6) trong app
function mapType(maLoai) {
  const code = Number(maLoai);
  if (code === 225 || code === 226) return 2; // Trụ trang trí
  if (code === 216 || code === 217) return 3; // Trụ HTLT (điện lực quản lý)
  return 1; // Trụ STK (mặc định)
}

// ── MAPPING CỘT ───────────────────────────────────────────────────────────

// Excel cols (0-based index):
//  [0]Mã  [1]Mã định danh  [2]Tên trụ  [3]STT/Tuyến  [4]Chiều cao
//  [5]Mã loại trụ  [6]Tên loại trụ  [7]Vĩ độ  [8]Kinh độ
//  [9]VN2000X  [10]VN2000Y  [11]Mã tủ  [12]Tên tủ
//  [13]Mã tuyến  [14]Tên tuyến  [15]Lý trình
//  [16]Tên đường  [17]Tên Phường/Xã  [18]Quận/Huyện

// App schema (25 cols):
//  [0]ID  [1]Tên trụ  [2]Lat  [3]Lon  [4]Ghi chú  [5]Người KS
//  [6]Loại  [7]Tủ điều khiển  [8]Loại trụ  [9]Loại cần  [10]Loại đèn
//  [11]Công suất  [12]Ảnh  [13]Thời gian cập nhật  [14]Marker gốc
//  [15]Khoảng cách(m)  [16]Mã PE  [17]Đường  [18]Phường/Xã
//  [19]VN2000-X  [20]VN2000-Y  [21]Số lượng đèn  [22]Loại cáp
//  [23]Độ chính xác(m)  [24]Chế độ GPS

function mapRow(r, timestamp) {
  const vn2000x = r[9]  ? Math.round(Number(r[9]))  : '';
  const vn2000y = r[10] ? Math.round(Number(r[10])) : '';
  return [
    String(r[1]  || ''),   // [0]  ID           ← Mã định danh
    String(r[2]  || ''),   // [1]  Tên trụ
    String(r[7]  || ''),   // [2]  Lat           ← Vĩ độ
    String(r[8]  || ''),   // [3]  Lon           ← Kinh độ
    '',                    // [4]  Ghi chú
    '',                    // [5]  Người KS
    mapType(r[5]),         // [6]  Loại
    String(r[12] || ''),   // [7]  Tủ điều khiển ← Tên tủ
    String(r[6]  || ''),   // [8]  Loại trụ      ← Tên loại trụ
    '',                    // [9]  Loại cần
    '',                    // [10] Loại đèn
    '',                    // [11] Công suất
    '',                    // [12] Ảnh
    timestamp,             // [13] Thời gian cập nhật
    '',                    // [14] Marker gốc
    '',                    // [15] Khoảng cách (m)
    String(r[0]  || ''),   // [16] Mã PE         ← Mã (số trong hệ thống)
    String(r[16] || ''),   // [17] Đường
    String(r[17] || ''),   // [18] Phường/Xã
    vn2000x,               // [19] VN2000-X
    vn2000y,               // [20] VN2000-Y
    1,                     // [21] Số lượng đèn (mặc định 1)
    '',                    // [22] Loại cáp
    '',                    // [23] Độ chính xác (m)
    '',                    // [24] Chế độ GPS
  ];
}

// ── GAS REQUEST ───────────────────────────────────────────────────────────

async function postToGAS(payload) {
  const res = await fetch(GAS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(json.message || 'GAS error');
  return json;
}

// ── IMPORT MỘT SHEET ──────────────────────────────────────────────────────

async function importSheet(excelName, sheetName, dataRows) {
  const total = dataRows.length;
  console.log(`\n🔄 ${excelName} → ${sheetName} (${total} hàng)`);

  let sentTotal = 0;
  for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
    const chunk      = dataRows.slice(i, i + CHUNK_SIZE);
    const clearFirst = i === 0; // Xóa sheet chỉ ở chunk đầu tiên
    const chunkNum   = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(dataRows.length / CHUNK_SIZE);

    process.stdout.write(`   Chunk ${chunkNum}/${totalChunks} (${chunk.length} hàng)... `);

    const result = await postToGAS({
      action:     'batch_import',
      sheet:      sheetName,
      rows:       chunk,
      clearFirst: clearFirst,
    });

    sentTotal += result.count || chunk.length;
    console.log(`✓ (${sentTotal}/${total})`);
  }

  console.log(`✅ ${sheetName}: Hoàn thành ${sentTotal} hàng`);
  return sentTotal;
}

// ── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Import Excel → Google Sheets');
  console.log('═══════════════════════════════════════════════════');

  const filePath = path.join(__dirname, EXCEL_FILE);
  if (!fs.existsSync(filePath)) {
    console.error('❌ Không tìm thấy file:', filePath);
    process.exit(1);
  }

  console.log('📂 Đọc file:', EXCEL_FILE);
  const wb = XLSX.readFile(filePath);

  const timestamp = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  let grandTotal = 0;
  const results  = {};

  for (const [excelSheet, gasSheet] of Object.entries(SHEET_MAP)) {
    const ws = wb.Sheets[excelSheet];
    if (!ws) {
      console.warn(`⚠️  Sheet "${excelSheet}" không có trong file — bỏ qua`);
      continue;
    }

    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    // Skip header rows (row 0 = header, row 1 = empty)
    const dataRows = rawRows
      .slice(2)
      .filter(r => r.some(v => v !== ''))
      .map(r => mapRow(r, timestamp));

    try {
      const count   = await importSheet(excelSheet, gasSheet, dataRows);
      results[gasSheet] = { ok: true, count };
      grandTotal += count;
    } catch (err) {
      console.error(`❌ Lỗi ${gasSheet}:`, err.message);
      results[gasSheet] = { ok: false, error: err.message };
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  KẾT QUẢ TỔNG HỢP');
  console.log('═══════════════════════════════════════════════════');
  for (const [sheet, r] of Object.entries(results)) {
    if (r.ok) {
      console.log(`  ✅ ${sheet.padEnd(12)} ${r.count} hàng`);
    } else {
      console.log(`  ❌ ${sheet.padEnd(12)} LỖI: ${r.error}`);
    }
  }
  console.log(`\n  Tổng: ${grandTotal} hàng đã nhập`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
