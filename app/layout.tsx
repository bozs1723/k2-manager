import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "K2Smart",
  description: "ระบบจัดการคิวงานผลิตสำหรับร้านพิมพ์และสินค้าสั่งทำ"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
