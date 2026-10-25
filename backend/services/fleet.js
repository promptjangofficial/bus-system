// Phase 4 — การจัดการรถ: ลงทะเบียน ค้นหา ปลดระวาง ลบ รถเสีย/ซ่อม และแก้ไขเส้นทาง

const config = require('../config');
const { LOG, AppError, fail, message } = require('../config/messages');
const { BusTree } = require('../core/bus-tree');
const { CircularRoute } = require('../core/circular-route');

const STATUS = Object.freeze({
  MOVING: 'MOVING', AT_STATION: 'AT_STATION', BROKEN: 'BROKEN', MODIFYING: 'MODIFYING', RETIRED: 'RETIRED',
});

function newBus({ name, plate, capacity, speedKmh }, route) {
  return {
    name, plate, capacity, speedKmh, route,
    status: STATUS.AT_STATION,
    prevStatus: null,
    progressKm: 0,
    dwellSec: config.DWELL_SEC / 2,
    pendingModify: false,
    laps: 0,
    device: { gps: null, passengers: null, engine: null, live: null, wasLive: false },
  };
}

function cleanInput(input = {}) {
  const L = config.LIMITS;
  const name = String(input.name ?? '').trim();
  const plate = String(input.plate ?? '').trim();
  const capacity = Number(input.capacity);
  const speedKmh = Number(input.speedKmh);
  if (!name || name.length > L.nameMax || !/^[\p{L}\p{M}\p{N}\- ]+$/u.test(name))
    throw new AppError('INVALID_FIELD', { field: 'ชื่อรถ', hint: `ตัวอักษร ตัวเลข หรือ - ไม่เกิน ${L.nameMax} ตัว` });
  if (!plate || plate.length > L.plateMax)
    throw new AppError('INVALID_FIELD', { field: 'ทะเบียน', hint: `ไม่เกิน ${L.plateMax} ตัวอักษร` });
  if (!Number.isInteger(capacity) || capacity < L.capacity[0] || capacity > L.capacity[1])
    throw new AppError('INVALID_FIELD', { field: 'ความจุ', hint: `${L.capacity[0]}–${L.capacity[1]} ที่นั่ง` });
  if (!Number.isFinite(speedKmh) || speedKmh < L.speedKmh[0] || speedKmh > L.speedKmh[1])
    throw new AppError('INVALID_FIELD', { field: 'ความเร็ว', hint: `${L.speedKmh[0]}–${L.speedKmh[1]} กม./ชม.` });
  if (!Array.isArray(input.route)) throw new AppError('INVALID_FIELD', { field: 'เส้นทาง' });
  return { name, plate, capacity, speedKmh, route: input.route.map(String) };
}

class Fleet {
  constructor({ graph, log, onChange = () => {} }) {
    this.graph = graph;
    this.log = log;
    this.onChange = onChange;
    this.tree = new BusTree();
  }

  stationName(code) { return this.graph.station(code)?.name || code; }

  // ---------- โหลด / บันทึก ----------
  load(records) {
    this.tree = new BusTree();
    for (const r of records || []) {
      try {
        const input = cleanInput(r);
        const res = CircularRoute.create(this.graph, input.route);
        if (!res.ok) throw fail(res);
        const bus = newBus(input, res.route);
        if (r.retired) bus.status = STATUS.RETIRED;
        if (this.tree.isEmpty()) this.tree = BusTree.create(bus);
        else { const ins = this.tree.insert(bus); if (!ins.ok) throw fail(ins); }
      } catch (err) {
        this.log.add(LOG.skippedRecord(r?.name ?? '?', err.message));
      }
    }
    this.log.add(LOG.loaded(this.tree.count));
  }

  records() {
    return this.tree.inorder().map(b => ({
      name: b.name, plate: b.plate, capacity: b.capacity, speedKmh: b.speedKmh,
      route: b.route.toArray(), retired: b.status === STATUS.RETIRED,
    }));
  }

  changed() { this.onChange(this.records()); }

  // ---------- อ่าน ----------
  list()   { return this.tree.inorder(); }
  active() { return this.list().filter(b => b.status !== STATUS.RETIRED); }

  find(name) { return this.tree.search(String(name)); }

  get(name) {
    const r = this.find(name);
    if (!r.node) throw new AppError('BUS_NOT_FOUND', { name }, 404);
    return r.node.bus;
  }

