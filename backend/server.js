// จุดเริ่มระบบ: สร้างบริการ → ผูก API → เสิร์ฟหน้าเว็บ → เริ่มนาฬิกาจำลอง

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createApp } = require('./services/app');
const { Router } = require('./api/router');
const { SseHub } = require('./api/sse');
const { sendError } = require('./api/http');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
  catch { res.writeHead(400); return res.end(); }
  const file = path.resolve(FRONTEND_DIR, '.' + rel);
  const inside = path.relative(FRONTEND_DIR, file);
  if (rel.includes('\0') || inside.startsWith('..') || path.isAbsolute(inside)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

async function start({ port = config.PORT, logger = console } = {}) {
  const ctx = await createApp(logger);
  const hub = new SseHub();
  const router = new Router();
  require('./api/routes/network.routes')(router, ctx);
  require('./api/routes/fleet.routes')(router, ctx);
  require('./api/routes/sim.routes')(router, ctx, hub);
  require('./api/routes/device.routes')(router, ctx);

  const server = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { res.writeHead(400); return res.end(); }
    if (url.pathname.startsWith('/api/')) {
      return router.handle(req, res, url).catch(err => sendError(res, err));
    }
    serveStatic(req, res, url);
  });

  let last = Date.now();
  const tickTimer = setInterval(() => {
    const now = Date.now();
    try { ctx.sim.tick(Math.min(1, (now - last) / 1000)); }
    catch (err) { logger.error?.(err); }
    last = now;
  }, config.TICK_MS);
  const castTimer = setInterval(() => hub.broadcast(ctx.sim.snapshot()), config.BROADCAST_MS);

  await new Promise(r => server.listen(port, r));
  const close = () => new Promise(r => {
    clearInterval(tickTimer); clearInterval(castTimer);
    hub.closeAll?.();
    server.closeAllConnections?.();
    server.close(() => r());
  });
  return { server, ctx, hub, port: server.address().port, close };
}

if (require.main === module) {
  start()
    .then(({ port }) => console.log(`พร้อมใช้งาน: http://localhost:${port}`))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { start };
