import { createClient } from '@supabase/supabase-js';

// Note: We use a separate client if we need to bypass type checks for a dynamic table
// but since we want to be safe, we'll try to use the main client with 'any' cast if necessary
// for the table name until types are regenerated.
import { supabase } from "@/integrations/supabase/client";

/**
 * Registra um log de erro no backend.
 */
export async function logStoreError({
  storeId,
  profileId,
  message,
  stack,
  metadata = {},
}: {
  storeId?: string;
  profileId?: string;
  message: string;
  stack?: string;
  metadata?: any;
}) {
  try {
    // Cast to any to bypass the missing type definition until types are regenerated
    const { error } = await (supabase as any).from("error_logs").insert({
      store_id: storeId,
      profile_id: profileId,
      url: window.location.href,
      message,
      stack,
      metadata,
    });

    if (error) {
      console.error("Erro ao salvar log de erro no backend:", error);
    }
  } catch (err) {
    console.error("Falha ao invocar logStoreError:", err);
  }
}

/**
 * Captura erros globais e os envia para o log.
 */
export function setupGlobalErrorLogging(storeId?: string, profileId?: string) {
  const handleError = (event: ErrorEvent) => {
    logStoreError({
      storeId,
      profileId,
      message: event.message,
      stack: event.error?.stack,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: "window_error"
      }
    });
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    logStoreError({
      storeId,
      profileId,
      message: `Unhandled Rejection: ${event.reason?.message || String(event.reason)}`,
      stack: event.reason?.stack,
      metadata: {
        reason: event.reason,
        type: "promise_rejection"
      }
    });
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
