# Thiết kế — Đường tự vẽ (Custom roads) offline-first + sync

> Tính năng: user chỉ chỗ (hẻm/đường còn thiếu) → app tạo đường ngay → lưu **offline (IndexedDB)** + **đồng bộ backend (GAS/Google Sheet)**.
> Đường tự vẽ được **căn tuyến / overlay / xuất CAD / MST** nhận y như đường OSM dựng sẵn.
> KHÔNG đẩy lên OpenStreetMap.org (chính sách + bảo mật + không offline). Có nút **xuất `.osc`/GeoJSON** tùy chọn để user tự upload OSM thật.

## Bước 0 — Tiêu chí đạt (đã chốt)

| # | Tiêu chí | Đo được |
|---|---|---|
| 1 | Vẽ đường bằng cách chạm các điểm dọc hẻm trên map → tạo 1 đường mới | Đường hiện ngay sau khi "Xong" |
| 2 | Đường mới có tag (mặc định `highway=service`, tên tùy chọn) | Record có `tags.highway` |
| 3 | Căn tuyến / overlay / CAD / MST **nhận** đường tự vẽ | align bắt được lề từ đường mới; CAD vẽ ra; overlay hiện |
| 4 | **Offline**: tắt mạng vẫn vẽ + lưu + dùng được | IndexedDB ghi/đọc không cần mạng |
| 5 | Có mạng → tự đẩy lên sheet `DuongVe`; máy khác tải về thấy | Hàng mới trong sheet; máy 2 thấy sau reload |
| 6 | Sửa (đổi tag/tên), xóa đường; không trùng khi vẽ lại | Edit/delete phản ánh cả offline lẫn sheet |
| 7 | PWA + UI hiện đại, dark/light, responsive, chạm ≥44px | Lighthouse PWA pass; kiểm tay |

**Ca xấu phải chịu:** đường < 2 điểm (bỏ), tọa độ NaN/ngoài TP, vẽ đè đường đã có (vẫn cho, không merge tự động), IndexedDB bị chặn (private mode) → fallback RAM + cảnh báo, sheet lỗi/timeout → giữ offline, cờ `pending_sync`, thử lại sau.

## Kiến trúc

```
[User vẽ polyline trên map]
        ↓  _crFinishDraw()
[Record: {id, coords:[[lon,lat]], tags, author, ts, _dirty}]
        ↓
[IndexedDB  store 'custom-roads']  ←─ offline, nguồn sự thật local, đọc tức thì
        ↓ (khi online)  _crSyncPush()
[GAS action 'save_road' → Sheet 'DuongVe']  ←─ chia sẻ team
        ↑ _crSyncPull() (CSV publish 'DuongVe' khi load app / switchDistrict)
[Hợp nhất lúc truy vấn]
   window._customRoadsForBounds(bounds, margin) → {roads:[...]}  (cùng shape prebuilt)
        ↓ append vào kết quả của 3 choke-point:
   _osmRoadsForBounds (overlay) · _raFetchRoads (căn tuyến) · _cgFetchOsm (CAD)
   → tự lan sang MST (_raFetchRoads) + route-summary
```

### Shape record (khớp prebuilt — không sửa consumer)
```js
// OSM prebuilt trả: { coords:[[lon,lat],...], tags:{highway,name,...} } trong { roads:[...] }
// Custom road nội bộ:
{ id:'CR_<sheet>_<n>', coords:[[lon,lat],...], tags:{highway:'service', name:''},
  author:'<username>', ts:'<ISO>', sheet:'<currentSheet>', _dirty:false }
// Khi append vào roads[] chỉ cần {coords, tags} — giữ nguyên các field khác để sửa/xóa/sync.
```

### Điểm chèn (merge-at-query) — DRY
- `window._customRoadsForBounds(bounds, marginDeg=0.0015)` → đọc IndexedDB (đã nạp sẵn vào RAM `_crAll`), lọc bằng `_pbRoadNearBounds`, trả `{roads:[{coords,tags}]}`.
- `window._withCustomRoads(result, bounds)` → `result.roads = result.roads.concat(custom.roads)`; gọi ở 3 nơi ngay trước `return`:
  1. `osm-prebuilt.js` `_osmRoadsForBounds` (overlay — cả live & prebuilt).
  2. `align-route.js` `_raFetchRoads` (căn tuyến + MST dùng chung).
  3. `cad-export.js` `_cgFetchOsm` (xuất CAD).
