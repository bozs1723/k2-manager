-- P1 (handoff): พนักงาน 1 คนถือได้หลายบทบาท (multi-role)
-- extra_roles = บทบาทเสริม (นอกเหนือจาก role หลัก) — สิทธิ์รวมกันฝั่งแอป
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.profiles
  add column if not exists extra_roles public.app_role[] not null default '{}';
