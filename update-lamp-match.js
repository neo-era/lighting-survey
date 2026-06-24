/**
 * update-lamp-match.js — Đồng bộ dữ liệu đèn vào trụ hiện hữu
 *
 * Bước 1: purge_no_gps  — xóa các hàng import nhầm (nguoiKS='import', lat='')
 * Bước 2: batch_match_update — dò theo Tên trụ, chỉ update trụ đã tồn tại
 *
 * Cách chạy: node update-lamp-match.js
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPFn7lnJZYdjUg5WlVq1P1JGI5O3rvcry_IVE3bhF5foDmbgT6KwBU4xFxHNwKruHRvQ/exec';
const XLSX_FILE = '2026-06 Công suất đèn Chiếu sáng Q.5-8-10-11-BT-PN.xlsx';
const BATCH_SIZE = 150; // records per batch_match_update call

const x = require('xlsx');

const SHEET_MAP = [
  { excel: 'Quận 5',  sheet: 'Quan5'      },
  { excel: 'Quận 8',  sheet: 'Quan8'      },
  { excel: 'Quận 10', sheet: 'Quan10'     },
  { excel: 'Quận 11', sheet: 'Quan11'     },
  { excel: 'Quận BT', sheet: 'BinhThanh'  },
  { excel: 'Quận PN', sheet: 'PhuNhuan'   },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function post(payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function normalizeLoaiDen(raw) {
  const s = String(raw).trim().toLowerCase();
  if (s.includes('led'))          return 'LED';
  if (s.includes('metal halide')) return 'MH';
  if (s.includes('hps') || s.includes('trang trí')) return 'HPS';
  return '';
}

function extractWatt(str) {
  const m = String(str).match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function buildPolesFromSheet(ws) {
  const rows = x.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(2).filter(r => r[11]);
  const map = {};
  for (const r of rows) {
    const tenTru = String(r[11]).trim();
    if (!tenTru) continue;
    if (!map[tenTru]) {
      map[tenTru] = {
        tenTru,
        tuDieuKhien: String(r[13]).trim(),
        lamps: [],
      };
    }
    map[tenTru].lamps.push({ loaiDen: String(r[5]).trim(), congSuat: String(r[7]).trim() });
  }
  return Object.values(map).map(p => {
    // Aggregate lamp data
    const loaiCounts = {};
    let maxWatt = 0;
    for (const l of p.lamps) {
      const ld = normalizeLoaiDen(l.loaiDen);
      if (ld) loaiCounts[ld] = (loaiCounts[ld] || 0) + 1;
      const w = extractWatt(l.congSuat);
      if (w > maxWatt) maxWatt = w;
    }
    const loaiDen = Object.entries(loaiCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return {
      tenTru: p.tenTru,
      tuDieuKhien: p.tuDieuKhien,
      loaiDen,
      congSuat: maxWatt > 0 ? String(maxWatt) : '',
      soLuongDen: p.lamps.length,
    };
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Đồng bộ dữ liệu đèn — dò theo tên trụ hiện hữu');
  console.log('═══════════════════════════════════════════════════════════');

  const wb = x.readFile(XLSX_FILE);

  // ── BƯỚC 1: Xóa các hàng import nhầm (không có GPS) ──────────────────────
  console.log('\n[ Bước 1 ] Xóa trụ import nhầm (lat rỗng + nguoiKS=import)...');
  for (const cfg of SHEET_MAP) {
    process.stdout.write(`  ${cfg.sheet.padEnd(12)} ... `);
    try {
      const j = await post({ action: 'purge_no_gps', sheet: cfg.sheet });
      console.log(j.status === 'ok' ? `✅  xóa ${j.deleted}/${j.total}` : `❌  ${JSON.stringify(j)}`);
    } catch (e) {
      console.log(`❌  ${e.message}`);
    }
    await sleep(500);
  }

  // ── BƯỚC 2: Update trụ hiện hữu theo tên ─────────────────────────────────
  console.log('\n[ Bước 2 ] Cập nhật thông tin đèn cho trụ hiện hữu...');

  for (const cfg of SHEET_MAP) {
    const ws = wb.Sheets[cfg.excel];
    if (!ws) { console.log(`⚠  Sheet "${cfg.excel}" không tìm thấy`); continue; }

    const poles = buildPolesFromSheet(ws);
    console.log(`\n▶ ${cfg.sheet.padEnd(12)} (${poles.length} trụ cần dò)`);

    let totalUpdated = 0, totalNotFound = 0;
    for (let i = 0; i < poles.length; i += BATCH_SIZE) {
      const batch = poles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(poles.length / BATCH_SIZE);
      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length}) ... `);
      try {
        const j = await post({ action: 'batch_match_update', sheet: cfg.sheet, records: batch });
        if (j.status === 'ok') {
          console.log(`✅  updated=${j.updated}  notFound=${j.notFound}`);
          totalUpdated  += j.updated;
          totalNotFound += j.notFound;
        } else {
          console.log(`❌  ${JSON.stringify(j)}`);
        }
      } catch (e) {
        console.log(`❌  ${e.message}`);
      }
      await sleep(800);
    }
    console.log(`  → ${cfg.sheet}: cập nhật ${totalUpdated} trụ | không khớp ${totalNotFound}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Xong!');
}

main().catch(console.error);
