// Edge Function: ให้ "เจ้าของ (Owner)" รีเซ็ตรหัสผ่านให้พนักงานคนอื่นได้อย่างปลอดภัย
// - ใช้ service_role อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่หลุดมาที่เบราว์เซอร์)
// - ตรวจ JWT ผู้เรียก + ต้องมี role = Owner ใน profiles เท่านั้นจึงจะรีเซ็ตได้
//
// Deploy:
//   supabase functions deploy admin-reset-password
//   (service_role key มีให้อัตโนมัติใน runtime ผ่าน env SUPABASE_SERVICE_ROLE_KEY)

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "ใช้ได้เฉพาะ POST" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "เซิร์ฟเวอร์ยังไม่ตั้งค่า service_role" }, 500);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "ไม่ได้เข้าสู่ระบบ" }, 401);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // ระบุตัวผู้เรียกจาก token
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return json({ error: "โทเค็นไม่ถูกต้อง/หมดอายุ" }, 401);

    // ต้องเป็น Owner เท่านั้น
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .single();
    if (profErr || !prof || prof.role !== "Owner") {
      return json({ error: "เฉพาะเจ้าของ (Owner) เท่านั้นที่รีเซ็ตรหัสผู้อื่นได้" }, 403);
    }

    const body = await req.json().catch(() => null);
    const userId = body?.userId;
    const newPassword = body?.newPassword;
    if (!userId || typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ error: "ข้อมูลไม่ครบ หรือรหัสผ่านสั้นกว่า 6 ตัว" }, 400);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
