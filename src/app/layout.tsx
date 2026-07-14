import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { IsaIntroGate } from "@/components/brand/IsaIntro";
import { PwaRegister } from "@/components/PwaRegister";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NavOrderProvider } from "@/components/NavOrderProvider";
import { LanguageProvider } from "@/lib/i18n";
import { EntitlementProvider } from "@/components/EntitlementProvider";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ProWelcome } from "@/components/ProWelcome";
import { HelpModal } from "@/components/HelpModal";
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
  // black-translucent lets the app paint under the status bar; combined with
  // viewportFit "cover" below this removes the letterbox bars on iOS.
  appleWebApp: { capable: true, title: "ISA", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  viewportFit: "cover", // edge-to-edge: draw into the notch / home-indicator area
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
            <NavOrderProvider>
              <LanguageProvider>
                <EntitlementProvider>
                  <PwaRegister />
                  <IsaIntroGate />
                  <LanguageToggle />
                  {children}
                  <UpgradeModal />
                  <ProWelcome />
                  <HelpModal />
                  <Toaster />
                </EntitlementProvider>
              </LanguageProvider>
            </NavOrderProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
