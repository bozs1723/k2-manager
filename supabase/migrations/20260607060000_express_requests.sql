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
