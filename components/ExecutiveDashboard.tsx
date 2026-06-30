"use client";

import { useMemo } from "react";
import type { Job, JobStatus, JobType } from "@/lib/types";
import { initialJobs } from "@/lib/mock-data";

const baht = (n: number) =>
new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

const num = (n: number) => new Intl.NumberFormat("th-TH").format(Number(n) || 0);

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function daysFromToday(due: string): number {
  if (!due) return 9999;
const d0 = new Date(todayISO()).getTime();
const d1 = new Date(due).getTime();
return Math.round((d1 - d0) / 86400000);
}

const TERMINAL: JobStatus[] = ["Completed", "Cancelled"];
const PRODUCTION_STATUSES: JobStatus[] = ["Ready for Production", "In Production", "QC", "Packing"];

const statusLabel: Record<JobStatus, string> = {
Quotation: "รอเสนอราคา",
  "Waiting Deposit": "รอมัดจำ",
  "Verifying Payment": "รอตรวจสอบยอด",
  "Deposit Confirmed": "มัดจำแล้ว",
  "New Order": "รับงานใหม่",
  "Waiting for File": "รอไฟล์",
  Designing: "กำลังออกแบบ",
  "Waiting for Customer Approval": "รอลูกค้าอนุมัติ",
  "Ready for Production": "พร้อมผลิต",
  "In Production": "กำลังผลิต",
  QC: "ตรวจคุณภาพ",
  Packing: "แพ็กของ",
  "Delivered / Picked Up": "จัดส่ง / รับแล้ว",
  Completed: "เสร็จสิ้น",
  Cancelled: "ยกเลิก"
  };

const FUNNEL_GROUPS: { label: string; tone: string; statuses: JobStatus[] }[] = [
  { label: "ขาย / การเงิน", tone: "bg-k2-mint", statuses: ["Quotation", "Waiting Deposit", "Verifying Payment", "Deposit Confirmed"] },
  { label: "เตรียมงาน", tone: "bg-k2-lilac", statuses: ["New Order", "Waiting for File", "Designing", "Waiting for Customer Approval"] },
  { label: "ผลิต", tone: "bg-k2-sky", statuses: ["Ready for Production", "In Production", "QC", "Packing"] },
  { label: "ส่งมอบ", tone: "bg-k2-peach", statuses: ["Delivered / Picked Up"] }
  ];

type Props = { jobs?: Job[] };

