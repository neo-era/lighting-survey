# Module hoá đợt 4a — Tách "In PDF" ra `src/features/print.js`

**Trạng thái:** thiết kế · **Phạm vi:** chỉ In PDF (hoãn lõi `src/app/`) · **Ngày:** 2026-10-13

## 1. Mục tiêu
Tách toàn bộ luồng **In bản vẽ / Xuất PDF** khỏi `index.html` (15.662 dòng) thành
`src/features/print.js` — classic script toàn cục, nạp `place: tail` (sau khối `<script>` chính).
Hành vi không đổi; không đổi giao diện.

## 2. Bối cảnh — vì sao "cần gom trước"
Cụm In PDF nằm rải trong khối script block1 (dòng ~3832–6683) + 2 helper icon-SVG lạc ở
block2 (10245/10256), **xen kẽ** với: hàm vẽ/sửa **sơ đồ cáp** (3901–4560), **xoay map**
(4606–4727), **collapsible panel** (4746–4789), đăng nhập/địa bàn. Vì vậy không thể cắt 1
dải liền — phải cắt **theo từng hàm** rồi gom lại.

## 3. Biên module (move-set)

### Chuyển sang `print.js` — 18 hàm top-level
`_savePdFields`, `_restorePdFields`, `openPrintDrawingModal`,
`_buildPrintCableSvg` (helper lồng `rotPt` đi theo), `_removePrintCableSvg`,
`_switchToPrintTile`, `_restoreOriginalTiles`, `_waitForTileLoad`,
`_zoomToScale`, `_showPrintOverlay`, `_hidePrintOverlay`, `_preparePrintLayout`,
`openPrintPreview`, `closePrintPreview`, `exportDrawingPDF`, `_loadPrintLibs`,
`_makeLampIconSvg`, `_makeCabinetIconSvg`.

### Chuyển sang `print.js` — 7 state top-level
`_PD_FIELDS`, `PRINT_CONFIG`, `_savedBaseLayers`, `_printCartoLayer`,
`_PRINT_TILE_URLS`, `_previewMode`, `_printLibsPromise`.

### GIỮ LẠI index.html (print.js gọi như global lúc runtime)
- `_buildCableLines`, `_removeCableLines`, `_cableLayerGroup` — tính năng cáp trên màn
  hình, **dùng chung với `src/features/data-tools.js`** → không được chuyển.
- `_applyMapScale` — widget tỷ lệ bản đồ (gọi `_zoomToScale` lúc runtime).
- Xoay map (9 hàm 4606–4727), collapsible (4746–4789), `_fitMapToRows`, và toàn bộ
  state lõi (`map`, `loadedData`, `L`, …) — **không thuộc In PDF**.
- `_filterRowsByTu` — hiện không có caller (giữ nguyên, không đụng).

## 4. Vì sao an toàn
- Classic script dùng chung 1 scope toàn cục; `print.js` nạp **tail** (sau cùng) nên mọi
  global nó tham chiếu (`map`, `loadedData`, `_buildCableLines`, `_applyMapScale`, `L`,
  `jsPDF`, `html2canvas`, …) đều đã tồn tại khi hàm print **chạy lúc runtime** (bấm nút).
- Các hàm print **không được gọi lúc nạp trang** — chỉ chạy qua onclick/được gọi từ hàm
  khác → an toàn khi đặt ở tail.
- State chuyển đi là khởi tạo đơn giản (`null/false/mảng/object`), không gọi hàm → thứ tự
  nạp không vỡ.

## 5. Rủi ro & ca xấu phải chịu
| Rủi ro | Xử lý / kiểm |
|---|---|
| Một hàm print bị **gọi lúc nạp** bởi code còn lại | Sandbox `loadAppSandbox()` 0 lỗi + rà acorn; nếu có → giữ lại hoặc đổi `place` |
| **Trùng tên** top-level giữa print.js và index.html | module-split test: "không còn bản trùng" |
| Handler `onclick` (openPrintDrawingModal, exportDrawingPDF…) mất global | module-split test: "mọi handler trỏ hàm có thật" |
| State dùng chung bị tách nhầm (`_cableLayerGroup`) | Đã quyết GIỮ LẠI; print.js gọi global |
| `rotPt` tưởng top-level | Đã xác nhận lồng 12-space trong `_buildPrintCableSvg` |

## 6. Thay đổi kèm theo
- `index.html`: chèn `<script src="src/features/print.js"></script>` ở nhóm tail
  (sau `osm.js`); xoá 18 hàm + 7 state khỏi vị trí cũ.
- `sw.js`: thêm `'src/features/print.js'` vào `STATIC_ASSETS`; bump `CACHE` v178 → v179.
- `tests/module-split.test.mjs`: thêm entry `src/features/print.js` (place `tail`) với 18 hàm.

## 7. Tiêu chí đạt (đo được)
1. `node tests/module-split.test.mjs` pass (thêm print.js, không còn bản trùng).
2. Sandbox nạp 0 lỗi; 18 hàm là global; mọi handler trỏ hàm có thật.
3. Không trùng tên top-level; 7 state đi cùng module.
4. `npm test` (vitest) pass nếu cài được gói (network); nếu không → dựa module-split + sandbox + kiểm tay.
5. SW precache + CACHE v179.
6. In PDF chạy đúng như cũ (mở modal → Xem trước → Xuất PDF).

## 8. Cách chạy test
```
node tests/module-split.test.mjs      # guard chính, không cần node_modules
npm install && npm test               # vitest 28 file (cần network)
```
