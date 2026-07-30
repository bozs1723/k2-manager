-- Database Webhook: insert แถวใหม่ใน notifications → เรียก Edge Function telegram-notify
-- (ใช้ระบบแจ้งเตือนเดิม — ฟังก์ชันปลายทางเป็นคนกรองชนิดเหตุการณ์ + กันข้อความซ้ำ แล้วส่งเข้ากลุ่ม Telegram)
--
-- โปรเจกต์นี้ไม่มี schema supabase_functions (ไม่เคยสร้าง webhook จาก Dashboard)
-- จึงยิงตรงผ่าน pg_net (async ไม่บล็อกการ insert) ด้วย trigger function ของเราเอง

create extension if not exists pg_net;

create or replace function public.notify_telegram_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- payload หน้าตาเดียวกับ Database Webhook มาตรฐานของ Supabase
  perform net.http_post(
    url := 'https://fbwgmoorslblwmwftkfz.supabase.co/functions/v1/telegram-notify',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists telegram_notify_webhook on public.notifications;
create trigger telegram_notify_webhook
  after insert on public.notifications
  for each row execute function public.notify_telegram_webhook();
