-- หน้าร้านออนไลน์ (Storefront) สำหรับลูกค้าเลือกสินค้า → สั่งผ่านฟอร์ม/LINE
-- เก็บสินค้า/หมวด/คำสั่งซื้อใน Supabase · ปลอดภัย/รันซ้ำได้ (idempotent)
--
-- โครงสร้าง:
--   product_categories  หมวดสินค้า (เช่น ป้ายธง, เสื้อ, อะคริลิค)
--   products            สินค้า + ราคาขั้นบันได + ตัวเลือก (ขนาด/วัสดุ) + รูป
--   shop_orders         คำสั่งซื้อจากหน้าร้าน (อนุญาตให้ลูกค้าทั่วไป/anon ส่งเข้ามาได้)
--   shop_settings       ตั้งค่าร้าน (ชื่อร้าน, LINE, เบอร์, ข้อความ hero) แถวเดียว
--   trigger             แปลงคำสั่งซื้อใหม่ → Lead ในระบบหลังบ้านอัตโนมัติ

-- ===================== 1) หมวดสินค้า =====================
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===================== 2) สินค้า =====================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  slug text unique,
  description text,
  base_price numeric not null default 0,           -- ราคาเริ่มต้น (ต่อหน่วย)
  unit text not null default 'ชิ้น',
  lead_time_days int,                              -- ผลิตเร็วกี่วัน (โชว์ "ผลิตเร็ว X วัน")
  badge text,                                      -- ป้ายมุมการ์ด เช่น "ขายดี"
  images text[] not null default '{}',             -- ลิงก์รูป (Supabase Storage / ภายนอก)
  options jsonb not null default '[]',             -- [{name, choices:[{label, priceDelta}]}]
  price_tiers jsonb not null default '[]',         -- [{minQty, price}] ราคาขั้นบันได (ยิ่งเยอะยิ่งถูก)
  pricing_mode text not null default 'fixed',      -- fixed | matrix | area | quote
  matrix jsonb,                                    -- ตาราง จำนวน×ขนาด (พวงกุญแจ)
  area jsonb,                                       -- ราคาต่อ ตร.ม. (ไวนิล/สติกเกอร์)
  min_qty int not null default 1,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- รองรับกรณีตารางมีอยู่แล้ว (รันซ้ำได้)
alter table public.products add column if not exists pricing_mode text not null default 'fixed';
alter table public.products add column if not exists matrix jsonb;
alter table public.products add column if not exists area jsonb;

create index if not exists products_category_idx on public.products (category_id, sort);
create index if not exists products_active_idx on public.products (active, sort);

-- ===================== 3) คำสั่งซื้อจากหน้าร้าน =====================
create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  category_name text,
  customer_name text not null,
  customer_phone text not null,
  line_id text,
  quantity int not null default 1,
  options jsonb not null default '[]',             -- ตัวเลือกที่ลูกค้าเลือก [{name, value}]
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  note text,
  status text not null default 'new',              -- new | contacting | quoted | won | lost
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shop_orders_status_idx on public.shop_orders (status, created_at desc);

-- ===================== 4) ตั้งค่าร้าน (แถวเดียว) =====================
create table if not exists public.shop_settings (
  id int primary key default 1,
  shop_name text not null default 'K2 Sign · ร้านป้ายพะเยา',
  hero_title text not null default 'ร้านป้ายพะเยา ครบวงจร งานด่วนรอรับได้!',
  hero_subtitle text not null default 'ไวนิล สติกเกอร์ สแตนดี้ พวงกุญแจ ป้ายทุกชนิด · ออกแบบฟรี เลือกสินค้าแล้วสั่งผ่าน LINE ได้ทันที',
  line_url text default 'https://lin.ee/k2sign',
  phone text default '065-989-5887',
  facebook_url text,
  updated_at timestamptz not null default now(),
  constraint shop_settings_singleton check (id = 1)
);

insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- ===================== 5) Trigger: คำสั่งซื้อใหม่ → Lead =====================
create or replace function public.shop_order_to_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_lead_id uuid;
  summary text;
begin
  summary :=
    'สั่งจากหน้าร้าน: ' || coalesce(NEW.product_name, '-') ||
    ' x' || NEW.quantity ||
    ' · รวม ฿' || to_char(NEW.total_price, 'FM999,999,990') ||
    case when NEW.options is not null and jsonb_array_length(NEW.options) > 0
      then ' · ตัวเลือก: ' || NEW.options::text else '' end ||
    case when coalesce(NEW.note, '') <> '' then ' · หมายเหตุ: ' || NEW.note else '' end;

  insert into public.leads (name, phone, channel, page, message, status)
  values (NEW.customer_name, NEW.customer_phone, 'Website', 'ร้านค้าออนไลน์', summary, 'new')
  returning id into new_lead_id;

  NEW.lead_id := new_lead_id;
  return NEW;
