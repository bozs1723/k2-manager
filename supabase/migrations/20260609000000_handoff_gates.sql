-- P2: ระบบส่ง–รับงาน (handoff gate) — ผู้ส่งกดส่ง / ผู้รับตรวจ-รับ-หรือตีกลับ
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.jobs add column if not exists handoff_status text;        -- null=ไม่มี, 'pending', 'accepted'
alter table public.jobs add column if not exists handoff_gate text;          -- รหัสด่าน เช่น 'design_review'
alter table public.jobs add column if not exists handoff_from_user uuid references public.profiles(id);  -- ผู้ส่ง (ใช้กฎ 4-eyes)
alter table public.jobs add column if not exists handoff_from_status public.job_status;  -- สถานะเดิม (ไว้ตีกลับ)
alter table public.jobs add column if not exists handoff_note text;          -- เหตุผลตีกลับ / หมายเหตุ
