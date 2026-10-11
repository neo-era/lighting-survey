// Nhập CSV toạ độ — VN-2000 / WGS84 / offset lưới cục bộ, xem trước, ghi hàng loạt
// Tách từ index.html (đợt 3 module hoá, v175) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ ("</script><script src=…><script>") nên thứ tự chạy lúc nạp giữ nguyên.
// Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau. Thêm code CHẠY LÚC NẠP phải rà lại.

    // ═══ NHẬP CSV TỌA ĐỘ — hỗ trợ VN-2000 + WGS84 (Nuwa RTK) ═══
    let _csvImportRows = [];
    let _csvImportFormat = null;    // 'vn2000' | 'wgs84'
    let _csvImportColMap = {};       // { name: 0, lat: 1, lon: 2, accuracy: 4, gpsMode: null }
    let _csvImportHeaders = null;    // header row (nếu có)

    // Robust CSV parser: auto-detect delimiter (comma / semicolon / tab)
    // B: Async chunked (5000 dòng/batch, yield main thread) — không freeze UI khi parse CSV lớn
    async function _parseCsvSmart(text) {
        const firstLine = text.split(/\r?\n/)[0] || '';
        const counts = {
            ',':  (firstLine.match(/,/g) || []).length,
            ';':  (firstLine.match(/;/g) || []).length,
            '\t': (firstLine.match(/\t/g) || []).length
        };
        let delim = ',';
        if (counts[';'] > counts[',']) delim = ';';
        if (counts['\t'] > counts[delim]) delim = '\t';

        const lines = text.split(/\r?\n/);
        const total = lines.length;
        const rows = [];
        const CHUNK = 5000;
        const setProg = typeof _setLoadProgress === 'function' ? _setLoadProgress : (typeof window !== 'undefined' && window._setLoadProgress) || null;
        for (let i = 0; i < total; i += CHUNK) {
            const end = Math.min(i + CHUNK, total);
            for (let j = i; j < end; j++) {
                const line = lines[j];
                if (!line.trim()) continue;
                const row = [];
                let inQuote = false, cell = '';
                for (let k = 0; k < line.length; k++) {
                    const ch = line[k];
                    if (ch === '"') { inQuote = !inQuote; }
                    else if (ch === delim && !inQuote) { row.push(cell); cell = ''; }
                    else { cell += ch; }
                }
                row.push(cell);
                rows.push(row.map(c => c.trim()));
            }
            if (end < total) {
                if (setProg) setProg(Math.round(end / total * 100));
                await new Promise(r => setTimeout(r, 0));
            }
        }
        if (setProg) setProg(null);
        return rows;
    }

    // Parse số linh hoạt: hỗ trợ "10,762523" (comma decimal EU/VN) và "10.762523" (dot)
    // Đồng thời detect integer scaled × 10^7 (Nuwa RTK format: 107625230 → 10.762523)
    function _parseFlexibleNumber(val) {
        if (val == null || val === '') return NaN;
        let s = String(val).trim();
        // Loại bỏ ký tự không cần
        if (!s) return NaN;
        // Nếu có cả dấu chấm và dấu phẩy → dấu phẩy là thousand separator
        if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
            s = s.replace(/,/g, '');
        } else if (s.indexOf(',') !== -1) {
            // Chỉ có dấu phẩy → là decimal separator
            s = s.replace(',', '.');
        }
        return parseFloat(s);
    }

    // Nếu giá trị lat/lon là integer scaled (VD 107625230 = 10.7625230)
    // → scale lại về dạng thập phân bình thường
    function _normalizeLatLon(v, isLat) {
        if (!isFinite(v)) return v;
        const abs = Math.abs(v);
        if (isLat && abs > 90 && abs < 900000000) {
            // Latitude scaled × 10^k → thử 10^7 trước
            if (abs > 1e7 && abs < 1e9) return v / 1e7;
            if (abs > 1e6 && abs < 1e8) return v / 1e6;
        }
        if (!isLat && abs > 180 && abs < 9000000000) {
            if (abs > 1e8 && abs < 1e10) return v / 1e7;
            if (abs > 1e7 && abs < 1e9) return v / 1e6;
        }
        return v;
    }

    // Auto-detect format + columns từ header
    function _detectCsvFormat(rows) {
        if (rows.length === 0) return { format: null, colMap: null, hasHeader: false };

        const header = rows[0].map(c => String(c).toLowerCase().trim());
        const looksLikeHeader = header.some(h => /^(name|point|id|tên|latitude|longitude|northing|easting|lat|lon|elevation)$/i.test(h));

        const colMap = { name: -1, lat: -1, lon: -1, north: -1, east: -1, accuracy: -1, gpsMode: -1, elevation: -1 };

        if (looksLikeHeader) {
            header.forEach((h, i) => {
                if (/^(name|point.?(name|id)?|tên(\s*trụ)?|id)$/i.test(h)) colMap.name = i;
                else if (/^(lat|latitude|vĩ.?độ)/i.test(h)) colMap.lat = i;
                else if (/^(lon|lng|longitude|kinh.?độ)/i.test(h)) colMap.lon = i;
                else if (/^(north(ing)?|toa.?do.?x|vn2000.?y)/i.test(h)) colMap.north = i;
                else if (/^(east(ing)?|toa.?do.?y|vn2000.?x)/i.test(h)) colMap.east = i;
                else if (/^(h.?accuracy|accuracy|độ.?chính.?xác|std.?dev)/i.test(h)) colMap.accuracy = i;
                else if (/^(solution|fix.?type|gps.?mode|quality|status)/i.test(h)) colMap.gpsMode = i;
                else if (/^(elev(ation)?|height|độ.?cao)/i.test(h)) colMap.elevation = i;
            });
        } else {
            // Không có header — đoán theo giá trị cột 1
            const sampleRow = rows[0];
            const val1 = parseFloat(sampleRow[1]);
            if (isFinite(val1) && val1 >= -90 && val1 <= 90) {
                // Format: Name, Lat, Lon
                colMap.name = 0; colMap.lat = 1; colMap.lon = 2;
            } else if (isFinite(val1) && val1 > 100000) {
                // Format: Name, Northing, Easting (VN-2000)
                colMap.name = 0; colMap.north = 1; colMap.east = 2;
            } else {
                // Không detect được, dùng default
                colMap.name = 0; colMap.north = 1; colMap.east = 2;
            }
        }

        const format = (colMap.lat >= 0 && colMap.lon >= 0) ? 'wgs84'
                     : (colMap.north >= 0 && colMap.east >= 0) ? 'vn2000'
                     : null;

        return { format, colMap, hasHeader: looksLikeHeader };
    }

    async function _onCsvImportChange(input) {
        const file = input.files[0];
        if (!file) return;
        const name = file.name.toLowerCase();
        const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

        const proceed = (allRows) => {
            allRows = allRows.filter(r => r.length >= 2 && String(r[0] || '').trim());
            if (allRows.length === 0) {
                displayError('File rỗng hoặc không đúng định dạng.');
                return;
            }
            const detect = _detectCsvFormat(allRows);
            if (!detect.format) {
                displayError('Không nhận diện được cột tọa độ. Cần cột: Name, Lat, Lon (WGS84) HOẶC Name, Northing, Easting (VN-2000).');
                return;
            }
            _csvImportFormat  = detect.format;
            _csvImportColMap  = detect.colMap;
            _csvImportHeaders = detect.hasHeader ? allRows[0] : null;
            _csvImportRows    = detect.hasHeader ? allRows.slice(1) : allRows;
            _openCsvImportModal(file.name);
        };

        if (isExcel) {
            // Load ExcelJS + parse workbook
            try {
                displayInfo && displayInfo('Đang đọc Excel...');
                await _loadExcelJS();
                const buf = await file.arrayBuffer();
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.load(buf);
                // Chọn sheet (nếu >1 hỏi user)
                let sheet;
                if (wb.worksheets.length > 1) {
                    const names = wb.worksheets.map(s => s.name);
                    const pickName = prompt(`File có ${wb.worksheets.length} sheet:\n${names.join('\n')}\n\nNhập tên sheet cần import:`, names[0]);
                    if (!pickName) return;
                    sheet = wb.getWorksheet(pickName) || wb.worksheets[0];
                } else {
                    sheet = wb.worksheets[0];
                }
                if (!sheet) { displayError('Không tìm thấy sheet trong file'); return; }
                // Convert sheet → array of arrays
                const allRows = [];
                sheet.eachRow({ includeEmpty: false }, row => {
                    const arr = [];
                    // row.values có index 1-based (index 0 = null)
                    for (let i = 1; i <= row.cellCount; i++) {
                        const v = row.getCell(i).value;
                        arr.push(v == null ? '' : String(v));
                    }
                    allRows.push(arr);
                });
                proceed(allRows);
            } catch (err) {
                console.error('[Excel import]', err);
                displayError('Lỗi đọc Excel: ' + err.message);
            } finally {
                input.value = '';
            }
        } else {
            // CSV path (backward-compat)
            const reader = new FileReader();
            reader.onload = async e => {
                try {
                    const parsed = await _parseCsvSmart(e.target.result);
                    proceed(parsed);
                } catch (err) {
                    console.error('[CSV parse]', err);
                    displayError('Lỗi đọc CSV: ' + err.message);
                }
            };
            reader.readAsText(file, 'UTF-8');
            input.value = '';
        }
    }

    function _openCsvImportModal(filename) {
        const rows = _csvImportRows;
        const fmt = _csvImportFormat === 'wgs84' ? 'WGS-84 (Lat/Lon)' : 'VN-2000 (Northing/Easting)';
        const c = _csvImportColMap;

        // Reset radio "Định dạng tọa độ" về Auto mỗi lần mở modal mới
        const autoRadio = document.querySelector('input[name="csvFormat"][value="auto"]');
        if (autoRadio) autoRadio.checked = true;

        document.getElementById('csvImportFileInfo').textContent =
            'File: ' + filename + ' — ' + rows.length + ' hàng dữ liệu';

        const detectedCols = [];
        if (c.name >= 0)      detectedCols.push('Tên [' + (c.name + 1) + ']');
        if (c.lat >= 0)       detectedCols.push('Lat [' + (c.lat + 1) + ']');
        if (c.lon >= 0)       detectedCols.push('Lon [' + (c.lon + 1) + ']');
        if (c.north >= 0)     detectedCols.push('Northing [' + (c.north + 1) + ']');
        if (c.east >= 0)      detectedCols.push('Easting [' + (c.east + 1) + ']');
        if (c.accuracy >= 0)  detectedCols.push('Accuracy [' + (c.accuracy + 1) + ']');
        if (c.gpsMode >= 0)   detectedCols.push('GPS mode [' + (c.gpsMode + 1) + ']');
        if (c.elevation >= 0) detectedCols.push('Elevation [' + (c.elevation + 1) + ']');

        document.getElementById('csvImportFormatInfo').innerHTML =
            '<b>🔍 Đã nhận diện:</b> ' + fmt + ' — ' + detectedCols.join(' · ') +
            (_csvImportHeaders ? '<br><span style="opacity:.7;">(Có hàng header)</span>' : '');

        // Hide/show VN-2000 zone group + offset group
        const isVn2000 = _csvImportFormat === 'vn2000';
        document.getElementById('csvZoneGroup').style.display = isVn2000 ? 'block' : 'none';
        document.getElementById('csvOffsetGroup').style.display = isVn2000 ? 'block' : 'none';

        // Restore offset từ localStorage
        _restoreCsvOffset();

        // Wire event handlers
        ['csvZone3', 'csvZone6'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onchange = _updateCsvPreview;
        });
        const loaiEl = document.getElementById('csvImportLoai');
        if (loaiEl) loaiEl.onchange = _updateCsvPreview;

        _updateCsvPreview();
        $('#csvImportModal').modal('show');
    }

    function _getCsvZoneParams() {
        const zone = document.querySelector('input[name="csvZone"]:checked');
        if (zone && zone.value === '6') return { cm: 105, k0: 0.9996 };
        return { cm: 105.75, k0: 0.9999 };
    }

    // Offset local grid (chỉ apply cho format VN-2000):
    // file_local = VN2000_chuẩn + (dE, dN)   → chuẩn = file_local - (dE, dN)
    function _getCsvOffset() {
        const dE = parseFloat(document.getElementById('csvOffsetE').value) || 0;
        const dN = parseFloat(document.getElementById('csvOffsetN').value) || 0;
        return { dE, dN };
    }

    function _onCsvOffsetChange() {
        // Save to localStorage
        const o = _getCsvOffset();
        try {
            localStorage.setItem('csv_offset_e', String(o.dE));
            localStorage.setItem('csv_offset_n', String(o.dN));
        } catch(e){_swallow(e);}
        _updateCsvPreview();
    }

    function _restoreCsvOffset() {
        try {
            const dE = parseFloat(localStorage.getItem('csv_offset_e'));
            const dN = parseFloat(localStorage.getItem('csv_offset_n'));
            const inE = document.getElementById('csvOffsetE');
            const inN = document.getElementById('csvOffsetN');
            if (inE && isFinite(dE)) inE.value = dE;
            if (inN && isFinite(dN)) inN.value = dN;
        } catch(e){_swallow(e);}
    }

    function _applyThamLuongOffset() {
        // Preset offset đã fit từ 10 điểm C1.01-C1.10:
        // file_local = VN2000_chuẩn + (-391.75, +223.86)
        document.getElementById('csvOffsetE').value = -391.75;
        document.getElementById('csvOffsetN').value = 223.86;
        _onCsvOffsetChange();
    }

    // User override auto-detect format — remap columns theo format ép buộc
    function _onCsvFormatOverride() {
        const el = document.querySelector('input[name="csvFormat"]:checked');
        const forced = el ? el.value : 'auto';
        const rows = _csvImportRows || [];
        if (rows.length === 0) return;

        if (forced === 'auto') {
            // Re-detect từ đầu (tôn trọng header nếu có)
            const allRows = _csvImportHeaders ? [_csvImportHeaders, ...rows] : rows;
            const d = _detectCsvFormat(allRows);
            _csvImportFormat = d.format;
            _csvImportColMap = d.colMap;
        } else {
            // Ép format — nếu có header dùng header, nếu không → default cột 0/1/2
            const c = { name: -1, lat: -1, lon: -1, north: -1, east: -1, accuracy: -1, gpsMode: -1, elevation: -1 };
            if (_csvImportHeaders) {
                const header = _csvImportHeaders.map(h => String(h).toLowerCase().trim());
                header.forEach((h, i) => {
                    if (/^(name|point.?(name|id)?|tên(\s*trụ)?|id)$/i.test(h)) c.name = i;
                    else if (/^(lat|latitude|vĩ.?độ)/i.test(h)) c.lat = i;
                    else if (/^(lon|lng|longitude|kinh.?độ)/i.test(h)) c.lon = i;
                    else if (/^(north(ing)?|toa.?do.?x|vn2000.?y)/i.test(h)) c.north = i;
                    else if (/^(east(ing)?|toa.?do.?y|vn2000.?x)/i.test(h)) c.east = i;
                    else if (/^(h.?accuracy|accuracy|độ.?chính.?xác|std.?dev)/i.test(h)) c.accuracy = i;
                    else if (/^(solution|fix.?type|gps.?mode|quality|status)/i.test(h)) c.gpsMode = i;
                    else if (/^(elev(ation)?|height|độ.?cao)/i.test(h)) c.elevation = i;
                });
            }
            // Default cột nếu chưa detect được (không có header hoặc header không khớp)
            if (c.name < 0) c.name = 0;
            if (forced === 'wgs84') {
                if (c.lat < 0) c.lat = 1;
                if (c.lon < 0) c.lon = 2;
                c.north = -1; c.east = -1;
            } else {
                if (c.north < 0) c.north = 1;
                if (c.east < 0) c.east = 2;
                c.lat = -1; c.lon = -1;
            }
            _csvImportFormat = forced;
            _csvImportColMap = c;
        }

        // Refresh UI
        const fmt = _csvImportFormat === 'wgs84' ? 'WGS-84 (Lat/Lon)'
                  : _csvImportFormat === 'vn2000' ? 'VN-2000 (Northing/Easting)'
                  : 'Không xác định';
        const c = _csvImportColMap;
        const detectedCols = [];
        if (c.name >= 0)      detectedCols.push('Tên [' + (c.name + 1) + ']');
        if (c.lat >= 0)       detectedCols.push('Lat [' + (c.lat + 1) + ']');
        if (c.lon >= 0)       detectedCols.push('Lon [' + (c.lon + 1) + ']');
        if (c.north >= 0)     detectedCols.push('Northing [' + (c.north + 1) + ']');
        if (c.east >= 0)      detectedCols.push('Easting [' + (c.east + 1) + ']');
        if (c.accuracy >= 0)  detectedCols.push('Accuracy [' + (c.accuracy + 1) + ']');
        if (c.gpsMode >= 0)   detectedCols.push('GPS mode [' + (c.gpsMode + 1) + ']');
        const forcedLabel = forced === 'auto' ? '' : ' <span style="background:#fbbf24;color:#78350f;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">Ép format</span>';
        document.getElementById('csvImportFormatInfo').innerHTML =
            '<b>🔍 Định dạng:</b> ' + fmt + forcedLabel + ' — ' + detectedCols.join(' · ') +
            (_csvImportHeaders ? '<br><span style="opacity:.7;">(Có hàng header)</span>' : '');

        const isVn = _csvImportFormat === 'vn2000';
        document.getElementById('csvZoneGroup').style.display = isVn ? 'block' : 'none';
        document.getElementById('csvOffsetGroup').style.display = isVn ? 'block' : 'none';

        _updateCsvPreview();
    }

    function _getCsvMode() {
        const el = document.querySelector('input[name="csvMode"]:checked');
        return el ? el.value : 'auto';
    }

    // Tính lat/lon từ 1 CSV row theo format đã detect
    // Với format VN-2000: TRỪ offset local grid trước khi convert
    function _extractLatLon(csvRow, zoneOpts, offsetOpts) {
        const c = _csvImportColMap;
        if (_csvImportFormat === 'wgs84') {
            let lat = _parseFlexibleNumber(csvRow[c.lat]);
            let lon = _parseFlexibleNumber(csvRow[c.lon]);
            // Detect + fix scaled integer (VD Nuwa: 107625230 → 10.7625230)
            lat = _normalizeLatLon(lat, true);
            lon = _normalizeLatLon(lon, false);
            return { lat, lon };
        } else {
            const north = _parseFlexibleNumber(csvRow[c.north]);
            const east  = _parseFlexibleNumber(csvRow[c.east]);
            // Bù offset local grid: file_local = VN2000_chuẩn + (dE, dN) → chuẩn = local - (dE, dN)
            const o = offsetOpts || { dE: 0, dN: 0 };
            const eStd = east  - o.dE;
            const nStd = north - o.dN;
            const r = convertVn2000ToLatLon(eStd, nStd, zoneOpts.cm, zoneOpts.k0);
            return { lat: r.lat, lon: r.lon };
        }
    }

    // Haversine distance meters
    function _haversineDist(lat1, lon1, lat2, lon2) {
        const R = 6371000, toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function _updateCsvPreview() {
        const zoneOpts = _getCsvZoneParams();
        const offsetOpts = _getCsvOffset();
        const mode = _getCsvMode();
        const c = _csvImportColMap;
        const tbody = document.getElementById('csvImportPreviewBody');
        const statsEl = document.getElementById('csvImportStats');
        const addOptsEl = document.getElementById('csvAddOptions');

        // Show "Options thêm mới" chỉ khi mode = auto hoặc add
        if (addOptsEl) addOptsEl.style.display = (mode === 'update') ? 'none' : 'block';

        // Build name → row index map từ loadedData
        const existingByName = {};
        if (Array.isArray(loadedData) && loadedData.length > 1) {
            for (let i = 1; i < loadedData.length; i++) {
                const nm = String(loadedData[i][1] || '').trim().toLowerCase();
                if (nm) existingByName[nm] = i;
            }
        }

        let matchCount = 0, newCount = 0, errCount = 0;
        const rowsHtml = [];

        for (let i = 0; i < _csvImportRows.length; i++) {
            const r = _csvImportRows[i];
            const name = String(r[c.name] || '').trim();
            if (!name) continue;

            let latLon;
            try {
                latLon = _extractLatLon(r, zoneOpts, offsetOpts);
                if (!isFinite(latLon.lat) || !isFinite(latLon.lon)) throw new Error('Lat/Lon không hợp lệ');
            } catch(ex) {
                errCount++;
                if (i < 10) rowsHtml.push(`<tr><td colspan="5" style="padding:4px 8px;color:#dc2626;">${name}: ${ex.message}</td></tr>`);
                continue;
            }

            const existingIdx = existingByName[name.toLowerCase()];
            const isMatch = !!existingIdx;
            let delta = '';
            let status, statusColor, willProcess = true;

            if (mode === 'add') {
                // Mode "Thêm mới" — LUÔN tạo dòng mới với ID mới, không cần check trùng
                status = '➕ Thêm mới (ID mới)';
                statusColor = '#16a34a';
                newCount++;
            } else if (isMatch) {
                // Dùng parseCoord để hỗ trợ dấu phẩy VN (10,759269) —
                // parseFloat("10,759269") = 10 → delta sai ~85km
                const oldLat = parseCoord(loadedData[existingIdx][2]);
                const oldLon = parseCoord(loadedData[existingIdx][3]);
                if (isFinite(oldLat) && isFinite(oldLon)) {
                    delta = _haversineDist(oldLat, oldLon, latLon.lat, latLon.lon).toFixed(2);
                }
                status = '🔄 Cập nhật (giữ ID)'; statusColor = '#0891b2'; matchCount++;
            } else {
                if (mode === 'update') { status = 'Bỏ qua (không tìm thấy)'; statusColor = '#94a3b8'; willProcess = false; }
                else                    { status = '➕ Thêm mới'; statusColor = '#16a34a'; newCount++; }
            }

            if (i < 100) {
                rowsHtml.push(`<tr style="border-bottom:1px solid #f1f5f9;${!willProcess ? 'opacity:.5;' : ''}">
                    <td style="padding:4px 8px;font-weight:600;">${name}</td>
                    <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:11px;">${latLon.lat.toFixed(6)}</td>
                    <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:11px;">${latLon.lon.toFixed(6)}</td>
                    <td style="padding:4px 8px;text-align:right;font-family:monospace;color:${delta && parseFloat(delta) > 5 ? '#f59e0b' : '#64748b'};">${delta ? delta + ' m' : '—'}</td>
                    <td style="padding:4px 8px;text-align:center;color:${statusColor};font-weight:600;">${status}</td>
                </tr>`);
            }
        }

        // Stats
        statsEl.innerHTML = `
            <span style="background:#e0f2fe;color:#0891b2;padding:4px 10px;border-radius:6px;font-weight:700;">🔄 Cập nhật: ${matchCount}</span>
            <span style="background:#dcfce7;color:#16a34a;padding:4px 10px;border-radius:6px;font-weight:700;">➕ Thêm mới: ${newCount}</span>
            ${errCount > 0 ? `<span style="background:#fee2e2;color:#dc2626;padding:4px 10px;border-radius:6px;font-weight:700;">⚠ Lỗi: ${errCount}</span>` : ''}
            <span style="color:#64748b;padding:4px 10px;">Tổng: ${_csvImportRows.length}</span>
            ${_csvImportRows.length > 100 ? `<span style="color:#94a3b8;padding:4px 10px;font-style:italic;">Chỉ hiện 100 dòng đầu trong preview</span>` : ''}
        `;

        tbody.innerHTML = rowsHtml.join('');

        // Update confirm button label
        const btn = document.getElementById('csvImportConfirmBtn');
        const total = matchCount + newCount;
        btn.textContent = total > 0 ? `Áp dụng ${total} thao tác` : 'Không có thao tác';
        btn.disabled = total === 0;
    }

    async function _confirmCsvImport() {
        const zoneOpts = _getCsvZoneParams();
        const offsetOpts = _getCsvOffset();
        const mode = _getCsvMode();
        const c = _csvImportColMap;
        const defaultLoai = document.getElementById('csvImportLoai').value;
        const defaultTu   = (document.getElementById('csvImportTu').value || '').trim();

        // Build name → loadedData index map
        const existingByName = {};
        if (Array.isArray(loadedData) && loadedData.length > 1) {
            for (let i = 1; i < loadedData.length; i++) {
                const nm = String(loadedData[i][1] || '').trim().toLowerCase();
                if (nm) existingByName[nm] = i;
            }
        }

        const updates = []; // { rowIndex, name, lat, lon, accuracy, gpsMode }
        const newRows = []; // full 25-col rows

        for (const r of _csvImportRows) {
            const name = String(r[c.name] || '').trim();
            if (!name) continue;
            let latLon;
            try {
                latLon = _extractLatLon(r, zoneOpts, offsetOpts);
                if (!isFinite(latLon.lat) || !isFinite(latLon.lon)) continue;
            } catch(_) { continue; }

            const accuracy = c.accuracy >= 0 ? parseFloat(r[c.accuracy]) : null;
            const gpsMode = c.gpsMode >= 0 ? String(r[c.gpsMode] || '').toLowerCase() : null;
            const isRTK = gpsMode && /fix|rtk|float|dgps/i.test(gpsMode);

            const existingIdx = existingByName[name.toLowerCase()];

            // Helper: build row mới với ID tự sinh
            const buildNewRow = () => {
                const isCabinet = /^CS\./i.test(name);
                const loai = isCabinet ? 5 : parseInt(defaultLoai || 1);
                let tu = defaultTu;
                if (!tu && !isCabinet) tu = 'CS.' + name.split('.')[0];

                const row = new Array(25).fill('');
                row[0]  = generateId();   // ← ID MỚI tự động
                row[1]  = name;
                // Format với dấu phẩy VN cho Google Sheet locale VN
                row[2]  = formatCoordVN(latLon.lat, 7);
                row[3]  = formatCoordVN(latLon.lon, 7);
                row[6]  = loai;
                row[7]  = tu;
                row[13] = new Date().toISOString();

                // VN2000: nếu CSV input là VN2000 → dùng giá trị CSV đã TRỪ offset (về hệ chuẩn)
                //        nếu CSV input là WGS-84 → tính từ Lat/Lon
                if (_csvImportFormat === 'vn2000') {
                    const eStd = _parseFlexibleNumber(r[c.east])  - offsetOpts.dE;
                    const nStd = _parseFlexibleNumber(r[c.north]) - offsetOpts.dN;
                    row[19] = Math.round(eStd);  // Easting chuẩn → X
                    row[20] = Math.round(nStd);  // Northing chuẩn → Y
                } else {
                    const vn = convertLatLonToVn2000(latLon.lat, latLon.lon);
                    row[19] = Math.round(vn.x);
                    row[20] = Math.round(vn.y);
                }

                if (isFinite(accuracy)) row[23] = accuracy;
                if (isRTK) row[24] = 'rtk';
                return row;
            };

            if (mode === 'add') {
                // LUÔN thêm mới với ID mới — không quan tâm trùng tên
                newRows.push(buildNewRow());
            } else if (existingIdx) {
                // Có match + mode auto/update → cập nhật in-place, GIỮ ID cũ
                // VN2000 chuẩn = giá trị CSV - offset local grid (nếu format VN2000)
                const csvVn2000x = _csvImportFormat === 'vn2000'
                    ? Math.round(_parseFlexibleNumber(r[c.east])  - offsetOpts.dE)
                    : null;
                const csvVn2000y = _csvImportFormat === 'vn2000'
                    ? Math.round(_parseFlexibleNumber(r[c.north]) - offsetOpts.dN)
                    : null;
                updates.push({
                    rowIndex: existingIdx,
                    name,
                    lat: latLon.lat,
                    lon: latLon.lon,
                    accuracy: isFinite(accuracy) ? accuracy : null,
                    gpsMode: isRTK ? 'rtk' : (accuracy && accuracy < 0.5 ? 'rtk' : null),
                    csvVn2000x,
                    csvVn2000y
                });
            } else {
                // Không match + mode update → skip
                if (mode === 'update') continue;
                // mode auto + không match → thêm mới
                newRows.push(buildNewRow());
            }
        }

        if (updates.length === 0 && newRows.length === 0) {
            displayError('Không có thao tác nào để thực hiện.');
            return;
        }

        $('#csvImportModal').modal('hide');
        displayInfo(`Đang xử lý ${updates.length} cập nhật + ${newRows.length} thêm mới...`);

        const bar = document.getElementById('loadProgressBar');
        const totalOps = updates.length + newRows.length;
        let done = 0;
        const updateBar = () => {
            done++;
            if (bar) { bar.style.display = 'block'; bar.style.width = Math.round(done / totalOps * 100) + '%'; }
        };

        // Helper: gọi batch_match_update 1 chunk với retry
        const BATCH_SIZE = 50;
        const MAX_RETRIES = 3;
        async function _batchUpdateChunk(records, attempt = 1) {
            try {
                const res = await fetch(KHAOSAT_GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'batch_match_update', sheet: currentSheet, records })
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                if (data.status === 'ok') return data.updated || 0;
                throw new Error(data.message || 'GAS error');
            } catch (err) {
                console.warn(`[batch_match_update] chunk lỗi lần ${attempt}:`, err.message);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1500 * attempt));
                    return _batchUpdateChunk(records, attempt + 1);
                }
                console.error('[batch_match_update] Fail sau', MAX_RETRIES, 'lần retry');
                return 0;
            }
        }

        // 1. UPDATES — chia chunk 50 markers/request để tránh GAS timeout
        let updateOk = 0;
        if (updates.length > 0) {
            // Update client-side trước (loadedData + marker) — feedback ngay lập tức
            // Format lat/lon với dấu phẩy VN (10,7606005) để khớp với Google Sheet locale VN
            updates.forEach(u => {
                const row = loadedData[u.rowIndex];
                if (!row) return;
                row[2] = formatCoordVN(u.lat, 7);
                row[3] = formatCoordVN(u.lon, 7);
                row[13] = new Date().toISOString();
                // VN2000: ưu tiên giá trị gốc từ CSV (tránh round-trip zone mismatch)
                if (u.csvVn2000x != null && u.csvVn2000y != null) {
                    row[19] = u.csvVn2000x;
                    row[20] = u.csvVn2000y;
                } else {
                    const vn = convertLatLonToVn2000(u.lat, u.lon);
                    row[19] = Math.round(vn.x);
                    row[20] = Math.round(vn.y);
                }
                if (u.accuracy != null) row[23] = u.accuracy;
                if (u.gpsMode) row[24] = u.gpsMode;
                // Move marker on map
                const entry = markers.find(m => normalizeText(String(m.name || '')) === normalizeText(u.name));
                if (entry && entry.marker) {
                    entry.marker.setLatLng([u.lat, u.lon]);
                    entry.lat = u.lat; entry.lon = u.lon;
                }
            });

            // Chia thành chunks + gọi song song (tối đa 3 chunk cùng lúc để không nghẽn GAS)
            const chunks = [];
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                chunks.push(updates.slice(i, i + BATCH_SIZE));
            }
            console.log(`[CSV import] Chia ${updates.length} updates thành ${chunks.length} chunks (${BATCH_SIZE}/chunk)`);
            displayInfo(`Đang gửi ${chunks.length} batch × ${BATCH_SIZE} marker lên Google Sheet...`);

            for (let ci = 0; ci < chunks.length; ci++) {
                const chunk = chunks[ci];
                const records = chunk.map(u => {
                    // Nếu CSV có VN2000 gốc → dùng thẳng; ngược lại tính từ Lat/Lon
                    let vx, vy;
                    if (u.csvVn2000x != null && u.csvVn2000y != null) {
                        vx = u.csvVn2000x;
                        vy = u.csvVn2000y;
                    } else {
                        const vn = convertLatLonToVn2000(u.lat, u.lon);
                        vx = Math.round(vn.x);
                        vy = Math.round(vn.y);
                    }
                    return {
                        tenTru: u.name,
                        // Format với dấu phẩy VN (10,7606005) để Google Sheet locale VN hiển thị đúng
                        lat: formatCoordVN(u.lat, 7),
                        lon: formatCoordVN(u.lon, 7),
                        capNhat: new Date().toISOString(),
                        vn2000x: vx,
                        vn2000y: vy,
                        ...(u.accuracy != null ? { accuracy: u.accuracy } : {}),
                        ...(u.gpsMode ? { gpsMode: u.gpsMode } : {})
                    };
                });
                const chunkOk = await _batchUpdateChunk(records);
                updateOk += chunkOk;
                // Progress bar
                for (let i = 0; i < chunk.length; i++) updateBar();
                displayInfo(`Batch ${ci+1}/${chunks.length}: ${chunkOk}/${chunk.length} ✓ (tổng: ${updateOk}/${updates.length})`);
            }
        }

        // 2. NEW ROWS — sync từng row (giữ nguyên logic cũ)
        let newOk = 0;
        for (const row of newRows) {
            if (!Array.isArray(loadedData)) loadedData = [[]];
            loadedData.push(row);
            addMarkerRowToMap(row);
            const success = await syncRowToGAS(row, { silent: true });
            if (success) newOk++;
            updateBar();
        }

        if (bar) { bar.style.display = 'none'; bar.style.width = '0'; }

        const msg = [];
        if (updates.length > 0) msg.push(`Cập nhật: ${updateOk}/${updates.length}`);
        if (newRows.length > 0) msg.push(`Thêm mới: ${newOk}/${newRows.length}`);

        // Cảnh báo nếu có row không sync được
        const totalOk = updateOk + newOk;
        if (totalOk < totalOps) {
            const failed = totalOps - totalOk;
            displayError(`⚠ ${msg.join(' · ')} — Còn ${failed} thao tác thất bại. Đang tự động thử lại...`);
            // Auto reload CSV từ Google Sheet để user thấy trạng thái thực
            setTimeout(async () => {
                try {
                    const page = DISTRICT_PAGES.find(p => p.sheet === currentSheet);
                    if (page && page.csvUrl) {
                        await loadFromCSV(page.csvUrl);
                        displayInfo(`🔄 Đã reload dữ liệu từ Google Sheet để kiểm tra`);
                    }
                } catch(e){_swallow(e);}
            }, 2000);
        } else {
            displayInfo(`✅ ${msg.join(' · ')} — Đồng bộ thành công 100%`);
            // Reload sau 2s để user thấy vị trí mới trên map
            setTimeout(async () => {
                try {
                    const page = DISTRICT_PAGES.find(p => p.sheet === currentSheet);
                    if (page && page.csvUrl) await loadFromCSV(page.csvUrl);
                } catch(e){_swallow(e);}
            }, 2000);
        }
    }
