// สร้างผู้ใช้พนักงาน K2 ทั้งหมดแบบครั้งเดียว (auth + profile) ผ่าน Supabase Admin API
//
// วิธีรัน:
//   1) เอา service_role key มาจาก Supabase: Dashboard > Project Settings > API > service_role (secret)
//      ⚠️ คีย์นี้เป็นความลับ — อย่า commit / อย่าแชร์
//   2) รันคำสั่ง (แทนค่า URL + KEY ของคุณ):
//        SUPABASE_URL="https://xxxx.supabase.co" \
//        SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..." \
//        node scripts/seed-users.mjs
//   3) สคริปต์จะพิมพ์ตารางรหัสผ่าน (สุ่มให้แต่ละคน) ออกมา — บันทึกไว้แจกพนักงาน
//      แล้วให้พนักงานเปลี่ยนรหัสเมื่อเข้าใช้ครั้งแรก
//
// ปลอดภัยต่อการรันซ้ำ: ถ้าผู้ใช้มีอยู่แล้วจะข้ามการสร้าง auth แล้วอัปเดต profile ให้แทน

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_DOMAIN = "k2smart.local"; // ต้องตรงกับ internalAuthDomain ในแอป

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌ ต้องตั้ง env: SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อนรัน");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// role ต้องตรงกับ enum app_role: Owner | Manager | Admin | HR | Accounting | Designer | Production Staff | Packing Staff | Sales Staff
const users = [
  { username: "patcharapan", name: "Patcharapan", role: "Sales Staff", extraRoles: [], branch: "พระรามเก้า" }, // อยู่ 2 สาขา — ตั้งหลักเป็นพระรามเก้า
  { username: "niracha", name: "Niracha", role: "Designer", extraRoles: [], branch: "พระรามเก้า" },
  { username: "suthasini", name: "Suthasini", role: "Manager", extraRoles: [], branch: "พะเยา" },
  { username: "tancanok", name: "Tancanok", role: "Sales Staff", extraRoles: ["Production Staff"], branch: "พะเยา" },
  { username: "natapat", name: "Natapat", role: "Manager", extraRoles: ["HR"], branch: "พระรามเก้า" },
  { username: "sarintra", name: "Sarintra", role: "Owner", extraRoles: [], branch: null },
  { username: "pongsatorn", name: "Pongsatorn", role: "Production Staff", extraRoles: [], branch: "พะเยา" },
  { username: "chiprapha", name: "Chiprapha", role: "Sales Staff", extraRoles: [], branch: "พระรามเก้า" },
  { username: "watcharapon", name: "Watcharapon", role: "Production Staff", extraRoles: [], branch: "พะเยา" },
  { username: "damon", name: "Damon", role: "Owner", extraRoles: [], branch: null },
  { username: "wan", name: "Wan", role: "Production Staff", extraRoles: [], branch: "พระรามเก้า" },
  { username: "meaw", name: "Meaw", role: "Sales Staff", extraRoles: [], branch: "พะเยา" },
  { username: "koy", name: "Koy", role: "Sales Staff", extraRoles: [], branch: "พะเยา" }
];

// รหัสผ่านสุ่ม อ่านง่าย ตัดอักขระกำกวม (0/O/1/l/I)
function genPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i += 1) s += alphabet[bytes[i] % alphabet.length];
  return `K2-${s}`;
}

async function findUserIdByEmail(email) {
  // ค้นจาก auth (วนหน้า) — ใช้กรณีผู้ใช้มีอยู่แล้ว
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

const results = [];
for (const u of users) {
  const email = `${u.username}@${AUTH_DOMAIN}`;
  const password = genPassword();
  let id = null;
  let note = "";

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.name, role: u.role, username: u.username }
  });

  if (authErr) {
    // อาจมีอยู่แล้ว → หา id เดิมมาอัปเดต profile
    id = await findUserIdByEmail(email);
    if (!id) {
      results.push({ ...u, password: null, status: `❌ auth error: ${authErr.message}` });
      continue;
    }
    note = "(มีอยู่แล้ว — อัปเดต profile, ไม่เปลี่ยนรหัส)";
  } else {
    id = created.user.id;
  }

  const { error: profErr } = await admin
    .from("profiles")
    .upsert(
      { id, email, full_name: u.name, role: u.role, extra_roles: u.extraRoles, branch: u.branch, is_active: true },
      { onConflict: "id" }
    );

  results.push({
    ...u,
    password: authErr ? null : password,
    status: profErr ? `❌ profile error: ${profErr.message}` : `✅ OK ${note}`.trim()
  });
}

console.log("\n=== ผลการสร้างผู้ใช้ K2 ===\n");
for (const r of results) {
  const roleText = r.extraRoles.length ? `${r.role} + ${r.extraRoles.join(", ")}` : r.role;
  console.log(
    `${r.status.startsWith("✅") ? "✅" : "❌"} ${r.name.padEnd(12)} | user: ${r.username.padEnd(12)} | pass: ${(r.password ?? "-").padEnd(13)} | ${roleText} | สาขา: ${r.branch ?? "-"}  ${r.status}`
  );
}
const ok = results.filter((r) => r.status.startsWith("✅")).length;
console.log(`\nสำเร็จ ${ok}/${results.length} คน`);
console.log("⚠️ บันทึกรหัสผ่านไว้แจกพนักงาน แล้วให้เปลี่ยนรหัสเมื่อเข้าใช้ครั้งแรก (รหัสไม่ได้ถูกบันทึกลงไฟล์)");
