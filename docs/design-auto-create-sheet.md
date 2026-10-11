# Thiết kế: Tự tạo sheet dữ liệu mới (địa bàn mới)

**Status**: Draft — Bước 1 dev-loop
**Audience**: Admin app lighting-survey (nội bộ Lavipco)

## Mục tiêu

Hiện tại thêm địa bàn mới mất 15 phút thao tác tay (tạo tab Google Sheet → copy header 30 cột → publish CSV → lấy URL → sửa code `DISTRICT_PAGES` → commit → deploy GitHub Pages → chờ CDN). Tự động hóa xuống **< 30 giây** qua admin UI.

## Kiến trúc

```
┌─────────────────────┐  POST action=create_dia_ban       ┌──────────────────┐
│  Admin modal UI     │ ──────────────────────────────── ▶│  GAS backend     │
│  /admin/cai-dat →   │                                   │                  │
│  "Thêm địa bàn mới" │ ◀───────────────────────────────  │  _withScriptLock │
└─────────────────────┘  { status, sheet, label, csvUrl } │                  │
                                                          │  1. Validate     │
┌─────────────────────┐  GET action=list_dia_ban          │  2. Create tab   │
│  Startup / refresh  │ ──────────────────────────────── ▶│  3. Copy header  │
│  dropdown ☰ panel   │                                   │  4. Publish      │
└─────────────────────┘ ◀───────────────────────────────  │  5. Save DiaBan  │
                        [{sheet,label,csvUrl,prefix}...]  │  6. Return meta  │
                                                          └──────────────────┘
```

## Schema sheet `DiaBan` (mới)

| Cột | Tên | Mô tả |
|---|---|---|
| A | sheet | Tên tab (unique key) |
| B | label | Hiển thị dropdown |
| C | csvUrl | GViz hoặc published CSV URL |
| D | prefix | Prefix cho auto-generate ID (2-4 ký tự uppercase) |
| E | region | TPHCM / BinhDuong / LongAn (optional) |
| F | centerLat | DISTRICT_CENTERS auto-populate (optional) |
| G | centerLon | — |
| H | createdAt | ISO timestamp |
| I | createdBy | username admin |
| J | status | 'active' / 'archived' |

## GAS endpoints

### 1. `create_dia_ban` (admin only, LockService)

Payload:
```json
{
  "action": "create_dia_ban",
  "sheet": "Quan12",
  "label": "Quận 12",
  "prefix": "Q12",
  "region": "TPHCM",
  "adminAuth": { ... }
}
```

Flow:
1. `_requireAdmin(data)` → reject nếu không phải admin
2. Validate: `sheet` regex `^[A-Za-z0-9_]{1,50}$`, không trùng tab hiện có, không trùng tên trong `DiaBan`
3. Validate: `label` 1-80 ký tự, trim
4. Validate: `prefix` `^[A-Z0-9]{1,10}$`, warn nếu trùng SHEET_ID_PREFIX cũ (vẫn cho phép)
5. `_withScriptLock`:
   - `ss.insertSheet(sheet)` → tab mới
   - Copy header 30 cột từ `DanhSachTru` (reuse `ensureHeader`)
   - Freeze row 1, bold header
   - Try `_publishViaGviz(sheet)` → return csvUrl
   - Nếu fail (file chưa shared public) → try `Drive.publish` fallback
   - Append row vào `DiaBan`: `[sheet, label, csvUrl, prefix, region, '', '', isoTs, username, 'active']`
6. Return `{status:'ok', sheet, label, csvUrl, prefix}`
7. Rollback nếu bất kỳ bước fail: `ss.deleteSheet(newSheet)` + cleanup

### 2. `list_dia_ban` (public, no auth)

Trả về array `[{sheet, label, csvUrl, prefix, region}, ...]` từ sheet `DiaBan` (filter status='active').

Fallback: nếu sheet `DiaBan` không tồn tại → trả `[]` (client dùng hardcode DISTRICT_PAGES).

### 3. GViz URL helper

```js
function _buildGvizUrl(spreadsheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?` +
         `tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}
```

Test URL trước khi save: UrlFetchApp.fetch với muteHttpExceptions=true, check 200 OK + content type CSV.

## Client (index.html)

### 1. Lazy load dynamic DISTRICT_PAGES

Sau login hoặc khi mở dropdown lần đầu:
```js
async function _loadDynamicDistricts() {
  try {
    const res = await fetch(KHAOSAT_GAS_URL, { method:'POST',
      body: JSON.stringify({ action: 'list_dia_ban' }) });
    const data = await res.json();
    if (data.status === 'ok' && Array.isArray(data.items)) {
      // Merge với DISTRICT_PAGES hardcode — dynamic WINS cho duplicate sheet
      const hcMap = new Map(DISTRICT_PAGES.map(p => [p.sheet, p]));
      data.items.forEach(it => hcMap.set(it.sheet, it));
      DISTRICT_PAGES.length = 0;
      hcMap.forEach(v => DISTRICT_PAGES.push(v));
      // Rebuild dropdown
      _buildDistrictOptions();
    }
  } catch (e) { _swallow(e); }
}
```

