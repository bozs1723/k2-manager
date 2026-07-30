import type { JobType } from "./types";

// รวมสาขาเหลือสาขาเดียว: ทุกประเภทงานผลิตที่สำนักงานใหญ่ พระรามเก้า
// (ค่าที่เก็บใน DB คงเป็น "พระรามเก้า" ให้ตรงกับโปรไฟล์/งานเดิม)
export function branchForJobType(type: JobType): string {
  void type;
  return "พระรามเก้า";
}
