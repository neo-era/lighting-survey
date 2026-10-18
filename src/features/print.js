// src/features/print.js — Luồng In bản vẽ / Xuất PDF (module hoá đợt 4a).
// Classic script toàn cục, nạp place: tail (sau khối <script> chính).
// Gọi global từ index.html lúc runtime: map, loadedData, L, _buildCableLines, _applyMapScale, jsPDF, html2canvas…
// 18 hàm + 7 state. KHÔNG dùng import/export.

        const _PD_FIELDS = ['pdTuSelect','pdScale','pdPaper','pdTileStyle','pdQuality','pdRotation','pdSoBanVe','pdTongBanVe','pdNguoiLap','pdCVPhuTrach','pdCSKhuVuc','pdDonVi1','pdDonVi2','pdDonVi2Sub'];

        function _savePdFields() {
            _PD_FIELDS.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const v = (el.value || '').trim();
                if (v) localStorage.setItem('pd_' + id, v);
            });
        }

        function _restorePdFields() {
            _PD_FIELDS.forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.value) return; // không ghi đè giá trị đang có
                const v = localStorage.getItem('pd_' + id);
                if (!v) return;
                // Với <select>: chỉ restore nếu option còn tồn tại
                if (el.tagName === 'SELECT') {
                    const opt = [...el.options].find(o => o.value === v);
                    if (opt) el.value = v;
                } else {
                    el.value = v;
                }
            });
            // Sync UI cho pdRotation (label đi kèm)
            const rotEl = document.getElementById('pdRotation');
            const rotLabel = document.getElementById('pdRotationVal');
            if (rotEl && rotLabel) rotLabel.textContent = (rotEl.value || 0) + '°';
        }

        function openPrintDrawingModal() {
            // Hiện mô tả bộ lọc đang áp dụng
            const descEl = document.getElementById('pdFilterDesc');
            if (descEl) {
                const filtered = _getFilteredRows();
                const parts = [];
                if (_activeFilters.tuDieuKhien && _activeFilters.tuDieuKhien.length)
                    parts.push('Tủ: ' + _activeFilters.tuDieuKhien.join(', '));
                if (_activeFilters.duong)   parts.push('Đường: ' + _activeFilters.duong);
                if (_activeFilters.phuongXa) parts.push(_activeFilters.phuongXa);
                if (_activeFilters.nguoiKS) parts.push('KS: ' + _activeFilters.nguoiKS);
                descEl.textContent = parts.length
                    ? parts.join(' — ') + ' (' + filtered.length + ' đối tượng)'
                    : 'Tất cả dữ liệu hiện tại (' + filtered.length + ' đối tượng)';
            }
            // Restore tất cả pd* field từ localStorage trước (không ghi đè value đang có)
            _restorePdFields();
            const nguoiEl = document.getElementById('pdNguoiLap');
            if (nguoiEl && !nguoiEl.value && currentUser) nguoiEl.value = currentUser.displayName || currentUser.username || '';
            const ngayEl = document.getElementById('pdNgay');
            if (ngayEl) ngayEl.value = new Date().toISOString().slice(0,10); // luôn lấy hôm nay
            // pdTenTu LUÔN lấy từ filter tủ điều khiển — không nhớ giá trị cũ, không restore localStorage
            const tenTuEl = document.getElementById('pdTenTu');
            if (tenTuEl) {
                const tuArr = (_activeFilters.tuDieuKhien || []).filter(Boolean);
                tenTuEl.value = (tuArr.length === 1) ? tuArr[0] : '';
            }
            $('#printDrawingModal').modal('show');
        }

        function _buildPrintCableSvg(rows, rotationDeg) {
            _removePrintCableSvg();
            const mapEl = document.getElementById('map');
            if (!mapEl) return;
            const W = mapEl.offsetWidth, H = mapEl.offsetHeight;
            const cx = W / 2, cy = H / 2;
            const θ = (rotationDeg || 0) * Math.PI / 180;
            const cosθ = Math.cos(θ), sinθ = Math.sin(θ);

            // Xoay điểm container-space quanh tâm map — khớp với CSS rotate(θdeg) trên map pane
            function rotPt(pt) {
                if (!rotationDeg) return pt;
                const dx = pt.x - cx, dy = pt.y - cy;
                return { x: cx + dx * cosθ - dy * sinθ, y: cy + dx * sinθ + dy * cosθ };
            }

            // Detect cycle để tô đỏ đoạn lỗi trong SVG
            const _svgCycle = _detectCableCycle(rows);
            const _svgCycleSet = (_svgCycle && _svgCycle.rows) || new Set();
            const _svgIdx = _rowIndex((loadedData || []).slice(1), rows);
            const _svgLL = r => { const la = parseCoord(r[2]), lo = parseCoord(r[3]); return Number.isFinite(la) && Number.isFinite(lo) ? [la, lo] : null; };

            let markup = '';
            rows.forEach(r => {
                if (!String(r[14] || '').trim()) return;
                const pRow = _resolveParent(r, _svgIdx);
                const pLL = pRow && _svgLL(pRow), cLL = _svgLL(r);
                if (!pLL || !cLL) return;

                const from = rotPt(map.latLngToContainerPoint(pLL));
                const to   = rotPt(map.latLngToContainerPoint(cLL));
                const distVal = String(r[15] || '').trim() ||
                    String(haversineM(cLL[0], cLL[1], pLL[0], pLL[1]));
                const mx = ((from.x + to.x) / 2).toFixed(1);
                const my = ((from.y + to.y) / 2).toFixed(1);
                const isCycle = _svgCycleSet.size > 0 && _svgCycleSet.has(r) && _svgCycleSet.has(pRow);
                const strokeColor = isCycle ? '#ef4444' : (CABLE_STYLE[String(r[22] || 'noi')] || CABLE_STYLE.noi).color;
                const strokeDash  = isCycle ? '6 4'     : (CABLE_STYLE[String(r[22] || 'noi')] || CABLE_STYLE.noi).dashArray;
                const strokeW     = isCycle ? 3.5        : 2.5;

                markup +=
                    `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"` +
                    ` stroke="${strokeColor}" stroke-width="${strokeW}" stroke-dasharray="${strokeDash}" opacity="0.85"/>` +
                    `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle"` +
                    ` font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="${strokeColor}"` +
                    ` paint-order="stroke" stroke="white" stroke-width="3" stroke-linejoin="round">${distVal}m</text>`;
            });

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = '_printCableSvg';
            svg.setAttribute('width', W);
            svg.setAttribute('height', H);
            svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450;overflow:visible;';
            svg.innerHTML = markup;
            mapEl.appendChild(svg);
        }

        function _removePrintCableSvg() {
            const el = document.getElementById('_printCableSvg');
            if (el) el.remove();
        }

        const PRINT_CONFIG = {
            // Kích thước giấy in (mm), dùng để tính aspect ratio + jsPDF format
            paper: {
                a3: { mmW: 420, mmH: 297 },
                a4: { mmW: 297, mmH: 210 }
            },
            // Ngưỡng chênh lệch px giữa width hiện tại vs targetW để quyết định có resize map không
            aspectRatioThresholdPx: 5,
            // Wait sau setView({reset}) — 600 khi vừa resize (Leaflet cần tính lại pixel origin),
            // 200 khi không resize (chỉ cần next frame)
            resyncDelayMs:   { afterResize: 600, normal: 200 },
            // Wait sau khi rotate map (CSS transform mất ~1 frame để repaint)
            rotationDelayMs: 150,
            // Wait sau khi build SVG cable (đảm bảo DOM commit)
            svgCableDelayMs: 100,
            // Wait sau khi append overlay (legend + title block) — chờ font/layout settle
            overlayDelayMs:  300,
            // html2canvas: scale 3 = pin-sharp cho A3 300 DPI (capture ~3600×2550 → 4960×3508 stretch chỉ 1.38×);
            // scale 2 làm text bể vì stretch 2×. PNG lossless để tránh JPEG artifact quanh text.
            // ⚠ Mobile: dùng captureScaleMobile để tránh OOM (scale 3 = ~90MB peak, mobile cũ có thể crash tab).
            captureScale:       3,     // Desktop — chữ pin-sharp
            captureScaleMobile: 2,     // Mobile — chữ hơi bể nhưng không crash
            jpegQuality:  0.95,
            // Timeout chờ tile layer load (fallback nếu network treo)
            tileLoadTimeoutMs: 5000
        };

        let _savedBaseLayers = [];

        let _printCartoLayer = null;

        const _PRINT_TILE_URLS = {
            voyager:  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            dark:     'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            positron: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        };

        function _switchToPrintTile(style) {
            const tileUrl = _PRINT_TILE_URLS[style] || _PRINT_TILE_URLS.voyager;
            _savedBaseLayers = [];
            map.eachLayer(l => {
                if (l instanceof L.TileLayer && l.options.pane !== 'shadowPane') {
                    _savedBaseLayers.push(l);
                    map.removeLayer(l);
                }
            });
            _printCartoLayer = L.tileLayer(tileUrl,
                { maxZoom: 20, attribution: '© CartoDB', crossOrigin: 'anonymous' }
            );
            _printCartoLayer.addTo(map);
        }

        function _restoreOriginalTiles() {
            if (_printCartoLayer) { map.removeLayer(_printCartoLayer); _printCartoLayer = null; }
            _savedBaseLayers.forEach(l => l.addTo(map));
            _savedBaseLayers = [];
        }

        function _waitForTileLoad(layer, maxMs) {
            return new Promise(resolve => {
                if (!layer) { resolve(); return; }
                let done = false;
                const finish = () => { if (!done) { done = true; resolve(); } };
                layer.once('load', finish);
                setTimeout(finish, maxMs || PRINT_CONFIG.tileLoadTimeoutMs);
            });
        }

        function _zoomToScale(scale, paperMmW, paperMmH) {
            const earthCirc = 40075016.686;
            const lat = map.getCenter().lat;
            const cosLat = Math.cos(lat * Math.PI / 180);
            const H = document.getElementById('map').offsetHeight;
            if (!H || !paperMmH) {
                // Fallback (legacy formula) nếu thiếu paper info — không chính xác nhưng không crash
                const zoom = Math.log2(earthCirc * cosLat * 96 / (25.4 * scale));
                map.setZoom(Math.round(zoom));
                return;
            }
            const zoomExact = Math.log2(earthCirc * cosLat * 1000 * H / (256 * paperMmH * scale));
            map.setZoom(zoomExact);
        }

        function _showPrintOverlay(opts) {
            _hidePrintOverlay();
            const { rows, tenTu, scale, ngay, nguoiLap, soBanVe, tongBanVe, cvPhuTrach = '', csKhuVuc = '',
                    donVi1 = '', donVi2 = '', donVi2Sub = '' } = opts;
            // Default nếu user không nhập
            const _donVi1     = donVi1    || 'TT QUẢN LÝ GIAO THÔNG VÀ HẠ TẦNG KỸ THUẬT TP.HCM';
            const _donVi2     = donVi2    || 'CÔNG TY CỔ PHẦN CHIẾU SÁNG CÔNG CỘNG TP.HCM';
            const _donVi2Sub  = donVi2Sub || 'CHIẾU SÁNG KHU VỰC TRUNG TÂM';
            const usedTypes = [...new Set(rows.map(r => parseInt(r[6])).filter(t => TYPE_CONFIG[t]))];

            // Đếm số trụ/tủ theo từng loại trong filtered rows
            const countByType = {};
            rows.forEach(r => {
                const t = Number(r[6]);
                if (t) countByType[t] = (countByType[t] || 0) + 1;
            });

            // ── Footer height: tự nở theo nội dung, không tính cố định (tránh clip) ──
            // Bật compact khi > 5 loại để icon đủ nhỏ fit trong max-height 280px.
            const compactMode = usedTypes.length > 5;

            // Style động cho row/cell (font + padding scale theo mode)
            const _rowStyle = 'border-bottom:1px solid #94a3b8;';
            const _cellPadV = compactMode ? '2px' : '4px';
            const _fontMain = compactMode ? '9px' : '10px';
            const _fontNum  = compactMode ? '10px' : '11px';
            const _iconW    = compactMode ? '18px' : '26px';
            const _cellLeft = `padding:${_cellPadV} 8px;border-right:1px solid #94a3b8;vertical-align:middle;`;
            const _cellMid  = `padding:${_cellPadV} 6px;border-right:1px solid #94a3b8;vertical-align:middle;text-align:center;font-weight:400;font-size:${_fontNum};color:#0f172a;`;
            const _cellRight= `padding:${_cellPadV} 6px;vertical-align:middle;text-align:center;font-size:${_fontMain};color:#1e293b;`;
            const legendItems = usedTypes.map(t => {
                const cfg = TYPE_CONFIG[t];
                const svgHtml = cfg.shape === 'cabinet'
                    ? _makeCabinetIconSvg(cfg.color, compactMode, t)
                    : _makeLampIconSvg(cfg.color, compactMode, t);
                const unit = cfg.shape === 'cabinet' ? 'tủ' : 'trụ';
                return `<tr style="${_rowStyle}">
                    <td style="${_cellLeft}">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <div style="width:${_iconW};text-align:center;flex-shrink:0;line-height:0;">${svgHtml}</div>
                            <span style="font-size:${_fontMain};color:#1e293b;">${cfg.label}</span>
                        </div>
                    </td>
                    <td style="${_cellMid}">${countByType[t] || 0}</td>
                    <td style="${_cellRight}">${unit}</td>
                </tr>`;
            }).join('');
            // Tổng cáp: cùng logic _buildCableLines — chỉ đếm row có Marker gốc (r[14]),
            // dùng r[15] (Khoảng cách) nếu hợp lệ, fallback Haversine tới trụ cha (_resolveParent, tra trong toàn bộ marker).
            // Tách tổng cáp theo loại (noi/ngam) — dùng cho legend hiển thị 2 dòng riêng
            const capByType = { noi: 0, ngam: 0 };
            const _capIdx = _rowIndex((loadedData || []).slice(1), rows);
            const _capLL = r => { const la = parseCoord(r[2]), lo = parseCoord(r[3]); return Number.isFinite(la) && Number.isFinite(lo) ? [la, lo] : null; };
            rows.forEach(r => {
                const pRow = _resolveParent(r, _capIdx);
                const pp = pRow && _capLL(pRow), cc = _capLL(r);
                if (!pp || !cc) return;
                const type = String(r[22] || 'noi') === 'ngam' ? 'ngam' : 'noi';
                const v = parseFloat(String(r[15] || '').replace(',', '.'));
                const len = (Number.isFinite(v) && v > 0)
                    ? v
                    : haversineM(pp[0], pp[1], cc[0], cc[1]);
                capByType[type] += len;
            });

            // Build cable rows — hiện 2 dòng riêng "Cáp nổi" và "Cáp ngầm"
            const _cableSvgW = compactMode ? '14' : '22';
            const _cableRow = (type) => {
                const style = CABLE_STYLE[type];
                const dashAttr = style.dashArray.replace('10 4', '5 2').replace('2 3 8 3', '1.5 1.5 4 1.5'); // scale dashArray cho icon nhỏ
                return `<tr style="${_rowStyle}">
                    <td style="${_cellLeft}">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <div style="width:${_iconW};text-align:center;flex-shrink:0;line-height:0;">
                                <svg width="${_cableSvgW}" height="8"><line x1="0" y1="4" x2="${_cableSvgW}" y2="4" stroke="${style.color}" stroke-width="2.2" stroke-dasharray="${dashAttr}"/></svg>
                            </div>
                            <span style="font-size:${_fontMain};color:#1e293b;">${style.label}</span>
                        </div>
                    </td>
                    <td style="${_cellMid}">${Math.round(capByType[type])}</td>
                    <td style="${_cellRight}">m</td>
                </tr>`;
            };
            // Luôn hiện cáp nổi; chỉ hiện cáp ngầm nếu có dữ liệu
            const cableRow = _cableRow('noi') + (capByType.ngam > 0 ? _cableRow('ngam') : '');
            const footerHtml = `<div style="position:absolute;left:0;bottom:0;width:30%;
                min-height:110px;max-height:280px;
                background:white;border-top:2px solid #1e293b;border-right:2px solid #1e293b;
                overflow:hidden;font-family:Arial,sans-serif;">
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <colgroup>
                        <col style="width:66%">
                        <col style="width:18%">
                        <col style="width:16%">
                    </colgroup>
                    <!-- Header row -->
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:4px 8px;border-bottom:1.5px solid #1e293b;border-right:1px solid #94a3b8;
                                       font-size:9px;font-weight:800;color:#0f172a;text-transform:uppercase;
                                       letter-spacing:.5px;text-align:left;">Bảng ký hiệu</th>
                            <th style="padding:4px 6px;border-bottom:1.5px solid #1e293b;border-right:1px solid #94a3b8;
                                       font-size:8.5px;font-weight:700;color:#475569;text-transform:uppercase;
                                       letter-spacing:.3px;text-align:center;">Số lượng</th>
                            <th style="padding:4px 6px;border-bottom:1.5px solid #1e293b;
                                       font-size:8.5px;font-weight:700;color:#475569;text-transform:uppercase;
                                       letter-spacing:.3px;text-align:center;">Đơn vị</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${legendItems}${cableRow}
                    </tbody>
                </table>
            </div>`;
            const overlay = document.createElement('div');
            overlay.id = 'printOverlay';
            overlay.style.cssText = 'position:absolute;inset:0;z-index:8000;pointer-events:none;'
                + 'font-family:Arial,Helvetica,sans-serif;'
                + 'text-rendering:geometricPrecision;'
                + '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;';
            overlay.innerHTML = `
                <!-- Khung in (margin + border) -->
                <div style="position:absolute;inset:14px;border:2px solid #1e293b;">
                    <!-- Tiêu đề bản vẽ (top center) -->
                    <div style="position:absolute;top:0;left:0;right:0;z-index:10;
                                background:rgba(255,255,255,.96);border-bottom:1.5px solid #1e293b;
                                text-align:center;padding:5px 12px 4px;">
                        <div style="font-size:12px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:.5px;line-height:1.3;">
                            BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ
                        </div>
                        <div style="font-size:9px;font-weight:700;color:#1e293b;margin-top:2px;letter-spacing:.3px;">
                            TỦ ĐIỀU KHIỂN - ${tenTu || ''}
                            <span style="margin-left:24px;">TL: 1 : ${parseInt(scale).toLocaleString()}</span>
                        </div>
                    </div>
                    ${footerHtml}
                    <!-- Khung tên (title block) — fixed 110px ở góc dưới phải, KHÔNG đồng bộ với footer -->
                    <div style="position:absolute;right:0;bottom:0;width:62.5%;height:110px;
                                background:white;border-top:2px solid #1e293b;border-left:2px solid #1e293b;overflow:hidden;">
                      <table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-family:Arial,sans-serif;">
                        <colgroup>
                          <col style="width:18%"><col style="width:18%"><col style="width:18%">
                          <col style="width:34%"><col style="width:12%">
                        </colgroup>
                        <!-- Hàng 1: Tên tổ chức — col 2+3 gộp -->
                        <tr>
                          <td style="border-right:1px solid #94a3b8;border-bottom:1px solid #94a3b8;padding:2px 5px;text-align:center;vertical-align:middle;">
                            <div style="font-size:7.5px;font-weight:800;color:#0f172a;text-transform:uppercase;line-height:1.4;">${_donVi1}</div>
                          </td>
                          <td colspan="2" style="border-right:1px solid #94a3b8;border-bottom:1px solid #94a3b8;padding:2px 5px;text-align:center;vertical-align:middle;">
                            <div style="font-size:7.5px;font-weight:800;color:#0f172a;text-transform:uppercase;line-height:1.4;">${_donVi2}</div>
                            <div style="font-size:6.5px;font-weight:800;color:#0f172a;text-transform:uppercase;margin-top:2px;letter-spacing:.3px;">${_donVi2Sub}</div>
                          </td>
                          <td rowspan="2" style="border-right:1px solid #94a3b8;padding:5px 10px;vertical-align:middle;text-align:center;">
                            <div style="font-size:9.5px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.3px;">BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN</div>
                            <div style="font-size:8.5px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-top:1px;">HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ</div>
                          </td>
                          <td style="border-bottom:1px solid #94a3b8;padding:2px 7px;vertical-align:middle;">
                            <span style="font-size:7.5px;font-weight:700;color:#475569;">SHBV:</span>
                          </td>
                        </tr>
                        <!-- Hàng 2: Nhãn chức vụ (bold) -->
                        <tr>
                          <td style="border-right:1px solid #94a3b8;border-bottom:1px solid #94a3b8;padding:2px 5px;font-size:7px;font-weight:800;text-align:center;vertical-align:middle;color:#0f172a;text-transform:uppercase;">CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN</td>
                          <td style="border-right:1px solid #94a3b8;border-bottom:1px solid #94a3b8;padding:2px 5px;font-size:7px;font-weight:800;text-align:center;vertical-align:middle;color:#0f172a;text-transform:uppercase;">PHÓ GIÁM ĐỐC</td>
                          <td style="border-right:1px solid #94a3b8;border-bottom:1px solid #94a3b8;padding:2px 5px;font-size:7px;font-weight:800;text-align:center;vertical-align:middle;color:#0f172a;text-transform:uppercase;">NGƯỜI LẬP</td>
                          <td style="border-bottom:1px solid #94a3b8;padding:2px 7px;vertical-align:middle;">
                            <span style="font-size:7.5px;font-weight:700;color:#475569;">Số soát xét:</span>
                          </td>
                        </tr>
                        <!-- Hàng 3: Ký tên (italic, mờ) -->
                        <tr>
                          <td style="border-right:1px solid #94a3b8;padding:2px 5px;font-size:7.5px;font-style:italic;text-align:center;vertical-align:middle;color:#94a3b8;">&nbsp;</td>
                          <td style="border-right:1px solid #94a3b8;padding:2px 5px;font-size:7.5px;font-style:italic;text-align:center;vertical-align:middle;color:#94a3b8;">&nbsp;</td>
                          <td style="border-right:1px solid #94a3b8;padding:2px 5px;font-size:7.5px;font-style:italic;text-align:center;vertical-align:middle;color:#94a3b8;">&nbsp;</td>
                          <td rowspan="2" style="border-right:1px solid #94a3b8;padding:5px 10px;vertical-align:middle;">
                            <div style="font-size:7.5px;font-weight:700;color:#475569;margin-bottom:2px;">BẢN VẼ:</div>
                            <div style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.2;">${tenTu || ''}</div>
                            <div style="font-size:8px;color:#2563eb;margin-top:2px;">Tỉ lệ: 1 : ${parseInt(scale).toLocaleString()}</div>
                          </td>
                          <td style="border-bottom:1px solid #94a3b8;padding:2px 7px;vertical-align:middle;">
                            <span style="font-size:7.5px;font-weight:700;color:#475569;">Bản vẽ số: </span><span style="font-size:11px;font-weight:800;color:#0f172a;">${soBanVe ? (tongBanVe ? soBanVe + '/' + tongBanVe : soBanVe) : ''}</span>
                          </td>
                        </tr>
                        <!-- Hàng 4: Tên người ký + Ngày -->
                        <tr>
                          <td style="border-right:1px solid #94a3b8;padding:2px 5px 7px;font-size:8.5px;font-weight:700;text-align:center;color:#0f172a;vertical-align:bottom;">${cvPhuTrach}</td>
                          <td style="border-right:1px solid #94a3b8;padding:2px 5px 7px;font-size:8.5px;font-weight:700;text-align:center;color:#0f172a;vertical-align:bottom;">${csKhuVuc}</td>
                          <td style="border-right:1px solid #94a3b8;padding:2px 5px 7px;font-size:9px;font-weight:700;text-align:center;color:#0f172a;vertical-align:bottom;">${nguoiLap || ''}</td>
                          <td style="padding:2px 7px;vertical-align:middle;">
                            <span style="font-size:7.5px;color:#475569;">Ngày: </span><span style="font-size:9px;font-weight:700;color:#0f172a;">${ngay ? (p => p[2]+'/'+p[1]+'/'+p[0].slice(2))(ngay.split('-')) : ''}</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                </div>`;
            document.getElementById('map').appendChild(overlay);
        }

        function _hidePrintOverlay() {
            const el = document.getElementById('printOverlay');
            if (el) el.remove();
        }

        let _previewMode = false;

        async function _preparePrintLayout(opts) {
            opts = opts || {};
            const paperKey = opts.paper || 'a3';
            const paperDim = PRINT_CONFIG.paper[paperKey] || PRINT_CONFIG.paper.a3;

            _savePdFields();
            const rows = _getFilteredRows();
            let mapEl, origStyleW, resized = false;

            if (!opts.skipTileSetup && rows.length > 0) {
                // Bật fractional zoom để Leaflet không round zoom (cần thiết cho tỷ lệ chính xác).
                if (map._origZoomSnap === undefined) map._origZoomSnap = map.options.zoomSnap;
                map.options.zoomSnap = 0;

                // Force aspect ratio khổ giấy — giống exportDrawingPDF
                mapEl = document.getElementById('map');
                origStyleW = mapEl.style.width;
                const ratio = paperDim.mmW / paperDim.mmH;
                const targetW = Math.round(mapEl.offsetHeight * ratio);
                if (Math.abs(mapEl.offsetWidth - targetW) > PRINT_CONFIG.aspectRatioThresholdPx) {
                    mapEl.style.width = targetW + 'px';
                    map.invalidateSize({ animate: false });
                    resized = true;
                    await new Promise(r => setTimeout(r, PRINT_CONFIG.resyncDelayMs.afterResize));
                }

                _switchToPrintTile(opts.tileStyle);
                _zoomToScale(opts.scale, paperDim.mmW, paperDim.mmH);
                if (opts.displayMsg) displayInfo(opts.displayMsg);
                await _waitForTileLoad(_printCartoLayer, PRINT_CONFIG.tileLoadTimeoutMs);
            }
            return {
                rows,
                cleanup: () => {
                    const _safe = fn => { try { fn(); } catch(e){_swallow(e);} };
                    _safe(_hidePrintOverlay);
                    _safe(_removePrintCableSvg);
                    _safe(_removeCableLines);
                    _safe(_restoreOriginalTiles);
                    _safe(_clearMapRotation);
                    _safe(() => {
                        // Restore kích thước map
                        if (resized && mapEl) {
                            mapEl.style.width = origStyleW || '';
                            map.invalidateSize({ animate: false });
                        }
                    });
                    _safe(() => {
                        if (map._origZoomSnap !== undefined) {
                            map.options.zoomSnap = map._origZoomSnap;
                            delete map._origZoomSnap;
                        }
                    });
                }
            };
        }

        async function openPrintPreview() {
            const scale      = parseInt((document.getElementById('pdScale')      || {}).value) || 1000;
            const paper      = (document.getElementById('pdPaper')     || {}).value || 'a3';
            const tileStyle  = (document.getElementById('pdTileStyle') || {}).value || 'voyager';
            const tenTu      = (document.getElementById('pdTenTu')      || {}).value?.trim() || '';
            const soBanVe    = (document.getElementById('pdSoBanVe')    || {}).value?.trim() || '';
            const tongBanVe  = (document.getElementById('pdTongBanVe')  || {}).value?.trim() || '';
            const nguoiLap   = (document.getElementById('pdNguoiLap')   || {}).value?.trim() || '';
            const ngay       = (document.getElementById('pdNgay')       || {}).value;
            const cvPhuTrach = (document.getElementById('pdCVPhuTrach') || {}).value?.trim() || '';
            const csKhuVuc   = (document.getElementById('pdCSKhuVuc')   || {}).value?.trim() || '';
            const donVi1     = (document.getElementById('pdDonVi1')     || {}).value?.trim() || '';
            const donVi2     = (document.getElementById('pdDonVi2')     || {}).value?.trim() || '';
            const donVi2Sub  = (document.getElementById('pdDonVi2Sub')  || {}).value?.trim() || '';

            // Fail-fast nếu không có dữ liệu (trước khi hide modal)
            if (!_getFilteredRows().length) { displayError('Không có dữ liệu để xem trước.'); return; }
            $('#printDrawingModal').modal('hide');

            const { rows } = await _preparePrintLayout({
                scale,
                paper,
                tileStyle,
                displayMsg: 'Đang tải bản đồ xem trước...'
            });

            map.setView(map.getCenter(), map.getZoom(), { animate: false, reset: true });
            await new Promise(r => setTimeout(r, PRINT_CONFIG.resyncDelayMs.normal));
            _buildCableLines(rows); // L.polyline cho xem trước (không qua html2canvas)
            _showPrintOverlay({ rows, tenTu, scale, ngay, nguoiLap, soBanVe, tongBanVe, cvPhuTrach, csKhuVuc, donVi1, donVi2, donVi2Sub });
            _currentMapRotation = parseFloat((document.getElementById('pdRotation') || {}).value) || 0;
            _applyMapRotation(_currentMapRotation);
            const prevRotEl = document.getElementById('previewRotVal');
            if (prevRotEl) prevRotEl.textContent = _currentMapRotation + '°';
            _previewMode = true;
            document.getElementById('printPreviewBar').style.display = 'flex';
        }

        function closePrintPreview() {
            _previewMode = false;
            _currentMapRotation = 0;
            _clearMapRotation();
            _hidePrintOverlay();
            _removePrintCableSvg();
            _removeCableLines();
            _restoreOriginalTiles();
            // Restore zoomSnap nếu đã bật fractional zoom trong preview
            if (map._origZoomSnap !== undefined) {
                map.options.zoomSnap = map._origZoomSnap;
                delete map._origZoomSnap;
            }
            document.getElementById('printPreviewBar').style.display = 'none';
        }

        async function exportDrawingPDF(opts) {
            opts = opts || {};
            const _returnBlob = opts.returnBlob === true;
            // Bug fix: clear stale blob so failed re-export doesn't serve previous result
            window._lastPdfBlob = null;
            window._lastPdfFilename = null;
            const exportBtn = document.getElementById('pdExportBtn');
            if (exportBtn) { exportBtn.disabled = true; exportBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Đang xử lý...'; }

            // Khai báo ngoài try để finally có thể truy cập
            const mapEl = document.getElementById('map');
            let origStyleW = mapEl ? mapEl.style.width : '';
            let origStyleH = mapEl ? mapEl.style.height : '';
            let resized = false;

            try {
                displayInfo('Đang tải thư viện in...');
                await _loadPrintLibs();

                const scale      = parseInt((document.getElementById('pdScale')      || {}).value) || 1000;
                const paper      = (document.getElementById('pdPaper')      || {}).value || 'a3';
                const tileStyle  = (document.getElementById('pdTileStyle')  || {}).value || 'voyager';
                const tenTu      = (document.getElementById('pdTenTu')      || {}).value.trim();
                const soBanVe    = (document.getElementById('pdSoBanVe')    || {}).value.trim();
                const tongBanVe  = (document.getElementById('pdTongBanVe')  || {}).value.trim();
                const nguoiLap   = (document.getElementById('pdNguoiLap')   || {}).value.trim();
                const ngay       = (document.getElementById('pdNgay')       || {}).value;
                const cvPhuTrach = (document.getElementById('pdCVPhuTrach') || {}).value?.trim() || '';
                const csKhuVuc   = (document.getElementById('pdCSKhuVuc')   || {}).value?.trim() || '';
                const donVi1     = (document.getElementById('pdDonVi1')     || {}).value?.trim() || '';
                const donVi2     = (document.getElementById('pdDonVi2')     || {}).value?.trim() || '';
                const donVi2Sub  = (document.getElementById('pdDonVi2Sub')  || {}).value?.trim() || '';
                const rotation   = parseFloat((document.getElementById('pdRotation') || {}).value) || 0;

                // Derive fallback name từ active tu filter (chỉ dùng khi user lọc đúng 1 tủ)
                const _selTu = document.getElementById('fTuDieuKhien');
                const _tuArr = _selTu ? [...(_selTu.selectedOptions || [])].map(o => o.value).filter(Boolean) : [];
                const activeTu = _tuArr.length === 1 ? _tuArr[0] : '';

                // Setup tile + zoom + chờ tile load (skip nếu đang ở preview mode — đã setup từ openPrintPreview)
                const { rows } = await _preparePrintLayout({
                    scale,
                    paper,
                    tileStyle,
                    displayMsg: 'Đang chờ bản đồ tải...',
                    skipTileSetup: _previewMode
                });
                if (rows.length === 0) { displayError('Không có dữ liệu để in.'); return; }

                // Reset pixel origin (quan trọng để tiles + markers đúng vị trí)
                // Aspect ratio đã được force trong _preparePrintLayout (khi !skipTileSetup)
                map.setView(map.getCenter(), map.getZoom(), { animate: false, reset: true });
                await new Promise(r => setTimeout(r, PRINT_CONFIG.resyncDelayMs.normal));

                // Re-apply rotation SAU setView — vì setView({reset}) ghi đè pane transform,
                // xóa mất rotation đã áp dụng trong preview
                if (rotation) {
                    _applyMapRotation(rotation);
                    await new Promise(r => setTimeout(r, PRINT_CONFIG.rotationDelayMs));
                }

                // 3. Vẽ cáp — toạ độ pre-rotated bằng toán học (không cần CSS rotate SVG)
                if (_previewMode) _removeCableLines();
                _buildPrintCableSvg(rows, rotation);
                await new Promise(r => setTimeout(r, PRINT_CONFIG.svgCableDelayMs));

                if (!_previewMode) {
                    // 4. Hiện overlay legend + title block
                    _showPrintOverlay({ rows, tenTu: tenTu || activeTu || 'Sơ đồ tuyến', scale, ngay, nguoiLap, soBanVe, tongBanVe, cvPhuTrach, csKhuVuc, donVi1, donVi2, donVi2Sub });
                    await new Promise(r => setTimeout(r, PRINT_CONFIG.overlayDelayMs));
                }

                // 5. Capture map (bao gồm SVG cáp + overlay bên trong #map)
                // Chọn scale theo priority:
                //   1. User chọn manual trong dropdown pdQuality (nếu ≠ 'auto')
                //   2. Auto: mobile/low-mem device → scale mobile, desktop → scale full
                const _isLowMemDevice = (typeof navigator !== 'undefined') && (
                    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||  // <=4GB RAM
                    (navigator.connection && navigator.connection.effectiveType === 'slow-2g')
                );
                const _userQuality = (document.getElementById('pdQuality') || {}).value || 'auto';
                let _printScale;
                let _scaleReason;
                if (_userQuality !== 'auto') {
                    _printScale = parseInt(_userQuality) || PRINT_CONFIG.captureScale;
                    _scaleReason = 'user chọn ' + _userQuality + '×';
                } else if (isMobile || _isLowMemDevice) {
                    _printScale = PRINT_CONFIG.captureScaleMobile;
                    _scaleReason = 'auto mobile/low-mem';
                } else {
                    _printScale = PRINT_CONFIG.captureScale;
                    _scaleReason = 'auto desktop';
                }
                displayInfo(`Đang chụp bản vẽ... (scale ${_printScale}× · ${_scaleReason})`);
                console.log('[print] scale =', _printScale,
                    '· reason =', _scaleReason,
                    '· isMobile =', isMobile,
                    '· deviceMemory =', (navigator.deviceMemory || 'unknown') + 'GB');
                const canvas = await window.html2canvas(mapEl, {
                    useCORS: true,
                    allowTaint: false,
                    scale: _printScale,
                    logging: false,
                    ignoreElements: el =>
                        el.classList && (
                            el.classList.contains('leaflet-control-container') ||
                            el.id === 'bottomActionBar' ||
                            el.id === 'topBar' ||
                            el.id === 'filterOverlay' ||
                            el.id === 'error'
                        )
                });

                // 6. Tạo PDF — canvas đã có đúng tỷ lệ landscape
                displayInfo('Đang tạo file PDF...');
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: paper });
                const pw = doc.internal.pageSize.getWidth();
                const ph = doc.internal.pageSize.getHeight();
                // PNG lossless → text edge sharp hơn hẳn JPEG (JPEG chroma subsampling làm chữ có halo).
                // File PDF nặng hơn ~2-3× nhưng cần thiết cho bản vẽ kỹ thuật.
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 0, 0, pw, ph, undefined, 'FAST');

                // 7. Lưu file (hoặc return Blob cho preview)
                const safeName = (tenTu || activeTu || 'sodotuyen').replace(/[^a-zA-Z0-9À-ɏḀ-ỿ\s_-]/g,'').trim().replace(/\s+/g,'-') || 'sodotuyen';
                const fileName = `${safeName}-${ngay || new Date().toISOString().slice(0,10)}.pdf`;
                if (_returnBlob) {
                    // Skip download, return Blob cho iframe preview / zip
                    window._lastPdfBlob = doc.output('blob');
                    window._lastPdfFilename = fileName;
                    displayError(`✅ PDF sẵn sàng (Blob) — ${fileName}`, 'success');
                } else {
                    doc.save(fileName);
                    displayError(`Đã xuất: ${fileName}`, 'success');
                }

            } catch (err) {
                console.error('exportDrawingPDF:', err);
                // Detect Out-Of-Memory hoặc canvas allocation failure
                var msg = String(err.message || err).toLowerCase();
                var isOOM = msg.includes('out of memory') ||
                            msg.includes('cannot allocate') ||
                            msg.includes('canvas') ||
                            msg.includes('exceeds') ||
                            msg.includes('maximum');
                if (isOOM && !window._pdfRetryLowScale) {
                    window._pdfRetryLowScale = true;
                    displayError(
                        '⚠ Máy hết bộ nhớ. Thử lại với scale thấp hơn?\n' +
                        'Nhấn OK để tự động thử lại với chất lượng thấp hơn (chữ có thể hơi bể nhưng không crash).'
                    );
                    // Fallback: giảm scale xuống 1 rồi retry
                    var oldScale = PRINT_CONFIG.captureScale;
                    var oldScaleM = PRINT_CONFIG.captureScaleMobile;
                    PRINT_CONFIG.captureScale = 1;
                    PRINT_CONFIG.captureScaleMobile = 1;
                    setTimeout(() => {
                        // Bug fix: pass opts so returnBlob:true is preserved in retry
                        exportDrawingPDF(opts).finally(() => {
                            PRINT_CONFIG.captureScale = oldScale;
                            PRINT_CONFIG.captureScaleMobile = oldScaleM;
                            window._pdfRetryLowScale = false;
                        });
                    }, 1000);
                    return;
                }
                displayError('Lỗi xuất PDF: ' + (err.message || err));
            } finally {
                // Cleanup — mỗi step độc lập, 1 fail không chặn các step khác
                const _safe = (fn, label) => { try { fn(); } catch(e) { console.warn('cleanup ' + label + ':', e); } };

                // Force close modal nếu vẫn còn open (vd user bấm Xuất PDF nhanh, error xảy ra trước modal hide)
                _safe(() => {
                    if (window.jQuery && jQuery('#printDrawingModal').hasClass('show')) {
                        jQuery('#printDrawingModal').modal('hide');
                    }
                }, 'modal-hide');

                _safe(() => _clearMapRotation(), 'clearMapRotation');
                _safe(() => _hidePrintOverlay(), 'hidePrintOverlay');
                _safe(() => _removePrintCableSvg(), 'removePrintCableSvg');
                _safe(() => _removeCableLines(), 'removeCableLines');
                _safe(() => _restoreOriginalTiles(), 'restoreOriginalTiles');
                // Restore zoomSnap nếu đã bật fractional zoom (kể cả khi đến từ preview mode)
                _safe(() => {
                    if (map && map._origZoomSnap !== undefined) {
                        map.options.zoomSnap = map._origZoomSnap;
                        delete map._origZoomSnap;
                    }
                }, 'restoreZoomSnap');

                // Luôn restore map size — kể cả khi resize từ preview mode (resized=false nhưng map đã bị co lại)
                _safe(() => {
                    if (mapEl) {
                        mapEl.style.width  = '';
                        mapEl.style.height = '';
                        if (map) map.invalidateSize({ animate: false });
                    }
                }, 'restoreMapSize');

                // Reset preview state + UI
                _safe(() => {
                    _previewMode = false;
                    _currentMapRotation = 0;
                    const bar = document.getElementById('printPreviewBar');
                    if (bar) bar.style.display = 'none';
                    const rotVal = document.getElementById('previewRotVal');
                    if (rotVal) rotVal.textContent = '0°';
                }, 'resetPreviewUI');

                // Re-enable nút Xuất PDF — luôn chạy cuối để user retry được
                _safe(() => {
                    if (exportBtn) {
                        exportBtn.disabled = false;
                        exportBtn.innerHTML = '<i class="fa fa-file-pdf-o"></i> Xuất PDF';
                    }
                }, 'resetExportBtn');
            }
        }

        let _printLibsPromise = null;

        function _loadPrintLibs() {
            const hasJsPdf = typeof window.jspdf !== 'undefined';
            const hasH2c   = typeof window.html2canvas !== 'undefined';
            if (hasJsPdf && hasH2c) return Promise.resolve();
            if (_printLibsPromise) return _printLibsPromise;

            const pending = []; // script element đang chờ load — dùng cho timeout cleanup
            const loadOne = (src) => new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                const remove = () => { if (s.parentNode) s.parentNode.removeChild(s); };
                s.onload  = () => { pending.splice(pending.indexOf(s), 1); resolve(); };
                s.onerror = () => { remove(); pending.splice(pending.indexOf(s), 1); reject(new Error('Không tải được ' + src)); };
                s._remove = remove;
                pending.push(s);
                document.head.appendChild(s);
            });

            const tasks = [];
            if (!hasJsPdf) tasks.push(loadOne('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'));
            if (!hasH2c)   tasks.push(loadOne('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'));

            _printLibsPromise = Promise.race([
                Promise.all(tasks),
                new Promise((_, reject) => setTimeout(() => {
                    // Timeout 15s — gỡ những script CHƯA load xong (`pending` đã loại bỏ những script onload thành công)
                    pending.slice().forEach(s => { try { s._remove(); } catch(e){_swallow(e);} });
                    reject(new Error('Timeout 15s khi tải thư viện in'));
                }, 15000))
            ]).catch(err => {
                _printLibsPromise = null;
                throw err;
            });

            return _printLibsPromise;
        }

        function _makeCabinetIconSvg(color, compact, type) {
            const w = compact ? 12 : 22, h = compact ? 14 : 26;
            // Type 6 (tủ ngầm): hollow dashed — matches makeCabinetIcon B&W distinction
            const body = parseInt(type) === 6
                ? `<rect x="2" y="1" width="20" height="24" rx="3" fill="white" stroke="${color}" stroke-width="2.5" stroke-dasharray="4 2"/>
                   <circle cx="12" cy="18" r="3" fill="${color}" opacity="0.7"/>`
                : `<rect x="2" y="1" width="20" height="24" rx="3" fill="${color}" stroke="white" stroke-width="2"/>
                   <line x1="2" y1="11" x2="22" y2="11" stroke="white" stroke-width="1.5" opacity="0.7"/>
                   <circle cx="12" cy="18" r="3" fill="white" opacity="0.85"/>`;
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 28">${body}</svg>`;
        }

        function _makeLampIconSvg(color, compact, type) {
            const w = compact ? 14 : 24, h = compact ? 22 : 38;
            // Lamp head shape matches makeLampIcon — type-based for B&W distinction:
            // 1: solid pill  2: hollow pill  3: solid square  4: hollow square + diagonal
            const t = parseInt(type) || 1;
            let head;
            if (t === 1)
                head = `<rect x="16" y="1.5" width="10" height="7" rx="3.5" fill="${color}"/>`;
            else if (t === 2)
                head = `<rect x="16" y="1.5" width="10" height="7" rx="3.5" fill="white" stroke="${color}" stroke-width="1.8"/>`;
            else if (t === 3)
                head = `<rect x="16" y="1.5" width="7" height="7" fill="${color}"/>`;
            else
                head = `<rect x="16" y="1.5" width="7" height="7" fill="white" stroke="${color}" stroke-width="1.8"/>` +
                       `<line x1="17" y1="2.5" x2="22" y2="7.5" stroke="${color}" stroke-width="1.2" opacity="0.9"/>`;
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 26 42">
                <rect x="10" y="18" width="4" height="24" rx="2" fill="${color}"/>
                <path d="M12 18 C12 12 15 7 22 5" stroke="${color}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
                ${head}
            </svg>`;
        }
