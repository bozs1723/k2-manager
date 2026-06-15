import type { JobType } from "./types";

// กำหนดสาขาที่รับผิดชอบผลิตตามประเภทงาน
// เสื้อ/สกรีน DTG → พระรามเก้า · นอกนั้น (ป้าย/อะคริลิค/UV/เลเซอร์/3D/อื่นๆ) → พะเยา
export function branchForJobType(type: JobType): string {
  return type === "DTG Shirt" ? "พระรามเก้า" : "พะเยา";
}
