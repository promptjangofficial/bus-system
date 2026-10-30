// Phase 6 — ธีมสว่าง/มืด: ตามระบบก่อน ผู้ใช้กดปุ่มเพื่อบังคับ (จำไว้ในเครื่อง)
// key 'theme' (เก็บเป็น bus-theme) ต้องตรงกับสคริปต์ใน <head> ของ index.html
import { getPref, setPref } from './prefs.js';

const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');

function saved() {
  const t = getPref('theme');
  return t === 'light' || t === 'dark' ? t : null;
}

export const currentTheme = () => saved() || (darkQuery().matches ? 'dark' : 'light');

export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // สีแถบเบราว์เซอร์มือถือ = สีหัวจอ
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--surface').trim());
}

export const saveTheme = theme => setPref('theme', theme);

// ระบบเปลี่ยนธีม (เช่น มือถือเข้าโหมดกลางคืน) → ตามเฉพาะเมื่อผู้ใช้ยังไม่ได้กดเลือกเอง
export function watchSystemTheme(onChange) {
  darkQuery().addEventListener('change', () => { if (!saved()) onChange(currentTheme()); });
}
