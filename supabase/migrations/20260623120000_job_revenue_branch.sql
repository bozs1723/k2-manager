-- แยก "สาขารายได้" (revenue_branch) ออกจาก "สาขาที่ผลิต" (production_branch)
--   เดิม: สรุปสิ้นวันคิดรายได้จาก production_branch → งานที่ขายโดยพระรามเก้าแต่ตั้ง
--         สาขาผลิตเป็นพะเยา (ค่าดีฟอลต์เดิม) ทำให้รายได้ไปโผล่ผิดสาขา
--   ใหม่: เงิน (มัดจำ/ปิดยอด) นับเข้า revenue_branch — แยกอิสระจากสาขาที่ลงมือผลิต
-- ปลอดภัย/รันซ้ำได้ (idempotent)

alter table public.jobs
  add column if not exists revenue_branch text;

-- Backfill: งานเดิมทั้งหมดให้สาขารายได้ = สาขาที่ผลิต (หรือสาขาบิลถ้าไม่มี)
-- รันเฉพาะแถวที่ยังว่าง เพื่อไม่ทับค่าที่แก้ไปแล้ว (รันซ้ำได้)
update public.jobs
set revenue_branch = coalesce(nullif(production_branch, ''), nullif(branch, ''))
where revenue_branch is null or revenue_branch = '';

-- ── แก้รายการที่ลงผิดสาขา (ตามที่ทีมยืนยัน) ───────────────────────────────────
-- งานมัดจำ ฿1,600 รับวันที่ 2026-06-23 ที่ถูกตั้งสาขาผลิตเป็น "พะเยา"
-- จริง ๆ เป็นรายได้ของ "พระรามเก้า" → ย้ายเฉพาะสาขารายได้ (ไม่แตะสาขาที่ผลิต)
-- หมายเหตุ: เงื่อนไขเจาะจง (วันที่+ยอด+สาขาผลิต) ถ้าตรงมากกว่า 1 ใบให้ตรวจ job_number
--           ด้วย SELECT ก่อน แล้วปรับ WHERE ให้ตรงใบที่ต้องการ
update public.jobs
set revenue_branch = 'พระรามเก้า'
where deposit_received_date = '2026-06-23'
  and round(coalesce(deposit, 0)) = 1600
  and coalesce(production_branch, '') = 'พะเยา'
  and coalesce(revenue_branch, '') = 'พะเยา';
