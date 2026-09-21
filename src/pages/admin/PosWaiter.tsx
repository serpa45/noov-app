import { useState, useMemo, useEffect, useRef } from "react";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  Users,
  Clock,
  Loader2,
  Bell,
  CheckCircle2,
  ChefHat,
  X,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

type CartItem = { id: string; name: string; price: number; qty: number; image?: string; weight?: string; unidade_medida?: string };

const PosWaiter = () => {
  const { user } = useAuth();
  useKeepScreenOn();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedMesa, setSelectedMesa] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get loja
  const { data: loja } = useQuery({
    queryKey: ["loja-garcom", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Get mesas
  const { data: mesas = [], isLoading: loadingMesas } = useQuery({
    queryKey: ["garcom-mesas", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_mesas")
        .select("*")
        .eq("loja_id", loja!.id);
      
      if (!data) return [];
      
      return [...data].sort((a, b) => {
        const numA = parseInt(a.nome.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.nome.replace(/\D/g, "")) || 0;
        return numA - numB || a.nome.localeCompare(b.nome);
      });
      return data || [];
    },
    enabled: !!loja,
  });

  // Get open comandas
  const { data: comandas = [] } = useQuery({
    queryKey: ["garcom-comandas", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_comandas")
        .select("*, pdv_pedidos(id, items, total, status_cozinha, created_at)")
        .eq("loja_id", loja!.id)
        .eq("status", "aberta");
      return data || [];
    },
    enabled: !!loja,
  });

  // Get products
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["garcom-products", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("loja_id", loja!.id)
        .eq("disponivel", true)
        .order("categoria");
      return data || [];
    },
    enabled: !!loja,
  });

  // Realtime subscriptions
  useRealtimeSubscription("pdv_mesas", [["garcom-mesas"]], loja ? `loja_id=eq.${loja.id}` : undefined);
  useRealtimeSubscription("pdv_comandas", [["garcom-comandas"]], loja ? `loja_id=eq.${loja.id}` : undefined);
  useRealtimeSubscription("pdv_pedidos", [["garcom-comandas"]], loja ? `loja_id=eq.${loja.id}` : undefined);

  // Listen for "pronto" orders via realtime
  useEffect(() => {
    if (!loja) return;
    const channel = supabase
      .channel("garcom-pronto-notify")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "pdv_pedidos",
        filter: `loja_id=eq.${loja.id}`,
      }, (payload: any) => {
        if (payload.new?.status_cozinha === "pronto" && payload.old?.status_cozinha !== "pronto") {
          // Find mesa for this order
          const comanda = comandas.find((c: any) =>
            c.pdv_pedidos?.some((p: any) => p.id === payload.new.id)
          );
          const mesa = comanda ? mesas.find((m: any) => m.id === comanda.mesa_id) : null;
          const newReady = {
            pedido_id: payload.new.id,
            mesa_nome: mesa?.nome || "Mesa",
            items: payload.new.items,
          };
          setReadyOrders((prev) => [...prev, newReady]);
          setShowReadyModal(true);
          // Play notification sound
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczFjlprN7TpnItGB1OipCqr6mXd0s1T3eQqayuqp6GXUNFbI+ip6qsoZJqTE5ccoiYo6mrmYNfTmBxf4yboqWXgl9cZm5+jJaepaOMeGlub3mEkJyjppyPg3l0dXqCipSdo6KTiH54dnaAho6XnaGVjIR+e3Z5gIiRmqCejIV+fXh5f4WNlZyekYiCf3x5e4KIj5adm4+Ign99eXt+");
            audio.play().catch(() => {});
          } catch {}
          toast.success(`🔔 Pedido pronto! ${mesa?.nome || "Mesa"}`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loja, comandas, mesas]);

  const categories = useMemo(() => {
    return [...new Set(products.map((p: any) => p.categoria || "Sem categoria"))];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p: any) => (p.categoria || "Sem categoria") === activeCategory);
    if (search) list = list.filter((p: any) => p.nome.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [products, activeCategory, search]);

  // Open comanda for a mesa
  const openComanda = useMutation({
    mutationFn: async (mesa: any) => {
      // Check if mesa already has an open comanda
      const existing = comandas.find((c: any) => c.mesa_id === mesa.id && c.status === "aberta");
      if (existing) return existing;

      const { data, error } = await supabase
        .from("pdv_comandas")
        .insert({
          loja_id: loja!.id,
          mesa_id: mesa.id,
          garcom_id: user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Update mesa status
      await supabase.from("pdv_mesas").update({ status: "ocupada" }).eq("id", mesa.id);

      return data;
    },
    onSuccess: (comanda, mesa) => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesas"] });
      queryClient.invalidateQueries({ queryKey: ["garcom-comandas"] });
      setSelectedMesa(mesa);
      setShowOrderModal(true);
      setCart([]);
    },
    onError: () => toast.error("Erro ao abrir comanda"),
  });

  // Send order to kitchen
  const sendToKitchen = useMutation({
    mutationFn: async () => {
      if (!selectedMesa || cart.length === 0) return;
      const comanda = comandas.find((c: any) => c.mesa_id === selectedMesa.id && c.status === "aberta");
      if (!comanda) {
        // Create comanda first
        const { data: newComanda, error: cErr } = await supabase
          .from("pdv_comandas")
          .insert({
            loja_id: loja!.id,
            mesa_id: selectedMesa.id,
            garcom_id: user!.id,
          })
          .select()
          .single();
        if (cErr) throw cErr;

        const items = cart.map((c) => ({
          id: c.id,
          nome: c.name,
          preco: c.price,
          qtd: c.qty,
          imagem_url: c.image,
        }));
        const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

        const { error } = await supabase.from("pdv_pedidos").insert({
          loja_id: loja!.id,
          mesa_id: selectedMesa.id,
          comanda_id: newComanda.id,
          items,
          total,
          status_cozinha: "pendente",
        });
        if (error) throw error;

        // Update comanda total
        await supabase.from("pdv_comandas")
          .update({ total: (newComanda.total || 0) + total })
          .eq("id", newComanda.id);
      } else {
        const items = cart.map((c) => ({
          id: c.id,
          nome: c.name,
          preco: c.price,
          qtd: c.qty,
          imagem_url: c.image,
        }));
        const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

        const { error } = await supabase.from("pdv_pedidos").insert({
          loja_id: loja!.id,
          mesa_id: selectedMesa.id,
          comanda_id: comanda.id,
          items,
          total,
          status_cozinha: "pendente",
        });
        if (error) throw error;

        await supabase.from("pdv_comandas")
          .update({ total: (comanda.total || 0) + total })
          .eq("id", comanda.id);
      }

      // Update mesa status
      await supabase.from("pdv_mesas").update({ status: "ocupada" }).eq("id", selectedMesa.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesas"] });
      queryClient.invalidateQueries({ queryKey: ["garcom-comandas"] });
      setCart([]);
      setShowOrderModal(false);
      toast.success("Pedido enviado para a cozinha!");
    },
    onError: () => toast.error("Erro ao enviar pedido"),
  });

  // Close comanda
  const closeComanda = useMutation({
    mutationFn: async (mesaId: string) => {
      const comanda = comandas.find((c: any) => c.mesa_id === mesaId && c.status === "aberta");
      if (!comanda) return;

      await supabase.from("pdv_comandas")
        .update({ status: "fechada", data_fechamento: new Date().toISOString() })
        .eq("id", comanda.id);

      await supabase.from("pdv_mesas")
        .update({ status: "livre", pedido_atual_id: null })
        .eq("id", mesaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesas"] });
      queryClient.invalidateQueries({ queryKey: ["garcom-comandas"] });
      toast.success("Comanda fechada!");
    },
  });

  const addToCart = (product: any) => {
    const hasPromo = product.preco_promocional && Number(product.preco_promocional) > 0 &&
      (!product.promocao_validade || new Date(product.promocao_validade) >= new Date());
    const price = hasPromo ? Number(product.preco_promocional) : Number(product.preco);

    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id);
      if (existing) return prev.map((c) => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: product.id, name: product.nome, price, qty: 1, image: product.imagem_url || undefined }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter((c) => c.qty > 0));
  };

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const getComandaForMesa = (mesaId: string) => {
    return comandas.find((c: any) => c.mesa_id === mesaId && c.status === "aberta");
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${mins % 60}m`;
  };

  const readyCount = useMemo(() => {
    let count = 0;
    comandas.forEach((c: any) => {
      c.pdv_pedidos?.forEach((p: any) => {
        if (p.status_cozinha === "pronto") count++;
      });
    });
    return count;
  }, [comandas]);

  const dismissReady = (pedidoId: string) => {
    setReadyOrders((prev) => prev.filter((r) => r.pedido_id !== pedidoId));
    // Mark as delivered
    supabase.from("pdv_pedidos").update({ status_cozinha: "entregue" }).eq("id", pedidoId).then();
    queryClient.invalidateQueries({ queryKey: ["garcom-comandas"] });
    if (readyOrders.length <= 1) setShowReadyModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">PDV Garçom</h1>
          <p className="text-sm text-muted-foreground">Selecione uma mesa para criar ou adicionar pedidos</p>
        </div>
        <div className="flex items-center gap-3">
          {readyCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="relative border-secondary text-secondary"
              onClick={() => {
                // Show all ready orders
                const allReady: any[] = [];
                comandas.forEach((c: any) => {
                  const mesa = mesas.find((m: any) => m.id === c.mesa_id);
                  c.pdv_pedidos?.forEach((p: any) => {
                    if (p.status_cozinha === "pronto") {
                      allReady.push({ pedido_id: p.id, mesa_nome: mesa?.nome || "Mesa", items: p.items });
                    }
                  });
                });
                setReadyOrders(allReady);
                setShowReadyModal(true);
              }}
            >
              <Bell className="w-4 h-4 mr-1" />
              Prontos
              <span className="ml-1 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {readyCount}
              </span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate("/lojista/cozinha")}>
            <ChefHat className="w-4 h-4 mr-1" /> Cozinha
          </Button>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              Livres: {mesas.filter((m: any) => m.status === "livre").length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              Ocupadas: {mesas.filter((m: any) => m.status === "ocupada").length}
            </span>
          </div>
        </div>
      </div>

      {/* Mesas grid */}
      {loadingMesas ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : mesas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">Nenhuma mesa cadastrada. Crie mesas no PDV Mesas primeiro.</p>
          <Button onClick={() => navigate("/lojista/pdv-mesas")}>Ir para PDV Mesas</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <AnimatePresence>
            {mesas.map((mesa: any, i: number) => {
              const comanda = getComandaForMesa(mesa.id);
              const pedidosProntos = comanda?.pdv_pedidos?.filter((p: any) => p.status_cozinha === "pronto")?.length || 0;
              const isOcupada = mesa.status === "ocupada";

              return (
                <motion.div
                  key={mesa.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    onClick={() => {
                      setSelectedMesa(mesa);
                      setCart([]);
                      setShowOrderModal(true);
                      if (!isOcupada) openComanda.mutate(mesa);
                    }}
                    className={`cursor-pointer border-2 hover:shadow-elevated transition-all select-none relative ${
                      isOcupada
                        ? "border-primary/40 bg-primary/5"
                        : "border-success/40 bg-success/5"
                    } ${pedidosProntos > 0 ? "ring-2 ring-secondary animate-pulse" : ""}`}
                  >
                    {pedidosProntos > 0 && (
                      <div className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
                        <Bell className="w-3 h-3" />
                      </div>
                    )}
                    <CardContent className="p-5 text-center">
                      <p className="text-lg font-bold font-display text-foreground mb-1">{mesa.nome}</p>
                      <Badge variant="outline" className={`text-[10px] mb-2 border ${
                        isOcupada ? "border-primary/40 text-primary" : "border-success/40 text-success"
                      }`}>
                        {isOcupada ? "Ocupada" : "Livre"}
                      </Badge>
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                        <Users className="w-3 h-3" /> {mesa.lugares}
                      </div>
                      {comanda && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold text-primary">
                            R$ {Number(comanda.total || 0).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      )}
                      {comanda?.data_abertura && (
                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" /> {getTimeSince(comanda.data_abertura)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Order Modal */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Novo Pedido — {selectedMesa?.nome}</span>
              {getComandaForMesa(selectedMesa?.id) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    closeComanda.mutate(selectedMesa.id);
                    setShowOrderModal(false);
                  }}
                >
                  Fechar Comanda
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto grid md:grid-cols-3 gap-4">
            {/* Products */}
            <div className="md:col-span-2 space-y-3">
              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
                {loadingProducts ? (
                  <div className="col-span-full flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filtered.map((p: any) => (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToCart(p)}
                    className="p-2 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-all text-center"
                  >
                    {p.imagem_url ? (
                      <div className="w-full aspect-square rounded-md overflow-hidden bg-muted mb-1">
                        <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center mb-1 text-3xl">🍽️</div>
                    )}
                    <p className="text-xs font-semibold text-foreground truncate">{p.nome}</p>
                    <p className="text-xs font-bold text-primary">R$ {Number(p.preco).toFixed(2).replace(".", ",")}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-foreground">Pedido</span>
              </div>
              {cart.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Adicione itens ao pedido</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{item.qty}x {item.weight ? `(${item.weight}${item.unidade_medida === "kg" ? "g" : "ml"}) ` : ""}{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          R$ {(item.price * item.qty).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-foreground text-sm">Total</span>
                    <span className="text-lg font-bold text-primary">
                      R$ {total.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <Button
                    className="w-full bg-gradient-cta text-accent-foreground font-bold border-0"
                    onClick={() => sendToKitchen.mutate()}
                    disabled={sendToKitchen.isPending}
                  >
                    {sendToKitchen.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChefHat className="w-4 h-4 mr-2" />}
                    Enviar para Cozinha
                  </Button>
                </div>
              )}

              {/* Existing orders for this mesa */}
              {selectedMesa && getComandaForMesa(selectedMesa.id)?.pdv_pedidos?.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Pedidos desta comanda</p>
                  {getComandaForMesa(selectedMesa.id).pdv_pedidos.map((p: any) => (
                    <div key={p.id} className="p-2 rounded-lg bg-muted/30 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className={`text-[9px] ${
                          p.status_cozinha === "pronto" ? "border-success text-success" :
                          p.status_cozinha === "preparando" ? "border-secondary text-secondary" :
                          p.status_cozinha === "entregue" ? "border-muted-foreground text-muted-foreground" :
                          "border-primary text-primary"
                        }`}>
                          {p.status_cozinha === "pendente" ? "Pendente" :
                           p.status_cozinha === "preparando" ? "Preparando" :
                           p.status_cozinha === "pronto" ? "Pronto!" :
                           "Entregue"}
                        </Badge>
                        <span className="text-muted-foreground">R$ {Number(p.total).toFixed(2).replace(".", ",")}</span>
                      </div>
                      {Array.isArray(p.items) && p.items.map((item: any, idx: number) => (
                        <p key={idx} className="text-muted-foreground">
                          {item.qtd || item.qty || 1}x {item.weight ? `(${item.weight}${item.unidade_medida === "kg" ? "g" : "ml"}) ` : ""}{item.nome || item.name}
                        </p>
                      ))}
                      {p.status_cozinha === "pronto" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-1 text-[10px] h-7 border-success text-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissReady(p.id);
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar como Entregue
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ready Orders Notification Modal */}
      <Dialog open={showReadyModal} onOpenChange={setShowReadyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-secondary" />
              Pedidos Prontos!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {readyOrders.map((order) => (
              <div key={order.pedido_id} className="p-3 rounded-lg border border-secondary/30 bg-secondary/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-foreground">{order.mesa_nome}</span>
                  <Badge className="bg-secondary text-secondary-foreground text-[10px]">Pronto!</Badge>
                </div>
                {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                  <p key={idx} className="text-sm text-muted-foreground">
                    {item.qtd || item.qty || 1}x {item.weight ? `(${item.weight}${item.unidade_medida === "kg" ? "g" : "ml"}) ` : ""}{item.nome || item.name}
                  </p>
                ))}
                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => dismissReady(order.pedido_id)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Entregar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PosWaiter;
