# ระบบเดินรถพิษณุโลก

## เริ่มใช้งาน
ต้องมี Node.js 18 ขึ้นไป ไม่ต้อง `npm install`

```bash
npm start              # เปิด http://localhost:3000
npm run start:offline  # ไม่ดึง OSRM ใช้ระยะทางโดยประมาณ
```

ค่าที่ตั้งผ่าน environment ได้: `PORT`, `USE_OSRM=0`, `OSRM_URL`, `DEVICE_API_KEY`

## ทดสอบ
```bash
npm test          # รันทุกเฟสเรียง 0 → 6 หยุดทันทีที่เฟสไหนไม่ผ่าน
npm test -- 4     # รันเฉพาะเฟส 4
```
แต่ละเฟสทดสอบส่วนของตัวเอง และความเข้ากันได้กับเฟสก่อนหน้า (ไฟล์อยู่ใน `tests/phaseN.*.test.js`) ใช้ข้อมูลชั่วคราว ไม่แตะ `runtime/` จริง และไม่ต้องต่ออินเทอร์เน็ต

แก้โค้ดเฟสไหน รัน `npm test` ทั้งหมดเสมอ เพราะเฟสหลังพึ่งเฟสก่อน

## แบ่งเฟส — แก้ส่วนไหน เปิดโฟลเดอร์นั้น

| เฟส | โฟลเดอร์ | หน้าที่ | ห้ามมี |
|---|---|---|---|
| 0 | `backend/config/` | ค่าตั้ง (`index.js`) และข้อความทั้งหมด (`messages.js`) | ตรรกะ |
| 1 | `backend/data/` | ข้อมูลล้วน: สถานี ถนน รถตั้งต้น (JSON) · `runtime/` = ข้อมูลที่ระบบบันทึกเอง | โค้ด |
| 2 | `backend/core/` | โครงสร้างข้อมูล: `bus-tree.js`, `circular-route.js`, `graph.js`, `geo.js` | ข้อความ, ไฟล์, HTTP |
| 3 | `backend/integrations/` | API ภายนอก: `osrm.js` (ระยะทางและเส้นถนนจริง) | ตรรกะระบบ |
| 4 | `backend/services/` | ตรรกะระบบ: `fleet.js` รถ · `simulation.js` การเดินรถ · `devices.js` อุปกรณ์ · `road-network.js` · `storage.js` · `event-log.js` · `app.js` ประกอบ | HTTP |
| 5 | `backend/api/` | HTTP: `router.js`, `http.js`, `sse.js`, `routes/*.routes.js` | ตรรกะระบบ |
| 6 | `frontend/` | UX/UI: `css/` (ธีมอยู่ที่ `tokens.css`) · `js/lib/api.js` (ทุกการเรียก backend) · `js/map/` · `js/ui/` แต่ละแผง · `js/content/texts.js` ข้อความหน้าจอ | ตรรกะเส้นทาง/การจำลอง |

ทิศทางการพึ่งพา: `api → services → core` · `services → integrations` · ทุกชั้นอ่าน `config` ได้ · `frontend` คุยกับ backend ผ่าน `js/lib/api.js` เท่านั้น

## API ภายนอกที่ใช้
- **OpenStreetMap** — แผนที่ฐาน (ฝั่งหน้าจอ ผ่าน Leaflet)
- **OSRM** — ระยะทางถนนจริงและเส้นถนนระหว่างสถานี ดึงครั้งแรกแล้วเก็บแคชไว้ที่ `backend/data/runtime/road-cache.json` ถ้าดึงไม่ได้จะใช้เส้นตรง × 1.25

## Backend API
| Method | Path | ใช้ทำ |
|---|---|---|
| GET | `/api/network` · `/api/stations` · `/api/roads` | ข้อมูลแผนที่ |
| GET | `/api/stations/:code/arrivals` | รถที่ผ่านสถานี + เวลาถึง |
| POST | `/api/routes/validate` | ตรวจเส้นทาง `{route:[...]}` |
| GET | `/api/buses` · `/api/buses/search?name=` · `/api/buses/:name` | รายการ / ค้นหา / รายละเอียดรถ |
| POST | `/api/buses` | ลงทะเบียน `{name, plate, capacity, speedKmh, route}` |
| POST | `/api/buses/:name/retire` · `breakdown` · `repair` · `modify` · `resume` | สั่งงานรถ |
| DELETE | `/api/buses/:name` | ลบ (ต้องปลดระวางก่อน, body `{confirm: name}`) |
| POST / DELETE | `/api/buses/:name/stops` · `/api/buses/:name/stops/:index` | เพิ่ม `{after, station}` / ลบจุดแวะ |
| GET | `/api/buses/:name/stops/search?station=` | ค้นหาสถานีในเส้นทาง |
| GET / POST | `/api/sim` · POST `/api/sim/reset` | เวลาจำลอง `{running, scale}` |
| GET | `/api/stream` | สถานะเรียลไทม์ (Server-Sent Events) |
| POST | `/api/devices/ingest` | รับข้อมูลจากอุปกรณ์ |
| GET | `/api/devices/status` | สถานะอุปกรณ์รายคัน |

## ติดอุปกรณ์จริง
อุปกรณ์ส่ง `POST /api/devices/ingest` (ส่งทีละรายการหรือเป็น array) ถ้าตั้ง `DEVICE_API_KEY` ต้องแนบ header `X-Device-Key`

```json
{"bus":"NU-01","type":"gps","lat":16.8153,"lng":100.2635,"speedKmh":28}
{"bus":"NU-01","type":"passenger","count":23}
{"bus":"NU-01","type":"engine","fault":true,"code":"P0300"}
```

| ข้อมูล | ฟังก์ชันที่เปิดใช้ | ระหว่างยังไม่ติดตั้ง |
|---|---|---|
| `gps` | ตำแหน่งจริง · ตรวจถึงสถานีเอง (รัศมี 80 ม.) · ETA จากความเร็วจริง | ใช้การจำลอง |
| `passenger` | จำนวนผู้โดยสาร · เตือนเกินความจุ | แสดง "รอเซนเซอร์" |
| `engine` | แจ้งรถเสียอัตโนมัติ | ผู้ดูแลกดเอง |

ถ้า GPS เงียบเกิน 30 วินาที รถคันนั้นจะกลับไปใช้การจำลองเอง

## หมายเหตุ
- พิกัดสถานีใน `backend/data/stations.json` เป็นค่าโดยประมาณ ถ้าแก้พิกัดแล้ว แคชถนนของสถานีนั้นจะถูกดึงใหม่เอง
- กด "รีเซ็ต" จะลบ `runtime/buses.json` แล้วโหลด `seed-buses.json` ใหม่
