import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sw.Work — Smart Workflow & Production System",
  description:
    "ระบบบริหารงานร้านพิมพ์ ร้านป้าย ร้านอะคริลิค และงานผลิตตามสั่ง — กรอกข้อมูลครั้งเดียว เอกสารครบทุกใบอัตโนมัติ"
};

export default function SwWorkLayout({ children }: { children: React.ReactNode }) {
  return <div className="sw-root">{children}</div>;
}
