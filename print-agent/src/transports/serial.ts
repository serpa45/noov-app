/**
 * Porta serial: cobre impressoras USB que aparecem como COM e tambem
 * impressoras Bluetooth pareadas no Windows (que ganham uma porta COM
 * de saida do tipo "Standard Serial over Bluetooth link").
 */

type SerialPortCtor = new (options: { path: string; baudRate: number; autoOpen: boolean }) => any;

let cached: SerialPortCtor | null = null;

async function loadSerialPort(): Promise<SerialPortCtor> {
  if (cached) return cached;
  try {
    const mod: any = await import("serialport");
    cached = (mod.SerialPort ?? mod.default?.SerialPort) as SerialPortCtor;
    if (!cached) throw new Error("export SerialPort ausente");
    return cached;
  } catch (err: any) {
    throw new Error(
      `Transporte serial indisponivel: instale a dependencia com "npm install serialport" (${err?.message || err})`,
    );
  }
}

export async function printViaSerial(path: string, baudRate: number, data: Uint8Array): Promise<void> {
  const SerialPort = await loadSerialPort();
  const port = new SerialPort({ path, baudRate, autoOpen: false });

  await new Promise<void>((resolve, reject) => {
    port.open((err: Error | null) => (err ? reject(err) : resolve()));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      port.write(Buffer.from(data), (err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      port.drain((err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });
  } finally {
    await new Promise<void>((resolve) => port.close(() => resolve()));
  }
}

export async function listSerialPorts(): Promise<Array<{ path: string; label: string }>> {
  try {
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
