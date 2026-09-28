import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const script = resolve(root, "dist", "agent.cjs");

if (process.platform !== "win32") {
  console.error("A instalacao como servico so esta disponivel no Windows.");
  process.exit(1);
}

if (!existsSync(script)) {
  console.error('Build nao encontrado. Rode "npm run build" antes de instalar o servico.');
  process.exit(1);
}

if (!existsSync(resolve(root, "config.json"))) {
  console.error("config.json nao encontrado. Copie config.example.json e preencha os dados.");
  process.exit(1);
}

const { Service } = await import("node-windows");

const svc = new Service({
  name: "NOOV Print Agent",
  description: "Imprime automaticamente os pedidos aceitos no NOOV (balcao e cozinha).",
  script,
  workingDirectory: root,
  env: [{ name: "NOOV_AGENT_HOME", value: root }],
  wait: 2,
  grow: 0.5,
  maxRestarts: 40,
});

svc.on("install", () => {
  console.log("Servico instalado. Iniciando...");
  svc.start();
});
svc.on("alreadyinstalled", () => console.log("O servico ja estava instalado."));
svc.on("start", () => console.log('Servico "NOOV Print Agent" em execucao.'));
svc.on("error", (err) => console.error("Erro no servico:", err));

svc.install();
