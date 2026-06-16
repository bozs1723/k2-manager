// รีเซ็ตรหัสผ่านพนักงาน K2 เป็นตัวเลข 6 หลัก (สุ่มให้แต่ละคน) ผ่าน Supabase Admin API
// แล้วพิมพ์ผล "แยกตามสาขา" + เขียนลงไฟล์ scripts/credentials.local.txt (ไม่ขึ้น git) สำหรับแจกพนักงาน
//
// วิธีรัน:
//   SUPABASE_URL="https://xxxx.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..." \
//   node scripts/reset-passwords.mjs
//
// ⚠️ สคริปต์นี้ "เปลี่ยน" รหัสผ่านของทุกคนเป็นรหัสใหม่ — รหัสเดิมจะใช้ไม่ได้
// แจกรหัสใหม่ให้พนักงาน แล้วให้เปลี่ยนเมื่อเข้าใช้ครั้งแรก

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

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

// รายชื่อพนักงาน + สาขา (ตรงกับ seed-users.mjs) · branch=null คือไม่สังกัดสาขา (Owner)
const users = [
  { username: "patcharapan", name: "Patcharapan", branch: "พระรามเก้า" },
  { username: "niracha", name: "Niracha", branch: "พระรามเก้า" },
  { username: "natapat", name: "Natapat", branch: "พระรามเก้า" },
  { username: "chiprapha", name: "Chiprapha", branch: "พระรามเก้า" },
  { username: "wan", name: "Wan", branch: "พระรามเก้า" },
  { username: "suthasini", name: "Suthasini", branch: "พะเยา" },
  { username: "tancanok", name: "Tancanok", branch: "พะเยา" },
  { username: "pongsatorn", name: "Pongsatorn", branch: "พะเยา" },
  { username: "watcharapon", name: "Watcharapon", branch: "พะเยา" },
  { username: "meaw", name: "Meaw", branch: "พะเยา" },
  { username: "koy", name: "Koy", branch: "พะเยา" },
  { username: "sarintra", name: "Sarintra", branch: null },
  { username: "damon", name: "Damon", branch: null }
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
for (const u of users) {
  const email = `${u.username}@${AUTH_DOMAIN}`;
  const id = emailToId.get(email);
  if (!id) {
    results.push({ ...u, password: null, status: "❌ ไม่พบผู้ใช้" });
    continue;
  }
  const password = gen6Digit();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  results.push({ ...u, password: error ? null : password, status: error ? `❌ ${error.message}` : "✅ OK" });
}

// จัดกลุ่มตามสาขา: พระรามเก้า, พะเยา ก่อน แล้วสาขาอื่นๆ ที่เหลือ, ปิดท้ายด้วยกลุ่มไม่มีสาขา
const branchOrder = ["พระรามเก้า", "พะเยา"];
const branches = [...new Set(results.map((r) => r.branch).filter(Boolean))]
  .sort((a, b) => {
    const ia = branchOrder.indexOf(a);
    const ib = branchOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, "th");
  });

const lines = [];
const out = (s = "") => { lines.push(s); console.log(s); };

out("\n=== รหัสผ่านใหม่ (ตัวเลข 6 หลัก) — แยกตามสาขา ===");
out(`(สร้างเมื่อ ${new Date().toLocaleString("th-TH")})`);

function printGroup(title, rows) {
  out(`\n----- ${title} (${rows.length} คน) -----`);
  for (const r of rows) {
    const ok = r.status.startsWith("✅");
    out(`${ok ? "✅" : "❌"} ${r.name.padEnd(12)} | ID: ${r.username.padEnd(12)} | รหัส: ${r.password ?? "-"}${ok ? "" : "  " + r.status}`);
  }
}

for (const b of branches) printGroup(`สาขา${b}`, results.filter((r) => r.branch === b));
const noBranch = results.filter((r) => !r.branch);
if (noBranch.length) printGroup("ไม่มีสาขา (Owner)", noBranch);

const ok = results.filter((r) => r.status.startsWith("✅")).length;
out(`\nรีเซ็ตสำเร็จ ${ok}/${results.length} คน`);
out("⚠️ พนักงาน login ด้วย ID (username) ได้เลย ระบบเติม @k2smart.local ให้เอง · ให้เปลี่ยนรหัสเมื่อเข้าใช้ครั้งแรก");

// เขียนลงไฟล์ (ไม่ขึ้น git) เผื่อ copy ไปแจก
const outPath = new URL("./credentials.local.txt", import.meta.url);
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`\n📄 บันทึกไฟล์แล้ว: scripts/credentials.local.txt (ไฟล์นี้ถูก gitignore — อย่าแชร์สาธารณะ)`);
