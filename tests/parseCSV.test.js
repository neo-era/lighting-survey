// Test suite for parseCSVText — Wave 1 Bước 2
// Run: node tests/parseCSV.test.js
// Expected: FAIL trước khi implement Bước 3 (parser hiện tại sai escaped quote)

const fs = require('fs');
const path = require('path');

// Extract parseCSVText từ index.html
function extractParseCSVText() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const m = html.match(/function\s+parseCSVText\s*\([\s\S]*?^\s{8}\}/m);
    if (!m) throw new Error('Không tìm thấy parseCSVText trong index.html');
    return new Function(m[0] + '\nreturn parseCSVText;')();
}

const parseCSVText = extractParseCSVText();

let pass = 0, fail = 0;
function assertEq(name, actual, expected) {
    const same = JSON.stringify(actual) === JSON.stringify(expected);
    if (same) { pass++; console.log('✓', name); }
    else {
        fail++;
        console.log('✗', name);
        console.log('  expected:', JSON.stringify(expected));
        console.log('  actual:  ', JSON.stringify(actual));
    }
}

// === Happy path ===
assertEq('simple 3 cells',
    parseCSVText('a,b,c'),
    [['a','b','c']]);

assertEq('2 rows',
    parseCSVText('a,b\nc,d'),
    [['a','b'],['c','d']]);

assertEq('empty cell',
    parseCSVText('a,,c'),
    [['a','','c']]);

// === Quoted normal ===
assertEq('quoted simple',
    parseCSVText('"a","b","c"'),
    [['a','b','c']]);

assertEq('quoted with comma',
    parseCSVText('"a,b","c"'),
    [['a,b','c']]);

// === EDGE — escaped quote (BUG hiện tại) ===
assertEq('escaped quote middle',
    parseCSVText('"Trụ ""cấp 1"" tuyến A",note'),
    [['Trụ "cấp 1" tuyến A','note']]);

assertEq('escaped quote at end',
    parseCSVText('"say ""hi""","reply"'),
    [['say "hi"','reply']]);

assertEq('escaped quote with comma',
    parseCSVText('"a"",b","c"'),
    [['a",b','c']]);

assertEq('double escaped only',
    parseCSVText('""'),
    [['']]);

assertEq('escaped quote + normal text',
    parseCSVText('"He said ""hello""",OK'),
    [['He said "hello"','OK']]);

// === Vietnamese unicode ===
assertEq('unicode simple',
    parseCSVText('Trụ đèn,Đường Trần Hưng Đạo'),
    [['Trụ đèn','Đường Trần Hưng Đạo']]);

// === Empty/edge ===
assertEq('empty string',
    parseCSVText(''),
    []);

assertEq('blank line ignored',
    parseCSVText('a,b\n\nc,d'),
    [['a','b'],['c','d']]);

assertEq('CRLF line endings',
    parseCSVText('a,b\r\nc,d'),
    [['a','b'],['c','d']]);

// === Nasty ===
assertEq('trailing comma',
    parseCSVText('a,b,'),
    [['a','b','']]);

// Skipped: stray " in unquoted field is undefined per RFC 4180.
// Current parser treats it as opening quote → cell absorbs rest of line. Không fix trong Wave 1.
// assertEq('quote in middle unquoted (loose)', parseCSVText('a"b,c'), [['a"b','c']]);

console.log('\n=== Result:', pass, 'pass /', fail, 'fail ===');
process.exit(fail > 0 ? 1 : 0);
