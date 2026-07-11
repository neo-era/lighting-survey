# 🎬 Video Tutorial Script — Lighting Survey

Bộ 7 video tutorial cho phần mềm Lighting Survey — tổng thời lượng ~30 phút.

---

## 📋 Chuẩn bị trước khi ghi

### Công cụ ghi hình (miễn phí)

| Tool | OS | Notes |
|---|:---:|---|
| **OBS Studio** | Win/Mac/Linux | Chuyên nghiệp, có scene switcher |
| **ScreenToGif** | Windows | Nhẹ, ghi được GIF/MP4 |
| **QuickTime** | macOS | Built-in, F5 để ghi |
| **Loom** | Web/Chrome | Cloud, share nhanh |
| **CleanShot X** | Mac | Trả phí nhưng đẹp |

### Setup

- **Resolution**: 1920×1080 (Full HD), FPS 30-60
- **Format**: MP4 (H.264, ~5 Mbps)
- **Audio**: Microphone rời (~ Fifine K678, Blue Yeti); tránh mic laptop
- **Trình duyệt**: Chrome (bookmark toolbar ẩn: `Ctrl+Shift+B`)
- **Cursor**: Highlight cursor với **Cursor Highlighter** extension
- **Zoom**: 125% (dễ nhìn trên mobile view)

### Dữ liệu demo

Tạo tài khoản test riêng trước khi ghi để không lộ dữ liệu thật:

```
Username: demo_admin
Password: Demo@2026
Role: admin
Vung: (trống — thấy tất cả)
```

Import ~50 marker mẫu trong Cần Giuộc để có data đẹp.

### Voice over tips

- Nói **chậm, rõ ràng**, tránh "ừm", "à"
- Ngừng 1-2 giây giữa các câu để dễ edit
- Script trước — không ứng khẩu
- Ghi audio riêng bằng Audacity → sync với video (post-production)

---

## 🎥 Video 1 — Giới thiệu & Đăng nhập (2 phút)

**Mục tiêu**: Cho khách hàng thấy giao diện chính, tạo ấn tượng đầu.

### Cảnh 1: Intro (0:00 - 0:15)

**Hiển thị**: Logo Lavipco full screen + fade vào text "Lighting Survey — Khảo sát chiếu sáng công cộng"

**Voice over**:
> "Xin chào! Đây là hướng dẫn sử dụng phần mềm **Lighting Survey** — công cụ khảo sát và quản lý hệ thống chiếu sáng công cộng đô thị, được thiết kế dành riêng cho các phòng Kinh tế Hạ tầng và đơn vị chiếu sáng công cộng tại Việt Nam."

### Cảnh 2: Truy cập app (0:15 - 0:30)

**Hiển thị**: Browser mở `https://neo-era.github.io/lighting-survey/` — screen recording show URL bar

**Voice over**:
> "Phần mềm chạy trên web, không cần cài đặt. Bạn chỉ cần mở trình duyệt Chrome hoặc Safari và truy cập vào đường link được cung cấp."

### Cảnh 3: Đăng nhập (0:30 - 1:15)

**Hiển thị**:
1. Login overlay
2. Type username: `demo_admin`
3. Type password: `Demo@2026` (dots)
4. Click "Đăng nhập"
5. Loading spinner ~2s
6. Map hiện ra + marker cluster

**Voice over**:
> "Nhập tên đăng nhập và mật khẩu được cấp bởi quản trị viên. Phần mềm hỗ trợ **4 mức phân quyền**: admin có toàn quyền, user có thể thêm sửa xóa, user1 chỉ được thêm sửa, và demo chỉ được xem. Sau khi đăng nhập, giao diện chính là bản đồ hiện thị toàn bộ trụ đèn và tủ điều khiển."

### Cảnh 4: PWA install (1:15 - 1:45)

**Hiển thị**:
1. Trên desktop Chrome — click icon Install ở URL bar
2. Dialog "Install Lighting Survey?"
3. Click Install
4. App tách ra như native app

**Voice over**:
> "Bạn có thể cài đặt phần mềm này như một app trên máy tính hoặc điện thoại. Trên Chrome, nhấp vào biểu tượng Install ở thanh địa chỉ. Trên iPhone Safari, chọn **Share → Add to Home Screen**. App sẽ hoạt động ngay cả khi mất kết nối internet."

### Cảnh 5: Ending Video 1 (1:45 - 2:00)

