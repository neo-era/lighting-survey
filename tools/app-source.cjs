// Nguồn JS của app = index.html + mọi <script src> NỘI BỘ (src/…), theo đúng thứ tự trong trang.
// Test trích hàm bằng regex/mốc @@…_START/END dùng hàm này thay cho đọc riêng index.html,
// nên khi tách code ra src/features/*.js (module hoá) test không phải sửa.
// CommonJS để dùng được từ cả test .js (require) lẫn .mjs (import default).
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

function appSource() {
    const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
    const parts = [html];
    for (const m of html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)) {
        const src = m[1];
        if (/^(https?:)?\/\//.test(src)) continue;   // CDN
        const f = path.join(REPO, src);
        if (fs.existsSync(f)) parts.push(fs.readFileSync(f, 'utf8'));
    }
    return parts.join('\n');
}

module.exports = { appSource, REPO };
