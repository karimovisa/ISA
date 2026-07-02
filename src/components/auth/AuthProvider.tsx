"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  displayName: "",
  signOut: async () => {},
});

/** Friendly first name: signup metadata → email local-part → "there". */
function deriveName(user: User | null): string {
  const meta = (user?.user_metadata?.full_name as string | undefined)?.trim();
  if (meta) return meta.split(/\s+/)[0];
  const local = user?.email?.split("@")[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return "there";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        displayName: deriveName(user),
        signOut,
      }}
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
