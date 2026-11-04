# Phân nhóm, phân quyền, quản lý người dùng — thiết kế v211

## Hiện trạng (2026-11-04)
- Sheet `TaiKhoan`: A=tên đăng nhập, B=mật khẩu (hash PBKDF2), C=họ tên, D=vai trò, E=vùng (danh sách tab, trống = tất cả).
- 4 vai trò **cố định trong code**: `admin` / `user` / `user1` / `demo`. Quyền kiểm tra **chỉ ở app** (`canEdit/canDelete/canDrag/canGithubSync`, ~40 chỗ `role === 'admin'`).
- **GAS không kiểm quyền các lệnh ghi** (`full_update`, `delete_row`, `batch_*`…): ai biết URL GAS là ghi/xoá được. Chỉ các lệnh quản trị kiểm mật khẩu admin gửi kèm.
- Đăng nhập lưu `ks_user` trong localStorage **vô thời hạn** → đổi vai trò/khoá tài khoản không có tác dụng tới khi người đó tự đăng xuất.
- Admin có hộp "👥 Quản lý tài khoản": xem / tạo / sửa / đặt lại mật khẩu / xoá.

## Mục tiêu (anh chốt: "Cả hai")
1. **Nhóm = đơn vị/đội** (vd Xí nghiệp CS1, Đội Quận 8): gán **địa bàn** cho cả nhóm; người vào nhóm hưởng theo.
2. **Vai trò tự định nghĩa**: admin tạo vai trò (vd "Giám sát", "Tư vấn") và tích chọn từng **quyền thao tác**.
3. **Quản lý người dùng** đầy đủ: khoá/mở, nhóm, vai trò, lần đăng nhập cuối, nhật ký.
4. Quyền phải được **máy chủ (GAS) kiểm thật**, không chỉ ẩn nút trên app.

## Tiêu chí "chạy đúng" (Chốt 1)

