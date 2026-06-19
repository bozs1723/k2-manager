// เทสตรรกะ VAT (none / inclusive / exclusive)
// รัน: npm run test:vat
import assert from "node:assert/strict";
import { computeVat, normalizeVatMode, VAT_RATE } from "./.vatbuild/vat.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

const near = (a, b) => Math.abs(a - b) < 0.001;

console.log("VAT_RATE = 7%");
check("ค่าคงที่ถูกต้อง", () => assert.equal(VAT_RATE, 0.07));

console.log("\nโหมด none (ไม่มีภาษี)");
check("ฐาน = ราคา, VAT = 0, รวม = ราคา", () => {
  const r = computeVat(1000, "none");
  assert.equal(r.base, 1000);
  assert.equal(r.vat, 0);
  assert.equal(r.total, 1000);
});

console.log("\nโหมด exclusive (บวก 7% เพิ่ม)");
check("ราคา 1000 → VAT 70, รวม 1070", () => {
  const r = computeVat(1000, "exclusive");
  assert.equal(r.base, 1000);
  assert.ok(near(r.vat, 70));
  assert.ok(near(r.total, 1070));
});

console.log("\nโหมด inclusive (ราคารวม VAT แล้ว)");
check("ราคา 1070 → ฐาน 1000, VAT 70, รวม 1070", () => {
  const r = computeVat(1070, "inclusive");
  assert.ok(near(r.base, 1000));
  assert.ok(near(r.vat, 70));
  assert.equal(r.total, 1070);
});
check("ฐาน + VAT = ยอดรวมเสมอ (inclusive)", () => {
  const r = computeVat(5350, "inclusive");
  assert.ok(near(r.base + r.vat, r.total));
});

console.log("\nกันค่าผิด");
check("ราคาติดลบ → 0", () => assert.equal(computeVat(-50, "exclusive").total, 0));
check("normalizeVatMode ค่าแปลก → none", () => {
  assert.equal(normalizeVatMode("blah"), "none");
  assert.equal(normalizeVatMode(undefined), "none");
  assert.equal(normalizeVatMode("inclusive"), "inclusive");
  assert.equal(normalizeVatMode("exclusive"), "exclusive");
});

console.log(`\n✅ ผ่านทั้งหมด ${passed} เคส`);
