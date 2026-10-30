// Phase 6 — ส่วนประกอบที่ใช้ร่วมกันหลายแผง
import { STATUS_LABEL } from '../content/texts.js';
import { state, busColor } from '../store.js';
import { esc } from '../lib/format.js';
import { replay } from '../lib/dom.js';

export const statusPill = s => `<span class="pill st-${s}">${STATUS_LABEL[s] || s}</span>`;
export const livePill = () => '<span class="pill st-LIVE">GPS จริง</span>';
// ป้ายสายรถ: ชื่อรถบนพื้นสีประจำสาย
export const plate = (name, { lg = false, off = false } = {}) =>
  `<span class="plate${lg ? ' lg' : ''}${off ? ' off' : ''}" style="--c:${busColor(name)}">${esc(name)}</span>`;

export const stationOptions = selected => state.stations
  .map(s => `<option value="${esc(s.code)}"${s.code === selected ? ' selected' : ''}>${esc(s.name)} (${esc(s.code)})</option>`).join('');

// เวลาถึงแบบป้ายรถเมล์: ตัวเลขนาทีใหญ่ · ไม่ถึงนาที = ใกล้ถึง · key = ใช้พลิกตัวเลขเมื่อค่าเปลี่ยน (flipChanged)
export function etaHTML(sec, here = false, key = '') {
  const f = key ? ` data-flip="${esc(key)}"` : '';
  if (here) return `<span class="eta soon"><b${f}>ถึงแล้ว</b></span>`;
  if (sec == null) return '<span class="eta"></span>';
  const m = Math.floor(sec / 60);
  return m < 1 ? `<span class="eta soon"><b${f}>ใกล้ถึง</b></span>` : `<span class="eta"><b${f}>${m}</b><span>นาที</span></span>`;
}

export const msgBox = m => (m ? `<div class="msg ${m.cls || ''}">${m.html ?? esc(m.text)}</div>` : '');

let timer;
export function toast(text, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'toast' + (isError ? ' err' : '');
  el.hidden = false;
  replay(el, 'toast-in');
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, isError ? 4500 : 2200);
}

// เรียก API แล้วแจ้งผลด้วย toast
export async function run(fn, okText) {
  try { const r = await fn(); if (okText) toast(okText); return r; }
  catch (err) { toast(err.message, true); return null; }
}
