// batch_match_update khớp theo ID trước (dòng trùng tên) — chạy CHÍNH gas-khaosat.js trong vm với sheet giả
// Run: node tests/batch-match-id.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + n); };

const HEAD = ['ID', 'Tên trụ', 'Lat', 'Lon', 'Thời gian cập nhật', 'Khoảng cách (m)'];
function makeSheet(rows) {
    const data = [HEAD.slice(), ...rows.map(r => r.slice())];
    const range = (r, c, nr, nc) => ({
        getValues: () => data.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)),
        setValues: vals => vals.forEach((v, i) => v.forEach((x, j) => { data[r - 1 + i][c - 1 + j] = x; })),
        setValue: v => { data[r - 1][c - 1] = v; }
    });
    return { data, getLastRow: () => data.length, getLastColumn: () => HEAD.length, getRange: range, getName: () => 'S' };
}
function load(sheet) {
    const ctx = {
        SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }), openById: () => null },
        ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 'json' } },
        LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
        Logger: { log() {} }, Utilities: {}, PropertiesService: {}, console
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas-khaosat.js'), 'utf8'), ctx);
    return ctx;
}

// Sheet có 2 dòng trùng tên "BTX_6" khác ID + 1 dòng không ID
{
    const sheet = makeSheet([
        ['Q1_006', 'BTX_6', 10.1, 106.1, '', 30],
        ['Q1_106', 'BTX_6', 10.2, 106.2, '', 31],
        ['', 'MOI_1', 10.3, 106.3, '', 5],
    ]);
    const G = load(sheet);
    const res = G.handleBatchMatchUpdate('S', [
        { tenTru: 'BTX_6', _matchId: 'Q1_106', lat: 11, lon: 107 },
        { tenTru: 'MOI_1', _matchId: '', lat: 12, lon: 108, khoangCach: 7 },
    ]);
    ok('trả về updated=2, notFound=0', res.status === 'ok' && res.updated === 2 && res.notFound === 0);
    ok('dòng trùng tên: CHỈ dòng có ID Q1_106 đổi toạ độ', sheet.data[2][2] === 11 && sheet.data[2][3] === 107);
    ok('dòng trùng tên kia (Q1_006) giữ nguyên', sheet.data[1][2] === 10.1 && sheet.data[1][3] === 106.1);
    ok('dòng không ID → khớp theo tên', sheet.data[3][2] === 12 && sheet.data[3][5] === 7);
    ok('không ghi _matchId ra sheet / không đổi cột ID', sheet.data[2][0] === 'Q1_106' && sheet.data[3][0] === '' && sheet.data[0].length === HEAD.length);
}

// ID không có trong sheet → fallback theo tên; không ID + không tên khớp → notFound
{
    const sheet = makeSheet([['Q1_001', 'A_1', 1, 1, '', '']]);
    const G = load(sheet);
    const res = G.handleBatchMatchUpdate('S', [
        { tenTru: 'A_1', _matchId: 'KHONG_CO', lat: 2 },
        { tenTru: 'B_9', _matchId: 'Q9_999', lat: 3 },
    ]);
    ok('ID lạ → fallback theo tên', sheet.data[1][2] === 2);
    ok('không khớp gì → notFound=1', res.updated === 1 && res.notFound === 1);
}

// Tương thích ngược: record không có _matchId vẫn khớp theo tên như cũ
{
    const sheet = makeSheet([['X1', 'C_1', 1, 1, '', ''], ['X2', 'C_2', 1, 1, '', '']]);
    const G = load(sheet);
    G.handleBatchMatchUpdate('S', [{ tenTru: 'C_2', lat: 9 }]);
    ok('không _matchId → theo tên (C_2 đổi, C_1 giữ)', sheet.data[2][2] === 9 && sheet.data[1][2] === 1);
}

// Client: pushMovedMarkersToSheet dùng batch cho MỌI số lượng + gửi _matchId
{
    const html = require('../tools/app-source.cjs').appSource();   // index.html + src/*.js (module hoá)
    const fn = html.match(/async function pushMovedMarkersToSheet\(\) \{[\s\S]*?\n        \}/);
    ok('pushMovedMarkersToSheet không còn ngưỡng rows.length >= 20', fn && !/rows\.length\s*>=\s*20/.test(fn[0]));
    const bs = html.match(/async function _batchSyncRowsToGAS\([\s\S]*?\n        \}/);
    ok('_batchSyncRowsToGAS gửi _matchId', bs && /_matchId/.test(bs[0]));
}

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
