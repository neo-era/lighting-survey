# Thiết kế — Mã QR cho trụ đèn / tủ điều khiển

> Từ popup 1 trụ/tủ → nút **"Mã QR"** → hiện QR + tóm tắt + lưu ảnh/in/sao chép link.
> QR = **link deep-link** mở app đến đúng đối tượng (zoom + popup), **kèm tham số đọc được** (tên/loại/CS) — chốt C.
> Tận dụng public view sẵn có (`?view=<sheet>`) + hạ tầng tạo QR sẵn có (`_loadShareQrLib`/qrcodejs).

## Bước 0 — Tiêu chí đạt (đã chốt C)

| # | Tiêu chí | Đo được |
|---|---|---|
| 1 | Popup trụ/tủ có nút "Mã QR" (cả pole lẫn cabinet) | Nút hiện trong popup |
| 2 | QR mã hoá **link mở app tới đúng marker** + tham số tóm tắt | Nội dung QR = `…?view=<sheet>&m=<id>&t=<tên>…` |
| 3 | Quét QR → app mở, **zoom + mở popup đúng trụ/tủ** (kể cả người ngoài, qua public view) | Mở link `&m=<id>` → focus marker |
| 4 | Scanner thường đọc được **tên/loại/CS** (nhúng trong link) | Chuỗi QR chứa text đọc được |
| 5 | Lưu ảnh PNG QR + **In nhãn** (QR + caption) | File tải / cửa sổ in |
| 6 | Sao chép link | Clipboard |
| 7 | PWA + UI dark/light + mobile dọc/ngang, chạm ≥44px | Kiểm ảnh |

**Ca xấu:** marker thiếu toạ độ / thiếu ID (fallback tên trụ) · tên có ký tự đặc biệt/dấu (encode đúng) · CDN qrcodejs lỗi (báo lỗi gọn, không treo) · link quá dài (giới hạn tham số tóm tắt) · quét `&m=<id>` không tồn tại trong sheet (báo "không tìm thấy", vẫn mở địa bàn).

## Deep-link tới 1 marker (mở rộng public view)

- Hiện: `?view=<sheet>`. Thêm: `&m=<markerId>` (+ đọc được: `&t=<tên>`, tùy chọn `&k=<loại đèn>`, `&p=<công suất>`).
- Pure fn `_markerShareLink(origin, pathname, sheet, id, opts)` — build URL, encode an toàn, chỉ thêm param có giá trị, cắt caption dài.
- Khi app khởi động (public hoặc đã đăng nhập) thấy `m`: sau khi nạp CSV → `_focusMarkerById(id)`:
  tìm row theo `row[0]===id` (fallback `row[1]===tên`), `map.setView([lat,lon], 19)` + mở popup marker đó.
- Nếu không tìm thấy id → vẫn mở địa bàn, toast "Không tìm thấy trụ <id>".

## Nội dung QR (chốt C)
```
https://neo-era.github.io/lighting-survey/?view=Quan5&m=Q5_012&t=Tr%E1%BB%A5%20STK%20Q5_012&k=LED&p=100W
```
- Là 1 URL → scanner mở được app; chuỗi hiển thị chứa tên/loại/CS đọc được.
- Thẻ QR (modal + bản in) hiển thị **caption chữ** rõ: Tên · Loại đèn · Công suất · Tủ · ID — để dán nhãn đọc bằng mắt.

## UI (Chốt UI — render 2–3 mẫu, mobile dọc+ngang)
- **Nút "Mã QR"** trong popup marker (hàng nút hành động), cho cả trụ & tủ.
- **Modal `#markerQrModal`**: QR lớn giữa, caption tóm tắt dưới, hàng nút [⬇ Lưu ảnh] [🖨 In nhãn] [🔗 Sao chép link] [✕].
- **(Tùy chọn, hỏi ở Chốt UI) Batch**: "In nhãn QR theo tủ/tuyến" → lưới nhãn (QR + tên) tất cả marker của tủ đã lọc → in A4. Dùng khi dán hàng loạt ngoài hiện trường.

## Lưu ảnh / In
- Lưu ảnh: qrcodejs render canvas → `toDataURL('image/png')` → tải `QR-<id>.png`.
- In nhãn: cửa sổ in nhỏ HTML (QR + caption) — tái dùng cách in sẵn có nếu hợp; mobile dùng `window.print()`.

## Pure fns (test `@@MARKERQR`)
- `_markerShareLink(origin, pathname, sheet, id, {t,k,p})` — build URL, encode, bỏ param rỗng.
- `_qrCaptionFor(row)` — caption chữ từ row (tên, loại đèn [10], công suất [11], tủ [7], ID [0]).
- `_qrFilenameFor(row)` — `QR-<id|tên>.png`, sanitize.
- `_parseMarkerParam(search)` — đọc `m` từ query.

## Rủi ro / nợ
- qrcodejs là CDN → offline lần đầu không tạo được QR (chấp nhận: tạo QR cần mạng 1 lần, sau SW cache `cdn-libs`).
- Deep-link public cần tủ/địa bàn đã publish CSV; marker ở `DanhSachTru` tổng quan vẫn mở được.
- Link chứa tên trụ (dữ liệu hạ tầng công) — không nhạy cảm; không nhúng Người KS.

## Kiểm chứng (Bước 5)
- Unit: build link/caption/filename/parse (thường + biên).
- Headless mobile: modal QR dọc+ngang, sáng+tối; batch (nếu chọn).
- Round-trip: parse link `&m=` → focus đúng marker (mô phỏng).
