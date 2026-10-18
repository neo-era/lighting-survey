// Báo cáo — modal lọc + xem trước + xuất Excel
// Tách từ index.html (đợt 3 module hoá, v175) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ ("</script><script src=…><script>") nên thứ tự chạy lúc nạp giữ nguyên.
// Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau. Thêm code CHẠY LÚC NẠP phải rà lại.

        // ─── BÁO CÁO ───────────────────────────────────────────────────

        function showReportModal() {
            // Set default date range: 30 ngày gần nhất
            const today = new Date();
            const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 30);
            const fmt = d => d.toISOString().slice(0,10);
            const fromEl = document.getElementById('rptDateFrom');
            const toEl = document.getElementById('rptDateTo');
            if (fromEl && !fromEl.value) fromEl.value = fmt(monthAgo);
            if (toEl && !toEl.value) toEl.value = fmt(today);

            populateReportWardFilter();
            renderReportPreview();

            if (typeof $ !== 'undefined' && $.fn.modal) {
                $('#reportModal').modal('show');
            } else {
                const modal = document.getElementById('reportModal');
                if (modal) {
                    modal.style.display = 'block'; modal.offsetHeight;
                    modal.classList.add('show');
                    document.body.classList.add('modal-open');
                    const bd = document.createElement('div');
                    bd.className = 'modal-backdrop show';
                    document.body.appendChild(bd);
                    bd.onclick = closeReportModal;
                }
            }
        }

        function closeReportModal() {
            if (typeof $ !== 'undefined' && $.fn.modal) {
                $('#reportModal').modal('hide');
            } else {
                const modal = document.getElementById('reportModal');
                if (modal) {
                    modal.classList.remove('show');
                    setTimeout(() => { modal.style.display = 'none'; document.body.classList.remove('modal-open'); const bd = document.querySelector('.modal-backdrop'); if (bd) bd.remove(); }, 300);
                }
            }
        }

        // Lấy danh sách phường/xã duy nhất từ dữ liệu đã load
        function getUniqueWards() {
            const wards = new Set();
            (Array.isArray(loadedData) ? loadedData : []).forEach(row => {
                const w = (row[18] || '').toString().trim();
                if (w) wards.add(w);
            });
            return [...wards].sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
        }

        function populateReportWardFilter() {
            const sel = document.getElementById('rptWard');
            if (!sel) return;
            const current = sel.value;
            sel.innerHTML = '<option value="">Tất cả</option>';
            getUniqueWards().forEach(w => {
                const opt = document.createElement('option');
                opt.value = w; opt.textContent = w;
                if (w === current) opt.selected = true;
                sel.appendChild(opt);
            });
        }

        // Parse ngày từ chuỗi vi-VN hoặc ISO
        function parseRowDate(str) {
            if (!str) return null;
            // vi-VN format: "10/5/2025, 20:30:00"
            const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (m) return new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
            // ISO: "2025-05-10T..."
            const d = new Date(str);
            return isNaN(d) ? null : d;
        }

        function getReportFilteredRows() {
            const fromVal = document.getElementById('rptDateFrom').value;
            const toVal = document.getElementById('rptDateTo').value;
            const ward = document.getElementById('rptWard').value;
            const type = document.getElementById('rptType').value;

            const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : null;
            const toDate = toVal ? new Date(toVal + 'T23:59:59') : null;

            return (Array.isArray(loadedData) ? loadedData : []).filter((row, idx) => {
                if (idx === 0 && typeof row[0] === 'string' && isNaN(parseCoord(row[2]))) return false; // bỏ header
                const rowDate = parseRowDate(row[13]);
                if (fromDate && rowDate && rowDate < fromDate) return false;
                if (toDate && rowDate && rowDate > toDate) return false;
                if (ward && (row[18] || '').toString().trim() !== ward) return false;
                if (type && String(row[6]) !== type) return false;
                return true;
            });
        }

        const MARKER_TYPE_LABEL = Object.fromEntries(
            Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.label])
        );

        function renderReportPreview() {
            const rows = getReportFilteredRows();
            const el = document.getElementById('reportPreview');
            if (!el) return;

            if (!rows.length) {
                el.innerHTML = '<div class="rpt-empty"><i class="fa fa-inbox" style="font-size:28px;display:block;margin-bottom:8px"></i>Không có dữ liệu phù hợp với bộ lọc.</div>';
                return;
            }

            // Tổng hợp số lượng theo loại
            const byType = {};
            rows.forEach(r => {
                const t = String(r[6]||'1');
                byType[t] = (byType[t]||0) + 1;
            });

            const summary = `
                <div class="rpt-summary">
                    <div class="rpt-stat-card">
                        <div class="rpt-stat-num">${rows.length}</div>
                        <div class="rpt-stat-lbl">Tổng trụ</div>
                    </div>
                    <div class="rpt-stat-card">
                        <div class="rpt-stat-num">${(byType['1']||0) + (byType['2']||0)}</div>
                        <div class="rpt-stat-lbl">Trụ đèn</div>
                    </div>
                    <div class="rpt-stat-card">
                        <div class="rpt-stat-num">${byType['6']||0}</div>
                        <div class="rpt-stat-lbl">Tủ điều khiển</div>
                    </div>
                </div>`;

            const tableRows = rows.map(r => `
                <tr>
                    <td>${r[1]||'—'}</td>
                    <td>${MARKER_TYPE_LABEL[String(r[6])]||'Không xác định'}</td>
                    <td>${r[8]||'—'}</td>
                    <td>${r[10]||'—'}</td>
                    <td>${r[17]||'—'}</td>
                    <td>${r[18]||'—'}</td>
                    <td>${r[5]||'—'}</td>
                    <td>${r[13]||'—'}</td>
                </tr>`).join('');

            el.innerHTML = summary + `
                <table>
                    <thead><tr>
                        <th>Tên trụ</th>
                        <th>Loại</th>
                        <th>Loại trụ</th>
                        <th>Loại đèn</th>
                        <th>Đường</th>
                        <th>Phường/Xã</th>
                        <th>Người KS</th>
                        <th>Ngày KS</th>
                    </tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>`;
        }

        async function exportReport() {
            const rows = getReportFilteredRows();
            if (!rows.length) { displayError('Không có dữ liệu để xuất.'); return; }
            displayInfo('Đang tải thư viện Excel...');
            try { await _loadExcelJS(); } catch(_) { /* fallback sang XLSX.js bên dưới */ }

            const fromVal = document.getElementById('rptDateFrom').value;
            const toVal = document.getElementById('rptDateTo').value;
            const ward = document.getElementById('rptWard').value || 'TatCa';
            const fileName = `BaoCao-${ward}-${fromVal||'all'}-${toVal||'all'}.xlsx`;

            // Tạo workbook với 2 sheet
            const ExcelJSGlobal = typeof ExcelJS !== 'undefined' ? ExcelJS : (typeof window !== 'undefined' ? window.ExcelJS : undefined);

            if (ExcelJSGlobal) {
                const wb = new ExcelJSGlobal.Workbook();
                wb.creator = 'Lighting System V1.2';
                wb.created = new Date();

                // ── Sheet 1: Tổng hợp theo phường/xã ──
                const wsSummary = wb.addWorksheet('Tổng hợp');
                wsSummary.addRow(['BÁO CÁO KHẢO SÁT HỆ THỐNG CHIẾU SÁNG']);
                wsSummary.getRow(1).font = { bold: true, size: 14 };
                wsSummary.addRow([`Từ ngày: ${fromVal||'—'}   Đến ngày: ${toVal||'—'}   Phường/Xã: ${ward==='TatCa'?'Tất cả':ward}`]);
                wsSummary.addRow([]);

                // Header tổng hợp
                const summaryHeader = wsSummary.addRow(['Loại thiết bị', 'Số lượng']);
                summaryHeader.font = { bold: true };
                summaryHeader.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF2563EB' } };
                summaryHeader.getCell(1).font = { bold:true, color:{ argb:'FFFFFFFF' } };
                summaryHeader.getCell(2).font = { bold:true, color:{ argb:'FFFFFFFF' } };

                // Tổng hợp theo loại
                const typeMap = {};
                rows.forEach(r => {
                    const t = String(r[6]||'1');
                    if (!typeMap[t]) typeMap[t] = 0;
                    typeMap[t]++;
                });
                let totalAll = 0;
                Object.entries(typeMap).sort(([a],[b])=>Number(a)-Number(b)).forEach(([t,cnt]) => {
                    totalAll += cnt;
                    const label = (TYPE_CONFIG[Number(t)] || {label: 'Không xác định'}).label;
                    wsSummary.addRow([label, cnt]);
                });
                const totalRow = wsSummary.addRow(['TỔNG', totalAll]);
                totalRow.font = { bold: true };

                [30,12].forEach((w,i) => { wsSummary.getColumn(i+1).width = w; });

                // ── Sheet 2: Chi tiết ──
                const wsDetail = wb.addWorksheet('Chi tiết');
                const detailHeader = wsDetail.addRow([
                    'STT','Tên trụ','Lat','Lon','Ghi chú','Người KS','Loại','Tủ điều khiển',
                    'Loại trụ','Loại cần','Loại đèn','Công suất','URL Ảnh','Ngày khảo sát','Marker gốc','Khoảng cách (m)','Mã PE','Đường','Phường/Xã'
                ]);
                detailHeader.font = { bold: true };
                detailHeader.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1D4ED8' } };
                ['STT','Tên trụ','Lat','Lon','Ghi chú','Người KS','Loại','Tủ điều khiển','Loại trụ','Loại cần','Loại đèn','Công suất','URL Ảnh','Ngày khảo sát','Marker gốc','Khoảng cách','Mã PE','Đường','Phường/Xã'].forEach((h,i) => {
                    detailHeader.getCell(i+1).font = { bold:true, color:{ argb:'FFFFFFFF' } };
                });

                const _rpIdx = _rowIndex((loadedData || []).slice(1));   // Marker gốc hiển thị tên (sheet có thể lưu ID)
                rows.forEach((r, i) => {
                    wsDetail.addRow([
                        i+1, r[1]||'',
                        parseCoord(r[2])||0, parseCoord(r[3])||0,
                        r[4]||'', r[5]||'', MARKER_TYPE_LABEL[String(r[6])]||'Không xác định',
                        r[7]||'', r[8]||'', r[9]||'', r[10]||'', r[11]||'',
                        r[12]&&r[12].startsWith('data:')?'(base64)':r[12]||'',
                        r[13]||'', _parentNameOf(r, _rpIdx), r[15]||'', r[16]||'', r[17]||'', r[18]||''
                    ]);
                });

                [5,20,12,12,20,16,14,18,12,12,12,12,30,20,18,14,14,18,16].forEach((w,i) => { wsDetail.getColumn(i+1).width = w; });

                const buffer = await wb.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.style.display='none'; a.href=url; a.download=fileName;
                document.body.appendChild(a); a.click();
                setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); },100);
                displayError(`Đã xuất báo cáo: ${fileName} (${rows.length} trụ)`);
            } else {
                // Fallback: XLSX đơn giản
                const header = ['STT','Tên trụ','Lat','Lon','Ghi chú','Người KS','Loại','Tủ điều khiển','Loại trụ','Loại cần','Loại đèn','Công suất','URL Ảnh','Ngày khảo sát','Marker gốc','Khoảng cách (m)','Mã PE','Đường','Phường/Xã'];
                const _rpIdx = _rowIndex((loadedData || []).slice(1));
                const dataRows = rows.map((r,i) => [
                    i+1, r[1]||'',
                    parseCoord(r[2])||0, parseCoord(r[3])||0,
                    r[4]||'', r[5]||'', MARKER_TYPE_LABEL[String(r[6])]||'Không xác định',
                    r[7]||'', r[8]||'', r[9]||'', r[10]||'', r[11]||'',
                    r[12]&&r[12].startsWith('data:')?'(base64)':r[12]||'',
                    r[13]||'', _parentNameOf(r, _rpIdx), r[15]||'', r[16]||'', r[17]||'', r[18]||''
                ]);
                const ws = XLSX.utils.aoa_to_sheet([header,...dataRows]);
                const wbx = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wbx, ws, 'Chi tiết');
                XLSX.writeFile(wbx, fileName);
                displayError(`Đã xuất báo cáo: ${fileName} (${rows.length} trụ)`);
            }
        }
