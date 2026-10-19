import type { AgentConfig, DocumentKind, PrinterConfig } from "./config.js";
import { buildDocument, orderLabel, type OrderRow } from "./documents.js";
import { log } from "./logger.js";
import { alreadyPrinted, markPrinted, markPrintState, printState } from "./state.js";
import { sendBytes } from "./transports/index.js";

const queues = new Map<string, Promise<unknown>>();
async function serialize<T>(printer: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(printer) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  queues.set(printer, next);
  try { return await next; }
  finally { if (queues.get(printer) === next) queues.delete(printer); }
}
export type PrintResult = { ok: boolean; sent: number; skipped: number; errors: string[] };

const DOC_LABEL: Record<DocumentKind, string> = {
  receipt: "via do balcao",
  kitchen: "via da cozinha",
};

/**
 * Imprime um pedido em todas as impressoras configuradas.
 * Cada combinacao pedido/impressora/documento so imprime uma vez, mesmo que
 * o evento chegue pelo websocket e pela varredura periodica ao mesmo tempo.
 */
export async function printOrder(
  order: OrderRow,
  loja: any,
  config: AgentConfig,
  options: { source: string; only?: DocumentKind[]; force?: boolean } = { source: "realtime" },
): Promise<PrintResult> {
  const result: PrintResult = { ok: true, sent: 0, skipped: 0, errors: [] };
  const numero = orderLabel(order);
  const targets = config.printers.filter((p) => p.enabled);

  for (const printer of targets) {
    const kinds = options.only
      ? printer.documents.filter((d) => options.only!.includes(d))
      : printer.documents;
    await serialize(`${printer.transport}:${printer.address}`, async () => {
      for (const kind of kinds) {
        const key = `${order.id}:${printer.name}:${kind}`;
        if (!options.force && alreadyPrinted(key)) {
          log.debug(`Pedido ${numero} ja impresso em ${printer.name} (${DOC_LABEL[kind]}), ignorando.`);
          result.skipped++;
          continue;
        }
        if (!options.force && ["failed", "sending"].includes(printState(key) || "")) {
          result.errors.push(`Pedido ${numero}: envio anterior incerto em ${printer.name}. Confira a impressora antes de reimprimir manualmente.`);
          continue;
        }
        markPrintState(key, "pending");

        let bytes: Uint8Array;
        try {
          bytes = buildDocument(kind, order, loja, printer);
        } catch (err) {
          result.errors.push(`Falha ao montar ${DOC_LABEL[kind]}: ${String(err)}`);
          log.error(`Falha ao montar a ${DOC_LABEL[kind]} do pedido ${numero}:`, err);
          continue;
        }

        try {
          markPrintState(key, "sending");
          for (let copy = 1; copy <= printer.copies; copy++) {
            await sendBytes(printer, bytes, `NOOV pedido ${numero}`);
          }
          markPrinted(key);
          result.sent++;
          log.info(
            `Pedido ${numero} enviado para ${printer.name} (${DOC_LABEL[kind]}, ${printer.copies}x, via ${options.source}).`,
          );
        } catch (err) {
          markPrintState(key, "failed");
          result.errors.push(`Falha no envio para ${printer.name}: ${String(err)}. Confira o papel antes de reimprimir.`);
          log.error(`Nao foi possivel imprimir o pedido ${numero} em ${printer.name}:`, err);
        }
      }
    });
  }
  if (!targets.length || !result.sent && !result.skipped && !result.errors.length) result.errors.push("Nenhuma impressora habilitada para o documento solicitado.");
  result.ok = result.errors.length === 0;
  return result;
}
