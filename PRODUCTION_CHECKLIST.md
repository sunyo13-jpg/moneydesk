# MoneyDesk Production Checklist

ใช้ checklist นี้เมื่อต้องการใช้เว็บระยะยาวและลดความเสี่ยงข้อมูลหาย

## 1. Database

- ใช้ PostgreSQL ภายนอก เช่น Supabase, Neon, Render PostgreSQL หรือ VPS PostgreSQL
- ตั้ง `DATABASE_URL` ใน hosting
- ตั้ง `REQUIRE_DATABASE_URL=true` เพื่อกันการ deploy แบบเผลอใช้ไฟล์ local
- เปิด backup หรือ point-in-time recovery ในผู้ให้บริการฐานข้อมูลถ้ามี
- ทดสอบ restore backup อย่างน้อยเดือนละครั้งถ้าเป็นข้อมูลสำคัญ

## 2. Hosting

- ใช้ public HTTPS URL จาก Render, Railway, Fly.io หรือ VPS
- ตั้ง `SESSION_SECRET` เป็นข้อความสุ่มยาว ไม่ใช้ค่า default
- ใช้ region ใกล้ผู้ใช้หลัก เช่น Singapore หรือ Asia ถ้ามีให้เลือก
- เปิด health check ไปที่ `/healthz`

## 3. Security

- ห้าม commit `.env` หรือ connection string ขึ้น GitHub
- ใช้รหัสผ่าน database ที่เดายาก
- จำกัดสิทธิ์การเข้าถึง dashboard ของ hosting และ database
- เปลี่ยน `SESSION_SECRET` ถ้าคิดว่า token หลุด

## 4. Operations

- หลัง deploy ให้สมัคร user ทดสอบ เพิ่มรายการ แล้ว refresh หน้า
- restart service แล้วตรวจว่าข้อมูลยังอยู่
- ตรวจ `/healthz` ว่าตอบ `ok: true`
- เก็บลิงก์ production และข้อมูลบัญชี hosting/database ไว้ในที่ปลอดภัย

## 5. Upgrade ต่อไปที่แนะนำ

- เพิ่มระบบ reset password ผ่าน email
- เพิ่ม export CSV/Excel รายเดือน
- เพิ่ม admin page สำหรับดูจำนวนผู้ใช้และสถานะระบบ
- เพิ่ม migration tool เมื่อ schema เริ่มซับซ้อน
