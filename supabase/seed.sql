insert into public.company_settings (
  id,
  name,
  legal_name,
  tax_id,
  branch,
  address,
  phone,
  email,
  bank_name,
  bank_account,
  bank_account_name,
  quote_prefix,
  quote_terms,
  created_at,
  updated_at
)
values (
  '55555555-5555-5555-5555-555555555555',
  'K2Smart',
  'บริษัท เคทู ไซน์ มีเดีย จำกัด',
  '0565567000869',
  'สาขาที่ 00001',
  '38 ซอยศูนย์วิจัย 8 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพมหานคร 10310',
  '02-000-0000',
  'accounting@k2work.example',
  'Kasikorn Bank',
  '000-0-00000-0',
  'บริษัท เคทู ไซน์ มีเดีย จำกัด',
  'WO',
  'ใบสั่งงานนี้ใช้ยืนยันรายละเอียดการผลิต และเริ่มผลิตหลังลูกค้ายืนยันแบบพร้อมชำระมัดจำ',
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  legal_name = excluded.legal_name,
  tax_id = excluded.tax_id,
  branch = excluded.branch,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  bank_name = excluded.bank_name,
  bank_account = excluded.bank_account,
  bank_account_name = excluded.bank_account_name,
  quote_prefix = excluded.quote_prefix,
  quote_terms = excluded.quote_terms,
  updated_at = now();

insert into public.customers (id, name, phone, line_id, email, notes, company_name, tax_id, branch, billing_address, accounting_email, requires_invoice, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'Baan Bloom Cafe', '089-442-1188', '@baanbloom', 'orders@baanbloom.example', 'ชอบสีเขียวโทนอ่อน', 'Baan Bloom Cafe Co., Ltd.', '0105566000001', 'สำนักงานใหญ่', '88/12 ถนนคาเฟ่ เขตเมือง กรุงเทพฯ 10200', 'accounting@baanbloom.example', true, now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'Peak Studio', '082-113-9981', 'peakstudio', 'team@peakstudio.example', 'งานป้ายและ branding', 'Peak Studio Co., Ltd.', '0105566000002', 'สำนักงานใหญ่', '42 Studio Road Bangkok 10110', 'finance@peakstudio.example', true, now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'KMITL Robotics Club', '091-245-6630', 'kmitlbot', 'robotics@example.edu', 'งาน 3D print และอะไหล่', 'KMITL Robotics Club', '', '', '', 'robotics@example.edu', false, now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'Nara Wedding', '086-774-2110', 'nara.n', 'nara@example.com', 'งานแต่งและ signage', 'Nara Wedding Studio', '', '', '12 Wedding Lane Chiang Mai', 'nara@example.com', false, now(), now())
on conflict (id) do nothing;

insert into public.jobs (
  id,
  job_number,
  customer_id,
  title,
  type,
  description,
  quantity,
  order_date,
  due_date,
  priority,
  status,
  price,
  deposit,
  internal_notes
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'K2-1028',
    '11111111-1111-1111-1111-111111111111',
    'เสื้อพนักงานคาเฟ่ DTG รอบเติมสต็อก',
    'DTG Shirt',
    'เสื้อ cotton สีครีม พิมพ์โลโก้ด้านหน้าและสโลแกนเล็กด้านหลัง ต้องส่ง proof สีให้ลูกค้าก่อนผลิต',
    60,
    '2026-05-28',
    '2026-05-30',
    'Today',
    'Designing',
    27000,
    12000,
    'ลูกค้าชอบหมึกเขียวโทนอ่อน ไม่สดเกินไป'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'K2-1029',
    '22222222-2222-2222-2222-222222222222',
    'ป้าย QR อะคริลิกตั้งโต๊ะ',
    'UV Print',
    'ป้ายอะคริลิกใสตั้งโต๊ะ พิมพ์ UV เป็น QR และ branding ของสตูดิโอ',
    35,
    '2026-05-26',
    '2026-06-02',
    'Normal',
    'Waiting for Customer Approval',
    17500,
    8000,
    'ส่ง proof แล้ว รอลูกค้ายืนยัน URL ปลายทางของ QR'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'K2-1030',
    '33333333-3333-3333-3333-333333333333',
    'ขายึดหุ่นยนต์แข่ง',
    '3D Print',
    'พิมพ์ชิ้นส่วนขายึด PLA+ สีดำ ต้องเทสต์ fit ก่อนส่ง',
    18,
    '2026-05-30',
    '2026-06-01',
    'Urgent',
    'In Production',
    12600,
    12600,
    'เช็ค orientation ก่อนพิมพ์ทุก batch'
  )
on conflict (id) do nothing;
