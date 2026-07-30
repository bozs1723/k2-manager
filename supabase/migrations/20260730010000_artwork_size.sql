-- ขนาดอาร์ตเวิร์กต่อรูป (ใช้ทั้ง "ใบยืนยันแบบ" และ "ใบสั่งงาน" — ข้อมูลกลางชุดเดียวต่อ งาน K2-xxxx)
-- เก็บเป็นฟิลด์ sizeW / sizeH / sizeUnit ภายใน jobs.artwork (jsonb array ของ
-- { id, url, label, qty, note, sizeW, sizeH, sizeUnit }) — jsonb รับฟิลด์ใหม่ได้เลย
-- จึง "ไม่ต้องเพิ่มคอลัมน์ขนาด" ใน schema
--
-- migration นี้กันเฉพาะเคสฐานข้อมูลเก่าที่ยังไม่มีคอลัมน์ artwork — idempotent รันซ้ำได้
alter table public.jobs add column if not exists artwork jsonb;
