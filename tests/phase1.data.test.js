// เฟส 1 — ข้อมูล (JSON) + ความเข้ากันได้กับเฟส 0 (ขอบเขตใน config)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { BACKEND, readJson } = require('./helpers');
const config = require('../backend/config');

const DATA = path.join(BACKEND, 'data');
const stations = readJson(path.join(DATA, 'stations.json'));
const roads = readJson(path.join(DATA, 'roads.json'));
const seed = readJson(path.join(DATA, 'seed-buses.json'));
const codes = new Set(stations.map(s => s.code));
const key = (u, v) => [u, v].sort().join('|');
const roadSet = new Set(roads.map(([u, v]) => key(u, v)));

test('สถานี: รหัสไม่ซ้ำ มีชื่อ พิกัดอยู่ในจังหวัดพิษณุโลก', () => {
  assert.equal(codes.size, stations.length, 'รหัสซ้ำ');
  for (const s of stations) {
    assert.ok(typeof s.code === 'string' && s.code.length > 0);
    assert.ok(typeof s.name === 'string' && s.name.trim().length > 0, s.code);
    assert.ok(s.lat > 16.3 && s.lat < 17.6, `${s.code} lat`);
    assert.ok(s.lng > 99.9 && s.lng < 101.1, `${s.code} lng`);
  }
});

test('สถานี: ไม่มีสองสถานีพิกัดซ้ำกัน (ระยะถนนจะเป็น 0)', () => {
  const seen = new Set(stations.map(s => `${s.lat},${s.lng}`));
  assert.equal(seen.size, stations.length);
});

test('ถนน: ทุกเส้นชี้สถานีที่มีจริง ไม่วนเข้าตัวเอง ไม่ซ้ำ', () => {
  for (const r of roads) {
    assert.ok(Array.isArray(r) && r.length === 2);
    assert.ok(codes.has(r[0]) && codes.has(r[1]), r.join('-'));
    assert.notEqual(r[0], r[1]);
  }
  assert.equal(roadSet.size, roads.length, 'มีถนนซ้ำ');
});

test('ถนน: ทุกสถานีเชื่อมถึงกันหมด (ไม่มีสถานีโดดเดี่ยว)', () => {
  const adj = new Map([...codes].map(c => [c, []]));
  roads.forEach(([u, v]) => { adj.get(u).push(v); adj.get(v).push(u); });
  const seen = new Set([stations[0].code]);
  const q = [stations[0].code];
  while (q.length) for (const n of adj.get(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.deepEqual([...codes].filter(c => !seen.has(c)), []);
});

test('รถตั้งต้น: ข้อมูลอยู่ในขอบเขตของเฟส 0', () => {
  const L = config.LIMITS;
  const names = seed.map(b => b.name.toLowerCase());
  assert.equal(new Set(names).size, seed.length, 'ชื่อรถซ้ำ');
  for (const b of seed) {
    assert.ok(b.name.length <= L.nameMax && b.plate.length <= L.plateMax, b.name);
    assert.ok(b.capacity >= L.capacity[0] && b.capacity <= L.capacity[1], b.name);
    assert.ok(b.speedKmh >= L.speedKmh[0] && b.speedKmh <= L.speedKmh[1], b.name);
  }
});

test('รถตั้งต้น: ทุกช่วงของเส้นทางมีถนนจริง รวมช่วงวนกลับ', () => {
  for (const b of seed) {
    assert.ok(b.route.length >= 2, b.name);
    b.route.forEach((u, i) => {
      const v = b.route[(i + 1) % b.route.length];
      assert.ok(roadSet.has(key(u, v)), `${b.name}: ${u} → ${v}`);
    });
  }
});

test('ตัวอย่างในแผนงาน d → g → h → j → i → h → g → d ใช้ได้กับข้อมูลถนน', () => {
  const r = ['d', 'g', 'h', 'j', 'i', 'h', 'g'];
  r.forEach((u, i) => assert.ok(roadSet.has(key(u, r[(i + 1) % r.length]))));
});
