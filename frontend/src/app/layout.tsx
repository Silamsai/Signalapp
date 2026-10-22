import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infrastructure Signal",
  description: "Account research, qualification, and outreach enablement",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
