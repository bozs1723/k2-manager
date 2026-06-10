-- กล่อง Lead ภายใน: บันทึกลูกค้าที่ทักเข้ามา → แปลงเป็นใบเสนอราคา
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  channel text,                              -- Facebook | LINE | หน้าร้าน | TikTok | Website | Shopee | อื่น ๆ
  page text,                                 -- ชื่อเพจ/ไลน์
  message text,
  status text not null default 'new',        -- new | contacting | quoted | won | lost
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status, created_at desc);

alter table public.leads enable row level security;

drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select to authenticated using (true);

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to authenticated with check (true);

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated using (true) with check (true);

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete to authenticated using (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

-- Realtime (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
end $$;
