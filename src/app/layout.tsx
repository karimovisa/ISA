import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { IsaIntroGate } from "@/components/brand/IsaIntro";
import { PwaRegister } from "@/components/PwaRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ISA — Run. Process. Aim.",
  description: "ISA — a personal operating system. Focus. Process. Peak.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "ISA", statusBarStyle: "black" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <PwaRegister />
          <IsaIntroGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
