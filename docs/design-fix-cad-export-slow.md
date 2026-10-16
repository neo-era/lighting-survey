# Xuất CAD chậm — Overpass chặn đường tới hạn

## Bối cảnh

Xuất bản vẽ chỉ **4 marker** (1 tủ, 3 tuyến cáp) mà nút "Đang xuất…" chạy **13 giây** chưa xong.

## Nguyên nhân gốc (đã đo)

`_generateCadDrawing` có **đúng một `await`** — gọi Overpass lấy nền OSM
([cad-export.js:109](../src/features/cad-export.js#L109)). Việc vẽ 4 marker chỉ tốn mili-giây;
toàn bộ thời gian là **chờ mạng**.

Kích hoạt khi bật **nền OSM** HOẶC **"Hướng theo đường"** (`orientByRoad`).

### Hai khiếm khuyết trong `_overpassFetch` ([osm.js:24](../src/features/osm.js#L24))

1. **Thử tuần tự 4 máy chủ, timeout 45s mỗi máy** → tối đa **180 giây**.
2. **`_overpassGoodIdx` ghi nhớ máy chủ dùng lần trước** → nếu máy đó sau này treo,
   nó vẫn được thử **đầu tiên** ở mọi lần xuất kế tiếp, lần nào cũng ăn trọn 45s.

### Đo thật (query ~1 km², cỡ vùng người dùng)

| Máy chủ | Kết quả |
|---|---|
| overpass-api.de | lỗi sau 0.95s |
| **maps.mail.ru** | **treo 51s** rồi mới timeout |
| overpass.kumi.systems | lỗi sau 1.0s |
| overpass.private.coffee | lỗi sau 0.95s |

Máy treo (không báo lỗi nhanh) là kiểu hỏng tệ nhất với vòng lặp tuần tự.

## Hướng đã chốt (sau review độc lập)

Người dùng chọn: gọi song song + hạ timeout + nút huỷ + hiện rõ đang chờ gì.
Bản đầu bắn **cả 4 máy cùng lúc**, timeout 12s. Review độc lập chỉ ra 3 vấn đề, nên chuyển sang **hedged request**:

1. Với đúng kịch bản đã đo (3 máy lỗi ~1s, mail.ru treo), song song vẫn **chờ trọn 12s** — chỉ giảm 51s→12s.
2. Timeout cứng 12s **cắt mất nền OSM** ở bản vẽ lớn có nhà cửa (trước chờ được 45s).
3. Bắn 4 máy công cộng mỗi lần: Overpass tính quota theo thời gian chạy query, huỷ phía trình duyệt
   không dừng query phía máy chủ → ăn quota 4 máy, dễ 429.

### Cơ chế cuối cùng

| Thành phần | Hành vi |
|---|---|
| Thứ tự gọi | Luôn bắt đầu từ máy chính. **Bỏ** việc ưu tiên máy thắng lần trước (`_overpassGoodIdx` chỉ còn để log) |
| Máy lỗi | Gọi **ngay** máy kế, không chờ |
| Máy chậm | Sau `OVERPASS_HEDGE_MS` = 2s chưa trả → gọi **thêm** máy kế, chạy song song |
| Thắng | Máy trả JSON có `elements` đầu tiên; huỷ các request còn lại |
| Timeout | Theo diện tích (`_overpassTimeoutFor`): tối thiểu 8s (vùng vài trụ), +1.5s/km² (+3s/km² nếu có nhà), trần 30s |
| Không có AbortController | Hẹn giờ độc lập vẫn kết thúc request treo (bản cũ treo vĩnh viễn) |
| Bỏ qua OSM | **Bấm lại nút đang bận** khi nhãn hiện "Đang tải nền OSM…" (chỉ lúc đang chờ Overpass, sau 800ms để chống double-click) → bản vẽ vẫn xuất, không có nền đường |

Không làm nút "Huỷ" riêng huỷ cả lần xuất: nền OSM vốn là phần tuỳ chọn (lỗi OSM chưa bao giờ chặn xuất),
nên dừng chờ mạng mà vẫn ra bản vẽ là kết quả hữu ích nhất. Nút "Hủy" của modal hiện **chỉ đóng modal**,
việc xuất vẫn chạy ngầm — giữ nguyên hành vi cũ, chưa sửa.

### Tác động thời gian

| Tình huống | Trước | Sau |
|---|---|---|
| Máy chính chạy tốt | 1–3s | 1–3s (1 request) |
| Máy chính lỗi nhanh, máy 2 tốt | ~2s | ~2s |
| Máy chính **treo**, máy 2 tốt | **45s+** | **~2s** (hedge) |
| Kịch bản đã đo, vùng 4 trụ | **tới 180s** | **~8s** rồi xuất không nền — hoặc bấm bỏ qua ngay |
| Bản vẽ lớn có nhà, máy chậm 20s | lấy được | lấy được (timeout 30s) |

## Phạm vi đã sửa

| File | Thay đổi |
|---|---|
| `src/features/osm.js` | `_overpassFetch` hedged + `opts.signal/timeoutMs/hedgeMs`; `_overpassTimeoutFor`; `_fetchOsmBasemap(bounds, options, signal)` — signal là **tham số riêng** vì `options` được lưu IndexedDB (AbortSignal không clone được) |
| `src/features/cad-export.js` | `_cgFetchOsm` bật cờ `_cgOsmFetching`; nút bận hiện "Đang tải nền OSM… Ns" + tooltip, bấm lại để bỏ qua; signal chỉ gắn cho `dxf`/`both`, preview không giữ signal; AbortError báo "đã bỏ qua" **1 lần** (không phải lỗi) ở cả nhánh nền OSM lẫn hướng theo đường |
| `tests/overpass-hedged.test.mjs` | Mới, 20 ca |
| `tests/overpass-failover.test.mjs` | 2 ca khẳng định hành vi gây lỗi ("chỉ thử tuần tự", "ưu tiên máy thắng cũ") sửa theo yêu cầu mới |
| `tests/cg-export-busy.test.mjs` | Nút bận không còn `disabled`; thêm ca bỏ qua chỉ khi đang chờ OSM, chống double-click |

**Không đụng**: cache IndexedDB, rate-limit 5s, logic vẽ DXF.

## Còn hở

- Kịch bản "mọi máy lỗi trừ một máy treo" vẫn tốn **1 lần timeout** (8s với vùng nhỏ) — giới hạn vốn có:
  không phân biệt được máy treo với máy chậm-nhưng-đúng. Người dùng có thể bấm bỏ qua.
- Nút "Hủy" của modal không dừng việc xuất đang chạy.
- Xuất batch nhiều tủ không truyền signal → không bỏ qua OSM được.

## Tải sẵn nền OSM khi mở modal Xuất CAD (v183)

**Câu hỏi**: tải và lưu cache nền OSM ngay lúc mở bản đồ để lúc xuất dùng luôn được không, có làm máy chậm không?

**Đã chốt**: tải sẵn **khi mở modal Xuất CAD**, không phải lúc mở bản đồ.
- Lúc mở bản đồ: đa số người dùng (khảo sát viên) không bao giờ xuất CAD → tải lúc đó chỉ tốn 3G,
  parse JSON lớn trên main thread làm giật UI, và nhân tải lên Overpass công cộng (thêm 429 cho người cần xuất).
- Lúc mở modal: người dùng mất 10–60s chọn bộ lọc / khung tên → đủ thời gian tải xong, bấm xuất là trúng cache.

### Cơ chế

| Thành phần | Việc |
|---|---|
| `_cgWarmOsm` | Mở modal (600ms) / đổi lựa chọn trong modal (debounce 1.5s) → tải im lặng (`quiet`) khung theo bộ lọc. Bỏ qua khi: modal đóng, đang xuất, vừa lỗi < 30s, không dùng OSM lẫn hướng theo đường, chưa hết 5s rate-limit (hẹn lại) |
| `_cgOsmBboxForFilters` | Cùng công thức ±0.001° như lúc xuất, **không** bỏ điểm ngoại lai → luôn bao chứa khung lúc xuất |
| Cache bộ nhớ `_osmMem` (tối đa 3 vùng) | Tra theo **bao chứa** + đủ lớp + còn hạn, không cần khớp đúng key |
| Request đang chạy `_osmInflight` | Bấm xuất khi tải sẵn chưa xong → chờ chính request đó; bấm bỏ qua chỉ bên đó thôi chờ |
| `_osmView` | Mọi đường trả về đều là **lát cắt mới**: chỉ lớp được xin, chỉ way chạm khung xin |
| `_osmClearMem` | Đóng modal → nhả RAM (IndexedDB vẫn giữ) |

### Review vòng 3 — lỗi tìm thấy và đã sửa

| Mức | Lỗi | Sửa |
|---|---|---|
| Cao | Tải sẵn có nhà, người dùng bỏ tick nhà → bản vẽ vẫn có nhà (cache giàu hơn yêu cầu) | `_osmView` cắt theo lớp |
| Cao | Tải sẵn vừa chạy → lần xuất (lớp khác) dính rate-limit 5s → mất nền | Bên chủ động **chờ** hết 5s (bỏ qua được); chỉ tải sẵn mới nhường |
| Vừa | Chờ chung request bị lỗi → mất bản cũ của mình | Fallback bản cũ khi request chung lỗi |
| Vừa | Cache cả quận, MST xin khung ±65m → duyệt cả quận, đơ UI | `_osmView` cắt theo khung |
| Vừa | Cache vài chục MB nằm mãi trong RAM | `_osmClearMem` khi đóng modal |
| Thấp | `_idbSet` không bắt `onabort` (hết dung lượng) → await treo, kẹt cả request chung | Ghi IndexedDB ngầm, không await |
| Thấp | Tải sẵn chen khi đang xuất / bắn lại liên tục khi Overpass lỗi | Bỏ qua khi bận, nghỉ 30s sau lỗi |

### Ảnh hưởng tốc độ máy

- Không tải gì nếu không mở modal Xuất CAD.
- Mạng: 1 request/khung bộ lọc (debounce), đúng lượng lần xuất vốn sẽ tải.
- RAM: tối đa 3 vùng, nhả khi đóng modal.
- CPU: parse JSON 1 lần lúc tải sẵn (trước đây cũng parse lúc xuất) — dời sớm hơn, không thêm.

Test: `tests/osm-prefetch-cache.test.mjs` (26 ca), `tests/cad-osm-warm.test.mjs` (17 ca).
