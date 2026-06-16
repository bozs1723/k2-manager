// เทสตรรกะแกนกลางการลงเวลา (GPS รัศมี / สาย-ตรงเวลา / ชั่วโมงทำงาน)
// รัน: npm run test:attendance
import assert from "node:assert/strict";
import { distanceMeters, lateMinutes, checkGeofence, workedMinutes } from "./.atbuild/attendance.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

// พิกัดสาขาพระรามเก้า
const BR = { gpsLat: 13.748470694052134, gpsLng: 100.59201842596407, radiusM: 150 };

console.log("ระยะทาง GPS (Haversine)");
check("จุดเดียวกัน = 0 เมตร", () => assert.equal(distanceMeters(BR.gpsLat, BR.gpsLng, BR.gpsLat, BR.gpsLng), 0));
check("ขยับ ~111 เมตร (0.001 องศา lat) อยู่ราว 100-120 ม.", () => {
  const d = distanceMeters(BR.gpsLat, BR.gpsLng, BR.gpsLat + 0.001, BR.gpsLng);
  assert.ok(d >= 100 && d <= 125, `ได้ ${d}`);
});

console.log("\nตรวจ geofence เช็คอิน");
check("อยู่ที่พิกัดสาขาพอดี → เช็คอินได้ (ในรัศมี)", () => {
  const g = checkGeofence(BR, BR.gpsLat, BR.gpsLng);
  assert.equal(g.geofenced, true);
  assert.equal(g.withinRadius, true);
});
check("ห่าง ~110 ม. (รัศมี 150) → ยังเช็คอินได้", () => {
  const g = checkGeofence(BR, BR.gpsLat + 0.001, BR.gpsLng);
  assert.equal(g.withinRadius, true);
});
check("ห่าง ~330 ม. (รัศมี 150) → เช็คอินไม่ได้ (นอกรัศมี)", () => {
  const g = checkGeofence(BR, BR.gpsLat + 0.003, BR.gpsLng);
  assert.equal(g.geofenced, true);
  assert.equal(g.withinRadius, false);
  assert.ok(g.distance > 150, `ระยะ ${g.distance}`);
});
check("สาขาไม่ตั้งพิกัด → geofenced=false (เช็คอินได้ทุกที่)", () => {
  const g = checkGeofence({ gpsLat: null, gpsLng: null, radiusM: 150 }, BR.gpsLat + 5, BR.gpsLng + 5);
  assert.equal(g.geofenced, false);
  assert.equal(g.withinRadius, true);
});
check("setting undefined → geofenced=false", () => {
  const g = checkGeofence(undefined, BR.gpsLat, BR.gpsLng);
  assert.equal(g.geofenced, false);
});

console.log("\nคำนวณสาย/ตรงเวลา (เข้างาน 09:00 ผ่อนผัน 5 นาที)");
check("มาถึง 08:30 → ตรงเวลา (สาย 0)", () => assert.equal(lateMinutes("09:00", 5, new Date(2026, 5, 16, 8, 30)), 0));
check("มาถึง 09:03 (ในผ่อนผัน) → สาย 0", () => assert.equal(lateMinutes("09:00", 5, new Date(2026, 5, 16, 9, 3)), 0));
check("มาถึง 09:05 (สุดผ่อนผัน) → สาย 0", () => assert.equal(lateMinutes("09:00", 5, new Date(2026, 5, 16, 9, 5)), 0));
check("มาถึง 09:20 → สาย 15 นาที", () => assert.equal(lateMinutes("09:00", 5, new Date(2026, 5, 16, 9, 20)), 15));

console.log("\nนับชั่วโมงทำงาน (เข้า-ออก)");
check("09:00 → 18:00 = 540 นาที (9 ชม.)", () => {
  const min = workedMinutes("2026-06-16T09:00:00", "2026-06-16T18:00:00");
  assert.equal(min, 540);
  assert.equal(`${Math.floor(min / 60)} ชม. ${min % 60} นาที`, "9 ชม. 0 นาที");
});
check("09:15 → 17:45 = 510 นาที (8 ชม. 30 นาที)", () => {
  const min = workedMinutes("2026-06-16T09:15:00", "2026-06-16T17:45:00");
  assert.equal(min, 510);
});
check("เวลาออกก่อนเข้า → 0 (ไม่ติดลบ)", () => assert.equal(workedMinutes("2026-06-16T18:00:00", "2026-06-16T09:00:00"), 0));

console.log(`\n${passed} เทสผ่านทั้งหมด ✅`);