- Lọc theo `sheet === currentSheet` để đường của địa bàn nào chỉ hiện ở địa bàn đó (đồng bộ với đa-địa-bàn T7).

### Backend — Sheet `DuongVe` (GAS)
| Cột | Tên | Ghi chú |
|---|---|---|
| 0 | ID | `CR_<sheet>_<n>` |
| 1 | Sheet | địa bàn |
| 2 | Highway | `service`/`residential`/`footway`/... |
| 3 | Tên | tùy chọn |
| 4 | Hình học | JSON `[[lon,lat],...]` (hoặc encoded polyline) |
| 5 | Người vẽ | username |
| 6 | Thời gian | ISO |
| 7 | Trạng thái | `''`/`'xoa'` (soft delete để sync đa máy) |

GAS actions mới: `save_road` (upsert theo ID), `delete_road` (set cột 7 = `xoa`). Load: publish CSV tab `DuongVe` → `_crSyncPull()`. **⚠ Cần redeploy GAS New version.**

### IndexedDB
- DB `lighting-survey-db` (đã có cho CSV cache) → thêm store `custom-roads` (key = id).
- `_crLoadAll()` lúc khởi động → `_crAll` (RAM) để `_customRoadsForBounds` truy vấn đồng bộ, nhanh.
- Ghi: `_crPut(rec)` (IndexedDB) + đánh `_dirty=true` → hàng đợi sync.

## Cơ chế "chỉ chỗ" → tạo đường (MVP)
- **Vẽ polyline thủ công**: bật mode → chạm lần lượt các điểm dọc hẻm (snap điểm đầu/cuối vào đường/nút gần ≤ ~8m để nối liền mạch) → "Xong" tạo đường. Đơn giản, chính xác, không phụ thuộc ML.
- (Mở rộng sau — không làm MVP) auto-trace từ ảnh vệ tinh.

## UI (Chốt UI — render 2–3 phương án trước khi code)
Thêm "chế độ vẽ đường" vào app hiện có (đồng bộ style ☰ panel + toolbar). 3 biến thể flow:
- **A — Toolbar nổi đáy map**: nút "✏️ Vẽ đường" → thanh công cụ nổi (Hoàn tác điểm / Xong / Hủy) + đếm điểm; sau "Xong" popup nhỏ nhập tên + loại.
- **B — Section trong ☰**: mục "🛣 Đường tự vẽ" (bật mode, danh sách đường đã vẽ, xóa/sửa); vẽ trên map, panel đóng khi vẽ.
- **C — FAB + bottom-sheet**: nút tròn góc phải-dưới → bottom-sheet kéo lên (vẽ/danh sách/đồng bộ), hợp mobile 1 tay.

## Rủi ro / nợ kỹ thuật
- Trùng/chồng đường khi nhiều người vẽ cùng chỗ → MVP không auto-merge; cảnh báo nếu điểm đầu/cuối trùng gần.
- Sheet geometry dài (nhiều điểm) → 1 ô có thể lớn; dùng JSON gọn (làm tròn 6 số lẻ) hoặc encoded polyline nếu cần.
- Đồng bộ xung đột (2 máy sửa 1 đường) → last-write-wins theo ts; soft-delete tránh "sống lại".
- Bake vào tile prebuilt (offline cho cả máy chưa từng online) → để pha sau: định kỳ gộp `DuongVe` vào `tools/build-osm-roads.py`.

## Test (Bước 2 — TDD, phần thuần trong @@CUSTOMROADS)
- `_crRecordValid` (≥2 điểm, tọa độ hợp lệ) · `_crToRoad` (→ {coords,tags}) · `_crNearBounds` (clip) ·
  `_crMerge` (append vào roads) · `_crEncodeGeom`/`_crDecodeGeom` (JSON round-trip) · `_crSoftDeleteFilter`.

## Kiểm chứng (Bước 5)
- Unit pass. Headless: vẽ 1 đường → `_raFetchRoads` trả có đường đó → align bắt lề. Offline (chặn fetch) vẫn vẽ/lưu/đọc. Round-trip IndexedDB. CAD export thấy đường. PWA Lighthouse.
