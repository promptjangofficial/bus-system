// Phase 6 — จัดรูปแบบข้อความ/เวลา
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fmtClock(sec) {
  const s = Math.floor(sec) % 86400;
  return [s / 3600, (s % 3600) / 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':');
}
export function fmtDur(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  const s = Math.max(0, Math.round(sec)), m = Math.floor(s / 60);
  return m ? `${m} นาที ${String(s % 60).padStart(2, '0')} วิ` : `${s} วิ`;
}
export function fmtAgo(ms) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} วิที่แล้ว` : `${Math.floor(s / 60)} นาทีที่แล้ว`;
}
