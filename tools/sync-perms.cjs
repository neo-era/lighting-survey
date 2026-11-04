// Chép khối @@PERMS từ src/core/perms.js sang gas-khaosat.js (giữ 2 bản giống hệt).
// Chạy: node tools/sync-perms.cjs
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..');
const re = /\/\/ @@PERMS_START[\s\S]*?\/\/ @@PERMS_END/;
const src = fs.readFileSync(path.join(R, 'src/core/perms.js'), 'utf8').match(re)[0];
const gp = path.join(R, 'gas-khaosat.js');
let gas = fs.readFileSync(gp, 'utf8');
if (re.test(gas)) gas = gas.replace(re, () => src);
else gas += '\n\n// ══ PHÂN QUYỀN v211 — lõi chung (chép từ src/core/perms.js bằng tools/sync-perms.cjs, KHÔNG sửa tay) ══\n' + src + '\n';
fs.writeFileSync(gp, gas);
console.log('synced @@PERMS →', gp);
