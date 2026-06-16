import type { BranchSetting } from "./types";

// ระยะห่างระหว่างพิกัด 2 จุด (เมตร) — สูตร Haversine
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// นาทีที่สาย เทียบเวลาเข้างาน + ผ่อนผัน (เช่น 5 นาที) — รับเวลาปัจจุบันเข้ามาเพื่อให้เทสได้
export function lateMinutes(workStart: string, graceMinutes: number, now: Date): number {
  const [h, m] = workStart.split(":").map((value) => Number(value) || 0);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = h * 60 + m + (graceMinutes || 0);
  return Math.max(0, nowMin - startMin);
}

// ตัดสินใจ geofence: สาขาตั้งพิกัดไว้ไหม / อยู่ในรัศมีไหม / ห่างกี่เมตร
// ถ้าสาขายังไม่ตั้งพิกัด -> geofenced=false (เช็คอินได้ทุกที่ แต่ผู้เรียกควรเตือน)
export function checkGeofence(
  setting: Pick<BranchSetting, "gpsLat" | "gpsLng" | "radiusM"> | undefined,
  lat: number,
  lng: number
): { geofenced: boolean; withinRadius: boolean; distance: number; radius: number } {
  if (!setting || setting.gpsLat == null || setting.gpsLng == null) {
    return { geofenced: false, withinRadius: true, distance: 0, radius: 0 };
  }
  const radius = setting.radiusM || 150;
  const distance = distanceMeters(lat, lng, setting.gpsLat, setting.gpsLng);
  return { geofenced: true, withinRadius: distance <= radius, distance, radius };
}

// นาทีที่ทำงานจริง ระหว่างเวลาเข้า-ออก (ไม่ติดลบ)
export function workedMinutes(checkInAt: string, checkOutAt: string): number {
  return Math.max(0, Math.round((new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 60000));
}
