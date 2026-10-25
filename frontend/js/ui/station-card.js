// Phase 6 — การ์ดสถานี: รถที่ผ่านสถานีนี้ และเวลาถึง
import { state, setUI, busColor } from '../store.js';
import { api } from '../lib/api.js';
import { ARRIVALS_REFRESH_MS } from '../config.js';
import { esc, fmtDur } from '../lib/format.js';
import { patch } from '../lib/dom.js';
import { statusPill } from './common.js';

let timer = null, data = null, loadedFor = null;

async function load(code) {
  try { data = await api.arrivals(code); } catch { data = null; }
  if (state.ui.station === code) render(document.getElementById('stationCard'));
}

function render(el) {
  if (!data) { patch(el, '<span class="muted">กำลังโหลด…</span>'); return; }
  const s = data.station;
  const rows = data.arrivals.map(a => `
    <div class="arrival"><i class="swatch" style="background:${busColor(a.bus)}"></i><b class="mono">${esc(a.bus)}</b>
      <span class="muted small">จุดแวะที่ ${a.positions.join(', ')}</span>
      ${a.here ? statusPill('AT_STATION') : a.nextHere && a.etaSec != null ? `<span class="mono">ถึงใน ${fmtDur(a.etaSec)}</span>` : ''}
      ${a.status === 'BROKEN' ? statusPill('BROKEN') : ''}</div>`).join('');
  patch(el, `<button class="close" data-act="closeStation" aria-label="ปิด">×</button>
    <div><h2 style="padding-right:24px"><span class="mono">${esc(s.code)}</span> ${esc(s.name)}</h2>
    <div class="muted small mono">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</div></div>
    ${rows || '<span class="muted">ไม่มีรถผ่านสถานีนี้</span>'}`);
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
