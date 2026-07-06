"use client";

// Sw.Work — Smart Workflow & Production System
// Sales → Quotation → Customer Confirm → Design → Production → QC → Delivery → Completed

import { useCallback, useEffect, useMemo, useState } from "react";
import { SwOrderDetail } from "../../components/sw-work/SwOrderDetail";
import { SwOrderForm } from "../../components/sw-work/SwOrderForm";
import { dateTh, thb } from "../../components/sw-work/SwDocuments";
import type { SwMode } from "../../lib/sw-work/store";
import {
  swCreateOrder,
  swListBundles,
  swResetDemo,
  swResolveMode,
  swUpdateOrderStatus,
  swUploadFile
} from "../../lib/sw-work/store";
import type { SwDocumentBundle, SwOrderFormInput, SwOrderStatus } from "../../lib/sw-work/types";
import {
  SW_DESIGN_STATUSES,
  SW_ORDER_STATUSES,
  SW_PIPELINE,
  SW_PRODUCT_TYPES
} from "../../lib/sw-work/types";

type View = "dashboard" | "new" | "board" | "orders" | "detail";

const NAV: Array<{ key: View; label: string }> = [
  { key: "dashboard", label: "แดชบอร์ด" },
  { key: "new", label: "+ ออเดอร์ใหม่" },
  { key: "board", label: "บอร์ดงาน" },
  { key: "orders", label: "ออเดอร์ทั้งหมด" }
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: SwOrderStatus }) {
  const tone: Record<SwOrderStatus, string> = {
    quotation: "bg-gray-100 text-gray-600",
    waiting_confirm: "bg-amber-100 text-amber-700",
    confirmed: "bg-lime-100 text-lime-700",
    design: "bg-sky-100 text-sky-700",
    production: "bg-orange-100 text-orange-700",
    qc: "bg-violet-100 text-violet-700",
    delivery: "bg-teal-100 text-teal-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600"
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone[status]}`}>
      {SW_ORDER_STATUSES[status]}
    </span>
  );
}

export default function SwWorkPage() {
  const [mode, setMode] = useState<SwMode>("demo");
  const [bundles, setBundles] = useState<SwDocumentBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  const reload = useCallback(async (nextMode?: SwMode) => {
    const m = nextMode ?? (await swResolveMode());
    setMode(m);
    try {
      setBundles(await swListBundles(m));
    } catch {
      // cloud มีปัญหา (เช่นยังไม่รัน migration) → ถอยไปโหมดเดโมเพื่อให้ใช้งานต่อได้
      if (m === "cloud") {
        setMode("demo");
        setBundles(await swListBundles("demo"));
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = bundles.find((b) => b.order.id === selectedId) ?? null;

  const handleCreate = async (form: SwOrderFormInput, files: File[]) => {
    setSubmitting(true);
    try {
      const bundle = await swCreateOrder(mode, form);
      for (const file of files) {
        try {
          await swUploadFile(mode, bundle.order.id, file);
        } catch {
          // ไฟล์พลาดไม่ควรทำให้ออเดอร์ล้ม — แนบเพิ่มทีหลังได้
        }
      }
      await reload(mode);
      setSelectedId(bundle.order.id);
      setView("detail");
      setToast(`สร้าง ${bundle.order.orderCode} พร้อมเอกสารครบ 5 ใบแล้ว`);
    } catch (err) {
      alert(`สร้างออเดอร์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const monthTotal = useMemo(() => {
    const now = new Date();
    return bundles
      .filter((b) => {
        const d = new Date(b.order.createdAt);
        return (
          b.order.status !== "cancelled" &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, b) => sum + b.order.total, 0);
  }, [bundles]);

  const countBy = (status: SwOrderStatus) => bundles.filter((b) => b.order.status === status).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bundles;
    return bundles.filter(
      (b) =>
        b.order.orderCode.toLowerCase().includes(q) ||
        b.order.customerName.toLowerCase().includes(q) ||
        SW_PRODUCT_TYPES[b.order.productType].includes(search.trim())
    );
  }, [bundles, search]);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      {/* Header */}
      <header className="no-print sticky top-0 z-20 -mx-4 mb-6 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded-full bg-orange-500" />
            <span className="text-xl font-extrabold tracking-tight">Sw.Work</span>
            <span className="hidden text-xs text-gray-400 sm:inline">Smart Workflow &amp; Production System</span>
          </div>
          <nav className="soft-scrollbar ml-auto flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                  view === item.key || (view === "detail" && item.key === "orders")
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              mode === "cloud" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
            title={mode === "cloud" ? "เชื่อมต่อ Supabase แล้ว" : "โหมดทดลอง — ข้อมูลเก็บในเครื่องนี้"}
          >
            {mode === "cloud" ? "Cloud" : "Demo"}
          </span>
          {mode === "demo" ? (
            <button
              type="button"
              className="text-xs font-bold text-gray-400 hover:text-red-500"
              onClick={() => {
                swResetDemo();
                void reload("demo");
              }}
            >
              รีเซ็ตเดโม
            </button>
          ) : null}
        </div>
      </header>

      {toast ? (
        <div className="no-print mb-4 rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          ✓ {toast}
        </div>
      ) : null}

      {loading ? (
        <p className="py-20 text-center text-gray-400">กำลังโหลด Sw.Work...</p>
      ) : null}

      {/* ---------- Dashboard ---------- */}
      {!loading && view === "dashboard" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="งานทั้งหมด" value={String(bundles.length)} hint="ออเดอร์ในระบบ" />
            <StatCard label="รอคอนเฟิร์ม" value={String(countBy("waiting_confirm") + countBy("quotation"))} hint="เสนอราคา + รอลูกค้า" />
            <StatCard
              label="กำลังทำ"
              value={String(countBy("confirmed") + countBy("design") + countBy("production") + countBy("qc"))}
              hint="ออกแบบ → ผลิต → QC"
            />
            <StatCard label="ยอดเดือนนี้" value={`${thb(monthTotal)} ฿`} hint="รวมยอดสุทธิ (ไม่รวมงานยกเลิก)" />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-extrabold">Business Flow</h3>
            <div className="soft-scrollbar flex items-center gap-1 overflow-x-auto pb-2">
              {SW_PIPELINE.map((step, i) => (
                <div key={step} className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setView("board")}
                    className="rounded-xl bg-gray-50 px-4 py-3 text-center hover:bg-orange-50"
                  >
                    <span className="block text-lg font-extrabold text-orange-600">{countBy(step)}</span>
                    <span className="block text-xs font-semibold text-gray-500">{SW_ORDER_STATUSES[step]}</span>
                  </button>
                  {i < SW_PIPELINE.length - 1 ? <span className="text-gray-300">→</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-extrabold">คิวงานออกแบบ (SW.Design)</h3>
              <ul className="space-y-2 text-sm">
                {(Object.entries(SW_DESIGN_STATUSES) as Array<[string, string]>).map(([key, label]) => {
                  const items = bundles.filter(
                    (b) => b.designTask.status === key && !["completed", "cancelled"].includes(b.order.status)
                  );
                  return (
                    <li key={key} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2">
                      <span className="font-semibold text-gray-600">{label}</span>
                      <span className="font-extrabold text-orange-600">{items.length}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-extrabold">ออเดอร์ล่าสุด</h3>
              <ul className="space-y-2">
                {bundles.slice(0, 6).map((b) => (
                  <li key={b.order.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(b.order.id)}
                      className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-2 text-left text-sm hover:bg-orange-50"
                    >
                      <span>
                        <b>{b.order.orderCode}</b> • {b.order.customerName}
                        <span className="block text-xs text-gray-400">
                          {SW_PRODUCT_TYPES[b.order.productType]} x {b.order.quantity.toLocaleString("th-TH")}
                        </span>
                      </span>
                      <StatusBadge status={b.order.status} />
                    </button>
                  </li>
                ))}
                {bundles.length === 0 ? <li className="text-sm text-gray-400">ยังไม่มีออเดอร์ — เริ่มที่ “+ ออเดอร์ใหม่”</li> : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------- Sales Order Form ---------- */}
      {!loading && view === "new" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-extrabold">ออเดอร์ใหม่ — Sales Order Form</h2>
            <p className="text-sm text-gray-500">กรอกครั้งเดียว ระบบสร้างใบเสนอราคา ใบคอนเฟิร์ม ใบสั่งผลิต ใบ QC และใบจัดส่งให้อัตโนมัติ</p>
          </div>
          <SwOrderForm submitting={submitting} onSubmit={handleCreate} />
        </div>
      ) : null}

      {/* ---------- Pipeline Board ---------- */}
      {!loading && view === "board" ? (
        <div className="soft-scrollbar overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: SW_PIPELINE.length * 250 }}>
            {SW_PIPELINE.map((status) => {
              const items = bundles.filter((b) => b.order.status === status);
              return (
                <div key={status} className="w-[240px] shrink-0 rounded-2xl bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-sm font-extrabold">{SW_ORDER_STATUSES[status]}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-500">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((b) => {
                      const nextIdx = SW_PIPELINE.indexOf(status) + 1;
                      const next = nextIdx < SW_PIPELINE.length ? SW_PIPELINE[nextIdx] : null;
                      return (
                        <div key={b.order.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                          <button type="button" className="block w-full text-left" onClick={() => openDetail(b.order.id)}>
                            <b>{b.order.orderCode}</b>
                            <span className="block text-xs text-gray-500">{b.order.customerName}</span>
                            <span className="block text-xs text-gray-400">
                              {SW_PRODUCT_TYPES[b.order.productType]} x {b.order.quantity.toLocaleString("th-TH")}
                            </span>
                            {b.order.dueDate ? (
                              <span className="mt-1 block text-xs font-semibold text-orange-600">ส่ง {dateTh(b.order.dueDate)}</span>
                            ) : null}
                          </button>
                          {next ? (
                            <button
                              type="button"
                              className="mt-2 w-full rounded-lg bg-gray-100 py-1 text-xs font-bold text-gray-600 hover:bg-orange-100 hover:text-orange-700"
                              onClick={() =>
                                void swUpdateOrderStatus(mode, b.order.id, next).then(() => reload(mode))
                              }
                            >
                              → {SW_ORDER_STATUSES[next]}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                    {items.length === 0 ? <p className="px-1 py-4 text-center text-xs text-gray-300">ว่าง</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ---------- Orders list ---------- */}
      {!loading && view === "orders" ? (
        <div className="space-y-4">
          <input
            className="w-full max-w-sm rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none"
            placeholder="ค้นหา รหัสงาน / ชื่อลูกค้า / สินค้า"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="soft-scrollbar overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[720px] bg-white text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">รหัสงาน</th>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3">สินค้า</th>
                  <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">สร้างเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.order.id}
                    className="cursor-pointer border-b border-gray-100 hover:bg-orange-50"
                    onClick={() => openDetail(b.order.id)}
                  >
                    <td className="px-4 py-3 font-bold">{b.order.orderCode}</td>
                    <td className="px-4 py-3">{b.order.customerName}</td>
                    <td className="px-4 py-3">
                      {SW_PRODUCT_TYPES[b.order.productType]} x {b.order.quantity.toLocaleString("th-TH")}
                    </td>
                    <td className="px-4 py-3 text-right">{thb(b.order.total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.order.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{dateTh(b.order.createdAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">ไม่พบออเดอร์</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ---------- Order detail ---------- */}
      {!loading && view === "detail" && selected ? (
        <SwOrderDetail
          bundle={selected}
          mode={mode}
          userName=""
          onBack={() => setView("orders")}
          onChanged={() => reload(mode)}
        />
      ) : null}
      {!loading && view === "detail" && !selected ? (
        <p className="py-20 text-center text-gray-400">ไม่พบออเดอร์ที่เลือก</p>
      ) : null}
    </div>
  );
}
