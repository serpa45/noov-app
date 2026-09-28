import {
  buildKitchenBytes,
  buildReceiptBytes,
  buildReceiptData,
  type KitchenTicketData,
} from "@/utils/thermalPrint";
import type { DocumentKind, PrinterConfig } from "./config.js";

export interface OrderRow {
  id: string;
  numero_diario?: number | null;
  created_at: string;
  status: string;
  items: any;
  [key: string]: any;
}

export function orderLabel(order: OrderRow): string {
  if (order.numero_diario != null) return String(order.numero_diario);
  return String(order.id).split("-")[0].toUpperCase();
}

function toKitchenData(order: OrderRow): KitchenTicketData {
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    orderNumber: orderLabel(order),
    date: new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    mesaNome: order.mesa_nome || undefined,
    garcomNome: order.garcom_nome || undefined,
    items: items.map((i: any) => ({
      name: i.nome || i.name || "Item",
      qty: Number(i.qtd ?? i.quantity ?? i.quantidade) || 1,
      obs: i.observacao || i.obs || undefined,
      extras: Array.isArray(i.adicionais || i.addons) ? i.adicionais || i.addons : undefined,
      sabores: i.sabores,
      tamanho: i.tamanho,
    })),
  };
}

export function buildDocument(kind: DocumentKind, order: OrderRow, loja: any, printer: PrinterConfig): Uint8Array {
  if (kind === "kitchen") {
    return buildKitchenBytes(toKitchenData(order), { paperWidth: printer.paperWidth });
  }
  const data = buildReceiptData(order, loja, orderLabel(order));
  return buildReceiptBytes(data, { paperWidth: printer.paperWidth, textSize: printer.textSize });
}
