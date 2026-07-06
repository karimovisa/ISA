"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { todayISO } from "@/lib/datetime";
import { PRAYERS, windowOf, statusAt, toMin } from "@/lib/prayer";
import { toast } from "@/lib/toast";
import type {
  PrayerLog,
  PrayerName,
  PrayerPreferences,
  PrayerTimes,
} from "@/lib/types";

const CITY = "sirdaryo";

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function usePrayer() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PrayerPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);

  const [active, setActive] = useState<PrayerTimes | null>(null);
  const [activeDate, setActiveDate] = useState("");
  const [logs, setLogs] = useState<PrayerLog[]>([]);
  const [timesLoading, setTimesLoading] = useState(true);
  const [nowMin, setNowMin] = useState(minutesNow());

  // Live clock so windows advance while the page is open.
  useEffect(() => {
    const id = setInterval(() => setNowMin(minutesNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadPrefs = useCallback(async () => {
    const { data } = await supabase
      .from("prayer_preferences")
      .select("*")
      .maybeSingle();
    setPrefs((data as PrayerPreferences) ?? null);
    setPrefsLoading(false);
  }, []);

  const loadTimes = useCallback(async () => {
    const today = todayISO();
    const yest = shiftDate(today, -1);
    const { data } = await supabase
      .from("prayer_times")
      .select("*")
      .eq("city", CITY)
      .in("date", [yest, today]);
    const rows = (data as PrayerTimes[]) ?? [];
    const todayRow = rows.find((r) => r.date === today) ?? null;
    const yestRow = rows.find((r) => r.date === yest) ?? null;

    // Before today's bomdod, the active "prayer day" is still yesterday.
    const now = minutesNow();
    if (todayRow && yestRow && now < toMin(todayRow.bomdod)) {
      setActive(yestRow);
      setActiveDate(yest);
    } else {
      setActive(todayRow);
      setActiveDate(todayRow ? today : "");
    }
    setTimesLoading(false);
  }, []);

  const loadLogs = useCallback(async (date: string) => {
    if (!date) return;
    const { data } = await supabase
      .from("prayer_logs")
      .select("*")
      .eq("date", date);
    setLogs((data as PrayerLog[]) ?? []);
  }, []);

  useEffect(() => {
    loadPrefs();
    loadTimes();
  }, [loadPrefs, loadTimes]);

  useEffect(() => {
    if (activeDate) loadLogs(activeDate);
  }, [activeDate, loadLogs]);

  const savePrefs = useCallback(
    async (patch: Partial<PrayerPreferences>) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("prayer_preferences")
        .upsert(
          { user_id: user.id, updated_at: new Date().toISOString(), ...patch },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) {
        toast("Couldn't save.", "error");
        return;
      }
      setPrefs(data as PrayerPreferences);
    },
    [user]
  );

  // "now" relative to the active day's midnight (past midnight → +1440).
  const effNow = activeDate === todayISO() ? nowMin : nowMin + 1440;

  const tick = useCallback(
    async (name: PrayerName) => {
      if (!user || !active) return;
      const win = windowOf(name, active);
      const status = statusAt(win, effNow);
      const { error } = await supabase.from("prayer_logs").upsert(
        {
          user_id: user.id,
          date: activeDate,
          prayer_name: name,
          ticked_at: new Date().toISOString(),
          status,
        },
        { onConflict: "user_id,date,prayer_name" }
      );
      if (error) {
        toast("Couldn't mark that.", "error");
        return;
      }
      toast(
        status === "vaqtida" ? "On time ✓" : "Late — logged anyway",
        status === "vaqtida" ? "success" : "info"
      );
      loadLogs(activeDate);
    },
    [user, active, activeDate, effNow, loadLogs]
  );

  const logFor = (name: PrayerName) =>
    logs.find((l) => l.prayer_name === name) ?? null;

  return {
    prefs,
    prefsLoading,
    savePrefs,
    active,
    activeDate,
    timesLoading,
    nowMin,
    effNow,
    logs,
    logFor,
    tick,
    prayers: PRAYERS,
    reloadLogs: () => loadLogs(activeDate),
  };
}
