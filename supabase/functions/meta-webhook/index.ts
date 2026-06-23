// Edge Function: Meta Webhook — รับข้อความเข้าจาก Facebook Messenger + Instagram DM
//   GET  → ตอบ challenge ตอนตั้งค่า Webhook (hub.verify_token = META_VERIFY_TOKEN)
//   POST → แปลง event เป็น inbox_conversations + inbox_messages (upsert ผ่าน service role)
//
// Deploy แบบ "ปิด Verify JWT" + ต้องมี secret: META_VERIFY_TOKEN
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ)
//
// ผูกหลายเพจได้: จับคู่ entry.id (Page ID / IG account ID) กับ connected_pages.external_page_id
// ถ้ายังไม่ผูก external_page_id จะ fallback ไปเพจ active เพจแรกของ platform นั้น เพื่อไม่ให้ข้อความหาย

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseAdmin = ReturnType<typeof createClient>;

function previewOf(text: string | null, hasAttachment: boolean): string {
  if (text && text.trim()) return text.trim().slice(0, 160);
  return hasAttachment ? "[ไฟล์แนบ]" : "";
}

async function resolvePageId(admin: SupabaseAdmin, platform: string, externalPageId: string | null): Promise<string | null> {
  if (externalPageId) {
    const { data } = await admin.from("connected_pages").select("id").eq("external_page_id", externalPageId).maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data: fallback } = await admin
    .from("connected_pages")
    .select("id")
    .eq("platform", platform)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (fallback?.id as string) ?? null;
}

// ดึงชื่อ/รูปลูกค้าจาก Graph API (best-effort — ต้องมี page token)
async function fetchProfile(senderId: string, pageToken: string | null): Promise<{ name?: string; avatar?: string }> {
  if (!pageToken) return {};
  try {
    const res = await fetch(`https://graph.facebook.com/${senderId}?fields=name,profile_pic&access_token=${pageToken}`);
    if (!res.ok) return {};
    const json = await res.json();
    return { name: json.name as string | undefined, avatar: json.profile_pic as string | undefined };
  } catch {
    return {};
  }
}

async function ingestMessage(admin: SupabaseAdmin, opts: {
  platform: string;
  externalPageId: string | null;
  senderId: string;
  recipientId: string;
  isEcho: boolean;
  text: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  externalMessageId: string | null;
  timestamp: number;
}) {
  const pageId = await resolvePageId(admin, opts.platform, opts.externalPageId);
  // echo = ข้อความที่เพจส่งออก (direction out) → external_thread_id คือผู้รับ
  const direction = opts.isEcho ? "out" : "in";
  const threadId = opts.isEcho ? opts.recipientId : opts.senderId;
  const hasAttachment = Boolean(opts.attachmentUrl);
  const createdAt = new Date(opts.timestamp || Date.now()).toISOString();

  // หา/สร้างบทสนทนา
  let conversationId: string | null = null;
  const { data: existing } = await admin
    .from("inbox_conversations")
    .select("id")
    .eq("page_id", pageId)
    .eq("external_thread_id", threadId)
    .maybeSingle();

  if (existing?.id) {
    conversationId = existing.id as string;
  } else {
    let token: string | null = null;
    if (pageId) {
      const { data: pageRow } = await admin.from("connected_pages").select("page_access_token").eq("id", pageId).maybeSingle();
      token = (pageRow?.page_access_token as string | null) ?? null;
    }
    const profile = direction === "in" ? await fetchProfile(threadId, token) : {};
    const { data: created } = await admin
      .from("inbox_conversations")
      .insert({
        page_id: pageId,
        platform: opts.platform,
        external_thread_id: threadId,
        customer_name: profile.name ?? "ลูกค้า",
        customer_avatar: profile.avatar ?? null,
        status: "new",
        last_message_preview: previewOf(opts.text, hasAttachment),
        last_message_at: createdAt
      })
      .select("id")
      .single();
    conversationId = (created?.id as string) ?? null;
  }

  if (!conversationId) return;

  // เก็บข้อความ (trigger จะอัปเดต preview/last_message_at/unread ให้)
  await admin.from("inbox_messages").insert({
    conversation_id: conversationId,
    direction,
    body: opts.text,
    attachment_url: opts.attachmentUrl,
    attachment_type: opts.attachmentType,
    external_message_id: opts.externalMessageId,
    is_read: direction === "out"
  });
}

Deno.serve(async (req) => {
  // ── Webhook verification ─────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("META_VERIFY_TOKEN");
    if (mode === "subscribe" && token && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("ok");

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
  if (!admin) return new Response("ok");

  const body = await req.json().catch(() => null);
  // object = "page" (Messenger) | "instagram" (IG DM)
  const platform = body?.object === "instagram" ? "instagram" : "facebook";
  const entries: Array<Record<string, unknown>> = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    const externalPageId = (entry.id as string) ?? null;
    const messaging: Array<Record<string, unknown>> = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const ev of messaging) {
      const sender = (ev.sender ?? {}) as { id?: string };
      const recipient = (ev.recipient ?? {}) as { id?: string };
      const message = (ev.message ?? {}) as {
        mid?: string; text?: string; is_echo?: boolean;
        attachments?: Array<{ type?: string; payload?: { url?: string } }>;
      };
      if (!sender.id || !message) continue;

      const attachment = message.attachments?.[0];
      await ingestMessage(admin, {
        platform,
        externalPageId,
        senderId: sender.id,
        recipientId: recipient.id ?? "",
        isEcho: Boolean(message.is_echo),
        text: message.text ?? null,
        attachmentUrl: attachment?.payload?.url ?? null,
        attachmentType: attachment?.type ?? null,
        externalMessageId: message.mid ?? null,
        timestamp: Number(ev.timestamp) || Date.now()
      }).catch((err) => console.error("ingest error", err));
    }
  }

  return new Response("ok");
});
