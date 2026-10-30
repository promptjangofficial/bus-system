// Phase 6 — แถบหัว: นาฬิกาจำลอง เริ่ม/หยุด อัตราเร็ว รีเซ็ต สถานะการเชื่อมต่อ
import { state, setUI, busColor } from '../store.js';
import { api } from '../lib/api.js';
import { NETWORK_SOURCE, CLOCK_DAY, VIEWS, THEME } from '../content/texts.js';
import { fmtClock } from '../lib/format.js';
import { patch } from '../lib/dom.js';
import { run } from './common.js';

export function mountHeader(el, { onView, onTheme }) {
  el.innerHTML = `
    <div class="brand">
      <span class="brand-mark" id="hdrMark" aria-hidden="true"></span>
      <span class="brand-text"><h1>ระบบเดินรถพิษณุโลก</h1><small id="hdrNet"></small></span>
    </div>
    <div class="header-controls">
      <span class="clock" id="hdrClock" aria-label="เวลาจำลอง"><span class="day">${CLOCK_DAY}</span><span class="hm">--:--</span><span class="s">--</span></span>
      <span class="sim-controls ctl-only">
        <button class="primary" id="hdrRun"></button>
        <div class="seg" id="hdrSpeed" role="group" aria-label="อัตราเร็วเวลาจำลอง"></div>
        <span id="hdrReset"></span>
      </span>
      <div class="seg view-seg" id="hdrView" role="group" aria-label="มุมมอง"></div>
      <button class="icon-btn" data-act="themeToggle" id="hdrTheme"></button>
      <span class="conn ctl-only" id="hdrConn"><i></i><span></span></span>
    </div>`;

  el.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'hdrRun') run(() => api.setSim({ running: !state.snap?.sim.running }));
    if (t.dataset.speed) run(() => api.setSim({ scale: Number(t.dataset.speed) }));
    if (t.dataset.act === 'viewSwitch') onView(t.dataset.view);
    if (t.dataset.act === 'themeToggle') onTheme(state.ui.theme === 'dark' ? 'light' : 'dark');
    if (t.dataset.act === 'reset') setUI({ confirmReset: true });
    if (t.dataset.act === 'resetCancel') setUI({ confirmReset: false });
    if (t.dataset.act === 'resetConfirm') {
      setUI({ confirmReset: false, selected: null, station: null });
      run(() => api.resetSim(), 'รีเซ็ตกลับเป็นข้อมูลตั้งต้นแล้ว');
    }
  });
}

export function updateHeader() {
  const sim = state.snap?.sim;
  const [h, m, s] = (sim ? fmtClock(sim.clock) : '--:--:--').split(':');
  const clock = document.getElementById('hdrClock');
  clock.querySelector('.hm').textContent = `${h}:${m}`;
  clock.querySelector('.s').textContent = s;
  document.getElementById('hdrRun').textContent = sim?.running ? 'หยุดชั่วคราว' : 'เริ่มเดินรถ';
  patch(document.getElementById('hdrSpeed'), (sim?.scales || []).map(s =>
    `<button data-speed="${s}" aria-pressed="${sim.scale === s}">${s}×</button>`).join(''));
  patch(document.getElementById('hdrView'), VIEWS.map(([k, label]) =>
    `<button data-act="viewSwitch" data-view="${k}" aria-pressed="${state.ui.view === k}">${label}</button>`).join(''));
  patch(document.getElementById('hdrReset'), state.ui.confirmReset
    ? '<button data-act="resetConfirm" class="primary">ยืนยันรีเซ็ต</button> <button data-act="resetCancel">ยกเลิก</button>'
    : '<button data-act="reset">รีเซ็ต</button>');
  patch(document.getElementById('hdrMark'), ['NU-01', 'AIR-03', 'CITY-02'].map(n => `<i style="background:${busColor(n)}"></i>`).join(''));
  const theme = document.getElementById('hdrTheme'), tt = THEME[state.ui.theme];
  if (theme.textContent !== tt.icon) { theme.textContent = tt.icon; theme.title = tt.label; theme.setAttribute('aria-label', tt.label); }
  const conn = document.getElementById('hdrConn');
  conn.classList.toggle('on', state.connected);
  conn.lastElementChild.textContent = state.connected ? 'เชื่อมต่อเซิร์ฟเวอร์' : 'ขาดการเชื่อมต่อ';
  document.getElementById('hdrNet').textContent = state.network
    ? `${state.network.stations} สถานี ${state.network.roads} ถนน ${NETWORK_SOURCE[state.network.source] || ''}` : '';
}
