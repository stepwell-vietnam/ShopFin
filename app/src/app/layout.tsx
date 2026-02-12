import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "ShopFin — Báo cáo Kinh doanh TMĐT",
  description: "Công cụ báo cáo trực quan dữ liệu kinh doanh Shopee & TikTok Shop. Upload file báo cáo, xem dashboard tài chính, doanh thu và đối soát dòng tiền.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
