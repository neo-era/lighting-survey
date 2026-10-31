// Xuất bản vẽ CAD (DXF/PDF) — khung tên, ký hiệu block, chú thích, mặt bằng / nguyên lý / tổng thể, BOM, tính điện, modal xuất CAD, xem trước PDF, nhiều tờ
// Tách từ index.html (đợt 2 module hoá, v174) — chỉ cắt/dán NGUYÊN VĂN (giữ cả thụt lề), KHÔNG đổi logic.
// Classic script, nạp TẠI ĐÚNG CHỖ CŨ: khối <script> chính được ngắt thành "</script><script src=…><script>"
// nên thứ tự chạy lúc nạp giữ nguyên. Đã rà bằng parser: không đoạn nào gọi lúc nạp tới hàm khai báo ở đoạn sau
// (hàm ở file sau không còn được hoist cho file trước). Thêm code CHẠY LÚC NẠP ở đây phải rà lại điều này.

        // ═══════════════════════════════════════════════════════════════════
        // CAD GENERATOR — Phase B: Title templates + Generator + Modal (T21)
        // ═══════════════════════════════════════════════════════════════════

        // ── Title block templates ──────────────────────────────────────────
        const TITLE_TEMPLATES = {
            state: {
                label: '🏛 Nhà nước (UBND/Sở XD/TT QLGT)',
                file: 'assets/dxf-templates/title_state.dxf',
                blockName: 'TITLE_STATE',
                // P59: Khung tên đầy đủ chuẩn TCVN 7285 — 7 rows, 190×215m
                fields: [
                    // Row 1: Header dự án
                    { key: 'DU_AN',         label: 'Tên dự án',                     multiline: true, default: '' },
                    { key: 'DIA_DIEM',      label: 'Địa điểm xây dựng',             multiline: true, default: '' },
                    // Row 3: CĐT + TV
                    { key: 'CHU_DAU_TU',    label: 'Chủ đầu tư (tổ chức)',          default: 'BAN QUẢN LÝ DỰ ÁN ĐẦU TƯ XÂY DỰNG HẠ TẦNG ĐÔ THỊ' },
                    { key: 'CHU_DAU_TU_KY', label: 'Chủ đầu tư — người ký',         default: '' },
                    { key: 'TU_VAN_TK',     label: 'Tư vấn thiết kế (tổ chức)',     default: '' },
                    { key: 'TU_VAN_TK_KY',  label: 'Tư vấn thiết kế — người ký',    default: '' },
                    // Row 5: Gói thầu
                    { key: 'GOI_THAU_CODE', label: 'Mã gói thầu (VD: XL-03)',       default: '' },
                    { key: 'GOI_THAU_DOAN', label: 'Đoạn tuyến (VD: cầu A→cống B)', default: '' },
                    { key: 'KM_BAT_DAU',    label: 'Km bắt đầu (VD: K6+300)',       default: '' },
                    { key: 'KM_KET_THUC',   label: 'Km kết thúc (VD: K9+870)',      default: '' },
                    { key: 'L_TUYEN',       label: 'Chiều dài tuyến (VD: 3.570M)',  default: '' },
                    { key: 'HANG_MUC',      label: 'Hạng mục',                      default: 'CHIẾU SÁNG' },
                    { key: 'NOI_DUNG_BV',   label: 'Nội dung bản vẽ',               default: 'BÌNH ĐỒ BỐ TRÍ HỆ THỐNG CHIẾU SÁNG' },
                    // Row 6: 4 người ký
                    { key: 'CHU_NHIEM_TK',  label: 'Chủ nhiệm thiết kế',            default: '' },
                    { key: 'CHU_TRI_TK',    label: 'Chủ trì thiết kế',              default: '' },
                    { key: 'THIET_KE',      label: 'Thiết kế',                      default: '' },
                    { key: 'QLCL',          label: 'Quản lý chất lượng',            default: '' },
                    // Row 7: SHBV pattern (XX = sheet index auto-replace)
                    { key: 'SHBV_PATTERN',  label: 'SHBV pattern (VD: 22-TLBC-03-07-XX)', default: '22-TLBC-03-07-XX' },
                    // Row 9: Footer LIÊN DANH
                    { key: 'LIEN_DANH',     label: 'Liên danh (footer)',            default: 'Công ty TNHH Tư vấn Xây dựng Hưng Nghiệp' },
                    // Common
                    { key: 'NGAY',          label: 'Ngày',                          default: () => new Date().toLocaleDateString('vi-VN') },
                    { key: 'TI_LE',         label: 'Tỉ lệ',                         default: '1:1000' },
                ]
            },
            // P59 v3: Kiểu 2 — Horizontal strip đáy (chuẩn công ty tư vấn điện lực VN)
            dienluc: {
                label: '⚡ Tư vấn điện lực (strip đáy)',
                file: 'assets/dxf-templates/title_state.dxf',   // reuse — không dùng INSERT block
                blockName: 'TITLE_STATE',
                fields: [
                    // Left column: header
                    { key: 'HANG_MUC',        label: 'Hạng mục',                     default: '' },
                    { key: 'DU_AN',           label: 'Dự án',                        multiline: true, default: '' },
                    { key: 'DIA_DIEM',        label: 'Địa điểm',                     multiline: true, default: '' },
                    // Logo column: company
                    { key: 'CONG_TY_TEN',     label: 'Tên công ty (đơn vị TK)',      multiline: true, default: 'CÔNG TY TNHH TV DV XD ĐIỆN PHƯỚC THỊNH' },
                    { key: 'CONG_TY_DIA_CHI', label: 'Địa chỉ công ty (line 1)',     default: '38 Thạnh Xuân 18, P. Thạnh Xuân, Q.12, TP.HCM' },
                    { key: 'CONG_TY_TEL',     label: 'Điện thoại/Fax',               default: 'TEL: (028) 66.533.215 - FAX: (028) 62.565.526' },
                    // Chức danh table (4 rows)
                    { key: 'CT_KS_NAME',      label: 'Chủ trì khảo sát — họ tên',    default: '' },
                    { key: 'CT_TK_NAME',      label: 'Chủ trì thiết kế — họ tên',    default: '' },
                    { key: 'CN_TK_NAME',      label: 'Chủ nhiệm thiết kế — họ tên',  default: '' },
                    { key: 'GIAM_DOC_NAME',   label: 'Giám đốc — họ tên',            default: '' },
                    // Right column: meta bản vẽ
                    { key: 'TEN_BAN_VE',      label: 'Tên bản vẽ',                   multiline: true, default: 'BẢN VẼ MẶT BẰNG HIỆN HỮU - TÁI BỐ TRÍ' },
                    { key: 'BUOC',            label: 'Bước (VD: BCNCKT)',            default: 'BCNCKT' },
                    { key: 'TI_LE',           label: 'Tỷ lệ',                        default: '1/1000' },
                    { key: 'KY_HIEU',         label: 'Ký hiệu (VD: /PTEC-BCNCKT)',   default: '/PTEC-BCNCKT' },
                    { key: 'NGAY',            label: 'Ngày',                         default: () => new Date().toLocaleDateString('vi-VN') },
                    { key: 'SO_BAN_VE',       label: 'Số bản vẽ (VD: /2026)',        default: '/' + new Date().getFullYear() },
                    { key: 'LAN_XUAT',        label: 'Lần xuất (VD: 01)',            default: '01' },
                ]
            },
            consulting: {
                label: '🏢 Tư vấn thiết kế',
                file: 'assets/dxf-templates/title_consulting.dxf',
                blockName: 'TITLE_CONSULTING',
                fields: [
                    { key: 'CHU_DAU_TU', label: 'Chủ đầu tư',   default: '' },
                    { key: 'DON_VI_TK',  label: 'Đơn vị thiết kế', default: '' },
                    { key: 'CHU_NHIEM',  label: 'Chủ nhiệm',    default: '' },
                    { key: 'KS_TK',      label: 'KS thiết kế',  default: '' },
                    { key: 'NGUOI_VE',   label: 'Người vẽ',     default: '' },
                    { key: 'KIEM_TRA',   label: 'Kiểm tra',     default: '' },
                    { key: 'NGAY',       label: 'Ngày',         default: () => new Date().toLocaleDateString('vi-VN') },
                    { key: 'TI_LE',      label: 'Tỉ lệ',        default: '1:1000' },
                ]
            },
            contractor: {
                label: '🏗 Nhà thầu thi công',
                file: 'assets/dxf-templates/title_contractor.dxf',
                blockName: 'TITLE_CONTRACTOR',
                fields: [
                    { key: 'BEN_A',        label: 'Bên A (Chủ đầu tư)',    default: '' },
                    { key: 'BEN_B',        label: 'Bên B (Nhà thầu)',      default: '' },
                    { key: 'GIAM_SAT',     label: 'Giám sát',              default: '' },
                    { key: 'KT_THI_CONG',  label: 'KT thi công',           default: '' },
                    { key: 'NGAY_DUYET',   label: 'Ngày duyệt',            default: () => new Date().toLocaleDateString('vi-VN') },
                    { key: 'TI_LE',        label: 'Tỉ lệ',                 default: '1:1000' },
                ]
            },
            // Kiểu 3 — Khung tên mẫu QBT 2026–2029 (CTCP CSCC TP.HCM) — id giữ 'knop12' để bản nháp cũ dùng tiếp.
            // Vẽ bằng src/core/cad-titleblock-qbt.js (đo từ bản vẽ QBT). Xem docs/design-titleblock-qbt.md.
            knop12: {
                label: '🏙 Nhà nước — mẫu QBT 2026–2029 (CTCP CSCC)',
                file: 'assets/dxf-templates/title_state.dxf',   // unused — inline render
                blockName: 'TITLE_STATE',
                fields: [
                    { key: 'TT_QLGT_NAME',  label: 'Tên Trung tâm (xuống dòng = Enter)', default: 'TT QUẢN LÝ HẠ TẦNG\nKỸ THUẬT TP.HCM', multiline: true },
                    { key: 'CV_PHU_TRACH',  label: 'Chức danh ký (ô Trung tâm)',      default: 'CHUYÊN VIÊN PHỤ TRÁCH ĐỊA BÀN' },
                    { key: 'NV_TT_QLGT',    label: 'Người ký — Trung tâm',            default: '' },
                    { key: 'CTCP_NAME',     label: 'Tên Công ty (xuống dòng = Enter)', default: 'CÔNG TY CỔ PHẦN\nCHIẾU SÁNG CÔNG CỘNG TP.HCM', multiline: true },
                    { key: 'CS_KHU_VUC',    label: 'Chức danh ký (ô Công ty)',        default: 'CHIẾU SÁNG KHU VỰC TRUNG TÂM' },
                    { key: 'NV_CTCP',       label: 'Người ký — Công ty',              default: '' },
                    { key: 'NGUOI_LAP',     label: 'Người lập',                       default: '' },
                    { key: 'TIEU_DE_BV',    label: 'Tên bản vẽ',                      default: 'BẢN VẼ SƠ ĐỒ TUYẾN TRẠM ĐÈN HỆ THỐNG CHIẾU SÁNG ĐÔ THỊ' },
                    { key: 'TEN_BAN_VE',    label: 'Tên tủ điều khiển',               default: '' },
                    { key: 'DIA_CHI',       label: 'Tên đường',                       default: '' },
                    { key: 'SHBV_PATTERN',  label: 'SHBV (XX = số tờ tự điền)',       default: '' },
                    { key: 'SO_SOAT_XET',   label: 'Số soát xét',                     default: '' },
                    { key: 'BAN_VE_SO',     label: 'Bản vẽ số',                       default: '' },
                    { key: 'NGAY',          label: 'Ngày',                            default: () => new Date().toLocaleDateString('vi-VN') },
                ]
            }
        };

        // _extractAttdefs → src/core/dxf-utils.js

        // Load title template — cached
        const _titleTemplateCache = {};
        async function _loadTitleTemplate(templateId) {
            if (_titleTemplateCache[templateId]) return _titleTemplateCache[templateId];
            const tpl = TITLE_TEMPLATES[templateId];
            if (!tpl) throw new Error(`Unknown template: ${templateId}`);
            const res = await fetch(tpl.file);
            if (!res.ok) throw new Error(`Fetch ${tpl.file} failed: ${res.status}`);
            const text = await res.text();
            const blockDef = _extractDxfBlock(text, tpl.blockName);
            if (!blockDef) throw new Error(`Block ${tpl.blockName} not found`);
            const attdefs = _extractAttdefs(blockDef);
            _titleTemplateCache[templateId] = { blockDef, attdefs, template: tpl };
            return _titleTemplateCache[templateId];
        }

        // ── Unique values helpers cho filter picker ───────────────────────
        function _getUniqueBasenames() {
            const s = new Set();
            (loadedData || []).slice(1).forEach(r => {
                const b = normalizeMarkerBaseName(String(r[1] || '').trim());
                if (b) s.add(b);
            });
            return [...s].sort();
        }
        function _getUniqueSurveyors() {
            const s = new Set();
            (loadedData || []).slice(1).forEach(r => {
                const v = String(r[5] || '').trim();
                if (v) s.add(v);
            });
            return [...s].sort();
        }
        function _getUniquePhuongXa() {
            const s = new Set();
            (loadedData || []).slice(1).forEach(r => {
                const v = String(r[18] || '').trim();
                if (v) s.add(v);
            });
            return [...s].sort();
        }

        // Filter rows theo 4 dimensions AND
        function _filterRowsForCadExport(filters) {
            const rows = (loadedData || []).slice(1);
            const tuSet = new Set(filters.tus || []);
            const bnSet = new Set(filters.basenames || []);
            const ksSet = new Set(filters.nguoiKS || []);
            const pxSet = new Set(filters.phuongXa || []);
            return rows.filter(r => {
                if (tuSet.size && !tuSet.has(String(r[7] || '').trim())) return false;
                if (bnSet.size && !bnSet.has(normalizeMarkerBaseName(String(r[1] || '').trim()))) return false;
                if (ksSet.size && !ksSet.has(String(r[5] || '').trim())) return false;
                if (pxSet.size && !pxSet.has(String(r[18] || '').trim())) return false;
                return true;
            });
        }

        // ── Offset presets — 2 tier: LOCAL (localStorage) + SHARED (GAS sheet OffsetPresets) ──
        // - Shared: cache localStorage `cad_offset_presets_shared` TTL 5 phút, fetch qua GAS action list_presets
        // - Local:  localStorage `cad_offset_presets_local` — mỗi user quản riêng, không share
        // - Merge: shared trước, local sau. Preset có source='shared' hoặc 'local'

        const _PRESETS_SHARED_TTL_MS = 5 * 60 * 1000; // 5 phút

        function _getLocalPresets() {
            try {
                const raw = localStorage.getItem('cad_offset_presets_local');
                if (raw) return JSON.parse(raw);
            } catch(e){_swallow(e);}
            return [];
        }

        function _getSharedPresetsCache() {
            try {
                const raw = localStorage.getItem('cad_offset_presets_shared');
                if (!raw) return null;
                return JSON.parse(raw);
            } catch (_) { return null; }
        }

        function _setSharedPresetsCache(presets) {
            try {
                localStorage.setItem('cad_offset_presets_shared', JSON.stringify({
                    fetchedAt: Date.now(),
                    presets: presets
                }));
            } catch(e){_swallow(e);}
        }

        // Default seed cho shared khi chưa fetch bao giờ (dùng cho offline / GAS chưa deploy)
        const _SEEDED_SHARED = [
            { id: 'vn2000_std', name: '🌍 VN2000 chuẩn quốc gia', region: 'Toàn quốc', dE: 0, dN: 0, cm: 105.75, k0: 0.9999, verify: 'Không offset — báo cáo nhà nước', createdBy: 'system' },
            { id: 'tham_luong', name: '📍 Tham Lương', region: 'Bình Tân, TPHCM', dE: -391.75, dN: 223.86, cm: 105.75, k0: 0.9999, verify: '10 điểm C1.01-C1.10 sai lệch 0.000m', createdBy: 'system' }
        ];

        // Synchronous get — merge shared cache + local. Không fetch GAS ở đây (đó là _syncSharedPresets).
        function _getCadOffsetPresets() {
            const shared = _getSharedPresetsCache();
            const sharedList = (shared && shared.presets) ? shared.presets : _SEEDED_SHARED;
            const local = _getLocalPresets();
            // Tag source
            const tagged = [
                ...sharedList.map(p => ({ ...p, source: 'shared' })),
                ...local.map(p => ({ ...p, source: 'local' }))
            ];
            // BACKWARD-COMPAT: đọc key cũ `cad_offset_presets` (từ P45/P49) → migrate về local
            try {
                const legacy = localStorage.getItem('cad_offset_presets');
                if (legacy) {
                    const arr = JSON.parse(legacy);
                    const seededIds = new Set(_SEEDED_SHARED.map(p => p.id));
                    const userOnly = arr.filter(p => !seededIds.has(p.id));
                    if (userOnly.length > 0 && local.length === 0) {
                        try { localStorage.setItem('cad_offset_presets_local', JSON.stringify(userOnly)); } catch(e){_swallow(e);}
                        userOnly.forEach(p => tagged.push({ ...p, source: 'local' }));
                    }
                    localStorage.removeItem('cad_offset_presets');
                }
            } catch(e){_swallow(e);}
            return tagged;
        }

        // Async fetch từ GAS + cache 5 phút. Gọi sau login + khi mở modal có preset.
        async function _syncSharedPresets(force) {
            const cached = _getSharedPresetsCache();
            if (!force && cached && (Date.now() - cached.fetchedAt) < _PRESETS_SHARED_TTL_MS) {
                return cached.presets;
            }
            try {
                const res = await fetch(KHAOSAT_GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'list_presets' })
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const json = await res.json();
                if (json.status === 'ok' && Array.isArray(json.presets)) {
                    _setSharedPresetsCache(json.presets);
                    return json.presets;
                }
                throw new Error(json.message || 'GAS response invalid');
            } catch (err) {
                console.warn('[Preset sync] Không fetch được shared presets:', err.message);
                return (cached && cached.presets) || _SEEDED_SHARED;
            }
        }
        window._syncSharedPresets = _syncSharedPresets;

        // Save preset: mode='local' hoặc 'shared'. Shared cần admin credentials.
        // Return preset object (đã stamp id/createdAt/source).
        async function _saveCadOffsetPreset(preset, mode) {
            mode = mode || 'local';
            if (mode === 'shared') {
                // Cần admin. Kiểm tra role client-side trước; nếu không admin → downgrade sang local.
                if (!currentUser || currentUser.role !== 'admin') {
                    displayError && displayError('Chỉ admin mới lưu shared preset. Sẽ lưu local.');
                    mode = 'local';
                }
            }
            if (mode === 'shared') {
                if (!preset.id) preset.id = 'usr_' + Date.now();
                if (!preset.createdAt) preset.createdAt = new Date().toISOString();
                preset.createdBy = currentUser.username;
                try {
                    const adminAuth = await _getAdminAuth();  // reuse admin cred từ P26 admin user mgmt
                    if (!adminAuth) throw new Error('Cần nhập lại mật khẩu admin để lưu shared');
                    const res = await fetch(KHAOSAT_GAS_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'save_preset', preset, adminAuth })
                    });
                    const json = await res.json();
                    if (json.status !== 'ok') throw new Error(json.message || 'GAS error');
                    // Invalidate cache → force reload
                    await _syncSharedPresets(true);
                    return { ...preset, source: 'shared' };
                } catch (err) {
                    displayError && displayError('Lỗi lưu shared: ' + err.message);
                    // Fallback: lưu local
                    mode = 'local';
                }
            }
            // Local save
            const local = _getLocalPresets();
            if (preset.id) {
                const idx = local.findIndex(p => p.id === preset.id);
                if (idx >= 0) local[idx] = preset;
                else local.push(preset);
            } else {
                preset.id = 'usr_' + Date.now();
                local.push(preset);
            }
            try { localStorage.setItem('cad_offset_presets_local', JSON.stringify(local)); } catch(e){_swallow(e);}
            return { ...preset, source: 'local' };
        }

        // Delete preset — nếu source='shared' cần admin.
        async function _deleteCadOffsetPreset(id, source) {
            if (source === 'shared') {
                if (!currentUser || currentUser.role !== 'admin') {
                    displayError && displayError('Chỉ admin mới xóa shared preset');
                    return false;
                }
                if (id === 'vn2000_std' || id === 'tham_luong') {
                    displayError && displayError('Không thể xóa preset mặc định hệ thống');
                    return false;
                }
                try {
                    const adminAuth = await _getAdminAuth();
                    if (!adminAuth) return false;
                    const res = await fetch(KHAOSAT_GAS_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'delete_preset', id, adminAuth })
                    });
                    const json = await res.json();
                    if (json.status !== 'ok') throw new Error(json.message || 'GAS error');
                    await _syncSharedPresets(true);
                    return true;
                } catch (err) {
                    displayError && displayError('Lỗi xóa shared: ' + err.message);
                    return false;
                }
            }
            // Local delete
            const local = _getLocalPresets().filter(p => p.id !== id);
            try { localStorage.setItem('cad_offset_presets_local', JSON.stringify(local)); } catch(e){_swallow(e);}
            return true;
        }
        window._deleteCadOffsetPreset = _deleteCadOffsetPreset;

        // Helper: get admin credentials — reuse pattern từ admin user management (nếu chưa có, prompt)
        // Cache trong tab-scoped variable (cleared on reload/logout, not readable by external JS)
        // Security fix: sessionStorage stores plaintext password accessible to any same-origin script
        let _adminAuthCached = null;
        async function _getAdminAuth() {
            if (_adminAuthCached) return _adminAuthCached;
            if (!currentUser || currentUser.role !== 'admin') return null;
            const pwd = prompt(`Xác nhận mật khẩu admin cho ${currentUser.username}:`);
            if (!pwd) return null;
            _adminAuthCached = { username: currentUser.username, password: pwd };
            return _adminAuthCached;
        }

        // ── Filter persistence localStorage ───────────────────────────────
        function _saveCadExportFilters(filters) {
            try { localStorage.setItem('cad_export_filters', JSON.stringify(filters)); } catch(e){_swallow(e);}
        }
        function _restoreCadExportFilters() {
            try {
                const raw = localStorage.getItem('cad_export_filters');
                if (raw) return JSON.parse(raw);
            } catch(e){_swallow(e);}
            return { tus: [], basenames: [], nguoiKS: [], phuongXa: [] };
        }

        // ── Lazy load JSZip ───────────────────────────────────────────────
        let _jsZipCache = null;
        async function _loadJSZip() {
            if (_jsZipCache) return _jsZipCache;
            const mod = await import('https://esm.sh/jszip@3.10.1');
            _jsZipCache = mod.default || mod.JSZip || mod;
            return _jsZipCache;
        }

        // ═══════════════════════════════════════════════════════════════════
        // Main generator: _generateCadDrawing(opts)
        // ═══════════════════════════════════════════════════════════════════
        // Tương thích AutoCAD 2021.
        // Các hàm _draw*Symbol dưới đây sinh entity primitives (CIRCLE + LINE + ARC + SOLID).
        // Chúng KHÔNG ghi thẳng vào ENTITIES nữa: _generateCadDrawing gọi chúng một lần cho
        // mỗi (type,state) tại gốc (0,0) để tạo định nghĩa BLOCK, rồi INSERT tại từng vị trí.
        // Lưu ý lịch sử: v70 từng bỏ BLOCK vì đọc file assets/dxf-blocks/*.dxf bị lỗi parse.
        // Vấn đề nằm ở khâu đọc file asset, không phải ở cơ chế BLOCK — nay block được sinh
        // trực tiếp từ code (giống TITLE_KNOP12) nên không còn phụ thuộc file ngoài.

        // ─────────────────────────────────────────────────────────────
        // P59+: CAD_SYMBOLS library — vẽ marker theo trạng thái cải tạo
        // Reference: kyhieu.pdf — 24 symbols chuẩn bản vẽ cải tạo VN
        // Approach: direct primitives (R12 compat), không dùng DXF BLOCK
        // ─────────────────────────────────────────────────────────────

        // ─────────────────────────────────────────────────────────────
        // HEADER khung nhìn — để AutoCAD mở ra là thấy nội dung ngay.
        // $EXTMIN/$EXTMAX chỉ là PHẠM VI bản vẽ (lệnh ZOOM Extents dùng), KHÔNG phải
        // khung nhìn khi mở. Khung nhìn lấy từ $VIEWCTR (tâm) + $VIEWSIZE (chiều cao).
        // Thiếu chúng, AutoCAD mở ở gốc (0,0) trong khi bản vẽ nằm ở ~600.000/1.200.000
        // (VN-2000) → màn hình trống trơn.
        // Trả về mảng group-code để ghép vào HEADER.
        // ─────────────────────────────────────────────────────────────
        function _dxfHeaderView(bounds, margin) {
            const m = margin || 0;
            const minX = bounds.minX - m, maxX = bounds.maxX + m;
            const minY = bounds.minY - m, maxY = bounds.maxY + m;
            const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
            // $VIEWSIZE là chiều CAO khung nhìn. Cửa sổ CAD luôn rộng hơn cao; giả định
            // tỉ lệ tối thiểu 1.4 (≈A3 ngang) để bề ngang bản vẽ không bị cắt trên màn hẹp.
            const viewH = Math.max(h, w / 1.4) * 1.04;   // +4% cho thoáng mép
            return [
                '9', '$EXTMIN',  '10', minX.toFixed(4), '20', minY.toFixed(4), '30', '0',
                '9', '$EXTMAX',  '10', maxX.toFixed(4), '20', maxY.toFixed(4), '30', '0',
                '9', '$LIMMIN',  '10', minX.toFixed(4), '20', minY.toFixed(4),
                '9', '$LIMMAX',  '10', maxX.toFixed(4), '20', maxY.toFixed(4),
                '9', '$VIEWCTR', '10', cx.toFixed(4),   '20', cy.toFixed(4),
                '9', '$VIEWSIZE','40', viewH.toFixed(4),
                '9', '$INSUNITS','70', '6'
            ];
        }

        // v163 — Bảng VPORT *ACTIVE: AutoCAD (đã thử 2021) dùng bảng này để đặt khung nhìn khi MỞ file, bỏ qua
        // $VIEWCTR/$VIEWSIZE ở HEADER. Thiếu bảng → mặc định tâm (0,0) cao 1000 → màn hình trống vì bản vẽ ở
        // toạ độ VN-2000 ~600 000 / 1 200 000. Chèn làm bảng ĐẦU TIÊN của section TABLES (đúng thứ tự R12).
        function _dxfActiveVport(bounds, margin) {
            const m = margin || 0;
            const minX = bounds.minX - m, maxX = bounds.maxX + m, minY = bounds.minY - m, maxY = bounds.maxY + m;
            const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
            const viewH = Math.max(h, w / 1.4) * 1.04;   // giống _dxfHeaderView: màn hẹp nhất ~1.4 vẫn thấy đủ bề ngang
            const f = v => Number(v).toFixed(4);
            return ['0', 'TABLE', '2', 'VPORT', '70', '1',
                '0', 'VPORT', '2', '*ACTIVE', '70', '0',
                '10', '0.0', '20', '0.0', '11', '1.0', '21', '1.0',
                '12', f((minX + maxX) / 2), '22', f((minY + maxY) / 2),
                '13', '0.0', '23', '0.0', '14', '1.0', '24', '1.0', '15', '1.0', '25', '1.0',
                '16', '0.0', '26', '0.0', '36', '1.0', '17', '0.0', '27', '0.0', '37', '0.0',
                '40', f(viewH), '41', '1.6', '42', '50.0', '43', '0.0', '44', '0.0', '50', '0.0', '51', '0.0',
                '71', '0', '72', '100', '73', '1', '74', '3', '75', '0', '76', '0', '77', '0', '78', '0',
                '0', 'ENDTAB'];
        }
        function _dxfInjectActiveVport(L, bounds, margin) {
            if (!bounds || !isFinite(bounds.minX) || !isFinite(bounds.maxX)) return;
            for (let i = 0; i + 3 < L.length; i++) {
                if (L[i] === '0' && L[i + 1] === 'SECTION' && L[i + 2] === '2' && L[i + 3] === 'TABLES') {
                    L.splice(i + 4, 0, ..._dxfActiveVport(bounds, margin));
                    return;
                }
            }
        }

        // Key duy nhất cho state (dùng cho legend detection)
        function _stateKey(type, state) {
            const isCabinet = (type === 5 || type === 6);
            if (isCabinet) return 'cab';   // v165 — mọi tủ chung block SYM_CAB
            return 'pole_' + (state || 'giu');
        }

        // Label ngắn Vietnamese cho legend
        const _STATE_LABELS = {
            'pole_giu':         'Đèn chiếu sáng hiện hữu giữ nguyên',
            'pole_thu':         'Đèn chiếu sáng hiện hữu thu hồi',
            'pole_thu_can':     'Đèn hiện hữu + cần đèn được thu hồi',
            'pole_thu_udc':     'Đèn hiện hữu + UDC thu hồi',
            'pole_thu_can_udc': 'Đèn hiện hữu + cần đèn + UDC thu hồi',
            'pole_moi_led':     'Bộ đèn LED + cần + trụ STK lắp mới',
            'pole_moi_led_thay':'LED thay HPS trên trụ STK hiện hữu',
            'pole_thao_lap':    'Trụ tháo gỡ, lắp đặt lại',
            'cab':              'Tủ điều khiển chiếu sáng',
            'cab_giu':          'TĐK chiếu sáng hiện hữu giữ nguyên',
            'cab_thu':          'TĐK chiếu sáng thu hồi',
            'cab_moi_led':      'TĐK chiếu sáng lắp mới',
            'cab_thao_lap':     'Bộ kết nối DCM tháo gỡ, lắp đặt lại',
            // Chi tiết TCVN lắp mới (6 icons)
            'pole_moi_stk_170w':  'TRỤ ĐÈN CAO 12M LẮP BỘ ĐÈN LED 170W',
            'pole_moi_stk_tuong': 'TRỤ ĐÈN CAO 12M LẮP BỘ ĐÈN LED 170W (TRÊN TƯỜNG CHẮN)',
            'pole_moi_dacau':     'BỘ ĐÈN PHA LED 40W CHIẾU SÁNG DẠ CẦU',
            'pole_moi_6m_2x60w':  'TRỤ ĐÈN CAO 6M LẮP 2 BỘ ĐÈN PHA LED 60W',
            'cab_moi_plc50a':     'TỦ ĐIỀU KHIỂN CHIẾU SÁNG PLC-50A',
            'pole_moi_tiepdia':   'CỌC TIẾP ĐỊA',
            // v152 — block đèn xoay theo hướng đường
            'pole_lamp1': 'Trụ đèn 1 bóng',
            'pole_lamp2': 'Trụ đèn 2 bóng',
            'pole_lamp3': 'Trụ đèn 3 bóng',
            'pole_lamp4': 'Trụ đèn 4 bóng'
        };

        // ─── Block đèn xoay theo hướng đường OSM (v152) — docs/design-road-oriented-lamp-block.md ───
        // Marker @@ROADLAMP_* để tests/road-lamp-block.test.js trích các hàm thuần này ra chạy bằng Node.
        // @@ROADLAMP_START
        // highway=construction GIỮ LẠI: tuyến mới thi công chính là nơi lắp đèn (VD khu J3/J4 DanhSachTru: 131/134 trụ)
        const _RL_NON_DRIVABLE = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway',
            'track', 'bridleway', 'corridor', 'proposed', 'elevator', 'platform']);
        function _rlIsDrivable(tags) {
            const h = tags && tags.highway;
            if (!h || _RL_NON_DRIVABLE.has(h)) return false;
            // Hẻm thường là highway=service → giữ; chỉ bỏ lối bãi xe / lối vào nhà
            if (h === 'service' && ['parking_aisle', 'driveway', 'drive-through'].includes(tags.service)) return false;
            return true;
        }
        // Lưới chỉ mục đoạn thẳng (mét) để tìm đoạn gần nhất nhanh khi có hàng nghìn trụ
        function _rlBuildIndex(segs, cell) {
            const grid = new Map();
            segs.forEach((s, i) => {
                const i0 = Math.floor(Math.min(s.x1, s.x2) / cell), i1 = Math.floor(Math.max(s.x1, s.x2) / cell);
                const j0 = Math.floor(Math.min(s.y1, s.y2) / cell), j1 = Math.floor(Math.max(s.y1, s.y2) / cell);
                for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) {
                    const k = a + ',' + b;
                    if (!grid.has(k)) grid.set(k, []);
                    grid.get(k).push(i);
                }
            });
            return { segs, grid, cell };
        }
        function _rlNearest(px, py, index, maxDist) {
            const { segs, grid, cell } = index;
            const r = Math.ceil(maxDist / cell);
            const ci = Math.floor(px / cell), cj = Math.floor(py / cell);
            const seen = new Set();
            let best = null;
            for (let a = ci - r; a <= ci + r; a++) for (let b = cj - r; b <= cj + r; b++) {
                const list = grid.get(a + ',' + b);
                if (!list) continue;
                for (const i of list) {
                    if (seen.has(i)) continue;
                    seen.add(i);
                    const s = segs[i];
                    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
                    const len2 = dx * dx + dy * dy;
                    if (len2 < 1e-9) continue;
                    const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / len2));
                    const qx = s.x1 + t * dx, qy = s.y1 + t * dy;
                    const d = Math.hypot(px - qx, py - qy);
                    if (d <= maxDist && (!best || d < best.dist)) {
                        best = { dist: d, qx, qy, ang: Math.atan2(dy, dx) * 180 / Math.PI };
                    }
                }
            }
            return best;
        }
        // Góc INSERT (độ, ngược chiều kim đồng hồ). Block cục bộ: X = hướng đường, đèn vươn theo ±Y.
        function _rlRotation(px, py, n, near, parent) {
            const axis = a => { let r = ((a % 180) + 180) % 180; return r > 90 ? r - 180 : r; };  // về (-90, 90]
            if (near) {
                if (n === 1 && near.dist >= 0.3) {
                    return Math.atan2(near.qy - py, near.qx - px) * 180 / Math.PI - 90;  // đèn quay về phía đường
                }
                return axis(near.ang);
            }
            if (parent) {
                const dx = px - parent.x, dy = py - parent.y;
                if (Math.hypot(dx, dy) < 1e-6) return 0;
                return axis(Math.atan2(dy, dx) * 180 / Math.PI);  // tuyến cáp xem như hướng đường
            }
            return 0;
        }
        function _rlLampDirs(n) {
            const k = Math.min(4, Math.max(1, parseInt(n) || 1));
            return [[0, 1], [0, -1], [1, 0], [-1, 0]].slice(0, k);
        }
        // Vẽ block đèn tại (x,y), hướng cục bộ (chưa xoay — INSERT lo phần xoay)
        function _rlDrawLampBlock(push, x, y, n, scale) {
            const s = scale || 1;
            const half = 0.9 * s, circR = 0.6 * s, armEnd = 1.4 * s, ry = 1.4 * s, rx = 0.8 * s;
            const P = v => v.toFixed(4);
            const line = (x1, y1, x2, y2) => push('0', 'LINE', '8', '0',
                '10', P(x1), '20', P(y1), '30', '0', '11', P(x2), '21', P(y2), '31', '0');
            // Ô vuông + tròn (trụ)
            line(x - half, y - half, x + half, y - half);
            line(x + half, y - half, x + half, y + half);
            line(x + half, y + half, x - half, y + half);
            line(x - half, y + half, x - half, y - half);
            push('0', 'CIRCLE', '8', '0', '10', P(x), '20', P(y), '30', '0', '40', P(circR));
            const SEG = 24, FILL_STEP = 15;
            for (const [dx, dy] of _rlLampDirs(n)) {
                const ux = -dy, uy = dx;  // vuông góc hướng cần
                line(x + dx * half, y + dy * half, x + dx * armEnd, y + dy * armEnd);  // cần đèn
                const cx = x + dx * (armEnd + ry), cy = y + dy * (armEnd + ry);
                const pt = deg => {
                    const t = deg * Math.PI / 180;
                    return [cx + dx * ry * Math.cos(t) + ux * rx * Math.sin(t),
                            cy + dy * ry * Math.cos(t) + uy * rx * Math.sin(t)];
                };
                for (let i = 0; i < SEG; i++) {  // viền ellipse
                    const [ax, ay] = pt(i * 360 / SEG), [bx, by] = pt((i + 1) * 360 / SEG);
                    line(ax, ay, bx, by);
                }
                // Nửa xa trụ tô đen: quạt tam giác SOLID (đỉnh 3 = đỉnh 4)
                for (let t = -90; t < 90; t += FILL_STEP) {
                    const [ax, ay] = pt(t), [bx, by] = pt(t + FILL_STEP);
                    push('0', 'SOLID', '8', '0',
                        '10', P(cx), '20', P(cy), '30', '0',
                        '11', P(ax), '21', P(ay), '31', '0',
                        '12', P(bx), '22', P(by), '32', '0',
                        '13', P(bx), '23', P(by), '33', '0');
                }
            }
        }
        // @@ROADLAMP_END

        // ─── Căn thẳng tuyến đèn theo tim đường OSM (v158) — docs/design-align-poles-road.md ───
        // Marker @@ROADALIGN_* để tests/align-poles-road.test.js trích các hàm thuần này ra chạy bằng Node.
        // @@ROADALIGN_START
        const RA_MAX_DIST = 30;   // trụ cách tim > 30m → coi như không thuộc đường này
        const RA_MAX_MOVE = 10;   // dời > 10m → bỏ tick sẵn, để người dùng tự quyết
        // Phép chiếu phẳng cục bộ (mét) quanh 1 điểm — đủ chính xác cho tuyến vài trăm mét, nghịch đảo đúng
        function _raLocalFrame(lat0, lon0) {
            // Bán kính cong WGS84 tại vĩ độ lat0: kinh tuyến (M) và vòng thẳng đứng (N)
            const a = 6378137, e2 = 0.00669437999014, rad = Math.PI / 180;
            const s2 = Math.sin(lat0 * rad) ** 2, w = 1 - e2 * s2;
            const ky = a * (1 - e2) / Math.pow(w, 1.5) * rad;
            const kx = a / Math.sqrt(w) * Math.cos(lat0 * rad) * rad;
            return {
                toXY: (lat, lon) => ({ x: (lon - lon0) * kx, y: (lat - lat0) * ky }),
                toLL: (x, y) => ({ lat: lat0 + y / ky, lon: lon0 + x / kx })
            };
        }
        // Đường xe chạy → polyline mét, nhóm theo tên. Way cùng tên vẽ ngược chiều way dài nhất thì đảo lại,
        // để "bên trái/phải đường" nhất quán trên cả tuyến.
        const RA_NODE_EPS = 0.5;  // 2 đầu way cách < 0.5m coi là cùng 1 nút OSM
        // Nhóm theo tên. Way KHÔNG tên chỉ gộp khi nối tiếp đầu–cuối tại nút đúng 2 way (hẻm OSM hay cắt nhiều way;
        // không gộp qua ngã ba để nhánh rẽ không thành cùng tuyến).
        // Hướng: đi theo liên thông đầu/cuối (đúng cả với tuyến chữ U, đường đôi tách nhập); thành phần rời mới
        // dùng vector so với way dài nhất. freeStart/freeEnd = đầu mút không nối way cùng nhóm (đường cụt, đổi tên).
        function _raRoadLines(roads, frame) {
            const same = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) <= RA_NODE_EPS;
            const first = l => l.pts[0], last = l => l.pts[l.pts.length - 1];
            const raw = [];
            (roads || []).forEach((r, i) => {
                if (!r || !Array.isArray(r.coords) || r.coords.length < 2 || !_rlIsDrivable(r.tags)) return;
                const pts = [];
                r.coords.forEach(c => { const p = frame.toXY(c[1], c[0]); if (!pts.length || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 1e-6) pts.push(p); });
                if (pts.length < 2) return;
                // Bề rộng mặt đường cùng quy tắc lớp mép đường DXF (tag width → lanes×3.5 → theo cấp đường)
                const width = typeof _osmRoadWidth === 'function' ? _osmRoadWidth(r.tags) : 6;
                raw.push({ i, name: (r.tags && r.tags.name) || null, pts, width });
            });
            const degree = p => raw.reduce((n, l) => n + (same(first(l), p) ? 1 : 0) + (same(last(l), p) ? 1 : 0), 0);
            // Union-find cho way không tên
            const parent = raw.map((_, k) => k);
            const find = k => (parent[k] === k ? k : (parent[k] = find(parent[k])));
            raw.forEach((a, ka) => {
                if (a.name) return;
                raw.forEach((b, kb) => {
                    if (kb <= ka || b.name) return;
                    const shared = [first(a), last(a)].find(p => same(p, first(b)) || same(p, last(b)));
                    if (shared && degree(shared) === 2) parent[find(kb)] = find(ka);
                });
            });
            const lines = raw.map((l, k) => ({ key: l.name || ('way#' + raw[find(k)].i), pts: l.pts, width: l.width }));
            const byKey = new Map();
            lines.forEach(l => { if (!byKey.has(l.key)) byKey.set(l.key, []); byKey.get(l.key).push(l); });
            byKey.forEach(group => {
                const vec = l => ({ x: last(l).x - first(l).x, y: last(l).y - first(l).y });
                const lenOf = l => l.pts.reduce((s, p, k) => (k ? s + Math.hypot(p.x - l.pts[k - 1].x, p.y - l.pts[k - 1].y) : 0), 0);
                const done = new Set();
                let ref = null;
                while (done.size < group.length) {
                    const seed = group.filter(l => !done.has(l)).reduce((a, b) => (lenOf(b) > lenOf(a) ? b : a));
                    const v = vec(seed);
                    if (ref && v.x * ref.x + v.y * ref.y < 0) seed.pts.reverse();
                    if (!ref && Math.hypot(v.x, v.y) > 1e-6) ref = vec(seed);
                    done.add(seed);
                    const queue = [seed];
                    while (queue.length) {
                        const w = queue.shift();
                        for (const n of group) {
                            if (done.has(n)) continue;
                            let rev = null;
                            if (same(first(n), last(w)) || same(last(n), first(w))) rev = false;
                            else if (same(first(n), first(w)) || same(last(n), last(w))) rev = true;
                            if (rev === null) continue;
                            if (rev) n.pts.reverse();
                            done.add(n);
                            queue.push(n);
                        }
                    }
                }
                group.forEach(l => {
                    const others = group.filter(o => o !== l);
                    const linked = p => same(first(l), last(l)) || others.some(o => same(p, first(o)) || same(p, last(o)));
                    l.freeStart = !linked(first(l));
                    l.freeEnd = !linked(last(l));
                });
            });
            return lines;
        }
        // Chân đường vuông góc gần nhất. key = null → mọi đường. side = +1 nếu trụ ở bên trái hướng đường.
        // endOver = trụ vượt qua đầu mút TỰ DO bao nhiêu mét (chân đường bị kẹp ở đầu mút → dời sẽ trượt dọc đường).
        function _raNearestOnLines(px, py, lines, key) {
            let best = null;
            for (const l of lines) {
                if (key != null && l.key !== key) continue;
                const nSeg = l.pts.length - 1;
                for (let i = 0; i < nSeg; i++) {
                    const a = l.pts[i], b = l.pts[i + 1];
                    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
                    if (len2 < 1e-9) continue;
                    const len = Math.sqrt(len2);
                    const tRaw = ((px - a.x) * dx + (py - a.y) * dy) / len2;
                    const t = Math.max(0, Math.min(1, tRaw));
                    const qx = a.x + t * dx, qy = a.y + t * dy;
                    const d = Math.hypot(px - qx, py - qy);
                    const endOver = (i === 0 && tRaw < 0 && l.freeStart) ? -tRaw * len
                                  : (i === nSeg - 1 && tRaw > 1 && l.freeEnd) ? (tRaw - 1) * len : 0;
                    // Hoà khoảng cách tại nút nối 2 way → ưu tiên đoạn mà chân đường nằm trong (không vượt đầu mút)
                    if (!best || d < best.dist - 1e-6 || (Math.abs(d - best.dist) <= 1e-6 && endOver < best.endOver)) {
                        const cross = dx * (py - a.y) - dy * (px - a.x);
                        best = { key: l.key, qx, qy, dist: d, side: cross < 0 ? -1 : 1, nx: -dy / len, ny: dx / len, endOver, width: l.width };
                    }
                }
            }
            return best;
        }
        // Bề rộng 1 tuyến = trung vị bề rộng các way theo chiều dài (tuyến có thể đổi bề rộng giữa chừng)
        function _raRoadWidth(lines, key) {
            const parts = lines.filter(l => l.key === key && isFinite(l.width)).map(l => ({
                w: l.width, len: l.pts.reduce((s, p, k) => (k ? s + Math.hypot(p.x - l.pts[k - 1].x, p.y - l.pts[k - 1].y) : 0), 0)
            })).sort((a, b) => a.w - b.w);
            const total = parts.reduce((s, p) => s + p.len, 0);
            let acc = 0;
            for (const p of parts) { acc += p.len; if (acc >= total / 2) return p.w; }
            return parts.length ? parts[parts.length - 1].w : 6;
        }
        const RA_MAX_WIDTH = 60;
        // Mốc căn → khoảng cách CÓ DẤU tới tim. ref 'mep': value tính từ mép ra ngoài (âm = vào lòng đường);
        // ref 'tim': value tính từ tim (≥ 0). side ±1 = phía so với hướng đường.
        function _raTargetOffset(cfg) {
            const c = cfg || {};
            const side = c.side < 0 ? -1 : 1, v = Number(c.value), w = Number(c.width);
            if (!isFinite(v)) return { error: 'value' };
            if (c.ref === 'tim') {
                if (v < 0 || v > RA_MAX_DIST) return { error: 'value' };
                return { offset: side * v };
            }
            if (!isFinite(w) || w <= 0 || w > RA_MAX_WIDTH) return { error: 'width' };
            if (v < -w / 2) return { error: 'inside' };
            if (w / 2 + v > RA_MAX_DIST) return { error: 'value' };
            return { offset: side * (w / 2 + v) };
        }
        // Kẹp cấu hình về khoảng hợp lệ (cấu hình nhớ từ đường khác có thể không hợp lệ với đường này)
        function _raFitCfg(cfg, width) {
            const c = Object.assign({}, cfg);
            const w = Math.min(RA_MAX_WIDTH, Math.max(0.5, Number(width) || 6));
            let v = Number.isFinite(c.value) ? c.value : (c.ref === 'tim' ? 0 : 0.5);
            if (c.ref === 'tim') v = Math.min(RA_MAX_DIST, Math.max(0, v));
            else v = Math.min(RA_MAX_DIST - w / 2, Math.max(-w / 2, v));
            c.value = v;
            return c;
        }
        // v162 — ĐƯỜNG ĐÔI: OSM vẽ 2 tim 1 chiều song song cùng tên (vd Nguyễn Thị Minh Khai). Trụ trên dải phân cách
        // bám tim gần nhất → mỗi trụ theo 1 tim khác nhau → căn gãy khúc. Từ chân đường q bắn tia theo pháp tuyến; gặp
        // tim song song cùng tên cách 2..40m → đó là chiều còn lại, TRỤC GIỮA = trung điểm 2 chân đường.
        const RA_DUAL_MIN = 2, RA_DUAL_MAX = 40, RA_DUAL_COS = Math.cos(20 * Math.PI / 180);
        function _raAxis(px, py, n, lines, key) {
            const dx = n.ny, dy = -n.nx;   // hướng đường tại chân (n = pháp tuyến trái)
            let best = null;
            for (const l of lines) {
                if (l.key !== key) continue;
                for (let i = 0; i < l.pts.length - 1; i++) {
                    const a = l.pts[i], b = l.pts[i + 1];
                    const ex = b.x - a.x, ey = b.y - a.y, el = Math.hypot(ex, ey);
                    if (el < 1e-9 || Math.abs((ex * dx + ey * dy) / el) < RA_DUAL_COS) continue;
                    const den = n.nx * ey - n.ny * ex;
                    if (Math.abs(den) < 1e-12) continue;
                    const wx = a.x - n.qx, wy = a.y - n.qy;
                    const s = (wx * ey - wy * ex) / den, u = (wx * n.ny - wy * n.nx) / den;   // q + s·n = a + u·e
                    if (u < 0 || u > 1 || Math.abs(s) < RA_DUAL_MIN || Math.abs(s) > RA_DUAL_MAX) continue;
                    if (!best || Math.abs(s) < Math.abs(best.s)) best = { s };
                }
            }
            if (!best) return { mx: n.qx, my: n.qy, signed: n.side * n.dist, half0: 0, gap: 0 };
            const mx = n.qx + n.nx * best.s / 2, my = n.qy + n.ny * best.s / 2;
            return { mx, my, signed: (px - mx) * n.nx + (py - my) * n.ny, half0: Math.abs(best.s) / 2, gap: Math.abs(best.s) };
        }
        const RA_SPLIT_GAP = 6;   // tách 2 hàng (2 bên đường) chỉ khi khoảng cách có dấu chia 2 cụm cách nhau ≥ 6m
        // Kế hoạch căn. Khoảng cách CÓ DẤU tới tim (+ = bên trái hướng đường) → mặc định 1 hàng = trung vị;
        // GPS nhiễu làm trụ vắt qua tim nên KHÔNG chia bên theo dấu từng trụ.
        // opts.offsets[g] (có dấu, mét) ghi đè khoảng cách của hàng g; null = giữ trung vị.
        function _raPlanAlign(poles, lines, opts) {
            // crossMin: trụ khác phía với hàng và cách tim > crossMin mới coi là "bên kia đường" (mốc mép: ½ bề rộng)
            const o = Object.assign({ maxDist: RA_MAX_DIST, maxMove: RA_MAX_MOVE, splitGap: RA_SPLIT_GAP, offsets: [], crossMin: 2 }, opts || {});
            const votes = new Map();
            poles.forEach(p => {
                const n = _raNearestOnLines(p.x, p.y, lines, null);
                if (!n || n.dist > o.maxDist) return;
                const v = votes.get(n.key) || { count: 0, sum: 0 };
                v.count++; v.sum += n.dist;
                votes.set(n.key, v);
            });
            if (votes.size === 0) return { error: 'no_road' };
            let roadKey = null, bestV = null;
            votes.forEach((v, k) => {
                if (!bestV || v.count > bestV.count || (v.count === bestV.count && v.sum < bestV.sum)) { roadKey = k; bestV = v; }
            });
            // v164 — tuyến chạy qua nhiều đường (vd LTT_LTT1: Lý Tự Trọng + Lê Thánh Tôn): căn theo đường của trụ
            // người dùng bấm, không theo đa số. Trụ trên đường khác → "xa đường", căn riêng bằng cách bấm trụ ở đó.
            if (o.roadKey && lines.some(l => l.key === o.roadKey)) roadKey = o.roadKey;
            const proj = poles.map(p => _raNearestOnLines(p.x, p.y, lines, roadKey));
            const median = arr => { const s = arr.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
            const offs = Array.isArray(o.offsets) ? o.offsets : [];
            const edge = Array.isArray(o.edge) ? o.edge : [];
            // Trục tham chiếu mỗi trụ: tim (đường 1 tim) hoặc trục giữa 2 tim (đường đôi)
            const axis = proj.map((n, i) => _raAxis(poles[i].x, poles[i].y, n, lines, roadKey));
            const wOver = Number(o.width) > 0 ? Number(o.width) : null;   // bề rộng 1 chiều xe người dùng sửa
            // Nửa bề rộng cả con đường tại trụ: ½ khoảng 2 tim (đường đôi) + ½ bề rộng 1 chiều xe
            const halfOf = i => axis[i].half0 + (wOver || proj[i].width || 6) / 2;
            const signed = axis.map(a => a.signed);
            // Vượt đầu mút tự do > 1m: chân đường kẹp ở đầu mút, dời sẽ trượt dọc tuyến → không căn, không tính trung vị
            const isEnd = proj.map(n => n.dist <= o.maxDist && n.endOver > 1);
            const use = proj.map((n, i) => n.dist <= o.maxDist && !isEnd[i]);
            const vals = signed.filter((_, i) => use[i]).sort((a, b) => a - b);
            if (vals.length < 2) return { error: 'too_few', roadKey };
            // 1 hàng, trừ khi các khoảng cách chia rõ 2 cụm (khe lớn nhất ≥ splitGap, mỗi cụm ≥ 2 trụ)
            let cut = null, gap = 0;
            for (let k = 1; k < vals.length; k++) {
                if (vals[k] - vals[k - 1] > gap && k >= 2 && vals.length - k >= 2) { gap = vals[k] - vals[k - 1]; cut = (vals[k] + vals[k - 1]) / 2; }
            }
            if (gap < o.splitGap) cut = null;
            const groupOf = s => (cut != null && s > cut ? 1 : 0);
            const groups = (cut == null ? [0] : [0, 1]).map(g => {
                const members = signed.filter((s, i) => use[i] && groupOf(s) === g);
                const ov = offs[g];
                const pos = members.filter(s => s > 0).length, neg = members.filter(s => s < 0).length;
                const sidePref = pos > neg ? 1 : neg > pos ? -1 : (Math.sign(median(members)) || 1);   // phía nhiều trụ hơn
                const e = edge[g];
                // Mốc mép: offset hiển thị = ½ bề rộng trung vị + value (từng trụ vẫn dùng ½ bề rộng của chính nó)
                const halfMed = median(signed.map((s, i) => i).filter(i => use[i] && groupOf(signed[i]) === g).map(halfOf));
                const offset = e ? (e.side < 0 ? -1 : 1) * (halfMed + Number(e.value || 0))
                    : (ov != null && isFinite(ov)) ? ov : median(members);
                return { offset, median: median(members), count: members.length, sidePref, halfMed };
            });
            const items = poles.map((p, i) => {
                const n = proj[i];
                if (!use[i]) return { x: p.x, y: p.y, dist: n.dist, signed: signed[i], group: -1, move: 0, flag: isEnd[i] ? 'end' : 'far', checked: false };
                const g = groupOf(signed[i]), e = edge[g];
                const S = e ? (e.side < 0 ? -1 : 1) * (halfOf(i) + Number(e.value || 0)) : groups[g].offset;
                const ax = axis[i];
                const x = ax.mx + S * n.nx, y = ax.my + S * n.ny;
                const move = Math.hypot(x - p.x, y - p.y);
                // Vị trí mới gần nhánh khác của đường hơn (nút giao, góc gấp) → không cách trục đúng S
                const an = _raNearestOnLines(x, y, lines, roadKey);
                const after = { dist: Math.abs(_raAxis(x, y, an, lines, roadKey).signed) };
                // Trụ lẻ ở hẳn bên kia tim (không đủ 2 trụ để thành hàng riêng) → đừng tự kéo qua đường
                // Mốc mép: chỉ coi là bên kia đường khi vượt ½ bề rộng CẢ con đường tại trụ đó
                const crossMin = e ? Math.max(2, halfOf(i))
                    : Array.isArray(o.crossMin) ? (Number.isFinite(o.crossMin[g]) ? o.crossMin[g] : 2) : o.crossMin;
                const otherSide = S !== 0 && Math.sign(signed[i]) !== Math.sign(S);
                const cross = otherSide && Math.abs(signed[i]) > crossMin;
                // Khác phía, cách tim 2m..crossMin: có thể là GPS lệch HOẶC trụ thật bên kia đường hẹp → đề xuất nhưng bỏ tick
                const straddle = otherSide && !cross && Math.abs(signed[i]) > 2;
                const flag = cross ? 'cross' : straddle ? 'straddle' : move > o.maxMove ? 'big'
                           : (Math.abs(after.dist - Math.abs(S)) > 0.5 ? 'junction' : 'ok');
                return { x, y, dist: n.dist, signed: signed[i], group: g, move, flag, checked: flag === 'ok',
                         nx: n.nx, ny: n.ny, dual: axis[i].gap > 0 };
            });
            const gaps = axis.filter((a, i) => use[i] && a.gap > 0).map(a => a.gap);
            return { roadKey, groups, items, dual: gaps.length ? { count: gaps.length, gap: median(gaps) } : null };
        }
        // @@ROADALIGN_END

        // Lấy đoạn đường xe chạy (VN2000 + offset xuất) cho bbox — dùng chung dữ liệu Overpass/cache của nền OSM
        function _rlRoadSegments(osmData, cm, k0, outDE, outDN) {
            const segs = [];
            (osmData && osmData.roads || []).forEach(rd => {
                if (!_rlIsDrivable(rd.tags) || !rd.coords || rd.coords.length < 2) return;
                const pts = rd.coords.map(([lon, lat]) => {
                    const vn = convertLatLonToVn2000(lat, lon, cm, k0);
                    return { x: vn.x + outDE, y: vn.y + outDN };
                });
                for (let i = 1; i < pts.length; i++) {
                    segs.push({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y });
                }
            });
            return segs;
        }

        // Vẽ 1 marker symbol dựa trên (type, state, opts).
        // - type: 1-4 = pole, 5-6 = cabinet
        // - state: '' (=giu) / 'thu' / 'thu_can' / 'thu_udc' / 'thu_can_udc'
        //          'moi_led' / 'moi_led_thay' / 'thao_lap'
        // - opts: { soLuongDen, loaiDen }
        function _drawMarkerSymbol(push, x, y, type, state, opts) {
            const isCabinet = (type === 5 || type === 6);
            if (isCabinet) return _drawCabinetSymbol(push, x, y, state);
            _drawPoleSymbol(push, x, y, state, opts || {});
        }

        // ─── POLE / LAMP symbols ───
        function _drawPoleSymbol(push, x, y, state, opts) {
            const R = 1.2;   // radius đèn
            const armLen = 2.5;   // chiều dài cần đèn
            const udcR = 0.6;   // radius UDC
            const soLuong = parseInt(opts.soLuongDen) || 1;
            state = state || 'giu';
            const _lampM = /^lamp([1-4])$/.exec(state);
            if (_lampM) return _rlDrawLampBlock(push, x, y, parseInt(_lampM[1]), 1);

            const drawEllipseFilled = (cx, cy, rx, ry) => {
                // DXF không hỗ trợ filled ellipse trực tiếp — dùng SOLID 4-vertex square approximation
                // + CIRCLE contour đè lên
                push('0', 'SOLID', '8', '0');
                push('10', (cx - rx).toFixed(4), '20', (cy - ry).toFixed(4), '30', '0');
                push('11', (cx + rx).toFixed(4), '21', (cy - ry).toFixed(4), '31', '0');
                push('12', (cx - rx).toFixed(4), '22', (cy + ry).toFixed(4), '32', '0');
                push('13', (cx + rx).toFixed(4), '23', (cy + ry).toFixed(4), '33', '0');
            };
            const drawEllipseContour = (cx, cy, rx, ry) => {
                // Approximation: dùng CIRCLE với radius trung bình
                push('0', 'CIRCLE', '8', '0');
                push('10', cx.toFixed(4), '20', cy.toFixed(4), '30', '0');
                push('40', ((rx + ry) / 2).toFixed(4));
            };
            const drawArm = (cx, cy, dx) => {
                // Cần đèn ngang
                push('0', 'LINE', '8', '0',
                    '10', cx.toFixed(4), '20', cy.toFixed(4), '30', '0',
                    '11', (cx + dx * armLen).toFixed(4), '21', cy.toFixed(4), '31', '0');
            };
            const drawUdc = (cx, cy, dx) => {
                push('0', 'CIRCLE', '8', '0');
                push('10', (cx + dx * (armLen + udcR)).toFixed(4), '20', cy.toFixed(4), '30', '0');
                push('40', udcR.toFixed(4));
            };
            const drawPoleBase = (cx, cy) => {
                // Trụ (line dọc) dưới đèn
                push('0', 'LINE', '8', '0',
                    '10', cx.toFixed(4), '20', cy.toFixed(4), '30', '0',
                    '11', cx.toFixed(4), '21', (cy - 3).toFixed(4), '31', '0');
                push('0', 'CIRCLE', '8', '0');
                push('10', cx.toFixed(4), '20', (cy - 3.5).toFixed(4), '30', '0');
                push('40', '0.4');
            };
            const drawLabel12m = (cx, cy) => {
                push('0', 'TEXT', '8', '0');
                push('10', (cx - 2).toFixed(4), '20', (cy - 5).toFixed(4), '30', '0');
                push('40', '1.2');
                push('1', '<12m');
            };

            // Helper draw ARC (¼ circle) — DXF ARC entity R12 compat
            const drawArc = (cx, cy, r, startAngle, endAngle) => {
                push('0', 'ARC', '8', '0',
                    '10', cx.toFixed(4), '20', cy.toFixed(4), '30', '0',
                    '40', r.toFixed(4),
                    '50', startAngle.toFixed(2),
                    '51', endAngle.toFixed(2));
            };
            // Helper draw filled square (SOLID)
            const drawSquareFilled = (cx, cy, hw) => {
                push('0', 'SOLID', '8', '0');
                push('10', (cx - hw).toFixed(4), '20', (cy - hw).toFixed(4), '30', '0');
                push('11', (cx + hw).toFixed(4), '21', (cy - hw).toFixed(4), '31', '0');
                push('12', (cx - hw).toFixed(4), '22', (cy + hw).toFixed(4), '32', '0');
                push('13', (cx + hw).toFixed(4), '23', (cy + hw).toFixed(4), '33', '0');
            };
            // Helper vẽ hatching (multiple LINE cạnh nhau)
            const drawHatchLines = (cx, cy, hw, hh, spacing) => {
                for (let dx = -hw + spacing; dx < hw; dx += spacing) {
                    push('0', 'LINE', '8', '0',
                        '10', (cx + dx).toFixed(4), '20', (cy - hh).toFixed(4), '30', '0',
                        '11', (cx + dx).toFixed(4), '21', (cy + hh).toFixed(4), '31', '0');
                }
            };

            // Dispatch by state
            switch (state) {
                case 'thu':   // Đèn thu hồi — oval đen filled, không cần
                    drawEllipseFilled(x, y, R * 1.4, R * 0.7);
                    break;
                case 'thu_can':   // Thu hồi + cần đèn (chỉ có cần trái)
                    drawEllipseFilled(x, y, R * 1.4, R * 0.7);
                    drawArm(x, y, -1);
                    break;
                case 'thu_udc':   // Thu hồi + UDC (cần phải + circle)
                    drawEllipseFilled(x, y, R * 1.4, R * 0.7);
                    drawArm(x, y, 1);
                    drawUdc(x, y, 1);
                    break;
                case 'thu_can_udc':   // Thu hồi + cần + UDC (2 bên đối xứng)
                    drawEllipseFilled(x, y, R * 1.4, R * 0.7);
                    drawArm(x, y, -1);
                    drawArm(x, y, 1);
                    drawUdc(x, y, 1);
                    break;
                case 'moi_led':   // Lắp mới LED — filled + trụ + label <12m
                    drawEllipseFilled(x, y, R * 1.4, R * 0.7);
                    drawPoleBase(x, y - R * 0.8);
                    drawLabel12m(x, y);
                    // Thêm cần đèn nếu soLuong>1
                    if (soLuong >= 1) drawArm(x, y, 1);
                    break;
                case 'moi_led_thay':   // LED thay HPS trên STK cũ — contour + trụ + label
                    drawEllipseContour(x, y, R * 1.4, R * 0.7);
                    drawPoleBase(x, y - R * 0.8);
                    drawLabel12m(x, y);
                    if (soLuong >= 1) drawArm(x, y, 1);
                    break;
                case 'thao_lap':   // Trụ tháo lắp — square nhỏ + play button
                    drawEllipseContour(x, y, R * 1.4, R * 0.7);
                    // Play button ▶
                    push('0', 'SOLID', '8', '0');
                    push('10', (x - 0.4).toFixed(4), '20', (y - 0.5).toFixed(4), '30', '0');
                    push('11', (x + 0.6).toFixed(4), '21', y.toFixed(4), '31', '0');
                    push('12', (x - 0.4).toFixed(4), '22', (y + 0.5).toFixed(4), '32', '0');
                    push('13', (x - 0.4).toFixed(4), '23', (y + 0.5).toFixed(4), '33', '0');
                    break;
                case 'moi_stk_170w': {   // Trụ STK 12m + LED 170W: trụ line + cần cong + đèn oval đen
                    // Trụ dọc từ (x, y-2) xuống (x, y-3)
                    push('0', 'LINE', '8', '0',
                        '10', x.toFixed(4), '20', (y - 2).toFixed(4), '30', '0',
                        '11', x.toFixed(4), '21', (y - 3.5).toFixed(4), '31', '0');
                    // Cần cong bên trái = ARC ¼ circle từ (x, y-2) cong tới (x-2, y)
                    drawArc(x, y - 2, 2, 90, 180);
                    // Đèn oval đen ở đầu cần (position ngoài cùng bên trái)
                    drawEllipseFilled(x - 2.5, y - 0.5, 1.2, 0.6);
                    break;
                }
                case 'moi_stk_tuong': {   // Trụ STK trên tường chắn: cần cong bên phải + hatching nền
                    push('0', 'LINE', '8', '0',
                        '10', x.toFixed(4), '20', (y - 2).toFixed(4), '30', '0',
                        '11', x.toFixed(4), '21', (y - 3.5).toFixed(4), '31', '0');
                    drawArc(x, y - 2, 2, 0, 90);
                    drawEllipseFilled(x + 2.5, y - 0.5, 1.2, 0.6);
                    // Hatching lines dưới (biểu tượng tường chắn)
                    for (let i = 0; i < 3; i++) {
                        const yh = y - 4 - i * 0.6;
                        push('0', 'LINE', '8', '0',
                            '10', (x - 2).toFixed(4), '20', yh.toFixed(4), '30', '0',
                            '11', (x + 2).toFixed(4), '21', yh.toFixed(4), '31', '0');
                    }
                    break;
                }
                case 'moi_dacau': {   // Đèn pha LED 40W dạ cầu — hình chữ nhật với lưới ngang
                    const hw = 1.5, hh = 1.2;
                    // Frame
                    push('0', 'LINE', '8', '0', '10', (x - hw).toFixed(4), '20', (y - hh).toFixed(4), '30', '0', '11', (x + hw).toFixed(4), '21', (y - hh).toFixed(4), '31', '0');
                    push('0', 'LINE', '8', '0', '10', (x + hw).toFixed(4), '20', (y - hh).toFixed(4), '30', '0', '11', (x + hw).toFixed(4), '21', (y + hh).toFixed(4), '31', '0');
                    push('0', 'LINE', '8', '0', '10', (x + hw).toFixed(4), '20', (y + hh).toFixed(4), '30', '0', '11', (x - hw).toFixed(4), '21', (y + hh).toFixed(4), '31', '0');
                    push('0', 'LINE', '8', '0', '10', (x - hw).toFixed(4), '20', (y + hh).toFixed(4), '30', '0', '11', (x - hw).toFixed(4), '21', (y - hh).toFixed(4), '31', '0');
                    // Lưới ngang bên trong (3 line horizontal)
                    for (let i = 1; i < 4; i++) {
                        const yh = y - hh + (2 * hh * i / 4);
                        push('0', 'LINE', '8', '0',
                            '10', (x - hw).toFixed(4), '20', yh.toFixed(4), '30', '0',
                            '11', (x + hw).toFixed(4), '21', yh.toFixed(4), '31', '0');
                    }
                    break;
                }
                case 'moi_6m_2x60w': {   // Trụ 6m + 2 đèn pha 60W — 2 hình chữ nhật nhỏ đối xứng
                    // Trụ dọc ngắn ở giữa (6m ~ shorter than STK)
                    push('0', 'LINE', '8', '0',
                        '10', x.toFixed(4), '20', (y - 1).toFixed(4), '30', '0',
                        '11', x.toFixed(4), '21', (y - 2.5).toFixed(4), '31', '0');
                    // 2 box đèn pha (mỗi cái 1.2×0.8m) đối xứng 2 bên
                    for (const side of [-1, 1]) {
                        const bx = x + side * 1.3;
                        const bhw = 0.8, bhh = 0.6;
                        push('0', 'LINE', '8', '0', '10', (bx - bhw).toFixed(4), '20', (y - bhh).toFixed(4), '30', '0', '11', (bx + bhw).toFixed(4), '21', (y - bhh).toFixed(4), '31', '0');
                        push('0', 'LINE', '8', '0', '10', (bx + bhw).toFixed(4), '20', (y - bhh).toFixed(4), '30', '0', '11', (bx + bhw).toFixed(4), '21', (y + bhh).toFixed(4), '31', '0');
                        push('0', 'LINE', '8', '0', '10', (bx + bhw).toFixed(4), '20', (y + bhh).toFixed(4), '30', '0', '11', (bx - bhw).toFixed(4), '21', (y + bhh).toFixed(4), '31', '0');
                        push('0', 'LINE', '8', '0', '10', (bx - bhw).toFixed(4), '20', (y + bhh).toFixed(4), '30', '0', '11', (bx - bhw).toFixed(4), '21', (y - bhh).toFixed(4), '31', '0');
                    }
                    break;
                }
                case 'moi_tiepdia': {   // Cọc tiếp địa: ⏊ symbol (line dọc + 3 lines ngang giảm dần)
                    // Line dọc chính
                    push('0', 'LINE', '8', '0',
                        '10', x.toFixed(4), '20', (y + 1).toFixed(4), '30', '0',
                        '11', x.toFixed(4), '21', y.toFixed(4), '31', '0');
                    // 3 line ngang giảm dần
                    const widths = [1.5, 1.0, 0.5];
                    widths.forEach((w, i) => {
                        const yh = y - i * 0.4;
                        push('0', 'LINE', '8', '0',
                            '10', (x - w).toFixed(4), '20', yh.toFixed(4), '30', '0',
                            '11', (x + w).toFixed(4), '21', yh.toFixed(4), '31', '0');
                    });
                    break;
                }
                case 'giu':
                default:   // Giữ nguyên — CONTOUR oval trắng
                    drawEllipseContour(x, y, R * 1.4, R * 0.7);
                    break;
            }
        }

        // ─── CABLE symbols (line pattern by state) ───
        // States: noi (nổi giữ), ngam (ngầm giữ), noi_thu, ngam_thu, noi_moi, ngam_moi
        const _CABLE_STATE_LABELS = {
            'noi':      'Cáp điện kéo nổi hiện hữu giữ nguyên',
            'ngam':     'Cáp điện kéo ngầm hiện hữu giữ nguyên',
            'noi_thu':  'Cáp điện kéo nổi thu hồi',
            'ngam_thu': 'Cáp điện kéo ngầm thu hồi',
            'noi_moi':  'Cáp điện kéo nổi lắp mới',
            'ngam_moi': 'Cáp điện kéo ngầm lắp mới (trong ống bảo vệ)'
        };

        // Vẽ line với pattern rời rạc — R12 compat (không dùng LTYPE dashed)
        // Approach: split thành nhiều LINE nhỏ theo pattern
        // layer: mặc định '0' để legend + bản vẽ tổng thể (chưa khai báo LAYER table) không đổi.
        // Bản vẽ mặt bằng truyền 'LIGHTING_CABLE' để tắt/bật cáp độc lập.
        function _drawCableSymbol(push, x1, y1, x2, y2, state, layer) {
            layer = layer || '0';
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            if (len < 0.1) return;
            const ux = dx / len, uy = dy / len;

            // Pattern segments: [drawLen1, gapLen1, drawLen2, gapLen2, ...]
            let pattern;
            switch (state) {
                case 'noi':      pattern = null; break;            // solid — 1 LINE
                case 'ngam':     pattern = [3, 1, 0.5, 1]; break;  // dash-dot (giữ ngầm)
                case 'noi_thu':  pattern = [2, 1, 0.5, 1]; break;  // dash-dot ngắn (thu nổi)
                case 'ngam_thu': pattern = [0.6, 0.6]; break;      // zigzag approximation (thu ngầm)
                case 'noi_moi':  pattern = [3, 1.5]; break;        // long dash (mới nổi)
                case 'ngam_moi': pattern = [1.2, 1.2]; break;      // dash short (mới ngầm ống)
                default: pattern = null;
            }

            if (!pattern) {
                // Solid
                push('0', 'LINE', '8', layer,
                    '10', x1.toFixed(4), '20', y1.toFixed(4), '30', '0',
                    '11', x2.toFixed(4), '21', y2.toFixed(4), '31', '0');
                return;
            }

            // Dashed pattern — vẽ segments
            const totalPat = pattern.reduce((s, v) => s + v, 0);
            let cursor = 0, ptrIdx = 0;
            let drawing = true;   // start with draw
            while (cursor < len) {
                const seg = Math.min(pattern[ptrIdx], len - cursor);
                if (drawing && seg > 0) {
                    const sx = x1 + ux * cursor;
                    const sy = y1 + uy * cursor;
                    const ex = x1 + ux * (cursor + seg);
                    const ey = y1 + uy * (cursor + seg);
                    push('0', 'LINE', '8', layer,
                        '10', sx.toFixed(4), '20', sy.toFixed(4), '30', '0',
                        '11', ex.toFixed(4), '21', ey.toFixed(4), '31', '0');
                }
                cursor += seg;
                ptrIdx = (ptrIdx + 1) % pattern.length;
                drawing = !drawing;
            }
        }

        // ─── CABINET / TĐK symbols ───
        // v165 — MỌI tủ dùng chung 1 ký hiệu (không phân biệt trạng thái cải tạo):
        // chữ nhật ngang 1.55:1, đường chéo dưới-trái → trên-phải, tam giác trên-trái GẠCH CHÉO.
        // Gạch = các LINE 45° (DXF R12 không có HATCH), cắt đúng theo 3 cạnh tam giác.
        const CAB_SYM_RATIO = 1.55;
        function _drawCabinetGeom(push, cx, cy, h) {
            const w = h * CAB_SYM_RATIO;
            const x1 = cx - w / 2, x2 = cx + w / 2, y1 = cy - h / 2, y2 = cy + h / 2;
            const ln = (ax, ay, bx, by) => push('0', 'LINE', '8', '0',
                '10', ax.toFixed(4), '20', ay.toFixed(4), '30', '0', '11', bx.toFixed(4), '21', by.toFixed(4), '31', '0');
            ln(x1, y1, x2, y1); ln(x2, y1, x2, y2); ln(x2, y2, x1, y2); ln(x1, y2, x1, y1);
            ln(x1, y1, x2, y2);
            // Đường gạch: y = x - k (hướng "/"), khoảng cách vuông góc = h/16 (0.25 m khi h = 4 m).
            // Tam giác = {x ≥ x1, y ≤ y2, trên đường chéo}. Gạch dốc 1 > dốc chéo m nên đoạn nằm trong là
            // x ∈ [max(x1, xChéo), xTrên]; k chạy từ đỉnh trên-trái (x1-y2) tới đỉnh trên-phải (x2-y2).
            const step = (h / 16) * Math.SQRT2;
            const m = h / w;
            const kMin = x1 - y2, kMax = x2 - y2;
            for (let k = kMin + step / 2; k < kMax; k += step) {
                const xDiag = (y1 - m * x1 + k) / (1 - m);
                const xa = Math.max(x1, xDiag), xb = y2 + k;
                if (xb - xa > 1e-6) ln(xa, xa - k, xb, xb - k);
            }
        }
        function _drawCabinetSymbol(push, x, y, state) {
            _drawCabinetGeom(push, x, y, 4);
        }

        // Tổng hợp thông tin đèn từ rows cho phần "Thông tin đèn/trụ" trong bản ký hiệu
        function _buildLampSpecs(rows) {
            const specs = new Map();  // key "loaiDen|congSuat|soLuong" → count
            for (const r of (rows || [])) {
                const type = parseInt(r[6]);
                if (type < 1 || type > 4) continue;  // chỉ trụ, bỏ qua tủ
                const loaiDen = String(r[10] || '').trim().toUpperCase();
                const congSuat = String(r[11] || '').trim().replace(/[Ww]$/, '');
                const soLuong = parseInt(r[21]) || 1;
                const key = `${loaiDen}|${congSuat}|${soLuong}`;
                specs.set(key, (specs.get(key) || 0) + 1);
            }
            return specs;
        }

        // ─── AUTO-LEGEND — vẽ CHÚ THÍCH box chỉ với symbols xuất hiện ───
        // lampSpecs: Map từ _buildLampSpecs(rows) — tuỳ chọn
        // ĐVT theo key chú thích
        function _legendUnit(kind, key) {
            if (kind === 'cable') return 'm';
            if (key === 'pole_moi_tiepdia') return 'Cọc';
            if (/^cab(_|$)/.test(key)) return 'Tủ';
            return 'Trụ';
        }
        // Số lượng: số nguyên, dấu chấm ngăn nghìn (4215.5 → "4.216")
        function _legendQty(v) {
            const n = Math.round(Number(v) || 0);
            return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        // Tổng mét cáp theo loại (row[22], mặc định 'noi') — chỉ đoạn có trụ gốc nằm trong tập xuất.
        // Ưu tiên số mét đã ghi (row[15], chấp nhận dấu phẩy thập phân); chưa ghi → đo Haversine.
        function _legendCableMeters(rows) {
            const pos = new Map();   // row → [lat, lon]
            for (const r of rows) {
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (isFinite(lat) && isFinite(lon)) pos.set(r, [lat, lon]);
            }
            const idx = _rowIndex((loadedData || []).slice(1), rows);   // cùng cách giải như khi vẽ cáp (_cadIdx)
            const out = new Map();
            for (const r of rows) {
                const pRow = _resolveParent(r, idx);
                if (!pRow || !pos.has(pRow)) continue;
                let m = parseFloat(String(r[15] || '').replace(',', '.'));
                if (!(m > 0)) {
                    const me = pos.get(r);
                    if (!me) continue;
                    const pp = pos.get(pRow);
                    m = haversineM(me[0], me[1], pp[0], pp[1]);
                }
                const st = String(r[22] || 'noi').trim() || 'noi';
                out.set(st, (out.get(st) || 0) + m);
            }
            return out;
        }

        // ─── AUTO-LEGEND — bảng CHÚ THÍCH: Ký hiệu | Diễn giải | ĐVT | Số lượng ───
        // Ký hiệu vẽ bằng ĐÚNG hàm đã sinh block (tỉ lệ 1:1) → trùng nét block trên bản vẽ.
        // counts (tuỳ chọn): { states: Map(key→số), cables: Map(state→mét) } — thiếu → bỏ trống cột SL.
        function _drawAutoLegend(push, escape, mapBounds, usedStates, usedCableStates, lampSpecs, counts) {
            usedStates = usedStates || new Set();
            usedCableStates = usedCableStates || new Set();
            counts = counts || {};
            const stCnt = counts.states || new Map(), cabM = counts.cables || null;
            const items = [];
            for (const key of usedStates) {
                const label = _STATE_LABELS[key];
                if (!label) continue;
                items.push({ kind: 'marker', key, label, qty: stCnt.has(key) ? _legendQty(stCnt.get(key)) : '' });
            }
            for (const key of usedCableStates) {
                const label = _CABLE_STATE_LABELS[key];
                if (!label) continue;
                items.push({ kind: 'cable', key, label, qty: cabM ? _legendQty(cabM.get(key) || 0) : '' });
            }
            // Block thật (bản vẽ mẫu): mỗi (block, layer trạng thái) 1 dòng — INSERT đúng block đó, màu theo layer
            for (const rb of (counts.realBlocks || [])) {
                items.push({ kind: 'blk', key: rb.block, layer: rb.layer, scale: rb.scale, unit: rb.unit,
                             label: rb.label, qty: _legendQty(rb.count) });
            }

            const lampRows = lampSpecs ? [...lampSpecs.entries()]
                .filter(([, c]) => c > 0)
                .sort(([a], [b]) => a.localeCompare(b))
                : [];

            if (items.length === 0 && lampRows.length === 0) return;

            // Vẽ ký hiệu vào mảng tạm tại (0,0) → đo bbox → vẽ lại căn giữa ô
            const P2 = [['10', '20'], ['11', '21'], ['12', '22'], ['13', '23']];
            function symbolOf(it, ox, oy) {
                const buf = [];
                const p = (...a) => { for (const v of a) buf.push(String(v)); };
                if (it.kind === 'blk') {
                    const s = it.scale.toFixed(4);
                    p('0', 'INSERT', '8', it.layer, '2', it.key, '10', ox.toFixed(4), '20', oy.toFixed(4), '30', '0',
                      '41', s, '42', s, '43', s, '50', '0');
                    return buf;
                }
                if (it.kind === 'cable') _drawCableSymbol(p, ox - 4, oy, ox + 4, oy, it.key);
                else if (/^cab(_|$)/.test(it.key)) _drawCabinetSymbol(p, ox, oy, it.key.replace(/^cab_?/, ''));
                else _drawPoleSymbol(p, ox, oy, it.key.replace(/^pole_/, ''), { soLuongDen: 1 });
                return buf;
            }
            function bboxOf(buf) {
                let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
                let ent = null, g = {};
                const flush = () => {
                    if (!ent) return;
                    const r = ent === 'CIRCLE' ? (+g['40'] || 0) : 0;
                    for (const [kx, ky] of P2) if (g[kx] != null && g[ky] != null) {
                        x0 = Math.min(x0, +g[kx] - r); x1 = Math.max(x1, +g[kx] + r);
                        y0 = Math.min(y0, +g[ky] - r); y1 = Math.max(y1, +g[ky] + r);
                    }
                };
                for (let i = 0; i + 1 < buf.length; i += 2) {
                    if (buf[i] === '0') { flush(); ent = buf[i + 1]; g = {}; } else if (!(buf[i] in g)) g[buf[i]] = buf[i + 1];
                }
                flush();
                return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: -1, y0: -1, x1: 1, y1: 1 };
            }
            for (const it of items) it.bb = it.kind === 'blk' ? _csBlockBBox(it.key, it.scale) : bboxOf(symbolOf(it, 0, 0));

            // Kích thước cột
            const TXT = 1.7, PADY = 1.2;
            const symColW = Math.max(14, ...items.map(it => it.bb.x1 - it.bb.x0 + 4));
            const maxLabel = Math.max(10, ...items.map(it => it.label.length));
            const descW = Math.max(52, maxLabel * TXT * 0.82 + 4);
            const unitW = 12, qtyW = 16;
            const boxW = symColW + descW + unitW + qtyW;
            for (const it of items) it.h = Math.max(6, it.bb.y1 - it.bb.y0 + 2 * PADY);
            const titleH = 8, headH = 6;
            const tableH = items.length ? headH + items.reduce((a, it) => a + it.h, 0) : 0;
            const rowH = 6;
            const lampSepH = lampRows.length > 0 ? 7 : 0;
            const boxH = titleH + tableH + lampSepH + lampRows.length * rowH + 4;
            const bx = mapBounds.minX;
            const byTop = mapBounds.minY - 5;
            const byBot = byTop - boxH;
            const F = v => v.toFixed(4);
            const ln = (x1, y1, x2, y2) => push('0', 'LINE', '8', '0', '10', F(x1), '20', F(y1), '30', '0', '11', F(x2), '21', F(y2), '31', '0');
            const tx = (x, y, h, str) => { push('0', 'TEXT', '8', '0'); push('10', F(x), '20', F(y), '30', '0'); push('40', String(h)); push('1', escape(str)); };

            // Khung ngoài + tiêu đề
            ln(bx, byTop, bx + boxW, byTop); ln(bx + boxW, byTop, bx + boxW, byBot);
            ln(bx + boxW, byBot, bx, byBot); ln(bx, byBot, bx, byTop);
            tx(bx + 3, byTop - 5, 3.0, 'Chú Thích:');

            // Bảng 4 cột
            const cX = [bx, bx + symColW, bx + symColW + descW, bx + symColW + descW + unitW, bx + boxW];
            const tTop = byTop - titleH, tBot = tTop - tableH;
            let yCur = tTop;
            if (items.length) {
                ln(bx, tTop, bx + boxW, tTop);
                for (let i = 1; i < 4; i++) ln(cX[i], tTop, cX[i], tBot);
                yCur = tTop - headH;
                ln(bx, yCur, bx + boxW, yCur);
                tx(cX[0] + 1.5, tTop - 4, TXT, 'Ký hiệu');
                tx(cX[1] + 1.5, tTop - 4, TXT, 'Diễn giải');
                tx(cX[2] + 1.5, tTop - 4, TXT, 'ĐVT');
                tx(cX[3] + 1.5, tTop - 4, TXT, 'Số lượng');
            }
            for (const it of items) {
                const yc = yCur - it.h / 2;
                const cx = (cX[0] + cX[1]) / 2;
                const ox = cx - (it.bb.x0 + it.bb.x1) / 2, oy = yc - (it.bb.y0 + it.bb.y1) / 2;
                push(...symbolOf(it, ox, oy));
                tx(cX[1] + 1.5, yc - TXT / 2, TXT, it.label);
                tx(cX[2] + 1.5, yc - TXT / 2, TXT, it.unit || _legendUnit(it.kind, it.key));
                if (it.qty) tx(cX[4] - 1.5 - it.qty.length * TXT * 0.62, yc - TXT / 2, TXT, it.qty);
                yCur -= it.h;
                ln(bx, yCur, bx + boxW, yCur);
            }
            const symX = bx + 5;
            const textX = bx + 12;

            // ── Phần THÔNG TIN ĐÈN/TRỤ ──
            if (lampRows.length > 0) {
                // Separator line + label
                push('0', 'LINE', '8', '0',
                    '10', bx.toFixed(4), '20', yCur.toFixed(4), '30', '0',
                    '11', (bx + boxW).toFixed(4), '21', yCur.toFixed(4), '31', '0');
                yCur -= 1.5;
                push('0', 'TEXT', '8', '0');
                push('10', (bx + 3).toFixed(4), '20', (yCur - 2).toFixed(4), '30', '0');
                push('40', '2.0');
                push('1', escape('Thông tin đèn/trụ:'));
                yCur -= 5.5;

                // Cột số lượng bắt đầu từ vị trí cố định
                const countX = bx + boxW - 3;
                for (const [key, count] of lampRows) {
                    const parts = key.split('|');
                    const loaiDen  = parts[0] || '';
                    const congSuat = parts[1] ? parts[1] + 'W' : '';
                    const soLuong  = parseInt(parts[2]) || 1;
                    const soLuongTxt = soLuong > 1 ? '×' + soLuong + ' bóng' : '1 bóng';
                    const label = [loaiDen, congSuat, soLuongTxt].filter(Boolean).join(' ');

                    // Mini lamp symbol: cột + vòng tròn nhỏ trên đỉnh
                    push('0', 'LINE', '8', '0',
                        '10', symX.toFixed(4), '20', (yCur - 2).toFixed(4), '30', '0',
                        '11', symX.toFixed(4), '21', yCur.toFixed(4), '31', '0');
                    push('0', 'CIRCLE', '8', '0');
                    push('10', symX.toFixed(4), '20', yCur.toFixed(4), '30', '0');
                    push('40', '1.2');

                    // Tên đèn
                    push('0', 'TEXT', '8', '0');
                    push('10', textX.toFixed(4), '20', (yCur - 1.5).toFixed(4), '30', '0');
                    push('40', '1.7');
                    push('1', escape(label || '(chưa ghi)'));

                    // Số lượng trụ (căn phải thủ công — chèn đủ khoảng cách)
                    const countStr = String(count) + ' trụ';
                    push('0', 'TEXT', '8', '0');
                    push('10', (countX - countStr.length * 0.95).toFixed(4), '20', (yCur - 1.5).toFixed(4), '30', '0');
                    push('40', '1.7');
                    push('1', escape(countStr));

                    yCur -= rowH;
                }
            }

            // Expand bounds để include legend
            if (bx < arguments[2].__legendExtendX || arguments[2].__legendExtendX == null) {
                mapBounds.__legendMinY = byBot - 5;
            }
        }

        // ─────────────────────────────────────────────────────────────
        // P60: SƠ ĐỒ NGUYÊN LÝ (Single-line electric diagram)
        // Layout: grid mỗi tủ 1 hàng, trụ xếp ngang, cáp nối liền
        // Tọa độ giả (không dùng lat/lon) — schematic diagram
        // ─────────────────────────────────────────────────────────────
        async function _generateSingleLineDrawing(opts) {
            const filters = opts.filters || {};
            const rows = _filterRowsForCadExport(filters);
            if (rows.length === 0) throw new Error('Filter không match marker nào');

            // Group by tủ điều khiển
            const byTu = new Map();
            rows.forEach(r => {
                const tu = String(r[7] || '').trim() || '(chưa gán tủ)';
                if (!byTu.has(tu)) byTu.set(tu, []);
                byTu.get(tu).push(r);
            });

            // Sort trụ trong mỗi tủ (natural sort — VD C1.02 < C1.10 < C1.20)
            const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
            for (const [tu, list] of byTu) {
                list.sort((a, b) => collator.compare(String(a[1] || ''), String(b[1] || '')));
            }
            const tuNames = [...byTu.keys()].sort((a, b) => collator.compare(a, b));

            // Layout constants (mét, không phải mm)
            const ROW_H       = 60;   // gap giữa các hàng tủ
            const COL_W       = 15;   // gap ngang giữa các trụ
            const POLE_H      = 8;    // chiều cao cột dọc trụ
            const TU_X        = -30;  // vị trí X của tủ (bên trái)
            const GROUND_X    = -18;  // vị trí X của cọc tiếp địa
            const TU_HW       = 4;    // half-width tủ (rectangle 8m)
            const CABLE_Y_OFF = POLE_H / 2;   // đường cáp ngang ở giữa cột dọc

            // Track max width để "Đến lưới hạ thế" đặt đúng
            let maxColsGlobal = 0;
            byTu.forEach(list => {
                const cnt = list.filter(r => {
                    const t = parseInt(r[6]);
                    return t >= 1 && t <= 4;
                }).length;
                if (cnt > maxColsGlobal) maxColsGlobal = cnt;
            });
            const rightEndX = maxColsGlobal * COL_W + 15;   // vị trí "Đến lưới hạ thế"

            const L = [];
            const push = (...args) => args.forEach(a => L.push(String(a)));
            push('0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC');
            // TABLES/STYLE — Times New Roman cho font tiếng Việt
            push('0', 'SECTION', '2', 'TABLES');
            push('0', 'TABLE', '2', 'STYLE', '70', '1');
            push('0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0', '41', '1',
                 '50', '0', '71', '0', '42', '2.5', '3', 'times.ttf', '4', '');
            push('0', 'ENDTAB', '0', 'ENDSEC');
            push('0', 'SECTION', '2', 'ENTITIES');

            // Track bounds + used states cho auto-legend
            const bounds = { minX: TU_X - 30, minY: 0, maxX: rightEndX + 15, maxY: 15 };
            const usedStates = new Set();
            const usedCableStates = new Set();
            const stateCounts = new Map();
            const _cnt = k => stateCounts.set(k, (stateCounts.get(k) || 0) + 1);

            // Draw mỗi tủ 1 hàng
            tuNames.forEach((tuName, rowIdx) => {
                const tuY = -rowIdx * ROW_H;
                const poles = byTu.get(tuName);
                const polesOnly = poles.filter(r => {
                    const t = parseInt(r[6]);
                    return t >= 1 && t <= 4;
                });

                // Ký hiệu tủ (chung với mặt bằng) cao 8 m tại TU_X
                const tuY1 = tuY - TU_HW, tuY2 = tuY + TU_HW;
                const tuX1 = TU_X - TU_HW * CAB_SYM_RATIO, tuX2 = TU_X + TU_HW * CAB_SYM_RATIO;
                _drawCabinetGeom(push, TU_X, tuY, TU_HW * 2);
                usedStates.add('cab'); _cnt('cab');

                // Cabinet name label (dưới tủ)
                push('0', 'TEXT', '8', '0');
                push('10', (TU_X - 5).toFixed(4), '20', (tuY - TU_HW - 4).toFixed(4), '30', '0');
                push('40', '2.5');
                push('1', _dxfEscape(tuName));

                // "Đến lưới hạ thế" — bên trái tủ với arrow
                push('0', 'TEXT', '8', '0');
                push('10', (tuX1 - 24).toFixed(4), '20', (tuY - 1).toFixed(4), '30', '0');
                push('40', '2.0');
                push('1', _dxfEscape('Đến lưới hạ thế'));
                push('0', 'LINE', '8', '0', '10', (tuX1 - 2).toFixed(4), '20', tuY.toFixed(4), '30', '0', '11', tuX1.toFixed(4), '21', tuY.toFixed(4), '31', '0');
                // Arrow tip vào tủ
                push('0', 'LINE', '8', '0', '10', (tuX1 - 1.5).toFixed(4), '20', (tuY + 0.6).toFixed(4), '30', '0', '11', tuX1.toFixed(4), '21', tuY.toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', (tuX1 - 1.5).toFixed(4), '20', (tuY - 0.6).toFixed(4), '30', '0', '11', tuX1.toFixed(4), '21', tuY.toFixed(4), '31', '0');

                // Cọc tiếp địa ⊥ tại GROUND_X (giữa tủ và trụ đầu)
                push('0', 'LINE', '8', '0', '10', GROUND_X.toFixed(4), '20', tuY.toFixed(4), '30', '0', '11', GROUND_X.toFixed(4), '21', (tuY - 4).toFixed(4), '31', '0');
                const gwArr = [1.8, 1.2, 0.6];
                gwArr.forEach((w, gi) => {
                    const yh = tuY - 4 - gi * 0.5;
                    push('0', 'LINE', '8', '0', '10', (GROUND_X - w).toFixed(4), '20', yh.toFixed(4), '30', '0', '11', (GROUND_X + w).toFixed(4), '21', yh.toFixed(4), '31', '0');
                });
                usedStates.add('pole_moi_tiepdia'); _cnt('pole_moi_tiepdia');
                // Wire ground → cabinet
                push('0', 'LINE', '8', '0', '10', tuX2.toFixed(4), '20', tuY.toFixed(4), '30', '0', '11', (GROUND_X - 1.8).toFixed(4), '21', tuY.toFixed(4), '31', '0');

                // Horizontal main busbar từ cabinet → cuối hàng
                if (polesOnly.length > 0) {
                    const cableY = tuY + CABLE_Y_OFF;
                    // Từ tủ (top-right) lên đến busbar height
                    push('0', 'LINE', '8', '0', '10', tuX2.toFixed(4), '20', tuY2.toFixed(4), '30', '0', '11', tuX2.toFixed(4), '21', cableY.toFixed(4), '31', '0');
                    // Busbar ngang từ cabinet-right đến trụ cuối cùng
                    const lastPoleX = (polesOnly.length - 1) * COL_W;
                    push('0', 'LINE', '8', '0', '10', tuX2.toFixed(4), '20', cableY.toFixed(4), '30', '0', '11', lastPoleX.toFixed(4), '21', cableY.toFixed(4), '31', '0');
                    // Track cable state (first pole cable spec — dùng cho legend)
                    const firstCable = String(polesOnly[0][22] || 'noi').trim();
                    usedCableStates.add(firstCable);
                }

                // Draw mỗi trụ
                polesOnly.forEach((r, colIdx) => {
                    const poleX = colIdx * COL_W;
                    // v156 — block đèn 1–4 bóng (đồng bộ bản vẽ mặt bằng), ô vuông nằm trên đường cáp ngang,
                    // bóng vươn ±Y (cao nhất ~4.2m → dưới nhãn pha ở POLE_H+2, trên nhãn tên ở -3)
                    const nLamp = Math.min(4, Math.max(1, parseInt(r[21]) || 1));
                    _rlDrawLampBlock(push, poleX, tuY + CABLE_Y_OFF, nLamp, 1);
                    usedStates.add('pole_lamp' + nLamp); _cnt('pole_lamp' + nLamp);

                    // Phase label above (A/B/C)
                    const phase = String(r[26] || '').trim();
                    if (phase) {
                        push('0', 'TEXT', '8', '0');
                        push('10', (poleX - 0.7).toFixed(4), '20', (tuY + POLE_H + 2).toFixed(4), '30', '0');
                        push('40', '2.5');
                        push('1', _dxfEscape(phase));
                    }

                    // Name label below (tên trụ)
                    const name = String(r[1] || '').trim();
                    push('0', 'TEXT', '8', '0');
                    push('10', (poleX - 3).toFixed(4), '20', (tuY - 3).toFixed(4), '30', '0');
                    push('40', '2.0');
                    push('1', _dxfEscape(name));
                });

                // Update bounds
                bounds.minY = Math.min(bounds.minY, tuY - TU_HW - 8);
                bounds.maxY = Math.max(bounds.maxY, tuY + POLE_H + 5);
            });

            // === POLISH: Frame + Title block (reuse P59 helpers) — 'none' = chỉ dữ liệu ===
            if (!_cgIsNoTitle(opts.templateId)) {
            // Auto override NOI_DUNG_BV cho single-line
            const template = TITLE_TEMPLATES[opts.templateId] || TITLE_TEMPLATES.state;
            const md = {};
            template.fields.forEach(f => {
                const v = opts.metadata ? opts.metadata[f.key] : null;
                md[f.key] = (v != null && v !== '') ? v
                    : (typeof f.default === 'function' ? f.default() : f.default);
            });
            md.NOI_DUNG_BV = 'SƠ ĐỒ NGUYÊN LÝ HỆ THỐNG CHIẾU SÁNG';
            // SHBV suffix 13 cho single-line
            if (md.SHBV_PATTERN && md.SHBV_PATTERN.includes('XX')) {
                md.SHBV_PATTERN = md.SHBV_PATTERN.replace(/-\d{2}-XX$/, '-13-XX')
                                                  .replace(/-\d{2}$/, '-13');
            }

            // Expand bounds cho title block (right side)
            if (opts.templateId === 'state' || !opts.templateId) {
                const tbW = 80;
                const tbH = 260;
                if ((bounds.maxY - bounds.minY) < tbH) {
                    bounds.minY -= tbH - (bounds.maxY - bounds.minY);
                }
                bounds.maxX += tbW + 10;
            } else if (opts.templateId === 'dienluc') {
                bounds.minY -= 65;
                if ((bounds.maxX - bounds.minX) < 320) {
                    bounds.minX = bounds.maxX - 320;
                }
            } else if (opts.templateId === 'knop12') {
                bounds.minY -= 65;
                if ((bounds.maxX - bounds.minX) < 320) {
                    bounds.minX = bounds.maxX - 320;
                }
                bounds.maxY += 25; // chỗ cho title strip phía trên
            }

            // Enforce A3 landscape aspect ratio (width ≥ height × 420/297)
            {
                const a3W = (bounds.maxY - bounds.minY) * (420 / 297);
                if (bounds.maxX - bounds.minX < a3W) {
                    bounds.minX -= a3W - (bounds.maxX - bounds.minX);
                }
            }

            // Frame outer + inner (TCVN 7285)
            const M = 20, IM = 5;
            const fox1 = (bounds.minX - M).toFixed(4);
            const foy1 = (bounds.minY - M).toFixed(4);
            const fox2 = (bounds.maxX + M).toFixed(4);
            const foy2 = (bounds.maxY + M).toFixed(4);
            push('0', 'LINE', '8', '0', '10', fox1, '20', foy1, '30', '0', '11', fox2, '21', foy1, '31', '0');
            push('0', 'LINE', '8', '0', '10', fox2, '20', foy1, '30', '0', '11', fox2, '21', foy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fox2, '20', foy2, '30', '0', '11', fox1, '21', foy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fox1, '20', foy2, '30', '0', '11', fox1, '21', foy1, '31', '0');
            const fix1 = (bounds.minX - M + IM).toFixed(4);
            const fiy1 = (bounds.minY - M + IM).toFixed(4);
            const fix2 = (bounds.maxX + M - IM).toFixed(4);
            const fiy2 = (bounds.maxY + M - IM).toFixed(4);
            push('0', 'LINE', '8', '0', '10', fix1, '20', fiy1, '30', '0', '11', fix2, '21', fiy1, '31', '0');
            push('0', 'LINE', '8', '0', '10', fix2, '20', fiy1, '30', '0', '11', fix2, '21', fiy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fix2, '20', fiy2, '30', '0', '11', fix1, '21', fiy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fix1, '20', fiy2, '30', '0', '11', fix1, '21', fiy1, '31', '0');

            // Title block — dispatch state / dienluc
            const sheetIdx = opts._sheetIdx || 1;
            const sheetTotal = opts._sheetTotal || 1;
            if (opts.templateId === 'state' || !opts.templateId) {
                const tbW = 80;
                const innerRight = bounds.maxX + M - IM;
                const innerBottom = bounds.minY - M + IM;
                const tbX = innerRight - tbW;
                const tbY = innerBottom;
                const tbHFull = 260; // fixed height — do not scale with frame
                _drawTitleBlockStateFull(push, _dxfEscape, _wrapText, md, tbX, tbY, sheetIdx, sheetTotal, tbHFull);
            } else if (opts.templateId === 'dienluc') {
                const innerLeft = bounds.minX - M + IM;
                const innerRight = bounds.maxX + M - IM;
                const innerBottom = bounds.minY - M + IM;
                const tbW = innerRight - innerLeft;
                md.TEN_BAN_VE = 'SƠ ĐỒ NGUYÊN LÝ HỆ THỐNG CHIẾU SÁNG';
                _drawTitleBlockDienluc(push, _dxfEscape, _wrapText, md, innerLeft, innerBottom, sheetIdx, sheetTotal, tbW);
            } else if (opts.templateId === 'knop12') {
                const innerLeft = bounds.minX - M + IM;
                const innerRight = bounds.maxX + M - IM;
                const innerBottom = bounds.minY - M + IM;
                const tbW = innerRight - innerLeft;
                md.TIEU_DE_BV = 'SƠ ĐỒ NGUYÊN LÝ HỆ THỐNG CHIẾU SÁNG';
                _drawTitleBlockKnop12(push, _dxfEscape, _wrapText, md, innerLeft, innerBottom, sheetIdx, sheetTotal, tbW, 1);
                _drawKnop12TitleStrip(push, _dxfEscape, innerLeft, innerRight, bounds.maxY + M - IM, md, 1000);
            }

            // Auto-legend (sơ đồ nguyên lý — lấy lampSpecs từ rows)
            // Cáp: liệt kê mọi loại có số mét (không chỉ loại cáp của trụ đầu mỗi tủ)
            const cableMeters = _legendCableMeters(rows);
            for (const k of cableMeters.keys()) usedCableStates.add(k);
            _drawAutoLegend(push, _dxfEscape, { minX: bounds.minX + 20, minY: 0, maxX: bounds.maxX, maxY: bounds.maxY }, usedStates, usedCableStates, _buildLampSpecs(rows),
                { states: stateCounts, cables: cableMeters });
            }

            // Patch HEADER — extents + khung nhìn để mở ra thấy nội dung ngay
            L.splice(0, 6, '0', 'SECTION', '2', 'HEADER',
                ..._dxfHeaderView(bounds, 20), '0', 'ENDSEC');
            _dxfInjectActiveVport(L, bounds, 20);

            push('0', 'ENDSEC', '0', 'EOF');
            return L.join('\r\n');
        }

        // ─────────────────────────────────────────────────────────────
        // P68: BOM (Bill of Materials) — auto-gen bảng vật tư từ data
        // Group by: loại + công suất đèn + số bóng | loại tủ | loại cáp
        // Output: Excel .xlsx + PDF
        // ─────────────────────────────────────────────────────────────
        function _aggregateBom(rows) {
            const items = {};   // key → { name, unit, count }
            const addItem = (key, name, unit, count) => {
                if (!items[key]) items[key] = { name, unit, count: 0 };
                items[key].count += count;
            };
            let totalCableM = 0;
            const cableByLoaiCap = {};
            rows.forEach(r => {
                const type = parseInt(r[6]);
                const loaiDen = String(r[10] || '').trim();
                const congSuat = String(r[11] || '').trim();
                const soLuong = parseInt(r[21]) || 1;
                const heightM = parseFloat(r[27]) || 0;
                if (type >= 1 && type <= 4) {
                    // Trụ đèn
                    const heightLbl = heightM > 0 ? `${heightM}m` : '';
                    const key = `pole_${type}_${loaiDen}_${congSuat}_${soLuong}_${heightLbl}`;
                    const name = `Trụ đèn cao ${heightLbl || '?'} lắp ${soLuong} bộ đèn ${loaiDen || 'LED'} ${congSuat}`;
                    addItem(key, name, 'Bộ', 1);
                } else if (type === 5 || type === 6) {
                    // Tủ điều khiển
                    addItem('cabinet_' + type, type === 5 ? 'Tủ điều khiển chiếu sáng nổi' : 'Tủ điều khiển chiếu sáng ngầm', 'Cái', 1);
                }
                // Cable
                const parent = String(r[14] || '').trim();
                const dist = parseFloat(r[15]) || 0;
                if (parent && dist > 0) {
                    const cableSpec = String(r[28] || '').trim() || 'CXV/DSTA (chưa spec)';
                    cableByLoaiCap[cableSpec] = (cableByLoaiCap[cableSpec] || 0) + dist;
                    totalCableM += dist;
                }
            });
            // Convert cable byLoaiCap to items
            Object.entries(cableByLoaiCap).forEach(([spec, m]) => {
                addItem('cable_' + spec, `Cáp ${spec}`, 'm', Math.round(m));
            });
            // Cọc tiếp địa: 1 cái mỗi tủ
            const cabCount = Object.values(items).filter((_, i) => Object.keys(items)[i].startsWith('cabinet_')).reduce((s, x) => s + x.count, 0);
            if (cabCount > 0) addItem('tiepdia', 'Cọc tiếp địa', 'Cái', cabCount);
            return Object.values(items).sort((a, b) => a.name.localeCompare(b.name));
        }

        async function _exportBomExcel(rows, opts) {
            const items = _aggregateBom(rows);
            if (items.length === 0) { displayError && displayError('Không có dữ liệu để tạo BOM.'); return; }
            const ExcelJS = await _loadExcelJS();
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('BOM', { views: [{ state: 'frozen', ySplit: 5 }] });
            // Header info
            ws.mergeCells('A1:D1');
            ws.getCell('A1').value = 'BẢNG VẬT TƯ THIẾT BỊ (BOM)';
            ws.getCell('A1').font = { size: 14, bold: true };
            ws.getCell('A1').alignment = { horizontal: 'center' };
            ws.getCell('A2').value = 'Dự án:';
            ws.getCell('B2').value = (opts && opts.metadata && opts.metadata.DU_AN) || '(chưa nhập)';
            ws.getCell('A3').value = 'Gói thầu:';
            ws.getCell('B3').value = ((opts && opts.metadata && opts.metadata.GOI_THAU_CODE) || '') + ' — ' + ((opts && opts.metadata && opts.metadata.GOI_THAU_DOAN) || '');
            ws.getCell('A4').value = 'Ngày lập:';
            ws.getCell('B4').value = new Date().toLocaleDateString('vi-VN');
            // Table header
            ws.getRow(5).values = ['STT', 'Tên vật tư / thiết bị', 'Đơn vị', 'Số lượng'];
            ws.getRow(5).font = { bold: true };
            ws.getRow(5).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; c.border = { top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}}; });
            // Data
            items.forEach((it, i) => {
                const row = ws.getRow(6 + i);
                row.values = [i + 1, it.name, it.unit, it.count];
                row.eachCell(c => { c.border = { top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}}; });
                row.getCell(4).numFmt = '#,##0';
            });
            ws.getColumn(1).width = 6;
            ws.getColumn(2).width = 50;
            ws.getColumn(3).width = 10;
            ws.getColumn(4).width = 12;
            const buf = await wb.xlsx.writeBuffer();
            const stamp = _dateStamp();
            _saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `bom-vat-tu-${stamp}.xlsx`);
            displayInfo && displayInfo(`✅ Đã xuất BOM Excel (${items.length} mục)`);
        }
        window._exportBomExcel = _exportBomExcel;

        // Nút UI trigger — được add trong CAD Generator modal footer
        async function _onCgExportBom() {
            const rows = _filterRowsForCadExport(_cgCurrentFilters);
            if (!rows || rows.length === 0) { displayError && displayError('Filter không match marker'); return; }
            const opts = { metadata: _collectMetadata() };
            try {
                await _exportBomExcel(rows, opts);
            } catch (err) {
                console.error('[BOM]', err);
                displayError && displayError('Lỗi xuất BOM: ' + err.message);
            }
        }
        window._onCgExportBom = _onCgExportBom;

        // ─────────────────────────────────────────────────────────────
        // P69: Tính toán điện — sụt áp ΔU, dòng I, công suất P theo IEC 60364
        // ─────────────────────────────────────────────────────────────
        const CABLE_ELECTRICAL_SPECS = {
            'CXV/DSTA 4X25MM²-0,6/1kV':          { R100m: 0.727, X100m: 0.078, Imax: 106 },
            'CXV/DSTA 4X16MM²-0,6/1kV':          { R100m: 1.15,  X100m: 0.082, Imax: 80 },
            'CXV/DSTA 4X10MM²-0,6/1kV + C25MM²': { R100m: 1.83,  X100m: 0.086, Imax: 63 },
            'CXV/DSTA 4X10MM²-0,6/1kV + C16MM²': { R100m: 1.83,  X100m: 0.086, Imax: 63 },
            'CXV/DSTA 4X6MM²-0,6/1kV':           { R100m: 3.05,  X100m: 0.089, Imax: 46 },
            'CXV/DSTA 4X4MM²-0,6/1kV':           { R100m: 4.57,  X100m: 0.092, Imax: 36 }
        };
        const U_RATED = 380;   // V (3 pha)
        const COS_PHI = 0.85;
        const SIN_PHI = Math.sqrt(1 - COS_PHI * COS_PHI);

        function _calcCabinetElectrical(rows, cabName) {
            const cabRows = rows.filter(r => String(r[7] || '').trim() === cabName);
            const poles = cabRows.filter(r => { const t = parseInt(r[6]); return t >= 1 && t <= 4; });
            let totalP_W = 0;
            const perPole = [];
            poles.forEach(r => {
                const congSuatVal = parseFloat(String(r[11] || '').replace(/[^\d.]/g, '')) || 0;
                const soLuong = parseInt(r[21]) || 1;
                const P_W = congSuatVal * soLuong;
                totalP_W += P_W;
                perPole.push({ name: String(r[1] || ''), P_W, cableSpec: String(r[28] || ''), dist_m: parseFloat(r[15]) || 0 });
            });
            const totalP_kW = totalP_W / 1000;
            const totalI_A = totalP_W / (Math.sqrt(3) * U_RATED * COS_PHI);
            // Sụt áp gần đúng: giả sử load tập trung cuối tuyến với dòng I_max
            let maxDeltaU_pct = 0;
            let maxAtPole = '';
            let accumL = 0;
            perPole.forEach(p => {
                accumL += p.dist_m;
                const spec = CABLE_ELECTRICAL_SPECS[p.cableSpec];
                if (!spec || accumL === 0) return;
                const I = p.P_W / (Math.sqrt(3) * U_RATED * COS_PHI);
                const R = spec.R100m * accumL / 100;
                const X = spec.X100m * accumL / 100;
                const dU_V = Math.sqrt(3) * I * (R * COS_PHI + X * SIN_PHI);
                const dU_pct = (dU_V / U_RATED) * 100;
                if (dU_pct > maxDeltaU_pct) { maxDeltaU_pct = dU_pct; maxAtPole = p.name; }
            });
            return {
                cabName,
                poleCount: poles.length,
                totalP_kW: totalP_kW.toFixed(2),
                totalI_A: totalI_A.toFixed(2),
                maxDeltaU_pct: maxDeltaU_pct.toFixed(2),
                maxAtPole,
                usagePercent: (totalP_kW / 10 * 100).toFixed(1),
                warning: maxDeltaU_pct > 5 ? '⚠ Sụt áp vượt 5%' : (totalP_kW > 9.5 ? '⚠ Gần đầy tủ (>95%)' : '✓ OK')
            };
        }

        async function _exportElectricalExcel(rows, opts) {
            const cabinets = [...new Set(rows.map(r => String(r[7] || '').trim()).filter(Boolean))];
            if (cabinets.length === 0) { displayError && displayError('Không có tủ nào'); return; }
            const results = cabinets.map(c => _calcCabinetElectrical(rows, c));
            const ExcelJS = await _loadExcelJS();
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Tính toán điện');
            ws.mergeCells('A1:H1');
            ws.getCell('A1').value = 'BẢNG TÍNH TOÁN ĐIỆN (IEC 60364)';
            ws.getCell('A1').font = { size: 14, bold: true };
            ws.getCell('A1').alignment = { horizontal: 'center' };
            ws.getRow(3).values = ['STT', 'Tủ', 'Số trụ', 'Công suất (kW)', 'Sử dụng %', 'Dòng (A)', 'ΔU max %', 'Tại trụ', 'Trạng thái'];
            ws.getRow(3).font = { bold: true };
            ws.getRow(3).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; c.border = { top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}}; });
            results.forEach((r, i) => {
                const row = ws.getRow(4 + i);
                row.values = [i + 1, r.cabName, r.poleCount, r.totalP_kW, r.usagePercent + '%', r.totalI_A, r.maxDeltaU_pct + '%', r.maxAtPole || '-', r.warning];
                row.eachCell(c => { c.border = { top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}}; });
                // Color status
                const sc = row.getCell(9);
                if (r.warning.startsWith('⚠')) sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                else sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            });
            ws.getColumn(1).width = 6;
            ws.getColumn(2).width = 20;
            [3,4,5,6,7,8,9].forEach(i => ws.getColumn(i).width = 12);
            const buf = await wb.xlsx.writeBuffer();
            _saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `tinh-toan-dien-${_dateStamp()}.xlsx`);
            displayInfo && displayInfo(`✅ Đã xuất tính toán điện (${results.length} tủ)`);
        }
        window._exportElectricalExcel = _exportElectricalExcel;

        // ─────────────────────────────────────────────────────────────
        // P70: Compile hồ sơ đầy đủ → ZIP chứa tất cả artifacts
        // (Full PDF merge cần pdf-lib phức tạp; MVP dùng zip đa file)
        // Include: mặt bằng DXF, sơ đồ nguyên lý DXF, bình đồ tổng thể DXF,
        //          BOM Excel, tính điện Excel, dấu+chữ ký PNG, README hồ sơ
        // ─────────────────────────────────────────────────────────────
        async function _onCgCompileFullDossier() {
            const rows = _filterRowsForCadExport(_cgCurrentFilters);
            if (!rows || rows.length === 0) { displayError && displayError('Filter không match marker'); return; }
            if (!confirm('Compile hồ sơ đầy đủ (3 bản vẽ DXF + BOM Excel + tính điện Excel + dấu/chữ ký). Có thể mất 30-60s. Tiếp tục?')) return;

            const btn = document.getElementById('cgBtnDossier');
            const oldText = btn ? btn.textContent : '';
            if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang compile...'; }

            try {
                const JSZip = await _loadJSZip();
                const zip = new JSZip();
                const stamp = _dateStamp();
                const cbOut = document.getElementById('cgExcludeOutliers');
                const cbStamps = document.getElementById('cgShowStamps');
                const stampsMeta = (cbStamps && cbStamps.checked) ? _collectStampsMeta() : null;
                const baseOpts = {
                    templateId: document.getElementById('cgTemplateId').value,
                    metadata: _collectMetadata(),
                    filters: _cgCurrentFilters,
                    outputOffset: { dE: 0, dN: 0 },
                    paper: 'a3', scale: 1000, cm: 105.75,
                    excludeOutliers: cbOut ? cbOut.checked : false,
                    stamps: stampsMeta,
                    orientByRoad: !!(document.getElementById('cgOrientByRoad') || {}).checked,  // v152
                    realBlocks: (document.getElementById('cgRealBlocks') || { checked: true }).checked !== false
                };
                const results = [];

                // 1. Mặt bằng bố trí DXF
                if (btn) btn.textContent = '⏳ 1/5 Mặt bằng...';
                try {
                    const dxf = await _generateCadDrawing(baseOpts);
                    zip.file(`01-mat-bang-bo-tri.dxf`, dxf);
                    results.push('✓ Mặt bằng bố trí');
                } catch(e) { results.push('✗ Mặt bằng: ' + e.message); }

                // 2. Sơ đồ nguyên lý DXF
                if (btn) btn.textContent = '⏳ 2/5 Sơ đồ...';
                try {
                    const dxf = await _generateSingleLineDrawing(baseOpts);
                    zip.file(`02-so-do-nguyen-ly.dxf`, dxf);
                    results.push('✓ Sơ đồ nguyên lý');
                } catch(e) { results.push('✗ Sơ đồ nguyên lý: ' + e.message); }

                // 3. Bình đồ tổng thể DXF
                if (btn) btn.textContent = '⏳ 3/5 Bình đồ...';
                try {
                    const dxf = await _generateOverviewDrawing(baseOpts);
                    zip.file(`03-binh-do-tong-the.dxf`, dxf);
                    results.push('✓ Bình đồ tổng thể');
                } catch(e) { results.push('✗ Bình đồ tổng thể: ' + e.message); }

                // 4. BOM Excel
                if (btn) btn.textContent = '⏳ 4/5 BOM...';
                try {
                    const ExcelJS = await _loadExcelJS();
                    const items = _aggregateBom(rows);
                    const wb = new ExcelJS.Workbook();
                    const ws = wb.addWorksheet('BOM');
                    ws.mergeCells('A1:D1');
                    ws.getCell('A1').value = 'BẢNG VẬT TƯ THIẾT BỊ';
                    ws.getCell('A1').font = { size: 14, bold: true };
                    ws.getRow(3).values = ['STT', 'Tên vật tư', 'Đơn vị', 'Số lượng'];
                    ws.getRow(3).font = { bold: true };
                    items.forEach((it, i) => ws.getRow(4 + i).values = [i + 1, it.name, it.unit, it.count]);
                    ws.getColumn(2).width = 50;
                    const buf = await wb.xlsx.writeBuffer();
                    zip.file(`04-bang-vat-tu-bom.xlsx`, buf);
                    results.push('✓ BOM (' + items.length + ' mục)');
                } catch(e) { results.push('✗ BOM: ' + e.message); }

                // 5. Tính điện Excel
                if (btn) btn.textContent = '⏳ 5/5 Tính điện...';
                try {
                    const ExcelJS = await _loadExcelJS();
                    const cabinets = [...new Set(rows.map(r => String(r[7] || '').trim()).filter(Boolean))];
                    const calcs = cabinets.map(c => _calcCabinetElectrical(rows, c));
                    const wb = new ExcelJS.Workbook();
                    const ws = wb.addWorksheet('Tính điện');
                    ws.getRow(1).values = ['STT', 'Tủ', 'Số trụ', 'P (kW)', 'I (A)', 'ΔU max %', 'Trạng thái'];
                    ws.getRow(1).font = { bold: true };
                    calcs.forEach((r, i) => ws.getRow(2 + i).values = [i + 1, r.cabName, r.poleCount, r.totalP_kW, r.totalI_A, r.maxDeltaU_pct, r.warning]);
                    ws.getColumn(2).width = 20;
                    const buf = await wb.xlsx.writeBuffer();
                    zip.file(`05-tinh-toan-dien.xlsx`, buf);
                    results.push('✓ Tính điện (' + calcs.length + ' tủ)');
                } catch(e) { results.push('✗ Tính điện: ' + e.message); }

                // 6. Dấu + chữ ký (folder)
                const images = _loadStampImages ? _loadStampImages() : {};
                const imgKeys = Object.keys(images).filter(k => images[k]);
                if (imgKeys.length > 0) {
                    const folder = zip.folder('06-dau-va-chu-ky');
                    const titleMap = { cdt: 'Dau_CDT', tv: 'Dau_TV', thamdinh: 'Dau_ThamDinh',
                        chunhiem_tk: 'Ky_ChuNhiem', chutri_tk: 'Ky_ChuTri', thietke: 'Ky_ThietKe', qlcl: 'Ky_QLCL' };
                    imgKeys.forEach(k => {
                        const m = images[k].match(/^data:image\/(png|jpe?g);base64,(.+)$/);
                        if (m) folder.file(`${titleMap[k] || k}.${m[1].replace('jpeg','jpg')}`, m[2], { base64: true });
                    });
                    results.push('✓ Dấu + chữ ký (' + imgKeys.length + ' file)');
                }

                // README hồ sơ
                const md = baseOpts.metadata || {};
                const readme = `HỒ SƠ THIẾT KẾ HỆ THỐNG CHIẾU SÁNG\n` +
                    `═══════════════════════════════════════\n\n` +
                    `Dự án: ${md.DU_AN || '(chưa nhập)'}\n` +
                    `Địa điểm: ${md.DIA_DIEM || '(chưa nhập)'}\n` +
                    `Gói thầu: ${md.GOI_THAU_CODE || ''} - ${md.GOI_THAU_DOAN || ''}\n` +
                    `Chủ đầu tư: ${md.CHU_DAU_TU || '(chưa nhập)'}\n` +
                    `Tư vấn thiết kế: ${md.TU_VAN_TK || '(chưa nhập)'}\n` +
                    `Ngày lập: ${new Date().toLocaleDateString('vi-VN')}\n\n` +
                    `───────────────────────────────────────\n` +
                    `DANH MỤC HỒ SƠ:\n` +
                    `───────────────────────────────────────\n` +
                    results.map((r, i) => `  ${(i+1).toString().padStart(2,'0')}. ${r}`).join('\n') +
                    `\n\n───────────────────────────────────────\n` +
                    `HƯỚNG DẪN SỬ DỤNG:\n` +
                    `───────────────────────────────────────\n` +
                    `1. Mở các file .dxf trong AutoCAD 2021+\n` +
                    `2. Mở BOM và tính điện trong Excel/LibreOffice\n` +
                    `3. Chèn dấu/chữ ký từ folder "06-dau-va-chu-ky/" vào các bản vẽ:\n` +
                    `   - AutoCAD: Insert > Raster Image Reference\n` +
                    `   - Đặt tại 4 ô con dấu (đỉnh bản vẽ) + khung tên phải\n\n` +
                    `Bản vẽ tạo bởi Lighting Survey app — https://neo-era.github.io/lighting-survey/`;
                zip.file('README.txt', readme);

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const filename = `HO-SO-CHIEU-SANG-${stamp}.zip`;
                _saveBlob(zipBlob, filename);
                displayInfo && displayInfo(`✅ Đã compile hồ sơ (${results.filter(r => r.startsWith('✓')).length}/${results.length} thành công)`);
            } catch (err) {
                console.error('[Compile dossier]', err);
                displayError && displayError('Lỗi compile hồ sơ: ' + err.message);
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = oldText; }
            }
        }
        window._onCgCompileFullDossier = _onCgCompileFullDossier;

        async function _onCgExportElectrical() {
            const rows = _filterRowsForCadExport(_cgCurrentFilters);
            if (!rows || rows.length === 0) { displayError && displayError('Filter không match marker'); return; }
            try {
                await _exportElectricalExcel(rows, { metadata: _collectMetadata() });
            } catch (err) {
                console.error('[Electrical]', err);
                displayError && displayError('Lỗi tính toán điện: ' + err.message);
            }
        }
        window._onCgExportElectrical = _onCgExportElectrical;

        // ─────────────────────────────────────────────────────────────
        // P62: BÌNH ĐỒ TỔNG THỂ (Overview drawing)
        // Layout: 1 tờ A3 overview toàn dự án — chỉ hiện tủ (không có trụ chi tiết)
        // Compass rose góc trên-phải, ghi chú kỹ thuật dưới
        // Reference: hồ sơ Sở XD TP.HCM trang 9
        // ─────────────────────────────────────────────────────────────
        async function _generateOverviewDrawing(opts) {
            const filters = opts.filters || {};
            const allRows = _filterRowsForCadExport(filters);
            if (allRows.length === 0) throw new Error('Filter không match marker nào');

            // Chỉ giữ tủ (loại 5, 6) — bình đồ tổng thể không hiện trụ
            const cabinets = allRows.filter(r => {
                const t = parseInt(r[6]);
                return t === 5 || t === 6;
            });
            if (cabinets.length === 0) throw new Error('Không có tủ điều khiển nào trong filter (bình đồ tổng thể cần tủ)');

            const cm    = opts.cm || 105.75;
            const k0    = Math.abs(cm - 105.0) < 0.01 ? 0.9996 : 0.9999;
            const outDE = (opts.outputOffset && opts.outputOffset.dE) || 0;
            const outDN = (opts.outputOffset && opts.outputOffset.dN) || 0;

            const L = [];
            const push = (...args) => args.forEach(a => L.push(String(a)));
            push('0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC');
            push('0', 'SECTION', '2', 'TABLES');
            push('0', 'TABLE', '2', 'STYLE', '70', '1');
            push('0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0', '41', '1',
                 '50', '0', '71', '0', '42', '2.5', '3', 'times.ttf', '4', '');
            push('0', 'ENDTAB', '0', 'ENDSEC');
            push('0', 'SECTION', '2', 'ENTITIES');

            // Compute cabinet positions VN2000
            const cabPositions = [];
            let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            for (const r of cabinets) {
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (!isFinite(lat) || !isFinite(lon)) continue;
                const vn = convertLatLonToVn2000(lat, lon, cm, k0);
                const x = vn.x + outDE, y = vn.y + outDN;
                cabPositions.push({
                    name: String(r[1] || '').trim(),
                    x, y,
                    type: parseInt(r[6]),
                    row: r
                });
                bounds.minX = Math.min(bounds.minX, x);
                bounds.minY = Math.min(bounds.minY, y);
                bounds.maxX = Math.max(bounds.maxX, x);
                bounds.maxY = Math.max(bounds.maxY, y);
            }
            if (cabPositions.length === 0) throw new Error('Tất cả tủ đều thiếu lat/lon');

            // Cabinet symbol size — scale theo bounds
            let bWidth = bounds.maxX - bounds.minX;
            let bHeight = bounds.maxY - bounds.minY;
            // Guard: nếu chỉ có 1-2 tủ → bounds cực nhỏ → expand ra 200m tối thiểu để tránh overlap
            const MIN_BOUNDS = 200;
            if (bWidth < MIN_BOUNDS) {
                const pad = (MIN_BOUNDS - bWidth) / 2;
                bounds.minX -= pad;
                bounds.maxX += pad;
                bWidth = MIN_BOUNDS;
            }
            if (bHeight < MIN_BOUNDS) {
                const pad = (MIN_BOUNDS - bHeight) / 2;
                bounds.minY -= pad;
                bounds.maxY += pad;
                bHeight = MIN_BOUNDS;
            }
            const bMax = Math.max(bWidth, bHeight);
            // Auto scale: cabinet 8-20m tùy bounds project (tăng min từ 5 → 8)
            const CAB_HW = Math.max(8, Math.min(20, bMax / 30));   // half-width
            const LABEL_H = CAB_HW * 0.6;   // text height cho label
            const COORD_H = CAB_HW * 0.3;

            // Vẽ đường nối giữa tủ (nếu có Marker gốc chỉ tủ khác)
            const cabByRow = new Map();
            cabPositions.forEach(c => cabByRow.set(c.row, c));
            const _cabIdx = _rowIndex((loadedData || []).slice(1));
            for (const c of cabPositions) {
                const p = cabByRow.get(_resolveParent(c.row, _cabIdx));
                if (!p) continue;
                // Dashed line
                _drawCableSymbol(push, c.x, c.y, p.x, p.y, 'ngam');   // dash-dot pattern
            }

            // Vẽ mỗi tủ + label + coord
            const coordVisible = opts.showCoords !== false;   // default true
            cabPositions.forEach(c => {
                // Ký hiệu tủ (chung với mặt bằng), cao 2·CAB_HW
                _drawCabinetGeom(push, c.x, c.y, CAB_HW * 2);

                // Label tủ (dưới cabinet)
                push('0', 'TEXT', '8', '0');
                push('10', (c.x - CAB_HW).toFixed(4), '20', (c.y - CAB_HW - LABEL_H * 1.5).toFixed(4), '30', '0');
                push('40', LABEL_H.toFixed(2));
                push('1', _dxfEscape(c.name));

                // Coord VN2000 (bên phải cabinet)
                if (coordVisible) {
                    const coordStr = c.x.toFixed(2) + ' / ' + c.y.toFixed(2);
                    push('0', 'TEXT', '8', '0');
                    push('10', (c.x + CAB_HW * CAB_SYM_RATIO + 2).toFixed(4), '20', (c.y + CAB_HW * 0.5).toFixed(4), '30', '0');
                    push('40', COORD_H.toFixed(2));
                    push('1', _dxfEscape(coordStr));
                    push('0', 'TEXT', '8', '0');
                    push('10', (c.x + CAB_HW * CAB_SYM_RATIO + 2).toFixed(4), '20', (c.y - CAB_HW * 0.5).toFixed(4), '30', '0');
                    push('40', COORD_H.toFixed(2));
                    push('1', _dxfEscape('(VN-2000)'));
                }
            });

            // Expand bounds cho labels + coord text
            bounds.minX -= CAB_HW * 2;
            bounds.maxX += CAB_HW * 5;   // extra room for coord text (dài hơn label)
            bounds.minY -= CAB_HW * 5;   // extra for labels + ghi chú box below
            bounds.maxY += CAB_HW * 3;   // extra top for compass

            // 'none' = chỉ dữ liệu: bỏ la bàn, ghi chú, khung viền, khung tên
            if (!_cgIsNoTitle(opts.templateId)) {
            // ═══ COMPASS ROSE (góc trên-phải, cách bounds cluster để không overlap) ═══
            const compassSize = Math.max(30, bMax / 15);
            const compassGap = compassSize * 0.8;
            const cpX = bounds.maxX + compassGap;
            const cpY = bounds.maxY - compassGap;
            // 4 triangles pointing N/E/S/W từ center
            // North (nhấn mạnh — filled)
            push('0', 'SOLID', '8', '0');
            push('10', (cpX - compassSize * 0.15).toFixed(4), '20', cpY.toFixed(4), '30', '0');
            push('11', (cpX + compassSize * 0.15).toFixed(4), '21', cpY.toFixed(4), '31', '0');
            push('12', cpX.toFixed(4), '22', (cpY + compassSize * 0.5).toFixed(4), '32', '0');
            push('13', cpX.toFixed(4), '23', (cpY + compassSize * 0.5).toFixed(4), '33', '0');
            // East/South/West (contour)
            const drawArrow = (cx, cy, dxN, dyN, size) => {
                // Triangle from cx,cy pointing towards (dxN, dyN) direction
                const perpX = -dyN * size * 0.15;
                const perpY = dxN * size * 0.15;
                const tipX = cx + dxN * size * 0.5;
                const tipY = cy + dyN * size * 0.5;
                push('0', 'LINE', '8', '0', '10', (cx + perpX).toFixed(4), '20', (cy + perpY).toFixed(4), '30', '0', '11', tipX.toFixed(4), '21', tipY.toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', (cx - perpX).toFixed(4), '20', (cy - perpY).toFixed(4), '30', '0', '11', tipX.toFixed(4), '21', tipY.toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', (cx + perpX).toFixed(4), '20', (cy + perpY).toFixed(4), '30', '0', '11', (cx - perpX).toFixed(4), '21', (cy - perpY).toFixed(4), '31', '0');
            };
            drawArrow(cpX, cpY, 1, 0, compassSize);   // East
            drawArrow(cpX, cpY, 0, -1, compassSize);  // South
            drawArrow(cpX, cpY, -1, 0, compassSize);  // West
            // Labels N/E/S/W
            const labelOff = compassSize * 0.6;
            const putCompassLabel = (dx, dy, txt) => {
                push('0', 'TEXT', '8', '0');
                push('10', (cpX + dx * labelOff - 1).toFixed(4), '20', (cpY + dy * labelOff - 1).toFixed(4), '30', '0');
                push('40', (compassSize * 0.15).toFixed(2));
                push('1', txt);
            };
            putCompassLabel(0, 1, 'N');
            putCompassLabel(1, 0, 'E');
            putCompassLabel(0, -1, 'S');
            putCompassLabel(-1, 0, 'W');

            // Expand bounds cho compass
            bounds.maxX = Math.max(bounds.maxX, cpX + compassSize);
            bounds.maxY = Math.max(bounds.maxY, cpY + compassSize);

            // ═══ Pre-compute GHI CHÚ box size (defer render đến sau frame) ═══
            const cabNames = cabPositions.map(c => c.name).join(', ');
            const rawLines = [
                `1. Trong phạm vi gói thầu gồm có ${cabPositions.length} tủ điều khiển chiếu sáng: ${cabNames}`,
                `2. Tọa độ trong bản vẽ theo tọa độ VN-2000`,
                `3. Công suất mỗi tủ điều khiển chiếu sáng ≤ 10 kVA`
            ];
            if (opts.metadata && opts.metadata.GHI_CHU) {
                String(opts.metadata.GHI_CHU).split('\n').forEach((line, i) => {
                    if (line.trim()) rawLines.push(`${4 + i}. ${line.trim()}`);
                });
            }
            const noteSize = Math.max(3, bMax / 80);
            const noteRowH = noteSize * 1.6;
            // Ghi chú width = 55% inner frame width (đủ chỗ, không tràn qua title block)
            const noteBoxW = (bounds.maxX - bounds.minX) * 0.55;
            const maxCharsPerLine = Math.floor(noteBoxW / (noteSize * 0.6));
            const ghiChuLines = [];
            rawLines.forEach(raw => {
                if (raw.length <= maxCharsPerLine) ghiChuLines.push(raw);
                else _wrapText(raw, maxCharsPerLine).forEach((ln, i) => ghiChuLines.push(i === 0 ? ln : '   ' + ln));
            });
            const noteBoxH = noteSize * 2 + noteRowH * ghiChuLines.length + noteSize;
            // Reserve space cho ghi chú ở bottom (expand bounds.minY)
            bounds.minY -= noteBoxH + 10;

            // ═══ TITLE BLOCK + FRAME (reuse P59) ═══
            const template = TITLE_TEMPLATES[opts.templateId] || TITLE_TEMPLATES.state;
            const md = {};
            template.fields.forEach(f => {
                const v = opts.metadata ? opts.metadata[f.key] : null;
                md[f.key] = (v != null && v !== '') ? v
                    : (typeof f.default === 'function' ? f.default() : f.default);
            });
            md.NOI_DUNG_BV = 'BÌNH ĐỒ TỔNG THỂ HỆ THỐNG CHIẾU SÁNG';
            md.TEN_BAN_VE = 'BÌNH ĐỒ TỔNG THỂ HỆ THỐNG CHIẾU SÁNG';
            if (md.SHBV_PATTERN && md.SHBV_PATTERN.includes('XX')) {
                md.SHBV_PATTERN = md.SHBV_PATTERN.replace(/-\d{2}-XX$/, '-01-XX')
                                                  .replace(/-\d{2}$/, '-01');
            }

            // Expand bounds cho title block
            if (opts.templateId === 'state' || !opts.templateId) {
                const tbW = 80, tbH = 260;
                if ((bounds.maxY - bounds.minY) < tbH) {
                    bounds.minY -= tbH - (bounds.maxY - bounds.minY);
                }
                bounds.maxX += tbW + 10;
            } else if (opts.templateId === 'dienluc') {
                bounds.minY -= 65;
                if ((bounds.maxX - bounds.minX) < 320) {
                    bounds.minX = bounds.maxX - 320;
                }
            } else if (opts.templateId === 'knop12') {
                bounds.minY -= 65;
                if ((bounds.maxX - bounds.minX) < 320) {
                    bounds.minX = bounds.maxX - 320;
                }
                bounds.maxY += 25; // chỗ cho title strip phía trên
            }

            // Enforce A3 landscape aspect ratio (width ≥ height × 420/297)
            {
                const a3W = (bounds.maxY - bounds.minY) * (420 / 297);
                if (bounds.maxX - bounds.minX < a3W) {
                    bounds.minX -= a3W - (bounds.maxX - bounds.minX);
                }
            }

            // Frame outer + inner
            const M = 20, IM = 5;
            const fox1 = (bounds.minX - M).toFixed(4);
            const foy1 = (bounds.minY - M).toFixed(4);
            const fox2 = (bounds.maxX + M).toFixed(4);
            const foy2 = (bounds.maxY + M).toFixed(4);
            push('0', 'LINE', '8', '0', '10', fox1, '20', foy1, '30', '0', '11', fox2, '21', foy1, '31', '0');
            push('0', 'LINE', '8', '0', '10', fox2, '20', foy1, '30', '0', '11', fox2, '21', foy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fox2, '20', foy2, '30', '0', '11', fox1, '21', foy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fox1, '20', foy2, '30', '0', '11', fox1, '21', foy1, '31', '0');
            const fix1 = (bounds.minX - M + IM).toFixed(4);
            const fiy1 = (bounds.minY - M + IM).toFixed(4);
            const fix2 = (bounds.maxX + M - IM).toFixed(4);
            const fiy2 = (bounds.maxY + M - IM).toFixed(4);
            push('0', 'LINE', '8', '0', '10', fix1, '20', fiy1, '30', '0', '11', fix2, '21', fiy1, '31', '0');
            push('0', 'LINE', '8', '0', '10', fix2, '20', fiy1, '30', '0', '11', fix2, '21', fiy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fix2, '20', fiy2, '30', '0', '11', fix1, '21', fiy2, '31', '0');
            push('0', 'LINE', '8', '0', '10', fix1, '20', fiy2, '30', '0', '11', fix1, '21', fiy1, '31', '0');

            // Title block
            const sheetIdx = opts._sheetIdx || 1;
            const sheetTotal = opts._sheetTotal || 1;
            if (opts.templateId === 'state' || !opts.templateId) {
                const tbW = 80;
                const innerRight = bounds.maxX + M - IM;
                const innerBottom = bounds.minY - M + IM;
                const tbX = innerRight - tbW;
                const tbY = innerBottom;
                const tbHFull = 260; // fixed height — do not scale with frame
                _drawTitleBlockStateFull(push, _dxfEscape, _wrapText, md, tbX, tbY, sheetIdx, sheetTotal, tbHFull);
            } else if (opts.templateId === 'dienluc') {
                const innerLeft = bounds.minX - M + IM;
                const innerRight = bounds.maxX + M - IM;
                const innerBottom = bounds.minY - M + IM;
                const tbW = innerRight - innerLeft;
                _drawTitleBlockDienluc(push, _dxfEscape, _wrapText, md, innerLeft, innerBottom, sheetIdx, sheetTotal, tbW);
            } else if (opts.templateId === 'knop12') {
                const innerLeft = bounds.minX - M + IM;
                const innerRight = bounds.maxX + M - IM;
                const innerBottom = bounds.minY - M + IM;
                const tbW = innerRight - innerLeft;
                md.TIEU_DE_BV = 'BÌNH ĐỒ TỔNG THỂ HỆ THỐNG CHIẾU SÁNG';
                md.TEN_BAN_VE = (opts.metadata && opts.metadata.TEN_BAN_VE) || '';
                _drawTitleBlockKnop12(push, _dxfEscape, _wrapText, md, innerLeft, innerBottom, sheetIdx, sheetTotal, tbW, 1);
                _drawKnop12TitleStrip(push, _dxfEscape, innerLeft, innerRight, bounds.maxY + M - IM, md, 1000);
            }

            // ═══ GHI CHÚ BOX — render sát góc dưới-trái inner frame ═══
            {
                const innerLeft = bounds.minX - M + IM;
                const innerBottom = bounds.minY - M + IM;
                const noteX_left = innerLeft + 2;
                const noteX_right = noteX_left + noteBoxW;
                const noteY_bot = innerBottom + 2;
                const noteY_top = noteY_bot + noteBoxH;
                // Frame
                push('0', 'LINE', '8', '0', '10', noteX_left.toFixed(4), '20', noteY_top.toFixed(4), '30', '0', '11', noteX_right.toFixed(4), '21', noteY_top.toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', noteX_right.toFixed(4), '20', noteY_top.toFixed(4), '30', '0', '11', noteX_right.toFixed(4), '21', noteY_bot.toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', noteX_right.toFixed(4), '20', noteY_bot.toFixed(4), '30', '0', '11', noteX_left.toFixed(4), '21', noteY_bot.toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', noteX_left.toFixed(4), '20', noteY_bot.toFixed(4), '30', '0', '11', noteX_left.toFixed(4), '21', noteY_top.toFixed(4), '31', '0');
                // Header
                push('0', 'TEXT', '8', '0');
                push('10', (noteX_left + 3).toFixed(4), '20', (noteY_top - noteSize * 1.2).toFixed(4), '30', '0');
                push('40', (noteSize * 1.3).toFixed(2));
                push('1', _dxfEscape('GHI CHÚ:'));
                // Lines
                ghiChuLines.forEach((line, i) => {
                    push('0', 'TEXT', '8', '0');
                    push('10', (noteX_left + 4).toFixed(4), '20', (noteY_top - noteSize * 2.5 - i * noteRowH).toFixed(4), '30', '0');
                    push('40', noteSize.toFixed(2));
                    push('1', _dxfEscape(line));
                });
            }
            }

            // Patch HEADER — extents + khung nhìn để mở ra thấy nội dung ngay
            L.splice(0, 6, '0', 'SECTION', '2', 'HEADER',
                ..._dxfHeaderView(bounds, 20), '0', 'ENDSEC');
            _dxfInjectActiveVport(L, bounds, 20);

            push('0', 'ENDSEC', '0', 'EOF');
            return L.join('\r\n');
        }

        async function _generateCadDrawing(opts) {
            const filters = opts.filters || {};
            const rows = _filterRowsForCadExport(filters);
            if (rows.length === 0) throw new Error('Filter không match marker nào để xuất');

            const cm    = opts.cm || 105.75;
            const k0    = Math.abs(cm - 105.0) < 0.01 ? 0.9996 : 0.9999;
            const scale = opts.scale || 1000;
            const outDE = (opts.outputOffset && opts.outputOffset.dE) || 0;
            const outDN = (opts.outputOffset && opts.outputOffset.dN) || 0;

            // Xây DXF thủ công (giống createDxfForMarkers) — AutoCAD strict parser
            const L = [];
            const push = (...args) => args.forEach(a => L.push(String(a)));
            push('0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC');
            // TABLES/STYLE — bắt buộc để tiếng Việt hiển thị đúng (Times New Roman TTF)
            // txt.shx (default) KHÔNG hỗ trợ Unicode extended → thay bằng times.ttf
            push('0', 'SECTION', '2', 'TABLES');
            // LAYER — tách cáp ra lớp riêng để bật/tắt độc lập trong AutoCAD.
            // Marker + text tên trụ vẫn ở layer '0'. Nét đứt cáp được vẽ bằng nhiều LINE rời
            // (hình học) nên linetype là CONTINUOUS, không phải DASHED.
            // LTYPE phải đứng trước LAYER. CENTER (gạch chấm, chu kỳ 20m thực địa) cho tim đường OSM.
            push('0', 'TABLE', '2', 'LTYPE', '70', '2');
            push('0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0');
            push('0', 'LTYPE', '2', 'CENTER', '70', '0', '3', 'Center ____ _ ____ _ ____', '72', '65', '73', '4', '40', '20.0',
                 '49', '12.5', '49', '-2.5', '49', '2.5', '49', '-2.5');
            push('0', 'ENDTAB');
            // Block thật trích từ bản vẽ mẫu (src/core/cad-symlib.js) — tắt được trong modal → quay về ký hiệu cũ
            const _realBlocks = opts.realBlocks === true && typeof _csPickBlock === 'function';   // UI luôn truyền rõ; thiếu → ký hiệu cũ
            push('0', 'TABLE', '2', 'LAYER', '70', String(6 + (_realBlocks ? CS_LAYERS.length : 0)));
            push('0', 'LAYER', '2', '0',              '70', '0', '62', '7', '6', 'CONTINUOUS');
            push('0', 'LAYER', '2', 'LIGHTING_CABLE', '70', '0', '62', '6', '6', 'CONTINUOUS');
            push('0', 'LAYER', '2', 'OSM_TIM_DUONG',  '70', '0', '62', '1', '6', 'CENTER');
            push('0', 'LAYER', '2', 'OSM_MEP_DUONG',  '70', '0', '62', '7', '6', 'CONTINUOUS');
            push('0', 'LAYER', '2', 'OSM_TEN_DUONG',  '70', '0', '62', '3', '6', 'CONTINUOUS');
            push('0', 'LAYER', '2', 'OSM_DUONG_KHAC', '70', '0', '62', '8', '6', 'CONTINUOUS');
            // Layer trạng thái cải tạo cho block thật — màu theo layer (block con BYLAYER trên layer 0)
            if (_realBlocks) for (const _ly of CS_LAYERS) push('0', 'LAYER', '2', _ly.layer, '70', '0', '62', String(_ly.color), '6', 'CONTINUOUS');
            push('0', 'ENDTAB');
            push('0', 'TABLE', '2', 'STYLE', '70', '1');
            push('0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0', '41', '1',
                 '50', '0', '71', '0', '42', '2.5', '3', 'times.ttf', '4', '');
            push('0', 'ENDTAB', '0', 'ENDSEC');
            // BLOCKS section injected here after entity generation (if any block defs created)
            const _blocksDefL = [];
            const _entitiesStartIdx = L.length;
            push('0', 'SECTION', '2', 'ENTITIES');

            // Marker gốc giải theo dòng (ID / tên duy nhất / tên trùng gần nhất) — cha có thể ngoài bộ lọc
            const _cadIdx = _rowIndex((loadedData || []).slice(1), rows);
            let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            const posMap = new Map();  // row → {x, y}

            // Track states used (cho auto-legend Phase C)
            const _usedStates = new Set();
            const _stateCounts = new Map();   // key chú thích → số đối tượng (cột Số lượng)
            const _usedCableStates = new Set();

            // ─── Ký hiệu marker xuất ra dưới dạng BLOCK ───
            // Mỗi (type,state) chỉ định nghĩa 1 lần rồi INSERT nhiều nơi → giảm ~78% dung
            // lượng DXF ở 1000 marker, và cho phép sửa 1 block đổi toàn bộ (REFEDIT/BCOUNT).
            // Nội dung block vẽ tại gốc (0,0) trên layer '0' → entity thừa kế layer của INSERT.
            // Format block sao chép y hệt TITLE_KNOP12 bên dưới (đã xác nhận AutoCAD 2021 mở được).
            const _symBlocks = new Set();
            const _symBlockName = k => 'SYM_' + String(k).toUpperCase();

            function _ensureSymbolBlock(key, type, state, symOpts) {
                const bn = _symBlockName(key);
                if (_symBlocks.has(bn)) return bn;
                const _bl = [];
                const _bp = (...a) => { for (const v of a) _bl.push(String(v)); };
                _drawMarkerSymbol(_bp, 0, 0, type, state, symOpts);
                _blocksDefL.push(
                    '0', 'BLOCK', '8', '0', '2', bn,
                    '70', '0', '10', '0.0000', '20', '0.0000', '30', '0.0000',
                    '3', bn,
                    ..._bl,
                    '0', 'ENDBLK', '8', '0'
                );
                _symBlocks.add(bn);
                return bn;
            }

            // Bbox lat/lon của rows — dùng cho Overpass (nền OSM + hướng đường)
            let _osmBbox = null;
            {
                let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
                for (const r of rows) {
                    const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                    if (!isFinite(lat) || !isFinite(lon)) continue;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    if (lon < minLon) minLon = lon;
                    if (lon > maxLon) maxLon = lon;
                }
                // Padding ~100m để nền không "cụt" ngay biên marker
                if (isFinite(minLat)) _osmBbox = { minLat: minLat - 0.001, maxLat: maxLat + 0.001, minLon: minLon - 0.001, maxLon: maxLon + 0.001 };
            }

            // v152 — Fetch Overpass 1 LẦN trước vòng lặp: rate-limit 5s của _fetchOsmBasemap
            // sẽ chặn lần gọi thứ 2 nếu nền OSM và hướng đường fetch riêng.
            const _orientByRoad = opts.orientByRoad === true;
            const _needRoads = _orientByRoad || !!(opts.osmOptions && opts.osmOptions.roads);
            let _osmData = null, _osmErr = null;
            if (opts._osmPrefetch) {
                // Luồng nhiều tờ / batch đã fetch 1 lần cho bbox tổng (xem _cgPrefetchOsm)
                _osmData = opts._osmPrefetch.data;
                _osmErr = opts._osmPrefetch.err;
            } else if (_osmBbox && (opts.osmOptions || _orientByRoad) && typeof _fetchOsmBasemap === 'function') {
                const fetchOpts = Object.assign({ roads: false, buildings: false, water: false, admin: false },
                    opts.osmOptions || {}, { roads: _needRoads });
                try {
                    if (_orientByRoad && typeof displayInfo === 'function') displayInfo('🧭 Đang lấy hướng đường từ OSM...');
                    _osmData = await _cgFetchOsm(_osmBbox, fetchOpts, opts.signal);
                } catch (err) {
                    _osmErr = err;
                    console.warn('[CAD Gen] Overpass lỗi:', err.message);
                }
            }

            let _roadIdx = null, _parentLL = null;
            const _rlStats = { road: 0, parent: 0, none: 0 };
            if (_orientByRoad) {
                const segs = _rlRoadSegments(_osmData, cm, k0, outDE, outDN);
                _roadIdx = segs.length ? _rlBuildIndex(segs, 50) : null;
                // Vị trí trụ cha cho fallback — tra trong toàn bộ dữ liệu (cha có thể nằm ngoài bộ lọc)
                _parentLL = r => {
                    const p = _resolveParent(r, _cadIdx);
                    const la = p ? parseCoord(p[2]) : NaN, lo = p ? parseCoord(p[3]) : NaN;
                    return isFinite(la) && isFinite(lo) ? [la, lo] : null;
                };
                if (_osmErr && _osmErr.name === 'AbortError') _cgNotifyOsmSkipped();
                else if (_osmErr && typeof displayWarning === 'function') {
                    displayWarning('⚠ Không lấy được đường OSM (' + _osmErr.message + ') — block xoay theo tuyến cáp.');
                }
            }

            // Iterate markers: dispatch symbol theo (type, trangThai) — P59+
            const _csDone = new Set();        // block thật đã định nghĩa (mỗi block 1 lần)
            const _realUsed = new Map();      // 'block|layer' → dòng chú thích {block, layer, label, count, scale, unit}
            for (const r of rows) {
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (!isFinite(lat) || !isFinite(lon)) continue;
                const vn = convertLatLonToVn2000(lat, lon, cm, k0);
                const x = vn.x + outDE, y = vn.y + outDN;
                const name = String(r[1] || '').trim();
                posMap.set(r, { x, y });

                const type = parseInt(r[6]);
                const state = String(r[29] || '').trim() || 'giu';  // default = giữ nguyên
                const soLuongDen = parseInt(r[21]) || 1;
                const loaiDen = String(r[10] || '').toUpperCase();

                const _isPole = type >= 1 && type <= 4;
                // Góc xoay theo tim đường gần nhất (fallback tuyến cáp tới trụ cha) — quy ước app: 0° = đèn hướng +Y
                const _roadRot = (nLamp) => {
                    const near = _roadIdx ? _rlNearest(x, y, _roadIdx, 40) : null;
                    let parentXY = null;
                    if (!near) {
                        const pll = _parentLL(r);
                        if (pll) {
                            const pv = convertLatLonToVn2000(pll[0], pll[1], cm, k0);
                            parentXY = { x: pv.x + outDE, y: pv.y + outDN };
                        }
                    }
                    _rlStats[near ? 'road' : (parentXY ? 'parent' : 'none')]++;
                    return _rlRotation(x, y, nLamp, near, parentXY);
                };
                let _bnReal = _realBlocks ? _csPickBlock(r) : null;
                if (_bnReal && !_csDef(_bnReal)) _bnReal = null;   // thư viện thiếu block → ký hiệu cũ, không ghi INSERT treo
                const _ks = scale / 1000;
                let _lbl = null;                                    // vị trí nhãn tên (block thật)
                if (_bnReal) {
                    // Block thật (bản vẽ mẫu): chọn theo loại trụ + loại đèn + số bóng; trạng thái → layer/màu
                    const nLamp = Math.min(4, Math.max(1, soLuongDen));
                    const rotR = (_orientByRoad && _isPole) ? _csRealRot(_roadRot(nLamp)) : 0;
                    _lbl = _csLabelPos(x, y, rotR, _isPole && type !== 2 ? nLamp : 0, _ks, name.length);
                    const ly = _csStateLayer(state);
                    const sc = _csInsertScale(_bnReal, scale);
                    _blocksDefL.push(..._csBlockDxf([_bnReal], _csDone));
                    push('0', 'INSERT', '8', ly.layer, '2', _bnReal,
                         '10', x.toFixed(4), '20', y.toFixed(4), '30', '0',
                         '41', sc.toFixed(4), '42', sc.toFixed(4), '43', sc.toFixed(4), '50', rotR.toFixed(2));
                    // Tủ nổi / ngầm cùng block nhưng tách dòng chú thích
                    const _cabKind = type === 5 ? ' nổi' : (type === 6 ? ' ngầm' : '');
                    const _uk = _bnReal + '|' + ly.layer + '|' + _cabKind;
                    const _u = _realUsed.get(_uk) || { block: _bnReal, layer: ly.layer, count: 0,
                        scale: _csInsertScale(_bnReal, 1000), unit: _isPole ? 'trụ' : 'tủ',
                        label: _csLabel(_bnReal) + _cabKind + ' — ' + ly.label };
                    _u.count++;
                    _realUsed.set(_uk, _u);
                } else if (_orientByRoad && _isPole) {
                    // v152 — block đèn N bóng, xoay vuông góc tim đường (fallback: tuyến cáp tới trụ cha)
                    const nLamp = Math.min(4, Math.max(1, soLuongDen));
                    const lampState = 'lamp' + nLamp;
                    const rot = _roadRot(nLamp);
                    const _key = 'pole_' + lampState;
                    const _bn  = _ensureSymbolBlock(_key, type, lampState, { soLuongDen: nLamp });
                    push('0', 'INSERT', '8', '0', '2', _bn,
                         '10', x.toFixed(4), '20', y.toFixed(4), '30', '0', '50', rot.toFixed(2));
                    _usedStates.add(_key); _stateCounts.set(_key, (_stateCounts.get(_key) || 0) + 1);
                } else {
                    // Ký hiệu = INSERT block (định nghĩa sinh 1 lần mỗi state)
                    const _key = _stateKey(type, state);
                    const _bn  = _ensureSymbolBlock(_key, type, state, { soLuongDen, loaiDen });
                    push('0', 'INSERT', '8', '0', '2', _bn,
                         '10', x.toFixed(4), '20', y.toFixed(4), '30', '0');
                    _usedStates.add(_key); _stateCounts.set(_key, (_stateCounts.get(_key) || 0) + 1);
                }

                // TEXT label tên trụ (cao 2m thực địa @ 1:1000) — tủ rộng 6.2 m nên đẩy nhãn ra ngoài khung.
                // Block thật: đầu đèn chiếm phía +X (tới ~9m) → đặt nhãn dưới tâm trụ cho khỏi đè đầu đèn.
                push('0', 'TEXT', '8', '0');
                if (_lbl) push('10', _lbl.x.toFixed(4), '20', _lbl.y.toFixed(4), '30', '0');   // né hướng đầu đèn, co theo tỉ lệ
                else push('10', (x + (_isPole ? 3 : 4)).toFixed(4), '20', (y - 1).toFixed(4), '30', '0');
                push('40', '2.0');
                push('1', _dxfEscape(name));

                const _pad = _bnReal ? Math.max(5, 10 * _ks) : 5;   // X4 @1:2000 vươn ~17m
                bounds.minX = Math.min(bounds.minX, x - _pad);
                bounds.minY = Math.min(bounds.minY, y - _pad);
                bounds.maxX = Math.max(bounds.maxX, x + _pad);
                bounds.maxY = Math.max(bounds.maxY, y + _pad);
            }
            // Expose used sets + lamp specs for legend generator
            opts.__usedStates = _usedStates;
            opts.__usedCableStates = _usedCableStates;
            opts.__lampSpecs = _buildLampSpecs(rows);
            opts.__legendCounts = { states: _stateCounts, cables: _legendCableMeters(rows), realBlocks: [..._realUsed.values()] };

            // Draw cables (dispatch pattern theo loaiCap state — P59+)
            // Skip toàn bộ block nếu user tắt cable trong modal (opts.includeCable === false)
            const _includeCable = opts.includeCable !== false;
            for (const r of rows) {
                if (!_includeCable) break;
                const p1 = posMap.get(r);
                const p2 = posMap.get(_resolveParent(r, _cadIdx));   // chỉ vẽ khi cả cha nằm trong bộ lọc
                if (!p1 || !p2) continue;

                const cableState = String(r[22] || 'noi').trim();  // noi/ngam/noi_thu/ngam_thu/noi_moi/ngam_moi
                _drawCableSymbol(push, p1.x, p1.y, p2.x, p2.y, cableState, 'LIGHTING_CABLE');
                _usedCableStates.add(cableState);

                // TEXT khoảng cách ở midpoint — cùng layer với cáp để tắt/bật đi kèm
                const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                const dist = r[15] || Math.round(Math.hypot(p1.x - p2.x, p1.y - p2.y));
                push('0', 'TEXT', '8', 'LIGHTING_CABLE');
                push('10', mx.toFixed(4), '20', my.toFixed(4), '30', '0');
                push('40', '1.5');
                push('1', `${dist}m`);
            }

            // P65+P66: Fetch + draw OSM basemap (roads/buildings/water/admin) — nếu user bật
            if (_orientByRoad) console.log('[CAD Gen] Hướng block đèn:', _rlStats);
            if (opts.osmOptions && typeof _drawOsmBasemapInDxf === 'function') {
                if (_osmErr || !_osmData) {
                    // Không throw — OSM fail không được block export
                    if (typeof displayError === 'function') {
                        if (_osmErr && _osmErr.name === 'AbortError') _cgNotifyOsmSkipped();
                        else displayError('⚠ Nền OSM lỗi (' + (_osmErr ? _osmErr.message : 'không có dữ liệu') + ') — bản vẽ vẫn xuất bình thường không có nền.');
                    }
                } else {
                    try {
                        // Chỉ vẽ lớp user chọn — roads có thể đã fetch thêm chỉ để tính hướng block
                        const drawData = Object.assign({}, _osmData);
                        if (!opts.osmOptions.roads) drawData.roads = [];
                        // Trim OSM tại bounds markers + padding 30m → KHÔNG scale bản vẽ
                        const CLIP_PAD = 30;
                        const clipBounds = {
                            minX: bounds.minX - CLIP_PAD, minY: bounds.minY - CLIP_PAD,
                            maxX: bounds.maxX + CLIP_PAD, maxY: bounds.maxY + CLIP_PAD
                        };
                        const oo = opts.osmOptions;
                        const stats = _drawOsmBasemapInDxf(push, drawData, cm, outDE, outDN, clipBounds, k0,
                            { center: oo.roadCenter !== false, edge: !!oo.roadEdge, name: !!oo.roadName, other: !!oo.roadOther, widths: oo.roadWidths,
                              radii: oo.cornerRadii, textHeight: 3 * scale / 1000 });  // 3mm trên giấy ở mọi tỉ lệ
                        console.log('[CAD Gen] OSM basemap drawn:', stats.entityCount, 'entities, skipped:', stats.skipped);
                    } catch (err) {
                        console.warn('[CAD Gen] OSM basemap skip:', err.message);
                        if (typeof displayError === 'function') {
                            displayError('⚠ Nền OSM lỗi (' + err.message + ') — bản vẽ vẫn xuất bình thường không có nền.');
                        }
                    }
                }
            }

            // CAD nền: entities từ file DXF đã upload (T17-T20)
            if (opts.cadBaseOptions && typeof _drawCadBaseInDxf === 'function' && isFinite(bounds.minX)) {
                try {
                    const CLIP_PAD = 30;
                    const clipBounds = {
                        minX: bounds.minX - CLIP_PAD, minY: bounds.minY - CLIP_PAD,
                        maxX: bounds.maxX + CLIP_PAD, maxY: bounds.maxY + CLIP_PAD
                    };
                    const stats = _drawCadBaseInDxf(push, opts.cadBaseOptions, cm, outDE, outDN, clipBounds);
                    console.log('[CAD Gen] CAD base drawn:', stats.entityCount, 'entities, skipped:', stats.skipped);
                } catch (err) {
                    console.warn('[CAD Gen] CAD base skip:', err.message);
                    if (typeof displayError === 'function') {
                        displayError('⚠ Nền CAD lỗi (' + err.message + ') — bản vẽ vẫn xuất bình thường không có nền.');
                    }
                }
            }

            // Snapshot bounds markers TRƯỚC khi expand bằng title block/polish
            // → dùng để đặt legend + north arrow trong khu vực markers
            const mapBounds = { ...bounds };

            // Title block đơn giản — vẽ trực tiếp LINE + TEXT (không INSERT block)
            const template = TITLE_TEMPLATES[opts.templateId] || TITLE_TEMPLATES.state;
            const md = {};
            template.fields.forEach(f => {
                const v = opts.metadata ? opts.metadata[f.key] : null;
                md[f.key] = (v != null && v !== '') ? v
                    : (typeof f.default === 'function' ? f.default() : f.default);
            });

            // Mẫu QBT: chưa nhập tên tủ / tên đường → lấy từ dữ liệu tờ (tủ chung duy nhất; đường xuất hiện nhiều nhất)
            if (opts.templateId === 'knop12') {
                const _mode = idx => { const c = new Map(); for (const r of rows) { const v = String(r[idx] || '').trim(); if (v) c.set(v, (c.get(v) || 0) + 1); }
                    let best = '', n = 0; for (const [v, m] of c) if (m > n) { best = v; n = m; } return { best, distinct: c.size }; };
                if (!String(md.TEN_BAN_VE || '').trim()) { const t = _mode(7); if (t.distinct === 1) md.TEN_BAN_VE = t.best; }
                if (!String(md.DIA_CHI || '').trim()) { const d = _mode(17); if (d.best) md.DIA_CHI = d.best.toUpperCase(); }
            }

            // Title block — pre-compute size + expand bounds (RENDER được deferred đến POLISH block để dùng bounds đã pad aspect ratio)
            let _titleRender = null;  // { type: 'state'|'dienluc'|'simple', tbW, tbH, ... }
            // 'none' = chỉ dữ liệu (trụ + cáp + nền): bỏ khung tên, khung viền, chú thích, mũi tên Bắc, thước, ô con dấu
            const _noTitle = _cgIsNoTitle(opts.templateId);
            if (!_noTitle && isFinite(bounds.maxX)) {
                if (opts.templateId === 'state') {
                    // P59 v2 + TCVN: Portrait 80×260m — sát góc phải, full height
                    const tbW = 80, tbH = 260;
                    _titleRender = { type: 'state', tbW, tbH };
                    if ((bounds.maxY - bounds.minY) < tbH) {
                        const diff = tbH - (bounds.maxY - bounds.minY);
                        bounds.minY -= diff;
                    }
                    bounds.maxX += (tbW + 10);
                } else if (opts.templateId === 'dienluc') {
                    // P59 v3 + TCVN: Horizontal strip 320×55m — sát đáy, right-aligned
                    const tbW = 320, tbH = 55;
                    _titleRender = { type: 'dienluc', tbW, tbH };
                    // Expand bounds.minY xuống dưới để có chỗ chứa strip 55m + margin
                    bounds.minY -= (tbH + 10);
                    // Đảm bảo width >= 320m
                    if ((bounds.maxX - bounds.minX) < tbW) {
                        bounds.minX = bounds.maxX - tbW;
                    }
                } else if (opts.templateId === 'knop12') {
                    // Mẫu QBT 2026–2029: khung tên đáy 52,9 + bảng ký hiệu 13 dòng (góc dưới phải) + tiêu đề đầu tờ.
                    // Cả tờ giữ ĐÚNG tỉ lệ mẫu: khung trong 384,65 × 281,84 nhân hệ số kk (≥ tỉ lệ/1000).
                    // A3 chuẩn: kk = tỉ lệ/1000, chừa chỗ ngay tại đây. Tự co giãn: tính kk sau khi biết khung (_qbtFitFrame).
                    const k = scale / 1000;
                    _titleRender = { type: 'knop12', k, tbH: QBT_FORM.H * k, auto: opts.frameMode !== 'a3-standard' };
                    if (!_titleRender.auto) {
                        const _clr = _qbtLegendClear(Array.from(posMap.values()), bounds, k);
                        _titleRender.lgSide = _clr.side;
                        _titleRender.lgE = _clr.E;
                        bounds.minY -= _titleRender.tbH + _clr.E;
                        bounds.maxY += 25 * k; // chỗ cho tiêu đề đầu tờ
                    }
                } else {
                    // Old simple layout — vẽ ngay như cũ (backward compat)
                    const tbX = bounds.maxX - 190;
                    const tbY = bounds.minY - 60;
                    const tbW = 190, tbH = 50;
                    const fx1 = tbX.toFixed(4), fy1 = tbY.toFixed(4);
                    const fx2 = (tbX + tbW).toFixed(4), fy2 = (tbY + tbH).toFixed(4);
                    push('0', 'LINE', '8', '0', '10', fx1, '20', fy1, '30', '0', '11', fx2, '21', fy1, '31', '0');
                    push('0', 'LINE', '8', '0', '10', fx2, '20', fy1, '30', '0', '11', fx2, '21', fy2, '31', '0');
                    push('0', 'LINE', '8', '0', '10', fx2, '20', fy2, '30', '0', '11', fx1, '21', fy2, '31', '0');
                    push('0', 'LINE', '8', '0', '10', fx1, '20', fy2, '30', '0', '11', fx1, '21', fy1, '31', '0');
                    let yCur = tbY + tbH - 5;
                    for (const f of template.fields) {
                        push('0', 'TEXT', '8', '0');
                        push('10', (tbX + 2).toFixed(4), '20', yCur.toFixed(4), '30', '0');
                        push('40', '2.5');
                        push('1', _dxfEscape(f.label + ': ' + (md[f.key] || '')));
                        yCur -= 5;
                        if (yCur < tbY + 2) break;
                    }
                    bounds.minX = Math.min(bounds.minX, tbX);
                    bounds.minY = Math.min(bounds.minY, tbY);
                    bounds.maxX = Math.max(bounds.maxX, tbX + tbW);
                }
            }

            // === POLISH v73 (chỉ LINE + TEXT + CIRCLE — R12 compat) ===
            // Trình tự: (a) compute size + expand bounds cho legend/north/stamps; (b) vẽ frame ôm bounds đã expand; (c) vẽ scale bar, legend, north arrow, stamps
            if (!_noTitle && isFinite(bounds.maxX) && isFinite(mapBounds.maxX)) {
                // P58: Pre-compute stamps size (đặt phía trên bản vẽ, trong frame)
                // Vẽ tất cả 4 ô nếu `enabled !== false` — kể cả trống (làm placeholder cho user ký tay in ra)
                const stampsMeta = opts.stamps || {};
                const activeStamps = STAMPS_CONFIG.filter(cfg => {
                    const d = stampsMeta[cfg.key];
                    return d && d.enabled !== false;
                });
                const STAMP_W = 60, STAMP_H = 40, STAMP_GAP = 5;   // meters @ 1:1000
                const stampsBlockW = activeStamps.length > 0
                    ? (activeStamps.length * STAMP_W + (activeStamps.length - 1) * STAMP_GAP) : 0;
                const stampsTopMargin = 20;                          // khoảng cách stamps → mapBounds top
                const stampsY = mapBounds.maxY + stampsTopMargin;    // y-đáy của stamps
                const stampsTopY = stampsY + STAMP_H;

                // Pre-compute Legend
                const TYPE_LABELS = {
                    1: 'Trụ STK', 2: 'Trụ trang trí', 3: 'Trụ HTLT',
                    4: 'Trụ TTLT', 5: 'Tủ CS nổi', 6: 'Tủ CS ngầm'
                };
                const byType = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
                for (const r of rows) {
                    const t = parseInt(r[6]);
                    if (byType[t] !== undefined) byType[t]++;
                }
                const usedTypes = Object.keys(byType).map(Number).filter(t => byType[t] > 0);
                const rowH = 5, lgW = 55;
                const lgH = usedTypes.length > 0 ? (8 + usedTypes.length * rowH + 3) : 0;
                // Positions cho 3 elements (Chú Thích + Tỉ lệ + Bảng ký hiệu) — recompute SAU A3 enforce
                // để đặt NGOÀI frame outer (dưới bounds.minY - M). Placeholder tại đây, override sau.
                let lgX = 0, lgTop = 0;
                // North arrow pre-compute (vẫn TRONG frame, góc trên phải mapBounds)
                const naX = mapBounds.maxX + 5;
                const naY = mapBounds.maxY + 5;
                const naW = 5, naH = 8;
                // Expand bounds chỉ cho north arrow + stamps (frame ôm cả 2)
                // Legend + auto-legend + scale bar → KHÔNG expand (chúng nằm ngoài frame)
                bounds.maxX = Math.max(bounds.maxX, naX + naW);
                bounds.maxY = Math.max(bounds.maxY, naY + naH + 6);
                // P58: Expand bounds cho stamps (bounds.maxY phải include stampsTopY + padding)
                if (activeStamps.length > 0) {
                    // Center stamps horizontally trong mapBounds
                    const stampsStartX = mapBounds.minX + (mapBounds.maxX - mapBounds.minX - stampsBlockW) / 2;
                    bounds.minX = Math.min(bounds.minX, stampsStartX - 5);
                    bounds.maxX = Math.max(bounds.maxX, stampsStartX + stampsBlockW + 5);
                    bounds.maxY = Math.max(bounds.maxY, stampsTopY + 10);
                    // Mẫu QBT: tiêu đề đầu tờ nằm TRÊN ô con dấu
                    if (_titleRender && _titleRender.type === 'knop12') bounds.maxY = Math.max(bounds.maxY, stampsTopY + 10 + 25 * _titleRender.k);
                }

                // Force aspect ratio A3 landscape (420/297 ≈ 1.414) — auto-pad ngang nếu bounds portrait
                // Ngăn bản vẽ hiển thị portrait khi cluster hẹp / title block cao.
                const A3_RATIO = 420 / 297;  // landscape
                if (_titleRender && _titleRender.type === 'knop12' && _titleRender.auto) {
                    // Khung tự co giãn: đặt khung theo đúng tỉ lệ tờ mẫu, khung tên/chữ/bảng nhân cùng hệ số kk
                    const fit = _qbtFitFrame(bounds, Array.from(posMap.values()), _titleRender.k, 15);
                    Object.assign(bounds, fit.bounds);
                    _titleRender.k = fit.kk;
                    _titleRender.tbH = QBT_FORM.H * fit.kk;
                }
                const bW = bounds.maxX - bounds.minX;
                const bH = bounds.maxY - bounds.minY;

                if (_titleRender && _titleRender.type === 'knop12' && _titleRender.auto) {
                    // đã đặt khung ở trên — giữ nguyên
                } else if (opts.frameMode === 'a3-standard') {
                    // A3 chuẩn 1:1000 — khung viền ngoài = 420×297mm chính xác
                    // bounds = content area; viền ngoài = bounds + 2×M (M=20) → trừ trước
                    const paperMmW = 420, paperMmH = 297, frameM = 20;
                    const _qbt = _titleRender && _titleRender.type === 'knop12';
                    // Mẫu QBT: khung trong đúng 384,65 × 281,84 (lề giấy theo bản gốc) — bounds = khung trong − 15 mỗi cạnh
                    const targetW = _qbt ? QBT_FORM.W * scale / 1000 - 30 : paperMmW * scale / 1000 - 2 * frameM;  // 380m @ 1:1000
                    const targetH = _qbt ? QBT_FORM.innerH * scale / 1000 - 30 : paperMmH * scale / 1000 - 2 * frameM;  // 257m @ 1:1000
                    const cx = (bounds.minX + bounds.maxX) / 2;
                    const cy = (bounds.minY + bounds.maxY) / 2;
                    // Warn nếu markers vượt content area (user có thể muốn split N tờ)
                    if (bW > targetW || bH > targetH) {
                        console.warn(`[CAD Gen] Markers ${bW.toFixed(0)}×${bH.toFixed(0)}m vượt nội dung A3 ${targetW}×${targetH}m — cân nhắc bấm "Chia tờ" để split.`);
                    }
                    bounds.minX = cx - targetW / 2;
                    bounds.maxX = cx + targetW / 2;
                    if (_qbt && _titleRender.lgE > 0 && bH > targetH) {
                        // Đã hạ đáy để bảng ký hiệu né trụ → giữ đáy (căn giữa sẽ kéo bảng lên đè trụ); phần thừa tràn phía trên
                        const _minY = bounds.minY;
                        bounds.minY = _minY;
                        bounds.maxY = _minY + targetH;
                    } else {
                        bounds.minY = cy - targetH / 2;
                        bounds.maxY = cy + targetH / 2;
                    }
                } else {
                    // Auto-fit: chỉ ép aspect ratio, không ép kích thước
                    const currentRatio = bW / bH;
                    if (currentRatio < A3_RATIO) {
                        const targetW = bH * A3_RATIO;
                        const padH = (targetW - bW) / 2;
                        bounds.minX -= padH;
                        bounds.maxX += padH;
                    } else if (currentRatio > A3_RATIO * 1.2) {
                        const targetH = bW / A3_RATIO;
                        const padV = (targetH - bH) / 2;
                        bounds.minY -= padV;
                        bounds.maxY += padV;
                    }
                }

                // === 1. FRAME TCVN 7285 (outer + inner) — vẽ SAU khi bounds đã expand ===
                const M = 20, IM = 5;
                // Viền ngoài: mặc định cách khung trong 5; mẫu QBT = mép giấy A3 với lề đúng bản gốc (trái 28,28 · phải 7,07 · dưới 7,08 · trên 8,05) × kk
                const _pm = (_titleRender && _titleRender.type === 'knop12') ? QBT_FORM.paperMargin.map(v => v * _titleRender.k) : null;
                const fox1 = (_pm ? bounds.minX - (M - IM) - _pm[0] : bounds.minX - M).toFixed(4);
                const foy1 = (_pm ? bounds.minY - (M - IM) - _pm[3] : bounds.minY - M).toFixed(4);
                const fox2 = (_pm ? bounds.maxX + (M - IM) + _pm[1] : bounds.maxX + M).toFixed(4);
                const foy2 = (_pm ? bounds.maxY + (M - IM) + _pm[2] : bounds.maxY + M).toFixed(4);
                push('0', 'LINE', '8', '0', '10', fox1, '20', foy1, '30', '0', '11', fox2, '21', foy1, '31', '0');
                push('0', 'LINE', '8', '0', '10', fox2, '20', foy1, '30', '0', '11', fox2, '21', foy2, '31', '0');
                push('0', 'LINE', '8', '0', '10', fox2, '20', foy2, '30', '0', '11', fox1, '21', foy2, '31', '0');
                push('0', 'LINE', '8', '0', '10', fox1, '20', foy2, '30', '0', '11', fox1, '21', foy1, '31', '0');
                const fix1 = (bounds.minX - M + IM).toFixed(4);
                const fiy1 = (bounds.minY - M + IM).toFixed(4);
                const fix2 = (bounds.maxX + M - IM).toFixed(4);
                const fiy2 = (bounds.maxY + M - IM).toFixed(4);
                push('0', 'LINE', '8', '0', '10', fix1, '20', fiy1, '30', '0', '11', fix2, '21', fiy1, '31', '0');
                push('0', 'LINE', '8', '0', '10', fix2, '20', fiy1, '30', '0', '11', fix2, '21', fiy2, '31', '0');
                push('0', 'LINE', '8', '0', '10', fix2, '20', fiy2, '30', '0', '11', fix1, '21', fiy2, '31', '0');
                push('0', 'LINE', '8', '0', '10', fix1, '20', fiy2, '30', '0', '11', fix1, '21', fiy1, '31', '0');

                // === 1c. STRIP CHÚ THÍCH / TỈ LỆ / BẢNG KÝ HIỆU — ĐẶT NGOÀI FRAME (dưới frame outer) ===
                // 3 blocks đặt trong 3 cột riêng biệt, cách frame outer 10m gap để dễ đọc
                const stripTop = bounds.minY - M - 10;     // 10m dưới frame outer bottom
                const stripLeft = bounds.minX;
                // Cột 1: scale bar + Tỉ lệ (chiếm ~60m)
                // Cột 2: BẢNG KÝ HIỆU legend cũ (loại marker + count, chiếm ~60m)
                // Cột 3: Auto-legend CHÚ THÍCH (states + lamp specs, chiếm ~90m)
                const _stripSbX = stripLeft + 5;
                const _stripSbY = stripTop - 12;
                const _stripLgX = stripLeft + 75;
                const _stripLgTop = stripTop;
                // Auto-legend dùng fake mapBounds (nó dựa vào minX + minY để tính vị trí)
                // byTop = mapBounds.minY - 5 → set mapBounds.minY = stripTop + 5 để byTop = stripTop
                const _stripAlMapBounds = {
                    minX: stripLeft + 155,
                    minY: stripTop + 5,
                    maxX: bounds.maxX,
                    maxY: bounds.maxY
                };
                // Override lgX/lgTop declared trước A3 enforce (dùng let, đã declare ở pre-compute)
                lgX = _stripLgX;
                lgTop = _stripLgTop;

                // === 1b. TITLE BLOCK (P59) — render SAU frame, dispatch theo type ===
                if (_titleRender) {
                    // Inner frame boundaries (M outer margin, IM inner offset)
                    const innerLeft = bounds.minX - M + IM;
                    const innerRight = bounds.maxX + M - IM;
                    const innerBottom = bounds.minY - M + IM;
                    const innerTop = bounds.maxY + M - IM;
                    const sheetIdx = opts._sheetIdx || 1;
                    const sheetTotal = opts._sheetTotal || 1;

                    if (_titleRender.type === 'state') {
                        // Portrait sát mép phải, full height
                        const tbW = _titleRender.tbW;
                        const tbX = innerRight - tbW;
                        const tbY = innerBottom;
                        const tbHFull = innerTop - innerBottom;
                        _drawTitleBlockStateFull(push, _dxfEscape, _wrapText, md, tbX, tbY, sheetIdx, sheetTotal, tbHFull);
                    } else if (_titleRender.type === 'dienluc') {
                        // Horizontal strip sát đáy, right-aligned, extend full width nếu bounds rộng hơn 260m
                        const tbH = _titleRender.tbH;
                        const availableW = innerRight - innerLeft;
                        const tbW = availableW;   // full width strip
                        const tbX = innerLeft;
                        const tbY = innerBottom;
                        _drawTitleBlockDienluc(push, _dxfEscape, _wrapText, md, tbX, tbY, sheetIdx, sheetTotal, tbW);
                    } else if (_titleRender.type === 'knop12') {
                        // KNỞ P12: generate title block as DXF BLOCK definition + INSERT at actual position
                        const availableW = innerRight - innerLeft;
                        const tbX = innerLeft;
                        const tbY = innerBottom;
                        const k = _titleRender.k;
                        // 1. Collect title block entities at (0,0) base point
                        const _tbBL = [];
                        const _tbBP = (...a) => { for (const x of a) _tbBL.push(x); };
                        _drawTitleBlockKnop12(_tbBP, _dxfEscape, _wrapText, md, 0, 0, sheetIdx, sheetTotal, availableW, k);
                        // 2. Register BLOCK definition (injected into BLOCKS section later)
                        _blocksDefL.push(
                            '0', 'BLOCK', '8', '0', '2', 'TITLE_KNOP12',
                            '70', '0', '10', '0.0000', '20', '0.0000', '30', '0.0000',
                            '3', 'TITLE_KNOP12',
                            ..._tbBL,
                            '0', 'ENDBLK', '8', '0'
                        );
                        // 3. INSERT block at actual drawing position
                        push('0', 'INSERT', '8', '0', '2', 'TITLE_KNOP12',
                             '10', tbX.toFixed(4), '20', tbY.toFixed(4), '30', '0');
                        _drawKnop12TitleStrip(push, _dxfEscape, innerLeft, innerRight, innerTop, md, k * 1000);
                        // 4. Bảng ký hiệu 13 dòng + số lượng của tờ này — góc dưới phải, đáy chạm đỉnh khung tên
                        const _lgItems = _qbtLegendRows(rows, _legendCableMeters(rows), _realBlocks);
                        const _lgW = _qbtLegendSize(k).w;
                        const _lgRight = _titleRender.lgSide === 'left' ? innerLeft + _lgW : innerRight;
                        const _lgRes = _qbtDrawLegendTable(push, _dxfEscape, _lgRight, tbY + _titleRender.tbH, k, _lgItems, {
                            cable: (p, x1, y1, x2, y2, st) => _drawCableSymbol(p, x1, y1, x2, y2, st, '0'),
                            pole: (p, x, y) => _drawPoleSymbol(p, x, y, 'giu', { soLuongDen: 1 }),
                            cab: (p, x, y) => _drawCabinetSymbol(p, x, y, 'giu'),
                        });
                        if (_lgRes.blocks.length) _blocksDefL.push(..._csBlockDxf(_lgRes.blocks, _csDone));
                    }
                }

                // Mẫu QBT: chỉ giữ phần trong khung (thước tỉ lệ + bảng CHÚ THÍCH ngoài khung bỏ đi)
                const _qbtOnlyFrame = !!(_titleRender && _titleRender.type === 'knop12');
                // === 2. SCALE BAR — NGOÀI frame outer (strip dưới) ===
                if (!_qbtOnlyFrame) {
                const sbX = _stripSbX;
                const sbY = _stripSbY;
                const segLen = 10, segH = 2;
                push('0', 'LINE', '8', '0', '10', sbX.toFixed(4), '20', sbY.toFixed(4), '30', '0',
                     '11', (sbX + 50).toFixed(4), '21', sbY.toFixed(4), '31', '0');
                for (let i = 0; i <= 5; i++) {
                    const vx = sbX + i * segLen;
                    push('0', 'LINE', '8', '0', '10', vx.toFixed(4), '20', sbY.toFixed(4), '30', '0',
                         '11', vx.toFixed(4), '21', (sbY + segH).toFixed(4), '31', '0');
                    push('0', 'TEXT', '8', '0');
                    push('10', (vx - 1).toFixed(4), '20', (sbY - 3.5).toFixed(4), '30', '0');
                    push('40', '1.8');
                    push('1', i === 5 ? (i * 10 + 'm') : String(i * 10));
                }
                push('0', 'TEXT', '8', '0');
                push('10', sbX.toFixed(4), '20', (sbY + 4).toFixed(4), '30', '0');
                push('40', '2.2');
                push('1', _dxfEscape('Tỉ lệ 1:' + scale));
                }

                // === 3. LEGEND BOX === (mẫu QBT đã có bảng ký hiệu 13 dòng trong khung → bỏ bảng cũ)
                if (usedTypes.length > 0 && !(_titleRender && _titleRender.type === 'knop12')) {
                    const lx1 = lgX.toFixed(4), ly1 = (lgTop - lgH).toFixed(4);
                    const lx2 = (lgX + lgW).toFixed(4), ly2 = lgTop.toFixed(4);
                    push('0', 'LINE', '8', '0', '10', lx1, '20', ly1, '30', '0', '11', lx2, '21', ly1, '31', '0');
                    push('0', 'LINE', '8', '0', '10', lx2, '20', ly1, '30', '0', '11', lx2, '21', ly2, '31', '0');
                    push('0', 'LINE', '8', '0', '10', lx2, '20', ly2, '30', '0', '11', lx1, '21', ly2, '31', '0');
                    push('0', 'LINE', '8', '0', '10', lx1, '20', ly2, '30', '0', '11', lx1, '21', ly1, '31', '0');
                    push('0', 'TEXT', '8', '0');
                    push('10', (lgX + 2).toFixed(4), '20', (lgTop - 4).toFixed(4), '30', '0');
                    push('40', '2.5');
                    push('1', _dxfEscape('BẢNG KÝ HIỆU'));
                    let ry = lgTop - 9;
                    for (const t of usedTypes) {
                        if (t === 5 || t === 6) {
                            _drawCabinetGeom(push, lgX + 4, ry - 1, 2.4);   // v165 — cùng ký hiệu block SYM_CAB
                        } else {
                            push('0', 'CIRCLE', '8', '0');
                            push('10', (lgX + 4).toFixed(4), '20', (ry - 1).toFixed(4), '30', '0');
                            push('40', '1.0');
                        }
                        push('0', 'TEXT', '8', '0');
                        push('10', (lgX + 8).toFixed(4), '20', (ry - 2).toFixed(4), '30', '0');
                        push('40', '2.0');
                        push('1', _dxfEscape(TYPE_LABELS[t] + ': ' + byType[t]));
                        ry -= rowH;
                    }
                }

                // === 4. NORTH ARROW ===
                push('0', 'LINE', '8', '0', '10', naX.toFixed(4), '20', (naY + naH).toFixed(4), '30', '0',
                     '11', (naX - naW).toFixed(4), '21', (naY - naH).toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', naX.toFixed(4), '20', (naY + naH).toFixed(4), '30', '0',
                     '11', (naX + naW).toFixed(4), '21', (naY - naH).toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', (naX - naW).toFixed(4), '20', (naY - naH).toFixed(4), '30', '0',
                     '11', (naX + naW).toFixed(4), '21', (naY - naH).toFixed(4), '31', '0');
                push('0', 'LINE', '8', '0', '10', naX.toFixed(4), '20', (naY + naH).toFixed(4), '30', '0',
                     '11', naX.toFixed(4), '21', (naY - naH).toFixed(4), '31', '0');
                push('0', 'TEXT', '8', '0');
                push('10', (naX - 1.5).toFixed(4), '20', (naY + naH + 2).toFixed(4), '30', '0');
                push('40', '3.5');
                push('1', 'B');

                // === 4b. AUTO-LEGEND "CHÚ THÍCH" (P59+) — NGOÀI frame outer (strip dưới, cột phải) ===
                if (!_qbtOnlyFrame) _drawAutoLegend(push, _dxfEscape, _stripAlMapBounds, opts.__usedStates, opts.__usedCableStates, opts.__lampSpecs, opts.__legendCounts);

                // === 5. APPROVAL STAMPS (P58) — 4 ô chuẩn hồ sơ Sở XD ===
                if (activeStamps.length > 0) {
                    // Center block horizontally trong mapBounds
                    const stampsStartX = mapBounds.minX + (mapBounds.maxX - mapBounds.minX - stampsBlockW) / 2;
                    activeStamps.forEach((cfg, idx) => {
                        const d = stampsMeta[cfg.key] || {};
                        const x0 = stampsStartX + idx * (STAMP_W + STAMP_GAP);
                        const y0 = stampsY;                                // đáy
                        const x1 = x0 + STAMP_W, y1 = y0 + STAMP_H;        // đỉnh
                        // Frame ô 4 LINE
                        push('0', 'LINE', '8', '0', '10', x0.toFixed(4), '20', y0.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', y0.toFixed(4), '31', '0');
                        push('0', 'LINE', '8', '0', '10', x1.toFixed(4), '20', y0.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', y1.toFixed(4), '31', '0');
                        push('0', 'LINE', '8', '0', '10', x1.toFixed(4), '20', y1.toFixed(4), '30', '0', '11', x0.toFixed(4), '21', y1.toFixed(4), '31', '0');
                        push('0', 'LINE', '8', '0', '10', x0.toFixed(4), '20', y1.toFixed(4), '30', '0', '11', x0.toFixed(4), '21', y0.toFixed(4), '31', '0');
                        // Header line phân tách title/body ở y0 + (STAMP_H * 0.7)
                        const yHeader = y0 + STAMP_H * 0.7;
                        push('0', 'LINE', '8', '0', '10', x0.toFixed(4), '20', yHeader.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', yHeader.toFixed(4), '31', '0');
                        // Text tên tổ chức — 2 dòng wrap tự động nếu dài > 30 chars
                        const org = String(d.org || cfg.defaultOrg || '');
                        const orgLines = _wrapText(org, 30);
                        const orgLineH = 3;
                        orgLines.slice(0, 3).forEach((line, li) => {
                            push('0', 'TEXT', '8', '0');
                            push('10', (x0 + 2).toFixed(4), '20', (y1 - 4 - li * orgLineH).toFixed(4), '30', '0');
                            push('40', '2.2');
                            push('1', _dxfEscape(line));
                        });
                        // Title box (THẨM ĐỊNH / PHÊ DUYỆT / ...)
                        push('0', 'TEXT', '8', '0');
                        push('10', (x0 + STAMP_W / 2 - cfg.title.length * 1.2).toFixed(4), '20', (yHeader - 3.5).toFixed(4), '30', '0');
                        push('40', '3.0');
                        push('1', _dxfEscape(cfg.title));
                        // Body: số VB + ngày + ký tên
                        let yCur = yHeader - 7;
                        if (d.vbSo || cfg.vbLabel) {
                            const label = cfg.vbLabel || 'Số';
                            const vbText = `${label}: ${d.vbSo || '...........'}${cfg.vbPrefix || ''}`;
                            push('0', 'TEXT', '8', '0');
                            push('10', (x0 + 2).toFixed(4), '20', yCur.toFixed(4), '30', '0');
                            push('40', '1.8');
                            push('1', _dxfEscape(vbText));
                            yCur -= 3.5;
                        }
                        if (d.ngay || cfg.vbLabel) {
                            const ngayText = d.ngay ? _fmtDateVi(d.ngay) : 'ngày ..... tháng ..... năm 20.....';
                            push('0', 'TEXT', '8', '0');
                            push('10', (x0 + 2).toFixed(4), '20', yCur.toFixed(4), '30', '0');
                            push('40', '1.8');
                            push('1', _dxfEscape(ngayText));
                            yCur -= 3.5;
                        }
                        if (d.nguoiKy) {
                            push('0', 'TEXT', '8', '0');
                            push('10', (x0 + 2).toFixed(4), '20', yCur.toFixed(4), '30', '0');
                            push('40', '1.8');
                            push('1', _dxfEscape('Ký: ' + d.nguoiKy));
                        } else {
                            push('0', 'TEXT', '8', '0');
                            push('10', (x0 + 2).toFixed(4), '20', yCur.toFixed(4), '30', '0');
                            push('40', '1.8');
                            push('1', _dxfEscape('Ký tên:'));
                        }
                    });
                }
            }

            push('0', 'ENDSEC', '0', 'EOF');

            // Inject BLOCKS section between TABLES and ENTITIES (if any blocks were registered)
            if (_blocksDefL.length > 0) {
                const _blockSec = [
                    '0', 'SECTION', '2', 'BLOCKS',
                    '0', 'BLOCK', '8', '0', '2', '*Model_Space', '70', '0',
                    '10', '0.0000', '20', '0.0000', '30', '0.0000', '3', '*Model_Space',
                    '0', 'ENDBLK', '8', '0',
                    ..._blocksDefL,
                    '0', 'ENDSEC'
                ];
                L.splice(_entitiesStartIdx, 0, ..._blockSec);
            }

            // Patch HEADER — extents + khung nhìn để mở ra thấy nội dung ngay
            // 'none': nền OSM/CAD được cắt theo bounds ±30m → lề 35 để khung nhìn ôm hết nền
            // Mẫu QBT: lề giấy trái 28,28·kk → khung nhìn ôm cả mép giấy
            const _viewM = _noTitle ? 35 : ((_titleRender && _titleRender.type === 'knop12') ? 15 + QBT_FORM.paperMargin[0] * _titleRender.k : 20);
            L.splice(0, 6, '0', 'SECTION', '2', 'HEADER',
                ..._dxfHeaderView(bounds, _viewM), '0', 'ENDSEC');
            _dxfInjectActiveVport(L, bounds, _viewM);

            // CRLF line-ending — AutoCAD strict
            return L.join('\r\n');
        }

        // ─────────────────────────────────────────────────────────────
        // P59: Revision history (auto-track mỗi lần export DXF)
        // Storage: localStorage['cad_revision_history_' + templateId] = [{index, ngay, mucDich, kyDuyet}]
        // ─────────────────────────────────────────────────────────────
        function _loadRevisionHistory(templateId) {
            try {
                const raw = localStorage.getItem('cad_revision_history_' + templateId);
                if (!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            } catch(e) { return []; }
        }

        function _pushRevisionOnExport(templateId, mucDich, kyDuyet) {
            const hist = _loadRevisionHistory(templateId);
            const todayIso = new Date().toISOString().slice(0, 10);
            const todayVn = todayIso.split('-').reverse().join('/');  // YYYY-MM-DD → DD/MM/YYYY
            // Row 0 auto = "Bản gốc" nếu chưa có history
            const nextIdx = hist.length;
            const entry = {
                index: String(nextIdx).padStart(2, '0'),
                ngay: todayVn,
                mucDich: mucDich || (nextIdx === 0 ? 'Bản gốc' : 'Cập nhật'),
                kyDuyet: kyDuyet || (window.currentUser ? currentUser.displayName || currentUser.username : '')
            };
            hist.push(entry);
            // Giữ max 4 entries (drop oldest)
            const trimmed = hist.slice(-4);
            try { localStorage.setItem('cad_revision_history_' + templateId, JSON.stringify(trimmed)); } catch(e) {}
            return trimmed;
        }
        window._loadRevisionHistory = _loadRevisionHistory;
        window._pushRevisionOnExport = _pushRevisionOnExport;

        // ─────────────────────────────────────────────────────────────
        // P59 v2: Khung tên PORTRAIT chuẩn Sở XD TP.HCM — 60×230m, 9 sections stacked
        // Layout (từ top xuống, mỗi section full-width):
        //   1. TÊN DỰ ÁN (30m, center bold uppercase)
        //   2. ĐỊA ĐIỂM XÂY DỰNG (16m)
        //   3. CHỦ ĐẦU TƯ + tổ chức + placeholder dấu (30m)
        //   4. TƯ VẤN THIẾT KẾ + tổ chức + placeholder dấu (30m)
        //   5. Revision table (28m — 5 sub-rows)
        //   6. GÓI THẦU + Km + Hạng mục + Nội dung + Số trang (44m)
        //   7. 4 người ký (28m — 4 sub-rows)
        //   8. SHBV (8m)
        //   9. Footer LIÊN DANH (16m)
        //   Total: 30+16+30+30+28+44+28+8+16 = 230m
        // ─────────────────────────────────────────────────────────────
        function _drawTitleBlockStateFull(push, escape, wrap, md, tbX, tbY, sheetIdx, sheetTotal, tbHOverride) {
            const tbW = 80;   // TCVN: 80mm width — đủ chỗ cho font chuẩn (title 3.5, body 2.5)
            const baseHeights = [35, 20, 32, 32, 32, 50, 32, 10, 17];   // base = 260m total (tăng cho font lớn hơn)
            const baseTotal = 260;
            const tbH = tbHOverride && tbHOverride > baseTotal ? tbHOverride : baseTotal;
            // Scale row heights nếu tbH lớn hơn base (full-height mode)
            const scale = tbH / baseTotal;
            const rowHeights = baseHeights.map(h => h * scale);
            const x1 = tbX + tbW, y1 = tbY + tbH;

            // Outer frame (4 LINE)
            push('0', 'LINE', '8', '0', '10', tbX.toFixed(4), '20', y1.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', y1.toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', x1.toFixed(4), '20', y1.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', tbY.toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', x1.toFixed(4), '20', tbY.toFixed(4), '30', '0', '11', tbX.toFixed(4), '21', tbY.toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', tbX.toFixed(4), '20', tbY.toFixed(4), '30', '0', '11', tbX.toFixed(4), '21', y1.toFixed(4), '31', '0');
            const rowTopY = [];
            let yCur = y1;
            for (let i = 0; i < rowHeights.length; i++) {
                rowTopY.push(yCur);
                yCur -= rowHeights[i];
                if (i < rowHeights.length - 1) {
                    push('0', 'LINE', '8', '0', '10', tbX.toFixed(4), '20', yCur.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', yCur.toFixed(4), '31', '0');
                }
            }

            // Helper text center-aligned in tbW
            const putCenter = (y, text, size) => {
                const sz = parseFloat(size);
                push('0', 'TEXT', '8', '0');
                push('10', (tbX + tbW / 2 - text.length * sz * 0.4).toFixed(4), '20', y.toFixed(4), '30', '0');
                push('40', size);
                push('1', escape(text));
            };
            const putLeft = (x, y, text, size) => {
                push('0', 'TEXT', '8', '0');
                push('10', x.toFixed(4), '20', y.toFixed(4), '30', '0');
                push('40', size);
                push('1', escape(text));
            };

            // ─── Section 1: TÊN DỰ ÁN (35m — TCVN title 3.5mm) ───
            const s1Top = rowTopY[0];
            putCenter(s1Top - 4, 'TÊN DỰ ÁN:', '2.0');
            const duAnText = (md.DU_AN || '').toUpperCase();
            const duAnLines = wrap(duAnText, 28);
            duAnLines.slice(0, 4).forEach((line, li) => {
                putCenter(s1Top - 10 - li * 6, line, '3.5');
            });

            // ─── Section 2: ĐỊA ĐIỂM (20m) ───
            const s2Top = rowTopY[1];
            putCenter(s2Top - 4, 'ĐỊA ĐIỂM XÂY DỰNG', '2.0');
            wrap(md.DIA_DIEM || '', 32).slice(0, 2).forEach((line, li) => {
                putCenter(s2Top - 10 - li * 5, line, '2.5');
            });

            // ─── Section 3: CHỦ ĐẦU TƯ (32m) ───
            const s3Top = rowTopY[2];
            putCenter(s3Top - 5, 'CHỦ ĐẦU TƯ:', '2.5');
            wrap(md.CHU_DAU_TU || '.....', 30).slice(0, 2).forEach((line, li) => {
                putCenter(s3Top - 11 - li * 5, line, '2.5');
            });
            // Placeholder dấu (khoảng trắng ~10m để user chèn con dấu scan)
            // Text tên người ký (bottom-align section)
            if (md.CHU_DAU_TU_KY) {
                putCenter(s3Top - 28, md.CHU_DAU_TU_KY, '2.5');
            }

            // ─── Section 4: TƯ VẤN THIẾT KẾ (32m) ───
            const s4Top = rowTopY[3];
            putCenter(s4Top - 5, 'TƯ VẤN THIẾT KẾ:', '2.5');
            wrap(md.TU_VAN_TK || '.....', 30).slice(0, 2).forEach((line, li) => {
                putCenter(s4Top - 11 - li * 5, line, '2.5');
            });
            if (md.TU_VAN_TK_KY) {
                putCenter(s4Top - 28, md.TU_VAN_TK_KY, '2.5');
            }

            // ─── Section 5: Revision table (32m, 5 sub-rows, TCVN 1.8mm min) ───
            const s5H = rowHeights[4];
            const s5Top = rowTopY[4];
            const s5Bot = s5Top - s5H;
            const subRowH = s5H / 5;
            const colWidths = [10, 20, 32, 18];  // sum 80 — proportional theo tbW=80
            // Vertical separators
            let colXCur = tbX;
            for (let i = 0; i < colWidths.length - 1; i++) {
                colXCur += colWidths[i];
                push('0', 'LINE', '8', '0', '10', colXCur.toFixed(4), '20', s5Top.toFixed(4), '30', '0', '11', colXCur.toFixed(4), '21', s5Bot.toFixed(4), '31', '0');
            }
            // Horizontal sub-row lines (skip top/bottom)
            for (let i = 1; i < 5; i++) {
                const y = s5Top - i * subRowH;
                push('0', 'LINE', '8', '0', '10', tbX.toFixed(4), '20', y.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', y.toFixed(4), '31', '0');
            }
            // Header row (TCVN 1.8mm min)
            const revHeaders = ['C.Sửa', 'Ngày PH', 'Mục đích phát hành', 'Ký duyệt'];
            colXCur = tbX;
            revHeaders.forEach((h, i) => {
                putLeft(colXCur + 1, s5Top - subRowH * 0.65, h, '1.8');
                colXCur += colWidths[i];
            });
            // Data rows
            const hist = _loadRevisionHistory('state');
            for (let i = 0; i < 4; i++) {
                const entry = hist[i];
                if (!entry) continue;
                const cells = [entry.index || '', entry.ngay || '', entry.mucDich || '', entry.kyDuyet || ''];
                colXCur = tbX;
                const yRow = s5Top - (i + 1) * subRowH - subRowH * 0.65;
                cells.forEach((cell, ci) => {
                    if (cell) putLeft(colXCur + 1, yRow, String(cell).slice(0, colWidths[ci] > 25 ? 30 : 15), '1.8');
                    colXCur += colWidths[ci];
                });
            }

            // ─── Section 6: GÓI THẦU + info (50m, TCVN title 3.5 / body 2.5) ───
            const s6Top = rowTopY[5];
            let yBody = s6Top - 6;
            if (md.GOI_THAU_CODE) { putCenter(yBody, 'GÓI THẦU ' + md.GOI_THAU_CODE + ':', '3.5'); yBody -= 6; }
            if (md.GOI_THAU_DOAN) {
                wrap('ĐOẠN ' + md.GOI_THAU_DOAN.toUpperCase(), 30).slice(0, 2).forEach(line => { putCenter(yBody, line, '2.5'); yBody -= 5; });
            }
            const kmParts = [];
            if (md.KM_BAT_DAU) kmParts.push(md.KM_BAT_DAU);
            if (md.KM_KET_THUC) kmParts.push(md.KM_KET_THUC);
            if (md.L_TUYEN) kmParts.push('L=' + md.L_TUYEN);
            if (kmParts.length) { putCenter(yBody, '(' + kmParts.join(' - ') + ')', '2.5'); yBody -= 6; }
            if (md.HANG_MUC) { putCenter(yBody, 'HẠNG MỤC: ' + md.HANG_MUC.toUpperCase(), '3.5'); yBody -= 6; }
            putCenter(yBody, 'Nội dung bản vẽ:', '2.5'); yBody -= 5;
            const noiDung = md.NOI_DUNG_BV || 'BÌNH ĐỒ BỐ TRÍ HỆ THỐNG CHIẾU SÁNG';
            wrap(noiDung, 32).slice(0, 2).forEach(line => { putCenter(yBody, line, '2.5'); yBody -= 5; });
            // Số trang (bottom-right corner section 6)
            if (sheetTotal > 1) {
                const pageText = String(sheetIdx).padStart(2, '0') + '/' + String(sheetTotal).padStart(2, '0');
                putCenter(s6Top - 46, pageText, '3.5');
            }

            // ─── Section 7: 4 người ký (32m scaled, 4 sub-rows TCVN 2.5mm) ───
            const s7H = rowHeights[6];
            const s7Top = rowTopY[6];
            const s7Bot = s7Top - s7H;
            const kySubH = s7H / 4;
            for (let i = 1; i < 4; i++) {
                const y = s7Top - i * kySubH;
                push('0', 'LINE', '8', '0', '10', tbX.toFixed(4), '20', y.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', y.toFixed(4), '31', '0');
            }
            const kyList = [
                { role: 'Chủ nhiệm TK',  name: md.CHU_NHIEM_TK || '' },
                { role: 'Chủ trì TK',    name: md.CHU_TRI_TK || '' },
                { role: 'Thiết kế',      name: md.THIET_KE || '' },
                { role: 'QL chất lượng', name: md.QLCL || '' }
            ];
            // Vertical separator role|name tại tbX + 35mm (44% width)
            const kySepX = tbX + 35;
            push('0', 'LINE', '8', '0', '10', kySepX.toFixed(4), '20', s7Top.toFixed(4), '30', '0', '11', kySepX.toFixed(4), '21', s7Bot.toFixed(4), '31', '0');
            kyList.forEach((k, i) => {
                const yTop = s7Top - i * kySubH;
                putLeft(tbX + 2, yTop - kySubH * 0.6, k.role + ':', '2.0');
                if (k.name) {
                    putLeft(kySepX + 2, yTop - kySubH * 0.6, k.name, '2.5');
                }
            });

            // ─── Section 8: SHBV (10m — TCVN 2.5mm) ───
            const s8Top = rowTopY[7];
            const shbvPattern = md.SHBV_PATTERN || '22-XXX-XX';
            const shbvNum = String(sheetIdx || 1).padStart(2, '0');
            const shbvActual = shbvPattern.replace(/XX/g, shbvNum);
            putCenter(s8Top - 6, 'SHBV: ' + shbvActual, '2.5');

            // ─── Section 9: Footer LIÊN DANH (17m — TCVN 1.8mm min) ───
            const s9Top = rowTopY[8];
            putCenter(s9Top - 4, 'LIÊN DANH', '2.0');
            const lienDanh = md.LIEN_DANH || 'Công ty TNHH Tư vấn Xây dựng Hưng Nghiệp';
            wrap(lienDanh, 40).slice(0, 2).forEach((line, li) => {
                putCenter(s9Top - 9 - li * 4, line, '1.8');
            });
        }

        // ─────────────────────────────────────────────────────────────
        // P59 v3: KIỂU 2 — Horizontal strip đáy (điện lực VN)
        // Layout: 4 cột từ trái → phải, text NORMAL horizontal
        //   Col 1 (60m): Hạng mục / Dự án / Địa điểm (stacked)
        //   Col 2 (55m): Logo placeholder + Tên công ty + Địa chỉ
        //   Col 3 (85m): Bảng chức danh 3 cols × 4 rows (Chức danh | Họ tên | Chữ ký)
        //   Col 4 (60m): Tên BV + Bước + Tỷ lệ + Ký hiệu + Ngày + Số BV + Lần xuất
        //   Total width: 260m, Height: 45m
        // ─────────────────────────────────────────────────────────────
        function _drawTitleBlockDienluc(push, escape, wrap, md, tbX, tbY, sheetIdx, sheetTotal, tbWOverride) {
            const baseW = 320, tbH = 55;   // TCVN: tăng W 260→320, H 45→55 cho font chuẩn
            const tbW = tbWOverride && tbWOverride > baseW ? tbWOverride : baseW;
            const scale = tbW / baseW;
            const colWidths = [70, 65, 105, 80].map(w => w * scale);   // sum = 320
            const x1 = tbX + tbW, y1 = tbY + tbH;

            // Outer frame
            push('0', 'LINE', '8', '0', '10', tbX.toFixed(4), '20', y1.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', y1.toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', x1.toFixed(4), '20', y1.toFixed(4), '30', '0', '11', x1.toFixed(4), '21', tbY.toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', x1.toFixed(4), '20', tbY.toFixed(4), '30', '0', '11', tbX.toFixed(4), '21', tbY.toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', tbX.toFixed(4), '20', tbY.toFixed(4), '30', '0', '11', tbX.toFixed(4), '21', y1.toFixed(4), '31', '0');

            // 3 vertical separators giữa 4 cols
            let colXCur = tbX;
            const colTopY = [];
            for (let i = 0; i < colWidths.length; i++) {
                colTopY.push(colXCur);
                colXCur += colWidths[i];
                if (i < colWidths.length - 1) {
                    push('0', 'LINE', '8', '0', '10', colXCur.toFixed(4), '20', tbY.toFixed(4), '30', '0', '11', colXCur.toFixed(4), '21', y1.toFixed(4), '31', '0');
                }
            }

            const putLeft = (x, y, text, size) => {
                push('0', 'TEXT', '8', '0');
                push('10', x.toFixed(4), '20', y.toFixed(4), '30', '0');
                push('40', size);
                push('1', escape(text));
            };
            const putCenter = (xC, y, text, size) => {
                const sz = parseFloat(size);
                push('0', 'TEXT', '8', '0');
                push('10', (xC - text.length * sz * 0.4).toFixed(4), '20', y.toFixed(4), '30', '0');
                push('40', size);
                push('1', escape(text));
            };

            // ─── Col 1: Header info — TCVN 2.5mm body ───
            const c1X = colTopY[0], c1W = colWidths[0];
            let yC1 = y1 - 6;
            putLeft(c1X + 2, yC1, 'Hạng mục:', '2.0');
            yC1 -= 4;
            wrap(md.HANG_MUC || '', Math.floor(c1W / 1.6)).slice(0, 1).forEach(line => {
                putLeft(c1X + 4, yC1, line, '2.5');
                yC1 -= 5;
            });
            yC1 -= 2;
            putLeft(c1X + 2, yC1, 'Dự án:', '2.0');
            yC1 -= 4;
            wrap(md.DU_AN || '', Math.floor(c1W / 1.5)).slice(0, 3).forEach(line => {
                putLeft(c1X + 4, yC1, line, '2.5');
                yC1 -= 4.5;
            });
            yC1 -= 2;
            putLeft(c1X + 2, yC1, 'Địa điểm:', '2.0');
            yC1 -= 4;
            wrap(md.DIA_DIEM || '', Math.floor(c1W / 1.6)).slice(0, 2).forEach(line => {
                putLeft(c1X + 4, yC1, line, '2.5');
                yC1 -= 4.5;
            });

            // ─── Col 2: Logo + Company info — TCVN 2.5mm ───
            const c2X = colTopY[1], c2W = colWidths[1];
            // Logo placeholder — tam giác nhỏ (12×10m) ở đỉnh cột
            const logoX = c2X + c2W / 2, logoY = y1 - 10;
            push('0', 'LINE', '8', '0', '10', (logoX - 6).toFixed(4), '20', logoY.toFixed(4), '30', '0', '11', (logoX + 6).toFixed(4), '21', logoY.toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', (logoX + 6).toFixed(4), '20', logoY.toFixed(4), '30', '0', '11', logoX.toFixed(4), '21', (logoY + 7).toFixed(4), '31', '0');
            push('0', 'LINE', '8', '0', '10', logoX.toFixed(4), '20', (logoY + 7).toFixed(4), '30', '0', '11', (logoX - 6).toFixed(4), '21', logoY.toFixed(4), '31', '0');
            // Tên công ty (2-3 lines)
            let yC2 = y1 - 22;
            wrap(md.CONG_TY_TEN || '', Math.floor(c2W / 1.5)).slice(0, 3).forEach(line => {
                putCenter(c2X + c2W / 2, yC2, line, '2.5');
                yC2 -= 4;
            });
            // Địa chỉ
            if (md.CONG_TY_DIA_CHI) {
                wrap(md.CONG_TY_DIA_CHI, Math.floor(c2W / 1.4)).slice(0, 2).forEach(line => {
                    putCenter(c2X + c2W / 2, yC2, line, '1.8');
                    yC2 -= 3.5;
                });
            }
            // Tel/Fax
            if (md.CONG_TY_TEL) {
                putCenter(c2X + c2W / 2, yC2, md.CONG_TY_TEL, '1.8');
            }

            // ─── Col 3: Chức danh table (3 cols × 4 rows) — TCVN 2.5mm body ───
            const c3X = colTopY[2], c3W = colWidths[2];
            const subColW = [c3W * 0.40, c3W * 0.35, c3W * 0.25];
            let subXCur = c3X;
            for (let i = 0; i < 2; i++) {
                subXCur += subColW[i];
                push('0', 'LINE', '8', '0', '10', subXCur.toFixed(4), '20', tbY.toFixed(4), '30', '0', '11', subXCur.toFixed(4), '21', y1.toFixed(4), '31', '0');
            }
            const subRowH = tbH / 5;   // header + 4 data
            for (let i = 1; i < 5; i++) {
                const y = y1 - i * subRowH;
                push('0', 'LINE', '8', '0', '10', c3X.toFixed(4), '20', y.toFixed(4), '30', '0', '11', (c3X + c3W).toFixed(4), '21', y.toFixed(4), '31', '0');
            }
            // Header row TCVN 2.0mm
            const headerY = y1 - subRowH * 0.65;
            putLeft(c3X + 2, headerY, 'Chức danh', '2.0');
            putLeft(c3X + subColW[0] + 2, headerY, 'Họ và tên', '2.0');
            putLeft(c3X + subColW[0] + subColW[1] + 2, headerY, 'Chữ ký', '2.0');
            // 4 data rows
            const roles = [
                { role: 'Chủ trì khảo sát', name: md.CT_KS_NAME || '' },
                { role: 'Chủ trí thiết kế', name: md.CT_TK_NAME || '' },
                { role: 'Chủ nhiệm thiết kế', name: md.CN_TK_NAME || '' },
                { role: 'GIÁM ĐỐC', name: md.GIAM_DOC_NAME || '' }
            ];
            roles.forEach((r, i) => {
                const rowY = y1 - (i + 1) * subRowH - subRowH * 0.65;
                putLeft(c3X + 2, rowY, r.role, '2.5');
                putLeft(c3X + subColW[0] + 2, rowY, r.name, '2.5');
                // Chữ ký cột trống — user chèn scan tay
            });

            // ─── Col 4: Meta bản vẽ — TCVN title 3.5 / body 2.5 ───
            const c4X = colTopY[3], c4W = colWidths[3];
            const c4MidY = y1 - tbH * 0.55;
            push('0', 'LINE', '8', '0', '10', c4X.toFixed(4), '20', c4MidY.toFixed(4), '30', '0', '11', (c4X + c4W).toFixed(4), '21', c4MidY.toFixed(4), '31', '0');
            // Tên bản vẽ (top ~55%)
            let yC4 = y1 - 6;
            putLeft(c4X + 2, yC4, 'Tên bản vẽ:', '2.0');
            yC4 -= 5;
            wrap(md.TEN_BAN_VE || '', Math.floor(c4W / 1.5)).slice(0, 3).forEach(line => {
                putCenter(c4X + c4W / 2, yC4, line, '3.5');
                yC4 -= 5;
            });
            // Meta grid 2×3 (bottom ~45%)
            const gridCols = 2, gridRows = 3;
            const gCellW = c4W / gridCols;
            const gCellH = (tbH * 0.45) / gridRows;
            push('0', 'LINE', '8', '0', '10', (c4X + gCellW).toFixed(4), '20', c4MidY.toFixed(4), '30', '0', '11', (c4X + gCellW).toFixed(4), '21', tbY.toFixed(4), '31', '0');
            for (let i = 1; i < gridRows; i++) {
                const y = c4MidY - i * gCellH;
                push('0', 'LINE', '8', '0', '10', c4X.toFixed(4), '20', y.toFixed(4), '30', '0', '11', (c4X + c4W).toFixed(4), '21', y.toFixed(4), '31', '0');
            }
            const grid = [
                [`Bước: ${md.BUOC || ''}`, `Ký hiệu: ${md.KY_HIEU || ''}`],
                [`Tỷ lệ: ${md.TI_LE || '1/1000'}`, `Ngày: ${md.NGAY || ''}`],
                [`Số bản vẽ: ${md.SO_BAN_VE || ''}`, `Lần xuất: ${md.LAN_XUAT || ''}`]
            ];
            grid.forEach((row, i) => {
                row.forEach((cell, j) => {
                    putLeft(c4X + j * gCellW + 2, c4MidY - i * gCellH - gCellH * 0.6, cell, '1.8');
                });
            });
        }

        // Khung tên mẫu QBT 2026–2029 — vẽ bởi src/core/cad-titleblock-qbt.js (đúng kích thước/cỡ chữ bản gốc).
        // tbW = bề rộng khung trong; k = tỉ lệ bản vẽ / 1000. Trả về {w, h}.
        function _drawTitleBlockKnop12(push, escape, wrap, md, tbX, tbY, sheetIdx, sheetTotal, tbW, k) {
            return _qbtDrawTitleBlock(push, escape, md, tbX, tbY, tbW, k || 1, sheetIdx, sheetTotal);
        }

        // Tiêu đề đầu tờ (mẫu QBT): tên bản vẽ + "TỦ ĐIỀU KHIỂN - <tên tủ>", canh theo ĐỈNH khung trong
        function _drawKnop12TitleStrip(push, escape, innerLeft, innerRight, innerTop, md, scale) {
            _qbtDrawHeader(push, escape, innerLeft, innerRight, innerTop, md, (scale || 1000) / 1000);
        }

        // Wrap text theo max chars per line (greedy, respect word boundaries).
        // Dùng cho tên tổ chức dài trong stamps + title block.
        function _wrapText(text, maxChars) {
            const words = String(text || '').split(/\s+/).filter(Boolean);
            const lines = [];
            let cur = '';
            for (const w of words) {
                if (!cur) { cur = w; continue; }
                if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
                else { lines.push(cur); cur = w; }
            }
            if (cur) lines.push(cur);
            return lines;
        }

        // Escape Unicode text cho DXF: ký tự >= U+0080 → \U+XXXX
        function _dxfEscape(text) {
            if (text == null) return '';
            const str = String(text);
            let out = '';
            for (let i = 0; i < str.length; i++) {
                const code = str.charCodeAt(i);
                if (code < 128) out += str[i];
                else out += '\\U+' + code.toString(16).toUpperCase().padStart(4, '0');
            }
            return out;
        }

        // Item 1 + 2: Vẽ bảng ký hiệu (Legend) + bảng thống kê (Statistics) trong DXF
        // Format: 2 cột × N hàng, bên trái là ký hiệu type + label, bên phải là count/total
        function _drawCadLegend(d, sheet, rows, scaleM) {
            const TYPE_LABEL = {
                1: 'Trụ STK', 2: 'Trụ trang trí', 3: 'Trụ HTLT', 4: 'Trụ TTLT',
                5: 'Tủ CS nổi', 6: 'Tủ CS ngầm'
            };
            const TYPE_BLOCK = {
                1: 'POLE_STK_1L', 2: 'POLE_TT', 3: 'POLE_HTLT', 4: 'POLE_TTLT',
                5: 'CABINET_NOI', 6: 'CABINET_NGAM'
            };
            // Count per type + total công suất
            const byType = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            let totalPower = 0, cableCount = 0;
            const rowSet = new Set(rows);
            const _lgIdx = _rowIndex((loadedData || []).slice(1), rows);
            for (const r of rows) {
                const t = parseInt(r[6]);
                if (byType[t] !== undefined) byType[t]++;
                const p = parseFloat(r[11]);
                const n = parseInt(r[21]) || 1;
                if (isFinite(p)) totalPower += p * n;
                if (rowSet.has(_resolveParent(r, _lgIdx))) cableCount++;
            }
            let totalCable = 0;
            for (const r of rows) {
                const d15 = parseFloat(r[15]);
                if (isFinite(d15)) totalCable += d15;
            }

            // Legend box: góc dưới-trái frame, cách 5mm
            const boxW = 80 * scaleM;
            const boxH = 60 * scaleM;
            const boxX = sheet.minX + 20 * scaleM + 5 * scaleM;  // leftInset + margin
            const boxY = sheet.minY + 10 * scaleM + 15 * scaleM; // inset + gap trên scale bar

            // Border box
            d.drawPolyline([
                [boxX, boxY],
                [boxX + boxW, boxY],
                [boxX + boxW, boxY + boxH],
                [boxX, boxY + boxH]
            ], true, 'LEGEND');

            // Title
            d.drawText(boxX + 2 * scaleM, boxY + boxH - 4 * scaleM, 3 * scaleM, 'BẢNG KÝ HIỆU', 'LEGEND');
            d.drawText(boxX + 2 * scaleM, boxY + boxH - 8 * scaleM, 2 * scaleM, '─────────────', 'LEGEND');

            // Iterate 6 types + row cable
            let yCursor = boxY + boxH - 13 * scaleM;
            const rowH = 6 * scaleM;
            const iconX = boxX + 5 * scaleM;
            const labelX = boxX + 15 * scaleM;
            const countX = boxX + 55 * scaleM;

            for (const [typeStr, count] of Object.entries(byType)) {
                if (count === 0) continue;
                const type = parseInt(typeStr);
                // Icon: insert block scaled nhỏ (1×1m thực → 2mm trên giấy @ 1:1000)
                try {
                    d.insertBlock(TYPE_BLOCK[type], iconX, yCursor, 0, 1.5 * scaleM, 'LEGEND');
                } catch(e){_swallow(e);}
                d.drawText(labelX, yCursor + rowH / 2 - scaleM, 2.5 * scaleM, TYPE_LABEL[type], 'LEGEND');
                d.drawText(countX, yCursor + rowH / 2 - scaleM, 2.5 * scaleM, count + ' cái', 'LEGEND');
                yCursor -= rowH;
            }

            // Cable row
            if (cableCount > 0) {
                d.drawPolyline([[iconX, yCursor + rowH / 2], [iconX + 6 * scaleM, yCursor + rowH / 2]], false, 'LEGEND');
                d.drawText(labelX, yCursor + rowH / 2 - scaleM, 2.5 * scaleM, 'Đường cáp', 'LEGEND');
                d.drawText(countX, yCursor + rowH / 2 - scaleM, 2.5 * scaleM, Math.round(totalCable) + 'm', 'LEGEND');
                yCursor -= rowH;
            }

            // Total row
            if (totalPower > 0) {
                d.drawText(iconX, yCursor + rowH / 2 - scaleM, 3 * scaleM, '⚡ Tổng công suất: ' + Math.round(totalPower) + 'W', 'LEGEND');
            }
        }

        // Save Blob as file
        function _saveBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
        }

        function _dateStamp() {
            const d = new Date();
            return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
        }

        // Expose Phase B lên window
        window._generateCadDrawing = _generateCadDrawing;
        window._loadTitleTemplate  = _loadTitleTemplate;
        window._extractAttdefs     = _extractAttdefs;
        window._filterRowsForCadExport = _filterRowsForCadExport;
        window._getCadOffsetPresets = _getCadOffsetPresets;
        window._saveCadOffsetPreset = _saveCadOffsetPreset;

        // ═══════════════════════════════════════════════════════════════════
        // CAD GENERATOR — Modal handlers (T21 Phase B UI)
        // ═══════════════════════════════════════════════════════════════════

        let _cgCurrentFilters = { tus: [], basenames: [], nguoiKS: [], phuongXa: [] };

        function _openCadGenerator() {
            const modal = document.getElementById('cadGeneratorModal');
            if (!modal) return;
            if (typeof loadedData === 'undefined' || !Array.isArray(loadedData) || loadedData.length < 2) {
                if (typeof displayError === 'function') displayError('Chưa có dữ liệu marker để xuất bản vẽ.');
                return;
            }
            const _cbOrient = document.getElementById('cgOrientByRoad');
            if (_cbOrient) { try { _cbOrient.checked = localStorage.getItem('cg_orient_by_road') === '1'; } catch(e){_swallow(e);} }
            const _cbReal = document.getElementById('cgRealBlocks');
            if (_cbReal) { try { _cbReal.checked = localStorage.getItem('cg_real_blocks') !== '0'; } catch(e){_swallow(e);} }
            _cgRestoreRoadWidths();
            _cgCurrentFilters = _restoreCadExportFilters();
            _cgRenderOffsetPresets();
            _cgRenderFilterAccordion();
            _cgRenderMetadataForm();
            _cgUpdateLiveCounter();
            if (typeof _cgUpdateCadBaseInfo === 'function') _cgUpdateCadBaseInfo();
            // F3: Auto-detect meridian từ centroid Lat/Lon
            _cgAutoDetectMeridian();
            modal.style.display = 'flex';
            if (typeof closeControlsModal === 'function') closeControlsModal();
            // Tải sẵn nền OSM; đổi bật/tắt OSM, hướng theo đường, lớp, bộ lọc → hẹn lại (debounce)
            if (!modal.dataset.cgWarmHooked) {
                modal.addEventListener('change', () => _cgScheduleWarmOsm(1500));
                modal.dataset.cgWarmHooked = '1';
            }
            _cgScheduleWarmOsm(600);
        }

        // F3: Auto-detect meridian từ centroid Lat/Lon của filtered rows
        // VN có 4 múi TM chuẩn: 105° / 105.5° / 105.75° / 106° → chọn múi gần centroid.lon nhất
        function _cgAutoDetectMeridian() {
            const sel = document.getElementById('cgMeridian');
            if (!sel) return;
            const rows = (loadedData || []).slice(1);
            let sumLon = 0, cnt = 0;
            for (const r of rows) {
                const lon = parseCoord(r[3]);
                if (isFinite(lon) && lon > 100 && lon < 115) { sumLon += lon; cnt++; }
            }
            if (cnt === 0) return;
            const avgLon = sumLon / cnt;
            const candidates = [105, 105.5, 105.75, 106];
            let best = candidates[0], minDiff = Math.abs(candidates[0] - avgLon);
            for (const c of candidates) {
                const d = Math.abs(c - avgLon);
                if (d < minDiff) { minDiff = d; best = c; }
            }
            const bestStr = String(best);
            if (sel.value !== bestStr) {
                sel.value = bestStr;
                if (typeof displayInfo === 'function') {
                    displayInfo(`🎯 Auto-detect kinh tuyến: ${best}° (centroid Lon=${avgLon.toFixed(3)}°)`);
                }
            }
        }
        window._cgAutoDetectMeridian = _cgAutoDetectMeridian;

        function _closeCadGenerator() {
            const modal = document.getElementById('cadGeneratorModal');
            if (modal) modal.style.display = 'none';
            // Bỏ hẹn tải sẵn + nhả RAM: dữ liệu OSM có nhà của cả quận có thể vài chục MB (IndexedDB vẫn giữ)
            if (_cgWarmTimer) { clearTimeout(_cgWarmTimer); _cgWarmTimer = null; }
            if (typeof _osmClearMem === 'function') _osmClearMem();
        }
        window._openCadGenerator = _openCadGenerator;
        window._closeCadGenerator = _closeCadGenerator;

        // ── Offset preset dropdown (P47: shared + local) ─────────────
        // Trigger async sync khi mở modal (background); render ngay với cache hiện có
        function _cgRenderOffsetPresets() {
            const sel = document.getElementById('cgOffsetPreset');
            const presets = _getCadOffsetPresets();
            sel.innerHTML = presets.map(p => {
                const badge = p.source === 'shared' ? '🌍' : '👤';
                const coords = (p.dE || p.dN) ? ` (ΔE=${p.dE}, ΔN=${p.dN})` : '';
                return `<option value="${p.id}" data-source="${p.source || 'local'}">${badge} ${p.name}${coords}</option>`;
            }).join('');
            sel.value = presets[0]?.id || '';
            _onCgOffsetPresetChange();
            // Sync background — nếu có change → re-render
            if (typeof _syncSharedPresets === 'function') {
                _syncSharedPresets(false).then(() => {
                    // Re-render nếu shared thực sự thay đổi
                    const newPresets = _getCadOffsetPresets();
                    if (newPresets.length !== presets.length ||
                        JSON.stringify(newPresets.map(p => p.id)) !== JSON.stringify(presets.map(p => p.id))) {
                        const cur = sel.value;
                        sel.innerHTML = newPresets.map(p => {
                            const badge = p.source === 'shared' ? '🌍' : '👤';
                            const coords = (p.dE || p.dN) ? ` (ΔE=${p.dE}, ΔN=${p.dN})` : '';
                            return `<option value="${p.id}" data-source="${p.source || 'local'}">${badge} ${p.name}${coords}</option>`;
                        }).join('');
                        if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
                    }
                }).catch(() => {});
            }
        }

        function _onCgOffsetPresetChange() {
            const presetId = document.getElementById('cgOffsetPreset').value;
            const preset = _getCadOffsetPresets().find(p => p.id === presetId);
            if (preset) {
                document.getElementById('cgOffsetE').value = preset.dE;
                document.getElementById('cgOffsetN').value = preset.dN;
            }
        }

        function _onCgOffsetInputChange() {
            // Nếu user sửa dE/dN thủ công → đánh dấu là custom
            // (không cần thay đổi state, chỉ đọc value khi export)
        }

        async function _onCgSaveOffsetPreset() {
            const dE = parseFloat(document.getElementById('cgOffsetE').value) || 0;
            const dN = parseFloat(document.getElementById('cgOffsetN').value) || 0;
            const name = prompt('Tên preset mới:', `Custom ${dE}/${dN}`);
            if (!name) return;
            const region = prompt('Khu vực (tùy chọn):', '') || '';

            // Nếu user là admin → hỏi lưu local hay shared. Ngược lại → local mặc định.
            let mode = 'local';
            if (currentUser && currentUser.role === 'admin') {
                const choice = confirm(
                    `Lưu preset "${name}"?\n\n` +
                    `[OK] = 🌍 Shared (cả team dùng chung, cần admin)\n` +
                    `[Cancel] = 👤 Local (chỉ trình duyệt này)`
                );
                mode = choice ? 'shared' : 'local';
            }

            const saved = await _saveCadOffsetPreset({
                name, region, dE, dN,
                cm: 105.75, k0: 0.9999,
                verify: 'User custom preset',
                createdAt: new Date().toISOString()
            }, mode);
            _cgRenderOffsetPresets();
            const badge = saved.source === 'shared' ? '🌍 Shared' : '👤 Local';
            if (typeof displayInfo === 'function') displayInfo(`Đã lưu preset "${name}" (${badge})`);
        }
        window._onCgOffsetPresetChange = _onCgOffsetPresetChange;
        window._onCgOffsetInputChange = _onCgOffsetInputChange;
        window._onCgSaveOffsetPreset = _onCgSaveOffsetPreset;

        // ── Filter accordion (4 dimensions) ─────────────────────────
        function _cgRenderFilterAccordion() {
            const dims = [
                { key: 'tus',       label: 'Tủ điều khiển', getUnique: _getUniqueCabinets },
                { key: 'basenames', label: 'Basename',      getUnique: _getUniqueBasenames },
                { key: 'nguoiKS',   label: 'Người khảo sát', getUnique: _getUniqueSurveyors },
                { key: 'phuongXa',  label: 'Phường/Xã',     getUnique: _getUniquePhuongXa }
            ];
            const container = document.getElementById('cgFilterAccordion');
            container.innerHTML = dims.map(d => {
                const values = d.getUnique();
                const selected = new Set(_cgCurrentFilters[d.key] || []);
                const isAllSelected = selected.size === 0;
                const label = isAllSelected ? `Tất cả (${values.length})` : `${selected.size}/${values.length}`;
                // F5: Auto-expand accordion nếu dimension có filter active
                // + highlight summary bằng background cam để user thấy ngay
                const openAttr = isAllSelected ? '' : 'open';
                const summaryBg = isAllSelected ? '#f8fafc' : '#fef3c7';
                const summaryColor = isAllSelected ? '#334155' : '#78350f';
                const activeBadge = isAllSelected ? '' : ' <span style="background:#f59e0b;color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:700;margin-left:4px;">ACTIVE</span>';
                return `
                <details ${openAttr} style="border:1px solid var(--border);border-radius:6px;margin-bottom:4px;padding:0;">
                    <summary style="padding:6px 10px;font-size:12px;font-weight:600;color:${summaryColor};cursor:pointer;background:${summaryBg};border-radius:6px 6px 0 0;">
                        ${d.label} — <span id="cgFlbl_${d.key}" style="color:#2563eb;font-weight:700;">${label}</span>${activeBadge}
                    </summary>
                    <div style="padding:8px 10px;">
                        <div style="display:flex;gap:6px;margin-bottom:6px;">
                            <button type="button" onclick="_cgSelectAllDim('${d.key}', true)" style="padding:3px 8px;font-size:10px;border:1px solid var(--border);background:#fff;border-radius:4px;cursor:pointer;">Chọn tất cả</button>
                            <button type="button" onclick="_cgSelectAllDim('${d.key}', false)" style="padding:3px 8px;font-size:10px;border:1px solid var(--border);background:#fff;border-radius:4px;cursor:pointer;">Bỏ chọn tất cả</button>
                            ${values.length > 10 ? `<input type="text" placeholder="Lọc..." oninput="_cgFilterDimSearch('${d.key}', this.value)" style="flex:1;padding:3px 6px;font-size:10px;border:1px solid var(--border);border-radius:4px;">` : ''}
                        </div>
                        <div id="cgFopts_${d.key}" style="max-height:150px;overflow-y:auto;font-size:11px;">
                            ${values.map(v => `
                                <label class="cg-fopt" style="display:block;padding:2px 4px;cursor:pointer;">
                                    <input type="checkbox" value="${_esc(v)}" ${selected.has(v) ? 'checked' : ''} onchange="_cgToggleDim('${d.key}', this.value, this.checked)"> ${_esc(v)}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </details>`;
            }).join('');
        }

        function _esc(s) { return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

        function _cgToggleDim(key, value, checked) {
            // Bug fix: strip '__NONE__' sentinel before operating so it doesn't pollute the array
            // when user checks an item after "Bỏ chọn tất cả"
            let arr = (_cgCurrentFilters[key] || []).filter(v => v !== '__NONE__');
            if (checked && !arr.includes(value)) arr.push(value);
            else if (!checked) {
                const idx = arr.indexOf(value);
                if (idx >= 0) arr.splice(idx, 1);
            }
            _cgCurrentFilters[key] = arr;
            _cgSaveFilters();
            _cgUpdateLiveCounter();
            _cgUpdateFilterLabel(key);
        }

        function _cgSelectAllDim(key, selectAll) {
            // Convention: filter [] = không lọc = tất cả marker pass
            // "Chọn tất cả" → set [] (default state, không lọc)
            // "Bỏ chọn tất cả" → set ['__NONE__'] (sentinel, không marker nào match)
            _cgCurrentFilters[key] = selectAll ? [] : ['__NONE__'];
            _cgSaveFilters();
            _cgRenderFilterAccordion();
            _cgUpdateLiveCounter();
        }
        window._cgToggleDim = _cgToggleDim;
        window._cgSelectAllDim = _cgSelectAllDim;

        function _cgFilterDimSearch(key, query) {
            const q = String(query || '').toLowerCase();
            const container = document.getElementById(`cgFopts_${key}`);
            if (!container) return;
            container.querySelectorAll('label.cg-fopt').forEach(lbl => {
                const val = (lbl.textContent || '').toLowerCase();
                lbl.style.display = val.includes(q) ? '' : 'none';
            });
        }
        window._cgFilterDimSearch = _cgFilterDimSearch;

        function _cgUpdateFilterLabel(key) {
            const dims = { tus: _getUniqueCabinets, basenames: _getUniqueBasenames, nguoiKS: _getUniqueSurveyors, phuongXa: _getUniquePhuongXa };
            const all = dims[key]();
            const selected = _cgCurrentFilters[key] || [];
            const lbl = document.getElementById(`cgFlbl_${key}`);
            if (lbl) lbl.textContent = selected.length === 0 ? `Tất cả (${all.length})` : `${selected.length}/${all.length}`;
        }

        function _cgSaveFilters() {
            _saveCadExportFilters(_cgCurrentFilters);
        }

        function _cgUpdateLiveCounter() {
            _cgScheduleWarmOsm(1500);   // khung đổi → tải sẵn lại nền OSM (debounce)
            const rows = _filterRowsForCadExport(_cgCurrentFilters);
            const el = document.getElementById('cgLiveCounter');
            const total = (loadedData || []).length - 1;
            const tuCount = new Set(rows.map(r => String(r[7] || '').trim()).filter(Boolean)).size;
            const _rowSet = new Set(rows), _lcIdx = _rowIndex((loadedData || []).slice(1), rows);
            const cableCount = rows.filter(r => _rowSet.has(_resolveParent(r, _lcIdx))).length;
            if (rows.length === 0) {
                el.style.background = '#fee2e2';
                el.style.color = '#dc2626';
                el.innerHTML = `⚠ Filter không match marker nào (0/${total})`;
                document.getElementById('cgBtnDxf').disabled = true;
                document.getElementById('cgBtnPdf').disabled = true;
                document.getElementById('cgBtnBoth').disabled = true;
                // Bug fix: disable batch button when no markers match
                const batchBtn = document.getElementById('cgBtnBatch');
                if (batchBtn) batchBtn.disabled = true;
            } else {
                // F1: 3 tier warn — filter chặt / bình thường / OK
                const ratio = rows.length / Math.max(1, total);
                let bg, color, prefix = 'Sẽ xuất', suffix = '';
                if (rows.length < 10) {
                    bg = '#fef2f2'; color = '#dc2626'; prefix = '⚠ CHỈ';
                    suffix = ` <span style="font-weight:400;font-size:11px;">(${(ratio*100).toFixed(2)}% dữ liệu — filter rất chặt, có chắc không?)</span>`;
                } else if (ratio < 0.05) {
                    bg = '#fffbeb'; color = '#78350f'; prefix = '⚠ Sẽ xuất';
                    suffix = ` <span style="font-weight:400;font-size:11px;">(chỉ ${(ratio*100).toFixed(1)}% dữ liệu)</span>`;
                } else {
                    bg = '#f0fdf4'; color = '#166534';
                }
                el.style.background = bg;
                el.style.color = color;
                el.innerHTML = `${prefix} <b>${rows.length}/${total}</b> marker (${tuCount} tủ · ${cableCount} tuyến cáp)${suffix}`;
                document.getElementById('cgBtnDxf').disabled = false;
                document.getElementById('cgBtnPdf').disabled = false;
                document.getElementById('cgBtnBoth').disabled = false;
                const batchBtn2 = document.getElementById('cgBtnBatch');
                if (batchBtn2) {
                    batchBtn2.disabled = false;
                    // F6: Dynamic label — hiển thị số tủ sẽ batch
                    batchBtn2.textContent = tuCount > 0 ? `📦 Batch ${tuCount} tủ` : '📦 Batch N tủ';
                }
            }
        }

        // ── Template + Metadata form ────────────────────────────────
        function _onCgTemplateChange() {
            _cgRenderMetadataForm();
        }
        window._onCgTemplateChange = _onCgTemplateChange;

        // P61: Loại bản vẽ change → show/hide sections + auto SHBV/nội dung + persist
        const _DRAWING_TYPE_META = {
            'site-plan': {
                hint: 'Mặt bằng bố trí: dùng lat/lon thực, có scale + offset local grid + multi-sheet',
                showSections: ['cgSectionFormat', 'cgSectionOutputOffset', 'cgSectionSheetSplit'],
                noiDungDefault: 'BÌNH ĐỒ BỐ TRÍ HỆ THỐNG CHIẾU SÁNG',
                shbvSuffix: '-07'
            },
            'single-line': {
                hint: 'Sơ đồ nguyên lý: tọa độ giả, mỗi tủ 1 hàng ngang. Ẩn scale/offset/chia tờ (không áp dụng).',
                showSections: [],   // Ẩn hết 3 sections
                noiDungDefault: 'SƠ ĐỒ NGUYÊN LÝ HỆ THỐNG CHIẾU SÁNG',
                shbvSuffix: '-13'
            },
            'overview': {
                hint: 'Bình đồ tổng thể: 1 tờ A3 overview toàn dự án. Chỉ có scale, không có multi-sheet.',
                showSections: ['cgSectionFormat', 'cgSectionOutputOffset'],
                noiDungDefault: 'BÌNH ĐỒ TỔNG THỂ HỆ THỐNG CHIẾU SÁNG',
                shbvSuffix: '-01'
            }
        };

        function _onCgDrawingTypeChange() {
            const sel = document.getElementById('cgDrawingType');
            if (!sel) return;
            const type = sel.value || 'site-plan';
            const meta = _DRAWING_TYPE_META[type] || _DRAWING_TYPE_META['site-plan'];

            // 1. Show/hide sections
            const allSections = ['cgSectionFormat', 'cgSectionOutputOffset', 'cgSectionSheetSplit'];
            allSections.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = meta.showSections.includes(id) ? '' : 'none';
            });

            // 2. Update hint
            const hint = document.getElementById('cgDrawingTypeHint');
            if (hint) hint.textContent = meta.hint;

            // 3. Auto override NOI_DUNG_BV nếu template = state (không đè nếu user đã sửa tay)
            const noiDungEl = document.getElementById('cgMeta_NOI_DUNG_BV');
            if (noiDungEl) {
                const currentVal = noiDungEl.value.trim();
                const knownDefaults = Object.values(_DRAWING_TYPE_META).map(m => m.noiDungDefault);
                // Chỉ auto-set nếu value đang là 1 trong 3 default (user chưa custom)
                if (!currentVal || knownDefaults.includes(currentVal)) {
                    noiDungEl.value = meta.noiDungDefault;
                }
            }
            // Auto override TEN_BAN_VE cho dienluc template (mẫu QBT dùng TEN_BAN_VE = tên tủ → không đè)
            const tenBvEl = (document.getElementById('cgTemplateId') || {}).value === 'knop12' ? null : document.getElementById('cgMeta_TEN_BAN_VE');
            if (tenBvEl) {
                const currentVal = tenBvEl.value.trim();
                const knownDefaults = Object.values(_DRAWING_TYPE_META).map(m => m.noiDungDefault);
                if (!currentVal || knownDefaults.includes(currentVal)) {
                    tenBvEl.value = meta.noiDungDefault;
                }
            }

            // 4. Auto adjust SHBV suffix
            const shbvEl = document.getElementById('cgMeta_SHBV_PATTERN');
            if (shbvEl && shbvEl.value) {
                // Replace -NN-XX pattern → -newSuffix-XX
                shbvEl.value = shbvEl.value.replace(/-\d{2}(-XX)?$/, meta.shbvSuffix + '$1');
            }

            // 5. Persist localStorage
            try { localStorage.setItem('cad_last_drawing_type', type); } catch(e) {}

            // 6. Refresh sheet info nếu ẩn/hiện chia tờ
            if (typeof _cgUpdateSheetInfo === 'function') _cgUpdateSheetInfo();
        }
        window._onCgDrawingTypeChange = _onCgDrawingTypeChange;

        function _cgRenderMetadataForm() {
            const templateId = document.getElementById('cgTemplateId').value;
            const template = TITLE_TEMPLATES[templateId];
            const container = document.getElementById('cgMetadataForm');
            if (!template) { container.innerHTML = ''; return; }
            // Restore từ localStorage nếu có
            const saved = _loadMetadataDraft(templateId);
            container.innerHTML = `<div style="font-size:11px;font-weight:700;color:#334155;margin-bottom:6px;">Nội dung khung tên (${template.fields.length} trường):</div>` +
                template.fields.map(f => {
                    const dv = saved[f.key] != null
                        ? saved[f.key]
                        : (typeof f.default === 'function' ? f.default() : (f.default || ''));
                    if (f.multiline) {
                        return `<div style="margin-bottom:6px;">
                            <label style="display:block;font-size:11px;color:#64748b;margin-bottom:2px;">${f.label}</label>
                            <textarea id="cgMeta_${f.key}" rows="2" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;resize:vertical;font-family:inherit;">${_esc(dv)}</textarea>
                        </div>`;
                    }
                    return `<div style="margin-bottom:6px;">
                        <label style="display:block;font-size:11px;color:#64748b;margin-bottom:2px;">${f.label}</label>
                        <input type="text" id="cgMeta_${f.key}" value="${_esc(dv)}" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
                    </div>`;
                }).join('');
        }

        function _collectMetadata() {
            const templateId = document.getElementById('cgTemplateId').value;
            const template = TITLE_TEMPLATES[templateId];
            if (!template) return {};   // 'none' — không có khung tên
            const md = {};
            template.fields.forEach(f => {
                const el = document.getElementById(`cgMeta_${f.key}`);
                md[f.key] = el ? String(el.value || '').trim() : '';
            });
            // Auto-tính L_TUYEN từ KM_BAT_DAU + KM_KET_THUC nếu user để trống
            if (!md.L_TUYEN && md.KM_BAT_DAU && md.KM_KET_THUC) {
                const lM = _parseKmDiff(md.KM_BAT_DAU, md.KM_KET_THUC);
                if (isFinite(lM) && lM > 0) md.L_TUYEN = (lM / 1000).toFixed(3) + 'M';
            }
            // Persist draft để lần sau mở modal auto-restore
            _saveMetadataDraft(templateId, md);
            return md;
        }

        // Parse "K6+300" + "K9+870" → 3570 (mét)
        function _parseKmDiff(kmStart, kmEnd) {
            const parse = (s) => {
                const m = String(s || '').match(/K?(\d+)\+(\d+)/i);
                if (!m) return NaN;
                return parseInt(m[1]) * 1000 + parseInt(m[2]);
            };
            return parse(kmEnd) - parse(kmStart);
        }

        // Persist metadata draft per template
        function _saveMetadataDraft(templateId, md) {
            try { localStorage.setItem('cad_metadata_draft_' + templateId, JSON.stringify(md)); } catch(e) {}
        }
        function _loadMetadataDraft(templateId) {
            try {
                const raw = localStorage.getItem('cad_metadata_draft_' + templateId);
                if (!raw) return {};
                const d = JSON.parse(raw) || {};
                // Mẫu knop12 đổi sang form QBT: tên đơn vị mặc định CŨ (1 dòng) → bỏ để lấy mặc định mới (2 dòng đúng mẫu)
                if (templateId === 'knop12') {
                    if (d.TT_QLGT_NAME === 'TT QUẢN LÝ GIAO THÔNG VÀ HẠ TẦNG KỸ THUẬT TP.HCM') delete d.TT_QLGT_NAME;
                    if (d.CTCP_NAME === 'CÔNG TY CỔ PHẦN CHIẾU SÁNG CÔNG CỘNG TP.HCM') delete d.CTCP_NAME;
                    // TEN_BAN_VE giờ là TÊN TỦ; bản nháp cũ có thể chứa tên loại bản vẽ (do đổi loại bản vẽ tự ghi đè trước đây)
                    const _typeNames = Object.values(typeof _DRAWING_TYPE_META !== 'undefined' ? _DRAWING_TYPE_META : {}).map(m => m.noiDungDefault);
                    if (_typeNames.includes(String(d.TEN_BAN_VE || '').trim())) delete d.TEN_BAN_VE;
                }
                return d;
            } catch(e) { return {}; }
        }

        // ── Compute sheet partitions dựa vào filter + scale ─────────
        function _cgComputeSheetsForCurrentOpts() {
            let rows = _filterRowsForCadExport(_cgCurrentFilters);
            if (rows.length === 0) return { partitions: [], bounds: null };
            const cm = parseFloat(document.getElementById('cgMeridian').value) || 105.75;
            const scale = parseInt(document.getElementById('cgScale').value) || 1000;
            const outDE = parseFloat(document.getElementById('cgOffsetE').value) || 0;
            const outDN = parseFloat(document.getElementById('cgOffsetN').value) || 0;
            // F2: Nếu checkbox "Bỏ outlier" bật → compute bounds SAU khi loại outlier
            // Tránh bounds hàng chục km do 1-2 marker lệch → hàng nghìn tờ A3
            const excludeOutliers = (document.getElementById('cgExcludeOutliers')||{}).checked;
            if (excludeOutliers && rows.length >= 3) {
                const outliers = _detectOutliers(rows, cm);
                if (outliers.outlierNames.size > 0) {
                    rows = rows.filter(r => !outliers.outlierNames.has(String(r[1]||'').trim()));
                }
            }
            if (rows.length === 0) return { partitions: [], bounds: null };
            // Bounds sau khi apply output offset
            let b = _computeCadBoundsFromRows(rows, cm);
            b = { minX: b.minX + outDE, minY: b.minY + outDN, maxX: b.maxX + outDE, maxY: b.maxY + outDN };
            const splitMode = document.getElementById('cgSheetSplit').value;
            let partitions;
            if (splitMode === 'auto') {
                partitions = _computeSheetPartitions(b, scale, 'a3', 0.1, (document.getElementById('cgTemplateId') || {}).value);
            } else {
                const n = parseInt(splitMode) || 1;
                if (n === 1) {
                    partitions = [{ ...b, index: 1, total: 1 }];
                } else {
                    // Force N tờ — split theo width nếu wide, ngược lại theo height
                    const w = b.maxX - b.minX, h = b.maxY - b.minY;
                    const parts = [];
                    if (w >= h) {
                        const step = w / n;
                        for (let i = 0; i < n; i++) {
                            parts.push({ minX: b.minX + i * step, minY: b.minY, maxX: b.minX + (i + 1) * step, maxY: b.maxY, index: i + 1, total: n });
                        }
                    } else {
                        const step = h / n;
                        for (let i = 0; i < n; i++) {
                            parts.push({ minX: b.minX, minY: b.minY + i * step, maxX: b.maxX, maxY: b.minY + (i + 1) * step, index: i + 1, total: n });
                        }
                    }
                    partitions = parts;
                }
            }
            return { partitions, bounds: b };
        }

        function _cgUpdateSheetInfo() {
            const info = document.getElementById('cgSheetInfo');
            if (!info) return;
            const { partitions, bounds } = _cgComputeSheetsForCurrentOpts();
            if (!bounds) { info.textContent = '—'; return; }
            const w = bounds.maxX - bounds.minX;
            const h = bounds.maxY - bounds.minY;
            const n = partitions.length;
            // F4: Bounds display fallback "1 điểm" khi 0×0
            const boundsLabel = (w < 1 && h < 1)
                ? '1 điểm (không có diện tích)'
                : (w < 10 && h < 10)
                    ? `${w.toFixed(1)}m × ${h.toFixed(1)}m`
                    : `${w.toFixed(0)}m × ${h.toFixed(0)}m`;
            // F1: 3 tier warn số tờ
            let color, prefix = '', suffix = '';
            if (n > 100) {
                color = '#dc2626'; prefix = '🚨 ';
                suffix = ` <span style="font-weight:400;font-size:11px;">— quá nhiều! Filter tủ trước hoặc bật "Bỏ outlier"</span>`;
            } else if (n > 20) {
                color = '#dc2626'; prefix = '⚠ ';
                suffix = ` <span style="font-weight:400;font-size:11px;">— nhiều tờ, cân nhắc filter</span>`;
            } else if (n > 4) {
                color = '#f59e0b';
            } else {
                color = '#166534';
            }
            info.innerHTML = `${prefix}<b>${n}</b> tờ · Bounds ${boundsLabel}${suffix}`;
            info.style.color = color;
            _cgUpdateOutlierInfo();
        }

        // Outlier detection dựa trên MAD (Median Absolute Deviation) từ centroid.
        // Marker cách centroid > max(3 × median, 100m) → outlier.
        function _detectOutliers(rows, cm) {
            if (!Array.isArray(rows) || rows.length < 3) {
                return { outlierNames: new Set(), medianDist: 0, centroid: null, count: 0 };
            }
            const cmm = cm || 105.75;
            const pts = [];
            for (const r of rows) {
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (!isFinite(lat) || !isFinite(lon)) continue;
                const vn = convertLatLonToVn2000(lat, lon, cmm);
                pts.push({ name: String(r[1] || '').trim(), x: vn.x, y: vn.y });
            }
            if (pts.length < 3) return { outlierNames: new Set(), medianDist: 0, centroid: null, count: 0 };
            // Centroid = median (robust hơn mean với outlier)
            const xs = pts.map(p => p.x).sort((a, b) => a - b);
            const ys = pts.map(p => p.y).sort((a, b) => a - b);
            const mid = Math.floor(pts.length / 2);
            const cx = xs[mid], cy = ys[mid];
            // Distance mỗi point → centroid
            const dists = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
            const sortedD = [...dists].sort((a, b) => a - b);
            const medianDist = sortedD[Math.floor(sortedD.length / 2)];
            // Threshold = max(3 × median, 100m absolute)
            const threshold = Math.max(3 * medianDist, 100);
            const outlierNames = new Set();
            pts.forEach((p, i) => {
                if (dists[i] > threshold && p.name) outlierNames.add(p.name);
            });
            return { outlierNames, medianDist, centroid: { x: cx, y: cy }, threshold, count: outlierNames.size };
        }
        window._detectOutliers = _detectOutliers;

        function _cgUpdateOutlierInfo() {
            const info = document.getElementById('cgOutlierInfo');
            const cb = document.getElementById('cgExcludeOutliers');
            if (!info) return;
            const rows = _filterRowsForCadExport(_cgCurrentFilters);
            if (rows.length === 0) { info.textContent = '—'; return; }
            const cm = parseFloat(document.getElementById('cgMeridian').value) || 105.75;
            const detected = _detectOutliers(rows, cm);
            const willExclude = cb && cb.checked;
            if (detected.count === 0) {
                info.innerHTML = `✓ Không phát hiện outlier (${rows.length} marker · median ${detected.medianDist.toFixed(0)}m)`;
                info.style.color = '#166534';
            } else {
                const action = willExclude ? '<b>sẽ BỎ khi xuất</b>' : '<b>sẽ GIỮ trong bản vẽ</b>';
                info.innerHTML = `⚠ Phát hiện <b>${detected.count}</b>/${rows.length} outlier (xa &gt;${detected.threshold.toFixed(0)}m từ cụm) — ${action}`;
                info.style.color = willExclude ? '#166534' : '#dc2626';
            }
        }
        window._cgUpdateOutlierInfo = _cgUpdateOutlierInfo;

        // Wire sheet info update khi đổi filter/scale/offset
        function _cgWireSheetInfoUpdates() {
            const els = ['cgSheetSplit', 'cgScale', 'cgOffsetE', 'cgOffsetN', 'cgMeridian', 'cgExcludeOutliers'];
            els.forEach(id => {
                const el = document.getElementById(id);
                if (el && !el._cgWired) {
                    el.addEventListener('change', _cgUpdateSheetInfo);
                    el.addEventListener('input', _cgUpdateSheetInfo);
                    el._cgWired = true;
                }
            });
        }

        // Hook vào _cgUpdateLiveCounter để refresh sheet info
        const _origCgUpdateLiveCounter = _cgUpdateLiveCounter;
        _cgUpdateLiveCounter = function() {
            _origCgUpdateLiveCounter();
            _cgUpdateSheetInfo();
        };

        // Hook vào _openCadGenerator để merge custom templates + refresh dropdown + wire updates
        const _origOpenCadGenerator = _openCadGenerator;
        _openCadGenerator = function() {
            _mergeCustomTemplates();
            _origOpenCadGenerator();
            _cgRefreshTemplateDropdown();
            _cgWireSheetInfoUpdates();
            _cgUpdateSheetInfo();
            // P58: restore stamps checkbox + render fields nếu đã có meta lưu
            const cbStamps = document.getElementById('cgShowStamps');
            const savedMeta = _loadStampsMeta();
            const hasSavedMeta = Object.keys(savedMeta).length > 0;
            if (cbStamps && hasSavedMeta) {
                cbStamps.checked = true;
                _toggleStampsSection();  // hiện container + render fields
            }
            // P61: restore last drawing type + apply show/hide sections
            const drawSel = document.getElementById('cgDrawingType');
            if (drawSel) {
                try {
                    const lastType = localStorage.getItem('cad_last_drawing_type');
                    if (lastType && drawSel.querySelector(`option[value="${lastType}"]:not([disabled])`)) {
                        drawSel.value = lastType;
                    }
                } catch(e) {}
                _onCgDrawingTypeChange();   // apply show/hide + hint + NOI_DUNG_BV
            }
        };
        window._openCadGenerator = _openCadGenerator;

        // ── Export handler (Phase C: preview + multi-sheet + zip) ────
        // Trạng thái đang chạy cho nút xuất: nút bấm hiện vòng xoay + "Đang xuất… Ns", các nút còn lại khoá
        // (chống bấm trùng khi đang tải nền OSM / tạo file). Luôn khôi phục trong finally.
        const _CG_EXPORT_BTNS = { preview: 'cgBtnPreview', dxf: 'cgBtnDxf', pdf: 'cgBtnPdf', both: 'cgBtnBoth' };
        let _cgExportBusy = false;
        let _cgExportAbort = null;     // AbortController của lần xuất đang chạy
        let _cgOsmFetching = false;    // đang chờ Overpass — chỉ lúc này bấm nút bận mới có tác dụng
        let _cgOsmSkipNotified = false; // đã báo "bỏ qua nền OSM" trong lần xuất này chưa (nhiều tờ → chỉ báo 1 lần)
        // Bọc lời gọi Overpass của luồng xuất: bật/tắt cờ để nút bận biết khi nào cho bỏ qua
        // Nền đường DỰNG SẴN bật khi: checkbox cgOsmPrebuilt tích (mặc định tích nếu chưa có) + có _pbGetRoads.
        function _cgUsePrebuilt() {
            if (typeof window._pbGetRoads !== 'function') return false;
            if (typeof window._osmPreferLive === 'function' && window._osmPreferLive()) return false;  // chế độ OSM live
            const cb = document.getElementById('cgOsmPrebuilt');
            return cb ? !!cb.checked : true;
        }
        async function _cgFetchOsm(bbox, fetchOpts, signal) {
            const result = await _cgFetchOsmRaw(bbox, fetchOpts, signal);
            // Hợp nhất đường tự vẽ (custom roads) vào nền xuất CAD.
            return (typeof window._withCustomRoads === 'function') ? window._withCustomRoads(result, bbox) : result;
        }
        async function _cgFetchOsmRaw(bbox, fetchOpts, signal) {
            _cgOsmFetching = true;
            try {
                const wantRoads = !fetchOpts || fetchOpts.roads !== false;
                const needOverpass = fetchOpts && (fetchOpts.buildings || fetchOpts.water || fetchOpts.admin);
                if (wantRoads && _cgUsePrebuilt()) {
                    let pb = null;
                    try { pb = await window._pbGetRoads(bbox, { pad: 1 }); } catch (e) { pb = null; }
                    if (pb && !pb._empty && pb.roads && pb.roads.length) {
                        if (!needOverpass) return pb;                       // chỉ cần đường → khỏi gọi Overpass
                        // cần thêm nhà/sông/ranh → lấy riêng các lớp đó từ Overpass rồi gộp đường dựng sẵn.
                        // Overpass lỗi → vẫn giữ đường dựng sẵn (không để mất nền đường vì server chết).
                        try {
                            const op = await _fetchOsmBasemap(bbox, Object.assign({}, fetchOpts, { roads: false }), signal);
                            return { roads: pb.roads, buildings: op.buildings || [], water: op.water || [], admin: op.admin || [] };
                        } catch (e2) {
                            if (typeof displayInfo === 'function') displayInfo('⚠ Không tải được nhà/sông/ranh từ Overpass — vẫn giữ nền đường dựng sẵn.');
                            return pb;
                        }
                    }
                    // prebuilt rỗng (bbox ngoài vùng TP.HCM) → rơi xuống Overpass như cũ
                }
                return await _fetchOsmBasemap(bbox, fetchOpts, signal);
            }
            finally { _cgOsmFetching = false; }
        }
        function _cgNotifyOsmSkipped() {
            if (_cgOsmSkipNotified) return;
            _cgOsmSkipNotified = true;
            if (typeof displayInfo === 'function') displayInfo('⏭ Đã bỏ qua nền OSM theo yêu cầu — bản vẽ xuất không có nền đường.');
        }
        let _cgExportT0 = 0;
        // Bấm lại nút đang bận = BỎ QUA nền OSM, xuất ngay. Không huỷ hẳn việc xuất: nền OSM vốn là phần
        // tuỳ chọn (lỗi OSM đã không chặn xuất), nên dừng chờ mạng rồi vẫn ra bản vẽ là kết quả hữu ích nhất.
        // Bỏ qua cú bấm trong 800ms đầu để double-click vô tình không kích hoạt.
        async function _onCgExport(mode) {
            if (_cgExportBusy) {
                if (_cgOsmFetching && _cgExportAbort && !_cgExportAbort.signal.aborted && Date.now() - _cgExportT0 > 800) _cgExportAbort.abort();
                return;
            }
            _cgExportBusy = true;
            _cgExportAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            _cgExportT0 = Date.now();
            _cgOsmSkipNotified = false;
            const btn = document.getElementById(_CG_EXPORT_BTNS[mode]);
            const footer = btn && btn.parentElement;
            const others = footer ? [...footer.querySelectorAll('button[id]')].filter(b => b !== btn) : [];   // nút Hủy (không id) vẫn bấm được
            const origHtml = btn ? btn.innerHTML : '';
            const t0 = Date.now();
            const render = () => {
                if (!btn) return;
                const sec = Math.floor((Date.now() - t0) / 1000);
                const skipping = _cgExportAbort && _cgExportAbort.signal.aborted;
                const canSkip = _cgOsmFetching && !!_cgExportAbort && !skipping;
                const what = skipping ? 'Bỏ qua OSM…' : (_cgOsmFetching ? 'Đang tải nền OSM…' : 'Đang xuất…');
                btn.innerHTML = '<span class="cg-busy-spin" aria-hidden="true"></span>' + what + (sec > 0 ? ' ' + sec + 's' : '');
                const tip = canSkip ? 'Bấm để bỏ qua nền OSM và xuất ngay' : '';
                if (tip) { btn.title = tip; btn.setAttribute('aria-label', what + ' ' + tip); }
                else { btn.removeAttribute('title'); btn.removeAttribute('aria-label'); }
            };
            let timer = null;
            if (btn) {
                // Không disabled: bấm lần nữa = bỏ qua nền OSM (đã chặn chạy trùng bằng _cgExportBusy)
                btn.classList.add('cg-busy');
                btn.setAttribute('aria-busy', 'true');
                render();
                timer = setInterval(render, 250);   // 250ms: nhãn "Đang tải nền OSM…" hiện ngay khi bắt đầu chờ
            }
            others.forEach(b => { b.dataset.cgWasDisabled = b.disabled ? '1' : ''; b.disabled = true; b.classList.add('cg-locked'); });
            try {
                await _onCgExportRun(mode);
            } finally {
                if (timer) clearInterval(timer);
                if (btn) {
                    btn.innerHTML = origHtml;
                    btn.disabled = false;
                    btn.classList.remove('cg-busy');
                    btn.removeAttribute('aria-busy');
                    btn.removeAttribute('title');
                    btn.removeAttribute('aria-label');
                }
                others.forEach(b => { b.disabled = b.dataset.cgWasDisabled === '1'; b.classList.remove('cg-locked'); delete b.dataset.cgWasDisabled; });
                _cgExportAbort = null;
                _cgExportBusy = false;
            }
        }

        async function _onCgExportRun(mode) {
            const cbOut = document.getElementById('cgExcludeOutliers');
            const cbStamps = document.getElementById('cgShowStamps');
            // P58: Persist stamps meta vào localStorage TRƯỚC khi build opts
            let stampsMeta = null;
            if (cbStamps && cbStamps.checked) {
                stampsMeta = _collectStampsMeta();
                _saveStampsMeta(stampsMeta);
            }
            const drawingType = (document.getElementById('cgDrawingType') || {}).value || 'site-plan';
            const opts = {
                templateId: document.getElementById('cgTemplateId').value,
                metadata: _collectMetadata(),
                filters: _cgCurrentFilters,
                outputOffset: {
                    dE: parseFloat(document.getElementById('cgOffsetE').value) || 0,
                    dN: parseFloat(document.getElementById('cgOffsetN').value) || 0
                },
                paper: 'a3',
                scale: parseInt(document.getElementById('cgScale').value) || 1000,
                cm: parseFloat(document.getElementById('cgMeridian').value) || 105.75,
                excludeOutliers: cbOut ? cbOut.checked : false,
                stamps: stampsMeta,  // null nếu tắt → generator skip stamps
                drawingType: drawingType,  // P60: 'site-plan' | 'single-line' | 'overview'
                osmOptions: (typeof _cgCollectOsmOpts === 'function') ? _cgCollectOsmOpts() : null,  // P65+P66: null nếu tắt
                orientByRoad: !!(document.getElementById('cgOrientByRoad') || {}).checked,  // v152
                realBlocks: (document.getElementById('cgRealBlocks') || { checked: true }).checked !== false,  // block bản vẽ mẫu
                cadBaseOptions: (typeof _cgCollectCadBaseOpts === 'function') ? _cgCollectCadBaseOpts() : null,  // CAD nền từ upload
                includeCable: (document.getElementById('cgIncludeCable') || {}).checked !== false,  // default true — cho phép tắt cáp
                frameMode: (document.getElementById('cgFrameMode') || {}).value || 'auto-fit',   // 'auto-fit' | 'a3-standard'
                // Chỉ gắn khi xuất file: opts của preview được giữ lại (_pdfPreviewCurrentOpts) để xuất DXF sau —
                // nếu mang theo signal đã huỷ thì lần xuất đó sẽ bỏ qua OSM mà người dùng không hề yêu cầu.
                signal: (_cgExportAbort && (mode === 'dxf' || mode === 'both')) ? _cgExportAbort.signal : undefined
            };

            // 'none' = chỉ dữ liệu: PDF luôn vẽ khung tên (exportDrawingPDF) → chỉ cho xuất DXF; không có ô con dấu
            if (_cgIsNoTitle(opts.templateId)) {
                if (mode !== 'dxf') {
                    displayError && displayError('"Không xuất khung tên" chỉ xuất DXF. Chọn template khác để xem trước / xuất PDF.');
                    return;
                }
                opts.stamps = null;
            }

            // P60/P61/P62: Dispatch generator theo loại bản vẽ
            // Overview + Single-line dùng function riêng, không đi qua wrapper outlier
            if (drawingType === 'overview') {
                if (mode === 'preview') {
                    displayError && displayError('Bình đồ tổng thể chưa hỗ trợ preview PDF. Bấm DXF để xuất trực tiếp.');
                    return;
                }
                if (mode === 'pdf') {
                    displayError && displayError('Bình đồ tổng thể chỉ xuất DXF (mở AutoCAD → Export PDF).');
                    return;
                }
                try {
                    displayInfo && displayInfo('Đang tạo bình đồ tổng thể...');
                    const dxfText = await _generateOverviewDrawing(opts);
                    const stamp = _dateStamp();
                    if (mode === 'both') {
                        const JSZip = await _loadJSZip();
                        const zip = new JSZip();
                        zip.file(`binh-do-tong-the-${stamp}.dxf`, dxfText);
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        _saveBlob(zipBlob, `binh-do-tong-the-${stamp}.zip`);
                        displayInfo && displayInfo('✅ Đã xuất zip (chỉ DXF)');
                    } else {
                        _saveBlob(new Blob([dxfText], { type: 'application/dxf' }),
                            `binh-do-tong-the-${stamp}.dxf`);
                        displayInfo && displayInfo('✅ Đã xuất bình đồ tổng thể');
                    }
                    if (opts.templateId === 'state') _pushRevisionOnExport('state');
                    return;
                } catch (err) {
                    console.error('[Overview] Export error:', err);
                    displayError && displayError('Lỗi xuất bình đồ tổng thể: ' + err.message);
                    return;
                }
            }
            if (drawingType === 'single-line') {
                // Guard modes không hỗ trợ
                if (mode === 'preview') {
                    displayError && displayError('Sơ đồ nguyên lý không hỗ trợ preview PDF (dùng tọa độ giả). Bấm DXF để xuất trực tiếp.');
                    return;
                }
                if (mode === 'pdf') {
                    displayError && displayError('Sơ đồ nguyên lý chỉ xuất DXF (mở AutoCAD → File → Export PDF).');
                    return;
                }
                try {
                    displayInfo && displayInfo('Đang tạo sơ đồ nguyên lý...');
                    const dxfText = await _generateSingleLineDrawing(opts);
                    const stamp = _dateStamp();
                    if (mode === 'both') {
                        // Zip chỉ có DXF (không có PDF cho single-line)
                        const JSZip = await _loadJSZip();
                        const zip = new JSZip();
                        zip.file(`so-do-nguyen-ly-${stamp}.dxf`, dxfText);
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        _saveBlob(zipBlob, `so-do-nguyen-ly-${stamp}.zip`);
                        displayInfo && displayInfo('✅ Đã xuất zip (chỉ DXF, không có PDF)');
                    } else {
                        _saveBlob(new Blob([dxfText], { type: 'application/dxf' }),
                            `so-do-nguyen-ly-${stamp}.dxf`);
                        displayInfo && displayInfo('✅ Đã xuất sơ đồ nguyên lý');
                    }
                    if (opts.templateId === 'state') _pushRevisionOnExport('state');
                    return;
                } catch (err) {
                    console.error('[SingleLine] Export error:', err);
                    displayError && displayError('Lỗi xuất sơ đồ nguyên lý: ' + err.message);
                    return;
                }
            }

            try {
                if (mode === 'preview') {
                    if (typeof displayInfo === 'function') displayInfo('Đang mở preview...');
                    _closeCadGenerator();
                    await _cgOpenPreview(opts);
                    return;
                }

                if (typeof displayInfo === 'function') displayInfo('Đang tạo bản vẽ...');
                const stamp = _dateStamp();

                // DXF: nếu >1 tờ → zip N file, ngược lại 1 file
                if (mode === 'dxf') {
                    console.log('[Export DXF] Click. opts.stamps =', opts.stamps);
                    console.log('[Export DXF] opts full =', JSON.parse(JSON.stringify(opts)));
                    const { partitions } = _cgComputeSheetsForCurrentOpts();
                    console.log('[Export DXF] partitions:', partitions.length);
                    if (partitions.length <= 1) {
                        console.log('[Export DXF] Single-sheet path — calling generator...');
                        const dxfText = await _generateCadDrawing(opts);
                        console.log('[Export DXF] DXF length:', dxfText ? dxfText.length : 'NULL');
                        if (!dxfText) throw new Error('Generator trả về null/undefined');
                        const baseName = `thiet-ke-${opts.templateId}-${stamp}`;
                        // 'none': không có khung tên/ô dấu → không kèm ảnh dấu/chữ ký
                        const packed = _cgIsNoTitle(opts.templateId)
                            ? { blob: new Blob([dxfText], { type: 'application/dxf' }), filename: baseName + '.dxf', isZip: false }
                            : await _maybeZipWithStamps(dxfText, baseName);
                        _saveBlob(packed.blob, packed.filename);
                        displayInfo && displayInfo(packed.isZip ? '✅ Đã xuất zip (DXF + dấu/chữ ký)' : '✅ Đã xuất DXF');
                        if (opts.templateId === 'state') _pushRevisionOnExport('state');
                    } else {
                        if (partitions.length > 10 && !confirm(`Bản vẽ có ${partitions.length} tờ. Việc xuất zip có thể mất nhiều thời gian. Tiếp tục?`)) return;
                        const dxfFiles = [];
                        const osmPrefetch = await _cgPrefetchOsm(opts);
                        for (const sb of partitions) {
                            try {
                                const dxfText = await _generateCadDrawing({ ...opts, sheetBounds: sb, _osmPrefetch: osmPrefetch });
                                const label = `thiet-ke-${opts.templateId}-${stamp}_${String(sb.index).padStart(2, '0')}-of-${String(sb.total).padStart(2, '0')}.dxf`;
                                dxfFiles.push({ name: label, content: dxfText });
                            } catch (err) {
                                console.warn(`[CAD Gen] Sheet ${sb.index}/${sb.total} skip:`, err.message);
                            }
                        }
                        if (dxfFiles.length === 0) throw new Error('Không có tờ nào có marker');
                        const JSZip = await _loadJSZip();
                        const zip = new JSZip();
                        dxfFiles.forEach(f => zip.file(f.name, f.content));
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        _saveBlob(zipBlob, `thiet-ke-${opts.templateId}-${stamp}.zip`);
                        displayInfo && displayInfo(`✅ Đã xuất zip: ${dxfFiles.length}/${partitions.length} DXF`);
                        if (opts.templateId === 'state') _pushRevisionOnExport('state');
                    }
                    return;
                }

                // Multi-sheet split (dùng cho PDF / both)
                const { partitions } = _cgComputeSheetsForCurrentOpts();
                const isMultiSheet = partitions.length > 1;

                if (mode === 'pdf') {
                    if (isMultiSheet) {
                        displayInfo && displayInfo('⚠ Multi-sheet PDF chưa hỗ trợ — xuất PDF cho toàn bộ view');
                    }
                    _closeCadGenerator();
                    await _cgExportPdf(opts);  // download PDF trực tiếp (returnBlob=false)
                    return;
                }

                if (mode === 'both') {
                    if (partitions.length > 10 && !confirm(`Bản vẽ có ${partitions.length} tờ. Việc xuất zip có thể mất nhiều thời gian. Tiếp tục?`)) return;

                    // Build DXF files (mỗi partition 1 file)
                    const dxfFiles = [];
                    const osmPrefetch = isMultiSheet ? await _cgPrefetchOsm(opts) : null;
                    for (const sb of partitions) {
                        const subOpts = { ...opts, _osmPrefetch: osmPrefetch };
                        if (isMultiSheet) subOpts.sheetBounds = sb;
                        try {
                            const dxfText = await _generateCadDrawing(subOpts);
                            const label = isMultiSheet
                                ? `thiet-ke-${opts.templateId}-${stamp}_${String(sb.index).padStart(2, '0')}-of-${String(sb.total).padStart(2, '0')}.dxf`
                                : `thiet-ke-${opts.templateId}-${stamp}.dxf`;
                            dxfFiles.push({ name: label, content: dxfText });
                        } catch (err) {
                            console.warn(`[CAD Gen] Sheet ${sb.index}/${sb.total} skip:`, err.message);
                        }
                    }

                    // Gen PDF Blob (không auto-save) + zip cùng với DXF files
                    _closeCadGenerator();
                    displayInfo && displayInfo('Đang tạo PDF cho zip...');
                    await _cgExportPdf({ ...opts, returnBlob: true });
                    const pdfBlob = window._lastPdfBlob;
                    const pdfName = window._lastPdfFilename || `ban-ve-${stamp}.pdf`;

                    const JSZip = await _loadJSZip();
                    const zip = new JSZip();
                    dxfFiles.forEach(f => zip.file(f.name, f.content));
                    if (pdfBlob) zip.file(pdfName, pdfBlob);
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    _saveBlob(zipBlob, `ban-ve-${stamp}.zip`);
                    displayInfo && displayInfo(`✅ Đã xuất zip: ${dxfFiles.length} DXF${pdfBlob ? ' + 1 PDF' : ''}`);
                    if (opts.templateId === 'state') _pushRevisionOnExport('state');
                }
            } catch (err) {
                console.error('[CAD Gen] Export error:', err);
                if (typeof displayError === 'function') displayError('Lỗi xuất bản vẽ: ' + err.message);
            }
        }
        window._onCgExport = _onCgExport;

        // v152 — Fetch Overpass 1 lần cho bbox toàn bộ trụ đang lọc, dùng chung cho nhiều tờ/nhiều tủ.
        // Không có cái này, tờ thứ 2 trở đi bị rate-limit 5s của _fetchOsmBasemap → mất nền + hướng block.
        // Khung OSM cho tập marker theo bộ lọc — CÙNG công thức với _generateCadDrawing (±0.001° ≈ 100m).
        // Không áp "loại điểm ngoại lai": bỏ điểm chỉ làm khung nhỏ lại, nên khung này luôn BAO CHỨA khung lúc xuất
        // → cache bộ nhớ của _fetchOsmBasemap (tra theo bao chứa) vẫn trúng.
        function _cgOsmBboxForFilters(filters) {
            let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
            for (const r of _filterRowsForCadExport(filters || {})) {
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (!isFinite(lat) || !isFinite(lon)) continue;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lon < minLon) minLon = lon;
                if (lon > maxLon) maxLon = lon;
            }
            if (!isFinite(minLat)) return null;
            return { minLat: minLat - 0.001, maxLat: maxLat + 0.001, minLon: minLon - 0.001, maxLon: maxLon + 0.001 };
        }
        function _cgOsmFetchOpts(osmOptions, orientByRoad) {
            return Object.assign({ roads: false, buildings: false, water: false, admin: false },
                osmOptions || {}, { roads: !!(orientByRoad || (osmOptions && osmOptions.roads)) });
        }

        // ── Tải sẵn nền OSM khi mở modal Xuất CAD ──
        // Người dùng mất 10–60s chọn bộ lọc / khung tên → đủ để tải xong, bấm xuất là trúng cache.
        // KHÔNG tải lúc mở bản đồ: phần lớn người dùng (khảo sát viên) không bao giờ xuất CAD — tải lúc đó chỉ tốn
        // 3G, chặn UI khi parse JSON lớn, và nhân tải lên máy chủ Overpass công cộng (thêm 429 cho người cần xuất).
        // var (không phải let): _cgUpdateLiveCounter nằm PHÍA TRÊN trong file và có thể chạy trước dòng này → let sẽ dính TDZ
        var _cgWarmTimer = null;
        var _cgWarmFailAt = 0;   // lần tải sẵn lỗi gần nhất — nghỉ 30s, tránh mỗi lần sửa ô lại bắn Overpass
        function _cgScheduleWarmOsm(delayMs) {
            if (_cgWarmTimer) clearTimeout(_cgWarmTimer);
            _cgWarmTimer = setTimeout(_cgWarmOsm, delayMs);
        }
        function _cgWarmOsm() {
            _cgWarmTimer = null;
            const modal = document.getElementById('cadGeneratorModal');
            if (!modal || modal.style.display === 'none' || typeof _fetchOsmBasemap !== 'function') return;
            if (_cgExportBusy) return;                              // đang xuất → lần xuất tự tải, đừng bắn thêm
            if (Date.now() - _cgWarmFailAt < 30000) return;          // vừa lỗi → nghỉ, lúc xuất sẽ thử lại
            const osmOptions = (typeof _cgCollectOsmOpts === 'function') ? _cgCollectOsmOpts() : null;
            const orientByRoad = !!(document.getElementById('cgOrientByRoad') || {}).checked;
            if (!osmOptions && !orientByRoad) return;            // không dùng OSM → không tải
            const bbox = _cgOsmBboxForFilters(_cgCurrentFilters);
            if (!bbox) return;
            // Tôn trọng rate-limit 5s: vừa có request thì hẹn lại, đừng để lỗi nuốt mất lượt tải sẵn
            const wait = 5000 - (Date.now() - (typeof _osmFetchLastMs === 'number' ? _osmFetchLastMs : 0));
            if (wait > 0) { _cgScheduleWarmOsm(wait + 100); return; }
            _fetchOsmBasemap(bbox, _cgOsmFetchOpts(osmOptions, orientByRoad), undefined, { quiet: true })
                .catch(e => {
                    // Rate-limit thì hẹn lại; lỗi mạng thật thì nghỉ 30s
                    if (e && /Đợi 5s/.test(e.message)) { _cgScheduleWarmOsm(5100); return; }
                    _cgWarmFailAt = Date.now();
                    console.warn('[CAD] Tải sẵn OSM lỗi (lúc xuất sẽ thử lại):', e && e.message);
                });
        }

        async function _cgPrefetchOsm(opts, filters) {
            if (!(opts.osmOptions || opts.orientByRoad) || typeof _fetchOsmBasemap !== 'function') return null;
            const bbox = _cgOsmBboxForFilters(filters || opts.filters || {});
            if (!bbox) return null;
            const fetchOpts = _cgOsmFetchOpts(opts.osmOptions, opts.orientByRoad);
            try {
                if (typeof displayInfo === 'function') displayInfo('🗺 Đang tải dữ liệu OSM cho toàn bộ bản vẽ...');
                return { data: await _cgFetchOsm(bbox, fetchOpts, opts.signal), err: null };
            } catch (err) {
                return { data: null, err };
            }
        }

        // ── T25: Batch export — mỗi tủ 1 DXF trong zip ────────────────
        async function _onCgBatchExport() {
            const allTus = _getUniqueCabinets();
            if (allTus.length === 0) {
                displayError && displayError('Không có tủ nào trong dữ liệu');
                return;
            }
            if (!confirm(`Sẽ xuất ${allTus.length} file DXF (mỗi tủ 1 file) vào 1 zip. Tiếp tục?`)) return;

            // P58: Đọc stamps meta 1 lần cho batch (mỗi tủ 1 file DXF)
            const cbStampsBatch = document.getElementById('cgShowStamps');
            const stampsMetaBatch = (cbStampsBatch && cbStampsBatch.checked) ? _collectStampsMeta() : null;
            if (stampsMetaBatch) _saveStampsMeta(stampsMetaBatch);
            const baseOpts = {
                templateId: document.getElementById('cgTemplateId').value,
                metadata: _collectMetadata(),
                outputOffset: {
                    dE: parseFloat(document.getElementById('cgOffsetE').value) || 0,
                    dN: parseFloat(document.getElementById('cgOffsetN').value) || 0
                },
                paper: 'a3',
                scale: parseInt(document.getElementById('cgScale').value) || 1000,
                cm: parseFloat(document.getElementById('cgMeridian').value) || 105.75,
                stamps: stampsMetaBatch,
                orientByRoad: !!(document.getElementById('cgOrientByRoad') || {}).checked,  // v152
                realBlocks: (document.getElementById('cgRealBlocks') || { checked: true }).checked !== false
            };
            if (baseOpts.orientByRoad) {
                baseOpts._osmPrefetch = await _cgPrefetchOsm(baseOpts, {
                    tus: [],
                    basenames: _cgCurrentFilters.basenames || [],
                    nguoiKS:   _cgCurrentFilters.nguoiKS   || [],
                    phuongXa:  _cgCurrentFilters.phuongXa  || []
                });
            }

            const btn = document.getElementById('cgBtnBatch');
            const oldText = btn.textContent;
            btn.disabled = true;

            try {
                const JSZip = await _loadJSZip();
                const zip = new JSZip();
                const stamp = _dateStamp();
                let ok = 0, skip = 0;
                for (let i = 0; i < allTus.length; i++) {
                    const tu = allTus[i];
                    btn.textContent = `⏳ ${i+1}/${allTus.length}...`;
                    const opts = {
                        ...baseOpts,
                        // Bug fix: respect active dimension filters (basenames/nguoiKS/phuongXa)
                        // Only override the 'tus' dimension to iterate per-cabinet
                        filters: {
                            tus: [tu],
                            basenames: _cgCurrentFilters.basenames || [],
                            nguoiKS:   _cgCurrentFilters.nguoiKS   || [],
                            phuongXa:  _cgCurrentFilters.phuongXa  || []
                        },
                        metadata: {
                            ...baseOpts.metadata,
                            CS_KHU_VUC: baseOpts.metadata.CS_KHU_VUC || tu,
                            BV_SO: (baseOpts.metadata.BV_SO || '') + ' — ' + tu,
                            // Mẫu QBT: ô "BẢN VẼ" + tiêu đề đầu tờ ghi tên tủ của từng file
                            ...(baseOpts.templateId === 'knop12' ? { TEN_BAN_VE: tu, DIA_CHI: '' } : {})
                        }
                    };
                    try {
                        const dxfText = await _generateCadDrawing(opts);
                        const safeName = String(tu).replace(/[\\/:*?"<>|]/g, '_');
                        zip.file(`${safeName}-${stamp}.dxf`, dxfText);
                        ok++;
                    } catch (err) {
                        console.warn(`[Batch] Skip ${tu}:`, err.message);
                        skip++;
                    }
                }
                if (ok === 0) throw new Error('Không xuất được tủ nào');
                btn.textContent = '⏳ Đang zip...';
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                _saveBlob(zipBlob, `batch-all-tus-${stamp}.zip`);
                displayInfo && displayInfo(`✅ Batch: ${ok} tủ xuất zip${skip ? `, ${skip} tủ skip (không có marker)` : ''}`);
            } catch (err) {
                console.error('[CAD Batch]', err);
                displayError && displayError('Lỗi batch export: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        }
        window._onCgBatchExport = _onCgBatchExport;

        // ═══════════════════════════════════════════════════════════════════
        // (End CAD Generator Phase B)
        // ═══════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════
        // CAD GENERATOR — Phase C: Preview PDF + Custom template + Multi-sheet
        // ═══════════════════════════════════════════════════════════════════

        // ── PD form wrapper — set DOM tạm từ opts để reuse exportDrawingPDF ──
        // Backup + apply + restore để không phá state form print hiện tại.
        const _CG_PD_MAP = {
            // opts.metadata KEY → pd form element ID (best-effort mapping)
            NGUOI_LAP: 'pdNguoiLap',
            NGUOI_VE:  'pdNguoiLap',     // consulting → map to same slot
            KT_THI_CONG: 'pdNguoiLap',   // contractor
            NGAY: 'pdNgay',
            NGAY_DUYET: 'pdNgay',
            CV_PHU_TRACH: 'pdCVPhuTrach',
            CS_KHU_VUC: 'pdCSKhuVuc',
            TT_QLGT: 'pdDonVi1',
            CHU_DAU_TU: 'pdDonVi1',
            BEN_A: 'pdDonVi1',
            DON_VI_TK: 'pdDonVi2',
            BEN_B: 'pdDonVi2',
            CHU_NHIEM: 'pdDonVi2Sub',
            KIEM_TRA: 'pdDonVi2Sub',
            GIAM_SAT: 'pdDonVi2Sub',
            BV_SO: 'pdSoBanVe',
            SHBV: 'pdSoBanVe',
        };
        const _CG_PD_IDS = [
            'pdScale', 'pdPaper', 'pdTileStyle', 'pdTenTu',
            'pdSoBanVe', 'pdTongBanVe', 'pdNguoiLap', 'pdNgay',
            'pdCVPhuTrach', 'pdCSKhuVuc', 'pdDonVi1', 'pdDonVi2', 'pdDonVi2Sub',
            'pdRotation'
        ];

        function _cgBackupPdForm() {
            const bak = {};
            _CG_PD_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (el) bak[id] = el.value;
            });
            // Backup filter tủ (multi-select)
            const selTu = document.getElementById('fTuDieuKhien');
            if (selTu) {
                bak._selTuValues = [...selTu.selectedOptions].map(o => o.value);
            }
            return bak;
        }

        function _cgApplyPdFormFromOpts(opts) {
            // Format
            const setVal = (id, v) => {
                const el = document.getElementById(id);
                if (el && v != null) el.value = String(v);
            };
            setVal('pdScale',    opts.scale || 1000);
            setVal('pdPaper',    opts.paper || 'a3');
            setVal('pdRotation', 0);
            setVal('pdTenTu',    (opts.metadata && (opts.metadata.TEN_TU || opts.metadata.CS_KHU_VUC)) || '');

            // Metadata mapping
            const md = opts.metadata || {};
            for (const [key, pdId] of Object.entries(_CG_PD_MAP)) {
                if (md[key] != null) setVal(pdId, md[key]);
            }

            // Filter tủ: set multi-select #fTuDieuKhien theo opts.filters.tus
            const selTu = document.getElementById('fTuDieuKhien');
            const tus = (opts.filters && opts.filters.tus) || [];
            if (selTu) {
                [...selTu.options].forEach(o => {
                    o.selected = tus.length === 0 || tus.includes(o.value);
                });
            }
        }

        function _cgRestorePdForm(bak) {
            for (const [id, val] of Object.entries(bak)) {
                if (id.startsWith('_')) continue;
                const el = document.getElementById(id);
                if (el) el.value = val;
            }
            const selTu = document.getElementById('fTuDieuKhien');
            if (selTu && bak._selTuValues) {
                const set = new Set(bak._selTuValues);
                [...selTu.options].forEach(o => { o.selected = set.has(o.value); });
            }
        }

        // Preview PDF: Generate PDF Blob → hiển thị fullscreen iframe modal (P51)
        // Cho phép user xem trước trước khi save/export
        let _pdfPreviewCurrentOpts = null;
        let _pdfPreviewCurrentUrl = null;

        async function _cgOpenPreview(opts) {
            const bak = _cgBackupPdForm();
            _cgApplyPdFormFromOpts(opts);
            try {
                displayInfo && displayInfo('Đang tạo PDF preview...');
                await exportDrawingPDF({ returnBlob: true });
                const blob = window._lastPdfBlob;
                if (!blob) throw new Error('Không tạo được PDF Blob');
                _pdfPreviewCurrentOpts = Object.assign({}, opts, { signal: undefined });   // không giữ signal của lần bấm này
                _showPdfPreviewModal(blob);
            } catch (err) {
                console.error('[Preview PDF]', err);
                displayError && displayError('Lỗi preview: ' + err.message);
            } finally {
                setTimeout(() => _cgRestorePdForm(bak), 3000);
            }
        }

        function _showPdfPreviewModal(blob) {
            // Revoke old URL nếu có
            if (_pdfPreviewCurrentUrl) { try { URL.revokeObjectURL(_pdfPreviewCurrentUrl); } catch(e){_swallow(e);} }
            _pdfPreviewCurrentUrl = URL.createObjectURL(blob);
            const iframe = document.getElementById('pdfPreviewFrame');
            if (iframe) iframe.src = _pdfPreviewCurrentUrl;
            document.getElementById('pdfPreviewModal').style.display = 'flex';
        }

        function _closePdfPreview() {
            document.getElementById('pdfPreviewModal').style.display = 'none';
            const iframe = document.getElementById('pdfPreviewFrame');
            if (iframe) iframe.src = 'about:blank';
            if (_pdfPreviewCurrentUrl) {
                try { URL.revokeObjectURL(_pdfPreviewCurrentUrl); } catch(e){_swallow(e);}
                _pdfPreviewCurrentUrl = null;
            }
        }
        window._closePdfPreview = _closePdfPreview;

        // Handler nút "💾 Xuất PDF" trong preview: save blob hiện tại
        function _pdfPreviewSave() {
            const blob = window._lastPdfBlob;
            const fname = window._lastPdfFilename || `preview-${_dateStamp()}.pdf`;
            if (!blob) return;
            _saveBlob(blob, fname);
            displayInfo && displayInfo('✅ Đã xuất PDF');
        }
        window._pdfPreviewSave = _pdfPreviewSave;

        // Handler "📐 Xuất DXF": gen DXF từ current opts + save
        async function _pdfPreviewExportDxf() {
            console.log('[Preview DXF] Click. opts =', _pdfPreviewCurrentOpts);
            if (!_pdfPreviewCurrentOpts) {
                displayError && displayError('Không có opts (preview đã đóng?). Bấm Preview lại.');
                return;
            }
            try {
                displayInfo && displayInfo('Đang tạo DXF...');
                console.log('[Preview DXF] Calling _generateCadDrawing...');
                const dxfText = await _generateCadDrawing(_pdfPreviewCurrentOpts);
                console.log('[Preview DXF] DXF length:', dxfText ? dxfText.length : 'null');
                if (!dxfText) throw new Error('DXF trống — generator trả về null');
                const stamp = _dateStamp();
                _saveBlob(new Blob([dxfText], { type: 'application/dxf' }),
                    `thiet-ke-${_pdfPreviewCurrentOpts.templateId}-${stamp}.dxf`);
                displayInfo && displayInfo('✅ Đã xuất DXF');
                if (_pdfPreviewCurrentOpts.templateId === 'state') _pushRevisionOnExport('state');
            } catch (err) {
                console.error('[Preview DXF] ERROR:', err);
                displayError && displayError('Lỗi xuất DXF: ' + (err.message || err));
            }
        }
        window._pdfPreviewExportDxf = _pdfPreviewExportDxf;

        // Handler "📦 Xuất cả 2 (zip)"
        async function _pdfPreviewExportBoth() {
            if (!_pdfPreviewCurrentOpts) return;
            const pdfBlob = window._lastPdfBlob;
            if (!pdfBlob) { displayError && displayError('Không có PDF Blob'); return; }
            try {
                displayInfo && displayInfo('Đang tạo DXF + zip...');
                const dxfText = await _generateCadDrawing(_pdfPreviewCurrentOpts);
                const JSZip = await _loadJSZip();
                const zip = new JSZip();
                const stamp = _dateStamp();
                zip.file(`thiet-ke-${_pdfPreviewCurrentOpts.templateId}-${stamp}.dxf`, dxfText);
                zip.file(window._lastPdfFilename || `preview-${stamp}.pdf`, pdfBlob);
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                _saveBlob(zipBlob, `ban-ve-${stamp}.zip`);
                displayInfo && displayInfo('✅ Đã xuất zip (DXF + PDF)');
            } catch (err) {
                displayError && displayError('Lỗi xuất zip: ' + err.message);
            }
        }
        window._pdfPreviewExportBoth = _pdfPreviewExportBoth;

        // Handler "← Sửa lại": đóng preview, mở lại modal generator
        function _pdfPreviewSetback() {
            _closePdfPreview();
            if (typeof _openCadGenerator === 'function') _openCadGenerator();
        }
        window._pdfPreviewSetback = _pdfPreviewSetback;

        // Export PDF: reuse `exportDrawingPDF()` với DOM đã set từ opts
        // Nếu opts.returnBlob → skip download, return Blob qua window._lastPdfBlob
        async function _cgExportPdf(opts) {
            const bak = _cgBackupPdForm();
            _cgApplyPdFormFromOpts(opts);
            try {
                if (typeof exportDrawingPDF === 'function') {
                    await exportDrawingPDF({ returnBlob: opts.returnBlob === true });
                }
                return window._lastPdfBlob || null;
            } finally {
                setTimeout(() => _cgRestorePdForm(bak), 3000); // chờ export xong
            }
        }

        // ── Custom title templates (localStorage) ──────────────────────
        // Merge với TITLE_TEMPLATES built-in tại runtime
        function _getCustomTitleTemplates() {
            try {
                const raw = localStorage.getItem('cad_title_templates');
                if (raw) return JSON.parse(raw);
            } catch(e){_swallow(e);}
            return [];
        }

        function _saveCustomTitleTemplate(tpl) {
            const list = _getCustomTitleTemplates();
            if (tpl.id) {
                const idx = list.findIndex(t => t.id === tpl.id);
                if (idx >= 0) list[idx] = tpl; else list.push(tpl);
            } else {
                tpl.id = 'tpl_' + Date.now();
                list.push(tpl);
            }
            try { localStorage.setItem('cad_title_templates', JSON.stringify(list)); } catch(e){_swallow(e);}
            _mergeCustomTemplates();
            return tpl;
        }

        function _deleteCustomTitleTemplate(id) {
            const list = _getCustomTitleTemplates().filter(t => t.id !== id);
            try { localStorage.setItem('cad_title_templates', JSON.stringify(list)); } catch(e){_swallow(e);}
            // Remove from runtime map
            delete TITLE_TEMPLATES[id];
        }

        function _mergeCustomTemplates() {
            const customs = _getCustomTitleTemplates();
            customs.forEach(tpl => {
                TITLE_TEMPLATES[tpl.id] = {
                    label: '👤 ' + tpl.label,
                    blockName: tpl.blockName,
                    _customDxfContent: tpl.dxfContent,   // base64 raw DXF
                    fields: tpl.fields || []
                };
            });
        }

        // Override _loadTitleTemplate để support custom (dùng _customDxfContent thay fetch)
        const _origLoadTitleTemplate = _loadTitleTemplate;
        _loadTitleTemplate = async function(templateId) {
            if (_titleTemplateCache[templateId]) return _titleTemplateCache[templateId];
            const tpl = TITLE_TEMPLATES[templateId];
            if (!tpl) throw new Error(`Unknown template: ${templateId}`);
            let text;
            if (tpl._customDxfContent) {
                // Custom template — base64 decode with UTF-8 support for Vietnamese diacritics
                // Bug fix: plain atob() returns Latin-1 byte string, mojibaking Vietnamese text
                text = decodeURIComponent(escape(atob(tpl._customDxfContent)));
            } else {
                const res = await fetch(tpl.file);
                if (!res.ok) throw new Error(`Fetch ${tpl.file} failed: ${res.status}`);
                text = await res.text();
            }
            const blockDef = _extractDxfBlock(text, tpl.blockName);
            if (!blockDef) throw new Error(`Block ${tpl.blockName} not found`);
            const attdefs = _extractAttdefs(blockDef);
            _titleTemplateCache[templateId] = { blockDef, attdefs, template: tpl };
            return _titleTemplateCache[templateId];
        };

        // Merge custom templates on load
        _mergeCustomTemplates();

        // Modal upload custom template
        function _cgOpenUploadTemplate() {
            const modal = document.getElementById('cadCustomTemplateModal');
            if (modal) modal.style.display = 'flex';
            // Reset
            const fi = document.getElementById('cctFileInput');
            if (fi) fi.value = '';
            document.getElementById('cctPreview').innerHTML = '';
            document.getElementById('cctSaveBtn').disabled = true;
        }
        function _cgCloseUploadTemplate() {
            const modal = document.getElementById('cadCustomTemplateModal');
            if (modal) modal.style.display = 'none';
        }
        window._cgOpenUploadTemplate = _cgOpenUploadTemplate;
        window._cgCloseUploadTemplate = _cgCloseUploadTemplate;

        let _cctParsedData = null;
        async function _cgOnUploadTemplateFile(input) {
            const file = input.files && input.files[0];
            if (!file || !file.name.toLowerCase().endsWith('.dxf')) {
                displayError && displayError('Chỉ chấp nhận file .dxf');
                return;
            }
            try {
                const text = await file.text();
                // Detect first BLOCK trong file (thường là title block user design)
                const lines = text.split(/\r?\n/);
                let firstBlockName = null;
                for (let i = 0; i < lines.length - 1; i++) {
                    if (lines[i].trim() === '0' && lines[i + 1].trim() === 'BLOCK') {
                        for (let j = i + 2; j < lines.length - 1 && lines[j].trim() !== '0'; j += 2) {
                            if (lines[j].trim() === '2') { firstBlockName = lines[j + 1].trim(); break; }
                        }
                        break;
                    }
                }
                if (!firstBlockName) {
                    displayError && displayError('File DXF không có BLOCK definition');
                    return;
                }
                const blockDef = _extractDxfBlock(text, firstBlockName);
                const attdefs = _extractAttdefs(blockDef);
                if (attdefs.length === 0) {
                    displayError && displayError('BLOCK không có ATTDEF field nào — không dùng làm title block được');
                    return;
                }
                _cctParsedData = { text, blockName: firstBlockName, attdefs };
                // Render preview form với field labels tự nhập
                const container = document.getElementById('cctPreview');
                container.innerHTML = `
                    <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px;">
                        Đã đọc BLOCK <code>${_esc(firstBlockName)}</code> với ${attdefs.length} ATTDEF field.
                    </div>
                    <label style="display:block;font-size:11px;font-weight:600;margin-bottom:2px;">Tên template (hiển thị trong dropdown)</label>
                    <input type="text" id="cctTemplateName" placeholder="VD: Khung tên công ty ABC" style="width:100%;padding:6px;border:1.5px solid var(--border);border-radius:4px;font-size:12px;margin-bottom:10px;">
                    <div style="font-size:11px;font-weight:600;color:#334155;margin-bottom:4px;">Nhãn tiếng Việt cho mỗi field:</div>
                    <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:8px;">
                    ${attdefs.map(a => `
                        <div style="display:grid;grid-template-columns:120px 1fr;gap:6px;margin-bottom:4px;align-items:center;">
                            <code style="font-size:10px;color:#64748b;">${_esc(a.tag)}</code>
                            <input type="text" data-cct-label="${_esc(a.tag)}" placeholder="${_esc(a.tag)}" value="${_esc(a.tag)}" style="padding:4px 6px;border:1px solid var(--border);border-radius:3px;font-size:11px;">
                        </div>
                    `).join('')}
                    </div>
                `;
                document.getElementById('cctSaveBtn').disabled = false;
            } catch (err) {
                displayError && displayError('Lỗi đọc file: ' + err.message);
            }
        }
        window._cgOnUploadTemplateFile = _cgOnUploadTemplateFile;

        function _cgSaveCustomTemplate() {
            if (!_cctParsedData) return;
            const name = (document.getElementById('cctTemplateName') || {}).value?.trim();
            if (!name) { displayError && displayError('Nhập tên template'); return; }
            const labelInputs = document.querySelectorAll('[data-cct-label]');
            const fields = _cctParsedData.attdefs.map((a, i) => {
                const inp = labelInputs[i];
                const label = inp ? inp.value.trim() || a.tag : a.tag;
                return { key: a.tag, label, default: '' };
            });
            const tpl = _saveCustomTitleTemplate({
                label: name,
                blockName: _cctParsedData.blockName,
                dxfContent: btoa(unescape(encodeURIComponent(_cctParsedData.text))),
                fields
            });
            displayInfo && displayInfo(`✅ Đã lưu template "${name}"`);
            _cgCloseUploadTemplate();
            // Refresh main modal template dropdown
            _cgRefreshTemplateDropdown();
            // Select the new template
            document.getElementById('cgTemplateId').value = tpl.id;
            _onCgTemplateChange();
        }
        window._cgSaveCustomTemplate = _cgSaveCustomTemplate;

        function _cgRefreshTemplateDropdown() {
            const sel = document.getElementById('cgTemplateId');
            if (!sel) return;
            const currentVal = sel.value;
            sel.innerHTML = Object.entries(TITLE_TEMPLATES).map(([id, tpl]) =>
                `<option value="${id}">${tpl.label}</option>`
            ).join('') + `<option value="none">🚫 Không xuất khung tên (chỉ dữ liệu)</option>`;
            // Try restore previous selection
            if (TITLE_TEMPLATES[currentVal] || _cgIsNoTitle(currentVal)) sel.value = currentVal;
        }
        window._cgRefreshTemplateDropdown = _cgRefreshTemplateDropdown;

        // 'none' không phải template trong TITLE_TEMPLATES — generator bỏ khung tên + trang trí, chỉ vẽ dữ liệu.
        // Viết literal (không dùng const) để hàm hoist an toàn, không dính TDZ nếu script lỗi giữa chừng.
        function _cgIsNoTitle(templateId) { return templateId === 'none'; }
        window._cgIsNoTitle = _cgIsNoTitle;

        // ── Multi-sheet split ─────────────────────────────────────────
        // A3 landscape @ 1:1000 → view = 420m × 297m thực địa
        // Grid partition với overlap 10%
        function _computeSheetPartitions(bounds, scale, paper = 'a3', overlap = 0.1, templateId) {
            const paperDim = paper === 'a3' ? { W: 420, H: 297 } : { W: 297, H: 210 };
            let sheetW = (paperDim.W - 20) * (scale / 1000);  // trừ lề, đơn vị m
            let sheetH = (paperDim.H - 60) * (scale / 1000);  // trừ lề + title block area
            if (templateId === 'knop12' && paper === 'a3' && typeof QBT_FORM !== 'undefined') {
                // Mẫu QBT: vùng vẽ = khung trong 384,65 × 281,84 − lề 15 − tiêu đề đầu tờ 25 − khung tên 52,9 − mũi tên Bắc ~20
                sheetW = (QBT_FORM.W - 30 - 20) * (scale / 1000);
                sheetH = (QBT_FORM.innerH - 30 - 25 - QBT_FORM.H) * (scale / 1000);
            }
            const worldW = bounds.maxX - bounds.minX;
            const worldH = bounds.maxY - bounds.minY;
            const step = 1 - overlap;
            const nCols = Math.max(1, Math.ceil(worldW / (sheetW * step)));
            const nRows = Math.max(1, Math.ceil(worldH / (sheetH * step)));
            const partitions = [];
            for (let r = 0; r < nRows; r++) {
                for (let c = 0; c < nCols; c++) {
                    const px = bounds.minX + c * sheetW * step;
                    const py = bounds.minY + r * sheetH * step;
                    partitions.push({
                        minX: px, minY: py,
                        maxX: Math.min(bounds.maxX, px + sheetW),
                        maxY: Math.min(bounds.maxY, py + sheetH),
                        index: partitions.length + 1,
                        total: nCols * nRows
                    });
                }
            }
            return partitions;
        }
        window._computeSheetPartitions = _computeSheetPartitions;

        // Compute bounds từ rows (VN2000 chuẩn, không apply offset — chỉ để detect)
        function _computeCadBoundsFromRows(rows, cm = 105.75) {
            let b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            for (const r of rows) {
                const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                if (!isFinite(lat) || !isFinite(lon)) continue;
                const vn = convertLatLonToVn2000(lat, lon, cm);
                b.minX = Math.min(b.minX, vn.x);
                b.minY = Math.min(b.minY, vn.y);
                b.maxX = Math.max(b.maxX, vn.x);
                b.maxY = Math.max(b.maxY, vn.y);
            }
            return b;
        }
        window._computeCadBoundsFromRows = _computeCadBoundsFromRows;

        // Update _generateCadDrawing để filter theo sheetBounds + outlier nếu có
        // (Override qua wrapper — không phá hàm gốc)
        const _origGenerateCadDrawing = _generateCadDrawing;
        _generateCadDrawing = async function(opts) {
            console.log('[Gen wrapper] Entry. sheetBounds=', !!opts.sheetBounds, 'excludeOutliers=', !!opts.excludeOutliers, 'stamps=', !!opts.stamps);
            const needSheet = !!opts.sheetBounds;
            const needOutlier = !!opts.excludeOutliers;
            if (!needSheet && !needOutlier) {
                console.log('[Gen wrapper] Direct call orig');
                try {
                    const r = await _origGenerateCadDrawing(opts);
                    console.log('[Gen wrapper] Orig returned length:', r ? r.length : 'null');
                    return r;
                } catch (e) {
                    console.error('[Gen wrapper] Orig threw:', e);
                    throw e;
                }
            }
            const cm = opts.cm || 105.75;
            const outDE = (opts.outputOffset && opts.outputOffset.dE) || 0;
            const outDN = (opts.outputOffset && opts.outputOffset.dN) || 0;
            const origFilter = _filterRowsForCadExport;
            // Compute outlier trên rows GỐC (không sheetBounds) — outlier là property của cluster tổng
            let outlierNames = null;
            if (needOutlier) {
                const rowsAll = origFilter(opts.filters || {});
                const det = _detectOutliers(rowsAll, cm);
                outlierNames = det.outlierNames;
            }
            const sb = opts.sheetBounds;
            const _patchedFilter = function(f) {
                let rows = origFilter(f);
                if (outlierNames && outlierNames.size > 0) {
                    rows = rows.filter(r => !outlierNames.has(String(r[1] || '').trim()));
                }
                if (needSheet) {
                    rows = rows.filter(r => {
                        const lat = parseCoord(r[2]), lon = parseCoord(r[3]);
                        if (!isFinite(lat) || !isFinite(lon)) return false;
                        const vn = convertLatLonToVn2000(lat, lon, cm);
                        const xOut = vn.x + outDE;
                        const yOut = vn.y + outDN;
                        return xOut >= sb.minX && xOut <= sb.maxX && yOut >= sb.minY && yOut <= sb.maxY;
                    });
                }
                return rows;
            };
            _filterRowsForCadExport = _patchedFilter;
            try {
                // Add sheet index to metadata (chỉ khi multi-sheet — sb có thể undefined khi single-sheet + excludeOutliers)
                const optsWithIdx = { ...opts, metadata: { ...opts.metadata } };
                if (sb && sb.total > 1) {
                    const shIdx = `Tờ ${String(sb.index).padStart(2, '0')}/${String(sb.total).padStart(2, '0')}`;
                    optsWithIdx.metadata.BV_SO = (opts.metadata.BV_SO || '') + ' — ' + shIdx;
                    optsWithIdx.metadata.SHBV  = (opts.metadata.SHBV  || '') + ' — ' + shIdx;
                    // P59: pass sheet index tường minh cho _drawTitleBlockStateFull
                    optsWithIdx._sheetIdx = sb.index;
                    optsWithIdx._sheetTotal = sb.total;
                }
                return await _origGenerateCadDrawing(optsWithIdx);
            } finally {
                _filterRowsForCadExport = origFilter;
            }
        };

        // Expose Phase C helpers
        window._cgOpenPreview = _cgOpenPreview;
        window._cgExportPdf   = _cgExportPdf;
        window._getCustomTitleTemplates = _getCustomTitleTemplates;
        window._saveCustomTitleTemplate = _saveCustomTitleTemplate;
        window._deleteCustomTitleTemplate = _deleteCustomTitleTemplate;

        // ═══════════════════════════════════════════════════════════════════
        // (End CAD Generator Phase C)
        // ═══════════════════════════════════════════════════════════════════
