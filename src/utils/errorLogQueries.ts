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

export async function clearErrorLogs(): Promise<number> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
  const response = await fetch("/api/admin/clear-error-logs", {
    method: "DELETE", headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Não foi possível limpar os logs.");
  if (!Number.isSafeInteger(result?.deleted) || result.deleted < 0) {
    throw new Error("O servidor não confirmou quantos logs foram excluídos.");
  }
  return result.deleted;
}
