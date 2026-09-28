import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

export type TransportKind = "spooler" | "network" | "serial";
export type DocumentKind = "receipt" | "kitchen";

export interface PrinterConfig {
  /** Rotulo livre usado nos logs, ex: "Balcao" ou "Cozinha". */
  name: string;
  enabled: boolean;
  transport: TransportKind;
  /** Nome da impressora no Windows, IP da impressora de rede ou porta COM. */
  address: string;
  /** Somente para `network`. */
  port: number;
  /** Somente para `serial` (USB serial e Bluetooth pareado como COM). */
  baudRate: number;
  documents: DocumentKind[];
  copies: number;
  paperWidth: 58 | 80;
  textSize: "small" | "normal" | "large";
}

export interface AgentConfig {
  supabase: {
    url: string;
    anonKey: string;
    email: string;
    password: string;
  };
  /** Status do pedido que dispara a impressao. */
  triggerStatus: string[];
  /** Imprime tambem as comandas do PDV (mesas/garcom) na cozinha. */
  printPdvKitchen: boolean;
  /** Se true, imprime os pedidos que ja estavam aceitos quando o agente subiu. */
  printBacklogOnStart: boolean;
  /** Rede de seguranca caso o websocket caia. */
  pollIntervalMs: number;
  retry: {
    maxAttempts: number;
    delayMs: number;
  };
  printers: PrinterConfig[];
  logLevel: "debug" | "info" | "warn" | "error";
}

const PRINTER_DEFAULTS: Omit<PrinterConfig, "name" | "transport" | "address"> = {
  enabled: true,
  port: 9100,
  baudRate: 9600,
  documents: ["receipt"],
  copies: 1,
  paperWidth: 58,
  textSize: "normal",
};

/**
 * Diretorio base do agente. Como servico do Windows o cwd nao e confiavel,
 * entao a raiz e deduzida a partir do proprio arquivo em execucao.
 */
export function agentHome(): string {
  if (process.env.NOOV_AGENT_HOME) return resolve(process.env.NOOV_AGENT_HOME);
  const entry = process.argv[1] ? resolve(process.argv[1]) : process.cwd();
  const dir = dirname(entry);
  if (basename(dir) === "dist" || basename(dir) === "src") return dirname(dir);
  return dir;
}

export function configPath(): string {
  return process.env.NOOV_AGENT_CONFIG
    ? resolve(process.env.NOOV_AGENT_CONFIG)
    : resolve(agentHome(), "config.json");
}

function fail(message: string): never {
  throw new Error(`config.json invalido: ${message}`);
}

function normalizePrinter(raw: any, index: number): PrinterConfig {
  const name = String(raw?.name || `Impressora ${index + 1}`);
  const transport = String(raw?.transport || "") as TransportKind;
  if (!["spooler", "network", "serial"].includes(transport)) {
    fail(`impressora "${name}" tem transport "${raw?.transport}" (use spooler, network ou serial)`);
  }
  const address = String(raw?.address || "").trim();
  if (!address) fail(`impressora "${name}" esta sem "address"`);

  const documents = Array.isArray(raw?.documents) && raw.documents.length
    ? raw.documents.map((d: any) => String(d) as DocumentKind)
    : PRINTER_DEFAULTS.documents;
  for (const doc of documents) {
    if (doc !== "receipt" && doc !== "kitchen") {
      fail(`impressora "${name}" tem documento "${doc}" (use receipt ou kitchen)`);
    }
  }

  const paperWidth = Number(raw?.paperWidth) === 80 ? 80 : 58;

  return {
    ...PRINTER_DEFAULTS,
    name,
    transport,
    address,
    enabled: raw?.enabled !== false,
    port: Number(raw?.port) || PRINTER_DEFAULTS.port,
    baudRate: Number(raw?.baudRate) || PRINTER_DEFAULTS.baudRate,
    documents,
    copies: Math.max(1, Number(raw?.copies) || 1),
    paperWidth,
    textSize: raw?.textSize === "small" || raw?.textSize === "large" ? raw.textSize : "normal",
  };
}

export function loadConfig(): AgentConfig {
  const path = configPath();
  if (!existsSync(path)) {
    throw new Error(
      `Arquivo de configuracao nao encontrado em ${path}. Copie config.example.json para config.json e preencha os dados.`,
    );
  }

  let raw: any;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err: any) {
    fail(`nao foi possivel ler o JSON (${err?.message || err})`);
  }

  const supabase = raw?.supabase ?? {};
  for (const field of ["url", "anonKey", "email", "password"]) {
    if (!String(supabase?.[field] || "").trim()) fail(`supabase.${field} nao foi preenchido`);
  }

  const printers = Array.isArray(raw?.printers) ? raw.printers.map(normalizePrinter) : [];
  if (!printers.some((p) => p.enabled)) fail("nenhuma impressora habilitada na lista 'printers'");

  const triggerStatus = Array.isArray(raw?.triggerStatus) && raw.triggerStatus.length
    ? raw.triggerStatus.map((s: any) => String(s).toLowerCase())
    : ["aceito"];

  return {
    supabase: {
      url: String(supabase.url).replace(/\/+$/, ""),
      anonKey: String(supabase.anonKey),
      email: String(supabase.email),
      password: String(supabase.password),
    },
    triggerStatus,
    printPdvKitchen: raw?.printPdvKitchen !== false,
    printBacklogOnStart: raw?.printBacklogOnStart === true,
    pollIntervalMs: Math.max(5000, Number(raw?.pollIntervalMs) || 20000),
    retry: {
      maxAttempts: Math.max(1, Number(raw?.retry?.maxAttempts) || 5),
      delayMs: Math.max(500, Number(raw?.retry?.delayMs) || 4000),
    },
    printers,
    logLevel: ["debug", "info", "warn", "error"].includes(raw?.logLevel) ? raw.logLevel : "info",
  };
}
