// Mã QR trụ/tủ — helpers thuần giữa mốc @@MARKERQR_START/END (marker-qr.js)
// Run: node tests/marker-qr.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();
    const m = src.match(/\/\/ @@MARKERQR_START([\s\S]*?)\/\/ @@MARKERQR_END/);
    if (!m) throw new Error('Chưa có block @@MARKERQR_START/END');
    return new Function(m[1] + '\nreturn { _mqShareLink, _mqCaption, _mqFilename, _mqParseMarker, _mqSummaryOpts };')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }

const O = 'https://neo-era.github.io', P = '/lighting-survey/';

// === _mqShareLink ===
const l1 = H._mqShareLink(O, P, 'Quan5', 'Q5_012', { t: 'Trụ STK Q5_012', k: 'LED', p: '100W' });
ok('link có base + view', l1.indexOf('https://neo-era.github.io/lighting-survey/?view=Quan5') === 0);
ok('link có &m=', l1.indexOf('&m=Q5_012') >= 0);
ok('link có &t= encode', l1.indexOf('&t=Tr%E1%BB%A5') >= 0);
ok('link có &k= &p=', l1.indexOf('&k=LED') >= 0 && l1.indexOf('&p=100W') >= 0);
const l2 = H._mqShareLink(O, P, 'Quan5', 'Q5_012', {});
ok('không có tóm tắt → chỉ view+m', l2 === 'https://neo-era.github.io/lighting-survey/?view=Quan5&m=Q5_012');
const l3 = H._mqShareLink(O, P, 'Quan5', '', {});
ok('không id → chỉ view', l3.indexOf('&m=') < 0);
const l4 = H._mqShareLink(O, P, 'Quan5', 'X', { t: 'a'.repeat(100) });
ok('cắt tham số dài ≤40', l4.match(/&t=(a+)/)[1].length <= 40);
ok('id có ký tự lạ được encode', H._mqShareLink(O, P, 'Quan5', 'A B/C', {}).indexOf('&m=A%20B%2FC') >= 0);

// === _mqCaption ===
const c1 = H._mqCaption(['Q5_012', 'Trụ STK Q5_012', '10.7', '106.6', '', 'hungnt', '1', 'VTS_H23', '', '', 'LED', '100W']);
ok('caption name', c1.name === 'Trụ STK Q5_012');
ok('caption sub gồm loại·CS·tủ', c1.sub === 'LED · 100W · Tủ VTS_H23');
ok('caption id', c1.id === 'Q5_012');
const c2 = H._mqCaption(['', '', '', '', '', '', '', '', '', '', '', '']);
ok('caption rỗng → (không tên)', c2.name === '(không tên)');
ok('caption sub rỗng khi thiếu', c2.sub === '');
const c3 = H._mqCaption(['ID1', 'Tủ A', '', '', '', '', '', '', '', '', '', '']);
ok('caption chỉ tên khi không loại/CS/tủ', c3.sub === '');

// === _mqFilename ===
ok('filename theo id', H._mqFilename(['Q5_012', 'Trụ STK']) === 'QR-Q5_012.png');
ok('filename fallback tên khi không id', H._mqFilename(['', 'Trụ A B']) === 'QR-Trụ_A_B.png');
ok('filename sanitize ký tự cấm', H._mqFilename(['A/B:C*?', 'x']) === 'QR-A_B_C_.png');
ok('filename rỗng → QR-qr.png', H._mqFilename(['', '']) === 'QR-qr.png');

// === _mqParseMarker ===
ok('parse m', H._mqParseMarker('?view=Quan5&m=Q5_012') === 'Q5_012');
ok('parse m encode', H._mqParseMarker('?m=A%20B') === 'A B');
ok('parse không m → rỗng', H._mqParseMarker('?view=Quan5') === '');
ok('parse rỗng → rỗng', H._mqParseMarker('') === '');

// === _mqSummaryOpts ===
const s1 = H._mqSummaryOpts(['Q5_012', 'Trụ STK', '', '', '', '', '', 'VTS', '', '', 'LED', '100W']);
ok('summaryOpts t/k/p', s1.t === 'Trụ STK' && s1.k === 'LED' && s1.p === '100W');

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
