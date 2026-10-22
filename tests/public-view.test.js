// Link chia sẻ công khai — helpers thuần giữa mốc @@PUBLICVIEW_START/END (index.html)
// Run: node tests/public-view.test.js
function load() {
    const src = require('../tools/app-source.cjs').appSource();
    const m = src.match(/\/\/ @@PUBLICVIEW_START([\s\S]*?)\/\/ @@PUBLICVIEW_END/);
    if (!m) throw new Error('Chưa có block @@PUBLICVIEW_START/END');
    return new Function(m[1] + '\nreturn { _parsePublicView, _resolvePublicPage, _shareLinkFor };')();
}
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
let H;
try { H = load(); } catch (e) { console.log('✗ load:', e.message); console.log('\n=== 0 pass / 1 fail ==='); process.exit(1); }

// === _parsePublicView ===
ok('lấy view từ query', H._parsePublicView('?view=Quan1') === 'Quan1');
ok('view kèm param khác', H._parsePublicView('?a=1&view=BinhThanh&b=2') === 'BinhThanh');
ok('không có view → ""', H._parsePublicView('?x=1') === '');
ok('query rỗng → ""', H._parsePublicView('') === '');
ok('trim khoảng trắng', H._parsePublicView('?view=%20Quan3%20') === 'Quan3');
ok('decode dấu', H._parsePublicView('?view=' + encodeURIComponent('Phú Nhuận')) === 'Phú Nhuận');

// === _resolvePublicPage ===
const pages = [
    { sheet: 'Quan1', label: 'Quận 1', csvUrl: 'https://x/q1.csv' },
    { sheet: 'NoCsv', label: 'Thiếu CSV' },               // không có csvUrl
    { sheet: 'Quan3', label: 'Quận 3', csvUrl: 'https://x/q3.csv' }
];
ok('tìm đúng page có csv', H._resolvePublicPage('Quan1', pages).label === 'Quận 1');
ok('sheet không tồn tại → null', H._resolvePublicPage('Quan9', pages) === null);
ok('sheet thiếu csvUrl → null', H._resolvePublicPage('NoCsv', pages) === null);
ok('sheet rỗng → null', H._resolvePublicPage('', pages) === null);
ok('pages không phải mảng → null', H._resolvePublicPage('Quan1', null) === null);

// === _shareLinkFor ===
ok('ghép link chuẩn', H._shareLinkFor('https://neo-era.github.io', '/lighting-survey/', 'Quan1') === 'https://neo-era.github.io/lighting-survey/?view=Quan1');
ok('encode tên có dấu/space', H._shareLinkFor('https://h', '/a/', 'Phú Nhuận') === 'https://h/a/?view=Ph%C3%BA%20Nhu%E1%BA%ADn');

console.log('\n=== ' + pass + ' pass / ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
