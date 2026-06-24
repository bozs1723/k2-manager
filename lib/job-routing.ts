import type { JobType } from "./types";

// กำหนดสาขาที่รับผิดชอบผลิตตามประเภทงาน (ตามที่ตั้งเครื่องจักรไว้)
// เสื้อ DTG + พิมพ์ 3D → พระรามเก้า · นอกนั้น (ป้าย/อะคริลิค/UV/เลเซอร์/พวงกุญแจ/อื่นๆ) → พะเยา
export function branchForJobType(type: JobType): string {
  return type === "DTG Shirt" || type === "3D Print" ? "พระรามเก้า" : "พะเยา";
}
