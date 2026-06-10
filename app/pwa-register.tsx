"use client";

import { useEffect } from "react";

// ลงทะเบียน service worker เพื่อให้แอปติดตั้งบนมือถือได้ + ใช้งานออฟไลน์
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
