# MoneyDesk

เว็บบันทึกรายรับรายจ่ายพร้อมระบบสมัครใช้งาน แยกข้อมูลตามผู้ใช้ และหน้า Dashboard สรุปผล

## ใช้แบบระยะยาว

ถ้าจะใช้จริงนานๆ อย่าเก็บข้อมูลไว้ในไฟล์ `data/db.json` ให้ใช้ PostgreSQL ผ่าน `DATABASE_URL`

ระบบนี้รองรับ 2 โหมด:

- มี `DATABASE_URL`: ใช้ PostgreSQL เหมาะสำหรับ production
- ไม่มี `DATABASE_URL`: ใช้ไฟล์ `data/db.json` เหมาะสำหรับลองในเครื่องเท่านั้น

## เปิดใช้งานบนเครื่อง

ต้องมี Node.js 18 ขึ้นไป

```bash
npm install
npm start
```

จากนั้นเปิด:

```text
http://localhost:3000
```

## Environment Variables สำหรับ production

ตั้งค่าใน hosting เช่น Render, Railway, Fly.io หรือ VPS:

```text
SESSION_SECRET=ข้อความสุ่มยาวๆสำหรับเซ็น token
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
REQUIRE_DATABASE_URL=true
PORT=3000
```

ถ้าฐานข้อมูลของคุณต้องการ SSL ให้ปล่อย `DATABASE_SSL` ว่างไว้ หรือใช้:

```text
DATABASE_SSL=true
```

## Deploy ให้คนอื่นเข้าได้ผ่าน 4G/5G

1. สร้าง PostgreSQL บน Supabase, Neon, Render PostgreSQL หรือ VPS
2. คัดลอก connection string มาใส่เป็น `DATABASE_URL`
3. เอาโปรเจกต์ขึ้น GitHub
4. สร้าง Web Service บน hosting
5. ตั้ง `Build Command` เป็น `npm install`
6. ตั้ง `Start Command` เป็น `npm start`
7. ตั้ง env ตามด้านบน
8. Deploy แล้วเปิด URL ที่ hosting ให้มา

## Health Check

ใช้ endpoint นี้ตรวจว่าเว็บยังทำงาน:

```text
/healthz
```

ตัวอย่างผลลัพธ์:

```json
{
  "ok": true,
  "store": "postgres",
  "uptime": 123
}
```

## API

- `POST /api/register`
- `POST /api/login`
- `GET /api/session`
- `GET /api/transactions`
- `POST /api/transactions`
- `DELETE /api/transactions/:id`
