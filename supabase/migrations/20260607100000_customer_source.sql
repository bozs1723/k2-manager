-- CRM: แหล่งที่มาลูกค้า + ชื่อเพจ/ชื่อไลน์
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.customers add column if not exists source_channel text;   -- Facebook | LINE | หน้าร้าน | TikTok | Website | Shopee | อื่น ๆ
alter table public.customers add column if not exists source_page text;       -- ชื่อเพจ/ชื่อไลน์ เช่น K2Sign, @k2sign
