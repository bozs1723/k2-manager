# แจ้งเตือนทีมเข้า Telegram (กลุ่มเดียว)

flow: แอป insert `notifications` (ระบบเดิม) → trigger `telegram_notify_webhook` (pg_net) →
Edge Function `telegram-notify` → Telegram Bot API `sendMessage` เข้ากลุ่มทีม

- เหตุการณ์ที่ส่งเข้ากลุ่ม: `assigned` (มอบหมายงาน) · `status_moved` (เปลี่ยนสถานะ/ส่ง-รับงาน) · `due_soon` (ใกล้/เลยกำหนด) · `express_request` / `express_decision` (งานด่วน)
- กันสแปม: แจ้งเตือนชุดเดียวกันที่ insert หลายแถว (ผู้รับหลายคน) ส่งเข้ากลุ่มครั้งเดียว (เทียบ งาน+ชนิด+ข้อความ ในหน้าต่าง 60 วิ)
- ข้อความไทยกระชับ เช่น `🔔 งาน K2-1234 มอบหมายให้ สมชาย แล้ว — ป้ายหน้าร้าน`

## สิ่งที่ deploy แล้ว (โปรเจกต์ fbwgmoorslblwmwftkfz)

1. Edge Function `telegram-notify` (verify_jwt = false เพื่อรับ webhook — แบบเดียวกับ notify-* ตัวอื่น)
2. Migration `telegram_webhook`: trigger after insert on `public.notifications` → pg_net POST เข้าฟังก์ชัน

## สิ่งที่รอเจ้าของ (ทำครั้งเดียว)

1. สร้างบอทกับ **@BotFather** → ได้ `TELEGRAM_BOT_TOKEN`
2. ดึงบอทเข้ากลุ่มทีม แล้วหา `chat_id` ของกลุ่ม (เช่น ส่งข้อความในกลุ่มแล้วเปิด
   `https://api.telegram.org/bot<TOKEN>/getUpdates` ดูค่า `chat.id` — กลุ่มจะเป็นเลขติดลบ เช่น `-100xxxxxxxxxx`)
3. ตั้ง Secrets: Dashboard → Project Settings → Edge Functions → Secrets
   - `TELEGRAM_BOT_TOKEN` = โทเคนจากข้อ 1
   - `TELEGRAM_CHAT_ID` = chat_id จากข้อ 2
   (หรือ CLI: `supabase secrets set TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=-100xxx`)

## ทดสอบส่งเข้ากลุ่ม 1 ครั้ง

```bash
curl -sS -X POST "https://fbwgmoorslblwmwftkfz.supabase.co/functions/v1/telegram-notify" \
  -H "Content-Type: application/json" -d '{"test": true}'
```

ผลตอนนี้ (30 ก.ค. 2026): `{"ok":true,"note":"ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — ข้ามการแจ้งเตือน"}`
→ ระบบพร้อมแล้ว เหลือแค่ตั้ง secret 2 ตัวข้างบน แล้วรันคำสั่งเดิม ควรได้ `{"ok":true,...}` และข้อความทดสอบเด้งในกลุ่ม

## deploy ใหม่เอง (ถ้าแก้โค้ดฟังก์ชัน)

```bash
supabase functions deploy telegram-notify --project-ref fbwgmoorslblwmwftkfz --no-verify-jwt
```
