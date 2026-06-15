-- เพิ่มประเภทงาน "อะคริลิค" เข้า enum job_type
-- ปลอดภัย/รันซ้ำได้ (if not exists, PG12+)
alter type public.job_type add value if not exists 'Acrylic';
