import { spawn } from "node:child_process";
import { ensureInstalledCopy, refreshAutostartIfEnabled } from "./autostart.js";
import { tryLoadConfig } from "./config.js";
import { configureLogger, log } from "./logger.js";
import { applyConfig, status } from "./runtime.js";
import { startSetupServer } from "./server/http.js";
import { initState } from "./state.js";
import { AGENT_VERSION, applyPendingUpdate, startUpdateChecks } from "./updater.js";

const SETUP_URL = "http://localhost:7777";

function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    else if (process.platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    else spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Sem navegador disponivel o lojista ainda pode abrir a URL na mao.
  }
}

async function main(): Promise<void> {
  // Copia o .exe para um caminho fixo ANTES de aplicar atualizacao,
  // para o lancador do Windows nao depender da pasta Downloads.
  try {
    ensureInstalledCopy();
  } catch (err) {
    log.warn("Nao foi possivel preparar a copia instalada:", err);
  }

  if (applyPendingUpdate()) {
    process.exit(0);
  }

  try {
    await refreshAutostartIfEnabled();
  } catch (err) {
    log.warn("Nao foi possivel atualizar o lancador de inicializacao:", err);
  }

  const background = process.argv.includes("--background");
  const stored = tryLoadConfig();

  configureLogger(stored?.logLevel ?? "info");
  initState();
  log.info(`NOOV Print Agent ${AGENT_VERSION} iniciando...`);

  try {
    await startSetupServer();
  } catch (err: any) {
    if (err?.code === "EADDRINUSE") {
      // Ja existe um agente rodando: o segundo clique so abre a tela dele.
      log.info("O agente ja esta em execucao. Abrindo a tela de configuracao.");
      openBrowser(SETUP_URL);
      process.exit(0);
    }
    throw err;
  }
  log.info(`Tela de configuracao disponivel em ${SETUP_URL}`);

  if (stored) {
    await applyConfig(stored).catch(() => {
      // applyConfig ja registrou o erro e vai tentar de novo sozinho.
    });
  } else {
    log.info("Nenhuma configuracao encontrada. Abrindo a tela de configuracao.");
  }

  if (!background && (!stored || !status().connected)) openBrowser(SETUP_URL);

  startUpdateChecks();
}

process.on("unhandledRejection", (err) => log.error("Erro nao tratado:", err));
process.on("uncaughtException", (err) => log.error("Excecao nao tratada:", err));
process.on("SIGINT", () => {
  log.info("Agente encerrado.");
  process.exit(0);
});

main().catch((err) => {
  log.error("Falha ao iniciar o agente:", err);
  process.exitCode = 1;
});