| # | Tiêu chí | Đo bằng |
|---|---|---|
| T1 | **Danh mục quyền** cố định trong code (khoá + nhãn tiếng Việt), phủ hết thao tác hiện có — bảng dưới | test đối chiếu: mọi action ghi trong `doPost` đều gắn ≥1 quyền |
| T2 | **Vai trò** lưu ở sheet `VaiTro` (mã, tên, danh sách quyền, hệ thống?, ghi chú). Tự tạo 4 vai trò hệ thống tương đương hiện nay (admin/user/user1/demo) → **không ai đổi quyền sau khi nâng cấp** | test: quyền hiệu lực của 4 vai trò cũ = hành vi `canEdit/canDelete/canDrag/canGithubSync/isAdmin` hiện tại |
| T3 | Admin **tạo/sửa/xoá** vai trò tự định nghĩa; vai trò hệ thống không xoá được, vai trò `admin` luôn đủ mọi quyền và không sửa được; không xoá vai trò đang có người dùng | test GAS |
| T4 | **Nhóm** lưu ở sheet `NhomNguoiDung` (mã, tên, địa bàn, ghi chú, trạng thái). Admin tạo/sửa/xoá; không xoá nhóm còn thành viên | test GAS |
| T5 | `TaiKhoan` thêm cột **F=nhóm** (mã nhóm, nhiều nhóm cách dấu phẩy), **G=trạng thái** (`hoat_dong`/`khoa`), **H=hết hạn**, **I=đăng nhập cuối**, J=số phiên, K=UID, L=buộc đổi MK (12 cột). Cột A–E giữ nguyên ý nghĩa | đọc file cũ 5 cột vẫn chạy |
| T6 | **Địa bàn hiệu lực** = hợp (vùng riêng E) ∪ (địa bàn các nhóm). Không có vùng riêng và không nhóm nào giới hạn → **tất cả** (giữ nghĩa cũ "trống = tất cả"). Nhóm có địa bàn trống = tất cả. Admin luôn tất cả | test hàm thuần `_effDistricts` nhiều ca |
| T7 | **Phiên đăng nhập có token**: login trả `token` ký HMAC-SHA256 (khoá bí mật trong Script Properties), hạn 30 ngày. App gửi token kèm mọi lệnh tới GAS | test ký/giải: đúng, sai chữ ký, hết hạn, sửa nội dung → từ chối |
| T8 | **GAS kiểm quyền mọi lệnh ghi**: token hợp lệ + tài khoản đang hoạt động + vai trò có quyền của lệnh + tab nằm trong địa bàn hiệu lực. Đọc lại quyền từ sheet mỗi lần (có cache ≤ 60 giây) → **khoá tài khoản / đổi vai trò có hiệu lực trong ≤ 1 phút** | test GAS: user1 xoá → bị chặn; tab ngoài địa bàn → bị chặn; tài khoản bị khoá → bị chặn |
| T9 | **Chuyển tiếp an toàn**: Script Property `AUTH_MODE` = `log` (mặc định sau nâng cấp: cho qua nhưng ghi `LichSu` "auth_violation") / `on` (chặn) / `off`. Admin bật `on` trong app khi các máy đã cập nhật | test 3 chế độ |
| T10 | App **làm mới hồ sơ** mỗi lần mở (`whoami` bằng token): cập nhật vai trò/quyền/địa bàn; token hết hạn / tài khoản bị khoá → về màn đăng nhập | test app |
| T11 | App ẩn/hiện nút theo **quyền** (không theo tên vai trò): thay `canEdit/canDelete/…` và các chỗ `role === 'admin'` bằng `hasPerm('…')`; `_allowedPages()` dùng địa bàn hiệu lực từ máy chủ | test: không còn so sánh `role === 'admin'` ngoài lớp tương thích |
| T12 | **Không tự khoá mình ra ngoài**: không khoá/xoá/hạ quyền chính mình; luôn còn ≥ 1 tài khoản đang hoạt động có quyền quản lý người dùng | test GAS |
| T13 | Tài khoản bị **khoá** không đăng nhập được (thông báo rõ "Tài khoản đã bị khoá — liên hệ quản trị"); mở khoá dùng lại ngay | test |
| T14 | Mọi thay đổi người dùng / nhóm / vai trò / chế độ kiểm quyền ghi `LichSu` (ai, lúc nào, đổi gì) | test |
| T15 | **Giao diện** "👥 Quản lý người dùng" 3 thẻ: Người dùng · Nhóm · Vai trò. Có tìm kiếm, lọc theo nhóm/vai trò/trạng thái; ma trận tích quyền cho vai trò; chạy tốt trên điện thoại (dọc + ngang), sáng/tối, phím Tab/Esc | chốt UI 2–3 phương án + ảnh chụp |
| T16 | Không hỏng tính năng cũ: toàn bộ test hiện có đạt (trừ `css-extract` hỏng sẵn); bản xem công khai (link chia sẻ, không đăng nhập) vẫn xem được | `node tests/*.test.*` |

### Danh mục quyền (T1)

