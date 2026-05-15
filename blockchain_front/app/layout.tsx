import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "链上募捐平台",
  description: "让每一份捐赠透明可追溯，智能合约托管，公开可信。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        <Providers>
          <Header />
          <main className="max-w-7xl mx-auto px-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
