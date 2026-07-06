"use client";

// Sw.Work — เอกสารทั้ง 5 ใบที่ระบบสร้างอัตโนมัติจาก Sales Order เดียว
// 1. Quotation  2. Customer Approval Sheet  3. Production Sheet  4. QC Checklist  5. Delivery Sheet

import type { SwDocumentBundle } from "../../lib/sw-work/types";
import {
  SW_ACCESSORIES,
  SW_APPROVAL_DECISIONS,
  SW_DELIVERY_STATUSES,
  SW_MATERIALS,
  SW_PRINTINGS,
  SW_PRODUCT_TYPES,
  SW_PRODUCTION_STATUSES,
  SW_SHAPES,
  SW_SIZE_UNITS
} from "../../lib/sw-work/types";
import { SwQr } from "./SwQr";

export function thb(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateTh(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function sizeText(bundle: SwDocumentBundle): string {
  const { order } = bundle;
  return `${order.width} x ${order.height} ${SW_SIZE_UNITS[order.sizeUnit]}`;
}

function DocFrame({
  title,
  subtitle,
  docNumber,
  date,
  children
}: {
  title: string;
  subtitle: string;
  docNumber: string;
  date?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sw-doc mx-auto w-full max-w-[820px] rounded-2xl border border-gray-200 bg-white p-8 text-[#1d1d1f] print:rounded-none print:border-0 print:p-0">
      <div className="flex items-start justify-between border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-xl font-extrabold tracking-tight">Sw.Work</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Smart Workflow &amp; Production System</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
          <p className="mt-2 text-sm font-bold text-orange-600">{docNumber}</p>
          <p className="text-xs text-gray-500">วันที่ {dateTh(date ?? new Date().toISOString())}</p>
        </div>
      </div>
      <div className="pt-5">{children}</div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function CheckBox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
          checked ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      {label}
    </span>
  );
}

function ImagePreview({ url, label }: { url?: string; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-dashed border-gray-300 p-3 text-center">
      <p className="mb-2 text-xs font-semibold text-gray-500">{label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="mx-auto max-h-48 rounded-lg object-contain" />
      ) : (
        <div className="flex h-32 items-center justify-center text-xs text-gray-400">ยังไม่มีรูป</div>
      )}
    </div>
  );
}

// ---------- 1. SW.Quote — ใบเสนอราคา ----------
export function QuotationDoc({ bundle }: { bundle: SwDocumentBundle }) {
  const { order, quotation } = bundle;
  return (
    <DocFrame
      title="ใบเสนอราคา"
      subtitle="Quotation"
      docNumber={quotation.docNumber}
      date={order.createdAt}
    >
      <div className="mb-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">ลูกค้า</p>
          <p className="font-bold">{order.customerName}</p>
          {order.customerCompany ? <p>{order.customerCompany}</p> : null}
          {order.customerPhone ? <p>โทร {order.customerPhone}</p> : null}
          {order.customerLineId ? <p>LINE: {order.customerLineId}</p> : null}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">อ้างอิงงาน</p>
          <p className="font-bold">{order.orderCode}</p>
          <p>ยืนราคาถึง {dateTh(quotation.validUntil)}</p>
        </div>
      </div>

      <table className="text-sm">
        <thead>
          <tr className="border-b-2 border-gray-900 text-left">
            <th className="py-2">รายการ</th>
            <th className="py-2 text-right">จำนวน</th>
            <th className="py-2 text-right">ราคา/หน่วย</th>
            <th className="py-2 text-right">รวม</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-3">
                {item.description}
                {order.accessories.length > 0 ? (
                  <span className="block text-xs text-gray-500">
                    อุปกรณ์เสริม: {order.accessories.map((a) => SW_ACCESSORIES[a]).join(", ")}
                  </span>
                ) : null}
              </td>
              <td className="py-3 text-right">{item.quantity.toLocaleString("th-TH")}</td>
              <td className="py-3 text-right">{thb(item.unit_price)}</td>
              <td className="py-3 text-right">{thb(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">รวม</span>
          <span>{thb(quotation.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">ส่วนลด</span>
          <span>-{thb(quotation.discount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">VAT 7%</span>
          <span>{thb(quotation.vat)}</span>
        </div>
        <div className="flex justify-between border-t-2 border-gray-900 pt-2 text-base font-extrabold">
          <span>ยอดสุทธิ</span>
          <span className="text-orange-600">{thb(quotation.total)} บาท</span>
        </div>
      </div>

      {order.notes ? (
        <p className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">หมายเหตุ: {order.notes}</p>
      ) : null}
    </DocFrame>
  );
}

// ---------- 2. SW.Confirm — ใบคอนเฟิร์มลูกค้า ----------
export function ApprovalDoc({ bundle }: { bundle: SwDocumentBundle }) {
  const { order, approval, files } = bundle;
  const artwork = files.find((f) => f.kind === "artwork" && f.publicUrl);
  const mockup = approval.mockupUrl ?? files.find((f) => f.kind === "mockup" && f.publicUrl)?.publicUrl;
  return (
    <DocFrame
      title="ใบคอนเฟิร์มงาน"
      subtitle="Customer Approval Sheet"
      docNumber={approval.docNumber}
      date={order.createdAt}
    >
      <div className="mb-5 flex gap-4">
        <ImagePreview url={artwork?.publicUrl} label="Product Preview" />
        <ImagePreview url={mockup ?? undefined} label="Mockup Preview" />
      </div>

      <div className="grid grid-cols-2 gap-x-8">
        <div>
          <SpecRow label="ลูกค้า" value={order.customerName} />
          <SpecRow label="สินค้า" value={SW_PRODUCT_TYPES[order.productType]} />
          <SpecRow label="ขนาดสินค้า" value={sizeText(bundle)} />
          <SpecRow label="รูปทรง / เส้นไดคัท" value={SW_SHAPES[order.shape]} />
        </div>
        <div>
          <SpecRow label="วัสดุ" value={SW_MATERIALS[order.material]} />
          <SpecRow label="วิธีพิมพ์" value={SW_PRINTINGS[order.printing]} />
          <SpecRow
            label="ตำแหน่งรูเจาะ"
            value={order.hasHole ? `${order.holePosition || "-"} (${order.holeSize || "-"})` : "ไม่เจาะรู"}
          />
          <SpecRow label="จำนวน" value={`${order.quantity.toLocaleString("th-TH")} ชิ้น`} />
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        หมายเหตุการผลิต: {order.notes || "-"}
      </p>

      <div className="mt-6 rounded-2xl border-2 border-orange-500 p-5">
        <h3 className="mb-3 text-sm font-extrabold text-orange-600">Customer Approval — การอนุมัติของลูกค้า</h3>
        <div className="flex gap-8">
          <CheckBox checked={approval.decision === "approved"} label="อนุมัติ (Approve)" />
          <CheckBox checked={approval.decision === "revision"} label="ขอแก้ไข (Request Revision)" />
        </div>
        {approval.customerNote ? (
          <p className="mt-3 text-xs text-gray-600">ความเห็นลูกค้า: {approval.customerNote}</p>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-b border-gray-400 pb-1 text-center font-semibold">
              {approval.signatureName || " "}
            </div>
            <p className="mt-1 text-center text-xs text-gray-500">ลายเซ็น (Signature)</p>
          </div>
          <div>
            <div className="border-b border-gray-400 pb-1 text-center font-semibold">
              {approval.decidedAt ? dateTh(approval.decidedAt) : " "}
            </div>
            <p className="mt-1 text-center text-xs text-gray-500">วันที่ (Date)</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-400">
        สถานะปัจจุบัน: {SW_APPROVAL_DECISIONS[approval.decision]}
        {approval.revisionCount > 0 ? ` • แก้ไขแล้ว ${approval.revisionCount} ครั้ง` : ""}
      </p>
    </DocFrame>
  );
}

// ---------- 3. SW.Production — ใบสั่งผลิต ----------
export function ProductionDoc({ bundle }: { bundle: SwDocumentBundle }) {
  const { order, productionSheet } = bundle;
  const artwork = bundle.files.find((f) => f.kind === "artwork" && f.publicUrl);
  return (
    <DocFrame
      title="ใบสั่งผลิต"
      subtitle="Production Sheet"
      docNumber={productionSheet.docNumber}
      date={order.createdAt}
    >
      <div className="mb-5 flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <SpecRow label="รหัสงาน" value={<span className="font-extrabold">{order.orderCode}</span>} />
              <SpecRow label="ชื่อลูกค้า" value={order.customerName} />
              <SpecRow label="สินค้า" value={SW_PRODUCT_TYPES[order.productType]} />
              <SpecRow label="จำนวน" value={`${order.quantity.toLocaleString("th-TH")} ชิ้น`} />
              <SpecRow label="ขนาด" value={sizeText(bundle)} />
            </div>
            <div>
              <SpecRow label="วัสดุ" value={SW_MATERIALS[order.material]} />
              <SpecRow label="วิธีพิมพ์" value={SW_PRINTINGS[order.printing]} />
              <SpecRow
                label="กำหนดส่ง"
                value={order.dueDate ? dateTh(order.dueDate) : "-"}
              />
              <SpecRow label="เครื่อง" value={productionSheet.machine || "-"} />
              <SpecRow label="ผู้ผลิต" value={productionSheet.operatorName || "-"} />
            </div>
          </div>
        </div>
        <div className="shrink-0 text-center">
          <SwQr value={productionSheet.qrPayload || order.orderCode} size={110} />
          <p className="mt-1 text-[10px] text-gray-400">สแกนตามงาน</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className={`rounded-xl border p-3 text-center text-sm font-bold ${productionSheet.whiteLayer ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-400"}`}>
          White Layer
          <span className="block text-xs font-semibold">{productionSheet.whiteLayer ? "ต้องพิมพ์" : "ไม่ใช้"}</span>
        </div>
        <div className={`rounded-xl border p-3 text-center text-sm font-bold ${productionSheet.varnishLayer ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-400"}`}>
          Varnish Layer
          <span className="block text-xs font-semibold">{productionSheet.varnishLayer ? "ต้องเคลือบ" : "ไม่ใช้"}</span>
        </div>
        <div className={`rounded-xl border p-3 text-center text-sm font-bold ${order.shape === "die_cut" || productionSheet.cutLine ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-400"}`}>
          Cut Line
          <span className="block text-xs font-semibold">{productionSheet.cutLine || SW_SHAPES[order.shape]}</span>
        </div>
        <div className={`rounded-xl border p-3 text-center text-sm font-bold ${order.hasHole ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-400"}`}>
          Hole
          <span className="block text-xs font-semibold">
            {order.hasHole ? `${productionSheet.holePosition || order.holePosition || "-"} ${order.holeSize ? `(${order.holeSize})` : ""}` : "ไม่เจาะ"}
          </span>
        </div>
      </div>

      {artwork?.publicUrl ? (
        <div className="mt-5">
          <ImagePreview url={artwork.publicUrl} label="รูปสินค้า / ไฟล์งาน" />
        </div>
      ) : null}

      {order.accessories.length > 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
          อุปกรณ์เสริม: <b>{order.accessories.map((a) => SW_ACCESSORIES[a]).join(", ")}</b>
        </p>
      ) : null}
      {order.notes ? (
        <p className="mt-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-800">โน้ตจากฝ่ายขาย: {order.notes}</p>
      ) : null}
      <p className="mt-4 text-right text-xs text-gray-400">
        สถานะการผลิต: {SW_PRODUCTION_STATUSES[productionSheet.status]}
      </p>
    </DocFrame>
  );
}

// ---------- 4. SW.QC — ใบตรวจคุณภาพ ----------
export function QcDoc({ bundle }: { bundle: SwDocumentBundle }) {
  const { order, qcChecklist } = bundle;
  const rows: Array<{ label: string; checked: boolean }> = [
    { label: "ขนาดถูกต้อง", checked: qcChecklist.checkSize },
    { label: "สีถูกต้อง", checked: qcChecklist.checkColor },
    { label: "จำนวนถูกต้อง", checked: qcChecklist.checkQuantity },
    { label: "รูเจาะถูกต้อง", checked: qcChecklist.checkHole },
    { label: "วัสดุถูกต้อง", checked: qcChecklist.checkMaterial },
    { label: "แพ็กเรียบร้อย", checked: qcChecklist.checkPacking }
  ];
  return (
    <DocFrame
      title="ใบตรวจคุณภาพ"
      subtitle="QC Checklist"
      docNumber={qcChecklist.docNumber}
      date={qcChecklist.checkedAt ?? order.createdAt}
    >
      <div className="mb-5 grid grid-cols-2 gap-x-8">
        <SpecRow label="รหัสงาน" value={order.orderCode} />
        <SpecRow label="ลูกค้า" value={order.customerName} />
        <SpecRow label="สินค้า" value={`${SW_PRODUCT_TYPES[order.productType]} • ${sizeText(bundle)}`} />
        <SpecRow label="จำนวนที่ต้องได้" value={`${order.quantity.toLocaleString("th-TH")} ชิ้น`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-gray-200 p-4">
            <CheckBox checked={row.checked} label={row.label} />
          </div>
        ))}
      </div>

      <div
        className={`mt-6 rounded-2xl p-5 text-center text-lg font-extrabold ${
          qcChecklist.passed === true
            ? "bg-green-50 text-green-700"
            : qcChecklist.passed === false
              ? "bg-red-50 text-red-600"
              : "bg-gray-50 text-gray-400"
        }`}
      >
        {qcChecklist.passed === true ? "ผ่านการตรวจสอบ ✓" : qcChecklist.passed === false ? "ไม่ผ่าน — ต้องแก้ไข" : "ยังไม่ได้ตรวจ"}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-8 text-sm">
        <SpecRow label="ผู้ตรวจ" value={qcChecklist.inspectorName || "-"} />
        <SpecRow label="ตรวจเมื่อ" value={qcChecklist.checkedAt ? dateTh(qcChecklist.checkedAt) : "-"} />
      </div>
      {qcChecklist.note ? (
        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">บันทึก QC: {qcChecklist.note}</p>
      ) : null}
    </DocFrame>
  );
}

// ---------- 5. SW.Delivery — ใบจัดส่ง ----------
export function DeliveryDoc({ bundle }: { bundle: SwDocumentBundle }) {
  const { order, delivery } = bundle;
  return (
    <DocFrame
      title="ใบจัดส่ง"
      subtitle="Delivery Sheet"
      docNumber={delivery.docNumber}
      date={delivery.shipDate ?? order.createdAt}
    >
      <div className="grid grid-cols-2 gap-x-8">
        <div>
          <SpecRow label="รหัสงาน" value={order.orderCode} />
          <SpecRow label="ผู้รับ" value={order.customerName} />
          <SpecRow label="โทร" value={order.customerPhone || "-"} />
          <SpecRow label="สินค้า" value={`${SW_PRODUCT_TYPES[order.productType]} x ${order.quantity.toLocaleString("th-TH")}`} />
        </div>
        <div>
          <SpecRow label="บริษัทขนส่ง" value={delivery.carrier || "-"} />
          <SpecRow
            label="เลขพัสดุ"
            value={delivery.trackingNumber ? <span className="font-extrabold text-orange-600">{delivery.trackingNumber}</span> : "-"}
          />
          <SpecRow label="วันที่จัดส่ง" value={delivery.shipDate ? dateTh(delivery.shipDate) : "-"} />
          <SpecRow label="สถานะ" value={SW_DELIVERY_STATUSES[delivery.status]} />
        </div>
      </div>
      {delivery.address ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">ที่อยู่จัดส่ง: {delivery.address}</p>
      ) : null}
      <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="border-b border-gray-400 pb-6" />
          <p className="mt-1 text-center text-xs text-gray-500">ผู้ส่ง / แพ็กสินค้า</p>
        </div>
        <div>
          <div className="border-b border-gray-400 pb-6" />
          <p className="mt-1 text-center text-xs text-gray-500">ผู้รับ</p>
        </div>
      </div>
    </DocFrame>
  );
}