| Khoá | Nhãn | Thay cho | Lệnh GAS cần quyền |
|---|---|---|---|
| `xem` | Xem bản đồ | (mọi người) | — |
| `them_sua` | Thêm / sửa trụ, tủ | `canEdit` | `full_update`, `log_action`, `upload_image` |
| `xoa` | Xoá trụ, tủ | `canDelete` | `delete_row` |
| `di_chuyen` | Dời vị trí, sửa cáp | `canDrag` | (qua `full_update` / `batch_match_update` khi chỉ đổi toạ độ/cáp) |
| `nhap_hang_loat` | Nhập CSV/Excel, công cụ hàng loạt | — | `batch_import`, `batch_match_update`, `assign_phases`, `fill_marker_goc*`, `normalize_coords`, `fix_loai`, `purge_no_gps`, `backup_pre_import` |
| `su_co` | Báo / cập nhật sự cố | `canEdit` / `canDelete` | `report_suco`, `update_suco` |
| `bao_tri` | Quản lý bảo trì, nhiệm vụ | admin | `create_bao_tri`, `complete_bao_tri`, `create_nhiem_vu`, `update_nhiem_vu_status` |
| `xuat_du_lieu` | Xuất CAD / báo cáo / in | (mọi người có đăng nhập) | — |
| `github` | Đồng bộ GitHub | `canGithubSync` | `upload_to_github` |
| `chia_se` | Tạo link chia sẻ công khai | admin | — |
| `lich_su` | Xem lịch sử thao tác, camera, đèn tắt | admin | — |
| `dia_ban` | Tạo / lưu trữ / xoá địa bàn, đường tự vẽ, preset offset | admin | `create_dia_ban`, `archive/restore/delete_dia_ban`, `save/delete_road`, `save/delete_preset` |
| `sao_luu` | Sao lưu & khôi phục | admin | `backup_now`, `list_backups`, `restore_*` |
| `bao_cao` | Gửi báo cáo ngày/tháng | admin | `send_*_report` |
| `quan_tri` | Quản lý người dùng, nhóm, vai trò | admin | `list/create/update/delete_user`, `reset_password`, nhóm, vai trò, `set_auth_mode` |

Vai trò hệ thống: `admin` = tất cả · `user` = xem, them_sua, xoa, di_chuyen, nhap_hang_loat, su_co, xuat_du_lieu · `user1` = xem, them_sua, su_co, xuat_du_lieu · `demo` = xem, xuat_du_lieu.

### Ca xấu cần chịu được
- Sheet `VaiTro`/`NhomNguoiDung` chưa có → tự tạo + gieo dữ liệu mặc định; dòng hỏng / quyền lạ → bỏ qua, không sập.
- Người dùng có vai trò không còn tồn tại → coi như `demo` (chỉ xem) + cảnh báo trong danh sách.
- Nhóm ghi trong cột F không tồn tại → bỏ qua nhóm đó.
- Đổi tên đăng nhập (đã có `change_credentials`) → token cũ hết hiệu lực, phải đăng nhập lại.
- Hai admin sửa cùng lúc → `_withScriptLock`.
- Mất khoá bí mật (Script Property bị xoá) → tự sinh khoá mới, mọi phiên cũ phải đăng nhập lại (không sập).

## Bổ sung sau Chốt 1 (bắt buộc từ 2 chuyên gia + quyết định của anh)

**Phạm vi (anh chốt 2026-11-04): chỉ chặn GHI.** Địa bàn hiệu lực giới hạn lệnh ghi; XEM dữ liệu trụ/tủ vẫn qua CSV công khai (ai có link là xem được). Giới hạn này hiện rõ trong hộp quản lý người dùng.
Đi kèm (anh tự làm): đổi "Publish to web" từ *toàn bộ tài liệu* sang *chỉ các tab địa bàn* — hiện các tab TaiKhoan, Phan quyen, LichSu, Setting đang công khai. Tab mới (VaiTro, NhomNguoiDung) **không** được publish.

