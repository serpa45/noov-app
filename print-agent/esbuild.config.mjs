import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(here, "src/index.ts")],
  outfile: resolve(here, "dist/agent.cjs"),
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
  // serialport traz binario nativo e so e usado em impressoras COM/Bluetooth.
  external: ["serialport"],
  alias: {
    "@/lib/utils": resolve(here, "src/shims/app-utils.ts"),
    "@": resolve(here, "../src"),
  },
});
