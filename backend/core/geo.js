// Phase 2 — คณิตศาสตร์พิกัด (ไม่มีข้อมูล ไม่มีข้อความ)
// พิกัดในเส้นถนนใช้รูปแบบ [lat, lng]

const R_KM = 6371;
const RAD = Math.PI / 180;

function haversineKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

const pt = ([lat, lng]) => ({ lat, lng });
const metersBetween = (a, b) => haversineKm(a, b) * 1000;

// พิกัดท้องถิ่นเป็นเมตร รอบจุดอ้างอิง o
function toXY(p, o) {
  const k = Math.cos(o.lat * RAD);
  return { x: (p.lng - o.lng) * 111320 * k, y: (p.lat - o.lat) * 110540 };
}

function cumulative(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + metersBetween(pt(coords[i - 1]), pt(coords[i])));
  }
  return cum;
}

// จุดบนเส้นที่ระยะสัดส่วน frac (0..1)
function pointAt(coords, frac) {
  if (coords.length === 1) return pt(coords[0]);
  const cum = cumulative(coords);
  const total = cum[cum.length - 1] || 1;
  const target = Math.max(0, Math.min(1, frac)) * total;
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] >= target) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (target - cum[i - 1]) / seg;
      const [la1, ln1] = coords[i - 1], [la2, ln2] = coords[i];
      return { lat: la1 + (la2 - la1) * t, lng: ln1 + (ln2 - ln1) * t };
    }
  }
  return pt(coords[coords.length - 1]);
}

// ฉายจุด P ลงบนเส้น: คืนสัดส่วนตามแนวเส้น และระยะห่างจากเส้น (เมตร)
function projectOnPolyline(coords, P) {
  const cum = cumulative(coords);
  const total = cum[cum.length - 1] || 1;
  let best = { frac: 0, offM: Infinity };
  for (let i = 1; i < coords.length; i++) {
    const A = pt(coords[i - 1]);
    const b = toXY(pt(coords[i]), A);
    const p = toXY(P, A);
    const L2 = b.x * b.x + b.y * b.y || 1;
    const t = Math.max(0, Math.min(1, (p.x * b.x + p.y * b.y) / L2));
    const off = Math.hypot(p.x - t * b.x, p.y - t * b.y);
    if (off < best.offM) {
      best = { frac: (cum[i - 1] + t * (cum[i] - cum[i - 1])) / total, offM: off };
    }
  }
  return best;
}

module.exports = { haversineKm, metersBetween, pointAt, projectOnPolyline };
