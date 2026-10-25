// Phase 6 — แผงรถโดยสาร: ค้นหา รายการ รายละเอียด การสั่งงาน และแก้ไขเส้นทาง
import { state, setUI, buses, selectedBus, stationName, busColor } from '../store.js';
import { api } from '../lib/api.js';
import { esc, fmtDur } from '../lib/format.js';
import { patch, $ } from '../lib/dom.js';
import { statusPill, livePill, stationOptions, msgBox, run } from './common.js';

let detailSig = null;

export function selectBus(name) {
  setUI({ selected: name, routeMsg: null, stopSearch: null, confirmDelete: false });
}

export function renderFleet(root) {
  detailSig = null;
  root.innerHTML = `
    <div class="section">
      <h3>ค้นหารถ</h3>
      <form class="row" id="fSearch" autocomplete="off">
        <input id="qName" placeholder="ชื่อรถ เช่น CITY-02" aria-label="ชื่อรถ">
        <button class="primary">ค้นหา</button>
      </form>
      ${msgBox(state.ui.searchMsg)}
      <div class="bus-list" id="busList"></div>
    </div>
    <div class="section" id="busDetail"></div>`;
  updateFleet(root);
}

function busListHTML() {
  const list = buses();
  if (!list.length) return '<div class="waiting" style="margin:8px">ยังไม่มีรถในระบบ — เพิ่มรถคันแรกได้ที่แท็บ "เพิ่มรถ"</div>';
  return list.map(b => `
    <button class="bus-row" data-pick="${esc(b.name)}" aria-current="${state.ui.selected === b.name}">
      <i class="swatch" style="background:${busColor(b.name)}"></i>
      <span style="min-width:0">
        <span class="nm">${esc(b.name)}</span> ${b.positionSource === 'gps' ? livePill() : ''}
        <span class="sub" style="display:block">${b.status === 'RETIRED' ? 'ปลดระวางแล้ว'
          : `ถัดไป ${esc(stationName(b.next))}${b.etaSec != null ? ' · ' + fmtDur(b.etaSec) : ''}`}</span>
      </span>
      ${statusPill(b.status)}
    </button>`).join('');
}

function detailLiveHTML(b) {
  if (b.status === 'RETIRED') return '<div class="msg">รถคันนี้ปลดระวางแล้ว ไม่แสดงบนแผนที่</div>';
  const live = b.positionSource === 'gps';
  const pax = b.device.passengers;
  return `
    <div class="row">${statusPill(b.status)} ${live ? livePill() : '<span class="tag">ตำแหน่งจำลอง</span>'}
      ${b.pendingModify ? '<span class="pill st-MODIFYING">รอถึงสถานีเพื่อแก้เส้นทาง</span>' : ''}</div>
    <dl class="kv">
      <dt>${b.status === 'MOVING' ? 'เพิ่งออกจาก' : 'อยู่ที่'}</dt><dd><b class="mono">${esc(b.current)}</b> ${esc(stationName(b.current))}</dd>
      <dt>สถานีถัดไป</dt><dd><b class="mono">${esc(b.next)}</b> ${esc(stationName(b.next))} <span class="muted mono">${b.segmentKm.toFixed(1)} กม.</span></dd>
      <dt>ถึงในอีก</dt><dd class="mono">${fmtDur(b.etaSec)}${b.etaSec != null ? ` <span class="muted">${b.etaBasis === 'real' ? 'เวลาจริง' : 'เวลาจำลอง'}</span>` : ''}</dd>
      ${b.dwellSec != null ? `<dt>จอดอีก</dt><dd class="mono">${fmtDur(b.dwellSec)}</dd>` : ''}
      <dt>ความเร็ว</dt><dd class="mono">${live ? `${Math.round(b.device.gps.speedKmh)} กม./ชม. (GPS)` : `${b.speedKmh} กม./ชม.`}</dd>
      <dt>ผู้โดยสาร</dt><dd>${pax
        ? `<span class="mono">${pax.count}/${b.capacity}</span><div class="bar${pax.count > b.capacity ? ' over' : ''}"><i style="width:${Math.min(100, pax.count / b.capacity * 100)}%"></i></div>`
        : `<span class="muted">รอเซนเซอร์นับผู้โดยสาร · ความจุ ${b.capacity} ที่นั่ง</span>`}</dd>
      <dt>ครบรอบ</dt><dd class="mono">${b.laps} รอบ</dd>
      ${b.offRouteM > 400 ? `<dt>คำเตือน</dt><dd style="color:var(--st-modifying)">ตำแหน่ง GPS ห่างเส้นทาง ${b.offRouteM} ม.</dd>` : ''}
    </dl>`;
}

