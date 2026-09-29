// Wave 4a — batch chunk sizing + editingRow race guard logic
let pass = 0, fail = 0;
function assert(name, cond) {
    if (cond) { pass++; console.log('✓', name); }
    else { fail++; console.log('✗', name); }
}

// Test 1: chunk size mobile vs desktop
function pickChunkSize(userOpt, isMobile) {
    // Mirror logic: opts > APP_CONFIG default (mobile 200 / desktop 500) > 500 hardcoded fallback
    const APP_CONFIG = { batch: { chunkSize: isMobile ? 200 : 500 } };
    return (userOpt && userOpt.chunkSize) || (APP_CONFIG.batch && APP_CONFIG.batch.chunkSize) || 500;
}
assert('mobile default 200', pickChunkSize(null, true) === 200);
assert('desktop default 500', pickChunkSize(null, false) === 500);
assert('override wins mobile', pickChunkSize({chunkSize: 300}, true) === 300);
assert('override wins desktop', pickChunkSize({chunkSize: 1000}, false) === 1000);
assert('opts empty → default', pickChunkSize({}, false) === 500);

// Test 2: editingRow capture pattern
let _editingRow = null;
async function saveMockOld() {
    // OLD: uses global mid-await
    await new Promise(r => setTimeout(r, 20));
    return _editingRow;
}
async function saveMockNew() {
    // NEW: capture local const at start
    const _capturedRow = _editingRow;
    await new Promise(r => setTimeout(r, 20));
    return _capturedRow;
}

(async () => {
    _editingRow = 'row1';
    const p1old = saveMockOld();
    _editingRow = 'row2';  // race: user opens another edit
    const res1old = await p1old;
    assert('OLD: mid-await race → wrong row', res1old === 'row2');

    _editingRow = 'row1';
    const p1new = saveMockNew();
    _editingRow = 'row2';
    const res1new = await p1new;
    assert('NEW: capture pattern → correct row', res1new === 'row1');

    console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
    process.exit(fail > 0 ? 1 : 0);
})();
