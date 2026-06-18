// Edge Function: ส่งแจ้งเตือน LINE ถึง "เจ้าของ (Owner)" ทุกครั้งที่พนักงานเช็คอินเข้างาน
// - ใช้ LINE Messaging API (push message) — Channel Access Token เก็บฝั่งเซิร์ฟเวอร์เท่านั้น
// - ตรวจ JWT ผู้เรียก (ต้องเข้าสู่ระบบ) แล้วดึงชื่อ/สาขาจาก profiles เอง กันการปลอมชื่อ
//
// ตั้งค่า secret ก่อน deploy:
//   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="<channel access token ของ LINE OA>"
//   supabase secrets set LINE_OWNER_USER_ID="<userId ของเจ้าของใน LINE>"   # ใส่หลายคนคั่นด้วย , ได้
//
// Deploy:
//   supabase functions deploy notify-checkin-line
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติใน runtime)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// แปลงเวลา ISO -> "HH:MM" ตามเขตเวลาไทย
function bangkokTime(iso: string): string {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "ใช้ได้เฉพาะ POST" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const ownerIds = (Deno.env.get("LINE_OWNER_USER_ID") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!url || !serviceKey) return json({ error: "เซิร์ฟเวอร์ยังไม่ตั้งค่า service_role" }, 500);
    if (!lineToken) return json({ error: "ยังไม่ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }, 500);
    if (!ownerIds.length) return json({ error: "ยังไม่ตั้งค่า LINE_OWNER_USER_ID" }, 500);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "ไม่ได้เข้าสู่ระบบ" }, 401);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // ระบุตัวผู้เช็คอินจาก token (กันการปลอมชื่อจาก body)
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return json({ error: "โทเค็นไม่ถูกต้อง/หมดอายุ" }, 401);

    const { data: prof } = await admin
      .from("profiles")
      .select("full_name, branch")
      .eq("id", caller.user.id)
      .single();

    const name = prof?.full_name || "พนักงาน";
    const branch = prof?.branch || "-";

    const body = await req.json().catch(() => null);
    const checkInAt: string = typeof body?.checkInAt === "string" ? body.checkInAt : new Date().toISOString();
    const status: string = body?.status === "late" ? "late" : "on_time";
    const lateMinutes = Number(body?.lateMinutes ?? 0) || 0;

    const time = bangkokTime(checkInAt);
    const statusLine = status === "late" ? `🔴 สาย ${lateMinutes} นาที` : "🟢 ตรงเวลา";
    const text = `เช็คอินเข้างาน\n👤 ${name}\n🕘 ${time} น.\n🏢 สาขา ${branch}\n${statusLine}`;

    // ส่งหาเจ้าของทุกคนที่ตั้งค่าไว้
    const results = await Promise.all(
      ownerIds.map((to) =>
        fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineToken}`
          },
          body: JSON.stringify({ to, messages: [{ type: "text", text }] })
        }).then(async (res) => ({ to, ok: res.ok, status: res.status, detail: res.ok ? null : await res.text() }))
      )
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length) return json({ ok: false, sent: results.length - failed.length, failed }, 502);

    return json({ ok: true, sent: results.length });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
