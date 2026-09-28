import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { agentHome } from "./config.js";
import { log } from "./logger.js";

const MAX_ENTRIES = 1000;

let file: string;
let printed = new Map<string, number>();

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
    printed = new Map(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
    log.debug(`Historico de impressao carregado (${printed.size} registros)`);
  } catch (err) {
    log.warn("Nao foi possivel ler o historico de impressao, comecando vazio.", err);
  }
}

function persist(): void {
  if (!file) return;
  try {
    if (printed.size > MAX_ENTRIES) {
      const keep = [...printed.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES);
      printed = new Map(keep);
    }
    writeFileSync(file, JSON.stringify(Object.fromEntries(printed)), "utf8");
  } catch (err) {
    log.warn("Falha ao gravar o historico de impressao.", err);
  }
}

export function alreadyPrinted(key: string): boolean {
  return printed.has(key);
}

export function markPrinted(key: string): void {
  printed.set(key, Date.now());
  persist();
}
