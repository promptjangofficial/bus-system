// Phase 6 — แผงอุปกรณ์ติดรถ: ฟังก์ชันที่รออุปกรณ์ สถานะรายคัน ปลายทางรับข้อมูล และเครื่องมือทดสอบ
import { state, setUI, buses, roadGeometry } from '../store.js';
import { api } from '../lib/api.js';
import { GPS_TEST_INTERVAL_MS } from '../config.js';
import { DEVICE_FEATURES, PAYLOAD_EXAMPLES } from '../content/texts.js';
import { esc, fmtAgo } from '../lib/format.js';
import { $, patch, copyText } from '../lib/dom.js';
import { msgBox, toast } from './common.js';

// ---------- เครื่องมือทดสอบ: ส่งพิกัดไล่ตามเส้นถนน (ไม่ใช่ข้อมูลจริง) ----------
const STEPS = 6;
const gpsTest = { bus: null, timer: null, step: 0, hold: 0 };
let deviceKey = '';
let testBusSel = null;
let rawDraft = null;

async function sendTest(payload) {
  try { await api.ingest(payload, deviceKey); }
  catch (err) { stopGpsTest(); setUI({ devMsg: { cls: 'err', text: err.message } }); }
}

function gpsTick() {
  const b = buses().find(x => x.name === gpsTest.bus);
  if (!b || b.status === 'RETIRED') return stopGpsTest();
  const geom = roadGeometry(b.current, b.next);
  if (!geom) return;
  if (['BROKEN', 'MODIFYING'].includes(b.status) || gpsTest.hold > 0) {
    gpsTest.hold = Math.max(0, gpsTest.hold - 1);
    const p = b.device.gps || { lat: geom[0][0], lng: geom[0][1] };
    return sendTest({ bus: b.name, type: 'gps', lat: p.lat, lng: p.lng, speedKmh: 0 });
  }
  gpsTest.step = Math.min(STEPS, gpsTest.step + 1);
  const [lat, lng] = geom[Math.round(gpsTest.step / STEPS * (geom.length - 1))];
  sendTest({ bus: b.name, type: 'gps', lat, lng, speedKmh: 28 });
  if (gpsTest.step >= STEPS) { gpsTest.step = 0; gpsTest.hold = 2; }
}

function startGpsTest(name) {
  stopGpsTest();
  const b = buses().find(x => x.name === name);
  Object.assign(gpsTest, { bus: name, step: Math.round((b?.fraction || 0) * STEPS), hold: 0 });
  gpsTick();
  gpsTest.timer = setInterval(gpsTick, GPS_TEST_INTERVAL_MS);
}
function stopGpsTest() { clearInterval(gpsTest.timer); gpsTest.timer = null; }

