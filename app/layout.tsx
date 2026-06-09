import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const metadata: Metadata = {
  title: "K2Smart",
  description: "ระบบจัดการคิวงานผลิตสำหรับร้านพิมพ์และสินค้าสั่งทำ",
  manifest: "/manifest.json",
  applicationName: "K2Smart",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "K2Smart"
  },
  icons: {
    icon: [
      { url: "/assets/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/assets/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#14383d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
