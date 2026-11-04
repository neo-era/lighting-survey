# Sao lưu dữ liệu (backup) — thiết kế v210

## Mục tiêu
Không mất dữ liệu khảo sát khi có người xoá nhầm, nhập CSV sai hoặc sửa hàng loạt sai.
Dữ liệu vẫn nằm ở Google Sheet; backup = **bản sao nguyên file Google Sheet** trên Google Drive.
Không thay đổi cấu trúc dữ liệu đang chạy.

## Nguồn cần sao lưu
- File Google Sheet chính (chứa GAS) — gồm mọi tab: DanhSachTru, các địa bàn, TaiKhoan, LichSu, DiaBan, SuCo, BaoTri, OffsetPresets…
- Mỗi file ngoài trong `EXTERNAL_SPREADSHEET_IDS` (hiện có CanGiuoc). Trùng ID chỉ chép 1 lần.
- Ngoài phạm vi: ảnh khảo sát (đã nằm trên Drive), file GitHub.

## Tiêu chí "chạy đúng" (Chốt 1)

| # | Tiêu chí | Đo bằng |
|---|---|---|
| T1 | **Tự động hằng ngày**: trigger chạy 1 lần/ngày khoảng 01:00 (giờ VN), chép mọi nguồn vào thư mục Drive `LightingSurvey_Backup` | Chạy `setupDailyBackupTrigger()` → thấy trigger `dailyBackup`; chạy tay `dailyBackup()` → có bản sao |
| T2 | **Sao lưu ngay**: admin bấm nút trong ☰ → chép mọi nguồn, trả danh sách bản vừa tạo | Action `backup_now` |
| T3 | Chỉ **admin** gọi được `backup_now` / `list_backups` / `restore_backup_sheet` (kiểm mật khẩu như các action admin khác) | Sai mật khẩu / role khác → lỗi |
| T4 | Tên bản sao đọc được: `<tên file> — backup 2026-11-04 01-05 (tự động)` / `(tay: admin)` / `(trước khôi phục: admin)`; mô tả file chứa JSON `{app:'lighting-survey-backup', v:1, src, kind, by, at}` để nhận diện | Unit test `_bkName`, `_bkMeta` |
| T5 | **Giữ có giới hạn**: mỗi nguồn giữ 30 bản tự động + 20 bản tay/trước-khôi-phục mới nhất; bản cũ hơn **cho vào Thùng rác Drive** (khôi phục được 30 ngày), không xoá vĩnh viễn; file không có mô tả của app thì **không bao giờ đụng** | Unit test `_bkPickToTrash` |
| T6 | Chống bấm liên tục: sao lưu tay cách nhau ≥ 5 phút | Unit test + action trả lỗi |
| T7 | **Danh sách bản sao** trong app: thời gian, loại, người, nguồn, nút mở trên Drive, nút tải Excel | Action `list_backups` (mới nhất trước, tối đa 60) |
| T8 | **Khôi phục 1 địa bàn** từ 1 bản sao: admin chọn tab, gõ đúng tên tab để xác nhận → GAS **tự sao lưu "trước khôi phục"** file đích, rồi ghi đè tab đó bằng dữ liệu trong bản sao; ghi LichSu | Action `restore_backup_sheet` |
| T9 | Khôi phục chỉ cho **tab dữ liệu trụ** (dòng 1 có cột "Tên trụ") — không cho khôi phục TaiKhoan/LichSu…; tab phải có trong cả bản sao lẫn file đích; bản sao phải là bản sao của đúng file nguồn | Unit test `_bkValidateRestore` |
| T10 | Lỗi 1 nguồn (vd không mở được file ngoài) không làm hỏng nguồn khác; kết quả báo nguồn nào lỗi | Kết quả `{ok:[…], failed:[…]}` |
| T11 | Ghi `LichSu` cho: backup tay, khôi phục (loại `backup` / `restore_backup`) | |
| T12 | Không ảnh hưởng tính năng cũ: toàn bộ test hiện có vẫn đạt (trừ `css-extract` đang lỗi sẵn) | `npx vitest run` + test node |

### Ca xấu cần chịu được
- Thư mục backup bị xoá/đổi → tự tạo lại (lưu ID ở Script Properties `BACKUP_FOLDER_ID`, kiểm `isTrashed`).
- Mô tả file hỏng / không phải JSON → bỏ qua file đó (không xoá).
- Bản sao không có tab cần khôi phục, hoặc header khác → từ chối, không ghi gì.
- Khôi phục khi đang có người ghi → dùng `_withScriptLock`.
- Tab bản sao có ít dòng hơn tab hiện tại → xoá phần dư (clearContent toàn tab rồi ghi).

