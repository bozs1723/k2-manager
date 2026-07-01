-- เก็บอาร์ตเวิร์กที่ดีไซเนอร์วางลงในใบสั่งงาน (รูปงานที่ออกแบบเสร็จ + ป้ายกำกับ + จำนวน + โน้ตผลิต)
-- รูปแบบ: jsonb array ของ { id, url, label, qty, note }
-- ปลอดภัย/รันซ้ำได้
alter table public.jobs add column if not exists artwork jsonb;
