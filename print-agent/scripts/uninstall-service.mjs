import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.error("A remocao do servico so esta disponivel no Windows.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const { Service } = await import("node-windows");

const svc = new Service({
  name: "NOOV Print Agent",
  script: resolve(root, "dist", "agent.cjs"),
});

svc.on("uninstall", () => console.log("Servico removido."));
svc.on("error", (err) => console.error("Erro ao remover o servico:", err));

svc.uninstall();
