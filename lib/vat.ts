// ตรรกะภาษีมูลค่าเพิ่ม (VAT 7%) สำหรับงาน/เอกสาร
// 3 โหมด: none = ไม่มีภาษี · inclusive = ราคารวม VAT แล้ว · exclusive = ยังไม่รวม (บวก 7%)

export type VatMode = "none" | "inclusive" | "exclusive";

export const VAT_RATE = 0.07;

export const VAT_MODES: VatMode[] = ["none", "inclusive", "exclusive"];

export const vatModeLabel: Record<VatMode, string> = {
  none: "ไม่มี VAT",
  inclusive: "ราคารวม VAT แล้ว",
  exclusive: "ยังไม่รวม VAT (บวก 7%)"
};

// แปลงค่าที่อาจไม่ถูกต้องให้เป็นโหมดที่รองรับ (กันข้อมูลเก่า/ค่าว่าง)
export function normalizeVatMode(value: unknown): VatMode {
  return value === "inclusive" || value === "exclusive" ? value : "none";
}

// คำนวณฐานภาษี / VAT / ยอดรวม จากราคาที่กรอก + โหมด
//   none      → ฐาน = ราคา, VAT = 0, รวม = ราคา
//   exclusive → ฐาน = ราคา, VAT = ราคา×7%, รวม = ราคา×1.07
//   inclusive → รวม = ราคา, ฐาน = ราคา/1.07, VAT = รวม − ฐาน
export function computeVat(price: number, mode: VatMode): { base: number; vat: number; total: number } {
  const p = Number.isFinite(price) ? Math.max(0, price) : 0;
  if (mode === "exclusive") {
    const vat = p * VAT_RATE;
    return { base: p, vat, total: p + vat };
  }
  if (mode === "inclusive") {
    const base = p / (1 + VAT_RATE);
    return { base, vat: p - base, total: p };
  }
  return { base: p, vat: 0, total: p };
}
