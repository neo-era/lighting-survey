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
    'src/core/cad-titleblock-qbt.js': { place: 'before', fns: ['_qbtTextW', '_qbtFit', '_qbtDrawTitleBlock', '_qbtDrawHeader', '_qbtLegendRows', '_qbtLegendSize', '_qbtDrawLegendTable', '_qbtCabinetAddress'] },
    'src/core/cad-rotate.js': { place: 'before', fns: ['_rotMake', '_rotTextAngle', '_rotBounds', '_rotBestAngle', '_rotScoreA3'] },
    'src/core/cad-symlib.js': { place: 'before', fns: ['_csDxfName', '_csLampKind', '_csPickBlock', '_csStateLayer', '_csDef', '_csBlockDxf', '_csInsertScale', '_csBlockBBox', '_csRealRot', '_csLabel'] },
    'src/features/cable-check.js': { place: 'before', fns: ['_openLongCableCheck', '_lcRefreshList', '_deleteLongCablesSelected', '_lcTuClear', '_lcTuUndo', '_lcTuRerun', '_lcXoaDelete', '_tuCablePlan', '_xoaPlan', '_rowMapByNamePreferCoord'] },
    'src/features/route-summary.js': { place: 'before', fns: ['_openRouteSummary', '_exportRouteSummary', '_rsGroup', '_rsSummarize', '_rsFillCt5', '_rsFillWdx'] },
    'src/features/align-route.js': { place: 'before', fns: ['openAlignRoute', '_raRecompute', '_raRenderPanel', '_raApply', '_raUndoAlign', '_raClose', '_raBulk', '_raBulkSelect', '_raToggle'] },
    'src/features/cable.js': { place: 'before', fns: ['_detectCableCycle','_clDist','_clToward','_clRootOf','_clPlanLength','_buildCableLines','_removeCableLines','_attachCableEditHandler','_showCableContextMenu','_cableAnchorLabelUpdate','_onCableDataReload','_toggleCableAnchor','_openCableLengthEditor','_applyCableLength','_deleteCableSegment','_pickParentMode','_rebuildCableLines','toggleDrawCableMode','setCableChild','setCableParent','_setCableToolbar','toggleCableLayer','_onOutsideCableDropdown','toggleAllTuCbs','onTuCbChange','drawSelectedCables','toggleCableEditMode'] },
    'src/features/media.js': { place: 'before', fns: ['_startVoiceRecord','_stopVoiceRecord','_clearVoice','_updateVoiceUI','_renderVoicePreview','_loadQrLib','_openQrScanner','_closeQrScanner','_loadChartJs','_loadMapillaryJS','_setMapillaryStatus','_openMapillaryViewer','_cleanupMapillary'] },
    'src/features/cad-export.js': { place: 'inline', fns: ['_generateCadDrawing', '_generateSingleLineDrawing', '_generateOverviewDrawing', '_drawAutoLegend', '_drawCabinetSymbol', '_drawTitleBlockStateFull', '_openCadGenerator', '_onCgExport', '_onCgExportRun', '_onCgBatchExport', '_onCgCompileFullDossier', '_raPlanAlign', '_rlDrawLampBlock', '_dxfEscape', '_saveBlob'] },
    'src/features/osm.js': { place: 'inline', fns: ['_fetchOsmBasemap', '_overpassFetch', '_osmBoundsKey', '_drawOsmBasemapInDxf', '_filletCorners', '_osmRoadWidth', '_mergeRoadChains'] },
    'src/features/custom-roads.js': { place: 'inline', fns: ['_crCoordValid', '_crRecordValid', '_crEncodeGeom', '_crDecodeGeom', '_crToRoad', '_crNearBounds', '_crActive', '_crNextId', '_crRoadsForBounds', '_crMergeInto', '_customRoadsForBounds', '_withCustomRoads', '_crBoot', '_crSyncPull', '_crOnDistrictChange'] },
    'src/features/marker-qr.js': { place: 'inline', fns: ['_mqShareLink', '_mqCaption', '_mqFilename', '_mqParseMarker', '_mqSummaryOpts', '_mqOpen', '_mqFocusFromUrl'] },
    'src/features/mst-ui.js': { place: 'inline', fns: ['_openAutoMstModal', '_onMstTuChange', '_mstDoPreview', '_mstApplyToData', '_mstRollback', '_mstGetNodesForTu'] },
    'src/features/data-tools.js': { place: 'inline', fns: ['_batchReverseGeocode', '_confirmEditExcelUpdate'] },
    'src/features/cad-overlay.js': { place: 'inline', fns: ['_handleCadUpload', '_openCadUpload', '_validateDxf', '_applyDxfFix', '_loadCachedCad', '_openCadAdjust', '_startStakeout', '_onCadTextDragEnd'] },
    'src/features/report.js': { place: 'tail', fns: ['showReportModal', 'exportReport', 'getReportFilteredRows', 'renderReportPreview'] },
    'src/features/daily-report.js': { place: 'tail', fns: ['openDailyReportModal', '_loadDailyReport', '_renderDailyReport'] },
    'src/features/csv-import.js': { place: 'tail', fns: ['_onCsvImportChange', '_parseCsvSmart', '_detectCsvFormat', '_confirmCsvImport', '_extractLatLon'] },
    'src/features/print.js': { place: 'tail', fns: ['_savePdFields','_restorePdFields','openPrintDrawingModal','_buildPrintCableSvg','_removePrintCableSvg','_switchToPrintTile','_restoreOriginalTiles','_waitForTileLoad','_zoomToScale','_showPrintOverlay','_hidePrintOverlay','_preparePrintLayout','openPrintPreview','closePrintPreview','exportDrawingPDF','_loadPrintLibs','_makeLampIconSvg','_makeCabinetIconSvg'] },
};
const firstInline = html.search(/<script>\s/);
for (const [file, { place, fns }] of Object.entries(MODULES)) {
    const src = fs.readFileSync(path.join(REPO, file), 'utf8');
    const tag = `<script src="${file}"></script>`;
    const at = html.indexOf(tag);
    ok(`${file}: được nạp bằng <script src>`, at > 0);
    if (place === 'before') ok(`${file}: nạp sau src/core/mst.js và TRƯỚC khối <script> chính`, at > html.indexOf('src/core/mst.js') && at < firstInline);
    else if (place === 'tail') ok(`${file}: nạp sau khối <script> chính (thay khối script cuối)`, at > html.lastIndexOf('src/features/osm.js'));
    else {
        // inline: module ngắt khối script tại chỗ. Cho phép NHIỀU <script src> inline nối nhau trong cùng
        // một dãy bọc bởi </script> … <script> (vd osm.js → osm-prebuilt.js → custom-roads.js).
        const norm = html.replace(/\r\n/g, '\n');
        const runs = norm.match(/<\/script>\n(?:[ \t]*<script src="[^"]+"><\/script>\n)+[ \t]*<script>/g) || [];
        ok(`${file}: nằm trong dãy <script src> ngắt khối (</script> … <script>)`,
            runs.some(b => b.includes(`<script src="${file}"></script>`)));
    }
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
