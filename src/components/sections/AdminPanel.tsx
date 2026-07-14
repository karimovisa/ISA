"use client";

// ISA — Owner-only admin panel. Pick a user from the list (search included),
// grant / extend / revoke Pro. No SQL, no typing emails.
//
// The UI is hidden for non-admins, but hiding is NOT the security boundary:
// every admin_* RPC re-checks is_admin() on the server, so calling them directly
// still returns "not authorized".

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Search, Check, X, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { fieldClass } from "@/components/ui/Modal";
import { formatSom } from "@/lib/money";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type UserRow = {
  user_id: string;
  email: string;
  plan_key: string;
  status: string;
  expires_at: string | null;
  joined_at: string;
  days_left: number | null;
};
type Stats = {
  total_users: number;
  pro_users: number;
  expiring_7d: number;
  new_7d: number;
  manual_revenue: number;
  click_revenue: number;
};
type Grant = {
  email: string;
  provider: string;
  amount: number;
  kind: string;
  period_end: string;
  note: string | null;
  created_at: string;
};
type RpcResult = { ok?: boolean; error?: string; expires_at?: string };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "—";

const isPro = (u: UserRow) =>
  u.plan_key === "pro" && (u.status === "lifetime" || u.status === "active");

export function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState("naqd pul");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [u, s, g] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.rpc("admin_stats"),
      supabase.rpc("admin_recent_grants", { p_limit: 6 }),
    ]);
    setUsers((u.data as UserRow[]) ?? []);
    setStats((s.data as Stats) ?? null);
    setGrants((g.data as Grant[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => {
      if (data === true) {
        setIsAdmin(true);
        void load();
      }
    });
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => u.email.toLowerCase().includes(term));
  }, [users, q]);

  if (!isAdmin) return null;

  // supabase.rpc() returns a thenable builder, not a full Promise — PromiseLike.
  const run = async (fn: () => PromiseLike<{ data: unknown; error: unknown }>, okMsg: string) => {
    setBusy(true);
    const { data, error } = await fn();
    setBusy(false);
    const r = (data ?? {}) as RpcResult;
    if (error || !r.ok) {
      toast(r.error ?? "Amal bajarilmadi.", "error");
      return;
    }
    toast(okMsg, "success");
    setSelected(null);
    void load();
  };

  const grant = () =>
    selected &&
    run(
      () =>
        supabase.rpc("admin_grant_pro_by_id", {
          p_user: selected.user_id,
          p_months: months,
          p_note: note.trim() || "manual",
        }),
      `${selected.email} — Pro ${months} oyga yoqildi`
    );

  const revoke = () =>
    selected &&
    window.confirm(`${selected.email} — Pro obunani bekor qilaymi?`) &&
    run(
      () => supabase.rpc("admin_revoke_pro_by_id", { p_user: selected.user_id }),
      `${selected.email} — Pro bekor qilindi`
    );

  return (
    <GlassCard className="mt-6 max-w-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15">
          <ShieldCheck size={16} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">Admin — Pro obuna</h3>
          <p className="text-xs text-muted">Foydalanuvchini tanlab, qo&apos;lda Pro bering.</p>
        </div>
        <button
          onClick={() => void load()}
          aria-label="Yangilash"
          className="shrink-0 rounded-lg p-1.5 text-muted transition hover:text-fg"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Jami", String(stats.total_users)],
              ["Pro", String(stats.pro_users)],
              ["7 kunda tugaydi", String(stats.expiring_7d)],
              ["Tushum", formatSom(Number(stats.manual_revenue) + Number(stats.click_revenue))],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-white/[0.02] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
              <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mt-3">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Email bo'yicha qidirish…"
          className={`${fieldClass} w-full pl-9`}
        />
      </div>

      {/* User list */}
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 && <li className="py-3 text-xs text-muted">Topilmadi.</li>}
        {filtered.map((u) => {
          const active = selected?.user_id === u.user_id;
          const pro = isPro(u);
          return (
            <li key={u.user_id}>
              <button
                onClick={() => setSelected(active ? null : u)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-accent/60 bg-accent/10"
                    : "border-line bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-fg">{u.email}</div>
                  <div className="text-xs text-muted">
                    {u.status === "lifetime"
                      ? "Cheksiz"
                      : pro
                        ? `${fmtDate(u.expires_at)} gacha${u.days_left != null ? ` · ${u.days_left} kun` : ""}`
                        : "Free"}
                  </div>
                </div>
                {pro && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      u.status === "lifetime"
                        ? "bg-white/10 text-fg"
                        : (u.days_left ?? 99) <= 7
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-accent/20 text-accent"
                    )}
                  >
                    {u.status === "lifetime" ? "∞" : "PRO"}
                  </span>
                )}
                {active && <Check size={15} className="shrink-0 text-accent" />}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Action bar for the selected user */}
      {selected && (
        <div className="mt-3 rounded-2xl border border-accent/40 bg-accent/[0.06] p-3">
          <p className="mb-2 truncate text-xs text-muted">
            Tanlangan: <span className="font-medium text-fg">{selected.email}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className={`${fieldClass} w-24 shrink-0`}
            >
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m} oy
                </option>
              ))}
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="izoh"
              className={`${fieldClass} min-w-0 flex-1`}
            />
            <PressButton
              onClick={grant}
              disabled={busy}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Check size={15} />
              {isPro(selected) ? "Uzaytirish" : "Pro ber"}
            </PressButton>
            {isPro(selected) && selected.status !== "lifetime" && (
              <PressButton
                onClick={revoke}
                disabled={busy}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:text-red-400 disabled:opacity-50"
              >
                <X size={15} /> Bekor
              </PressButton>
            )}
          </div>
          {isPro(selected) && selected.status !== "lifetime" && (
            <p className="mt-2 text-[11px] text-muted">
              Uzaytirsangiz, qolgan kunlar ustiga qo&apos;shiladi (yo&apos;qolmaydi).
            </p>
          )}
        </div>
      )}

      {/* Recent grants */}
      {grants.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Clock size={12} /> Oxirgi to&apos;lovlar
          </p>
          <ul className="space-y-1">
            {grants.map((g, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-fg/80">{g.email}</span>
                <span className="shrink-0 text-muted">{g.provider === "manual" ? g.note || "naqd" : g.provider}</span>
                <span className="shrink-0 tabular-nums text-muted">{formatSom(Number(g.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}
