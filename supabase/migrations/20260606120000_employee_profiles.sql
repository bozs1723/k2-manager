-- โปรไฟล์พนักงานสไตล์เฟสบุ๊ก: ข้อมูลส่วนตัว + ข้อมูลบัญชีธนาคาร (ส่วนตัว)
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push)
-- ปลอดภัย/รันซ้ำได้ (idempotent) — เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม

-- 1) ฟิลด์โปรไฟล์สาธารณะ (ทุกคนในทีมเห็นได้) บนตาราง profiles
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists line_id text;
alter table public.profiles add column if not exists job_title text;   -- ตำแหน่ง/แผนก
alter table public.profiles add column if not exists bio text;         -- แนะนำตัว
alter table public.profiles add column if not exists cover_url text;   -- รูปปก (data URL หรือ URL)
-- หมายเหตุ: avatar_url (รูปโปรไฟล์) มีอยู่แล้วในตาราง profiles

-- 2) ข้อมูลบัญชีธนาคาร — แยกตารางต่างหาก
--    เพราะต้องจำกัดการมองเห็น: เห็นเฉพาะเจ้าตัว + เจ้าของ (Owner)
create table if not exists public.profile_bank_details (
  id uuid primary key references public.profiles(id) on delete cascade,
  bank_name text,
  bank_account_no text,
  bank_account_name text,
  updated_at timestamptz not null default now()
);

drop trigger if exists profile_bank_set_updated_at on public.profile_bank_details;
create trigger profile_bank_set_updated_at
  before update on public.profile_bank_details
  for each row execute function public.set_updated_at();

alter table public.profile_bank_details enable row level security;

-- อ่าน + เขียน ได้เฉพาะเจ้าของแถว (เจ้าตัว) หรือ Owner เท่านั้น
-- (พนักงานคนอื่นมองไม่เห็นเลขบัญชีของกันและกัน)
drop policy if exists "self or owner read bank details" on public.profile_bank_details;
create policy "self or owner read bank details"
  on public.profile_bank_details for select
  to authenticated
  using (id = auth.uid() or public.current_role()::text = 'Owner');

drop policy if exists "self or owner write bank details" on public.profile_bank_details;
create policy "self or owner write bank details"
  on public.profile_bank_details for all
  to authenticated
  using (id = auth.uid() or public.current_role()::text = 'Owner')
  with check (id = auth.uid() or public.current_role()::text = 'Owner');
