-- ============================================================
-- K2 Manager — ไฟล์ติดตั้งฐานข้อมูลครบในไฟล์เดียว (รันรอบเดียวจบ)
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งหมด → Run
-- ปลอดภัย/รันซ้ำได้ (idempotent) — ไม่ลบข้อมูลเดิม
-- สร้างจาก: setup_safe.sql + migrations ทั้งหมดถึง 2026-06-07 (customer source)
-- ============================================================

-- ===== [1] schema หลัก (ตาราง/สิทธิ์/seed) =====
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'Owner',
      'Manager',
      'Admin',
      'Designer',
      'Production Staff',
      'Packing Staff',
      'Sales Staff'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'job_type') then
    create type public.job_type as enum (
      'DTG Shirt',
      'UV Print',
      'Laser Cut',
      'Signage',
      '3D Print',
      'Other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'job_priority') then
    create type public.job_priority as enum (
      'Normal',
      'Urgent',
      'Very Urgent',
      'Today'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum (
      'New Order',
      'Waiting for File',
      'Designing',
      'Waiting for Customer Approval',
      'Ready for Production',
      'In Production',
      'QC',
      'Packing',
      'Delivered / Picked Up',
      'Completed',
      'Cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('unpaid', 'partial', 'paid');
  end if;

  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum ('draft', 'sent', 'approved', 'expired');
  end if;
end $$;

alter type public.app_role add value if not exists 'Manager';

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null,
  tax_id text,
  branch text,
  address text,
  phone text,
  email text,
  bank_name text,
  bank_account text,
  bank_account_name text,
  quote_prefix text not null default 'WO',
  quote_terms text,
  facebook_pages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.company_settings add column if not exists name text;
alter table public.company_settings add column if not exists legal_name text;
alter table public.company_settings add column if not exists tax_id text;
alter table public.company_settings add column if not exists branch text;
alter table public.company_settings add column if not exists address text;
alter table public.company_settings add column if not exists phone text;
alter table public.company_settings add column if not exists email text;
alter table public.company_settings add column if not exists bank_name text;
alter table public.company_settings add column if not exists bank_account text;
alter table public.company_settings add column if not exists bank_account_name text;
alter table public.company_settings add column if not exists quote_prefix text default 'WO';
alter table public.company_settings add column if not exists quote_terms text;
alter table public.company_settings add column if not exists facebook_pages jsonb not null default '[]'::jsonb;
alter table public.company_settings add column if not exists updated_at timestamptz not null default now();
alter table public.company_settings add column if not exists created_at timestamptz not null default now();

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  username text unique,
  full_name text not null,
  role public.app_role not null default 'Sales Staff',
  avatar_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role public.app_role not null default 'Sales Staff';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();
create unique index if not exists profiles_username_key on public.profiles (username) where username is not null;

create table if not exists public.role_permissions (
  role public.app_role primary key,
  permissions text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.role_permissions add column if not exists permissions text[] not null default '{}';
alter table public.role_permissions add column if not exists updated_at timestamptz not null default now();
alter table public.role_permissions add column if not exists created_at timestamptz not null default now();

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  line_id text,
  email text,
  notes text,
  company_name text,
  tax_id text,
  branch text,
  billing_address text,
  accounting_email text,
  requires_invoice boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists line_id text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists notes text;
alter table public.customers add column if not exists company_name text;
alter table public.customers add column if not exists tax_id text;
alter table public.customers add column if not exists branch text;
alter table public.customers add column if not exists billing_address text;
alter table public.customers add column if not exists accounting_email text;
alter table public.customers add column if not exists requires_invoice boolean not null default false;
alter table public.customers add column if not exists created_at timestamptz not null default now();
alter table public.customers add column if not exists updated_at timestamptz not null default now();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique,
  quote_number text unique,
  quote_status public.quote_status not null default 'draft',
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_name text,
  customer_phone text,
  customer_line_id text,
  company_name text,
  tax_id text,
  branch text,
  billing_address text,
  accounting_email text,
  requires_invoice boolean not null default false,
  title text not null,
  type public.job_type not null,
  description text not null,
  quantity integer not null check (quantity > 0),
  order_date date not null default current_date,
  due_date date not null,
  priority public.job_priority not null default 'Normal',
  status public.job_status not null default 'New Order',
  assigned_designer uuid references public.profiles(id),
  assigned_production uuid references public.profiles(id),
  price numeric(12, 2) not null default 0 check (price >= 0),
  deposit numeric(12, 2) not null default 0 check (deposit >= 0),
  remaining_balance numeric(12, 2) generated always as (greatest(price - deposit, 0)) stored,
  payment_status public.payment_status generated always as (
    case
      when deposit <= 0 then 'unpaid'::public.payment_status
      when deposit >= price then 'paid'::public.payment_status
      else 'partial'::public.payment_status
    end
  ) stored,
  internal_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs add column if not exists quote_number text;
alter table public.jobs add column if not exists quote_status public.quote_status not null default 'draft';
alter table public.jobs add column if not exists customer_name text;
alter table public.jobs add column if not exists customer_phone text;
alter table public.jobs add column if not exists customer_line_id text;
alter table public.jobs add column if not exists company_name text;
alter table public.jobs add column if not exists tax_id text;
alter table public.jobs add column if not exists branch text;
alter table public.jobs add column if not exists billing_address text;
alter table public.jobs add column if not exists accounting_email text;
alter table public.jobs add column if not exists requires_invoice boolean not null default false;
alter table public.jobs add column if not exists internal_notes text;
alter table public.jobs add column if not exists created_by uuid references public.profiles(id);
alter table public.jobs add column if not exists updated_at timestamptz not null default now();
alter table public.jobs add column if not exists created_at timestamptz not null default now();

create table if not exists public.job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.job_comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists role_permissions_set_updated_at on public.role_permissions;
create trigger role_permissions_set_updated_at
before update on public.role_permissions
for each row execute function public.set_updated_at();

drop trigger if exists company_settings_set_updated_at on public.company_settings;
create trigger company_settings_set_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', nullif(split_part(new.email, '@', 1), '')),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'K2 User'),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'Sales Staff'::public.app_role)
  )
  on conflict (id) do update
    set email = excluded.email,
        username = excluded.username,
        full_name = excluded.full_name,
        role = excluded.role,
        is_active = true,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_files enable row level security;
alter table public.job_comments enable row level security;
alter table public.job_status_history enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "profiles can read team" on public.profiles;
create policy "profiles can read team"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "authenticated users read role permissions" on public.role_permissions;
create policy "authenticated users read role permissions"
on public.role_permissions for select
to authenticated
using (true);

drop policy if exists "owners and admins manage role permissions" on public.role_permissions;
create policy "owners and admins manage role permissions"
on public.role_permissions for all
to authenticated
using (public.current_role()::text in ('Owner', 'Admin'))
with check (public.current_role()::text in ('Owner', 'Admin'));

drop policy if exists "authenticated users read company settings" on public.company_settings;
create policy "authenticated users read company settings"
on public.company_settings for select
to authenticated
using (true);

drop policy if exists "owners and admins manage company settings" on public.company_settings;
create policy "owners and admins manage company settings"
on public.company_settings for all
to authenticated
using (public.current_role()::text in ('Owner', 'Admin'))
with check (public.current_role()::text in ('Owner', 'Admin'));

drop policy if exists "owners and admins manage profiles" on public.profiles;
create policy "owners and admins manage profiles"
on public.profiles for all
to authenticated
using (public.current_role()::text in ('Owner', 'Admin'))
with check (public.current_role()::text in ('Owner', 'Admin'));

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_role());

drop policy if exists "authenticated users read customers" on public.customers;
create policy "authenticated users read customers"
on public.customers for select
to authenticated
using (true);

drop policy if exists "sales admins owners manage customers" on public.customers;
create policy "sales admins owners manage customers"
on public.customers for all
to authenticated
using (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Sales Staff'))
with check (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Sales Staff'));

drop policy if exists "authenticated users read jobs" on public.jobs;
create policy "authenticated users read jobs"
on public.jobs for select
to authenticated
using (true);

drop policy if exists "staff can create and update jobs" on public.jobs;
create policy "staff can create and update jobs"
on public.jobs for all
to authenticated
using (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Designer', 'Production Staff', 'Packing Staff', 'Sales Staff'))
with check (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Designer', 'Production Staff', 'Packing Staff', 'Sales Staff'));

drop policy if exists "authenticated users read job children" on public.job_files;
create policy "authenticated users read job children"
on public.job_files for select
to authenticated
using (true);

drop policy if exists "authenticated users manage comments and files" on public.job_files;
create policy "authenticated users manage comments and files"
on public.job_files for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users read comments" on public.job_comments;
create policy "authenticated users read comments"
on public.job_comments for select
to authenticated
using (true);

drop policy if exists "authenticated users write comments" on public.job_comments;
create policy "authenticated users write comments"
on public.job_comments for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "authenticated users read status history" on public.job_status_history;
create policy "authenticated users read status history"
on public.job_status_history for select
to authenticated
using (true);

drop policy if exists "authenticated users write status history" on public.job_status_history;
create policy "authenticated users write status history"
on public.job_status_history for insert
to authenticated
with check (changed_by = auth.uid());

drop policy if exists "owners admins read audit log" on public.audit_log;
create policy "owners admins read audit log"
on public.audit_log for select
to authenticated
using (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

drop policy if exists "authenticated users write audit log" on public.audit_log;
create policy "authenticated users write audit log"
on public.audit_log for insert
to authenticated
with check (actor_id = auth.uid());

insert into public.company_settings (
  name,
  legal_name,
  tax_id,
  branch,
  address,
  phone,
  email,
  bank_name,
  bank_account,
  bank_account_name,
  quote_prefix,
  quote_terms,
  facebook_pages
)
select
  'K2Smart',
  'บริษัท เคทู ไซน์ มีเดีย จำกัด',
  '0565567000869',
  'สาขาที่ 00001',
  '38 ซอยศูนย์วิจัย 8 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพมหานคร 10310',
  '02-000-0000',
  'accounting@k2work.example',
  'Kasikorn Bank',
  '000-0-00000-0',
  'บริษัท เคทู ไซน์ มีเดีย จำกัด',
  'WO',
  'ใบสั่งงานนี้ใช้ยืนยันรายละเอียดการผลิต และเริ่มผลิตหลังลูกค้ายืนยันแบบพร้อมชำระมัดจำ',
  '["K2sign media", "K2 Smart"]'::jsonb
where not exists (select 1 from public.company_settings);

-- ============================================================
-- ===== migration: 20260605120000_notifications_and_express =====
-- ============================================================
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

-- ============================================================
-- ===== migration: 20260606000000_realtime_customers_jobs =====
-- ============================================================
-- เปิด Realtime ให้ตารางลูกค้า/งาน เพื่อซิงก์ข้ามเครื่องแบบสด
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push)
-- รันซ้ำได้ปลอดภัย

do $$
declare
  rt_table text;
begin
  foreach rt_table in array array['customers', 'jobs', 'job_comments', 'job_status_history']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = rt_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', rt_table);
    end if;
  end loop;
end $$;

-- ============================================================
-- ===== migration: 20260606120000_employee_profiles =====
-- ============================================================
-- โปรไฟล์พนักงานสไตล์เฟสบุ๊ก: ข้อมูลส่วนตัว + ข้อมูลบัญชีธนาคาร (ส่วนตัว)
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push)
-- ปลอดภัย/รันซ้ำได้ (idempotent) — เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม

-- 1) ฟิลด์โปรไฟล์สาธารณะ (ทุกคนในทีมเห็นได้) บนตาราง profiles
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists line_id text;
alter table public.profiles add column if not exists job_title text;   -- ตำแหน่ง/แผนก
alter table public.profiles add column if not exists bio text;         -- แนะนำตัว
alter table public.profiles add column if not exists cover_url text;   -- รูปปก (data URL หรือ URL)
-- หมายเหตุ: avatar_url (รูปโปรไฟล์) มีอยู่แล้วในตาราง profiles

-- 2) ข้อมูลบัญชีธนาคาร — แยกตารางต่างหาก
--    เพราะต้องจำกัดการมองเห็น: เห็นเฉพาะเจ้าตัว + เจ้าของ (Owner)
create table if not exists public.profile_bank_details (
  id uuid primary key references public.profiles(id) on delete cascade,
  bank_name text,
  bank_account_no text,
  bank_account_name text,
  updated_at timestamptz not null default now()
);

drop trigger if exists profile_bank_set_updated_at on public.profile_bank_details;
create trigger profile_bank_set_updated_at
  before update on public.profile_bank_details
  for each row execute function public.set_updated_at();

alter table public.profile_bank_details enable row level security;

-- อ่าน + เขียน ได้เฉพาะเจ้าของแถว (เจ้าตัว) หรือ Owner เท่านั้น
-- (พนักงานคนอื่นมองไม่เห็นเลขบัญชีของกันและกัน)
drop policy if exists "self or owner read bank details" on public.profile_bank_details;
create policy "self or owner read bank details"
  on public.profile_bank_details for select
  to authenticated
  using (id = auth.uid() or public.current_role()::text = 'Owner');

drop policy if exists "self or owner write bank details" on public.profile_bank_details;
create policy "self or owner write bank details"
  on public.profile_bank_details for all
  to authenticated
  using (id = auth.uid() or public.current_role()::text = 'Owner')
  with check (id = auth.uid() or public.current_role()::text = 'Owner');

-- ============================================================
-- ===== migration: 20260607000000_branch_acceptance =====
-- ============================================================
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

-- ============================================================
-- ===== migration: 20260607010000_employee_branch =====
-- ============================================================
-- รอบ 3b: สาขาประจำของพนักงานแต่ละคน (ยกเว้นเจ้าของที่เห็นทุกสาขา)
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.profiles add column if not exists branch text;

-- ============================================================
-- ===== migration: 20260607020000_hr_role_enum =====
-- ============================================================
-- HR-1: เพิ่มบทบาท HR เข้า enum app_role
-- รันไฟล์นี้ "แยกต่างหาก" ก่อนไฟล์ employee_hr (ALTER TYPE ADD VALUE ต้องรันคนละรอบ)
alter type public.app_role add value if not exists 'HR';

-- ============================================================
-- ===== migration: 20260607020001_employee_hr =====
-- ============================================================
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

-- ============================================================
-- ===== migration: 20260607030000_branch_settings =====
-- ============================================================
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

-- ============================================================
-- ===== migration: 20260607040000_attendance =====
-- ============================================================
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

-- ============================================================
-- ===== migration: 20260607050000_leave_holidays =====
-- ============================================================
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

-- ============================================================
-- ===== migration: 20260607060000_express_requests =====
-- ============================================================
-- งานด่วน: ระบบขออนุมัติรายคำขอ (เซลส์ขอ → ผู้จัดการอนุมัติ → ปลดล็อกสร้างงานด่วน)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.express_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_by_name text,
  status text not null default 'pending',      -- pending | approved | rejected
  approved_by uuid references public.profiles(id),
  approved_by_name text,
  note text,
  consumed boolean not null default false,      -- ใช้สร้างงานด่วนไปแล้วหรือยัง
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists express_requests_status_idx on public.express_requests (status, created_at desc);
create index if not exists express_requests_requester_idx on public.express_requests (requested_by, created_at desc);

alter table public.express_requests enable row level security;

-- อ่านได้ทุกคนที่ล็อกอิน (เซลส์เห็นสถานะคำขอของตัวเอง · ผู้จัดการเห็นคำขอที่รออนุมัติ)
drop policy if exists express_requests_read on public.express_requests;
create policy express_requests_read
  on public.express_requests for select
  to authenticated
  using (true);

-- สร้างคำขอ: เป็นของตัวเองเท่านั้น
drop policy if exists express_requests_insert on public.express_requests;
create policy express_requests_insert
  on public.express_requests for insert
  to authenticated
  with check (requested_by = auth.uid());

-- อนุมัติ/ปฏิเสธ: เจ้าของ/ผู้จัดการ · ส่วน consumed (ใช้สร้างงานแล้ว) เจ้าของคำขออัปเดตได้
drop policy if exists express_requests_update on public.express_requests;
create policy express_requests_update
  on public.express_requests for update
  to authenticated
  using (public.current_role()::text in ('Owner', 'Manager') or requested_by = auth.uid())
  with check (public.current_role()::text in ('Owner', 'Manager') or requested_by = auth.uid());

-- เปิด Realtime ให้ผู้จัดการเห็นคำขอใหม่แบบสด (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'express_requests'
  ) then
    alter publication supabase_realtime add table public.express_requests;
  end if;
end $$;

-- ============================================================
-- ===== migration: 20260607070000_deposit_slip =====
-- ============================================================
-- บังคับแนบสลิปมัดจำ + ผู้จัดการยืนยันยอดก่อนเข้าคิวผลิต
-- ปลอดภัย/รันซ้ำได้ (idempotent) — เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูลเดิม

alter table public.jobs add column if not exists deposit_slip text;                 -- รูปสลิป (data URL)
alter table public.jobs add column if not exists deposit_received_date date;         -- วันที่รับเงินมัดจำ
alter table public.jobs add column if not exists deposit_confirmed boolean not null default false;  -- ผู้จัดการยืนยันยอดแล้ว
alter table public.jobs add column if not exists deposit_confirmed_by uuid references public.profiles(id);
alter table public.jobs add column if not exists deposit_confirmed_at timestamptz;

-- ============================================================
-- ===== migration: 20260607080000_deposit_waiver =====
-- ============================================================
-- ข้อยกเว้นมัดจำ: เจ้าของอนุมัติให้ลูกค้าบางรายไม่ต้องมัดจำ (ต้องเจ้าของอนุมัติก่อนเข้าผลิต)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.jobs add column if not exists deposit_waived boolean not null default false;

-- ============================================================
-- ===== migration: 20260607090000_quotations =====
-- ============================================================
-- ใบเสนอราคา (Quotation) — ต้นน้ำของ flow: เสนอราคา → ลูกค้าอนุมัติ → แปลงเป็นใบงาน
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  title text not null,
  description text,
  amount numeric(12, 2) not null default 0,
  status text not null default 'draft',     -- draft | sent | approved | rejected | converted
  created_by uuid references public.profiles(id),
  created_by_name text,
  approved_at timestamptz,
  converted_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists quotations_status_idx on public.quotations (status, created_at desc);

alter table public.quotations enable row level security;

-- อ่าน/สร้าง/แก้ ได้ทุกคนที่ล็อกอิน (แอปคุมการมองเห็นผ่านเมนูตามบทบาท)
drop policy if exists quotations_read on public.quotations;
create policy quotations_read on public.quotations for select to authenticated using (true);

drop policy if exists quotations_insert on public.quotations;
create policy quotations_insert on public.quotations for insert to authenticated with check (true);

drop policy if exists quotations_update on public.quotations;
create policy quotations_update on public.quotations for update to authenticated using (true) with check (true);

drop policy if exists quotations_delete on public.quotations;
create policy quotations_delete on public.quotations for delete to authenticated using (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

-- Realtime (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quotations'
  ) then
    alter publication supabase_realtime add table public.quotations;
  end if;
end $$;

-- ============================================================
-- ===== migration: 20260607100000_customer_source =====
-- ============================================================
-- CRM: แหล่งที่มาลูกค้า + ชื่อเพจ/ชื่อไลน์
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.customers add column if not exists source_channel text;   -- Facebook | LINE | หน้าร้าน | TikTok | Website | Shopee | อื่น ๆ
alter table public.customers add column if not exists source_page text;       -- ชื่อเพจ/ชื่อไลน์ เช่น K2Sign, @k2sign
