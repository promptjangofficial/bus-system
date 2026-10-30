// Phase 6 — แผงโครงสร้างข้อมูล: วาด Binary Search Tree ของรถ และ Circular Linked List ของเส้นทาง
// ไฮไลต์การทำงานล่าสุด (สร้าง / ค้นหา / เพิ่ม / ลบ) จากข้อมูลจริงใน backend
import { state, setUI, buses, selectedBus, stationName, busColor } from '../store.js';
import { api } from '../lib/api.js';
import { esc } from '../lib/format.js';
import { $, patch } from '../lib/dom.js';
import { stationOptions, run } from './common.js';

const REFRESH_MS = 1000;
let structs = null, timer = null;

async function refresh() {
  if (state.ui.view !== 'control' || state.ui.tab !== 'ds') { clearInterval(timer); timer = null; return; }
  try { structs = await api.structures(); } catch { /* ใช้ข้อมูลเดิม */ }
  const root = document.getElementById('panelBody');
  if (root && state.ui.tab === 'ds') updateDs(root);
}

// ---------- Binary Search Tree ----------
const COL = 100, ROW = 72, PW = 84, PH = 28;

function layoutTree(root) {
  const nodes = [], edges = [];
  let i = 0, depth = 0;
  const walk = (n, d, parent) => {
    if (!n) return;
    walk(n.left, d + 1, n);
    Object.assign(n, { x: i++ * COL + COL / 2, y: d * ROW + 30 });
    depth = Math.max(depth, d);
    nodes.push(n);
    if (parent) edges.push([parent, n]);
    walk(n.right, d + 1, n);
  };
  walk(root, 0, null);
  return { nodes, edges, w: Math.max(i * COL, 320), h: (depth + 1) * ROW + 10 };
}

