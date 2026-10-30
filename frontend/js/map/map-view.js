// Phase 6 — แผนที่ (Leaflet + OpenStreetMap)
import { MAP } from '../config.js';
import { state, roadGeometry, busColor } from '../store.js';
import { esc } from '../lib/format.js';

const BUS_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.6"><rect x="3" y="2.5" width="10" height="9" rx="2"/><path d="M3 7.5h10M5.5 13.5v-2M10.5 13.5v-2"/></svg>';

export function createMapView(el, { onStationClick, onBusClick }) {
  const map = L.map(el, { zoomControl: false }).setView(MAP.center, MAP.zoom);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(MAP.tiles, { maxZoom: 19, subdomains: MAP.subdomains, attribution: MAP.attribution }).addTo(map);

  const roadLayer = L.layerGroup().addTo(map);
  const linesLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const stationLayer = L.layerGroup().addTo(map);
  const busLayer = L.layerGroup().addTo(map);
  const stationMarkers = new Map();
  const busMarkers = new Map();
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function drawNetwork() {
    roadLayer.clearLayers();
    stationLayer.clearLayers();
    stationMarkers.clear();
    for (const r of state.roads) {
      L.polyline(r.geometry, { color: css('--road'), weight: 2.5, opacity: .7, dashArray: '1 5', lineCap: 'round', interactive: false }).addTo(roadLayer);
    }
    for (const s of state.stations) {
      const m = L.marker([s.lat, s.lng], { icon: stationIcon(s, ''), keyboard: true, title: s.name, zIndexOffset: 100 })
        .bindTooltip(esc(s.name), { direction: 'top', offset: [0, -12] })
        .on('click', () => onStationClick(s.code))
        .addTo(stationLayer);
      stationMarkers.set(s.code, { m, key: '' });
    }
    if (state.stations.length) map.fitBounds(state.stations.map(s => [s.lat, s.lng]), { padding: [40, 40] });
  }

  function stationIcon(s, cls) {
    return L.divIcon({ className: 'st-icon', html: `<div class="st-pin ${cls}">${esc(s.code)}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
  }

  function markStations(selected, draft) {
    for (const s of state.stations) {
      const entry = stationMarkers.get(s.code);
      const cls = draft.includes(s.code) ? 'is-draft' : s.code === selected ? 'is-sel' : '';
      if (entry && entry.key !== cls) { entry.m.setIcon(stationIcon(s, cls)); entry.key = cls; }
    }
  }

  const segmentLine = (u, v) => {
    const geom = roadGeometry(u, v);
    if (geom) return geom;
    const a = state.stations.find(s => s.code === u), b = state.stations.find(s => s.code === v);
    return [[a.lat, a.lng], [b.lat, b.lng]];
  };

  // ทุกสายแบบจาง ให้แผนที่อ่านเหมือนผังรถประจำทาง
  function drawLines(list) {
    linesLayer.clearLayers();
    for (const { route, color } of list) {
      route.forEach((u, i) => L.polyline(segmentLine(u, route[(i + 1) % route.length]),
        { color, weight: 3.5, opacity: .4, lineCap: 'round', interactive: false }).addTo(linesLayer));
    }
  }

  // เส้นทางของรถที่เลือก หรือเส้นทางร่างตอนเพิ่มรถ
  function drawRoute(codes, color, { draft = false, badSegments = [] } = {}) {
    routeLayer.clearLayers();
    if (!codes || codes.length < 2) return;
    codes.forEach((u, i) => {
      const v = codes[(i + 1) % codes.length];
      const bad = badSegments.includes(i) || !roadGeometry(u, v);
      const line = segmentLine(u, v);
      // ขอบขาวรองใต้เส้นสี ให้อ่านออกบนแผนที่ทุกโทน
      if (!bad) L.polyline(line, { color: '#fff', weight: 10, opacity: .9, interactive: false }).addTo(routeLayer);
      L.polyline(line, {
        color: bad ? css('--st-broken') : color, weight: bad ? 4 : 6, opacity: 1, lineCap: 'round', lineJoin: 'round',
        dashArray: bad || draft ? '2 9' : null, interactive: false,
      }).addTo(routeLayer);
    });
  }

  function busIcon(b, selected) {
    const live = b.positionSource === 'gps';
    return L.divIcon({
      className: 'bus-icon',
      html: `<div class="bus-pin st-${b.status}${selected ? ' is-sel' : ''}" style="--c:${busColor(b.name)}">${BUS_SVG}<span>${esc(b.name)}</span>${live ? '<span class="gps" title="GPS จริง"></span>' : ''}</div>`,
      iconSize: [0, 0], iconAnchor: [0, 0],
    });
  }

  function updateBuses(list, selected) {
    const seen = new Set();
    for (const b of list) {
      if (b.status === 'RETIRED' || b.lat == null) continue;
      seen.add(b.name);
      const key = `${b.status}|${b.name === selected}|${b.positionSource}`;
      let entry = busMarkers.get(b.name);
      if (!entry) {
        const m = L.marker([b.lat, b.lng], { icon: busIcon(b, b.name === selected), zIndexOffset: 1000, title: b.name })
          .on('click', () => onBusClick(b.name)).addTo(busLayer);
        entry = { m, key };
        busMarkers.set(b.name, entry);
      } else {
        entry.m.setLatLng([b.lat, b.lng]);
        if (entry.key !== key) { entry.m.setIcon(busIcon(b, b.name === selected)); entry.key = key; }
      }
    }
    for (const [name, entry] of busMarkers) {
      if (!seen.has(name)) { busLayer.removeLayer(entry.m); busMarkers.delete(name); }
    }
  }

  return {
    drawNetwork, drawLines, drawRoute, markStations, updateBuses,
    focus: (lat, lng) => map.panTo([lat, lng]),
    invalidate: () => map.invalidateSize(),
  };
}
