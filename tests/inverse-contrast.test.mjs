// Thanh/nhãn nổi chữ trắng phải đọc được ở CẢ chế độ sáng và tối (v213).
// Lỗi thật 16/11/2026: thanh "Nhấp vào bản đồ để chọn vị trí" nền var(--text) — ở chế độ tối --text là màu SÁNG
// → chữ trắng trên nền trắng. Run: node tests/inverse-contrast.test.mjs
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); };
const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = rd('index.html'), css = rd('src/styles/app.css');
const js = fs.readdirSync(new URL('../src/features/', import.meta.url)).map(f => rd('src/features/' + f)).join('\n');

ok('không còn nền var(--text) (index.html, app.css, src/features)', !/background:\s*var\(--text\)/.test(html + css + js));

const lum = hex => { const c = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const bgs = [...css.matchAll(/--inverse-bg:\s*(#[0-9a-f]{6})/gi)].map(m => m[1]);
ok('nền tối có ở :root + 3 khối chế độ tối', bgs.length === 4, bgs);
const fg = (css.match(/--inverse-fg:\s*(#[0-9a-f]{6})/i) || [])[1];
bgs.forEach(b => ok(`chữ ${fg} trên ${b}: tương phản ≥ 7 (AAA)`, ratio(fg, b) >= 7, ratio(fg, b).toFixed(2)));
// chữ phụ 72% trắng trên nền tối: trộn rồi đo
const mix = (b, a) => '#' + b.replace('#', '').match(/../g).map(h => Math.round(255 * a + parseInt(h, 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
bgs.forEach(b => ok(`chữ phụ (72% trắng) trên ${b}: tương phản ≥ 4.5`, ratio(mix(b, .72), b) >= 4.5, ratio(mix(b, .72), b).toFixed(2)));
ok('thanh chọn vị trí dùng nền tối cố định + chữ trắng', /id="pickOnMapHint"[^>]*background:var\(--inverse-bg\); color:white/.test(html));

console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
if (fail) process.exit(1);