**Hiển thị**: Text overlay "Video tiếp theo: Xem bản đồ & Tìm kiếm"

**Voice over**:
> "Trong video tiếp theo, tôi sẽ hướng dẫn cách tìm kiếm và xem thông tin trụ đèn trên bản đồ."

---

## 🎥 Video 2 — Bản đồ & Tìm kiếm (3 phút)

### Cảnh 1: Zoom + pan (0:00 - 0:30)

**Hiển thị**:
1. Scroll wheel zoom in đến zoom 15 → marker cluster giãn ra
2. Drag map pan qua khu vực khác
3. Zoom về 12 → tủ điều khiển hiện, các trụ ẩn (P25 zoom tier)

**Voice over**:
> "Bản đồ hỗ trợ zoom bằng con lăn chuột hoặc pinch trên điện thoại. Khi zoom xa, phần mềm chỉ hiển thị các tủ điều khiển để tránh rối. Khi zoom gần, các trụ đèn hiện ra chi tiết."

### Cảnh 2: Loại marker (0:30 - 1:15)

**Hiển thị**: Zoom in show 6 loại marker khác màu — pointer highlight từng loại

**Voice over**:
> "Có **6 loại đối tượng**:
> - Trụ STK màu xanh dương
> - Trụ trang trí màu hồng
> - Trụ HTLT màu xanh lá
> - Trụ TTLT màu cam
> - Tủ chiếu sáng nổi màu xanh biển
> - Tủ chiếu sáng ngầm màu xám
>
> Trên mỗi marker có badge nhỏ hiển thị số lượng bóng và công suất, ví dụ '2L100' là 2 bóng LED 100 watt."

### Cảnh 3: Click marker → popup (1:15 - 2:00)

**Hiển thị**:
1. Click 1 marker
2. Popup xuất hiện với: ảnh, tên trụ, tọa độ, loại đèn, công suất, tủ, đường
3. Highlight từng field
4. Nút "🧭 Đi đến" — click → routing

**Voice over**:
> "Nhấn vào bất kỳ marker nào để xem thông tin chi tiết. Popup hiển thị hình ảnh, tên trụ, tọa độ GPS, loại đèn, công suất, tủ điều khiển và địa chỉ. Bạn cũng có thể nhấn 'Đi đến' để mở Google Maps chỉ đường đến vị trí đó."

### Cảnh 4: Tìm kiếm (2:00 - 2:45)

**Hiển thị**:
1. Click hamburger ☰
2. Ô "Tìm kiếm" — type "duong tran hung dao" (không dấu)
3. Enter → results panel hiện list matching
4. Click 1 result → map center + popup mở

**Voice over**:
> "Để tìm nhanh, mở panel điều khiển bằng nút menu, gõ vào ô tìm kiếm — không cần gõ có dấu. Ví dụ 'duong tran hung dao' sẽ tìm được 'Đường Trần Hưng Đạo'. Bạn cũng có thể nhập tên trụ, mã số hoặc tọa độ dạng 'lat,lon'."

### Cảnh 5: Bộ lọc (2:45 - 3:00)

**Hiển thị**: Click nút "⏧ Lọc" → filter overlay show — chọn loại + tủ + Áp dụng → marker filter

**Voice over**:
> "Nút Lọc cho phép hiển thị chỉ những marker cần quan tâm, theo loại, tủ điều khiển, đường hoặc phường xã."

---

## 🎥 Video 3 — Thêm marker mới (3 phút)

### Cảnh 1: Bấm Thêm marker (0:00 - 0:20)

**Hiển thị**: ☰ → nút "+ Thêm marker" — GPS spinner + auto get vị trí

**Voice over**:
> "Để thêm một trụ đèn mới, nhấn 'Thêm marker' trong panel điều khiển. Phần mềm sẽ tự động lấy vị trí GPS hiện tại của bạn."

### Cảnh 2: Chọn tọa độ chính xác (0:20 - 0:45)

**Hiển thị**:
1. Marker tạm hiện trên bản đồ
2. Drag marker đến vị trí chính xác
3. Toast "Đã cập nhật vị trí"

**Voice over**:
> "Nếu vị trí GPS chưa chính xác, bạn có thể kéo marker đến đúng vị trí trụ đèn thực tế. Phần mềm tự động cập nhật tọa độ và tính toán VN-2000."

### Cảnh 3: Điền form (0:45 - 1:45)

