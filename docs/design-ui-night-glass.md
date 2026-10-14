# Nâng cấp giao diện — Night Glass (Kính mờ ban đêm)

**Trạng thái:** đã áp (lần 1) · **Ngày:** 2026-10-14

## Chốt
- Phạm vi: TOÀN BỘ — design token + restyle đồng bộ + dark mode (Bước 0).
- Hướng chọn (chốt UI qua 3 mockup): **C · Kính mờ ban đêm** — glass, nhấn teal, dark-first.

## Hệ thống thiết kế (app.css :root)
- Accent: **teal** `--primary #14b8a6` (thay xanh #2563eb generic). Danger rose #e11d48, success teal-green #0d9488, secondary amber #f59e0b.
- Glass: `--surface` translucent + `--blur`/`--blur-strong` (backdrop-filter); shadow teal-tint.
- Font: **Be Vietnam Pro** (thay Inter — chuẩn dấu tiếng Việt).
- Radius mềm hơn (sm10/14/22).

## Dark + Light
- `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` (tự động) + `:root[data-theme="dark"]` (ép tay).
- Nút **Tự động / Sáng / Tối** trong ☰ panel (section "Giao diện") → `setTheme()`; init sớm ở `<head id="theme-init">` tránh nháy; lưu `localStorage.theme`.
- `color-scheme` khai báo để form control/scrollbar theo theme.

## Lớp restyle (cuối app.css)
- backdrop-filter cho topbar (#controlsBtn, .topbar-search), #searchResults, panel (.modal.left .modal-content), .marker-popup-card, export/report modal.
- `.modal-content` nền `--surface-solid` + `color --text` → modal đổ tối.
- focus-visible outline teal; `@media (prefers-reduced-motion) → tắt transition/animation`.

## Token hoá màu
- app.css: 67 hex trung tính/brand → var() (trừ dòng định nghĩa token).
- index.html: 499 thuộc tính `style=` inline → token; `background:#fff`→`var(--surface-solid)`, giữ `color:#fff`.

## Còn lại (lượt token hoá sâu — đang làm)
- 171 thuộc tính `style=` vẫn còn hex literal (color:#fff, #78350f amber-ink, vài màu riêng sâu trong modal). Token hoá có kiểm soát để dark mode phủ kín hơn — KHÔNG đụng hex trong JS (màu SVG/chart/DXF).

## Kiểm chứng
- module-split 68/0; full node-test 0 fail; vitest 47/47; css-extract 6/0.
- Xem trước: bản `ui-preview.html` nhúng app.css thật (sáng/tối).
- SW cache bump để client lấy CSS mới.
