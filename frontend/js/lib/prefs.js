// Phase 6 — ค่าที่ผู้ใช้เลือกไว้ในเครื่อง (ธีม แผงข้าง บันทึกเหตุการณ์) และขนาดจอ
// localStorage อาจใช้ไม่ได้ (โหมดส่วนตัว/บล็อกข้อมูล) → ทุกครั้งห่อ try/catch แล้วใช้ค่าเริ่มต้นแทน
const PREFIX = 'bus-';

export function getPref(key) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export function setPref(key, value) {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* ใช้ได้แค่รอบนี้ */ }
}

// ขนาดจอ: มือถือ ≤ 700 · แท็บเล็ต 701–1179 · PC ≥ 1180 (ตรงกับ @media ใน layout.css)
const QUERIES = { phone: '(max-width: 700px)', tablet: '(min-width: 701px) and (max-width: 1179px)' };

export const currentLayout = () =>
  matchMedia(QUERIES.phone).matches ? 'phone' : matchMedia(QUERIES.tablet).matches ? 'tablet' : 'pc';

export function watchLayout(onChange) {
  for (const q of Object.values(QUERIES)) matchMedia(q).addEventListener('change', () => onChange(currentLayout()));
}

export const isLandscape = () => matchMedia('(orientation: landscape)').matches;