function routeChipsHTML(b) {
  const mod = b.status === 'MODIFYING';
  return `<div class="chips">${b.route.map((c, i) => `
    <span class="chip${i === b.currentIndex && b.status !== 'RETIRED' ? ' cur' : ''}" title="${esc(stationName(c))}">
      <span class="ix">${i + 1}</span><b>${esc(c)}</b>
      ${mod && i !== b.currentIndex ? `<button data-del="${i}" aria-label="ลบจุดแวะที่ ${i + 1}">×</button>` : ''}
    </span><span class="arrow">→</span>`).join('')}<span class="arrow">↺ วนกลับ</span></div>`;
}

function detailHTML(b) {
  const st = b.status, ui = state.ui;
  const actions = [];
  if (st === 'BROKEN') actions.push('<button class="primary" data-act="repair">ยืนยันซ่อมเสร็จ</button>');
  else if (st !== 'RETIRED') actions.push('<button class="danger" data-act="breakdown">แจ้งรถเสีย</button>');
  if (st !== 'RETIRED' && st !== 'MODIFYING')
    actions.push(`<button data-act="modify" ${st === 'BROKEN' || b.pendingModify ? 'disabled' : ''}>แก้ไขเส้นทาง</button>`);
  if (st === 'RETIRED') {
    actions.push(ui.confirmDelete
      ? `<button class="danger" data-act="removeConfirm">ยืนยันลบ ${esc(b.name)} ออกจากระบบ</button><button data-act="removeCancel">ยกเลิก</button>`
      : '<button class="danger" data-act="removeAsk">ลบออกจากระบบ</button>');
  } else {
    actions.push(`<button data-act="retire" ${st === 'MOVING' ? 'disabled title="ต้องจอดที่สถานีก่อน"' : ''}>ปลดระวาง</button>`);
  }

  const modify = st === 'MODIFYING' ? `
    <div class="msg warn">รถจอดอยู่ที่สถานี เพิ่มหรือลบจุดแวะ แล้วกดตรวจสอบเพื่อเดินรถต่อ</div>
    <form class="row" id="fInsert">
      <label class="small muted" for="insAfter">แทรกหลังจุดแวะที่</label>
      <select id="insAfter">${b.route.map((c, i) => `<option value="${i}">${i + 1} · ${esc(c)}</option>`).join('')}</select>
      <select id="insStation" aria-label="สถานีที่จะเพิ่ม">${stationOptions()}</select>
      <button>เพิ่มจุดแวะ</button>
    </form>
    <div class="row"><button class="primary" data-act="resume">ตรวจสอบเส้นทางและเดินรถต่อ</button></div>` : '';

  return `
    <div class="row" style="justify-content:space-between">
      <h2 class="row" style="gap:8px"><i class="swatch" style="background:${busColor(b.name)};width:12px;height:12px"></i>${esc(b.name)}</h2>
      <span class="mono muted">${esc(b.plate)}</span>
    </div>
    <div id="detailLive" class="section"></div>
    <div class="row">${actions.join('')}</div>
    <div class="section">
      <h3>เส้นทาง · ${b.route.length} จุดแวะ</h3>
      <div id="routeChips"></div>
      ${modify}
      ${msgBox(ui.routeMsg)}
      <form class="row" id="fStopSearch">
        <select id="stopCode" aria-label="สถานีที่จะค้นหา">${stationOptions(ui.stopSearch?.station)}</select>
        <button>รถคันนี้ผ่านสถานีนี้ไหม</button>
      </form>
      ${ui.stopSearch ? msgBox(ui.stopSearch.positions.length
        ? { cls: 'ok', text: `ผ่าน ${stationName(ui.stopSearch.station)} ที่จุดแวะที่ ${ui.stopSearch.positions.join(', ')}` }
        : { text: `ไม่ผ่าน ${stationName(ui.stopSearch.station)}` }) : ''}
    </div>`;
}

