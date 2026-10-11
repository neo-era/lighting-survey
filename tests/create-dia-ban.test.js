// Create Dia Ban — logic validation tests
// Run: node tests/create-dia-ban.test.js
let pass = 0, fail = 0;
function assert(name, cond) {
    if (cond) { pass++; console.log('✓', name); }
    else { fail++; console.log('✗', name); }
}

// === Sheet name validation ===
function validateSheetName(name, existingSheets) {
    if (!name || typeof name !== 'string') return { ok: false, err: 'Tên tab bắt buộc' };
    const trimmed = name.trim();
    if (!/^[A-Za-z0-9_]{1,50}$/.test(trimmed)) {
        return { ok: false, err: 'Tên tab chỉ chấp nhận A-Z, 0-9, _ (max 50 ký tự)' };
    }
    if (existingSheets.includes(trimmed)) {
        return { ok: false, err: 'Tab đã tồn tại' };
    }
    return { ok: true, name: trimmed };
}

const existing = ['DanhSachTru', 'Quan1', 'PhuNhuan'];
assert('valid name OK', validateSheetName('Quan12', existing).ok === true);
assert('valid name underscored', validateSheetName('My_Sheet', existing).ok === true);
assert('reject empty', validateSheetName('', existing).ok === false);
assert('reject with space', validateSheetName('Quan 12', existing).ok === false);
assert('reject Vietnamese', validateSheetName('Quận12', existing).ok === false);
assert('reject special chars', validateSheetName('Quan@12', existing).ok === false);
assert('reject existing name', validateSheetName('Quan1', existing).ok === false);
assert('reject >50 chars', validateSheetName('A'.repeat(51), existing).ok === false);
assert('trim whitespace', validateSheetName('  Quan12  ', existing).name === 'Quan12');

// === Label validation ===
function validateLabel(label) {
    if (!label || typeof label !== 'string') return { ok: false, err: 'Label bắt buộc' };
    const trimmed = label.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
        return { ok: false, err: 'Label 1-80 ký tự' };
    }
    return { ok: true, label: trimmed };
}

assert('label Vietnamese OK', validateLabel('Quận 12').ok === true);
assert('label with special OK', validateLabel('Xã Bà Rịa - Vũng Tàu').ok === true);
assert('reject empty label', validateLabel('').ok === false);
assert('reject >80 label', validateLabel('X'.repeat(81)).ok === false);

// === Prefix validation ===
function validatePrefix(prefix, existingPrefixes) {
    if (!prefix) return { ok: false, err: 'Prefix bắt buộc' };
    const trimmed = String(prefix).trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(trimmed)) {
        return { ok: false, err: 'Prefix chỉ A-Z, 0-9 (max 10 ký tự)' };
    }
    const warn = existingPrefixes.includes(trimmed) ? 'Prefix trùng với địa bàn khác' : null;
    return { ok: true, prefix: trimmed, warn };
}

const existingPrefix = ['TQ', 'Q1', 'PN'];
assert('prefix Q12 OK', validatePrefix('Q12', existingPrefix).ok === true);
assert('prefix auto uppercase', validatePrefix('q12', existingPrefix).prefix === 'Q12');
assert('reject prefix with special', validatePrefix('Q1!', existingPrefix).ok === false);
assert('warn duplicate prefix', validatePrefix('Q1', existingPrefix).warn !== null);
assert('allow duplicate (not reject)', validatePrefix('Q1', existingPrefix).ok === true);

// === Auto-suggest prefix từ sheet name ===
function suggestPrefix(sheet) {
    // Rule: lấy chữ cái đầu uppercase + digits
    // VD: "Quan12" → "Q12", "PhuNhuan" → "PN", "TruVanTho" → "TVT", "BauBang" → "BB"
    const letters = sheet.replace(/[^A-Z]/g, ''); // uppercase letters only
    const digits = sheet.match(/\d+/g);
    const prefix = (letters.slice(0, 3) + (digits ? digits.join('') : '')).toUpperCase();
    return prefix.slice(0, 10);
}

assert('suggest Quan12 → Q12', suggestPrefix('Quan12') === 'Q12');
assert('suggest PhuNhuan → PN', suggestPrefix('PhuNhuan') === 'PN');
assert('suggest TruVanTho → TVT', suggestPrefix('TruVanTho') === 'TVT');
assert('suggest BauBang → BB', suggestPrefix('BauBang') === 'BB');
assert('suggest Quan123 → Q123', suggestPrefix('Quan123') === 'Q123');

// === GViz URL builder ===
function buildGvizUrl(spreadsheetId, sheetName) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?` +
           `tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

const expected = 'https://docs.google.com/spreadsheets/d/1abc/gviz/tq?tqx=out:csv&sheet=Quan12';
assert('GViz URL simple', buildGvizUrl('1abc', 'Quan12') === expected);
assert('GViz URL với encoded space (edge)',
    buildGvizUrl('1abc', 'My Sheet').includes('My%20Sheet'));

// === Dynamic merge logic ===
function mergeDistrictPages(hardcoded, dynamic) {
    const map = new Map(hardcoded.map(p => [p.sheet, p]));
    dynamic.forEach(p => map.set(p.sheet, p)); // dynamic wins
    return Array.from(map.values());
}

const hc = [
    { sheet: 'DanhSachTru', label: 'Tổng quan', csvUrl: 'url1' },
    { sheet: 'Quan1', label: 'Quận 1', csvUrl: 'url2' }
];
const dyn = [
    { sheet: 'Quan1', label: 'Quận 1 (updated)', csvUrl: 'url2-new' },
    { sheet: 'Quan12', label: 'Quận 12', csvUrl: 'url3' }
];
const merged = mergeDistrictPages(hc, dyn);
assert('merge: 3 unique entries', merged.length === 3);
assert('merge: dynamic WINS override hardcode',
    merged.find(p => p.sheet === 'Quan1').label === 'Quận 1 (updated)');
assert('merge: hardcoded không bị xóa khi không có trong dynamic',
    merged.find(p => p.sheet === 'DanhSachTru') !== undefined);
assert('merge: dynamic-only entry được thêm',
    merged.find(p => p.sheet === 'Quan12') !== undefined);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
