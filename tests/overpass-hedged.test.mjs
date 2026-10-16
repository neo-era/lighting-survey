// _overpassFetch — hedged request: gọi máy 1, máy lỗi → gọi ngay máy kế, máy chưa trả sau hedgeMs → gọi thêm.
// _overpassTimeoutFor — timeout mỗi request theo diện tích vùng tải.
//
// Bối cảnh: bản cũ thử tuần tự 4 máy, 45s/máy → xuất CAD 4 marker đứng tới 180s (đo thật: maps.mail.ru treo 51s).
// Không bắn cả 4 máy cùng lúc vì Overpass công cộng tính quota theo thời gian chạy query, huỷ phía trình duyệt
// không dừng query phía máy chủ. Xem docs/design-fix-cad-export-slow.md
// Run: node tests/overpass-hedged.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(name, cond, extra) {
    if (cond) { pass++; console.log('  OK  ', name); }
    else { fail++; console.log('  FAIL', name, extra === undefined ? '' : '-> ' + JSON.stringify(extra)); }
}

const SRC = fs.readFileSync(path.join(root, 'src/features/osm.js'), 'utf8');

function extractFn(name) {
    const start = SRC.search(new RegExp('(async\\s+)?function\\s+' + name + '\\s*\\('));
    if (start < 0) throw new Error('Khong tim thay ham ' + name);
    let depth = 0, i = SRC.indexOf('{', start);
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') depth++;
        else if (SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}
function constNum(name) {
    const m = SRC.match(new RegExp('const ' + name + '\\s*=\\s*(\\d+)'));
    if (!m) throw new Error('Khong tim thay hang ' + name);
    return parseInt(m[1], 10);
}
function extractUrls() {
    const m = SRC.match(/const OVERPASS_URLS\s*=\s*\[([\s\S]*?)\]/);
    return m[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(s => s.startsWith('http') || s === 'OVERPASS_URL')
        .map(s => (s === 'OVERPASS_URL' ? 'https://overpass-api.de/api/interpreter' : s));
}

const URLS = extractUrls();
const H = URLS.map(u => u.replace(/^https?:\/\//, '').split('/')[0]);
const C = {
    MIN: constNum('OVERPASS_TIMEOUT_MIN_MS'),
    MAX: constNum('OVERPASS_TIMEOUT_MS'),
    HEDGE: constNum('OVERPASS_HEDGE_MS')
};

function mkAbortErr() { const e = new Error('aborted'); e.name = 'AbortError'; return e; }

// plan: { host: 'hang' | { delay, ok, status, body } }; may khong khai bao = 'hang'
function build(plan, AC) {
    const state = { started: [], aborted: 0 };
    function fetchMock(url, init) {
        const host = String(url).replace(/^https?:\/\//, '').split('/')[0];
        state.started.push(host);
        const cfg = plan[host] || 'hang';
        return new Promise((resolve, reject) => {
            let done = false;
            const sig = init && init.signal;
            if (sig) {
                if (sig.aborted) { state.aborted++; return reject(mkAbortErr()); }
                sig.addEventListener('abort', () => { if (done) return; done = true; state.aborted++; reject(mkAbortErr()); });
            }
            if (cfg === 'hang') return;
            setTimeout(() => {
                if (done) return;
                done = true;
                if (cfg.ok === false) resolve({ ok: false, status: cfg.status || 500, json: async () => ({}) });
                else resolve({ ok: true, status: 200, json: async () => cfg.body });
            }, cfg.delay == null ? 5 : cfg.delay);
        });
    }
    const src = 'const OVERPASS_URLS = ' + JSON.stringify(URLS) + ';\n'
        + 'const OVERPASS_TIMEOUT_MIN_MS = ' + C.MIN + ';\n'
        + 'const OVERPASS_TIMEOUT_MS = ' + C.MAX + ';\n'
        + 'const OVERPASS_HEDGE_MS = ' + C.HEDGE + ';\n'
        + 'let _overpassGoodIdx = 0;\n'
        + extractFn('_overpassTimeoutFor') + '\n'
        + extractFn('_overpassFetch') + '\n; return { _overpassFetch, _overpassTimeoutFor };';
    const fns = new Function('fetch', 'AbortController', 'setTimeout', 'clearTimeout', src)(
        fetchMock, AC === undefined ? AbortController : AC, setTimeout, clearTimeout);
    return { fn: fns._overpassFetch, timeoutFor: fns._overpassTimeoutFor, state };
}

const OK = { elements: [{ type: 'way', id: 1 }] };
const FAST = { hedgeMs: 60, timeoutMs: 400 };   // thu nhỏ thời gian cho test chạy nhanh
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('_overpassFetch (hedged) + _overpassTimeoutFor');
console.log('  [cau hinh] ' + URLS.length + ' may chu, timeout ' + C.MIN + '..' + C.MAX + 'ms, hedge ' + C.HEDGE + 'ms\n');

async function run() {
    let r, t0, err, dt;

    // --- Hằng số ---
    assert('timeout tran <= 30s (ban cu 45s/may x 4 may tuan tu)', C.MAX <= 30000, C);
    assert('hedge <= 3s', C.HEDGE <= 3000, C);

    // --- Timeout theo diện tích ---
    {
        const { timeoutFor } = build({});
        const tiny = { minLat: 10.760, maxLat: 10.762, minLon: 106.650, maxLon: 106.652 };   // ~0.05 km2 (4 trụ)
        const big  = { minLat: 10.740, maxLat: 10.800, minLon: 106.640, maxLon: 106.720 };   // ~58 km2
        assert('vung 4 tru -> timeout toi thieu ' + C.MIN + 'ms', timeoutFor(tiny, { buildings: false }) <= C.MIN + 200,
            timeoutFor(tiny, { buildings: false }));
        assert('vung lon co nha -> cham tran ' + C.MAX + 'ms', timeoutFor(big, { buildings: true }) === C.MAX,
            timeoutFor(big, { buildings: true }));
        const mid = { minLat: 10.76, maxLat: 10.78, minLon: 106.65, maxLon: 106.67 };       // ~4.9 km2
        assert('nha ton thoi gian hon chi duong', timeoutFor(mid, { buildings: true }) > timeoutFor(mid, { buildings: false }));
        assert('khong co bounds -> dung tran', timeoutFor(null) === C.MAX);
    }

    // 1) Ca binh thuong: may 1 tra nhanh -> CHI 1 request (khong an quota 4 may cong cong)
    {
        const plan = {}; plan[H[0]] = { delay: 5, body: OK };
        const { fn, state } = build(plan);
        r = await fn('q', null, FAST);
        await sleep(FAST.hedgeMs + 40);
        assert('may 1 nhanh -> chi goi 1 may', state.started.length === 1, state.started);
        assert('tra dung du lieu', !!(r && r.elements && r.elements.length === 1));
    }

    // 2) May 1 LOI NHANH -> goi NGAY may 2, khong doi het hedge
    {
        const plan = {}; plan[H[0]] = { delay: 5, ok: false, status: 406 }; plan[H[1]] = { delay: 5, body: OK };
        const { fn } = build(plan);
        t0 = Date.now();
        r = await fn('q', null, { hedgeMs: 1000, timeoutMs: 2000 });
        dt = Date.now() - t0;
        assert('may 1 loi nhanh -> may 2 duoc goi ngay (<200ms, khong doi hedge 1000ms)', dt < 200, { ms: dt });
    }

    // 3) May 1 TREO, may 2 nhanh -> may 2 duoc goi sau hedge, tra ~hedge (khong doi timeout)
    {
        const plan = {}; plan[H[0]] = 'hang'; plan[H[1]] = { delay: 5, body: OK };
        const { fn, state } = build(plan);
        t0 = Date.now();
        r = await fn('q', null, FAST);
        dt = Date.now() - t0;
        assert('may 1 treo -> may 2 tra sau ~hedge, khong doi timeout', dt < FAST.timeoutMs && dt >= FAST.hedgeMs - 5, { ms: dt });
        assert('chi goi 2 may', state.started.length === 2, state.started);
    }

    // 4) Dung kich ban DA DO: 406 nhanh, mail.ru treo, 2 may 500 -> doi ~1 timeout roi bo (KHONG phai n x timeout)
    //    Day la gioi han that cua cach nay: may treo cuoi cung van ton 1 lan timeout.
    {
        const plan = {};
        plan[H[0]] = { delay: 5, ok: false, status: 406 };
        plan[H[1]] = 'hang';
        plan[H[2]] = { delay: 5, ok: false, status: 500 };
        plan[H[3]] = { delay: 5, ok: false, status: 500 };
        const { fn } = build(plan);
        err = null; t0 = Date.now();
        try { await fn('q', null, FAST); } catch (e) { err = e; }
        dt = Date.now() - t0;
        assert('kich ban da do -> nem loi sau ~1 timeout (khong cong don)', !!err && dt < FAST.timeoutMs * 1.6, { ms: dt });
        assert('loi neu ly do tung may', !!(err && H.every(h => err.message.indexOf(h) >= 0)), err && err.message);
    }

    // 5) Thang roi phai huy cac request con lai
    {
        const plan = {}; plan[H[0]] = 'hang'; plan[H[1]] = 'hang'; plan[H[2]] = { delay: 5, body: OK };
        const { fn, state } = build(plan);
        await fn('q', null, { hedgeMs: 20, timeoutMs: 1000 });
        await sleep(30);
        assert('co may thang -> huy cac may dang cho', state.aborted >= 2, { aborted: state.aborted, started: state.started });
    }

    // 6) JSON thieu elements = hong -> goi may ke
    {
        const plan = {}; plan[H[0]] = { delay: 5, body: { foo: 1 } }; plan[H[1]] = { delay: 5, body: OK };
        const { fn } = build(plan);
        r = await fn('q', null, FAST);
        assert('bo qua JSON thieu elements', !!(r && Array.isArray(r.elements) && r.elements.length === 1));
    }

    // 7) Huy tu ngoai truoc khi co may nao tra
    {
        const { fn } = build({});   // tat ca treo
        const ctl = new AbortController();
        setTimeout(() => ctl.abort(), 20);
        err = null; t0 = Date.now();
        try { await fn('q', null, { signal: ctl.signal, hedgeMs: 60, timeoutMs: 5000 }); } catch (e) { err = e; }
        dt = Date.now() - t0;
        assert('huy tu ngoai dung ngay, khong doi timeout', !!err && err.name === 'AbortError' && dt < 300, { ms: dt });
    }

    // 8) Huy SAU khi da co ket qua -> khong nem
    {
        const plan = {}; plan[H[0]] = { delay: 5, body: OK };
        const { fn } = build(plan);
        const ctl = new AbortController();
        err = null; r = null;
        try { r = await fn('q', null, { signal: ctl.signal, hedgeMs: 60, timeoutMs: 400 }); } catch (e) { err = e; }
        ctl.abort();
        assert('huy sau khi co ket qua -> khong nem', !err && !!(r && r.elements));
    }

    // 9) Trinh duyet cu KHONG co AbortController + may treo -> van ket thuc nho hen gio doc lap
    {
        const { fn } = build({}, null);   // AbortController = null, tat ca treo
        err = null; t0 = Date.now();
        try { await fn('q', null, { hedgeMs: 20, timeoutMs: 150 }); } catch (e) { err = e; }
        dt = Date.now() - t0;
        assert('khong co AbortController + treo -> van nem loi, khong treo vinh vien', !!err && dt < 1000, { ms: dt });
    }

    // 10) Tat ca loi nhanh -> nem loi nhanh
    {
        const plan = {}; H.forEach((h, i) => { plan[h] = { delay: 5, ok: false, status: 500 + i }; });
        const { fn } = build(plan);
        err = null; t0 = Date.now();
        try { await fn('q', null, { hedgeMs: 1000, timeoutMs: 2000 }); } catch (e) { err = e; }
        dt = Date.now() - t0;
        assert('tat ca loi nhanh -> nem loi nhanh (<300ms)', !!err && dt < 300, { ms: dt });
    }

    // 11) onTry duoc goi de UI biet dang cho may nao
    {
        const plan = {}; plan[H[0]] = { delay: 5, ok: false, status: 500 }; plan[H[1]] = { delay: 5, body: OK };
        const { fn } = build(plan);
        const tried = [];
        await fn('q', (h, k) => tried.push(k), FAST);
        assert('onTry goi cho tung may duoc thu', tried.length === 2 && tried[0] === 0 && tried[1] === 1, tried);
    }

    console.log('\n' + pass + ' pass, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
}
run();
