/**
 * import-lamp-poles.js — Import trụ đèn từ file "Công suất đèn" vào các sheet quận
 * Nguồn: 2026-06 Công suất đèn Chiếu sáng Q.5-8-10-11-BT-PN.xlsx
 * Cách chạy: node import-lamp-poles.js
 *
 * Dữ liệu: mỗi hàng Excel = 1 bóng đèn → gộp theo Tên trụ → 1 hàng/trụ
 * Các trường gộp:
 *   loaiDen   = loại đèn phổ biến nhất của trụ (LED / HPS / MH)
 *   congSuat  = công suất cao nhất của trụ (W)
 *   soLuong   = số bóng đèn trên trụ
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPFn7lnJZYdjUg5WlVq1P1JGI5O3rvcry_IVE3bhF5foDmbgT6KwBU4xFxHNwKruHRvQ/exec';
const XLSX_FILE = '2026-06 Công suất đèn Chiếu sáng Q.5-8-10-11-BT-PN.xlsx';
const BATCH_SIZE = 200; // rows per GAS request

const x = require('xlsx');

// Excel sheet → GAS sheet + ID prefix
const SHEET_MAP = [
  { excel: 'Quận 5',  sheet: 'Quan5',      prefix: 'Q5'  },
  { excel: 'Quận 8',  sheet: 'Quan8',      prefix: 'Q8'  },
  { excel: 'Quận 10', sheet: 'Quan10',     prefix: 'Q10' },
  { excel: 'Quận 11', sheet: 'Quan11',     prefix: 'Q11' },
  { excel: 'Quận BT', sheet: 'BinhThanh',  prefix: 'BT'  },
  { excel: 'Quận PN', sheet: 'PhuNhuan',   prefix: 'PN'  },
];

// HEADER column order (phải khớp với GAS HEADER)
const COL_COUNT = 26;
// [0]ID [1]Tên trụ [2]Lat [3]Lon [4]Ghi chú [5]Người KS
// [6]Loại [7]Tủ điều khiển [8]Loại trụ [9]Loại cần [10]Loại đèn
// [11]Công suất [12]Ảnh [13]Thời gian cập nhật [14]Marker gốc [15]Khoảng cách (m)
// [16]Mã PE [17]Đường [18]Phường/ Xã [19]VN2000-X [20]VN2000-Y
// [21]Số lượng đèn [22]Loại cáp [23]Độ chính xác (m) [24]Chế độ GPS [25]Label offset

function normalizeLoaiDen(raw) {
  const s = String(raw).trim().toLowerCase();
  if (s.includes('led'))          return 'LED';
  if (s.includes('metal halide')) return 'MH';
  if (s.includes('hps'))          return 'HPS';
  if (s.includes('trang trí'))    return 'HPS';
  return '';
}

function extractWatt(congSuatStr) {
  // "HPS 250/150W" → 250, "LED 120W-<130W" → 120, "HPS 70W" → 70
  const m = String(congSuatStr).match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function isDecorative(loaiDenRaw) {
  return String(loaiDenRaw).toLowerCase().includes('trang trí');
}

function buildPolesFromSheet(ws) {
  const rows = x.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(2).filter(r => r[11]);
  const polesMap = {};
  for (const r of rows) {
    const tenTru = String(r[11]).trim();
    if (!tenTru) continue;
    if (!polesMap[tenTru]) {
      polesMap[tenTru] = {
        tenTru,
        tenTu:    String(r[13]).trim(),
        duong:    String(r[17]).trim(),
        phuongXa: String(r[18]).trim(),
        lamps:    [],
        decorative: false,
      };
    }
    const p = polesMap[tenTru];
    p.lamps.push({
      loaiDenRaw: String(r[5]).trim(),
      congSuatRaw: String(r[7]).trim(),
    });
    if (isDecorative(r[5])) p.decorative = true;
  }
  return Object.values(polesMap);
}

function poleToRow(pole, id, now) {
  // Aggregate lamp data
  const loaiCounts = {};
  let maxWatt = 0;
  for (const l of pole.lamps) {
    const ld = normalizeLoaiDen(l.loaiDenRaw);
    if (ld) loaiCounts[ld] = (loaiCounts[ld] || 0) + 1;
    const w = extractWatt(l.congSuatRaw);
    if (w > maxWatt) maxWatt = w;
  }
  // Most common loaiDen
  const loaiDen = Object.entries(loaiCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const congSuat = maxWatt > 0 ? String(maxWatt) : '';
  const soLuong = pole.lamps.length;
  // loai: 2 = trang trí, 1 = STK
  const loai = pole.decorative ? '2' : '1';

  const row = new Array(COL_COUNT).fill('');
  row[0]  = id;           // ID
  row[1]  = pole.tenTru;  // Tên trụ
  row[2]  = '';           // Lat (chưa có GPS)
  row[3]  = '';           // Lon
  row[5]  = 'import';     // Người KS
  row[6]  = loai;         // Loại (1=STK, 2=trang trí)
  row[7]  = pole.tenTu;   // Tủ điều khiển
  row[10] = loaiDen;      // Loại đèn
  row[11] = congSuat;     // Công suất
  row[13] = now;          // Thời gian cập nhật
  row[17] = pole.duong;   // Đường
  row[18] = pole.phuongXa; // Phường/ Xã
  row[21] = soLuong;      // Số lượng đèn
  return row;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postBatch(sheet, rows) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'batch_import', sheet, rows, clearFirst: false }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Import trụ đèn theo công suất — 6 quận/huyện');
  console.log('═══════════════════════════════════════════════════════════');

  const wb = x.readFile(XLSX_FILE);
  const now = new Date().toISOString();

  for (const cfg of SHEET_MAP) {
    const ws = wb.Sheets[cfg.excel];
    if (!ws) { console.log(`⚠  Sheet "${cfg.excel}" không tìm thấy, bỏ qua`); continue; }

    const poles = buildPolesFromSheet(ws);
    console.log(`\n▶ ${cfg.sheet.padEnd(12)} (${poles.length} trụ)`);

    // Build rows
    const gasRows = poles.map((p, i) => {
      const id = `${cfg.prefix}_${String(i + 1).padStart(4, '0')}`;
      return poleToRow(p, id, now);
    });

    // Send in batches
    let inserted = 0;
    for (let i = 0; i < gasRows.length; i += BATCH_SIZE) {
      const batch = gasRows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(gasRows.length / BATCH_SIZE);
      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} rows) ... `);
      try {
        const j = await postBatch(cfg.sheet, batch);
        if (j.status === 'ok') {
          console.log(`✅  ${j.count}`);
          inserted += j.count;
        } else {
          console.log(`❌  ${JSON.stringify(j)}`);
        }
      } catch (e) {
        console.log(`❌  ${e.message}`);
      }
      await sleep(800); // GAS rate limit
    }
    console.log(`  → Tổng: ${inserted}/${poles.length} trụ đã import`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Xong!');
}

main().catch(console.error);
