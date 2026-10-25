// Phase 6 — แถบหัว: นาฬิกาจำลอง เริ่ม/หยุด อัตราเร็ว รีเซ็ต สถานะการเชื่อมต่อ
import { state, setUI } from '../store.js';
import { api } from '../lib/api.js';
import { NETWORK_SOURCE } from '../content/texts.js';
import { fmtClock } from '../lib/format.js';
import { patch } from '../lib/dom.js';
import { run } from './common.js';

export function mountHeader(el) {
  el.innerHTML = `
    <div class="brand"><h1>ระบบเดินรถพิษณุโลก</h1><small id="hdrNet"></small></div>
    <div class="header-controls">
      <span class="clock" id="hdrClock" aria-label="เวลาจำลอง">--:--:--</span>
      <button class="primary" id="hdrRun"></button>
      <div class="seg" id="hdrSpeed" role="group" aria-label="อัตราเร็วเวลาจำลอง"></div>
      <span id="hdrReset"></span>
      <span class="conn" id="hdrConn"><i></i><span></span></span>
    </div>`;

  el.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'hdrRun') run(() => api.setSim({ running: !state.snap?.sim.running }));
    if (t.dataset.speed) run(() => api.setSim({ scale: Number(t.dataset.speed) }));
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
  document.getElementById('hdrClock').textContent = sim ? fmtClock(sim.clock) : '--:--:--';
  document.getElementById('hdrRun').textContent = sim?.running ? '⏸ หยุดชั่วคราว' : '▶ เริ่มเดินรถ';
  patch(document.getElementById('hdrSpeed'), (sim?.scales || []).map(s =>
    `<button data-speed="${s}" aria-pressed="${sim.scale === s}">${s}×</button>`).join(''));
  patch(document.getElementById('hdrReset'), state.ui.confirmReset
    ? '<button data-act="resetConfirm" class="primary">ยืนยันรีเซ็ต</button> <button data-act="resetCancel">ยกเลิก</button>'
    : '<button data-act="reset">รีเซ็ต</button>');
  const conn = document.getElementById('hdrConn');
  conn.classList.toggle('on', state.connected);
  conn.lastElementChild.textContent = state.connected ? 'เชื่อมต่อเซิร์ฟเวอร์' : 'ขาดการเชื่อมต่อ';
  document.getElementById('hdrNet').textContent = state.network
    ? `${state.network.stations} สถานี · ${state.network.roads} ถนน · ${NETWORK_SOURCE[state.network.source] || ''}` : '';
}
