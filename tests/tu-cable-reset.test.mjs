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
    ...Array.from({ length: 10 }, (_, i) => row('S' + i, 'S' + i + '_1', '10,78', '106,67', 1, 'Tủ ' + String(i + 1).padStart(2, '0'), 'Tủ ' + String(i + 1).padStart(2, '0'), '5')),
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

sb.run("currentUser = { role: 'user', username: 'u' }");
const selCount = () => sb.run('_lcTuSel.size');

// Lọc không dấu + "Chọn tất cả (đang lọc)" chỉ lấy tủ khớp
sb.ctx._lcTuInit();
el('lcTuFilter').value = 'tue tinh';
sb.ctx._lcTuSelectAll(true);
ok('lọc "tue tinh" (không dấu) + Chọn tất cả → chỉ chọn Tuệ Tĩnh 204', selCount() === 1 && sb.run('_lcTuSel.has("Tuệ Tĩnh 204")'));
ok('danh sách lọc hiện 1/12 tủ', /1\/12 tủ/.test(el('lcTuFilterInfo').textContent));
el('lcTuFilter').value = '';
ok('1 tủ: nhãn nút = tên tủ', /^Tuệ Tĩnh 204/.test(el('lcTuToggle').textContent));
ok('nút Xoá bật khi tủ còn cáp', el('lcTuBtnClear').disabled === false);

// Bấm 📍 dòng lỗi → THÊM tủ (không thay)
sb.ctx._lcTuSet('Khác');
ok('📍 thêm tủ "Khác" → 2 tủ đã chọn', selCount() === 2 && /2 tủ đã chọn/.test(el('lcTuToggle').textContent));
ok('dòng tổng: 2 tủ · 5 trụ · 8 cáp', /2 tủ · 5 trụ · 8 cáp/.test(el('lcTuInfo').textContent));

// Xoá 2 tủ (< 10, user thường được) — 1 lần ghi sheet
await sb.ctx._lcTuClear(false);
ok('xoá 2 tủ: mọi dòng của 2 tủ hết Marker gốc / Khoảng cách', rows.filter(r => r[7] === TU || r[7] === 'Khác').every(r => r[14] === '' && r[15] === ''));
ok('xoá 2 tủ: tủ khác (Tủ 01) giữ nguyên', data.find(r => r[0] === 'S0')[14] === 'Tủ 01');
ok('xoá 2 tủ: gửi sheet 1 lần, 8 bản ghi (gồm dòng import Q11_*)', sent.length === 1 && sent[0].ids.length === 8 && sent[0].ids.includes('Q11_2073') && sent[0].ids.includes('X1'));
ok('xoá: chỉ gửi cột markerGoc/khoangCach/capNhat', JSON.stringify(sent[0].fields) === JSON.stringify(['markerGoc', 'khoangCach', 'capNhat']));
ok('xoá: hiện nút Hoàn tác (2 tủ)', el('lcTuBtnUndo').style.display === '' && /2 tủ/.test(el('lcTuBtnUndo').textContent));
ok('xoá xong: nút Xoá tắt (hết cáp)', el('lcTuBtnClear').disabled === true);

await sb.ctx._lcTuUndo();
ok('hoàn tác: khôi phục y nguyên cả 2 tủ', data[2][14] === TU && data[6][14] === 'TT_TT_204_2 (đèn 18)' && data[6][15] === '29' && data[2][13] === 'old' && data[11][14] === 'Khác');
ok('hoàn tác: gửi lại 8 bản ghi với giá trị cũ', sent.length === 2 && sent[1].ids.length === 8 && sent[1].vals.some(v => v[0] === 'TT_TT_204_3 (đèn 19)' && v[1] === '16'));
ok('hoàn tác: ẩn nút Hoàn tác', el('lcTuBtnUndo').style.display === 'none');

// Huỷ xác nhận → không làm gì
sb.ctx.uiConfirm = async () => false;
await sb.ctx._lcTuClear(false);
ok('huỷ xác nhận: không xoá, không gửi', sent.length === 2 && data[2][14] === TU);

// Chọn tất cả (12 tủ) — user thường bị chặn
sb.ctx._lcTuSelectAll(true);
ok('chọn tất cả: 12 tủ, nhãn "Tất cả (12 tủ)"', selCount() === 12 && /Tất cả \(12 tủ\)/.test(el('lcTuToggle').textContent));
ok('≥10 tủ + user thường: nút Xoá tắt, có giải thích', el('lcTuBtnClear').disabled === true && /chỉ admin/.test(el('lcTuBtnClear').title));
let prompted = 0; sb.ctx.uiPrompt = async () => { prompted++; return 'XOA'; };
await sb.ctx._lcTuClear(false);
ok('≥10 tủ + user thường: gọi thẳng cũng bị chặn, không hỏi, không gửi', prompted === 0 && sent.length === 2);

// Admin: gõ sai → không xoá; gõ đúng → xoá tất cả
sb.run("currentUser = { role: 'admin', username: 'a' }");
sb.ctx._lcTuSelectAll(true);
ok('admin: nút Xoá bật', el('lcTuBtnClear').disabled === false);
sb.ctx.uiPrompt = async () => 'xoa nhe';
await sb.ctx._lcTuClear(false);
ok('admin gõ sai chữ: không xoá, không gửi', sent.length === 2 && data[2][14] === TU);
sb.ctx.uiPrompt = async () => ' xoa ';
await sb.ctx._lcTuClear(false);
ok('admin gõ "xoa": xoá cáp của cả 12 tủ trong 1 lần ghi (18 bản ghi)', sent.length === 3 && sent[2].ids.length === 18 && rows.every(r => r[14] === '' && r[15] === ''));

// Chạy lại tối ưu: Auto MST nhận đúng danh sách tủ
sb.ctx._lcTuSelectAll(false);
sb.ctx._lcTuSet(TU); sb.ctx._lcTuSet('Tủ 03');
const opt = v => ({ value: v, selected: false });
const mstOpts = [opt(TU), opt('Khác'), opt('Tủ 03'), opt('Tủ 04')];
els.mstTuSelect = { options: mstOpts };
let previewed = 0;
for (const f of ['_closeLongCableCheck', '_openAutoMstModal', '_onMstTuChange']) sb.ctx[f] = () => {};
sb.ctx._mstDoPreview = () => { previewed++; };
sb.ctx._lcTuRerun();
ok('chạy lại tối ưu: Auto MST chọn đúng 2 tủ + xem trước', mstOpts.filter(o => o.selected).map(o => o.value).join('|') === TU + '|Tủ 03' && previewed === 1);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
