// ===== ระบบรหัสลูกค้า K2 (SOP v1) =====
// รูปแบบ: [เพจ]-[แอดมิน]-[ลำดับ]-[ปี] เช่น KS-AOM-0001-26
// ทะเบียนนี้คือ Source of Truth — ห้ามตั้งรหัสเอง
export const CUSTOMER_CODE_PAGES: { name: string; code: string }[] = [
  { name: "Sweetdesign", code: "SW" },
  { name: "K2Sign", code: "KS" },
  { name: "K2 พะเยา", code: "KP" },
  { name: "TheDecor", code: "TD" },
  { name: "MonMon", code: "MM" },
  { name: "K2STUDIO", code: "ST" },
  { name: "Fluffi", code: "FF" }
];

export const CUSTOMER_CODE_ADMINS: { name: string; code: string }[] = [
  { name: "อ้อม", code: "AOM" },
  { name: "อ้อ", code: "AOR" },
  { name: "ก้อยพัทยา", code: "KOY" },
  { name: "เหมียว", code: "MAW" },
  { name: "แคท", code: "CAT" },
  { name: "ออย", code: "OYL" },
  { name: "House / Walk-in (ไม่มีเจ้าของ)", code: "HSE" }
];

// ปี ค.ศ. 2 หลัก เช่น 2026 -> "26"
export function customerCodeYear(): string {
  return String(new Date().getFullYear()).slice(-2);
}

// ประกอบรหัสเต็ม ลำดับเติม 0 ให้ครบ 4 หลัก เช่น (KS, AOM, 1, "26") -> "KS-AOM-0001-26"
export function formatCustomerCode(page: string, admin: string, seq: number, year: string): string {
  return `${page}-${admin}-${String(seq).padStart(4, "0")}-${year}`;
}

// เลขวิ่งรวมทั้งบริษัท ไม่รีเซ็ต — เลขถัดไป = เลขสูงสุดที่เคยออก + 1
export function nextCustomerSeq(customers: { codeSeq?: number }[]): number {
  return customers.reduce((max, customer) => Math.max(max, customer.codeSeq ?? 0), 0) + 1;
}
