import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, Minus, ShoppingCart, CreditCard, Banknote, Smartphone, Utensils, Monitor, Loader2, Package, Printer, QrCode, Check, Copy, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import PdvAddonModal from "@/components/pdv/PdvAddonModal";
import ReceiptCart from "@/components/pdv/ReceiptCart";
import { printReceipt, printKitchenTicket } from "@/utils/printHelper";
import { isStoreOpen } from "@/utils/storeHours";

// PrintService removed
// ReceiptData and printThermal removed as we use window.print() now
import { useIsMobile } from "@/hooks/use-mobile";

interface ProductAddon {
  nome: string;
  preco: string | number;
  tipo?: string;
}

interface Product {
  id: string;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  promocao_validade: string | null;
  categoria: string | null;
  imagem_url: string | null;
  adicionais: ProductAddon[] | null;
  max_sabores: number | null;
  tamanhos: { nome: string; preco: number }[] | null;
  emoji?: string;
  unidade_medida?: string | null;
}

type CartItem = {
  uid: string; // unique key for items with different addons
  id: string;
  name: string;
  price: number;
  qty: number;
  emoji: string;
  image?: string;
  addons?: { nome: string; preco: number }[];
  observation?: string;
  weight?: string;
  unidade_medida?: string;
  weightMode?: "weight" | "value";
};