| # | Thay đổi | Từ |
|---|---|---|
| B1 | **Mặc định từ chối**: "tất cả địa bàn" phải ghi tường minh `*`; ô trống = không địa bàn nào (chỉ xem). Chuyển đổi một lần: tài khoản cũ có vùng trống → `*`. Nhóm có địa bàn trống = không cấp gì | IAM |
| B2 | **Chỉ ghi vào tab địa bàn**: mọi lệnh ghi có `sheet` phải là tab địa bàn thật (danh sách cứng + sheet DiaBan + EXTERNAL_SPREADSHEET_IDS); tab hệ thống (TaiKhoan, VaiTro, LichSu…) hoặc tên lạ → lỗi, **không** rơi về DanhSachTru. Kiểm địa bàn trên tên tab đã tra | GAS |
| B3 | Lệnh có xoá dòng (`delete_row`, `purge_no_gps`) đều cần `xoa`; `purge_no_gps` cần `xoa` + `nhap_hang_loat`. Test: mọi lệnh xoá dòng cần `xoa` | IAM |
| B4 | `di_chuyen` phía máy chủ: `full_update` / `batch_match_update` cần `them_sua`; người chỉ có `di_chuyen` thì chỉ được đổi cột toạ độ/VN2000/cáp (Lat, Lon, VN2000-X/Y, Marker gốc, Khoảng cách, Thời gian cập nhật, Label offset). Ghi rõ: người có `them_sua` vẫn dời được trụ qua sửa toạ độ — `di_chuyen` khác `them_sua` chủ yếu ở giao diện | IAM+GAS |
| B5 | Tách quyền: `xuat_du_lieu` (xuất trong địa bàn được giao) / `xuat_toan_bo`; `lich_su` (nhật ký) / `giam_sat` (camera, đèn tắt); `bao_tri` / `nhiem_vu`. Mỗi lần xuất ghi LichSu qua lệnh `log_export`. Vai trò không tồn tại → chỉ `xem` | IAM |
| B6 | **Nhật ký đáng tin**: người thực hiện lấy từ token, bỏ qua giá trị app gửi. GAS tự ghi: đăng nhập thành công/thất bại, lệnh bị từ chối, xuất dữ liệu, mọi thay đổi người dùng/nhóm/vai trò/chế độ | IAM+GAS |
| B7 | **Vòng đời tài khoản**: thêm cột hết hạn; vai trò đánh dấu "bên ngoài" (vd Tư vấn/Nhà thầu) bắt buộc có hạn, quá hạn tự khoá, token chỉ 7 ngày. Đặt lại mật khẩu → mật khẩu tạm, buộc đổi ở lần đăng nhập đầu. Nghỉ việc → **khoá**, chỉ xoá được tài khoản chưa từng đăng nhập. Khoá có bước **bàn giao** sự cố/nhiệm vụ đang mở sang người khác | IAM |
| B8 | **Chống dò mật khẩu thật**: đếm sai theo tên đăng nhập bằng CacheService (biến toàn cục không giữ giữa các lượt chạy) — 5 lần sai → khoá đăng nhập 15 phút | GAS |
| B9 | **Thu hồi token**: cột `sv` (số phiên) + `uid` cố định. Token = `{uid, sv, iat, exp}` ký HMAC-SHA256, mã hoá base64 web-safe, so chữ ký thời gian cố định. Tăng `sv` khi đổi/đặt lại mật khẩu, khoá, đổi tên, "đăng xuất mọi máy". Admin đổi gì thì xoá cache người đó ngay | GAS+IAM |
| B10 | **Khoá bí mật HMAC**: chỉ sinh khi `getProperty` trả null (đọc lỗi → báo lỗi, không sinh lại); sinh trong LockService | GAS |
| B11 | **Thứ tự kiểm**: `ping`/`login` → `_authorize` → `_bkStaleResponse` → lệnh. `check_sheet`, `get_daily_report` cũng cần quyền | GAS |
| B12 | **AUTH_MODE**: `log` chỉ nới cho lệnh ghi dữ liệu trụ/tủ/sự cố; lệnh quản trị (`quan_tri`, `sao_luu`, `dia_ban`, `set_auth_mode`, `bao_cao`) **luôn chặn thật**. Bỏ `off` khỏi giao diện (chỉ đặt qua Script Properties). Banner cho admin: số ngày đang ở `log` + số lệnh ghi không token theo từng người 7 ngày qua; nút bật `on` chỉ sáng khi 7 ngày liền = 0 (admin vẫn được bật cưỡng bức có xác nhận). Máy cũ bị chặn nhận `status:'auth_required'` → app báo "Cập nhật app", không mất dữ liệu đang nhập | IAM+GAS |
| B13 | **Gia hạn trượt**: `whoami` trả token mới khi còn < 7 ngày → khảo sát viên không bị đá ra giữa ca | GAS |
| B14 | Luật "không tự khoá" kiểm **trong** `_withScriptLock` | GAS |
| B15 | Đọc cấu hình Script Properties bằng một lần `getProperties()` mỗi lượt chạy; cache gọn theo người (`{status, sv, perms, districts, exp}`) — cache mất thì đọc lại sheet, không coi là từ chối | GAS |
| B16 | Bỏ gửi mật khẩu admin rõ trong mọi lệnh quản trị — dùng token có quyền `quan_tri`; app cũ gửi `adminAuth` vẫn được nhận trong giai đoạn `log` | GAS |

