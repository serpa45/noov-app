/** Porta local do NOOV Print Agent (so escuta em 127.0.0.1). */
const AGENT_BASE = "http://127.0.0.1:7777";

export type AgentDocumentKind = "receipt" | "kitchen";

/**
 * Envia um pedido para o NOOV Print Agent local (mesmo caminho do "Imprimir teste").
 * Retorna true se o agente aceitou e imprimiu; false se o agente nao esta rodando.
 */
export async function printOrderViaAgent(
  order: Record<string, any>,
  documents?: AgentDocumentKind[],
): Promise<{ ok: boolean; offline?: boolean; error?: string }> {
  if (!order?.id) return { ok: false, error: "Pedido inválido" };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${AGENT_BASE}/api/print-order`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order, documents }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (data?.ok) return { ok: true };
    return { ok: false, error: data?.error || "Agente recusou a impressão" };
  } catch {
    return {
      ok: false,
      offline: true,
      error: "NOOV Print Agent não está rodando neste computador",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
