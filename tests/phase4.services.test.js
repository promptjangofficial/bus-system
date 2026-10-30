// เฟส 4 — ตรรกะระบบ + ความเข้ากันได้กับเฟส 0–3
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.USE_OSRM = process.env.USE_OSRM ?? '0';
process.env.BUS_RUNTIME_DIR = process.env.BUS_RUNTIME_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'bus-p4-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../backend/config');
const { ERRORS } = require('../backend/config/messages');
const { createApp } = require('../backend/services/app');
const { STATUS } = require('../backend/services/fleet');

const quiet = { log() {}, warn() {} };
const RUNTIME_BUSES = path.join(config.RUNTIME_DIR, 'buses.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function freshApp() {
  try { fs.unlinkSync(RUNTIME_BUSES); } catch {}
  return createApp(quiet);
}
// เดินเวลาจำลองไป simSec วินาที เป็นก้าวละ stepSec
function advance(ctx, simSec, stepSec = 5) {
  ctx.sim.running = true;
  const scale = ctx.sim.scale;
  for (let t = 0; t < simSec; t += stepSec) ctx.sim.tick(stepSec / scale);
}
const bus = (ctx, n) => ctx.fleet.get(n);
const errCode = fn => { try { fn(); } catch (e) { return e.code; } return null; };

const VIEW_FIELDS = ['name', 'plate', 'capacity', 'speedKmh', 'status', 'pendingModify', 'laps', 'route', 'currentIndex',
  'device', 'current', 'next', 'segmentKm', 'lat', 'lng', 'fraction', 'etaSec', 'etaBasis', 'dwellSec', 'positionSource', 'offRouteM'];

test('เข้ากับเฟส 1–3: สร้างเครือข่ายถนนแบบออฟไลน์ได้ ทุกถนน km > 0', async () => {
  const ctx = await freshApp();
  assert.equal(ctx.network.source, 'estimate');
  assert.equal(ctx.network.stations, 12);
  for (const r of ctx.graph.roads()) {
    assert.ok(r.km > 0, `${r.from}-${r.to}`);
    assert.ok(r.geometry.length >= 2);
  }
  assert.equal(ctx.fleet.list().length, 3);
});

test('ลงทะเบียนรถ: ตรวจทุกช่องข้อมูล ข้อความเป็นภาษาไทยจากเฟส 0', async () => {
  const ctx = await freshApp();
  const ok = { name: 'BUS-04', plate: '12-3456 พล', capacity: 30, speedKmh: 30, route: ['d', 'g', 'i'] };
  const cases = [
    [{ ...ok, name: '' }, 'INVALID_FIELD'],
    [{ ...ok, name: 'x'.repeat(21) }, 'INVALID_FIELD'],
    [{ ...ok, name: '<script>' }, 'INVALID_FIELD'],
    [{ ...ok, plate: '' }, 'INVALID_FIELD'],
    [{ ...ok, capacity: 0 }, 'INVALID_FIELD'],
    [{ ...ok, capacity: 2.5 }, 'INVALID_FIELD'],
    [{ ...ok, speedKmh: 500 }, 'INVALID_FIELD'],
    [{ ...ok, route: 'dgi' }, 'INVALID_FIELD'],
    [{ ...ok, route: ['d', 'g', 'k'] }, 'NO_EDGE'],
    [{ ...ok, name: 'NU-01' }, 'BUS_EXISTS'],
    [{ ...ok, name: 'nu-01' }, 'BUS_EXISTS'],
    [undefined, 'INVALID_FIELD'],
  ];
  for (const [input, code] of cases) {
    let err;
    try { ctx.fleet.create(input); } catch (e) { err = e; }
    assert.ok(err, `ควรถูกปฏิเสธ: ${JSON.stringify(input)}`);
    assert.equal(err.code, code, JSON.stringify(input));
    assert.ok(ERRORS[err.code]);
    assert.match(err.message, /[ก-๙]/);
  }
  const b = ctx.fleet.create(ok);
  assert.equal(b.status, STATUS.AT_STATION);
  assert.deepEqual(ctx.fleet.list().map(x => x.name), ['AIR-03', 'BUS-04', 'CITY-02', 'NU-01']);
});