**Nhận thêm (NÊN):** vai trò mẫu (không phải hệ thống, sửa được) "Giám sát/Trưởng XN" (xem, them_sua, di_chuyen, su_co, bao_tri, nhiem_vu, lich_su, xuat_du_lieu) và "Tư vấn/Nhà thầu" (bên ngoài: xem, xuat_du_lieu); người được giao nhiệm vụ tự cập nhật trạng thái nhiệm vụ của mình; danh sách người dùng gắn nhãn "không đăng nhập > 90 ngày" và "sắp hết hạn".
**Không nhận (để sau):** chặn XEM (anh chọn chỉ chặn ghi); quản trị theo nhóm (`quan_tri_nhom`); hạn dùng/thu hồi link chia sẻ; tách TaiKhoan sang file riêng (thay bằng chỉ publish tab địa bàn).

### Danh mục quyền sau Chốt 1
`xem`, `them_sua`, `xoa`, `di_chuyen`, `nhap_hang_loat`, `su_co`, `bao_tri`, `nhiem_vu`, `xuat_du_lieu`, `xuat_toan_bo`, `github`, `chia_se`, `lich_su`, `giam_sat`, `dia_ban`, `sao_luu`, `bao_cao`, `quan_tri` (18 quyền).
Vai trò hệ thống: `admin` = tất cả · `user` = xem, them_sua, xoa, di_chuyen, nhap_hang_loat, su_co, xuat_du_lieu, xuat_toan_bo · `user1` = xem, them_sua, su_co, xuat_du_lieu, xuat_toan_bo · `demo` = xem, xuat_du_lieu, xuat_toan_bo (giữ đúng hành vi hiện tại: ai đăng nhập cũng xuất được).

## Chốt UI — phương án B (danh sách – chi tiết 2 cột)
Mẫu: 3 phương án A (bảng + ngăn kéo), B (danh sách – chi tiết), C (thẻ theo đơn vị + ma trận). Chuyên gia UX chọn **B**, bắt buộc:
U1 vùng chạm ≥ 44px trên điện thoại (tab, chip lọc, dòng danh sách, nút ✕ của chip nhóm) · U2 nút Lưu luôn thấy (đầu khung chi tiết trên máy tính, thanh dưới cố định trên điện thoại), sửa dở mà rời đi → hỏi "Bỏ thay đổi?" · U3 điện thoại ngang (cao < 500px): băng cảnh báo 1 dòng ≤ 40px · U4 điện thoại dọc: chi tiết thay danh sách, nút ‹ / Back quay về danh sách không đóng hộp · U5 Khoá → bước bàn giao rồi xác nhận; Đăng xuất mọi máy / Đặt lại mật khẩu có xác nhận; nút Khoá đỏ, cuối mục, xa nút Lưu · U6 tương phản tối: chữ phụ ≥ 4.5:1, viền ô chưa tích ≥ 3:1 · U7 vai trò hệ thống: khoá ô quyền, không có nút Xoá, chú thích "hệ thống"; xoá vai trò đang dùng → chọn vai trò thay thế.
Nhận thêm: nguồn địa bàn hiệu lực ("Quan5 (nhóm XN2)", "Quan1 (riêng)"); "So sánh vai trò" (ma trận chỉ xem, máy tính); tóm tắt "8/18 quyền · Xem"; nhãn 🔒 Khoá có chữ; đăng nhập cuối trên mỗi dòng; số quyền cạnh số người ở danh sách vai trò; ô tìm + chip lọc dính đầu.