## Kiến trúc
**GAS (`gas-khaosat.js`)** — khối `@@BACKUP_START … @@BACKUP_END`:
- Hàm thuần (test bằng Node): `_bkStamp(date)`, `_bkName(srcName, date, kind, by)`, `_bkMeta(obj)`/`_bkParseMeta(desc)`, `_bkPickToTrash(items, keep)`, `_bkValidateRestore(req)`, `_bkTooSoon(lastIso, nowMs)`.
- Hàm Drive: `_bkFolder()`, `_bkSources()`, `_bkRun(kind, by)`, `_bkListItems()`, `_bkApplyRetention()`.
- Trigger: `dailyBackup()`, `setupDailyBackupTrigger()`, `removeDailyBackupTrigger()`.
- Action: `backup_now`, `list_backups`, `restore_backup_sheet` (2 action ghi bọc `_withScriptLock`).

**Client** — `src/features/backup.js` (classic script, nạp như các file đợt 3):
- Section `#sec-backup` trong ☰ (chỉ admin): nút **Sao lưu ngay**, nút **Danh sách bản sao** → modal liệt kê + nút Mở / Tải Excel / Khôi phục.
- Khôi phục: chọn tab (mặc định địa bàn đang xem) → `prompt` gõ tên tab → gọi GAS → tải lại địa bàn.
- Dùng `_getAdminAuth()` có sẵn.

## Triển khai
1. Dán `gas-khaosat.js` → Deploy **New version**.
2. Trong Apps Script chọn hàm `setupDailyBackupTrigger` → Run 1 lần (cấp quyền Drive + Gmail, tạo thư mục `LightingSurvey_Backup`).
3. App: SW cache v210 (tự cập nhật).

## Cần kiểm trên Google thật (chưa giả lập được)
- Bấm "Sao lưu ngay" → mở bản sao: có kéo theo dự án Apps Script không; nếu có, Script Properties (GITHUB_TOKEN) có bị chép theo không.
- Khôi phục thử 1 địa bàn ít dòng: tab giữ nguyên gid (CSV publish vẫn đọc được), số thập phân dấu phẩy giữ đúng.
- Độ trễ CSV publish sau khôi phục có ≤ 6 phút không.
- Sáng hôm sau: có bản "(tự động)" lúc 01–02h; ☰ hiện "Bản tự động gần nhất: … giờ trước".
- Thời gian sao lưu/khôi phục với file lớn nhất (Quận 8 ~13k dòng) — phải < 6 phút/lượt.

## Bổ sung sau Chốt 1 (bắt buộc từ chuyên gia)
| # | Thay đổi | Áp dụng |
|---|---|---|
| B1 | Sao lưu **trước thao tác hàng loạt** (nhập CSV, gán pha, áp MST, điền địa chỉ, công cụ dữ liệu) — action `backup_pre_import` (không cần admin, chỉ chép file chứa tab đó; có bản <15 phút thì dùng lại) | client gọi `_bkPreBatch()` trước khi ghi; lỗi → hỏi có tiếp tục không |
| B2 | Khôi phục: **xem trước** (`restore_preview`: số dòng hiện tại / trong bản sao / số dòng chỉ có ở hiện tại / số dòng `capNhat` sau giờ sao lưu); bắt buộc **lý do**; trước khi ghi đè chép nguyên tab hiện tại thành tab ẩn `_TruocKP_<tab>_<stamp>` trong file đích + sao lưu "trước khôi phục" cả file | thay cho lọc từng dòng "mới hơn" (cùng mục đích, không đổi kiểu dữ liệu) |
| B3 | **Máy đang mở dữ liệu cũ**: khôi phục xong GAS lưu mốc `BK_EPOCH_<tab>` (giờ server); trong 30 ngày, lệnh ghi vào tab đó phải kèm `clientEpochSeen` ≥ mốc, không thì trả `status:'stale'` + `restoredAt` + `serverNow`. App chỉ ghi nhận đã thấy mốc (localStorage `bk_epoch_seen`) **sau khi tải lại**, và chỉ tải lại khi `serverNow ≥ restoredAt + 6 phút` (CSV "Publish to web" có độ trễ) — chưa đủ thì báo chờ và hẹn tự tải lại. Chỉ so giờ server với giờ server → đồng hồ điện thoại lệch không ảnh hưởng | client gắn `clientEpochSeen` qua 1 lớp bọc `fetch` (chỉ khớp URL đúng bằng `KHAOSAT_GAS_URL`). ⚠ Công cụ chạy ngoài trình duyệt (vd script import) ghi vào tab vừa khôi phục trong 30 ngày phải gửi `clientEpochSeen` |
| B4 | Ghép header: cho phép khi header bản sao là **phần đầu** của header hiện tại (theo `norm()`), cột thêm sau để trống, header dòng 1 giữ nguyên bản hiện tại; thiếu cột lõi / khác thứ tự → từ chối | `_bkValidateRestore` |
| B5 | Trigger lỗi không ai hay: ☰ hiện "Bản tự động gần nhất: X giờ trước", đỏ khi > 36 giờ; lỗi → email chủ script + LichSu `backup_failed` | |
| B6 | Bảo mật: thư mục backup luôn PRIVATE (mỗi lần chạy kiểm và đặt lại); không bao giờ chia sẻ link | ⚠ cần anh kiểm trên máy thật: bản sao file có kéo theo Script Properties (GITHUB_TOKEN) không |
| B7 | Khôi phục **không dùng `getSheet()`** (có nhánh dự phòng ngầm) → `_bkTargetSheet(tab)` mở đúng file, thiếu thì báo lỗi | |
| B8 | Ghi đè bằng `Sheet.copyTo` (tab tạm) + `Range.copyTo` — giữ kiểu dữ liệu/định dạng, giữ nguyên tab (gid không đổi vì CSV publish theo gid) | |
| B9 | Khoá: sao lưu chỉ khoá ngắn quanh kiểm 5 phút; khôi phục giữ khoá suốt | |
| B10 | Trigger `.atHour(1).everyDays(1).inTimezone('Asia/Ho_Chi_Minh')`; setup chạy lại vẫn chỉ 1 trigger; tên dùng `Utilities.formatDate(…,'Asia/Ho_Chi_Minh',…)` | trigger chạy trong khung 01:00–02:00 |
| B11 | Chỉ bỏ Thùng rác file: meta.app khớp + nằm trong thư mục backup + chủ sở hữu là tài khoản chạy script; lỗi từng file → ghi `failed` | |
| B12 | Giữ bản: tự động 30 ngày gần nhất + 1 bản/tuần × 8 tuần + 1 bản/tháng × 12 tháng; tay 20; trước khôi phục 20; trước nhập 20 (nhóm riêng) | góp ý NÊN của chuyên gia nghiệp vụ, nhận |

