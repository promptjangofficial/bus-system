// Phase 0 — ข้อความทั้งหมดของระบบ (ข้อผิดพลาด + บันทึกเหตุการณ์)
// โค้ดส่วนอื่นส่งแค่ "รหัส" มา ข้อความแก้ได้ที่ไฟล์นี้ไฟล์เดียว

const ERRORS = {
  ROUTE_TOO_SHORT:   () => 'เส้นทางต้องมีอย่างน้อย 2 สถานี',
  STATION_NOT_FOUND: p => `ไม่มีสถานีรหัส "${p.station}"`,
  DUPLICATE_ADJACENT:p => `สถานี ${p.station} ซ้ำติดกับจุดก่อนหน้าหรือถัดไป`,
  NO_EDGE:           p => `ไม่มีถนนเชื่อม ${p.from} → ${p.to}${p.closing ? ' (ช่วงวนกลับจุดเริ่มต้น)' : ''}`,
  MIN_STOPS:         () => 'เส้นทางต้องเหลืออย่างน้อย 2 สถานี',
  DELETE_CURRENT:    () => 'ลบสถานีที่รถจอดอยู่ไม่ได้',
  INDEX_OUT_OF_RANGE:() => 'ลำดับจุดแวะไม่ถูกต้อง',
  BUS_EXISTS:        p => `มีรถชื่อ ${p.name} แล้ว`,
  BUS_NOT_FOUND:     p => `ไม่พบรถชื่อ ${p.name}`,
  INVALID_FIELD:     p => `ข้อมูล "${p.field}" ไม่ถูกต้อง${p.hint ? ' — ' + p.hint : ''}`,
  NOT_MODIFYING:     () => 'ต้องหยุดรถเพื่อแก้ไขเส้นทางก่อน',
  CANNOT_MODIFY:     () => 'รถเสียหรือปลดระวางอยู่ แก้ไขเส้นทางไม่ได้',
  MUST_BE_AT_STATION:() => 'รถต้องจอดที่สถานีก่อน',
  ALREADY_RETIRED:   () => 'รถคันนี้ปลดระวางแล้ว',
  NOT_RETIRED:       () => 'ต้องปลดระวางรถก่อนจึงจะลบได้',
  CONFIRM_MISMATCH:  () => 'ชื่อที่ยืนยันไม่ตรงกับรถที่จะลบ',
  NOT_BROKEN:        () => 'รถไม่ได้อยู่ในสถานะรถเสีย',
  BAD_SCALE:         p => `อัตราเร็วต้องเป็น ${(p.allowed || []).join(', ') || 'ค่าที่กำหนดไว้'}`,
  BAD_DEVICE_TYPE:   p => `ไม่รู้จัก type "${p.type}" (ใช้ gps / passenger / engine)`,
  DEVICE_FIELD:      p => `ข้อมูลอุปกรณ์ไม่ครบ: ${p.field}`,
  DEVICE_KEY:        () => 'คีย์อุปกรณ์ไม่ถูกต้อง',
  BAD_JSON:          () => 'รูปแบบ JSON ไม่ถูกต้อง',
  BODY_TOO_LARGE:    () => 'ข้อมูลที่ส่งมาใหญ่เกินไป',
  NOT_FOUND:         () => 'ไม่พบปลายทางที่เรียก',
  BAD_URL:           () => 'รูปแบบ URL ไม่ถูกต้อง',
  INTERNAL:          () => 'เซิร์ฟเวอร์ขัดข้อง',
};

const LOG = {
  loaded:        n => `โหลดข้อมูลรถ ${n} คัน`,
  rootCreated:   n => `ลงทะเบียน ${n} เป็นคันแรกของระบบ`,
  busCreated:    n => `ลงทะเบียนรถ ${n}`,
  retired:       n => `${n} ปลดระวาง`,
  removed:       n => `ลบ ${n} ออกจากระบบ`,
  broken:   (n, r) => `${n} รถเสีย${r ? ' — ' + r : ''}`,
  repaired:      n => `${n} ซ่อมเสร็จ เดินทางต่อ`,
  modifyPending: n => `${n} จะหยุดแก้ไขเส้นทางเมื่อถึงสถานีถัดไป`,
  modifying:     n => `${n} หยุดที่สถานีเพื่อแก้ไขเส้นทาง`,
  resumed:       n => `${n} ตรวจเส้นทางใหม่ผ่าน กลับมาเดินรถ`,
  stopInserted:(n, s) => `${n} เพิ่มจุดแวะ ${s}`,
  stopDeleted: (n, s) => `${n} ลบจุดแวะ ${s}`,
  departed: (n, a, b) => `${n} ออกจาก ${a} → ${b}`,
  arrived:    (n, s) => `${n} ถึง ${s}`,
  lap:     (n, k, s) => `${n} ครบรอบที่ ${k} กลับถึง ${s}`,
  gpsStart:      n => `${n} เริ่มรับตำแหน่งจาก GPS`,
  gpsLost:       n => `${n} สัญญาณ GPS ขาด กลับไปใช้การจำลอง`,
  overCapacity:(n, c, cap) => `${n} ผู้โดยสารเกินความจุ (${c}/${cap})`,
  engineFault:   c => `อุปกรณ์แจ้งเครื่องยนต์ขัดข้อง ${c}`,
  userBreakdown: () => 'จำลองโดยผู้ดูแล',
  simStart:      () => 'เริ่มเวลาจำลอง',
  simPause:      () => 'หยุดเวลาจำลองชั่วคราว',
  simSpeed:      s => `ปรับอัตราเร็วเวลาเป็น ${s}×`,
  simReset:      () => 'รีเซ็ตระบบกลับเป็นข้อมูลตั้งต้น',
  skippedRecord:(n, e) => `ข้ามข้อมูลรถ ${n}: ${e}`,
};

function message(code, params = {}) {
  const fn = ERRORS[code];
  if (!fn) return code;
  try { return fn(params || {}); } catch { return code; }
}

class AppError extends Error {
  constructor(code, params = {}, status = 400) {
    super(message(code, params));
    this.code = code;
    this.params = params;
    this.status = status;
  }
}

// แปลงผลลัพธ์ { ok:false, code, ... } จากชั้น core เป็น AppError
function fail(result, status = 400) {
  const { ok, code, ...params } = result;
  return new AppError(code, params, status);
}

module.exports = { ERRORS, LOG, message, AppError, fail };
