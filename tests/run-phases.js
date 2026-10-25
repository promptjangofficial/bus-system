// รันการทดสอบทีละเฟส เรียงจาก 0 → 6
// แต่ละเฟสทดสอบทั้งส่วนของตัวเอง และความเข้ากันได้กับเฟสก่อนหน้า
// เฟสไหนไม่ผ่าน หยุดทันที (เฟสถัดไปพึ่งเฟสนี้อยู่)

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PHASES = [
  ['0', 'ค่าตั้งและข้อความ',       'phase0.config.test.js'],
  ['1', 'ข้อมูล',                 'phase1.data.test.js'],
  ['2', 'โครงสร้างข้อมูล',         'phase2.core.test.js'],
  ['3', 'API ภายนอก (OSRM)',      'phase3.integrations.test.js'],
  ['4', 'ตรรกะระบบ',              'phase4.services.test.js'],
  ['5', 'HTTP API',               'phase5.api.test.js'],
  ['6', 'หน้าจอ (UX/UI)',          'phase6.frontend.test.js'],
];

const only = process.argv[2];
let failed = false;
for (const [id, name, file] of PHASES) {
  if (only !== undefined && only !== id) continue;
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `bus-phase${id}-`));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', path.join(__dirname, file)], {
    encoding: 'utf8',
    env: { ...process.env, USE_OSRM: '0', BUS_RUNTIME_DIR: runtime, PORT: '0', FORCE_COLOR: '0' },
  });
  fs.rmSync(runtime, { recursive: true, force: true });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/^ℹ pass (\d+)/m) || [])[1] || '?';
  const fail = (out.match(/^ℹ fail (\d+)/m) || [])[1] || '?';
  const ms = Date.now() - t0;
  if (r.status === 0) {
    console.log(`✔ เฟส ${id} ${name} — ผ่าน ${pass} ข้อ (${ms} ms)`);
  } else {
    console.log(`✘ เฟส ${id} ${name} — ไม่ผ่าน ${fail} ข้อ\n`);
    console.log(out);
    failed = true;
    break;
  }
}
process.exit(failed ? 1 : 0);
