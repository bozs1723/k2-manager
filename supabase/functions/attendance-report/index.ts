// Edge Function: รายงานลงเวลาเข้ากลุ่ม LINE แยกตามสาขา (เรียกโดย Cron วันละ 2 รอบ)
//   ?kind=checkin   → รายงานเช็คอิน  (ตั้ง cron 10:30 ICT = 03:30 UTC)
//   ?kind=checkout  → รายงานเช็คเอาท์ (ตั้ง cron 18:30 ICT = 11:30 UTC)
//
// ความปลอดภัย: ปิด Verify JWT แล้วป้องกันด้วย header x-cron-secret = REPORT_CRON_SECRET
//
// Secrets ที่ต้องตั้ง:
//   LINE_CHANNEL_ACCESS_TOKEN, REPORT_CRON_SECRET
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_PUSH = "https://api.line.me/v2/bot/message/push";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// วันที่วันนี้ตามเวลาไทย -> "YYYY-MM-DD"
function bangkokDateISO(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

// วันในสัปดาห์ตามเวลาไทย ("Sun".."Sat")
function bangkokWeekday(d = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" }).format(d);
}

// "YYYY-MM-DD" -> "DD/MM/YYYY"
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// timestamptz -> "HH:MM" เวลาไทย
function bangkokTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

type Member = { id: string; full_name: string | null; branch: string | null; role: string | null };
type Att = { profile_id: string; check_in_at: string | null; check_out_at: string | null; late_minutes: number | null; status: string | null };
type Ot = { profile_id: string; hours: number | null; note: string | null };

// รวมชั่วโมง OT แบบอ่านง่าย: 1.5 -> "1.5", 2 -> "2"
function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function buildCheckin(branch: string, dateISO: string, members: Member[], att: Map<string, Att>): string {
  const present: string[] = [];
  const absent: string[] = [];
  for (const m of members) {
    const name = m.full_name || "พนักงาน";
    const a = att.get(m.id);
    if (a?.check_in_at) {
      const tag = a.status === "late" ? `สาย ${a.late_minutes ?? 0} นาที` : "ตรงเวลา";
      present.push(`• ${name} — ${bangkokTime(a.check_in_at)} (${tag})`);
    } else {
      absent.push(`• ${name}`);
    }
  }
  return [
    `📋 รายงานเช็คอิน — ${branch}`,
    `🗓 ${thaiDate(dateISO)} (รอบ 10:30)`,
    ``,
    `✅ เช็คอินแล้ว (${present.length})`,
    present.length ? present.join("\n") : "— ไม่มี —",
    ``,
    `⛔️ ยังไม่เช็คอิน (${absent.length})`,
    absent.length ? absent.join("\n") : "— ครบทุกคน 🎉 —"
  ].join("\n");
}

function buildCheckout(
  branch: string,
  dateISO: string,
  members: Member[],
  att: Map<string, Att>,
  ot: Map<string, number>
): string {
  const out: string[] = [];
  const notOut: string[] = [];
  const absent: string[] = [];
  const otLines: string[] = [];
  let otTotal = 0;
  for (const m of members) {
    const name = m.full_name || "พนักงาน";
    const a = att.get(m.id);
    if (!a?.check_in_at) {
      absent.push(`• ${name}`);
    } else if (a.check_out_at) {
      out.push(`• ${name} — ${bangkokTime(a.check_out_at)}`);
    } else {
      notOut.push(`• ${name} (เข้า ${bangkokTime(a.check_in_at)})`);
    }
    const hours = ot.get(m.id) ?? 0;
    if (hours > 0) {
      otTotal += hours;
      otLines.push(`• ${name} — ${fmtHours(hours)} ชม.`);
    }
  }
  return [
    `📋 รายงานเช็คเอาท์ — ${branch}`,
    `🗓 ${thaiDate(dateISO)} (รอบ 18:30)`,
    ``,
    `✅ เช็คเอาท์แล้ว (${out.length})`,
    out.length ? out.join("\n") : "— ไม่มี —",
    ``,
    `⌛️ ยังไม่เช็คเอาท์ (${notOut.length})`,
    notOut.length ? notOut.join("\n") : "— ไม่มี —",
    ``,
    `🚫 ขาด/ไม่มา (${absent.length})`,
    absent.length ? absent.join("\n") : "— ไม่มี —",
    ``,
    `🕐 OT วันนี้ (รวม ${fmtHours(otTotal)} ชม.)`,
    otLines.length ? otLines.join("\n") : "— ไม่มี —"
  ].join("\n");
}

// รายงานวันหยุด (วันอาทิตย์): แจ้งว่าหยุด + ใครมาทำ OT (= คนที่มาลงเวลา) พร้อมชั่วโมง OT ถ้ามี
function buildHoliday(branch: string, dateISO: string, members: Member[], att: Map<string, Att>, ot: Map<string, number>): string {
  const otPeople: string[] = [];
  for (const m of members) {
    const a = att.get(m.id);
    if (!a?.check_in_at) continue;
    const name = m.full_name || "พนักงาน";
    const timeTxt = a.check_out_at ? `${bangkokTime(a.check_in_at)}-${bangkokTime(a.check_out_at)}` : `เข้า ${bangkokTime(a.check_in_at)}`;
    const hours = ot.get(m.id) ?? 0;
    const hoursTxt = hours > 0 ? ` — OT ${fmtHours(hours)} ชม.` : "";
    otPeople.push(`• ${name} (${timeTxt})${hoursTxt}`);
  }
  return [
    `🏖 วันนี้เป็นวันหยุด — ${branch}`,
    `🗓 ${thaiDate(dateISO)} (วันอาทิตย์)`,
    ``,
    otPeople.length
      ? `🕐 มาทำ OT วันนี้ (${otPeople.length})\n${otPeople.join("\n")}`
      : `ไม่มีพนักงานมาทำ OT วันนี้`
  ].join("\n");
}

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get("REPORT_CRON_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!url || !serviceKey) return json({ error: "ยังไม่ตั้งค่า service_role" }, 500);
    if (!lineToken) return json({ error: "ยังไม่ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }, 500);

    const kind = new URL(req.url).searchParams.get("kind") === "checkout" ? "checkout" : "checkin";
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: groups } = await admin.from("branch_line_groups").select("branch, line_group_id");
    if (!groups?.length) return json({ ok: true, note: "ยังไม่มีสาขาที่ผูกกลุ่ม LINE" });

    const today = bangkokDateISO();
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, branch, role")
      .not("branch", "is", null);
    const { data: att } = await admin
      .from("attendance")
      .select("profile_id, check_in_at, check_out_at, late_minutes, status")
      .eq("work_date", today);

    const attByProfile = new Map<string, Att>((att ?? []).map((a) => [a.profile_id, a as Att]));

    // วันอาทิตย์ = วันหยุดของทุกคน → รายงานแบบวันหยุด (แจ้งคนที่มาทำ OT)
    const isHoliday = bangkokWeekday() === "Sun";
    // วันหยุดส่งรายงานครั้งเดียวตอนเย็น (รอบเช็คเอาท์) — ข้ามรอบเช้าเพื่อไม่ให้ซ้ำ/แจ้งก่อนคนมา OT
    if (isHoliday && kind === "checkin") {
      return json({ ok: true, kind, date: today, note: "วันหยุด — ข้ามรอบเช้า ส่งสรุป OT ตอนเย็นแทน" });
    }

    // OT ของวันนี้ — รวมชั่วโมงต่อคน (รอบเช็คเอาท์ หรือวันหยุดที่ต้องโชว์ OT)
    const otByProfile = new Map<string, number>();
    if (kind === "checkout" || isHoliday) {
      const { data: ot } = await admin
        .from("overtime")
        .select("profile_id, hours, note")
        .eq("work_date", today);
      for (const row of (ot ?? []) as Ot[]) {
        otByProfile.set(row.profile_id, (otByProfile.get(row.profile_id) ?? 0) + (Number(row.hours) || 0));
      }
    }

    const results: Array<Record<string, unknown>> = [];
    for (const g of groups) {
      // พนักงานของสาขานี้ (ตัดเจ้าของออก เพราะปกติไม่ลงเวลา) เรียงตามชื่อ
      const members = ((profs ?? []) as Member[])
        .filter((p) => p.branch === g.branch && p.role !== "Owner")
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "th"));
      if (!members.length) continue;

      const text = isHoliday
        ? buildHoliday(g.branch, today, members, attByProfile, otByProfile)
        : kind === "checkin"
          ? buildCheckin(g.branch, today, members, attByProfile)
          : buildCheckout(g.branch, today, members, attByProfile, otByProfile);

      const res = await fetch(LINE_PUSH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
        body: JSON.stringify({ to: g.line_group_id, messages: [{ type: "text", text }] })
      });
      results.push({ branch: g.branch, ok: res.ok, status: res.status, detail: res.ok ? null : await res.text() });
    }

    return json({ ok: true, kind, date: today, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
