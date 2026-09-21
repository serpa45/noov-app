import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone, Navigation, Check, Truck, Clock,
  Package, User, Loader2, Bike, UserPlus, Copy, Trash2, Star, History,
  MapPin,
} from "lucide-react";
import DeliveryMap from "@/components/delivery/DeliveryMap";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusMap: Record<string, { label: string; className: string }> = {
  pendente: { label: "Para Entrega", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  aceita: { label: "Aceita", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  em_transito: { label: "Em trânsito", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  entregue: { label: "Entregue", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  cancelada: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const filterTabs = [
  { key: "all", label: "Todas" },
  { key: "pendente", label: "Para Entrega" },
  { key: "aceita", label: "Aceitas" },
  { key: "em_transito", label: "Em trânsito" },
  { key: "entregue", label: "Entregues" },
];

const Deliveries = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("all");
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [mapDelivery, setMapDelivery] = useState<any>(null);
  const [mapRouteInfo, setMapRouteInfo] = useState<{ distance?: string; duration?: string } | null>(null);

  // Fetch loja
  const { data: loja } = useQuery({
    queryKey: ["loja-info-deliveries", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, codigo_convite, nome, logo_url, horario_funcionamento, tolerancia_pedidos_min")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Tolerance countdown logic
  const [toleranceCountdown, setToleranceCountdown] = useState<string | null>(null);
  const isInTolerance = useRef(false);

  useEffect(() => {
    const horario = (loja as any)?.horario_funcionamento;
    if (!horario) return;

    const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

    const calcRemaining = () => {
      const now = new Date();
      const todayName = dayNames[now.getDay()];
      const todaySchedule = horario[todayName];
      const toleranciaMin = (loja as any)?.tolerancia_pedidos_min ?? 60;

      if (todaySchedule?.aberto && todaySchedule?.fim) {
        const [closeH, closeM] = todaySchedule.fim.split(":").map(Number);
        const closingTime = new Date(now);
        if (closeH < 12 && parseInt(todaySchedule.inicio) >= 12) {
          closingTime.setDate(closingTime.getDate() + 1);
        }
        closingTime.setHours(closeH, closeM, 0, 0);
        const toleranceEnd = new Date(closingTime.getTime() + toleranciaMin * 60000);

        if (now >= closingTime && now < toleranceEnd) {
          const remaining = toleranceEnd.getTime() - now.getTime();
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          isInTolerance.current = true;
          setToleranceCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
          return;
        }
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayName = dayNames[yesterday.getDay()];
      const yesterdaySchedule = horario[yesterdayName];

      if (yesterdaySchedule?.aberto && yesterdaySchedule?.fim) {
        const [closeH, closeM] = yesterdaySchedule.fim.split(":").map(Number);
        const closingTime = new Date(yesterday);
        if (closeH < 12 && parseInt(yesterdaySchedule.inicio) >= 12) {
          closingTime.setDate(closingTime.getDate() + 1);
        }
        closingTime.setHours(closeH, closeM, 0, 0);
        const toleranceEnd = new Date(closingTime.getTime() + toleranciaMin * 60000);

        if (now >= closingTime && now < toleranceEnd) {
          const remaining = toleranceEnd.getTime() - now.getTime();
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          isInTolerance.current = true;
          setToleranceCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
          return;
        }
      }

      if (isInTolerance.current) {
        isInTolerance.current = false;
        queryClient.invalidateQueries({ queryKey: ["entregas-lojista"] });
      }
      setToleranceCountdown(null);
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [loja, queryClient]);

  // Fetch linked entregadores with codigo_acesso
  const { data: entregadores = [] } = useQuery({
    queryKey: ["loja-entregadores", user?.id, loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const { data: links } = await (supabase as any)
        .from("loja_entregadores")
        .select("entregador_id, id")
        .eq("loja_id", loja.id);
      if (!links || links.length === 0) return [];

      const ids = links.map((l: any) => l.entregador_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, codigo_acesso")
        .in("user_id", ids);
      return (profiles || []).map((p) => ({
        ...p,
        link_id: links.find((l: any) => l.entregador_id === p.user_id)?.id,
      }));
    },
    enabled: !!user && !!loja,
  });

  // Fetch real deliveries — only today
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["entregas-lojista", user?.id, loja?.id],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (!loja) return [];
      const { data, error } = await supabase
        .from("entregas")
        .select("*, pedidos(*)")
        .eq("lojista_id", loja.id)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;

      const filteredData = (data || []).filter(d => d.entregador_id);
      const entregadorIds = [...new Set(filteredData.map((d) => d.entregador_id))];
      let nameMap: Record<string, string> = {};
      if (entregadorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", entregadorIds);
        nameMap = (profiles || []).reduce(
          (acc, p) => ({ ...acc, [p.user_id]: p.full_name || "Sem Nome" }),
          {} as Record<string, string>
        );
      }

      return (data || []).map((d) => {
        const rawPedido = (d as any).pedidos;
        const pedido = Array.isArray(rawPedido) ? rawPedido[0] : rawPedido;
        return {
          ...d,
          entregador_nome: d.entregador_id ? (nameMap[d.entregador_id] || "Carregando...") : null,
          pedido: pedido || null,
        };
      });
    },
    enabled: !!user && !!loja,
  });

  // Realtime subscription for deliveries
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('entregas-lojista-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, () => {
        queryClient.invalidateQueries({ queryKey: ["entregas-lojista"] });
        queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Register driver
  const handleRegisterDriver = async () => {
    if (!newDriverName.trim() || !loja) return;
    setRegisterLoading(true);
    setGeneratedCode("");
    try {
      const { data, error } = await supabase.functions.invoke("registrar-entregador", {
        body: { nome: newDriverName.trim(), telefone: newDriverPhone.trim(), loja_id: loja.id },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "Erro ao cadastrar", variant: "destructive" });
      } else {
        setGeneratedCode(data.codigo_acesso);
        queryClient.invalidateQueries({ queryKey: ["loja-entregadores"] });
        toast({ title: "Entregador cadastrado! 🎉" });
      }
    } catch {
      toast({ title: "Erro ao cadastrar entregador", variant: "destructive" });
    }
    setRegisterLoading(false);
  };

  // Remove driver
  const removeDriver = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase as any)
        .from("loja_entregadores")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-entregadores"] });
      toast({ title: "Entregador removido" });
    },
  });

  const assignDriver = useMutation({
    mutationFn: async ({ deliveryId, entregadorId }: { deliveryId: string; entregadorId: string }) => {
      // Get delivery to find pedido_id
      const delivery = deliveries.find(d => d.id === deliveryId);
      const driver = entregadores.find((e: any) => e.user_id === entregadorId);
      
      const { error } = await supabase
        .from("entregas")
        .update({ 
          entregador_id: entregadorId,
          status: "aceita",
          aceita_em: new Date().toISOString()
        })
        .eq("id", deliveryId);
      
      if (error) throw error;

      // Update pedido status as well
      if (delivery?.pedido_id) {
        const currentHistorico = Array.isArray((delivery.pedido as any)?.status_historico) 
          ? (delivery.pedido as any).status_historico 
          : [];
          
        await supabase.from("pedidos").update({
          status: "aceita",
          status_historico: [
            ...currentHistorico,
            { 
              status: "aceita", 
              timestamp: new Date().toISOString(),
              entregador_id: entregadorId,
              entregador_nome: driver?.full_name || "Entregador"
            },
          ],
        }).eq("id", delivery.pedido_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-lojista"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({ title: "Entregador designado! 🛵" });
    },
  });
  

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado! 📋" });
  };

  const pedidoIdParam = searchParams.get("pedido_id");

  const filtered = deliveries.filter((d) => {
    if (pedidoIdParam && d.pedido_id === pedidoIdParam) return true;
    if (activeTab === "all") return true;
    return d.status === activeTab;
  });

  const stats = {
    total: deliveries.length,
    active: deliveries.filter((d) => ["aceita", "em_transito"].includes(d.status)).length,
    pending: deliveries.filter((d) => d.status === "pendente").length,
    delivered: deliveries.filter((d) => d.status === "entregue").length,
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      {/* Tolerance countdown banner */}
      {toleranceCountdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
                Estabelecimento fechado — tolerância ativa
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                As entregas do dia serão zeradas em <strong className="font-mono text-base">{toleranceCountdown}</strong>. 
                Após esse período, consulte o <strong>Histórico de Entregas</strong>.
              </p>
            </div>
          </div>
        </motion.div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Gerencie entregas e entregadores</p>
        </div>
        <Button
          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          onClick={() => { setDriverDialogOpen(true); setGeneratedCode(""); setNewDriverName(""); setNewDriverPhone(""); }}
        >
          <UserPlus className="w-4 h-4 mr-2" /> Criar Entregador
        </Button>
      </div>

      {/* Driver Registration Dialog */}
      <Dialog open={driverDialogOpen} onOpenChange={setDriverDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Cadastrar Entregador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {!generatedCode ? (
              <>
                <div>
                  <Label className="text-xs font-medium">Nome do entregador *</Label>
                  <Input
                    className="mt-1"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Telefone</Label>
                  <Input
                    className="mt-1"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <Button
                  onClick={handleRegisterDriver}
                  disabled={!newDriverName.trim() || registerLoading}
                  className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold"
                >
                  {registerLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Cadastrar
                </Button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                  <Check className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex flex-col items-center">
                  {loja?.logo_url && (
                    <img src={loja.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mb-3 shadow-sm border border-border/50" />
                  )}
                  <p className="text-sm text-muted-foreground mb-2">
                    Entregador <span className="font-bold text-foreground">{newDriverName}</span> cadastrado!
                  </p>
                  <p className="text-xs text-muted-foreground">Código de acesso para o entregador:</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-center gap-3">
                  <span className="text-3xl font-bold font-display tracking-[0.3em] text-primary">
                    {generatedCode}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyCode(generatedCode)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe o código e o link abaixo com o entregador:
                </p>
                <div className="flex flex-col gap-2">
                  <div className="bg-muted/30 rounded-lg p-2 text-xs font-mono break-all flex items-center justify-between gap-2 border border-border/50">
                    <span className="truncate flex-1">
                      {window.location.origin}/entregador/login?logo={encodeURIComponent(loja?.logo_url || "")}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0" 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/entregador/login?logo=${encodeURIComponent(loja?.logo_url || "")}`);
                        toast({ title: "Link copiado! 📋" });
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setGeneratedCode(""); setNewDriverName(""); setNewDriverPhone(""); }}>
                  Cadastrar outro
                </Button>
              </div>
            )}

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Entregadores vinculados ({entregadores.length})</h4>
              {entregadores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum entregador cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {entregadores.map((e: any) => (
                    <div key={e.user_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border/50">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bike className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.full_name || "Entregador"}</p>
                        <div className="flex items-center gap-2">
                          {e.phone && <p className="text-xs text-muted-foreground">{e.phone}</p>}
                          {e.codigo_acesso && (
                            <button
                              onClick={() => copyCode(e.codigo_acesso)}
                              className="text-xs text-primary font-mono flex items-center gap-0.5 hover:underline"
                            >
                              <Copy className="w-2.5 h-2.5" /> {e.codigo_acesso}
                            </button>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => e.link_id && removeDriver.mutate(e.link_id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Entregas", value: stats.total, icon: Package, color: "text-primary" },
          { label: "Para Entrega", value: stats.pending, icon: Clock, color: "text-yellow-600" },
          { label: "Em andamento", value: stats.active, icon: Navigation, color: "text-blue-600" },
          { label: "Entregues", value: stats.delivered, icon: Check, color: "text-green-600" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted/50 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors relative ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border/50"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1.5 text-[10px] font-bold opacity-70">({deliveries.filter((d) => d.status === tab.key).length})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 whitespace-nowrap border-dashed border-primary/50 text-primary hover:bg-primary/5"
            onClick={() => navigate("/lojista/entregas/historico")}
          >
            <History className="w-4 h-4" />
            Histórico
          </Button>
        </div>
      </div>

      {/* Delivery list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground"
              >
                <Truck className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhuma entrega encontrada</p>
                <p className="text-sm mt-1">As entregas aparecem aqui quando o pedido sair para entrega</p>
              </motion.div>
            )}

            {filtered.map((d: any, i) => {
              const st = statusMap[d.status] || { label: d.status, className: "bg-muted text-muted-foreground" };
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="border-border/50 shadow-card hover:shadow-elevated transition-shadow">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex flex-col gap-2">
                        <div className="w-full">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold font-display text-sm text-foreground">
                              Nº {d.pedido?.numero_diario ? String(d.pedido.numero_diario).padStart(3, "0") : d.id.slice(0, 6)}
                            </span>
                             <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                               <Clock className="w-2.5 h-2.5" /> {formatTime(d.created_at)}
                             </span>
                            {d.pedido?.avaliacao && (
                              <div className="flex items-center gap-0.5 ml-2">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} className={`w-3 h-3 ${s <= d.pedido.avaliacao ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                                ))}
                                <span className="text-[10px] font-bold text-yellow-600 ml-1">{d.pedido.avaliacao}/5</span>
                              </div>
                            )}
                            <Badge variant="outline" className={`text-[10px] py-0 h-4 ml-auto ${st.className}`}>
                               {st.label}
                             </Badge>
                          </div>

                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                              <Bike className="w-3 h-3 text-primary" />
                            </div>
                             <span className="text-xs font-semibold text-foreground">
                               {d.entregador_id ? (
                                 <span className="font-bold">{d.entregador_nome}</span>
                               ) : (
                                 <span className="text-destructive font-bold animate-pulse flex items-center gap-1 text-[10px]">
                                   <Clock className="w-2.5 h-2.5" /> AGUARDANDO ACEITE
                                 </span>
                               )}
                             </span>
                           </div>

                          {d.pedido?.cliente_nome && (
                             <p className="text-[11px] text-muted-foreground">
                               <Package className="w-2.5 h-2.5 inline mr-1" />
                               {d.pedido.cliente_nome}
                               {d.pedido.cliente_telefone && (
                                 <span className="ml-2">
                                   <Phone className="w-2.5 h-2.5 inline mr-0.5" />
                                   {d.pedido.cliente_telefone}
                                 </span>
                               )}
                             </p>
                          )}

                          {d.endereco_entrega && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight break-words">
                              <MapPin className="w-2.5 h-2.5 inline mr-1" />
                              {d.endereco_entrega}
                            </p>
                          )}

                          {["pendente", "aceita"].includes(d.status) && entregadores.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                                  {d.entregador_id ? "Trocar entregador:" : "Designar entregador:"}
                                </p>
                              </div>
                              <div className="flex flex-row flex-wrap gap-1.5">
                              {entregadores.map((e: any) => {
                                const isSelected = d.entregador_id === e.user_id;
                                return (
                                  <Button
                                    key={e.user_id}
                                    size="sm"
                                    variant={isSelected ? "default" : "outline"}
                                    className={`h-6 text-[9px] px-1.5 font-bold shrink-0 ${isSelected ? "bg-primary text-white" : "border-primary/20 text-primary hover:bg-primary/5"}`}
                                    onClick={() => assignDriver.mutate({ deliveryId: d.id, entregadorId: e.user_id })}
                                    disabled={assignDriver.isPending}
                                  >
                                    <Bike className={`w-3 h-3 mr-1 ${isSelected ? "text-white" : "text-primary"}`} />
                                    {e.full_name?.split(" ")[0]}
                                  </Button>
                                );
                              })}
                              </div>
                            </div>
                          )}
                          {d.observacoes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{d.observacoes}"</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-2">
                          <div className="flex flex-col">
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Valor Total:</p>
                            <p className="text-sm font-bold text-foreground">{formatCurrency(Number((d as any).valor_total || d.pedido?.total || 0))}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-primary uppercase font-semibold">Taxa de Entrega:</p>
                            <p className="text-lg font-bold font-display text-primary">
                              {formatCurrency(Number(d.valor_entrega))}
                            </p>
                          </div>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Map Dialog */}
      <Dialog open={!!mapDelivery} onOpenChange={(open) => { if (!open) { setMapDelivery(null); setMapRouteInfo(null); } }}>
        <DialogContent className="max-w-[90vw] w-[90vw] max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-3 pb-1 shrink-0">
            <DialogTitle className="font-display text-sm flex items-center gap-2 pr-8">
              Rastreio — Nº {mapDelivery?.pedido?.numero_diario ? String(mapDelivery.pedido.numero_diario).padStart(3, "0") : mapDelivery?.id?.slice(0, 6)}
            </DialogTitle>
          </DialogHeader>

          <div className="px-3 pb-3 flex-1 min-h-0">
            <div className="w-full h-[70vh]">
              <DeliveryMap
                driverLat={mapDelivery?.latitude_atual}
                driverLng={mapDelivery?.longitude_atual}
                destLat={mapDelivery?.pedido?.latitude_entrega}
                destLng={mapDelivery?.pedido?.longitude_entrega}
                showBottomBar={true}
                fullscreen={true}
                fitToRoute={true}
                onRouteInfo={setMapRouteInfo}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deliveries;
