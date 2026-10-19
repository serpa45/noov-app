import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { agentHome } from "./config.js";
import { log } from "./logger.js";

const MAX_ENTRIES = 1000;

let file: string;
type JobState = { status: "pending" | "sending" | "failed" | "printed"; at: number };
let printed = new Map<string, JobState>();

export function initState(): void {
  const dir = resolve(agentHome(), "state");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Diretorio pode ja existir ou ser somente leitura; seguimos em memoria.
  }
  file = resolve(dir, "printed.json");

  if (!existsSync(file)) return;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    printed = new Map(Object.entries(raw).map(([k, v]) => {
      const state = typeof v === "number" ? { status: "printed" as const, at: v } : v as JobState;
      // Uma interrupcao durante o envio tem resultado incerto: so reimpressao manual.
      if (state.status === "sending") state.status = "failed";
      return [k, state];
    }));
    log.debug(`Historico de impressao carregado (${printed.size} registros)`);
  } catch (err) {
    log.warn("Nao foi possivel ler o historico de impressao, comecando vazio.", err);
  }
}

function persist(): void {
  if (!file) return;
  try {
    if (printed.size > MAX_ENTRIES) {
      const unresolved = [...printed.entries()].filter(([, value]) => value.status !== "printed");
      const complete = [...printed.entries()].filter(([, value]) => value.status === "printed")
        .sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
      printed = new Map([...complete, ...unresolved]);
    }
    writeFileSync(file + ".tmp", JSON.stringify(Object.fromEntries(printed)), "utf8");
    renameSync(file + ".tmp", file);
  } catch (err) {
    log.warn("Falha ao gravar o historico de impressao.", err);
  }
}

export function alreadyPrinted(key: string): boolean {
  return printed.get(key)?.status === "printed";
}

export function markPrinted(key: string): void {
  printed.set(key, { status: "printed", at: Date.now() });
  persist();
}

export function hasPrintState(key: string): boolean { return printed.has(key); }
export function printState(key: string) { return printed.get(key)?.status; }
export function markPrintState(key: string, status: JobState["status"]): void {
  printed.set(key, { status, at: Date.now() });
  persist();
}
