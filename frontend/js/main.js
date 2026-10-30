// Phase 6 — จุดเริ่มหน้าจอ: โหลดข้อมูล → ต่อสตรีม → ผูกแผงต่างๆ
import { state, subscribe, emit, setUI, selectedBus, busColor, busOf } from './store.js';
import { api, openStream } from './lib/api.js';
import { TABS } from './content/texts.js';
import { createMapView } from './map/map-view.js';
import { mountHeader, updateHeader } from './ui/header.js';
import { updateEventLog } from './ui/event-log.js';
import { mountStationCard, updateStationCard, syncStation } from './ui/station-card.js';
import { updateRider, mountRiderEvents } from './ui/rider-sheet.js';
import { updateAlerts } from './ui/alert-bar.js';
import { renderFleet, updateFleet, mountFleetEvents, selectBus } from './ui/fleet-panel.js';
import { renderAdd, mountAddEvents, addStop } from './ui/add-panel.js';
import { renderDevices, updateDevices, mountDeviceEvents } from './ui/device-panel.js';
import { renderDs, updateDs, mountDsEvents } from './ui/ds-panel.js';
import { toast } from './ui/common.js';
import { mountSheet } from './ui/sheet.js';
import { currentTheme, applyTheme, saveTheme, watchSystemTheme } from './lib/theme.js';
import { getPref, setPref, currentLayout, watchLayout, isLandscape } from './lib/prefs.js';
import { PANEL } from './content/texts.js';

const el = {
  header: document.getElementById('header'),
  tabs: document.getElementById('tabs'),
  body: document.getElementById('panelBody'),
  card: document.getElementById('stationCard'),
  log: document.getElementById('eventLog'),
  sheet: document.getElementById('riderSheet'),
  alerts: document.getElementById('alertBar'),
  panelToggle: document.getElementById('panelToggle'),
  logBar: document.getElementById('logBar'),
  main: document.getElementById('appMain'),
};

const sheet = mountSheet(el.main, { isActive: () => currentLayout() === 'phone' });

const PANELS = {
  fleet:   { render: renderFleet,   update: updateFleet },
  add:     { render: renderAdd,     update: () => {} },
  devices: { render: renderDevices, update: updateDevices },
  ds:      { render: renderDs,      update: updateDs },
};

const focusBus = name => { const b = busOf(name); if (b?.lat != null) mapView.focus(b.lat, b.lng, sheet.height()); };

const rider = () => state.ui.view === 'rider';
const adding = () => !rider() && state.ui.tab === 'add';

const mapView = createMapView(document.getElementById('map'), {
  onStationClick: code => {
    if (adding()) return addStop(code);
    setUI({ station: state.ui.station === code ? null : code, ...(rider() ? { selected: null } : {}) });
  },
  onBusClick: name => {
    if (rider()) return setUI({ selected: name, station: null, searchMsg: null });
    if (state.ui.tab !== 'fleet') state.ui.tab = 'fleet';
    selectBus(name);
  },
});

// สลับมุมมอง: ผู้โดยสารเริ่มจากรายการรถทุกสาย · ศูนย์ควบคุมเลือกรถคันแรกไว้ให้
function setView(view) {
  const firstBus = () => state.snap?.buses.find(b => b.status !== 'RETIRED')?.name || null;
  state.ui.view = view;
  document.body.dataset.view = view;
  Object.assign(state.ui, view === 'rider'
    ? { selected: null, station: null, searchMsg: null }
    : { selected: state.ui.selected || firstBus(), searchMsg: null });
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  history.replaceState(null, '', url);
  emit('ui');
}

// สลับธีม: เปลี่ยนตัวแปร CSS แล้ววาดใหม่ทั้งหน้า (สีเส้นทาง/หมุดรถบนแผนที่ขึ้นกับธีม)
function setTheme(theme, save = false) {
  if (save) saveTheme(theme);
  applyTheme(theme);
  state.ui.theme = theme;
  emit('ui');
}

// แผงข้างซ่อนได้ (PC/แท็บเล็ต) · จำแยกตามขนาดจอ · ไม่เคยเลือก: PC และแท็บเล็ตแนวนอนเปิดไว้
function setPanel(open, save = false) {
  if (save) setPref('panel-' + currentLayout(), open ? 'open' : 'closed');
  state.ui.panelOpen = open;
  document.body.dataset.panel = open ? 'open' : 'closed';
  const t = PANEL[open ? 'hide' : 'show'];
  Object.assign(el.panelToggle, { textContent: t.icon, title: t.label });
  el.panelToggle.setAttribute('aria-label', t.label);
  el.panelToggle.setAttribute('aria-expanded', String(open));
}
// บันทึกเหตุการณ์ยุบได้ · ไม่เคยเลือก: มือถือยุบไว้ นอกนั้นเปิด
function setLog(open, save = false) {
  if (save) setPref('log-' + currentLayout(), open ? 'open' : 'closed');
  state.ui.logOpen = open;
  document.body.dataset.log = open ? 'open' : 'closed';
  updateEventLog(el.log, el.logBar);
}
function restoreLayout() {
  const panel = getPref('panel-' + currentLayout()), log = getPref('log-' + currentLayout());
  setPanel(panel ? panel === 'open' : currentLayout() === 'pc' || isLandscape());
  setLog(log ? log === 'open' : currentLayout() !== 'phone');
  sheet.apply();
}

