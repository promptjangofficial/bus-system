// Phase 5 — API รถโดยสาร
module.exports = function register(router, ctx) {
  const view = b => ctx.sim.view(b);

  router.get('/api/buses', () => ctx.fleet.list().map(view));

  router.get('/api/buses/search', ({ query }) => {
    const name = (query.get('name') || '').trim();
    const r = ctx.fleet.search(name);
    return { found: !!r.node, bus: r.node ? view(r.node.bus) : null, comparisons: r.path.length };
  });

  // ภาพโครงสร้างข้อมูล: ต้นไม้ BST ของรถ + การทำงานล่าสุดของต้นไม้และของแต่ละเส้นทาง
  router.get('/api/structures', () => ctx.fleet.structures());

  router.get('/api/buses/:name', ({ params }) => view(ctx.fleet.get(params.name)));

  router.post('/api/buses', ({ body }) => view(ctx.fleet.create(body)));

  router.post('/api/buses/:name/retire',    ({ params }) => view(ctx.fleet.retire(params.name)));
  router.delete('/api/buses/:name',         ({ params, body }) => ctx.fleet.remove(params.name, body.confirm));
  router.post('/api/buses/:name/breakdown', ({ params }) => view(ctx.fleet.breakdown(params.name)));
  router.post('/api/buses/:name/repair',    ({ params }) => view(ctx.fleet.repair(params.name)));
  router.post('/api/buses/:name/modify',    ({ params }) => view(ctx.fleet.requestModify(params.name)));
  router.post('/api/buses/:name/resume',    ({ params }) => view(ctx.fleet.resume(params.name)));

  router.post('/api/buses/:name/stops',        ({ params, body }) => view(ctx.fleet.insertStop(params.name, body.after, body.station)));
  router.delete('/api/buses/:name/stops/:index', ({ params }) => view(ctx.fleet.deleteStop(params.name, params.index)));
  router.get('/api/buses/:name/stops/search',  ({ params, query }) => ctx.fleet.searchStop(params.name, query.get('station') || ''));
};
