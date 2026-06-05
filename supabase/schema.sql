create type public.app_role as enum (
  'Owner',
  'Manager',
  'Admin',
  'Designer',
  'Production Staff',
  'Packing Staff',
  'Sales Staff'
);

create type public.job_type as enum (
  'DTG Shirt',
  'UV Print',
  'Laser Cut',
  'Signage',
  '3D Print',
  'Other'
);

create type public.job_priority as enum (
  'Normal',
  'Urgent',
  'Very Urgent',
  'Today'
);

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

create type public.payment_status as enum ('unpaid', 'partial', 'paid');
create type public.quote_status as enum ('draft', 'sent', 'approved', 'expired');

create table public.company_settings (
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
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.profiles (
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

create table public.role_permissions (
  role public.app_role primary key,
  permissions text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.customers (
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

create table public.jobs (
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

create table public.job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.job_comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create table public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
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

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger role_permissions_set_updated_at
before update on public.role_permissions
for each row execute function public.set_updated_at();

create trigger company_settings_set_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

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
        updated_at = now();
  return new;
end;
$$;

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

create policy "profiles can read team"
on public.profiles for select
to authenticated
using (true);

create policy "authenticated users read role permissions"
on public.role_permissions for select
to authenticated
using (true);

create policy "owners and admins manage role permissions"
on public.role_permissions for all
to authenticated
using (public.current_role()::text in ('Owner', 'Admin'))
with check (public.current_role()::text in ('Owner', 'Admin'));

create policy "authenticated users read company settings"
on public.company_settings for select
to authenticated
using (true);

create policy "owners and admins manage company settings"
on public.company_settings for all
to authenticated
using (public.current_role()::text in ('Owner', 'Admin'))
with check (public.current_role()::text in ('Owner', 'Admin'));

create policy "owners and admins manage profiles"
on public.profiles for all
to authenticated
using (public.current_role()::text in ('Owner', 'Admin'))
with check (public.current_role()::text in ('Owner', 'Admin'));

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_role());

create policy "authenticated users read customers"
on public.customers for select
to authenticated
using (true);

create policy "sales admins owners manage customers"
on public.customers for all
to authenticated
using (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Sales Staff'))
with check (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Sales Staff'));

create policy "authenticated users read jobs"
on public.jobs for select
to authenticated
using (true);

create policy "staff can create and update jobs"
on public.jobs for all
to authenticated
using (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Designer', 'Production Staff', 'Packing Staff', 'Sales Staff'))
with check (public.current_role()::text in ('Owner', 'Manager', 'Admin', 'Designer', 'Production Staff', 'Packing Staff', 'Sales Staff'));

create policy "authenticated users read job children"
on public.job_files for select
to authenticated
using (true);

create policy "authenticated users manage comments and files"
on public.job_files for all
to authenticated
using (true)
with check (true);

create policy "authenticated users read comments"
on public.job_comments for select
to authenticated
using (true);

create policy "authenticated users write comments"
on public.job_comments for insert
to authenticated
with check (author_id = auth.uid());

create policy "authenticated users read status history"
on public.job_status_history for select
to authenticated
using (true);

create policy "authenticated users write status history"
on public.job_status_history for insert
to authenticated
with check (changed_by = auth.uid());

create policy "owners admins read audit log"
on public.audit_log for select
to authenticated
using (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

create policy "authenticated users write audit log"
on public.audit_log for insert
to authenticated
with check (actor_id = auth.uid());

-- งานด่วน + แจ้งเตือนข้ามเครื่อง (ดู migration 20260605120000)
alter table public.jobs
  add column if not exists is_express boolean not null default false;

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

create policy "authenticated read shop state"
on public.shop_state for select
to authenticated
using (true);

create policy "owners managers update shop state"
on public.shop_state for update
to authenticated
using (public.current_role()::text in ('Owner', 'Manager'))
with check (public.current_role()::text in ('Owner', 'Manager'));

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

create policy "users read own notifications"
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

create policy "users update own notifications"
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "users delete own notifications"
on public.notifications for delete
to authenticated
using (recipient_id = auth.uid());

create policy "authenticated insert notifications"
on public.notifications for insert
to authenticated
with check (true);

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