Không nhận (để sau): khôi phục theo từng dòng, bản ngoài tài khoản (3-2-1), cờ "giữ vĩnh viễn", diễn tập khôi phục tự động, sao lưu ảnh.

## Nhật ký duyệt
- 2026-11-04 · Chốt 2 vòng 2 · Chuyên gia Apps Script: **DUYỆT** (nhận thêm: tạo lại thư mục backup → email + LichSu `backup_folder_new`). Chuyên gia QA: DUYỆT CÓ ĐIỀU KIỆN — còn `_recalcAllCableDistances` chưa sao lưu trước → đã thêm (≥20 dòng) + test kiểm mọi lối ghi hàng loạt có `_bkPreBatch`. Không nhận: tự ghi nhận mốc khôi phục lúc đăng nhập (máy mới bị chặn đúng 1 lần, phải tải lại — chấp nhận để không tin dữ liệu cache cũ); dừng sớm vòng `syncRowToGAS` từng dòng khi stale (vô hại, mọi lệnh đều bị chặn).
- 2026-11-04 · Chốt 2 vòng 1 · Chuyên gia Apps Script: DUYỆT CÓ ĐIỀU KIỆN — 7 bắt buộc Chốt 1 đạt; 3 bắt buộc mới: (1) stale so giờ máy với giờ server, (2) chưa tính độ trễ CSV publish, (3) `_bkFolder` tạo thư mục mới khi lỗi tạm thời → đã sửa (B3 viết lại; thư mục chỉ tạo mới khi "không tìm thấy"). Nhận thêm: trước nhập không dọn bản cũ; cờ `BK_RESTORE_INPROGRESS`; giữ 3 tab `_TruocKP_` mới nhất; test đối chiếu danh sách lệnh ghi GAS/app. Chuyên gia QA: DUYỆT CÓ ĐIỀU KIỆN — (1)(2) như trên; (3) thiếu sao lưu trước ở các lối ghi hàng loạt khác → thêm vào `_batchSyncRowsToGAS` (≥20 dòng), cập nhật từ Excel, xoá dòng "XÓA". Nhận thêm: nhập CSV dừng cả đợt khi gặp stale; nút ≥44px trên điện thoại; chữ cảnh báo dùng `--danger-ink` cho nền tối. Không nhận: bắt đăng nhập cho `backup_pre_import` (các lệnh ghi khác cũng chưa kiểm quyền; có giới hạn 15 phút/file).
- 2026-11-04 · Chốt 1 · Chuyên gia Apps Script/Drive: DUYỆT CÓ ĐIỀU KIỆN (7 bắt buộc → B4,B6–B11). Chuyên gia quản trị dữ liệu: DUYỆT CÓ ĐIỀU KIỆN (6 bắt buộc → B1–B6). Mâu thuẫn ở cách ghép header → chọn cách an toàn hơn (phần đầu theo thứ tự, B4).
