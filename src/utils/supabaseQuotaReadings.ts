import { supabase } from "@/integrations/supabase/client";
import { validateQuotaSnapshot, type QuotaSnapshot } from "./supabaseQuotas";

export async function requestQuotaReading(projectRef: string, snapshot?: QuotaSnapshot): Promise<{ snapshot: QuotaSnapshot | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Entre novamente para acessar as leituras compartilhadas.");
  const response = await fetch("/api/admin/supabase-quota-readings", {
    method: snapshot ? "PUT" : "GET",
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(snapshot ? { "Content-Type": "application/json" } : {}) },
    ...(snapshot ? { body: JSON.stringify(validateQuotaSnapshot(snapshot, projectRef)) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Falha ao acessar as leituras compartilhadas.");
  if (!snapshot && result?.snapshot === null) return { snapshot: null };
  return { snapshot: validateQuotaSnapshot(result?.snapshot, projectRef) };
}
