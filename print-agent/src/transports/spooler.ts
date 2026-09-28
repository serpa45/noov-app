import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const isWindows = process.platform === "win32";

/**
 * Envia bytes crus para uma impressora instalada no sistema.
 *
 * No Windows usa a API winspool.drv com tipo de dado RAW, que e o mesmo
 * caminho que o QZ Tray usava — porem a partir de um processo local, sem
 * certificado, assinatura ou janela de permissao no navegador.
 */
const WINDOWS_RAW_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public static class NoovRawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinterW(string src, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int StartDocPrinterW(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void Send(string printerName, string filePath, string docName)
    {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr hPrinter;
        if (!OpenPrinterW(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("Nao foi possivel abrir a impressora '" + printerName + "' (codigo " + Marshal.GetLastWin32Error() + ")");
        try
        {
            DOCINFOW di = new DOCINFOW();
            di.pDocName = docName;
            di.pDataType = "RAW";
            if (StartDocPrinterW(hPrinter, 1, di) == 0)
                throw new Exception("StartDocPrinter falhou (codigo " + Marshal.GetLastWin32Error() + ")");
            try
            {
                if (!StartPagePrinter(hPrinter))
                    throw new Exception("StartPagePrinter falhou (codigo " + Marshal.GetLastWin32Error() + ")");
                IntPtr buffer = Marshal.AllocCoTaskMem(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, buffer, bytes.Length);
                    int written;
                    if (!WritePrinter(hPrinter, buffer, bytes.Length, out written))
                        throw new Exception("WritePrinter falhou (codigo " + Marshal.GetLastWin32Error() + ")");
                }
                finally { Marshal.FreeCoTaskMem(buffer); }
                EndPagePrinter(hPrinter);
            }
            finally { EndDocPrinter(hPrinter); }
        }
        finally { ClosePrinter(hPrinter); }
    }
}
"@
[NoovRawPrinter]::Send($args[0], $args[1], $args[2])
`;

/**
 * O PowerShell devolve o stack trace inteiro no stderr; aqui fica apenas a
 * linha que descreve o problema, que e o que vai parar no log do lojista.
 */
function summarizeShellError(err: any, printerName: string): string {
  const raw = String(err?.stderr || err?.message || err);
  const detail =
    raw.match(/Nao foi possivel abrir a impressora[^"\r\n]*/)?.[0] ??
    raw.match(/(?:StartDocPrinter|StartPagePrinter|WritePrinter) falhou[^"\r\n]*/)?.[0] ??
    raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ??
    raw;
  return `Impressora "${printerName}": ${detail}`;
}

export async function printViaSpooler(printerName: string, data: Uint8Array, docName = "NOOV"): Promise<void> {
  const id = randomUUID();
  const binPath = join(tmpdir(), `noov-print-${id}.bin`);
  await writeFile(binPath, Buffer.from(data));

  const scriptPath = join(tmpdir(), `noov-print-${id}.ps1`);
  try {
    if (isWindows) {
      await writeFile(scriptPath, WINDOWS_RAW_SCRIPT, "utf8");
      await run(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, printerName, binPath, docName],
        { windowsHide: true, timeout: 30000 },
      );
    } else {
      await run("lp", ["-d", printerName, "-o", "raw", binPath], { timeout: 30000 });
    }
  } catch (err: any) {
    throw new Error(summarizeShellError(err, printerName));
  } finally {
    await unlink(binPath).catch(() => {});
    await unlink(scriptPath).catch(() => {});
  }
}

export async function listSpoolerPrinters(): Promise<string[]> {
  try {
    if (isWindows) {
      const { stdout } = await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name",
        ],
        { windowsHide: true, timeout: 20000 },
      );
      return stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    }
    const { stdout } = await run("lpstat", ["-p"], { timeout: 20000 });
    return stdout
      .split(/\r?\n/)
      .map((l) => l.match(/^printer\s+(\S+)/)?.[1])
      .filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}
