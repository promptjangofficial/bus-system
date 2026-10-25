// เฟส 3 — OSRM (จำลองการตอบกลับ ไม่ต้องใช้อินเทอร์เน็ต) + ความเข้ากันได้กับเฟส 2
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../backend/config');
const osrm = require('../backend/integrations/osrm');
const { Graph } = require('../backend/core/graph');
const { pointAt } = require('../backend/core/geo');

const A = { code: 'd', lat: 16.8153, lng: 100.2635 };
const B = { code: 'g', lat: 16.8212, lng: 100.2638 };
const realFetch = global.fetch;
test.afterEach(() => { global.fetch = realFetch; });

const reply = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });

test('ส่งพิกัดเป็น lng,lat ตามรูปแบบ OSRM', async () => {
  let url;
  global.fetch = async u => { url = u; return reply({ code: 'Ok', routes: [{ distance: 800, geometry: { coordinates: [[100.2635, 16.8153], [100.2638, 16.8212]] } }] })(); };
  await osrm.fetchRoad(A, B);
  assert.ok(url.startsWith(config.OSRM_URL));
  assert.ok(url.includes('100.2635,16.8153;100.2638,16.8212'), url);
  assert.ok(url.includes('geometries=geojson'));
});

test('แปลงผลเป็น กม. และสลับพิกัดเป็น [lat, lng]', async () => {
  global.fetch = reply({ code: 'Ok', routes: [{ distance: 1234, geometry: { coordinates: [[100.2635, 16.8153], [100.2636, 16.818], [100.2638, 16.8212]] } }] });
  const r = await osrm.fetchRoad(A, B);
  assert.equal(r.km, 1.2);
  assert.equal(r.source, 'osrm');
  assert.deepEqual(r.geometry[0], [16.8153, 100.2635]);
  assert.equal(r.geometry.length, 3);
});

test('HTTP ผิดพลาด / ไม่พบเส้นทาง / ข้อมูลว่าง ต้อง throw', async () => {
  global.fetch = reply({}, 500);
  await assert.rejects(osrm.fetchRoad(A, B), /HTTP 500/);
  global.fetch = reply({ code: 'NoRoute', routes: [] });
  await assert.rejects(osrm.fetchRoad(A, B), /NoRoute/);
  global.fetch = reply({ code: 'Ok', routes: [] });
  await assert.rejects(osrm.fetchRoad(A, B));
});

test('ระยะทาง 0 (จุดเดียวกัน) ต้องไม่ได้ km = 0', async () => {
  global.fetch = reply({ code: 'Ok', routes: [{ distance: 0, geometry: { coordinates: [[100.2635, 16.8153], [100.2635, 16.8153]] } }] });
  const r = await osrm.fetchRoad(A, B);
  assert.ok(r.km > 0, 'km = 0 จะทำให้การจำลองหารด้วยศูนย์');
});

test('หมดเวลา (timeout) ต้องยกเลิกคำขอ', async () => {
  const saved = config.OSRM_TIMEOUT_MS;
  config.OSRM_TIMEOUT_MS = 50;
  global.fetch = (u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
  try { await assert.rejects(osrm.fetchRoad(A, B), /abort/); }
  finally { config.OSRM_TIMEOUT_MS = saved; }
});

test('เข้ากับเฟส 2: ผลจาก OSRM ใส่ Graph และหาจุดบนเส้นได้', async () => {
  global.fetch = reply({ code: 'Ok', routes: [{ distance: 700, geometry: { coordinates: [[100.2635, 16.8153], [100.2640, 16.818], [100.2638, 16.8212]] } }] });
  const road = await osrm.fetchRoad(A, B);
  const g = new Graph();
  g.addStation(A); g.addStation(B);
  g.addRoad('d', 'g', road);
  const back = g.edge('g', 'd').geometry;
  assert.deepEqual(back[0], [16.8212, 100.2638]);
  const mid = pointAt(g.edge('d', 'g').geometry, 0.5);
  assert.ok(mid.lat > A.lat && mid.lat < B.lat);
});
