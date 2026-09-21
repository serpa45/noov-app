import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Wallet, CreditCard, TrendingUp, DollarSign, Loader2, CheckCircle2, Clock, ArrowDownCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const AffiliateFinancial = () => {
  const { user } = useAuth();

  useRealtimeSubscription("comissoes", [["afiliado-comissoes", user?.id ?? ""]]);
  useRealtimeSubscription("saques", [["afiliado-saques", user?.id ?? ""]]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSaque, setShowSaque] = useState(false);
  const [saqueValor, setSaqueValor] = useState("");

  const { data: comissoes = [], isLoading: loadingComissoes } = useQuery({
    queryKey: ["afiliado-comissoes", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("*")
        .eq("afiliado_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: saques = [], isLoading: loadingSaques } = useQuery({
    queryKey: ["afiliado-saques", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("saques")
        .select("*")
        .eq("afiliado_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const solicitarSaque = useMutation({
    mutationFn: async (valor: number) => {
      const { error } = await supabase.from("saques").insert({
        afiliado_id: user!.id,
        valor,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["afiliado-saques"] });
      setShowSaque(false);
      setSaqueValor("");
      toast({ title: "Saque solicitado! 💸", description: "O administrador será notificado." });
    },
    onError: () => {
      toast({ title: "Erro ao solicitar saque", variant: "destructive" });
    },
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const stats = useMemo(() => {
    const totalComissoes = comissoes.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
    const totalSaquesAprovados = saques.filter((s: any) => s.status === "pago").reduce((sum: number, s: any) => sum + Number(s.valor), 0);
    const totalPago = totalSaquesAprovados;
    const totalSaquesPendentes = saques.filter((s: any) => s.status === "pendente").reduce((sum: number, s: any) => sum + Number(s.valor), 0);
    const saldoDisponivel = totalComissoes - totalSaquesAprovados;
    return { totalComissoes, totalPago, totalSaquesAprovados, totalSaquesPendentes, saldoDisponivel };
  }, [comissoes, saques]);

  const isLoading = loadingComissoes || loadingSaques;

  const handleSolicitar = () => {
    const valor = Number(saqueValor.replace(",", "."));
    if (!valor || valor <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    if (valor > stats.saldoDisponivel) {
      toast({ title: "Saldo insuficiente", description: `Disponível: ${formatCurrency(stats.saldoDisponivel)}`, variant: "destructive" });
      return;
    }
    solicitarSaque.mutate(valor);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Financeiro/Saque 💰</h1>
          <p className="text-muted-foreground mt-1">Acompanhe seus ganhos e saques</p>
          <p className="text-xs text-muted-foreground mt-1">💡 Solicitação de pagamento todo dia 10 de cada mês, o pagamento será realizado no próximo dia útil.</p>
        </motion.div>

        {/* Balance Highlight */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="ml-auto w-full lg:w-auto">
          <Card className="border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10 shadow-elevated overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent to-primary" />
            <CardContent className="p-4 md:p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Saldo disponível para saque</p>
                  <p className="text-2xl md:text-3xl font-extrabold font-display text-foreground mt-0.5">
                    {formatCurrency(stats.saldoDisponivel)}
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowSaque(true)} className="bg-gradient-cta text-accent-foreground font-bold border-0">
                <CreditCard className="w-4 h-4 mr-2" /> Solicitar Saque
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Saldo Disponível", value: formatCurrency(stats.saldoDisponivel), icon: Wallet, color: "text-accent" },
          { label: "Total Recebido", value: formatCurrency(stats.totalPago), icon: DollarSign, color: "text-primary" },
          { label: "Saques Realizados", value: formatCurrency(stats.totalSaquesAprovados), icon: CreditCard, color: "text-muted-foreground" },
          { label: "Total Comissões", value: formatCurrency(stats.totalComissoes), icon: TrendingUp, color: "text-green-600" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex w-10 h-10 rounded-lg bg-primary/10 items-center justify-center shrink-0">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold font-display text-foreground truncate">{s.value}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Withdrawal Requests */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" /> Solicitações de Saque
          </CardTitle>
        </CardHeader>
        <CardContent>
          {saques.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum saque solicitado ainda.</p>
          ) : (
            <div className="space-y-2">
              {saques.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <ArrowDownCircle className={`w-5 h-5 shrink-0 ${s.status === "pago" ? "text-green-600" : "text-yellow-500"}`} />
                    <div>
                      <p className="text-sm font-semibold">{formatCurrency(Number(s.valor))}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(s.created_at)}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${
                    s.status === "pago" ? "text-green-700 border-green-200" :
                    s.status === "rejeitado" ? "text-red-600 border-red-200" :
                    "text-yellow-600 border-yellow-200"
                  }`}>
                    {s.status === "pago" ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</> :
                     s.status === "rejeitado" ? "Rejeitado" :
                     <><Clock className="w-3 h-3 mr-1" /> Pendente</>}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Commissions */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" /> Últimas Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comissoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comissão registrada.</p>
          ) : (
            <div className="space-y-1">
              {comissoes.slice(0, 15).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(Number(c.valor_comissao))}</p>
                    <p className="text-[10px] text-muted-foreground">{c.percentual}% de {formatCurrency(Number(c.valor_pedido))} · {formatDate(c.created_at)}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${c.status === "pago" ? "text-green-700 border-green-200" : "text-yellow-600 border-yellow-200"}`}>
                    {c.status === "pago" ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Dialog */}
      <Dialog open={showSaque} onOpenChange={setShowSaque}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Solicitar Saque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Saldo disponível</p>
              <p className="text-2xl font-bold font-display text-foreground">{formatCurrency(stats.saldoDisponivel)}</p>
            </div>
            <div>
              <Label className="text-xs">Valor do saque (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                className="mt-1"
                value={saqueValor}
                onChange={(e) => setSaqueValor(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSolicitar}
              disabled={solicitarSaque.isPending}
              className="w-full bg-gradient-cta text-accent-foreground font-bold border-0"
            >
              {solicitarSaque.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Solicitar Saque
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              O administrador será notificado e processará seu saque.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AffiliateFinancial;
