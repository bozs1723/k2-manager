# ✅ เช็กลิสต์ที่ต้องทำตอนถึงคอม (Supabase)

ทำครั้งเดียวจบ — ฝั่งเว็บ (Netlify) deploy อัตโนมัติแล้ว เหลือแค่ฝั่ง **Supabase** (SQL + Edge Functions)

---

## 1) รัน SQL (Supabase → SQL Editor)

### 1.1 รัน "ทีละบรรทัด" บรรทัดนี้ก่อน (enum รันรวมกับอันอื่นไม่ได้)
```sql
alter type public.job_type add value if not exists 'Keychain';
```

### 1.2 จากนั้นรันก้อนนี้ได้เลย (ปลอดภัย รันซ้ำได้)
```sql
-- สาขารายได้ (ตามเพจ) + ชื่อเพจ
alter table public.jobs add column if not exists income_branch text;
alter table public.jobs add column if not exists sales_page text;

-- โหมดภาษี (ถ้าเคยรันแล้วจะไม่มีผลซ้ำ)
alter table public.jobs add column if not exists vat_mode text not null default 'none';

-- แก้เคส "งานสาขาอื่นเด้งให้ผจก.ผิดสาขา" (Aphicha):
-- ตั้งสาขาที่ผลิตของงานที่ยังรออนุมัติ ให้ตรงตามประเภทงาน
update public.jobs
set production_branch = case
  when type in ('DTG Shirt', '3D Print') then 'พระรามเก้า'
  else 'พะเยา'
end
where acceptance = 'pending';
```

---

## 2) Redeploy Edge Functions (Supabase → Edge Functions → เลือกฟังก์ชัน → แท็บ Code → ลบของเก่า → วางจาก repo → Deploy)

| ฟังก์ชัน | ทำไมต้อง redeploy | ไฟล์ใน repo |
|---|---|---|
| **notify-new-order** | เพิ่ม "เด้ง LINE ตอนผู้จัดการอนุมัติ" (event approved) | `supabase/functions/notify-new-order/index.ts` |
| **daily-summary** | รายรับแยกตามเพจ (income_branch) | `supabase/functions/daily-summary/index.ts` |
| **attendance-report** | รายงาน OT รอบเย็น + วันหยุด(อาทิตย์) | `supabase/functions/attendance-report/index.ts` |

> notify-job-followup deploy + ตั้ง cron ไปแล้ว — ไม่ต้องทำซ้ำ

---

## 3) (ตัวเลือก) Secret สำหรับแจ้งออเดอร์ใหม่
ถ้ายังไม่ได้ตั้ง: Supabase → Edge Functions → Secrets
```
ORDER_NOTIFY_GROUP_ID = C5bb66f978cec656f02bd46fa0f87c9be
```

---

## 4) (ตัวเลือก) Auto-deploy ผ่าน GitHub
ทำได้เฉพาะถ้าล็อกอิน GitHub เป็นเจ้าของ repo (bozs1723) — ถ้าใช้บัญชีอื่น ข้ามได้ ใช้ redeploy เองตามข้อ 2

---

## ทดสอบหลังทำเสร็จ
- สร้างงานด้วยบัญชีเซล → กลุ่ม LINE เด้ง "ออเดอร์ใหม่รออนุมัติ" (+ เพจ)
- ผจก.กดยอมรับ → กลุ่ม LINE เด้ง "✅ ผู้จัดการอนุมัติงานแล้ว"
- ผจก.พะเยา ไม่เห็นงาน DTG อีก (เห็นเฉพาะ ป้าย/อะคริลิค/เลเซอร์/พวงกุญแจ)
- คนที่เป็นการเงิน เห็นปุ่มยืนยันมัดจำ
