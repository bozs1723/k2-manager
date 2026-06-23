-- K-Connect (MVP) — Unified Inbox สำหรับ Facebook Messenger + Instagram DM ของหลายเพจ
--   รวมแชททุกเพจ → มอบหมายพนักงาน → โน้ตภายใน → แท็ก → เชื่อมลูกค้า/ใบเสนอราคาเดิม
-- ปลอดภัย/รันซ้ำได้ (idempotent)

-- ── เพจที่เชื่อมต่อ (Facebook Page / Instagram Account) ───────────────────────
create table if not exists public.connected_pages (
  id uuid primary key default gen_random_uuid(),
  page_name text not null,                       -- K2 Sign | K2 Phayao | Fluffi.pet | K2Studio.DTG | K2 Premium
  platform text not null default 'facebook',     -- facebook | instagram
  external_page_id text,                          -- Facebook Page ID / Instagram Business Account ID
  page_access_token text,                         -- token สำหรับส่งข้อความ (server-side เท่านั้น)
  branch text,                                    -- สาขาที่ดูแลเพจนี้ (ใช้กั้นสิทธิ์ผู้จัดการ)
  allowed_manager_ids uuid[] not null default '{}',-- ผู้จัดการที่ได้รับสิทธิ์เพจนี้ (เพิ่มเติมจากสาขา)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform, external_page_id)
);

create index if not exists connected_pages_active_idx on public.connected_pages (is_active, page_name);

-- ── บทสนทนา (1 ห้องแชท = 1 ลูกค้า ต่อ 1 เพจ) ─────────────────────────────────
create table if not exists public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.connected_pages(id) on delete set null,
  platform text not null default 'facebook',     -- facebook | instagram
  external_thread_id text,                        -- PSID / IGSID ของลูกค้า
  customer_name text not null default 'ลูกค้า',
  customer_avatar text,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'new',             -- new | assigned | waiting_customer | closed
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  unread_count int not null default 0,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (page_id, external_thread_id)
);

create index if not exists inbox_conversations_status_idx on public.inbox_conversations (status, last_message_at desc);
create index if not exists inbox_conversations_page_idx on public.inbox_conversations (page_id, last_message_at desc);
create index if not exists inbox_conversations_assignee_idx on public.inbox_conversations (assigned_to, last_message_at desc);

-- ── ข้อความ ──────────────────────────────────────────────────────────────────
create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  direction text not null default 'in',           -- in (จากลูกค้า) | out (เจ้าหน้าที่ตอบ)
  sender_name text,
  body text,
  attachment_url text,
  attachment_type text,                           -- image | file | sticker | ...
  external_message_id text,
  is_read boolean not null default false,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (conversation_id, external_message_id)
);

create index if not exists inbox_messages_conversation_idx on public.inbox_messages (conversation_id, created_at);

-- ── การมอบหมาย (ประวัติ assign — แถวล่าสุด = ผู้รับผิดชอบปัจจุบัน) ────────────
create table if not exists public.inbox_assignments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists inbox_assignments_conversation_idx on public.inbox_assignments (conversation_id, created_at desc);

-- ── แท็ก (New Lead | Follow Up | Waiting Quote | Waiting Payment | In Production | Completed | VIP) ──
create table if not exists public.inbox_tags (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  tag text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (conversation_id, tag)
);

create index if not exists inbox_tags_conversation_idx on public.inbox_tags (conversation_id);

-- ── โน้ตภายใน (ลูกค้าไม่เห็น) ─────────────────────────────────────────────────
create table if not exists public.inbox_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  body text not null,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);

create index if not exists inbox_notes_conversation_idx on public.inbox_notes (conversation_id, created_at);

-- ── โปรไฟล์โซเชียลของลูกค้า (ผูก PSID/IGSID กับลูกค้าในระบบเดิม) ───────────────
create table if not exists public.customer_social_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  platform text not null default 'facebook',      -- facebook | instagram
  external_id text not null,                       -- PSID / IGSID
  page_id uuid references public.connected_pages(id) on delete set null,
  handle text,
  display_name text,
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);

create index if not exists customer_social_profiles_customer_idx on public.customer_social_profiles (customer_id);

-- ── เก็บชื่อผู้รับผิดชอบ + พรีวิวข้อความล่าสุด ให้ inbox_conversations อัตโนมัติ ─
create or replace function public.inbox_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inbox_conversations
  set last_message_preview = left(coalesce(new.body, '[ไฟล์แนบ]'), 160),
      last_message_at = new.created_at,
      unread_count = case when new.direction = 'in' then unread_count + 1 else 0 end,
      status = case when new.direction = 'in' and status = 'closed' then 'new' else status end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists inbox_messages_touch on public.inbox_messages;
create trigger inbox_messages_touch
after insert on public.inbox_messages
for each row execute function public.inbox_touch_conversation();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- อ่าน/เขียนได้ทุกคนที่ล็อกอิน (แอปคุมการมองเห็นตามเพจ/การมอบหมายในชั้น UI
-- เหมือนกับ leads/quotations) — ลบเฉพาะ Owner/Manager/Admin
do $$
declare t text;
begin
  foreach t in array array[
    'connected_pages','inbox_conversations','inbox_messages',
    'inbox_assignments','inbox_tags','inbox_notes','customer_social_profiles'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format($f$create policy %I on public.%I for delete to authenticated using (public.current_role()::text in ('Owner','Manager','Admin'))$f$, t || '_delete', t);
  end loop;
end $$;

-- เพจ/โทเคน เป็นข้อมูลตั้งค่าระบบ — แก้ไขได้เฉพาะ Owner/Admin
drop policy if exists connected_pages_update on public.connected_pages;
create policy connected_pages_update on public.connected_pages
  for update to authenticated
  using (public.current_role()::text in ('Owner','Admin'))
  with check (public.current_role()::text in ('Owner','Admin'));

drop policy if exists connected_pages_insert on public.connected_pages;
create policy connected_pages_insert on public.connected_pages
  for insert to authenticated
  with check (public.current_role()::text in ('Owner','Admin'));

-- ── Realtime (idempotent) ─────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['inbox_conversations','inbox_messages','inbox_tags','inbox_notes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── เพจเริ่มต้นตาม MVP (idempotent — กันซ้ำด้วยชื่อเพจ) ────────────────────────
insert into public.connected_pages (page_name, platform, branch)
select v.page_name, v.platform, v.branch
from (values
  ('K2 Sign', 'facebook', 'พะเยา'),
  ('K2 Phayao', 'facebook', 'พะเยา'),
  ('Fluffi.pet', 'facebook', 'พระรามเก้า'),
  ('K2Studio.DTG', 'facebook', 'พระรามเก้า'),
  ('K2 Premium', 'facebook', 'พระรามเก้า')
) as v(page_name, platform, branch)
where not exists (
  select 1 from public.connected_pages p where p.page_name = v.page_name
);
