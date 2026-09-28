import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { agentHome, isPackaged } from "./config.js";
import { log } from "./logger.js";

const run = promisify(execFile);

const ENTRY_NAME = "NOOV Print Agent";
// Chave de inicializacao do proprio usuario: nao exige privilegio de
// administrador, ao contrario do Agendador de Tarefas e dos servicos.
const RUN_KEY = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const isWindows = process.platform === "win32";

function launcherPath(): string {
  return resolve(agentHome(), "iniciar-oculto.vbs");
}

/**
 * O executavel e um app de console: chamado direto pela inicializacao do
 * Windows ele abriria uma janela preta na cara do operador. Este lancador em
 * VBScript sobe o agente sem janela nenhuma.
 */
function writeLauncher(): string {
  const exe = process.execPath.replace(/"/g, '""');
  const script = ['Set sh = CreateObject("WScript.Shell")', `sh.Run """${exe}"" --background", 0, False`, ""].join("\r\n");
  const path = launcherPath();
  writeFileSync(path, script, "latin1");
  return path;
}

/** Aspas simples em PowerShell sao escapadas dobrando-as. */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function powershell(command: string): Promise<string> {
  const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    windowsHide: true,
    timeout: 20000,
  });
  return stdout;
}

export function autostartSupported(): boolean {
  return isWindows && isPackaged();
}

export async function isAutostartEnabled(): Promise<boolean> {
  if (!isWindows) return false;
  try {
    const out = await powershell(
      `(Get-ItemProperty -Path ${psQuote(RUN_KEY)} -ErrorAction SilentlyContinue).${psQuote(ENTRY_NAME)}`,
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export async function enableAutostart(): Promise<void> {
  if (!autostartSupported()) {
    throw new Error("A inicializacao automatica so esta disponivel no executavel do Windows.");
  }
  const value = `wscript.exe "${writeLauncher()}"`;
  await powershell(
    `Set-ItemProperty -Path ${psQuote(RUN_KEY)} -Name ${psQuote(ENTRY_NAME)} -Value ${psQuote(value)} -Force`,
  );
  log.info("Inicializacao automatica com o Windows ativada.");
}

export async function disableAutostart(): Promise<void> {
  if (!isWindows) return;
  try {
    await powershell(
      `Remove-ItemProperty -Path ${psQuote(RUN_KEY)} -Name ${psQuote(ENTRY_NAME)} -ErrorAction SilentlyContinue`,
    );
    log.info("Inicializacao automatica desativada.");
  } catch (err) {
    log.warn("Nao foi possivel remover a inicializacao automatica.", err);
  }
}
