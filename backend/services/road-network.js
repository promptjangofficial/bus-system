// Phase 4 — สร้าง Graph จากข้อมูลสถานี + ถนน
// ลำดับแหล่งข้อมูล: แคช → OSRM (ถนนจริง) → เส้นตรง × ROAD_FACTOR

const config = require('../config');
const storage = require('./storage');
const osrm = require('../integrations/osrm');
const { Graph } = require('../core/graph');
const { haversineKm } = require('../core/geo');

function straightRoad(a, b) {
  return {
    km: Math.max(config.MIN_ROAD_KM, Math.round(haversineKm(a, b) * config.ROAD_FACTOR * 10) / 10),
    geometry: [[a.lat, a.lng], [b.lat, b.lng]],
    source: 'estimate',
  };
}

async function buildGraph(logger = console) {
  const graph = new Graph();
  storage.loadStations().forEach(s => graph.addStation(s));

  const cache = storage.loadRoadCache();
  let cacheChanged = false;
  let osrmOk = config.USE_OSRM;

  for (const [u, v] of storage.loadRoads()) {
    const a = graph.station(u), b = graph.station(v);
    if (!a || !b) { logger.warn(`ข้ามถนน ${u}-${v}: ไม่มีสถานี`); continue; }
    const key = `${u}|${v}|${a.lat},${a.lng}|${b.lat},${b.lng}`;
    let road = cache[key];
    if (!road && osrmOk) {
      try {
        road = await osrm.fetchRoad(a, b);
        cache[key] = road;
        cacheChanged = true;
      } catch (err) {
        logger.warn(`ดึงเส้นถนนจาก OSRM ไม่ได้ (${err.message}) — ใช้ระยะประมาณแทน`);
        osrmOk = false;   // ไม่ลองซ้ำทุกเส้นเมื่อออฟไลน์
      }
    }
    if (road && !(road.km >= config.MIN_ROAD_KM)) road = { ...road, km: config.MIN_ROAD_KM };
    graph.addRoad(u, v, road || straightRoad(a, b));
  }
  if (cacheChanged) storage.saveRoadCache(cache);

  const roads = graph.roads();
  const meta = {
    source: roads.every(r => r.source === 'osrm') ? 'osrm'
          : roads.some(r => r.source === 'osrm') ? 'mixed' : 'estimate',
    roads: roads.length,
    stations: graph.stations.size,
  };
  logger.log(`เครือข่ายถนน: ${meta.stations} สถานี ${meta.roads} ถนน (แหล่งข้อมูล: ${meta.source})`);
  return { graph, meta };
}

module.exports = { buildGraph };
