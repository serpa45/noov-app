import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const isWindows = process.platform === "win32";

/**
 * Porta serial: cobre impressoras USB que aparecem como COM e tambem
 * impressoras Bluetooth pareadas no Windows, que ganham uma porta COM de saida
 * do tipo "Standard Serial over Bluetooth link".
 *
 * No Windows a porta e aberta como arquivo (`\\.\COM3`) depois de configurada
 * pelo comando `mode`. Isso evita o modulo nativo `serialport`, que nao
 * sobrevive ao empacotamento em executavel unico.
 */

function normalizePort(path: string): string {
  const name = path.replace(/^\\\\\.\\/, "").replace(/:$/, "");
  return name.toUpperCase();
}

async function printViaWindowsComPort(path: string, baudRate: number, data: Uint8Array): Promise<void> {
  const port = normalizePort(path);
  try {
    await run(
      "cmd.exe",
      ["/c", "mode", `${port}:`, `BAUD=${baudRate}`, "PARITY=n", "DATA=8", "STOP=1", "xon=off", "odsr=off", "octs=off", "rts=on", "dtr=on"],
      { windowsHide: true, timeout: 15000 },
    );
  } catch (err: any) {
    throw new Error(`Nao foi possivel configurar a porta ${port}: ${String(err?.stderr || err?.message || err).trim()}`);
  }

  try {
    await writeFile(`\\\\.\\${port}`, Buffer.from(data));
  } catch (err: any) {
    throw new Error(`Nao foi possivel escrever na porta ${port}: ${err?.message || err}`);
  }
}

async function printViaSerialPortModule(path: string, baudRate: number, data: Uint8Array): Promise<void> {
  let SerialPort: any;
  try {
    const mod: any = await import("serialport");
    SerialPort = mod.SerialPort ?? mod.default?.SerialPort;
    if (!SerialPort) throw new Error("export SerialPort ausente");
  } catch (err: any) {
    throw new Error(`Transporte serial indisponivel: instale "serialport" (${err?.message || err})`);
  }

  const port = new SerialPort({ path, baudRate, autoOpen: false });
  await new Promise<void>((resolve, reject) => port.open((e: Error | null) => (e ? reject(e) : resolve())));
  try {
    await new Promise<void>((resolve, reject) =>
      port.write(Buffer.from(data), (e: Error | null | undefined) => (e ? reject(e) : resolve())),
    );
    await new Promise<void>((resolve, reject) =>
      port.drain((e: Error | null | undefined) => (e ? reject(e) : resolve())),
    );
  } finally {
    await new Promise<void>((resolve) => port.close(() => resolve()));
  }
}

export async function printViaSerial(path: string, baudRate: number, data: Uint8Array): Promise<void> {
  if (isWindows) return printViaWindowsComPort(path, baudRate, data);
  return printViaSerialPortModule(path, baudRate, data);
}

export async function listSerialPorts(): Promise<Array<{ path: string; label: string }>> {
  try {
    if (isWindows) {
      const { stdout } = await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | Select-Object -ExpandProperty Name",
        ],
        { windowsHide: true, timeout: 20000 },
      );
      return stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label) => ({ path: label.match(/\((COM\d+)\)/)?.[1] ?? label, label }));
    }

    const mod: any = await import("serialport");
    const SerialPort = mod.SerialPort ?? mod.default?.SerialPort;
    const ports = await SerialPort.list();
    return ports.map((p: any) => ({
      path: p.path,
      label: [p.manufacturer, p.friendlyName || p.pnpId].filter(Boolean).join(" ") || p.path,
    }));
  } catch {
    return [];
  }
}