test('จำลองการเดินรถ: จอด → ออก → ถึงสถานีถัดไป → เลื่อน current', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'CITY-02');
  assert.equal(b.route.current.code, 'd');
  advance(ctx, config.DWELL_SEC / 2 + 5);
  assert.equal(b.status, STATUS.MOVING);
  const segSec = ctx.graph.dist('d', 'g') / b.speedKmh * 3600;
  advance(ctx, segSec + 5);
  assert.equal(b.route.current.code, 'g');
  assert.equal(b.status, STATUS.AT_STATION);
  assert.ok(ctx.log.list(50).some(l => l.text.includes('CITY-02 ถึง')));
});

test('จำลองการเดินรถ: วิ่งครบรอบแล้วกลับจุดเริ่ม นับรอบได้', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'CITY-02');
  const codes = b.route.toArray();
  const lap = codes.reduce((s, u, i) => s + ctx.graph.dist(u, codes[(i + 1) % codes.length]) / b.speedKmh * 3600 + config.DWELL_SEC, 0);
  advance(ctx, lap + 60);
  assert.ok(b.laps >= 1, `laps = ${b.laps}`);
});

test('หยุดเวลาชั่วคราวแล้วไม่มีอะไรขยับ', async () => {
  const ctx = await freshApp();
  advance(ctx, 120);
  ctx.sim.setRunning(false);
  const before = JSON.stringify(ctx.sim.snapshot().buses);
  const clock = ctx.sim.clock;
  for (let i = 0; i < 20; i++) ctx.sim.tick(1);
  assert.equal(ctx.sim.clock, clock);
  assert.equal(JSON.stringify(ctx.sim.snapshot().buses), before);
});

test('ปรับอัตราเร็ว: รับเฉพาะค่าใน config', async () => {
  const ctx = await freshApp();
  ctx.sim.setScale(60);
  assert.equal(ctx.sim.scale, 60);
  assert.equal(errCode(() => ctx.sim.setScale(7)), 'BAD_SCALE');
  assert.equal(errCode(() => ctx.sim.setScale('abc')), 'BAD_SCALE');
});

test('แก้ไขเส้นทาง: ขอตอนวิ่ง → หยุดเมื่อถึงสถานี → เพิ่ม/ลบจุด → ตรวจแล้วเดินต่อ', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'CITY-02');
  assert.equal(errCode(() => ctx.fleet.insertStop('CITY-02', 0, 'i')), 'NOT_MODIFYING');
  advance(ctx, config.DWELL_SEC / 2 + 5);
  assert.equal(b.status, STATUS.MOVING);
  ctx.fleet.requestModify('CITY-02');
  assert.equal(b.pendingModify, true);
  advance(ctx, 400);
  assert.equal(b.status, STATUS.MODIFYING);
  assert.equal(b.route.current.code, 'g');
  const clockNow = b.route.current;
  advance(ctx, 300);
  assert.equal(b.route.current, clockNow, 'ระหว่างแก้ไข รถต้องไม่ขยับ');
  ctx.fleet.insertStop('CITY-02', 0, 'i');                 // d → i → g
  assert.deepEqual(b.route.toArray().slice(0, 3), ['d', 'i', 'g']);
  assert.equal(errCode(() => ctx.fleet.deleteStop('CITY-02', 2)), 'DELETE_CURRENT');
  ctx.fleet.deleteStop('CITY-02', 1);
  ctx.fleet.resume('CITY-02');
  assert.equal(b.status, STATUS.AT_STATION);
  advance(ctx, 30);
  assert.equal(b.status, STATUS.MOVING);
});

test('เวลาถึงสถานี: ทุกคันที่ผ่านมีเวลาถึง ป้ายไกลกว่าใช้เวลานานกว่า รถเสียไม่มีเวลาถึง', async () => {
  const ctx = await freshApp();
  advance(ctx, config.DWELL_SEC + 5);                       // ทุกคันออกจากป้ายแรกแล้ว
  const at = code => ctx.sim.arrivalsAt(code).find(a => a.bus === 'NU-01');
  const b = bus(ctx, 'NU-01');                              // a → b → e → d …
  assert.equal(b.route.current.next.code, 'b');
  const toB = at('b'), toE = at('e'), toD = at('d');
  assert.ok(toB.nextHere && Math.abs(toB.etaSec - ctx.sim.eta(b)) < 1e-6);
  assert.ok(toE.etaSec > toB.etaSec + config.DWELL_SEC, 'ต้องรวมเวลาจอดที่ป้ายระหว่างทาง');
  assert.ok(toD.etaSec > toE.etaSec);
  for (const code of ['d', 'g', 'h']) for (const a of ctx.sim.arrivalsAt(code)) assert.ok(a.etaSec >= 0, `${a.bus} → ${code}`);
  ctx.fleet.breakdown('NU-01');
  assert.equal(at('d').etaSec, null);
});

