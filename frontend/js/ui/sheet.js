// Phase 6 — แผ่นล่างบนมือถือ (ทั้งสองมุมมอง): ลากหรือแตะที่จับ หยุด 3 ระดับ แอบดู / ครึ่ง / เต็ม
// ความสูงเก็บใน --sheet-h บน .app-main ให้แผ่น บันทึกเหตุการณ์ และปุ่มบนแผนที่ขยับตามกัน
const SNAPS = { peek: () => 132, half: h => Math.round(h * 0.5), full: h => h - 12 };
const ORDER = ['peek', 'half', 'full'];

export function mountSheet(host, { isActive }) {
  let snap = 'half', drag = null, dragged = false;
  const px = k => SNAPS[k](host.clientHeight);
  const current = () => parseFloat(host.style.getPropertyValue('--sheet-h')) || 0;

  function apply() {
    document.body.dataset.sheet = snap;
    if (isActive()) host.style.setProperty('--sheet-h', px(snap) + 'px');
    else host.style.removeProperty('--sheet-h');
  }

  host.addEventListener('pointerdown', e => {
    const h = e.target.closest('.sheet-handle');
    if (!h || !isActive()) return;
    h.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, h0: current() };
    dragged = false;
  });
  host.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (!dragged && Math.abs(dy) < 6) return;
    if (!dragged) { dragged = true; document.body.classList.add('sheet-dragging'); }
    host.style.setProperty('--sheet-h', Math.min(Math.max(drag.h0 + dy, px('peek') - 40), px('full')) + 'px');
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    if (!dragged) return;
    document.body.classList.remove('sheet-dragging');
    // ปล่อยมือ → ไปหยุดที่ระดับที่ใกล้ที่สุด (แอนิเมชัน spring จาก CSS)
    const h = current();
    snap = ORDER.reduce((best, k) => (Math.abs(px(k) - h) < Math.abs(px(best) - h) ? k : best));
    apply();
  };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  host.addEventListener('click', e => {
    if (!e.target.closest('[data-act="sheetCycle"]')) return;
    if (dragged) { dragged = false; return; }   // เพิ่งลากเสร็จ ไม่นับเป็นการแตะ
    snap = ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length];
    apply();
  });

  new ResizeObserver(apply).observe(host);
  apply();
  return { apply, height: () => (isActive() ? current() : 0) };
}