export function updateFleet(root) {
  patch($('#busList', root), busListHTML());
  const detail = $('#busDetail', root);
  const b = selectedBus();
  const ui = state.ui;
  const sig = b ? [b.name, b.status, b.pendingModify, b.route.join(','), ui.confirmDelete, JSON.stringify(ui.routeMsg), JSON.stringify(ui.stopSearch)].join('|') : 'none';
  if (sig !== detailSig) {
    detailSig = sig;
    detail.innerHTML = b ? detailHTML(b) : '<div class="waiting">เลือกรถจากรายการหรือคลิกรถบนแผนที่</div>';
  }
  if (b) {
    patch($('#detailLive', root), detailLiveHTML(b));
    patch($('#routeChips', root), routeChipsHTML(b));
  }
}

export function mountFleetEvents(root, { onFocusBus }) {
  root.addEventListener('pointerdown', e => {
    const row = e.target.closest('[data-pick]');
    if (row) { selectBus(row.dataset.pick); onFocusBus(row.dataset.pick); }
  });
  root.addEventListener('keydown', e => {
    const row = e.target.closest('[data-pick]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectBus(row.dataset.pick); onFocusBus(row.dataset.pick); }
  });

  root.addEventListener('submit', async e => {
    if (state.ui.tab !== 'fleet') return;
    e.preventDefault();
    const b = selectedBus();
    if (e.target.id === 'fSearch') {
      const q = $('#qName', root).value.trim();
      if (!q) return;
      const r = await run(() => api.searchBus(q));
      if (!r) return;
      if (r.found) { setUI({ searchMsg: { cls: 'ok', text: `พบ ${r.bus.name}` } }); selectBus(r.bus.name); onFocusBus(r.bus.name); }
      else setUI({ searchMsg: { cls: 'err', text: `ไม่พบรถชื่อ "${q}"` } });
    }
    if (e.target.id === 'fStopSearch' && b) {
      const r = await run(() => api.searchStop(b.name, $('#stopCode', root).value));
      if (r) setUI({ stopSearch: { station: r.station, positions: r.positions } });
    }
    if (e.target.id === 'fInsert' && b) {
      const station = $('#insStation', root).value, after = Number($('#insAfter', root).value);
      try { await api.insertStop(b.name, after, station); setUI({ routeMsg: { cls: 'ok', text: `เพิ่ม ${stationName(station)} หลังจุดแวะที่ ${after + 1} แล้ว` } }); }
      catch (err) { setUI({ routeMsg: { cls: 'err', text: err.message } }); }
    }
  });

  root.addEventListener('click', async e => {
    if (state.ui.tab !== 'fleet') return;
    const b = selectedBus();
    if (!b) return;
    const del = e.target.closest('[data-del]');
    if (del) {
      try { await api.deleteStop(b.name, Number(del.dataset.del)); setUI({ routeMsg: { cls: 'ok', text: 'ลบจุดแวะแล้ว' } }); }
      catch (err) { setUI({ routeMsg: { cls: 'err', text: err.message } }); }
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    switch (act) {
      case 'breakdown': run(() => api.breakdown(b.name), `${b.name} หยุดรถ — สถานะรถเสีย`); break;
      case 'repair':    run(() => api.repair(b.name), `${b.name} เดินทางต่อ`); break;
      case 'modify':    run(() => api.modify(b.name)); setUI({ routeMsg: null }); break;
      case 'resume':
        try { await api.resume(b.name); setUI({ routeMsg: { cls: 'ok', text: 'เส้นทางถูกต้อง กลับมาเดินรถแล้ว' } }); }
        catch (err) { setUI({ routeMsg: { cls: 'err', text: err.message } }); }
        break;
      case 'retire':        run(() => api.retire(b.name), `${b.name} ปลดระวางแล้ว`); break;
      case 'removeAsk':     setUI({ confirmDelete: true }); break;
      case 'removeCancel':  setUI({ confirmDelete: false }); break;
      case 'removeConfirm': {
        const ok = await run(() => api.remove(b.name), `ลบ ${b.name} ออกจากระบบแล้ว`);
        if (ok) setUI({ selected: null, confirmDelete: false });
        break;
      }
    }
  });
}
