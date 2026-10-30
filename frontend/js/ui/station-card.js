// Phase 6 — ป้ายสถานี: รถทุกคันที่ผ่านป้ายนี้ และอีกกี่นาทีจะถึง (ใช้ทั้งมุมมองผู้โดยสารและศูนย์ควบคุม)
import { state, setUI, emit, busOf } from '../store.js';
import { api } from '../lib/api.js';
import { ARRIVALS_REFRESH_MS } from '../config.js';
import { esc } from '../lib/format.js';
import { patch } from '../lib/dom.js';
import { statusPill, plate, etaHTML } from './common.js';

let timer = null, data = null, loadedFor = null;

async function load(code) {
  try { data = await api.arrivals(code); } catch { data = null; }
  if (state.ui.station === code) emit('snap');
}

// เริ่ม/หยุดดึงข้อมูลตามป้ายที่เลือกอยู่ (เรียกทุกครั้งที่สถานะเปลี่ยน)
export function syncStation() {
  const code = state.ui.station;
  if (!code) { clearInterval(timer); timer = null; loadedFor = null; data = null; return; }
  if (loadedFor !== code) {
    loadedFor = code; data = null;
    clearInterval(timer);
    load(code);
    timer = setInterval(() => load(code), ARRIVALS_REFRESH_MS);
  }
}

// จำนวนป้ายก่อนถึงที่นี่ นับจากป้ายถัดไปของรถ (positions เริ่มนับที่ 1)
function stopsAway(a) {
  const b = busOf(a.bus);
  if (!b) return null;
  const n = b.route.length, from = (b.currentIndex + 1) % n;
  return Math.min(...a.positions.map(p => (p - 1 - from + n) % n));
}

function arrivalNote(a) {
  if (a.here) return 'จอดอยู่ที่ป้ายนี้';
  if (a.nextHere) return 'ป้ายถัดไปคือที่นี่';
  const k = stopsAway(a);
  return k == null ? 'ผ่านป้ายนี้' : `อีก ${k} ป้าย`;
}

// เรียงคันที่ใกล้ถึงที่สุดขึ้นก่อน รถเสีย/แก้เส้นทางไว้ท้าย
const order = a => (a.here ? -1 : a.etaSec ?? Infinity);

export function stationBoardHTML() {
  if (!data || data.station.code !== state.ui.station) return '<p class="muted">กำลังโหลด…</p>';
  const s = data.station;
  const rows = [...data.arrivals].sort((x, y) => order(x) - order(y)).map(a => `
    <div class="arrival">${plate(a.bus)}
      <span class="info">${a.status === 'BROKEN' ? statusPill('BROKEN') : esc(arrivalNote(a))}</span>
      ${a.status === 'BROKEN' ? '<span class="eta"></span>' : etaHTML(a.etaSec, a.here)}</div>`).join('');
  return `<h2><span class="stop-code">${esc(s.code)}</span>${esc(s.name)}</h2>
    ${rows || '<p class="muted">ไม่มีรถผ่านป้ายนี้</p>'}`;
}

export function mountStationCard(el) {
  el.addEventListener('click', e => { if (e.target.closest('[data-act="closeStation"]')) setUI({ station: null }); });
}

// การ์ดลอยบนแผนที่ (มุมมองศูนย์ควบคุม)
export function updateStationCard(el) {
  el.hidden = !state.ui.station;
  if (state.ui.station) patch(el, `<button class="close" data-act="closeStation" aria-label="ปิด">×</button>${stationBoardHTML()}`);
}
