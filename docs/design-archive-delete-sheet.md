# Thiết kế: Archive & Delete địa bàn (v151)

**Status**: Draft — Bước 1 dev-loop (ngược của v150 create)
**Audience**: Admin app lighting-survey

## Mục tiêu

Admin cần quay lại trạng thái không muốn có địa bàn (sai sót, test nhầm, sheet merge, archive cũ). Luồng DELETE phải **an toàn 3 lớp** vì xóa Google Sheet tab = mất data không revert được.

## 3 cấp độ "xóa"

| Cấp | Action | Reversible | Google Sheet tab | DiaBan row | Confirm |
|---|---|---|---|---|---|
| **1. Archive** | Soft hide | ✅ Restore được | GIỮ | GIỮ (`status='archived'`) | 1× |
| **2. Delete config** | Xóa khỏi DiaBan | ❌ (phải tạo lại) | GIỮ (manual access qua Sheet) | XÓA | 2× (type `DELETE`) |
| **3. Delete tab Sheet** | Xóa cả tab | ❌❌ UNRECOVERABLE | XÓA | XÓA | 3× (type EXACT sheet name) |

Checkbox "Cũng xóa tab Google Sheet" trong modal delete config → chuyển sang cấp 3.

## GAS endpoints mới

### `archive_dia_ban` (admin, LockService)
```json
{ "action": "archive_dia_ban", "sheet": "Quan12", "adminAuth": {...} }
```
Flow: `_requireAdmin` → find row trong `DiaBan` theo sheet → set col J (status) = `'archived'` → log → return ok

### `restore_dia_ban` (admin, LockService)
```json
{ "action": "restore_dia_ban", "sheet": "Quan12", "adminAuth": {...} }
```
Set `status='active'`. Reverse của archive.

### `delete_dia_ban` (admin, LockService)
```json
{
  "action": "delete_dia_ban",
  "sheet": "Quan12",
  "confirmText": "DELETE" | "Quan12",   // text user gõ để confirm
  "alsoDeleteTab": true/false,          // true → xóa tab Sheet
  "adminAuth": {...}
}
```
Flow:
1. Validate `_requireAdmin`
2. Validate sheet không phải `DanhSachTru` (protected)
3. Validate confirmText:
   - Nếu `alsoDeleteTab=false` → confirmText phải = `'DELETE'`
   - Nếu `alsoDeleteTab=true` → confirmText phải = sheet name chính xác (case-sensitive)
4. Nếu `alsoDeleteTab=true`: `ss.deleteSheet(tab)` — có try/catch (sheet có thể không tồn tại nếu user xóa manual)
5. Xóa row khỏi `DiaBan`
6. Log vào `LichSu` loại `delete_dia_ban` + ghi detail "alsoDeleteTab=X"
7. Return `{status:'ok', deletedTab: bool, rowCountBefore: N}`

## Client UI

### Nút trigger: ⚙ icon bên nút "➕ Thêm địa bàn mới"

```
🗺 Điều hướng
[Dropdown]
[Current label]
[➕ Thêm địa bàn mới]  [⚙]  ← nút quản lý (admin only)
```

### Modal `#manageDiaBanModal`

```
┌─────────────────────────────────────────────┐
│ ⚙ Quản lý địa bàn                           │
├─────────────────────────────────────────────┤
│ [Active (15)] [Archived (2)]  ← tabs        │
├─────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ Quận 1 · Quan1 · 234 rows · Q1     │   │
│ │ [📥 Archive]                        │   │
│ ├──────────────────────────────────────┤   │
│ │ Quận 12 · Quan12 · 0 rows · Q12   │   │
│ │ [📥 Archive] [🗑 Delete]            │   │
│ └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│                              [Đóng]         │
└─────────────────────────────────────────────┘
```

Note: `DanhSachTru` show NO action buttons (protected).
Items hardcode cũ (không trong DiaBan) show chỉ `[📥 Archive]` (lưu vào DiaBan với status=archived, source=legacy).

