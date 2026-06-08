"use client";

import { useEffect } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase";

export function useRealtimeRefresh(tables: string[], onRefresh: () => void) {
  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase || tables.length === 0) return;

    const channel = supabase.channel(`prta-refresh-${tables.join("-")}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onRefresh()
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onRefresh, tables]);
}
