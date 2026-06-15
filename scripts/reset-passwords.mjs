// รีเซ็ตรหัสผ่านพนักงาน K2 เป็นตัวเลข 6 หลัก (สุ่มให้แต่ละคน) ผ่าน Supabase Admin API
//
// วิธีรัน:
//   SUPABASE_URL="https://xxxx.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..." \
//   node scripts/reset-passwords.mjs
//
// พิมพ์ตาราง username + รหัสใหม่ออกมา — แจกพนักงาน แล้วให้เปลี่ยนเมื่อเข้าใช้

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_DOMAIN = "k2smart.local";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌ ต้องตั้ง env: SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อนรัน");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const usernames = [
  "patcharapan", "niracha", "suthasini", "tancanok", "natapat",
  "sarintra", "pongsatorn", "chiprapha", "watcharapon", "damon",
  "wan", "meaw", "koy"
];

// รหัสตัวเลข 6 หลัก (100000–999999) สุ่มแบบ cryptographically secure
function gen6Digit() {
  return String(crypto.randomInt(100000, 1000000));
}

// สร้าง map อีเมล -> user id (วนทุกหน้า)
async function loadUserMap() {
  const map = new Map();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) if (u.email) map.set(u.email, u.id);
    if (data.users.length < 200) break;
  }
  return map;
}

const emailToId = await loadUserMap();
const results = [];
for (const username of usernames) {
  const email = `${username}@${AUTH_DOMAIN}`;
  const id = emailToId.get(email);
  if (!id) {
    results.push({ username, password: null, status: "❌ ไม่พบผู้ใช้" });
    continue;
  }
  const password = gen6Digit();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  results.push({ username, password: error ? null : password, status: error ? `❌ ${error.message}` : "✅ OK" });
}

console.log("\n=== รหัสผ่านใหม่ (ตัวเลข 6 หลัก) ===\n");
for (const r of results) {
  console.log(`${r.status.startsWith("✅") ? "✅" : "❌"} ${r.username.padEnd(12)} | รหัส: ${r.password ?? "-"}  ${r.status.startsWith("✅") ? "" : r.status}`);
}
const ok = results.filter((r) => r.status.startsWith("✅")).length;
console.log(`\nรีเซ็ตสำเร็จ ${ok}/${results.length} คน`);
