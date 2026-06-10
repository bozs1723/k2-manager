-- CRM: ติดตามลูกค้าที่เป็นเพื่อน LINE OA + แต้มสะสม (เริ่มเก็บฐานก่อนเชื่อม LINE API)
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.customers add column if not exists line_friend boolean not null default false;
alter table public.customers add column if not exists loyalty_points integer not null default 0;
