# ระบบส่งสินค้า + เรียก Flash เข้ารับ (Job → Ship)

เมื่อง านผลิตเสร็จ (สถานะ QC / แพ็กของ เป็นต้นไป) พนักงานกดปุ่ม **"ส่งสินค้า"** ในหน้ารายละเอียดงาน
ระบบจะเปิดหน้าต่างกรอกข้อมูลพัสดุ (แบบเดียวกับ OrderPlus) โดย **ดึงข้อมูลผู้รับจากลูกค้าที่ผูกกับงานอัตโนมัติ**
จากนั้นบันทึกข้อมูลจัดส่ง ย้ายสถานะเป็น "จัดส่ง / รับแล้ว" และ (ถ้าตั้งค่าไว้) เรียก Flash เข้ารับ + ออกเลขพัสดุให้อัตโนมัติ

## ทำงานได้ทันทีโดยไม่ต้องมี key
ถ้ายังไม่ตั้งค่า Flash API ระบบจะ **บันทึกข้อมูลพัสดุไว้ก่อน** (สถานะ "บันทึกข้อมูลแล้ว")
ทีมงานเอาข้อมูลไปกรอกในแอป/เว็บ Flash เองได้ แล้วค่อยเปิดการเรียกอัตโนมัติทีหลัง

## เปิดเรียก Flash อัตโนมัติ (เมื่อมี merchant API)

1. รัน migration `supabase/migrations/20260630000000_job_shipping_flash.sql`
   (เพิ่มคอลัมน์ `shipping jsonb` และ `tracking_number` บนตาราง `jobs`)

2. Deploy edge function:
   ```bash
   supabase functions deploy flash-create-parcel
   ```

3. ตั้ง Secrets ของ edge function (Supabase → Edge Functions → Secrets):
   - `FLASH_MCH_ID` — merchant id จาก Flash
   - `FLASH_SECRET_KEY` — secret key จาก Flash (ใช้เซ็น SHA256)
   - `FLASH_BASE_URL` — `https://open-api.flashexpress.com` (จริง) หรือ sandbox
   - `FLASH_SRC_NAME`, `FLASH_SRC_PHONE`, `FLASH_SRC_PROVINCE`, `FLASH_SRC_CITY`,
     `FLASH_SRC_DISTRICT`, `FLASH_SRC_POSTAL`, `FLASH_SRC_ADDRESS` — ที่อยู่ผู้ส่ง (ร้าน)

4. ตั้ง env ฝั่งแอป (Netlify / .env.local):
   ```
   NEXT_PUBLIC_FLASH_PICKUP_URL="https://<project>.supabase.co/functions/v1/flash-create-parcel"
   ```

> ความปลอดภัย: `FLASH_SECRET_KEY` อยู่ฝั่ง edge function เท่านั้น ไม่หลุดไปเบราว์เซอร์
> การเซ็นคำขอ (เรียงคีย์ ASC → `&key=SECRET` → SHA256 ตัวพิมพ์ใหญ่) ทำในเซิร์ฟเวอร์

## หน่วยข้อมูลที่ส่งให้ Flash
- น้ำหนัก: กรอกเป็น **กก.** ในฟอร์ม → ระบบแปลงเป็น **กรัม** ให้ Flash
- COD / ประกัน: กรอกเป็น **บาท** → ระบบแปลงเป็น **สตางค์** ให้ Flash
- `articleCategory` ส่งค่าเริ่มต้น `1` (ทั่วไป) และแนบหมวดที่เลือกไปใน remark
  ปรับ mapping รหัสหมวดสินค้าได้ที่ `lib/flash.ts` / edge function เมื่อพร้อมใช้งานจริง

## ไฟล์ที่เกี่ยวข้อง
- `lib/types.ts` — type `Shipment` + `Job.shipping`
- `lib/flash.ts` — ประกอบ payload + เรียก edge function (คืน draft ถ้ายังไม่ตั้งค่า)
- `app/page.tsx` — ปุ่ม "ส่งสินค้า", `ShipModal`, ฟังก์ชัน `shipJob`
- `supabase/functions/flash-create-parcel/index.ts` — เซ็น + ยิง Flash Open API
- `supabase/migrations/20260630000000_job_shipping_flash.sql`
