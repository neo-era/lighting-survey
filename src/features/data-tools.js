// Công cụ dữ liệu — điền địa chỉ hàng loạt (Nominatim), tính lại khoảng cách cáp, sửa dữ liệu qua Excel
// Tách từ index.html (đợt 3 module hoá, v175) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ ("</script><script src=…><script>") nên thứ tự chạy lúc nạp giữ nguyên.
// Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau. Thêm code CHẠY LÚC NẠP phải rà lại.

        // ═══════════════════════════════════════════════════════════════════
        // T24 — Reverse-geocode batch: điền Đường + Phường/Xã tự động
        // ═══════════════════════════════════════════════════════════════════

        let _batchGeocodeCancel = false;
        async function _batchReverseGeocode() {
            if (!loadedData || loadedData.length < 2) {
                displayError && displayError('Chưa có dữ liệu marker');
                return;
            }
            // Filter marker chưa có Đường HOẶC Phường/Xã
            const rows = loadedData.slice(1);
            const missing = rows.filter(r => {
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (!isFinite(lat) || !isFinite(lon)) return false;
                const duong = String(r[17] || '').trim();
                const px = String(r[18] || '').trim();
                return !duong || !px;
            });
            if (missing.length === 0) {
                displayInfo && displayInfo('✅ Tất cả marker đã có Đường + Phường/Xã');
                return;
            }
            const est = Math.ceil(missing.length / 60);
            if (!confirm(`Sẽ điền địa chỉ cho ${missing.length} marker. Ước tính ~${est} phút (rate limit 1 req/s Nominatim). Tiếp tục?`)) return;

            _batchGeocodeCancel = false;
            const bar = document.getElementById('loadProgressBar');
            const setBar = pct => {
                if (!bar) return;
                if (pct === null) { bar.style.display = 'none'; bar.style.width = '0'; return; }
                bar.style.display = 'block';
                bar.style.width = pct + '%';
            };
            // Cancel button qua displayInfo? Đơn giản: dùng confirm để cancel giữa chừng
            let cancelled = false;
            const onKey = e => { if (e.key === 'Escape') { cancelled = true; _batchGeocodeCancel = true; } };
            document.addEventListener('keydown', onKey);

            let ok = 0, fail = 0, syncBatch = [];
            for (let i = 0; i < missing.length; i++) {
                if (_batchGeocodeCancel || cancelled) break;
                const r = missing[i];
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                setBar(Math.round(i / missing.length * 100));
                displayInfo && displayInfo(`⏳ Geocode ${i + 1}/${missing.length}: ${r[1] || '?'} (ESC để dừng)`);
                try {
                    const addr = await reverseGeocode(lat, lon);
                    if (addr) {
                        const road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.cycleway || '';
                        const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || addr.hamlet || addr.town || '';
                        let changed = false;
                        if (!String(r[17] || '').trim() && road) { r[17] = road; changed = true; }
                        if (!String(r[18] || '').trim() && ward) { r[18] = ward; changed = true; }
                        if (changed) {
                            r[13] = new Date().toISOString();
                            syncBatch.push(r);
                            ok++;
                        }
                    } else {
                        fail++;
                    }
                } catch (err) {
                    fail++;
                }
                // Batch sync mỗi 10 marker
                if (syncBatch.length >= 10) {
                    for (const row of syncBatch) {
                        try { if (typeof syncRowToGAS === 'function') await syncRowToGAS(row, { silent: true }); } catch(e){_swallow(e);}
                    }
                    syncBatch = [];
                }
                // Rate limit 1s
                await new Promise(res => setTimeout(res, 1000));
            }
            // Flush remaining
            for (const row of syncBatch) {
                try { if (typeof syncRowToGAS === 'function') await syncRowToGAS(row, { silent: true }); } catch(e){_swallow(e);}
            }
            document.removeEventListener('keydown', onKey);
            setBar(null);
            const msg = cancelled ? `⚠ Đã dừng: điền ${ok}, lỗi ${fail}` : `✅ Điền xong ${ok} marker (lỗi ${fail})`;
            displayInfo && displayInfo(msg);

            // Log action
            try {
                if (typeof _logAction === 'function') {
                    _logAction('batch_geocode', '', '', JSON.stringify({ total: missing.length, ok, fail, cancelled }));
                }
            } catch(e){_swallow(e);}
        }
        window._batchReverseGeocode = _batchReverseGeocode;

        // ═══════════════════════════════════════════════════════════════════
        // Recalc tất cả Khoảng cách cáp bằng Haversine
        // ═══════════════════════════════════════════════════════════════════
        async function _recalcAllCableDistances() {
            if (!loadedData || loadedData.length < 2) {
                displayError && displayError('Chưa có dữ liệu marker');
                return;
            }
            const rows = loadedData.slice(1);

            // Build position index: tên trụ → [lat, lon]
            const posIdx = {};
            rows.forEach(r => {
                const name = String(r[1] || '').trim();
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (name && isFinite(lat) && isFinite(lon)) posIdx[name] = [lat, lon];
            });

            // Tìm các row có Marker gốc hợp lệ
            const toCalc = [], notFound = [];
            rows.forEach(r => {
                const parentName = String(r[14] || '').trim();
                if (!parentName) return;
                const cLat = parseCoord(r[2]), cLon = parseCoord(r[3]);
                if (!isFinite(cLat) || !isFinite(cLon)) return;
                if (!posIdx[parentName]) { notFound.push(String(r[1] || '')); return; }
                toCalc.push(r);
            });

            if (toCalc.length === 0) {
                displayInfo && displayInfo('Không có marker nào có Marker gốc hợp lệ để tính');
                return;
            }
            const notFoundMsg = notFound.length ? `\n⚠ ${notFound.length} trụ gốc không tìm thấy (bỏ qua).` : '';
            if (!confirm(`Sẽ tính lại khoảng cách Haversine cho ${toCalc.length} marker có Marker gốc.${notFoundMsg}\nCột "Khoảng cách (m)" sẽ bị GHI ĐÈ. Tiếp tục?`)) return;

            const bar = document.getElementById('loadProgressBar');
            const setBar = pct => {
                if (!bar) return;
                if (pct === null) { bar.style.display = 'none'; bar.style.width = '0'; return; }
                bar.style.display = 'block';
                bar.style.width = pct + '%';
            };

            let ok = 0, fail = 0;
            for (let i = 0; i < toCalc.length; i++) {
                const r = toCalc[i];
                const parentName = String(r[14] || '').trim();
                const [pLat, pLon] = posIdx[parentName];
                const cLat = parseCoord(r[2]), cLon = parseCoord(r[3]);
                const dist = haversineM(cLat, cLon, pLat, pLon);
                r[15] = dist;
                r[13] = new Date().toISOString();
                setBar(Math.round(i / toCalc.length * 100));
                displayInfo && displayInfo(`⏳ ${i + 1}/${toCalc.length}: ${r[1] || '?'} ← ${parentName} = ${dist}m`);
                try {
                    if (typeof syncRowToGAS === 'function') await syncRowToGAS(r, { silent: true });
                    ok++;
                } catch (_) { fail++; }
            }

            setBar(null);
            displayInfo && displayInfo(`✅ Tính lại ${ok} khoảng cách cáp${fail ? ` (${fail} lỗi sync)` : ''}${notFound.length ? ` | ${notFound.length} bỏ qua` : ''}`);

            // Redraw sơ đồ cáp nếu đang hiện
            if (typeof _cableVisible !== 'undefined' && _cableVisible && typeof _buildCableLines === 'function') {
                _buildCableLines(rows);
            }

            try {
                if (typeof _logAction === 'function') {
                    _logAction('batch_recalc_dist', '', '', JSON.stringify({ total: toCalc.length, ok, fail, notFound: notFound.length }));
                }
            } catch(e){_swallow(e);}
        }
        window._recalcAllCableDistances = _recalcAllCableDistances;

        // ═══════════════════════════════════════════════════════════════════
        // Excel round-trip: Tải Excel chỉnh sửa + Cập nhật từ Excel
        // ═══════════════════════════════════════════════════════════════════

        // Chuẩn hóa giá trị cell ExcelJS → string
        function _normCellVal(v) {
            if (v === null || v === undefined) return '';
            if (v instanceof Date) return v.toISOString();
            if (typeof v === 'object' && v.richText) return v.richText.map(t => t.text || '').join('');
            if (typeof v === 'object' && v.result !== undefined) return String(v.result);
            if (typeof v === 'object' && v.text !== undefined) return String(v.text);
            return String(v);
        }

        // Export loadedData thành Excel để chỉnh sửa ngoài — dùng XLSX.js (always loaded)
        function _exportEditableExcel() {
            if (!Array.isArray(loadedData) || loadedData.length < 2) {
                displayError('Chưa có dữ liệu để xuất.'); return;
            }
            if (typeof XLSX === 'undefined') { displayError('Thư viện XLSX chưa tải xong, thử lại.'); return; }
            try {
                displayInfo('Đang tạo Excel...');
                const wb = XLSX.utils.book_new();
                // Chuẩn bị dữ liệu — đảm bảo tất cả là string/number/null
                const wsData = loadedData.map(row =>
                    (Array.isArray(row) ? row : []).map(c => (c === null || c === undefined) ? '' : c)
                );
                const ws = XLSX.utils.aoa_to_sheet(wsData);

                // Style header row (XLSX.js tự set header bằng aoa nên chỉ set col widths)
                const colWidths = [];
                wsData.forEach(row => {
                    row.forEach((cell, i) => {
                        const len = String(cell || '').length;
                        if (!colWidths[i] || len > colWidths[i]) colWidths[i] = len;
                    });
                });
                ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w + 2, 8), 40) }));

                XLSX.utils.book_append_sheet(wb, ws, 'DuLieu');
                const sheetLabel = (typeof currentSheet !== 'undefined' && currentSheet && currentSheet !== 'DanhSachTru') ? '_' + currentSheet : '';
                const fname = 'dulieu_chinh_sua' + sheetLabel + '_' + new Date().toISOString().slice(0,10) + '.xlsx';
                XLSX.writeFile(wb, fname);
                displayInfo('Đã tải Excel. Chỉnh sửa xong thì dùng nút 📤 Cập nhật Excel.');
            } catch(e) {
                displayError('Lỗi tạo Excel: ' + e.message);
            }
        }
        window._exportEditableExcel = _exportEditableExcel;

        // Biến lưu trữ pending changes để confirm
        let _editExcelPending = null;

        // Đọc file Excel, diff với loadedData, hiện modal xác nhận — dùng XLSX.js
        async function _onEditExcelImport(input) {
            const file = input.files && input.files[0];
            if (!file) return;
            input.value = '';

            if (!Array.isArray(loadedData) || loadedData.length < 2) {
                displayError('Chưa có dữ liệu gốc để so sánh.'); return;
            }
            if (typeof XLSX === 'undefined') { displayError('Thư viện XLSX chưa tải xong, thử lại.'); return; }

            displayInfo('Đang đọc file Excel...');
            try {
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array', cellDates: true });

                // Lấy sheet đầu tiên
                const wsName = wb.SheetNames[0];
                if (!wsName) { displayError('File Excel không có sheet nào.'); return; }
                const ws = wb.Sheets[wsName];

                // Chuyển worksheet thành mảng rows (defval: '' để tránh undefined)
                const xlRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

                if (xlRows.length < 2) { displayError('File Excel không có dữ liệu.'); return; }

                // xlRows[0] = header, xlRows[1..] = data
                const xlData = xlRows.slice(1);

                // Build lookup map từ loadedData (by ID col[0], fallback col[1])
                const origById = {};
                const origByName = {};
                loadedData.slice(1).forEach(row => {
                    const id = String(row[0] || '').trim();
                    const name = String(row[1] || '').trim();
                    if (id) origById[id] = row;
                    if (name) origByName[name] = row;
                });

                const changed = [];
                const added = [];

                xlData.forEach(xlRow => {
                    // Pad tới độ dài cột gốc
                    const maxCols = Math.max(xlRow.length, loadedData[0].length);
                    while (xlRow.length < maxCols) xlRow.push('');

                    const xlId = String(xlRow[0] || '').trim();
                    const xlName = String(xlRow[1] || '').trim();

                    // Tìm row gốc
                    const origRow = (xlId && origById[xlId]) || (xlName && origByName[xlName]);

                    if (!origRow) {
                        // Row mới (không match ID hoặc tên)
                        if (xlName) added.push(xlRow);
                        return;
                    }

                    // So sánh từng cột — bỏ qua cột 13 (capNhat/timestamp)
                    const diffs = [];
                    const colCount = Math.max(origRow.length, xlRow.length);
                    for (let c = 0; c < colCount; c++) {
                        if (c === 13) continue; // skip timestamp
                        const orig = String(origRow[c] || '').trim();
                        const xl = String(xlRow[c] || '').trim();
                        if (orig !== xl) {
                            const colName = (loadedData[0][c] || ('Col ' + c));
                            diffs.push({ col: c, colName, orig, xl });
                        }
                    }

                    if (diffs.length > 0) {
                        changed.push({ origRow, xlRow, diffs });
                    }
                });

                _editExcelPending = { changed, added };
                _showEditExcelConfirm({ changed, added, fileName: file.name });

            } catch(e) {
                displayError('Lỗi đọc Excel: ' + e.message);
                console.error(e);
            }
        }
        window._onEditExcelImport = _onEditExcelImport;

        // Hiển thị modal xác nhận diff
        function _showEditExcelConfirm({ changed, added, fileName }) {
            const total = changed.length + added.length;
            if (total === 0) {
                displayInfo('Không có thay đổi nào so với dữ liệu hiện tại.');
                return;
            }

            let html = `<p style="margin-bottom:12px;color:#374151;">File: <b>${fileName}</b></p>`;

            if (changed.length > 0) {
                html += `<h6 style="color:#b45309;margin-bottom:8px;">✏ ${changed.length} marker thay đổi:</h6>`;
                html += '<div style="overflow-x:auto;margin-bottom:16px;">';
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
                html += '<thead><tr style="background:#fef3c7;">';
                html += '<th style="padding:5px 8px;text-align:left;border:1px solid #d1d5db;">Tên trụ</th>';
                html += '<th style="padding:5px 8px;text-align:left;border:1px solid #d1d5db;">Cột</th>';
                html += '<th style="padding:5px 8px;text-align:left;border:1px solid #d1d5db;">Giá trị cũ</th>';
                html += '<th style="padding:5px 8px;text-align:left;border:1px solid #d1d5db;">Giá trị mới</th>';
                html += '</tr></thead><tbody>';
                changed.forEach(({ origRow, diffs }) => {
                    const name = String(origRow[1] || '').trim() || String(origRow[0] || '(no id)');
                    diffs.forEach((d, i) => {
                        html += `<tr style="background:${i % 2 === 0 ? '#fffbeb' : '#ffffff'};">`;
                        if (i === 0) html += `<td rowspan="${diffs.length}" style="padding:5px 8px;border:1px solid #d1d5db;font-weight:600;vertical-align:top;">${name}</td>`;
                        html += `<td style="padding:5px 8px;border:1px solid #d1d5db;color:#6b7280;">${d.colName}</td>`;
                        html += `<td style="padding:5px 8px;border:1px solid #d1d5db;color:#dc2626;">${d.orig || '<i>trống</i>'}</td>`;
                        html += `<td style="padding:5px 8px;border:1px solid #d1d5db;color:#16a34a;">${d.xl || '<i>trống</i>'}</td>`;
                        html += '</tr>';
                    });
                });
                html += '</tbody></table></div>';
            }

            if (added.length > 0) {
                html += `<h6 style="color:#0369a1;margin-bottom:8px;">➕ ${added.length} marker mới:</h6>`;
                html += '<ul style="margin:0;padding-left:20px;color:#374151;">';
                added.forEach(row => {
                    const name = String(row[1] || row[0] || '(không tên)').trim();
                    html += `<li>${name}</li>`;
                });
                html += '</ul>';
                html += '<p style="margin-top:8px;font-size:11px;color:#6b7280;">Các marker mới sẽ được thêm vào Sheet và bản đồ.</p>';
            }

            document.getElementById('editExcelModalBody').innerHTML = html;
            document.getElementById('editExcelConfirmBtn').textContent = `✓ Áp dụng ${total} thay đổi`;
            $('#editExcelModal').modal('show');
        }

        // Thực thi cập nhật: sync changed + added lên GAS
        async function _confirmEditExcelUpdate() {
            if (!_editExcelPending) return;
            const { changed, added } = _editExcelPending;
            _editExcelPending = null;
            $('#editExcelModal').modal('hide');

            const total = changed.length + added.length;
            if (total === 0) return;

            displayInfo(`Đang cập nhật ${total} marker...`);
            let ok = 0;

            // Cập nhật changed rows — ghi đè in-place
            for (const { origRow, xlRow } of changed) {
                const colCount = Math.max(origRow.length, xlRow.length);
                for (let c = 0; c < colCount; c++) {
                    if (c === 13) continue; // giữ timestamp gốc
                    if (xlRow[c] !== undefined) origRow[c] = xlRow[c];
                }
                origRow[13] = new Date().toISOString(); // cập nhật timestamp
                const success = await syncRowToGAS(origRow, { silent: true });
                if (success) ok++;
                // Redraw marker
                const name = String(origRow[1] || '').trim();
                if (name && markers) {
                    const md = markers.find(m => m.name === name);
                    if (md && md.marker) {
                        try {
                            markersCluster.removeLayer(md.marker);
                            if (labelLayerGroup.hasLayer(md.marker._lbl)) labelLayerGroup.removeLayer(md.marker._lbl);
                        } catch(e){_swallow(e);}
                        addMarkerRowToMap(origRow);
                    }
                }
            }

            // Thêm added rows
            for (const xlRow of added) {
                if (!xlRow[0]) xlRow[0] = generateId();
                xlRow[13] = new Date().toISOString();
                while (xlRow.length < (loadedData[0] || []).length) xlRow.push('');
                loadedData.push(xlRow);
                addMarkerRowToMap(xlRow);
                const success = await syncRowToGAS(xlRow, { silent: true });
                if (success) ok++;
            }

            displayInfo(`Đã cập nhật ${ok}/${total} marker lên Sheet.`);
        }
        window._confirmEditExcelUpdate = _confirmEditExcelUpdate;

        // ═══════════════════════════════════════════════════════════════════
        // (End T24 Reverse-geocode batch)
        // ═══════════════════════════════════════════════════════════════════
