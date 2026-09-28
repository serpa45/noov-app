import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { agentHome } from "./config.js";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const RECENT_LIMIT = 300;

let minLevel: Level = "info";
let logDir: string | null = null;
const recent: string[] = [];

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
