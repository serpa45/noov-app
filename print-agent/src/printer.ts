import type { AgentConfig, DocumentKind, PrinterConfig } from "./config.js";
import { buildDocument, orderLabel, type OrderRow } from "./documents.js";
import { log } from "./logger.js";
import { alreadyPrinted, markPrinted } from "./state.js";
import { sendBytes } from "./transports/index.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DOC_LABEL: Record<DocumentKind, string> = {
  receipt: "via do balcao",
  kitchen: "via da cozinha",
};

async function sendWithRetry(
  printer: PrinterConfig,
  bytes: Uint8Array,
  docName: string,
  retry: AgentConfig["retry"],
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    try {
      await sendBytes(printer, bytes, docName);
      return;
    } catch (err) {
      lastError = err;
      log.warn(`[${printer.name}] tentativa ${attempt}/${retry.maxAttempts} falhou:`, err);
      if (attempt < retry.maxAttempts) await sleep(retry.delayMs * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

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
): Promise<void> {
  const numero = orderLabel(order);
  const targets = config.printers.filter((p) => p.enabled);

  for (const printer of targets) {
    const kinds = options.only
      ? printer.documents.filter((d) => options.only!.includes(d))
      : printer.documents;
    for (const kind of kinds) {
      const key = `${order.id}:${printer.name}:${kind}`;
      if (!options.force && alreadyPrinted(key)) {
        log.debug(`Pedido ${numero} ja impresso em ${printer.name} (${DOC_LABEL[kind]}), ignorando.`);
        continue;
      }

      let bytes: Uint8Array;
      try {
        bytes = buildDocument(kind, order, loja, printer);
      } catch (err) {
        log.error(`Falha ao montar a ${DOC_LABEL[kind]} do pedido ${numero}:`, err);
        continue;
      }

      try {
        for (let copy = 1; copy <= printer.copies; copy++) {
          await sendWithRetry(printer, bytes, `NOOV pedido ${numero}`, config.retry);
        }
        markPrinted(key);
        log.info(
          `Pedido ${numero} impresso em ${printer.name} (${DOC_LABEL[kind]}, ${printer.copies}x, via ${options.source}).`,
        );
      } catch (err) {
        log.error(`Nao foi possivel imprimir o pedido ${numero} em ${printer.name}:`, err);
      }
    }
  }
}
