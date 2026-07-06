-- ============================================================
-- Sw.Work — Smart Workflow & Production System
-- ระบบบริหารงานร้านพิมพ์ ร้านป้าย ร้านอะคริลิค และงานผลิตตามสั่ง
-- "ฝ่ายขายกรอกข้อมูลเพียงครั้งเดียว แล้วระบบสร้างเอกสารทั้งหมดอัตโนมัติ"
-- ปลอดภัย/รันซ้ำได้ (idempotent)
-- ============================================================

-- ---------- SW.Customer ----------
create table if not exists public.sw_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  line_id text,
  company text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_customers_name_idx on public.sw_customers (name);
create index if not exists sw_customers_phone_idx on public.sw_customers (phone);

-- ---------- SW.Order (Sales Order Form — จุดกรอกข้อมูลครั้งเดียว) ----------
create table if not exists public.sw_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,               -- เช่น SW2607-0001
  customer_id uuid references public.sw_customers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_line_id text,
  customer_company text,

  product_type text not null,                    -- acrylic_keychain | acrylic_sign | light_box | sticker | label | standee | pvc_board
  width numeric(10, 2) not null default 0,
  height numeric(10, 2) not null default 0,
  size_unit text not null default 'cm',          -- cm | mm | inch | m
  quantity integer not null default 1,
  shape text not null default 'rectangle',       -- circle | square | rectangle | die_cut | custom
  material text not null,                        -- acrylic_3mm | acrylic_5mm | acrylic_frost | pvc | pp_board | sticker
  printing text not null,                        -- side_1 | side_2 | uv | uv_white | uv_white_varnish
  has_hole boolean not null default false,
  hole_position text,
  hole_size text,
  accessories text[] not null default '{}',      -- ring | star_ring | heart_ring | chain | tassel
  notes text,

  unit_price numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  vat_enabled boolean not null default false,
  total numeric(12, 2) not null default 0,

  status text not null default 'quotation',
  constraint sw_orders_status_check check (status in (
    'quotation', 'waiting_confirm', 'confirmed', 'design',
    'production', 'qc', 'delivery', 'completed', 'cancelled'
  )),

  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_orders_status_idx on public.sw_orders (status, created_at desc);
create index if not exists sw_orders_customer_idx on public.sw_orders (customer_id);

-- ---------- ไฟล์แนบ (Supabase Storage) ----------
create table if not exists public.sw_order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  file_name text not null,
  file_type text,                                -- jpg | png | ai | pdf | psd
  storage_path text,
  public_url text,
  kind text not null default 'artwork',          -- artwork | mockup | reference | slip
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sw_order_files_order_idx on public.sw_order_files (order_id);

-- ---------- SW.Quote ----------
create table if not exists public.sw_quotations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  doc_number text not null unique,               -- Q-SW2607-0001
  items jsonb not null default '[]',             -- [{description, quantity, unit_price, amount}]
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  vat numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  valid_until date,
  status text not null default 'draft',          -- draft | sent | approved | rejected
  sent_via text[] not null default '{}',         -- line | email | pdf
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_quotations_order_idx on public.sw_quotations (order_id);

-- ---------- SW.Confirm (Customer Approval Sheet) ----------
create table if not exists public.sw_approvals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  doc_number text not null unique,               -- CA-SW2607-0001
  mockup_url text,
  product_image_url text,
  decision text not null default 'pending',      -- pending | approved | revision
  customer_note text,
  signature_name text,
  decided_at timestamptz,
  revision_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_approvals_order_idx on public.sw_approvals (order_id);

-- ---------- SW.Design ----------
create table if not exists public.sw_design_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  status text not null default 'waiting_design',
  constraint sw_design_status_check check (status in (
    'waiting_design', 'designing', 'sent_confirm', 'waiting_approval', 'ready_production'
  )),
  designer_id uuid references public.profiles(id) on delete set null,
  designer_name text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_design_tasks_order_idx on public.sw_design_tasks (order_id);
create index if not exists sw_design_tasks_status_idx on public.sw_design_tasks (status);

-- ---------- SW.Production (Production Sheet) ----------
create table if not exists public.sw_production_sheets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  doc_number text not null unique,               -- PS-SW2607-0001
  white_layer boolean not null default false,
  varnish_layer boolean not null default false,
  cut_line text,                                 -- คำอธิบาย/ลิงก์ไฟล์เส้นไดคัท
  hole_position text,
  qr_payload text,                               -- ข้อมูลใน QR สำหรับตามงาน
  machine text,
  operator_name text,
  status text not null default 'waiting',        -- waiting | printing | cutting | finishing | done
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_production_sheets_order_idx on public.sw_production_sheets (order_id);

