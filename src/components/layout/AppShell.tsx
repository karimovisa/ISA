"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { IsaLogo } from "@/components/brand/IsaLogo";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <motion.div
        className="text-white"
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <IsaLogo className="w-28" glow />
      </motion.div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <Splash />;
  if (!session) return <Splash />;

  return (
    <div className="min-h-dvh md:pl-20">
      <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-8 sm:px-8 md:pb-12 md:pt-12">
        {children}
      </main>
      <Sidebar />
    </div>
  );
}
