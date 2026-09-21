import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Truck, Clock, MapPin, Star, Package, User, Phone, CalendarIcon, Printer, Copy, ExternalLink, Wallet, History, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, subDays, startOfDay, endOfDay, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FilterPeriod = "today" | "week" | "month" | "year" | "custom";

const periodFilters: { value: FilterPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "custom", label: "Personalizado" },
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MotoboyDetail() {
  const { entregadorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedEntrega, setSelectedEntrega] = useState<string | null>(null);
  const [period, setPeriod] = useState<FilterPeriod>("month");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [customPaymentValue, setCustomPaymentValue] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"standard" | "custom">("standard");

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

  const { data: loja } = useQuery({
    queryKey: ["loja-for-motoboy", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["motoboy-profile", entregadorId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", entregadorId!).single();
      return data;
    },
    enabled: !!entregadorId,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["motoboy-entregas", loja?.id, entregadorId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas")
        .select("*, pedidos(numero_diario, cliente_nome)")
        .eq("lojista_id", loja!.id)
        .eq("entregador_id", entregadorId!)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      return (data || []).map((d: any) => {
        const pedido = Array.isArray(d.pedidos) ? d.pedidos[0] : d.pedidos;
        return { ...d, pedido };
      });
    },
    enabled: !!loja && !!entregadorId,
  });

  const entregaSelecionada = entregas.find(e => e.id === selectedEntrega);

  const { data: pedidoDetalhe } = useQuery({
    queryKey: ["pedido-entrega", entregaSelecionada?.pedido_id],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos").select("*").eq("id", entregaSelecionada!.pedido_id!).single();
      return data;
    },
    enabled: !!entregaSelecionada?.pedido_id,
  });

  const { data: pagamentosHistorico = [], refetch: refetchPagamentos } = useQuery({
    queryKey: ["motoboy-pagamentos", entregadorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregador_pagamentos")
        .select("*")
        .eq("entregador_id", entregadorId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!entregadorId,
  });

  const totalEntregas = entregas.length;
  const totalValor = entregas.reduce((s, e) => s + Number(e.valor_entrega), 0);
  const entregasConcluidas = entregas.filter(e => e.status === "entregue").length;

  const entregasPendentes = useMemo(() => {
    return entregas.filter(e => !e.pago && e.status === "entregue");
  }, [entregas]);

  const entregasHojePendentes = useMemo(() => {
    const hoje = new Date();
    const start = startOfDay(hoje);
    const end = endOfDay(hoje);
    return entregasPendentes.filter(e => {
      const date = new Date(e.created_at);
      return date >= start && date <= end;
    });
  }, [entregasPendentes]);

  const entregasAnterioresPendentes = useMemo(() => {
    const hoje = startOfDay(new Date());
    return entregasPendentes.filter(e => new Date(e.created_at) < hoje);
  }, [entregasPendentes]);

  const valorHojePendente = entregasHojePendentes.reduce((s, e) => s + Number(e.valor_entrega), 0);
  const valorAnteriorPendente = entregasAnterioresPendentes.reduce((s, e) => s + Number(e.valor_entrega), 0);
  const valorTotalPendente = entregasPendentes.reduce((s, e) => s + Number(e.valor_entrega), 0);

  const handlePayment = async () => {
    const paymentValue = paymentMode === "custom" ? Number(customPaymentValue.replace(",", ".")) : valorHojePendente;
    const targetDeliveries = paymentMode === "standard" ? entregasHojePendentes : entregasPendentes;
    
    if (paymentMode === "standard" && entregasHojePendentes.length === 0) return;
    if (paymentMode === "custom" && (!paymentValue || paymentValue <= 0)) {
      toast.error("Informe um valor válido para o pagamento");
      return;
    }
    
    setIsProcessingPayment(true);
    try {
      const { data: store } = await supabase.from("lojas").select("id").eq("user_id", user!.id).single();
      if (!store) throw new Error("Loja não encontrada");

      // 1. Create payment record
      const { error: pError } = await supabase.from("entregador_pagamentos").insert({
        entregador_id: entregadorId,
        lojista_id: store.id,
        valor: paymentValue,
        periodo_inicio: startOfDay(new Date()).toISOString(),
        periodo_fim: endOfDay(new Date()).toISOString(),
        quantidade_entregas: targetDeliveries.length,
      });

      if (pError) throw pError;

      // 2. Add to expenses
      const { error: eError } = await supabase.from("despesas").insert({
        loja_id: store.id,
        categoria: "Pagamento Motoboy",
        descricao: `Pagamento Motoboy ${profile?.full_name || entregadorId} ${paymentMode === "custom" ? "(Valor Manual)" : ""}`,
        valor: paymentValue,
        data: format(new Date(), "yyyy-MM-dd"),
      });

      if (eError) throw eError;

      // 3. Mark deliveries as paid
      if (targetDeliveries.length > 0) {
        const { error: uError } = await supabase
          .from("entregas")
          .update({ pago: true })
          .in("id", targetDeliveries.map(e => e.id));

        if (uError) throw uError;
      }

      toast.success("Pagamento realizado com sucesso!");
      setIsPaymentDialogOpen(false);
      setCustomPaymentValue("");
      setPaymentMode("standard");
      refetchPagamentos();
      // Refetch entregas to update status
      queryClient.invalidateQueries({ queryKey: ["motoboy-entregas"] });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao realizar pagamento: " + error.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "entregue": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "em_transito": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "cancelado": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "entregue": return "Entregue";
      case "em_transito": return "Em trânsito";
      case "coletado": return "Coletado";
      case "cancelado": return "Cancelado";
      default: return status;
    }
  };

  const calcDuration = (timestamps: any) => {
    if (!timestamps) return null;
    const t = typeof timestamps === "string" ? JSON.parse(timestamps) : timestamps;
    const start = t.coletado || t.aceito;
    const end = t.entregue || t.concluido;
    if (!start || !end) return null;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(diff / 60000);
    return mins > 0 ? `${mins} min` : null;
  };

  // Detail view for a selected delivery
  if (selectedEntrega && entregaSelecionada) {
    const timestamps = typeof entregaSelecionada.status_timestamps === "string"
      ? JSON.parse(entregaSelecionada.status_timestamps as string)
      : (entregaSelecionada.status_timestamps || {});
    const items = pedidoDetalhe?.items
      ? (Array.isArray(pedidoDetalhe.items) ? pedidoDetalhe.items : [])
      : [];

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedEntrega(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display">Detalhes da Entrega</h2>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(entregaSelecionada.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Truck className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Entrega</p>
                <p className="text-sm font-bold text-green-600">{fmt(Number(entregaSelecionada.valor_entrega))}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo de Entrega</p>
                <p className="text-sm font-bold">{calcDuration(entregaSelecionada.status_timestamps) || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Endereço</p>
                <p className="text-xs font-medium truncate max-w-[160px]">{entregaSelecionada.endereco_entrega || "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Timeline de Status</h3>
            <div className="space-y-3">
              {Object.entries(timestamps).filter(([, v]) => !!v).map(([key, val]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(val as string), "HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Client info */}
        {pedidoDetalhe && (
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground">Nome</p>
                  <p className="font-medium">{pedidoDetalhe.cliente_nome || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Telefone</p>
                  <p className="font-medium">{pedidoDetalhe.cliente_telefone || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground">Endereço</p>
                  <p className="font-medium">{pedidoDetalhe.endereco_entrega || "—"}</p>
                </div>
              </div>
              {pedidoDetalhe.avaliacao && (
                <div className="flex items-center gap-1 pt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < pedidoDetalhe.avaliacao! ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                  ))}
                  {pedidoDetalhe.avaliacao_comentario && (
                    <span className="text-xs text-muted-foreground ml-2">"{pedidoDetalhe.avaliacao_comentario}"</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Products / receipt */}
        {items.length > 0 && (
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" /> Produtos do Pedido
              </h3>
              <div className="divide-y divide-border/40">
                {items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{item.nome || item.name || "Item"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Qtd: {item.quantidade || item.qty || 1}
                        {item.observacao ? ` • ${item.observacao}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {fmt(Number(item.preco || item.total || 0) * Number(item.quantidade || item.qty || 1))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-3 border-t border-border/40 mt-2">
                <span className="text-sm font-bold">Total</span>
                <span className="text-sm font-bold text-green-600">{fmt(Number(pedidoDetalhe?.total || 0))}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=1000,height=700");
    if (!printWindow) return;
    const periodLabel = period === "custom"
      ? `${customRange.from ? format(customRange.from, "dd/MM/yyyy") : "—"} a ${customRange.to ? format(customRange.to, "dd/MM/yyyy") : "—"}`
      : periodFilters.find(p => p.value === period)?.label || "";

    const rows = entregas.map((e, idx) => {
      const date = new Date(e.created_at);
      const bg = idx % 2 === 0 ? "#fff" : "#f2f2f2";
      return `<tr style="background:${bg};">
        <td style="border:1px solid #999;padding:3px 6px;">${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
        <td style="border:1px solid #999;padding:3px 6px;">${e.endereco_entrega || "—"}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${getStatusLabel(e.status)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold;">${fmt(Number(e.valor_entrega))}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${calcDuration(e.status_timestamps) || "—"}</td>
      </tr>`;
    }).join("");

    printWindow.document.write(`<html><head><title>Relatório - ${profile?.full_name || "Entregador"}</title>
      <style>* { box-sizing: border-box; } body { margin: 20px; font-family: Arial, sans-serif; font-size: 10px; color: #222; } @media print { body { margin: 10px; } }</style></head><body>
      <div style="border-bottom:3px solid #2563EB;padding-bottom:8px;margin-bottom:12px;">
        <h1 style="margin:0;font-size:16px;color:#2563EB;">Relatório de Entregas - ${profile?.full_name || "Entregador"}</h1>
        <p style="margin:2px 0 0;font-size:10px;color:#666;">Período: ${periodLabel} • Telefone: ${profile?.phone || "—"}</p>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <div style="flex:1;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Total</div>
          <div style="font-size:14px;font-weight:bold;">${totalEntregas}</div>
        </div>
        <div style="flex:1;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Concluídas</div>
          <div style="font-size:14px;font-weight:bold;color:#16a34a;">${entregasConcluidas}</div>
        </div>
        <div style="flex:1;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Ganhos</div>
          <div style="font-size:14px;font-weight:bold;color:#16a34a;">${fmt(totalValor)}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead><tr style="background:#2563EB;color:#fff;">
          <th style="border:1px solid #999;padding:4px 6px;">Data/Hora</th>
          <th style="border:1px solid #999;padding:4px 6px;">Endereço</th>
          <th style="border:1px solid #999;padding:4px 6px;">Status</th>
          <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Valor</th>
          <th style="border:1px solid #999;padding:4px 6px;">Tempo</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#e5e7eb;font-weight:bold;">
          <td colspan="3" style="border:1px solid #999;padding:4px 6px;text-align:right;">TOTAL</td>
          <td style="border:1px solid #999;padding:4px 6px;text-align:right;color:#16a34a;">${fmt(totalValor)}</td>
          <td style="border:1px solid #999;padding:4px 6px;"></td>
        </tr></tfoot>
      </table>
      <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Header + Access Info */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigate("/lojista/relatorio-entregadores")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-primary flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {(profile?.full_name || "M")[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold font-display">{profile?.full_name || "Entregador"}</h2>
            {profile?.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {profile.phone}</p>
            )}
          </div>
        </div>
        <Card className="border-border/40 shrink-0">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Código:</p>
              <p className="text-sm font-bold font-mono text-foreground">{profile?.codigo_acesso || "—"}</p>
              {profile?.codigo_acesso && (
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => navigator.clipboard.writeText(profile.codigo_acesso!)}>
                  <Copy className="w-3 h-3" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Link:</p>
              <p className="text-xs text-foreground truncate font-mono max-w-[200px]">https://noov.app.br/entregador/login</p>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => navigator.clipboard.writeText("https://noov.app.br/entregador/login")}>
                <Copy className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => window.open("https://noov.app.br/entregador/login", "_blank")}>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <hr className="border-border" />

      {/* Period Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {periodFilters.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground border border-border/50 hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <CalendarIcon className="w-3 h-3" />
                    {customRange.from ? format(customRange.from, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customRange.from}
                    onSelect={(d) => setCustomRange(prev => ({ ...prev, from: d }))}
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <CalendarIcon className="w-3 h-3" />
                    {customRange.to ? format(customRange.to, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customRange.to}
                    onSelect={(d) => setCustomRange(prev => ({ ...prev, to: d }))}
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                <Wallet className="w-4 h-4" /> Pagamento Hoje
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Realizar Pagamento do Dia</DialogTitle>
                <DialogDescription>
                  Resumo das entregas de hoje ({format(new Date(), "dd/MM/yyyy")}) que ainda não foram pagas.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex p-1 bg-muted rounded-lg">
                    <button 
                      className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", paymentMode === "standard" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                      onClick={() => setPaymentMode("standard")}
                    >
                      Padrão (Hoje)
                    </button>
                    <button 
                      className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", paymentMode === "custom" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                      onClick={() => setPaymentMode("custom")}
                    >
                      Outro Valor
                    </button>
                  </div>

                  {paymentMode === "standard" ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg border border-border/50">
                        <div>
                          <p className="text-sm text-muted-foreground">Entregas de Hoje</p>
                          <p className="text-2xl font-bold">{entregasHojePendentes.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total a Pagar</p>
                          <p className="text-2xl font-bold text-green-600">{fmt(valorHojePendente)}</p>
                        </div>
                      </div>
                      
                      {valorAnteriorPendente > 0 && (
                        <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                           <p className="text-sm font-medium text-amber-800">Pendentes anteriores</p>
                           <p className="text-sm font-bold text-amber-800">{fmt(valorAnteriorPendente)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border/50 space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-sm font-medium">Valor Manual</Label>
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                          Total pendente: {fmt(valorTotalPendente)}
                        </Badge>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                        <Input 
                          type="text" 
                          placeholder="0,00" 
                          value={customPaymentValue}
                          onChange={(e) => setCustomPaymentValue(e.target.value)}
                          className="pl-9 h-12 text-lg font-bold"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Faltam {fmt(valorTotalPendente)} para quitar todas as entregas concluídas.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {paymentMode === "standard" ? (
                      entregasHojePendentes.length > 0 ? (
                        entregasHojePendentes.map((e) => (
                          <div key={e.id} className="flex justify-between items-center text-[11px] border-b border-border/40 pb-2">
                            <span className="text-muted-foreground">Pedido Nº {String(e.pedido?.numero_diario || "").padStart(3, "0")}</span>
                            <span className="font-semibold text-foreground">{fmt(Number(e.valor_entrega))}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-center text-muted-foreground py-4">Nenhuma entrega pendente para hoje.</p>
                      )
                    ) : (
                      entregasAnterioresPendentes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Entregas Anteriores:</p>
                          {entregasAnterioresPendentes.map((e) => (
                            <div key={e.id} className="flex justify-between items-center text-[11px] border-b border-border/40 pb-2">
                              <div className="flex flex-col">
                                <span className="text-foreground">Pedido Nº {String(e.pedido?.numero_diario || "").padStart(3, "0")}</span>
                                <span className="text-[9px] text-muted-foreground">{format(new Date(e.created_at), "dd/MM/yyyy")}</span>
                              </div>
                              <span className="font-semibold text-foreground">{fmt(Number(e.valor_entrega))}</span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsPaymentDialogOpen(false); setPaymentMode("standard"); }}>Cancelar</Button>
                <Button 
                  onClick={handlePayment} 
                  disabled={(paymentMode === "standard" && entregasHojePendentes.length === 0) || (paymentMode === "custom" && !customPaymentValue) || isProcessingPayment}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessingPayment ? "Processando..." : "Confirmar Pagamento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/40">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-primary">{totalEntregas}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">Total Entregas</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-green-600">{entregasConcluidas}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">Concluídas</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-xl font-bold text-green-600">{fmt(totalValor)}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">Ganhos Período</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-xl font-bold text-amber-600">{fmt(valorTotalPendente)}</p>
            <p className="text-[9px] sm:text-[10px] text-amber-700 uppercase tracking-wider font-bold">Total a Pagar</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="entregas" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="entregas" className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Entregas
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico de Pagamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entregas" className="space-y-4">
          <h3 className="text-sm font-semibold">Todas as Entregas no Período</h3>
          {entregas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrega encontrada.</p>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/70 text-left">
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Pedido</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Data/Hora</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Cliente</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Bairro</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap text-center">Pago</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Tempo</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entregas.map((e: any) => {
                    const num = e.pedido?.numero_diario ? String(e.pedido.numero_diario).padStart(3, "0") : "---";
                    const parts = e.endereco_entrega ? e.endereco_entrega.split(",").map((s: string) => s.trim()) : [];
                    const bairro = parts.length >= 3 ? parts[parts.length - 2] : (parts.length > 0 ? parts[0] : "—");
                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedEntrega(e.id)}
                      >
                        <td className="px-3 py-2 font-bold text-foreground">Nº {num}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {format(parseISO(e.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </td>
                        <td className="px-3 py-2 text-foreground max-w-[140px] truncate">
                          {e.pedido?.cliente_nome || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">
                          {bairro}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {e.pago ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getStatusColor(e.status)}`}>
                            {getStatusLabel(e.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {calcDuration(e.status_timestamps) || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-primary whitespace-nowrap">
                          {fmt(Number(e.valor_entrega))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td colSpan={7} className="px-3 py-2.5 text-right text-muted-foreground">Total</td>
                    <td className="px-3 py-2.5 text-right text-primary">{fmt(totalValor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-4">
          <h3 className="text-sm font-semibold">Histórico de Pagamentos Realizados</h3>
          {pagamentosHistorico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pagamento registrado.</p>
          ) : (
            <div className="space-y-3">
              {pagamentosHistorico.map((p: any) => (
                <Card key={p.id} className="border-border/40">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{fmt(Number(p.valor))}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(p.data_pagamento || p.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">{p.quantidade_entregas} entregas</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Liquidadas</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
