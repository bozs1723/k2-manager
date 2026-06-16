-- ตั้งพิกัด GPS ให้สาขาพระรามเก้า (เปิด geofence เช็คอินในรัศมี)
-- พิกัด: 13.748470694052134, 100.59201842596407 · รัศมี 150 เมตร
-- ปลอดภัย/รันซ้ำได้ (idempotent)

insert into public.branch_settings (branch, work_start, work_end, late_grace_minutes, gps_lat, gps_lng, radius_m)
values ('พระรามเก้า', '09:00', '18:00', 5, 13.748470694052134, 100.59201842596407, 150)
on conflict (branch) do update
  set gps_lat = excluded.gps_lat,
      gps_lng = excluded.gps_lng,
      radius_m = excluded.radius_m;
