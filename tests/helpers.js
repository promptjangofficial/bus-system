// เครื่องมือร่วมของชุดทดสอบ
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

function listFiles(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'runtime') out.push(...listFiles(p, ext)); }
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}
const read = p => fs.readFileSync(p, 'utf8');
const readJson = p => JSON.parse(read(p));

// เรียก HTTP แบบดิบ (ไม่ normalize path) — ใช้ทดสอบ path แปลกๆ
function rawRequest(port, { method = 'GET', path: p = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function api(port, method, p, body, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* ไม่ใช่ JSON */ }
  return { status: res.status, data };
}

module.exports = { ROOT, BACKEND, FRONTEND, listFiles, read, readJson, rawRequest, api };
