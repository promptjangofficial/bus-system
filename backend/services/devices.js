// Phase 4 — รับข้อมูลจากอุปกรณ์ติดรถ
// ยังไม่ติดอุปกรณ์: ฟังก์ชันพร้อมใช้ รอแค่ข้อมูลส่งเข้ามา
//   gps       → ตำแหน่งจริง, ตรวจถึงสถานีอัตโนมัติ (geofence), ETA จากความเร็วจริง
//   passenger → จำนวนผู้โดยสาร / เกินความจุ
//   engine    → แจ้งรถเสียอัตโนมัติ

const config = require('../config');
const { LOG, AppError } = require('../config/messages');
const { STATUS } = require('./fleet');
const { metersBetween, projectOnPolyline } = require('../core/geo');

const num = v => typeof v === 'number' && Number.isFinite(v);

class DeviceGateway {
  constructor({ fleet, sim, log }) {
    this.fleet = fleet;
    this.sim = sim;
    this.log = log;
  }

  checkKey(key) {
    if (config.DEVICE_API_KEY && key !== config.DEVICE_API_KEY) throw new AppError('DEVICE_KEY', {}, 401);
  }

  ingest(payload) {
    if (Array.isArray(payload)) return payload.map(p => this.ingestOne(p));
    return this.ingestOne(payload);
  }

  ingestOne(p) {
    if (!p || typeof p !== 'object') throw new AppError('BAD_JSON');
    if (!p.bus) throw new AppError('DEVICE_FIELD', { field: 'bus' });
    const bus = this.fleet.get(p.bus);
    const now = Date.now();
    switch (p.type) {
      case 'gps': {
        if (!num(p.lat) || !num(p.lng)) throw new AppError('DEVICE_FIELD', { field: 'lat, lng' });
        bus.device.gps = { lat: p.lat, lng: p.lng, speedKmh: num(p.speedKmh) ? p.speedKmh : 0, receivedAt: now };
        this.applyGps(bus);
        break;
      }
      case 'passenger': {
        if (!num(p.count) || p.count < 0) throw new AppError('DEVICE_FIELD', { field: 'count' });
        bus.device.passengers = { count: Math.round(p.count), receivedAt: now };
        if (p.count > bus.capacity) this.log.add(LOG.overCapacity(bus.name, p.count, bus.capacity));
        break;
      }
      case 'engine': {
        bus.device.engine = { fault: !!p.fault, code: String(p.code || ''), receivedAt: now };
        if (p.fault && bus.status !== STATUS.RETIRED) this.fleet.breakdown(bus, LOG.engineFault(bus.device.engine.code));
        break;
      }
      default:
        throw new AppError('BAD_DEVICE_TYPE', { type: p.type });
    }
    return { ok: true, bus: bus.name, type: p.type };
  }

  applyGps(bus) {
    if (bus.status === STATUS.RETIRED || bus.status === STATUS.MODIFYING) return;
    const dev = bus.device;
    const P = { lat: dev.gps.lat, lng: dev.gps.lng };
    if (!dev.wasLive) { dev.wasLive = true; this.log.add(LOG.gpsStart(bus.name)); }

    const seg = this.sim.segment(bus);
    const A = this.fleet.graph.station(seg.from);
    const B = this.fleet.graph.station(seg.to);

    // ถึงสถานีถัดไป → เลื่อน current
    if (metersBetween(P, B) < config.GEOFENCE_M) {
      if (bus.status !== STATUS.BROKEN && !(bus.status === STATUS.AT_STATION && seg.from === B.code)) this.sim.arrive(bus);
      dev.live = { frac: 0, offM: 0 };
      return;
    }
    const pr = projectOnPolyline(seg.edge.geometry, P);
    dev.live = { frac: pr.frac, offM: pr.offM };
    bus.progressKm = pr.frac * seg.edge.km;

    if (bus.status === STATUS.BROKEN) return;
    const atStart = metersBetween(P, A) < config.GEOFENCE_M && dev.gps.speedKmh < 3;
    const next = atStart ? STATUS.AT_STATION : STATUS.MOVING;
    if (next !== bus.status) {
      if (next === STATUS.MOVING) this.log.add(LOG.departed(bus.name, A.name, B.name));
      bus.status = next;
    }
    if (bus.status === STATUS.AT_STATION && bus.pendingModify) this.sim.enterModify(bus);
  }

  status() {
    return this.fleet.list().map(b => {
      const v = this.sim.view(b);
      return { bus: b.name, ...v.device };
    });
  }
}

module.exports = { DeviceGateway };
