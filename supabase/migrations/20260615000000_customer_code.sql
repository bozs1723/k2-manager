-- ระบบรหัสลูกค้า K2 (SOP v1)
-- รูปแบบ: [เพจ]-[แอดมิน]-[ลำดับ]-[ปี] เช่น KS-AOM-0001-26
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.customers add column if not exists customer_code text;  -- รหัสเต็ม เช่น KS-AOM-0001-26
alter table public.customers add column if not exists code_page text;      -- รหัสเพจ 2 ตัว เช่น KS
alter table public.customers add column if not exists code_admin text;     -- รหัสแอดมิน 3 ตัว เช่น AOM (เจ้าของค่าคอม)
alter table public.customers add column if not exists code_seq integer;    -- เลขวิ่งรวมทั้งบริษัท ไม่รีเซ็ต
alter table public.customers add column if not exists code_year text;      -- ปี ค.ศ. 2 หลัก เช่น 26

-- กันเลขลำดับซ้ำและรหัสซ้ำ (กติกาเหล็ก: เลขลำดับระบบแจกเท่านั้น)
create unique index if not exists customers_code_seq_key
  on public.customers (code_seq) where code_seq is not null;
create unique index if not exists customers_customer_code_key
  on public.customers (customer_code) where customer_code is not null and customer_code <> '';