test('ฉากวิดีโอ: AIR-03 แทรก ม.นเรศวร หลัง รพ.พุทธชินราช แล้วตรวจเส้นทางผ่าน', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'AIR-03');
  ctx.fleet.requestModify('AIR-03');
  for (let i = 0; i < 200 && b.status !== STATUS.MODIFYING; i++) advance(ctx, 30);
  assert.equal(b.status, STATUS.MODIFYING);
  const after = b.route.toArray().indexOf('e');
  ctx.fleet.insertStop('AIR-03', after, 'a');               // e → a → c
  assert.deepEqual(b.route.toArray().slice(after, after + 2), ['e', 'a']);
  ctx.fleet.resume('AIR-03');
  assert.equal(b.status, STATUS.AT_STATION);
});

test('รถเสียระหว่างวิ่ง: หยุดนิ่ง แล้วซ่อมเสร็จวิ่งต่อจากจุดเดิม', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'NU-01');
  advance(ctx, config.DWELL_SEC / 2 + 60);
  assert.equal(b.status, STATUS.MOVING);
  ctx.fleet.breakdown('NU-01');
  const p = b.progressKm;
  advance(ctx, 600);
  assert.equal(b.status, STATUS.BROKEN);
  assert.equal(b.progressKm, p);
  assert.equal(ctx.sim.eta(b), null);
  ctx.fleet.repair('NU-01');
  assert.equal(b.status, STATUS.MOVING);
  advance(ctx, 30);
  assert.ok(b.progressKm > p || b.status === STATUS.AT_STATION);
  assert.equal(errCode(() => ctx.fleet.repair('NU-01')), 'NOT_BROKEN');
});

test('ปลดระวางและลบ: ต้องจอดก่อน ต้องปลดก่อนลบ ต้องยืนยันชื่อตรง', async () => {
  const ctx = await freshApp();
  advance(ctx, config.DWELL_SEC / 2 + 5);
  assert.equal(errCode(() => ctx.fleet.retire('NU-01')), 'MUST_BE_AT_STATION');
  ctx.sim.setRunning(false);
  const b = bus(ctx, 'AIR-03');
  b.status = STATUS.AT_STATION;
  assert.equal(errCode(() => ctx.fleet.remove('AIR-03', 'AIR-03')), 'NOT_RETIRED');
  ctx.fleet.retire('AIR-03');
  assert.equal(errCode(() => ctx.fleet.retire('AIR-03')), 'ALREADY_RETIRED');
  assert.ok(!ctx.fleet.active().includes(b));
  assert.equal(errCode(() => ctx.fleet.remove('AIR-03', 'NU-01')), 'CONFIRM_MISMATCH');
  ctx.fleet.remove('AIR-03', 'AIR-03');
  assert.equal(errCode(() => ctx.fleet.get('AIR-03')), 'BUS_NOT_FOUND');
  assert.equal(ctx.fleet.list().length, 2);
});

test('บันทึกข้อมูล: เพิ่มรถแล้วเปิดระบบใหม่ยังอยู่ รีเซ็ตแล้วกลับเป็นค่าตั้งต้น', async () => {
  const ctx = await freshApp();
  ctx.fleet.create({ name: 'BUS-09', plate: '99-9999 พล', capacity: 20, speedKmh: 30, route: ['d', 'g', 'i'] });
  await sleep(500);
  assert.ok(fs.existsSync(RUNTIME_BUSES));
  const again = await createApp(quiet);
  assert.ok(again.fleet.find('BUS-09').node, 'เปิดใหม่ต้องเห็นรถที่เพิ่มไว้');
  again.reset();
  assert.ok(!fs.existsSync(RUNTIME_BUSES));
  assert.equal(again.fleet.list().length, 3);
  assert.equal(again.sim.clock, config.START_CLOCK_SEC);
});

