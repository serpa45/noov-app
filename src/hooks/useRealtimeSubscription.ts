import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on a table and auto-invalidate React Query cache.
 * @param tableName - public table name
 * @param queryKeys - array of query key prefixes to invalidate on change
 * @param filter - optional Postgres filter string e.g. "lojista_id=eq.xxx"
 */
export function useRealtimeSubscription(
  tableName: string,
  queryKeys: string[][],
  filter?: string
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const channelName = filter
      ? `${tableName}-${filter}-${uniqueId}`
      : `${tableName}-realtime-${uniqueId}`;

    const subscriptionConfig: any = {
      event: "*" as const,
      schema: "public",
      table: tableName,
    };
    if (filter) subscriptionConfig.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", subscriptionConfig, () => {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, JSON.stringify(queryKeys), filter, queryClient]);
}