-- ---------- SW.QC ----------
create table if not exists public.sw_qc_checklists (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  doc_number text not null unique,               -- QC-SW2607-0001
  check_size boolean not null default false,
  check_color boolean not null default false,
  check_quantity boolean not null default false,
  check_hole boolean not null default false,
  check_material boolean not null default false,
  check_packing boolean not null default false,
  passed boolean,
  inspector_name text,
  note text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_qc_checklists_order_idx on public.sw_qc_checklists (order_id);

-- ---------- SW.Delivery ----------
create table if not exists public.sw_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  doc_number text not null unique,               -- DL-SW2607-0001
  carrier text,                                  -- Flash | Kerry | J&T | ไปรษณีย์ไทย | รับเอง | ส่งเอง
  tracking_number text,
  ship_date date,
  address text,
  status text not null default 'waiting',        -- waiting | packed | shipped | delivered
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_deliveries_order_idx on public.sw_deliveries (order_id);

-- ---------- ประวัติสถานะ ----------
create table if not exists public.sw_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sw_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sw_status_history_order_idx on public.sw_status_history (order_id, created_at desc);

-- ============================================================
-- AI AUTOMATION — กรอกออเดอร์ครั้งเดียว ระบบสร้างเอกสารทั้ง 5 ใบอัตโนมัติ
-- 1. Quotation  2. Customer Approval Sheet  3. Production Sheet
-- 4. QC Checklist  5. Delivery Sheet
-- ============================================================
create or replace function public.sw_generate_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area numeric;
  v_subtotal numeric;
  v_vat numeric;
  v_desc text;
begin
  v_subtotal := greatest(new.unit_price * new.quantity - new.discount, 0);
  v_vat := case when new.vat_enabled then round(v_subtotal * 0.07, 2) else 0 end;
  v_desc := new.product_type || ' ' || new.width || 'x' || new.height || ' ' || new.size_unit
            || ' / ' || new.material || ' / ' || new.printing;

  -- 1. Quotation
  insert into public.sw_quotations (order_id, doc_number, items, subtotal, discount, vat, total, valid_until)
  values (
    new.id,
    'Q-' || new.order_code,
    jsonb_build_array(jsonb_build_object(
      'description', v_desc,
      'quantity', new.quantity,
      'unit_price', new.unit_price,
      'amount', new.unit_price * new.quantity
    )),
    new.unit_price * new.quantity,
    new.discount,
    v_vat,
    v_subtotal + v_vat,
    current_date + interval '15 days'
  )
  on conflict (doc_number) do nothing;

  -- 2. Customer Approval Sheet
  insert into public.sw_approvals (order_id, doc_number)
  values (new.id, 'CA-' || new.order_code)
  on conflict (doc_number) do nothing;

  -- 3. Design task (คิวกราฟิก)
  insert into public.sw_design_tasks (order_id)
  select new.id
  where not exists (select 1 from public.sw_design_tasks where order_id = new.id);

  -- 4. Production Sheet
  insert into public.sw_production_sheets (order_id, doc_number, white_layer, varnish_layer, hole_position, qr_payload)
  values (
    new.id,
    'PS-' || new.order_code,
    new.printing in ('uv_white', 'uv_white_varnish'),
    new.printing = 'uv_white_varnish',
    new.hole_position,
    'SWWORK|' || new.order_code || '|' || new.id
  )
  on conflict (doc_number) do nothing;

  -- 5. QC Checklist
  insert into public.sw_qc_checklists (order_id, doc_number)
  values (new.id, 'QC-' || new.order_code)
  on conflict (doc_number) do nothing;

  -- 6. Delivery Sheet
  insert into public.sw_deliveries (order_id, doc_number)
  values (new.id, 'DL-' || new.order_code)
  on conflict (doc_number) do nothing;

  return new;
end;
$$;

drop trigger if exists sw_orders_generate_documents on public.sw_orders;
create trigger sw_orders_generate_documents
  after insert on public.sw_orders
  for each row execute function public.sw_generate_documents();

-- บันทึกประวัติเมื่อสถานะออเดอร์เปลี่ยน
create or replace function public.sw_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.sw_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif new.status is distinct from old.status then
    insert into public.sw_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists sw_orders_log_status on public.sw_orders;
create trigger sw_orders_log_status
  after insert or update on public.sw_orders
  for each row execute function public.sw_log_status_change();

-- อัปเดต updated_at อัตโนมัติ
create or replace function public.sw_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'sw_customers', 'sw_orders', 'sw_quotations', 'sw_approvals',
    'sw_design_tasks', 'sw_production_sheets', 'sw_qc_checklists', 'sw_deliveries'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.sw_touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- RLS — ทุกคนที่ล็อกอินใช้งานได้ (แอปคุมการมองเห็นผ่านเมนูตามบทบาท)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'sw_customers', 'sw_orders', 'sw_order_files', 'sw_quotations', 'sw_approvals',
    'sw_design_tasks', 'sw_production_sheets', 'sw_qc_checklists', 'sw_deliveries', 'sw_status_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (public.current_role()::text in (''Owner'', ''Manager'', ''Admin''))',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- Storage bucket สำหรับไฟล์งาน (JPG/PNG/AI/PDF/PSD และ Mockup)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('sw-work-files', 'sw-work-files', true)
on conflict (id) do nothing;

drop policy if exists sw_work_files_read on storage.objects;
create policy sw_work_files_read on storage.objects
  for select using (bucket_id = 'sw-work-files');

drop policy if exists sw_work_files_insert on storage.objects;
create policy sw_work_files_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'sw-work-files');

drop policy if exists sw_work_files_update on storage.objects;
create policy sw_work_files_update on storage.objects
  for update to authenticated using (bucket_id = 'sw-work-files');

drop policy if exists sw_work_files_delete on storage.objects;
create policy sw_work_files_delete on storage.objects
  for delete to authenticated using (bucket_id = 'sw-work-files');

-- ============================================================
-- Realtime (idempotent)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['sw_orders', 'sw_design_tasks', 'sw_deliveries'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
