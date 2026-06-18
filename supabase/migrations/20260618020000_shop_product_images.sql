-- ผูกรูปสินค้าจริง K2 Sign เข้ากับสินค้าในระบบ (ไฟล์อยู่ใน public/shop/)
-- ปลอดภัย/รันซ้ำได้ — อัปเดตตาม slug

update public.products set images = array[
  '/shop/standee-2.jpg','/shop/standee-5.jpg','/shop/standee-4.jpg','/shop/standee-3.jpg','/shop/standee-1.jpg'
] where slug = 'standee-acrylic';

update public.products set images = array[
  '/shop/keychain-1.jpg','/shop/keychain-2.jpg'
] where slug = 'acrylic-keychain';

update public.products set images = array[
  '/shop/sticker-1.jpg','/shop/sticker-2.jpg','/shop/sticker-3.jpg'
] where slug = 'sticker-print';

update public.products set images = array[
  '/shop/menu-1.jpg','/shop/menu-2.jpg','/shop/menu-3.jpg','/shop/menu-4.jpg','/shop/menu-5.jpg'
] where slug = 'menu-plaswood';

update public.products set images = array[
  '/shop/led-1.jpg','/shop/led-2.jpg'
] where slug = 'led-sign';

-- ป้ายร้าน: ใช้รูปป้ายอะคริลิคไฟออกหลัง (Gold Mirror) เป็นรูปหลัก + ปรับคำอธิบาย
update public.products set
  images = array['/shop/sign-1.jpg','/shop/sign-2.jpg','/shop/sign-3.jpg','/shop/sign-4.jpg'],
  description = 'ป้ายหน้าร้าน ป้ายบริษัท · งานเด่น ป้ายอะคริลิคไฟออกหลัง Gold Mirror หรูหรา + ป้ายไวนิล/อิงค์เจ็ท ออกแบบ+ติดตั้งครบวงจร แจ้งขนาด/แบบเพื่อขอใบเสนอราคา',
  badge = 'งานพรีเมียม'
where slug = 'shop-sign';
