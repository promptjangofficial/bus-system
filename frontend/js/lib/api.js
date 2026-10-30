// Phase 6 — ตัวเรียก Backend API (ทุกการติดต่อเซิร์ฟเวอร์อยู่ในไฟล์นี้)
import { API_BASE } from '../config.js';

async function req(method, path, body, headers = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `เซิร์ฟเวอร์ตอบกลับ ${res.status}`);
  return data;
}
const enc = encodeURIComponent;

export const api = {
  network:      () => req('GET', '/api/network'),
  stations:     () => req('GET', '/api/stations'),
  roads:        () => req('GET', '/api/roads'),
  arrivals:     code => req('GET', `/api/stations/${enc(code)}/arrivals`),
  validateRoute: route => req('POST', '/api/routes/validate', { route }),

  searchBus:    name => req('GET', `/api/buses/search?name=${enc(name)}`),
  structures:   () => req('GET', '/api/structures'),
  createBus:    bus => req('POST', '/api/buses', bus),
  retire:       name => req('POST', `/api/buses/${enc(name)}/retire`, {}),
  remove:       name => req('DELETE', `/api/buses/${enc(name)}`, { confirm: name }),
  breakdown:    name => req('POST', `/api/buses/${enc(name)}/breakdown`, {}),
  repair:       name => req('POST', `/api/buses/${enc(name)}/repair`, {}),
  modify:       name => req('POST', `/api/buses/${enc(name)}/modify`, {}),
  resume:       name => req('POST', `/api/buses/${enc(name)}/resume`, {}),
  insertStop:   (name, after, station) => req('POST', `/api/buses/${enc(name)}/stops`, { after, station }),
  deleteStop:   (name, index) => req('DELETE', `/api/buses/${enc(name)}/stops/${index}`, {}),
  searchStop:   (name, station) => req('GET', `/api/buses/${enc(name)}/stops/search?station=${enc(station)}`),

  setSim:       patch => req('POST', '/api/sim', patch),
  resetSim:     () => req('POST', '/api/sim/reset', {}),

  ingest:       (payload, key) => req('POST', '/api/devices/ingest', payload, key ? { 'X-Device-Key': key } : {}),
  deviceUrl:    () => `${location.origin}${API_BASE}/api/devices/ingest`,
};

export function openStream(onSnapshot, onConnection) {
  const es = new EventSource(API_BASE + '/api/stream');
  es.onopen = () => onConnection(true);
  es.onerror = () => onConnection(false);
  es.onmessage = e => { try { onSnapshot(JSON.parse(e.data)); } catch { /* ข้ามข้อมูลเสีย */ } };
  return es;
}
