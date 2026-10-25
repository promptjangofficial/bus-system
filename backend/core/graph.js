// Phase 2 — Graph: สถานี (vertex) และถนน (edge) พร้อมระยะทางและเส้นถนน
// edge(u, v).geometry จะเรียงจาก u ไป v เสมอ

class Graph {
  constructor() {
    this.stations = new Map();
    this.adj = new Map();
    this.roadList = [];
  }

  addStation(station) {
    this.stations.set(station.code, station);
    this.adj.set(station.code, new Map());
  }

  addRoad(u, v, { km, geometry, source }) {
    this.adj.get(u).set(v, { km, geometry, source });
    this.adj.get(v).set(u, { km, geometry: [...geometry].reverse(), source });
    this.roadList.push({ from: u, to: v, km, geometry, source });
  }

  hasStation(code) { return this.stations.has(code); }
  station(code)    { return this.stations.get(code); }
  hasEdge(u, v)    { return !!this.adj.get(u)?.has(v); }
  edge(u, v)       { return this.adj.get(u)?.get(v) || null; }
  dist(u, v)       { return this.edge(u, v)?.km; }
  neighbors(u)     { return [...(this.adj.get(u)?.keys() || [])]; }
  allStations()    { return [...this.stations.values()]; }
  roads()          { return this.roadList; }
}

module.exports = { Graph };
