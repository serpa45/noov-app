import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { agentHome } from "./config.js";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const RECENT_LIMIT = 300;

let minLevel: Level = "info";
let logDir: string | null = null;
const recent: string[] = [];
let remoteReporter: ((message: string) => Promise<void>) | undefined;
const remotelyReported = new Map<string, number>();
export function setRemoteErrorReporter(reporter?: (message: string) => Promise<void>): void {
  remoteReporter = reporter;
}
function safeText(text: string): string {
  return text.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/([?&#](?:access_token|refresh_token|token|password|code)=)[^\s&#]*/gi, "$1[redacted]").slice(0, 12000);
}

/** Ultimas linhas em memoria, mostradas na tela de configuracao do agente. */
export function recentLogs(): string[] {
  return [...recent];
}

export function configureLogger(level: Level): void {
  minLevel = level;
  try {
    logDir = resolve(agentHome(), "logs");
    mkdirSync(logDir, { recursive: true });
  } catch {
    logDir = null;
  }
}

function write(level: Level, args: unknown[]): void {
  if (ORDER[level] < ORDER[minLevel]) return;

  const stamp = new Date().toISOString();
  const text = args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.stack || a.message : JSON.stringify(a)))
    .join(" ");
  if (level === "error" && remoteReporter) {
    const safe = safeText(text);
    const now = Date.now();
    for (const [key, at] of remotelyReported) if (now - at > 60000) remotelyReported.delete(key);
    if (!remotelyReported.has(safe)) {
      remotelyReported.set(safe, now);
      // O envio remoto nunca bloqueia o trabalho da impressora ou gera outro log remoto.
      void remoteReporter(safe).catch(() => { remotelyReported.delete(safe); });
    }
  }
  const entry = `[${stamp}] ${level.toUpperCase()} ${text}`;

  recent.push(entry);
  if (recent.length > RECENT_LIMIT) recent.shift();

  if (level === "error" || level === "warn") console.error(entry);
  else console.log(entry);

  if (!logDir) return;
  try {
    const file = resolve(logDir, `agent-${stamp.slice(0, 10)}.log`);
    appendFileSync(file, `${entry}\n`, "utf8");
  } catch {
    // Log em arquivo e melhor esforco; nunca deve derrubar a impressao.
  }
}

export const log = {
  debug: (...args: unknown[]) => write("debug", args),
  info: (...args: unknown[]) => write("info", args),
  warn: (...args: unknown[]) => write("warn", args),
  error: (...args: unknown[]) => write("error", args),
};
