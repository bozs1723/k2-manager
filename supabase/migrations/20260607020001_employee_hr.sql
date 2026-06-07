-- HR-1: ตารางข้อมูล HR / เงินเดือนรายคน
-- เห็นและแก้ได้เฉพาะเจ้าของ (Owner) และ HR เท่านั้น (ผ่าน RLS)
-- รันไฟล์นี้หลังจากรัน 20260607020000_hr_role_enum.sql แล้ว

create table if not exists public.employee_hr (
  id uuid primary key references public.profiles(id) on delete cascade,
  monthly_salary numeric not null default 0,
  position text,
  start_date date,
  updated_at timestamptz not null default now()
);

drop trigger if exists employee_hr_set_updated_at on public.employee_hr;
create trigger employee_hr_set_updated_at
  before update on public.employee_hr
  for each row execute function public.set_updated_at();

alter table public.employee_hr enable row level security;

drop policy if exists owner_hr_read_employee_hr on public.employee_hr;
create policy owner_hr_read_employee_hr
  on public.employee_hr for select
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR'));

drop policy if exists owner_hr_write_employee_hr on public.employee_hr;
create policy owner_hr_write_employee_hr
  on public.employee_hr for all
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR'))
  with check (public.current_role()::text in ('Owner', 'HR'));
