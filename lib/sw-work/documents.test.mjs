import assert from "node:assert/strict";
import {
  swDocNumbers,
  swGenerateDocuments,
  swHasVarnishLayer,
  swHasWhiteLayer,
  swNextOrderCode,
  swOrderDescription,
  swQrPayload
} from "./.swdbuild/documents.mjs";

// รหัสงานรายเดือน
const july = new Date("2026-07-06T10:00:00");
assert.equal(swNextOrderCode([], july), "SW2607-0001");
assert.equal(swNextOrderCode(["SW2607-0001", "SW2607-0009"], july), "SW2607-0010");
assert.equal(
  swNextOrderCode(["SW2606-0042"], july),
  "SW2607-0001",
  "เดือนใหม่ต้องเริ่มนับใหม่"
);
assert.equal(swNextOrderCode(["SW2607-XXXX"], july), "SW2607-0001", "เลขเพี้ยนต้องไม่พังระบบ");

// เลขเอกสารทั้ง 5 ใบผูกกับรหัสงานเดียวกัน
assert.deepEqual(swDocNumbers("SW2607-0001"), {
  quotation: "Q-SW2607-0001",
  approval: "CA-SW2607-0001",
  production: "PS-SW2607-0001",
  qc: "QC-SW2607-0001",
  delivery: "DL-SW2607-0001"
});

// คำอธิบายรายการ
assert.equal(
  swOrderDescription({
    productType: "acrylic_keychain",
    width: 5,
    height: 5,
    sizeUnit: "cm",
    material: "acrylic_3mm",
    printing: "uv_white"
  }),
  "พวงกุญแจอะคริลิค 5x5 ซม. / อะคริลิค 3 มม. / UV + White"
);

// เลเยอร์พิมพ์
assert.equal(swHasWhiteLayer("uv_white"), true);
assert.equal(swHasWhiteLayer("uv_white_varnish"), true);
assert.equal(swHasWhiteLayer("uv"), false);
assert.equal(swHasVarnishLayer("uv_white_varnish"), true);
assert.equal(swHasVarnishLayer("uv_white"), false);

assert.equal(swQrPayload("SW2607-0001", "abc"), "SWWORK|SW2607-0001|abc");

// สร้างเอกสารครบชุดจากออเดอร์เดียว
let seq = 0;
const makeId = () => `id-${++seq}`;
const docs = swGenerateDocuments(
  {
    id: "order-1",
    orderCode: "SW2607-0001",
    productType: "acrylic_keychain",
    width: 5,
    height: 5,
    sizeUnit: "cm",
    quantity: 100,
    material: "acrylic_3mm",
    printing: "uv_white_varnish",
    holePosition: "บนกลาง",
    unitPrice: 42.5,
    discount: 425,
    vatEnabled: true
  },
  july,
  makeId
);

assert.equal(docs.quotation.docNumber, "Q-SW2607-0001");
assert.equal(docs.quotation.subtotal, 4250);
assert.equal(docs.quotation.vat, 267.75); // (4250-425)*7%
assert.equal(docs.quotation.total, 4092.75);
assert.equal(docs.quotation.validUntil, "2026-07-21");
assert.equal(docs.quotation.items.length, 1);
assert.equal(docs.quotation.items[0].quantity, 100);

assert.equal(docs.approval.docNumber, "CA-SW2607-0001");
assert.equal(docs.approval.decision, "pending");

assert.equal(docs.designTask.status, "waiting_design");

assert.equal(docs.productionSheet.docNumber, "PS-SW2607-0001");
assert.equal(docs.productionSheet.whiteLayer, true);
assert.equal(docs.productionSheet.varnishLayer, true);
assert.equal(docs.productionSheet.holePosition, "บนกลาง");
assert.equal(docs.productionSheet.qrPayload, "SWWORK|SW2607-0001|order-1");

assert.equal(docs.qcChecklist.docNumber, "QC-SW2607-0001");
assert.equal(docs.qcChecklist.passed, null);

assert.equal(docs.delivery.docNumber, "DL-SW2607-0001");
assert.equal(docs.delivery.status, "waiting");

// ทุก record ต้องผูกกับออเดอร์เดียวกันและ id ไม่ซ้ำ
const ids = [
  docs.quotation.id,
  docs.approval.id,
  docs.designTask.id,
  docs.productionSheet.id,
  docs.qcChecklist.id,
  docs.delivery.id
];
assert.equal(new Set(ids).size, 6);
for (const record of [docs.quotation, docs.approval, docs.designTask, docs.productionSheet, docs.qcChecklist, docs.delivery]) {
  assert.equal(record.orderId, "order-1");
}

console.log("sw-work documents tests passed");
