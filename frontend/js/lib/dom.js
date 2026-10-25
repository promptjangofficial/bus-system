// Phase 6 — เครื่องมือ DOM: อัปเดตเฉพาะเมื่อเนื้อหาเปลี่ยน (ไม่ทำให้ปุ่ม/ฟอร์มกระตุก)
const cache = new WeakMap();
export const $ = (sel, root = document) => root.querySelector(sel);
export function patch(el, html) {
  if (!el || cache.get(el) === html) return;
  cache.set(el, html);
  el.innerHTML = html;
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
