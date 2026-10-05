import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evidence Intelligence | SIH26245 Compliance Hub",
  description: "AI-Based Real-Time Monitoring of Training Centres for Attendance and Infrastructure Compliance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#070a0f] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
