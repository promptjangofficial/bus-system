// Phase 2 — Binary Search Tree: ข้อมูลรถ เรียงตามชื่อรถ

class BusNode {
  constructor(bus) { this.bus = bus; this.left = null; this.right = null; }
}

class BusTree {
  constructor() { this.root = null; this.count = 0; }

  // ไม่สนตัวพิมพ์เล็ก/ใหญ่ (NU-01 = nu-01) แต่ยังแยกวรรณยุกต์ไทย
  static cmp(a, b) { return a.localeCompare(b, 'th', { sensitivity: 'accent' }); }

  // Create: รถคันแรกเป็น Root Node
  static create(firstBus) {
    const t = new BusTree();
    t.root = new BusNode(firstBus);
    t.count = 1;
    return t;
  }

  isEmpty() { return !this.root; }

  // Insert: จัดตำแหน่งตามลำดับชื่อรถ
  insert(bus) {
    if (!this.root) { this.root = new BusNode(bus); this.count = 1; return { ok: true, root: true }; }
    let n = this.root;
    for (;;) {
      const c = BusTree.cmp(bus.name, n.bus.name);
      if (c === 0) return { ok: false, code: 'BUS_EXISTS', name: bus.name };
      if (c < 0) { if (!n.left) { n.left = new BusNode(bus); break; } n = n.left; }
      else       { if (!n.right) { n.right = new BusNode(bus); break; } n = n.right; }
    }
    this.count++;
    return { ok: true, root: false };
  }

  // Search: คืนโหนดที่พบ และเส้นทางที่เทียบผ่าน
  search(name) {
    const path = [];
    let n = this.root;
    while (n) {
      path.push(n.bus.name);
      const c = BusTree.cmp(name, n.bus.name);
      if (c === 0) return { node: n, path };
      n = c < 0 ? n.left : n.right;
    }
    return { node: null, path };
  }

  // Delete: ใช้ inorder successor เมื่อมีลูกสองข้าง
  delete(name) {
    const found = this.search(name).node;
    if (!found) return null;
    const bus = found.bus;
    const del = (n, key) => {
      if (!n) return null;
      const c = BusTree.cmp(key, n.bus.name);
      if (c < 0) { n.left = del(n.left, key); return n; }
      if (c > 0) { n.right = del(n.right, key); return n; }
      if (!n.left) return n.right;
      if (!n.right) return n.left;
      let s = n.right;
      while (s.left) s = s.left;
      n.bus = s.bus;
      n.right = del(n.right, s.bus.name);
      return n;
    };
    this.root = del(this.root, name);
    this.count--;
    return bus;
  }

  inorder() {
    const out = [];
    const walk = n => { if (!n) return; walk(n.left); out.push(n.bus); walk(n.right); };
    walk(this.root);
    return out;
  }
}

module.exports = { BusTree };
