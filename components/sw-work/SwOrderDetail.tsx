"use client";

// Sw.Work — หน้ารายละเอียดออเดอร์: เอกสารครบชุด + การทำงานของแต่ละโมดูล

import { useRef, useState } from "react";
import type { SwMode } from "../../lib/sw-work/store";
import {
  swSetMockupFromFile,
  swUpdateApproval,
  swUpdateDelivery,
  swUpdateDesign,
  swUpdateOrderStatus,
  swUpdateProduction,
  swUpdateQc,
  swUpdateQuotation
} from "../../lib/sw-work/store";
import type { SwDocumentBundle, SwOrderStatus } from "../../lib/sw-work/types";
import {
  SW_CARRIERS,
  SW_DELIVERY_STATUSES,
  SW_DESIGN_STATUSES,
  SW_ORDER_STATUSES,
  SW_PIPELINE,
  SW_PRODUCTION_STATUSES
} from "../../lib/sw-work/types";
import { ApprovalDoc, DeliveryDoc, ProductionDoc, QcDoc, QuotationDoc, dateTh, thb } from "./SwDocuments";

type DocTab = "quotation" | "approval" | "design" | "production" | "qc" | "delivery" | "history";

const TABS: Array<{ key: DocTab; label: string }> = [
  { key: "quotation", label: "1. ใบเสนอราคา" },
  { key: "approval", label: "2. ใบคอนเฟิร์ม" },
  { key: "design", label: "3. งานออกแบบ" },
  { key: "production", label: "4. ใบสั่งผลิต" },
  { key: "qc", label: "5. ใบ QC" },
  { key: "delivery", label: "6. ใบจัดส่ง" },
  { key: "history", label: "ประวัติ" }
];

const inputCls =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none";

