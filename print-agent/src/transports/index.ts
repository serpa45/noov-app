import type { PrinterConfig } from "../config.js";
import { printViaNetwork } from "./network.js";
import { printViaSerial } from "./serial.js";
import { printViaSpooler } from "./spooler.js";

export { listSerialPorts } from "./serial.js";
export { listSpoolerPrinters } from "./spooler.js";

export async function sendBytes(printer: PrinterConfig, data: Uint8Array, docName: string): Promise<void> {
  switch (printer.transport) {
    case "network":
      return printViaNetwork(printer.address, printer.port, data);
    case "serial":
      return printViaSerial(printer.address, printer.baudRate, data);
    case "spooler":
      return printViaSpooler(printer.address, data, docName);
    default:
      throw new Error(`Transporte desconhecido: ${printer.transport}`);
  }
}
