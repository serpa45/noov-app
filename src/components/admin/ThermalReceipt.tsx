import React, { forwardRef } from "react";
import { Printer } from "lucide-react";
import { formatPhone } from "@/lib/utils";

interface OrderItem {
  nome?: string;
  name?: string;
  qtd?: number;
  quantity?: number;
  quantidade?: number;
  preco?: number;
  price?: number;
  observacao?: string;
  adicionais?: string[];
  sabores?: string[];
  caldo_sabor?: { nome: string; valorExtra: number } | null;

  tamanho?: string;
  bordas?: string[];
  weight?: string;
  unidade_medida?: string;
}

interface ThermalReceiptProps {
  order: any;
  loja: any;
  orderNumStr: string;
}

const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(({ order, loja, orderNumStr }, ref) => {
  if (!order) return null;

  const parseItems = (items: any): OrderItem[] => {
    if (!Array.isArray(items)) return [];
    return items.map((i: any) => (typeof i === "string" ? { nome: i, qtd: 1 } : i));
  };

  const items = parseItems(order.items);
  const formattedDate = new Date(order.created_at).toLocaleString("pt-BR");
  
  // Extração da forma de pagamento e troco das observações, se disponível
  const extractFromObs = (obs: string) => {
    if (!obs) return { payment: null, troco: null };
    const pMatch = obs.match(/Pagamento:\s*(.+)/i);
    const tMatch = obs.match(/Troco\s+para:\s*R\$\s*([\d,.]+)/i);
    return {
      payment: pMatch ? pMatch[1].trim() : null,
      troco: tMatch ? Number(tMatch[1].replace(".", "").replace(",", ".")) : null
    };
  };

  const { payment: paymentFromObs, troco: trocoFromObs } = extractFromObs(order.observacoes);
  const displayPaymentMethod = (paymentFromObs || order.forma_pagamento || order.payment_method || "DINHEIRO").toUpperCase();
  const trocoParaValue = Number(order.troco_para || trocoFromObs || 0);

  
  const subtotal = items.reduce((s, it: any) => {
    const qtd = Number(it.qtd || it.quantity || it.quantidade) || 1;
    const basePrice = Number(it.unit_price || it.preco || it.price) || 0;
    const adds = (it.adicionais || it.addons || []).map((a: any) => {
      if (typeof a !== "object") return 0;
      const aQty = Math.max(1, Number(a?.quantidade) || 1);
      return (Number(a?.preco) || 0) * aQty;
    });
    const addonsTotal = adds.reduce((sum, p) => sum + p, 0);
    
    let totalUnitPrice = Number(it.preco || it.price) || 0;
    if (!it.unit_price && addonsTotal > 0 && totalUnitPrice === basePrice) {
      totalUnitPrice = basePrice + addonsTotal;
    }
    
    return s + totalUnitPrice * qtd;
  }, 0);
  const taxa = Number(order.taxa_entrega || 0);
  const cupomDesconto = Number(order.cupom_desconto || 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const escape = (s: any) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

  const enderecoLoja = [
    loja?.endereco_rua,
    loja?.endereco_numero,
    loja?.endereco_bairro,
    loja?.endereco_cidade && loja?.endereco_estado
      ? `${loja.endereco_cidade}/${loja.endereco_estado}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Payload estruturado para a impressão Bluetooth replicar exatamente este layout
  const noovPayload = JSON.stringify({ order, loja, orderNumStr });

  return (
    <div className="bg-white text-black p-4 font-mono text-[10px] leading-tight w-full max-w-[280px] mx-auto print:shadow-none print:max-w-none print:w-[72mm] relative" style={{ boxSizing: 'border-box', overflow: 'hidden' }} ref={ref}>
      <script
        type="application/json"
        data-noov-receipt="1"
        style={{ display: 'none' }}
        dangerouslySetInnerHTML={{ __html: noovPayload }}
      />
      {order.status === "cancelado" && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%) rotate(-30deg)', 
            border: '4px solid #ff0000', 
            color: '#ff0000', 
            fontSize: '32px', 
            fontWeight: 'bold', 
            padding: '10px 20px', 
            zIndex: 100, 
            opacity: 0.4, 
            pointerEvents: 'none',
            borderRadius: '12px',
            textTransform: 'uppercase',
            textAlign: 'center'
          }}
        >
          CANCELADO
        </div>
      )}
      <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', marginBottom: '2px' }}>
        {String(loja?.nome || "Loja").replace(/[^\p{L}\p{N}\s&'.-]/gu, "").trim() || "Loja"}
      </div>
      {enderecoLoja && <div style={{ textAlign: 'center', fontSize: '10px' }}>{enderecoLoja}</div>}
      {loja?.documento && <div style={{ textAlign: 'center', fontSize: '10px' }}>CNPJ/CPF: {loja.documento}</div>}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>Documento Auxiliar - Não Fiscal</div>
      
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
      
      <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '12px', marginBottom: '4px' }}>PEDIDO Nº {orderNumStr}</div>
      <div style={{ fontSize: '10px' }}>
        <b>Emissão:</b> {formattedDate}<br/>
        <b>Tipo:</b> {(order.tipo || "delivery").toUpperCase()}<br/>
        <b>ID:</b> {order.id.split("-")[0].toUpperCase()}
      </div>
      
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
      
      {(() => {
        const enderecoStr = String(order.endereco_entrega || "");
        const ehRetirada = !order.endereco_entrega
          || /retirada\s+no\s+local|retirada\s+no\s+balc[ãa]o/i.test(enderecoStr)
          || ["retirada", "balcao", "balcão", "pickup"].includes(String(order.tipo || "").toLowerCase());
        return (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>DADOS DO CLIENTE</div>
            <div style={{ fontSize: '10px', wordBreak: 'break-word', overflowWrap: 'break-word', overflow: 'hidden' }}>
              <b>Nome:</b> {(order.cliente_nome || "CONSUMIDOR FINAL").replace(/^PDV\s+Mesa/i, "Mesa")}<br/>
              {order.cliente_telefone ? <><b>Tel:</b> {formatPhone(order.cliente_telefone)}<br/></> : ""}
              {order.cliente_documento ? <><b>CPF/CNPJ:</b> {order.cliente_documento}<br/></> : ""}
              {!ehRetirada && order.endereco_entrega && (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><b>Endereço:</b> {order.endereco_entrega}</div>
              )}
              {!ehRetirada && !order.endereco_entrega && order.cliente_endereco_completo && (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><b>Endereço:</b> {order.cliente_endereco_completo}</div>
              )}
            </div>
          </>
        );
      })()}
      
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
      
      <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ textAlign: 'left', paddingBottom: '4px' }}>DESCRIÇÃO</th>
            <th style={{ textAlign: 'right', paddingBottom: '4px' }}>QT</th>
            <th style={{ textAlign: 'right', paddingBottom: '4px' }}>UNIT</th>
            <th style={{ textAlign: 'right', paddingBottom: '4px' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, idx: number) => {
            const nome = it.nome || it.name || "Item";
            const qtd = Number(it.qtd || it.quantity || it.quantidade) || 1;
            
            // Adicionais
            const adds = (it.adicionais || it.addons || []).map((a: any) => {
              const aNome = typeof a === "string" ? a : a?.nome || "";
              const aPreco = typeof a === "object" ? Number(a?.preco) || 0 : 0;
              const aQty = typeof a === "object" ? Math.max(1, Number(a?.quantidade) || 1) : 1;
              return { nome: aNome, preco: aPreco, quantidade: aQty };
            });

            const addonsTotal = adds.reduce((sum, a) => sum + a.preco * a.quantidade, 0);
            
            // Base price calculation
            const basePrice = Number(it.unit_price || it.preco || it.price) || 0;
            let totalUnitPrice = Number(it.preco || it.price) || 0;

            // Use gratis_ate to determine if some addons are free
            const gratisAte = Number(it.gratis_ate) || 0;
            const processedAdds = adds.map((a, i) => ({
              ...a,
              isFree: a.preco === 0 || i < gratisAte
            }));

            if (!it.unit_price && addonsTotal > 0 && totalUnitPrice === basePrice) {
              totalUnitPrice = basePrice + addonsTotal;
            }
            
            const itemTotal = totalUnitPrice * qtd;

            const isKg = it.weight && (it.unidade_medida === "kg" || /quilo|kg/i.test(String(it.unidade_medida || "")));
            const detalhes: string[] = [];
            if (it.tamanho) detalhes.push(`Tam: ${it.tamanho}`);

            if (it.sabores?.length) detalhes.push(`Sab: ${it.sabores.join(", ")}`);
            if (it.caldo_sabor?.nome) {
              const ex = Number(it.caldo_sabor.valorExtra || 0);
              detalhes.push(`Sabor: ${it.caldo_sabor.nome}${ex > 0 ? ` (+${formatCurrency(ex)})` : ""}`);
            }

            if (it.bordas?.length) detalhes.push(`Bor: ${it.bordas.join(", ")}`);
            
            const adicionaisItems = processedAdds.length ? processedAdds.map((a: any, i: number) => {
              const lineLabel = a.quantidade > 1 ? `${a.nome} x${a.quantidade}` : a.nome;
              const lineTotal = a.preco * a.quantidade;
              return (
                <tr key={i}>
                  <td colSpan={3} style={{ fontSize: '9px', color: '#333', paddingLeft: '12px' }}>+ {lineLabel}</td>
                  <td style={{ textAlign: 'right', fontSize: '9px', color: '#333' }}>{a.isFree ? "Grátis" : formatCurrency(lineTotal).replace("R$", "")}</td>
                </tr>
              );
            }) : null;

            if (it.observacao) detalhes.push(`Obs: ${it.observacao}`);
            
            return (
              <React.Fragment key={idx}>
                <tr>
                  <td style={{ paddingTop: '4px', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {nome}
                    {isKg && <div style={{ fontSize: '9px', fontWeight: 700, color: '#000' }}>Peso: {it.weight}g</div>}

                  </td>
                  <td style={{ textAlign: 'right', paddingTop: '4px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {qtd}x
                  </td>
                  <td style={{ textAlign: 'right', paddingTop: '4px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {formatCurrency(basePrice).replace("R$", "")}
                  </td>
                  <td style={{ textAlign: 'right', paddingTop: '4px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {formatCurrency(basePrice * qtd).replace("R$", "")}
                  </td>
                </tr>
                {adicionaisItems}
                {adds.length > 0 && (
                  <tr style={{ borderTop: '0.5px dotted #ccc' }}>
                    <td colSpan={3} style={{ textAlign: 'right', fontSize: '9px', fontWeight: 'bold', paddingTop: '2px' }}>Subtotal:</td>
                    <td style={{ textAlign: 'right', fontSize: '9px', fontWeight: 'bold', paddingTop: '2px' }}>{formatCurrency(itemTotal).replace("R$", "")}</td>
                  </tr>
                )}
                {detalhes.length > 0 ? (
                  <tr>
                    <td colSpan={4} style={{ fontSize: '9px', color: '#333', paddingBottom: '4px', borderBottom: '0.5px solid #eee', wordBreak: 'break-word' }}>
                      {detalhes.map((detalhe, detalheIndex) => (
                        <div key={detalheIndex} style={{ paddingLeft: '8px', borderTop: detalheIndex === 0 ? '0' : '0.5px dotted #ddd' }}>
                          {detalhe}
                        </div>
                      ))}
                    </td>
                  </tr>
                ) : (
                  <tr><td colSpan={4} style={{ paddingBottom: '4px', borderBottom: '0.5px solid #eee' }}></td></tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      
      <div style={{ borderTop: '1px solid #000', margin: '8px 0' }}></div>
      
      <div style={{ fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Qtd. total de itens</span><span>{items.length}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Valor total</span><span>{formatCurrency(subtotal)}</span></div>
        {taxa > 0 && order.cupom_tipo !== 'frete_gratis' && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Taxa de entrega</span><span>{formatCurrency(taxa)}</span></div>}
        {order.cupom_tipo === 'frete_gratis' && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Taxa de entrega</span><span className="font-bold text-emerald-500">Grátis (Cupom)</span></div>}
        {cupomDesconto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
            <span>Desconto (Cupom: {order.cupom_codigo})</span>
            {order.cupom_tipo !== 'frete_gratis' && <span>-{formatCurrency(cupomDesconto)}</span>}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '12px', marginTop: '4px', paddingTop: '4px', borderTop: '1px double #000' }}>
          <span>VALOR A PAGAR</span><span>{formatCurrency(Number(order.total || 0))}</span>
        </div>
      </div>
      
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
      
      <div style={{ fontSize: '10px' }}>
        <div style={{ fontWeight: 700, marginBottom: '2px' }}>FORMA DE PAGAMENTO</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{displayPaymentMethod.split('|')[0].trim()}</span>
          </div>
        </div>
        {displayPaymentMethod.includes("DINHEIRO") && (
          <div style={{ marginTop: '2px' }}>
            {trocoParaValue > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Troco para:</span>
                <span>{formatCurrency(trocoParaValue)}</span>
              </div>
            )}
            {trocoParaValue - Number(order.total || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontWeight: 'bold' }}>
                <span>TROCO:</span>
                <span>{formatCurrency(trocoParaValue - Number(order.total || 0))}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      
      <div style={{ borderTop: '1px solid #000', margin: '10px 0' }}></div>
      
      <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>AGRADECEMOS A PREFERÊNCIA</div>
      <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '4px' }}>Sistema de Gestão NOOV</div>
    </div>
  );
});



ThermalReceipt.displayName = "ThermalReceipt";

export default ThermalReceipt;
