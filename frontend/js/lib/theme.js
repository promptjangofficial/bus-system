// Phase 6 — ธีมสว่าง/มืด: ตามระบบก่อน ผู้ใช้กดปุ่มเพื่อบังคับ (จำไว้ในเครื่อง)
// ชื่อ key ต้องตรงกับสคริปต์ใน <head> ของ index.html
const KEY = 'bus-theme';
const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');

function saved() {
  try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : null; }
  catch { return null; }
}

export const currentTheme = () => saved() || (darkQuery().matches ? 'dark' : 'light');

export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // สีแถบเบราว์เซอร์มือถือ = สีหัวจอ
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--surface').trim());
}

export function saveTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* โหมดส่วนตัว/บล็อกข้อมูล: ใช้ได้แค่รอบนี้ */ }
}

// ระบบเปลี่ยนธีม (เช่น มือถือเข้าโหมดกลางคืน) → ตามเฉพาะเมื่อผู้ใช้ยังไม่ได้กดเลือกเอง
export function watchSystemTheme(onChange) {
  darkQuery().addEventListener('change', () => { if (!saved()) onChange(currentTheme()); });
}
