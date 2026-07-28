import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data Miner ⚡ Pixel Arcade B2B Lead Scraper",
  description: "Extract enriched B2B leads across 20+ platforms simultaneously with retro pixel art AI agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-[#0D0C0A] text-gray-100 selection:bg-[#FFC700] selection:text-black">
        {children}
      </body>
    </html>
  );
}
