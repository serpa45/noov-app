import type { AgentConfig } from "./config.js";
import type { OrderRow } from "./documents.js";
import { log } from "./logger.js";
import { printOrder } from "./printer.js";
import { markPrinted } from "./state.js";
import type { Session } from "./supabase.js";

const LOOKBACK_HOURS = 12;

function lookbackISO(hours = LOOKBACK_HOURS): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isTrigger(config: AgentConfig, status: unknown): boolean {
  return config.triggerStatus.includes(String(status || "").toLowerCase());
}

/**
 * Marca como impresso tudo que ja estava aceito quando o agente subiu, para
 * que uma reinicializacao no meio do expediente nao cuspa o dia inteiro.
 */
async function seedBaseline(session: Session, config: AgentConfig): Promise<void> {
  const { data } = await session.client
    .from("pedidos")
    .select("id, status")
    .eq("lojista_id", session.userId)
    .gte("created_at", lookbackISO());

  let count = 0;
  for (const row of data ?? []) {
    if (!isTrigger(config, (row as any).status)) continue;
    for (const printer of config.printers) {
      for (const kind of printer.documents) markPrinted(`${(row as any).id}:${printer.name}:${kind}`);
    }
    count++;
  }
  if (count) log.info(`${count} pedido(s) ja aceitos foram ignorados no arranque.`);
}

async function resolveMesaNome(session: Session, mesaId: string | null): Promise<string | undefined> {
  if (!mesaId) return undefined;
  const { data } = await session.client.from("pdv_mesas").select("nome").eq("id", mesaId).maybeSingle();
  return (data as any)?.nome || undefined;
}

export async function startWatching(session: Session, config: AgentConfig): Promise<void> {
  if (!config.printBacklogOnStart) await seedBaseline(session, config);

  const handleOrder = async (row: OrderRow, source: string) => {
    if (!isTrigger(config, row.status)) return;
    await printOrder(row, session.loja, config, { source });
  };

  session.client
    .channel("noov-print-pedidos")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pedidos", filter: `lojista_id=eq.${session.userId}` },
      (payload) => {
        const row = payload.new as OrderRow;
        if (!row?.id) return;
        void handleOrder(row, "tempo real").catch((err) => log.error("Erro ao imprimir pedido:", err));
      },
    )
    .subscribe((status) => log.info(`Canal de pedidos: ${status}`));

  if (config.printPdvKitchen) {
    session.client
      .channel("noov-print-pdv")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_pedidos", filter: `loja_id=eq.${session.loja.id}` },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          void (async () => {
            const mesaNome = await resolveMesaNome(session, row.mesa_id);
            // A chave inclui o momento da ultima inclusao de itens: cada nova
            // rodada na mesma comanda gera uma comanda nova para a cozinha.
            const round = row.last_added_at || row.created_at;
            await printOrder(
              { ...row, id: `${row.id}@${round}`, mesa_nome: mesaNome },
              session.loja,
              config,
              { source: "PDV", only: ["kitchen"] },
            );
          })().catch((err) => log.error("Erro ao imprimir comanda do PDV:", err));
        },
      )
      .subscribe((status) => log.info(`Canal do PDV: ${status}`));
  }

  // Varredura periodica: rede de seguranca caso o websocket caia sem avisar.
  setInterval(() => {
    void (async () => {
      const { data, error } = await session.client
        .from("pedidos")
        .select("*")
        .eq("lojista_id", session.userId)
        .gte("created_at", lookbackISO(6))
        .order("created_at", { ascending: true });
      if (error) {
        log.warn("Varredura periodica falhou:", error.message);
        return;
      }
      for (const row of data ?? []) await handleOrder(row as OrderRow, "varredura");
    })().catch((err) => log.error("Erro na varredura periodica:", err));
  }, config.pollIntervalMs);

  log.info("Agente pronto. Aguardando pedidos aceitos...");
}
