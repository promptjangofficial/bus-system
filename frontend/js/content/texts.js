// Phase 6 — ข้อความคงที่บนหน้าจอ
export const STATUS_LABEL = {
  MOVING: 'กำลังวิ่ง',
  AT_STATION: 'จอดที่สถานี',
  BROKEN: 'รถเสีย',
  MODIFYING: 'แก้ไขเส้นทาง',
  RETIRED: 'ปลดระวาง',
};

// วันที่แสดงหน้านาฬิกาจำลอง (บทวิดีโอเริ่มเช้าวันจันทร์)
export const CLOCK_DAY = 'จันทร์';

export const NETWORK_SOURCE = {
  osrm: 'ตามถนนจริง',
  mixed: 'ตามถนนจริงบางส่วน',
  estimate: 'ระยะทางโดยประมาณ',
};

// มุมมอง: ผู้โดยสาร (มือถือ) / ศูนย์ควบคุม (ผู้ดูแล)
export const VIEWS = [
  ['rider', 'ผู้โดยสาร'],
  ['control', 'ศูนย์ควบคุม'],
];

export const RIDER = {
  listTitle: 'รถที่กำลังให้บริการ',
  hint: 'แตะป้ายบนแผนที่ เพื่อดูว่ารถสายไหนจะมาถึงอีกกี่นาที',
  searchPlaceholder: 'ค้นหารถ เช่น NU-01',
  back: 'ดูรถทุกสาย',
  brokenNote: 'รถเสียกลางทาง ศูนย์ควบคุมรับทราบแล้ว กำลังส่งช่างไป',
  modifyingNote: 'ศูนย์ควบคุมกำลังปรับเส้นทาง รถจอดรออยู่ที่ป้าย',
};

export const TABS = [
  ['fleet', 'รถโดยสาร'],
  ['add', 'เพิ่มรถ'],
  ['devices', 'อุปกรณ์ติดรถ'],
  ['ds', 'โครงสร้างข้อมูล'],
];

export const DEVICE_FEATURES = [
  { name: 'ตำแหน่งรถจริงบนแผนที่', device: 'GPS Tracker (เช่น ESP32 + GPS / 4G)', type: 'gps', fallback: 'ใช้ตำแหน่งจากการจำลอง' },
  { name: 'ตรวจว่ารถถึงสถานีอัตโนมัติ', device: 'GPS (รัศมี 80 ม.)', type: 'gps', fallback: 'คำนวณจากระยะทางและความเร็ว' },
  { name: 'เวลาถึงสถานีจากความเร็วจริง', device: 'GPS', type: 'gps', fallback: 'ใช้ความเร็วที่กำหนดไว้' },
  { name: 'จำนวนผู้โดยสาร / เตือนเกินความจุ', device: 'เซนเซอร์นับคนที่ประตู', type: 'passenger', fallback: 'แสดง "รอเซนเซอร์"' },
  { name: 'แจ้งรถเสียอัตโนมัติ', device: 'OBD-II อ่านรหัสขัดข้อง', type: 'engine', fallback: 'ผู้ดูแลกด "แจ้งรถเสีย" เอง' },
];

export const PAYLOAD_EXAMPLES =
`{"bus":"NU-01","type":"gps","lat":16.8153,"lng":100.2635,"speedKmh":28}
{"bus":"NU-01","type":"passenger","count":23}
{"bus":"NU-01","type":"engine","fault":true,"code":"P0300"}`;
