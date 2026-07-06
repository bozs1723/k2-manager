import assert from "node:assert/strict";
import {
  swAreaCm2,
  swCalculatePrice,
  swGrandTotal,
  swTierDiscountRate,
  swVatAmount
} from "./.swpbuild/pricing.mjs";

// แปลงหน่วยเป็น ตร.ซม.
assert.equal(swAreaCm2(5, 5, "cm"), 25);
assert.equal(swAreaCm2(50, 50, "mm"), 25);
assert.equal(swAreaCm2(1, 1, "inch"), 6.45);
assert.equal(swAreaCm2(1, 2, "m"), 20000);
assert.equal(swAreaCm2(-3, 5, "cm"), 0, "ขนาดติดลบต้องไม่ทำให้พื้นที่ติดลบ");

// ส่วนลดตามจำนวน
assert.equal(swTierDiscountRate(1), 0);
assert.equal(swTierDiscountRate(49), 0);
assert.equal(swTierDiscountRate(50), 0.05);
assert.equal(swTierDiscountRate(100), 0.1);
assert.equal(swTierDiscountRate(200), 0.15);
assert.equal(swTierDiscountRate(500), 0.2);
assert.equal(swTierDiscountRate(9999), 0.2);

// พวงกุญแจอะคริลิค 5x5 ซม. UV+White พร้อมรูและห่วง จำนวน 100
const keychain = swCalculatePrice({
  productType: "acrylic_keychain",
  material: "acrylic_3mm",
  printing: "uv_white",
  width: 5,
  height: 5,
  sizeUnit: "cm",
  quantity: 100,
  hasHole: true,
  accessories: ["ring"]
});
// พื้นที่ 25 ตร.ซม. * 0.45 = 11.25 < ขั้นต่ำ 25 → วัสดุ 25
assert.equal(keychain.materialCost, 25);
// UV+White ตัวคูณ 1.5 → ค่าพิมพ์ 12.5
assert.equal(keychain.printingCost, 12.5);
assert.equal(keychain.holeCost, 3);
assert.equal(keychain.accessoryCost, 2);
assert.equal(keychain.unitPrice, 42.5);
assert.equal(keychain.subtotal, 4250);
assert.equal(keychain.tierDiscountRate, 0.1);
assert.equal(keychain.tierDiscount, 425);
assert.equal(keychain.total, 3825);

// ป้ายอะคริลิค 60x40 ซม. หนา 5 มม. UV 1 ชิ้น — พื้นที่ใหญ่ต้องคิดตามจริง ไม่ใช่ขั้นต่ำ
const sign = swCalculatePrice({
  productType: "acrylic_sign",
  material: "acrylic_5mm",
  printing: "uv",
  width: 60,
  height: 40,
  sizeUnit: "cm",
  quantity: 1,
  hasHole: false,
  accessories: []
});
// 2400 ตร.ซม. * 0.65 = 1560, ค่าพิมพ์ UV 25% = 390
assert.equal(sign.materialCost, 1560);
assert.equal(sign.printingCost, 390);
assert.equal(sign.unitPrice, 1950);
assert.equal(sign.total, 1950);

// จำนวนที่ไม่ใช่จำนวนเต็มบวกต้องไม่พังระบบ
const zero = swCalculatePrice({
  productType: "sticker",
  material: "sticker",
  printing: "side_1",
  width: 10,
  height: 10,
  sizeUnit: "cm",
  quantity: 0,
  hasHole: false,
  accessories: []
});
assert.equal(zero.subtotal, 0);
assert.equal(zero.total, 0);

// VAT และยอดสุทธิ
assert.equal(swVatAmount(1000, true), 70);
assert.equal(swVatAmount(1000, false), 0);
assert.equal(swGrandTotal(1000, 100, true), 963);
assert.equal(swGrandTotal(1000, 100, false), 900);
assert.equal(swGrandTotal(100, 500, true), 0, "ส่วนลดเกินยอดต้องไม่ติดลบ");

console.log("sw-work pricing tests passed");
