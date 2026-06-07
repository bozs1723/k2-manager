-- Flow ยอมรับงานตามสาขา: เพิ่มฟิลด์สาขาผลิต + สถานะการยอมรับบนตาราง jobs
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push)
-- ปลอดภัย/รันซ้ำได้ (idempotent) — เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม

-- สาขาที่ผลิต (พะเยา / กรุงเทพ)
alter table public.jobs add column if not exists production_branch text;

-- สถานะการยอมรับงานเข้าสาขา: 'pending' (เซลสร้าง รอผู้จัดการยอมรับ) | 'accepted' | 'rejected'
-- default 'accepted' เพื่อให้งานเดิมที่มีอยู่แล้วไม่ค้างสถานะรอยอมรับ
alter table public.jobs add column if not exists acceptance text not null default 'accepted';

-- เหตุผลที่ผู้จัดการตีกลับ (ให้เซลแก้)
alter table public.jobs add column if not exists reject_reason text;
