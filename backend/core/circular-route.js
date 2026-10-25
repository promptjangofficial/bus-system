// Phase 2 — Circular Linked List: เส้นทางเดินรถ (โหนดสุดท้ายชี้กลับ head)
// คืนผลเป็น { ok:true } หรือ { ok:false, code, ...params } — ข้อความอยู่ที่ config/messages.js

class RouteNode {
  constructor(code) { this.code = code; this.next = null; }
}

class CircularRoute {
  constructor(graph) {
    this.graph = graph;
    this.head = null;
    this.current = null;   // จุดแวะปัจจุบัน / จุดที่เพิ่งออกมา
    this.size = 0;
  }

  // ตรวจทุกช่วง รวมช่วงวนกลับ head — คืนรายการปัญหาทั้งหมด
  static issues(graph, codes) {
    if (!Array.isArray(codes) || codes.length < 2) return [{ code: 'ROUTE_TOO_SHORT' }];
    const missing = codes.filter(c => !graph.hasStation(c));
    if (missing.length) return missing.map(c => ({ code: 'STATION_NOT_FOUND', station: c }));
    const out = [];
    for (let i = 0; i < codes.length; i++) {
      const u = codes[i], v = codes[(i + 1) % codes.length];
      const closing = i === codes.length - 1;
      if (u === v) out.push({ code: 'DUPLICATE_ADJACENT', station: u, segment: i });
      else if (!graph.hasEdge(u, v)) out.push({ code: 'NO_EDGE', from: u, to: v, closing, segment: i });
    }
    return out;
  }

  static validate(graph, codes) {
    const list = CircularRoute.issues(graph, codes);
    return list.length ? { ok: false, ...list[0] } : { ok: true };
  }

  // Create
  static create(graph, codes) {
    const v = CircularRoute.validate(graph, codes);
    if (!v.ok) return v;
    const route = new CircularRoute(graph);
    let tail = null;
    for (const c of codes) {
      const n = new RouteNode(c);
      if (!route.head) route.head = n; else tail.next = n;
      tail = n;
      route.size++;
    }
    tail.next = route.head;
    route.current = route.head;
    return { ok: true, route };
  }

  toArray() {
    const out = [];
    if (!this.head) return out;
    let n = this.head;
    do { out.push(n.code); n = n.next; } while (n !== this.head);
    return out;
  }

  nodeAt(i) { let n = this.head; for (let k = 0; k < i; k++) n = n.next; return n; }

  indexOf(node) {
    let n = this.head, i = 0;
    do { if (n === node) return i; n = n.next; i++; } while (n !== this.head);
    return -1;
  }

  // Search: ลำดับที่ผ่านสถานีนี้ (นับจาก 1)
  search(code) {
    const pos = [];
    if (!this.head) return pos;
    let n = this.head, i = 1;
    do { if (n.code === code) pos.push(i); n = n.next; i++; } while (n !== this.head);
    return pos;
  }

  // Insert: แทรกหลังลำดับ index (นับจาก 0)
  insertAfter(index, code) {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) return { ok: false, code: 'INDEX_OUT_OF_RANGE' };
    if (!this.graph.hasStation(code)) return { ok: false, code: 'STATION_NOT_FOUND', station: code };
    const prev = this.nodeAt(index), next = prev.next;
    if (code === prev.code || code === next.code) return { ok: false, code: 'DUPLICATE_ADJACENT', station: code };
    if (!this.graph.hasEdge(prev.code, code)) return { ok: false, code: 'NO_EDGE', from: prev.code, to: code };
    if (!this.graph.hasEdge(code, next.code)) return { ok: false, code: 'NO_EDGE', from: code, to: next.code };
    const n = new RouteNode(code);
    n.next = next;
    prev.next = n;
    this.size++;
    return { ok: true };
  }

  // Delete: ลบลำดับ index (นับจาก 0) และคงความเป็นวงกลม
  deleteAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) return { ok: false, code: 'INDEX_OUT_OF_RANGE' };
    if (this.size <= 2) return { ok: false, code: 'MIN_STOPS' };
    const node = this.nodeAt(index);
    if (node === this.current) return { ok: false, code: 'DELETE_CURRENT' };
    const prev = this.nodeAt((index - 1 + this.size) % this.size);
    const next = node.next;
    if (prev.code === next.code) return { ok: false, code: 'DUPLICATE_ADJACENT', station: prev.code };
    if (!this.graph.hasEdge(prev.code, next.code)) return { ok: false, code: 'NO_EDGE', from: prev.code, to: next.code };
    prev.next = next;
    if (node === this.head) this.head = next;
    this.size--;
    return { ok: true, removed: node.code };
  }

  advance() { this.current = this.current.next; }
}

module.exports = { CircularRoute };
