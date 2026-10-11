// Tên gốc tuyến (normalizeMarkerBaseName) — src/core/text.js. Run: node tests/marker-basename.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'text.js'), 'utf8'), ctx);
const B = ctx.window.normalizeMarkerBaseName;

// Tên có số thứ tự trong ngoặc ở cuối (dữ liệu thật Quan1: LTT_LTT1_12 (48))
ok('LTT_LTT1_12 (48) → ltt_ltt1', B('LTT_LTT1_12 (48)') === 'ltt_ltt1');
ok('LTT_LTT1_9 (45) → ltt_ltt1', B('LTT_LTT1_9 (45)') === 'ltt_ltt1');
ok('LTT_LTT1_15 (không ngoặc) → ltt_ltt1', B('LTT_LTT1_15') === 'ltt_ltt1');
ok('ngoặc không có khoảng trắng: LTT_LTT1_12(48) → ltt_ltt1', B('LTT_LTT1_12(48)') === 'ltt_ltt1');
ok('khoảng trắng thừa cuối: "LTT_LTT1_12 (48)  " → ltt_ltt1', B('LTT_LTT1_12 (48)  ') === 'ltt_ltt1');
ok('LAX_LTT1_1 → lax_ltt1 (tuyến khác)', B('LAX_LTT1_1') === 'lax_ltt1');
// Không đổi hành vi cũ
ok('BTX_BTX1_6 → btx_btx1', B('BTX_BTX1_6') === 'btx_btx1');
ok('VTS_H232VTS_19 → vts_h232vts', B('VTS_H232VTS_19') === 'vts_h232vts');
ok('NTMK_NTMK 10_15 → ntmk_ntmk 10', B('NTMK_NTMK 10_15') === 'ntmk_ntmk 10');
ok('rỗng / null → ""', B('') === '' && B(null) === '');
ok('ngoặc ở GIỮA tên không bị cắt: "Trụ (A) 3" → "tru (a)"', B('Trụ (A) 3') === 'tru (a)');

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