test('บันทึกข้อมูล: ไฟล์ runtime เสียไม่ทำให้ระบบล่ม', async () => {
  fs.mkdirSync(config.RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(RUNTIME_BUSES, '{ไม่ใช่ JSON');
  const ctx = await createApp(quiet);
  assert.equal(ctx.fleet.list().length, 3, 'ไฟล์เสียต้องกลับไปใช้ค่าตั้งต้น');
  fs.writeFileSync(RUNTIME_BUSES, JSON.stringify([{ name: 'BAD', plate: 'x', capacity: 10, speedKmh: 30, route: ['a', 'k'] }]));
  const ctx2 = await createApp(quiet);
  assert.ok(ctx2.log.list(50).some(l => l.text.includes('ข้ามข้อมูลรถ BAD')));
  fs.unlinkSync(RUNTIME_BUSES);
});

// ---------------- อุปกรณ์ ----------------
test('GPS: ตำแหน่งกลางทาง → กำลังวิ่ง ใช้ตำแหน่งจริง', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'CITY-02');
  const d = ctx.graph.station('d'), g = ctx.graph.station('g');
  ctx.devices.ingest({ bus: 'CITY-02', type: 'gps', lat: (d.lat + g.lat) / 2, lng: (d.lng + g.lng) / 2, speedKmh: 25 });
  const v = ctx.sim.view(b);
  assert.equal(v.status, STATUS.MOVING);
  assert.equal(v.positionSource, 'gps');
  assert.equal(v.etaBasis, 'real');
  assert.ok(v.fraction > 0.4 && v.fraction < 0.6, `fraction ${v.fraction}`);
  assert.ok(v.etaSec > 0 && isFinite(v.etaSec));
});

test('GPS: เข้าใกล้สถานีถัดไป → ถึงสถานี เลื่อน current', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'CITY-02');
  const g = ctx.graph.station('g');
  ctx.devices.ingest({ bus: 'CITY-02', type: 'gps', lat: g.lat + 0.0003, lng: g.lng, speedKmh: 10 });
  assert.equal(b.route.current.code, 'g');
  assert.equal(b.status, STATUS.AT_STATION);
  ctx.devices.ingest({ bus: 'CITY-02', type: 'gps', lat: g.lat, lng: g.lng, speedKmh: 0 });
  assert.equal(b.route.current.code, 'g', 'ส่งพิกัดเดิมซ้ำต้องไม่ข้ามสถานี');
});

test('GPS: สัญญาณขาดเกินเวลา → กลับไปใช้การจำลอง', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'CITY-02');
  const d = ctx.graph.station('d'), g = ctx.graph.station('g');
  ctx.devices.ingest({ bus: 'CITY-02', type: 'gps', lat: (d.lat + g.lat) / 2, lng: (d.lng + g.lng) / 2, speedKmh: 25 });
  const realNow = Date.now;
  Date.now = () => realNow() + config.LIVE_TTL_MS + 1000;
  try {
    ctx.sim.tick(0.1);
    const v = ctx.sim.view(b);
    assert.equal(v.positionSource, 'sim');
    assert.ok(v.fraction > 0.4, 'ต่อจากตำแหน่ง GPS ล่าสุด ไม่ย้อนกลับไปต้นทาง');
    assert.ok(ctx.log.list(50).some(l => l.text.includes('สัญญาณ GPS ขาด')));
  } finally { Date.now = realNow; }
});

test('GPS: ถึงสถานีขณะรอแก้เส้นทาง → เข้าสถานะแก้ไขเส้นทาง', async () => {
  const ctx = await freshApp();
  const b = bus(ctx, 'CITY-02');
  advance(ctx, config.DWELL_SEC / 2 + 5);
  ctx.fleet.requestModify('CITY-02');
  const g = ctx.graph.station('g');
  ctx.devices.ingest({ bus: 'CITY-02', type: 'gps', lat: g.lat, lng: g.lng, speedKmh: 5 });
  assert.equal(b.status, STATUS.MODIFYING);
});

