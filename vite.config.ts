import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Chama a RPC bump_app_version no Supabase durante o build de produção
// e retorna { major, minor } para serem injetados no bundle via `define`.
async function fetchNextVersion(url: string, anonKey: string): Promise<{ major: number; minor: number } | null> {
  try {
    const res = await fetch(`${url}/rest/v1/rpc/bump_app_version`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: "{}",
    });
    if (!res.ok) {
      console.warn("[auto-bump-version] HTTP", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.major !== "number" || typeof row.minor !== "number") return null;
    return { major: row.major, minor: row.minor };
  } catch (err) {
    console.warn("[auto-bump-version] fetch failed:", err);
    return null;
  }
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isBuild = mode !== "development";

  let injectedMajor: number | null = null;
  let injectedMinor: number | null = null;

  if (isBuild && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    const next = await fetchNextVersion(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
    if (next) {
      injectedMajor = next.major;
      injectedMinor = next.minor;
      console.log(`[auto-bump-version] bumped to v${next.major}.${next.minor}`);
    }
  }

  // Usa fuso horário de São Paulo para bater com o que o backend/UI exibe
  const brParts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const buildDay = Number(brParts.find((p) => p.type === "day")?.value ?? "1");
  const buildYear = Number(brParts.find((p) => p.type === "year")?.value ?? "2026") % 100;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean) as Plugin[],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    define: {
      __APP_MAJOR__: JSON.stringify(injectedMajor),
      __APP_MINOR__: JSON.stringify(injectedMinor),
      __BUILD_DAY__: JSON.stringify(buildDay),
      __BUILD_YEAR__: JSON.stringify(buildYear),
    },
  };
});
