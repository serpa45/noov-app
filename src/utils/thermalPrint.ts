/**
 * ESC/POS Thermal Printer via WebUSB
 * Falls back to window.print() if WebUSB is unavailable
 */

import { formatPhone } from "@/lib/utils";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// ESC/POS commands
const INIT = [ESC, 0x40]; // Initialize printer
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const CENTER = [ESC, 0x61, 0x01];
const LEFT = [ESC, 0x61, 0x00];
const CUT = [GS, 0x56, 0x00]; // Full cut
const COMPACT_SIZE = [ESC, 0x21, 0x01];
const NORMAL_SIZE = [ESC, 0x21, 0x00];

function textToBytes(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

function line(text: string): number[] {
  return [...textToBytes(text), LF];
}

function dashedLine(): number[] {
  return line("--------------------------------");
}

function doubleLine(): number[] {
  return line("================================");
}

function itemLine(): number[] {
  return line("- - - - - - - - - - - - - - - -");
}

function blank(): number[] {
  return [LF];
}

// Cabeçalho de seção destacado:
// ==========================================
//             TITULO
// ==========================================
function sectionHeader(title: string): number[] {
  const bytes: number[] = [];
  bytes.push(...dashedLine());
  bytes.push(...CENTER, ...BOLD_ON);
  bytes.push(...line(title.toUpperCase()));
  bytes.push(...BOLD_OFF, ...LEFT);
  bytes.push(...dashedLine());
  return bytes;
}

export interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storeDocument?: string;
  orderNumber: string;
  orderIdShort?: string;
  date: string;
  type: string;
  clientName: string;
  clientPhone?: string;
  clientDocument?: string;
  clientAddress?: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    unit_price?: number;
    obs?: string;
    extras?: any[];
    sabores?: string[];
    quantidade_sabores?: number;
    caldo_sabor?: { nome: string; valorExtra: number } | null;

    tamanho?: string;
    bordas?: string[];
    quantidade_bordas?: number;
    gratis_ate?: number;
    weight?: string;
    unidade_medida?: string;
  }>;
  observations?: string;
  subtotal?: number;
  taxaServico?: number;
  taxaEntrega?: number;
  total: number;
  paymentMethod?: string;
  changeAmount?: number;
  trocoPara?: number;
  cupomCodigo?: string;
  cupomTipo?: string;
  cupomDesconto?: number;
  isCancelled?: boolean;
}

interface ReceiptBuildOptions {
  textSize?: "small" | "normal" | "large";
  paperWidth?: 58 | 80;
}

// ---- Helpers de layout (alinhamento estilo recibo detalhado) ----
const COLS_58 = 32;
const COLS_80 = 48;

function padBetween(left: string, right: string, width: number): string {
  const l = String(left ?? "");
  const r = String(right ?? "");
  if (l.length + r.length >= width) {
    return l.slice(0, Math.max(0, width - r.length - 1)) + " " + r;
  }
  return l + " ".repeat(width - l.length - r.length) + r;
}

function wrapText(text: string, width: number, indent = 0): string[] {
  const out: string[] = [];
  const ind = " ".repeat(indent);
  const usable = Math.max(1, width - indent);
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  let cur = "";
  for (const w of words) {
    if (!cur.length) {
      cur = w.length > usable ? w.slice(0, usable) : w;
      continue;
    }
    if (cur.length + 1 + w.length <= usable) {
      cur += " " + w;
    } else {
      out.push(ind + cur);
      cur = w.length > usable ? w.slice(0, usable) : w;
    }
  }
  if (cur.length) out.push(ind + cur);
  return out.length ? out : [ind];
}

