// Edge Function: LINE Webhook — ระบบคำสั่งในกลุ่ม
//   id / groupid          → ตอบ Group ID (ใช้ตอนตั้งค่าผูกสาขา)
//   รายงาน / เช็คอิน      → สรุปเช็คอินของสาขานี้ "ณ ตอนนี้"
//   เช็คเอาท์             → สรุปเช็คเอาท์ของสาขานี้ "ณ ตอนนี้"
//   เมนู / help           → แสดงรายการคำสั่ง
//   (ข้อความอื่น)         → เงียบ
//
// Deploy แบบ "ปิด Verify JWT" + ต้องมี secret: LINE_CHANNEL_ACCESS_TOKEN
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_REPLY = "https://api.line.me/v2/bot/message/reply";

function bangkokDateISO(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function bangkokTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  } catch {
    return "";
  }
}

type Member = { id: string; full_name: string | null; branch: string | null; role: string | null };
type Att = { profile_id: string; check_in_at: string | null; check_out_at: string | null; late_minutes: number | null; status: string | null };

function buildCheckin(branch: string, dateISO: string, members: Member[], att: Map<string, Att>): string {
  const present: string[] = [], absent: string[] = [];
  for (const m of members) {
    const name = m.full_name || "พนักงาน";
    const a = att.get(m.id);
    if (a?.check_in_at) {
      const tag = a.status === "late" ? `สาย ${a.late_minutes ?? 0} นาที` : "ตรงเวลา";
      present.push(`• ${name} — ${bangkokTime(a.check_in_at)} (${tag})`);
    } else absent.push(`• ${name}`);
  }
  return [
    `📋 รายงานเช็คอิน — ${branch}`,
    `🗓 ${thaiDate(dateISO)} (${bangkokTime(new Date().toISOString())})`,
    ``,
    `✅ เช็คอินแล้ว (${present.length})`,
    present.length ? present.join("\n") : "— ไม่มี —",
    ``,
    `⛔️ ยังไม่เช็คอิน (${absent.length})`,
    absent.length ? absent.join("\n") : "— ครบทุกคน 🎉 —"
  ].join("\n");
}

function buildCheckout(branch: string, dateISO: string, members: Member[], att: Map<string, Att>): string {
  const out: string[] = [], notOut: string[] = [], absent: string[] = [];
  for (const m of members) {
    const name = m.full_name || "พนักงาน";
    const a = att.get(m.id);
    if (!a?.check_in_at) absent.push(`• ${name}`);
    else if (a.check_out_at) out.push(`• ${name} — ${bangkokTime(a.check_out_at)}`);
    else notOut.push(`• ${name} (เข้า ${bangkokTime(a.check_in_at)})`);
  }
  return [
    `📋 รายงานเช็คเอาท์ — ${branch}`,
    `🗓 ${thaiDate(dateISO)} (${bangkokTime(new Date().toISOString())})`,
    ``,
    `✅ เช็คเอาท์แล้ว (${out.length})`,
    out.length ? out.join("\n") : "— ไม่มี —",
    ``,
    `⌛️ ยังไม่เช็คเอาท์ (${notOut.length})`,
    notOut.length ? notOut.join("\n") : "— ไม่มี —",
    ``,
    `🚫 ขาด/ไม่มา (${absent.length})`,
    absent.length ? absent.join("\n") : "— ไม่มี —"
  ].join("\n");
}

const MENU = [
  "🤖 คำสั่งที่ใช้ได้:",
  "• รายงาน / เช็คอิน — สรุปเช็คอินสาขานี้ ณ ตอนนี้",
  "• เช็คเอาท์ — สรุปเช็คเอาท์สาขานี้ ณ ตอนนี้",
  "• id — ดู Group ID (ไว้ตั้งค่าผูกสาขา)",
  "• เมนู — แสดงคำสั่งทั้งหมด"
].join("\n");

// สร้างรายงานสดของ "ทุกสาขา" ที่ผูกกับกลุ่มนี้ — คืนเป็นข้อความแยกสาขา (สูงสุด 5 ข้อความ/ครั้งตามลิมิต LINE)
async function liveReport(admin: ReturnType<typeof createClient>, groupId: string, kind: "checkin" | "checkout"): Promise<string[]> {
  const { data: rows } = await admin.from("branch_line_groups").select("branch").eq("line_group_id", groupId);
  const branches = Array.from(new Set((rows ?? []).map((r) => r.branch as string))).sort((a, b) => a.localeCompare(b, "th"));
  if (!branches.length) return ["กลุ่มนี้ยังไม่ได้ผูกกับสาขา — พิมพ์ \"id\" เพื่อเอา Group ID ไปผูกในระบบก่อนครับ"];

  const today = bangkokDateISO();
  const { data: att } = await admin
    .from("attendance")
    .select("profile_id, check_in_at, check_out_at, late_minutes, status")
    .eq("work_date", today);
  const attMap = new Map<string, Att>((att ?? []).map((a) => [a.profile_id, a as Att]));

  const { data: profs } = await admin.from("profiles").select("id, full_name, branch, role").in("branch", branches);

  const messages: string[] = [];
  for (const branch of branches) {
    const members = ((profs ?? []) as Member[])
      .filter((p) => p.branch === branch && p.role !== "Owner")
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "th"));
    if (!members.length) {
      messages.push(`สาขา ${branch} ยังไม่มีพนักงานในระบบ`);
      continue;
    }
    messages.push(kind === "checkin" ? buildCheckin(branch, today, members, attMap) : buildCheckout(branch, today, members, attMap));
  }
  return messages.slice(0, 5);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

  const body = await req.json().catch(() => null);
  const events: Array<Record<string, unknown>> = Array.isArray(body?.events) ? body.events : [];

  for (const ev of events) {
    const replyToken = ev.replyToken as string | undefined;
    if (!replyToken || !lineToken) continue;
    const src = (ev.source ?? {}) as { groupId?: string; roomId?: string; userId?: string };
    const message = (ev.message ?? {}) as { type?: string; text?: string };
    const text = (message.text ?? "").trim().toLowerCase();

    let replies: string[] = [];

    if (["id", "groupid", "group id", "ไอดี"].includes(text)) {
      if (src.groupId) replies = [`📌 Group ID ของกลุ่มนี้:\n${src.groupId}\n\nนำไปผูกกับสาขาในตาราง branch_line_groups`];
      else if (src.roomId) replies = [`📌 Room ID:\n${src.roomId}`];
      else if (src.userId) replies = [`📌 User ID:\n${src.userId}`];
    } else if (["เมนู", "help", "คำสั่ง", "?"].includes(text)) {
      replies = [MENU];
    } else if (["รายงาน", "เช็คอิน", "เช็คชื่อ", "checkin", "report"].includes(text)) {
      replies = src.groupId && admin ? await liveReport(admin, src.groupId, "checkin") : ["ใช้คำสั่งนี้ได้เฉพาะในกลุ่มที่ผูกสาขาแล้วครับ"];
    } else if (["เช็คเอาท์", "เช็คเอ้าท์", "checkout", "ออกงาน"].includes(text)) {
      replies = src.groupId && admin ? await liveReport(admin, src.groupId, "checkout") : ["ใช้คำสั่งนี้ได้เฉพาะในกลุ่มที่ผูกสาขาแล้วครับ"];
    }

    if (!replies.length) continue; // ข้อความอื่น — เงียบ

    await fetch(LINE_REPLY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
      body: JSON.stringify({ replyToken, messages: replies.slice(0, 5).map((t) => ({ type: "text", text: t })) })
    }).catch(() => {});
  }

  return new Response("ok");
});