### Archive modal confirm
```
Ẩn địa bàn "Quận 12" khỏi dropdown?
Data KHÔNG bị xóa. Có thể khôi phục bất cứ lúc nào trong tab Archived.
[Hủy] [Archive]
```

### Delete modal confirm (2 lớp)
```
🚨 XÓA ĐỊA BÀN "Quận 12"

Sheet: Quan12
Rows hiện có: 234 marker

☐ Cũng xóa tab Google Sheet (MẤT DATA KHÔNG HỒI PHỤC)

Gõ "DELETE" để xác nhận:
[________]

[Hủy] [🗑 Xóa]
```

Khi tick checkbox "Cũng xóa tab" → placeholder đổi thành "Gõ Quan12 để xác nhận" và validate exact match.

### Archived tab
```
┌──────────────────────────────────────┐
│ Quận 12 · Quan12 · archived 2d ago │
│ [↶ Restore] [🗑 Delete]              │
└──────────────────────────────────────┘
```

## Validation rules

| Rule | Error |
|---|---|
| Sheet name = `DanhSachTru` + action delete | "Không được xóa sheet gốc DanhSachTru" |
| Confirm text không khớp | "Confirm text sai — gõ chính xác" |
| Archive sheet đã archived | "Sheet đã archived rồi" (idempotent OK) |
| Delete sheet không trong DiaBan | "Sheet không trong config — thêm vào trước rồi archive" |

## Side effects client

**Sau archive hiện tại (`currentSheet` bị archive):**
```js
if (currentSheet === archivedSheet) {
    currentSheet = 'DanhSachTru';
    await loadFromCSVWithCache('DanhSachTru', ...);
}
```

**Sau delete:**
- Clear popup cache (sheet không tồn tại nữa)
- Reload dynamic districts
- Nếu dropdown đang chọn → chuyển về DanhSachTru

## Edge cases

| Case | Behavior |
|---|---|
| 2 admin cùng archive sheet | LockService serialize, thứ 2 OK (idempotent) hoặc error nếu đã archived |
| Delete tab trong khi user khác đang xem data đó | GAS delete xong, user khác fetch CSV fail → thấy toast "Sheet không tồn tại" |
| Restore sheet đã delete tab (nhưng config đã archive thôi) | Restore OK, nhưng CSV fetch sẽ fail — client show error, user tự tạo lại tab bằng create modal |
| Delete config nhưng tab Sheet đã bị user xóa manual | `ss.deleteSheet()` throw → catch silent, chỉ xóa config |

## Logging

Mọi action đều ghi `LichSu`:
- `archive_dia_ban` — detail: sheet name
- `restore_dia_ban` — detail: sheet name
- `delete_dia_ban` — detail: `JSON.stringify({sheet, alsoDeleteTab, rowCountBefore})`

Để audit "ai xóa sheet nào, khi nào".

## Rủi ro & mitigation

| R | Mitigation |
|---|---|
| **R1** User gõ nhầm "DELETE" (viết hoa VN gõ dễ sai) | Case-insensitive match + hint rõ "Gõ chính xác DELETE (viết hoa)" |
| **R2** User xóa nhầm sheet quan trọng → mất 1000 markers | 3 confirm + hiển thị row count trước khi xóa + checkbox default OFF (chỉ xóa config, giữ tab) |
| **R3** GAS deleteSheet() lỗi silent → client tưởng xóa xong mà sheet vẫn còn | Server trả `deletedTab: true/false` dựa trên kết quả thực tế → client toast rõ |

## Non-goals

- Bulk archive/delete nhiều sheet cùng lúc
- Permanent restore sau khi delete config (phải tạo lại via create modal)
- Backup CSV trước khi delete tab (defer — manual qua Google Sheet export)

## Timeline

- Bước 2: 15 phút (unit test validation + confirm pattern)
- Bước 3: 60 phút (GAS 3 handlers + client modal + 3-tier confirm)
- Bước 4: 15 phút
- Bước 5: 10 phút
- **Total**: ~100 phút
