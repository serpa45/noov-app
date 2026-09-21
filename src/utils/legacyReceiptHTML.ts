/**
 * Build legacy (pre-redesign) thermal receipt HTML.
 * Used as fallback for mobile printing where the new fiscal-note style
 * does not render well in the browser print dialog.
 */

import { formatPhone } from "@/lib/utils";

export function buildLegacyReceiptHTML(order: any, loja: any, orderNumStr: string): string {
  if (!order) return "";

  // Remove acentos e caracteres não-ASCII para evitar problemas de encoding
  // em diálogos de impressão de navegadores móveis (que renderizavam UTF-8
  // como caracteres CJK/chineses).
  const stripAccents = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x00-\x7F]/g, "");
  const escape = (s: any) =>
    stripAccents(String(s ?? "")).replace(
      /[<>&]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)
    );

  const items: any[] = Array.isArray(order.items)
    ? order.items.map((i: any) => (typeof i === "string" ? { nome: i, qtd: 1 } : i))
    : [];

  const formattedDate = new Date(order.created_at).toLocaleString("pt-BR");
  const endereco = [loja?.endereco_rua, loja?.endereco_numero, loja?.endereco_bairro]
    .filter(Boolean)
    .join(", ");

  const obs = order.observacoes || "";
  const paymentMatch = obs.match(/Pagamento:\s*([^|]+)/i);
  const changeMatch = obs.match(/Troco para:\s*R\$\s*([^|]+)/i);
  const payment = order.forma_pagamento || (paymentMatch ? paymentMatch[1].trim() : null);
  const changeVal = changeMatch ? changeMatch[1].trim().replace(",", ".") : null;
  const changeAmount = changeVal ? Number(changeVal) - Number(order.total || 0) : null;

  const cupomDesconto = Number(order.cupom_desconto || 0);

  const itemsHTML = items
    .map((item: any) => {
      const name = item.nome || item.name || "Item";
      const qty = Number(item.qtd || item.quantity || item.quantidade) || 1;
      const storedPrice = Number(item.preco || item.price) || 0;
      const gratisAte = Number(item.gratis_ate) || 0;
      const addons = (item.adicionais || item.addons || []).map((a: any, idx: number) => {
        if (typeof a === "string") return { nome: a, preco: 0, quantidade: 1, isFree: idx < gratisAte };
        const aQty = Math.max(1, Number(a?.quantidade) || 1);
        return { nome: a?.nome || "", preco: Number(a?.preco) || 0, quantidade: aQty, isFree: idx < gratisAte };
      });
      const addonsTotal = addons.reduce((s: number, a: any) => s + (a.isFree ? 0 : a.preco * a.quantidade), 0);
      const basePrice = Math.max(storedPrice - addonsTotal, 0);
      const itemTotal = storedPrice * qty;

      const isKg = item.weight && (item.unidade_medida === "kg" || /quilo|kg/i.test(String(item.unidade_medida || "")));
      let html = `
        <div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between">
            <span>${qty}x ${escape(name)}${isKg ? `<br/><span style="font-size:10px;font-weight:bold">Peso: ${escape(item.weight)}g</span>` : ""}</span>
            <span>R$ ${basePrice.toFixed(2)}</span>
          </div>`;
      if (item.tamanho) html += `<p style="font-size:10px;margin:0 0 0 8px">Tam: ${escape(item.tamanho)}</p>`;

      if (item.sabores?.length)
        html += `<p style="font-size:10px;margin:0 0 0 8px">Sabores: ${escape(item.sabores.join(", "))}</p>`;
      if (item.caldo_sabor?.nome) {
        const ex = Number(item.caldo_sabor.valorExtra || 0);
        html += `<p style="font-size:10px;margin:0 0 0 8px">Sabor: ${escape(item.caldo_sabor.nome)}${ex > 0 ? ` (+R$ ${ex.toFixed(2)})` : ""}</p>`;
      }

      if (item.bordas?.length)
        html += `<p style="font-size:10px;margin:0 0 0 8px">Bordas: ${escape(item.bordas.join(", "))}</p>`;
      addons.forEach((a: any) => {
        const lineLabel = a.quantidade > 1 ? `${a.nome} x${a.quantidade}` : a.nome;
        const lineTotal = a.preco * a.quantidade;
        html += `<div style="display:flex;justify-content:space-between;margin-left:8px;font-size:10px">
          <span>+ ${escape(lineLabel)}</span>
          <span>${a.isFree ? "Gratis" : lineTotal > 0 ? `R$ ${lineTotal.toFixed(2)}` : ""}</span>
        </div>`;
      });
      if (item.observacao || item.observation)
        html += `<p style="font-size:10px;margin:0 0 0 8px">Obs: ${escape(item.observacao || item.observation)}</p>`;
      if (addons.length > 0) {
        html += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:11px;margin-left:8px;border-top:1px dotted #000;margin-top:2px">
          <span>Subtotal</span><span>R$ ${itemTotal.toFixed(2)}</span>
        </div>`;
      }
      html += `</div>`;
      return html;
    })
    .join("");

  return `
    <div style="font-family:'Courier New',monospace;color:#000;font-size:12px;line-height:1.3;max-width:300px;margin:0 auto">
      <div style="text-align:center;margin-bottom:6px">
        <p style="font-size:14px;font-weight:bold;margin:0">${escape(loja?.nome || "Loja")}</p>
        ${endereco ? `<p style="font-size:10px;margin:0">${escape(endereco)}</p>` : ""}
      </div>
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <p style="margin:0;font-weight:bold">Pedido N: ${escape(orderNumStr)}</p>
      <p style="margin:0">${escape(formattedDate)}</p>
      <p style="margin:0">Tipo: ${escape(order.tipo || "delivery")}</p>
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <p style="margin:0;font-weight:bold">Cliente: ${escape(order.cliente_nome || "-")}</p>
      ${order.cliente_telefone ? `<p style="margin:0">Tel: ${escape(formatPhone(order.cliente_telefone))}</p>` : ""}
      ${order.endereco_entrega ? `<p style="margin:0">End: ${escape(order.endereco_entrega)}</p>` : ""}
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <p style="margin:0 0 4px 0;font-weight:bold">ITENS:</p>
      ${itemsHTML}
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      ${order.observacoes ? `<p style="margin:0 0 4px 0">Obs: ${escape(order.observacoes)}</p>` : ""}
      ${
        cupomDesconto > 0
          ? `<div style="display:flex;justify-content:space-between"><span>Desconto${order.cupom_codigo ? ` (${escape(order.cupom_codigo)})` : ""}</span><span>-R$ ${cupomDesconto.toFixed(2)}</span></div>`
          : ""
      }
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px">
        <span>TOTAL</span><span>R$ ${Number(order.total || 0).toFixed(2)}</span>
      </div>
      ${payment ? `<p style="margin:4px 0 0 0">Pagamento: ${escape(payment)}</p>` : ""}
      ${
        changeAmount !== null && changeAmount > 0
          ? `<p style="margin:2px 0 0 0;font-weight:bold;font-size:11px">Troco para o cliente: R$ ${changeAmount.toFixed(2)}</p>`
          : ""
      }
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <p style="text-align:center;margin:6px 0 0 0">Obrigado pela preferencia</p>
    </div>
  `;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
}
