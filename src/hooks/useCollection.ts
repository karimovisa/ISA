"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Row = { id: string };

/**
 * Generic CRUD hook over a Supabase table. RLS scopes every query to the
 * signed-in user, so we never filter by user_id on reads.
 */
export function useCollection<T extends Row>(
  table: string,
  options: { orderBy?: string; ascending?: boolean } = {}
) {
  const { orderBy = "created_at", ascending = false } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending });
    if (!error && rows) setData(rows as T[]);
    setLoading(false);
  }, [table, orderBy, ascending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (row: Partial<T>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from(table)
        .insert({ ...row, user_id: user.id });
      if (!error) await refresh();
    },
    [table, refresh]
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      // Dynamic table name → bypass generic row typing.
      const { error } = await supabase
        .from(table)
        .update(patch as never)
        .eq("id", id);
      if (!error) await refresh();
    },
    [table, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (!error) await refresh();
    },
    [table, refresh]
  );

  return { data, loading, add, update, remove, refresh };
}
