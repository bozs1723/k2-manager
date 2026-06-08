-- บังคับแนบสลิปมัดจำ + ผู้จัดการยืนยันยอดก่อนเข้าคิวผลิต
-- ปลอดภัย/รันซ้ำได้ (idempotent) — เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูลเดิม

alter table public.jobs add column if not exists deposit_slip text;                 -- รูปสลิป (data URL)
alter table public.jobs add column if not exists deposit_received_date date;         -- วันที่รับเงินมัดจำ
alter table public.jobs add column if not exists deposit_confirmed boolean not null default false;  -- ผู้จัดการยืนยันยอดแล้ว
alter table public.jobs add column if not exists deposit_confirmed_by uuid references public.profiles(id);
alter table public.jobs add column if not exists deposit_confirmed_at timestamptz;
