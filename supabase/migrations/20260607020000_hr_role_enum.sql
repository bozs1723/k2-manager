-- HR-1: เพิ่มบทบาท HR เข้า enum app_role
-- รันไฟล์นี้ "แยกต่างหาก" ก่อนไฟล์ employee_hr (ALTER TYPE ADD VALUE ต้องรันคนละรอบ)
alter type public.app_role add value if not exists 'HR';