export default function ExecutiveDashboard({ jobs = initialJobs }: Props) {
const m = useMemo(() => {
const active = jobs.filter((j) => !TERMINAL.includes(j.status));
const openValue = active.reduce((s, j) => s + (Number(j.price) || 0), 0);
const depositIn = jobs.reduce((s, j) => s + (Number(j.deposit) || 0), 0);
const balanceDue = active.reduce((s, j) => s + (Number(j.remainingBalance) || 0), 0);
const overdue = active.filter((j) => daysFromToday(j.dueDate) < 0);
const dueToday = active.filter((j) => daysFromToday(j.dueDate) === 0);
const inProduction = active.filter((j) => PRODUCTION_STATUSES.includes(j.status));

const byStatus: Record<string, { count: number; value: number }> = {};
active.forEach((j) => {
const k = j.status;
byStatus[k] = byStatus[k] || { count: 0, value: 0 };
byStatus[k].count += 1;
byStatus[k].value += Number(j.price) || 0;
});
const maxStatusCount = Math.max(1, ...Object.values(byStatus).map((v) => v.count));

const byStaff: Record<string, { count: number; qty: number; value: number }> = {};
inProduction.forEach((j) => {
const k = j.assignedProduction?.trim() || "— ยังไม่มอบหมาย —";
byStaff[k] = byStaff[k] || { count: 0, qty: 0, value: 0 };
byStaff[k].count += 1;
byStaff[k].qty += Number(j.quantity) || 0;
byStaff[k].value += Number(j.price) || 0;
});
const staffRows = Object.entries(byStaff).sort((a, b) => b[1].count - a[1].count);
const maxStaff = Math.max(1, ...staffRows.map(([, v]) => v.count));

const trend: { label: string; count: number; isPast: boolean }[] = [];
for (let i = 0; i < 7; i++) {
const d = new Date(todayISO());
d.setDate(d.getDate() + i);
const iso = new Intl.DateTimeFormat("en-CA").format(d);
let count = active.filter((j) => j.dueDate === iso).length;
if (i === 0) count += overdue.length;
trend.push({
label: i === 0 ? "วันนี้" : d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric" }),
count,
isPast: i === 0 && overdue.length > 0
});
}
const maxTrend = Math.max(1, ...trend.map((t) => t.count));

const byType: Record<string, { count: number; value: number }> = {};
active.forEach((j) => {
  const k = j.type as JobType;
byType[k] = byType[k] || { count: 0, value: 0 };
byType[k].count += 1;
byType[k].value += Number(j.price) || 0;
});
const typeRows = Object.entries(byType).sort((a, b) => b[1].value - a[1].value);

const actions = [...overdue, ...dueToday].sort((a, b) => daysFromToday(a.dueDate) - daysFromToday(b.dueDate));

return { active, openValue, depositIn, balanceDue, overdue, dueToday, inProduction, byStatus, maxStatusCount, staffRows, maxStaff, trend, maxTrend, typeRows, actions };
}, [jobs]);

return (
  <div className="space-y-5 font-sans text-k2-ink">
  <div className="flex flex-wrap items-end justify-between gap-3">
  <div>
  <h2 className="text-2xl font-extrabold">ภาพรวมผู้บริหาร</h2>
  <p className="text-sm text-k2-muted">สรุปเงิน งาน และคอขวดการผลิต ณ {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
</div>
<span className="rounded-full bg-k2-cloud px-3 py-1 text-xs font-bold text-k2-muted">งานเปิดอยู่ {num(m.active.length)} งาน</span>
</div>

<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
<Kpi label="มูลค่างานเปิดอยู่" value={baht(m.openValue)} tone="bg-k2-sky" sub={`${num(m.active.length)} งาน`} />
<Kpi label="มัดจำรับแล้ว" value={baht(m.depositIn)} tone="bg-k2-mint" sub="สะสมทุกงาน" />
<Kpi label="ยอดคงเหลือค้างรับ" value={baht(m.balanceDue)} tone="bg-k2-peach" sub="ต้องตามเก็บ" />
<Kpi label="กำลังผลิตอยู่" value={num(m.inProduction.length)} tone="bg-k2-lilac" sub="พร้อมผลิต→แพ็ก" />
<Kpi label="เลยกำหนดส่ง" value={num(m.overdue.length)} tone={m.overdue.length ? "bg-rose-100" : "bg-k2-cloud"} sub={m.overdue.length ? "ต้องเคลียร์ด่วน" : "ไม่มีงานค้าง"} danger={m.overdue.length > 0} />
<Kpi label="ครบกำหนดวันนี้" value={num(m.dueToday.length)} tone="bg-k2-rose" sub="วางแผนให้ทันส่ง" />
</div>

<div className="grid gap-4 lg:grid-cols-3">
<div className="rounded-3xl bg-white p-5 shadow-glass lg:col-span-2">
<h3 className="mb-4 text-lg font-bold">คอขวดในสายงาน (จำนวนงาน · มูลค่า)</h3>
<div className="space-y-4">
{FUNNEL_GROUPS.map((g) => {
const rows = g.statuses.filter((s) => m.byStatus[s]);
if (!rows.length) return null;
return (
<div key={g.label}>
<div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-k2-muted">{g.label}</div>
<div className="space-y-1.5">
{rows.map((s) => {
const v = m.byStatus[s];
return (
<div key={s} className="flex items-center gap-3">
<div className="w-28 shrink-0 text-sm">{statusLabel[s]}</div>
<div className="h-6 flex-1 overflow-hidden rounded-full bg-k2-cloud">
<div className={`flex h-full items-center justify-end rounded-full ${g.tone} px-2 text-xs font-bold text-k2-ink`} style={{ width: `${Math.max(8, (v.count / m.maxStatusCount) * 100)}%` }}>
{v.count}
</div>
</div>
<div className="w-24 shrink-0 text-right text-xs text-k2-muted">{baht(v.value)}</div>
</div>
);
})}
</div>
</div>
);
})}
</div>
</div>

<div className="rounded-3xl bg-white p-5 shadow-glass">
<h3 className="mb-1 text-lg font-bold">กำหนดส่ง 7 วัน</h3>
<p className="mb-4 text-xs text-k2-muted">งานเลยกำหนดถูกกองไว้ที่ "วันนี้"</p>
<div className="flex h-44 items-end justify-between gap-2">
{m.trend.map((t, i) => (
<div key={i} className="flex flex-1 flex-col items-center gap-1">
<div className="text-xs font-bold">{t.count}</div>
<div className={`w-full rounded-t-lg ${t.isPast ? "bg-rose-300" : "bg-k2-mint"}`} style={{ height: `${(t.count / m.maxTrend) * 100}%`, minHeight: t.count ? 6 : 2 }} />
<div className="text-[10px] text-k2-muted">{t.label}</div>
</div>
))}
</div>
</div>
</div>

<div className="grid gap-4 lg:grid-cols-2">
<div className="rounded-3xl bg-white p-5 shadow-glass">
<h3 className="mb-4 text-lg font-bold">กำลังการผลิตรายช่าง</h3>
{m.staffRows.length === 0 ? (
<p className="text-sm text-k2-muted">ยังไม่มีงานในสายผลิต</p>
) : (
<div className="space-y-2.5">
{m.staffRows.map(([name, v]) => (
<div key={name} className="flex items-center gap-3">
<div className={`w-32 shrink-0 truncate text-sm ${name.startsWith("—") ? "font-bold text-rose-600" : ""}`}>{name}</div>
<div className="h-6 flex-1 overflow-hidden rounded-full bg-k2-cloud">
<div className="flex h-full items-center justify-end rounded-full bg-k2-sky px-2 text-xs font-bold" style={{ width: `${Math.max(10, (v.count / m.maxStaff) * 100)}%` }}>
{v.count} งาน
</div>
</div>
<div className="w-20 shrink-0 text-right text-xs text-k2-muted">{num(v.qty)} ชิ้น</div>
</div>
))}
</div>
)}
</div>

<div className="rounded-3xl bg-white p-5 shadow-glass">
<h3 className="mb-4 text-lg font-bold">สัดส่วนประเภทงาน (ตามมูลค่า)</h3>
<div className="space-y-2.5">
{m.typeRows.map(([type, v]) => (
<div key={type} className="flex items-center justify-between gap-3 rounded-2xl bg-k2-cloud px-3 py-2">
<div className="text-sm font-semibold">{type}</div>
<div className="flex items-center gap-3 text-xs text-k2-muted">
<span className="rounded-full bg-white px-2 py-0.5 font-bold text-k2-ink">{v.count} งาน</span>
<span className="w-24 text-right">{baht(v.value)}</span>
</div>
</div>
))}
</div>
</div>
</div>

<div className="rounded-3xl bg-white p-5 shadow-glass">
<h3 className="mb-4 text-lg font-bold">⚠️ ต้องจัดการ — เลยกำหนด &amp; ครบวันนี้</h3>
{m.actions.length === 0 ? (
<p className="rounded-2xl bg-k2-rose px-4 py-3 text-sm font-semibold text-emerald-700">✓ ไม่มีงานเลยกำหนดหรือครบวันนี้ — ทุกอย่างอยู่ในแผน</p>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left text-sm">
<thead className="text-xs uppercase text-k2-muted">
<tr>
<th className="pb-2 pr-3">งาน</th>
<th className="pb-2 pr-3">ลูกค้า</th>
<th className="pb-2 pr-3">ประเภท</th>
<th className="pb-2 pr-3">สถานะ</th>
<th className="pb-2 pr-3">กำหนดส่ง</th>
<th className="pb-2 pr-3 text-right">มูลค่า</th>
</tr>
</thead>
<tbody>
{m.actions.map((j) => {
const d = daysFromToday(j.dueDate);
const tag = d < 0 ? `เลย ${-d} วัน` : "วันนี้";
return (
<tr key={j.id} className="border-t border-k2-cloud">
<td className="py-2 pr-3 font-mono text-xs font-bold text-k2-ink">{j.quoteNumber || j.id}</td>
<td className="py-2 pr-3">{j.customerName}</td>
<td className="py-2 pr-3 text-k2-muted">{j.type}</td>
<td className="py-2 pr-3">{statusLabel[j.status]}</td>
<td className="py-2 pr-3">
<span className={`rounded-full px-2 py-0.5 text-xs font-bold ${d < 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{tag}</span>
</td>
<td className="py-2 pr-3 text-right text-k2-muted">{baht(Number(j.price) || 0)}</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>
</div>
);
}
function Kpi({ label, value, sub, tone, danger }: { label: string; value: string; sub?: string; tone: string; danger?: boolean }) {
return (
<div className={`rounded-3xl ${tone} p-4 shadow-glass`}>
<div className="text-xs font-bold text-k2-muted">{label}</div>
<div className={`mt-1 text-2xl font-extrabold ${danger ? "text-rose-700" : "text-k2-ink"}`}>{value}</div>
{sub && <div className="mt-0.5 text-[11px] text-k2-muted">{sub}</div>}
</div>
);
}
