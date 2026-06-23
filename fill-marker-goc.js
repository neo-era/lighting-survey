/**
 * fill-marker-goc.js — Điền Marker gốc theo chuỗi tuyến cho tất cả sheet
 * Cách chạy: node fill-marker-goc.js
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPFn7lnJZYdjUg5WlVq1P1JGI5O3rvcry_IVE3bhF5foDmbgT6KwBU4xFxHNwKruHRvQ/exec';

const SHEETS = ['Quan1', 'Quan3', 'Quan5', 'Quan8', 'Quan10', 'Quan11', 'PhuNhuan', 'BinhThanh'];

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
  console.log('  Điền Marker gốc theo chuỗi tuyến');
  console.log('═══════════════════════════════════════════════════');

  for (const sheet of SHEETS) {
    process.stdout.write(`🔄 ${sheet.padEnd(12)} ... `);
    try {
      const j = await postGAS({ action: 'fill_marker_goc_chain', sheet, overwrite: true });
      if (j.status === 'ok') {
        console.log(`✅  filled=${j.filled}/${j.total}`);
      } else {
        console.log(`❌  ${j.message}`);
      }
    } catch (e) {
      console.log(`❌  ${e.message}`);
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('Xong!');
}

main();