### 2. UI Modal `#createDiaBanModal`

Trigger: nút "➕ Thêm địa bàn" trong ☰ panel section "🗺 Điều hướng" (chỉ hiện khi admin).

Fields:
- Tên tab (sheet name) — input, validation realtime
- Tên hiển thị (label) — input
- Prefix ID — input, auto-suggest từ sheet (VD "Quan12" → "Q12")
- Khu vực — dropdown TPHCM/BinhDuong/LongAn/Khác
- Nút: Hủy, Tạo

Design pattern khớp UI hiện có (ctrl-input, modal `#longCableModal` làm reference). KHÔNG render 3 phương án vì:
- Form admin ngắn (4 fields) không cần design iteration
- Dùng Bootstrap modal pattern đã có

### 3. Error handling

| Server response | Client UX |
|---|---|
| `status: 'ok'` | Toast success + refresh dropdown + chuyển sang địa bàn mới |
| `status: 'error', message: 'Sheet đã tồn tại'` | Highlight input sheet red + show error inline |
| `status: 'busy'` | Toast "Server đang bận, thử lại sau 5s" |
| `status: 'error', message: 'Permission...'` | Toast + hint "Kiểm tra Google Sheet share settings" |
| Network error | Toast "Không kết nối được GAS" |

## Edge cases

| Case | Behavior |
|---|---|
| Admin tạo sheet trong khi admin khác đang tạo cùng tên | LockService serialize → thứ 2 nhận "đã tồn tại" |
| User chưa publish spreadsheet (GViz 404) | Fallback `Drive.publish` tab mới |
| Prefix trùng với preset cũ (VD `Q1`) | Warn trong response, vẫn cho tạo (user tự chịu trách nhiệm trùng ID) |
| Sheet tồn tại nhưng không có trong `DiaBan` | GAS detect → return `{status:'error', hint:'adopt'}` client offer "Import vào config" |
| Delete sheet (feature tương lai) | NOT in scope — chỉ cần archive status='archived' là ẩn khỏi dropdown |

## Rủi ro & mitigation

| Rủi ro | Mitigation |
|---|---|
| **R1** GViz URL khác format publishedURL — client code cũ (`loadFromCSVWithCache`) có thể không parse đúng | Test fetch cả 2 format trước khi save; fallback publishedURL nếu GViz fail parse |
| **R2** `insertSheet` + `getRange().setValues` + `publish` không atomic trên GAS. Nếu publish fail giữa chừng → sheet tạo rồi nhưng không có csvUrl → DiaBan ghi partial | Try-catch toàn pipeline, catch → `ss.deleteSheet(newSheet)` + return error |
| **R3** Dynamic DISTRICT_PAGES merge với hardcode có thể gây duplicate labels | Dedupe bằng `sheet` field (unique key), dynamic entries override hardcode |

## Backwards compatibility

- `DISTRICT_PAGES` hardcode trong index.html giữ nguyên → sheets cũ vẫn work ngay cả khi GAS `list_dia_ban` chưa deploy
- Sau khi GAS deploy, dynamic merge vào runtime array
- Nếu user chưa upgrade GAS → client fetch `list_dia_ban` fail → `_swallow` → chỉ hiện hardcoded (không break)

## Non-goals (defer)

- UI xóa/archive sheet
- Edit metadata sheet đã tạo
- Bulk import nhiều sheet cùng lúc
- Clone sheet (copy data từ sheet khác)
- Phân quyền chi tiết "ai được tạo sheet nào"

## Deploy checklist

1. GAS: dán code mới → Deploy New Version (giữ URL)
2. Verify sheet `DiaBan` tự tạo khi gọi `list_dia_ban` lần đầu (auto-create pattern giống `OffsetPresets`)
3. Client: push commit → GitHub Pages auto-deploy
4. SW bump v149 → v150
5. User test: login admin → mở modal → tạo 1 sheet test → verify tab mới + CSV fetch OK + dropdown có địa bàn mới

## Timeline estimate

- Bước 2 (test): 15 phút (GAS mocking + client UI checklist)
- Bước 3 (code): 60 phút (GAS 3 handlers + client modal + dynamic load)
- Bước 4 (review): 15 phút
- Bước 5 (verify): 15 phút (manual test flow)
- **Total**: ~2 giờ (task vừa)
