import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { RouteShell } from "@/components/layout/RouteShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SignalApp",
  description: "Account research, qualification, and outreach enablement",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${instrumentSerif.variable} font-sans antialiased`}>
        <RouteShell>{children}</RouteShell>
      </body>
    </html>
  );
}
