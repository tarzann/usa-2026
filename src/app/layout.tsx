import type { Metadata } from "next";
import { Assistant, Space_Grotesk } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "USA 2026 Trip Planner AI",
  description: "מערכת חכמה לניהול טיול עם ציר ימים, מפה עשירה ו-AI Copilot.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
