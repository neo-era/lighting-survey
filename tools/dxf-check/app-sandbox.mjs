// Chạy các <script> inline của index.html trong vm Node với DOM/Leaflet/jQuery GIẢ (Proxy nuốt mọi lời gọi)
// để gọi được các hàm sinh DXF THẬT (_generateCadDrawing, _generateSingleLineDrawing, _generateOverviewDrawing)
// mà không cần trình duyệt. Chỉ dùng cho test — không mô phỏng giao diện.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { REPO } from './lib.mjs';

function stub(name = 'stub') {
    const fn = function () {};
    return new Proxy(fn, {
        get(t, k) {
            if (k === Symbol.toPrimitive) return () => 0;
            if (k === Symbol.iterator) return function* () {};
            if (k === 'then') return undefined;          // không phải Promise
            if (k === 'length') return 0;
            if (k === 'toString' || k === 'valueOf') return () => '';
            if (!(k in t)) t[k] = stub(name + '.' + String(k));
            return t[k];
        },
        set(t, k, v) { t[k] = v; return true; },
        apply() { return stub(name + '()'); },
        construct() { return stub('new ' + name); },
        has() { return true; }
    });
}

export function loadAppSandbox() {
    const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
    // Đúng thứ tự trong trang: script inline + script src NỘI BỘ (src/core/*.js…); bỏ CDN (http) và module
    const scripts = [];
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
        const attrs = m[1], body = m[2];
        if (/type\s*=\s*["']module/.test(attrs)) continue;
        const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/);
        if (src) {
            if (/^(https?:)?\/\//.test(src[1])) continue;
            const f = path.join(REPO, src[1].split('?')[0]);
            if (fs.existsSync(f)) scripts.push({ name: src[1], code: fs.readFileSync(f, 'utf8') });
        } else if (body.trim().length > 10) {
            scripts.push({ name: 'inline', code: body });
        }
    }
    const store = new Map();
    const localStorage = {
        getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k), clear: () => store.clear()
    };
    const ctx = {
        console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        requestAnimationFrame: () => 0, queueMicrotask: f => f(),
        localStorage, sessionStorage: localStorage,
        document: stub('document'), navigator: stub('navigator'), location: stub('location'),
        L: stub('L'), $: stub('$'), jQuery: stub('jQuery'), XLSX: stub('XLSX'), ExcelJS: stub('ExcelJS'),
        fetch: () => Promise.reject(new Error('fetch tắt trong sandbox')),
        indexedDB: stub('indexedDB'), caches: stub('caches'), Image: function () { return stub('Image'); },
        FileReader: function () { return stub('FileReader'); }, Blob: function () { return stub('Blob'); },
        URL: Object.assign(function () { return stub('URL'); }, { createObjectURL: () => 'blob:', revokeObjectURL() {} }),
        alert() {}, confirm: () => true, prompt: () => null,
        Intl, Math, JSON, Date, Promise, Map, Set, Array, Object, String, Number, RegExp, Error, Symbol, Proxy, Reflect,
        parseFloat, parseInt, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
    };
    ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
    ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
    vm.createContext(ctx);
    const errors = [];
    scripts.forEach((s, i) => {
        try { vm.runInContext(s.code, ctx, { filename: `${s.name}#${i}` }); }
        catch (e) { errors.push(`${s.name}#${i}: ${e.message}`); }
    });
    return { ctx, errors, run: code => vm.runInContext(code, ctx) };
}
