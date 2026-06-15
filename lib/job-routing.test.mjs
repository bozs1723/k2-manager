// เทสกฎ routing สาขาผลิตตามประเภทงาน
// รัน: npm run test:job-routing
import assert from "node:assert/strict";
import { branchForJobType } from "./.jrbuild/job-routing.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

console.log("routing สาขาตามประเภทงาน");
check("เสื้อ DTG → พระรามเก้า", () => assert.equal(branchForJobType("DTG Shirt"), "พระรามเก้า"));
check("ป้าย (Signage) → พะเยา", () => assert.equal(branchForJobType("Signage"), "พะเยา"));
check("อะคริลิค (Acrylic) → พะเยา", () => assert.equal(branchForJobType("Acrylic"), "พะเยา"));
check("UV Print → พะเยา", () => assert.equal(branchForJobType("UV Print"), "พะเยา"));
check("Laser Cut → พะเยา", () => assert.equal(branchForJobType("Laser Cut"), "พะเยา"));
check("3D Print → พะเยา", () => assert.equal(branchForJobType("3D Print"), "พะเยา"));
check("อื่นๆ (Other) → พะเยา", () => assert.equal(branchForJobType("Other"), "พะเยา"));

console.log(`\n${passed} เทสผ่านทั้งหมด ✅`);