test('GPS: รถปลดระวางหรือกำลังแก้เส้นทาง ไม่ถูกตำแหน่ง GPS ย้าย', async () => {
  const ctx = await freshApp();
  ctx.fleet.requestModify('AIR-03');
  const b = bus(ctx, 'AIR-03');
  const f = ctx.graph.station('f');
  ctx.devices.ingest({ bus: 'AIR-03', type: 'gps', lat: f.lat, lng: f.lng, speedKmh: 20 });
  assert.equal(b.status, STATUS.MODIFYING);
  assert.equal(b.route.current.code, 'c');
  ctx.fleet.retire('AIR-03');
  ctx.devices.ingest({ bus: 'AIR-03', type: 'gps', lat: f.lat, lng: f.lng, speedKmh: 20 });
  const v = ctx.sim.view(b);
  assert.equal(v.status, STATUS.RETIRED);
  assert.equal(v.lat, undefined);
});

test('นับผู้โดยสาร และเตือนเกินความจุ', async () => {
  const ctx = await freshApp();
  ctx.devices.ingest({ bus: 'CITY-02', type: 'passenger', count: 12 });
  assert.equal(ctx.sim.view(bus(ctx, 'CITY-02')).device.passengers.count, 12);
  ctx.devices.ingest({ bus: 'CITY-02', type: 'passenger', count: 40 });
  assert.ok(ctx.log.list(50).some(l => l.text.includes('เกินความจุ')));
});

test('เครื่องยนต์ขัดข้อง → รถเสียอัตโนมัติ ซ่อมแล้วเคลียร์รหัส', async () => {
  const ctx = await freshApp();
  ctx.devices.ingest({ bus: 'NU-01', type: 'engine', fault: true, code: 'P0300' });
  assert.equal(bus(ctx, 'NU-01').status, STATUS.BROKEN);
  ctx.fleet.repair('NU-01');
  assert.equal(ctx.sim.view(bus(ctx, 'NU-01')).device.engine.fault, false);
});

test('ข้อมูลอุปกรณ์ผิดรูปแบบถูกปฏิเสธด้วยรหัสที่มีข้อความ', async () => {
  const ctx = await freshApp();
  const cases = [
    [null, 'BAD_JSON'], [{ type: 'gps' }, 'DEVICE_FIELD'],
    [{ bus: 'NU-01', type: 'radar' }, 'BAD_DEVICE_TYPE'],
    [{ bus: 'NU-01', type: 'gps', lat: '16' }, 'DEVICE_FIELD'],
    [{ bus: 'NU-01', type: 'passenger', count: -1 }, 'DEVICE_FIELD'],
    [{ bus: 'XX', type: 'passenger', count: 1 }, 'BUS_NOT_FOUND'],
  ];
  for (const [p, code] of cases) {
    assert.equal(errCode(() => ctx.devices.ingest(p)), code, JSON.stringify(p));
    assert.ok(ERRORS[code]);
  }
  assert.deepEqual(ctx.devices.ingest([{ bus: 'NU-01', type: 'passenger', count: 1 }]).map(r => r.ok), [true]);
});

test('คีย์อุปกรณ์: ตั้งไว้แล้วต้องตรงเท่านั้น', async () => {
  const ctx = await freshApp();
  config.DEVICE_API_KEY = 'secret';
  try {
    assert.equal(errCode(() => ctx.devices.checkKey('nope')), 'DEVICE_KEY');
    assert.equal(errCode(() => ctx.devices.checkKey(undefined)), 'DEVICE_KEY');
    ctx.devices.checkKey('secret');
  } finally { config.DEVICE_API_KEY = ''; }
  ctx.devices.checkKey(undefined);
});

// ---------------- สัญญาข้อมูลที่ส่งให้ชั้นถัดไป ----------------
test('ข้อมูลที่ส่งให้หน้าจอครบทุกช่อง และแปลงเป็น JSON ได้', async () => {
  const ctx = await freshApp();
  advance(ctx, 200);
  const snap = JSON.parse(JSON.stringify(ctx.sim.snapshot()));
  assert.deepEqual(Object.keys(snap.sim).sort(), ['clock', 'running', 'scale', 'scales']);
  for (const v of snap.buses) for (const f of VIEW_FIELDS) assert.ok(f in v, `ขาด ${f} ใน ${v.name}`);
  for (const l of snap.log) assert.ok('clock' in l && 'text' in l);
});

