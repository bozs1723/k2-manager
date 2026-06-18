-- รายงานลงเวลา: จับคู่ "สาขา" → "กลุ่ม LINE" สำหรับส่งรายงานเช็คอิน/เช็คเอาท์เข้ากลุ่มแยกตามสาขา
-- ปลอดภัย/รันซ้ำได้ (idempotent)

create table if not exists public.branch_line_groups (
  branch text primary key,
  line_group_id text not null,
  updated_at timestamptz not null default now()
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
