// เฟส 5 — HTTP API + ความเข้ากันได้กับเฟส 4 (ผลที่ได้ต้องตรงกับ service)
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.USE_OSRM = process.env.USE_OSRM ?? '0';
process.env.BUS_RUNTIME_DIR = process.env.BUS_RUNTIME_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'bus-p5-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { api, rawRequest } = require('./helpers');
const { ERRORS } = require('../backend/config/messages');
const { start } = require('../backend/server');

let app, port;
const quiet = { log() {}, warn() {} };
test.before(async () => { app = await start({ port: 0, logger: quiet }); port = app.port; });
test.after(async () => { await app.close(); });

const expectError = (r, status, code) => {
  assert.equal(r.status, status, JSON.stringify(r.data));
  assert.equal(r.data.code, code);
  assert.ok(ERRORS[code], `รหัส ${code} ต้องมีข้อความ`);
  assert.equal(typeof r.data.error, 'string');
};

test('แผนที่: network / stations / roads', async () => {
  const n = await api(port, 'GET', '/api/network');
  assert.equal(n.status, 200);
  for (const k of ['source', 'stations', 'roads', 'deviceKeyRequired', 'liveTtlMs']) assert.ok(k in n.data, k);
  const s = await api(port, 'GET', '/api/stations');
  assert.equal(s.data.length, 12);
  assert.ok(s.data.every(x => Array.isArray(x.neighbors) && x.neighbors.length > 0));
  const r = await api(port, 'GET', '/api/roads');
  assert.equal(r.data.length, n.data.roads);
});

test('รถที่ผ่านสถานี + สถานีไม่มีจริง', async () => {
  const r = await api(port, 'GET', '/api/stations/g/arrivals');
  assert.equal(r.status, 200);
  assert.ok(r.data.arrivals.length >= 3);
  expectError(await api(port, 'GET', '/api/stations/zz/arrivals'), 404, 'STATION_NOT_FOUND');
});

test('ตรวจเส้นทาง', async () => {
  const ok = await api(port, 'POST', '/api/routes/validate', { route: ['d', 'g', 'i'] });
  assert.deepEqual(ok.data, { ok: true, issues: [] });
  const bad = await api(port, 'POST', '/api/routes/validate', { route: ['d', 'g', 'k'] });
  assert.equal(bad.data.ok, false);
  assert.ok(bad.data.issues.every(i => typeof i.message === 'string' && Number.isInteger(i.segment)));
  const empty = await api(port, 'POST', '/api/routes/validate', {});
  assert.equal(empty.data.issues[0].code, 'ROUTE_TOO_SHORT');
});

test('รถ: รายการ / ค้นหา / รายละเอียด', async () => {
  const list = await api(port, 'GET', '/api/buses');
  assert.deepEqual(list.data.map(b => b.name), ['AIR-03', 'CITY-02', 'NU-01']);
  const found = await api(port, 'GET', '/api/buses/search?name=city-02');
  assert.equal(found.data.found, true, 'ค้นหาไม่สนตัวพิมพ์เล็ก/ใหญ่');
  const miss = await api(port, 'GET', '/api/buses/search?name=XX');
  assert.equal(miss.data.found, false);
  assert.equal((await api(port, 'GET', '/api/buses/NU-01')).data.name, 'NU-01');
  expectError(await api(port, 'GET', '/api/buses/NOPE'), 404, 'BUS_NOT_FOUND');
});

test('รถ: ลงทะเบียน / ข้อมูลผิด / ชื่อซ้ำ', async () => {
  const body = { name: 'BUS-04', plate: '12-3456 พล', capacity: 30, speedKmh: 30, route: ['d', 'g', 'i'] };
  const r = await api(port, 'POST', '/api/buses', body);
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'AT_STATION');
  assert.ok(app.ctx.fleet.find('BUS-04').node, 'ต้องเข้า service ชั้นเฟส 4 จริง');
  expectError(await api(port, 'POST', '/api/buses', body), 409, 'BUS_EXISTS');
  expectError(await api(port, 'POST', '/api/buses', { ...body, name: 'B5', capacity: -1 }), 400, 'INVALID_FIELD');
  expectError(await api(port, 'POST', '/api/buses', { ...body, name: 'B5', route: ['a', 'k'] }), 400, 'NO_EDGE');
});

