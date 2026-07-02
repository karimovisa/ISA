"use client";

import { GlassCard } from "@/components/ui/GlassCard";

export function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <GlassCard className="max-w-lg p-8">
        <h1 className="text-2xl font-bold tracking-tight">Almost there 👋</h1>
        <p className="mt-3 text-sm text-muted">
          ISLOM OS needs a Supabase connection. Create a free project at{" "}
          <span className="text-accent">supabase.com</span>, run the SQL in{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-fg">
            supabase/schema.sql
          </code>
          , then add these to{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-fg">
            .env.local
          </code>
          :
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-black/40 p-4 text-xs text-muted">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...`}
        </pre>
        <p className="mt-4 text-xs text-muted">
          Restart the dev server after saving. See{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-fg">
            SETUP.md
          </code>{" "}
          for the full walkthrough.
        </p>
      </GlassCard>
    </div>
  );
}
