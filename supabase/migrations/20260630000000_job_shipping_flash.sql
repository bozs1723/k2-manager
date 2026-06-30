-- ข้อมูลจัดส่ง/เรียก Flash เข้ารับ (เก็บเป็น jsonb เดียวบน jobs)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.jobs
  add column if not exists shipping jsonb;

-- เลขพัสดุ (tracking) แยกออกมาเป็นคอลัมน์เพื่อค้นหา/อ้างอิงง่าย
alter table public.jobs
  add column if not exists tracking_number text;

create index if not exists jobs_tracking_number_idx
  on public.jobs (tracking_number)
  where tracking_number is not null;
