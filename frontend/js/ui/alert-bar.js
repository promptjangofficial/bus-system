// Phase 6 — แถบแจ้งเตือนรถเสียบนแผนที่ (ทั้งสองมุมมอง)
import { state, buses, stationName } from '../store.js';
import { esc } from '../lib/format.js';
import { patch } from '../lib/dom.js';
import { plate } from './common.js';

function alertHTML(b) {
  const where = `ระหว่าง ${esc(stationName(b.current))} กับ ${esc(stationName(b.next))}`;
  if (state.ui.view === 'rider') return `${plate(b.name)}<span><b>รถเสีย</b> ${where}</span>`;
  const by = b.device.engine?.fault
    ? `เซนเซอร์แจ้งเครื่องยนต์ขัดข้อง ${esc(b.device.engine.code)}`
    : 'ผู้ดูแลแจ้งรถเสีย';
  return `${plate(b.name)}<span><b>${by}</b> ${where}</span>
    <button data-act="alertPick" data-bus="${esc(b.name)}">ดูรถคันนี้</button>`;
}

export function updateAlerts(el) {
  const broken = buses().filter(b => b.status === 'BROKEN');
  el.hidden = !broken.length;
  patch(el, broken.map(b => `<div class="alert">${alertHTML(b)}</div>`).join(''));
}
