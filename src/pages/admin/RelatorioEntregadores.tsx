import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, Package, Clock, CheckCircle, MapPin, CalendarIcon,
  Phone, TrendingUp, Award, UserPlus, Loader2, Check, Copy, Trash2, Bike,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, isWithinInterval, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
  { value: "all", label: "Todo período" },
  { value: "custom", label: "Personalizado" },
];

const STATUS_COLORS: Record<string, string> = {
  entregue: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pendente: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  aceita: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  em_transito: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function RelatorioEntregadores() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState("all");

  // Driver registration state
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  

  const { data: loja } = useQuery({
    queryKey: ["loja-entregadores", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, logo_url").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Linked drivers for dialog
  const { data: linkedEntregadores = [] } = useQuery({
    queryKey: ["loja-entregadores-linked", loja?.id],
    queryFn: async () => {
      const { data: links } = await (supabase as any)
        .from("loja_entregadores")
        .select("entregador_id, id")
        .eq("loja_id", loja!.id);
      if (!links?.length) return [];
      const ids = links.map((l: any) => l.entregador_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, codigo_acesso")
        .in("user_id", ids);
      return (profiles || []).map((p) => ({
        ...p,
        link_id: links.find((l: any) => l.entregador_id === p.user_id)?.id,
      }));
    },
    enabled: !!loja?.id,
  });

  const removeDriver = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase as any).from("loja_entregadores").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-entregadores-linked"] });
      queryClient.invalidateQueries({ queryKey: ["relatorio-entregadores"] });
      toast({ title: "Entregador removido" });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado! 📋" });
  };

  const { data: rawEntregadores = [], isLoading } = useQuery({
    queryKey: ["relatorio-entregadores", loja?.id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("loja_entregadores")
        .select("entregador_id, created_at")
        .eq("loja_id", loja!.id);
      if (!links?.length) return [];

      const ids = links.map((l) => l.entregador_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, avatar_url, codigo_acesso")
        .in("user_id", ids);

      const { data: entregas } = await supabase
        .from("entregas")
        .select("entregador_id, status, valor_entrega, created_at, finalizada_em")
        .eq("lojista_id", loja!.id)
        .in("entregador_id", ids);

      return (profiles || []).map((p) => {
        const link = links.find((l) => l.entregador_id === p.user_id);
        return {
          ...p,
          entregas: (entregas || []).filter((e) => e.entregador_id === p.user_id),
          vinculado_em: link?.created_at,
        };
      });
    },
    enabled: !!loja?.id,
  });

  const dateRange = useMemo(() => {
    if (dateFrom && dateTo) return { from: startOfDay(dateFrom), to: endOfDay(dateTo) };
    if (dateFrom) return { from: startOfDay(dateFrom), to: endOfDay(new Date()) };
    if (dateTo) return { from: startOfDay(new Date(0)), to: endOfDay(dateTo) };
    return null;
  }, [dateFrom, dateTo]);

  const entregadores = useMemo(() => {
    return rawEntregadores
      .filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return e.full_name?.toLowerCase().includes(q) || e.phone?.includes(q);
      })
      .map((e) => {
        let filteredEntregas = e.entregas;

        if (dateRange) {
          filteredEntregas = filteredEntregas.filter((d) =>
            isWithinInterval(new Date(d.created_at), { start: dateRange.from, end: dateRange.to })
          );
        }

        if (statusFilter !== "all") {
          filteredEntregas = filteredEntregas.filter((d) => d.status === statusFilter);
        }

        const concluidas = filteredEntregas.filter((d) => d.status === "entregue");
        const pendentes = filteredEntregas.filter((d) => ["pendente", "aceita", "em_transito"].includes(d.status));
        const canceladas = filteredEntregas.filter((d) => d.status === "cancelada");
        const totalGanho = concluidas.reduce((s, d) => s + (d.valor_entrega || 0), 0);
        const taxaSucesso = filteredEntregas.length > 0 ? Math.round((concluidas.length / filteredEntregas.length) * 100) : 0;
        const ultimaEntrega = filteredEntregas.length > 0
          ? filteredEntregas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;

        return {
          ...e,
          filteredEntregas,
          total: filteredEntregas.length,
          concluidas: concluidas.length,
          pendentes: pendentes.length,
          canceladas: canceladas.length,
          totalGanho,
          taxaSucesso,
          ultimaEntrega,
        };
      })
      .sort((a, b) => b.concluidas - a.concluidas);
  }, [rawEntregadores, search, dateRange, statusFilter]);

  const totalEntregas = entregadores.reduce((s, e) => s + e.total, 0);
  const totalConcluidas = entregadores.reduce((s, e) => s + e.concluidas, 0);
  const totalGanho = entregadores.reduce((s, e) => s + e.totalGanho, 0);
  const taxaGeralSucesso = totalEntregas > 0 ? Math.round((totalConcluidas / totalEntregas) * 100) : 0;
  const melhorEntregador = entregadores.length > 0 ? entregadores[0] : null;

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
        queryClient.invalidateQueries({ queryKey: ["relatorio-entregadores"] });
        queryClient.invalidateQueries({ queryKey: ["loja-entregadores"] });
        toast({ title: "Entregador cadastrado! 🎉" });
      }
    } catch {
      toast({ title: "Erro ao cadastrar entregador", variant: "destructive" });
    }
    setRegisterLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Relatório de Entregadores
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Visualize e imprima relatórios detalhados de entregadores.</p>
          <div 
            className="flex items-center gap-2 mt-2 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/10 w-fit cursor-pointer transition-all active:scale-95 group"
            onClick={() => {
              const link = `${window.location.origin}/entregador/login?logo=${encodeURIComponent(loja?.logo_url || "")}`;
              navigator.clipboard.writeText(link);
              toast({ title: "Link de login para entregadores copiado! 📋" });
            }}
          >
            <span className="text-[11px] font-medium">Link de acesso dos entregadores</span>
            <Copy className="w-3 h-3 group-hover:scale-110 transition-transform" />
          </div>
        </div>
        {melhorEntregador && melhorEntregador.concluidas > 0 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Top Entregador</p>
              <p className="text-sm font-bold text-foreground">{melhorEntregador.full_name || "—"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="entregue">Concluída</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aceita">Aceita</SelectItem>
            <SelectItem value="em_transito">Em trânsito</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("text-xs", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="w-3.5 h-3.5 mr-1" />
              {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("text-xs", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="w-3.5 h-3.5 mr-1" />
              {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            Limpar datas
          </Button>
        )}
        <Button
          onClick={() => { setDriverDialogOpen(true); setGeneratedCode(""); setNewDriverName(""); setNewDriverPhone(""); }}
          className="ml-auto bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full"
          size="sm"
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
                  <Input className="mt-1" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Telefone</Label>
                  <Input className="mt-1" value={newDriverPhone} onChange={(e) => setNewDriverPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <Button
                  onClick={handleRegisterDriver}
                  disabled={!newDriverName.trim() || registerLoading}
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
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
                  <span className="text-3xl font-bold font-display tracking-[0.3em] text-primary">{generatedCode}</span>
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
              <h4 className="text-sm font-semibold mb-3">Entregadores vinculados ({linkedEntregadores.length})</h4>
              {linkedEntregadores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum entregador cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {linkedEntregadores.map((e: any) => (
                    <div key={e.user_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border/50">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bike className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.full_name || "Entregador"}</p>
                        <div className="flex items-center gap-2">
                          {e.phone && <p className="text-xs text-muted-foreground">{e.phone}</p>}
                          {e.codigo_acesso && (
                            <button onClick={() => copyCode(e.codigo_acesso)} className="text-xs text-primary font-mono flex items-center gap-0.5 hover:underline">
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/15"><Truck className="w-4 h-4 text-primary" /></div>
            <div>
              <p className="text-xl font-extrabold text-foreground leading-none">{entregadores.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Entregadores</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-secondary/15"><Package className="w-4 h-4 text-secondary" /></div>
            <div>
              <p className="text-xl font-extrabold text-foreground leading-none">{totalEntregas}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total Entregas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xl font-extrabold text-foreground leading-none">{totalConcluidas}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/5 to-violet-500/10 border-violet-500/20">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-500/15"><TrendingUp className="w-4 h-4 text-violet-600" /></div>
            <div>
              <p className="text-xl font-extrabold text-foreground leading-none">{taxaGeralSucesso}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Taxa Sucesso</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15"><MapPin className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xl font-extrabold text-foreground leading-none">R$ {totalGanho.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total Ganho</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : entregadores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-semibold text-muted-foreground">Nenhum entregador encontrado</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Ajuste os filtros ou vincule entregadores à sua loja</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entregadores.map((e, idx) => {
            return (
              <Card
                key={e.user_id}
                className="transition-all duration-200 cursor-pointer hover:shadow-lg border"
                onClick={() => navigate(`/lojista/financeiro/motoboy/${e.user_id}`)}
              >
                <CardContent className="p-0">
                  {/* Main row */}
                  <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      {/* Ranking badge */}
                      <div className="relative">
                        {e.avatar_url ? (
                          <img src={e.avatar_url} alt={e.full_name || ""} className="w-12 h-12 rounded-full object-cover border-2 border-background shadow-sm" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-lg shadow-sm">
                            {e.full_name?.[0]?.toUpperCase() || "E"}
                          </div>
                        )}
                        {idx < 3 && e.concluidas > 0 && (
                          <div className={cn(
                            "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm",
                            idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : "bg-amber-700"
                          )}>
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{e.full_name || "Sem nome"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {e.phone || "—"}
                          </span>
                          {e.codigo_acesso && (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); navigator.clipboard.writeText(e.codigo_acesso); toast({ title: "Código copiado! 📋" }); }}
                              className="text-[10px] text-primary font-mono flex items-center gap-0.5 hover:underline"
                            >
                              <Copy className="w-2.5 h-2.5" /> {e.codigo_acesso}
                            </button>
                          )}
                          {e.vinculado_em && (
                            <span className="text-[10px] text-muted-foreground/60">
                              · Vinculado {formatDistanceToNow(new Date(e.vinculado_em), { addSuffix: true, locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 text-sm font-sans">
                      {e.pendentes > 0 && (
                        <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-[10px] animate-pulse">
                          <Clock className="w-3 h-3 mr-1" /> Em rota
                        </Badge>
                      )}
                      <div className="text-center min-w-[50px]">
                        <p className="text-lg font-extrabold text-foreground">{e.total}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center min-w-[50px]">
                        <p className="text-lg font-extrabold text-emerald-600">{e.concluidas}</p>
                        <p className="text-[10px] text-muted-foreground">Concluídas</p>
                      </div>
                      <div className="text-center min-w-[50px]">
                        <p className="text-lg font-extrabold text-amber-600">{e.pendentes}</p>
                        <p className="text-[10px] text-muted-foreground">Ativas</p>
                      </div>
                      <div className="text-center min-w-[70px]">
                        <p className="text-lg font-extrabold text-primary">R$ {e.totalGanho.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">Ganho</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
