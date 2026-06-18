// Edge Function: LINE Webhook — ใช้ "อ่าน group ID" ของกลุ่มที่เชิญบอทเข้าไป
// - เมื่อบอทถูกเชิญเข้ากลุ่ม (join) หรือมีคนพิมพ์ในกลุ่ม → บอทตอบกลับ group ID ให้คัดลอก
// - นำ group ID ไปผูกกับสาขาในตาราง branch_line_groups
//
// ตั้งค่าใน LINE Developers Console (แท็บ Messaging API):
//   - Use webhook = ON
//   - Webhook URL = https://<project-ref>.supabase.co/functions/v1/line-webhook
// และใน Supabase: deploy ฟังก์ชันนี้แบบ "ปิด Verify JWT" (เพราะ LINE เป็นคนเรียก ไม่มี JWT)

const LINE_REPLY = "https://api.line.me/v2/bot/message/reply";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const body = await req.json().catch(() => null);
  const events: Array<Record<string, unknown>> = Array.isArray(body?.events) ? body.events : [];

  for (const ev of events) {
    const src = (ev.source ?? {}) as { type?: string; groupId?: string; roomId?: string; userId?: string };
    const replyToken = ev.replyToken as string | undefined;
    if (!replyToken || !lineToken) continue;

    let idText = "";
    if (src.groupId) idText = `📌 Group ID ของกลุ่มนี้:\n${src.groupId}\n\nนำไปผูกกับสาขาในตาราง branch_line_groups`;
    else if (src.roomId) idText = `📌 Room ID:\n${src.roomId}`;
    else if (src.userId) idText = `📌 User ID:\n${src.userId}`;
    if (!idText) continue;

    await fetch(LINE_REPLY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text: idText }] })
    }).catch(() => {});
  }

  // LINE ต้องการ 200 เสมอ
  return new Response("ok");
});
