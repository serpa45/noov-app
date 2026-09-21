import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata número de telefone brasileiro:
 * - 11 dígitos (celular): (XX) XXXXX-XXXX
 * - 10 dígitos (fixo): (XX) XXXX-XXXX
 * - Com DDI 55 removido automaticamente
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

/**
 * Aplica máscara progressiva enquanto o usuário digita o telefone.
 * Limita a 11 dígitos e formata como (XX) XXXXX-XXXX.
 */
export function maskPhoneInput(value: string): string {
  const d = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
