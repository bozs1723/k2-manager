// Edge Function: Meta Send — ส่งข้อความตอบกลับไป Facebook Messenger / Instagram DM
//   เรียกจากแอป (พร้อม JWT ของผู้ใช้) ด้วย body: { conversationId, text }
//   ดึง page token + external_thread_id จากตาราง แล้วยิง Graph API Send API
//   *ไม่* เขียน inbox_messages — แอปเขียนแถว direction 'out' เองอยู่แล้ว (ทำงานได้แม้ยังไม่ผูก token)
//
// Deploy แบบเปิด Verify JWT (ค่าเริ่มต้น) — ใช้ service role อ่าน token ฝั่งเซิร์ฟเวอร์

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
  if (!admin) return json({ ok: false, error: "not configured" }, 200);

  const { conversationId, text } = await req.json().catch(() => ({}));
  if (!conversationId || !text) return json({ ok: false, error: "missing conversationId/text" }, 400);

  const { data: conv } = await admin
    .from("inbox_conversations")
    .select("external_thread_id, platform, page_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv?.external_thread_id || !conv.page_id) {
    // ยังไม่ผูกเพจ/ไม่ใช่แชทจริง — ถือว่าบันทึกในระบบพอ (mock)
    return json({ ok: true, delivered: false, reason: "no external thread" });
  }

  const { data: page } = await admin
    .from("connected_pages")
    .select("page_access_token, external_page_id")
    .eq("id", conv.page_id)
    .maybeSingle();
  const token = page?.page_access_token as string | null;
  if (!token) return json({ ok: true, delivered: false, reason: "no page token" });

  const endpoint = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: conv.external_thread_id },
      messaging_type: "RESPONSE",
      message: { text }
    })
  }).catch(() => null);

  if (!res || !res.ok) {
    const detail = res ? await res.text().catch(() => "") : "network error";
    return json({ ok: false, delivered: false, error: detail }, 200);
  }
  const result = await res.json().catch(() => ({}));
  return json({ ok: true, delivered: true, messageId: result.message_id ?? null });
});
