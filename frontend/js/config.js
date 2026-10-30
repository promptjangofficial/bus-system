// Phase 6 — ค่าตั้งฝั่งหน้าจอ
export const API_BASE = '';                 // ว่าง = เซิร์ฟเวอร์เดียวกับหน้าเว็บ
export const MAP = {
  center: [16.80, 100.25],
  zoom: 13,
  // แผนที่ OpenStreetMap (ไม่ต้องใช้ API key) ลดสีด้วย --tile-filter ให้สีสายรถเด่น
  tiles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  subdomains: 'abc',
  attribution: '&copy; ผู้ร่วมพัฒนา <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · เส้นทาง <a href="https://project-osrm.org">OSRM</a>',
};
// สีประจำสาย ตรงกับลายรถในวิดีโอ (ตัวถังขาวคาดแถบสี) · ทุกสีอ่านตัวอักษรขาวบนพื้นสีได้
export const LINE_COLORS = { 'NU-01': '#157f44', 'AIR-03': '#bd5b00', 'CITY-02': '#2563c9' };
// รถที่เพิ่มภายหลังได้สีจากชุดนี้ตามชื่อ (ไม่มีโทน teal เพราะชนกับสีหลักของหน้าจอ)
export const BUS_COLORS = ['#7a3fb8', '#b0306a', '#4a5d78', '#6b5a00', '#3b4fb0', '#8a4a2a'];
// ธีมมืด: สีเดียวกันแต่สว่างขึ้น ให้เส้นทางเด่นบนแผนที่มืด · ตัวอักษรบนสีเป็นสีเข้ม (--on-line)
// ลำดับตรงกับชุดสว่าง รถคันเดิมจึงได้สีโทนเดิม
export const LINE_COLORS_DARK = { 'NU-01': '#4cc38a', 'AIR-03': '#ff9a3d', 'CITY-02': '#6aa5ff' };
export const BUS_COLORS_DARK = ['#b48af0', '#f07aa8', '#9fb0c8', '#d2bb45', '#8d9cf5', '#d39a6e'];
export const ARRIVALS_REFRESH_MS = 2000;
export const VALIDATE_DEBOUNCE_MS = 200;
export const GPS_TEST_INTERVAL_MS = 1000;
