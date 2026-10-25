// Phase 6 — ส่วนประกอบที่ใช้ร่วมกันหลายแผง
import { STATUS_LABEL } from '../content/texts.js';
import { state } from '../store.js';
import { esc } from '../lib/format.js';

export const statusPill = s => `<span class="pill st-${s}">${STATUS_LABEL[s] || s}</span>`;
export const livePill = () => '<span class="pill st-LIVE">GPS จริง</span>';

export const stationOptions = selected => state.stations
  .map(s => `<option value="${esc(s.code)}"${s.code === selected ? ' selected' : ''}>${esc(s.code)} · ${esc(s.name)}</option>`).join('');

export const msgBox = m => (m ? `<div class="msg ${m.cls || ''}">${m.html ?? esc(m.text)}</div>` : '');

let timer;
export function toast(text, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'toast' + (isError ? ' err' : '');
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, isError ? 4500 : 2200);
}

// เรียก API แล้วแจ้งผลด้วย toast
export async function run(fn, okText) {
  try { const r = await fn(); if (okText) toast(okText); return r; }
  catch (err) { toast(err.message, true); return null; }
}
