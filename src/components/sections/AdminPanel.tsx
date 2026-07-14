"use client";

// ISA — Owner-only admin panel. Manual Pro grants (cash / bank transfer) without
// touching SQL. The UI is hidden for everyone else, but hiding is NOT the
// security boundary: every admin_* RPC re-checks is_admin() on the server, so a
// non-admin calling them directly still gets "not authorized".

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { fieldClass } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";

type Row = { email: string; plan_key: string; status: string; expires_at: string | null };
type RpcResult = { ok?: boolean; error?: string; expires_at?: string; kind?: string };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "—";

export function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState("naqd pul");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_list_users");
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => {
      if (data === true) {
        setIsAdmin(true);
        void load();
      }
    });
  }, [load]);

  if (!isAdmin) return null;

  const grant = async () => {
    const target = email.trim();
    if (!target || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_grant_pro", {
      p_email: target,
      p_months: months,
      p_note: note.trim() || "manual",
    });
    setBusy(false);
    const r = (data ?? {}) as RpcResult;
    if (error || !r.ok) {
      toast(r.error ?? "Pro berib bo'lmadi.", "error");
      return;
    }
    toast(`${target} — Pro yoqildi (${fmtDate(r.expires_at ?? null)} gacha)`, "success");
    setEmail("");
    void load();
  };

  const revoke = async (target: string) => {
    if (busy || !window.confirm(`${target} — Pro obunani bekor qilaymi?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_revoke_pro", { p_email: target });
    setBusy(false);
    const r = (data ?? {}) as RpcResult;
    if (error || !r.ok) {
      toast(r.error ?? "Bekor qilib bo'lmadi.", "error");
      return;
    }
    toast(`${target} — Pro bekor qilindi.`, "success");
    void load();
  };

  const pro = rows.filter((r) => r.plan_key === "pro");

  return (
    <GlassCard className="mt-6 max-w-xl p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15">
          <ShieldCheck size={16} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">Admin — Pro obuna</h3>
          <p className="text-xs text-muted">Naqd yoki check orqali to&apos;lov qilganlarga qo&apos;lda Pro bering.</p>
        </div>
      </div>

      {/* Grant form */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className={`${fieldClass} w-24 shrink-0`}
        >
          {[1, 2, 3, 6, 12].map((m) => (
            <option key={m} value={m}>{m} oy</option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="izoh"
          className={`${fieldClass} w-28 shrink-0`}
        />
        <PressButton
          onClick={grant}
          disabled={busy || !email.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Plus size={15} /> Pro ber
        </PressButton>
      </div>

      {/* Current Pro members */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">
          Pro foydalanuvchilar ({pro.length})
        </p>
        {pro.length === 0 ? (
          <p className="text-xs text-muted">Hozircha yo&apos;q.</p>
        ) : (
          <ul className="space-y-1.5">
            {pro.map((r) => (
              <li
                key={r.email}
                className="group flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-fg">{r.email}</div>
                  <div className="text-xs text-muted">
                    {r.status === "lifetime" ? "Cheksiz" : `${fmtDate(r.expires_at)} gacha`}
                  </div>
                </div>
                {r.status !== "lifetime" && (
                  <button
                    onClick={() => revoke(r.email)}
                    aria-label="Bekor qilish"
                    className="shrink-0 rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}
