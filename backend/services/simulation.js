// Phase 4 — โมเดลจำลองการเดินรถ: นาฬิกาจำลองเดียวกันทุกคัน
// ไม่มี GPS = เดินตามระยะทาง/ความเร็ว · มี GPS สด = ตำแหน่งมาจาก services/devices.js

const config = require('../config');
const { LOG, AppError } = require('../config/messages');
const { STATUS } = require('./fleet');
const { pointAt } = require('../core/geo');

class Simulation {
  constructor({ fleet, graph, log }) {
    this.fleet = fleet;
    this.graph = graph;
    this.log = log;
    this.running = false;
    this.scale = config.DEFAULT_SCALE;
    this.clock = config.START_CLOCK_SEC;
  }

  // ---------- การควบคุม ----------
  setRunning(on) {
    on = !!on;
    if (on === this.running) return;
    this.running = on;
    this.log.add(on ? LOG.simStart() : LOG.simPause());
  }

  setScale(s) {
    s = Number(s);
    if (!config.SCALES.includes(s)) throw new AppError('BAD_SCALE', { allowed: config.SCALES });
    this.scale = s;
    this.log.add(LOG.simSpeed(s));
  }

  resetClock() { this.running = false; this.clock = config.START_CLOCK_SEC; }

  // ---------- ช่วงถนนปัจจุบัน ----------
  segment(bus) {
    const cur = bus.route.current;
    return { from: cur.code, to: cur.next.code, edge: this.graph.edge(cur.code, cur.next.code) };
  }

  isLive(bus) {
    const g = bus.device.gps;
    return !!(g && Date.now() - g.receivedAt < config.LIVE_TTL_MS);
  }

  // ---------- การเดินรถ ----------
  tick(dtRealSec) {
    const dt = this.running ? dtRealSec * this.scale : 0;
    if (this.running) this.clock += dt;
    for (const bus of this.fleet.active()) this.step(bus, dt);
  }

  step(bus, dt) {
    const dev = bus.device;
    if (dev.wasLive && !this.isLive(bus)) {
      dev.wasLive = false;
      dev.live = null;
      this.log.add(LOG.gpsLost(bus.name));
    }
    if (this.isLive(bus) || dt <= 0) return;
    if (bus.status === STATUS.BROKEN || bus.status === STATUS.MODIFYING) return;

    if (bus.status === STATUS.AT_STATION) {
      if (bus.pendingModify) return this.enterModify(bus);
      bus.dwellSec -= dt;
      if (bus.dwellSec <= 0) this.depart(bus);
      return;
    }
    bus.progressKm += bus.speedKmh / 3600 * dt;
    if (bus.progressKm >= this.segment(bus).edge.km) this.arrive(bus);
  }

  depart(bus) {
    const { from, to } = this.segment(bus);
    bus.status = STATUS.MOVING;
    bus.progressKm = 0;
    this.log.add(LOG.departed(bus.name, this.fleet.stationName(from), this.fleet.stationName(to)));
  }

  // ถึงสถานีถัดไป: เลื่อน current → current.next
  arrive(bus) {
    bus.route.advance();
    bus.progressKm = 0;
    bus.status = STATUS.AT_STATION;
    bus.dwellSec = config.DWELL_SEC;
    const here = this.fleet.stationName(bus.route.current.code);
    if (bus.route.current === bus.route.head) {
      bus.laps++;
      this.log.add(LOG.lap(bus.name, bus.laps, here));
    } else {
      this.log.add(LOG.arrived(bus.name, here));
    }
    if (bus.pendingModify) this.enterModify(bus);
  }

  enterModify(bus) {
    bus.pendingModify = false;
    bus.status = STATUS.MODIFYING;
    this.log.add(LOG.modifying(bus.name));
  }

  // ---------- ค่าที่แสดงผล ----------
  fraction(bus) {
    if (this.isLive(bus) && bus.device.live) return bus.device.live.frac;
    const moving = bus.status === STATUS.MOVING ||
      (bus.status === STATUS.BROKEN && bus.prevStatus === STATUS.MOVING);
    if (!moving) return 0;
    return Math.min(1, bus.progressKm / this.segment(bus).edge.km);
  }

