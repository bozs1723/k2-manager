# แจ้งเตือนเจ้าของผ่าน LINE เมื่อพนักงานเช็คอิน

ทุกครั้งที่พนักงานเช็คอินเข้างานสำเร็จ ระบบจะส่งข้อความ LINE ถึงเจ้าของทันที
ผ่าน LINE Messaging API (push message) โดย Channel Access Token ถูกเก็บฝั่ง
เซิร์ฟเวอร์ (Supabase Edge Function) เท่านั้น ไม่หลุดมาที่เบราว์เซอร์

ตัวอย่างข้อความ:

```
เช็คอินเข้างาน
👤 สมชาย ใจดี
🕘 08:45 น.
🏢 สาขา สีลม
🟢 ตรงเวลา
```

## โครงสร้าง

- ฝั่งแอป: `app/page.tsx` → ฟังก์ชัน `checkIn()` เรียก `notifyOwnerCheckInLine()`
  ซึ่ง `invoke` Edge Function แบบ fire-and-forget (ถ้าส่ง LINE ล้มเหลว
  การเช็คอินยังสำเร็จปกติ)
- ฝั่งเซิร์ฟเวอร์: `supabase/functions/notify-checkin-line/index.ts`
  ตรวจ JWT ผู้เรียก → ดึงชื่อ/สาขาจาก `profiles` เอง (กันปลอมชื่อ) →
  push เข้า LINE

## สิ่งที่ต้องเตรียม (ทำครั้งเดียว)

1. **สร้าง LINE Official Account + Messaging API channel**
   - ไปที่ https://developers.line.biz/console/ → สร้าง Provider → สร้าง
     channel แบบ **Messaging API**
   - คัดลอก **Channel access token (long-lived)** จากแท็บ Messaging API

2. **หา userId ของเจ้าของ**
   - ให้เจ้าของ **แอดเป็นเพื่อน** กับ LINE OA นี้ก่อน (สำคัญ — push หาคนที่
     ไม่ได้เป็นเพื่อนไม่ได้)
   - หา userId ได้จาก webhook event (ฟิลด์ `source.userId`) หรือเครื่องมือ
     ทดสอบใน LINE Developers console

3. **ตั้งค่า secret ใน Supabase แล้ว deploy**

   ```bash
   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="<channel access token>"
   supabase secrets set LINE_OWNER_USER_ID="<userId ของเจ้าของ>"
   # ส่งหาหลายคนได้ คั่นด้วย , เช่น "Uxxxx,Uyyyy"

   supabase functions deploy notify-checkin-line
   ```

## ปรับแต่งภายหลัง

- **เพิ่มผู้รับ** (เช่น ผจก.สาขา): ใส่ userId เพิ่มใน `LINE_OWNER_USER_ID`
  คั่นด้วย `,`
- **เปลี่ยนข้อความ**: แก้ตัวแปร `text` ใน
  `supabase/functions/notify-checkin-line/index.ts`
- **แจ้งเฉพาะคนมาสาย**: เพิ่มเงื่อนไข `if (status !== "late") return ...`
  ก่อนยิง push ในฟังก์ชัน
