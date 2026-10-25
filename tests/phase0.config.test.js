// เฟส 0 — ค่าตั้งและข้อความ
const test = require('node:test');
const assert = require('node:assert/strict');
const { BACKEND, listFiles, read } = require('./helpers');
const config = require('../backend/config');
const { ERRORS, LOG, message, AppError, fail } = require('../backend/config/messages');

test('ค่าตั้งการจำลองสมเหตุสมผล', () => {
  assert.ok(config.SCALES.includes(config.DEFAULT_SCALE), 'DEFAULT_SCALE ต้องอยู่ใน SCALES');
  assert.ok(config.SCALES.every(s => Number.isFinite(s) && s > 0));
  assert.ok(config.DWELL_SEC > 0);
  assert.ok(config.TICK_MS > 0 && config.TICK_MS <= config.BROADCAST_MS);
  assert.ok(config.START_CLOCK_SEC >= 0 && config.START_CLOCK_SEC < 86400);
});

test('ค่าตั้งเครือข่ายถนนและอุปกรณ์สมเหตุสมผล', () => {
  assert.ok(config.ROAD_FACTOR >= 1);
  assert.ok(config.GEOFENCE_M > 0 && config.GEOFENCE_M < config.OFF_ROUTE_WARN_M);
  assert.ok(config.LIVE_TTL_MS > config.BROADCAST_MS);
  assert.match(config.OSRM_URL, /^https?:\/\//);
});

test('ขอบเขตข้อมูลรถเรียงถูก (ต่ำ ≤ สูง)', () => {
  for (const k of ['capacity', 'speedKmh']) {
    const [lo, hi] = config.LIMITS[k];
    assert.ok(lo > 0 && lo <= hi, k);
  }
  assert.ok(config.LIMITS.nameMax > 0 && config.LIMITS.plateMax > 0);
});

test('ทุกรหัสข้อผิดพลาดที่โค้ด backend ใช้ มีข้อความรองรับ', () => {
  const used = new Set();
  for (const f of listFiles(BACKEND, '.js')) {
    const src = read(f);
    for (const m of src.matchAll(/code:\s*'([A-Z_]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/AppError\('([A-Z_]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/message\('([A-Z_]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size > 10);
  const missing = [...used].filter(c => !ERRORS[c]);
  assert.deepEqual(missing, [], 'รหัสที่ไม่มีข้อความ');
});

test('ทุกข้อความบันทึก (LOG.x) ที่โค้ดเรียก มีอยู่จริง', () => {
  const missing = [];
  for (const f of listFiles(BACKEND, '.js')) {
    for (const m of read(f).matchAll(/LOG\.(\w+)\(/g)) if (typeof LOG[m[1]] !== 'function') missing.push(m[1]);
  }
  assert.deepEqual(missing, []);
});

test('ข้อความทุกตัวสร้างได้โดยไม่พัง แม้พารามิเตอร์ไม่ครบ', () => {
  for (const code of Object.keys(ERRORS)) assert.equal(typeof message(code, {}), 'string', code);
  for (const [k, fn] of Object.entries(LOG)) assert.equal(typeof fn('x', 'y', 'z'), 'string', k);
  assert.equal(message('ไม่มีรหัสนี้'), 'ไม่มีรหัสนี้');
});

test('AppError และ fail() แปลงผลลัพธ์ถูก', () => {
  const e = new AppError('BUS_NOT_FOUND', { name: 'X' }, 404);
  assert.equal(e.status, 404);
  assert.match(e.message, /X/);
  const f = fail({ ok: false, code: 'NO_EDGE', from: 'a', to: 'c' });
  assert.equal(f.code, 'NO_EDGE');
  assert.deepEqual(f.params, { from: 'a', to: 'c' });
  assert.match(f.message, /a → c/);
});
