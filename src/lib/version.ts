/**
 * Versionamento do sistema.
 *
 * Formato: MAJOR.MINOR.DDYY (ex.: 1.2.0726 = versão 1.2 publicada dia 07 do ano 2026).
 *
 * - MAJOR/MINOR são incrementados automaticamente a cada `vite build` (publicação):
 *   o plugin em vite.config.ts chama a RPC `bump_app_version` no backend,
 *   que avança MINOR em +1 (rolando para o próximo MAJOR quando passa de 5)
 *   e devolve os valores atuais, injetados no bundle via `define`.
 * - DDYY é a data do build (dia do mês + dois últimos dígitos do ano).
 * - Os fallbacks abaixo são usados em dev, quando o Supabase não é consultado.
 */

declare const __APP_MAJOR__: number | null;
declare const __APP_MINOR__: number | null;
declare const __BUILD_DAY__: number | undefined;
declare const __BUILD_YEAR__: number | undefined;

const FALLBACK_MAJOR = 1;
const FALLBACK_MINOR = 1;

const injectedMajor = typeof __APP_MAJOR__ !== "undefined" ? __APP_MAJOR__ : null;
const injectedMinor = typeof __APP_MINOR__ !== "undefined" ? __APP_MINOR__ : null;

export const APP_MAJOR = injectedMajor != null ? injectedMajor : FALLBACK_MAJOR;
export const APP_MINOR = injectedMinor != null ? injectedMinor : FALLBACK_MINOR;

const now = new Date();
const brParts = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  year: "numeric",
}).formatToParts(now);
const brDay = Number(brParts.find((p) => p.type === "day")?.value ?? now.getDate());
const brYear = Number(brParts.find((p) => p.type === "year")?.value ?? now.getFullYear());

const buildDay = typeof __BUILD_DAY__ !== "undefined" && __BUILD_DAY__ != null ? __BUILD_DAY__ : brDay;
const buildYear = typeof __BUILD_YEAR__ !== "undefined" && __BUILD_YEAR__ != null ? __BUILD_YEAR__ : brYear % 100;

const pad2 = (n: number) => String(n).padStart(2, "0");

export const APP_VERSION = `${APP_MAJOR}.${APP_MINOR}.${pad2(buildDay)}${pad2(buildYear)}`;
