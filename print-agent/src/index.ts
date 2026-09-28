import { loadConfig } from "./config.js";
import { configureLogger, log } from "./logger.js";
import { initState } from "./state.js";
import { connect } from "./supabase.js";
import { startWatching } from "./watcher.js";

const RECONNECT_DELAY_MS = 15000;

async function main(): Promise<void> {
  const config = loadConfig();
  configureLogger(config.logLevel);
  initState();

  log.info("NOOV Print Agent iniciando...");
  for (const printer of config.printers) {
    log.info(
      `Impressora "${printer.name}": ${printer.transport} -> ${printer.address}` +
        ` | ${printer.documents.join(", ")} | ${printer.copies}x | ${printer.paperWidth}mm` +
        (printer.enabled ? "" : " (desativada)"),
    );
  }

  const session = await connect(config);
  await startWatching(session, config);
}

function start(): void {
  main().catch((err) => {
    log.error("Falha ao iniciar o agente:", err);
    log.info(`Nova tentativa em ${RECONNECT_DELAY_MS / 1000}s.`);
    setTimeout(start, RECONNECT_DELAY_MS);
  });
}

process.on("unhandledRejection", (err) => log.error("Erro nao tratado:", err));
process.on("uncaughtException", (err) => log.error("Excecao nao tratada:", err));
process.on("SIGINT", () => {
  log.info("Agente encerrado.");
  process.exit(0);
});

start();
