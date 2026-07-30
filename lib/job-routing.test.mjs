// เทสกฎ routing สาขาผลิต — รวมสาขาเหลือสาขาเดียว (สำนักงานใหญ่ พระรามเก้า)
// รัน: npm run test:job-routing
import assert from "node:assert/strict";
import { branchForJobType } from "./.jrbuild/job-routing.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

console.log("routing สาขาตามประเภทงาน (สาขาเดียว)");
for (const type of ["DTG Shirt", "UV Print", "Laser Cut", "Signage", "Acrylic", "3D Print", "Keychain", "Other"]) {
  check(`${type} → พระรามเก้า`, () => assert.equal(branchForJobType(type), "พระรามเก้า"));
}

console.log(`\n${passed} เทสผ่านทั้งหมด ✅`);
