-- เพิ่มประเภทงาน "พวงกุญแจ" (Keychain) เข้า enum job_type
-- ปลอดภัย/รันซ้ำได้ (if not exists, PG12+)
alter type public.job_type add value if not exists 'Keychain';
