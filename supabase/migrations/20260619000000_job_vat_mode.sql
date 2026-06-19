-- โหมดภาษีต่องาน: none = ไม่มี VAT · inclusive = ราคารวม VAT แล้ว · exclusive = ยังไม่รวม (บวก 7%)
-- ปลอดภัย/รันซ้ำได้ (idempotent) — งานเดิมทั้งหมดถือเป็น 'none'
alter table public.jobs add column if not exists vat_mode text not null default 'none';

alter table public.jobs drop constraint if exists jobs_vat_mode_check;
alter table public.jobs add constraint jobs_vat_mode_check
  check (vat_mode in ('none', 'inclusive', 'exclusive'));
