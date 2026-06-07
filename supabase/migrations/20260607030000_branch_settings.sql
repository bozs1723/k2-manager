-- HR-2a: ตั้งค่าลงเวลาแต่ละสาขา (เวลาเข้า-ออกงาน, สายได้กี่นาที, พิกัด GPS, รัศมี)
-- อ่านได้ทุกคน (พนักงานต้องรู้เวลา/พิกัดสาขาตัวเองตอนเช็คอิน) · แก้ได้เฉพาะเจ้าของ/HR
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.branch_settings (
  branch text primary key,
  work_start text not null default '09:00',
  work_end text not null default '18:00',
  late_grace_minutes int not null default 5,
  gps_lat numeric,
  gps_lng numeric,
  radius_m int not null default 150,
  updated_at timestamptz not null default now()
);

drop trigger if exists branch_settings_set_updated_at on public.branch_settings;
create trigger branch_settings_set_updated_at
  before update on public.branch_settings
  for each row execute function public.set_updated_at();

alter table public.branch_settings enable row level security;

drop policy if exists branch_settings_read on public.branch_settings;
create policy branch_settings_read
  on public.branch_settings for select
  to authenticated
  using (true);

drop policy if exists branch_settings_write on public.branch_settings;
create policy branch_settings_write
  on public.branch_settings for all
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR'))
  with check (public.current_role()::text in ('Owner', 'HR'));