function treeSVG(tree, op) {
  if (!tree) return '<div class="waiting">ต้นไม้ว่าง ยังไม่มีรถในระบบ</div>';
  const { nodes, edges, w, h } = layoutTree(tree);
  const path = op && op.op !== 'create' ? op.path : [];
  const step = name => path.indexOf(name);
  const onPath = (a, b) => step(a.name) >= 0 && step(b.name) === step(a.name) + 1;
  const hit = op && (op.op === 'insert' || (op.op === 'search' && op.found) || op.op === 'create') ? op.key : null;
  const lines = edges.map(([a, b]) =>
    `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${onPath(a, b) ? 'on' : ''}"/>`).join('');
  const plates = nodes.map(n => {
    const k = step(n.name);
    const cls = [n.status === 'RETIRED' ? 'off' : '', k >= 0 ? 'on' : '', n.name === hit ? 'hit' : ''].join(' ');
    return `<g class="bst-node ${cls}" transform="translate(${n.x - PW / 2},${n.y - PH / 2})">
      <rect width="${PW}" height="${PH}" rx="8" style="fill:${n.status === 'RETIRED' ? 'var(--surface-2)' : busColor(n.name)}"/>
      <text x="${PW / 2}" y="${PH / 2 + 5}">${esc(n.name)}</text>
      ${k >= 0 ? `<circle cx="0" cy="0" r="10" class="step"/><text x="0" y="4" class="step-n">${k + 1}</text>` : ''}
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="Binary Search Tree ของรถ">
    <g class="bst-edges">${lines}</g>${plates}</svg>`;
}

function childSide(tree, key) {
  let side = null;
  const walk = (n, parent) => {
    if (!n) return;
    if (n.name === key && parent) side = { parent: parent.name, left: parent.left === n };
    walk(n.left, n); walk(n.right, n);
  };
  walk(tree, null);
  return side;
}

function treeOpText(op, tree) {
  if (!op) return '';
  const p = op.path.map(esc).join(' → ');
  switch (op.op) {
    case 'create': return `<b>Create</b> สร้างต้นไม้ ${esc(op.key)} เป็น Root Node${op.count > 1 ? ` แล้วเพิ่มรถตามลำดับชื่อจนครบ ${op.count} คัน` : ''}`;
    case 'search': return op.found
      ? `<b>Search</b> ${esc(op.key)}: เทียบ ${op.path.length} ครั้ง ${p} พบ`
      : `<b>Search</b> ${esc(op.key)}: เทียบ ${op.path.length} ครั้ง ${p} ไม่พบรถชื่อนี้`;
    case 'insert': {
      const s = childSide(tree, op.key);
      return `<b>Insert</b> ${esc(op.key)}: เทียบผ่าน ${op.path.slice(0, -1).map(esc).join(' → ')} แล้ววางเป็นลูก${s?.left ? 'ซ้าย' : 'ขวา'}ของ ${esc(s?.parent || '')}`;
    }
    case 'delete': return `<b>Delete</b> ${esc(op.key)}: ${op.successor ? `มีลูกสองข้าง จึงย้าย ${esc(op.successor)} (inorder successor) ขึ้นมาแทน`
      : op.child ? `มีลูกข้างเดียว จึงเลื่อน ${esc(op.child)} ขึ้นมาแทนที่` : 'เป็นใบ ตัดออกได้ทันที'}`;
    default: return '';
  }
}

// ---------- Circular Linked List ----------
const S = 380, CX = S / 2, CY = 175, NR = 18;

function ringSVG(b, op) {
  const n = b.route.length;
  const R = Math.min(130, 40 + n * 10);
  const pt = (i, r = R) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const cur = b.currentIndex, next = (cur + 1) % n;
  const found = new Set(op?.op === 'search' ? op.positions.map(p => p - 1) : []);
  const ins = op?.op === 'insert' ? op.index : -1;
  const bridge = op?.op === 'delete' ? (op.index - 1 + n) % n : -1;   // ลิงก์ใหม่ที่ข้ามโหนดที่ถูกลบ
  const color = busColor(b.name);

  const arrows = b.route.map((_, i) => {
    const j = (i + 1) % n;
    const [x1, y1] = pt(i), [x2, y2] = pt(j);
    const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    const on = i === ins || j === ins || i === bridge;
    const closing = j === 0;
    return `<line x1="${x1 + ux * (NR + 2)}" y1="${y1 + uy * (NR + 2)}" x2="${x2 - ux * (NR + 6)}" y2="${y2 - uy * (NR + 6)}"
      class="${on ? 'on' : ''}${closing ? ' closing' : ''}" marker-end="url(#${on ? 'arrowOn' : 'arrow'})"/>`;
  }).join('');

  const nodes = b.route.map((code, i) => {
    const [x, y] = pt(i);
    const cls = [i === cur ? 'cur' : '', i === next ? 'next' : '', found.has(i) || i === ins ? 'on' : ''].join(' ');
    return `<g class="ring-node ${cls}"><title>${i + 1}. ${esc(stationName(code))}</title>
      <circle cx="${x}" cy="${y}" r="${NR}"/><text x="${x}" y="${y + 5}">${esc(code)}</text>
      <text x="${pt(i, R - NR - 14)[0]}" y="${pt(i, R - NR - 14)[1] + 4}" class="ix">${i + 1}</text></g>`;
  }).join('');

  // ป้ายตัวชี้: head / current / next (โหนดเดียวกันอาจมีหลายป้าย)
  const labels = new Map();
  [[0, 'head'], [cur, 'current'], [next, 'next']].forEach(([i, l]) => labels.set(i, [...(labels.get(i) || []), l]));
  const tags = [...labels].map(([i, ls]) => {
    const [x, y] = pt(i, R + NR + 16);
    return `<text x="${x}" y="${y + 4}" class="ring-tag">${ls.join(' / ')}</text>`;
  });

  return `<svg viewBox="0 0 ${S} ${CY * 2}" role="img" aria-label="Circular Linked List เส้นทาง ${esc(b.name)}" style="--c:${color}">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--faint)"/></marker>
      <marker id="arrowOn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)"/></marker>
    </defs>
    <g class="ring-arrows">${arrows}</g>${nodes}${tags.join('')}</svg>`;
}

function routeOpText(b, op) {
  if (!op) return '';
  const r = b.route, n = r.length, name = c => esc(stationName(c));
  switch (op.op) {
    case 'create': return `<b>Create</b> สร้างเส้นทาง ${op.size} จุดแวะ โหนดสุดท้ายชี้กลับ head (${name(r[0])})`;
    case 'search': return op.positions.length
      ? `<b>Search</b> ${name(op.station)}: ผ่านที่ลำดับ ${op.positions.join(', ')}`
      : `<b>Search</b> ${name(op.station)}: เส้นทางนี้ไม่ผ่านสถานีนี้`;
    case 'insert': return `<b>Insert</b> ${name(op.station)} ที่ลำดับ ${op.index + 1}: ต่อ ${name(r[(op.index - 1 + n) % n])} → ${name(op.station)} → ${name(r[(op.index + 1) % n])}`;
    case 'delete': return `<b>Delete</b> ${name(op.station)} ออก: ต่อ ${name(r[(op.index - 1 + n) % n])} → ${name(r[op.index % n])} โดยตรง วงยังปิดครบ`;
    default: return '';
  }
}

// ---------- แผง ----------
export function renderDs(root) {
  const active = buses().filter(b => b.status !== 'RETIRED');
  if (!active.some(b => b.name === state.ui.selected) && active[0]) state.ui.selected = active[0].name;
  root.innerHTML = `
    <div class="section">
      <h3>Binary Search Tree: ข้อมูลรถ เรียงตามชื่อ</h3>
      <form class="row" id="dsTreeSearch" autocomplete="off">
        <input id="dsName" placeholder="ชื่อรถ เช่น CITY-02" aria-label="ชื่อรถที่จะค้นหาในต้นไม้">
        <button class="primary">ค้นหาในต้นไม้</button>
      </form>
      <p class="ds-op" id="dsTreeOp"></p>
      <div class="ds-canvas" id="dsTree"></div>
      <p class="small muted" id="dsInorder"></p>
      <p class="small muted">เพิ่มรถได้ที่แท็บเพิ่มรถ ส่วนการลบรถ ให้ปลดระวางก่อนแล้วกดลบออกจากระบบ</p>
    </div>
    <div class="section">
      <h3>Circular Linked List: เส้นทางของรถ</h3>
      <div class="row">
        <select id="dsBus" aria-label="รถที่จะดูเส้นทาง">${active.map(b => `<option${b.name === state.ui.selected ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      </div>
      <form class="row" id="dsStopSearch">
        <select id="dsStop" aria-label="สถานีที่จะค้นหาในเส้นทาง">${stationOptions()}</select>
        <button>ค้นหาสถานีในเส้นทาง</button>
      </form>
      <p class="ds-op" id="dsRouteOp"></p>
      <div class="ds-canvas ring" id="dsRing"></div>
      <p class="small muted">เพิ่ม/ลบจุดแวะ: แท็บรถโดยสาร กดแก้ไขเส้นทาง เมื่อรถจอดที่สถานีจะแทรกหรือลบได้</p>
    </div>`;
  if (!timer) { timer = setInterval(refresh, REFRESH_MS); }
  refresh();
  updateDs(root);
}

export function updateDs(root) {
  if (!$('#dsTree', root)) return;
  const tree = structs?.tree ?? null;
  patch($('#dsTreeOp', root), treeOpText(structs?.treeOp, tree));
  patch($('#dsTree', root), structs ? treeSVG(tree, structs.treeOp) : '<p class="muted">กำลังโหลด…</p>');
  const names = buses().map(b => esc(b.name)).join(', ');
  patch($('#dsInorder', root), names ? `Inorder (เรียงตามชื่อ): ${names}` : '');
  const b = selectedBus();
  patch($('#dsRouteOp', root), b ? routeOpText(b, structs?.routeOps?.[b.name]) : '');
  patch($('#dsRing', root), b && b.status !== 'RETIRED' ? ringSVG(b, structs?.routeOps?.[b.name]) : '<div class="waiting">เลือกรถที่ยังให้บริการ</div>');
}

export function mountDsEvents(root) {
  root.addEventListener('change', e => {
    if (state.ui.tab === 'ds' && e.target.id === 'dsBus') setUI({ selected: e.target.value });
  });
  root.addEventListener('submit', async e => {
    if (state.ui.tab !== 'ds') return;
    e.preventDefault();
    if (e.target.id === 'dsTreeSearch') {
      const q = $('#dsName', root).value.trim();
      if (q) { await run(() => api.searchBus(q)); refresh(); }
    }
    if (e.target.id === 'dsStopSearch') {
      const b = selectedBus();
      if (b) { await run(() => api.searchStop(b.name, $('#dsStop', root).value)); refresh(); }
    }
  });
}