## Kiến trúc (dự kiến — chi tiết sau Chốt 1)
- **Lõi thuần** `src/core/perms.js` (dùng chung app + test; GAS có bản sao khối `@@PERMS` giữa 2 file được test so khớp): danh mục quyền, vai trò hệ thống, `_effPerms`, `_effDistricts`, `_actionPerm`, kiểm tra luật "không tự khoá".
- **GAS**: token (`Utilities.computeHmacSha256Signature`), `_authorize(data)` gọi đầu `doPost`, cache `CacheService` 60 giây, các action nhóm/vai trò, `whoami`, `set_auth_mode`.
- **App**: `src/features/user-admin.js` (hộp quản lý 3 thẻ), `hasPerm()`, gắn token vào mọi `fetch` tới GAS (mở rộng lớp bọc fetch đã có), `whoami` khi mở app.

## Nhật ký duyệt
- 2026-11-04 · Chốt 1 · Chuyên gia nghiệp vụ IAM: DUYỆT CÓ ĐIỀU KIỆN (8 bắt buộc → B1, B3–B7, B12). Chuyên gia bảo mật/GAS: DUYỆT CÓ ĐIỀU KIỆN (8 bắt buộc → B2, B4, B6, B8–B16). Phát hiện kèm: file đang publish toàn bộ tài liệu (lộ TaiKhoan) → đã báo anh sửa. Anh chọn phạm vi "chỉ chặn ghi".
- 2026-11-04 · Chốt UI · Chuyên gia UX: chọn B + ghép ý A/C (U1–U7 bắt buộc).
- 2026-11-04 · Chốt 2 · Chuyên gia bảo mật/IAM: 3 cao + 4 vừa + 4 thấp. Đã sửa: mật khẩu admin kiểu cũ có giới hạn dò + chỉ nhận ở chế độ log; `upload_to_github` chỉ `data/*.xlsx`; quyền chỉ-dời không đổi tên/không tạo trụ; khoá quản trị cuối qua ngày hết hạn; `change_credentials` (khoá, trạng thái, định dạng tên); thời gian đăng nhập không lộ tên; bỏ `_authUser` client gửi; giới hạn bộ đếm vi phạm; dòng TaiKhoan thêm tay tự cấp UID; hàm `resetLoginLock` mở khoá khẩn cấp. **Còn lại (báo anh):** API đọc `doGet` + `api_key` (sự cố); sự cố/ảnh/đường tự vẽ chưa giới hạn địa bàn; chế độ log không chặn lệnh thiếu phiên; ai có `quan_tri` = siêu quản trị; token 30 ngày trong localStorage.
- 2026-11-04 · Chốt 2 · Chuyên gia QA: 2 cao + 4 vừa + 6 thấp. Đã sửa: mất mạng lúc mở app không bắt đăng nhập (chờ có mạng); lưu bị từ chối vì phiên → giữ lại, tự lưu tiếp sau đăng nhập (kể cả ảnh); sửa cáp/dời gửi đúng trường vị trí (quyền `di_chuyen` dùng được); nút Sự cố theo quyền `su_co`; chặn + ghi nhật ký mọi đường xuất (Excel mới/sửa, CAD nhanh, BOM, tính điện, sự cố; hồ sơ ghi SAU khi xác nhận); chế độ `off` không ghi vi phạm; whoami thu hẹp địa bàn → tự chuyển địa bàn được phép; nút chạm ≥44px trên điện thoại; đóng hộp quản lý không để thừa lịch sử Back. Giữ nguyên: nút Lưu ở đầu khung chi tiết (dính, luôn thấy) thay vì đáy; khoá không bàn giao vẫn cho chọn.