test('รถ: แก้เส้นทางผ่าน HTTP ครบวงจร', async () => {
  const n = encodeURIComponent('BUS-04');
  expectError(await api(port, 'POST', `/api/buses/${n}/stops`, { after: 0, station: 'h' }), 400, 'NOT_MODIFYING');
  const m = await api(port, 'POST', `/api/buses/${n}/modify`, {});
  assert.ok(['MODIFYING', 'AT_STATION', 'MOVING'].includes(m.data.status));
  app.ctx.fleet.get('BUS-04').status = 'MODIFYING';
  const ins = await api(port, 'POST', `/api/buses/${n}/stops`, { after: 1, station: 'h' });
  assert.equal(ins.status, 200, JSON.stringify(ins.data));
  assert.deepEqual(ins.data.route, ['d', 'g', 'h', 'i']);
  const s = await api(port, 'GET', `/api/buses/${n}/stops/search?station=h`);
  assert.deepEqual(s.data.positions, [3]);
  expectError(await api(port, 'DELETE', `/api/buses/${n}/stops/0`), 400, 'DELETE_CURRENT');
  const del = await api(port, 'DELETE', `/api/buses/${n}/stops/2`);
  assert.deepEqual(del.data.route, ['d', 'g', 'i']);
  const res = await api(port, 'POST', `/api/buses/${n}/resume`, {});
  assert.equal(res.data.status, 'AT_STATION');
});

test('รถ: รถเสีย / ซ่อม / ปลดระวาง / ลบ', async () => {
  assert.equal((await api(port, 'POST', '/api/buses/BUS-04/breakdown', {})).data.status, 'BROKEN');
  assert.equal((await api(port, 'POST', '/api/buses/BUS-04/repair', {})).data.status, 'AT_STATION');
  expectError(await api(port, 'DELETE', '/api/buses/BUS-04', { confirm: 'BUS-04' }), 400, 'NOT_RETIRED');
  assert.equal((await api(port, 'POST', '/api/buses/BUS-04/retire', {})).data.status, 'RETIRED');
  expectError(await api(port, 'DELETE', '/api/buses/BUS-04', { confirm: 'x' }), 400, 'CONFIRM_MISMATCH');
  expectError(await api(port, 'DELETE', '/api/buses/BUS-04'), 400, 'CONFIRM_MISMATCH');
  assert.equal((await api(port, 'DELETE', '/api/buses/BUS-04', { confirm: 'BUS-04' })).status, 200);
  expectError(await api(port, 'GET', '/api/buses/BUS-04'), 404, 'BUS_NOT_FOUND');
});

test('เวลาจำลอง: เริ่ม / ความเร็ว / ค่าผิด / รีเซ็ต', async () => {
  const r = await api(port, 'POST', '/api/sim', { running: true, scale: 60 });
  assert.deepEqual([r.data.running, r.data.scale], [true, 60]);
  expectError(await api(port, 'POST', '/api/sim', { scale: 3 }), 400, 'BAD_SCALE');
  const reset = await api(port, 'POST', '/api/sim/reset', {});
  assert.equal(reset.data.running, false);
  assert.equal((await api(port, 'GET', '/api/buses')).data.length, 3);
});

