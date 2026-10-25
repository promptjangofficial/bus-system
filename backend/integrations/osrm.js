// Phase 3 — API ภายนอก: OSRM (Open Source Routing Machine)
// ดึงระยะทางถนนจริงและเส้นถนนระหว่างสองสถานี

const config = require('../config');

async function fetchRoad(from, to) {
  const url = `${config.OSRM_URL}/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.OSRM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'phitsanulok-bus-system/1.0' } });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const r = data.routes?.[0];
    if (data.code !== 'Ok' || !r) throw new Error(`OSRM ${data.code || 'no route'}`);
    return {
      km: Math.max(config.MIN_ROAD_KM, Math.round(r.distance / 100) / 10),
      geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      source: 'osrm',
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchRoad };
