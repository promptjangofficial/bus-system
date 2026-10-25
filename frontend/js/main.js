// Phase 6 — จุดเริ่มหน้าจอ: โหลดข้อมูล → ต่อสตรีม → ผูกแผงต่างๆ
import { state, subscribe, emit, setUI, selectedBus, busColor, busOf } from './store.js';
import { api, openStream } from './lib/api.js';
import { TABS } from './content/texts.js';
import { createMapView } from './map/map-view.js';
import { mountHeader, updateHeader } from './ui/header.js';
import { updateEventLog } from './ui/event-log.js';
import { mountStationCard, updateStationCard } from './ui/station-card.js';
import { renderFleet, updateFleet, mountFleetEvents, selectBus } from './ui/fleet-panel.js';
import { renderAdd, mountAddEvents, addStop } from './ui/add-panel.js';
import { renderDevices, updateDevices, mountDeviceEvents } from './ui/device-panel.js';
import { toast } from './ui/common.js';

const el = {
  header: document.getElementById('header'),
  tabs: document.getElementById('tabs'),
  body: document.getElementById('panelBody'),
  card: document.getElementById('stationCard'),
  log: document.getElementById('eventLog'),
};

const PANELS = {
  fleet:   { render: renderFleet,   update: updateFleet },
  add:     { render: renderAdd,     update: () => {} },
  devices: { render: renderDevices, update: updateDevices },
};

const focusBus = name => { const b = busOf(name); if (b?.lat != null) mapView.focus(b.lat, b.lng); };

const mapView = createMapView(document.getElementById('map'), {
  onStationClick: code => {
    if (state.ui.tab === 'add') return addStop(code);
    setUI({ station: state.ui.station === code ? null : code });
  },
  onBusClick: name => { if (state.ui.tab !== 'fleet') state.ui.tab = 'fleet'; selectBus(name); },
});

let routeKey = null;
function syncMapRoute() {
  const ui = state.ui;
  let key, draw;
  if (ui.tab === 'add') {
    key = 'draft|' + ui.builder.join(',') + '|' + ui.builderIssues.map(i => i.segment).join(',');
    draw = () => mapView.drawRoute(ui.builder, getComputedStyle(document.documentElement).getPropertyValue('--route-draft').trim(),
      { draft: true, badSegments: ui.builderIssues.map(i => i.segment) });
  } else {
    const b = selectedBus();
    key = b && b.status !== 'RETIRED' ? 'bus|' + b.name + '|' + b.route.join(',') : 'none';
    draw = () => mapView.drawRoute(b && b.status !== 'RETIRED' ? b.route : null, b ? busColor(b.name) : null);
  }
  if (key !== routeKey) { routeKey = key; draw(); }
  mapView.markStations(ui.station, ui.tab === 'add' ? ui.builder : []);
}

function renderTabs() {
  el.tabs.innerHTML = TABS.map(([k, label]) =>
    `<button role="tab" data-tab="${k}" aria-selected="${state.ui.tab === k}">${label}</button>`).join('');
}

subscribe(kind => {
  const panel = PANELS[state.ui.tab];
  if (kind === 'ui') { renderTabs(); panel.render(el.body); }
  else panel.update(el.body);
  updateHeader();
  updateEventLog(el.log);
  updateStationCard(el.card);
  mapView.updateBuses(state.snap?.buses || [], state.ui.selected);
  syncMapRoute();
});

el.tabs.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) setUI({ tab: t.dataset.tab, station: t.dataset.tab === 'add' ? null : state.ui.station });
});

mountHeader(el.header);
mountStationCard(el.card);
mountFleetEvents(el.body, { onFocusBus: focusBus });
mountAddEvents(el.body, { onCreated: name => { setUI({ tab: 'fleet' }); selectBus(name); } });
mountDeviceEvents(el.body);

async function boot() {
  try {
    const [network, stations, roads] = await Promise.all([api.network(), api.stations(), api.roads()]);
    Object.assign(state, { network, stations, roads });
  } catch (err) {
    toast('โหลดข้อมูลแผนที่ไม่สำเร็จ: ' + err.message, true);
  }
  mapView.drawNetwork();
  emit('ui');
  openStream(
    snap => {
      const first = !state.snap;
      state.snap = snap;
      if (first && !state.ui.selected) state.ui.selected = snap.buses.find(b => b.status !== 'RETIRED')?.name || null;
      if (state.ui.selected && !busOf(state.ui.selected)) state.ui.selected = null;
      emit(first ? 'ui' : 'snap');
    },
    on => { state.connected = on; updateHeader(); },
  );
  window.addEventListener('resize', () => mapView.invalidate());
}
boot();
