import { useState, forwardRef, useRef } from "react";
import { Plus, Minus, Printer, Banknote, CreditCard, CheckCircle2, ChefHat, Send, XCircle, PackagePlus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


interface CartItem {
  uid: string;
  id: string;
  name: string;
  price: number;
  qty: number;
  addons?: { nome: string; preco: number; quantidade?: number }[];
  sabores?: string[];
  observation?: string;
  order_type?: string;

  weight?: string;
  unidade_medida?: string;
  weightMode?: "weight" | "value";
}

interface Payment {
  valor: number;
  metodo: string;
}

const paymentLabel: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "PIX",
};

const kitchenStatusLabel: Record<string, { label: string; color: string }> = {
  em_preparo: { label: "Em Preparo 🔥", color: "bg-orange-100 text-orange-700 border-orange-200" },
  pronto: { label: "Pronto ✅", color: "bg-green-100 text-green-700 border-green-200" },
};

interface ReceiptCartProps {
  storeName?: string;
  lojaInfo?: any;
  orderNumStr?: string;
  clientName?: string;
  clientPhone?: string;
  tipoPedido?: string;
  title?: string;
  subtitle?: string;
  cart: CartItem[];
  total: number;
  taxaServico?: number;
  includeServiceCharge?: boolean;
  onToggleServiceCharge?: () => void;
  valorPago?: number;
  restante?: number;
  payments?: Payment[];
  kitchenStatus?: string;
  onUpdateQty: (uid: string, delta: number) => void;
  garcomNome?: string;
  onClearMesaNotify?: () => void;

  onRemove?: (uid: string) => void;
  onPayTotal: () => void;
  onPayPartial?: () => void;
  onPrint: () => void;
  onPrintOrder?: () => void;
  onCloseOrder?: () => void;
  onSendToKitchen?: () => void;
  onMarkReady?: () => void;
  onCancelOrder?: () => void;
  showCloseButton?: boolean;
  disablePayment?: boolean;
  submitting?: boolean;
}

