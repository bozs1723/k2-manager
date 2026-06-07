# คู่มือเชื่อม Supabase ทีละขั้น (ภาษาไทย)

เป้าหมาย: ทำให้แอปเก็บข้อมูลจริงบนคลาวด์ ใช้ร่วมกันหลายเครื่อง/หลายคน

มี 4 ขั้นใหญ่ — ทำตามลำดับ ใช้เวลารวมประมาณ 15–20 นาที

---

## ขั้นที่ 1: สร้าง Project บน Supabase (ฟรี)

1. เปิด https://supabase.com → กด **Start your project** → ล็อกอินด้วย GitHub หรืออีเมล
2. กด **New project**
3. กรอก:
   - **Name**: `k2-manager` (ตั้งชื่ออะไรก็ได้)
   - **Database Password**: ตั้งรหัสผ่านฐานข้อมูล → **จดเก็บไว้** (ใช้ตอนกู้ระบบ)
   - **Region**: เลือก **Southeast Asia (Singapore)** (ใกล้ไทยสุด เร็วสุด)
4. กด **Create new project** → รอสร้างประมาณ 1–2 นาที

---

## ขั้นที่ 2: สร้างตาราง (รัน SQL 1 ครั้ง)

> นี่คือ "ชั้นวางของ" ในฐานข้อมูล ถ้าไม่ทำขั้นนี้ แอปจะเชื่อมติดแต่บันทึกข้อมูลไม่ได้

1. ในเมนูซ้ายของ Supabase → กด **SQL Editor**
2. กด **New query**
3. เปิดไฟล์ **`supabase/setup_complete.sql`** ในโปรเจกต์นี้ → **คัดลอกทั้งหมด** → วางในช่อง SQL
4. กด **Run** (หรือ Ctrl/Cmd + Enter)
5. เห็นข้อความ **Success** ด้านล่าง = เรียบร้อย ✅

> ไฟล์นี้รันซ้ำได้ปลอดภัย ถ้ามีตารางอยู่แล้วจะไม่พังของเดิม

**ตรวจว่าตารางครบ** (ไม่บังคับ): รันคำสั่งนี้ ควรได้ 15 ตาราง
```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```
ควรเห็น: attendance, audit_log, branch_settings, company_settings, customers,
employee_hr, job_comments, job_files, job_status_history, jobs, notifications,
profile_bank_details, profiles, role_permissions, shop_state

---

## ขั้นที่ 3: คัดลอกค่าเชื่อมต่อ 2 ตัว

1. เมนูซ้าย → **Project Settings** (รูปเฟือง) → **API**
2. คัดลอก 2 ค่านี้เก็บไว้:
   - **Project URL** — หน้าตาแบบ `https://xxxxxxxx.supabase.co`
   - **anon public** key (อยู่ใต้หัวข้อ *Project API keys* → แถว `anon` `public`) — สายอักษรยาวๆ

> 🔒 2 ค่านี้เป็นค่าฝั่ง public ใส่ในเว็บได้ปลอดภัย
> ⚠️ **ห้าม** ใช้ค่า `service_role` (อันนั้นเป็นรหัสลับ ห้ามใส่ในเว็บเด็ดขาด)

---

## ขั้นที่ 4: ใส่ค่าใน Netlify แล้ว Deploy

1. เข้า https://app.netlify.com → เลือกโปรเจกต์ **k2-manager**
2. **Site configuration** → **Environment variables** → **Add a variable** → **Add a single variable**
3. เพิ่ม 2 ตัวนี้ (Key ต้องสะกดตรงเป๊ะ):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | (Project URL จากขั้น 3) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon public key จากขั้น 3) |

4. ไปที่แท็บ **Deploys** → **Trigger deploy** → **Deploy site** (ให้มันสร้างใหม่พร้อมค่าที่เพิ่ง

ใส่)
5. รอ deploy เสร็จ (1–3 นาที)

---

## ขั้นที่ 5: ทดสอบว่าใช้ได้จริง

1. เปิดเว็บจริง → ตอนนี้ควรเจอ **หน้าล็อกอิน (อีเมล + รหัสผ่าน)**
2. **สมัครบัญชีแรก** = จะกลายเป็นผู้ใช้คนแรกในระบบ
   - หมายเหตุ: ผู้ใช้คนแรกอาจได้สิทธิ์ `Sales Staff` ตามค่าเริ่มต้น
     ถ้าต้องการให้เป็น **Owner** บอกผมได้ เดี๋ยวให้คำสั่ง SQL เปลี่ยน role ให้
3. ลองเพิ่มงาน 1 ชิ้น → เปิดในมืออีกเครื่อง/เบราว์เซอร์อื่นแล้วล็อกอิน → ถ้าเห็นงานเดียวกัน = **สำเร็จ! 🎉**

---

## ตั้งผู้ใช้คนแรกเป็น Owner (ถ้าต้องการ)

หลังสมัครบัญชีแรกแล้ว รันใน SQL Editor (แก้อีเมลให้ตรง):
```sql
update public.profiles set role = 'Owner'
where email = 'อีเมลที่สมัคร@example.com';
```

---

## แก้ปัญหาเบื้องต้น

- **เปิดเว็บแล้วไม่เจอหน้าล็อกอิน / ยังเป็นข้อมูลตัวอย่าง** → ค่า env ใน Netlify ยังไม่เข้า: เช็คสะกด Key ให้ตรง แล้ว Trigger deploy ใหม่
- **ล็อกอินได้แต่บางหน้า error สีแดง** → ตารางขาด: กลับไปรัน `setup_complete.sql` ในขั้น 2 ใหม่
- **สมัคร/ล็อกอินไม่ได้** → ที่ Supabase → Authentication → Providers → เปิด **Email** ให้ on
  (ถ้าไม่อยากยืนยันอีเมล: Authentication → Settings → ปิด *Confirm email*)
