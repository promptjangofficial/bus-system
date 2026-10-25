// Phase 5 — Router ขนาดเล็ก รองรับ path แบบ /api/buses/:name

const { AppError } = require('../config/messages');
const { readJson, send, sendError } = require('./http');

function decodeParams(keys, match) {
  try { return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(match[i + 1])])); }
  catch { throw new AppError('BAD_URL'); }
}

class Router {
  constructor() { this.routes = []; }

  add(method, pattern, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler });
  }
  get(p, h)    { this.add('GET', p, h); }
  post(p, h)   { this.add('POST', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  async handle(req, res, url) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Device-Key',
      });
      return res.end();
    }
    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      try {
        const params = decodeParams(r.keys, m);
        const body = req.method === 'GET' ? {} : await readJson(req);
        const out = await r.handler({ req, res, params, body, query: url.searchParams });
        if (out !== undefined && !res.headersSent) send(res, 200, out);
      } catch (err) {
        sendError(res, err);
      }
      return;
    }
    sendError(res, new AppError('NOT_FOUND', {}, 404));
  }
}

module.exports = { Router };