**Hiển thị**:
1. Form popup hiện
2. Fill "Tên trụ": Q1_042 (hoặc scan QR nếu có)
3. Chọn "Loại": Trụ STK
4. Điền "Tủ điều khiển": ADV_2
5. Chọn "Loại đèn": LED, "Công suất": 100W, "Số lượng": 2
6. Chọn "Loại trụ": Bê tông
7. Điền "Đường": Trần Hưng Đạo, "Phường": Bến Nghé

**Voice over**:
> "Điền các thông tin cần thiết: tên trụ, loại đối tượng, tủ điều khiển, loại đèn và công suất. Nếu trụ có mã QR dán sẵn, bạn có thể nhấn biểu tượng camera bên cạnh ô tên trụ để scan và tự động điền."

### Cảnh 4: Chụp ảnh (1:45 - 2:20)

**Hiển thị**:
1. Click ô ảnh 1 → camera hoạt động → chụp
2. Click ô ảnh 2 → chọn từ gallery
3. Preview 3 ảnh

**Voice over**:
> "Chụp tối đa 3 ảnh cho mỗi trụ: ảnh toàn cảnh, ảnh đèn cận cảnh và ảnh mã QR. Ảnh sẽ được lưu tự động lên Google Drive."

### Cảnh 5: Ghi âm ghi chú (2:20 - 2:40)

**Hiển thị**:
1. Nút "🎙 Ghi âm ghi chú"
2. Ghi 5 giây "Trụ số 42 nghiêng nhẹ về phía đông, cần chỉnh"
3. Preview player

**Voice over**:
> "Ngoài ghi chú bằng chữ, bạn có thể ghi âm bằng giọng nói — rất tiện khi tay đang bận cầm thiết bị đo."

### Cảnh 6: Lưu (2:40 - 3:00)

**Hiển thị**: Click "💾 Lưu" → toast success → marker hiện trên map

**Voice over**:
> "Nhấn Lưu để đồng bộ marker lên Google Sheet. Dữ liệu sẽ có mặt trên bản đồ của tất cả người dùng khác trong tổ chức ngay lập tức."

---

## 🎥 Video 4 — Sự cố, Bảo trì, Nhiệm vụ (4 phút)

### Cảnh 1: Báo sự cố (0:00 - 1:00)

**Hiển thị**:
1. Click marker → popup → nút "⚠️ Sự cố"
2. Modal: chọn loại "💡 Cháy bóng", mức độ "🔴 Cao"
3. Type mô tả + chụp ảnh
4. Nhấn "Gửi báo cáo"
5. Toast success + marker glow đỏ

**Voice over**:
> "Khi phát hiện sự cố như cháy bóng, tối đèn hay gãy trụ, nhấn nút Sự cố trên popup marker. Chọn loại sự cố, mức độ khẩn cấp, mô tả chi tiết và chụp ảnh minh chứng. Marker sẽ có viền đỏ nhấp nháy để tất cả người dùng khác biết trụ này cần xử lý."

### Cảnh 2: Xử lý sự cố (Admin) (1:00 - 1:45)

**Hiển thị**:
1. ☰ → Chọn trang → "⚠️ Sự cố"
2. Admin panel list sự cố → filter "Chờ xử lý"
3. Click 🎯 → nhảy tới marker
4. Nhấn "Đã xử lý" → status update

**Voice over**:
> "Với quyền admin, mở panel điều khiển, chọn 'Sự cố' để xem danh sách toàn bộ sự cố đang chờ. Có thể lọc theo trạng thái, mức độ, hoặc nhấn biểu tượng đích để nhảy đến vị trí trụ trên bản đồ."

### Cảnh 3: Lịch bảo trì (1:45 - 2:45)

**Hiển thị**:
1. Popup marker → nút "🔧 Bảo trì" (admin only)
2. Modal tạo lịch: loại "💡 Thay bóng đèn", chu kỳ 24 tháng, lần cuối today
3. Nhấn "Tạo lịch"
4. ☰ → "🔧 Lịch bảo trì" → xem danh sách

**Voice over**:
> "Phần mềm quản lý lịch bảo trì định kỳ cho từng trụ đèn. Ví dụ, bóng đèn LED thường thay 24 tháng, tủ điện kiểm tra 6 tháng. Khi đến hạn, hệ thống tự động cảnh báo và hiển thị trong dashboard."

