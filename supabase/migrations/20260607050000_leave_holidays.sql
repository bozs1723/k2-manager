-- HR-3: ใบลา (ลาป่วย/ลากิจ/ลาพักร้อน) + วันหยุดบริษัท
-- ปลอดภัย/รันซ้ำได้ (idempotent)

-- ใบลา: พนักงานสร้าง/ดูของตัวเอง · เจ้าของ/HR ดูทุกคน + อนุมัติ/ปฏิเสธ
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null default 'sick',
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists leave_requests_profile_idx on public.leave_requests (profile_id, created_at desc);

alter table public.leave_requests enable row level security;

drop policy if exists leave_read on public.leave_requests;
create policy leave_read
  on public.leave_requests for select
  to authenticated
  using (profile_id = auth.uid() or public.current_role()::text in ('Owner', 'HR'));

-- พนักงานสร้างใบลาของตัวเอง
drop policy if exists leave_insert on public.leave_requests;
create policy leave_insert
  on public.leave_requests for insert
  to authenticated
  with check (profile_id = auth.uid() or public.current_role()::text in ('Owner', 'HR'));

-- อนุมัติ/ปฏิเสธ ได้เฉพาะเจ้าของ/HR
drop policy if exists leave_update on public.leave_requests;
create policy leave_update
  on public.leave_requests for update
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR'))
  with check (public.current_role()::text in ('Owner', 'HR'));

-- วันหยุดบริษัท: อ่านได้ทุกคน · แก้เฉพาะเจ้าของ/HR
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.holidays enable row level security;

drop policy if exists holidays_read on public.holidays;
create policy holidays_read
  on public.holidays for select
  to authenticated
  using (true);

drop policy if exists holidays_write on public.holidays;
create policy holidays_write
  on public.holidays for all
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR'))
  with check (public.current_role()::text in ('Owner', 'HR'));
