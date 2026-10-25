// Phase 6 — ค่าตั้งฝั่งหน้าจอ
export const API_BASE = '';                 // ว่าง = เซิร์ฟเวอร์เดียวกับหน้าเว็บ
export const MAP = {
  center: [16.80, 100.25],
  zoom: 13,
  tiles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; ผู้ร่วมพัฒนา <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · เส้นทาง <a href="https://project-osrm.org">OSRM</a>',
};
export const BUS_COLORS = ['#0e7c86', '#c2410c', '#7c3aed', '#15803d', '#be185d', '#1d4ed8', '#a16207'];
export const ARRIVALS_REFRESH_MS = 2000;
export const VALIDATE_DEBOUNCE_MS = 200;
export const GPS_TEST_INTERVAL_MS = 1000;
