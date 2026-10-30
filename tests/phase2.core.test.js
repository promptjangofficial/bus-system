// เฟส 2 — โครงสร้างข้อมูล + ความเข้ากันได้กับเฟส 0 (รหัสข้อความ) และเฟส 1 (ข้อมูลจริง)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { BACKEND, readJson } = require('./helpers');
const { ERRORS } = require('../backend/config/messages');
const { BusTree } = require('../backend/core/bus-tree');
const { CircularRoute } = require('../backend/core/circular-route');
const { Graph } = require('../backend/core/graph');
const geo = require('../backend/core/geo');

const DATA = path.join(BACKEND, 'data');
const failCodes = new Set();
const track = r => { if (r && r.ok === false) failCodes.add(r.code); return r; };

function realGraph() {
  const g = new Graph();
  const st = readJson(path.join(DATA, 'stations.json'));
  st.forEach(s => g.addStation(s));
  for (const [u, v] of readJson(path.join(DATA, 'roads.json'))) {
    const a = g.station(u), b = g.station(v);
    g.addRoad(u, v, { km: geo.haversineKm(a, b), geometry: [[a.lat, a.lng], [b.lat, b.lng]], source: 'estimate' });
  }
  return g;
}
const bus = name => ({ name });

// ---------------- Binary Search Tree ----------------
test('BST: create ทำให้รถคันแรกเป็น root', () => {
  const t = BusTree.create(bus('M'));
  assert.equal(t.root.bus.name, 'M');
  assert.equal(t.count, 1);
});

test('BST: insert จัดตำแหน่งตามชื่อ และ inorder เรียงถูก', () => {
  const t = BusTree.create(bus('M'));
  for (const n of ['D', 'T', 'A', 'F', 'Q', 'Z']) assert.ok(track(t.insert(bus(n))).ok);
  assert.equal(t.root.left.bus.name, 'D');
  assert.equal(t.root.right.bus.name, 'T');
  assert.deepEqual(t.inorder().map(b => b.name), ['A', 'D', 'F', 'M', 'Q', 'T', 'Z']);
  assert.equal(t.count, 7);
});

test('BST: insert ชื่อซ้ำถูกปฏิเสธ', () => {
  const t = BusTree.create(bus('NU-01'));
  assert.equal(track(t.insert(bus('NU-01'))).code, 'BUS_EXISTS');
  assert.equal(t.count, 1);
});

test('BST: ชื่อต่างกันแค่ตัวพิมพ์เล็ก/ใหญ่ ถือเป็นคันเดียวกัน', () => {
  const t = BusTree.create(bus('NU-01'));
  assert.equal(t.insert(bus('nu-01')).ok, false, 'ไม่ควรมี NU-01 และ nu-01 พร้อมกัน');
  assert.ok(t.search('nu-01').node, 'ค้นหาตัวพิมพ์เล็กควรเจอ');
});

test('BST: search คืนเส้นทางที่เทียบผ่าน', () => {
  const t = BusTree.create(bus('M'));
  ['D', 'T', 'F'].forEach(n => t.insert(bus(n)));
  assert.deepEqual(t.search('F').path, ['M', 'D', 'F']);
  const miss = t.search('E');
  assert.equal(miss.node, null);
  assert.deepEqual(miss.path, ['M', 'D', 'F']);
});

test('BST: delete ใบ / ลูกเดียว / สองลูก / root และยังเรียงถูก', () => {
  const t = BusTree.create(bus('M'));
  ['D', 'T', 'A', 'F', 'Q', 'Z', 'E'].forEach(n => t.insert(bus(n)));
  assert.equal(t.delete('A').name, 'A');        // ใบ
  assert.equal(t.delete('F').name, 'F');        // ลูกเดียว (E)
  assert.equal(t.delete('T').name, 'T');        // สองลูก
  assert.equal(t.delete('M').name, 'M');        // root
  assert.equal(t.delete('ไม่มี'), null);
  assert.deepEqual(t.inorder().map(b => b.name), ['D', 'E', 'Q', 'Z']);
  assert.equal(t.count, 4);
  ['D', 'E', 'Q', 'Z'].forEach(n => t.delete(n));
  assert.ok(t.isEmpty());
  assert.equal(t.count, 0);
});

