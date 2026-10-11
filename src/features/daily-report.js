// Báo cáo ngày — xem + gửi email
// Tách từ index.html (đợt 3 module hoá, v175) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ ("</script><script src=…><script>") nên thứ tự chạy lúc nạp giữ nguyên.
// Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau. Thêm code CHẠY LÚC NẠP phải rà lại.

    // ── BÁO CÁO NGÀY — CLIENT LOGIC ──────────────────────────────────────

    function openDailyReportModal() {
        const drDate = document.getElementById('drDate');
        if (drDate && !drDate.value) {
            // Mặc định hôm nay (Asia/Ho_Chi_Minh offset +7)
            const now = new Date();
            const offset = 7 * 60;
            const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
            drDate.value = local.toISOString().slice(0, 10);
        }
        $('#dailyReportModal').modal('show');
        if (drDate && drDate.value) _loadDailyReport();
    }

    async function _loadDailyReport() {
        const dateStr = (document.getElementById('drDate') || {}).value;
        if (!dateStr) return;
        const content = document.getElementById('drContent');
        const status  = document.getElementById('drStatus');
        if (!content) return;
        content.innerHTML = '<div style="text-align:center;padding:60px;"><div class="spinner-border text-primary" style="width:2rem;height:2rem;"></div><div style="margin-top:12px;color:#64748b;font-size:13px;">Đang tải dữ liệu từ Google Sheets...</div></div>';
        if (status) { status.textContent = ''; }
        try {
            const res = await fetch(KHAOSAT_GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_daily_report', date: dateStr })
            });
            const json = await res.json();
            if (json.status !== 'ok') throw new Error(json.message || 'GAS trả về lỗi');
            _renderDailyReport(json.report, json.date);
        } catch (e) {
            content.innerHTML = `<div style="padding:20px;color:#dc2626;background:#fff5f5;border-radius:8px;">❌ ${e.message}</div>`;
        }
    }

    async function _sendDailyReportEmail() {
        const dateStr = (document.getElementById('drDate') || {}).value;
        const status  = document.getElementById('drStatus');
        if (!dateStr) return;
        if (status) { status.textContent = '⏳ Đang gửi email...'; status.style.color = '#f59e0b'; }
        try {
            const res = await fetch(KHAOSAT_GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_daily_report', date: dateStr })
            });
            const json = await res.json();
            if (json.status === 'ok') {
                if (status) { status.textContent = '✅ Đã gửi đến ' + (json.recipients || 'email recipients'); status.style.color = '#10b981'; }
            } else if (json.status === 'skipped') {
                if (status) { status.textContent = '⚠️ Email bị tắt trong Setting'; status.style.color = '#f59e0b'; }
            } else {
                throw new Error(json.message || json.reason || 'Lỗi không xác định');
            }
        } catch (e) {
            if (status) { status.textContent = '❌ ' + e.message; status.style.color = '#dc2626'; }
        }
    }

    const _DR_TYPE_LABEL = { 1:'Trụ STK', 2:'Trụ trang trí', 3:'Trụ HTLT', 4:'Trụ TTLT', 5:'Tủ CS nổi', 6:'Tủ CS ngầm' };
    const _DR_THAO_TAC   = { 'edit':'✏️ Sửa', 'delete':'🗑 Xóa', 'move':'📍 Di chuyển' };
    const _DR_TILE_COLORS = ['#2563eb', '#10b981', '#8b5cf6', '#dc2626'];

    function _drTile(icon, value, label, color) {
        return `<div style="background:#fff;border-left:4px solid ${color};border-radius:8px;padding:12px 16px;flex:1;min-width:120px;text-align:center;">
            <div style="font-size:24px;">${icon}</div>
            <div style="font-size:22px;font-weight:900;color:${color};font-family:monospace;line-height:1.2;">${value}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;font-weight:600;">${label}</div>
        </div>`;
    }

    function _drTableHdr(cols, bg) {
        return '<thead><tr style="background:' + bg + ';">'
            + cols.map(c => `<th style="border:1px solid #cbd5e1;padding:5px 8px;font-size:12px;white-space:nowrap;">${c}</th>`).join('')
            + '</tr></thead>';
    }

    function _renderDailyReport(rp, dateStr) {
        const content = document.getElementById('drContent');
        if (!rp) { content.innerHTML = '<div style="color:#94a3b8;padding:40px;text-align:center;">Không có dữ liệu</div>'; return; }

        const dp = (dateStr || '').split('-');
        const dateDisplay = dp.length === 3 ? dp[2] + '/' + dp[1] + '/' + dp[0] : dateStr;
        const withAnh = (rp.rows || []).filter(r => r.hasAnh).length;
        const anhPct  = rp.total > 0 ? Math.round(withAnh / rp.total * 100) : 0;
        const surveyorCount = Object.keys(rp.bySurveyor || {}).length;
        const editLogs = (rp.lichSuToday || []).filter(r => r.thaoTac === 'edit' || r.thaoTac === 'delete' || r.thaoTac === 'move');

        let html = '';

        // Tiêu đề ngày
        html += `<div style="background:linear-gradient(135deg,#1e40af,#2563eb);border-radius:8px;padding:12px 18px;color:#fff;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">
            <div>
                <div style="font-size:16px;font-weight:900;">BÁO CÁO KHẢO SÁT</div>
                <div style="font-size:12px;opacity:.8;margin-top:2px;">📅 ${dateDisplay}</div>
            </div>
            <div style="font-size:28px;font-weight:900;font-family:monospace;">${rp.total}</div>
        </div>`;

        // Tiles
        html += `<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
            ${_drTile('📍', rp.total, 'Marker khảo sát', '#2563eb')}
            ${_drTile('👷', surveyorCount, 'Người khảo sát', '#10b981')}
            ${_drTile('📷', withAnh + ' (' + anhPct + '%)', 'Có ảnh', '#8b5cf6')}
            ${_drTile('⚠️', (rp.suCoToday || []).length, 'Sự cố hôm nay', '#dc2626')}
        </div>`;

        if (rp.total === 0 && !(rp.suCoToday || []).length && !editLogs.length) {
            html += '<div style="text-align:center;padding:40px;background:#fff;border-radius:8px;color:#94a3b8;font-size:14px;">🌙 Không có hoạt động khảo sát nào được ghi nhận trong ngày này.</div>';
            content.innerHTML = html;
            return;
        }

        // Section wrapper
        const SEC = (title, color, body) =>
            `<div style="background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:13px;color:${color};border-bottom:2px solid ${color};padding-bottom:4px;margin-bottom:10px;">${title}</div>
                ${body}
            </div>`;

        // 1. Theo người khảo sát
        if (surveyorCount > 0) {
            const surveyors = Object.keys(rp.bySurveyor).sort((a,b) => rp.bySurveyor[b].count - rp.bySurveyor[a].count);
            let rows = '';
            surveyors.forEach((name, i) => {
                const sv = rp.bySurveyor[name];
                const sheetList = Object.keys(sv.sheets || {}).map(s => `${s}&nbsp;(${sv.sheets[s]})`).join(', ');
                rows += `<tr style="background:${i%2===0?'#fff':'#f8fafc'}">
                    <td style="border:1px solid #e2e8f0;padding:5px 8px;font-weight:700;">${name}</td>
                    <td style="border:1px solid #e2e8f0;padding:5px 8px;text-align:center;font-size:15px;font-weight:900;color:#2563eb;">${sv.count}</td>
                    <td style="border:1px solid #e2e8f0;padding:5px 8px;font-size:11px;color:#64748b;">${sheetList}</td>
                </tr>`;
            });
            const table = `<div style="overflow-x:auto;"><table width="100%" style="border-collapse:collapse;font-size:13px;">
                ${_drTableHdr(['Người khảo sát', 'Số marker', 'Địa bàn'], '#dbeafe')}
                <tbody>${rows}</tbody></table></div>`;
            html += SEC('1. Theo người khảo sát', '#2563eb', table);
        }

        // 2. Theo địa bàn
        if (Object.keys(rp.bySheet || {}).length > 0) {
            let rows = '';
            Object.keys(rp.bySheet).sort().forEach((s, i) => {
                rows += `<tr style="background:${i%2===0?'#fff':'#f8fafc'}">
                    <td style="border:1px solid #e2e8f0;padding:5px 8px;">${s}</td>
                    <td style="border:1px solid #e2e8f0;padding:5px 8px;text-align:center;font-weight:700;">${rp.bySheet[s]}</td>
                </tr>`;
            });
            const table = `<div style="overflow-x:auto;"><table width="100%" style="border-collapse:collapse;font-size:13px;">
                ${_drTableHdr(['Địa bàn', 'Số marker'], '#dbeafe')}
                <tbody>${rows}</tbody></table></div>`;
            html += SEC('2. Theo địa bàn', '#2563eb', table);
        }

        // 3. Chi tiết marker
        if ((rp.rows || []).length > 0) {
            let rows = '';
            rp.rows.slice(0, 100).forEach((r, i) => {
                let gio = r.capNhat || '';
                if (gio.indexOf('T') !== -1) gio = gio.slice(11, 16);
                else if (gio.indexOf(' ') !== -1) gio = gio.split(' ')[1] || '';
                rows += `<tr style="background:${i%2===0?'#fff':'#f8fafc'}">
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;font-weight:600;font-size:12px;">${r.tenTru}</td>
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;font-size:11px;color:#64748b;">${r.sheet}</td>
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;font-size:12px;">${r.nguoiKS}</td>
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;font-size:11px;">${r.tu}</td>
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;font-size:11px;">${r.duong}</td>
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;font-size:11px;">${r.px}</td>
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;text-align:center;">${r.hasAnh ? '✅' : '—'}</td>
                    <td style="border:1px solid #e2e8f0;padding:4px 6px;font-family:monospace;font-size:11px;">${gio}</td>
                </tr>`;
            });
            const extra = rp.rows.length > 100 ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;font-style:italic;">... và ${rp.rows.length-100} marker nữa (xem đầy đủ trong app)</div>` : '';
            const title = `3. Chi tiết marker đã khảo sát${rp.rows.length > 100 ? ' (100/' + rp.rows.length + ')' : ''}`;
            const table = `<div style="overflow-x:auto;"><table width="100%" style="border-collapse:collapse;font-size:12px;">
                ${_drTableHdr(['Tên trụ/tủ','Địa bàn','Người KS','Tủ ĐK','Đường','Phường/Xã','Ảnh','Giờ CN'], '#dbeafe')}
                <tbody>${rows}</tbody></table></div>${extra}`;
            html += SEC(title, '#2563eb', table);
        }

        // 4. Sự cố hôm nay
        if ((rp.suCoToday || []).length > 0) {
            let rows = '';
            rp.suCoToday.forEach((sc, i) => {
                const gio = String(sc.thoiGian || '').slice(-5);
                rows += `<tr style="background:${i%2===0?'#fff':'#fff5f5'}">
                    <td style="border:1px solid #fecaca;padding:4px 6px;font-family:monospace;font-size:11px;">${sc.id}</td>
                    <td style="border:1px solid #fecaca;padding:4px 6px;font-family:monospace;font-size:11px;">${gio}</td>
                    <td style="border:1px solid #fecaca;padding:4px 6px;font-weight:700;">${sc.tenTru}</td>
                    <td style="border:1px solid #fecaca;padding:4px 6px;">${sc.loai}</td>
                    <td style="border:1px solid #fecaca;padding:4px 6px;">${sc.mucDo==='Khẩn cấp'?'<b style="color:#dc2626">⚡ Khẩn cấp</b>':sc.mucDo}</td>
                    <td style="border:1px solid #fecaca;padding:4px 6px;">${sc.trangThai}</td>
                </tr>`;
            });
            const table = `<div style="overflow-x:auto;"><table width="100%" style="border-collapse:collapse;font-size:12px;">
                ${_drTableHdr(['ID','Giờ','Tên trụ','Loại SC','Mức độ','Trạng thái'], '#fee2e2')}
                <tbody>${rows}</tbody></table></div>`;
            html += SEC(`4. Sự cố phát sinh (${rp.suCoToday.length})`, '#dc2626', table);
        }

        // 5. Thao tác xóa/sửa/di chuyển
        if (editLogs.length > 0) {
            let rows = '';
            editLogs.slice(0, 50).forEach((log, i) => {
                const gio = String(log.thoiGian || '').slice(11, 16);
                const label = _DR_THAO_TAC[log.thaoTac] || log.thaoTac;
                rows += `<tr style="background:${i%2===0?'#fff':'#fffbeb'}">
                    <td style="border:1px solid #fde68a;padding:4px 6px;font-family:monospace;font-size:11px;">${gio}</td>
                    <td style="border:1px solid #fde68a;padding:4px 6px;">${log.nguoi}</td>
                    <td style="border:1px solid #fde68a;padding:4px 6px;">${label}</td>
                    <td style="border:1px solid #fde68a;padding:4px 6px;font-weight:700;">${log.tenTru}</td>
                    <td style="border:1px solid #fde68a;padding:4px 6px;font-size:11px;color:#64748b;">${String(log.chiTiet||'').slice(0,100)}</td>
                </tr>`;
            });
            const table = `<div style="overflow-x:auto;"><table width="100%" style="border-collapse:collapse;font-size:12px;">
                ${_drTableHdr(['Giờ','Người TH','Thao tác','Tên trụ','Chi tiết'], '#fef3c7')}
                <tbody>${rows}</tbody></table></div>`;
            html += SEC(`5. Thao tác chỉnh sửa / xóa (${editLogs.length})`, '#f59e0b', table);
        }

        content.innerHTML = html;
    }