function ActionButton({
  children,
  onClick,
  tone = "orange",
  disabled
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "orange" | "gray" | "green" | "red";
  disabled?: boolean;
}) {
  const tones: Record<string, string> = {
    orange: "bg-orange-500 text-white hover:bg-orange-600",
    gray: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    green: "bg-green-600 text-white hover:bg-green-700",
    red: "bg-red-500 text-white hover:bg-red-600"
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function StatusStepper({ status }: { status: SwOrderStatus }) {
  const steps = SW_PIPELINE;
  const idx = steps.indexOf(status);
  return (
    <div className="soft-scrollbar flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <div key={step} className="flex shrink-0 items-center gap-1">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status === "cancelled"
                ? "bg-gray-100 text-gray-400"
                : i < idx
                  ? "bg-orange-100 text-orange-700"
                  : i === idx
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-400"
            }`}
          >
            {SW_ORDER_STATUSES[step]}
          </span>
          {i < steps.length - 1 ? <span className="text-gray-300">›</span> : null}
        </div>
      ))}
      {status === "cancelled" ? (
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">ยกเลิก</span>
      ) : null}
    </div>
  );
}

export function SwOrderDetail({
  bundle,
  mode,
  userName,
  onBack,
  onChanged
}: {
  bundle: SwDocumentBundle;
  mode: SwMode;
  userName: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [tab, setTab] = useState<DocTab>("quotation");
  const [busy, setBusy] = useState(false);
  const [signName, setSignName] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [inspector, setInspector] = useState(bundle.qcChecklist.inspectorName);
  const [designer, setDesigner] = useState(bundle.designTask.designerName);
  const [machine, setMachine] = useState(bundle.productionSheet.machine);
  const [operator, setOperator] = useState(bundle.productionSheet.operatorName);
  const [cutLine, setCutLine] = useState(bundle.productionSheet.cutLine);
  const [carrier, setCarrier] = useState(bundle.delivery.carrier || SW_CARRIERS[0]);
  const [tracking, setTracking] = useState(bundle.delivery.trackingNumber);
  const [shipDate, setShipDate] = useState(bundle.delivery.shipDate ?? "");
  const [address, setAddress] = useState(bundle.delivery.address);
  const mockupInput = useRef<HTMLInputElement>(null);

  const { order, quotation, approval, designTask, productionSheet, qcChecklist, delivery } = bundle;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const setOrderStatus = (status: SwOrderStatus) =>
    run(() => swUpdateOrderStatus(mode, order.id, status, userName));

  const quoteShareText =
    `ใบเสนอราคา ${quotation.docNumber}\n` +
    `${quotation.items[0]?.description ?? ""}\n` +
    `จำนวน ${order.quantity.toLocaleString("th-TH")} ชิ้น\n` +
    `ยอดสุทธิ ${thb(quotation.total)} บาท (ยืนราคาถึง ${dateTh(quotation.validUntil)})\n` +
    `— Sw.Work`;

  const markQuotationSent = (via: "line" | "email" | "pdf") =>
    run(async () => {
      const sentVia = Array.from(new Set([...quotation.sentVia, via]));
      await swUpdateQuotation(mode, quotation.id, { status: "sent", sentVia });
      if (order.status === "quotation") {
        await swUpdateOrderStatus(mode, order.id, "waiting_confirm", userName);
      }
    });

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600">
            ← กลับ
          </button>
          <div>
            <h2 className="text-lg font-extrabold">{order.orderCode}</h2>
            <p className="text-sm text-gray-500">
              {order.customerName}
              {order.dueDate ? ` • กำหนดส่ง ${dateTh(order.dueDate)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={inputCls}
            value={order.status}
            disabled={busy}
            onChange={(e) => setOrderStatus(e.target.value as SwOrderStatus)}
          >
            {(Object.entries(SW_ORDER_STATUSES) as Array<[SwOrderStatus, string]>).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ActionButton tone="gray" onClick={() => window.print()}>พิมพ์ / PDF</ActionButton>
        </div>
      </div>

      <div className="no-print">
        <StatusStepper status={order.status} />
      </div>

      <div className="no-print soft-scrollbar flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-bold ${
              tab === t.key ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- แถบการทำงานของแต่ละโมดูล ---------- */}
      <div className="no-print">
        {tab === "quotation" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 p-4">
            <span className="text-sm font-bold text-gray-500">SW.Quote:</span>
            <ActionButton
              tone="gray"
              disabled={busy}
              onClick={() => {
                window.open(`https://line.me/R/share?text=${encodeURIComponent(quoteShareText)}`, "_blank");
                void markQuotationSent("line");
              }}
            >
              ส่งผ่าน LINE
            </ActionButton>
            <ActionButton
              tone="gray"
              disabled={busy}
              onClick={() => {
                window.location.href = `mailto:?subject=${encodeURIComponent(`ใบเสนอราคา ${quotation.docNumber}`)}&body=${encodeURIComponent(quoteShareText)}`;
                void markQuotationSent("email");
              }}
            >
              ส่งผ่าน Email
            </ActionButton>
            <ActionButton
              tone="gray"
              disabled={busy}
              onClick={() => {
                window.print();
                void markQuotationSent("pdf");
              }}
            >
              Export PDF
            </ActionButton>
            <span className="ml-auto text-xs text-gray-400">
              สถานะ: {quotation.status}{quotation.sentVia.length ? ` • ส่งแล้วทาง ${quotation.sentVia.join(", ")}` : ""}
            </span>
          </div>
        ) : null}

        {tab === "approval" ? (
          <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-500">SW.Confirm:</span>
              <input
                ref={mockupInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void run(async () => {
                      await swSetMockupFromFile(mode, approval.id, order.id, file);
                    });
                  }
                  if (mockupInput.current) mockupInput.current.value = "";
                }}
              />
              <ActionButton tone="gray" disabled={busy} onClick={() => mockupInput.current?.click()}>
                อัปโหลด Mockup
              </ActionButton>
              <input
                className={inputCls}
                placeholder="ชื่อลูกค้าที่เซ็น"
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
              />
              <input
                className={`${inputCls} flex-1 min-w-[160px]`}
                placeholder="ความเห็นลูกค้า (ถ้ามี)"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                tone="green"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await swUpdateApproval(mode, approval.id, {
                      decision: "approved",
                      signatureName: signName || order.customerName,
                      customerNote
                    });
                    await swUpdateDesign(mode, designTask.id, { status: "ready_production" });
                    if (order.status === "waiting_confirm" || order.status === "quotation" || order.status === "design") {
                      await swUpdateOrderStatus(mode, order.id, "confirmed", userName);
                    }
                  })
                }
              >
                ✓ ลูกค้าอนุมัติ
              </ActionButton>
              <ActionButton
                tone="red"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await swUpdateApproval(mode, approval.id, {
                      decision: "revision",
                      signatureName: signName || order.customerName,
                      customerNote,
                      revisionCount: approval.revisionCount + 1
                    });
                    await swUpdateDesign(mode, designTask.id, { status: "designing" });
                    await swUpdateOrderStatus(mode, order.id, "design", userName);
                  })
                }
              >
                ✎ ลูกค้าขอแก้ไข
              </ActionButton>
            </div>
          </div>
        ) : null}

        {tab === "design" ? (
          <div className="space-y-4 rounded-2xl bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-500">SW.Design:</span>
              <input
                className={inputCls}
                placeholder="ชื่อกราฟิก"
                value={designer}
                onChange={(e) => setDesigner(e.target.value)}
                onBlur={() => {
                  if (designer !== designTask.designerName) {
                    void run(() => swUpdateDesign(mode, designTask.id, { designerName: designer }));
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(SW_DESIGN_STATUSES) as Array<[typeof designTask.status, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await swUpdateDesign(mode, designTask.id, { status: key });
                      if (key === "ready_production" && order.status !== "production") {
                        await swUpdateOrderStatus(mode, order.id, "production", userName);
                      } else if ((key === "designing" || key === "waiting_design") && order.status === "confirmed") {
                        await swUpdateOrderStatus(mode, order.id, "design", userName);
                      }
                    })
                  }
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    designTask.status === key ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              เริ่ม {designTask.startedAt ? dateTh(designTask.startedAt) : "-"} • เสร็จ {designTask.finishedAt ? dateTh(designTask.finishedAt) : "-"}
            </p>
          </div>
        ) : null}

        {tab === "production" ? (
          <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-500">SW.Production:</span>
              <input className={inputCls} placeholder="เครื่องพิมพ์/เครื่องตัด" value={machine} onChange={(e) => setMachine(e.target.value)} />
              <input className={inputCls} placeholder="ผู้ผลิต" value={operator} onChange={(e) => setOperator(e.target.value)} />
              <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Cut Line / ไฟล์ไดคัท" value={cutLine} onChange={(e) => setCutLine(e.target.value)} />
              <ActionButton
                tone="gray"
                disabled={busy}
                onClick={() => run(() => swUpdateProduction(mode, productionSheet.id, { machine, operatorName: operator, cutLine }))}
              >
                บันทึก
              </ActionButton>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(SW_PRODUCTION_STATUSES) as Array<[typeof productionSheet.status, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await swUpdateProduction(mode, productionSheet.id, { status: key });
                      if (key === "done" && order.status !== "qc") {
                        await swUpdateOrderStatus(mode, order.id, "qc", userName);
                      } else if (key !== "waiting" && key !== "done" && order.status !== "production") {
                        await swUpdateOrderStatus(mode, order.id, "production", userName);
                      }
                    })
                  }
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    productionSheet.status === key ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "qc" ? (
          <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-500">SW.QC:</span>
              {(
                [
                  ["checkSize", "ขนาด"],
                  ["checkColor", "สี"],
                  ["checkQuantity", "จำนวน"],
                  ["checkHole", "รูเจาะ"],
                  ["checkMaterial", "วัสดุ"],
                  ["checkPacking", "แพ็ก"]
                ] as Array<["checkSize" | "checkColor" | "checkQuantity" | "checkHole" | "checkMaterial" | "checkPacking", string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => swUpdateQc(mode, qcChecklist.id, { [key]: !qcChecklist[key] }))}
                  className={`rounded-full px-3 py-2 text-sm font-bold ${
                    qcChecklist[key] ? "bg-green-600 text-white" : "bg-white text-gray-500 border border-gray-200"
                  }`}
                >
                  {qcChecklist[key] ? "✓ " : ""}{label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input className={inputCls} placeholder="ชื่อผู้ตรวจ" value={inspector} onChange={(e) => setInspector(e.target.value)} />
              <ActionButton
                tone="green"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await swUpdateQc(mode, qcChecklist.id, { passed: true, inspectorName: inspector || userName });
                    if (order.status !== "delivery") {
                      await swUpdateOrderStatus(mode, order.id, "delivery", userName);
                    }
                  })
                }
              >
                ✓ ผ่าน QC
              </ActionButton>
              <ActionButton
                tone="red"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await swUpdateQc(mode, qcChecklist.id, { passed: false, inspectorName: inspector || userName });
                    await swUpdateOrderStatus(mode, order.id, "production", userName);
                  })
                }
              >
                ✗ ไม่ผ่าน (ส่งกลับผลิต)
              </ActionButton>
            </div>
          </div>
        ) : null}

        {tab === "delivery" ? (
          <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-500">SW.Delivery:</span>
              <select className={inputCls} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                {SW_CARRIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input className={inputCls} placeholder="เลขพัสดุ" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              <input type="date" className={inputCls} value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
              <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="ที่อยู่จัดส่ง" value={address} onChange={(e) => setAddress(e.target.value)} />
              <ActionButton
                tone="gray"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    swUpdateDelivery(mode, delivery.id, { carrier, trackingNumber: tracking, shipDate: shipDate || undefined, address })
                  )
                }
              >
                บันทึก
              </ActionButton>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(SW_DELIVERY_STATUSES) as Array<[typeof delivery.status, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await swUpdateDelivery(mode, delivery.id, { status: key });
                      if (key === "delivered" && order.status !== "completed") {
                        await swUpdateOrderStatus(mode, order.id, "completed", userName);
                      }
                    })
                  }
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    delivery.status === key ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ---------- ตัวเอกสาร (พิมพ์ได้) ---------- */}
      <div id="print-doc">
        {tab === "quotation" ? <QuotationDoc bundle={bundle} /> : null}
        {tab === "approval" ? <ApprovalDoc bundle={bundle} /> : null}
        {tab === "design" ? <ApprovalDoc bundle={bundle} /> : null}
        {tab === "production" ? <ProductionDoc bundle={bundle} /> : null}
        {tab === "qc" ? <QcDoc bundle={bundle} /> : null}
        {tab === "delivery" ? <DeliveryDoc bundle={bundle} /> : null}
        {tab === "history" ? (
          <div className="mx-auto w-full max-w-[820px] rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-extrabold">ประวัติสถานะ</h3>
            <ul className="space-y-2 text-sm">
              {bundle.history.length === 0 ? <li className="text-gray-400">ยังไม่มีประวัติ</li> : null}
              {bundle.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2">
                  <span>
                    {h.fromStatus ? `${SW_ORDER_STATUSES[h.fromStatus as SwOrderStatus] ?? h.fromStatus} → ` : "สร้างออเดอร์ • "}
                    <b>{SW_ORDER_STATUSES[h.toStatus as SwOrderStatus] ?? h.toStatus}</b>
                    {h.changedByName ? ` โดย ${h.changedByName}` : ""}
                  </span>
                  <span className="text-xs text-gray-400">{dateTh(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
