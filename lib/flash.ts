// เชื่อมต่อ Flash Express Open API (เรียกขนส่งเข้ารับพัสดุเมื่องานเสร็จ)
//
// ความปลอดภัย: secret key ของ Flash ห้ามอยู่ฝั่งเบราว์เซอร์เด็ดขาด การเซ็น (sign)
// และการยิง API จริงทำที่ Supabase Edge Function `flash-create-parcel` เท่านั้น
// ไฟล์นี้เป็นฝั่ง client: ประกอบ payload (ไม่มี secret) แล้วส่งไปที่ edge function
// ถ้ายังไม่ตั้งค่า (ยังไม่มี URL/ยังไม่เปิด) จะคืนผลแบบ draft โดยไม่ยิงออกนอก
//
// เปิดใช้งานจริงเมื่อพร้อม โดยตั้ง env:
//   NEXT_PUBLIC_FLASH_PICKUP_URL = URL ของ edge function flash-create-parcel
// และตั้ง secret ฝั่ง edge function: FLASH_MCH_ID, FLASH_SECRET_KEY, FLASH_SRC_* (ที่อยู่ผู้ส่ง)

import type { Shipment } from "./types";

export type FlashPickupInput = {
  // เลขอ้างอิงฝั่งเรา (เลขงาน) เพื่อกันสร้างซ้ำ
  outTradeNo: string;
  // ผู้รับ
  dstName: string;
  dstPhone: string;
  dstProvinceName: string;
  dstCityName: string;       // อำเภอ/เขต
  dstDistrictName: string;   // ตำบล/แขวง
  dstPostalCode: string;
  dstDetailAddress: string;
  // พัสดุ
  articleCategory: string;
  weight: number;            // กรัม (Flash ใช้หน่วยกรัม)
  width?: number;            // ซม.
  length?: number;
  height?: number;
  // เก็บเงินปลายทาง
  codEnabled: 0 | 1;
  codAmount?: number;        // สตางค์ (Flash ใช้หน่วยสตางค์)
  insured: 0 | 1;
  insureDeclareValue?: number; // สตางค์
  remark?: string;
};

export type FlashPickupResult = {
  ok: boolean;
  draft: boolean;            // true = ยังไม่ได้ยิง API จริง (ยังไม่ตั้งค่า)
  trackingNumber?: string;   // pno
  sortCode?: string;
  message: string;
};

const FLASH_PICKUP_URL =
  process.env.NEXT_PUBLIC_FLASH_PICKUP_URL ?? process.env.NEXT_PUBLIC_FLASH_CREATE_PARCEL_URL ?? "";

export const isFlashConfigured = Boolean(FLASH_PICKUP_URL);

// แปลงข้อมูลจากฟอร์ม (Shipment) เป็น payload ที่ Flash ต้องการ
export function buildFlashPickupInput(outTradeNo: string, shipment: Shipment): FlashPickupInput {
  const toGrams = (kg: number) => Math.max(1, Math.round((Number.isFinite(kg) ? kg : 0) * 1000));
  const toSatang = (baht?: number) => Math.max(0, Math.round((baht ?? 0) * 100));
  return {
    outTradeNo,
    dstName: shipment.recipientName.trim(),
    dstPhone: shipment.recipientPhone.replace(/\D/g, ""),
    dstProvinceName: shipment.province.trim(),
    dstCityName: shipment.district.trim(),
    dstDistrictName: shipment.subdistrict.trim(),
    dstPostalCode: shipment.postalCode.replace(/\D/g, ""),
    dstDetailAddress: shipment.address.trim(),
    // Flash ต้องการ articleCategory เป็นรหัสตัวเลข — ส่งค่าเริ่มต้น "1" (ทั่วไป) ไว้ก่อน
    // ส่วนหมวดที่พนักงานเลือก (ข้อความไทย) แนบไปใน remark ให้ขนส่งอ่าน
    articleCategory: "1",
    weight: toGrams(shipment.weightKg),
    width: shipment.widthCm ? Math.round(shipment.widthCm) : undefined,
    length: shipment.lengthCm ? Math.round(shipment.lengthCm) : undefined,
    height: shipment.heightCm ? Math.round(shipment.heightCm) : undefined,
    codEnabled: shipment.codEnabled ? 1 : 0,
    codAmount: shipment.codEnabled ? toSatang(shipment.codAmount) : undefined,
    insured: shipment.insured ? 1 : 0,
    insureDeclareValue: shipment.insured ? toSatang(shipment.insuredValue) : undefined,
    remark: [shipment.parcelCategory?.trim(), shipment.note?.trim()].filter(Boolean).join(" · ") || undefined
  };
}

// หมวดสินค้าให้เลือกในฟอร์ม (ข้อความให้พนักงานอ่านเข้าใจ — ไม่ใช่รหัส Flash)
export const PARCEL_CATEGORY_OPTIONS = [
  "สินค้าทั่วไป",
  "เสื้อผ้า / สิ่งทอ",
  "ป้าย / งานพิมพ์",
  "ของพรีเมียม / ของชำร่วย",
  "อะคริลิค / งานเปราะบาง",
  "เอกสาร",
  "อื่น ๆ"
];

// เรียกขนส่งเข้ารับ: ถ้ายังไม่ตั้งค่า edge function จะคืน draft (ไม่ยิงออกนอก)
export async function requestFlashPickup(input: FlashPickupInput): Promise<FlashPickupResult> {
  if (!FLASH_PICKUP_URL) {
    return {
      ok: false,
      draft: true,
      message: "บันทึกข้อมูลจัดส่งแล้ว (ยังไม่ได้เชื่อม Flash API — ตั้งค่า NEXT_PUBLIC_FLASH_PICKUP_URL เพื่อเรียกเข้ารับอัตโนมัติ)"
    };
  }
  try {
    const res = await fetch(FLASH_PICKUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = (await res.json().catch(() => ({}))) as {
      pno?: string;
      trackingNumber?: string;
      sortCode?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, draft: false, message: data.error || data.message || `เรียก Flash ไม่สำเร็จ (HTTP ${res.status})` };
    }
    const tracking = data.pno || data.trackingNumber;
    if (!tracking) {
      return { ok: false, draft: false, message: data.message || data.error || "Flash ไม่ส่งเลขพัสดุกลับมา" };
    }
    return {
      ok: true,
      draft: false,
      trackingNumber: tracking,
      sortCode: data.sortCode,
      message: data.message || "เรียก Flash เข้ารับสำเร็จ"
    };
  } catch (error) {
    return {
      ok: false,
      draft: false,
      message: error instanceof Error ? `เชื่อมต่อ Flash ไม่ได้: ${error.message}` : "เชื่อมต่อ Flash ไม่ได้"
    };
  }
}

// URL ติดตามพัสดุ Flash สำหรับแสดงให้ลูกค้า
export function flashTrackingUrl(trackingNumber: string): string {
  return `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(trackingNumber)}`;
}
