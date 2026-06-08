-- B: ด่านการเงิน (เสนอราคา -> มัดจำ -> ตรวจสอบยอด -> มัดจำแล้ว) + บทบาทฝ่ายการเงิน
-- ปลอดภัย/รันซ้ำได้ (idempotent) — เป็น DDL ล้วน ไม่มีการใช้ค่าใหม่ในสคริปต์เดียวกัน

-- เพิ่ม 4 สถานะการเงินเข้า enum job_status (ใช้กับ jobs.status และ job_status_history)
alter type public.job_status add value if not exists 'Quotation';
alter type public.job_status add value if not exists 'Waiting Deposit';
alter type public.job_status add value if not exists 'Verifying Payment';
alter type public.job_status add value if not exists 'Deposit Confirmed';

-- เพิ่มบทบาท 'Accounting' (ฝ่ายการเงิน) เข้า enum app_role
alter type public.app_role add value if not exists 'Accounting';
