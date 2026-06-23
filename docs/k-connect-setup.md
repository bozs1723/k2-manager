# K-Connect — คู่มือเปิดใช้งาน (MVP)

K-Connect คือ Module กล่องแชทรวม (Unified Inbox) ภายใน K2 OS รวมข้อความจาก
**Facebook Messenger** และ **Instagram DM** ของหลายเพจไว้ในที่เดียว เพื่อให้พนักงาน
ตอบลูกค้า มอบหมายงาน ใส่โน้ต/แท็ก และต่อยอดเป็นใบเสนอราคาด้วยระบบเดิม

โมดูลนี้ **ไม่ใช่ระบบใหม่** — ใช้ Authentication, Customer, Quotation และ Permission
เดิมของ K2 OS ทั้งหมด

---

## 1) ฐานข้อมูล

รัน migration:

```
supabase/migrations/20260623000000_k_connect.sql
```

สร้างตาราง (idempotent + RLS + Realtime):

- `connected_pages` — เพจที่เชื่อมต่อ (+ seed 5 เพจตาม MVP)
- `inbox_conversations` — บทสนทนา (1 ลูกค้า/เพจ)
- `inbox_messages` — ข้อความ (เข้า/ออก)
- `inbox_assignments` — ประวัติการมอบหมาย
- `inbox_tags` — แท็กมาตรฐาน
- `inbox_notes` — โน้ตภายใน
- `customer_social_profiles` — ผูก PSID/IGSID เข้ากับลูกค้าเดิม

> โหมดไม่มี Supabase (mock) ใช้ข้อมูลตัวอย่างใน `lib/mock-data.ts` ได้ทันทีโดยไม่ต้องตั้งค่าอะไร

---

## 2) สิทธิ์ (Permission)

เพิ่มสิทธิ์ใหม่ 2 ตัว ใน Settings → สิทธิ์ตามบทบาท:

- `view_inbox` — เห็นเมนู K-Connect และตอบแชทในขอบเขตของตน
- `manage_inbox` — มอบหมายแชทให้คนอื่น + เห็นเพจของสาขา/ที่ได้รับสิทธิ์

ขอบเขตการมองเห็น (ทำใน UI เหมือน leads/quotations):

| บทบาท   | เห็นอะไร |
|---------|----------|
| Owner   | ทุกแชท ทุกเพจ |
| Manager | เฉพาะเพจของสาขาตน หรือเพจใน `allowed_manager_ids` |
| Staff   | เฉพาะแชทที่ถูก **Assign** ให้ตน |

---

## 3) เชื่อมต่อ Facebook Messenger / Instagram (ของจริง)

เนื่องจากแอปเป็น **static export** (ไม่มี API route ฝั่ง Next.js) การรับ-ส่งข้อความ
จึงทำผ่าน **Supabase Edge Functions**

### รับข้อความเข้า — `meta-webhook`

```
supabase functions deploy meta-webhook --no-verify-jwt
supabase secrets set META_VERIFY_TOKEN=<สุ่มสตริงของคุณ>
```

ใน Meta App → Webhooks ของ Messenger และ Instagram:

- **Callback URL**: `https://<project-ref>.functions.supabase.co/meta-webhook`
- **Verify Token**: ค่าเดียวกับ `META_VERIFY_TOKEN`
- Subscribe field: `messages`, `messaging_postbacks`

ฟังก์ชันจะแม็พ `entry.id` (Page ID / IG account ID) กับ
`connected_pages.external_page_id` แล้ว upsert เป็น conversation + message อัตโนมัติ
(trigger จะอัปเดต preview / unread / last_message_at ให้)

### ส่งข้อความตอบกลับ — `meta-send`

```
supabase functions deploy meta-send
```

แอปจะเขียนข้อความ `direction = out` ลงตารางเองก่อน แล้วเรียก `meta-send` เพื่อยิง
Graph API Send API (best-effort) — ถ้ายังไม่ผูก token ข้อความจะถูกบันทึกในระบบตามปกติ

### ผูกเพจ + Token

ในตาราง `connected_pages` กำหนดให้แต่ละเพจ:

- `external_page_id` = Facebook Page ID / IG Business Account ID
- `page_access_token` = Page Access Token (เก็บฝั่ง server เท่านั้น — ไม่ส่งให้ client)
- `branch` = สาขาที่ดูแล (ใช้กั้นสิทธิ์ผู้จัดการ)

---

## 4) ขอบเขต MVP

ทำแล้ว: Unified Inbox, Chat Window (ประวัติ/ส่ง/เวลา/สถานะอ่าน), Assign, Internal Notes,
Tags, Customer Card, ปุ่ม Create Quotation (เข้าระบบใบเสนอราคาเดิม), Dashboard

ยังไม่ทำ (ตามสั่ง): LINE OA, Shopee, TikTok, AI Chatbot/Auto Reply/Lead Scoring, Automation
