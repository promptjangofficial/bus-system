// Phase 6 — แผงเพิ่มรถ: ข้อมูลรถ + สร้างเส้นทางด้วยการคลิกสถานี
import { state, setUI, stationName, stationOf, buses } from '../store.js';
import { api } from '../lib/api.js';
import { VALIDATE_DEBOUNCE_MS } from '../config.js';
import { esc } from '../lib/format.js';
import { $, debounce } from '../lib/dom.js';
import { stationOptions, msgBox, toast } from './common.js';

const FORM_IDS = ['fName', 'fPlate', 'fCap', 'fSpeed'];
let draft = { fName: '', fPlate: '', fCap: '30', fSpeed: '30' };

const validate = debounce(async () => {
  const route = state.ui.builder;
  if (route.length < 2) { setUI({ builderIssues: [] }); return; }
  try {
    const r = await api.validateRoute(route);
    if (route === state.ui.builder) setUI({ builderIssues: r.issues });
  } catch (err) { toast(err.message, true); }
}, VALIDATE_DEBOUNCE_MS);

export function addStop(code) {
  setUI({ builder: [...state.ui.builder, code], addMsg: null });
  validate();
}

function builderHTML() {
  const { builder, builderIssues } = state.ui;
  if (!builder.length) return '<div class="waiting">คลิกสถานีบนแผนที่ตามลำดับที่รถจะวิ่ง หรือเลือกจากรายการด้านล่าง</div>';
  const bad = new Set(builderIssues.map(i => i.segment));
  const chips = builder.map((c, i) => `<span class="chip${bad.has(i) ? ' bad' : ''}" title="${esc(stationName(c))}"><span class="ix">${i + 1}</span><b>${esc(c)}</b> ${esc(stationName(c))}</span><span class="arrow">→</span>`).join('');
  const last = builder[builder.length - 1];
  const next = (stationOf(last)?.neighbors || []).map(c => `<b class="mono">${esc(c)}</b> ${esc(stationName(c))}`).join(' · ');
  const status = builder.length < 2 ? { text: 'เลือกอย่างน้อย 2 สถานี' }
    : builderIssues.length ? { cls: 'err', text: builderIssues.map(i => i.message).join(' · ') }
    : { cls: 'ok', text: 'ทุกช่วงมีถนนเชื่อมกัน รวมช่วงวนกลับจุดเริ่มต้น' };
  return `<div class="chips">${chips}<span class="arrow">↺ กลับ ${esc(builder[0])}</span></div>
    ${msgBox(status)}
    <div class="small muted">ต่อจาก ${esc(last)} ได้: ${next || '—'}</div>`;
}

export function renderAdd(root) {
  const first = buses().length === 0;
  const ready = state.ui.builder.length >= 2 && !state.ui.builderIssues.length;
  root.innerHTML = `
    <div class="section">
      <h3>ลงทะเบียนรถใหม่</h3>
      ${first ? '<div class="msg">ยังไม่มีรถในระบบ คันนี้จะเป็นคันแรก</div>' : ''}
      <form id="fAdd" class="form-grid" autocomplete="off">
        <label>ชื่อรถ<input id="fName" required maxlength="20" placeholder="เช่น BUS-04" value="${esc(draft.fName)}"></label>
        <label>ทะเบียน<input id="fPlate" required maxlength="20" placeholder="เช่น 12-3456 พล" value="${esc(draft.fPlate)}"></label>
        <label>ความจุ (ที่นั่ง)<input id="fCap" type="number" min="1" max="200" value="${esc(draft.fCap)}"></label>
        <label>ความเร็วเฉลี่ย (กม./ชม.)<input id="fSpeed" type="number" min="5" max="120" value="${esc(draft.fSpeed)}"></label>
        <div class="full section">
          <h3>เส้นทางเดินรถ</h3>
          ${builderHTML()}
          <div class="row">
            <select id="bSel" aria-label="เลือกสถานี">${stationOptions()}</select>
            <button type="button" data-act="bAdd">เพิ่มสถานี</button>
            <button type="button" data-act="bPop" ${state.ui.builder.length ? '' : 'disabled'}>ลบตัวท้าย</button>
            <button type="button" data-act="bClear" ${state.ui.builder.length ? '' : 'disabled'}>ล้าง</button>
          </div>
        </div>
        <div class="full row"><button class="primary" ${ready ? '' : 'disabled'}>ลงทะเบียนรถ</button></div>
      </form>
      ${msgBox(state.ui.addMsg)}
    </div>`;
}

export function mountAddEvents(root, { onCreated }) {
  root.addEventListener('input', e => { if (FORM_IDS.includes(e.target.id)) draft[e.target.id] = e.target.value; });

  root.addEventListener('click', e => {
    if (state.ui.tab !== 'add') return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'bAdd') addStop($('#bSel', root).value);
    if (act === 'bPop') { setUI({ builder: state.ui.builder.slice(0, -1) }); validate(); }
    if (act === 'bClear') setUI({ builder: [], builderIssues: [] });
  });

  root.addEventListener('submit', async e => {
    if (state.ui.tab !== 'add' || e.target.id !== 'fAdd') return;
    e.preventDefault();
    const bus = {
      name: draft.fName.trim(), plate: draft.fPlate.trim(),
      capacity: Number(draft.fCap), speedKmh: Number(draft.fSpeed), route: state.ui.builder,
    };
    try {
      const created = await api.createBus(bus);
      draft = { fName: '', fPlate: '', fCap: '30', fSpeed: '30' };
      setUI({ builder: [], builderIssues: [], addMsg: null });
      toast(`ลงทะเบียน ${created.name} แล้ว`);
      onCreated(created.name);
    } catch (err) {
      setUI({ addMsg: { cls: 'err', text: err.message } });
    }
  });
}
