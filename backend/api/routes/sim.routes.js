// Phase 5 — API ควบคุมเวลาจำลอง + สตรีมเรียลไทม์
module.exports = function register(router, ctx, hub) {
  router.get('/api/sim', () => ctx.sim.snapshot().sim);

  router.post('/api/sim', ({ body }) => {
    if (body.scale !== undefined) ctx.sim.setScale(body.scale);
    if (body.running !== undefined) ctx.sim.setRunning(body.running);
    return ctx.sim.snapshot().sim;
  });

  router.post('/api/sim/reset', () => { ctx.reset(); return ctx.sim.snapshot().sim; });

  router.get('/api/stream', ({ req, res }) => { hub.connect(req, res, ctx.sim.snapshot()); });
};
