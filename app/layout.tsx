import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human Eval — ระบบให้คะแนนแชตบอต",
  description: "ระบบให้คะแนนคำตอบแชตบอตโดยมนุษย์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
