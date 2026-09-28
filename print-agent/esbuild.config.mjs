import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8"));

await build({
  entryPoints: [resolve(here, "src/index.ts")],
  outfile: resolve(here, "dist/agent.cjs"),
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
  // serialport traz binario nativo e so e usado fora do Windows.
  external: ["serialport"],
  define: {
    __AGENT_VERSION__: JSON.stringify(pkg.version),
  },
  // A tela de configuracao entra embutida no bundle, sem arquivos soltos.
  loader: { ".html": "text" },
  alias: {
    "@/lib/utils": resolve(here, "src/shims/app-utils.ts"),
    "@": resolve(here, "../src"),
  },
});
