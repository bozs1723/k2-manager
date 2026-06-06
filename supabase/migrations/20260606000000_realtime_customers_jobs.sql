-- เปิด Realtime ให้ตารางลูกค้า/งาน เพื่อซิงก์ข้ามเครื่องแบบสด
-- รันไฟล์นี้กับ Supabase project (SQL editor หรือ supabase db push)
-- รันซ้ำได้ปลอดภัย

do $$
declare
  rt_table text;
begin
  foreach rt_table in array array['customers', 'jobs', 'job_comments', 'job_status_history']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = rt_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', rt_table);
    end if;
  end loop;
end $$;
