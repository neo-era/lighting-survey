// _testGvizUrl — phân biệt CSV thật với trang đăng nhập Google.
//
// Bối cảnh: địa bàn tạo động dùng URL gviz, URL này YÊU CẦU ĐĂNG NHẬP. Khi sheet chưa chia sẻ
// công khai, Google trả trang HTML đăng nhập. Validator cũ chỉ kiểm "body có dấu phẩy hoặc dấu
// nháy" nên trang HTML lọt qua → địa bàn tạo ra không tải được mà không ai biết, trình duyệt
// chỉ báo "Failed to fetch". Xem docs/design-fix-gviz-csv-401.md
// Run: node tests/gviz-url-check.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(name, cond, extra) {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗', name, extra === undefined ? '' : '→ ' + JSON.stringify(extra)); }
}

const GAS_SRC = fs.readFileSync(path.join(root, 'gas-khaosat.js'), 'utf8');

/** Trích nguyên văn 1 hàm từ gas-khaosat.js để test đúng code chạy thật (không phải bản chép). */
function extractFn(name) {
    const start = GAS_SRC.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('Không tìm thấy hàm ' + name + ' trong gas-khaosat.js');
    let depth = 0, i = GAS_SRC.indexOf('{', start);
    for (; i < GAS_SRC.length; i++) {
        if (GAS_SRC[i] === '{') depth++;
        else if (GAS_SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return GAS_SRC.slice(start, i);
}

/**
 * Dựng _testGvizUrl với UrlFetchApp giả lập.
 * Phải nạp kèm norm() vì _testGvizUrl phụ thuộc vào nó (trong GAS cả hai là hàm toàn cục).
 * `response` là Error để mô phỏng lỗi mạng.
 */
function buildTester(response) {
    const UrlFetchApp = {
        fetch() {
            if (response instanceof Error) throw response;
            return {
                getResponseCode: () => response.code,
                getContentText: () => response.body,
                getHeaders: () => response.headers || {}
            };
        }
    };
    const src = extractFn('norm') + '\n' + extractFn('_testGvizUrl') + '\n; return _testGvizUrl;';
    return new Function('UrlFetchApp', src)(UrlFetchApp);
}

const CT_CSV  = { 'Content-Type': 'text/csv; charset=utf-8' };
const CSV_OK          = 'ID,Tên trụ,Lat,Lon,Ghi chú\nQ_001,VTS_01,10.76,106.66,\n';
const CSV_HEADER_ONLY = 'ID,Tên trụ,Lat,Lon\n';
// Trang đăng nhập Google thật — có CẢ dấu phẩy lẫn dấu nháy nên qua mặt validator cũ
const HTML_LOGIN = '<!DOCTYPE html><html><head><style nonce="abc">body{margin:0,padding:0}'
    + '</style><title>Đăng nhập</title></head><body><div class="button primary-button">'
    + 'Sign in</div></body></html>';

const T = (code, body, headers) => buildTester({ code, body, headers: headers || {} })('https://x');

console.log('_testGvizUrl:');
let r;

// --- Ca hợp lệ ---
assert('chấp nhận CSV thật có cột Tên trụ', T(200, CSV_OK, CT_CSV).ok === true, T(200, CSV_OK, CT_CSV));
assert('chấp nhận CSV chỉ có dòng tiêu đề (địa bàn mới chưa có trụ)', T(200, CSV_HEADER_ONLY, CT_CSV).ok === true);

// Header dán từ macOS / IMPORTRANGE có thể ở dạng NFD. Regex viết bằng NFC sẽ không khớp
// nếu không normalize → báo fail oan dù sheet hoàn toàn đúng.
r = T(200, 'ID,' + 'Tên trụ'.normalize('NFD') + ',Lat\n', CT_CSV);
assert('chấp nhận cột Tên trụ dạng NFD (dấu tổ hợp)', r.ok === true, r);
r = T(200, 'ID,' + 'TÊN TRỤ'.normalize('NFD') + ',Lat\n', CT_CSV);
assert('chấp nhận TÊN TRỤ viết hoa, dạng NFD', r.ok === true, r);
r = T(200, 'ID,Tên  trụ,Lat\n', CT_CSV);
assert('chấp nhận "Tên  trụ" hai khoảng trắng', r.ok === true, r);

// --- Ca gây ra lỗi thật ngoài hiện trường ---
r = T(200, HTML_LOGIN, { 'Content-Type': 'text/html; charset=utf-8' });
assert('TỪ CHỐI trang HTML đăng nhập dù HTTP 200', r.ok === false, r);
r = T(200, HTML_LOGIN, {});
assert('TỪ CHỐI HTML cả khi thiếu header Content-Type', r.ok === false, r);
r = T(200, HTML_LOGIN, { 'CONTENT-TYPE': 'text/html' });
assert('TỪ CHỐI HTML khi header viết HOA toàn bộ', r.ok === false, r);

r = T(401, HTML_LOGIN, { 'Content-Type': 'text/html' });
assert('từ chối HTTP 401 và nêu đúng mã lỗi', r.ok === false && r.code === 401, r);

// gviz lặng lẽ trả CSV của SHEET ĐẦU TIÊN khi tên tab sai (đã kiểm bằng curl thật — KHÔNG
// trả envelope lỗi). Nếu sheet rơi về đó không có cột Tên trụ thì phải bắt được.
r = T(200, 'A,B,C\n1,2,3\n', CT_CSV);
assert('từ chối khi gviz rơi về sheet khác không có cột Tên trụ', r.ok === false, r);
r = T(200, 'ID,Ten cot khac,Lat\n', CT_CSV);
assert('từ chối CSV chỉ có tiêu đề nhưng sai cột', r.ok === false, r);

// --- Ca biên ---
assert('từ chối body rỗng', T(200, '', CT_CSV).ok === false);
r = T(200, '   \n\n  ', CT_CSV);
assert('từ chối body chỉ có khoảng trắng', r.ok === false, r);

let threw = false;
try { r = buildTester(new Error('DNS fail'))('https://x'); } catch (e) { threw = true; }
assert('không ném khi UrlFetchApp lỗi mạng', threw === false && r.ok === false, r);

r = T(200, HTML_LOGIN, { 'Content-Type': 'text/html' });
assert('luôn kèm lý do đọc được khi fail', typeof r.reason === 'string' && r.reason.length > 0, r);

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
