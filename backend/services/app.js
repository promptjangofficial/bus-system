// Phase 4 — ประกอบบริการทั้งหมดเข้าด้วยกัน (จุดเดียวที่ผูก service กัน)

const storage = require('./storage');
const { buildGraph } = require('./road-network');
const { EventLog } = require('./event-log');
const { Fleet } = require('./fleet');
const { Simulation } = require('./simulation');
const { DeviceGateway } = require('./devices');
const { LOG } = require('../config/messages');

async function createApp(logger = console) {
  const { graph, meta } = await buildGraph(logger);
  const ctx = { graph, network: meta };

  ctx.log = new EventLog(() => ctx.sim?.clock ?? 0);
  ctx.fleet = new Fleet({ graph, log: ctx.log, onChange: records => storage.saveBuses(records) });
  ctx.sim = new Simulation({ fleet: ctx.fleet, graph, log: ctx.log });
  ctx.devices = new DeviceGateway({ fleet: ctx.fleet, sim: ctx.sim, log: ctx.log });

  ctx.fleet.load(storage.loadSavedBuses() || storage.loadSeedBuses());

  ctx.reset = () => {
    storage.clearSavedBuses();
    ctx.sim.resetClock();
    ctx.log.clear();
    ctx.fleet.load(storage.loadSeedBuses());
    ctx.log.add(LOG.simReset());
  };
  return ctx;
}

module.exports = { createApp };
