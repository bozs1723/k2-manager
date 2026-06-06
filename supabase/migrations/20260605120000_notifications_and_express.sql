-- งานด่วน + แจ้งเตือนข้ามเครื่อง (Realtime)
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push) เพื่อเปิดใช้งาน
-- โหมด mock/localStorage ของแอปยังทำงานได้โดยไม่ต้องรันไฟล์นี้

-- 1) ธงงานด่วนบนตาราง jobs
alter table public.jobs
  add column if not exists is_express boolean not null default false;

-- 2) สถานะร้านแบบ singleton — ใช้เก็บสวิตช์ "เปิดรับงานด่วน" ให้ทั้งร้านเห็นตรงกัน
create table if not exists public.shop_state (
  id boolean primary key default true check (id),
  express_orders_enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.shop_state (id) values (true)
  on conflict (id) do nothing;

drop trigger if exists shop_state_set_updated_at on public.shop_state;
create trigger shop_state_set_updated_at
  before update on public.shop_state
  for each row execute function public.set_updated_at();

alter table public.shop_state enable row level security;

drop policy if exists "authenticated read shop state" on public.shop_state;
create policy "authenticated read shop state"
  on public.shop_state for select
  to authenticated
  using (true);

-- เฉพาะผู้จัดการ/เจ้าของเปิด-ปิดงานด่วนได้
drop policy if exists "owners managers update shop state" on public.shop_state;
create policy "owners managers update shop state"
  on public.shop_state for update
  to authenticated
  using (public.current_role()::text in ('Owner', 'Manager'))
  with check (public.current_role()::text in ('Owner', 'Manager'));

-- 3) ตารางแจ้งเตือนรายบุคคล
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  job_id uuid references public.jobs(id) on delete cascade,
  job_number text,
  job_title text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

-- อ่าน/อัปเดต/ลบได้เฉพาะแจ้งเตือนของตัวเอง
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications"
  on public.notifications for delete
  to authenticated
  using (recipient_id = auth.uid());

-- ผู้ใช้ที่ล็อกอินสร้างแจ้งเตือนถึงเพื่อนร่วมงานได้ (เช่น มอบหมายงาน/ย้ายสถานะ)
drop policy if exists "authenticated insert notifications" on public.notifications;
create policy "authenticated insert notifications"
  on public.notifications for insert
  to authenticated
  with check (true);

-- 4) เปิด Realtime ให้สองตารางนี้ (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_state'
  ) then
    alter publication supabase_realtime add table public.shop_state;
  end if;
end $$;
