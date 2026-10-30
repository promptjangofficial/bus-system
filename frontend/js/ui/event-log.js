// Phase 6 — บันทึกเหตุการณ์ใต้แผนที่
import { state } from '../store.js';
import { esc, fmtClock } from '../lib/format.js';
import { patch } from '../lib/dom.js';

export function updateEventLog(el) {
  const items = state.snap?.log || [];
  patch(el, items.length
    ? items.map(l => `<div><span class="t">${fmtClock(l.clock).slice(0, 5)}</span><span>${esc(l.text)}</span></div>`).join('')
    : '<span class="muted">ยังไม่มีเหตุการณ์</span>');
}
