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

alter table public.company_settings add column if not exists facebook_pages jsonb not null default '[]'::jsonb;

alter table public.company_settings enable row level security;

drop policy if exists "authenticated users read company settings" on public.company_settings;
create policy "authenticated users read company settings"
on public.company_settings for select
to authenticated
using (true);

drop policy if exists "owners and admins manage company settings" on public.company_settings;
create policy "owners and admins manage company settings"
on public.company_settings for all
to authenticated
using (public.current_role() in ('Owner', 'Admin'))
with check (public.current_role() in ('Owner', 'Admin'));

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
