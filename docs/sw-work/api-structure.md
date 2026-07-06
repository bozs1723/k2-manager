# Sw.Work — API Structure

แอปนี้เป็น Next.js **static export** จึงไม่มี API route ฝั่งเซิร์ฟเวอร์ — "API" ของระบบคือ

1. **PostgREST ของ Supabase** (ตาราง `sw_*` + RLS) — ถูกเรียกผ่าน
2. **ชั้นข้อมูล `lib/sw-work/store.ts`** — contract เดียวที่ UI ใช้ ซึ่งสลับ backend ได้ 2 โหมด:
   - `cloud` → Supabase (ต้องล็อกอิน)
   - `demo` → localStorage (พรีวิวได้โดยไม่ต้องตั้งค่าอะไร)

## Contract ของชั้นข้อมูล

```ts
swResolveMode(): Promise<"cloud" | "demo">
// cloud เมื่อคอนฟิก NEXT_PUBLIC_SUPABASE_* และมี session

swListBundles(mode): Promise<SwDocumentBundle[]>
// ออเดอร์ทั้งหมดพร้อมเอกสารครบชุด (order + 5 เอกสาร + design task + files + history)

swCreateOrder(mode, form: SwOrderFormInput): Promise<SwDocumentBundle>
// จุดเดียวของ "กรอกครั้งเดียว" — insert sw_orders แล้วเอกสารทั้ง 5 ใบเกิดจาก DB trigger
// (โหมดเดโมใช้ swGenerateDocuments() ตรรกะเดียวกัน)

swUpdateOrderStatus(mode, orderId, status, byName?)        // เลื่อน pipeline + ลง history
swUpdateQuotation(mode, id, { status?, sentVia? })         // SW.Quote
swUpdateApproval(mode, id, { decision?, customerNote?, signatureName?, mockupUrl?, revisionCount? })
swUpdateDesign(mode, id, { status?, designerName? })       // ประทับ started_at/finished_at อัตโนมัติ
swUpdateProduction(mode, id, { status?, machine?, operatorName?, cutLine? })
swUpdateQc(mode, id, { checkSize?...checkPacking?, passed?, inspectorName?, note? })
swUpdateDelivery(mode, id, { status?, carrier?, trackingNumber?, shipDate?, address? })

swUploadFile(mode, orderId, file, kind)                    // → Supabase Storage `sw-work-files`
swSetMockupFromFile(mode, approvalId, orderId, file)       // อัปโหลด + ผูกเป็น mockup ของใบคอนเฟิร์ม
swResetDemo()                                              // ล้างข้อมูลเดโม
```

## ตาราง Supabase (เรียกผ่าน supabase-js)

| ตาราง | ใช้ทำอะไร |
|---|---|
| `sw_orders` | select / insert (trigger สร้างเอกสาร) / update status |
| `sw_quotations` `sw_approvals` `sw_design_tasks` `sw_production_sheets` `sw_qc_checklists` `sw_deliveries` | select / update ตามโมดูล |
| `sw_order_files` | select / insert (คู่กับ Storage upload) |
| `sw_status_history` | select (insert โดย trigger เท่านั้น) |
| `sw_customers` | สมุดลูกค้า (เฟสถัดไป: autocomplete/CRM) |

Realtime publication: `sw_orders`, `sw_design_tasks`, `sw_deliveries` — พร้อมให้ UI subscribe ในเฟสถัดไป

## กติกา auto-advance ของ pipeline

| เหตุการณ์ในโมดูล | สถานะออเดอร์เปลี่ยนเป็น |
|---|---|
| ส่งใบเสนอราคา (LINE/Email/PDF) | `waiting_confirm` |
| ลูกค้าอนุมัติใบคอนเฟิร์ม | `confirmed` (และ design task → `ready_production`) |
| ลูกค้าขอแก้ไข | `design` (design task → `designing`, revision_count +1) |
| กราฟิกกด "พร้อมผลิต" | `production` |
| ผลิตกด "ผลิตเสร็จ" | `qc` |
| QC ผ่าน | `delivery` |
| QC ไม่ผ่าน | `production` (ส่งกลับ) |
| จัดส่งถึงมือลูกค้า | `completed` |

## เอกสาร/เลขรหัส

- รหัสงาน: `SWYYMM-####` รันต่อเดือน (`swNextOrderCode`)
- เลขเอกสาร: `Q- / CA- / PS- / QC- / DL-` + รหัสงาน (`swDocNumbers`)
- QR ใบสั่งผลิต: `SWWORK|<order_code>|<order_id>` (`swQrPayload`) — สแกนเพื่อตามงานได้ในเฟสถัดไป
- Export PDF: ผ่าน `window.print()` + print stylesheet `#print-doc` (A4)
- ส่ง LINE: `https://line.me/R/share?text=...` / ส่ง Email: `mailto:`
