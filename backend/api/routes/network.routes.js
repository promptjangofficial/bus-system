// Phase 5 — API แผนที่: สถานี ถนน และรถที่ผ่านแต่ละสถานี
const config = require('../../config');
const { AppError } = require('../../config/messages');

module.exports = function register(router, ctx) {
  router.get('/api/network', () => ({
    ...ctx.network,
    deviceKeyRequired: !!config.DEVICE_API_KEY,
    liveTtlMs: config.LIVE_TTL_MS,
  }));

  router.get('/api/stations', () =>
    ctx.graph.allStations().map(s => ({ ...s, neighbors: ctx.graph.neighbors(s.code) })));

  router.get('/api/roads', () => ctx.graph.roads());

  router.get('/api/stations/:code/arrivals', ({ params }) => {
    const st = ctx.graph.station(params.code);
    if (!st) throw new AppError('STATION_NOT_FOUND', { station: params.code }, 404);
    return { station: st, arrivals: ctx.sim.arrivalsAt(st.code) };
  });

  router.post('/api/routes/validate', ({ body }) => ctx.fleet.validateRoute(body.route));
};