end;
$$;

drop trigger if exists shop_order_to_lead_trg on public.shop_orders;
create trigger shop_order_to_lead_trg
  before insert on public.shop_orders
  for each row execute function public.shop_order_to_lead();

-- ===================== 6) RLS =====================
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_settings enable row level security;

-- หมวด: ลูกค้าทั่วไปเห็นเฉพาะที่เปิดอยู่ · ทีมเห็นทั้งหมด · แอดมินจัดการ
drop policy if exists product_categories_read_anon on public.product_categories;
create policy product_categories_read_anon on public.product_categories
  for select to anon using (active = true);
drop policy if exists product_categories_read_auth on public.product_categories;
create policy product_categories_read_auth on public.product_categories
  for select to authenticated using (true);
drop policy if exists product_categories_write on public.product_categories;
create policy product_categories_write on public.product_categories
  for all to authenticated
  using (public.current_role()::text in ('Owner', 'Manager', 'Admin'))
  with check (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

-- สินค้า: ลูกค้าทั่วไปเห็นเฉพาะที่เปิดขาย · ทีมเห็นทั้งหมด · แอดมินจัดการ
drop policy if exists products_read_anon on public.products;
create policy products_read_anon on public.products
  for select to anon using (active = true);
drop policy if exists products_read_auth on public.products;
create policy products_read_auth on public.products
  for select to authenticated using (true);
drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all to authenticated
  using (public.current_role()::text in ('Owner', 'Manager', 'Admin'))
  with check (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

-- คำสั่งซื้อ: ลูกค้าทั่วไป "ส่งเข้ามา" ได้ (insert) · ทีมอ่าน/อัปเดต · แอดมินลบ
drop policy if exists shop_orders_insert_anon on public.shop_orders;
create policy shop_orders_insert_anon on public.shop_orders
  for insert to anon, authenticated with check (true);
drop policy if exists shop_orders_read on public.shop_orders;
create policy shop_orders_read on public.shop_orders
  for select to authenticated using (true);
drop policy if exists shop_orders_update on public.shop_orders;
create policy shop_orders_update on public.shop_orders
  for update to authenticated using (true) with check (true);
drop policy if exists shop_orders_delete on public.shop_orders;
create policy shop_orders_delete on public.shop_orders
  for delete to authenticated
  using (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

-- ตั้งค่าร้าน: ทุกคนอ่านได้ (หน้าร้านต้องใช้ LINE/เบอร์) · แอดมินแก้ไข
drop policy if exists shop_settings_read on public.shop_settings;
create policy shop_settings_read on public.shop_settings
  for select to anon, authenticated using (true);
drop policy if exists shop_settings_write on public.shop_settings;
create policy shop_settings_write on public.shop_settings
  for update to authenticated
  using (public.current_role()::text in ('Owner', 'Manager', 'Admin'))
  with check (public.current_role()::text in ('Owner', 'Manager', 'Admin'));

-- ===================== 7) Storage bucket รูปสินค้า =====================
insert into storage.buckets (id, name, public)
values ('shop-images', 'shop-images', true)
on conflict (id) do nothing;

drop policy if exists shop_images_read on storage.objects;
create policy shop_images_read on storage.objects
  for select to public using (bucket_id = 'shop-images');
drop policy if exists shop_images_insert on storage.objects;
create policy shop_images_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'shop-images');
drop policy if exists shop_images_delete on storage.objects;
create policy shop_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'shop-images');

-- ===================== 8) Realtime (idempotent) =====================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shop_orders') then
    alter publication supabase_realtime add table public.shop_orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='products') then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;

-- ===================== 9) ข้อมูลสินค้าจริง K2 Sign (seed) =====================
insert into public.product_categories (slug, name, description, sort) values
  ('standee', 'สแตนดี้อะคริลิค', 'งานพิมพ์ UV + เลเซอร์ตัดอะคริลิค ราคาตามขนาด', 1),
  ('keychain', 'พวงกุญแจอะคริลิค', 'พวงกุญแจอะคริลิค ฟรีโซ่ไข่ปลา ราคาตามจำนวน+ขนาด', 2),
  ('vinyl', 'ไวนิล', 'พิมพ์ไวนิล Konica/EPSON หมึกแท้ คิดราคาต่อ ตร.ม.', 3),
  ('sticker', 'สติกเกอร์', 'PVC, 3M, แบ็คลิท, ฉลากสินค้า คิดราคาต่อ ตร.ม.', 4),
  ('signage', 'ป้าย & งานสั่งทำ', 'ป้ายร้าน ป้ายไฟ เมนูพลาสวูด ตัวอักษร CNC (ขอใบเสนอราคา)', 5)
