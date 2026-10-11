// Xoá hẳn trụ đặt tên tạm "XÓA" trong modal Kiểm tra sơ đồ cáp (v172).
// Run: node tests/xoa-rows.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const row = (id, name, tu, parent, dist) => {
    const r = new Array(30).fill('');
    Object.assign(r, { 0: id, 1: name, 2: '10,77', 3: '106,68', 6: '3', 7: tu, 14: parent || '', 15: dist || '' });
    return r;
};
const header = ['ID', 'Tên trụ', 'Lat', 'Lon'];
const data = [header,
    row('', 'XÓA', 'Trần Quốc Thảo 4', 'XÓA'),          // không ID
    row('', 'XÓA', 'Trần Quốc Thảo 4', 'XÓA'),
    row('18149_2', 'Xóa', 'Hẻm 21', ''),                 // có ID, chữ thường
    row('', ' XOA ', 'Trần Quốc Thảo 3', ''),            // không dấu + khoảng trắng
    row('A1', 'TQT_XOA_1', 'Trần Quốc Thảo 4', ''),      // chứa chữ xoa nhưng KHÔNG phải tên XÓA
    row('A2', 'TQT_TQT4_7', 'Trần Quốc Thảo 4', 'XÓA', '3364'),   // trụ con lấy XÓA làm gốc
    row('A3', 'TQT_TQT4_8', 'Trần Quốc Thảo 4', 'TQT_TQT4_7', '30'),
];
sb.ctx.__rows = data;
sb.run('loadedData = __rows;');

const plan = sb.ctx._xoaPlan(data.slice(1));
ok('bắt đúng 4 dòng tên XÓA / Xóa / " XOA "', plan.del.length === 4);
ok('không bắt nhầm "TQT_XOA_1"', !plan.del.some(r => r[1] === 'TQT_XOA_1'));
ok('dòng có ID xoá trước', plan.del[0][0] === '18149_2');
ok('1 trụ con lấy XÓA làm gốc (không tính các dòng XÓA)', plan.children.length === 1 && plan.children[0][0] === 'A2');
ok('đếm theo tủ', plan.byTu['Trần Quốc Thảo 4'] === 2 && plan.byTu['Hẻm 21'] === 1 && plan.byTu['Trần Quốc Thảo 3'] === 1);
const csv = sb.ctx._rowsToCsv(['a', 'b'], [['x,y', 'he said "hi"'], ['1', '']]);
ok('CSV: bọc ngoặc + nhân đôi dấu nháy', csv === 'a,b\r\n"x,y","he said ""hi"""\r\n1,');

// ── Luồng UI ──
const els = {};
const el = id => els[id] || (els[id] = { id, value: '', textContent: '', innerHTML: '', disabled: false, style: {}, title: '' });
sb.ctx.document = Object.assign(sb.ctx.document || {}, { getElementById: el, querySelectorAll: () => [] });
for (const f of ['_lcRefreshList', '_lcClearHighlight', '_logAction', 'displayInfo', 'displayError', '_invalidatePopupCacheForRow', '_rebuildCableLines'])
    sb.ctx[f] = () => {};
let rendered = 0; sb.ctx.addMarkersToMap = () => { rendered++; };
const saved = []; sb.ctx._saveBlob = (b, name) => saved.push({ b, name });
sb.ctx.Blob = class { constructor(parts) { this.text = parts.join(''); } };
const synced = []; sb.ctx._batchSyncRowsToGAS = async rs => { synced.push(rs.map(r => r[0])); return { updated: rs.length }; };
const posts = []; let failId = null;
sb.ctx.fetch = async (url, o) => { const b = JSON.parse(o.body); posts.push(b);
    return { json: async () => ({ status: b.id === failId ? 'error' : 'ok' }) }; };
sb.run("currentSheet = 'Quan3';");

sb.run("currentUser = { role: 'user' }");
sb.ctx._lcTuInit();
ok('thanh XÓA hiện, nêu 4 trụ + 1 trụ con', els.lcXoaBar.style.display === 'flex' && /4 trụ tên "XÓA"/.test(els.lcXoaInfo.innerHTML) && /1 trụ khác/.test(els.lcXoaInfo.innerHTML));
ok('user thường: nút tắt', els.lcXoaBtn.disabled === true);
let asked = 0; sb.ctx.uiPrompt = async () => { asked++; return 'XOA'; };
await sb.ctx._lcXoaDelete();
ok('user thường gọi thẳng: bị chặn, không hỏi, không gửi', asked === 0 && posts.length === 0);

sb.run("currentUser = { role: 'admin' }");
sb.ctx._lcTuInit();
ok('admin: nút bật, ghi "Xoá 4 trụ tên XÓA…"', els.lcXoaBtn.disabled === false && /Xoá 4 trụ tên XÓA/.test(els.lcXoaBtn.textContent));
sb.ctx.uiPrompt = async () => 'không';
await sb.ctx._lcXoaDelete();
ok('admin gõ sai: không xoá, không backup', posts.length === 0 && saved.length === 0 && data.length === 8);

failId = '18149_2';   // 1 dòng lỗi phía GAS
sb.ctx.uiPrompt = async () => 'xoa';
await sb.ctx._lcXoaDelete();
ok('backup CSV tải trước, có header + 4 dòng XÓA + 1 trụ con', saved.length === 1 && /^backup-xoa-Quan3-/.test(saved[0].name) &&
    saved[0].b.text.split('\r\n').length === 6 && /TQT_TQT4_7/.test(saved[0].b.text));
ok('backup giữ Marker gốc CŨ của trụ con ("XÓA", 3364)', /TQT_TQT4_7[^\r\n]*XÓA,3364/.test(saved[0].b.text));
ok('trụ con: bỏ Marker gốc + Khoảng cách, ghi sheet theo ID', data.find(r => r[0] === 'A2')[14] === '' && synced.length === 1 && synced[0].join() === 'A2');
ok('gửi 4 lệnh delete_row đúng sheet, dòng có ID gửi ID', posts.length === 4 && posts.every(p => p.action === 'delete_row' && p.sheet === 'Quan3') && posts[0].id === '18149_2');
ok('dòng không ID gửi tên gốc (" XOA " đã trim)', posts.some(p => p.id === '' && p.tenTru === 'XOA'));
ok('gỡ khỏi dữ liệu: 3 dòng thành công bị gỡ, dòng lỗi (18149_2) còn lại', data.length === 5 && data.some(r => r[0] === '18149_2') && !data.some(r => r[1] === 'XÓA'));
ok('giữ nguyên "TQT_XOA_1" và trụ thường', data.some(r => r[1] === 'TQT_XOA_1') && data.some(r => r[0] === 'A3' && r[14] === 'TQT_TQT4_7'));
ok('vẽ lại bản đồ 1 lần', rendered === 1);
ok('thanh XÓA còn 1 dòng (lỗi) để bấm lại', /1 trụ tên "XÓA"/.test(els.lcXoaInfo.innerHTML));

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
