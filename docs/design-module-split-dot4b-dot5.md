# Module hoá đợt 4b (Cable sơ đồ) + đợt 5 (CSS)

**Trạng thái:** hoàn tất · **Ngày:** 2026-10-14

## Đợt 5 — Tách CSS → src/styles/app.css
- Gộp 2 khối `<style>` (chính trong `<head>` + phụ cuối `<body>` cho #updateBanner) → `src/styles/app.css` (941 dòng), thay khối 1 bằng `<link rel="stylesheet" href="src/styles/app.css">`, xoá khối 2.
- Cascade giữ nguyên: link đặt trong head SAU các CDN css (bootstrap/leaflet/font) → app css vẫn override; thứ tự block1→block2 trong app.css = thứ tự nguồn cũ.
- CSS dời **nguyên văn** (chỉ thêm 1 comment phân cách) → giao diện không đổi 1 pixel.
- SW: precache `src/styles/app.css` + bump CACHE v179→v180.
- Test: `tests/css-extract.test.mjs` (6/0).

## Đợt 4b — Tách Cable sơ đồ → src/features/cable.js (place: before)
- 27 hàm (vẽ/sửa/toggle sơ đồ cáp trên bản đồ) + 10 state → `src/features/cable.js` (604 dòng).
- `place: before` (sau src/core, trước khối `<script>` chính): an toàn cả khi bị gọi lúc nạp lẫn runtime.
- GIỮ global: `_buildCableLines`/`_removeCableLines` được `data-tools.js` + `print.js` dùng → nằm trong cable.js nhưng vẫn là global (classic script chung scope trình duyệt).
- **Bẫy đã xử lý — state `let/const` chung scope trình duyệt:** moved state (`_cableLayerGroup`, `_selectedTus`, `CL_MAX_LEN`…) phải xoá sạch khỏi index.html, nếu còn 1 khai báo trùng → SyntaxError "already declared" lúc nạp. Đã verify 10/10 state = 0 trùng ở index.html và không module nào khác khai báo lại.
- **Bẫy đã xử lý — marker test @@CABLELEN:** `tests/cable-length-edit.test.js` cắt khối giữa `// @@CABLELEN_START/END` (chứa CL_MAX_LEN + _clNum + _clDist + _clToward + _clRootOf + _clPlanLength) từ appSource rồi eval riêng. toString không mang theo comment marker → phải di chuyển marker vào cable.js bọc đúng 2 const + 4 hàm, xoá marker mồ côi ở index.html.
- Test: `module-split` (+entry cable.js, place before) 63/0; `cable-length-edit` 28/0.

## Phương pháp tách (tái dùng từ đợt 4a)
`fn.toString()` của V8 (qua sandbox) lấy nguyên văn hàm (tránh brace-count trên template/CSS); scanner string/comment-aware tìm `;` kết state. Validate (sandbox 0 lỗi, không trùng, cross-ref resolve) TRƯỚC khi ghi.

## Kết quả
index.html: 14.855 → **13.331 dòng** (−1.524 qua 2 đợt). Toàn bộ test xanh: 26 node-test + vitest 47/47.

## Còn lại (đợt sau)
- Lõi thật sự `src/app/` (map init, state toàn cục, markers, popup, CRUD/GAS, GPS, bootstrap) — rủi ro cao nhất, làm riêng từng cụm.
- Cụm runtime khác còn inline: xoay map, polygon/ranh, voice/QR, thông báo, SuCo/BaoTri/NhiemVu, Dashboard, filter, routing.
