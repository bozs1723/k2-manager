// Edge Function: ส่งแจ้งเตือนทีมเข้า "กลุ่ม Telegram เดียว" (แทน/เสริมแจ้งเตือนในแอป)
//
// วิธีเชื่อม (ใช้ระบบ notifications เดิม ไม่สร้างใหม่):
//   insert แถวใหม่ในตาราง public.notifications
//     → Database Webhook (trigger หลัง INSERT — ดู migration 20260730000000_telegram_webhook.sql)
//     → เรียกฟังก์ชันนี้ → ยิง Telegram Bot API sendMessage เข้ากลุ่มทีม
//
// Secrets ที่ต้องตั้ง (Dashboard → Edge Functions → Secrets — ห้ามอยู่ฝั่งเว็บ):
//   TELEGRAM_BOT_TOKEN = โทเคนบอทจาก @BotFather
//   TELEGRAM_CHAT_ID   = chat_id ของกลุ่มทีม (กลุ่มเดียว เช่น -1001234567890)
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ)
//
// โหมดทดสอบ: เรียกด้วย body { "test": true } → ส่งข้อความตัวอย่างเข้ากลุ่มทันที
//
// หมายเหตุกันสแปม: แจ้งเตือนในแอปเป็น "รายคน" (งานเดียวมัดจำหลายแถว ผู้รับหลายคน)
// แต่กลุ่ม Telegram มีกลุ่มเดียว — ฟังก์ชันนี้จึงกันข้อความซ้ำ: ถ้ามีแถวเนื้อหาเดียวกัน
// (งาน+ชนิด+ข้อความ) ถูกสร้างก่อนหน้าภายใน 60 วินาที ถือว่าส่งเข้ากลุ่มไปแล้ว → ข้าม

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type NotificationRow = {
  id: string;
  recipient_id: string | null;
  type: string;
  job_id: string | null;
  job_number: string | null;
  job_title: string | null;
  message: string;
  created_at: string;
};

type WebhookPayload = {
  type?: string; // "INSERT"
  table?: string;
  record?: NotificationRow;
  test?: boolean;
};

// ชนิดแจ้งเตือน → อีโมจินำหน้า (ข้อความหลักใช้ของเดิมจากแอป ซึ่งเป็นไทยกระชับอยู่แล้ว)
const TYPE_EMOJI: Record<string, string> = {
  assigned: "🔔",
  status_moved: "🔄",
  comment: "💬",
  due_soon: "⏰",
  express_request: "⚡",
  express_decision: "⚡"
};

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  const detail = await res.text();
  return { ok: res.ok, status: res.status, detail: res.ok ? null : detail };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!botToken || !chatId) {
      // ยังไม่ได้ตั้ง secret (รอโทเคนจากเจ้าของ) — ตอบ ok เพื่อไม่ให้ webhook retry รัว
      return json({ ok: true, note: "ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — ข้ามการแจ้งเตือน" });
    }

    const payload = (await req.json().catch(() => ({}))) as WebhookPayload;

    // โหมดทดสอบ: ส่งข้อความตัวอย่างเข้ากลุ่ม 1 ครั้ง
    if (payload.test === true) {
      const sample = [
        "🤖 ทดสอบระบบแจ้งเตือน K2Smart → Telegram",
        "🔔 งาน K2-TEST มอบหมายให้ คุณทดสอบ แล้ว",
        "— ถ้าเห็นข้อความนี้ในกลุ่ม แปลว่าเชื่อมสำเร็จ —"
      ].join("\n");
      return json(await sendTelegram(botToken, chatId, sample));
    }

    const row = payload.record;
    if (!row || payload.type !== "INSERT") return json({ ok: true, note: "ไม่ใช่เหตุการณ์ INSERT ของ notifications — ข้าม" });

    // ส่งเฉพาะเหตุการณ์ที่ทีมตกลงให้เข้ากลุ่ม: มอบหมาย / เปลี่ยนสถานะ-ส่งรับงาน / ใกล้กำหนด / งานด่วน
    const wanted = ["assigned", "status_moved", "due_soon", "express_request", "express_decision"];
    if (!wanted.includes(row.type)) return json({ ok: true, note: `ชนิด ${row.type} ไม่ต้องแจ้งเข้ากลุ่ม` });

    if (!url || !serviceKey) return json({ error: "ยังไม่ตั้งค่า service_role" }, 500);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // กันซ้ำ: แจ้งเตือนชุดเดียวกันถูก insert หลายแถว (ผู้รับหลายคน) — ส่งเข้ากลุ่มครั้งเดียวพอ
    const windowStart = new Date(new Date(row.created_at).getTime() - 60_000).toISOString();
    const { data: earlier } = await admin
      .from("notifications")
      .select("id")
      .eq("type", row.type)
      .eq("message", row.message)
      .neq("id", row.id)
      .gte("created_at", windowStart)
      .lt("created_at", row.created_at)
      .limit(1);
    if (earlier && earlier.length > 0) return json({ ok: true, note: "แจ้งชุดนี้เข้ากลุ่มไปแล้ว — ข้ามแถวซ้ำ" });

    // แต่งข้อความไทยกระชับ: ชนิด assigned ระบุชื่อคนที่ถูกมอบหมายให้ชัด
    let text = `${TYPE_EMOJI[row.type] ?? "🔔"} ${row.message}`;
    if (row.type === "assigned" && row.recipient_id) {
      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", row.recipient_id).single();
      const name = profile?.full_name?.trim();
      if (name && row.job_number) text = `🔔 งาน ${row.job_number} มอบหมายให้ ${name} แล้ว${row.job_title ? ` — ${row.job_title}` : ""}`;
      else if (name) text = `🔔 ${row.message} (ถึง ${name})`;
    }

    return json(await sendTelegram(botToken, chatId, text));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
