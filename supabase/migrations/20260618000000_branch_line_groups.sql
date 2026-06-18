-- รายงานลงเวลา: จับคู่ "สาขา" → "กลุ่ม LINE"
-- รองรับ 1 กลุ่มรับได้หลายสาขา (กลุ่มหุ้นส่วน) และ 1 สาขาส่งได้หลายกลุ่ม
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.branch_line_groups (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  line_group_id text not null,
  updated_at timestamptz not null default now(),
  unique (branch, line_group_id)
);

alter table public.branch_line_groups enable row level security;

-- อ่าน/แก้ได้เฉพาะ Owner / HR (Edge Function ใช้ service_role จึงข้าม RLS อยู่แล้ว)
drop policy if exists branch_line_groups_read on public.branch_line_groups;
create policy branch_line_groups_read
  on public.branch_line_groups for select
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR'));

drop policy if exists branch_line_groups_write on public.branch_line_groups;
create policy branch_line_groups_write
  on public.branch_line_groups for all
  to authenticated
  using (public.current_role()::text in ('Owner', 'HR'))
  with check (public.current_role()::text in ('Owner', 'HR'));
