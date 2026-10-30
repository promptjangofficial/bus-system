// Phase 6 — บันทึกเหตุการณ์ใต้แผนที่: ยุบเป็นแถบได้ นับรายการใหม่ที่ยังไม่อ่านระหว่างยุบ
import { state } from '../store.js';
import { LOG } from '../content/texts.js';
import { esc, fmtClock } from '../lib/format.js';
import { patch } from '../lib/dom.js';

// รายการใหม่อยู่บนสุด · จำรายการบนสุดที่เห็นล่าสุด แล้วนับว่ามีอะไรมาต่อจากนั้นกี่รายการ
let seenKey = null, unread = 0;
const keyOf = l => `${l.clock}|${l.text}`;

export function updateEventLog(el, bar) {
  const items = state.snap?.log || [];
  if (state.ui.logOpen || seenKey === null) {
    seenKey = items[0] ? keyOf(items[0]) : '';
    unread = 0;
  } else {
    const i = items.findIndex(l => keyOf(l) === seenKey);
    unread = i < 0 ? items.length : i;
  }
  patch(el, items.length
    ? items.map(l => `<div><span class="t">${fmtClock(l.clock).slice(0, 5)}</span><span>${esc(l.text)}</span></div>`).join('')
    : `<span class="muted">${LOG.empty}</span>`);
  // ตัวเลขเปลี่ยน = สร้างป้ายใหม่ → แอนิเมชันเด้งเล่นเอง
  patch(bar, `<span>${LOG.title}</span>${unread
    ? `<span class="log-badge" aria-label="${LOG.unread(unread)}">${unread > 99 ? '99+' : unread}</span>` : ''}<span class="chev" aria-hidden="true">⌃</span>`);
  bar.setAttribute('aria-expanded', String(state.ui.logOpen));
  bar.title = state.ui.logOpen ? LOG.hide : LOG.show;
}
