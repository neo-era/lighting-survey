/**
 * import-q3-cabinets.js — Import tủ điều khiển Quận 3 từ file Excel
 * Cách chạy: node import-q3-cabinets.js
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPFn7lnJZYdjUg5WlVq1P1JGI5O3rvcry_IVE3bhF5foDmbgT6KwBU4xFxHNwKruHRvQ/exec';
const XLSX_FILE = '2026-06 Định vị TĐK Chiếu sáng Q1-3-.5-8-10-11-BT-PN.xlsx';
const SHEET_NAME = 'Quận 3';
const TARGET_SHEET = 'Quan3';

const x = require('xlsx');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function postGAS(payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Import tủ điều khiển Quận 3');
  console.log('═══════════════════════════════════════════════════');

  const wb = x.readFile(XLSX_FILE);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`❌ Không tìm thấy sheet "${SHEET_NAME}"`);
    process.exit(1);
  }

  const rows = x.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Row 0 = header, Row 1 = summary totals, Row 2+ = data
  const dataRows = rows.slice(2).filter(r => r[2] && r[51]);

  console.log(`📋 Tổng số tủ: ${dataRows.length}`);
  console.log('');

  let ok = 0, fail = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];

    const id = `Q3_${String(i + 1).padStart(3, '0')}`;
    const tenTru = String(r[2]).trim();
    const lat = parseFloat(parseFloat(r[51]).toFixed(6));
    const lon = parseFloat(parseFloat(r[52]).toFixed(6));
    const vn2000x = parseFloat(r[53]) || 0;
    const vn2000y = parseFloat(r[54]) || 0;
    const maPE = String(r[0]).trim();
    const duong = String(r[4]).trim();
    const phuongXa = String(r[5]).trim();
    const noi = parseFloat(r[40]) || 0;
    const ngam = parseFloat(r[41]) || 0;
    // ngầm = type 6, nổi = type 5
    const loai = (ngam > 0 && noi === 0) ? 6 : 5;

    if (!lat || !lon) {
      console.log(`  ⚠  [${id}] ${tenTru} — bỏ qua (thiếu tọa độ)`);
      continue;
    }

    const payload = {
      action: 'full_update',
      sheet: TARGET_SHEET,
      id,
      tenTru,
      lat: lat.toFixed(6),
      lon: lon.toFixed(6),
      vn2000x: vn2000x.toString(),
      vn2000y: vn2000y.toString(),
      maPE,
      duong,
      phuongXa,
      loai: loai.toString(),
      // Tủ không có đèn/cần — để trống
      loaiDen: '',
      congSuat: '',
      soLuongDen: '',
      ghiChu: '',
      nguoiKS: 'import',
      capNhat: new Date().toISOString(),
    };

    process.stdout.write(`  [${String(i + 1).padStart(3)}/${dataRows.length}] ${tenTru.padEnd(35)} Loại ${loai} ... `);

    try {
      const j = await postGAS(payload);
      if (j.status === 'ok' || j.result === 'updated' || j.result === 'inserted') {
        console.log(`✅  ${j.result || 'ok'}`);
        ok++;
      } else {
        console.log(`❌  ${JSON.stringify(j)}`);
        fail++;
      }
    } catch (e) {
      console.log(`❌  ${e.message}`);
      fail++;
    }

    // Tránh rate limit GAS (~500ms/request)
    await sleep(600);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Xong! ✅ ${ok} thành công  ❌ ${fail} lỗi`);
}

main().catch(console.error);
