# Wave 3 UX — Manual verification checklist

## 4.2 Toast helpers (browser DevTools console)
- [ ] `displaySuccess('OK')` → toast xanh lá, 4s auto-hide
- [ ] `displayWarning('Cảnh báo')` → toast vàng
- [ ] `displayError('Lỗi')` → toast đỏ (như cũ)
- [ ] `displayInfo('Đang tải')` → toast xanh dương (như cũ)
- [ ] Toast mới đè toast cũ (không stack, không leak timer)

## 4.1 uiConfirm/uiPrompt (browser DevTools console)
- [ ] `await uiConfirm('Xóa marker?')` → Bootstrap modal hiện, click "OK" → resolve true
- [ ] `await uiConfirm('Xóa?')` → click "Hủy" hoặc close X → resolve false
- [ ] `await uiConfirm('Xóa?')` khi Bootstrap chưa load → fallback native confirm, vẫn return true/false
- [ ] `await uiPrompt('Tên?', 'default')` → input hiện, submit → resolve string, cancel → resolve null
- [ ] Gọi 2 uiConfirm song song → cái sau chờ cái trước xong (queue behavior)

## 4.4 Focus trap #markerPopupForm
- [ ] Mở popup thêm marker → focus tự động vào input `#markerNameInput`
- [ ] Bấm Esc → popup đóng (giống bấm Hủy)
- [ ] Esc khi đang chọn text trong textarea → chỉ đóng popup, không phá selection
- [ ] Tab từ input cuối → focus quay về input đầu (trap)
- [ ] Shift+Tab từ input đầu → focus tới input cuối (trap ngược)
- [ ] Popup không hiển thị (display:none) → Esc không trigger gì

## Regression
- [ ] `showMarkerPopupAt(10.7, 106.6)` từ DevTools → popup mở như cũ
- [ ] `hideMarkerPopup()` → popup đóng, không leak listener
- [ ] Save marker → popup đóng + toast thành công (không có regression toast)
- [ ] Xóa marker → confirm dialog (native cho giờ) → OK → xóa