// ---------- การแสดงผล ----------
function statusTableHTML() {
  const cell = (v, ok, txt) => v ? `${ok}<div class="muted small mono">${fmtAgo(v.ageMs)}</div>` : `<span class="muted">${txt}</span>`;
  const rows = buses().map(b => {
    const d = b.device;
    return `<tr><td class="mono">${esc(b.name)}</td>
      <td>${cell(d.gps, d.gps?.online ? '<span class="pill st-LIVE">ออนไลน์</span>' : '<span class="pill st-RETIRED">ขาดสัญญาณ</span>', 'ยังไม่ติดตั้ง')}</td>
      <td>${cell(d.passengers, `<span class="mono">${d.passengers?.count}/${b.capacity}</span>`, 'ยังไม่ติดตั้ง')}</td>
      <td>${cell(d.engine, d.engine?.fault ? `<span class="pill st-BROKEN">${esc(d.engine.code || 'ขัดข้อง')}</span>` : '<span class="pill st-MOVING">ปกติ</span>', 'ยังไม่ติดตั้ง')}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>รถ</th><th>GPS</th><th>นับผู้โดยสาร</th><th>เครื่องยนต์</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderDevices(root) {
  const active = buses().filter(b => b.status !== 'RETIRED');
  const pick = [testBusSel, gpsTest.bus, state.ui.selected].find(n => active.some(b => b.name === n));
  const testBus = pick || active[0]?.name;
  root.innerHTML = `
    <div class="section">
      <h3>ฟังก์ชันที่ใช้ข้อมูลจากอุปกรณ์</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>ฟังก์ชัน</th><th>อุปกรณ์</th><th>ระหว่างยังไม่ติดตั้ง</th></tr></thead>
        <tbody>${DEVICE_FEATURES.map(f => `<tr><td>${esc(f.name)}</td><td>${esc(f.device)} <span class="tag">${f.type}</span></td><td class="muted">${esc(f.fallback)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="section">
      <h3>สถานะอุปกรณ์รายคัน</h3>
      <div class="table-wrap" id="devStatus"></div>
    </div>

    <div class="section">
      <h3>ปลายทางรับข้อมูลจากอุปกรณ์</h3>
      <div class="copy-line"><code id="devUrl">POST ${esc(api.deviceUrl())}</code><button data-act="copyUrl">คัดลอก</button></div>
      <pre>${esc(PAYLOAD_EXAMPLES)}</pre>
      <div class="small muted">ส่งทีละรายการหรือเป็น array · Content-Type: application/json${state.network?.deviceKeyRequired ? ' · ต้องแนบ header <span class="mono">X-Device-Key</span>' : ''} · GPS เงียบเกิน ${Math.round((state.network?.liveTtlMs || 30000) / 1000)} วินาที ระบบกลับไปใช้การจำลองเอง</div>
    </div>

    <div class="section">
      <h3>ทดสอบการรับข้อมูล <span class="tag">ข้อมูลทดสอบ</span></h3>
      ${state.network?.deviceKeyRequired ? `<input id="devKey" placeholder="X-Device-Key" value="${esc(deviceKey)}" aria-label="คีย์อุปกรณ์">` : ''}
      <div class="row">
        <select id="tBus" aria-label="รถที่จะทดสอบ">${active.map(b => `<option${b.name === testBus ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      </div>
      <div class="row">
        ${gpsTest.timer ? `<button data-act="gpsStop">หยุดส่ง GPS (${esc(gpsTest.bus)})</button>` : '<button data-act="gpsStart">ส่ง GPS ต่อเนื่อง</button>'}
        <button data-act="paxTest">ส่งจำนวนผู้โดยสาร</button>
        <button class="danger" data-act="engTest">ส่งรหัสเครื่องยนต์ขัดข้อง</button>
      </div>
      <textarea id="rawJson" rows="3" aria-label="JSON ที่จะส่ง">${esc(rawDraft ?? `{"bus":"${testBus || 'CITY-02'}","type":"passenger","count":18}`)}</textarea>
      <div class="row"><button data-act="rawSend">ส่ง JSON นี้</button></div>
      ${msgBox(state.ui.devMsg)}
    </div>`;
  updateDevices(root);
}

export function updateDevices(root) { patch($('#devStatus', root), statusTableHTML()); }

export function mountDeviceEvents(root) {
  root.addEventListener('input', e => { if (e.target.id === 'devKey') deviceKey = e.target.value; if (e.target.id === 'rawJson') rawDraft = e.target.value; });
  root.addEventListener('change', e => { if (e.target.id === 'tBus') testBusSel = e.target.value; });
  root.addEventListener('click', async e => {
    if (state.ui.tab !== 'devices') return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const bus = $('#tBus', root)?.value;
    const target = buses().find(b => b.name === bus);
    try {
      switch (act) {
        case 'copyUrl': toast(await copyText(api.deviceUrl(), $('#devUrl', root)) ? 'คัดลอกแล้ว' : 'เลือกข้อความไว้ให้แล้ว กด Ctrl+C เพื่อคัดลอก'); return;
        case 'gpsStart': if (bus) { startGpsTest(bus); setUI({ devMsg: { cls: 'ok', text: `กำลังส่งพิกัดทดสอบของ ${bus} ทุก 1 วินาที` } }); } return;
        case 'gpsStop': stopGpsTest(); setUI({ devMsg: { text: 'หยุดส่ง GPS ทดสอบแล้ว รถจะกลับไปใช้การจำลองเมื่อสัญญาณหมดอายุ' } }); return;
        case 'paxTest': {
          if (!target) return;
          const count = Math.floor(Math.random() * (target.capacity + 6));
          await api.ingest({ bus, type: 'passenger', count }, deviceKey);
          setUI({ devMsg: { cls: 'ok', text: `ส่งจำนวนผู้โดยสาร ${count} คน ให้ ${bus}` } });
          return;
        }
        case 'engTest':
          await api.ingest({ bus, type: 'engine', fault: true, code: 'P0300' }, deviceKey);
          setUI({ devMsg: { cls: 'warn', text: `${bus} ได้รับรหัส P0300 และเปลี่ยนเป็นรถเสีย — ยืนยันซ่อมได้ที่แท็บรถโดยสาร` } });
          return;
        case 'rawSend': {
          let payload;
          try { payload = JSON.parse($('#rawJson', root).value); }
          catch { setUI({ devMsg: { cls: 'err', text: 'JSON ไม่ถูกต้อง ตรวจเครื่องหมายคำพูดและวงเล็บ' } }); return; }
          const r = await api.ingest(payload, deviceKey);
          setUI({ devMsg: { cls: 'ok', text: `รับข้อมูลแล้ว ${r.results.length} รายการ` } });
          return;
        }
      }
    } catch (err) {
      setUI({ devMsg: { cls: 'err', text: err.message } });
    }
  });
}
