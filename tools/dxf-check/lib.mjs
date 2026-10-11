// Nạp CHÍNH các hàm xuất DXF trong index.html để chạy ngoài trình duyệt (Node).
// Không viết lại logic — nếu index.html đổi, công cụ dùng bản mới ngay.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE_DIR = path.join(REPO, 'tools', 'dxf-check', '.cache');

function readIndex() {
    // index.html có thể là CRLF (Windows) hoặc LF → chuẩn hoá để regex theo dòng khớp
    return fs.readFileSync(path.join(REPO, 'index.html'), 'utf8').split('\r\n').join('\n');
}

function pick(html, re, label) {
    const m = html.match(re);
    if (!m) throw new Error('Không tìm thấy ' + label + ' trong index.html — marker/định nghĩa đã đổi?');
    return m[1] !== undefined ? m[1] : m[0];
}

export async function loadIndexFunctions() {
    const html = readIndex();
    const { convertLatLonToVn2000 } = await import(pathToFileURL(path.join(REPO, 'lib', 'vn2000.js')).href);
    const code = [
        pick(html, /\/\/ @@ROADLAMP_START([\s\S]*?)\/\/ @@ROADLAMP_END/, '@@ROADLAMP'),
        pick(html, /\/\/ @@OSMROAD_START([\s\S]*?)\/\/ @@OSMROAD_END/, '@@OSMROAD'),
        pick(html, /function _dxfEscape\(text\) \{[\s\S]*?\n        \}/, '_dxfEscape'),
        pick(html, /(function _drawOsmBasemapInDxf\([\s\S]*?\n        \})\n        window\._drawOsmBasemapInDxf/, '_drawOsmBasemapInDxf'),
        pick(html, /function parseCSVText\(text\) \{[\s\S]*?\n        \}/, 'parseCSVText'),
    ].join('\n');
    const fns = new Function('convertLatLonToVn2000', code + `
        return { _rlIsDrivable, _rlBuildIndex, _rlNearest, _rlRotation, _rlDrawLampBlock,
                 _osmRoadWidth, _drawOsmBasemapInDxf, parseCSVText, _dxfEscape };`)(convertLatLonToVn2000);
    // Bảng LTYPE + LAYER y hệt generator (_generateCadDrawing)
    const tablesSrc = pick(html, /(push\('0', 'TABLE', '2', 'LTYPE'[\s\S]*?)push\('0', 'TABLE', '2', 'STYLE'/, 'bảng LTYPE/LAYER');
    fns.writeTables = new Function('push', tablesSrc);
    fns.convertLatLonToVn2000 = convertLatLonToVn2000;
    fns.districtCsvUrls = () => {
        const urls = [...html.matchAll(/sheet:\s*'(\w+)',\s*csvUrl:\s*'(https:[^']+)'/g)].map(m => [m[1], m[2]]);
        const main = html.match(/const KHAOSAT_CSV_URL\s*=\s*'([^']+)'/);
        if (main) urls.unshift(['DanhSachTru', main[1]]);
        return new Map(urls);
    };
    return fns;
}

function cached(name, ttlMs) {
    const f = path.join(CACHE_DIR, name);
    if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < ttlMs) return fs.readFileSync(f, 'utf8');
    return null;
}
function saveCache(name, text) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, name), text);
}

export async function fetchSheetCsv(fns, sheet, { refresh = false } = {}) {
    const name = `csv_${sheet}.csv`;
    const hit = !refresh && cached(name, 6 * 3600e3);
    if (hit) return hit;
    const url = fns.districtCsvUrls().get(sheet);
    if (!url) throw new Error('Không có csvUrl cho sheet ' + sheet);
    const res = await fetch(url);
    const text = await res.text();
    // Lỗi Google trả trang HTML — không được lưu vào cache
    if (!res.ok || /^\s*<!DOCTYPE|^\s*<html/i.test(text)) throw new Error(`Tải CSV ${sheet} lỗi HTTP ${res.status}`);
    saveCache(name, text);
    return text;
}

// Overpass từ Node BẮT BUỘC có User-Agent (thiếu → 406/429)
export async function fetchOverpassRoads(bbox, { refresh = false } = {}) {
    const b = [bbox.minLat, bbox.minLon, bbox.maxLat, bbox.maxLon].map(v => v.toFixed(4)).join(',');
    const name = `overpass_${b.replace(/[,.]/g, '_')}.json`;
    const hit = !refresh && cached(name, 30 * 24 * 3600e3);
    if (hit) return JSON.parse(hit);
    const q = `[out:json][timeout:60];(way["highway"](${b}););out geom;`;
    // Máy chủ chính hay quá tải (504) → thử lần lượt các mirror
    const endpoints = ['https://overpass-api.de/api/interpreter',
                       'https://overpass.kumi.systems/api/interpreter',
                       'https://overpass.private.coffee/api/interpreter'];
    const errors = [];
    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                           'User-Agent': 'lighting-survey-dxf-check/1.0 (+https://github.com/neo-era/lighting-survey)',
                           'Accept': 'application/json' },
                body: 'data=' + encodeURIComponent(q)
            });
            const text = await res.text();
            if (res.ok && text.startsWith('{')) {
                const json = JSON.parse(text);
                // Overpass báo quá giờ/lỗi bằng "remark" trong JSON 200 → dữ liệu thiếu, không cache
                if (json.remark && /timeout|error|runtime/i.test(json.remark)) {
                    errors.push(`${url} → ${json.remark.slice(0, 120)}`);
                    continue;
                }
                saveCache(name, text);
                return json;
            }
            errors.push(`${url} → HTTP ${res.status}: ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120)}`);
        } catch (e) {
            errors.push(`${url} → ${e.message}`);
        }
    }
    throw new Error('Overpass lỗi ở mọi máy chủ:\n  ' + errors.join('\n  '));
}
