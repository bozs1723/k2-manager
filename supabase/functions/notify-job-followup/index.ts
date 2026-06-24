// Edge Function: รายงานเตือน "งานต้องเร่ง" เข้ากลุ่ม LINE กลาง (เรียกโดย Cron วันละครั้ง เช้า)
//   - งานด่วน (priority ด่วน/ด่วนมาก/ต้องเสร็จวันนี้ หรือ is_express)
//   - งานใกล้กำหนดส่ง (เหลือ <= 2 วัน) และงานเลยกำหนด
//   แต่ละงานบอก: ติดอยู่ขั้นตอนไหน + แผนกไหนต้องทำต่อ + เหลือ/เลยกี่วัน + สาขา
//
// ทดสอบเอง: body { "test": true }  (ไม่ต้องมี cron secret)
// ป้องกัน cron: header x-cron-secret = REPORT_CRON_SECRET (ถ้าตั้งไว้)
//
// Secrets: LINE_CHANNEL_ACCESS_TOKEN, ORDER_NOTIFY_GROUP_ID, (REPORT_CRON_SECRET ถ้ามี)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_PUSH = "https://api.line.me/v2/bot/message/push";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret"
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function bangkokDateISO(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
// จำนวนวันจาก a -> b (รับ "YYYY-MM-DD")
function dayDiff(aISO: string, bISO: string): number {
  return Math.round((Date.parse(`${bISO}T00:00:00Z`) - Date.parse(`${aISO}T00:00:00Z`)) / 86400000);
}

const STATUS_TH: Record<string, string> = {
  "Quotation": "รอเสนอราคา", "Waiting Deposit": "รอมัดจำ", "Verifying Payment": "รอตรวจสอบยอด",
  "Deposit Confirmed": "มัดจำแล้ว", "New Order": "รับงานใหม่", "Waiting for File": "รอไฟล์",
  "Designing": "กำลังออกแบบ", "Waiting for Customer Approval": "รอลูกค้าอนุมัติ",
  "Ready for Production": "พร้อมผลิต", "In Production": "กำลังผลิต", "QC": "ตรวจคุณภาพ",
  "Packing": "แพ็กของ", "Delivered / Picked Up": "จัดส่ง/รับแล้ว", "Completed": "เสร็จสิ้น", "Cancelled": "ยกเลิก"
};
// แผนกที่ต้องทำต่อในแต่ละสถานะ
const DEPT_TH: Record<string, string> = {
  "Quotation": "ฝ่ายขาย", "Waiting Deposit": "ฝ่ายขาย/ลูกค้า", "Verifying Payment": "ฝ่ายการเงิน",
  "Deposit Confirmed": "ผู้จัดการสาขา", "New Order": "ผู้จัดการสาขา", "Waiting for File": "ฝ่ายขาย/ลูกค้า",
  "Designing": "ดีไซเนอร์", "Waiting for Customer Approval": "ฝ่ายขาย", "Ready for Production": "ฝ่ายผลิต",
  "In Production": "ฝ่ายผลิต", "QC": "ฝ่ายผลิต/QC", "Packing": "ฝ่ายแพ็ก", "Delivered / Picked Up": "ฝ่ายขาย"
};
const DONE = ["Delivered / Picked Up", "Completed", "Cancelled"];
const URGENT_PRIORITY = ["Urgent", "Very Urgent", "Today"];

type JobRow = {
  job_number: string; title: string | null; status: string; priority: string | null;
  is_express: boolean | null; due_date: string | null; production_branch: string | null; acceptance: string | null;
};

function buildReport(branchLabel: string, dateISO: string, jobs: JobRow[]): string | null {
  const today = dateISO;
  const items = jobs
    .filter((j) => !DONE.includes(j.status))
    .map((j) => {
      const daysLeft = j.due_date ? dayDiff(today, j.due_date) : 999;
      const urgent = j.is_express === true || URGENT_PRIORITY.includes(j.priority ?? "");
      const dueSoon = j.due_date ? daysLeft <= 2 : false;
      return { j, daysLeft, urgent, dueSoon };
    })
    .filter((x) => x.urgent || x.dueSoon)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (!items.length) return null;

  const lines = items.map(({ j, daysLeft, urgent }) => {
    const flag = daysLeft < 0 ? "🔴" : daysLeft === 0 ? "🟠" : urgent ? "⚡️" : "🟡";
    const dueText = !j.due_date ? "ไม่ระบุกำหนด"
      : daysLeft < 0 ? `เลยกำหนด ${-daysLeft} วัน`
      : daysLeft === 0 ? "ครบกำหนดวันนี้"
      : `เหลือ ${daysLeft} วัน`;
    const stat = j.acceptance === "pending" ? "รอผู้จัดการอนุมัติ" : (STATUS_TH[j.status] ?? j.status);
    const dept = j.acceptance === "pending" ? "ผู้จัดการสาขา" : (DEPT_TH[j.status] ?? "-");
    const exp = j.is_express ? " ⚡️ด่วน" : "";
    return `${flag} ${j.job_number} · ${j.title || "-"}${exp}\n   ⏱ ${dueText} · 📍 ${stat} → ${dept}${j.production_branch ? ` · ${j.production_branch}` : ""}`;
  });

  return [
    `⏰ งานต้องเร่ง / ใกล้กำหนด — ${branchLabel}`,
    `🗓 ${thaiDate(dateISO)} · รวม ${items.length} งาน`,
    ``,
    ...lines,
    ``,
    `🔴 เลยกำหนด · 🟠 วันนี้ · ⚡️ ด่วน · 🟡 ใกล้กำหนด`
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const groupId = Deno.env.get("ORDER_NOTIFY_GROUP_ID");
    const cronSecret = Deno.env.get("REPORT_CRON_SECRET");
    if (!url || !serviceKey) return json({ error: "ยังไม่ตั้งค่า service_role" }, 500);
    if (!lineToken) return json({ error: "ยังไม่ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }, 500);
    if (!groupId) return json({ ok: true, note: "ยังไม่ได้ตั้ง ORDER_NOTIFY_GROUP_ID — ข้ามการแจ้งเตือน" });

    const body = await req.json().catch(() => ({}));
    const isTest = (body as { test?: boolean })?.test === true;
    // ถ้าตั้ง cron secret ไว้ และไม่ใช่โหมดทดสอบ → ต้องมี header ตรง
    if (cronSecret && !isTest && req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "unauthorized" }, 401);
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const today = bangkokDateISO();
    const { data: jobs } = await admin
      .from("jobs")
      .select("job_number, title, status, priority, is_express, due_date, production_branch, acceptance")
      .not("status", "in", "(Completed,Cancelled)");

    const text = buildReport("ทุกสาขา", today, (jobs ?? []) as JobRow[]);
    if (!text) return json({ ok: true, note: "วันนี้ไม่มีงานด่วน/ใกล้กำหนด", date: today });

    const res = await fetch(LINE_PUSH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
      body: JSON.stringify({ to: groupId, messages: [{ type: "text", text }] })
    });
    return json({ ok: res.ok, status: res.status, date: today, detail: res.ok ? null : await res.text() });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