const ReceiptCart = forwardRef<HTMLDivElement, ReceiptCartProps>(({
  storeName,
  lojaInfo,
  orderNumStr,
  clientName,
  clientPhone,
  tipoPedido,
  title = "Pedido",
  subtitle,
  cart,
  total,
  taxaServico = 0,
  includeServiceCharge = false,
  onToggleServiceCharge,
  valorPago = 0,
  restante = 0,
  payments = [],
  kitchenStatus = "pendente",
  onUpdateQty,
  garcomNome,
  onRemove,
  onClearMesaNotify,

  onPayTotal,
  onPayPartial,
  onPrint,
  onPrintOrder,
  onCloseOrder,
  onSendToKitchen,
  onMarkReady,
  onCancelOrder,
  showCloseButton,
  disablePayment,
  submitting,
}, ref) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const dashed = "border-b border-dashed border-border";
  const statusInfo = kitchenStatusLabel[kitchenStatus];
  const isFinalized = showCloseButton && restante <= 0 && valorPago > 0;

  // Payload estruturado p/ impressão Bluetooth replicar o MESMO layout
  // utilizado em /lojista/pedidos (ThermalReceipt → bluetoothPrint.printHTML).
  const noovOrderPayload = (() => {
    const items = cart.map((c) => ({
      nome: c.name,
      qtd: c.qty,
      preco: c.price,
      unit_price: c.price,
      adicionais: (c.addons || []).map((a) => ({
        nome: a.nome,
        preco: Number(a.preco) || 0,
        quantidade: Math.max(1, Number(a.quantidade) || 1),
      })),
      sabores: c.sabores,
      observacao: c.observation,
      weight: c.weight,
      unidade_medida: c.unidade_medida,
    }));
    const formaPagamento = payments.length
      ? payments.map((p) => `${paymentLabel[p.metodo] || p.metodo}`).join(" + ")
      : undefined;
    const order = {
      id: `pdv-${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
      tipo: tipoPedido || (subtitle?.toLowerCase().includes("mesa") ? "mesa" : "balcao"),
      items,
      total,
      taxa_servico: taxaServico && includeServiceCharge ? taxaServico : 0,
      cliente_nome: clientName || subtitle || "CONSUMIDOR FINAL",
      cliente_telefone: clientPhone,
      forma_pagamento: formaPagamento,
      observacoes: garcomNome ? `Garçom: ${garcomNome}` : undefined,
      status: "pendente",
    };
    const loja = lojaInfo || { nome: storeName || "Loja" };
    return JSON.stringify({ order, loja, orderNumStr: orderNumStr || "PDV" });
  })();

  return (
    <div className="space-y-3">
      {/* Action buttons above the cart */}
      {cart.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                className="flex-1 h-10"
                onClick={onPayTotal}
                disabled={disablePayment || submitting || restante <= 0}
              >
                <Banknote className="w-4 h-4 mr-1.5" /> Pagar Total
              </Button>
              {onPayPartial && (
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={onPayPartial}
                  disabled={disablePayment || submitting || restante <= 0}
                >
                  <CreditCard className="w-4 h-4 mr-1.5" /> Parcial
                </Button>
              )}
            </div>

            {isFinalized && onCloseOrder && (
              <Button
                className="w-full h-10 bg-green-600 hover:bg-green-700 text-white"
                onClick={onCloseOrder}
                disabled={submitting}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Finalizar Pedido
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Receipt card */}
      <div 
        ref={ref}
        id="receipt-content"
        className="bg-card border border-border rounded-2xl shadow-card font-mono text-sm overflow-hidden print:shadow-none"
      >
        <script
          type="application/json"
          data-noov-receipt="1"
          style={{ display: 'none' }}
          dangerouslySetInnerHTML={{ __html: noovOrderPayload }}
        />
        {/* Receipt header */}
        <div className="bg-muted/50 px-5 py-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-base font-bold font-display text-foreground">{title}</p>
              </div>
            </div>

            {cart.length > 0 && (kitchenStatus === "pendente" || cart.some(i => (i as any).is_new)) && onSendToKitchen && (
              <Button
                size="sm"
                className="shrink-0 rounded-full bg-orange-500 hover:bg-orange-600 text-white"
                onClick={onSendToKitchen}
                disabled={disablePayment || submitting}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {kitchenStatus !== "pendente" ? "Adicionar Item" : "Enviar Pedido"}
              </Button>
            )}
            {cart.length > 0 && kitchenStatus === "em_preparo" && (
              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-xs shrink-0">
                <ChefHat className="w-3 h-3 mr-1" />
                Em Preparo 🔥
              </Badge>
            )}
            {cart.length > 0 && kitchenStatus === "pronto" && (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs shrink-0">
                <ChefHat className="w-3 h-3 mr-1" />
                Pronto ✅
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          
          {garcomNome && (
            <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-1">
              Garçom: {garcomNome}
            </p>
          )}
          
          <div className="flex gap-2 justify-start py-1 print:hidden">
            <Button 
              variant="outline" 
              size="sm"
              className="h-8 border-dashed hover:bg-primary/5 hover:text-primary transition-all text-xs font-bold px-3" 
              onClick={onPrint}
            >
              <Printer className="w-4 h-4 mr-1.5" /> Cozinha
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              className="h-8 border-dashed hover:bg-blue-500/5 hover:text-blue-600 hover:border-blue-500/30 transition-all text-xs font-bold px-3" 
              onClick={onPrintOrder}
            >
              <Printer className="w-4 h-4 mr-1.5" /> Cliente
            </Button>
          </div>
        </div>

        <div className={`mx-4 ${dashed}`} />

        {/* Items */}
        <div className="px-5 py-3">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-xs">
              Adicione itens ao pedido
            </p>
          ) : (
            <div className="space-y-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Itens</p>
              {cart.map((item, idx) => (
                <div key={item.uid} className={`${item.order_type === "mesa_cliente" ? "bg-blue-50/30 -mx-5 px-5" : ""} border-b border-border/30 last:border-0`}>
                  <div className="flex items-stretch gap-0 overflow-hidden relative">
                    <div className="flex-1 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 w-full">
                          <span className="text-foreground truncate text-[12px] flex items-center gap-1.5">
                            <span className="truncate">{item.name}</span>
                            {(item as any).is_new && (
                              <Badge className="bg-red-500 hover:bg-red-500 text-white text-[8px] px-1 py-0 h-3.5 animate-pulse shrink-0 print:hidden">
                                NOVO
                              </Badge>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                            <button
                              onClick={() => onUpdateQty(item.uid, -1)}
                              className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] font-bold min-w-[14px] text-center">{item.qty}</span>
                            <button
                              onClick={() => onUpdateQty(item.uid, 1)}
                              className="w-6 h-6 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="hidden print:inline text-[11px] font-bold">x{item.qty}</span>
                        </div>
                        {item.weight && (
                          <div className="mt-1 space-y-0.5 pl-4 print:hidden">
                            <p className="text-[11px] font-bold text-primary">
                              Peso: {item.weight}{item.unidade_medida === "kg" ? "g" : "ml"}
                            </p>
                            {item.weightMode && (
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                                Seleção: {item.weightMode === "value" ? "Por Valor" : "Por Grama"}
                              </p>
                            )}
                          </div>
                        )}
                        {item.sabores && item.sabores.length > 0 && (
                          <div className="mt-1 pl-4">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                              Sabores:
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.sabores.join(" / ")}
                            </p>
                          </div>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div className="mt-1 space-y-0 pl-4">
                            <p className="text-[10px] text-muted-foreground mb-0.5 print:hidden">
                              Preço unitário: R$ {item.price.toFixed(2).replace(".", ",")}
                            </p>
                            {item.addons.map((a) => {
                              const aQty = Math.max(1, Number(a.quantidade) || 1);
                              const lineLabel = aQty > 1 ? `${a.nome} x${aQty}` : a.nome;
                              const lineTotal = Number(a.preco) * aQty;
                              return (
                                <p key={a.nome} className="text-[11px] text-muted-foreground">
                                  + {lineLabel} {Number(a.preco) > 0 && <span className="text-foreground print:hidden">R$ {lineTotal.toFixed(2).replace(".", ",")}</span>}
                                </p>
                              );
                            })}
                          </div>
                        )}
                        {item.observation && (
                          <p className="mt-1 text-[11px] text-muted-foreground italic pl-4">
                            Obs: {item.observation}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-end mt-2 print:hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-bold text-right text-xs">
                            Total: R$ {((item.price + (item.addons?.reduce((acc, a) => acc + Number(a.preco) * Math.max(1, Number(a.quantidade) || 1), 0) || 0)) * item.qty).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <>
            <div className="print:hidden">
              <div className={`mx-4 ${dashed}`} />

              {/* Totals */}
              <div className="px-5 py-3 space-y-1">
                <div className="flex justify-between items-baseline text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span>R$ {(total - taxaServico).toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span>Taxa de Serviço (10% opcional)</span>
                    {onToggleServiceCharge && (
                      <input 
                        type="checkbox" 
                        checked={includeServiceCharge} 
                        onChange={onToggleServiceCharge}
                        className="w-3.5 h-3.5 accent-primary cursor-pointer"
                      />
                    )}
                  </div>
                  <span className={includeServiceCharge ? "text-foreground" : "line-through text-muted-foreground"}>
                    R$ {taxaServico.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mt-1 pt-1 border-t border-dotted border-border/50">
                  <span className="text-foreground font-bold">TOTAL GERAL</span>
                  <span className="text-lg font-bold font-display text-primary">
                    R$ {total.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                {payments.length > 0 ? (
                  <>
                    {payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-green-600">Parcial Pago - {paymentLabel[p.metodo] || p.metodo}</span>
                        <span className="font-medium text-green-600">R$ {p.valor.toFixed(2).replace(".", ",")}</span>
                      </div>
                    ))}
                  </>
                ) : valorPago > 0 ? (
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">Pago</span>
                    <span className="font-medium text-green-600">R$ {valorPago.toFixed(2).replace(".", ",")}</span>
                  </div>
                ) : null}
                {(valorPago > 0 && restante > 0) && (
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-foreground">Restante</span>
                    <span className="text-primary font-display">R$ {restante.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cancel button at the bottom of the receipt */}
            {onCancelOrder && (
              <>
                <div className={`mx-4 ${dashed} print:hidden`} />
                <div className="px-5 py-3 print:hidden">
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={submitting}
                      className="w-full text-center text-xs text-destructive/70 hover:text-destructive transition-colors py-1"
                    >
                      <XCircle className="w-3.5 h-3.5 inline mr-1" />
                      Cancelar Pedido
                    </button>
                  ) : (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-medium text-destructive">Cancelar este pedido?</p>
                      <p className="text-[11px] text-muted-foreground">Itens, pagamentos e registros serão cancelados.</p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => { setShowCancelConfirm(false); onCancelOrder(); }}
                          disabled={submitting}
                        >
                          Sim, Cancelar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setShowCancelConfirm(false)}
                        >
                          Não
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default ReceiptCart;