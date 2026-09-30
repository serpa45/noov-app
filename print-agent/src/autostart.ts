import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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

/** Caminho fixo do .exe — nao muda quando o lojista baixa outra copia em Downloads. */
export function installedExePath(): string {
  return resolve(agentHome(), "noov-print-agent.exe");
}

/**
 * Garante uma copia do agente em %APPDATA%\NOOV Print Agent\.
 * O lancador automatico sempre aponta para esse arquivo, assim mover ou
 * apagar o download original nao quebra a inicializacao com o Windows.
 */
export function ensureInstalledCopy(): string {
  if (!isPackaged()) return process.execPath;

  mkdirSync(agentHome(), { recursive: true });
  const target = installedExePath();
  const current = resolve(process.execPath);

  if (current.toLowerCase() === target.toLowerCase()) return target;

  try {
    copyFileSync(current, target);
    log.info(`Copia do agente atualizada em ${target}`);
  } catch (err) {
    if (!existsSync(target)) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    log.warn("Nao foi possivel atualizar a copia instalada; usando a existente.", err);
  }
  return target;
}

/**
 * O executavel e um app de console: chamado direto pela inicializacao do
 * Windows ele abriria uma janela preta. Este lancador sobe o agente sem
 * janela e sem popup de erro se o arquivo sumir.
 */
function writeLauncher(exePath: string): string {
  const exe = exePath.replace(/"/g, '""');
  const script = [
    'On Error Resume Next',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set sh = CreateObject("WScript.Shell")',
    `exe = "${exe}"`,
    "If fso.FileExists(exe) Then",
    '  sh.Run """" & exe & """ --background", 0, False',
    "End If",
    "",
  ].join("\r\n");
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
  const exe = ensureInstalledCopy();
  const value = `wscript.exe "${writeLauncher(exe)}"`;
  await powershell(
    `Set-ItemProperty -Path ${psQuote(RUN_KEY)} -Name ${psQuote(ENTRY_NAME)} -Value ${psQuote(value)} -Force`,
  );
  log.info("Inicializacao automatica com o Windows ativada.");
}

/** Regrava o .vbs apontando para a copia instalada atual — evita o erro 80070002. */
export async function refreshAutostartIfEnabled(): Promise<void> {
  if (!autostartSupported()) return;
  if (!(await isAutostartEnabled())) return;
  try {
    await enableAutostart();
    log.info("Lancador de inicializacao atualizado.");
  } catch (err) {
    log.warn("Nao foi possivel atualizar o lancador de inicializacao.", err);
  }
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
