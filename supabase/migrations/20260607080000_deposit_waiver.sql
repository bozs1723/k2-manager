-- ข้อยกเว้นมัดจำ: เจ้าของอนุมัติให้ลูกค้าบางรายไม่ต้องมัดจำ (ต้องเจ้าของอนุมัติก่อนเข้าผลิต)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.jobs add column if not exists deposit_waived boolean not null default false;
