import { spawn } from "node:child_process";
import { existsSync, renameSync, statSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isPackaged } from "./config.js";
import { log } from "./logger.js";

declare const __AGENT_VERSION__: string;

export const AGENT_VERSION = typeof __AGENT_VERSION__ === "string" ? __AGENT_VERSION__ : "dev";

const DEFAULT_MANIFEST_URL =
  "https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/installers/print-agent/latest.json";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function manifestUrl(): string {
  return process.env.NOOV_AGENT_MANIFEST || DEFAULT_MANIFEST_URL;
}

function paths() {
  const exe = process.execPath;
  const dir = dirname(exe);
  return {
    exe,
    pending: resolve(dir, "noov-print-agent.new.exe"),
    previous: resolve(dir, "noov-print-agent.old.exe"),
  };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Troca o executavel por uma versao ja baixada e reinicia.
 *
 * Roda antes de qualquer conexao, no arranque: o Windows nao deixa sobrescrever
 * um .exe em uso, mas deixa renomea-lo, entao a versao velha e movida de lado e
 * a nova assume o nome original. Fazer isso so no arranque evita reiniciar o
 * agente no meio do expediente e perder um pedido.
 *
 * Retorna true quando o processo vai ser substituido e deve encerrar.
 */
export function applyPendingUpdate(): boolean {
  if (!isPackaged()) return false;
  const { exe, pending, previous } = paths();

  if (existsSync(previous)) {
    try {
      unlinkSync(previous);
    } catch {
      // A versao anterior pode ainda estar travada; sera removida depois.
    }
  }

  if (!existsSync(pending)) return false;

  try {
    if (statSync(pending).size < 1024 * 1024) {
      unlinkSync(pending);
      log.warn("Atualizacao descartada: arquivo baixado esta incompleto.");
      return false;
    }
    renameSync(exe, previous);
    renameSync(pending, exe);
  } catch (err) {
    log.error("Falha ao aplicar a atualizacao:", err);
    return false;
  }

  log.info("Atualizacao aplicada. Reiniciando o agente...");
  spawn(exe, process.argv.slice(2), { detached: true, stdio: "ignore" }).unref();
  return true;
}

async function downloadUpdate(): Promise<void> {
  const response = await fetch(manifestUrl(), { cache: "no-store" } as RequestInit);
  if (!response.ok) throw new Error(`manifesto respondeu ${response.status}`);

  const manifest: any = await response.json();
  const version = String(manifest?.version || "");
  const url = String(manifest?.url || "");
  if (!version || !url) throw new Error("manifesto sem version/url");

  if (compareVersions(version, AGENT_VERSION) <= 0) {
    log.debug(`Agente ja esta atualizado (${AGENT_VERSION}).`);
    return;
  }

  const { pending } = paths();
  if (existsSync(pending)) {
    log.debug("Atualizacao ja baixada, aguardando o proximo arranque.");
    return;
  }

  log.info(`Baixando a versao ${version} do agente...`);
  const binary = await fetch(url);
  if (!binary.ok) throw new Error(`download respondeu ${binary.status}`);
  await writeFile(pending, Buffer.from(await binary.arrayBuffer()));
  log.info(`Versao ${version} baixada. Sera aplicada no proximo arranque do agente.`);
}

export function startUpdateChecks(): void {
  if (!isPackaged()) return;
  const check = () => void downloadUpdate().catch((err) => log.debug("Verificacao de atualizacao falhou:", err));
  setTimeout(check, 60000);
  setInterval(check, CHECK_INTERVAL_MS);
}
