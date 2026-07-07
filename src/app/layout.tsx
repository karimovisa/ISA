import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { IsaIntroGate } from "@/components/brand/IsaIntro";
import { PwaRegister } from "@/components/PwaRegister";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Toaster } from "@/components/ui/Toaster";

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
    <html lang="en" data-theme="boys" className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('isa_theme')||'boys';if(t==='girls'){var m=localStorage.getItem('isa_girls_mode')||'auto';var h=(new Date()).getHours();var d=m==='auto'?(h>=6&&h<19):m==='day';t=d?'girls-day':'girls-night'}document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <PwaRegister />
              <IsaIntroGate />
              <LanguageToggle />
              {children}
              <Toaster />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
