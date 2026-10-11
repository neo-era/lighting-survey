// Xoá toàn bộ tuyến cáp của 1 tủ + hoàn tác + MST ghi vào dòng có toạ độ (v168).
// Dữ liệu mẫu theo đúng ca thật Quan11 "Tuệ Tĩnh 204": mỗi trụ 2 dòng (1 có toạ độ nối thẳng về tủ, 1 import trống toạ độ nối chuỗi).
// Run: node tests/tu-cable-reset.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

const row = (id, name, lat, lon, type, tu, parent, dist) => {
    const r = new Array(30).fill('');
    Object.assign(r, { 0: id, 1: name, 2: lat, 3: lon, 6: String(type), 7: tu, 13: 'old', 14: parent, 15: dist });
    return r;
};
const TU = 'Tuệ Tĩnh 204';
const data = [new Array(30).fill('h'),
    row('C1', TU, '10,7600', '106,6500', 5, TU, '', ''),
    row('17896_1', 'TT_TT_204_1 (đèn 17)', '10,7612', '106,6512', 1, TU, TU, ''),
    row('17896_2', 'TT_TT_204_2 (đèn 18)', '10,7608', '106,6508', 1, TU, TU, ''),
    row('17896_3', 'TT_TT_204_3 (đèn 19)', '10,7605', '106,6505', 1, TU, TU, ''),
    row('17896_4', 'TT_TT_204_4 (đèn 20)', '10,7602', '106,6502', 1, TU, TU, ''),
    row('Q11_2073', 'TT_TT_204_1 (đèn 17)', '', '', 1, TU, 'TT_TT_204_2 (đèn 18)', '29'),
    row('Q11_2074', 'TT_TT_204_2 (đèn 18)', '', '', 1, TU, 'TT_TT_204_3 (đèn 19)', '16'),
    row('Q11_2075', 'TT_TT_204_3 (đèn 19)', '', '', 1, TU, 'TT_TT_204_4 (đèn 20)', '20'),
    row('Q11_2076', 'TT_TT_204_4 (đèn 20)', '', '', 1, TU, '', ''),
    // Tủ khác — không được đụng
    row('C2', 'Khác', '10,7700', '106,6600', 5, 'Khác', '', ''),
    row('X1', 'K_1', '10,7701', '106,6601', 1, 'Khác', 'Khác', '15'),
];
sb.ctx.__rows = data;
sb.run('loadedData = __rows;');
const rows = data.slice(1);

// ── Hàm thuần ──
const plan = sb.ctx._tuCablePlan(rows, TU);
ok('plan: 7 dòng có cáp của tủ (4 có toạ độ + 3 không toạ độ)', plan.targets.length === 7 && plan.withCoord === 4 && plan.noCoord === 3);
ok('plan: 4 trụ, 9 dòng thuộc tủ', plan.poleCount === 4 && plan.rowCount === 9);
ok('plan: không lấy dòng của tủ khác', !plan.targets.some(r => r[7] === 'Khác'));
ok('plan: tủ không tồn tại → rỗng', sb.ctx._tuCablePlan(rows, 'ZZZ').targets.length === 0);

const m = sb.ctx._rowMapByNamePreferCoord(rows);
ok('map tên: trùng tên → lấy dòng CÓ toạ độ (17896_1, không phải Q11_2073)', m.get('TT_TT_204_1 (đèn 17)')[0] === '17896_1');
ok('map tên: dòng trống toạ độ đứng trước vẫn bị thay bằng dòng có toạ độ',
    sb.ctx._rowMapByNamePreferCoord([data[6], data[2]]).get('TT_TT_204_1 (đèn 17)')[0] === '17896_1');

// ── Luồng UI: xoá → sync theo ID → hoàn tác ──
const sent = [];
sb.ctx._batchSyncRowsToGAS = async (rs, fields) => { sent.push({ ids: rs.map(r => r[0]), fields, vals: rs.map(r => [r[14], r[15]]) });
    return { updated: rs.length, failed: 0, notFound: 0 }; };
sb.ctx.uiConfirm = async () => true;
const els = {};
const el = id => els[id] || (els[id] = { id, value: '', textContent: '', innerHTML: '', disabled: false, style: {} });
sb.ctx.document = Object.assign(sb.ctx.document || {}, { getElementById: el, querySelectorAll: () => [] });
for (const f of ['_lcRefreshList', '_lcClearHighlight', '_logAction', 'displayInfo', 'displayError', '_invalidatePopupCacheForRow'])
    sb.ctx[f] = () => {};
sb.ctx.canEdit = () => true;

el('lcTuInput').value = 'tue tinh 204';   // gõ không dấu
ok('gõ không dấu "tue tinh 204" → nhận đúng tủ', sb.ctx._lcTuOnInput() === TU);
ok('nút Xoá bật khi tủ còn cáp', el('lcTuBtnClear').disabled === false);

await sb.ctx._lcTuClear(false);
ok('xoá: không còn dòng nào của tủ có Marker gốc / Khoảng cách', rows.filter(r => r[7] === TU).every(r => r[14] === '' && r[15] === ''));
ok('xoá: tủ khác giữ nguyên', data[11][14] === 'Khác' && data[11][15] === '15');
ok('xoá: gửi đúng 7 bản ghi, gồm cả dòng import (ID Q11_*)', sent.length === 1 && sent[0].ids.length === 7 && sent[0].ids.includes('Q11_2073') && sent[0].ids.includes('17896_1'));
ok('xoá: chỉ gửi cột markerGoc/khoangCach/capNhat', JSON.stringify(sent[0].fields) === JSON.stringify(['markerGoc', 'khoangCach', 'capNhat']));
ok('xoá: hiện nút Hoàn tác', el('lcTuBtnUndo').style.display === '');
ok('xoá xong: nút Xoá tắt (hết cáp)', el('lcTuBtnClear').disabled === true);

await sb.ctx._lcTuUndo();
ok('hoàn tác: khôi phục y nguyên giá trị cũ', data[2][14] === TU && data[6][14] === 'TT_TT_204_2 (đèn 18)' && data[6][15] === '29' && data[2][13] === 'old');
ok('hoàn tác: gửi lại 7 bản ghi với giá trị cũ', sent.length === 2 && sent[1].ids.length === 7 && sent[1].vals.some(v => v[0] === 'TT_TT_204_3 (đèn 19)' && v[1] === '16'));
ok('hoàn tác: ẩn nút Hoàn tác', el('lcTuBtnUndo').style.display === 'none');

// Huỷ xác nhận → không làm gì
sb.ctx.uiConfirm = async () => false;
await sb.ctx._lcTuClear(false);
ok('huỷ xác nhận: không xoá, không gửi', sent.length === 2 && data[2][14] === TU);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
