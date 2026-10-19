import { reportAppError } from "@/utils/errorLogger";

/** Porta local do NOOV Print Agent (so escuta em 127.0.0.1). */
const AGENT_BASE = "http://127.0.0.1:7777";

export type AgentDocumentKind = "receipt" | "kitchen";

/**
 * Envia um pedido para o NOOV Print Agent local (mesmo caminho do "Imprimir teste").
 * Confirma o envio ao agente; o papel depende do driver e da impressora.
 */
export async function printOrderViaAgent(
  order: Record<string, any>,
  documents?: AgentDocumentKind[],
  automatic = false,
): Promise<{ ok: boolean; offline?: boolean; error?: string }> {
  if (!order?.id) return { ok: false, error: "Pedido inválido" };

  const preflightAttempts = automatic ? 3 : 1;
  for (let attempt = 1; attempt <= preflightAttempts; attempt++) {
    const preflightController = new AbortController();
    const preflightTimer = window.setTimeout(() => preflightController.abort(), 3000);
    try {
      const status = await fetch(`${AGENT_BASE}/api/status`, {
        cache: "no-store", signal: preflightController.signal,
      });
      if (!status.ok) throw new Error("Agente indisponível");
      break;
    } catch {
      window.clearTimeout(preflightTimer);
      if (attempt < preflightAttempts) {
        // Ainda nao enviamos pedido: repetir esta verificacao nao duplica cupons.
        await new Promise(resolve => window.setTimeout(resolve, 5000));
        continue;
      }
      reportAppError(new Error("NOOV Print Agent indisponível neste computador"), "print_error", "print-agent-status");
      return { ok: false, offline: true, error: "NOOV Print Agent indisponível neste computador" };
    } finally {
      window.clearTimeout(preflightTimer);
    }
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 180000);

  try {
    const res = await fetch(`${AGENT_BASE}/api/print-order`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order, documents, automatic }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) return { ok: true };
    reportAppError(new Error(data?.error || "Agente recusou a impressão"), "print_error", "print-agent");
    return { ok: false, error: data?.error || "Agente recusou a impressão" };
  } catch {
    reportAppError(new Error("Não foi possível confirmar o envio à impressora. Verifique o agente antes de reimprimir."), "print_error", "print-agent");
    return {
      ok: false,
      offline: false,
      error: "Não foi possível confirmar o envio à impressora. Verifique o agente antes de reimprimir.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
