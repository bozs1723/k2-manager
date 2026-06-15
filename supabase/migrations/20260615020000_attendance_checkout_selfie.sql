-- เพิ่มรูปถ่ายตอนเช็คเอาท์ (timestamp ฝังในรูปฝั่งแอป)
-- ปลอดภัย/รันซ้ำได้
alter table public.attendance add column if not exists check_out_selfie text;
