---
name: dev-loop
description: Chu trình phát triển 7 bước — lập kế hoạch → viết test → code → tự review từ góc nhìn mới → kiểm chứng → ghi nhớ → cải thiện. Dùng khi user yêu cầu thực hiện một task code có độ phức tạp vừa/cao (thêm feature mới, fix bug khó, refactor module), hoặc gõ `/dev-loop` để bắt đầu chu trình. KHÔNG dùng cho task trivial (đổi text, rename biến, thêm 1 dòng).
---

# Chu trình dev-loop — 7 bước

Đây là chu trình chuẩn cho task phức tạp. Đi theo THỨ TỰ, không skip bước nào. Mỗi bước kết thúc bằng 1 dòng tóm tắt gửi user trước khi sang bước tiếp theo.

Trước khi bắt đầu, gọi TodoWrite tạo 7 mục tương ứng 7 bước dưới — cập nhật status khi mỗi bước xong.

---

## Bước 1 — Lập kế hoạch (Plan)

Trước khi viết dòng code nào:

1. **Đọc context**: file/module liên quan, CLAUDE.md hiện tại, memory nếu có
2. **Xác định thay đổi**:
   - File nào bị đụng, dòng nào (file:line)
   - Signature hàm mới / thay đổi
   - Dependencies chéo (cần đụng file khác không)
   - Backwards-compatibility (có breaking change không)
3. **Liệt kê edge cases**: input rỗng, null, unicode, giá trị âm, boundary, concurrent, offline
4. **Chọn approach**: nếu có ≥2 cách, ghi ngắn gọn trade-off từng cách + chọn 1
5. **Rủi ro chính**: 1-3 rủi ro lớn nhất có thể phá vỡ đâu đó

**Output**: message ngắn ≤ 8 dòng gửi user gồm: `Approach:`, `Files sẽ sửa:`, `Edge cases:`, `Rủi ro:`, `Ước tính effort:`. Không cần user duyệt trừ khi kế hoạch phá cấu trúc lớn hoặc user đã nói "chỉ làm khi tôi OK".

## Bước 2 — Viết test (Write tests)

**Test trước code** — dù project chưa có test framework:

1. **Nếu có test framework** (Vitest/Jest/Pytest): tạo file test đầy đủ
2. **Nếu chưa có**: viết test dạng "verification script" — script Node.js/PowerShell/bash ngắn assert kết quả bằng `console.assert` hoặc exit code, hoặc HTML page với `<script>` chạy manually
3. **Cho code không testable dễ** (UI, integration): viết checklist verification manual dạng:
   ```
   □ Click X → Y hiện
   □ Nhập input Z → validation W
   □ Ngắt mạng → offline message
   ```
4. Cover đủ:
   - Happy path (input hợp lệ, kết quả mong đợi)
   - Ít nhất 3 edge cases từ Bước 1
   - Error path (input sai, exception được throw đúng)

Test/checklist này phải **fail hoặc chưa chạy được** trước Bước 3 — chưa có code implement.

**Output**: `Đã viết N test / verification checkpoints. Chưa run — sẽ fail.`

## Bước 3 — Code (Implement)

Viết code implement để pass tests ở Bước 2:

1. **Small commits mental**: implement từng test một, không all-at-once
2. **Không thêm feature ngoài kế hoạch**: nếu phát hiện task cần mở rộng, hỏi user, không tự thêm
3. **Không refactor code cũ** không liên quan trực tiếp đến task
4. **Comment chỉ khi WHY non-obvious** (theo CLAUDE.md rule)
5. **Match code style hiện tại** — không đưa vào pattern lạ (VD dùng jQuery nếu codebase dùng jQuery)

**Output**: `Đã implement. Files thay đổi: [list]. Dòng thay đổi: ~N lines.`

## Bước 4 — Tự review từ GÓC NHÌN MỚI (Fresh-eyes review)

**QUAN TRỌNG**: Đây KHÔNG phải là "đọc lại code của tôi". Là **giả vờ là code reviewer mới**, chưa biết gì về conversation này, chỉ đọc diff.

Làm theo trình tự này, không skip:

1. **Reset mental context**: viết 1 dòng "Tôi là reviewer mới, chưa biết task này để làm gì."
2. **Chỉ đọc diff** (git diff), không đọc lại conversation
3. **Đặt 5 câu hỏi**:
   - Tên hàm/biến này đọc lên có hiểu ngay không? Có ambiguous không?
   - Nếu người khác dùng hàm này 6 tháng nữa, họ có gọi sai không?
   - Có xử lý input xấu không (null, undefined, empty, unicode, giá trị lớn)?
   - Có leak (memory, listener, file handle, network conn) khi throw giữa chừng không?
   - Có duplicate logic với code cũ ở nơi khác không?
4. **Grep** những từ khóa liên quan trong codebase để tìm duplicate / conflict
5. **Ghi findings ra danh sách ≥3 issue** — kể cả nếu tưởng "OK rồi" thì cũng phải cố tìm 3

