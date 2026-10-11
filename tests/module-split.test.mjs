// Module hoá index.html (đợt 1, v173): mỗi tính năng tách ra src/features/*.js là classic script toàn cục.
// Kiểm: file tồn tại + nạp đúng thứ tự (trước khối <script> chính), có trong precache SW, không còn bản trùng trong
// index.html, hàm/handler onclick vẫn là toàn cục, và các nút trong HTML gọi tới hàm có thật.
// Run: node tests/module-split.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAppSandbox } from '../tools/dxf-check/app-sandbox.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');

// place: 'before' = nạp trước khối <script> chính (đợt 1 — file không chạy gì lúc nạp ngoài khai báo)
//        'inline' = khối <script> chính được ngắt tại đúng chỗ cũ: </script><script src=…><script> (đợt 2)
const MODULES = {
    'src/features/cable-check.js': { place: 'before', fns: ['_openLongCableCheck', '_lcRefreshList', '_deleteLongCablesSelected', '_lcTuClear', '_lcTuUndo', '_lcTuRerun', '_lcXoaDelete', '_tuCablePlan', '_xoaPlan', '_rowMapByNamePreferCoord'] },
    'src/features/align-route.js': { place: 'before', fns: ['openAlignRoute', '_raRecompute', '_raRenderPanel', '_raApply', '_raUndoAlign', '_raClose', '_raBulk', '_raBulkSelect', '_raToggle'] },
    'src/features/cad-export.js': { place: 'inline', fns: ['_generateCadDrawing', '_generateSingleLineDrawing', '_generateOverviewDrawing', '_drawAutoLegend', '_drawCabinetSymbol', '_drawTitleBlockStateFull', '_openCadGenerator', '_onCgExport', '_onCgExportRun', '_onCgBatchExport', '_onCgCompileFullDossier', '_raPlanAlign', '_rlDrawLampBlock', '_dxfEscape', '_saveBlob'] },
    'src/features/osm.js': { place: 'inline', fns: ['_fetchOsmBasemap', '_overpassFetch', '_osmBoundsKey', '_drawOsmBasemapInDxf', '_filletCorners', '_osmRoadWidth', '_mergeRoadChains'] },
};
const firstInline = html.search(/<script>\s/);
for (const [file, { place, fns }] of Object.entries(MODULES)) {
    const src = fs.readFileSync(path.join(REPO, file), 'utf8');
    const tag = `<script src="${file}"></script>`;
    const at = html.indexOf(tag);
    ok(`${file}: được nạp bằng <script src>`, at > 0);
    if (place === 'before') ok(`${file}: nạp sau src/core/mst.js và TRƯỚC khối <script> chính`, at > html.indexOf('src/core/mst.js') && at < firstInline);
    else ok(`${file}: ngắt khối script tại chỗ (</script> ↵ <script src> ↵ <script>)`,
        html.replace(/\r\n/g, '\n').includes(`</script>\n    <script src="${file}"></script>\n    <script>`));
    ok(`${file}: có trong precache sw.js`, sw.includes(`'${file}'`));
    for (const fn of fns) {
        const re = new RegExp(`(?:async\\s+)?function\\s+${fn}\\s*\\(`);
        if (!re.test(src)) { ok(`${file}: khai báo ${fn}`, false); continue; }
        if (re.test(html)) ok(`${fn}: còn bản trùng trong index.html`, false);
    }
    ok(`${file}: đủ ${fns.length} hàm, không còn bản trùng trong index.html`, fns.every(fn => new RegExp(`function\\s+${fn}\\s*\\(`).test(src) && !new RegExp(`function\\s+${fn}\\s*\\(`).test(html)));
    ok(`${file}: không phải ES module (không import/export cấp cao nhất)`, !/^(import|export)\s/m.test(src));
}

// Sandbox nạp đúng thứ tự trang → mọi hàm toàn cục + gọi được
const sb = loadAppSandbox();
ok('sandbox nạp index.html + module không lỗi', sb.errors.length === 0);
const all = Object.values(MODULES).flatMap(m => m.fns);
ok('mọi hàm module là toàn cục trong trang', all.every(fn => typeof sb.ctx[fn] === 'function'));

// Mọi onclick/onchange/oninput trong HTML gọi tới hàm có thật (bắt lỗi cắt sót handler)
const handlers = new Set();
// Quét cả HTML lẫn chuỗi template trong các module (panel/modal sinh động cũng có onclick)
const allSrc = [html, ...Object.keys(MODULES).map(f => fs.readFileSync(path.join(REPO, f), 'utf8'))].join('\n');
for (const m of allSrc.matchAll(/\son(?:click|change|input|keydown)="([^"]+)"/g)) {
    for (const c of m[1].matchAll(/(?:^|[;\s(!])([A-Za-z_$][\w$]*)\s*\(/g)) handlers.add(c[1]);
}
const SKIP = new Set(['if', 'return', 'function', 'parseFloat', 'parseInt', 'String', 'Number', 'confirm', 'alert', 'prompt', 'setTimeout', 'event', 'this', 'document', 'window', 'getElementById', 'stopPropagation', 'preventDefault', 'remove', 'click', 'focus', 'select', 'blur', 'contains', 'toggle', 'add', 'querySelector', 'closest', 'open', 'print', 'encodeURIComponent', 'navigator', 'writeText', 'then', 'replace', 'trim', 'toUpperCase', 'toLowerCase', 'Math', 'max', 'min', 'round', 'isNaN', 'Boolean', 'location', 'reload', 'history', 'back', 'scrollTo', 'scrollIntoView', 'modal', '$', 'jQuery', 'requestAnimationFrame', 'Date', 'now', 'JSON', 'stringify', 'parse', 'console', 'log', 'error', 'warn']);
// Gán vào window lúc mở modal kiểm tra DXF (không tồn tại khi nạp trang) — không phải lỗi
const RUNTIME = new Set(['_dxfPreflightDone', '_dpfApplyChecked', '_dpfApplyAll', '_dpfContinue']);
const missing = [...handlers].filter(h => !SKIP.has(h) && !RUNTIME.has(h) && typeof sb.ctx[h] !== 'function');
ok(`mọi handler trong HTML trỏ tới hàm có thật (${handlers.size} tên)` + (missing.length ? ' — thiếu: ' + missing.join(', ') : ''), missing.length === 0);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
