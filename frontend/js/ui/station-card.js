// Phase 6 — การ์ดสถานี: รถที่ผ่านสถานีนี้ และเวลาถึง
import { state, setUI, busOf } from '../store.js';
import { api } from '../lib/api.js';
import { ARRIVALS_REFRESH_MS } from '../config.js';
import { esc } from '../lib/format.js';
import { patch } from '../lib/dom.js';
import { statusPill, plate } from './common.js';

let timer = null, data = null, loadedFor = null;

async function load(code) {
  try { data = await api.arrivals(code); } catch { data = null; }
  if (state.ui.station === code) render(document.getElementById('stationCard'));
}

function render(el) {
  if (!data) { patch(el, '<span class="muted">กำลังโหลด…</span>'); return; }
  const s = data.station;
  const rows = data.arrivals.map(a => `
    <div class="arrival">${plate(a.bus)}
      <span class="info">${a.status === 'BROKEN' ? statusPill('BROKEN') : esc(arrivalNote(a))}</span>
      ${etaHTML(a)}</div>`).join('');
  patch(el, `<button class="close" data-act="closeStation" aria-label="ปิด">×</button>
    <h2><span class="stop-code">${esc(s.code)}</span>${esc(s.name)}</h2>
    ${rows || '<p class="muted">ไม่มีรถผ่านป้ายนี้</p>'}`);
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
  if (a.nextHere) return 'กำลังมาป้ายนี้';
  const k = stopsAway(a);
  return k == null ? 'ผ่านป้ายนี้' : `อีก ${k} ป้ายก่อนถึง`;
}

function etaHTML(a) {
  if (a.status === 'BROKEN') return '<span class="eta"></span>';
  if (a.here) return '<span class="eta soon"><b>ถึงแล้ว</b></span>';
  if (!a.nextHere || a.etaSec == null) return '<span class="eta"></span>';
  const m = Math.floor(a.etaSec / 60);
  return m < 1 ? '<span class="eta soon"><b>ใกล้ถึง</b></span>' : `<span class="eta"><b>${m}</b><span>นาที</span></span>`;
}

export function mountStationCard(el) {
  el.addEventListener('click', e => { if (e.target.closest('[data-act="closeStation"]')) setUI({ station: null }); });
}

export function updateStationCard(el) {
  const code = state.ui.station;
  el.hidden = !code;
  if (!code) { clearInterval(timer); timer = null; loadedFor = null; return; }
  if (loadedFor !== code) {
    loadedFor = code; data = null; render(el);
    clearInterval(timer);
    load(code);
    timer = setInterval(() => load(code), ARRIVALS_REFRESH_MS);
  }
}
