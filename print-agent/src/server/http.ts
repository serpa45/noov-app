import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SETUP_PORT } from "../brand.js";
import { parseConfig, saveConfig, tryLoadConfig } from "../config.js";
import { autostartSupported, disableAutostart, enableAutostart, isAutostartEnabled } from "../autostart.js";
import { buildDocument, type OrderRow } from "../documents.js";
import { log, recentLogs } from "../logger.js";
import { applyConfig, status } from "../runtime.js";
import { connect } from "../supabase.js";
import { sendBytes } from "../transports/index.js";
import { listSerialPorts, listSpoolerPrinters } from "../transports/index.js";
import { AGENT_VERSION } from "../updater.js";
import SETUP_HTML from "./ui.html";

const TEST_LOJA = {
  nome: "TESTE NOOV",
  documento: "00.000.000/0001-00",
  endereco_rua: "Rua de Teste",
  endereco_numero: "100",
  endereco_bairro: "Centro",
  endereco_cidade: "Sao Paulo",
  endereco_estado: "SP",
};

const TEST_ORDER: OrderRow = {
  id: "00000000-0000-0000-0000-000000000000",
  numero_diario: 999,
  created_at: new Date().toISOString(),
  status: "aceito",
  tipo: "balcao",
  total: 42.5,
  cliente_nome: "CLIENTE DE TESTE",
  cliente_telefone: "11999998888",
  observacoes: "Pagamento: Dinheiro",
  items: [
    {
      nome: "X-Salada",
      quantidade: 2,
      preco: 18.5,
      observacao: "Sem cebola",
      adicionais: [{ nome: "Bacon", preco: 3, quantidade: 1 }],
    },
    { nome: "Refrigerante Lata", quantidade: 1, preco: 5.5 },
  ],
};

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512 * 1024) throw new Error("Corpo da requisicao grande demais.");
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Monta o objeto que vai para o config.json a partir do que a tela enviou. */
function configFromForm(form: any): any {
  const stored = tryLoadConfig();
  const password = String(form?.password || "") || stored?.supabase.password || "";
  return {
    supabase: { email: String(form?.email || "").trim(), password },
    triggerStatus: Array.isArray(form?.triggerStatus) && form.triggerStatus.length ? form.triggerStatus : ["aceito"],
    printPdvKitchen: form?.printPdvKitchen !== false,
    printBacklogOnStart: false,
    pollIntervalMs: 20000,
    logLevel: "info",
    retry: { maxAttempts: 5, delayMs: 4000 },
    printers: (Array.isArray(form?.printers) ? form.printers : []).filter((p: any) => p?.enabled !== false),
  };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://localhost:${SETUP_PORT}`);
  const path = url.pathname;

  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(SETUP_HTML);
    return;
  }

  if (req.method === "GET" && path === "/api/status") {
    const stored = tryLoadConfig();
    json(res, 200, {
      ...status(),
      version: AGENT_VERSION,
      hasPassword: Boolean(stored?.supabase.password),
      autostart: await isAutostartEnabled(),
      autostartSupported: autostartSupported(),
      config: stored
        ? {
            email: stored.supabase.email,
            triggerStatus: stored.triggerStatus,
            printPdvKitchen: stored.printPdvKitchen,
            printers: stored.printers,
          }
        : null,
    });
    return;
  }

  if (req.method === "GET" && path === "/api/printers") {
    const [spooler, serial] = await Promise.all([listSpoolerPrinters(), listSerialPorts()]);
    json(res, 200, { spooler, serial });
    return;
  }

  if (req.method === "GET" && path === "/api/logs") {
    json(res, 200, { lines: recentLogs().slice(-120) });
    return;
  }

  if (req.method === "POST" && path === "/api/login") {
    const body = await readBody(req);
    try {
      const probe = parseConfig({
        supabase: { email: body?.email, password: body?.password },
        printers: [{ name: "temp", transport: "spooler", address: "temp" }],
      });
      const session = await connect(probe);
      const nome = session.loja?.nome ?? "";
      await session.client.auth.signOut().catch(() => {});
      json(res, 200, { ok: true, lojaNome: nome });
    } catch (err: any) {
      json(res, 200, { ok: false, error: err?.message || String(err) });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/test") {
    const body = await readBody(req);
    try {
      const printer = parseConfig({
        supabase: { email: "teste@noov.app.br", password: "teste" },
        printers: [body?.printer],
      }).printers[0];
      for (const kind of printer.documents) {
        await sendBytes(printer, buildDocument(kind, TEST_ORDER, TEST_LOJA, printer), "NOOV teste");
      }
      log.info(`Teste enviado para "${printer.name}".`);
      json(res, 200, { ok: true });
    } catch (err: any) {
      json(res, 200, { ok: false, error: err?.message || String(err) });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/save") {
    const body = await readBody(req);
    try {
      const raw = configFromForm(body);
      const config = saveConfig(raw);
      if (autostartSupported()) {
        if (body?.autostart === false) await disableAutostart();
        else await enableAutostart();
      }
      await applyConfig(config);
      json(res, 200, { ok: true });
    } catch (err: any) {
      json(res, 200, { ok: false, error: err?.message || String(err) });
    }
    return;
  }

  json(res, 404, { error: "not found" });
}

export function startSetupServer(): Promise<string> {
  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      log.error("Erro na tela de configuracao:", err);
      if (!res.headersSent) json(res, 500, { error: err?.message || String(err) });
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    // Apenas 127.0.0.1: a tela nunca fica exposta na rede da loja.
    server.listen(SETUP_PORT, "127.0.0.1", () => resolve(`http://localhost:${SETUP_PORT}`));
  });
}
