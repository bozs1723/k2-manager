# Deploy Edge Function: admin-reset-password

ฟังก์ชันนี้ให้ **Owner รีเซ็ตรหัสผ่านพนักงาน** ได้จากในแอปอย่างปลอดภัย
ต้อง deploy ขึ้น Supabase ก่อนใช้งาน (ทำครั้งเดียว)

โปรเจกต์: `fbwgmoorslblwmwftkfz`

---

## วิธีที่ 1 — ผ่านหน้าเว็บ Supabase (ง่ายสุด ไม่ต้องลงโปรแกรม)

1. เข้า https://supabase.com/dashboard → เลือกโปรเจกต์ K2
2. เมนูซ้าย → **Edge Functions**
3. กด **Deploy a new function** → **Via Editor** (หรือ Create function)
4. ตั้งชื่อให้ตรงเป๊ะ: `admin-reset-password`
5. ลบโค้ดตัวอย่าง แล้ววางโค้ดทั้งหมดจากไฟล์
   `supabase/functions/admin-reset-password/index.ts` (ในโปรเจกต์นี้)
6. กด **Deploy**

เสร็จแล้ว — `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` ระบบใส่ให้อัตโนมัติใน runtime ไม่ต้องตั้งเอง

---

## วิธีที่ 2 — ผ่าน Supabase CLI

```bash
# 1. ติดตั้ง CLI (ครั้งเดียว)
npm install -g supabase

# 2. login (เปิดเบราว์เซอร์ให้ยืนยัน)
supabase login

# 3. เชื่อมโปรเจกต์
supabase link --project-ref fbwgmoorslblwmwftkfz

# 4. deploy
supabase functions deploy admin-reset-password
```

---

## ทดสอบหลัง deploy

1. เปิดเว็บแอป → login เป็น **Owner**
2. ไปเมนู **Settings** → การ์ดจัดการสมาชิก
3. กดปุ่มกุญแจ 🔑 (สีเหลือง) ที่พนักงานคนใดก็ได้
4. ยืนยัน → ระบบสร้างรหัส 6 หลักใหม่ แสดงให้ก็อปแจก
5. ลองเอารหัสใหม่ไป login เป็นพนักงานคนนั้น

## หากขึ้น error
- **"เฉพาะเจ้าของ (Owner) เท่านั้น..."** → บัญชีที่ใช้อยู่ role ไม่ใช่ Owner
- **404 / function not found** → ชื่อฟังก์ชันไม่ตรง ต้องเป็น `admin-reset-password` เป๊ะ
- **CORS / 401** → ลองรีเฟรชหน้า (token หมดอายุ) แล้ว login ใหม่
