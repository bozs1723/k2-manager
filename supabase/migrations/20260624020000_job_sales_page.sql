-- เก็บชื่อเพจที่รับงาน (เพื่อโชว์ตอนอนุมัติ + แจ้งเข้า LINE)
-- ปลอดภัย/รันซ้ำได้
alter table public.jobs add column if not exists sales_page text;
