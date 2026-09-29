import type { AgentConfig } from "./config.js";
import { log } from "./logger.js";
import { connect, type Session } from "./supabase.js";
import { startWatching, type StopWatching } from "./watcher.js";

export interface RuntimeStatus {
  configured: boolean;
  connected: boolean;
  lojaNome: string | null;
  lastError: string | null;
  startedAt: string | null;
}

let config: AgentConfig | null = null;
let session: Session | null = null;
let stop: StopWatching | null = null;
let lastError: string | null = null;
let startedAt: string | null = null;
let retryTimer: NodeJS.Timeout | null = null;

const RETRY_DELAY_MS = 20000;

export function currentConfig(): AgentConfig | null {
  return config;
}

export function currentSession(): Session | null {
  return session;
}

export function status(): RuntimeStatus {
  return {
    configured: Boolean(config),
    connected: Boolean(session && stop),
    lojaNome: session?.loja?.nome ?? null,
    lastError,
    startedAt,
  };
}

async function teardown(): Promise<void> {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (stop) {
    await stop().catch(() => {});
    stop = null;
  }
  if (session) {
    await session.client.auth.signOut().catch(() => {});
    session = null;
  }
  startedAt = null;
}

/**
 * Sobe (ou re-sobe) a escuta de pedidos com a configuracao dada.
 * Falhas de rede nao derrubam o processo: o agente segue tentando em segundo
 * plano para que a tela de configuracao continue acessivel.
 */
export async function applyConfig(next: AgentConfig): Promise<void> {
  await teardown();
  config = next;
  lastError = null;

  try {
    session = await connect(next);
    stop = await startWatching(session, next);
    startedAt = new Date().toISOString();
  } catch (err: any) {
    lastError = err?.message || String(err);
    log.error("Nao foi possivel conectar:", lastError);
    session = null;
    stop = null;
    retryTimer = setTimeout(() => {
      if (config) void applyConfig(config).catch(() => {});
    }, RETRY_DELAY_MS);
    throw err;
  }
}

export async function shutdown(): Promise<void> {
  await teardown();
  config = null;
}
