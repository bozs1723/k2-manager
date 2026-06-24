// Edge Function: แจ้งเตือน "ออเดอร์ใหม่รออนุมัติ" เข้ากลุ่ม LINE กลาง (เรียกจากแอปตอนสร้างงาน)
//
// เรียกจากเบราว์เซอร์ผ่าน supabase.functions.invoke("notify-new-order", { body: { job_id } })
// (เปิด Verify JWT ได้ — เฉพาะผู้ล็อกอินถึงเรียกได้)
//
// Secrets ที่ต้องตั้ง:
//   LINE_CHANNEL_ACCESS_TOKEN         (มีอยู่แล้ว)
//   ORDER_NOTIFY_GROUP_ID = Cxxxxxxxx (group id ของกลุ่มกลางที่จะรับแจ้งเตือน)
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_PUSH = "https://api.line.me/v2/bot/message/push";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const baht = (n: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(n) || 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const groupId = Deno.env.get("ORDER_NOTIFY_GROUP_ID");
    if (!url || !serviceKey) return json({ error: "ยังไม่ตั้งค่า service_role" }, 500);
    if (!lineToken) return json({ error: "ยังไม่ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }, 500);
    if (!groupId) return json({ ok: true, note: "ยังไม่ได้ตั้ง ORDER_NOTIFY_GROUP_ID — ข้ามการแจ้งเตือน" });

    const body = await req.json().catch(() => ({}));

    // โหมดทดสอบ: ส่งข้อความตัวอย่างเข้ากลุ่มทันที (ไม่ต้องมีงานจริง)
    //   เรียกด้วย body { "test": true }
    if ((body as { test?: boolean })?.test === true) {
      const sample = [
        "🆕 ออเดอร์ใหม่รออนุมัติ (ตัวอย่างทดสอบ)",
        "🔖 เลขงาน: WO-DEMO-001",
        "👤 ลูกค้า: คุณทดสอบ ระบบ",
        "📦 งาน: ป้ายไวนิล 2x3 เมตร ⚡️ด่วน",
        "🏭 สาขา: พระรามเก้า",
        "💵 ราคา: ฿3,500",
        "✍️ สร้างโดย: เซล (ทดสอบ)",
        "",
        "👉 ผู้จัดการสาขา กรุณาเข้าระบบกดอนุมัติเข้าผลิต",
        "",
        "— ข้อความนี้เป็นการทดสอบระบบ —"
      ].join("\n");
      const res = await fetch(LINE_PUSH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
        body: JSON.stringify({ to: groupId, messages: [{ type: "text", text: sample }] })
      });
      return json({ ok: res.ok, status: res.status, test: true, detail: res.ok ? null : await res.text() });
    }

    const jobId = (body as { job_id?: string })?.job_id;
    if (!jobId) return json({ error: "ต้องส่ง job_id" }, 400);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: job } = await admin
      .from("jobs")
      .select("job_number, customer_name, title, production_branch, acceptance, created_by, price, is_express")
      .eq("id", jobId)
      .single();
    if (!job) return json({ error: "ไม่พบงาน" }, 404);
    // แจ้งเฉพาะงานที่ยังรอผู้จัดการอนุมัติ
    if (job.acceptance !== "pending") return json({ ok: true, note: "งานนี้ไม่ได้รออนุมัติ — ไม่ต้องแจ้ง" });

    let creator = "";
    if (job.created_by) {
      const { data: p } = await admin.from("profiles").select("full_name").eq("id", job.created_by).single();
      creator = p?.full_name ?? "";
    }

    const text = [
      "🆕 ออเดอร์ใหม่รออนุมัติ",
      `🔖 เลขงาน: ${job.job_number}`,
      `👤 ลูกค้า: ${job.customer_name || "-"}`,
      `📦 งาน: ${job.title || "-"}${job.is_express ? " ⚡️ด่วน" : ""}`,
      `🏭 สาขา: ${job.production_branch || "-"}`,
      Number(job.price) > 0 ? `💵 ราคา: ${baht(job.price)}` : null,
      creator ? `✍️ สร้างโดย: ${creator}` : null,
      "",
      "👉 ผู้จัดการสาขา กรุณาเข้าระบบกดอนุมัติเข้าผลิต"
    ].filter(Boolean).join("\n");

    const res = await fetch(LINE_PUSH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
      body: JSON.stringify({ to: groupId, messages: [{ type: "text", text }] })
    });
    return json({ ok: res.ok, status: res.status, detail: res.ok ? null : await res.text() });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