let routeKey = null, linesKey = null;
function syncMapRoute() {
  const ui = state.ui;
  const active = (state.snap?.buses || []).filter(b => b.status !== 'RETIRED');
  const lk = ui.theme + '|' + active.map(b => b.name + ':' + b.route.join(',')).join('|');
  if (lk !== linesKey) { linesKey = lk; mapView.drawLines(active.map(b => ({ route: b.route, color: busColor(b.name) }))); }
  let key, draw;
  if (adding()) {
    key = ui.theme + '|draft|' + ui.builder.join(',') + '|' + ui.builderIssues.map(i => i.segment).join(',');
    draw = () => mapView.drawRoute(ui.builder, getComputedStyle(document.documentElement).getPropertyValue('--route-draft').trim(),
      { draft: true, badSegments: ui.builderIssues.map(i => i.segment) });
  } else {
    const b = selectedBus();
    key = ui.theme + '|' + (b && b.status !== 'RETIRED' ? 'bus|' + b.name + '|' + b.route.join(',') : 'none');
    draw = () => mapView.drawRoute(b && b.status !== 'RETIRED' ? b.route : null, b ? busColor(b.name) : null);
  }
  if (key !== routeKey) { routeKey = key; draw(); }
  mapView.markStations(ui.station, adding() ? ui.builder : []);
}

function renderTabs() {
  el.tabs.innerHTML = TABS.map(([k, label]) =>
    `<button role="tab" data-tab="${k}" aria-selected="${state.ui.tab === k}">${label}</button>`).join('');
}

subscribe(kind => {
  syncStation();
  if (rider()) {
    updateRider(el.sheet);
    el.card.hidden = true;
  } else {
    const panel = PANELS[state.ui.tab];
    if (kind === 'ui') { renderTabs(); panel.render(el.body); }
    else panel.update(el.body);
    updateEventLog(el.log, el.logBar);
    updateStationCard(el.card);
  }
  updateHeader();
  updateAlerts(el.alerts);
  mapView.updateBuses(state.snap?.buses || [], state.ui.selected, state.ui.theme);
  syncMapRoute();
});

el.tabs.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) setUI({ tab: t.dataset.tab, station: t.dataset.tab === 'add' ? null : state.ui.station });
});

el.panelToggle.addEventListener('click', e => {
  if (e.target.closest('[data-act="panelToggle"]')) setPanel(!state.ui.panelOpen, true);
});
document.addEventListener('keydown', e => {
  // ใช้ตำแหน่งปุ่ม ไม่ใช่ตัวอักษร (แป้นไทยปุ่มนี้คือ บ)
  if (e.code !== 'BracketLeft' || e.ctrlKey || e.metaKey || e.altKey || rider() || currentLayout() === 'phone') return;
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  setPanel(!state.ui.panelOpen, true);
});

el.logBar.addEventListener('click', e => {
  if (e.target.closest('[data-act="logToggle"]')) setLog(!state.ui.logOpen, true);
});

el.alerts.addEventListener('click', e => {
  const t = e.target.closest('[data-act="alertPick"]');
  if (!t) return;
  state.ui.tab = 'fleet';
  selectBus(t.dataset.bus);
  focusBus(t.dataset.bus);
});

mountHeader(el.header, { onView: setView, onTheme: theme => setTheme(theme, true) });
state.ui.theme = currentTheme();
applyTheme(state.ui.theme);
watchSystemTheme(theme => setTheme(theme));
restoreLayout();
watchLayout(restoreLayout);
mountRiderEvents(el.sheet, { onFocusBus: focusBus });
mountStationCard(el.card);
mountFleetEvents(el.body, { onFocusBus: focusBus });
mountAddEvents(el.body, { onCreated: name => { setUI({ tab: 'fleet' }); selectBus(name); } });
mountDeviceEvents(el.body);
mountDsEvents(el.body);

async function boot() {
  try {
    const [network, stations, roads] = await Promise.all([api.network(), api.stations(), api.roads()]);
    Object.assign(state, { network, stations, roads });
  } catch (err) {
    toast('โหลดข้อมูลแผนที่ไม่สำเร็จ: ' + err.message, true);
  }
  const asked = new URLSearchParams(location.search).get('view');
  state.ui.view = ['rider', 'control'].includes(asked) ? asked : currentLayout() === 'phone' ? 'rider' : 'control';
  document.body.dataset.view = state.ui.view;
  mapView.drawNetwork({ bottomInset: sheet.height() });
  emit('ui');
  openStream(
    snap => {
      const first = !state.snap;
      state.snap = snap;
      if (first && !rider() && !state.ui.selected) state.ui.selected = snap.buses.find(b => b.status !== 'RETIRED')?.name || null;
      if (state.ui.selected && !busOf(state.ui.selected)) state.ui.selected = null;
      emit(first ? 'ui' : 'snap');
    },
    on => { state.connected = on; updateHeader(); },
  );
}
boot();
