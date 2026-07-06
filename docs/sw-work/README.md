# Sw.Work — Smart Workflow & Production System

ระบบบริหารงานร้านพิมพ์ ร้านป้าย ร้านอะคริลิค และงานผลิตตามสั่ง

> **"ฝ่ายขายกรอกข้อมูลเพียงครั้งเดียว แล้วระบบสร้างเอกสารทั้งหมดอัตโนมัติ"**

เปิดใช้งานที่เส้นทาง **`/sw-work`** ของแอปนี้ (Next.js static export เดียวกับ K2Smart)

- ยังไม่ตั้งค่า Supabase หรือยังไม่ล็อกอิน → ระบบทำงานใน **โหมดเดโม** (เก็บข้อมูลใน localStorage พร้อมตัวอย่างงาน 3 รายการ)
- ตั้งค่า Supabase + ล็อกอินแล้ว → ระบบทำงานใน **โหมด Cloud** เต็มรูปแบบ (ต้องรัน migration `supabase/migrations/20260706000000_sw_work.sql` ก่อน)

---

## Business Flow

```
Sales → Quotation → Customer Confirm → Design → Production → QC → Delivery → Completed
```

สถานะออเดอร์ (`sw_orders.status`):

| สถานะ | ความหมาย |
|---|---|
| `quotation` | สร้างใบเสนอราคาแล้ว |
| `waiting_confirm` | ส่งให้ลูกค้าแล้ว รอคอนเฟิร์ม |
| `confirmed` | ลูกค้าอนุมัติแบบ/ราคาแล้ว |
| `design` | อยู่ในคิวกราฟิก |
| `production` | กำลังผลิต |
| `qc` | รอตรวจ/กำลังตรวจคุณภาพ |
| `delivery` | แพ็ก/จัดส่ง |
| `completed` | จบงาน |
| `cancelled` | ยกเลิก |

## Modules

| โมดูล | หน้าที่ | เอกสาร |
|---|---|---|
| **SW.Quote** | ใบเสนอราคา คำนวณราคาอัตโนมัติ รองรับส่วนลด + VAT, Export PDF, ส่งผ่าน LINE/Email | `Q-<รหัสงาน>` |
| **SW.Confirm** | ใบคอนเฟิร์มลูกค้า: รูปสินค้า, Mockup, ขนาด, เส้นไดคัท, ตำแหน่งรู, สเปกวัสดุ, จำนวน, หมายเหตุ, ช่องอนุมัติ (□ อนุมัติ / □ ขอแก้ไข + ลายเซ็น + วันที่) | `CA-<รหัสงาน>` |
| **SW.Design** | คิวกราฟิก 5 สถานะ: รอออกแบบ → กำลังออกแบบ → ส่งคอนเฟิร์มแล้ว → รออนุมัติ → พร้อมผลิต | — |
| **SW.Production** | ใบสั่งผลิต: รหัสงาน, ลูกค้า, รูป, จำนวน, ขนาด, วัสดุ, วิธีพิมพ์, White/Varnish Layer, Cut Line, Hole Position, **QR Code** ตามงาน | `PS-<รหัสงาน>` |
| **SW.QC** | เช็กลิสต์ 6 ข้อ: ขนาด/สี/จำนวน/รูเจาะ/วัสดุ/แพ็ก + ผ่าน/ไม่ผ่าน (ไม่ผ่าน = ส่งกลับผลิตอัตโนมัติ) | `QC-<รหัสงาน>` |
| **SW.Delivery** | เลขพัสดุ, บริษัทขนส่ง, วันที่ส่ง, สถานะ (ส่งถึงมือ = ปิดงานอัตโนมัติ) | `DL-<รหัสงาน>` |

## AI Automation — กรอกครั้งเดียว ได้เอกสารครบ

เมื่อฝ่ายขายกด "สร้างออเดอร์" ระบบสร้างให้ทันที **ใน transaction เดียว**:

1. **Quotation** — รายการสินค้า + ราคา + ส่วนลด + VAT + ยืนราคา 15 วัน
2. **Customer Approval Sheet** — สเปกครบ พร้อมช่องอนุมัติ
3. **Production Sheet** — เลเยอร์พิมพ์/ไดคัท/รูเจาะ ตั้งค่าจากข้อมูลฟอร์มอัตโนมัติ + QR
4. **QC Checklist** — 6 ข้อรอติ๊ก
5. **Delivery Sheet** — รอใส่เลขพัสดุ