on conflict (slug) do nothing;

-- (A) fixed: สแตนดี้อะคริลิค — ราคาตามขนาด
insert into public.products (category_id, name, slug, description, base_price, unit, lead_time_days, badge, options, price_tiers, pricing_mode, min_qty, sort)
select c.id, 'สแตนดี้อะคริลิค', 'standee-acrylic',
  'งานพิมพ์ UV เลเซอร์ตัดอะคริลิค เลือกขนาดได้ · XL (11-15 ซม.) ราคา 129-189฿ ขึ้นกับแบบงาน',
  39, 'ชิ้น', 5, 'ยอดนิยม',
  '[{"name":"ขนาด","choices":[{"label":"Mini (3-4 ซม.)","priceDelta":0},{"label":"S (5-6 ซม.)","priceDelta":20},{"label":"M (7-8 ซม.)","priceDelta":40},{"label":"L (9-10 ซม.)","priceDelta":60},{"label":"XL (11-15 ซม.)","priceDelta":150}]}]'::jsonb,
  '[]'::jsonb, 'fixed', 1, 1
from public.product_categories c where c.slug = 'standee'
on conflict (slug) do nothing;

-- (B) matrix: พวงกุญแจอะคริลิค — ตาราง จำนวน × ขนาด
insert into public.products (category_id, name, slug, description, base_price, unit, lead_time_days, badge, pricing_mode, matrix, min_qty, sort)
select c.id, 'พวงกุญแจอะคริลิค', 'acrylic-keychain',
  'พวงกุญแจอะคริลิคพิมพ์ UV ฟรีโซ่ไข่ปลาสีเงิน · ระยะเวลาผลิต 3-7 วันขึ้นกับจำนวน',
  16, 'ชิ้น', 7, 'ขายดี', 'matrix',
  '{
    "sizeLabel":"ขนาด",
    "sizes":["3 ซม.","4 ซม.","5 ซม.","6 ซม.","7 ซม.","8 ซม.","9 ซม.","10 ซม."],
    "tiers":[
      {"label":"1-9 ชิ้น","minQty":1,"prices":[80,85,90,95,100,130,140,150]},
      {"label":"10-19 ชิ้น","minQty":10,"prices":[39,44,49,54,59,64,69,74]},
      {"label":"20-49 ชิ้น","minQty":20,"prices":[35,40,45,50,55,60,65,70]},
      {"label":"50-99 ชิ้น","minQty":50,"prices":[29,34,39,44,49,54,59,64]},
      {"label":"100-199 ชิ้น","minQty":100,"prices":[19,24,29,34,39,44,49,54]},
      {"label":"200-299 ชิ้น","minQty":200,"prices":[17,22,27,31,36,41,46,51]},
      {"label":"500+ ชิ้น","minQty":500,"prices":[16,20,25,29,34,39,43,47]}
    ],
    "addons":[{"name":"งาน 2 ด้าน (พิมพ์อีกด้าน)","perSize":[5,5,10,10,15,15,20,20]}],
    "freebie":"ฟรีโซ่ไข่ปลาสีเงิน"
  }'::jsonb, 1, 1
from public.product_categories c where c.slug = 'keychain'
on conflict (slug) do nothing;

-- (C) area: ไวนิล — ราคาต่อ ตร.ม.
insert into public.products (category_id, name, slug, description, base_price, unit, lead_time_days, badge, pricing_mode, area, min_qty, sort)
select c.id, 'ป้ายไวนิลพิมพ์', 'vinyl-print',
  'พิมพ์ไวนิล Konica 512i 3.2M / EPSON หมึกแท้ เกรด 2-3 ปี · ลดราคาเมื่อสั่ง 50 ตร.ม. ขึ้นไป',
  60, 'ตร.ม.', 1, 'เริ่ม 60฿', 'area',
  '{
    "unitLabel":"ตร.ม.","minSqm":1,
    "materials":[
      {"name":"Konica หลังขาว 360G","tiers":[{"minSqm":0,"price":80},{"minSqm":50,"price":60}]},
      {"name":"Konica หลังขาว 400G","tiers":[{"minSqm":0,"price":90},{"minSqm":50,"price":70}]},
      {"name":"Konica หลังดำ 360G","tiers":[{"minSqm":0,"price":90},{"minSqm":50,"price":70}]},
      {"name":"Konica หลังดำ 400G","tiers":[{"minSqm":0,"price":100},{"minSqm":50,"price":80}]},
      {"name":"EPSON หมึกแท้ หลังขาว 400G","tiers":[{"minSqm":0,"price":150}]},
      {"name":"EPSON หมึกแท้ หลังดำ 400G","tiers":[{"minSqm":0,"price":150}]},
      {"name":"EPSON ทึบกันแสง","tiers":[{"minSqm":0,"price":300}]},
      {"name":"EPSON เทาโปร่งแสงตู้ไฟ 440G","tiers":[{"minSqm":0,"price":350}]},
      {"name":"EPSON ทึบสะท้อนแสง 510G","tiers":[{"minSqm":0,"price":350}]}
    ],
    "addons":[
      {"name":"ตอกตาไก่ + ซีลขอบ","pricePerSqm":10},
      {"name":"เคลือบเงา/ฝ้า","pricePerSqm":100},
      {"name":"รีดซีลทับ PP Board 3 มิล","pricePerSqm":120},
      {"name":"รีดซีลทับ PP Board 5 มิล","pricePerSqm":180}
    ]
  }'::jsonb, 1, 1
