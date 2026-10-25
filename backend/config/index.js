// Phase 0 — ค่าตั้งระบบทั้งหมด (แก้ที่นี่ที่เดียว ไม่มีค่าคงที่ซ่อนในโค้ดส่วนอื่น)
const path = require('path');
const env = process.env;

module.exports = {
  PORT: Number(env.PORT) || 3000,

  // การจำลอง
  START_CLOCK_SEC: 6 * 3600,   // เวลาเริ่มของนาฬิกาจำลอง 06:00
  DEFAULT_SCALE: 30,           // 1 วินาทีจริง = 30 วินาทีจำลอง
  SCALES: [1, 10, 30, 60],
  DWELL_SEC: 60,               // เวลาจอดที่สถานี (เวลาจำลอง)
  TICK_MS: 100,                // รอบคำนวณ
  BROADCAST_MS: 250,           // รอบส่งสถานะให้หน้าจอ

  // เครือข่ายถนน
  ROAD_FACTOR: 1.25,           // ใช้เมื่อดึงระยะทางจริงไม่ได้: เส้นตรง × ค่านี้
  MIN_ROAD_KM: 0.1,            // ถนนสั้นสุด กันหารด้วยศูนย์ในการจำลอง
  USE_OSRM: env.USE_OSRM !== '0',
  OSRM_URL: env.OSRM_URL || 'https://router.project-osrm.org',
  OSRM_TIMEOUT_MS: 6000,

  // อุปกรณ์ติดรถ
  GEOFENCE_M: 80,              // ใกล้สถานีเกินนี้ = ถึงสถานี
  LIVE_TTL_MS: 30000,          // GPS เงียบเกินนี้ = สัญญาณขาด กลับไปใช้การจำลอง
  OFF_ROUTE_WARN_M: 400,
  DEVICE_API_KEY: env.DEVICE_API_KEY || '',   // ว่าง = ไม่ตรวจคีย์

  // ข้อจำกัดข้อมูลรถ
  LIMITS: { nameMax: 20, plateMax: 20, capacity: [1, 200], speedKmh: [5, 120] },
  RUNTIME_DIR: env.BUS_RUNTIME_DIR || path.join(__dirname, '..', 'data', 'runtime'),
  LOG_MAX: 60,
  BODY_MAX_BYTES: 100 * 1024,
};