test('สตรีมเรียลไทม์: ได้ข้อมูลทันทีที่เชื่อมต่อ และได้รอบถัดไป', async () => {
  const events = await new Promise((resolve, reject) => {
    const got = [];
    const req = http.get({ host: '127.0.0.1', port, path: '/api/stream' }, res => {
      assert.match(res.headers['content-type'], /text\/event-stream/);
      let buf = '';
      res.on('data', c => {
        buf += c;
        for (const m of buf.matchAll(/^data: (.+)$/gm)) got.push(JSON.parse(m[1]));
        buf = buf.slice(buf.lastIndexOf('\n'));
        if (got.length >= 2) { req.destroy(); resolve(got); }
      });
    });
    req.on('error', e => { if (got.length < 2) reject(e); });
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
  assert.ok(events[0].sim && Array.isArray(events[0].buses) && Array.isArray(events[0].log));
});

test('อุปกรณ์: รับข้อมูลเป็นชุด และสถานะ', async () => {
  const r = await api(port, 'POST', '/api/devices/ingest', [
    { bus: 'NU-01', type: 'passenger', count: 10 },
    { bus: 'NU-01', type: 'engine', fault: false },
  ]);
  assert.equal(r.data.results.length, 2);
  expectError(await api(port, 'POST', '/api/devices/ingest', { bus: 'NU-01', type: 'x' }), 400, 'BAD_DEVICE_TYPE');
  const st = await api(port, 'GET', '/api/devices/status');
  assert.equal(st.data.find(x => x.bus === 'NU-01').passengers.count, 10);
});

test('ข้อมูลผิดรูปแบบ: JSON เสีย / ใหญ่เกิน → ตอบ error และเซิร์ฟเวอร์ยังทำงาน', async () => {
  const bad = await rawRequest(port, { method: 'POST', path: '/api/buses', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
  assert.equal(JSON.parse(bad.text).code, 'BAD_JSON');
  const big = await rawRequest(port, { method: 'POST', path: '/api/devices/ingest', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(200 * 1024) })
    .catch(e => ({ status: 'socket:' + e.code }));
  assert.equal(big.status, 413, 'ต้องตอบ 413 ไม่ใช่ตัดการเชื่อมต่อ');
  assert.equal((await api(port, 'GET', '/api/network')).status, 200);
});

test('URL แปลก (%) ไม่ทำให้เซิร์ฟเวอร์ล่ม', async () => {
  const a = await rawRequest(port, { path: '/api/buses/%E0%A4%A' });
  assert.ok(a.status >= 400 && a.status < 500, `ได้ ${a.status}`);
  const b = await rawRequest(port, { path: '/%E0%A4%A' });
  assert.ok(b.status >= 400 && b.status < 500, `ได้ ${b.status}`);
  assert.equal((await api(port, 'GET', '/api/network')).status, 200, 'เซิร์ฟเวอร์ต้องยังอยู่');
});

test('ไฟล์หน้าเว็บ: เปิดได้ และอ่านไฟล์นอกโฟลเดอร์ frontend ไม่ได้', async () => {
  const home = await rawRequest(port, { path: '/' });
  assert.equal(home.status, 200);
  assert.match(home.headers['content-type'], /text\/html/);
  const js = await rawRequest(port, { path: '/js/main.js' });
  assert.match(js.headers['content-type'], /javascript/);
  for (const p of ['/..%2Fbackend%2Fconfig%2Findex.js', '/%2e%2e/backend/config/index.js', '/..%2F..%2Fetc%2Fpasswd', '/..%2Ffrontend-x/a']) {
    const r = await rawRequest(port, { path: p });
    assert.ok([403, 404].includes(r.status), `${p} → ${r.status}`);
    assert.ok(!r.text.includes('DEVICE_API_KEY'), 'ห้ามรั่วซอร์ส backend');
  }
  assert.equal((await rawRequest(port, { path: '/nope.html' })).status, 404);
});

test('ปลายทางที่ไม่มี / OPTIONS (CORS)', async () => {
  expectError(await api(port, 'GET', '/api/nothing'), 404, 'NOT_FOUND');
  const o = await rawRequest(port, { method: 'OPTIONS', path: '/api/devices/ingest' });
  assert.equal(o.status, 204);
  assert.match(o.headers['access-control-allow-headers'], /X-Device-Key/);
});

test('โครงสร้างข้อมูล: /api/structures และการค้นหาผ่าน API ถูกบันทึก', async () => {
  await api(port, 'GET', '/api/buses/search?name=NU-01');
  const r = await api(port, 'GET', '/api/structures');
  assert.equal(r.status, 200);
  assert.ok(r.data.tree && r.data.tree.name && 'left' in r.data.tree && 'status' in r.data.tree);
  assert.equal(r.data.treeOp.op, 'search');
  assert.equal(r.data.treeOp.key, 'NU-01');
  assert.ok(Array.isArray(r.data.treeOp.path));
  assert.equal(typeof r.data.routeOps, 'object');
});