// ---------------- Graph + geo ----------------
test('Graph: geometry กลับทิศให้อัตโนมัติ', () => {
  const g = new Graph();
  g.addStation({ code: 'a', lat: 0, lng: 0 });
  g.addStation({ code: 'b', lat: 1, lng: 1 });
  g.addRoad('a', 'b', { km: 2, geometry: [[0, 0], [0.5, 0.5], [1, 1]], source: 'x' });
  assert.deepEqual(g.edge('a', 'b').geometry[0], [0, 0]);
  assert.deepEqual(g.edge('b', 'a').geometry[0], [1, 1]);
  assert.equal(g.dist('b', 'a'), 2);
  assert.equal(g.roads().length, 1);
  assert.equal(g.hasEdge('a', 'zz'), false);
});

test('geo: ระยะทาง จุดบนเส้น และการฉายจุด', () => {
  const km = geo.haversineKm({ lat: 16.8153, lng: 100.2635 }, { lat: 16.7468, lng: 100.1938 });
  assert.ok(km > 10 && km < 11.5, `สถานีรถไฟ–ม.นเรศวร ≈ 10.6 กม. ได้ ${km}`);
  const line = [[16.80, 100.20], [16.80, 100.30]];
  assert.deepEqual(geo.pointAt(line, 0), { lat: 16.80, lng: 100.20 });
  assert.ok(Math.abs(geo.pointAt(line, 0.5).lng - 100.25) < 1e-9);
  assert.ok(Math.abs(geo.pointAt(line, 2).lng - 100.30) < 1e-9, 'ค่าเกิน 1 ต้องตัดที่ปลายเส้น');
  const pr = geo.projectOnPolyline(line, { lat: 16.801, lng: 100.275 });
  assert.ok(Math.abs(pr.frac - 0.75) < 0.01);
  assert.ok(pr.offM > 90 && pr.offM < 130);
});

// ---------------- Circular Linked List ----------------
test('Circular List: create แล้วโหนดสุดท้ายชี้กลับ head และ current = head', () => {
  const g = realGraph();
  const { ok, route } = CircularRoute.create(g, ['d', 'g', 'h', 'j', 'i', 'h', 'g']);
  assert.ok(ok);
  assert.equal(route.size, 7);
  assert.equal(route.current, route.head);
  assert.equal(route.nodeAt(6).next, route.head);
  assert.deepEqual(route.toArray(), ['d', 'g', 'h', 'j', 'i', 'h', 'g']);
});

test('Circular List: create ปฏิเสธเส้นทางผิดทุกแบบ', () => {
  const g = realGraph();
  assert.equal(track(CircularRoute.create(g, ['d'])).code, 'ROUTE_TOO_SHORT');
  assert.equal(track(CircularRoute.create(g, 'dg')).code, 'ROUTE_TOO_SHORT');
  assert.equal(track(CircularRoute.create(g, ['d', 'zz'])).code, 'STATION_NOT_FOUND');
  assert.equal(track(CircularRoute.create(g, ['d', 'd', 'g'])).code, 'DUPLICATE_ADJACENT');
  const closing = track(CircularRoute.create(g, ['d', 'g', 'l']));
  assert.equal(closing.code, 'NO_EDGE');
  assert.equal(closing.closing, true, 'l → d เป็นช่วงวนกลับ');
  const issues = CircularRoute.issues(g, ['d', 'g', 'k']);
  assert.deepEqual(issues.map(i => i.segment), [1, 2]);
});

test('Circular List: search คืนทุกลำดับที่ผ่าน', () => {
  const { route } = CircularRoute.create(realGraph(), ['d', 'g', 'h', 'j', 'i', 'h', 'g']);
  assert.deepEqual(route.search('h'), [3, 6]);
  assert.deepEqual(route.search('a'), []);
});

