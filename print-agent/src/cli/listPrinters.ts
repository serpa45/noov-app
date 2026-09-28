import { listSerialPorts, listSpoolerPrinters } from "../transports/index.js";

const spooler = await listSpoolerPrinters();
console.log("\nImpressoras instaladas no sistema (transport: \"spooler\")");
if (spooler.length) spooler.forEach((name) => console.log(`  - ${name}`));
else console.log("  nenhuma encontrada");

const serial = await listSerialPorts();
console.log("\nPortas COM / Bluetooth pareado (transport: \"serial\")");
if (serial.length) serial.forEach((p) => console.log(`  - ${p.path}  (${p.label})`));
else console.log("  nenhuma encontrada (ou o pacote serialport nao esta instalado)");

console.log("\nPara impressora de rede use transport \"network\" com o IP dela e porta 9100.\n");
