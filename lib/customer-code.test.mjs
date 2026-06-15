// เทสตรรกะระบบรหัสลูกค้า K2 (SOP v1)
// รัน: npm run test:customer-code
import assert from "node:assert/strict";
import {
  CUSTOMER_CODE_PAGES,
  CUSTOMER_CODE_ADMINS,
  customerCodeYear,
  formatCustomerCode,
  nextCustomerSeq
} from "./.ccbuild/customer-code.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

console.log("ระบบรหัสลูกค้า K2 — customer-code");

// formatCustomerCode
check('format พื้นฐาน -> KS-AOM-0001-26', () => assert.equal(formatCustomerCode("KS", "AOM", 1, "26"), "KS-AOM-0001-26"));
check('format เติม 0 ครบ 4 หลัก (42) -> FF-OYL-0042-26', () => assert.equal(formatCustomerCode("FF", "OYL", 42, "26"), "FF-OYL-0042-26"));
check('format เลขเกิน 4 หลักไม่ตัด', () => assert.equal(formatCustomerCode("KS", "HSE", 12345, "26"), "KS-HSE-12345-26"));

// nextCustomerSeq (เลขวิ่งรวมทั้งบริษัท ไม่รีเซ็ต)
check("nextSeq ลูกค้าว่าง -> 1", () => assert.equal(nextCustomerSeq([]), 1));
check("nextSeq = max + 1", () => assert.equal(nextCustomerSeq([{ codeSeq: 5 }, { codeSeq: 3 }, { codeSeq: 41 }]), 42));
check("nextSeq ข้ามลูกค้าที่ยังไม่มีรหัส", () => assert.equal(nextCustomerSeq([{}, { codeSeq: undefined }]), 1));

// customerCodeYear
check("year = 2 หลักท้ายของปีปัจจุบัน", () => assert.equal(customerCodeYear(), String(new Date().getFullYear()).slice(-2)));

// ทะเบียน (source of truth)
check("เพจ KS = K2Sign", () => assert.ok(CUSTOMER_CODE_PAGES.some((p) => p.code === "KS" && p.name === "K2Sign")));
check("เพจมีครบ 7 รายการ", () => assert.equal(CUSTOMER_CODE_PAGES.length, 7));
check("เพจไม่มีรหัสซ้ำ", () => assert.equal(new Set(CUSTOMER_CODE_PAGES.map((p) => p.code)).size, CUSTOMER_CODE_PAGES.length));
check("แอดมิน AOM(อ้อม) ≠ AOR(อ้อ) — คนละคน", () => {
  const aom = CUSTOMER_CODE_ADMINS.find((a) => a.code === "AOM");
  const aor = CUSTOMER_CODE_ADMINS.find((a) => a.code === "AOR");
  assert.equal(aom?.name, "อ้อม");
  assert.equal(aor?.name, "อ้อ");
  assert.notEqual(aom?.code, aor?.code);
});
check("แอดมินมี HSE สำหรับ House/Walk-in", () => assert.ok(CUSTOMER_CODE_ADMINS.some((a) => a.code === "HSE")));
check("แอดมินไม่มีรหัสซ้ำ", () => assert.equal(new Set(CUSTOMER_CODE_ADMINS.map((a) => a.code)).size, CUSTOMER_CODE_ADMINS.length));

// end-to-end ตามตัวอย่างใน SOP
check("E2E: ลูกค้าคนแรก K2Sign/อ้อม -> KS-AOM-0001-26", () => {
  const seq = nextCustomerSeq([]);
  assert.equal(formatCustomerCode("KS", "AOM", seq, "26"), "KS-AOM-0001-26");
});

console.log(`\n${passed} เทสผ่านทั้งหมด ✅`);
