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
  quote_prefix text not null default 'QT',
  quote_terms text,
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
alter table public.company_settings add column if not exists quote_prefix text default 'QT';
alter table public.company_settings add column if not exists quote_terms text;
alter table public.company_settings add column if not exists updated_at timestamptz not null default now();
alter table public.company_settings add column if not exists created_at timestamptz not null default now();

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique,
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
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role public.app_role not null default 'Sales Staff';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();

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
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'K2 User'),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'Sales Staff'::public.app_role)
  )
  on conflict (id) do update
    set email = excluded.email,
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
  quote_terms
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
  'QT',
  'ใบเสนอราคานี้มีอายุ 7 วัน และเริ่มผลิตหลังยืนยันแบบพร้อมชำระมัดจำ'
where not exists (select 1 from public.company_settings);
