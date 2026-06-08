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
