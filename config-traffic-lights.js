// ═══════════════════════════════════════════════════════════════════════════
// CONFIG VARIANT: TRAFFIC LIGHTS SURVEY
// ═══════════════════════════════════════════════════════════════════════════
// P42 — Fork vertical cho khảo sát đèn tín hiệu giao thông.
//
// Cách dùng:
// 1. Fork repo lighting-survey → new repo traffic-light-survey
// 2. Trong index.html của repo mới, thay TYPE_CONFIG bằng TRAFFIC_LIGHT_TYPES bên dưới
// 3. Rename các label "trụ đèn" → "cột tín hiệu", "tủ điều khiển" → "tủ đèn tín hiệu"
// 4. Update template báo cáo Excel + PDF header
// 5. Deploy lên URL riêng, VD: neo-era/traffic-light-survey
//
// Marketing target: Sở GTVT, Ban ATGT, Phòng CSGT
// ═══════════════════════════════════════════════════════════════════════════

// 6 loại đối tượng chính cho khảo sát đèn tín hiệu
const TRAFFIC_LIGHT_TYPES = {
    1: {
        label: 'Đèn tín hiệu 3 màu (chính)',
        color: '#ef4444',
        shape: 'pole',
        emoji: '🚦',
        icon: 'makeLampIcon'
    },
    2: {
        label: 'Đèn xoay 4 hướng',
        color: '#f59e0b',
        shape: 'pole',
        emoji: '🚥',
        icon: 'makeLampIcon'
    },
    3: {
        label: 'Đèn cho người đi bộ',
        color: '#10b981',
        shape: 'pole',
        emoji: '🚶',
        icon: 'makeLampIcon'
    },
    4: {
        label: 'Đèn cảnh báo (vàng nhấp nháy)',
        color: '#eab308',
        shape: 'pole',
        emoji: '⚠️',
        icon: 'makeLampIcon'
    },
    5: {
        label: 'Tủ điều khiển tín hiệu',
        color: '#2563eb',
        shape: 'cabinet',
        emoji: '📦',
        icon: 'makeCabinetIcon'
    },
    6: {
        label: 'Camera giám sát giao thông',
        color: '#8b5cf6',
        shape: 'cabinet',
        emoji: '📹',
        icon: 'makeCabinetIcon'
    }
};

// Fields specific cho traffic lights (mở rộng row schema)
const TRAFFIC_LIGHT_EXTRA_FIELDS = [
    'Chu kỳ đèn (giây)',
    'Kiểu đồng bộ',           // 'fixed' | 'adaptive' | 'vehicle-actuated'
    'Kết nối TCC',            // Trung tâm điều khiển
    'Model camera',
    'Số kênh',
    'Năm lắp đặt'
];

const TRAFFIC_LIGHT_SYNC_MODES = [
    { id: 'fixed', label: 'Cố định' },
    { id: 'adaptive', label: 'Thích ứng lưu lượng' },
    { id: 'actuated', label: 'Kích hoạt theo phương tiện' }
];

// Rename UI labels
const TRAFFIC_LIGHT_UI_LABELS = {
    'Trụ đèn': 'Cột tín hiệu',
    'Tủ điều khiển': 'Tủ đèn tín hiệu',
    'Loại trụ': 'Loại cột',
    'Chiếu sáng': 'Đèn tín hiệu',
    'Bảng khảo sát chiếu sáng': 'Bảng khảo sát đèn tín hiệu'
};

// Config báo cáo Excel — thay logo + tên đơn vị mặc định
const TRAFFIC_LIGHT_REPORT_DEFAULT = {
    donvi_name: 'Sở Giao thông Vận tải',
    phong_name: 'Phòng Kỹ thuật',
    report_title: 'BÁO CÁO HỆ THỐNG ĐÈN TÍN HIỆU GIAO THÔNG',
    tcvn_ref: '(Theo TCVN 8813:2011 và QCVN 41:2019/BGTVT)'
};

// TYPE_CONFIG mapping cho popup marker + icon
const TRAFFIC_LIGHT_TYPE_CONFIG_MAP = {
    1: { label: 'Đèn tín hiệu chính', bg: '#fee2e2', color: '#ef4444', emoji: '🚦', shape: 'pole' },
    2: { label: 'Đèn xoay 4 hướng',   bg: '#fef3c7', color: '#f59e0b', emoji: '🚥', shape: 'pole' },
    3: { label: 'Đèn người đi bộ',    bg: '#dcfce7', color: '#10b981', emoji: '🚶', shape: 'pole' },
    4: { label: 'Đèn cảnh báo',       bg: '#fef9c3', color: '#eab308', emoji: '⚠️', shape: 'pole' },
    5: { label: 'Tủ điều khiển',      bg: '#dbeafe', color: '#2563eb', emoji: '📦', shape: 'cabinet' },
    6: { label: 'Camera giao thông',  bg: '#ede9fe', color: '#8b5cf6', emoji: '📹', shape: 'cabinet' }
};

/*
 * Hướng dẫn migration từ Lighting Survey → Traffic Light Survey:
 *
 * 1. Fork repo (GitHub):
 *    - Fork neo-era/lighting-survey → traffic-light-survey
 *    - Clone về máy
 *
 * 2. Thay config trong index.html:
 *    - Search & replace TYPE_CONFIG → dùng TRAFFIC_LIGHT_TYPE_CONFIG_MAP
 *    - Search & replace text theo TRAFFIC_LIGHT_UI_LABELS
 *
 * 3. Update schema Google Sheet:
 *    - Thêm cột: Chu kỳ đèn, Kiểu đồng bộ, Kết nối TCC, Model camera, Số kênh, Năm lắp đặt
 *    - Update HEADER trong gas-khaosat.js
 *
 * 4. Update báo cáo Excel:
 *    - Thay logo + tên đơn vị mặc định trong bc_ config
 *    - Đổi title thành TRAFFIC_LIGHT_REPORT_DEFAULT.report_title
 *
 * 5. Deploy:
 *    - GitHub Pages: enable trong repo settings
 *    - URL: neo-era.github.io/traffic-light-survey/
 *
 * 6. Marketing:
 *    - Target: Sở GTVT, Ban ATGT, Phòng CSGT các tỉnh
 *    - Giá đề xuất: gói Chuẩn 92 triệu (giống Lighting Survey)
 *    - Selling points: RTK GNSS support, PDF bản vẽ kỹ thuật, offline PWA
 */

// Export cho testing/import
if (typeof module !== 'undefined') {
    module.exports = {
        TRAFFIC_LIGHT_TYPES,
        TRAFFIC_LIGHT_EXTRA_FIELDS,
        TRAFFIC_LIGHT_SYNC_MODES,
        TRAFFIC_LIGHT_UI_LABELS,
        TRAFFIC_LIGHT_REPORT_DEFAULT,
        TRAFFIC_LIGHT_TYPE_CONFIG_MAP
    };
}