**Output**: bảng findings dạng:
```
| # | Vấn đề | File:line | Severity (H/M/L) |
```
Nếu thật sự 0 issue: ghi "Đã review, không tìm thấy issue nào" nhưng phải nêu 3 câu hỏi cụ thể đã đặt để chứng minh đã review thật.

## Bước 5 — Kiểm chứng (Verify)

Fix findings từ Bước 4 (nếu có severity H/M), sau đó verify:

1. **Chạy test/verification script** từ Bước 2 — TẤT CẢ phải pass
2. **Verify manual checklist** (nếu là UI): mô tả rõ đã click/nhập gì, kết quả ra sao. Nếu không tự chạy được, ghi rõ "Không tự test được, cần user verify: [checklist]"
3. **Regression check**: chạy tests hiện có (nếu có), hoặc mở feature liên quan trong browser xem còn work không
4. **Syntax check**: cho JS, chạy `node -e "new Function(fs.readFileSync(...))"` hoặc project's linter/tsc
5. **Nếu có gì fail**: quay lại Bước 3 (implement) hoặc Bước 4 (review), không cheat pass

**Output**: `✓ N/N tests pass. Manual checklist: [status]. Regression: [status].`

## Bước 6 — Ghi nhớ (Remember)

Update memory theo `MEMORY.md` protocol của user:

1. **Suy nghĩ có gì đáng nhớ**:
   - Non-obvious constraint mới phát hiện (VD: "GAS không hỗ trợ optional chaining")
   - Pattern user preference vừa xác nhận (VD: "user muốn error message tiếng Việt, không English")
   - Bug fix có root cause thú vị (VD: "Google Sheet locale VN lưu comma decimal → parseFloat lỗi")
   - Feedback user đưa ra trong task này (correction hoặc validation)
   - Reference mới về external system
2. **KHÔNG lưu**: code pattern đã có trong file (git log biết), task-specific state, ephemeral debug info
3. **Nếu có gì đáng lưu**: write memory file mới hoặc append vào memory hiện có, update `MEMORY.md` index (1 dòng)
4. **Nếu không có gì đáng lưu**: ghi rõ "Không có memory mới — task này thuộc pattern đã biết"

**Output**: `Memory: [đã thêm N mục / không có]`

## Bước 7 — Cải thiện (Improve — reflect for next time)

Reflect ngắn về chu trình vừa rồi:

1. **Bước nào tốn nhiều thời gian nhất?** Có phải do task khó thật hay do approach chưa tối ưu?
2. **Bước 4 (review) có tìm ra issue không?** Nếu có → tốt, chu trình đang hoạt động. Nếu không → có thể review chưa đủ nghiêm, note lại để lần sau nghiêm hơn
3. **Có bước nào skip không?** Nếu skip → giải thích lý do, hoặc thừa nhận đã sai (không được lặp lại)
4. **Đề xuất cải thiện cho task tương tự lần sau**: 1-2 câu ngắn

**Output**: Message cuối gửi user gồm:
- ✅ Xong task
- 📊 Effort thực tế vs ước tính (Bước 1)
- 💡 Learning cho lần sau (nếu có)
- 🔜 Suggested next steps (nếu applicable)

---

## Nguyên tắc chung

- **KHÔNG được skip bước**: nếu task đơn giản đến mức không cần Bước 2 (test), hoặc Bước 6 (memory), vẫn phải NÊU RÕ lý do skip trong output, không im lặng bỏ qua
- **Bước 4 là KEY** — nhiều bug lọt lưới vì reviewer là chính mình. Nếu cảm thấy "code tôi vừa viết chắc chắn đúng" → tự cảnh giác gấp đôi
- **Không cheat**: không viết test dễ pass để check-off, không skip verify vì "tin rằng code đúng", không đánh dấu completed khi thật ra chưa test
- **Với task cần user duyệt** (destructive action, deploy, breaking change): dừng ở cuối Bước 1 chờ user approve trước khi sang Bước 2

## Template Todo cho chu trình

```
1. [pending] Plan — approach + files + edge cases + rủi ro
2. [pending] Tests — viết test trước, expect fail
3. [pending] Code — implement để pass tests
4. [pending] Fresh-eyes review — giả vờ là reviewer mới, ≥3 findings
5. [pending] Verify — chạy test + regression + syntax check
6. [pending] Memory — ghi learning nếu có
7. [pending] Improve — reflect + suggest next
```

## Khi user gõ `/dev-loop <mô tả task>`

Bắt đầu ngay Bước 1 với task đó. Không hỏi lại clarification trừ khi task ambiguous đến mức không thể plan.

## Khi task đang chạy có phản hồi user

- Nếu user nói "OK, tiếp": tiếp bước hiện tại
- Nếu user thêm requirement: quay lại Bước 1 update plan
- Nếu user báo bug: quay lại Bước 3 fix + phải làm lại Bước 4 (review)
- Nếu user nói "skip test": vẫn viết checklist verification manual (Bước 2 tối thiểu)
