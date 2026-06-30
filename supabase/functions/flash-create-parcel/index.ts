// Edge Function: สร้างออเดอร์/เรียก Flash Express เข้ารับพัสดุ (เรียกจากแอปตอนกด "ส่งสินค้า")
//
// ทำการเซ็น (sign) ด้วย secret key ฝั่งเซิร์ฟเวอร์เท่านั้น — secret ไม่หลุดไปฝั่งเบราว์เซอร์
// แอปเรียกผ่าน fetch(NEXT_PUBLIC_FLASH_PICKUP_URL) ด้วย payload จาก lib/flash.ts (buildFlashPickupInput)
//
// Secrets ที่ต้องตั้ง (Supabase → Edge Functions → Secrets):
//   FLASH_MCH_ID        = merchant id จาก Flash
//   FLASH_SECRET_KEY    = secret key จาก Flash (ใช้เซ็น)
//   FLASH_BASE_URL      = https://open-api.flashexpress.com (จริง) หรือ open-api-tra.flashexpress.com (ทดสอบ)
//   FLASH_SRC_NAME      = ชื่อผู้ส่ง (ร้าน)
//   FLASH_SRC_PHONE     = เบอร์ผู้ส่ง
//   FLASH_SRC_PROVINCE  = จังหวัดผู้ส่ง
//   FLASH_SRC_CITY      = อำเภอ/เขตผู้ส่ง
//   FLASH_SRC_DISTRICT  = ตำบล/แขวงผู้ส่ง
//   FLASH_SRC_POSTAL    = รหัสไปรษณีย์ผู้ส่ง
//   FLASH_SRC_ADDRESS   = ที่อยู่ผู้ส่ง (รายละเอียด)
//   FLASH_EXPRESS_CATEGORY (ไม่บังคับ, ค่าเริ่มต้น 1 = มาตรฐาน)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// เซ็นตามสเปก Flash: เรียงคีย์ ASC → key=value&... → ต่อ &key=SECRET → SHA256 → ตัวพิมพ์ใหญ่
async function sign(params: Record<string, string>, secret: string): Promise<string> {
  const stringA = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined && params[k] !== null && k !== "sign")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const stringSignTemp = `${stringA}&key=${secret}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stringSignTemp));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function nonce(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const mchId = Deno.env.get("FLASH_MCH_ID");
    const secret = Deno.env.get("FLASH_SECRET_KEY");
    const baseUrl = (Deno.env.get("FLASH_BASE_URL") ?? "https://open-api.flashexpress.com").replace(/\/$/, "");
    if (!mchId || !secret) return json({ error: "ยังไม่ตั้งค่า FLASH_MCH_ID / FLASH_SECRET_KEY" }, 500);

    const input = await req.json().catch(() => ({}));
    if (!input?.dstName || !input?.dstPhone || !input?.dstDetailAddress) {
      return json({ error: "ข้อมูลผู้รับไม่ครบ (ชื่อ/เบอร์/ที่อยู่)" }, 400);
    }

    // ประกอบพารามิเตอร์ (ทุกค่าต้องเป็น string ตอนเซ็น)
    const params: Record<string, string> = {
      mchId,
      nonceStr: nonce(),
      outTradeNo: String(input.outTradeNo ?? ""),
      expressCategory: String(input.expressCategory ?? Deno.env.get("FLASH_EXPRESS_CATEGORY") ?? "1"),
      articleCategory: String(input.articleCategory ?? "1"),
      weight: String(input.weight ?? 1000),
      // ผู้ส่ง (ร้าน) จาก env
      srcName: Deno.env.get("FLASH_SRC_NAME") ?? "",
      srcPhone: Deno.env.get("FLASH_SRC_PHONE") ?? "",
      srcProvinceName: Deno.env.get("FLASH_SRC_PROVINCE") ?? "",
      srcCityName: Deno.env.get("FLASH_SRC_CITY") ?? "",
      srcDistrictName: Deno.env.get("FLASH_SRC_DISTRICT") ?? "",
      srcPostalCode: Deno.env.get("FLASH_SRC_POSTAL") ?? "",
      srcDetailAddress: Deno.env.get("FLASH_SRC_ADDRESS") ?? "",
      // ผู้รับ
      dstName: String(input.dstName),
      dstPhone: String(input.dstPhone),
      dstProvinceName: String(input.dstProvinceName ?? ""),
      dstCityName: String(input.dstCityName ?? ""),
      dstDistrictName: String(input.dstDistrictName ?? ""),
      dstPostalCode: String(input.dstPostalCode ?? ""),
      dstDetailAddress: String(input.dstDetailAddress),
      codEnabled: String(input.codEnabled ?? 0)
    };
    if (input.width) params.width = String(input.width);
    if (input.length) params.length = String(input.length);
    if (input.height) params.height = String(input.height);
    if (Number(input.codEnabled) === 1 && input.codAmount) params.codAmount = String(input.codAmount);
    params.insured = String(input.insured ?? 0);
    if (Number(input.insured) === 1 && input.insureDeclareValue) params.insureDeclareValue = String(input.insureDeclareValue);
    if (input.remark) params.remark = String(input.remark);

    params.sign = await sign(params, secret);

    const res = await fetch(`${baseUrl}/open/v3/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString()
    });
    const data = await res.json().catch(() => ({}));
    // รูปแบบผลลัพธ์ Flash: { code: 1, message, data: { pno, sortCode, ... } }
    if (data?.code !== 1 || !data?.data?.pno) {
      return json({ error: data?.message || `Flash ปฏิเสธคำขอ (code ${data?.code ?? res.status})`, raw: data }, 502);
    }
    return json({
      pno: data.data.pno,
      sortCode: data.data.sortCode ?? data.data.sortingLineCode ?? null,
      message: "สร้างออเดอร์ Flash สำเร็จ"
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
