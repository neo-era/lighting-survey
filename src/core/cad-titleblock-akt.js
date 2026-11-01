// Khung tên mẫu A.K.T (Thay LED CT1) — đo từ "Thay_Led_CT1_khung_ten_danh_muc…dxf" (25 tờ cùng form).
// Classic script, hàm thuần trong @@AKTTITLE_START/END (test trích). Dùng chung helper chữ/hình của cad-titleblock-qbt.js
// (_qbtText, _qbtLine, _qbtPrims, _qbtFit, _qbtTextW, _qbtDrawSym, _qbtLegendRows). Xem docs/design-titleblock-akt.md.

        // @@AKTTITLE_START
        // Gốc toạ độ = góc dưới-trái khung trong; đơn vị = mm giấy @1:1000 (× k).
        const AKT_FORM = {
            id: 'akt',
            W: 397.93, innerH: 281.36, H: 41.83,
            paperMargin: [16.61, 5.46, 6.93, 8.71],      // trái, phải, trên, dưới (mép giấy A3 → khung trong)
            headerH: 14,                                  // chừa trên nội dung cho tiêu đề đầu tờ
            header: { h: 4.5, dTop: 3.66, cxRatio: 198.29 / 397.93 },
            colsFull: [82.18, 143.69, 176.9, 203.5, 231.41, 255.84],
            dvSplit: 34.69, signRows: [30.83, 20.55, 10.28],
            rightSplit: 27, lowerCols: [288.81, 371.29], khRows: [9, 18],
            legend: { w: 55.61, qtyW: 14, top0: 7.84, pitch: 10.18, bottom: 7.88, symCx: 11.7, txtCx: 33.68, txtW: 37.4,
                headX: 2.01, headTop: 1.39, hHead: 2.5, hRow: 2.0 },
        };
        const AKT_PITCH = 5 / 3;   // giãn dòng MTEXT mặc định = 1,667 × cao chữ

        // Logo chữ "A.K.T" (khối akt-Logo AKT × 0,01228) — tam giác SOLID; gốc = góc dưới-trái khối
        const AKT_LOGO_PRIMS = [["S",0.0,0.0,0.425,0.246,4.411,7.148],["S",2.332,0.246,0.425,0.246,0.0,0.0],["S",4.269,7.394,0.0,0.0,4.411,7.148],["S",2.332,0.246,0.0,0.0,2.473,0.0],["S",8.419,7.394,4.269,7.394,4.411,7.148],["S",3.013,1.426,2.332,0.246,2.473,0.0],["S",8.419,7.394,4.411,7.148,8.173,7.148],["S",3.013,1.426,2.473,0.0,3.155,1.18],["S",8.419,0.0,8.419,7.394,8.173,7.148],["S",4.96,1.426,3.013,1.426,3.155,1.18],["S",8.419,0.0,8.173,7.148,8.173,0.246],["S",4.96,1.426,3.155,1.18,5.205,1.18],["S",6.276,0.0,8.419,0.0,8.173,0.246],["S",4.96,3.077,4.96,1.426,5.205,1.18],["S",6.276,0.0,8.173,0.246,6.522,0.246],["S",4.96,3.077,5.205,1.18,5.205,3.323],["S",6.276,5.252,6.276,0.0,6.522,0.246],["S",3.966,3.077,4.96,3.077,5.205,3.323],["S",6.276,5.252,6.522,0.246,6.522,5.497],["S",3.966,3.077,5.205,3.323,4.392,3.323],["S",5.505,5.252,6.276,5.252,6.522,5.497],["S",5.364,5.497,3.966,3.077,4.392,3.323],["S",5.505,5.252,6.522,5.497,5.364,5.497],["S",5.364,5.497,4.392,3.323,5.505,5.252],["S",6.522,0.246,8.173,0.246,8.173,7.148],["S",4.411,7.148,0.425,0.246,2.332,0.246],["S",3.013,1.426,4.96,1.426,4.96,3.077],["S",6.522,5.497,6.522,0.246,8.173,7.148],["S",4.411,7.148,2.332,0.246,3.013,1.426],["S",3.013,1.426,4.96,3.077,3.966,3.077],["S",5.364,5.497,6.522,5.497,8.173,7.148],["S",4.411,7.148,3.013,1.426,3.966,3.077],["S",5.364,5.497,8.173,7.148,4.411,7.148],["S",4.411,7.148,3.966,3.077,5.364,5.497],["S",28.75,5.252,28.996,5.497,28.996,7.148],["S",31.664,5.497,28.996,5.497,28.75,5.252],["S",28.75,7.394,28.75,5.252,28.996,7.148],["S",31.664,5.497,28.75,5.252,31.419,5.252],["S",36.23,7.394,28.75,7.394,28.996,7.148],["S",31.664,0.246,31.664,5.497,31.419,5.252],["S",36.23,7.394,28.996,7.148,35.984,7.148],["S",31.664,0.246,31.419,5.252,31.419,0.0],["S",36.23,5.252,36.23,7.394,35.984,7.148],["S",33.315,0.246,31.664,0.246,31.419,0.0],["S",36.23,5.252,35.984,7.148,35.984,5.497],["S",33.315,0.246,31.419,0.0,33.561,0.0],["S",33.561,5.252,36.23,5.252,35.984,5.497],["S",33.315,5.497,33.315,0.246,33.561,0.0],["S",33.561,5.252,35.984,5.497,33.315,5.497],["S",33.315,5.497,33.561,0.0,33.561,5.252],["S",35.984,5.497,35.984,7.148,28.996,7.148],["S",28.996,7.148,28.996,5.497,31.664,5.497],["S",31.664,5.497,31.664,0.246,33.315,0.246],["S",33.315,5.497,35.984,5.497,28.996,7.148],["S",31.664,5.497,33.315,0.246,33.315,5.497],["S",33.315,5.497,28.996,7.148,31.664,5.497],["S",14.845,0.0,15.09,0.246,15.09,7.148],["S",16.741,0.246,15.09,0.246,14.845,0.0],["S",14.845,7.394,14.845,0.0,15.09,7.148],["S",16.741,0.246,14.845,0.0,16.987,0.0],["S",16.987,7.394,14.845,7.394,15.09,7.148],["S",16.741,2.528,16.741,0.246,16.987,0.0],["S",16.987,7.394,15.09,7.148,16.741,7.148],["S",16.741,2.528,16.987,0.0,16.987,2.421],["S",16.987,5.349,16.987,7.394,16.741,7.148],["S",17.998,3.699,16.741,2.528,16.987,2.421],["S",16.987,5.349,16.741,7.148,16.741,4.784],["S",17.998,3.699,16.987,2.421,17.94,3.309],["S",19.182,7.394,16.987,5.349,16.741,4.784],["S",19.992,0.246,17.998,3.699,17.94,3.309],["S",19.182,7.394,16.741,4.784,19.278,7.148],["S",19.992,0.246,17.94,3.309,19.851,-0.0],["S",22.324,7.394,19.182,7.394,19.278,7.148],["S",21.899,0.246,19.992,0.246,19.851,-0.0],["S",22.324,7.394,19.278,7.148,21.7,7.148],["S",21.899,0.246,19.851,-0.0,22.324,0.0],["S",19.548,4.808,22.324,7.394,21.7,7.148],["S",19.238,4.854,21.899,0.246,22.324,0.0],["S",19.548,4.808,21.7,7.148,19.238,4.854],["S",19.238,4.854,22.324,0.0,19.548,4.808],["S",17.998,3.699,19.992,0.246,21.899,0.246],["S",19.238,4.854,21.7,7.148,19.278,7.148],["S",16.741,4.784,16.741,7.148,15.09,7.148],["S",15.09,7.148,15.09,0.246,16.741,0.246],["S",17.998,3.699,21.899,0.246,19.238,4.854],["S",19.238,4.854,19.278,7.148,16.741,4.784],["S",15.09,7.148,16.741,0.246,16.741,2.528],["S",17.998,3.699,19.238,4.854,16.741,4.784],["S",16.741,4.784,15.09,7.148,16.741,2.528],["S",16.741,2.528,17.998,3.699,16.741,4.784],["S",10.561,0.0,10.806,0.246,10.806,1.896],["S",12.457,0.246,10.806,0.246,10.561,0.0],["S",10.561,2.142,10.561,0.0,10.806,1.896],["S",12.457,0.246,10.561,0.0,12.703,0.0],["S",12.703,2.142,10.561,2.142,10.806,1.896],["S",12.457,1.896,12.457,0.246,12.703,0.0],["S",12.703,2.142,10.806,1.896,12.457,1.896],["S",12.457,1.896,12.703,0.0,12.703,2.142],["S",12.457,0.246,12.457,1.896,10.806,1.896],["S",10.806,1.896,10.806,0.246,12.457,0.246],["S",24.466,0.0,24.712,0.246,24.712,1.896],["S",26.362,0.246,24.712,0.246,24.466,0.0],["S",24.466,2.142,24.466,0.0,24.712,1.896],["S",26.362,0.246,24.466,0.0,26.608,0.0],["S",26.608,2.142,24.466,2.142,24.712,1.896],["S",26.362,1.896,26.362,0.246,26.608,0.0],["S",26.608,2.142,24.712,1.896,26.362,1.896],["S",26.362,1.896,26.608,0.0,26.608,2.142],["S",24.712,1.896,24.712,0.246,26.362,0.246],["S",26.362,0.246,26.362,1.896,24.712,1.896]];
        // Logo vuông "AK" — gốc = góc dưới-trái ô vuông (83,5; 20,76)
        const AKT_AK_PRIMS = [["S",10.664,5.683,11.375,5.683,11.375,11.369],["S",0.002,11.369,0.002,5.683,0.713,5.683],["S",10.664,10.658,10.664,5.683,11.375,11.369],["S",0.002,11.369,0.713,5.683,0.713,10.658],["S",0.713,10.658,10.664,10.658,11.375,11.369],["S",11.375,11.369,0.002,11.369,0.713,10.658],["S",11.375,-0.004,11.375,5.683,10.664,5.683],["S",0.713,0.707,0.713,5.683,0.002,5.683],["S",11.375,-0.004,10.664,5.683,10.664,0.707],["S",0.713,0.707,0.002,5.683,0.002,-0.004],["S",0.002,-0.004,11.375,-0.004,10.664,0.707],["S",10.664,0.707,0.713,0.707,0.002,-0.004],["L",0.002,-0.004,11.375,-0.004],["L",11.375,-0.004,11.375,11.369],["L",11.375,11.369,0.002,11.369],["L",0.002,11.369,0.002,-0.004],["L",0.713,0.707,10.664,0.707],["L",10.664,0.707,10.664,10.658],["L",10.664,10.658,0.713,10.658],["L",0.713,10.658,0.713,0.707],["S",6.242,9.343,4.677,7.777,4.677,4.343],["S",4.677,4.343,6.242,4.343,6.242,9.343],["L",6.242,4.343,6.242,9.343],["S",1.243,4.343,3.894,4.343,3.894,5.126],["S",3.133,5.126,4.677,6.67,4.677,7.777],["S",1.243,4.343,3.894,5.126,3.133,5.126],["S",3.133,5.126,4.677,7.777,1.243,4.343],["L",4.677,4.343,4.677,7.777],["L",3.894,4.343,3.894,5.126],["L",1.243,4.343,3.894,4.343],["L",3.133,5.126,3.894,5.126],["L",1.243,4.343,6.242,9.343],["L",3.133,5.126,4.677,6.67],["L",4.677,4.343,6.242,4.343],["S",6.528,6.843,7.081,6.29,9.581,8.789],["S",9.581,8.789,9.027,9.343,6.528,6.843],["L",6.528,6.843,9.027,9.343],["S",8.188,7.397,7.081,6.29,9.027,4.343],["S",9.027,4.343,10.135,5.451,8.188,7.397],["L",7.081,6.29,9.581,8.789],["L",6.528,6.843,9.027,4.343],["L",8.188,7.397,10.135,5.451],["L",9.027,9.343,9.581,8.789],["L",9.027,4.343,10.135,5.451],["L",10.664,5.683,11.375,5.683]];

        // Nội dung mặc định = tờ mẫu (người dùng sửa trong form, nhớ bản nháp)
        const AKT_DEFAULTS = {
            AKT_CONG_TRINH: 'THAY THẾ ĐÈN CHIẾU SÁNG ĐÔ THỊ HPS QUÁ NIÊN HẠN TIÊU HAO ĐIỆN NĂNG TIÊU THỤ HIỆN HỮU THÀNH ĐÈN CHIẾU SÁNG LED TIẾT KIỆM ĐIỆN TRÊN CÁC TUYẾN ĐƯỜNG THUỘC CÁC PHƯỜNG : TÂN HIỆP, LONG NGUYÊN, TÂY NAM VÀ CÁC XÃ : BẮC TÂN UYÊN, THƯỜNG TÂN, TRỪ VĂN THỐ',
            AKT_DV_TEN: 'CÔNG TY TNHH TƯ VẤN XÂY DỰNG',
            AKT_DV_DIA_CHI: 'TRỤ SỞ : 101 HÀM NGHI, PHƯỜNG TUY HÒA,\nTỈNH ĐẮK LẮK\nĐT: 0257.3811368 - 0983586505\nEmail: xaydungakt101hamnghi@gmail.com',
            AKT_PGD: 'NGUYỄN HUY HÙNG',
            AKT_CHU_TRI: 'KS.Nguyễn Ngọc Kim', AKT_THIET_KE: 'KS.Trần Doãn Minh', AKT_KIEM: 'KS.Nguyễn Ngọc Kim',
            AKT_TEN_BV: '',
            AKT_GIAI_DOAN: 'Báo cáo\nKinh Tế - Kỹ Thuật',
            AKT_TY_LE: '',
            AKT_DIA_DIEM: 'CÁC PHƯỜNG : TÂN HIỆP, LONG NGUYÊN, TÂY NAM VÀ CÁC XÃ : BẮC TÂN UYÊN, THƯỜNG TÂN, TRỪ VĂN THỐ - THÀNH PHỐ HỒ CHÍ MINH',
            AKT_KY_HIEU: 'CS1-04-XX', AKT_TONG_SO: '', AKT_NAM: '',
            AKT_TIEU_DE: 'BẢN VẼ MẶT BẰNG BỐ TRÍ ĐÈN CHIẾU SÁNG',
        };
        const _aktV = (md, key) => { const v = md && md[key]; return (v == null || String(v).trim() === '') ? AKT_DEFAULTS[key] : String(v); };
        const _aktPad2 = n => String(n).padStart(2, '0');

        // Đoạn chữ căn giữa (như MTEXT \pxqc): ngắt theo bề rộng, chân dòng i = top − h − i·giãn. Trả về chân dòng cuối.
        // wf = hệ số bề ngang (group 41); maxLines vượt thì thu nhỏ chữ (≥ minH).
        function _aktPara(push, esc, text, cx, top, h, maxW, opts) {
            opts = opts || {};
            const wf = opts.wf || 1;
            const f = _qbtFit(text, maxW / wf, h, opts.maxLines || 9, opts.minH || h * 0.6);
            const pitch = f.h * AKT_PITCH;
            let y = top - f.h;
            f.lines.forEach((l, i) => {
                y = top - f.h - i * pitch;
                _qbtText(push, esc, cx, y, f.h, l, { center: !opts.left, wf: wf !== 1 ? wf : 0 });
            });
            return { bottom: y, lines: f.lines.length, h: f.h, pitch };
        }

        // 1 dòng vừa bề rộng maxW: giữ cỡ chữ h, ép ngang (wf từ wf0 xuống tối thiểu minWf, mặc định 0,8); vẫn không vừa mới thu nhỏ chữ.
        function _aktFit1(text, maxW, h, wf0, minWf) {
            const s = String(text || '').replace(/\s+/g, ' ').trim();
            wf0 = wf0 || 1;
            minWf = minWf || 0.8;
            const w1 = _qbtTextW(s, h);
            if (w1 * wf0 <= maxW) return { s, h, wf: wf0 };
            const wf = maxW / w1;
            if (wf >= minWf) return { s, h, wf: Math.floor(wf * 1000) / 1000 };
            return { s, h: h * maxW / (w1 * minWf), wf: minWf };
        }

        // Khung tên đáy. (x,y) = góc dưới-trái; W = bề rộng thực (cột co giãn theo W); k = hệ số khung.
        // sheetIdx/sheetTotal: chia tờ → "XX" trong Ký hiệu = số tờ, Tổng số = số tờ. tyLe: chuỗi "1/…" mặc định.
        function _aktDrawTitleBlock(push, esc, md, x, y, W, k, sheetIdx, sheetTotal, tyLe) {
            const F = AKT_FORM;
            k = k || 1;
            W = W > 0 ? W : F.W * k;
            md = md || {};
            const sx = W / (F.W * k);
            const X = v => x + v * k * sx;
            const Y = v => y + v * k;
            const C = F.colsFull, H = F.H;
            const cw = (a, b) => (b - a) * k * sx - 1.2 * k;      // bề rộng chữ tối đa trong ô
            const L = (x1, y1, x2, y2) => _qbtLine(push, X(x1), Y(y1), X(x2), Y(y2));

            // Khung + ranh
            L(0, 0, F.W, 0); L(F.W, 0, F.W, H); L(F.W, H, 0, H); L(0, H, 0, 0);
            for (const c of C) L(c, 0, c, H);
            L(C[0], F.dvSplit, C[1], F.dvSplit);
            for (const r of F.signRows) L(C[2], r, C[5], r);
            L(C[5], F.rightSplit, F.W, F.rightSplit);
            for (const c of F.lowerCols) L(c, 0, c, F.rightSplit);
            for (const r of F.khRows) L(F.lowerCols[1], r, F.W, r);

            const h2 = 2.0 * k, pitch2 = h2 * AKT_PITCH;
            // 1. Công trình
            {
                const cx = X((0 + C[0]) / 2), top = Y(38.84), mw = cw(0, C[0]);
                _aktPara(push, esc, 'CÔNG TRÌNH :', cx, top, h2, mw);
                _aktPara(push, esc, _aktV(md, 'AKT_CONG_TRINH'), cx, top - 2 * pitch2, h2, mw, { maxLines: 6, minH: 1.4 * k });
            }
            // 2. Đơn vị thiết kế
            {
                const f = _qbtFit('ĐƠN VỊ THIẾT KẾ', cw(C[0], C[1]), 2.6 * k, 1, 1.6 * k);
                _qbtText(push, esc, X(110.82), Y(37.91) - f.h / 2, f.h, f.lines[0], { center: true });
                _qbtPrims(push, esc, AKT_AK_PRIMS, X(83.5), Y(20.76), k);
                _qbtText(push, esc, X(89.19), Y(23.78) - 1.264 * k, 1.264 * k, 'A.K.T design', { center: true, wf: 0.8 });
                _qbtPrims(push, esc, AKT_LOGO_PRIMS, X(101.64), Y(20.76), k);
                // Bản gốc: Arial ép 0,75 rộng 45,14 — Times cùng cỡ rộng hơn → ép ngang thêm cho vừa bề rộng gốc
                const fn = _aktFit1(_aktV(md, 'AKT_DV_TEN'), Math.min(45.14 * k * sx, 2 * (X(C[1]) - X(119.75)) - 0.6 * k), 2.488 * k, 0.75, 0.65);
                _qbtText(push, esc, X(119.75), Y(28.55), fn.h, fn.s, { center: true, wf: fn.wf });
                const ad = String(_aktV(md, 'AKT_DV_DIA_CHI')).split(/\r?\n/).filter(s => s.trim());
                const ha = 2.132 * k, pa = ha * AKT_PITCH;
                const blockH = (ad.length - 1) * pa + ha;
                const fits = ad.map(s => _qbtFit(s, cw(C[0], C[1]) / 0.8, ha, 1, 1.3 * k));
                fits.forEach((f, i) => _qbtText(push, esc, X(112.64), Y(8.67) + blockH / 2 - ha - i * pa, f.h, f.lines[0], { center: true, wf: 0.8 }));
            }
            // 3. Phó giám đốc
            {
                const cx = X((C[1] + C[2]) / 2);
                _aktPara(push, esc, 'PHÓ GIÁM ĐỐC', cx, Y(38.17), h2, cw(C[1], C[2]), { maxLines: 1 });
                const fp = _aktFit1(_aktV(md, 'AKT_PGD'), cw(C[1], C[2]), h2);
                _qbtText(push, esc, cx, Y(5.61) - fp.h, fp.h, fp.s, { center: true, wf: fp.wf !== 1 ? fp.wf : 0 });
            }
            // 4. Bảng ký
            {
                const c1 = X((C[2] + C[3]) / 2), c2 = X((C[3] + C[4]) / 2), c3 = X((C[4] + C[5]) / 2);
                _aktPara(push, esc, 'CHỨC DANH', c1, Y(38.27), h2, cw(C[2], C[3]), { maxLines: 1 });
                _aktPara(push, esc, 'HỌ VÀ TÊN', c2, Y(38.45), h2, cw(C[3], C[4]), { maxLines: 1 });
                _aktPara(push, esc, 'CHỮ KÝ', c3, Y(37.76), h2, cw(C[4], C[5]), { maxLines: 1 });
                const rows = [['CHỦ TRÌ THIẾT KẾ', 'AKT_CHU_TRI', 26.76, 27.71], ['THIẾT KẾ', 'AKT_THIET_KE', 16.79, 17.44], ['KIỂM', 'AKT_KIEM', 6.27, 7.16]];
                for (const [lab, key, t1, t2] of rows) {
                    _aktPara(push, esc, lab, c1, Y(t1), h2, cw(C[2], C[3]), { maxLines: 1, minH: 1.3 * k });
                    const f = _aktFit1(_aktV(md, key), (C[4] - C[3]) * k * sx - 1.0 * k, h2);
                    _qbtText(push, esc, X(C[3]) + 0.8 * k * sx, Y(t2) - f.h, f.h, f.s, { wf: f.wf !== 1 ? f.wf : 0 });
                }
            }
            // 5. Tên bản vẽ
            {
                _qbtText(push, esc, X(261.83), Y(40.04) - 2.5 * k, 2.5 * k, '%%uTên bản vẽ:', { wf: 0.8 });
                const ten = _aktV(md, 'AKT_TEN_BV') || '';
                const mw = Math.min(109.49 * k * sx, 2 * (X(F.W) - X(328.15)) - 1.2 * k);
                _aktPara(push, esc, ten, X(328.15), Y(39.94), h2, mw, { maxLines: 3, minH: 1.3 * k });
            }
            // 6. Giai đoạn + tỷ lệ
            {
                const cx = X((C[5] + F.lowerCols[0]) / 2), mw = cw(C[5], F.lowerCols[0]);
                _aktPara(push, esc, 'Giai đoạn thực hiện :', cx, Y(23.29), h2, mw, { maxLines: 1, minH: 1.3 * k });
                _aktPara(push, esc, _aktV(md, 'AKT_GIAI_DOAN'), cx, Y(23.29) - pitch2, h2, mw, { maxLines: 3, minH: 1.3 * k });
                const tl = String(md.AKT_TY_LE || '').trim() || tyLe || '1/1000';
                _aktPara(push, esc, 'Tỷ lệ : ' + tl.replace(/^\s*(tỷ|tỉ)\s*lệ\s*:?\s*/i, ''), cx, Y(23.29) - 5 * pitch2, h2, mw, { maxLines: 1, minH: 1.3 * k });
            }
            // 7. Địa điểm xây dựng
            {
                const cx = X((F.lowerCols[0] + F.lowerCols[1]) / 2), mw = cw(F.lowerCols[0], F.lowerCols[1]);
                _aktPara(push, esc, 'ĐỊA ĐIỂM XÂY DỰNG :', cx, Y(25.39), h2, mw, { maxLines: 1 });
                _aktPara(push, esc, _aktV(md, 'AKT_DIA_DIEM'), cx, Y(25.39) - 2 * pitch2, h2, mw, { maxLines: 4, minH: 1.3 * k });
            }
            // 8. Ký hiệu / tổng số / năm
            {
                const cx = X((F.lowerCols[1] + F.W) / 2), mw = cw(F.lowerCols[1], F.W);
                let kh = _aktV(md, 'AKT_KY_HIEU');
                if (/XX/.test(kh)) kh = kh.replace(/XX/g, _aktPad2(sheetIdx || 1));
                else if ((sheetTotal || 1) > 1) kh += ' (' + (sheetIdx || 1) + '/' + sheetTotal + ')';
                _aktPara(push, esc, 'Ký hiệu bản vẽ :', cx, Y(25.15), h2, mw, { maxLines: 1, minH: 1.3 * k });
                _aktPara(push, esc, kh, cx, Y(25.15) - pitch2, h2, mw, { maxLines: 1, minH: 1.2 * k });
                const tong = String(md.AKT_TONG_SO || '').trim() || _aktPad2(sheetTotal || 1);
                _aktPara(push, esc, 'Tổng số bản vẽ : ' + tong, cx, Y(15.48), h2, mw, { maxLines: 1, minH: 1.2 * k });
                const nam = String(md.AKT_NAM || '').trim() || String(new Date().getFullYear());
                _aktPara(push, esc, 'Năm thực hiện : ' + nam, cx, Y(5.57), h2, mw, { maxLines: 1, minH: 1.2 * k });
            }
            return { h: H * k, w: W };
        }

        // Tiêu đề đầu tờ: 1 dòng, đỉnh chữ cách đỉnh khung trong 3,66
        function _aktDrawHeader(push, esc, innerLeft, innerRight, innerTop, md, k) {
            const F = AKT_FORM.header;
            k = k || 1;
            const cx = innerLeft + (innerRight - innerLeft) * F.cxRatio;
            const f = _qbtFit(_aktV(md || {}, 'AKT_TIEU_DE'), innerRight - innerLeft - 10 * k, F.h * k, 1, 2.5 * k);
            _qbtText(push, esc, cx, innerTop - F.dTop * k - f.h, f.h, f.lines[0], { center: true });
        }

        // Dòng ô GHI CHÚ: các ký hiệu có trong tờ (số lượng ≠ "–"), chữ ": <tên>"
        function _aktLegendItems(rows, cableMeters, real) {
            return _qbtLegendRows(rows, cableMeters, real).filter(it => it.qty && it.qty !== '–')
                .map(it => Object.assign({}, it, { label: ': ' + it.label }));
        }
        function _aktLegendSize(k, n) {
            const L = AKT_FORM.legend;
            k = k || 1;
            if (!(n > 0)) return { w: 0, h: 0 };          // tờ không có ký hiệu đếm được → không vẽ ô
            return { w: (L.w + L.qtyW) * k, h: (L.top0 + (n - 1) * L.pitch + L.bottom) * k };
        }

        // Ô GHI CHÚ: góc dưới-phải tại (xRight, yBottom). Trả về {w, h, blocks}.
        function _aktDrawLegend(push, esc, xRight, yBottom, k, items, symFns) {
            const L = AKT_FORM.legend;
            k = k || 1;
            items = items || [];
            const { w, h } = _aktLegendSize(k, items.length);
            if (!items.length) return { w: 0, h: 0, blocks: [] };
            const x0 = xRight - w, yTop = yBottom + h;
            _qbtLine(push, x0, yBottom, xRight, yBottom); _qbtLine(push, xRight, yBottom, xRight, yTop);
            _qbtLine(push, xRight, yTop, x0, yTop); _qbtLine(push, x0, yTop, x0, yBottom);
            _qbtText(push, esc, x0 + L.headX * k, yTop - L.headTop * k - L.hHead * k, L.hHead * k, '%%uGHI CHÚ:', { wf: 0.8 });
            const qcx = x0 + (L.w + L.qtyW / 2) * k;
            _qbtText(push, esc, qcx, yTop - L.headTop * k - L.hRow * k, L.hRow * k, 'SL', { center: true });
            const blocks = [];
            items.forEach((it, i) => {
                const top = yTop - (L.top0 + i * L.pitch) * k;
                const f = _qbtFit(it.label, L.txtW * k, L.hRow * k, 2, 1.3 * k);
                const pitch = f.h * AKT_PITCH;
                const blockH = (f.lines.length - 1) * pitch + f.h;
                f.lines.forEach((l, j) => _qbtText(push, esc, x0 + L.txtCx * k, top - f.h - j * pitch, f.h, l, { center: true }));
                const ym = top - blockH / 2;
                const fq = _qbtFit(it.qty || '', (L.qtyW - 1.5) * k, L.hRow * k, 1, 1.2 * k);
                _qbtText(push, esc, qcx, ym - fq.h / 2, fq.h, fq.lines[0], { center: true });
                _qbtDrawSym(push, esc, it.sym, x0 + L.symCx * k, ym, 16 * k, 7 * k, k, symFns || {}, blocks);
            });
            return { w, h, blocks };
        }
        // @@AKTTITLE_END

        if (typeof window !== 'undefined') {
            Object.assign(window, { AKT_FORM, AKT_DEFAULTS, _aktDrawTitleBlock, _aktDrawHeader, _aktLegendItems, _aktLegendSize, _aktDrawLegend });
        }
