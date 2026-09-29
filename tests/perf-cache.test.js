// Wave 2 — cache hit ratio + benchmark
// Run: node tests/perf-cache.test.js
// Verify: cache map returns SAME object cho same input, DIFFERENT cho different input

let pass = 0, fail = 0;
function assert(name, cond) {
    if (cond) { pass++; console.log('✓', name); }
    else { fail++; console.log('✗', name); }
}

// Simulate icon cache logic
const iconCache = new Map();
function iconKey(color, loaiDen, congSuat, soLuong, type, hasIncident) {
    return `${color}|${loaiDen}|${congSuat}|${soLuong}|${type}|${hasIncident?1:0}`;
}
function makeLampIconMock(color, loaiDen, congSuat, soLuong, type, hasIncident) {
    const key = iconKey(color, loaiDen, congSuat, soLuong, type, hasIncident);
    if (iconCache.has(key)) return iconCache.get(key);
    const icon = { _html: `svg:${key}`, _type: 'divIcon' };  // simulate divIcon creation
    iconCache.set(key, icon);
    return icon;
}

// Test 1: same input → same object
const a = makeLampIconMock('#0ea5e9', 'LED', '100', '1', 1, false);
const b = makeLampIconMock('#0ea5e9', 'LED', '100', '1', 1, false);
assert('same input → same object ref', a === b);

// Test 2: different input → different object
const c = makeLampIconMock('#ec4899', 'LED', '100', '1', 2, false);
assert('different type → different object', a !== c);

// Test 3: hasIncident change → different object
const d = makeLampIconMock('#0ea5e9', 'LED', '100', '1', 1, true);
assert('hasIncident change → different object', a !== d);

// Test 4: cache size grows correctly
iconCache.clear();
for (let i = 0; i < 100; i++) makeLampIconMock('#0ea5e9', 'LED', '100', '1', 1, false);
assert('100 calls same input → cache size 1', iconCache.size === 1);

for (let type = 1; type <= 4; type++) {
    for (let watt of ['50','100','150']) {
        for (let n of ['1','2']) {
            makeLampIconMock('#0ea5e9', 'LED', watt, n, type, false);
        }
    }
}
assert('permutation coverage → cache holds distinct entries',
    iconCache.size === 1 + 4*3*2);

// === Popup cache ===
const popupCache = new Map();
let popupBuildCount = 0;
function buildPopupHtml(row) {
    popupBuildCount++;
    return `<div>${row[1]} ${row[0]}</div>`;
}
function getCachedPopup(row) {
    const key = String(row[0] || row[1]);
    if (popupCache.has(key)) return popupCache.get(key);
    const html = buildPopupHtml(row);
    popupCache.set(key, html);
    return html;
}
function invalidatePopup(row) {
    popupCache.delete(String(row[0] || row[1]));
}

const row1 = ['ID1', 'Trụ A'];
popupBuildCount = 0;
getCachedPopup(row1);
getCachedPopup(row1);
getCachedPopup(row1);
assert('popup: 3 calls same row → build 1 lần', popupBuildCount === 1);

const row2 = ['ID2', 'Trụ B'];
getCachedPopup(row2);
assert('popup: khác row → build tăng lên', popupBuildCount === 2);

invalidatePopup(row1);
getCachedPopup(row1);
assert('popup: sau invalidate → rebuild', popupBuildCount === 3);

// === Debounce ===
function debounce(fn, ms) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}
let callCount = 0;
const debounced = debounce(() => callCount++, 50);
debounced(); debounced(); debounced();
setTimeout(() => {
    assert('debounce: 3 rapid calls → 1 execution', callCount === 1);
    // Sau đó 1 call nữa → 2 total
    debounced();
    setTimeout(() => {
        assert('debounce: 1 more call sau timeout → 2 total', callCount === 2);
        console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
        process.exit(fail > 0 ? 1 : 0);
    }, 80);
}, 80);