### Cảnh 4: Nhiệm vụ (2:45 - 3:45)

**Hiển thị**:
1. ☰ → "📋 Nhiệm vụ" (admin) → nhấn "+ Tạo nhiệm vụ"
2. Fill: giao cho user "lamvt", mô tả "Khảo sát trụ đèn khu Trần Hưng Đạo", deadline 7 ngày
3. Nhấn "Giao nhiệm vụ"
4. Chuyển sang tài khoản `lamvt` → thấy section "Nhiệm vụ của tôi"
5. Nhấn "▶ Bắt đầu" → "📮 Nộp báo cáo" → điền kết quả

**Voice over**:
> "Chức năng Nhiệm vụ giúp admin phân công công việc cho khảo sát viên. Nhân viên nhận nhiệm vụ sẽ thấy thông báo, bắt đầu thực hiện, và nộp báo cáo kết quả. Admin duyệt và đóng nhiệm vụ khi hoàn thành."

### Cảnh 5: Notification (3:45 - 4:00)

**Hiển thị**: Section "🔔 Thông báo" trong ☰ với badge đỏ

**Voice over**:
> "Panel thông báo cập nhật mỗi 60 giây, hiển thị sự cố mới, nhiệm vụ được giao, và lịch bảo trì sắp đến hạn."

---

## 🎥 Video 5 — Dashboard & Báo cáo Nhà nước (3 phút)

### Cảnh 1: Dashboard KPI (0:00 - 1:15)

**Hiển thị**:
1. ☰ → "📊 Dashboard KPI"
2. Modal load Chart.js (~500ms)
3. Show 4 tile số: Tổng trụ, Sự cố, Bảo trì trễ, Nhiệm vụ chờ
4. Chart 1: Bar theo loại
5. Chart 2: Donut % có ảnh
6. Chart 3: Line SC 30 ngày
7. Chart 4: Bar top KSV

**Voice over**:
> "Dashboard cho lãnh đạo tổng quan trong 5 giây: tổng số trụ và tủ, sự cố chưa xử lý, bảo trì trễ hạn, nhiệm vụ chờ duyệt. Biểu đồ cột cho biết phân bố các loại đối tượng theo địa bàn. Biểu đồ tròn hiển thị tỷ lệ đã có ảnh khảo sát đầy đủ. Biểu đồ đường theo dõi số sự cố 30 ngày qua. Cuối cùng là bảng xếp hạng top 10 khảo sát viên."

### Cảnh 2: Báo cáo Nhà nước (1:15 - 3:00)

**Hiển thị**:
1. ☰ → "📑 Báo cáo Nhà nước"
2. Fill thông tin đơn vị (auto-fill từ localStorage)
3. Chọn kỳ tháng
4. Click card "1. Báo cáo tháng"
5. Excel file download tự động
6. Mở Excel → show 5 sheet: Tổng hợp, Sự cố, Bảo trì, Nhân sự, Ký duyệt
7. Highlight ô "Người ký" + "Ngày báo cáo"
8. Click card "2. Báo cáo TT06/2016" → download file khác
9. Click "📧 Gửi qua email" → confirm → toast success

**Voice over**:
> "Phần mềm hỗ trợ xuất báo cáo Excel theo 3 mẫu chuẩn:
> - Báo cáo tháng nội bộ có 5 sheet: tổng hợp, sự cố, bảo trì, nhân sự và trang ký duyệt.
> - Báo cáo theo Thông tư 06/2016/TT-BXD của Bộ Xây dựng — bắt buộc trong hồ sơ hành chính.
> - Danh mục thiết bị theo TCVN 7722.
>
> Thông tin đơn vị và người ký được lưu lại, không cần điền lại lần sau. Đặc biệt, hệ thống có tính năng gửi báo cáo tự động qua email vào 6 giờ sáng ngày 1 hàng tháng, không cần admin can thiệp."

---

## 🎥 Video 6 — CAD Overlay & Stake-out RTK (5 phút)

### Cảnh 1: Upload DXF (0:00 - 1:00)

**Hiển thị**:
1. ☰ → "📐 Tải DXF"
2. Chọn file `.dxf` từ máy
3. Chọn kinh tuyến 105.75°, k₀ 0.9999
4. Loading → parse → render overlay
5. Bản vẽ hiện trên bản đồ Google

