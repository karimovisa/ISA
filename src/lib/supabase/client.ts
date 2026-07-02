import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both env vars are present, so the UI can show a setup screen
 *  instead of crashing when Supabase isn't configured yet. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Browser Supabase client. Falls back to harmless placeholder values when the
 * project isn't configured, so importing this module never throws at build time.
 */
export const supabase = createBrowserClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);
