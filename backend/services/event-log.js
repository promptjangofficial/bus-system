// Phase 4 — บันทึกเหตุการณ์ (ประทับเวลาจำลอง)

const config = require('../config');

class EventLog {
  constructor(clockFn) {
    this.clockFn = clockFn;
    this.items = [];
    this.seq = 0;
  }
  add(text) {
    this.items.unshift({ id: ++this.seq, clock: this.clockFn(), text });
    if (this.items.length > config.LOG_MAX) this.items.length = config.LOG_MAX;
  }
  list(n = 15) { return this.items.slice(0, n); }
  clear() { this.items = []; }
}

module.exports = { EventLog };
