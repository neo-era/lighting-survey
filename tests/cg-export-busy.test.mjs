// Nút xuất CAD báo trạng thái đang chạy: vòng xoay + "Đang xuất… Ns", khoá nút khác, chống bấm trùng, luôn khôi phục.
// Run: node tests/cg-export-busy.test.mjs
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const sb = loadAppSandbox();
ok('sandbox nạp index.html không lỗi', sb.errors.length === 0);

function fakeBtn(id, html, disabled) {
    const cls = new Set();
    return { id, innerHTML: html, disabled: !!disabled, dataset: {}, attrs: {},
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), has: c => cls.has(c) },
        setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
}
const btns = {
    cgBtnPreview: fakeBtn('cgBtnPreview', '👁 Preview'), cgBtnDxf: fakeBtn('cgBtnDxf', 'DXF'),
    cgBtnPdf: fakeBtn('cgBtnPdf', 'PDF'), cgBtnBoth: fakeBtn('cgBtnBoth', 'Cả 2 (zip)'),
    cgBtnBom: fakeBtn('cgBtnBom', 'BOM', true),   // vốn đang disabled → phải giữ nguyên sau khi xong
};
const footer = { querySelectorAll: sel => sel === 'button[id]' ? Object.values(btns) : [] };
Object.values(btns).forEach(b => { b.parentElement = footer; });
sb.ctx.setInterval = setInterval; sb.ctx.clearInterval = clearInterval;
sb.ctx.document = Object.assign(sb.ctx.document || {}, { getElementById: id => btns[id] || null });

let release, runs = 0, throwNext = false;
sb.ctx._onCgExportRun = () => { runs++; if (throwNext) { throwNext = false; return Promise.reject(new Error('boom')); }
    return new Promise(r => { release = r; }); };

const p = sb.ctx._onCgExport('dxf');
await new Promise(r => setTimeout(r, 0));
const d = btns.cgBtnDxf;
ok('đang chạy: nút DXF hiện vòng xoay + "Đang xuất…"', /cg-busy-spin/.test(d.innerHTML) && /Đang xuất…/.test(d.innerHTML));
ok('đang chạy: nút DXF bị disable + aria-busy', d.disabled && d.attrs['aria-busy'] === 'true' && d.classList.has('cg-busy'));
ok('đang chạy: các nút xuất khác bị khoá', btns.cgBtnPdf.disabled && btns.cgBtnPreview.disabled && btns.cgBtnBoth.disabled);
sb.ctx._onCgExport('dxf'); sb.ctx._onCgExport('pdf');
await new Promise(r => setTimeout(r, 0));
ok('bấm thêm khi đang chạy → không chạy lần 2', runs === 1);
await new Promise(r => setTimeout(r, 1100));
ok('đếm giây: sau ~1s hiện "1s"', /Đang xuất… 1s/.test(d.innerHTML));
release(); await p;
ok('xong: nút DXF trở lại "DXF", bật lại', d.innerHTML === 'DXF' && !d.disabled && !d.classList.has('cg-busy') && !('aria-busy' in d.attrs));
ok('xong: nút khác bật lại; nút vốn disabled (BOM) vẫn disabled',
    !btns.cgBtnPdf.disabled && !btns.cgBtnPreview.disabled && btns.cgBtnBom.disabled && !btns.cgBtnPdf.classList.has('cg-locked'));

// Lỗi giữa chừng vẫn khôi phục
throwNext = true;
try { await sb.ctx._onCgExport('pdf'); } catch (_) { /* lỗi lan ra là chấp nhận được */ }
ok('lỗi: nút PDF khôi phục "PDF", bật lại', btns.cgBtnPdf.innerHTML === 'PDF' && !btns.cgBtnPdf.disabled);
const p2 = sb.ctx._onCgExport('both');
await new Promise(r => setTimeout(r, 0));
ok('sau lỗi: bấm lại được (không kẹt cờ busy)', runs === 3);
release(); await p2;

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