function brl(v: number): string {
  return `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;
}

export function buildReceiptBytes(data: ReceiptData, options: ReceiptBuildOptions = {}): Uint8Array {
  const bytes: number[] = [];
  const isSmallText = options.textSize === "small";
  const baseTextMode = isSmallText ? COMPACT_SIZE : NORMAL_SIZE;
  const WIDTH = options.paperWidth === 80 ? COLS_80 : COLS_58;
  const sepDashed = "-".repeat(WIDTH);
  const sepDouble = "=".repeat(WIDTH);
  const sepDotted = (() => {
    let s = "";
    for (let i = 0; i < WIDTH; i++) s += i % 2 === 0 ? "-" : " ";
    return s;
  })();

  // Init
  bytes.push(...INIT);
  if (isSmallText) {
    bytes.push(0x0f, ...COMPACT_SIZE, 0x1d, 0x21, 0x00, ESC, 0x20, 0x00);
  }

  // ===== CABEÇALHO DA LOJA =====
  bytes.push(...CENTER, ...BOLD_ON);
  const cleanStoreName = String(data.storeName || "Loja")
    .replace(/[^\p{L}\p{N}\s&'.-]/gu, "")
    .trim()
    .toUpperCase() || "LOJA";
  bytes.push(...line(cleanStoreName));
  bytes.push(...BOLD_OFF, ...baseTextMode);
  if (data.storeAddress) {
    for (const ln of wrapText(data.storeAddress, WIDTH)) bytes.push(...line(ln));
  }
  if (data.storeDocument) {
    bytes.push(...line(`CNPJ/CPF: ${data.storeDocument}`));
  }
  bytes.push(...line("Documento Auxiliar - Nao Fiscal"));
  bytes.push(...LEFT);
  bytes.push(...line(sepDashed));

  // ===== PEDIDO =====
  bytes.push(...CENTER, ...BOLD_ON);
  bytes.push(...line(`PEDIDO N ${data.orderNumber}`));
  bytes.push(...BOLD_OFF, ...LEFT);
  bytes.push(...line(`Emissao: ${data.date}`));
  bytes.push(...line(`Tipo: ${String(data.type).toUpperCase()}`));
  if (data.orderIdShort) bytes.push(...line(`ID: ${data.orderIdShort}`));
  bytes.push(...line(sepDashed));

  // ===== CLIENTE =====
  bytes.push(...BOLD_ON);
  bytes.push(...line("DADOS DO CLIENTE"));
  bytes.push(...BOLD_OFF);
  bytes.push(...line(`Nome: ${data.clientName || "CONSUMIDOR FINAL"}`));
  if (data.clientPhone) bytes.push(...line(`Tel: ${formatPhone(data.clientPhone)}`));
  if (data.clientDocument) bytes.push(...line(`CPF/CNPJ: ${data.clientDocument}`));
  const ehRetirada = !data.clientAddress
    || /retirada\s+no\s+local|retirada\s+no\s+balc[ãa]o/i.test(String(data.clientAddress))
    || ["retirada", "balcao", "balcão", "pickup"].includes(String(data.type || "").toLowerCase());
  if (!ehRetirada && data.clientAddress) {
    for (const ln of wrapText(`Endereco: ${data.clientAddress}`, WIDTH)) bytes.push(...line(ln));
  }
  bytes.push(...line(sepDashed));

  // ===== ITENS — cabeçalho colunar =====
  // DESCRICAO | QT | UNIT | TOTAL
  const qtW = 3, unitW = 7, totalW = 8;
  const descW = WIDTH - qtW - unitW - totalW - 2; // 2 espaços de respiro
  bytes.push(...BOLD_ON);
  bytes.push(...line(
    "DESCRICAO".padEnd(descW) +
    " " + "QT".padStart(qtW) +
    " " + "UNIT".padStart(unitW) +
    "TOTAL".padStart(totalW)
  ));
  bytes.push(...BOLD_OFF);
  bytes.push(...line(sepDashed));

  data.items.forEach((item, idx) => {
    const gratisAte = item.gratis_ate || 0;
    const addons = (item.extras || []).map((ext, i) => {
      if (ext && typeof ext === "object") {
        const eAny = ext as any;
        const aQty = Math.max(1, Number(eAny.quantidade) || 1);
        return { nome: eAny.nome || String(ext), preco: Number(eAny.preco) || 0, quantidade: aQty, isFree: i < gratisAte || Number(eAny.preco) === 0 };
      }
      return { nome: String(ext), preco: 0, quantidade: 1, isFree: true };
    });
    const addonsTotal = addons.reduce((s, a) => s + (a.isFree ? 0 : a.preco * a.quantidade), 0);
    const basePrice = Number(item.unit_price ?? item.price) || 0;
    const baseOnly = item.unit_price !== undefined ? basePrice : Math.max(basePrice - addonsTotal, 0);
    let unitTotal = Number(item.price) || 0;
    if (item.unit_price === undefined && addonsTotal > 0 && unitTotal === baseOnly) {
      unitTotal = baseOnly + addonsTotal;
    }
    const itemTotal = unitTotal * item.qty;
    const hasExtras = addons.length > 0 || (item.bordas && item.bordas.length > 0);

    // Linha principal: nome (multi-linhas se preciso) com qt/unit/total na primeira linha
    const nameLines = wrapText(item.name, descW);
    const head = nameLines.shift() || item.name;
    bytes.push(...line(
      head.padEnd(descW) +
      " " + (String(item.qty) + "x").padStart(qtW) +
      " " + baseOnly.toFixed(2).padStart(unitW) +
      (baseOnly * item.qty).toFixed(2).padStart(totalW)
    ));
    for (const ln of nameLines) bytes.push(...line(ln));

    if (item.tamanho) bytes.push(...line(`  Tam: ${item.tamanho}`));
    if (item.weight && item.unidade_medida === "kg") {
      bytes.push(...line(`  Peso: ${item.weight}g`));
    }
    if (item.sabores?.length) {
      const q = item.quantidade_sabores || item.sabores.length;
      for (const ln of wrapText(`Sab (${q}): ${item.sabores.join(" / ")}`, WIDTH, 2)) bytes.push(...line(ln));
    }
    if (item.caldo_sabor?.nome) {
      const extra = Number(item.caldo_sabor.valorExtra || 0);
      bytes.push(...line(`  Sabor: ${item.caldo_sabor.nome}${extra > 0 ? ` (+${brl(extra)})` : ""}`));
    }
    if (item.bordas?.length) {
      const q = item.quantidade_bordas || item.bordas.length;
      for (const ln of wrapText(`Bor (${q}): ${item.bordas.join(", ")}`, WIDTH, 2)) bytes.push(...line(ln));
    }
    for (const add of addons) {
      const label = add.quantidade > 1 ? `+ ${add.nome} x${add.quantidade}` : `+ ${add.nome}`;
      const lineTotal = add.preco * add.quantidade;
      const priceLabel = add.isFree ? "Gratis" : lineTotal.toFixed(2);
      const labelLines = wrapText(label, WIDTH - priceLabel.length - 3, 2);
      const first = labelLines.shift() || label;
      bytes.push(...line(padBetween(first, priceLabel, WIDTH)));
      for (const ln of labelLines) bytes.push(...line(ln));
    }
    if (item.obs) {
      for (const ln of wrapText(`Obs: ${item.obs}`, WIDTH, 2)) bytes.push(...line(ln));
    }
    if (hasExtras) {
      bytes.push(...line(padBetween("  Subtotal:", brl(itemTotal), WIDTH)));
    }
    if (idx < data.items.length - 1) bytes.push(...line(sepDotted));
  });

  bytes.push(...line(sepDashed));

  // ===== TOTAIS =====
  bytes.push(...line(padBetween("Qtd. total de itens", String(data.items.length), WIDTH)));
  if (data.subtotal !== undefined) {
    bytes.push(...line(padBetween("Valor total", brl(data.subtotal), WIDTH)));
  }
  if (data.taxaEntrega !== undefined && data.taxaEntrega > 0) {
    if (data.cupomTipo === 'frete_gratis') {
      bytes.push(...line(padBetween("Taxa de entrega", "Grátis (Cupom)", WIDTH)));
    } else {
      bytes.push(...line(padBetween("Taxa de entrega", brl(data.taxaEntrega), WIDTH)));
    }
  }
  if (data.taxaServico !== undefined && data.taxaServico > 0) {
    bytes.push(...line(padBetween("Taxa de servico", brl(data.taxaServico), WIDTH)));
  }
  if (data.cupomDesconto !== undefined && data.cupomDesconto > 0) {
    const cupomLabel = data.cupomCodigo ? ` (Cupom: ${data.cupomCodigo})` : "";
    const pricePart = data.cupomTipo === 'frete_gratis' ? "" : `-${brl(data.cupomDesconto)}`;
    bytes.push(...line(padBetween(`Desconto${cupomLabel}`, pricePart, WIDTH)));
  }
  bytes.push(...line(sepDouble));
  bytes.push(...BOLD_ON);
  bytes.push(...line(padBetween("VALOR A PAGAR", brl(data.total), WIDTH)));
  bytes.push(...BOLD_OFF);
  bytes.push(...line(sepDashed));

  // ===== FORMA DE PAGAMENTO =====
  if (data.paymentMethod) {
    bytes.push(...BOLD_ON);
    bytes.push(...line("FORMA DE PAGAMENTO"));
    bytes.push(...BOLD_OFF);
    bytes.push(...line(data.paymentMethod.split('|')[0].trim().toUpperCase()));
    if (data.trocoPara && data.trocoPara > 0) {
      bytes.push(...line(padBetween("Troco para:", brl(data.trocoPara), WIDTH)));
      if (data.trocoPara > data.total) {
        bytes.push(...line(padBetween("TROCO:", brl(data.trocoPara - data.total), WIDTH)));
      }
    } else if (data.changeAmount && data.changeAmount > 0) {
      bytes.push(...line(padBetween("TROCO:", brl(data.changeAmount), WIDTH)));
    }
    bytes.push(...line(sepDashed));
  }

  if (data.observations) {
    bytes.push(...BOLD_ON);
    bytes.push(...line("OBSERVACOES"));
    bytes.push(...BOLD_OFF);
    for (const ln of wrapText(data.observations, WIDTH)) bytes.push(...line(ln));
    bytes.push(...line(sepDashed));
  }

  // ===== RODAPÉ =====
  bytes.push(...CENTER, ...BOLD_ON);
  bytes.push(...line("AGRADECEMOS A PREFERENCIA"));
  bytes.push(...BOLD_OFF);
  bytes.push(...line("Sistema de Gestao NOOV"));
  bytes.push(...LEFT);

  // Feed and cut
  bytes.push(LF, LF, LF);
  bytes.push(0x12, ...NORMAL_SIZE);
  bytes.push(...CUT);

  return new Uint8Array(bytes);
}

let cachedDevice: any = null;

async function connectPrinter(): Promise<any> {
  if (cachedDevice) {
    try {
      await cachedDevice.open();
      return cachedDevice;
    } catch {
      cachedDevice = null;
    }
  }

  try {
    const nav = navigator as any;
    const device = await nav.usb.requestDevice({
      filters: [] // Accept any USB device
    });
    cachedDevice = device;
    return device;
  } catch {
    return null;
  }
}

export async function printThermal(data: ReceiptData): Promise<boolean> {
  // Check WebUSB support
  if (!("usb" in (navigator as any))) {
    console.log("WebUSB not available, falling back to window.print()");
    return false;
  }

  try {
    const device = await connectPrinter();
    if (!device) return false;

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);

    const receiptBytes = buildReceiptBytes(data);

    // Find the OUT endpoint
    const iface = device.configuration!.interfaces[0];
    const alternate = iface.alternates[0];
    const endpoint = alternate.endpoints.find(e => e.direction === "out");

    if (endpoint) {
      await device.transferOut(endpoint.endpointNumber, receiptBytes);
    } else {
      // Try control transfer as fallback
      await device.controlTransferOut(
        { requestType: "class", recipient: "interface", request: 0x09, value: 0x0200, index: 0 },
        receiptBytes
      );
    }

    await device.close();
    return true;
  } catch (err) {
    console.error("Thermal print error:", err);
    return false;
  }
}

export function buildReceiptData(order: any, loja: any, orderNumStr: string): ReceiptData {
  const items = Array.isArray(order.items)
    ? order.items.map((i: any) => {
        const qty = Number(i.qtd || i.quantity || i.quantidade) || 1;
        const basePrice = Number(i.unit_price ?? i.preco ?? i.price) || 0;
        const adds = Array.isArray(i.adicionais || i.addons) ? (i.adicionais || i.addons) : [];
        const addonsTotal = adds.reduce((s: number, a: any) => {
          if (!a || typeof a !== "object") return s;
          const aQty = Math.max(1, Number(a?.quantidade) || 1);
          return s + (Number(a?.preco) || 0) * aQty;
        }, 0);
        let unitTotal = Number(i.preco || i.price) || 0;
        if (i.unit_price === undefined && addonsTotal > 0 && unitTotal === basePrice) {
          unitTotal = basePrice + addonsTotal;
        }
        return {
          name: i.nome || i.name || "Item",
          qty,
          price: unitTotal,
          unit_price: i.unit_price !== undefined ? Number(i.unit_price) : undefined,
          obs: i.observacao,
          extras: adds,
          sabores: i.sabores,
          quantidade_sabores: i.quantidade_sabores,
          caldo_sabor: i.caldo_sabor || null,
          tamanho: i.tamanho,
          bordas: i.bordas,
          quantidade_bordas: i.quantidade_bordas,
          gratis_ate: i.gratis_ate,
          weight: i.weight,
          unidade_medida: i.unidade_medida,
        };
      })
    : [];

  const obs = order.observacoes || "";
  const paymentMatch = obs.match(/Pagamento:\s*([^|\n]+)/i);
  const payment = paymentMatch ? paymentMatch[1].trim() : (order.forma_pagamento || order.payment_method);
  
  // Extração de troco_para das observações se não estiver no campo direto
  let trocoPara = Number(order.troco_para || 0);
  if (!trocoPara && obs) {
    const trocoMatch = obs.match(/Troco\s+para:\s*R\$\s*([\d,.]+)/i);
    if (trocoMatch) {
      trocoPara = Number(trocoMatch[1].replace(".", "").replace(",", "."));
    }
  }
  const trocoParaFinal = trocoPara || undefined;

  const subtotalCalc = items.reduce((s, it: any) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

  const enderecoLoja = [
    loja?.endereco_rua,
    loja?.endereco_numero,
    loja?.endereco_bairro,
    loja?.endereco_cidade && loja?.endereco_estado
      ? `${loja.endereco_cidade}/${loja.endereco_estado}`
      : null,
  ].filter(Boolean).join(", ");

  const clientAddress = order.endereco_entrega || order.cliente_endereco_completo || undefined;

  return {
    storeName: loja?.nome || "Loja",
    storeAddress: enderecoLoja || undefined,
    storeDocument: loja?.documento || undefined,
    orderNumber: orderNumStr,
    orderIdShort: typeof order.id === "string" ? order.id.split("-")[0].toUpperCase() : undefined,
    date: new Date(order.created_at).toLocaleString("pt-BR"),
    type: order.tipo || "delivery",
    clientName: (order.cliente_nome || "CONSUMIDOR FINAL").replace(/^PDV\s+Mesa/i, "Mesa"),
    clientPhone: order.cliente_telefone || undefined,
    clientDocument: order.cliente_documento || undefined,
    clientAddress,
    items,
    subtotal: subtotalCalc,
    taxaEntrega: Number(order.taxa_entrega || 0) || undefined,
    taxaServico: Number(order.taxa_servico || 0) || undefined,
    total: Number(order.total || 0),
    paymentMethod: payment,
    trocoPara: trocoParaFinal,
    cupomCodigo: order.cupom_codigo,
    cupomTipo: order.cupom_tipo,
    cupomDesconto: Number(order.cupom_desconto || 0) || undefined,
    isCancelled: order.status === "cancelado",
  };
}

// ===== KITCHEN TICKET (cozinha) =====
// Ticket enxuto: nº pedido, hora, itens + quantidade (com adicionais e observação).
export interface KitchenTicketItem {
  name: string;
  qty: number;
  obs?: string;
  extras?: Array<{ nome?: string; quantidade?: number } | string>;
  sabores?: string[];
  tamanho?: string;
}

export interface KitchenTicketData {
  orderNumber: string;
  date?: string;
  mesaNome?: string;
  garcomNome?: string;
  items: KitchenTicketItem[];
}

export function buildKitchenBytes(data: KitchenTicketData, options: ReceiptBuildOptions = {}): Uint8Array {
  const bytes: number[] = [];
  const WIDTH = options.paperWidth === 80 ? COLS_80 : COLS_58;
  const sepDashed = "-".repeat(WIDTH);

  bytes.push(...INIT);
  bytes.push(...CENTER, ...BOLD_ON);
  bytes.push(...line("** COZINHA **"));
  bytes.push(...line(`PEDIDO N ${data.orderNumber}`));
  bytes.push(...BOLD_OFF, ...LEFT);
  if (data.date) bytes.push(...line(`Hora: ${data.date}`));
  if (data.mesaNome) bytes.push(...line(`Mesa: ${data.mesaNome}`));
  if (data.garcomNome) bytes.push(...line(`Garcom: ${data.garcomNome}`));
  bytes.push(...line(sepDashed));

  bytes.push(...BOLD_ON);
  bytes.push(...line(`ITENS·${data.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)}`));
  bytes.push(...BOLD_OFF);
  bytes.push(...line(sepDashed));

  for (const it of data.items) {
    const qtyStr = `${it.qty}x `;
    const nameLines = wrapText(qtyStr + (it.name || "Item"), WIDTH);
    bytes.push(...BOLD_ON);
    for (const ln of nameLines) bytes.push(...line(ln));
    bytes.push(...BOLD_OFF);
    if (it.tamanho) bytes.push(...line(`  Tam: ${it.tamanho}`));
    if (it.sabores?.length) {
      for (const ln of wrapText(`Sab: ${it.sabores.join(" / ")}`, WIDTH, 2)) bytes.push(...line(ln));
    }
    if (it.extras?.length) {
      for (const ex of it.extras) {
        const nome = typeof ex === "string" ? ex : (ex?.nome || "");
        const q = typeof ex === "object" ? Math.max(1, Number(ex?.quantidade) || 1) : 1;
        if (!nome) continue;
        const lbl = q > 1 ? `+ ${nome} x${q}` : `+ ${nome}`;
        for (const ln of wrapText(lbl, WIDTH, 2)) bytes.push(...line(ln));
      }
    }
    if (it.obs) {
      for (const ln of wrapText(`Obs: ${it.obs}`, WIDTH, 2)) bytes.push(...line(ln));
    }
    bytes.push(LF);
  }

  bytes.push(...line(sepDashed));
  bytes.push(LF, LF, LF, LF);
  bytes.push(...CUT);
  return new Uint8Array(bytes);
}


