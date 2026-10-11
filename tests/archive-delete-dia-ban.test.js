// Wave Archive/Delete Dia Ban — validation + confirm pattern tests
let pass = 0, fail = 0;
function assert(name, cond) {
    if (cond) { pass++; console.log('✓', name); }
    else { fail++; console.log('✗', name); }
}

// === Protected sheets ===
const PROTECTED_SHEETS = ['DanhSachTru'];
function canDelete(sheetName) {
    return !PROTECTED_SHEETS.includes(sheetName);
}
assert('DanhSachTru protected', canDelete('DanhSachTru') === false);
assert('Quan12 not protected', canDelete('Quan12') === true);
assert('Random sheet not protected', canDelete('MyNewSheet') === true);

// === Confirm text validation ===
function validateDeleteConfirm(confirmText, alsoDeleteTab, sheetName) {
    const required = alsoDeleteTab ? sheetName : 'DELETE';
    const got = String(confirmText || '').trim();
    if (got !== required) {
        return { ok: false, err: 'Confirm text sai — cần gõ chính xác "' + required + '"' };
    }
    return { ok: true };
}

assert('delete config: DELETE OK', validateDeleteConfirm('DELETE', false, 'Quan12').ok === true);
assert('delete config: wrong text', validateDeleteConfirm('delete', false, 'Quan12').ok === false);
assert('delete config: trimmed', validateDeleteConfirm('  DELETE  ', false, 'Quan12').ok === true);
assert('delete tab: sheet name OK', validateDeleteConfirm('Quan12', true, 'Quan12').ok === true);
assert('delete tab: wrong case', validateDeleteConfirm('quan12', true, 'Quan12').ok === false);
assert('delete tab: DELETE không đủ', validateDeleteConfirm('DELETE', true, 'Quan12').ok === false);
assert('delete empty confirm', validateDeleteConfirm('', false, 'Quan12').ok === false);
assert('delete null confirm', validateDeleteConfirm(null, false, 'Quan12').ok === false);

// === Status transition ===
function canArchive(current) { return current === 'active'; }
function canRestore(current) { return current === 'archived'; }
function canDeleteConfig(current) { return current === 'active' || current === 'archived'; }

assert('active → archive OK', canArchive('active') === true);
assert('archived → archive KHÔNG', canArchive('archived') === false);
assert('archived → restore OK', canRestore('archived') === true);
assert('active → restore KHÔNG', canRestore('active') === false);
assert('active → delete OK', canDeleteConfig('active') === true);
assert('archived → delete OK', canDeleteConfig('archived') === true);

// === Full delete flow validation (3 lớp) ===
function validateDeleteRequest(req, existingSheets, diaBanRow) {
    // Lớp 1: admin check (giả định đã pass)
    // Lớp 2: protected sheet
    if (!canDelete(req.sheet)) {
        return { ok: false, step: 'protected', err: 'Không được xóa sheet gốc' };
    }
    // Lớp 3: confirm text
    const vConfirm = validateDeleteConfirm(req.confirmText, req.alsoDeleteTab, req.sheet);
    if (!vConfirm.ok) return { ok: false, step: 'confirm', err: vConfirm.err };
    // Lớp 4: sheet existence check (optional - gracefully skip if alsoDeleteTab + sheet không tồn tại)
    const tabExists = existingSheets.includes(req.sheet);
    return { ok: true, tabExists };
}

const sampleSheets = ['DanhSachTru', 'Quan12', 'Quan11'];
assert('delete Quan12 với DELETE text, no tab',
    validateDeleteRequest({ sheet: 'Quan12', confirmText: 'DELETE', alsoDeleteTab: false }, sampleSheets).ok === true);
assert('delete Quan12 với sheet name, with tab',
    validateDeleteRequest({ sheet: 'Quan12', confirmText: 'Quan12', alsoDeleteTab: true }, sampleSheets).ok === true);
assert('delete DanhSachTru → reject protected',
    validateDeleteRequest({ sheet: 'DanhSachTru', confirmText: 'DELETE', alsoDeleteTab: false }, sampleSheets).step === 'protected');
assert('delete với wrong confirm → reject',
    validateDeleteRequest({ sheet: 'Quan12', confirmText: 'yes', alsoDeleteTab: false }, sampleSheets).step === 'confirm');
assert('delete sheet không tồn tại → tabExists false',
    validateDeleteRequest({ sheet: 'Quan99', confirmText: 'DELETE', alsoDeleteTab: false }, sampleSheets).tabExists === false);

// === Client post-action side effects ===
function handleAfterArchive(archivedSheet, currentSheet) {
    if (archivedSheet === currentSheet) {
        return { switchTo: 'DanhSachTru' };
    }
    return { switchTo: null };
}
assert('archive currentSheet → auto switch to DanhSachTru',
    handleAfterArchive('Quan12', 'Quan12').switchTo === 'DanhSachTru');
assert('archive other sheet → không switch',
    handleAfterArchive('Quan12', 'Quan11').switchTo === null);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
