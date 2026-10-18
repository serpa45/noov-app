import { supabase } from "@/integrations/supabase/client";

type ErrorContext = { storeId?: string; profileId?: string };
let context: ErrorContext = {};
const recent = new Map<string, number>();

export function setErrorLoggingContext(value: ErrorContext) {
  context = value;
  return () => { if (context === value) context = {}; };
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error ?? "Erro desconhecido");
}

export function sanitizeErrorText(value: string): string {
  return value.replace(/([?&#](?:access_token|refresh_token|token|password|code)=)[^\s&#]*/gi, "$1[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 12000);
}

export async function logStoreError({ storeId, profileId, message, stack, metadata = {} }: ErrorContext & {
  message: string; stack?: string; metadata?: Record<string, unknown>;
}) {
  const safeMessage = sanitizeErrorText(message);
  const url = typeof window === "undefined" ? "" : window.location.origin + window.location.pathname;
  const fingerprint = `${url}:${safeMessage}:${metadata.type ?? "error"}`;
  const now = Date.now();
  for (const [key, timestamp] of recent) if (now - timestamp > 5000) recent.delete(key);
  if (recent.has(fingerprint)) return;
  recent.set(fingerprint, now);
  try {
    const safeMetadata = Object.fromEntries(Object.entries(metadata)
      .filter(([key]) => !/token|password|authorization|cookie|secret/i.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? sanitizeErrorText(value) :
        typeof value === "number" || typeof value === "boolean" || value === null ? value : String(value)]));
    const { error } = await (supabase as any).from("error_logs").insert({
      store_id: storeId ?? context.storeId,
      profile_id: profileId ?? context.profileId,
      url, message: safeMessage, stack: stack ? sanitizeErrorText(stack) : undefined,
      metadata: safeMetadata,
    });
    if (error) {
      recent.delete(fingerprint);
      console.warn("Não foi possível salvar o log no Supabase:", error.message);
    }
  } catch (error) {
    recent.delete(fingerprint);
    console.warn("Falha ao registrar erro:", errorMessage(error));
  }
}

export function reportAppError(error: unknown, type: string, source?: string) {
  void logStoreError({ message: errorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
    metadata: { type, ...(source ? { source } : {}) },
  });
}

export function setupGlobalErrorLogging() {
  const handleError = (event: ErrorEvent) => {
    void logStoreError({ message: event.message, stack: event.error?.stack,
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno, type: "window_error" } });
  };
  const handleRejection = (event: PromiseRejectionEvent) => reportAppError(event.reason, "promise_rejection");
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
