// Phase 6 — เครื่องมือ DOM: อัปเดตเฉพาะเมื่อเนื้อหาเปลี่ยน (ไม่ทำให้ปุ่ม/ฟอร์มกระตุก)
const cache = new WeakMap();
export const $ = (sel, root = document) => root.querySelector(sel);
export function patch(el, html) {
  if (!el || cache.get(el) === html) return;
  cache.set(el, html);
  el.innerHTML = html;
}
// เล่นแอนิเมชันซ้ำ: ถอด class → บังคับคำนวณใหม่ → ใส่กลับ · ms = ถอดออกเองหลังเล่นจบ
export function replay(el, cls, ms = 0) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  if (ms) setTimeout(() => el.classList.remove(cls), ms);
}
// ตัวเลขนาทีที่เปลี่ยนค่า → ใส่ class flip (จำค่าเดิมตาม data-flip)
const lastFlip = new Map();
export function flipChanged(root) {
  for (const n of root.querySelectorAll('[data-flip]')) {
    const k = n.dataset.flip, v = n.textContent;
    if (lastFlip.has(k) && lastFlip.get(k) !== v) n.classList.add('flip');
    lastFlip.set(k, v);
  }
}
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    if (fallbackEl) { const r = document.createRange(); r.selectNodeContents(fallbackEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    return false;
  }
}
