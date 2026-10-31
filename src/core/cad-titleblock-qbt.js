// Khung tên mẫu QBT 2026–2029 (CTCP CSCC TP.HCM) — đo từ "Bản vẽ bố trí 2026-2029.QBT.dwg", 64 tờ cùng form.
// Đơn vị: mm giấy = m bản vẽ @1:1000; mọi kích thước × k = tỉ lệ/1000. Gốc = góc dưới-trái khung trong.
// Chỉ entity R12 (LINE/ARC/CIRCLE/TEXT/INSERT). Classic script, hàm thuần trong @@QBTTITLE_START/END (test trích).
// Xem docs/design-titleblock-qbt.md.

        // @@QBTTITLE_START
        const QBT_FORM = {
            W: 384.65,                     // bề rộng khung tên = khung trong của tờ mẫu
            H: 52.9,                       // chiều cao khung tên
            innerH: 281.84,                // chiều cao khung trong của tờ mẫu (giấy A3 420 × 297)
            paperMargin: [28.28, 7.07, 8.05, 7.08],   // lề giấy → khung trong: trái, phải, trên, dưới
            rowSplit: 31.11,               // ngăn tầng trên / dưới
            colsFull: [75.83, 227.5, 349.85],   // ranh cột suốt chiều cao
            colLower: 151.13,              // ranh cột chỉ ở tầng dưới
            shbvSplits: [41.71, 16.97],    // chia thêm trong cột SHBV
            hOrg: 4.24, orgGap: 7.07,      // tên đơn vị: 2 dòng, giãn dòng
            orgBase: [43.62, 36.55],
            ttCx: 37.915, ctcpCx: 159.49,
            logo: { cx: 89.136, cy: 42.036 },
            hTitle: 4.25, titleCx: 285.26, titleCy: 41.99, titleW: 109.6,   // MText 3,54 × \H1.2x
            hLabel: 2.83, labelBase: 25.39, nameBase: 2.0,
            hBv: 3.54, bvBase: 25.06, tuBase: 18.86, hDuong: 2.83, duongBase: 6.49,
            shbvX: 351.0, shbvBase: [45.43, 35.19, 21.9, 7.31],
            header: { h1: 4.25, d1: 10.87, h2: 3.54, d2: 21.9 },   // tiêu đề đầu tờ: chân dòng = đỉnh khung trong − d
            legend: {
                cols: [8.78, 33.14, 25.92, 16.0],   // STT | Tên ký hiệu | Áp dụng | Số lượng (cột mới)
                headH: 10.51, rowH: 9.0, nLeft: 7, nRight: 6,
                hHead: 2.5, hStt: 2.5, hName: 2.0, hQty: 2.0, nameIndent: 3.46,
            },
        };
        QBT_FORM.legend.groupW = QBT_FORM.legend.cols.reduce((a, b) => a + b, 0);

        const QBT_TITLE_DEFAULT = 'BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ';

        // Logo CS (vòng tròn + chữ "TP. HO CHI MINH" chạy theo cung), toạ độ tương đối tâm logo @1:1000
        // ['L',x1,y1,x2,y2] ['C',cx,cy,r] ['A',cx,cy,r,a1,a2] ['T',x,y,h,rot,txt]
        const QBT_LOGO_PRIMS = [["L",-0.191,-0.675,-0.191,5.115],["A",0,0,3.836,109.442,250.558],["A",0,0,5.119,104.444,255.556],["C",0,0,6.596],["C",0,0,6.802],["A",0,0,5.119,263.173,4.891],["C",0,0,9.158],["T",6.13,-6.122,1.238,47.874,"H"],["T",4.94,-7.069,1.238,38.933,"N"],["T",0.066,-8.672,1.238,4.489,"H"],["T",-1.264,-8.652,1.238,359.074,"C"],["T",-3.224,-8.058,1.238,336.191,"O"],["T",-4.436,-7.46,1.238,333.087,"H"],["T",-6.057,-6.058,1.238,313.525,"P."],["T",-6.916,-5.216,1.238,311.913,"T"],["L",-6.946,-3.873,-6.672,-4.72],["L",-6.671,-4.719,-6.947,-3.873],["L",-6.501,-4.196,-7.222,-4.718],["L",-6.501,-4.196,-7.391,-4.197],["L",-6.671,-4.719,-7.391,-4.195],["L",-1.277,-3.618,-1.277,-4.957],["L",-0.609,-1.303,-0.609,-5.083],["A",0,0,5.119,263.173,293.964],["T",1.563,-8.509,1.238,9.247,"I"],["T",2.696,-8.183,1.238,23.634,"M"],["T",4.314,-7.449,1.238,31.914,"I"],["L",-0.609,-1.303,0.7,-1.303],["L",-0.191,-0.675,2.28,-0.675],["L",0.7,-1.303,0.7,-3.772],["A",0,0,3.836,280.526,304.055],["A",0,0,3.836,280.526,349.863],["L",2.28,-0.675,3.776,-0.675],["A",0,0,5.119,17.46,92.132],["A",0,0,3.836,23.602,72.631],["L",1.145,0.436,1.145,3.661],["L",1.145,0.436,2.35,0.436],["L",2.35,0.436,5.1,0.436],["L",4.883,1.536,3.515,1.536],["A",0,0,3.836,48.878,72.631],["L",-1.277,3.617,-1.277,4.957],["A",-3.757,3.286,2.502,270.039,7.608],["L",6.946,-3.873,6.672,-4.72],["L",6.671,-4.719,6.947,-3.873],["L",6.501,-4.196,7.222,-4.718],["L",6.501,-4.196,7.391,-4.197],["L",6.671,-4.719,7.391,-4.195]];

        // "Điểm dừng lưới" — hình chữ T (block `Diem dung luoi` của bản vẽ mẫu), tâm tại chân chữ T
        const QBT_DDL_PRIMS = [['L', 0, -0.837, 0, 0.837], ['L', 0, 0, -3.025, 0]];

        // Bề rộng chuỗi chữ Times New Roman cao h — bảng độ rộng ký tự chuẩn của font (đơn vị em),
        // chữ có dấu tiếng Việt lấy theo chữ gốc. Dùng để ngắt dòng / thu nhỏ cho vừa ô.
        const QBT_TNR_W = (() => {
            const w = {};
            const set = (chars, v) => { for (const c of chars) w[c] = v; };
            set('ABCDGHKNOQUVXYĐ', 0.722); set('EFLTZ', 0.611); set('PS', 0.556); set('R', 0.667);
            set('I', 0.333); set('J', 0.389); set('M', 0.889); set('W', 0.944);
            set('abdghknopquvxy', 0.5); set('ceđ', 0.444); set('s', 0.389); set('ilj', 0.278); set('frt', 0.333);
            set('m', 0.778); set('w', 0.722); set('z', 0.444);
            set('0123456789', 0.5); set(' ', 0.25); set('.,:;', 0.25); set('-', 0.333); set('/()', 0.333);
            set('–', 0.5); set('²', 0.3); set('_', 0.5);
            return w;
        })();
        function _qbtTextW(s, h) {
            let w = 0;
            for (const ch of String(s || '').normalize('NFC')) {
                let v = QBT_TNR_W[ch];
                if (v === undefined) {
                    const base = ch === 'đ' || ch === 'Đ' ? ch : ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    v = QBT_TNR_W[base];
                    if (v === undefined) v = base !== base.toLowerCase() ? 0.722 : 0.5;
                    if (base !== ch && /[ƠơƯư]/.test(ch)) v += 0.06;   // móc ơ/ư
                }
                w += v;
            }
            // AutoCAD: chiều cao chữ TrueType = chiều cao CHỮ HOA (Times: 0,662 em) → 1 em = h / 0,662
            return w * h / 0.662;
        }

        // Ngắt chuỗi (giữ xuống dòng có sẵn) vừa bề rộng maxW ở chữ cao h; nếu > maxLines dòng thì thu nhỏ chữ (≥ minH)
        function _qbtFit(text, maxW, h, maxLines, minH) {
            maxLines = maxLines || 1;
            minH = minH || h * 0.5;
            const wrapAt = (hh) => {
                const out = [];
                for (const para of String(text || '').split(/\r?\n/)) {
                    const words = para.trim().split(/\s+/).filter(Boolean);
                    if (!words.length) continue;
                    let cur = words[0];
                    for (const w of words.slice(1)) {
                        if (_qbtTextW(cur + ' ' + w, hh) <= maxW) cur += ' ' + w;
                        else { out.push(cur); cur = w; }
                    }
                    out.push(cur);
                }
                return out;
            };
            // Không bao giờ bỏ chữ: dòng thừa gộp vào dòng cuối (chấp nhận tràn nhẹ khi đã ở cỡ tối thiểu)
            const keep = ls => ls.length <= maxLines ? ls : ls.slice(0, maxLines - 1).concat(ls.slice(maxLines - 1).join(' '));
            let hh = h;
            for (let i = 0; i < 40; i++) {
                const lines = wrapAt(hh);
                const fits = lines.length <= maxLines && lines.every(l => _qbtTextW(l, hh) <= maxW);
                if (fits || hh <= minH) return { lines: keep(lines), h: hh };
                hh = Math.max(minH, hh * 0.94);
            }
            return { lines: keep(wrapAt(hh)), h: hh };
        }

        function _qbtN(v) { return (+v).toFixed(4); }

        // TEXT R12: căn trái (mặc định) hoặc giữa (center=true → 72=1 + điểm canh 11/21)
        function _qbtText(push, esc, x, y, h, s, opts) {
            opts = opts || {};
            const t = esc ? esc(String(s)) : String(s);
            push('0', 'TEXT', '8', opts.layer || '0', '10', _qbtN(x), '20', _qbtN(y), '30', '0', '40', _qbtN(h), '1', t);
            if (opts.rot) push('50', _qbtN(opts.rot));
            if (opts.center) push('72', '1', '11', _qbtN(x), '21', _qbtN(y), '31', '0');
        }
        function _qbtLine(push, x1, y1, x2, y2) {
            push('0', 'LINE', '8', '0', '10', _qbtN(x1), '20', _qbtN(y1), '30', '0', '11', _qbtN(x2), '21', _qbtN(y2), '31', '0');
        }

        // Hình nguyên thuỷ (logo / ký hiệu nhỏ) tại (ox,oy) tỉ lệ s
        function _qbtPrims(push, esc, prims, ox, oy, s) {
            for (const q of prims) {
                if (q[0] === 'L') _qbtLine(push, ox + q[1] * s, oy + q[2] * s, ox + q[3] * s, oy + q[4] * s);
                else if (q[0] === 'C') push('0', 'CIRCLE', '8', '0', '10', _qbtN(ox + q[1] * s), '20', _qbtN(oy + q[2] * s), '30', '0', '40', _qbtN(q[3] * s));
                else if (q[0] === 'A') push('0', 'ARC', '8', '0', '10', _qbtN(ox + q[1] * s), '20', _qbtN(oy + q[2] * s), '30', '0',
                    '40', _qbtN(q[3] * s), '50', _qbtN(q[4]), '51', _qbtN(q[5]));
                else if (q[0] === 'T') _qbtText(push, esc, ox + q[1] * s, oy + q[2] * s, q[3] * s, q[5], { rot: q[4] });
            }
        }

        // Khung tên đáy. (x,y) = góc dưới-trái; W = bề rộng thực (cột co giãn theo W); k = tỉ lệ/1000.
        // md: TT_QLGT_NAME, CTCP_NAME, TIEU_DE_BV, CV_PHU_TRACH, NV_TT_QLGT, CS_KHU_VUC, NV_CTCP, NGUOI_LAP,
        //     TEN_BAN_VE (tên tủ), DIA_CHI (tên đường), SHBV_PATTERN (XX = số tờ), SO_SOAT_XET, BAN_VE_SO, NGAY
        function _qbtDrawTitleBlock(push, esc, md, x, y, W, k, sheetIdx, sheetTotal) {
            const F = QBT_FORM;
            k = k || 1;
            W = W > 0 ? W : F.W * k;
            const sx = W / (F.W * k);
            const X = v => x + v * k * sx;          // vị trí cột theo mẫu, co giãn ngang
            const Y = v => y + v * k;
            const H = F.H;
            md = md || {};

            // Khung + ranh
            _qbtLine(push, X(0), Y(0), X(F.W), Y(0));
            _qbtLine(push, X(F.W), Y(0), X(F.W), Y(H));
            _qbtLine(push, X(F.W), Y(H), X(0), Y(H));
            _qbtLine(push, X(0), Y(H), X(0), Y(0));
            _qbtLine(push, X(0), Y(F.rowSplit), X(F.W), Y(F.rowSplit));
            for (const c of F.colsFull) _qbtLine(push, X(c), Y(0), X(c), Y(H));
            _qbtLine(push, X(F.colLower), Y(0), X(F.colLower), Y(F.rowSplit));
            for (const s of F.shbvSplits) _qbtLine(push, X(F.colsFull[2]), Y(s), X(F.W), Y(s));

            const colW = (a, b) => (b - a) * k * sx - 1 * k;   // bề rộng chữ tối đa trong ô (lề 0,5 mỗi bên — nhãn mẫu gần kín ô)
            const center2 = (txt, cx, maxW) => {                // 2 dòng tên đơn vị, giãn 7,07
                const f = _qbtFit(txt, maxW, F.hOrg * k, 2, 2.5 * k);
                const n = f.lines.length;
                const gap = F.orgGap * (f.h / F.hOrg);
                const mid = (F.orgBase[0] + F.orgBase[1]) / 2 * k;   // tâm khối 2 dòng như mẫu
                f.lines.forEach((l, i) => _qbtText(push, esc, cx, y + mid + ((n - 1) / 2 - i) * gap, f.h, l, { center: true }));
            };

            // Tầng trên
            center2(md.TT_QLGT_NAME || 'TT QUẢN LÝ HẠ TẦNG\nKỸ THUẬT TP.HCM', X(F.ttCx), colW(0, F.colsFull[0]));
            _qbtPrims(push, esc, QBT_LOGO_PRIMS, X(F.logo.cx), Y(F.logo.cy), k);
            {   // tên công ty nằm bên phải logo trong ô gộp 75,83–227,5
                const right = F.colsFull[1], cx = F.ctcpCx;
                const maxW = 2 * Math.min(cx - (F.logo.cx + 10), right - cx) * k * sx;
                center2(md.CTCP_NAME || 'CÔNG TY CỔ PHẦN\nCHIẾU SÁNG CÔNG CỘNG TP.HCM', X(cx), maxW);
            }
            {   // tên bản vẽ — MText rộng 109,6 → 1–2 dòng, tâm khối tại (285,26; 41,99)
                const f = _qbtFit(md.TIEU_DE_BV || QBT_TITLE_DEFAULT, F.titleW * k * sx, F.hTitle * k, 2, 2.5 * k);
                const gap = f.h * 5 / 3, n = f.lines.length;
                const base0 = F.titleCy * k + ((n - 1) * gap) / 2 - f.h / 2;
                f.lines.forEach((l, i) => _qbtText(push, esc, X(F.titleCx), y + base0 - i * gap, f.h, l, { center: true }));
            }

            // Tầng dưới: nhãn + tên người ký, giữa ô
            const lower = [[0, F.colsFull[0], md.CV_PHU_TRACH || 'CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN', md.NV_TT_QLGT],
                           [F.colsFull[0], F.colLower, md.CS_KHU_VUC || 'CHIẾU SÁNG KHU VỰC TRUNG TÂM', md.NV_CTCP],
                           [F.colLower, F.colsFull[1], 'NGƯỜI LẬP', md.NGUOI_LAP]];
            for (const [a, b, label, name] of lower) {
                const cx = X((a + b) / 2), mw = colW(a, b);
                const fl = _qbtFit(label, mw, F.hLabel * k, 1, 1.5 * k);
                _qbtText(push, esc, cx, Y(F.labelBase), fl.h, fl.lines[0] || '', { center: true });
                if (name) {
                    const fn = _qbtFit(name, mw, F.hLabel * k, 1, 1.5 * k);
                    _qbtText(push, esc, cx, Y(F.nameBase), fn.h, fn.lines[0], { center: true });
                }
            }
            {   // Ô BẢN VẼ: "BẢN VẼ" / tên tủ / tên đường
                const a = F.colsFull[1], b = F.colsFull[2], cx = X((a + b) / 2), mw = colW(a, b);
                _qbtText(push, esc, cx, Y(F.bvBase), F.hBv * k, 'BẢN VẼ', { center: true });
                if (md.TEN_BAN_VE) {
                    const f = _qbtFit(md.TEN_BAN_VE, mw, F.hBv * k, 1, 1.8 * k);
                    _qbtText(push, esc, cx, Y(F.tuBase), f.h, f.lines[0], { center: true });
                }
                if (md.DIA_CHI) {
                    const f = _qbtFit(md.DIA_CHI, mw, F.hDuong * k, 1, 1.5 * k);
                    _qbtText(push, esc, cx, Y(F.duongBase), f.h, f.lines[0], { center: true });
                }
            }
            {   // Cột SHBV: nhãn tại đúng vị trí mẫu; giá trị cùng dòng nếu vừa, không thì xuống dòng dưới nhãn
                const sIdx = String(Math.max(1, parseInt(sheetIdx) || 1)).padStart(2, '0');
                // Bản vẽ số: XX → số tờ; chia nhiều tờ mà không có XX → thêm "(tờ i/n)"
                const nTot = parseInt(sheetTotal) || 1;
                let bvSo = String(md.BAN_VE_SO || '').trim();
                if (/XX/.test(bvSo)) bvSo = bvSo.replace(/XX/g, sIdx);
                else if (nTot > 1) bvSo = (bvSo ? bvSo + ' ' : '') + '(tờ ' + sIdx + '/' + String(nTot).padStart(2, '0') + ')';
                const vals = [String(md.SHBV_PATTERN || '').replace(/XX/g, sIdx), md.SO_SOAT_XET, bvSo, md.NGAY];
                const labels = ['SHBV:', 'Số soát xét:', 'Bản vẽ số:', 'Ngày:'];
                const cellTop = [F.H, F.shbvSplits[0], F.rowSplit, F.shbvSplits[1]];
                const cellBot = [F.shbvSplits[0], F.rowSplit, F.shbvSplits[1], 0];
                const x0 = X(F.colsFull[2]) + (F.shbvX - F.colsFull[2]) * k;
                const right = X(F.W) - 1 * k;
                for (let i = 0; i < 4; i++) {
                    const h = F.hLabel * k, v = vals[i] == null ? '' : String(vals[i]).trim();
                    const lw = _qbtTextW(labels[i], h);
                    if (!v) { _qbtText(push, esc, x0, Y(F.shbvBase[i]), h, labels[i]); continue; }
                    const avail = right - (x0 + lw + 1.5 * k);
                    if (_qbtTextW(v, h) <= avail) {
                        _qbtText(push, esc, x0, Y(F.shbvBase[i]), h, labels[i]);
                        _qbtText(push, esc, x0 + lw + 1.5 * k, Y(F.shbvBase[i]), h, v);
                    } else {   // 2 dòng: nhãn sát trên, giá trị dưới (thu nhỏ cho vừa bề rộng ô)
                        _qbtText(push, esc, x0, Y(cellTop[i]) - 1 * k - h, h, labels[i]);
                        const f = _qbtFit(v, right - x0, h, 1, 1.4 * k);
                        _qbtText(push, esc, x0, Y(cellBot[i]) + 1.2 * k, f.h, f.lines[0]);
                    }
                }
            }
            return { w: W, h: H * k };
        }

        // Tiêu đề đầu tờ (giữa khung trong): tên bản vẽ + "TỦ ĐIỀU KHIỂN - <tên tủ>"
        function _qbtDrawHeader(push, esc, innerLeft, innerRight, innerTop, md, k) {
            const F = QBT_FORM.header;
            k = k || 1;
            md = md || {};
            const cx = (innerLeft + innerRight) / 2, maxW = innerRight - innerLeft - 10 * k;
            const f1 = _qbtFit(md.TIEU_DE_BV || QBT_TITLE_DEFAULT, maxW, F.h1 * k, 1, 2.5 * k);
            _qbtText(push, esc, cx, innerTop - F.d1 * k, f1.h, f1.lines[0], { center: true });
            const tu = String(md.TEN_BAN_VE || '').trim();
            const f2 = _qbtFit('TỦ ĐIỀU KHIỂN' + (tu ? ' - ' + tu : ''), maxW, F.h2 * k, 1, 2.0 * k);
            _qbtText(push, esc, cx, innerTop - F.d2 * k, f2.h, f2.lines[0], { center: true });
        }

        // 13 dòng bảng ký hiệu đúng thứ tự mẫu + số lượng theo dữ liệu tờ đang xuất.
        // rows: dòng dữ liệu (cột như sheet); cableMeters: Map trạng thái cáp → mét (noi*, ngam*); real: dùng block thật
        function _qbtLegendRows(rows, cableMeters, real) {
            const n = v => Math.min(4, Math.max(1, parseInt(v) || 1));
            const fold = s => String(s || '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
            const lampKind = v => { const s = fold(v); return /LED/.test(s) ? 'LED' : (/\bMH\b|METAL|HALIDE/.test(s) ? 'MH' : 'HPS'); };
            const c = { LED: 0, HPS: 0, MH: 0, denTT: 0, stk: 0, btlt: 0, truTT: 0, kntt: 0, tdk: 0 };
            for (const r of rows || []) {
                const t = parseInt(r[6]);
                if (t === 1 || t === 3 || t === 4) {
                    c[lampKind(r[10])] += n(r[21]);
                    if (t === 1) c.stk++; else c.btlt++;
                } else if (t === 2) { c.truTT++; c.denTT += n(r[21]); }
                else if (t === 5 || t === 6) {
                    const s = fold(String(r[1] || '') + ' ' + String(r[4] || ''));
                    if (/KNTT/.test(s) && !/(KHONG|CHUA)\s+(CO\s+)?KNTT/.test(s)) c.kntt++; else c.tdk++;
                }
            }
            let mNoi = 0, mNgam = 0;
            if (cableMeters && typeof cableMeters.forEach === 'function') {
                cableMeters.forEach((m, key) => { if (/^ngam/.test(String(key))) mNgam += +m || 0; else mNoi += +m || 0; });
            }
            const fmt = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            const q = (v, u) => v > 0 ? fmt(v) + ' ' + u : '–';
            const B = name => real ? { blk: name } : null;
            return [
                { stt: 1, label: 'Đèn LED', sym: B('DEN_LED'), qty: q(c.LED, 'bộ') },
                { stt: 2, label: 'Đèn HPS', sym: B('DEN_HPS'), qty: q(c.HPS, 'bộ') },
                { stt: 3, label: 'Đèn MH', sym: B('DEN_MH'), qty: q(c.MH, 'bộ') },
                { stt: 4, label: 'Đèn trang trí', sym: B('DEN_TRANG_TRI'), qty: q(c.denTT, 'bộ') },
                { stt: 5, label: 'Trụ STK', sym: real ? { blk: 'TRU_STK' } : { pole: true }, qty: q(c.stk, 'trụ') },
                { stt: 6, label: 'Trụ BTLT', sym: real ? { blk: 'TRU_BTLT' } : { pole: true }, qty: q(c.btlt, 'trụ') },
                { stt: 7, label: 'Trụ treo cáp - TTC', sym: B('TTC'), qty: '–' },
                { stt: 8, label: 'Trụ trang trí', sym: real ? { blk: 'TRU_TRANG_TRI' } : { pole: true }, qty: q(c.truTT, 'trụ') },
                { stt: 9, label: 'Điểm dừng lưới', sym: { prims: QBT_DDL_PRIMS }, qty: '–' },
                { stt: 10, label: 'Tủ điều khiển KNTT', sym: real ? { blk: 'TU_DK_KNTT' } : { cab: true }, qty: q(c.kntt, 'tủ') },
                { stt: 11, label: 'Tủ điều khiển thường', sym: real ? { blk: 'TDK_HIENHUU' } : { cab: true }, qty: q(c.tdk, 'tủ') },
                { stt: 12, label: 'Cáp nguồn nổi', sym: { cable: 'noi' }, qty: q(mNoi, 'm') },
                { stt: 13, label: 'Cáp nguồn ngầm', sym: { cable: 'ngam' }, qty: q(mNgam, 'm') },
            ];
        }

        // Địa chỉ tủ cho ô BẢN VẼ: "<Số nhà> <Đường>, <Phường/Xã>" (in hoa) từ dòng tủ — cột 30 / 17 / 18.
        // Thiếu phần nào bỏ phần đó; số nhà đã có trong tên đường (vd "123 An Dương Vương") thì không lặp.
        function _qbtCabinetAddress(row) {
            if (!row) return '';
            const so = String(row[30] == null ? '' : row[30]).trim();
            const duong = String(row[17] || '').trim();
            const phuong = String(row[18] || '').trim();
            // Không khử trùng số nhà: đường có tên bắt đầu bằng số ("3 Tháng 2", "19 Tháng 5") sẽ mất số nhà
            const street = (so + ' ' + duong).trim();
            const parts = [street, phuong].filter(Boolean);
            return parts.join(', ').replace(/\s+/g, ' ').toUpperCase();
        }

        function _qbtLegendSize(k) {
            const L = QBT_FORM.legend;
            k = k || 1;
            return { w: 2 * L.groupW * k, h: (L.headH + L.nLeft * L.rowH) * k };
        }

        // Vùng né quanh tâm ký hiệu: ký hiệu trụ/tủ + nhãn tên (đặt quanh tâm, dài ~10–20) → lề ngang 12·k, dọc 8·k
        const QBT_CLEAR = { mx: 12, gap: 8 };

        // Khung A3 chuẩn (kk = k cố định): chọn phía đặt bảng ký hiệu + lượng hạ đáy để bảng không đè trụ/tủ.
        // Mẫu đặt bảng bên PHẢI; nếu góc phải vướng mà góc trái trống thì dời sang TRÁI (không phải hạ đáy — khung
        // A3 cố định, hạ đáy sẽ đẩy nội dung tràn khỏi tờ). b = bounds nội dung (khung trong = b ± MI); pts = [{x,y}].
        // Trả về { E, side: 'right'|'left' }.
        function _qbtLegendClear(pts, b, k, MI) {
            MI = MI == null ? 15 : MI;
            const lg = _qbtLegendSize(k), gap = QBT_CLEAR.gap * k, mx = QBT_CLEAR.mx * k;
            const lgTop = b.minY - MI + lg.h;       // đỉnh bảng khi đáy khung tên vừa chừa xong
            const need = (inside) => {
                let E = 0;
                for (const p of pts || []) if (inside(p)) E = Math.max(E, lgTop + gap - p.y);
                return E;
            };
            const right = need(p => p.x + mx >= b.maxX + MI - lg.w);
            if (right <= 0) return { E: 0, side: 'right' };
            const left = need(p => p.x - mx <= b.minX - MI + lg.w);
            if (left <= 0) return { E: 0, side: 'left' };
            return left < right ? { E: left, side: 'left' } : { E: right, side: 'right' };
        }

        // Khung tự co giãn: đặt khung trong đúng tỉ lệ tờ mẫu (384,65 : 281,84) bao nội dung b, chừa tiêu đề đầu tờ 25·kk,
        // khung tên 52,9·kk và bảng ký hiệu không đè pts. kk = bề rộng khung trong / 384,65 (≥ k).
        // Trả về { bounds (vùng nội dung mới = khung trong − MI), kk }.
        // opts.center (v203): phần khung cao dư (do giữ tỉ lệ) chia đều trên/dưới thay vì dồn hết xuống đáy
        // → nội dung nằm giữa vùng trống (giữa tiêu đề và khung tên/bảng ký hiệu). Mặc định tắt (giữ bố cục cũ).
        function _qbtFitFrame(b, pts, k, MI, opts) {
            MI = MI == null ? 15 : MI;
            const F = QBT_FORM, R = F.W / F.innerH, gap = QBT_CLEAR.gap, mx = QBT_CLEAR.mx;
            const cx = (b.minX + b.maxX) / 2;
            const w0 = Math.max(b.maxX - b.minX + 2 * MI, F.W * k);
            let kk = k, innerW = w0, innerTop = 0, innerH = 0;
            for (let it = 0; it < 60; it++) {
                innerTop = b.maxY + MI + 25 * kk;
                let needH = innerTop - (b.minY - MI) + F.H * kk;          // đỉnh khung tên ≤ đáy nội dung − MI
                const lg = _qbtLegendSize(kk);
                const lgLeft = cx + innerW / 2 - lg.w;
                for (const p of pts || []) if (p.x + mx * kk >= lgLeft) needH = Math.max(needH, innerTop + F.H * kk + lg.h + gap * kk - p.y);
                innerW = Math.max(w0, R * needH);
                innerH = innerW / R;
                const nk = innerW / F.W;
                if (Math.abs(nk - kk) < 1e-9) { kk = nk; break; }
                kk = nk;
            }
            innerTop = b.maxY + MI + 25 * kk;
            if (opts && opts.center) {
                // Dời khung lên d (nội dung xuống tương đối) — tối đa tới khi chạm khung tên / bảng ký hiệu
                const tbTop = innerTop - innerH + F.H * kk;
                const lg = _qbtLegendSize(kk), lgLeft = cx + innerW / 2 - lg.w;
                let dMax = b.minY - MI - tbTop;
                for (const p of pts || []) if (p.x + mx * kk >= lgLeft) dMax = Math.min(dMax, p.y - (tbTop + lg.h + gap * kk));
                if (dMax > 0) innerTop += dMax / 2;
            }
            return {
                kk,
                bounds: { minX: cx - innerW / 2 + MI, maxX: cx + innerW / 2 - MI, maxY: innerTop - MI, minY: innerTop - innerH + MI },
            };
        }

        // Bảng ký hiệu: góc dưới-phải tại (xRight, yBottom). Trả về {w, h, blocks} — blocks = tên block thật
        // cần định nghĩa trong BLOCKS (caller nối _csBlockDxf). symFns: { pole, cab, cable } vẽ ký hiệu cũ/cáp.
        function _qbtDrawLegendTable(push, esc, xRight, yBottom, k, items, symFns) {
            const L = QBT_FORM.legend;
            k = k || 1;
            symFns = symFns || {};
            const { w, h } = _qbtLegendSize(k);
            const x0 = xRight - w, yTop = yBottom + h;
            const blocks = [];
            const rowY = i => yTop - (L.headH + (i + 1) * L.rowH) * k;   // đáy hàng dữ liệu i (0-based)
            // Khung ngoài + hàng tiêu đề
            _qbtLine(push, x0, yBottom, xRight, yBottom);
            _qbtLine(push, xRight, yBottom, xRight, yTop);
            _qbtLine(push, xRight, yTop, x0, yTop);
            _qbtLine(push, x0, yTop, x0, yBottom);
            _qbtLine(push, x0, yTop - L.headH * k, xRight, yTop - L.headH * k);
            for (let g = 0; g < 2; g++) {
                const gx = x0 + g * L.groupW * k;
                const nRows = g === 0 ? L.nLeft : L.nRight;
                const yLow = rowY(nRows - 1);
                // Ranh cột của nhóm (tới đáy hàng cuối của nhóm)
                let cx = gx;
                for (let c = 0; c < L.cols.length; c++) {
                    if (c > 0 || g > 0) _qbtLine(push, cx, yTop, cx, yLow);
                    cx += L.cols[c] * k;
                }
                if (g === 0) _qbtLine(push, cx, yTop, cx, yBottom);   // ranh giữa 2 nhóm: suốt chiều cao
                for (let i = 0; i < nRows - 1; i++) _qbtLine(push, gx, rowY(i), gx + L.groupW * k, rowY(i));
                if (g === 1) _qbtLine(push, gx, yLow, gx + L.groupW * k, yLow);   // đáy nhóm phải (ô trống bên dưới)
                // Tiêu đề cột
                const hy = yTop - L.headH * k / 2 - L.hHead * k / 2;
                const colX = c => gx + L.cols.slice(0, c).reduce((a, b) => a + b, 0) * k;
                const heads = ['', 'Tên ký hiệu', 'Áp dụng', 'Số lượng'];
                for (let c = 1; c < 4; c++) {
                    const f = _qbtFit(heads[c], L.cols[c] * k - 1.5 * k, L.hHead * k, 1, 1.6 * k);
                    _qbtText(push, esc, colX(c) + L.cols[c] * k / 2, hy, f.h, f.lines[0], { center: true });
                }
                // Hàng dữ liệu
                const list = (items || []).slice(g === 0 ? 0 : L.nLeft, g === 0 ? L.nLeft : L.nLeft + L.nRight);
                list.forEach((it, i) => {
                    const yb = rowY(i), ym = yb + L.rowH * k / 2;
                    _qbtText(push, esc, colX(0) + L.cols[0] * k / 2, ym - L.hStt * k / 2, L.hStt * k, String(it.stt), { center: true });
                    const fn = _qbtFit(it.label, L.cols[1] * k - L.nameIndent * k - 1 * k, L.hName * k, 1, 1.4 * k);
                    _qbtText(push, esc, colX(1) + L.nameIndent * k, ym - fn.h / 2, fn.h, fn.lines[0]);
                    const fq = _qbtFit(it.qty || '', L.cols[3] * k - 1.5 * k, L.hQty * k, 1, 1.3 * k);
                    if (it.qty) _qbtText(push, esc, colX(3) + L.cols[3] * k / 2, ym - fq.h / 2, fq.h, fq.lines[0], { center: true });
                    // Ký hiệu, căn giữa ô Áp dụng
                    const sx = colX(2) + L.cols[2] * k / 2, maxW = L.cols[2] * k - 4 * k, maxH = L.rowH * k - 2.4 * k;
                    const s = it.sym;
                    if (!s) return;
                    if (s.blk && typeof _csBlockBBox === 'function' && typeof _csDef === 'function' && _csDef(s.blk)) {
                        const base = (typeof _csInsertScale === 'function' ? _csInsertScale(s.blk, 1000) : 1) * k;
                        const bb1 = _csBlockBBox(s.blk, 1);
                        const bw = bb1.x1 - bb1.x0, bh = bb1.y1 - bb1.y0;
                        const sc = Math.min(base, bw > 0 ? maxW / bw : base, bh > 0 ? maxH / bh : base);
                        const ix = sx - (bb1.x0 + bw / 2) * sc, iy = ym - (bb1.y0 + bh / 2) * sc;
                        push('0', 'INSERT', '8', '0', '2', s.blk, '10', _qbtN(ix), '20', _qbtN(iy), '30', '0',
                            '41', _qbtN(sc), '42', _qbtN(sc), '43', _qbtN(sc), '50', '0');
                        if (blocks.indexOf(s.blk) < 0) blocks.push(s.blk);
                    } else if (s.prims) {
                        _qbtPrims(push, esc, s.prims, sx + 1.5 * k, ym, k * 1.6);
                    } else if (s.cable && symFns.cable) {
                        symFns.cable(push, sx - 9 * k, ym, sx + 9 * k, ym, s.cable);
                    } else if (s.pole && symFns.pole) {
                        symFns.pole(push, sx, ym);
                    } else if (s.cab && symFns.cab) {
                        symFns.cab(push, sx, ym);
                    }
                });
            }
            return { w, h, blocks };
        }
        // @@QBTTITLE_END

        if (typeof window !== 'undefined') {
            Object.assign(window, { QBT_FORM, _qbtTextW, _qbtFit, _qbtDrawTitleBlock, _qbtDrawHeader,
                _qbtLegendRows, _qbtLegendSize, _qbtDrawLegendTable, _qbtLegendClear, _qbtFitFrame, _qbtCabinetAddress });
        }