**Voice over**:
> "Tính năng độc đáo của Lighting Survey là hiển thị bản vẽ AutoCAD DXF trực tiếp lên bản đồ. Upload file DXF, chọn kinh tuyến trung tâm phù hợp với địa phương, và phần mềm sẽ chuyển đổi tọa độ VN-2000 sang lat/lon và overlay lên bản đồ Google."

### Cảnh 2: Tinh chỉnh vị trí (1:00 - 2:00)

**Hiển thị**:
1. Info box → "🎯 Chỉnh"
2. Modal show meridian slider + k₀ dropdown + offset X/Y
3. Điều chỉnh — preview delta realtime
4. Apply → bản vẽ dịch chuyển

**Voice over**:
> "Nếu bản vẽ hiển thị lệch vị trí, dùng công cụ Chỉnh để điều chỉnh kinh tuyến, hệ số k₀, hoặc dịch chuyển bằng mét. Preview realtime hiển thị delta so với trung tâm địa bàn giúp bạn biết đã căn chỉnh chính xác."

### Cảnh 3: Layer control (2:00 - 2:45)

**Hiển thị**:
1. Info box → "🎨 Lớp"
2. Modal show list 20+ layers
3. Uncheck "TEXT" layer → text ẩn
4. Click preset "🚫 Ẩn text"
5. Đổi màu 1 layer → color picker → apply

**Voice over**:
> "Bản vẽ CAD có thể chứa hàng chục lớp khác nhau — text, dimension, boundary, POLE, CABLE... Panel Lớp cho phép bật/tắt từng lớp, đổi màu, hoặc dùng các preset nhanh như 'Chỉ trụ', 'Chỉ cáp', 'Ẩn text'."

### Cảnh 4: Snap về đỉnh CAD (2:45 - 3:15)

**Hiển thị**:
1. Toggle "🧲 Snap về đỉnh CAD" + bán kính 5m
2. Click gần đỉnh CAD → marker tự dịch về đỉnh chính xác
3. Toast "Đã snap về đỉnh CAD (cách 0.5m, layer POLE_MAIN)"

**Voice over**:
> "Khi thêm marker mới trong phạm vi 5 mét của một đỉnh CAD, hệ thống tự động dịch marker về đỉnh đó — đảm bảo tọa độ khớp chính xác với bản thiết kế."

### Cảnh 5: Stake-out RTK (3:15 - 4:45)

**Hiển thị**:
1. Info box → "🧭 Stake-out"
2. Click 1 đỉnh CAD làm target
3. Marker đỏ pulse tại target
4. Floating bar hiện: arrow + distance + bearing + RTK status
5. Simulate movement (nếu ghi outdoor) — distance giảm dần
6. Đến ngưỡng → rung + voice "Đã đến vị trí"
7. Confirm dialog → mở popup thêm marker với tọa độ target

**Voice over**:
> "Với thiết bị RTK Tersus Luka, tính năng Stake-out cho phép điều hướng đến chính xác từng đỉnh trong bản vẽ với sai số dưới 5 centimet. Chọn 1 đỉnh CAD làm target, phần mềm hiển thị mũi tên chỉ hướng, khoảng cách còn lại, và tự động rung, phát âm khi bạn đứng đúng vị trí. Đây là tính năng tương đương với thiết bị RTK chuyên dụng có giá 100-150 triệu đồng."

### Cảnh 6: Ending (4:45 - 5:00)

**Hiển thị**: Video splash "Lighting Survey — More than a survey app"

**Voice over**:
> "Tính năng CAD overlay và stake-out RTK là điểm khác biệt của Lighting Survey so với các phần mềm khảo sát khác."

---

## 🎥 Video 7 — Setup cho Admin (10 phút, chi tiết hơn)

### Cảnh 1: Quy trình setup tổng quan (0:00 - 0:45)

**Hiển thị**: Flowchart 7 bước

**Voice over**:
> "Video này dành cho quản trị viên setup phần mềm cho tổ chức mới. Có 7 bước chính:
> 1. Tạo Google Spreadsheet
> 2. Deploy Google Apps Script
> 3. Setup GitHub Pages
> 4. Cấu hình URL trong index.html
> 5. Tạo tài khoản admin
> 6. Import dữ liệu ban đầu
> 7. Publish CSV cho các tính năng nâng cao"

### Cảnh 2 - Cảnh 8: Chi tiết từng bước (0:45 - 9:30)

