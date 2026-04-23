import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "現場報告システム",
  description: "建築事業部 現場報告システム - 見える工事®",
};

// maximumScale/userScalable を設定するとiOS PWAでピンチイベントがJS到達前にブロックされる。
// グローバルtouchstartでモーダル以外のピンチを防ぐ方式に変更。
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" style={{ colorScheme: "light" }}>
      <head>
        {/* モーダル外のピンチズームをJSで防止（data-allow-pinch属性がある要素は許可） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener('touchstart',function(e){if(e.touches.length>1&&!e.target.closest('[data-allow-pinch]')){e.preventDefault();}},{passive:false});`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
