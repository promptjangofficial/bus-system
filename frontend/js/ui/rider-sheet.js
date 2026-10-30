// Phase 6 — มุมมองผู้โดยสาร: แผ่นข้อมูลใต้แผนที่ (มือถือ) / ข้างแผนที่ (จอใหญ่)
// สามหน้า: รถทุกสาย → แตะป้ายดูรถที่จะมาถึง → แตะ/ค้นหารถดูตำแหน่งและเส้นทาง
import { state, setUI, buses, selectedBus, stationName } from '../store.js';
import { api } from '../lib/api.js';
import { RIDER } from '../content/texts.js';
import { esc } from '../lib/format.js';
import { patch, $ } from '../lib/dom.js';
import { statusPill, plate, etaHTML, msgBox, run } from './common.js';
import { stationBoardHTML } from './station-card.js';
import { routeDiagramHTML } from './fleet-panel.js';

const backBtn = () => `<button class="sheet-back" data-act="riderBack">${RIDER.back}</button>`;

function listHTML() {
  const list = buses().filter(b => b.status !== 'RETIRED');
  const rows = list.map(b => `
    <button class="arrival rider-row" data-rpick="${esc(b.name)}">${plate(b.name)}
      <span class="info">${b.status === 'BROKEN' ? statusPill('BROKEN')
        : b.status === 'MODIFYING' ? statusPill('MODIFYING')
        : `ถัดไป <b>${esc(stationName(b.next))}</b>`}</span>
      ${b.status === 'MOVING' || b.status === 'AT_STATION' ? etaHTML(b.etaSec) : '<span class="eta"></span>'}
    </button>`).join('');
  return `<h2 class="sheet-title">${RIDER.listTitle}</h2>
    ${rows}
    <p class="muted small sheet-hint">${RIDER.hint}</p>`;
}

function busHTML(b) {
  const status = b.status === 'BROKEN' ? `<div class="msg err">${RIDER.brokenNote}</div>`
    : b.status === 'MODIFYING' ? `<div class="msg warn">${RIDER.modifyingNote}</div>`
    : `<div class="rider-next"><span class="muted">ถัดไป</span><b>${esc(stationName(b.next))}</b>${etaHTML(b.etaSec)}</div>`;
  return `${backBtn()}
    <div class="bus-head"><h2>${plate(b.name, { lg: true })}</h2>${statusPill(b.status)}</div>
    ${status}
    ${routeDiagramHTML(b, { readonly: true })}`;
}

export function updateRider(el) {
  const b = selectedBus();
  const home = !state.ui.station && !(b && b.status !== 'RETIRED');
  // ช่องค้นหาสร้างครั้งเดียว ไม่ถูกเขียนทับระหว่างพิมพ์ (ข้อมูลสดอัปเดตหลายครั้งต่อวินาที)
  $('#rSearch', el).hidden = !home;
  patch($('#rMsg', el), home ? msgBox(state.ui.searchMsg) : '');
  patch($('#rBody', el), state.ui.station ? `${backBtn()}${stationBoardHTML()}` : home ? listHTML() : busHTML(b));
}

export function mountRiderEvents(el, { onFocusBus }) {
  el.innerHTML = `
    <form class="row" id="rSearch" autocomplete="off">
      <input id="rName" placeholder="${RIDER.searchPlaceholder}" aria-label="ชื่อรถ">
      <button class="primary">ค้นหา</button>
    </form>
    <div id="rMsg"></div>
    <div id="rBody"></div>`;
  el.addEventListener('click', e => {
    const pick = e.target.closest('[data-rpick]');
    if (pick) { setUI({ selected: pick.dataset.rpick, station: null, searchMsg: null }); onFocusBus(pick.dataset.rpick); return; }
    if (e.target.closest('[data-act="riderBack"]')) setUI({ station: null, selected: null, searchMsg: null });
  });
  el.addEventListener('submit', async e => {
    if (e.target.id !== 'rSearch') return;
    e.preventDefault();
    const q = $('#rName', el).value.trim();
    if (!q) return;
    const r = await run(() => api.searchBus(q));
    if (!r) return;
    if (r.found) { setUI({ selected: r.bus.name, station: null, searchMsg: null }); onFocusBus(r.bus.name); }
    else setUI({ searchMsg: { cls: 'err', text: `ไม่พบรถชื่อ "${q}"` } });
  });
}