from public.product_categories c where c.slug = 'vinyl'
on conflict (slug) do nothing;

-- (D) area: สติกเกอร์ — ราคาต่อ ตร.ม.
insert into public.products (category_id, name, slug, description, base_price, unit, lead_time_days, badge, pricing_mode, area, min_qty, sort)
select c.id, 'สติกเกอร์พิมพ์', 'sticker-print',
  'สติกเกอร์ PVC / 3M / แบ็คลิทตู้ไฟ / ฉลากสินค้า UV คิดราคาต่อ ตร.ม.',
  350, 'ตร.ม.', 2, null, 'area',
  '{
    "unitLabel":"ตร.ม.","minSqm":1,
    "materials":[
      {"name":"PVC ขาว","tiers":[{"minSqm":0,"price":350}]},
      {"name":"PVC ใส","tiers":[{"minSqm":0,"price":390}]},
      {"name":"สติกเกอร์ขาว 3M หลังเทา","tiers":[{"minSqm":0,"price":400}]},
      {"name":"แบ็คลิทตู้ไฟ","tiers":[{"minSqm":0,"price":450}]},
      {"name":"PP / Photo","tiers":[{"minSqm":0,"price":450}]},
      {"name":"แคนวาส","tiers":[{"minSqm":0,"price":450}]},
      {"name":"ฉลากสินค้า 3P UV","tiers":[{"minSqm":0,"price":550}]}
    ],
    "addons":[
      {"name":"เคลือบเงา/ฝ้า","pricePerSqm":100},
      {"name":"ไดคัท/ตัดตามรูปทรง","pricePerSqm":50}
    ]
  }'::jsonb, 1, 1
from public.product_categories c where c.slug = 'sticker'
on conflict (slug) do nothing;

-- (E) quote: ป้าย & งานสั่งทำ — ขอใบเสนอราคา
insert into public.products (category_id, name, slug, description, base_price, unit, lead_time_days, badge, options, pricing_mode, min_qty, sort)
select c.id, v.name, v.slug, v.description, 0, 'งาน', null, v.badge, v.options::jsonb, 'quote', 1, v.sort
from (values
  ('ป้ายร้าน / ป้ายบริษัท', 'shop-sign', 'ป้ายหน้าร้าน ป้ายบริษัท ไวนิล/อิงค์เจ็ท/ป้ายไฟ ออกแบบ+ติดตั้งครบวงจร แจ้งขนาดเพื่อขอใบเสนอราคา', null, '[]', 1),
  ('ป้ายไฟ LED', 'led-sign', 'ป้ายไฟ LED ป้ายตู้ไฟ สว่างชัดเจน ทนทาน แจ้งขนาด/รูปแบบเพื่อประเมินราคา', null, '[]', 2),
  ('เมนูอาหารพลาสวูด (พิมพ์ UV)', 'menu-plaswood', 'ป้ายเมนูอาหารพลาสวูด พิมพ์ UV กันน้ำ เลือกขนาด A4/A3/A2/A1', 'Best Seller',
    '[{"name":"ขนาด","choices":[{"label":"A4"},{"label":"A3"},{"label":"A2"},{"label":"A1"}]}]', 3),
  ('ตัวอักษร / ตัดเลเซอร์ / CNC', 'letter-cnc', 'ตัวอักษรพลาสวูด อะคริลิค โลหะ ตัดเลเซอร์ และงาน CNC ตามแบบ', null, '[]', 4)
) as v(name, slug, description, badge, options, sort)
cross join public.product_categories c where c.slug = 'signage'
on conflict (slug) do nothing;