  // ---------- ลงทะเบียน ----------
  create(raw) {
    const input = cleanInput(raw);
    if (this.find(input.name).node) throw new AppError('BUS_EXISTS', { name: input.name }, 409);
    const res = CircularRoute.create(this.graph, input.route);
    if (!res.ok) throw fail(res);
    const bus = newBus(input, res.route);
    if (this.tree.isEmpty()) {
      this.tree = BusTree.create(bus);
      this.log.add(LOG.rootCreated(bus.name));
    } else {
      const ins = this.tree.insert(bus);
      if (!ins.ok) throw fail(ins, 409);
      this.log.add(LOG.busCreated(bus.name));
    }
    this.changed();
    return bus;
  }

  // ---------- ปลดระวาง / ลบ ----------
  retire(name) {
    const b = this.get(name);
    if (b.status === STATUS.RETIRED) throw new AppError('ALREADY_RETIRED');
    if (b.status === STATUS.MOVING) throw new AppError('MUST_BE_AT_STATION');
    b.status = STATUS.RETIRED;
    b.pendingModify = false;
    this.log.add(LOG.retired(b.name));
    this.changed();
    return b;
  }

  remove(name, confirm) {
    const b = this.get(name);
    if (b.status !== STATUS.RETIRED) throw new AppError('NOT_RETIRED');
    if (confirm !== b.name) throw new AppError('CONFIRM_MISMATCH');
    this.tree.delete(b.name);
    this.log.add(LOG.removed(b.name));
    this.changed();
    return { name: b.name };
  }

  // ---------- รถเสีย / ซ่อม ----------
  breakdown(name, reason = LOG.userBreakdown()) {
    const b = typeof name === 'string' ? this.get(name) : name;
    if (b.status === STATUS.RETIRED) throw new AppError('ALREADY_RETIRED');
    if (b.status === STATUS.BROKEN) return b;
    b.prevStatus = b.status;
    b.status = STATUS.BROKEN;
    this.log.add(LOG.broken(b.name, reason));
    return b;
  }

  repair(name) {
    const b = this.get(name);
    if (b.status !== STATUS.BROKEN) throw new AppError('NOT_BROKEN');
    b.status = b.prevStatus === STATUS.MODIFYING ? STATUS.MODIFYING
             : b.prevStatus === STATUS.MOVING ? STATUS.MOVING : STATUS.AT_STATION;
    if (b.status === STATUS.AT_STATION) b.dwellSec = Math.max(b.dwellSec, 10);
    b.prevStatus = null;
    if (b.device.engine?.fault) b.device.engine = { ...b.device.engine, fault: false, clearedAt: Date.now() };
    this.log.add(LOG.repaired(b.name));
    return b;
  }

  // ---------- แก้ไขเส้นทาง ----------
  requestModify(name) {
    const b = this.get(name);
    if (b.status === STATUS.BROKEN || b.status === STATUS.RETIRED) throw new AppError('CANNOT_MODIFY');
    if (b.status === STATUS.MODIFYING) return b;
    if (b.status === STATUS.AT_STATION) {
      b.status = STATUS.MODIFYING;
      this.log.add(LOG.modifying(b.name));
    } else {
      b.pendingModify = true;
      this.log.add(LOG.modifyPending(b.name));
    }
    return b;
  }

  requireModifying(b) { if (b.status !== STATUS.MODIFYING) throw new AppError('NOT_MODIFYING'); }

  insertStop(name, after, code) {
    const b = this.get(name);
    this.requireModifying(b);
    const res = b.route.insertAfter(Number(after), String(code));
    if (!res.ok) throw fail(res);
    this.log.add(LOG.stopInserted(b.name, this.stationName(code)));
    this.changed();
    return b;
  }

  deleteStop(name, index) {
    const b = this.get(name);
    this.requireModifying(b);
    const res = b.route.deleteAt(Number(index));
    if (!res.ok) throw fail(res);
    this.log.add(LOG.stopDeleted(b.name, this.stationName(res.removed)));
    this.changed();
    return b;
  }

  resume(name) {
    const b = this.get(name);
    this.requireModifying(b);
    const v = CircularRoute.validate(this.graph, b.route.toArray());
    if (!v.ok) throw fail(v);
    b.status = STATUS.AT_STATION;
    b.dwellSec = 10;
    this.log.add(LOG.resumed(b.name));
    return b;
  }

  searchStop(name, code) {
    const b = this.get(name);
    return { bus: b.name, station: code, positions: b.route.search(String(code)) };
  }

  validateRoute(codes) {
    const issues = CircularRoute.issues(this.graph, codes);
    return { ok: issues.length === 0, issues: issues.map(i => ({ ...i, message: message(i.code, i) })) };
  }
}

module.exports = { Fleet, STATUS };
