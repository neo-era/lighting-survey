// Mã QR cho trụ đèn / tủ điều khiển — nút "Mã QR" trong popup → modal (phương án C: thẻ gọn + in cả tủ).
// QR = link deep-link mở app tới đúng marker (?view=<sheet>&m=<id>&t=&k=&p=) + tên/loại/CS đọc được.
// Quét → public view zoom + mở popup. Lưu ảnh PNG / In nhãn / In loạt cả tủ / Sao chép link.
// Tái dùng _loadShareQrLib + QRCode (qrcodejs) sẵn có. Classic script. Hàm thuần trong @@MARKERQR_START/END.
// Xem docs/design-marker-qr.md.

        // ─────────────────────────────────────────────────────────────
        // Phần thuần — test trích qua @@MARKERQR
        // ─────────────────────────────────────────────────────────────
        // @@MARKERQR_START
        // Link deep-link tới 1 marker. opts {t,k,p} = tóm tắt đọc được (tên/loại đèn/công suất), cắt ≤40 ký tự.
        function _mqShareLink(origin, pathname, sheet, id, opts) {
            opts = opts || {};
            let u = (origin || '') + (pathname || '') + '?view=' + encodeURIComponent(sheet || '');
            if (id) u += '&m=' + encodeURIComponent(id);
            const add = (k, v) => { if (v) u += '&' + k + '=' + encodeURIComponent(String(v).slice(0, 40)); };
            add('t', opts.t); add('k', opts.k); add('p', opts.p);
            return u;
        }
        // Caption chữ cho thẻ/nhãn: tên (row[1]), phụ = loại đèn[10] · công suất[11] · Tủ[7], id[0].
        function _mqCaption(row) {
            row = row || [];
            const name = String(row[1] || '').trim() || '(không tên)';
            const ld = String(row[10] || '').trim(), cs = String(row[11] || '').trim(), tu = String(row[7] || '').trim();
            const parts = [];
            if (ld) parts.push(ld);
            if (cs) parts.push(cs);
            if (tu) parts.push('Tủ ' + tu);
            return { name, sub: parts.join(' · '), id: String(row[0] || '').trim() };
        }
        // Tên file ảnh QR, sanitize ký tự cấm + khoảng trắng → '_'.
        function _mqFilename(row) {
            row = row || [];
            const base = (String(row[0] || row[1] || 'qr').trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 48)) || 'qr';
            return 'QR-' + base + '.png';
        }
        // Đọc tham số marker ?m= từ query.
        function _mqParseMarker(search) {
            try { return (new URLSearchParams(search || '').get('m') || '').trim(); } catch (e) { return ''; }
        }
        // {t,k,p} cho link từ row (tên, loại đèn, công suất).
        function _mqSummaryOpts(row) {
            row = row || [];
            return { t: String(row[1] || '').trim(), k: String(row[10] || '').trim(), p: String(row[11] || '').trim() };
        }
        // @@MARKERQR_END

        // ─────────────────────────────────────────────────────────────
        // Runtime: modal + render QR + lưu/in/copy + batch + deep-link focus
        // ─────────────────────────────────────────────────────────────
        let _mqCurrent = null;   // { row, link, cap }

        function _mqToast(msg, err) {
            if (err && typeof displayError === 'function') return displayError(msg);
            if (typeof displayInfo === 'function') return displayInfo(msg);
        }
        function _mqEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
        function _mqSheet() { return (typeof currentSheet !== 'undefined' && currentSheet) ? currentSheet : 'DanhSachTru'; }

        function _mqInjectUI() {
            if (document.getElementById('mqModal')) return;
            const css = document.createElement('style');
            css.textContent = `
              #mqModal{display:none;position:fixed;inset:0;z-index:9700;align-items:center;justify-content:center;
                background:rgba(2,6,23,.55);padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom))}
              #mqCard{width:100%;max-width:320px;background:var(--panel,#fff);color:var(--ink,#0f172a);
                border:1px solid var(--line,#e2e8f0);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.4);
                padding:16px;max-height:92vh;max-height:calc(100dvh - 24px);overflow:auto}
              #mqCard .hd{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14.5px;margin-bottom:12px}
              #mqCard .hd .x{margin-left:auto;border:none;background:transparent;font-size:20px;line-height:1;
                color:var(--muted,#64748b);cursor:pointer;min-width:44px;min-height:44px}
              /* Màn ngang (thấp): QR trái, thông tin+nút phải — tránh cắt nút */
              @media (orientation:landscape) and (max-height:540px){
                #mqCard{max-width:600px}
                #mqBody{display:flex;gap:16px;align-items:center}
                #mqRight{flex:1;min-width:0}
                #mqQr{width:160px;height:160px}
                #mqQr img,#mqQr canvas{width:148px!important;height:148px!important}
                #mqCard .cap{margin:0 0 10px;text-align:left}
              }
              #mqQr{width:200px;height:200px;margin:0 auto;background:#fff;border-radius:10px;padding:8px;
                display:flex;align-items:center;justify-content:center;font-size:12px;color:#64748b}
              #mqQr img,#mqQr canvas{width:184px!important;height:184px!important;display:block}
              #mqCard .cap{text-align:center;margin:12px 0}
              #mqCard .cap .nm{font-weight:700;font-size:14px}
              #mqCard .cap .sub{color:var(--muted,#64748b);font-size:12.5px;margin-top:1px}
              #mqCard .cap .id{font-family:ui-monospace,monospace;font-size:11.5px;color:var(--brand,#2563eb);margin-top:3px}
              #mqActs{display:flex;gap:7px}
              #mqActs .pill{flex:1;border:none;border-radius:10px;padding:10px 6px;font-size:12px;font-weight:600;
                cursor:pointer;display:inline-flex;gap:5px;align-items:center;justify-content:center;min-height:44px}
              #mqActs .pill.ghost{background:transparent;color:var(--ink,#0f172a);border:1px solid var(--line,#e2e8f0)}
              #mqActs .pill.go{background:var(--brand,#2563eb);color:#fff}
              #mqBatch{margin-top:12px;border-top:1px dashed var(--line,#e2e8f0);padding-top:11px;display:none;
                align-items:center;gap:8px;font-size:12px;color:var(--muted,#64748b)}
              #mqBatch button{margin-left:auto;border:1px solid #7c3aed;color:#7c3aed;background:transparent;
                border-radius:9px;padding:9px 11px;font-size:12px;font-weight:700;cursor:pointer;min-height:44px}
            `;
            document.head.appendChild(css);
            const m = document.createElement('div');
            m.id = 'mqModal';
            m.innerHTML =
                '<div id="mqCard" role="dialog" aria-label="Mã QR">' +
                  '<div class="hd">📱 Mã QR<button class="x" id="mqX" title="Đóng" aria-label="Đóng">×</button></div>' +
                  '<div id="mqBody">' +
                    '<div id="mqQr">Đang tạo QR…</div>' +
                    '<div id="mqRight">' +
                      '<div class="cap"><div class="nm" id="mqName"></div><div class="sub" id="mqSub"></div><div class="id" id="mqId"></div></div>' +
                      '<div id="mqActs">' +
                        '<button class="pill ghost" id="mqSave">⬇ Ảnh</button>' +
                        '<button class="pill ghost" id="mqPrint">🖨 In</button>' +
                        '<button class="pill go" id="mqCopy">🔗 Link</button>' +
                      '</div>' +
                      '<div id="mqBatch"><span id="mqBatchLbl"></span><button id="mqBatchBtn">🖨 In loạt</button></div>' +
                    '</div>' +
                  '</div>' +
                '</div>';
            document.body.appendChild(m);
            // đóng: nút ×, chạm nền, Esc
            document.getElementById('mqX').onclick = _mqClose;
            m.addEventListener('click', e => { if (e.target === m) _mqClose(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.style.display === 'flex') _mqClose(); });
            document.getElementById('mqSave').onclick = _mqSaveImage;
            document.getElementById('mqPrint').onclick = _mqPrintLabel;
            document.getElementById('mqCopy').onclick = _mqCopyLink;
            document.getElementById('mqBatchBtn').onclick = _mqPrintBatch;
        }

        function _mqClose() { const m = document.getElementById('mqModal'); if (m) m.style.display = 'none'; }

        function _mqOpen() {
            const row = (typeof _currentPopupRow !== 'undefined') ? _currentPopupRow : null;
            if (!row) { _mqToast('Chưa chọn trụ/tủ.', true); return; }
            _mqInjectUI();
            const id = String(row[0] || '').trim() || String(row[1] || '').trim();
            const link = _mqShareLink(location.origin, location.pathname, _mqSheet(), id, _mqSummaryOpts(row));
            const cap = _mqCaption(row);
            _mqCurrent = { row, link, cap };
            document.getElementById('mqName').textContent = cap.name;
            document.getElementById('mqSub').textContent = cap.sub;
            document.getElementById('mqId').textContent = cap.id ? ('ID: ' + cap.id) : '';
            // batch: đếm trụ cùng tủ
            const tu = String(row[7] || '').trim();
            const batch = document.getElementById('mqBatch');
            if (tu && Array.isArray(loadedData)) {
                const n = loadedData.slice(1).filter(r => String(r[7] || '').trim() === tu).length;
                if (n > 1) {
                    document.getElementById('mqBatchLbl').textContent = 'In nhãn QR cả tủ ' + tu + ' (' + n + ')';
                    batch.style.display = 'flex';
                } else batch.style.display = 'none';
            } else batch.style.display = 'none';
            document.getElementById('mqModal').style.display = 'flex';
            _mqRenderQr(link);
        }
        window._mqOpen = _mqOpen;

        async function _mqRenderQr(link) {
            const box = document.getElementById('mqQr');
            if (!box) return;
            box.textContent = 'Đang tạo QR…';
            try {
                if (typeof _loadShareQrLib === 'function') await _loadShareQrLib();
                if (typeof QRCode === 'undefined') throw new Error('no QRCode');
                box.innerHTML = '';
                new QRCode(box, { text: link, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
            } catch (e) {
                box.textContent = 'Không tạo được QR — cần mạng lần đầu để tải thư viện.';
            }
        }

        function _mqDataUrl(box) {
            if (!box) return null;
            const c = box.querySelector('canvas');
            if (c) { try { return c.toDataURL('image/png'); } catch (e) {} }
            const img = box.querySelector('img');
            return img ? img.src : null;
        }

        function _mqSaveImage() {
            const d = _mqDataUrl(document.getElementById('mqQr'));
            if (!d) { _mqToast('QR chưa sẵn sàng.', true); return; }
            const a = document.createElement('a');
            a.href = d; a.download = _mqFilename(_mqCurrent.row);
            document.body.appendChild(a); a.click(); a.remove();
        }

        async function _mqCopyLink() {
            try { await navigator.clipboard.writeText(_mqCurrent.link); _mqToast('Đã sao chép link.'); }
            catch (e) { _mqToast('Không sao chép được. Link: ' + _mqCurrent.link, true); }
        }

        function _mqLabelHtml(dataUrl, cap) {
            return '<div class="qlab"><img src="' + dataUrl + '" alt="QR"><div class="qn">' + _mqEsc(cap.name) + '</div>' +
                (cap.sub ? '<div class="qs">' + _mqEsc(cap.sub) + '</div>' : '') +
                (cap.id ? '<div class="qi">' + _mqEsc(cap.id) + '</div>' : '') + '</div>';
        }
        function _mqPrintHtml(innerLabels) {
            const css = '@page{margin:10mm} body{font-family:system-ui,sans-serif;margin:0} ' +
                '.grid{display:flex;flex-wrap:wrap;gap:7mm;padding:6mm;justify-content:flex-start} ' +
                '.qlab{width:46mm;text-align:center;border:1px dashed #94a3b8;border-radius:6px;padding:4mm 3mm;box-sizing:border-box;break-inside:avoid;page-break-inside:avoid} ' +
                '.qlab img{width:36mm;height:36mm;image-rendering:pixelated} ' +
                '.qn{font-weight:700;font-size:11pt;margin-top:2mm;word-break:break-word} ' +
                '.qs{font-size:9pt;color:#334155;margin-top:1mm} .qi{font-family:monospace;font-size:8pt;color:#2563eb;margin-top:1mm}';
            const html = '<!doctype html><html><head><meta charset="utf-8"><title>In nhãn QR</title><style>' + css +
                '</style></head><body><div class="grid">' + innerLabels + '</div>' +
                '<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>';
            const w = window.open('', '_blank');
            if (!w) { _mqToast('Trình duyệt chặn cửa sổ in — cho phép popup hoặc dùng “Ảnh”.', true); return; }
            w.document.open(); w.document.write(html); w.document.close();
        }

        function _mqPrintLabel() {
            const d = _mqDataUrl(document.getElementById('mqQr'));
            if (!d) { _mqToast('QR chưa sẵn sàng.', true); return; }
            _mqPrintHtml(_mqLabelHtml(d, _mqCurrent.cap));
        }

        async function _mqPrintBatch() {
            const tu = String(_mqCurrent.row[7] || '').trim();
            if (!tu) { _mqToast('Trụ/tủ này không thuộc tủ nào để in loạt.', true); return; }
            if (!Array.isArray(loadedData)) return;
            const rows = loadedData.slice(1).filter(r => String(r[7] || '').trim() === tu);
            if (!rows.length) { _mqToast('Không có trụ nào thuộc tủ ' + tu, true); return; }
            _mqToast('Đang tạo ' + rows.length + ' nhãn QR…');
            try { if (typeof _loadShareQrLib === 'function') await _loadShareQrLib(); if (typeof QRCode === 'undefined') throw 0; }
            catch (e) { _mqToast('Cần mạng để tạo QR (lần đầu).', true); return; }
            const tmp = document.createElement('div');
            tmp.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
            document.body.appendChild(tmp);
            let inner = '';
            for (const r of rows) {
                const id = String(r[0] || '').trim() || String(r[1] || '').trim();
                const link = _mqShareLink(location.origin, location.pathname, _mqSheet(), id, _mqSummaryOpts(r));
                tmp.innerHTML = '';
                try { new QRCode(tmp, { text: link, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { continue; }
                const d = _mqDataUrl(tmp);
                if (d) inner += _mqLabelHtml(d, _mqCaption(r));
            }
            tmp.remove();
            if (!inner) { _mqToast('Không tạo được nhãn.', true); return; }
            _mqPrintHtml(inner);
        }

        // ── Deep-link focus: ?m=<id> → zoom + mở popup đúng marker (sau khi nạp dữ liệu) ──
        function _mqFocusFromUrl(tries) {
            tries = tries || 0;
            const id = _mqParseMarker(location.search);
            if (!id) return;
            if (typeof markers === 'undefined' || !Array.isArray(markers) || !markers.length) {
                if (tries < 12) setTimeout(() => _mqFocusFromUrl(tries + 1), 400);
                return;
            }
            let item = markers.find(m => String(m.id || '') === id) || markers.find(m => String(m.name || '') === id);
            if (!item) {
                if (tries < 12) { setTimeout(() => _mqFocusFromUrl(tries + 1), 400); return; }
                _mqToast('Không tìm thấy trụ "' + id + '" trong địa bàn.', true);
                return;
            }
            try {
                if (typeof map !== 'undefined' && map) map.setView([item.lat, item.lon], 19);
                setTimeout(() => { try { item.marker.openPopup(); } catch (e) {} }, 350);
            } catch (e) {}
        }
        window._mqFocusFromUrl = _mqFocusFromUrl;
