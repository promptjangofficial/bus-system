// Phase 5 — เครื่องมือ HTTP: อ่าน body, ส่ง JSON, จัดการข้อผิดพลาด

const config = require('../config');
const { AppError, message } = require('../config/messages');

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > config.BODY_MAX_BYTES) { tooLarge = true; chunks.length = 0; return; }  // อ่านทิ้งจนจบ แล้วตอบ 413
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new AppError('BODY_TOO_LARGE', {}, 413));
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new AppError('BAD_JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, err) {
  if (err instanceof AppError) return send(res, err.status, { error: err.message, code: err.code });
  console.error(err);
  send(res, 500, { error: message('INTERNAL'), code: 'INTERNAL' });
}

module.exports = { readJson, send, sendError };
