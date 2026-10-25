// Phase 5 — API อุปกรณ์ติดรถ (GPS / นับผู้โดยสาร / เครื่องยนต์)
module.exports = function register(router, ctx) {
  router.post('/api/devices/ingest', ({ req, body }) => {
    ctx.devices.checkKey(req.headers['x-device-key']);
    return { results: [].concat(ctx.devices.ingest(body)) };
  });

  router.get('/api/devices/status', () => ctx.devices.status());
};
