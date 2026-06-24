-- แยกสาขา "รายได้" ออกจากสาขา "ผลิต"
--   production_branch = สาขาที่ผลิต (ตามประเภทงาน)
--   income_branch     = สาขาที่รับรายได้ (ตามเพจที่รับงาน)
-- ปลอดภัย/รันซ้ำได้ — งานเก่าที่ income_branch ว่าง รายงานจะ fallback ไปใช้ production_branch
alter table public.jobs add column if not exists income_branch text;
