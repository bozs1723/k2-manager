-- แนบไฟล์งานจริง (Supabase Storage) + ดู/ดาวน์โหลดในแอป
-- ปลอดภัย/รันซ้ำได้

-- 1) คอลัมน์ url เก็บลิงก์ไฟล์
alter table public.job_files add column if not exists url text;

-- 2) bucket เก็บไฟล์งาน (อ่านสาธารณะ)
insert into storage.buckets (id, name, public)
values ('job-files', 'job-files', true)
on conflict (id) do nothing;

-- 3) สิทธิ์: อ่านสาธารณะ · ผู้ล็อกอินอัปโหลด/ลบได้
drop policy if exists job_files_read on storage.objects;
create policy job_files_read on storage.objects
  for select to public using (bucket_id = 'job-files');

drop policy if exists job_files_insert on storage.objects;
create policy job_files_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'job-files');

drop policy if exists job_files_delete on storage.objects;
create policy job_files_delete on storage.objects
  for delete to authenticated using (bucket_id = 'job-files');