const PosCounter = () => {
  const { user } = useAuth();
  useKeepScreenOn();
  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"balcao" | "mesas" | null>("balcao");
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [lojaNome, setLojaNome] = useState<string>("");
  const [lojaSegmento, setLojaSegmento] = useState<string>("");
  const [lojaInfo, setLojaInfo] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [paymentValue, setPaymentValue] = useState("");
  const [valorPago, setValorPago] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [localPayments, setLocalPayments] = useState<{ valor: number; metodo: string }[]>([]);
  const [kitchenStatus, setKitchenStatus] = useState<string>("pendente");
  const [currentOrderNum, setCurrentOrderNum] = useState<number | null>(null);
  const [includeServiceCharge, setIncludeServiceCharge] = useState(false);
  const [closedModal, setClosedModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const [todayStats, setTodayStats] = useState<{ total: number; count: number }>({ total: 0, count: 0 });

  const fetchTodayStats = useCallback(async (id: string) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("pdv_pedidos")
      .select("total")
      .eq("loja_id", id)
      .eq("status", "finalizado")
      .gte("created_at", start.toISOString());
    const rows = data || [];
    setTodayStats({
      total: rows.reduce((s: number, r: any) => s + Number(r.total || 0), 0),
      count: rows.length,
    });
  }, []);




  const fetchProducts = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("loja_id", id)
        .eq("disponivel", true)
        .order("categoria");
      if (error) throw error;
      setProducts((data || []).map((p: any) => ({
        ...p,
        adicionais: Array.isArray(p.adicionais) ? p.adicionais : null,
        tamanhos: Array.isArray(p.tamanhos) ? p.tamanhos : null,
      })));
    } catch (err) {
      console.error("Error fetching products:", err);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchLoja = async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, segmento, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, documento, horario_funcionamento, pdv_venda_fora_horario")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setLojaId(data.id);
        setLojaNome(data.nome);
        setLojaSegmento(data.segmento);
        setLojaInfo(data);
        fetchProducts(data.id);
        fetchTodayStats(data.id);
      }
    };
    fetchLoja();
  }, [user, fetchProducts, fetchTodayStats]);

  useEffect(() => {
    if (!lojaId) return;
    const ch = supabase
      .channel(`pdv_today_${lojaId}_${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pdv_pedidos", filter: `loja_id=eq.${lojaId}` }, () => fetchTodayStats(lojaId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lojaId, fetchTodayStats]);




  const handleSelectMode = (selectedMode: "balcao" | "mesas") => {
    if (selectedMode === "mesas") {
      navigate("/lojista/pdv-mesas");
    } else {
      setMode("balcao");
    }
  };

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.categoria || "Sem categoria"))];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => (p.categoria || "Sem categoria") === activeCategory);
    if (search) list = list.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [products, activeCategory, search]);

  const handleProductClick = (product: Product) => {
    const hasAddons = product.adicionais && product.adicionais.length > 0;
    const hasSizes = lojaSegmento === "pizzaria" && product.tamanhos && product.tamanhos.length > 0;
    const isWeightBased = product.unidade_medida === "kg";
    
    if (hasAddons || hasSizes || isWeightBased) {
      setAddonProduct(product);
      setShowAddonModal(true);
    } else {
      addToCartDirect(product);
    }
  };

  const addToCartDirect = (product: Product) => {
    const hasPromo = product.preco_promocional && Number(product.preco_promocional) > 0 && (!product.promocao_validade || new Date(product.promocao_validade) >= new Date());
    const precoFinal = hasPromo ? Number(product.preco_promocional) : Number(product.preco);
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id && (!c.addons || c.addons.length === 0));
      if (existing) {
        return prev.map((c) => c.uid === existing.uid ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, {
        uid: crypto.randomUUID(),
        id: product.id,
        name: product.nome,
        price: precoFinal,
        qty: 1,
        emoji: product.emoji || "🍔",
        image: product.imagem_url || undefined,
      }];
    });
  };

  const handleAddonConfirm = (data: {
    productId: string;
    name: string;
    basePrice: number;
    totalPrice: number;
    qty: number;
    addons: { nome: string; preco: number }[];
    observation: string;
    image?: string;
    weight?: string;
    unidade_medida?: string;
    weightMode?: "weight" | "value";
  }) => {
    setCart((prev) => [...prev, {
      uid: crypto.randomUUID(),
      id: data.productId,
      name: data.name,
      price: data.totalPrice,
      unit_price: data.basePrice,
      qty: data.qty,
      emoji: "🍔",
      image: data.image,
      addons: data.addons,
      observation: data.observation,
      weight: data.weight,
      unidade_medida: data.unidade_medida,
      weightMode: data.weightMode,
    }]);
  };

  const updateQty = (uid: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => c.uid === uid ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter((c) => c.qty > 0)
    );
  };

  const totalProdutos = cart.reduce((acc, c) => {
    const addonsTotal = c.addons?.reduce((sum, a) => sum + Number(a.preco), 0) || 0;
    return acc + (c.price + addonsTotal) * c.qty;
  }, 0);
  const taxaServico = includeServiceCharge ? totalProdutos * 0.1 : 0;
  const total = totalProdutos + taxaServico;
  const restante = Math.max(0, total - valorPago);

  const handleRegisterPayment = async () => {
    const val = parseFloat(paymentValue.replace(",", "."));
    if (!val || val <= 0) { toast.error("Valor inválido"); return; }
    setSubmitting(true);
    try {
      const newPaid = valorPago + val;
      setValorPago(newPaid);
      setLocalPayments((prev) => [...prev, { valor: val, metodo: paymentMethod }]);
      setShowPaymentModal(false);
      toast.success(`Pagamento de R$ ${val.toFixed(2).replace(".", ",")} registrado`);
      if (newPaid >= total) {
        await finalizeOrder(newPaid);
      }
    } catch (err) {
      toast.error("Erro ao registrar pagamento");
    } finally {
      setSubmitting(false);
    }
  };

  const finalizeOrder = async (paid?: number) => {
    if (!lojaId || !user) return;
    if (!(lojaInfo as any)?.pdv_venda_fora_horario) {
      const openCheck = isStoreOpen(lojaInfo?.horario_funcionamento);
      if (!openCheck.open) {
        setClosedModal({ open: true, message: openCheck.message });
        return;
      }
    }
    setSubmitting(true);

    try {
      const itemsJson = cart.map((i) => ({
        uid: i.uid, id: i.id, name: i.name, price: i.price,
        quantity: i.qty, image: i.image, addons: i.addons || [],
        observation: i.observation || "",
      }));
      // Insert into pdv_pedidos
      const { data: insertedPdv, error } = await supabase.from("pdv_pedidos").insert({
        loja_id: lojaId,
        items: itemsJson as any,
        total,
        valor_pago: paid ?? total,
        pagamento_status: (paid ?? total) >= total ? "pago" : "parcial",
        status: "finalizado",
        status_cozinha: kitchenStatus === "pendente" ? "pronto" : kitchenStatus,
        metodo_pagamento: paymentMethod,
      }).select("numero_diario").single();
      if (error) throw error;

      // Update existing pedido (sent to kitchen) or insert new one
      const { data: existingPedido } = await supabase
        .from("pedidos")
        .select("id")
        .eq("lojista_id", user.id)
        .eq("tipo", "balcao")
        .eq("status", "preparando")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPedido) {
        await supabase.from("pedidos").update({
          items: itemsJson as any,
          total,
          status: "entregue",
          observacoes: `Pagamento: ${paymentMethod}`,
        }).eq("id", existingPedido.id);
      } else {
        await supabase.from("pedidos").insert({
          lojista_id: user.id,
          items: itemsJson as any,
          total,
          status: "entregue",
          tipo: "balcao",
          cliente_nome: "PDV Balcão",
          observacoes: `Pagamento: ${paymentMethod}`,
        });
      }

      toast.success(`Pedido Nº ${String(insertedPdv?.numero_diario || 0).padStart(3, "0")} finalizado!`);
      setCart([]);
      setValorPago(0);
      setLocalPayments([]);
      setKitchenStatus("pendente");
      setCurrentOrderNum(null);
    } catch (err) {
      toast.error("Erro ao finalizar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const printOrder = async () => {
    try {
      await printKitchenTicket({
        orderNumber: currentOrderNum ? String(currentOrderNum).padStart(3, "0") : "BAL",
        date: new Date().toLocaleTimeString("pt-BR"),
        items: cart.map((c: any) => ({
          name: c.name,
          qty: c.qty,
          obs: c.observation,
          extras: c.addons,
          sabores: c.sabores,
        })),
      });
    } catch (error) {
      console.error("Erro ao imprimir cozinha:", error);
      toast.error("Erro ao gerar a comanda da cozinha.");
    }
  };

  const printClientReceipt = async () => {
    try {
      await printReceipt(receiptRef.current?.innerHTML || "");
    } catch (error) {
      console.error("Erro ao imprimir comprovante:", error);
      toast.error("Erro ao imprimir comprovante.");
    }
  };

  if (!mode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display text-foreground">Como deseja atender hoje?</h1>
          <p className="text-muted-foreground">Selecione o tipo de atendimento do seu estabelecimento</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4">
          <button onClick={() => handleSelectMode("mesas")} className="group relative flex flex-col items-center p-8 rounded-2xl bg-card border-2 border-border hover:border-primary/50 hover:shadow-elevated transition-all">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Utensils className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Com Mesas</h3>
            <p className="text-sm text-center text-muted-foreground">Ideal para restaurantes, bares e lanchonetes com atendimento em mesas e comandas.</p>
          </button>
          <button onClick={() => handleSelectMode("balcao")} className="group relative flex flex-col items-center p-8 rounded-2xl bg-card border-2 border-border hover:border-primary/50 hover:shadow-elevated transition-all">
            <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Monitor className="w-10 h-10 text-secondary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Balcão Direto</h3>
            <p className="text-sm text-center text-muted-foreground">Ideal para cafeterias, quiosques e fast-food com pagamento imediato no balcão.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)]">
      <div className="space-y-4 pb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/lojista")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">PDV</h1>
            <p className="text-sm text-muted-foreground">Atendimento no Balcão</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20">
            <CardContent className="p-5 flex items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Vendas hoje</p>
                <p className="text-2xl font-bold font-display">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(todayStats.total)}
                </p>
                <p className="text-[11px] text-white/70">{todayStats.count} {todayStats.count === 1 ? "pedido" : "pedidos"}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Banknote className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>


      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setActiveCategory(null)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>Todos</button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{cat}</button>
        ))}
      </div>

      {/* Full-width separator */}
      <div className="w-full h-px bg-border flex-shrink-0" />
      </div>



      <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-6 items-start min-h-0">
        <div className="w-full lg:flex-[2] space-y-8 pr-2 md:pr-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground">Carregando produtos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum produto encontrado</p>
            </div>
          ) : (
            categories.map((category) => {
              const categoryProducts = filtered.filter(p => (p.categoria || "Sem categoria") === category);
              if (categoryProducts.length === 0) return null;
              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{category}</h2>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
                    {categoryProducts.map((p) => {
                      const hasPromo = p.preco_promocional && Number(p.preco_promocional) > 0 && (!p.promocao_validade || new Date(p.promocao_validade) >= new Date());
                      const precoFinal = hasPromo ? Number(p.preco_promocional) : Number(p.preco);
                      const hasAddons = p.adicionais && p.adicionais.length > 0;
                      return (
                        <motion.button
                          key={p.id}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => handleProductClick(p)}
                          className="relative p-3 rounded-xl bg-card border border-border/50 shadow-card hover:shadow-elevated hover:border-primary/30 transition-all text-center active:bg-primary/5"
                        >
                          {hasPromo && (
                            <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md z-10">PROMO</div>
                          )}
                          {hasAddons && (
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md z-10">+EXTRAS</div>
                          )}
                          {p.imagem_url ? (
                            <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                              <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center mb-2 text-4xl">🍽️</div>
                          )}
                          <p className="text-sm font-semibold font-display text-foreground leading-tight truncate">{p.nome}</p>
                          <div className="mt-1">
                            {hasPromo ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-xs text-muted-foreground line-through">R$ {Number(p.preco).toFixed(2).replace(".", ",")}</span>
                                <span className="text-base font-bold text-destructive">R$ {precoFinal.toFixed(2).replace(".", ",")}</span>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-primary">R$ {precoFinal.toFixed(2).replace(".", ",")}</span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Vertical separator */}
        <div className="hidden md:block w-px bg-border self-stretch" />

        {/* Cart - Fixed/Sticky on tablets and desktop */}
        <div className="w-full md:w-[350px] lg:w-[380px] md:sticky md:top-4 md:self-start z-20">
          <ReceiptCart
            ref={receiptRef}
            lojaInfo={lojaInfo || { nome: lojaNome }}
            orderNumStr={currentOrderNum ? String(currentOrderNum).padStart(3, "0") : "BAL"}
            tipoPedido="balcao"
            title={currentOrderNum ? `Balcão #${String(currentOrderNum).padStart(3, "0")}` : "Balcão"}
            subtitle={new Date().toLocaleString("pt-BR")}
            cart={cart}
            total={total}
            taxaServico={taxaServico}
            includeServiceCharge={includeServiceCharge}
            onToggleServiceCharge={() => setIncludeServiceCharge(!includeServiceCharge)}
            valorPago={valorPago}
            restante={restante}
            payments={localPayments}
            kitchenStatus={kitchenStatus}
            onUpdateQty={updateQty}
            onPayTotal={() => {
              setIsPartialPayment(false);
              setPaymentValue(restante.toFixed(2).replace(".", ","));
              setShowPaymentModal(true);
            }}


            onPrint={printOrder}
            onPrintOrder={printClientReceipt}
            onSendToKitchen={async () => {
              if (!lojaId || !user) return;
              if (!(lojaInfo as any)?.pdv_venda_fora_horario) {
                const openCheck = isStoreOpen(lojaInfo?.horario_funcionamento);
                if (!openCheck.open) {
                  setClosedModal({ open: true, message: openCheck.message });
                  return;
                }
              }
              setKitchenStatus("em_preparo");

              const itemsJson = cart.map((i) => ({
                uid: i.uid, id: i.id, name: i.name, price: i.price,
                quantity: i.qty, image: i.image, addons: i.addons || [],
                observation: i.observation || "",
              }));
              await supabase.from("pedidos").insert({
                lojista_id: user.id,
                items: itemsJson as any,
                total,
                status: "preparando",
                tipo: "balcao",
                cliente_nome: "PDV Balcão",
                observacoes: "Pedido enviado para preparo",
              });
              toast.success("Pedido enviado para preparo! 🍳");
            }}
            onMarkReady={() => {
              setKitchenStatus("pronto");
              toast.success("Pedido pronto! ✅");
            }}
            onCancelOrder={() => {
              // Cancel related pedido in pedidos table
              if (user) {
                supabase.from("pedidos")
                  .select("id")
                  .eq("lojista_id", user.id)
                  .eq("tipo", "balcao")
                  .in("status", ["preparando", "em_preparo"])
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle()
                  .then(({ data: ep }) => {
                    if (ep) supabase.from("pedidos").update({ status: "cancelado" }).eq("id", ep.id);
                  });
              }
              setCart([]);
              setValorPago(0);
              setLocalPayments([]);
              setKitchenStatus("pendente");
              toast.success("Pedido cancelado!");
            }}
            disablePayment={submitting}
            submitting={submitting}
          />
        </div>
      </div>

      {/* Addon Modal */}
      <PdvAddonModal
        open={showAddonModal}
        onClose={() => { setShowAddonModal(false); setAddonProduct(null); }}
        product={addonProduct}
        segmento={lojaSegmento}
        flavorProducts={
          addonProduct && lojaSegmento === "pizzaria"
            ? products
                .filter(p => p.categoria === addonProduct.categoria && p.id !== addonProduct.id)
                .map(p => ({ id: p.id, nome: p.nome, preco: p.preco, imagem_url: p.imagem_url }))
            : []
        }
        onConfirm={handleAddonConfirm}
      />

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isPartialPayment ? "Pagamento Parcial" : "Pagamento Total"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">
                {isPartialPayment ? "Valor parcial" : "Valor total"} (restante: R$ {restante.toFixed(2).replace(".", ",")})
              </label>
              <Input
                placeholder="0,00"
                value={paymentValue}
                onChange={(e) => setPaymentValue(e.target.value)}
                className="h-12 text-lg"
                autoFocus
                readOnly={!isPartialPayment}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "dinheiro", icon: Banknote, label: "Dinheiro" },
                { key: "cartao", icon: CreditCard, label: "Cartão" },
                { key: "pix", icon: Smartphone, label: "Pix" },
              ].map((pm) => (
                <button
                  key={pm.key}
                  onClick={() => setPaymentMethod(pm.key)}
                  className={`p-3 rounded-xl border-2 text-center transition-colors ${
                    paymentMethod === pm.key
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  <pm.icon className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">{pm.label}</span>
                </button>
              ))}
            </div>
            {isPartialPayment && (
              <p className="text-xs text-muted-foreground">
                💡 Informe o valor que o cliente deseja pagar agora. O restante ficará pendente.
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleRegisterPayment}
              disabled={submitting || !paymentValue}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isPartialPayment ? "Confirmar Parcial" : "Confirmar Pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Estabelecimento Fechado */}
      <Dialog open={closedModal.open} onOpenChange={(o) => setClosedModal((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0 [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="bg-red-600 px-4 py-3">
            <DialogTitle className="text-white">Estabelecimento fechado</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground">{closedModal.message}</p>
            <p className="text-xs text-muted-foreground">
              Ajuste o horário em <b>Configurações → Horário</b>.
            </p>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setClosedModal({ open: false, message: "" })}>Entendi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

};

export default PosCounter;
