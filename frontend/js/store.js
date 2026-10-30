// Phase 6 — สถานะฝั่งหน้าจอ
import { BUS_COLORS, LINE_COLORS, BUS_COLORS_DARK, LINE_COLORS_DARK } from './config.js';

export const state = {
  network: null, stations: [], roads: [], snap: null, connected: false,
  ui: {
    view: 'control', theme: 'light', tab: 'fleet', selected: null, station: null,
    builder: [], builderIssues: [],
    searchMsg: null, routeMsg: null, stopSearch: null, addMsg: null, devMsg: null,
    confirmDelete: false, confirmReset: false,
  },
};

const listeners = new Set();
export const subscribe = fn => listeners.add(fn);
export const emit = kind => listeners.forEach(fn => fn(kind));   // 'ui' = โครงหน้าเปลี่ยน, 'snap' = ข้อมูลสด

export function setUI(patch) { Object.assign(state.ui, patch); emit('ui'); }

export const stationOf = code => state.stations.find(s => s.code === code);
export const stationName = code => stationOf(code)?.name || code;
export const buses = () => state.snap?.buses || [];
export const busOf = name => buses().find(b => b.name === name) || null;
export const selectedBus = () => busOf(state.ui.selected);

export function roadGeometry(u, v) {
  for (const r of state.roads) {
    if (r.from === u && r.to === v) return r.geometry;
    if (r.from === v && r.to === u) return [...r.geometry].reverse();
  }
  return null;
}

// สีรถตามธีมปัจจุบัน (เส้นบนแผนที่เป็น SVG ใช้ตัวแปร CSS ไม่ได้ จึงคืนค่าสีจริง)
export function busColor(name, theme = state.ui.theme) {
  const [lines, pool] = theme === 'dark' ? [LINE_COLORS_DARK, BUS_COLORS_DARK] : [LINE_COLORS, BUS_COLORS];
  if (lines[name]) return lines[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return pool[h % pool.length];
}
