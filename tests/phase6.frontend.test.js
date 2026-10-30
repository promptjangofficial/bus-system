// เฟส 6 — หน้าจอ + ความเข้ากันได้กับเฟส 5 (ทุกการเรียก API ต้องมีปลายทางจริง และช่องข้อมูลตรงกัน)
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.USE_OSRM = process.env.USE_OSRM ?? '0';
process.env.BUS_RUNTIME_DIR = process.env.BUS_RUNTIME_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'bus-p6-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('url');
const { FRONTEND, listFiles, read } = require('./helpers');
const { start } = require('../backend/server');
const { STATUS } = require('../backend/services/fleet');

const JS = listFiles(path.join(FRONTEND, 'js'), '.js');
const ALL_JS = JS.map(read).join('\n');
const HTML = read(path.join(FRONTEND, 'index.html'));
const CSS = listFiles(path.join(FRONTEND, 'css'), '.css').map(read).join('\n');
const load = rel => import(pathToFileURL(path.join(FRONTEND, 'js', rel)).href);

let app, base;
const realFetch = global.fetch;
test.before(async () => {
  app = await start({ port: 0, logger: { log() {}, warn() {} } });
  base = `http://127.0.0.1:${app.port}`;
  global.location = { origin: base };
  global.fetch = (u, o) => realFetch(String(u).startsWith('/') ? base + u : u, o);
});
test.after(async () => { global.fetch = realFetch; await app.close(); });

