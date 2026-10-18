import { supabase } from "@/integrations/supabase/client";

export const errorLogKeys = {
  list: ["admin-error-logs"] as const,
  count: ["admin-error-logs-count"] as const,
};

export type ErrorLog = {
  id: string; message: string; created_at: string; url: string; stack?: string;
  metadata?: Record<string, unknown>; lojas?: { nome: string } | null;
};

export async function fetchErrorLogs(): Promise<ErrorLog[]> {
  const { data, error } = await (supabase as any).from("error_logs")
    .select("*, lojas(nome)").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function countErrorLogs() {
  const { count, error } = await (supabase as any).from("error_logs")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
