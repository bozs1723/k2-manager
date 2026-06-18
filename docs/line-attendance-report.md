# รายงานลงเวลาเข้ากลุ่ม LINE (แยกตามสาขา)

ส่ง "รายงานสรุป" เข้ากลุ่ม LINE ของแต่ละสาขา วันละ 2 รอบ:

- **10:30** → รายงาน **เช็คอิน** (ใครมาแล้ว/ตรงเวลา/สาย, ใครยังไม่มา)
- **18:30** → รายงาน **เช็คเอาท์** (ใครออกแล้ว, ยังไม่ออก, ขาด) + **สรุป OT วันนี้** (ชั่วโมง OT ที่ผู้จัดการเปิดให้แต่ละคน + รวมทั้งสาขา)

## โครงสร้าง

| ส่วน | ไฟล์ | หน้าที่ |
|------|------|---------|
| ตารางจับคู่สาขา→กลุ่ม | `supabase/migrations/20260618000000_branch_line_groups.sql` | เก็บ `branch` ↔ `line_group_id` |
| webhook อ่าน group ID | `supabase/functions/line-webhook/index.ts` | บอทตอบ group ID เมื่อมีคนพิมพ์ในกลุ่ม |
| ฟังก์ชันรายงาน | `supabase/functions/attendance-report/index.ts` | สร้าง+ส่งรายงานเข้ากลุ่ม (เรียกโดย cron) |

> หมายเหตุ: รายงานนับ "พนักงานของสาขา" = ทุก profile ที่ `branch` ตรงกัน **ยกเว้น role = Owner**

---

## ขั้นตอนตั้งค่า (ทำครั้งเดียว)

### 1) เปิดให้บอทเข้ากลุ่มได้
ใน **LINE Official Account Manager** (manager.line.biz) → Settings → Response settings →
เปิด **Allow bot to join group chats / อนุญาตให้เข้ากลุ่ม**

### 2) Deploy ฟังก์ชัน + ตั้ง secret
ตั้ง secret เพิ่ม (นอกจาก `LINE_CHANNEL_ACCESS_TOKEN` ที่มีอยู่แล้ว):

```
REPORT_CRON_SECRET = <สุ่มข้อความยาวๆ เป็นรหัสกันคนอื่นเรียก cron>
```

Deploy 2 ฟังก์ชันใหม่:
- `line-webhook` → **ปิด Verify JWT** (LINE เป็นคนเรียก ไม่มี JWT)
- `attendance-report` → **ปิด Verify JWT** (ใช้ x-cron-secret แทน)

(deploy ผ่าน Dashboard → Edge Functions → Deploy a new function แล้ววางโค้ดจากไฟล์ หรือ `supabase functions deploy <ชื่อ>`)

### 3) ตั้ง Webhook URL ใน LINE
LINE Developers Console → channel → แท็บ **Messaging API**:
- **Use webhook** = ON
- **Webhook URL** = `https://<project-ref>.supabase.co/functions/v1/line-webhook`
- กด **Verify** ให้ขึ้น Success

### 4) สร้างกลุ่ม + เก็บ group ID + ผูกสาขา
ทำซ้ำต่อสาขา:
1. สร้างกลุ่ม LINE ของสาขานั้น → **เชิญบอท (LINE OA) เข้ากลุ่ม**
2. พิมพ์อะไรก็ได้ในกลุ่ม 1 ข้อความ → บอทจะตอบ **Group ID** (`Cxxxxxxxx...`)
3. เอา group ID ไปผูกกับชื่อสาขา (ชื่อต้องตรงกับค่าใน `profiles.branch` เป๊ะ)
   ผ่าน Supabase → **SQL Editor**:

   ```sql
   insert into public.branch_line_groups (branch, line_group_id)
   values ('สาขาที่ 00001', 'Cxxxxxxxxxxxxxxxx')
   on conflict (branch) do update set line_group_id = excluded.line_group_id, updated_at = now();
   ```

### 5) ตั้ง Cron 2 รอบ (เวลาไทย → เก็บเป็น UTC)
Supabase → **Integrations → Cron** (หรือ Database → Cron Jobs) → New job
ตั้ง 2 งาน ให้ยิง HTTP POST ไปที่ฟังก์ชัน พร้อม header `x-cron-secret`:

| งาน | Schedule (UTC) | URL |
|-----|----------------|-----|
| เช็คอิน 10:30 ICT | `30 3 * * *` | `https://<ref>.supabase.co/functions/v1/attendance-report?kind=checkin` |
| เช็คเอาท์ 18:30 ICT | `30 11 * * *` | `https://<ref>.supabase.co/functions/v1/attendance-report?kind=checkout` |

Header ทั้งสองงาน: `x-cron-secret: <ค่า REPORT_CRON_SECRET>`

ตัวอย่าง SQL (รันใน SQL Editor — อย่า commit ค่าจริงลง repo):

```sql
select cron.schedule('attendance-checkin', '30 3 * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/attendance-report?kind=checkin',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<REPORT_CRON_SECRET>')
  );
$$);

select cron.schedule('attendance-checkout', '30 11 * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/attendance-report?kind=checkout',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<REPORT_CRON_SECRET>')
  );
$$);
```

---

## ทดสอบ
ยิงฟังก์ชันเองได้เลย (ใส่ secret ให้ตรง):
```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/attendance-report?kind=checkin" \
  -H "x-cron-secret: <REPORT_CRON_SECRET>"
```
ดูผลลัพธ์ JSON ว่า `results` แต่ละสาขา `ok: true` ไหม + กลุ่มได้รับข้อความหรือยัง

## ปรับแต่ง
- **เปลี่ยนเวลา**: แก้ cron schedule (จำไว้ว่าเป็น UTC, ไทย = UTC+7)
- **เปลี่ยนข้อความ/หัวข้อ**: แก้ฟังก์ชัน `buildCheckin` / `buildCheckout`
- **รวมเจ้าของในรายงานด้วย**: เอาเงื่อนไข `p.role !== "Owner"` ออก