test('index.html: ทุกไฟล์ css/js ที่อ้างถึงมีอยู่จริง', () => {
  const refs = [...HTML.matchAll(/(?:href|src)="(?!https?:)([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 6);
  for (const r of refs) assert.ok(fs.existsSync(path.join(FRONTEND, r)), r);
});

test('import ทุกบรรทัดชี้ไฟล์ที่มี และชื่อที่ import ถูก export จริง', () => {
  for (const f of JS) {
    const src = read(f);
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
      const target = path.resolve(path.dirname(f), m[2]);
      assert.ok(fs.existsSync(target), `${path.basename(f)} → ${m[2]}`);
      const tsrc = read(target);
      for (const name of m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        const re = name.replace(/[$]/g, '\\$&');
        assert.match(tsrc, new RegExp(`export\\s+(async\\s+)?(function|const|let|class)\\s+${re}(?![\\w$])`), `${path.basename(f)} ต้องการ ${name} จาก ${m[2]}`);
      }
    }
  }
});

test('โมดูลพื้นฐานโหลดได้ใน Node (ไม่มีโค้ดที่แตะ DOM ตอนโหลด)', async () => {
  for (const m of ['config.js', 'content/texts.js', 'lib/format.js', 'store.js', 'lib/api.js', 'lib/theme.js']) await load(m);
});

test('เข้ากับเฟส 5: ทุกฟังก์ชันใน api.js เรียกปลายทางที่มีจริง', async () => {
  const { api } = await load('lib/api.js');
  const samples = {
    arrivals: ['g'], validateRoute: [['d', 'g', 'i']], searchBus: ['NU-01'],
    createBus: [{ name: 'UI-01', plate: '1-1 พล', capacity: 10, speedKmh: 30, route: ['d', 'g', 'i'] }],
    retire: ['UI-01'], remove: ['UI-01'], breakdown: ['NU-01'], repair: ['NU-01'], modify: ['CITY-02'], resume: ['CITY-02'],
    insertStop: ['CITY-02', 0, 'i'], deleteStop: ['CITY-02', 1], searchStop: ['CITY-02', 'h'],
    setSim: [{ scale: 30 }], resetSim: [], ingest: [{ bus: 'NU-01', type: 'passenger', count: 3 }],
  };
  const order = ['network', 'stations', 'roads', 'arrivals', 'validateRoute', 'searchBus', 'structures', 'createBus', 'breakdown', 'repair',
    'modify', 'insertStop', 'deleteStop', 'searchStop', 'resume', 'retire', 'remove', 'setSim', 'ingest', 'resetSim'];
  const fns = Object.keys(api).filter(k => k !== 'deviceUrl');
  assert.deepEqual(fns.filter(k => !order.includes(k)), [], 'มีฟังก์ชันที่ยังไม่ได้ทดสอบ');
  for (const k of order) {
    try { await api[k](...(samples[k] || [])); }
    catch (e) { assert.doesNotMatch(e.message, /ไม่พบปลายทาง|404/, `${k}: ${e.message}`); }
  }
  assert.equal(api.deviceUrl(), `${base}/api/devices/ingest`);
});

test('เข้ากับเฟส 5: ช่องข้อมูลที่หน้าจออ่าน มีในข้อมูลจาก backend', async () => {
  const r = await (await realFetch(`${base}/api/buses`)).json();
  const used = {
    bus: ['name', 'plate', 'capacity', 'speedKmh', 'status', 'pendingModify', 'laps', 'route', 'currentIndex', 'current', 'next',
      'segmentKm', 'lat', 'lng', 'fraction', 'etaSec', 'etaBasis', 'dwellSec', 'positionSource', 'offRouteM', 'device'],
  };
  for (const f of used.bus) {
    assert.match(ALL_JS, new RegExp(`\\.${f}\\b`), `หน้าจอไม่ได้ใช้ ${f} — ลบออกจากรายการ`);
    assert.ok(r.every(b => f in b), `backend ไม่ส่ง ${f}`);
  }
  const net = await (await realFetch(`${base}/api/network`)).json();
  for (const f of ['source', 'stations', 'roads', 'deviceKeyRequired', 'liveTtlMs']) assert.ok(f in net, f);
});

test('ป้ายสถานะครบทุกสถานะของ backend และมีสีใน CSS', async () => {
  const { STATUS_LABEL, NETWORK_SOURCE } = await load('content/texts.js');
  for (const s of Object.values(STATUS)) {
    assert.ok(STATUS_LABEL[s], `ไม่มีป้าย ${s}`);
    assert.match(CSS, new RegExp(`\\.st-${s}\\b`), `ไม่มีสี .st-${s}`);
  }
  for (const s of ['MOVING', 'AT_STATION', 'BROKEN', 'MODIFYING']) assert.match(CSS, new RegExp(`\\.bus-pin\\.st-${s}`));
  for (const s of ['osrm', 'mixed', 'estimate']) assert.ok(NETWORK_SOURCE[s], s);
});

test('แท็บทุกอันมีแผงรองรับ', async () => {
  const { TABS } = await load('content/texts.js');
  const main = read(path.join(FRONTEND, 'js', 'main.js'));
  const panels = main.match(/const PANELS = \{([\s\S]*?)\};/)[1];
  for (const [k] of TABS) assert.match(panels, new RegExp(`\\b${k}:`), `แท็บ ${k} ไม่มีแผง`);
});

test('มุมมองผู้โดยสาร/ศูนย์ควบคุม: ทุกมุมมองมีปุ่มสลับและมีสไตล์ ปุ่มแจ้งรถเสีย/แก้เส้นทางยังมีชื่อตามบทวิดีโอ', async () => {
  const { VIEWS } = await load('content/texts.js');
  assert.deepEqual(VIEWS.map(([k]) => k), ['rider', 'control']);
  const main = read(path.join(FRONTEND, 'js', 'main.js'));
  for (const [k] of VIEWS) assert.match(main, new RegExp(`'${k}'`), `main.js ไม่รู้จักมุมมอง ${k}`);
  assert.match(CSS, /\[data-view="rider"\]/);
  for (const label of ['แจ้งรถเสีย', 'แก้ไขเส้นทาง', 'ตรวจสอบเส้นทางและเดินรถต่อ']) assert.ok(ALL_JS.includes(`>${label}<`), label);
});

test('ทุก id ที่โค้ดเรียก มีอยู่ใน HTML หรือ template', () => {
  const defined = new Set([...(HTML + ALL_JS).matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
  const used = new Set([
    ...[...ALL_JS.matchAll(/getElementById\('([\w-]+)'\)/g)].map(m => m[1]),
    ...[...ALL_JS.matchAll(/\$\('#([\w-]+)'/g)].map(m => m[1]),
  ]);
  assert.deepEqual([...used].filter(id => !defined.has(id)), []);
});

test('ทุกปุ่ม data-act มีตัวจัดการ', () => {
  const acts = new Set([...ALL_JS.matchAll(/data-act="(\w+)"/g)].map(m => m[1]));
  const handled = new Set([
    ...[...ALL_JS.matchAll(/(?:case\s+|===\s*)'(\w+)'/g)].map(m => m[1]),
    ...[...ALL_JS.matchAll(/closest\('\[data-act="(\w+)"\]'\)/g)].map(m => m[1]),
  ]);
  assert.ok(acts.size > 15);
  assert.deepEqual([...acts].filter(a => !handled.has(a)), []);
});

test('ข้อความที่แสดงถูก escape กันการแทรกโค้ด', async () => {
  const { esc, fmtClock, fmtDur, fmtAgo } = await load('lib/format.js');
  assert.equal(esc('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  assert.equal(esc(null), '');
  assert.equal(fmtClock(3661), '01:01:01');
  assert.equal(fmtClock(86400 + 60), '00:01:00');
  assert.equal(fmtDur(null), '—');
  assert.equal(fmtDur(75), '1 นาที 15 วิ');
  assert.equal(fmtDur(-5), '0 วิ');
  assert.equal(fmtAgo(125000), '2 นาทีที่แล้ว');
  // ชื่อรถ/ทะเบียน/ข้อความจากเซิร์ฟเวอร์ต้องผ่าน esc ก่อนใส่ HTML
  for (const f of JS.filter(f => f.includes(`${path.sep}ui${path.sep}`))) {
    // toast ใช้ textContent จึงปลอดภัย — ตรวจเฉพาะบรรทัดที่สร้าง HTML
    const lines = read(f).split('\n').filter(l => !/\b(run|toast)\(/.test(l) && !/text:\s*`/.test(l));
    const bad = lines.flatMap(l => [...l.matchAll(/\$\{(b|a|s|bus|x)\.(name|plate|code)\}/g)].map(m => m[0]));
    assert.deepEqual(bad, [], `${path.basename(f)} มีค่าที่ไม่ผ่าน esc`);
  }
});

test('store: หาเส้นถนนได้ทั้งสองทิศ และสีรถคงที่', async () => {
  const store = await load('store.js');
  const { BUS_COLORS } = await load('config.js');
  store.state.roads = [{ from: 'a', to: 'b', geometry: [[1, 1], [2, 2]] }];
  assert.deepEqual(store.roadGeometry('b', 'a'), [[2, 2], [1, 1]]);
  assert.equal(store.roadGeometry('a', 'z'), null);
  assert.equal(store.busColor('NU-01'), store.busColor('NU-01'));
  assert.ok(BUS_COLORS.includes(store.busColor('ทดสอบ')));
});

test('ธีมมืด: ตั้งสีครบทุกตัวแปร และสีรถมีชุดสำหรับธีมมืด', async () => {
  const tokens = read(path.join(FRONTEND, 'css', 'tokens.css'));
  const block = re => tokens.match(re)?.[1] || '';
  const names = css => new Set([...css.matchAll(/(--[\w-]+):\s*#/g)].map(m => m[1]));
  const light = names(block(/^:root \{([^}]*)\}/m));
  const viaMedia = names(block(/:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/));
  const viaToggle = names(block(/:root\[data-theme="dark"\] \{([^}]*)\}/));
  assert.ok(light.size > 15);
  // ทุกสีของธีมสว่างต้องมีค่าธีมมืด ทั้งทางตามระบบและทางกดปุ่ม
  assert.deepEqual([...light].filter(n => !viaMedia.has(n)), []);
  assert.deepEqual([...viaMedia].sort(), [...viaToggle].sort());
  assert.match(HTML, /localStorage\.getItem\('bus-theme'\)/);
  assert.match(read(path.join(FRONTEND, 'js', 'lib', 'theme.js')), /const KEY = 'bus-theme'/);

  const store = await load('store.js');
  const cfg = await load('config.js');
  assert.equal(cfg.BUS_COLORS.length, cfg.BUS_COLORS_DARK.length);
  assert.deepEqual(Object.keys(cfg.LINE_COLORS), Object.keys(cfg.LINE_COLORS_DARK));
  assert.equal(store.busColor('NU-01', 'dark'), cfg.LINE_COLORS_DARK['NU-01']);
  assert.equal(store.busColor('ทดสอบ', 'dark'), cfg.BUS_COLORS_DARK[cfg.BUS_COLORS.indexOf(store.busColor('ทดสอบ', 'light'))]);
});
