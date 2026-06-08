-- รับเงินส่วนที่เหลือ (ยอดคงเหลือ) + สลิป ตอนปิดงาน
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.jobs add column if not exists balance_slip text;            -- รูปสลิปยอดคงเหลือ (data URL)
alter table public.jobs add column if not exists balance_received_date date;   -- วันที่รับเงินส่วนที่เหลือ
