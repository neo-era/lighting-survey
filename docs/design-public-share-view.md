# Thiết kế: Link chia sẻ công khai (read-only) theo địa bàn — v1.0.136+

## Mục tiêu
Admin tạo được 1 link công khai cho mỗi địa bàn. Mở link → bản đồ hiển thị **toàn bộ trụ/tủ** của địa bàn,
**không cần đăng nhập, không có bảng điều khiển ☰**, chỉ xem (không sửa/xóa/kéo). Gửi cho ai cũng xem được.

## Tiêu chí đạt (Bước 0 — đã chốt)
- URL `…/lighting-survey/?view=<TênSheet>` → vào thẳng chế độ xem công khai, bỏ qua login.
- Hiển thị trụ/tủ của đúng địa bàn đó (đọc CSV công khai đã publish — không cần backend/auth mới).
- **Ẩn hoàn toàn:** ☰ (bảng điều khiển), login, nút thêm/sửa/xóa/kéo marker, căn thẳng tuyến, cáp edit, GitHub, xuất dữ liệu.
- **Popup trụ:** đầy đủ kỹ thuật + **giữ ảnh**, nhưng **ẩn Người khảo sát**; chỉ còn 2 nút **Đi đến + Street View**.
- **Đầu trang:** thanh header mảnh `💡 Chiếu sáng — <nhãn địa bàn> · N trụ/tủ · [Cài ứng dụng]`.
- **Admin lấy link:** nút `🔗 Chia sẻ địa bàn` (chỉ admin) trong ☰ → modal hiện link + Copy + Mở thử.
- PWA vẫn cài được; chạy mượt mobile/desktop.

### Ca biên/ca xấu
- `?view=` trỏ sheet không tồn tại / không có csvUrl → trang báo "Địa bàn không hợp lệ", không rơi về login.
- CSV lỗi/mạng → báo lỗi rõ, không trắng trang.
- Địa bàn tạo động (sheet DiaBan) → `_loadDynamicDistricts()` trước rồi resolve.
- Người xem không có token/khóa gì → vẫn xem được (CSV vốn công khai). KHÔNG lộ Người KS.

## Kiến trúc — tái dùng index.html, thêm chế độ `_publicView`
Không tạo trang riêng: cùng `index.html`, phát hiện `?view=` lúc `checkAuth()`.

### Vai trò `public`
`currentUser = {username:'public', role:'public', vung:[sheet]}`. Mọi `canEdit/canDelete/canDrag/canGithubSync`
trả false (role 'public' ∉ danh sách) → popup tự rút còn **Đi đến + Street View** (nhánh else sẵn có), không có
nút Căn thẳng/Cáp. Không cần sửa logic quyền.

### Luồng
```
checkAuth():
  pv = ?view
  nếu pv → _startPublicView(pv); return     (bỏ login)
  … (như cũ)

_startPublicView(sheet):
  _publicView = true; body.classList.add('public-view')
  await _loadDynamicDistricts() (gộp địa bàn động)
  page = DISTRICT_PAGES.find(sheet có csvUrl); không có → _publicError('Địa bàn không hợp lệ')
  currentUser = {username:'public', role:'public', vung:[sheet]}
  ẩn login/☰/topbarUser (qua class public-view + CSS)
  dựng header mảnh (nhãn + nút cài app)
  currentSheet = sheet; loadFromCSVWithCache(sheet, page.csvUrl) → fitBounds
  cập nhật số đếm trên header sau khi marker load
```

### Hàm thuần (test được) — mốc `@@PUBLICVIEW_START/END` trong index.html
- `_parsePublicView(search)` — lấy `view` từ query string (trim); rỗng → ''.
- `_resolvePublicPage(sheet, pages)` — tìm page theo sheet, phải có csvUrl; không có → null.
- `_shareLinkFor(origin, pathname, sheet)` — ghép link chia sẻ (encode sheet).

### Thay đổi code (index.html)
1. `checkAuth()` — nhánh public ở đầu.
2. `_startPublicView`, `_publicError`, `_publicHeaderCount()` — mới.
3. Popup: dòng Người KS thêm điều kiện `&& !_publicView`.
4. Markup: `#publicHeader` (ẩn mặc định, hiện khi public) + modal `#shareDistrictModal`.
5. Nút admin `🔗 Chia sẻ địa bàn` trong ☰ (ẩn/hiện trong `_applyRoleUI` như các nút admin khác).
6. CSS `body.public-view`: ẩn `#topBar`, `#loginOverlay`, `#topbarUser`, FAB không cần; `#map { top:44px }` chừa header.
7. PWA: bắt `beforeinstallprompt` → nút "Cài ứng dụng" trên header; iOS → hướng dẫn ngắn.
8. `sw.js`: bump cache.

## Bảo mật/riêng tư
- CSV địa bàn vốn đã publish công khai → link không lộ thêm gì ngoài vị trí trụ. **Ẩn Người KS** theo yêu cầu.
- Không có ghi dữ liệu nào trong chế độ public (mọi nút ghi đã ẩn + quyền false). GAS không bị gọi ghi.
- Link không chứa bí mật; ai có link đều xem được (đúng mục đích).

## Kiểm chứng (Bước 5)
- Unit: `_parsePublicView`, `_resolvePublicPage`, `_shareLinkFor`.
- Smoke trình duyệt: mở `?view=Quan1` → không login, không ☰, có header + marker; popup không có Người KS, chỉ 2 nút.
- Thử `?view=SaiTên` → báo lỗi. Admin đăng nhập → thấy nút Chia sẻ, copy link đúng.
