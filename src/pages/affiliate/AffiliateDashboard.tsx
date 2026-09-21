import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Wallet,
  CreditCard,
  Loader2,
  Store,
  History,
  LayoutDashboard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const AffiliateDashboard = () => {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  useRealtimeSubscription("comissoes", [["affiliate-comissoes-dash", user?.id ?? ""]]);
  useRealtimeSubscription("saques", [["affiliate-saques-dash", user?.id ?? ""]]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["affiliate-profile-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("codigo_afiliado, full_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: lojas = [], isLoading: lojasLoading } = useQuery({
    queryKey: ["affiliate-lojas-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, slug, segmento, created_at")
        .eq("afiliado_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: comissoes = [], isLoading: comissoesLoading } = useQuery({
    queryKey: ["affiliate-comissoes-dash", user?.id],
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

  const { data: comissaoPercent } = useQuery({
    queryKey: ["config-global", "comissao_afiliado_percent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "comissao_afiliado_percent")
        .maybeSingle();
      return data?.valor ? Number(data.valor) : 10;
    },
  });

  const { data: saques = [], isLoading: saquesLoading } = useQuery({
    queryKey: ["affiliate-saques-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("saques")
        .select("*")
        .eq("afiliado_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const code = (profile as any)?.codigo_afiliado || "";
  const affiliateLink = code ? `https://noov.app.br/cadastro?ref=${code}` : "";

  const totalComissao = comissoes.reduce((acc, c) => acc + Number(c.valor_comissao), 0);
  const totalSaquesAprovados = saques.filter((s: any) => s.status === "pago").reduce((sum: number, s: any) => sum + Number(s.valor), 0);
  const totalSaquesPendentes = saques.filter((s: any) => s.status === "pendente").reduce((sum: number, s: any) => sum + Number(s.valor), 0);
  
  // O saldo disponível para saque é o total de comissões menos saques já aprovados ou pendentes
  const saldoDisponivel = Math.max(0, totalComissao - totalSaquesAprovados - totalSaquesPendentes);
  
  // A comissão pendente no card deve refletir o que o usuário ainda tem a receber (total - pago)
  const comissaoPendente = Math.max(0, totalComissao - totalSaquesAprovados);
  const totalIndicados = lojas.length;

  const copyLink = () => {
    if (!affiliateLink) return;
    navigator.clipboard.writeText(`https://${affiliateLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoading = profileLoading || lojasLoading || comissoesLoading || saquesLoading;

  // Data processing for charts
  const chartData = useMemo(() => {
    // Return early if data is still loading to avoid inconsistent hook states
    if (lojasLoading || comissoesLoading) {
      return { earnings: [], indicacoes: [] };
    }

    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        key: format(date, "yyyy-MM"),
        label: format(date, "MMM", { locale: ptBR }),
        start: startOfMonth(date),
        end: endOfMonth(date),
      };
    });

    const earnings = months.map(m => {
      const total = (comissoes || [])
        .filter(c => {
          if (!c.created_at) return false;
          const date = new Date(c.created_at);
          return isWithinInterval(date, { start: m.start, end: m.end });
        })
        .reduce((sum, c) => sum + Number(c.valor_comissao || 0), 0);
      
      return {
        month: m.label,
        valor: total
      };
    });

    const indicacoes = months.map(m => {
      const countLojistas = (lojas || []).filter(l => {
        if (!l.created_at) return false;
        const date = new Date(l.created_at);
        return isWithinInterval(date, { start: m.start, end: m.end });
      }).length;

      return {
        month: m.label,
        lojistas: countLojistas,
        afiliados: 0 
      };
    });

    return { earnings, indicacoes };
  }, [comissoes, lojas, lojasLoading, comissoesLoading]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const stats = [
    { label: "Total de Indicados", value: String(totalIndicados), icon: Users, color: "text-primary", borderColor: "bg-primary" },
    { label: "Lojas Ativas", value: String(totalIndicados), icon: TrendingUp, color: "text-primary", borderColor: "bg-primary" },
    { label: "Comissão Pendente", value: formatCurrency(comissaoPendente), icon: Clock, color: "text-red-600", borderColor: "bg-red-500" },
    { label: "Comissão Paga", value: formatCurrency(totalSaquesAprovados), icon: Check, color: "text-green-600", borderColor: "bg-green-500" },
    { label: "Comissão Total", value: formatCurrency(totalComissao), icon: DollarSign, color: "text-accent", borderColor: "bg-accent" },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">
          Painel do Afiliado 🤝
        </h1>
        <p className="text-muted-foreground mt-1">Acompanhe seus resultados e ganhos</p>
      </motion.div>


      {/* Balance Highlight */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10 shadow-elevated overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent to-primary" />
          <CardContent className="p-5 md:p-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Saldo disponível para saque</p>
              <p className="text-3xl md:text-4xl font-extrabold font-display text-foreground mt-1">
                {formatCurrency(saldoDisponivel)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-accent" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
          >
            <Card className="border-border/50 shadow-card hover:shadow-elevated transition-shadow overflow-hidden relative h-full">
              <div className={`absolute top-0 left-0 w-full h-1 ${stat.borderColor}`} />
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`w-4 h-4 ${stat.color} shrink-0`} />
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                </div>
                <p className="text-xl font-bold font-display text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Ganhos Mensais (R$)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.earnings}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [formatCurrency(value), "Ganhos"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="valor" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorValor)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Indicações de Lojistas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.indicacoes}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar name="Lojistas" dataKey="lojistas" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="w-full">
      <Tabs defaultValue="indicados" className="w-full">
        <TabsList className="w-full flex justify-start h-auto p-0 bg-transparent border-b border-border rounded-none mb-6 overflow-x-auto">
          <TabsTrigger 
            value="indicados" 
            className="px-6 py-3 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
          >
            <Users className="w-4 h-4" />
            <span className="font-semibold">Meus Indicados</span>
          </TabsTrigger>
          <TabsTrigger 
            value="comissoes" 
            className="px-6 py-3 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
          >
            <DollarSign className="w-4 h-4" />
            <span className="font-semibold">Últimas Comissões</span>
          </TabsTrigger>
          <TabsTrigger 
            value="pagamentos" 
            className="px-6 py-3 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
          >
            <History className="w-4 h-4" />
            <span className="font-semibold">Histórico de Pagamentos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indicados" className="mt-0">
          <Card className="border-border/50 shadow-sm rounded-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/60">
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Loja</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Data de Cadastro</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40 text-right">Comissão Total</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Valor Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {lojas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground">
                          Nenhum lojista cadastrado.
                        </td>
                      </tr>
                    ) : (
                      lojas.map((loja) => {
                        const lojaComissoes = comissoes.filter(c => c.loja_id === loja.id);
                        const totalLoja = lojaComissoes.reduce((s, c) => s + Number(c.valor_comissao), 0);
                        const pagoLoja = lojaComissoes.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_comissao), 0);
                        return (
                          <tr key={loja.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4 font-medium text-foreground border-r border-border/40">
                              <div className="flex items-center gap-2">
                                <Store className="w-4 h-4 text-primary" />
                                {loja.nome}
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground border-r border-border/40">
                              {format(new Date(loja.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                            <td className="p-4 text-right font-bold border-r border-border/40">
                              {formatCurrency(totalLoja)}
                            </td>
                            <td className="p-4 text-right text-success font-medium">
                              {pagoLoja > 0 ? formatCurrency(pagoLoja) : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comissoes" className="mt-0">
          <Card className="border-border/50 shadow-sm rounded-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/60">
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Tipo</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Data e Hora</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Status</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Valor da Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {comissoes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground">
                          Nenhuma comissão registrada.
                        </td>
                      </tr>
                    ) : (
                      comissoes.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4 font-medium text-foreground border-r border-border/40">
                            Comissão Recebida
                          </td>
                          <td className="p-4 text-muted-foreground border-r border-border/40">
                            {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm")}
                          </td>
                          <td className="p-4 border-r border-border/40">
                            {c.status === "pago" ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge className="bg-success hover:bg-success text-white px-3 py-0.5 rounded-full text-[10px] w-fit">
                                  <Check className="w-3 h-3 mr-1" />
                                  Comissão paga
                                </Badge>
                                {c.pago_em && (
                                  <span className="text-[10px] text-muted-foreground pl-1">
                                    em {format(new Date(c.pago_em), "dd/MM/yyyy 'às' HH:mm")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="secondary" className="px-3 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 border-amber-200 w-fit">
                                Pendente
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 text-right text-success font-bold">
                            + {formatCurrency(Number(c.valor_comissao))}
                          </td>
                        </tr>
                      ))
                    )}

                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-0">
          <Card className="border-border/50 shadow-sm rounded-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/60">
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Status</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Valor Pago</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider border-r border-border/40">Solicitado Em</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Pago Em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {saques.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground">
                          Nenhum registro de saque encontrado.
                        </td>
                      </tr>
                    ) : (
                      saques.map((s: any) => (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="p-4 border-r border-border/40">
                            <Badge 
                              variant={s.status === "pago" ? "default" : "secondary"}
                              className={s.status === "pago" 
                                ? "bg-success hover:bg-success text-white px-3 py-0.5 rounded-full text-[10px]" 
                                : "px-3 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 border-amber-200"}
                            >
                              {s.status === "pago" ? "Pago" : "Pendente"}
                            </Badge>
                          </td>
                          <td className="p-4 font-bold text-foreground border-r border-border/40">
                            {formatCurrency(Number(s.valor))}
                          </td>
                          <td className="p-4 text-muted-foreground border-r border-border/40">
                            {format(new Date(s.created_at), "dd/MM/yyyy HH:mm")}
                          </td>
                          <td className="p-4">
                            {s.pago_em ? (
                              <span className="text-success font-medium flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" />
                                {format(new Date(s.pago_em), "dd/MM/yyyy HH:mm")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default AffiliateDashboard;
