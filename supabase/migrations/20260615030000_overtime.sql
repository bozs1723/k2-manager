-- ระบบ OT: ผู้จัดการสาขาเปิด OT ให้พนักงานของสาขาตัวเอง (เชื่อมเงินเดือน)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.overtime (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  hours numeric not null default 0,
  note text,
  branch text,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists overtime_profile_date_idx on public.overtime (profile_id, work_date);

alter table public.overtime enable row level security;

-- อ่าน: เจ้าของแถว · เจ้าของร้าน/HR/ผู้จัดการ
drop policy if exists overtime_read on public.overtime;
create policy overtime_read
  on public.overtime for select
  to authenticated
  using (profile_id = auth.uid() or public.current_role()::text in ('Owner', 'HR', 'Manager'));

-- เขียน: เจ้าของร้าน/HR/ผู้จัดการ (จำกัดเฉพาะสาขาตัวเองฝั่งแอป)
drop policy if exists overtime_write on public.overtime;
create policy overtime_write
  on public.overtime for all
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR', 'Manager'))
  with check (public.current_role()::text in ('Owner', 'HR', 'Manager'));
