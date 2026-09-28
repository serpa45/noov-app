/**
 * Substitui `@/lib/utils` quando o ESC/POS do app roda fora do navegador.
 * Mantem apenas o que `src/utils/thermalPrint.ts` consome, evitando arrastar
 * clsx/tailwind-merge para dentro do agente.
 */

export function formatPhone(value?: string | null): string {
  if (!value) return "";
  let digits = String(value).replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return String(value);
}
