// Phase 4 — การอ่าน/เขียนไฟล์ข้อมูล (ที่เดียวที่แตะไฟล์ใน data/)

const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RUNTIME_DIR = config.RUNTIME_DIR;
const FILES = {
  stations:  path.join(DATA_DIR, 'stations.json'),
  roads:     path.join(DATA_DIR, 'roads.json'),
  seedBuses: path.join(DATA_DIR, 'seed-buses.json'),
  buses:     path.join(RUNTIME_DIR, 'buses.json'),
  roadCache: path.join(RUNTIME_DIR, 'road-cache.json'),
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

let saveTimer = null;

module.exports = {
  loadStations:  () => readJson(FILES.stations, []),
  loadRoads:     () => readJson(FILES.roads, []),
  loadSeedBuses: () => readJson(FILES.seedBuses, []),
  loadSavedBuses:() => readJson(FILES.buses, null),
  loadRoadCache: () => readJson(FILES.roadCache, {}),
  saveRoadCache(cache) {
    try { writeJsonAtomic(FILES.roadCache, cache); }
    catch (err) { console.error(`บันทึกแคชถนนไม่สำเร็จ: ${err.message}`); }
  },

  // บันทึกรถแบบหน่วงเวลา รวมหลายการเปลี่ยนแปลงเป็นการเขียนครั้งเดียว
  saveBuses(records) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { writeJsonAtomic(FILES.buses, records); }
      catch (err) { console.error(`บันทึกข้อมูลรถไม่สำเร็จ: ${err.message}`); }
    }, 300);
  },
  clearSavedBuses() {
    clearTimeout(saveTimer);
    try { fs.unlinkSync(FILES.buses); } catch { /* ไม่มีไฟล์ก็ไม่เป็นไร */ }
  },
};