กลไก: **trigger `sw_generate_documents`** ในฐานข้อมูล (โหมด Cloud) และฟังก์ชัน `swGenerateDocuments()` ใน `lib/sw-work/documents.ts` (โหมดเดโม) — ตรรกะเดียวกัน มีเทสต์ครอบ

## เครื่องคำนวณราคาอัตโนมัติ

`lib/sw-work/pricing.ts` — ราคา/ชิ้น = ค่าวัสดุตามพื้นที่ (มีขั้นต่ำต่อชิ้น) × ตัวคูณวิธีพิมพ์ + ค่าเจาะรู + ค่าอุปกรณ์เสริม แล้วเสนอส่วนลดตามจำนวน (50+ ชิ้น = 5%, 100+ = 10%, 200+ = 15%, 500+ = 20%) ฝ่ายขาย override ราคาและส่วนลดเองได้เสมอ

## Sales Order Form (ข้อมูลที่ฝ่ายขายกรอก)

Customer (ชื่อ/โทร/LINE/บริษัท) • Product Type (7 ชนิด) • Size (กว้าง×สูง + หน่วย) • Quantity • Shape (5 แบบ) • Material (6 ชนิด) • Printing (5 วิธี) • Hole (ตำแหน่ง+ขนาด) • Accessory (5 ชนิด) • Uploaded Files (JPG/PNG/AI/PDF/PSD → Supabase Storage bucket `sw-work-files`) • Notes • Due Date

## Design Style

Modern • Minimal • Professional • Apple Style — พื้นหลังขาว (`#ffffff`), ตัวอักษรเข้ม (`#1d1d1f`), Accent สีส้ม (`orange-500 #f97316`), การ์ดมุมโค้ง `rounded-2xl`, ฟอนต์ Nunito + Noto Sans Thai

## Folder Structure

```
k2-manager/
├── app/
│   └── sw-work/
│       ├── layout.tsx            # metadata + ธีมพื้นขาว (.sw-root)
│       └── page.tsx              # แอปหลัก: แดชบอร์ด / ฟอร์มขาย / บอร์ด / รายการ / รายละเอียด
├── components/
│   └── sw-work/
│       ├── SwOrderForm.tsx       # Sales Order Form + คำนวณราคาสด
│       ├── SwOrderDetail.tsx     # แท็บเอกสาร 5 ใบ + การทำงานแต่ละโมดูล
│       ├── SwDocuments.tsx       # เทมเพลตเอกสารพิมพ์ได้ทั้ง 5 ใบ
│       └── SwQr.tsx              # QR Code ตามงาน
├── lib/
│   └── sw-work/
│       ├── types.ts              # ชนิดข้อมูล + ตัวเลือก + ป้ายชื่อภาษาไทย
│       ├── pricing.ts (+ test)   # เครื่องคำนวณราคาอัตโนมัติ
│       ├── documents.ts (+ test) # สร้างเอกสารครบชุด / เลขเอกสาร / รหัสงาน
│       └── store.ts              # ชั้นข้อมูล Supabase + โหมดเดโม
├── supabase/
│   └── migrations/
│       └── 20260706000000_sw_work.sql   # ตาราง + trigger + RLS + Storage + Realtime
└── docs/sw-work/
    ├── README.md                 # ไฟล์นี้
    ├── er-diagram.md             # ER Diagram
    ├── api-structure.md          # โครงสร้าง API / ชั้นข้อมูล
    └── mvp-roadmap.md            # แผนพัฒนา MVP → SaaS
```

## Technology

- **Frontend**: Next.js 14 (static export) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres + RLS + Trigger + Realtime)
- **Storage**: Supabase Storage (`sw-work-files`)
- **Auth**: Supabase Auth (ใช้ session ร่วมกับแอป K2Smart)

## การทดสอบ

```bash
npm run test:sw-pricing     # เครื่องคำนวณราคา
npm run test:sw-documents   # การสร้างเอกสาร/เลขเอกสาร/รหัสงาน
```
