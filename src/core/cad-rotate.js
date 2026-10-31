// Tự xoay bản vẽ cho tuyến nằm gọn trong phần trống của khung (v203).
// Xoay CẢ NỘI DUNG quanh tâm tuyến (trụ, cáp, nền OSM/CAD) — khung tên luôn nằm ngang, mũi tên Bắc xoay theo.
// Khi xoay, toạ độ DXF không còn là VN-2000 thật (giống bản vẽ QBT gốc). Góc dương = ngược chiều kim đồng hồ.
// Classic script, hàm thuần trong @@CADROTATE_START/END (test trích). Xem docs/design-cad-auto-rotate.md.

        // @@CADROTATE_START
        // Phép xoay quanh (cx, cy) góc deg (độ, ngược chiều kim đồng hồ). deg = 0 → phép đồng nhất.
        function _rotMake(cx, cy, deg) {
            const d = +deg || 0;
            const r = d * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
            return {
                deg: d, cx, cy,
                xf: d === 0 ? ((x, y) => [x, y]) : ((x, y) => {
                    const dx = x - cx, dy = y - cy;
                    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
                }),
            };
        }

        // Góc chữ sau khi xoay: giữ chữ đọc được (không lộn ngược) → đưa về (-90, 90]
        function _rotTextAngle(a, deg) {
            let r = ((((+a || 0) + (+deg || 0)) % 360) + 360) % 360;
            if (r > 180) r -= 360;
            if (r > 90) r -= 180;
            else if (r <= -90) r += 180;
            return Math.abs(r) < 1e-9 ? 0 : r;
        }

        // Khung bao các điểm sau khi xoay (± pad)
        function _rotBounds(pts, rot, pad) {
            pad = pad || 0;
            const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            for (const p of pts || []) {
                const [x, y] = rot.xf(p.x, p.y);
                if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
                if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
            }
            if (isFinite(b.minX)) { b.minX -= pad; b.minY -= pad; b.maxX += pad; b.maxY += pad; }
            return b;
        }

        // Chọn góc xoay cho tập điểm pts [{x,y}] (toạ độ bản vẽ, chưa xoay): góc làm tuyến NẰM NGANG
        // (bề dọc khung bao nhỏ nhất, thử -89..90° bước 1°) — không đặt tuyến theo đường chéo tờ giấy.
        // score(bounds, ptsRot) → càng nhỏ càng tốt (vd hệ số phóng khung). Chỉ xoay khi lợi ≥ keepGain (10%)
        // so với không xoay; góc nằm ngang gần ±90° (≤ 5°) và kém ±90° không quá snapGain (3%) → dùng ±90° cho tròn.
        // Trả về { deg, cx, cy, gain } — gain = score(0)/score(deg) (≥ 1).
        function _rotBestAngle(pts, score, opts) {
            opts = opts || {};
            const pad = opts.pad || 0, keepGain = opts.keepGain == null ? 0.10 : opts.keepGain, snapGain = opts.snapGain == null ? 0.03 : opts.snapGain;
            const P = (pts || []).filter(p => p && isFinite(p.x) && isFinite(p.y));
            if (P.length < 2) return { deg: 0, cx: P.length ? P[0].x : 0, cy: P.length ? P[0].y : 0, gain: 1 };
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
            const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            const bAt = deg => _rotBounds(P, _rotMake(cx, cy, deg), pad);
            const at = deg => {
                const rot = _rotMake(cx, cy, deg);
                return score(_rotBounds(P, rot, pad), P.map(p => { const [x, y] = rot.xf(p.x, p.y); return { x, y }; }));
            };
            // Góc nằm ngang: bề dọc nhỏ nhất (hoà → ưu tiên góc gần 0)
            let flat = 0, hMin = Infinity;
            for (let d = -89; d <= 90; d++) {
                const b = bAt(d), h = b.maxY - b.minY;
                if (h < hMin - 1e-9 || (Math.abs(h - hMin) <= 1e-9 && Math.abs(d) < Math.abs(flat))) { hMin = h; flat = d; }
            }
            const s0 = at(0);
            if (flat === 0) return { deg: 0, cx, cy, gain: 1 };
            let best = flat, sb = at(flat);
            if (Math.abs(Math.abs(flat) - 90) <= 5) {
                const s90 = at(90), sm90 = at(-90), s9 = Math.min(s90, sm90);
                if (s9 <= sb * (1 + snapGain)) { best = s90 <= sm90 ? 90 : -90; sb = s9; }
            }
            if (!(sb > 0) || s0 <= sb * (1 + keepGain)) return { deg: 0, cx, cy, gain: 1 };
            return { deg: best, cx, cy, gain: s0 / sb };
        }

        // Thước đo mặc định khi không có khung tên đặc thù: khung giấy A3 ngang cần bao nhiêu
        // (addW / addH = phần khung tên chiếm thêm ngang / dọc)
        function _rotScoreA3(addW, addH) {
            const R = 420 / 297;
            return b => Math.max(b.maxX - b.minX + (addW || 0), (b.maxY - b.minY + (addH || 0)) * R);
        }
        // @@CADROTATE_END

        if (typeof window !== 'undefined') {
            Object.assign(window, { _rotMake, _rotTextAngle, _rotBounds, _rotBestAngle, _rotScoreA3 });
        }
