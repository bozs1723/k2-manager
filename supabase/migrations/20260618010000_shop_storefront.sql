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
  min_qty int not null default 1,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  shop_name text not null default 'K2Smart',
  hero_title text not null default 'งานพิมพ์ & ป้าย สั่งทำคุณภาพ ผลิตไว',
  hero_subtitle text not null default 'เลือกสินค้าที่ต้องการ แจ้งจำนวน แล้วสั่งผ่าน LINE ได้ทันที',
  line_url text,
  phone text,
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

-- ===================== 9) ข้อมูลตัวอย่างเริ่มต้น (seed) =====================
insert into public.product_categories (slug, name, description, sort) values
  ('flags', 'ป้ายธง / ธงญี่ปุ่น', 'ธงญี่ปุ่น ธงเซลส์ ป้ายหน้าร้าน', 1),
  ('shirts', 'เสื้อ DTG / สกรีน', 'เสื้อพิมพ์ลายคุณภาพสูง สั่งทำตามแบบ', 2),
  ('signage', 'ป้าย / Signage', 'ป้ายไวนิล ป้ายอะคริลิค ป้ายโลโก้', 3),
  ('acrylic', 'งานอะคริลิค', 'กล่อง ป้าย ของพรีเมียมอะคริลิค', 4)
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, description, base_price, unit, lead_time_days, badge, images, options, price_tiers, sort)
select c.id, v.name, v.slug, v.description, v.base_price, v.unit, v.lead_time_days, v.badge, v.images, v.options::jsonb, v.price_tiers::jsonb, v.sort
from (values
  ('flags', 'ป้ายธงญี่ปุ่น (J-Flag)', 'j-flag', 'ธงญี่ปุ่นพร้อมฐาน ผลิตไว ใช้หน้าร้าน/อีเวนต์ ขนาดมาตรฐาน 50x150 ซม.', 970, 'ชุด', 3, 'ขายดี',
    array['https://images.unsplash.com/photo-1561049501-e1f96bdd98fd?w=800'],
    '[{"name":"ฐาน","choices":[{"label":"ฐานกลม","priceDelta":0},{"label":"ฐานเหลี่ยม","priceDelta":120},{"label":"ฐานปูน","priceDelta":320}]},{"name":"ขนาด","choices":[{"label":"50x150 ซม.","priceDelta":0},{"label":"60x180 ซม.","priceDelta":180}]}]',
    '[{"minQty":1,"price":970},{"minQty":6,"price":920},{"minQty":12,"price":870}]', 1),
  ('shirts', 'เสื้อยืดพิมพ์ลาย DTG', 'dtg-tee', 'เสื้อ Cotton 100% พิมพ์ DTG สีคมชัด สั่งขั้นต่ำ 1 ตัว', 250, 'ตัว', 5, null,
    array['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
    '[{"name":"ไซซ์","choices":[{"label":"S","priceDelta":0},{"label":"M","priceDelta":0},{"label":"L","priceDelta":0},{"label":"XL","priceDelta":20},{"label":"2XL","priceDelta":40}]}]',
    '[{"minQty":1,"price":250},{"minQty":10,"price":220},{"minQty":50,"price":190}]', 1),
  ('acrylic', 'ป้ายโลโก้อะคริลิคตัวนูน', 'acrylic-logo', 'ป้ายโลโก้อะคริลิคตัวนูน ติดผนัง/หน้าร้าน งานเนี้ยบ', 1500, 'งาน', 7, 'พรีเมียม',
    array['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'],
    '[{"name":"ขนาด","choices":[{"label":"30 ซม.","priceDelta":0},{"label":"50 ซม.","priceDelta":900},{"label":"100 ซม.","priceDelta":2500}]}]',
    '[{"minQty":1,"price":1500}]', 1)
) as v(cat_slug, name, slug, description, base_price, unit, lead_time_days, badge, images, options, price_tiers, sort)
join public.product_categories c on c.slug = v.cat_slug
on conflict (slug) do nothing;