  position(bus) {
    if (this.isLive(bus)) return { lat: bus.device.gps.lat, lng: bus.device.gps.lng };
    return pointAt(this.segment(bus).edge.geometry, this.fraction(bus));
  }

  // วินาที: เวลาจำลองเมื่อไม่มี GPS / เวลาจริงเมื่อมี GPS
  eta(bus) {
    if ([STATUS.BROKEN, STATUS.RETIRED, STATUS.MODIFYING].includes(bus.status)) return null;
    const km = this.segment(bus).edge.km;
    if (this.isLive(bus) && bus.device.live) {
      const v = bus.device.gps.speedKmh > 3 ? bus.device.gps.speedKmh : bus.speedKmh;
      return km * (1 - bus.device.live.frac) / v * 3600;
    }
    if (bus.status === STATUS.MOVING) return (km - bus.progressKm) / bus.speedKmh * 3600;
    return Math.max(0, bus.dwellSec) + km / bus.speedKmh * 3600;
  }

  // วินาทีจนรถถึงสถานี code ครั้งถัดไป: เวลาถึงป้ายถัดไป แล้วบวก (จอด + วิ่ง) ทีละช่วงตาม next ของ Circular Linked List
  etaTo(bus, code) {
    let t = this.eta(bus);
    if (t == null) return null;
    let n = bus.route.current.next;
    for (let i = 0; i < bus.route.size && n.code !== code; i++, n = n.next) {
      t += config.DWELL_SEC + this.graph.edge(n.code, n.next.code).km / bus.speedKmh * 3600;
    }
    return n.code === code ? t : null;
  }

  view(bus) {
    const retired = bus.status === STATUS.RETIRED;
    const live = !retired && this.isLive(bus);
    const d = bus.device;
    const base = {
      name: bus.name, plate: bus.plate, capacity: bus.capacity, speedKmh: bus.speedKmh,
      status: bus.status, pendingModify: bus.pendingModify, laps: bus.laps,
      route: bus.route.toArray(), currentIndex: bus.route.indexOf(bus.route.current),
      device: {
        gps: d.gps ? { lat: d.gps.lat, lng: d.gps.lng, speedKmh: d.gps.speedKmh, ageMs: Date.now() - d.gps.receivedAt, online: live } : null,
        passengers: d.passengers ? { count: d.passengers.count, ageMs: Date.now() - d.passengers.receivedAt } : null,
        engine: d.engine ? { fault: d.engine.fault, code: d.engine.code, ageMs: Date.now() - d.engine.receivedAt } : null,
      },
    };
    if (retired) return base;
    const seg = this.segment(bus);
    const pos = this.position(bus);
    return {
      ...base,
      current: seg.from, next: seg.to, segmentKm: seg.edge.km,
      lat: pos.lat, lng: pos.lng,
      fraction: this.fraction(bus),
      etaSec: this.eta(bus),
      etaBasis: live ? 'real' : 'sim',
      dwellSec: bus.status === STATUS.AT_STATION && !live ? Math.max(0, bus.dwellSec) : null,
      positionSource: live ? 'gps' : 'sim',
      offRouteM: live && d.live ? Math.round(d.live.offM) : null,
    };
  }

  snapshot() {
    return {
      sim: { running: this.running, scale: this.scale, clock: this.clock, scales: config.SCALES },
      buses: this.fleet.list().map(b => this.view(b)),
      log: this.log.list(15),
      serverTime: Date.now(),
    };
  }

  arrivalsAt(code) {
    return this.fleet.active()
      .map(b => ({ bus: b, positions: b.route.search(code) }))
      .filter(x => x.positions.length)
      .map(({ bus, positions }) => {
        const v = this.view(bus);
        const here = v.current === code && bus.status !== STATUS.MOVING;
        return {
          bus: bus.name, positions, status: bus.status,
          here,
          nextHere: v.next === code,
          etaSec: here ? 0 : this.etaTo(bus, code),
          etaBasis: v.etaBasis,
        };
      });
  }
}

module.exports = { Simulation };