test('ทดสอบหนัก: 4 ชั่วโมงจำลอง ทุกค่าต้องเป็นตัวเลขที่ถูกต้อง', async () => {
  const ctx = await freshApp();
  ctx.sim.setScale(60);
  for (let i = 0; i < 4 * 3600 / 5; i++) {
    ctx.sim.running = true;
    ctx.sim.tick(5 / 60);
    if (i % 97 === 0) for (const b of ctx.fleet.active()) if (b.status === STATUS.MOVING) { ctx.fleet.breakdown(b.name); ctx.fleet.repair(b.name); }
    if (i % 200 === 0) {
      for (const b of ctx.fleet.active()) {
        const v = ctx.sim.view(b);
        assert.ok(Number.isFinite(v.lat) && Number.isFinite(v.lng), b.name);
        assert.ok(v.fraction >= 0 && v.fraction <= 1);
        assert.ok(v.etaSec === null || (Number.isFinite(v.etaSec) && v.etaSec >= 0));
      }
    }
  }
  assert.ok(ctx.fleet.list().every(b => b.laps >= 1));
});

test('บันทึกไฟล์ไม่สำเร็จ ระบบต้องไม่ล่ม', async () => {
  const storage = require('../backend/services/storage');
  const fsMod = require('fs');
  const real = fsMod.writeFileSync;
  const errors = [];
  const realErr = console.error;
  console.error = m => errors.push(m);
  fsMod.writeFileSync = () => { throw new Error('ENOSPC'); };
  try {
    storage.saveBuses([]);
    storage.saveRoadCache({});
    await sleep(450);
  } finally { fsMod.writeFileSync = real; console.error = realErr; }
  assert.equal(errors.length, 2);
});

test('โครงสร้างข้อมูล: บันทึกเฉพาะการทำงานที่ผู้ใช้สั่ง พร้อมเส้นทางเปรียบเทียบใน BST', async () => {
  const ctx = await freshApp();
  let s = ctx.fleet.structures();
  assert.equal(s.treeOp.op, 'create');
  assert.equal(s.tree.name, s.treeOp.key, 'create ชี้ root');
  assert.equal(s.count, 3);
  assert.equal(s.routeOps['NU-01'].op, 'create');

  ctx.fleet.search('CITY-02');
  s = ctx.fleet.structures();
  assert.equal(s.treeOp.op, 'search');
  assert.equal(s.treeOp.found, true);
  assert.equal(s.treeOp.path.at(-1), 'CITY-02');
  const seq = s.treeOp.seq;
  ctx.fleet.get('NU-01');                                   // การค้นหาภายในไม่ทับ
  assert.equal(ctx.fleet.structures().treeOp.seq, seq);
  assert.equal(ctx.fleet.search('ไม่มีคันนี้').node, null);
  assert.equal(ctx.fleet.structures().treeOp.found, false);

  ctx.fleet.create({ name: 'ZZ-09', plate: '1-1 พล', capacity: 20, speedKmh: 30, route: ['d', 'g', 'i'] });
  s = ctx.fleet.structures();
  assert.equal(s.treeOp.op, 'insert');
  assert.equal(s.treeOp.path.at(-1), 'ZZ-09');
  assert.equal(s.routeOps['ZZ-09'].op, 'create');

  ctx.fleet.searchStop('CITY-02', 'h');
  assert.deepEqual(ctx.fleet.structures().routeOps['CITY-02'], { op: 'search', station: 'h', positions: [3, 6], seq: ctx.fleet.ops.seq });

  ctx.fleet.retire('ZZ-09');
  ctx.fleet.remove('ZZ-09', 'ZZ-09');
  s = ctx.fleet.structures();
  assert.equal(s.treeOp.op, 'delete');
  assert.equal(s.treeOp.key, 'ZZ-09');
  assert.equal(s.treeOp.successor, null);
  assert.equal(s.treeOp.child, null, 'ZZ-09 เป็นใบ');
  assert.equal(s.routeOps['ZZ-09'], undefined);
});
