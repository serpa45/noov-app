import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrackingMap } from "@/components/delivery/TrackingMap";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike, CheckCircle, Navigation, MapPin, Clock, Phone, ArrowLeft, Loader2,
  Package, Store
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; color: string; icon: any; order: number }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock, order: 1 },
  aceito: { label: "Aceito", color: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle, order: 2 },
  preparando: { label: "Preparando", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: Package, order: 3 },
  aceita: { label: "Entregador a caminho da loja", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: Bike, order: 4 },
  coletado: { label: "Pedido Coletado", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: Package, order: 5 },
  saiu_entrega: { label: "Saiu para Entrega", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Navigation, order: 6 },
  em_transito: { label: "Entregador a caminho de você", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Navigation, order: 7 },
  entregue: { label: "Entregue!", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle, order: 8 },
  finalizado: { label: "Concluído!", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle, order: 9 },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Clock, order: 0 },
};

const OrderTracking = () => {
  const { id } = useParams<{ id: string }>();
  const [pedido, setPedido] = useState<any>(null);
  const [entrega, setEntrega] = useState<any>(null);
  const [loja, setLoja] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const isDemo = id === "demo";

  useEffect(() => {
    if (!id || isDemo) {
      if (isDemo) {
        setPedido({ 
          id: "demo", 
          numero_diario: 0, 
          status: "saiu_entrega", 
          items: [
            { nome: "Pizza Margherita", quantidade: 2, preco: 35 }, 
            { nome: "Refrigerante", quantidade: 1, preco: 8 }
          ], 
          total: 78, 
          endereco_entrega: "Av. Paulista, 1000 - São Paulo" 
        });
        setLoja({ 
          nome: "Pizzaria Demo", 
          telefone: "11999999999",
          logo_url: "https://api.dicebear.com/7.x/initials/svg?seed=P"
        });
        setEntrega({ 
          status: "saiu_entrega",
          entregador: {
            full_name: "João Silva",
            avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=J"
          }
        });
        setLoading(false);
      }
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch order
        const { data: orderData, error: orderError } = await supabase
          .from("pedidos")
          .select("*")
          .eq("id", id)
          .single();

        if (orderError) throw orderError;
        setPedido(orderData);

        // Fetch store by lojista_id (user_id)
        const { data: storeData } = await supabase
          .from("lojas")
          .select("*")
          .eq("user_id", orderData.lojista_id)
          .maybeSingle();
        setLoja(storeData);

        // Fetch delivery
        const { data: deliveryData } = await supabase
          .from("entregas")
          .select("*")
          .eq("pedido_id", id)
          .maybeSingle();

        if (deliveryData) {
          // Fetch driver profile separately if assigned
          if (deliveryData.entregador_id) {
            const { data: driverProfile } = await supabase
              .from("profiles")
              .select("avatar_url, full_name")
              .eq("user_id", deliveryData.entregador_id)
              .maybeSingle();
            setEntrega({ ...deliveryData, entregador: driverProfile });
          } else {
            setEntrega(deliveryData);
          }
        }

        setLoading(false);
      } catch (error: any) {
        console.error("Error fetching tracking data:", error);
        toast({ title: "Erro", description: "Não foi possível carregar os dados do pedido", variant: "destructive" });
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to realtime updates
    const pedidoSub = supabase
      .channel(`pedido-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${id}` }, (payload) => {
        setPedido((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    const entregaSub = supabase
      .channel(`entrega-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "entregas", filter: `pedido_id=eq.${id}` }, (payload) => {
        setEntrega((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pedidoSub);
      supabase.removeChannel(entregaSub);
    };
  }, [id]);
  
  // Update driver details when assigned
  useEffect(() => {
    if (entrega?.entregador_id && !entrega.entregador) {
      const fetchEntregador = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("avatar_url, full_name")
          .eq("id", entrega.entregador_id)
          .maybeSingle();
        if (data) {
          setEntrega((prev: any) => ({ ...prev, entregador: data }));
        }
      };
      fetchEntregador();
    }
  }, [entrega?.entregador_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <p className="text-muted-foreground animate-pulse font-medium">Localizando seu pedido...</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <ArrowLeft className="w-10 h-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold font-display mb-2">Pedido não encontrado</h2>
        <p className="text-muted-foreground mb-8">O código do pedido é inválido ou ele expirou.</p>
        <Button onClick={() => navigate("/")} className="w-full max-w-xs">Voltar para o Início</Button>
      </div>
    );
  }

  const currentStatus = (entrega?.status || pedido.status) as string;
  const config = statusConfig[currentStatus] || statusConfig.pendente;
  const StatusIcon = config.icon;

  const isOutForDelivery = ["coletado", "saiu_entrega", "em_transito", "entregue"].includes(currentStatus);
  
  const driverLoc: [number, number] | null = (entrega?.latitude_atual && entrega?.longitude_atual && isOutForDelivery) 
    ? [Number(entrega.latitude_atual), Number(entrega.longitude_atual)] 
    : null;
  const customerLoc: [number, number] | null = pedido?.latitude_entrega && pedido?.longitude_entrega 
    ? [Number(pedido.latitude_entrega), Number(pedido.longitude_entrega)] 
    : null;
  
  // Store location from loja address (show only before collection)
  const storeLoc: [number, number] | null = null; // Could be derived from loja coords if available
  const showStore = !isOutForDelivery;

  const steps = ["pendente", "aceito", "preparando", "aceita", "coletado", "saiu_entrega", "finalizado"];
  const normalizedStatus = currentStatus;
  const currentStepIndex = steps.indexOf(normalizedStatus === "cancelado" ? "pendente" : (normalizedStatus === "em_transito" ? "saiu_entrega" : (normalizedStatus === "entregue" ? "finalizado" : (normalizedStatus === "coletado" ? "coletado" : normalizedStatus))));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-sm font-bold font-display">Acompanhamento</h1>
            <p className="text-[10px] text-muted-foreground">Pedido Nº {pedido.numero_diario || pedido.id.slice(0, 4)}</p>
          </div>
        </div>
        <Badge variant="outline" className={`${config.color} border-0`}>
          {config.label}
        </Badge>
      </header>

      {/* Map Section */}
      <div className="relative" style={{ height: "40vh" }}>
        <TrackingMap 
          driverLoc={driverLoc} 
          customerLoc={customerLoc} 
          storeLoc={showStore ? storeLoc : null} 
          simulationMode={isDemo || (!driverLoc && !customerLoc)}
          storeLogo={loja?.logo_url}
          driverPhoto={entrega?.entregador?.avatar_url}
          driverName={entrega?.entregador?.full_name}
        />
        
        {/* Floating status card */}
        <div className="absolute top-4 left-4 right-4 z-[1000]">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <Card className="border-border/50 shadow-elevated bg-card/90 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${config.color}`}>
                  <StatusIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Status Atual</p>
                  <p className="text-base font-bold text-foreground line-clamp-1">{config.label}</p>
                </div>
                {entrega?.entregador_id && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0 animate-pulse">
                    AO VIVO
                  </Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Bottom Sheet Details */}
      <div className="bg-card border-t border-border rounded-t-[32px] shadow-2xl z-30 -mt-8 pb-safe">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto my-3" />
        <div className="px-6 py-2 space-y-6 overflow-y-auto max-h-[50vh]">
          
          {/* Progress bar */}
          <div className="flex justify-between items-center px-2">
            {steps.map((step, i) => {
              const stepConfig = statusConfig[step];
              const StepIcon = stepConfig.icon;
              const isActive = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;

              return (
                <div key={step} className="flex-1 flex flex-col items-center gap-1.5 relative">
                  {i < steps.length - 1 && (
                    <div className={`absolute left-1/2 w-full h-[2px] top-4 -z-10 transition-colors ${
                      i < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 ${
                    isActive ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                  }`}>
                    <StepIcon className="w-4 h-4" />
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-primary absolute -bottom-5 whitespace-nowrap">
                      {stepConfig.label.split(" ")[0]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 space-y-5">
            {/* Store & Driver Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Store className="w-3 h-3" /> Loja
                </p>
                <p className="text-sm font-bold text-foreground truncate">{loja?.nome || "Loja"}</p>
              </div>
              {entrega?.entregador_id ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <Bike className="w-3 h-3" /> Entregador
                  </p>
                  <p className="text-sm font-bold text-foreground truncate">🛵 Em trânsito</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Estimativa
                  </p>
                  <p className="text-sm font-bold text-foreground">30-45 min</p>
                </div>
              )}
            </div>

            {/* Address */}
            <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">Local de Entrega</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pedido.endereco_entrega}</p>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-display">Resumo do Pedido</h3>
                <p className="text-xs font-bold text-primary">R$ {Number(pedido.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-2 scrollbar-none">
                {Array.isArray(pedido.items) && pedido.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{item.qty || item.quantidade}x {item.weight ? `(${item.weight}g) ` : ""}{item.name || item.nome}</span>
                      {item.weightMode === "value" && (
                        <p className="text-[10px] text-primary font-medium">Escolhido por valor</p>
                      )}
                    </div>
                    <span className="ml-2">R$ {Number((item.price || item.preco) * (item.qty || item.quantidade) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Support button */}
            {loja?.telefone && (
              <Button
                variant="outline"
                className="w-full rounded-2xl border-border/50 h-12 text-sm font-bold"
                onClick={() => window.open(`tel:${loja.telefone}`)}
              >
                <Phone className="w-4 h-4 mr-2" /> Falar com a loja
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
