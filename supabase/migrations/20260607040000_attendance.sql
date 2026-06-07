-- HR-2b: ลงเวลา เช็คอิน/เอาท์ (เซลฟี่ + GPS)
-- พนักงานเห็น/บันทึกของตัวเอง · เจ้าของ/HR เห็นทุกคน
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_selfie text,
  check_in_lat numeric,
  check_in_lng numeric,
  late_minutes int not null default 0,
  status text not null default 'on_time',
  created_at timestamptz not null default now()
);

create unique index if not exists attendance_profile_date_idx on public.attendance (profile_id, work_date);

alter table public.attendance enable row level security;

-- พนักงานอ่านของตัวเอง · เจ้าของ/HR อ่านทุกคน
drop policy if exists attendance_read on public.attendance;
create policy attendance_read
  on public.attendance for select
  to authenticated
  using (profile_id = auth.uid() or public.current_role()::text in ('Owner', 'HR'));

-- พนักงานสร้าง/แก้ของตัวเอง · เจ้าของ/HR แก้ได้ทุกคน
drop policy if exists attendance_write on public.attendance;
create policy attendance_write
  on public.attendance for all
  to authenticated
  using (profile_id = auth.uid() or public.current_role()::text in ('Owner', 'HR'))
  with check (profile_id = auth.uid() or public.current_role()::text in ('Owner', 'HR'));
