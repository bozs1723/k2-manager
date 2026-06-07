-- รอบ 3b: สาขาประจำของพนักงานแต่ละคน (ยกเว้นเจ้าของที่เห็นทุกสาขา)
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.profiles add column if not exists branch text;
