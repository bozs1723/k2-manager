// Edge Function: สรุปสิ้นวัน แยกสาขา ส่งเข้ากลุ่ม LINE (เรียกโดย Cron รอบเย็น เช่น 20:00 ICT = 13:00 UTC)
//   - งานที่เสร็จวันนี้ (status เปลี่ยนเป็น Completed วันนี้ ตาม job_status_history)
//   - เงินรับเข้าจริงวันนี้ (มัดจำที่รับวันนี้ + ยอดคงเหลือที่ปิดวันนี้)
//
// ความปลอดภัย: ปิด Verify JWT แล้วป้องกันด้วย header x-cron-secret = REPORT_CRON_SECRET
// Secrets: LINE_CHANNEL_ACCESS_TOKEN, REPORT_CRON_SECRET (ใช้ตัวเดียวกับ attendance-report ได้)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_PUSH = "https://api.line.me/v2/bot/message/push";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function bangkokDateISO(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function baht(n: number): string {
  return `฿${Math.round(n).toLocaleString("en-US")}`;
}

type Job = {
  id: string;
  production_branch: string | null;
  branch: string | null;
  price: number | string;
  deposit: number | string;
  remaining_balance: number | string;
  deposit_received_date: string | null;
  balance_received_date: string | null;
  title: string | null;
  customer_name: string | null;
  status: string | null;
};

function jobBranch(j: Job): string {
  return (j.production_branch || j.branch || "").trim();
}

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get("REPORT_CRON_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!url || !serviceKey) return json({ error: "ยังไม่ตั้งค่า service_role" }, 500);
    if (!lineToken) return json({ error: "ยังไม่ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }, 500);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const today = bangkokDateISO();

    const { data: groups } = await admin.from("branch_line_groups").select("branch, line_group_id");
    if (!groups?.length) return json({ ok: true, note: "ยังไม่มีสาขาที่ผูกกลุ่ม LINE" });

    // งานที่มีการรับเงินวันนี้ (มัดจำ หรือ ปิดยอด)
    const { data: payJobs } = await admin
      .from("jobs")
      .select("id, production_branch, branch, price, deposit, remaining_balance, deposit_received_date, balance_received_date, title, customer_name, status")
      .or(`deposit_received_date.eq.${today},balance_received_date.eq.${today}`);

    // งานที่เปลี่ยนสถานะเป็น Completed วันนี้ (ดูจากประวัติ 2 วันล่าสุด แล้วกรองตามวันไทย)
    const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data: hist } = await admin
      .from("job_status_history")
      .select("job_id, created_at")
      .eq("to_status", "Completed")
      .gte("created_at", since);
    const completedTodayIds = new Set(
      (hist ?? []).filter((h) => bangkokDateISO(new Date(h.created_at)) === today).map((h) => h.job_id)
    );

    let completedJobs: Job[] = [];
    if (completedTodayIds.size) {
      const { data } = await admin
        .from("jobs")
        .select("id, production_branch, branch, price, deposit, remaining_balance, deposit_received_date, balance_received_date, title, customer_name, status")
        .in("id", Array.from(completedTodayIds));
      completedJobs = (data ?? []) as Job[];
    }

    const results: Array<Record<string, unknown>> = [];
    for (const g of groups) {
      const branch = (g.branch as string).trim();

      // ----- เงินรับเข้าวันนี้ -----
      let depositSum = 0;
      let balanceSum = 0;
      for (const j of (payJobs ?? []) as Job[]) {
        if (jobBranch(j) !== branch) continue;
        const price = Number(j.price) || 0;
        const remaining = Number(j.remaining_balance) || 0;
        const deposit = Number(j.deposit) || 0;
        const balToday = j.balance_received_date === today;
        const depToday = j.deposit_received_date === today;
        if (balToday) balanceSum += remaining;
        if (depToday) depositSum += balToday ? Math.max(price - remaining, 0) : deposit;
      }
      const revenue = depositSum + balanceSum;

      // ----- งานที่เสร็จวันนี้ -----
      const done = completedJobs.filter((j) => jobBranch(j) === branch);
      const doneLines = done.slice(0, 15).map((j) => `• ${j.title || "งาน"} — ${j.customer_name || "-"}`);
      const moreDone = done.length > 15 ? `\n…และอีก ${done.length - 15} งาน` : "";

      const text = [
        `🧾 สรุปสิ้นวัน — ${branch}`,
        `🗓 ${thaiDate(today)}`,
        ``,
        `✅ งานที่เสร็จวันนี้ (${done.length})`,
        done.length ? doneLines.join("\n") + moreDone : "— ไม่มี —",
        ``,
        `💰 รายรับวันนี้: ${baht(revenue)}`,
        `   • มัดจำที่รับ: ${baht(depositSum)}`,
        `   • ปิดยอด/ยอดคงเหลือ: ${baht(balanceSum)}`
      ].join("\n");

      const res = await fetch(LINE_PUSH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
        body: JSON.stringify({ to: g.line_group_id, messages: [{ type: "text", text }] })
      });
      results.push({ branch, done: done.length, revenue, ok: res.ok, status: res.status });
    }

    return json({ ok: true, date: today, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