Chi tiết từng bước với screen recording. Xem `huongdan.html` section triển khai.

### Cảnh 9: Testing & handover (9:30 - 10:00)

**Voice over**:
> "Sau khi hoàn tất setup, test đăng nhập, thêm 3 marker mẫu, xuất báo cáo, và bàn giao đường link cho khách hàng."

---

## 📤 Post-production checklist

- [ ] Cut các đoạn "ừm", "à" bằng Descript hoặc DaVinci Resolve
- [ ] Thêm intro/outro chung 5 giây (logo + fade)
- [ ] Thêm subtitle SRT (Việt + Anh) — dùng YouTube auto-caption
- [ ] Background music nhẹ (Bensound.com, YouTube Audio Library — free)
- [ ] Thumbnail cho mỗi video (Canva template)
- [ ] Export MP4 1080p H.264, 4-6 Mbps
- [ ] Upload YouTube (unlisted or public) + Google Drive backup

## 📦 Publish

### YouTube playlist
- Playlist name: "Lighting Survey — Hướng dẫn sử dụng"
- Description: link tải app + docs
- Tag: khảo sát chiếu sáng, PWA, GIS, RTK

### Embed vào huongdan.html
```html
<div class="video-embed">
    <iframe src="https://www.youtube.com/embed/PLAYLIST_ID" allowfullscreen></iframe>
</div>
```

### Backup local
- Copy vào `docs/videos/` trong repo (compress < 100MB)
- Hoặc host trên GitHub Release

---

## 🎨 Design assets

### Intro splash (5 giây)
```
[Logo Lavipco] → fade → [Text: Lighting Survey] → fade → [Sub: Khảo sát chiếu sáng công cộng]
```

### Lower third (name tag khi voice over)
```
┌─────────────────────────────┐
│ Mai Vũ Lâm                  │
│ Phát triển sản phẩm         │
└─────────────────────────────┘
```

### Color palette
- Primary: `#2563eb` (blue)
- Success: `#10b981` (green)
- Warning: `#f59e0b` (orange)
- Danger: `#dc2626` (red)
- Text: `#1e293b`

### Font
- Heading: Inter Bold
- Body: Inter Regular
- Mono: Fira Code (for code snippets)

---

## 💡 Tips ghi hình chuyên nghiệp

1. **Chạy sạch app** trước khi ghi: xóa test data, clear notifications
2. **Zoom in browser** 125% để dễ nhìn trên mobile viewer
3. **Ẩn bookmarks toolbar** (`Ctrl+Shift+B`) để giao diện clean
4. **Ẩn dev tools** (F12 close) trừ khi cần show
5. **Cursor mượt** — dùng chuột thay trackpad
6. **Ngừng 1-2s** giữa mỗi action để dễ edit
7. **Ghi audio riêng** với mic tốt — sync post-production
8. **Voice over** viết script trước, đọc chậm, ngừng nghỉ tự nhiên
9. **Đèn** tự nhiên ban ngày hoặc softbox nếu ghi trong nhà
10. **Screen ratio 16:9** — không ghi ở orientation portrait

---

## 📊 Timeline dự kiến

| Task | Thời gian |
|---|:---:|
| Chuẩn bị dữ liệu demo | 2 giờ |
| Ghi audio voice over (7 video) | 3 giờ |
| Ghi screen recording | 4 giờ |
| Edit + subtitle | 8 giờ |
| Upload + tạo thumbnails | 2 giờ |
| **Tổng** | **~20 giờ** |

Nếu thuê editor freelance: **~5-10 triệu VNĐ** cho toàn bộ 7 video edit chuyên nghiệp.

---

## 🎯 Distribution strategy

### Public
- **YouTube channel**: Lavipco Solutions
- **Facebook Page**: chia sẻ video 1 + 5 (giới thiệu + báo cáo NN)
- **LinkedIn**: video 6 (CAD + RTK — sale point cho enterprise)
- **Website riêng**: embed toàn bộ playlist

### Sale collateral
- USB gửi khách hàng tiềm năng (7 video + demo login)
- Email marketing với link video 1 (intro)
- Trong hợp đồng training: đính kèm link playlist

### Vietnamese SEO keywords
- "phần mềm khảo sát chiếu sáng"
- "quản lý trụ đèn công cộng"
- "báo cáo TT06/2016"
- "khảo sát trụ đèn RTK"
- "PWA khảo sát Việt Nam"