test('Circular List: insert ตรวจทางเชื่อมทั้งสองฝั่ง', () => {
  const g = realGraph();
  const { route } = CircularRoute.create(g, ['d', 'g', 'i']);
  assert.ok(route);
  assert.ok(track(route.insertAfter(1, 'h')).ok, 'g → h → i');
  assert.deepEqual(route.toArray(), ['d', 'g', 'h', 'i']);
  assert.equal(track(route.insertAfter(0, 'k')).code, 'NO_EDGE');
  assert.equal(track(route.insertAfter(0, 'g')).code, 'DUPLICATE_ADJACENT');
  assert.equal(track(route.insertAfter(9, 'i')).code, 'INDEX_OUT_OF_RANGE');
  assert.equal(track(route.insertAfter(NaN, 'i')).code, 'INDEX_OUT_OF_RANGE');
  assert.equal(track(route.insertAfter(0, 'zz')).code, 'STATION_NOT_FOUND');
  assert.equal(route.nodeAt(route.size - 1).next, route.head);
});

test('Circular List: delete ห้ามลบจุดที่รถอยู่ ห้ามเหลือน้อยกว่า 2 และคงวงกลม', () => {
  const g = realGraph();
  const { route } = CircularRoute.create(g, ['d', 'g', 'h', 'i']);
  assert.equal(track(route.deleteAt(0)).code, 'DELETE_CURRENT');
  route.advance();                                           // current = g
  const r = track(route.deleteAt(0));                        // ลบ head (d): i → g ต้องมีถนน
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(route.head.code, 'g');
  assert.deepEqual(route.toArray(), ['g', 'h', 'i']);
  assert.equal(route.nodeAt(2).next, route.head);
  assert.equal(track(route.deleteAt(5)).code, 'INDEX_OUT_OF_RANGE');
  const { route: two } = CircularRoute.create(g, ['d', 'g']);
  assert.equal(track(two.deleteAt(1)).code, 'MIN_STOPS');
  const { route: r3 } = CircularRoute.create(g, ['a', 'b', 'e', 'b']);
  assert.equal(track(r3.deleteAt(2)).code, 'DUPLICATE_ADJACENT', 'ลบ e แล้ว b ติดกัน');
});

test('Circular List: advance วนกลับ head หลังสถานีสุดท้าย', () => {
  const { route } = CircularRoute.create(realGraph(), ['d', 'g', 'h', 'i']);
  for (let i = 0; i < 4; i++) route.advance();
  assert.equal(route.current, route.head);
});

// ---------------- ความเข้ากันได้ ----------------
test('เข้ากับเฟส 0: ทุกรหัสที่ core คืน มีข้อความรองรับ', () => {
  assert.ok(failCodes.size >= 7);
  assert.deepEqual([...failCodes].filter(c => !ERRORS[c]), []);
});

test('เข้ากับเฟส 1: รถตั้งต้นทุกคันสร้างเป็น Tree + Circular List ได้', () => {
  const g = realGraph();
  const t = new BusTree();
  for (const b of readJson(path.join(DATA, 'seed-buses.json'))) {
    const r = CircularRoute.create(g, b.route);
    assert.ok(r.ok, `${b.name}: ${r.code}`);
    assert.ok(t.insert({ ...b, route: r.route }).ok);
  }
  assert.equal(t.count, 3);
});

test('BST: shape ให้โครงต้นไม้สำหรับวาด และ successorName บอกตัวแทนเมื่อลบโหนดที่มีลูกสองข้าง', () => {
  const t = BusTree.create(bus('M'));
  ['D', 'T', 'B', 'F', 'R', 'W'].forEach(n => t.insert(bus(n)));
  const s = t.shape(b => ({ name: b.name }));
  assert.equal(s.name, 'M');
  assert.deepEqual([s.left.name, s.right.name], ['D', 'T']);
  assert.deepEqual([s.left.left.name, s.left.right.name, s.right.left.name], ['B', 'F', 'R']);
  assert.equal(s.left.left.left, null);
  assert.equal(t.successorName('M'), 'R');   // ค่าน้อยสุดของต้นไม้ขวา
  assert.equal(t.successorName('B'), null);  // ใบ ไม่ต้องหาตัวแทน
  assert.equal(t.successorName('ZZ'), null);
  assert.equal(t.onlyChildName('M'), null);  // ลูกสองข้าง ใช้ successor
  t.delete('B');
  assert.equal(t.onlyChildName('D'), 'F');   // เหลือลูกขวาคนเดียว
  assert.equal(t.onlyChildName('F'), null);  // ใบ
  assert.equal(new BusTree().shape(), null);
});
