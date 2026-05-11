# Lighting Survey — Khảo Sát Chiếu Sáng

Web app bản đồ khảo sát hệ thống chiếu sáng công cộng.

## Tính năng
- Bản đồ Leaflet full-screen (OSM + Google Satellite)
- Thêm marker tại vị trí GPS hoặc click bản đồ
- Lưu dữ liệu lên **Google Sheets** qua Apps Script
- Upload ảnh lên **GitHub** qua Apps Script proxy
- Tìm kiếm trụ theo tên / tọa độ
- Chỉ đường xe máy (OSRM)
- Xuất báo cáo Excel theo ngày / phường xã
- Xuất CAD (DXF, VN2000)
- PWA — cài được trên điện thoại

## Cài đặt
1. Clone repo
2. Mở bằng Live Server (VS Code) hoặc bất kỳ static server
3. Cấu hình GAS URL trong `index.html` (biến `KHAOSAT_GAS_URL`)

## Backend
- `gas-khaosat.js` — dán vào Google Apps Script, deploy thành Web App
- Cần tạo Script Property: `GITHUB_TOKEN` = PAT với scope `contents:write`

## Author
Mai Vũ Lâm — maivulam2020@gmail.com
