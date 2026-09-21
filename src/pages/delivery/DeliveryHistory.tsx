import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Truck, Clock, DollarSign, TrendingUp,
  CheckCircle, Package, CalendarIcon, ChevronRight, MapPin, Star, History
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  format, parseISO, startOfDay, endOfDay, subDays,
  startOfMonth, startOfYear
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type FilterPeriod = "today" | "week" | "month" | "year" | "custom";
type Entrega = Tables<"entregas"> & { pedido?: any };

const periodFilters: { value: FilterPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "custom", label: "Período" },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  entregue: { label: "Entregue", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  cancelada: { label: "Cancelado", color: "text-red-500", bg: "bg-red-500/10" },
  em_transito: { label: "Em trânsito", color: "text-blue-600", bg: "bg-blue-500/10" },
  pendente: { label: "Pendente", color: "text-amber-600", bg: "bg-amber-500/10" },
  aceita: { label: "Aceita", color: "text-blue-600", bg: "bg-blue-500/10" },
  coletado: { label: "Coletado", color: "text-orange-600", bg: "bg-orange-500/10" },
};

export default function DeliveryHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<FilterPeriod>("month");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week": return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "month": return { start: startOfMonth(now), end: endOfDay(now) };
      case "year": return { start: startOfYear(now), end: endOfDay(now) };
      case "custom": return {
        start: customRange.from ? startOfDay(customRange.from) : startOfMonth(now),
        end: customRange.to ? endOfDay(customRange.to) : endOfDay(now),
      };
    }
  }, [period, customRange]);

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ["entregador-historico", user?.id, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas")
        .select("*, pedidos(*)")
        .eq("entregador_id", user!.id)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      return (data || []).map(d => {
        const rawPedido = (d as any).pedidos;
        const pedido = Array.isArray(rawPedido) ? rawPedido[0] : rawPedido;
        return { ...d, pedido: pedido || null } as Entrega;
      });
    },
    enabled: !!user,
  });

  const totalEntregas = entregas.length;
  const entregasConcluidas = entregas.filter(e => e.status === "entregue").length;
  const totalGanhos = entregas.filter(e => e.status === "entregue").reduce((s, e) => s + Number(e.valor_entrega), 0);
  const mediaPorEntrega = entregasConcluidas > 0 ? totalGanhos / entregasConcluidas : 0;

  const selected = entregas.find(e => e.id === selectedId);

  const calcDuration = (timestamps: any) => {
    if (!timestamps) return null;
    const t = typeof timestamps === "string" ? JSON.parse(timestamps) : timestamps;
    const start = t.aceita || t.coletado;
    const end = t.entregue;
    if (!start || !end) return null;
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    return mins > 0 ? `${mins} min` : null;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 h-14 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/entregador")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <p className="text-sm font-black font-display">Histórico de Entregas</p>
          <p className="text-[10px] text-muted-foreground">Acompanhe seus ganhos</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Period Filters */}
        <div className="flex flex-wrap gap-2">
          {periodFilters.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                period === p.value
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-card text-muted-foreground border border-border/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl">
                  <CalendarIcon className="w-3 h-3" />
                  {customRange.from ? format(customRange.from, "dd/MM/yy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customRange.from} onSelect={d => setCustomRange(prev => ({ ...prev, from: d }))} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl">
                  <CalendarIcon className="w-3 h-3" />
                  {customRange.to ? format(customRange.to, "dd/MM/yy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customRange.to} onSelect={d => setCustomRange(prev => ({ ...prev, to: d }))} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <Card className="border-border/40 bg-emerald-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Ganhos</p>
                <p className="text-base font-black text-emerald-600">{fmt(totalGanhos)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Concluídas</p>
                <p className="text-base font-black text-primary">{entregasConcluidas}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Total</p>
                <p className="text-base font-black">{totalEntregas}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Média</p>
                <p className="text-base font-black text-amber-600">{fmt(mediaPorEntrega)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delivery List */}
        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Entregas no período</h3>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entregas.length === 0 ? (
          <div className="text-center py-16 space-y-3 opacity-50">
            <Package className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma entrega neste período</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entregas.map(e => {
              const cfg = statusConfig[e.status] || statusConfig.pendente;
              const duration = calcDuration(e.status_timestamps);
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 py-3 px-1 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(e.id)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Truck className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">
                        Nº {e.pedido?.numero_diario ? String(e.pedido.numero_diario).padStart(3, "0") : e.id.slice(0, 4)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {format(parseISO(e.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {duration && ` • ${duration}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`text-[8px] font-bold uppercase ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs font-black text-emerald-600">{fmt(Number(e.valor_entrega))}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={o => { if (!o) setSelectedId(null); }}>
        <DialogContent className="max-w-md p-0 rounded-t-[24px] sm:rounded-[24px] gap-0 border-0 overflow-hidden top-auto bottom-0 left-0 right-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
          {selected && (() => {
            const pedido = selected.pedido;
            const items = pedido?.items ? (Array.isArray(pedido.items) ? pedido.items : []) : [];
            const cfg = statusConfig[selected.status] || statusConfig.pendente;
            const timestamps = typeof selected.status_timestamps === "string"
              ? JSON.parse(selected.status_timestamps as string)
              : (selected.status_timestamps || {});

            return (
              <div className="max-h-[85vh] overflow-y-auto p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cfg.bg}`}>
                    <Truck className={`w-6 h-6 ${cfg.color}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black font-display">
                      Nº {pedido?.numero_diario ? String(pedido.numero_diario).padStart(3, "0") : selected.id.slice(0, 4)}
                    </h2>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(selected.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-500/5 rounded-xl p-3 text-center">
                    <DollarSign className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs font-black text-emerald-600">{fmt(Number(selected.valor_entrega))}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">VALOR</p>
                  </div>
                  <div className="bg-blue-500/5 rounded-xl p-3 text-center">
                    <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs font-black">{calcDuration(selected.status_timestamps) || "—"}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">TEMPO</p>
                  </div>
                  <div className="bg-amber-500/5 rounded-xl p-3 text-center">
                    <MapPin className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                    <p className="text-xs font-black truncate">{selected.endereco_entrega?.split(",")[0] || "—"}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">LOCAL</p>
                  </div>
                </div>

                {/* Timeline removed */}

                {/* Client */}
                {pedido && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Cliente</p>
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                      <p className="text-sm font-bold">{pedido.cliente_nome || "Não informado"}</p>
                      {pedido.cliente_telefone && <p className="text-xs text-muted-foreground">{pedido.cliente_telefone}</p>}
                      {pedido.endereco_entrega && <p className="text-xs text-muted-foreground">{pedido.endereco_entrega}</p>}
                      {pedido.avaliacao && (
                        <div className="flex items-center gap-1 pt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < pedido.avaliacao ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Products */}
                {items.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Produtos</p>
                    <div className="divide-y divide-border/30 bg-muted/30 rounded-xl overflow-hidden">
                      {items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2">
                          <div>
                            <p className="text-xs font-bold">{item.nome || item.name || "Item"}</p>
                            <p className="text-[10px] text-muted-foreground">Qtd: {item.quantidade || item.qty || 1}</p>
                          </div>
                          <span className="text-xs font-black">
                            {fmt(Number(item.preco || item.total || 0) * Number(item.quantidade || item.qty || 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-dashed space-y-1">
                      {(() => {
                        const subtotal = (items || []).reduce((acc: number, item: any) => 
                          acc + (item.preco_total || (item.preco || 0) * (item.quantidade || 1)), 0);
                        const deliveryFee = Number(selected.valor_entrega || 0);
                        const total = subtotal + deliveryFee;
                        return (
                          <>
                            <div className="flex justify-between px-1">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Subtotal</span>
                              <span className="text-xs font-bold">{fmt(subtotal)}</span>
                            </div>
                            <div className="flex justify-between px-1">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Entrega</span>
                              <span className="text-xs font-bold text-primary">{fmt(deliveryFee)}</span>
                            </div>
                            <div className="flex justify-between px-1 pt-1 border-t border-dashed">
                              <span className="text-xs font-black uppercase">Total do Pedido</span>
                              <span className="text-xs font-black text-emerald-600">{fmt(total)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-30 bg-background/90 backdrop-blur-xl border-t border-border/40 safe-area-bottom">
        <div className="flex max-w-lg mx-auto">
          <button
            className="flex-1 flex flex-col items-center gap-1 py-3 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate("/entregador")}
          >
            <Package className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-wider">Pedidos</span>
          </button>
          <button
            className="flex-1 flex flex-col items-center gap-1 py-3 text-primary"
          >
            <History className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-wider">Histórico</span>
          </button>
        </div>
      </nav>
    </div>
  );
}