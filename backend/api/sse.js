// Phase 5 — Server-Sent Events: ส่งสถานะเรียลไทม์ให้หน้าจอ

class SseHub {
  constructor() { this.clients = new Set(); }

  connect(req, res, firstPayload) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 2000\n\n');
    if (firstPayload) res.write(`data: ${JSON.stringify(firstPayload)}\n\n`);
    this.clients.add(res);
    req.on('close', () => this.clients.delete(res));
  }

  closeAll() {
    for (const res of this.clients) res.end();
    this.clients.clear();
  }

  broadcast(payload) {
    if (!this.clients.size) return;
    const line = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of this.clients) {
      if (res.writableEnded || res.destroyed) { this.clients.delete(res); continue; }
      res.write(line);
    }
  }
}

module.exports = { SseHub };
