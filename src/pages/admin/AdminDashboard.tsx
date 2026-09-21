import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Store, Users, DollarSign, Loader2, BarChart3, ShoppingCart,
  UserCheck, CreditCard, Crown, TrendingDown, CalendarIcon, Wallet, Clock,
  Sparkles, Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar,
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

const currentYear = new Date().getFullYear();

const months = [
  { value: "all", label: "Mês" },
  { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
  { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
  { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const AdminDashboard = () => {
  const { profile } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const userName = profile?.full_name?.split(" ")[0] || "Admin";

  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  const { data: allLojas = [], isLoading: l1 } = useQuery({
    queryKey: ["admin-lojas-chart"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("created_at, afiliado_id, id, clientes(count)")
        .order("created_at");
      return (data ?? []).map((l: any) => ({
        ...l,
        clientes_count: Array.isArray(l.clientes) ? (l.clientes[0]?.count ?? 0) : 0,
      }));
    },
  });

  const { data: allPedidos = [], isLoading: l2 } = useQuery({
    queryKey: ["admin-all-pedidos-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos").select("total, created_at, integration_fee");
      return data ?? [];
    },
  });

  const { data: totalUsers = 0, isLoading: l3 } = useQuery({
    queryKey: ["admin-total-users"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: allAfiliados = [], isLoading: l4 } = useQuery({
    queryKey: ["admin-total-afiliados"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id").not("codigo_afiliado", "is", null);
      return data ?? [];
    },
  });

  const { data: allComissoes = [], isLoading: l5 } = useQuery({
    queryKey: ["admin-all-comissoes"],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes").select("valor_comissao, status, created_at");
      return data ?? [];
    },
  });

  const { data: allPagamentosLoja = [], isLoading: l6 } = useQuery({
    queryKey: ["admin-all-pagamentos-loja-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_loja")
        .select("valor, status, created_at, plano_nome");
      return data ?? [];
    },
  });

  const { data: allPlanosAtivos = [], isLoading: l8 } = useQuery({
    queryKey: ["admin-all-planos-ativos-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("plano_id, loja_id, ativo, created_at, planos(nome)")
        .eq("ativo", true);
      return data ?? [];
    },
  });

  const { data: allSaques = [], isLoading: l7 } = useQuery({
    queryKey: ["admin-all-saques-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("saques").select("valor, status, created_at");
      return data ?? [];
    },
  });

  const { data: taxaIntegracaoConfig } = useQuery({
    queryKey: ["config-global", "taxa_integracao_mercado_pago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "taxa_integracao_mercado_pago")
        .maybeSingle();
      return data?.valor ? Number(data.valor) : 0;
    },
  });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const hasFilter = filterMonth !== "all" || filterYear !== "all";

  const matchesFilter = (dateStr: string) => {
    if (!hasFilter) return true;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    const yearMatch = filterYear === "all" || d.getFullYear() === Number(filterYear);
    const monthMatch = filterMonth === "all" || d.getMonth() + 1 === Number(filterMonth);
    return yearMatch && monthMatch;
  };

  const stats = useMemo(() => {
    const filteredLojas = allLojas.filter((l: any) => matchesFilter(l.created_at));
    const filteredComissoes = allComissoes.filter((c: any) => matchesFilter(c.created_at));
    const filteredSaques = allSaques.filter((s: any) => matchesFilter(s.created_at));
    const filteredPagamentos = allPagamentosLoja.filter((p: any) => matchesFilter(p.created_at) && p.status === 'aprovado');
    const filteredPedidos = allPedidos.filter((p: any) => matchesFilter(p.created_at));

    const totalLojas = filteredLojas.length;
    const totalClientes = filteredLojas.reduce((acc: number, loja: any) => acc + (loja.clientes_count || 0), 0);
    const totalAfiliados = allAfiliados.filter((a: any) => matchesFilter(a.created_at || new Date().toISOString())).length;

    // Receita Total (Soma de todos os pagamentos aprovados no histórico)
    const pagamentosTotais = filteredPagamentos.reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

    const totalComissoes = filteredComissoes.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
    const comissoesPagas = filteredComissoes
      .filter((c: any) => c.status === "pago")
      .reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
    const comissoesPendentes = filteredComissoes
      .filter((c: any) => c.status === "pendente")
      .reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);

    // Valor Líquido (Receita Planos - Comissões)
    const valorLiquido = pagamentosTotais - totalComissoes;

    const totalVendasLojistas = filteredPedidos.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
    // Taxa de Integração: calculada como a porcentagem (taxaIntegracaoConfig) sobre a Receita Total (pagamentosTotais)
    const totalComissaoIntegracao = pagamentosTotais * ((taxaIntegracaoConfig || 0) / 100);
    // Total da Plataforma: Lucro Líquido (Receita - Comissões) - Taxa de Integração
    const totalPlataforma = valorLiquido - totalComissaoIntegracao;

    // Saques
    const saquesPagos = filteredSaques
      .filter((s: any) => s.status === "pago")
      .reduce((s: number, sq: any) => s + Number(sq.valor), 0);
    const saquesPendentes = filteredSaques
      .filter((s: any) => s.status === "pendente")
      .reduce((s: number, sq: any) => s + Number(sq.valor), 0);

    // Planos Contratados e por tipo (Baseado nos planos atualmente ativos, excluindo trials que não possuem registro ativo)
    const filteredPlanosAtivos = allPlanosAtivos.filter((p: any) => matchesFilter(p.created_at));
    const planosPorTipo: Record<string, number> = {
      "Start": 0,
      "Pro": 0,
      "Ultra": 0
    };
    filteredPlanosAtivos.forEach((p: any) => {
      const nome = (p.planos as any)?.nome || "Desconhecido";
      planosPorTipo[nome] = (planosPorTipo[nome] || 0) + 1;
    });

    // Lojas em teste: lojas sem plano ativo
    const lojasComPlanoIds = new Set(filteredPlanosAtivos.map((p: any) => p.loja_id));
    const lojasEmTeste = filteredLojas.filter((l: any) => !lojasComPlanoIds.has(l.id)).length;

    return {
      totalLojas, totalAfiliados, totalClientes, pagamentosTotais,
      comissoesPagas, comissoesPendentes, valorLiquido, planosPorTipo, totalPlanos: filteredPlanosAtivos.length,
      saquesPagos, saquesPendentes, totalComissoes, lojasEmTeste,
      totalVendasLojistas, totalComissaoIntegracao, totalPlataforma
    };
  }, [allLojas, allAfiliados, allComissoes, allPagamentosLoja, allSaques, allPlanosAtivos, filterMonth, filterYear, taxaIntegracaoConfig]);

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const result: { 
      label: string; 
      month: string; 
      lojas: number; 
      faturamento: number;
      comissoes: number;
      plataforma: number;
    }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      result.push({ label, month: monthKey, lojas: 0, faturamento: 0, comissoes: 0, plataforma: 0 });
    }
    
    allLojas.forEach((l: any) => {
      const key = l.created_at?.slice(0, 7);
      const m = result.find((r) => r.month === key);
      if (m) m.lojas++;
    });
    
    allPagamentosLoja.forEach((p: any) => {
      if (p.status !== 'aprovado') return;
      const key = p.created_at?.slice(0, 7);
      const m = result.find((r) => r.month === key);
      if (m) { 
        const valor = Number(p.valor || 0);
        m.faturamento += valor;
        
        // Simulação de divisão baseada na lógica de 35% e taxa MP
        const comissao = valor * 0.35;
        const taxaMP = valor * (Number(taxaIntegracaoConfig || 0.99) / 100);
        m.comissoes += comissao;
        m.plataforma += (valor - comissao - taxaMP);
      }
    });
    return result;
  }, [allLojas, allPagamentosLoja, taxaIntegracaoConfig]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cardData = [
    { label: "Planos Contratados", value: String(stats.totalPlanos), icon: Crown, color: "text-primary" },
    { label: "Lojas Cadastradas", value: String(stats.totalLojas), icon: Store, color: "text-primary" },
    { 
      label: "Clientes Totais (Lojas)", 
      value: String(stats.totalClientes), 
      icon: Users, 
      color: "text-blue-500" 
    },
    { label: "Total de Afiliados", value: String(stats.totalAfiliados), icon: UserCheck, color: "text-accent" },
    { label: "Receita Total (Planos)", value: formatCurrency(stats.pagamentosTotais), icon: CreditCard, color: "text-primary" },
    { label: "Total Comissão Afiliado", value: formatCurrency(stats.totalComissoes), icon: DollarSign, color: "text-accent" },
    { label: "Lucro Total Plataforma", value: formatCurrency(stats.valorLiquido), icon: TrendingDown, color: "text-green-700" },
    { label: `Taxa de Integração (${taxaIntegracaoConfig || 0}%)`, value: formatCurrency(stats.totalComissaoIntegracao), icon: BarChart3, color: "text-blue-600" },
    { label: "Total da Plataforma", value: formatCurrency(stats.totalPlataforma), icon: DollarSign, color: "text-indigo-600" },
    { label: "Saques a Pagar", value: formatCurrency(stats.comissoesPendentes), icon: Wallet, color: "text-red-600" },
    { label: "Saques Pendentes", value: formatCurrency(stats.saquesPendentes), icon: Clock, color: "text-yellow-600" },
    { label: "Saques Pagos", value: formatCurrency(stats.saquesPagos), icon: Wallet, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">
            {greeting}, {userName} 🛡️
          </p>
          <p className="text-muted-foreground mt-1">Painel de administração global do sistema NOOV.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Plans by Type */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Planos Contratados por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border transition-all hover:shadow-md flex items-center gap-4 text-blue-600 bg-blue-50 border-blue-100">
                <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black font-display leading-none mb-1">{stats.lojasEmTeste}</p>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80">Lojas em Teste</p>
                </div>
              </div>
              {Object.entries(stats.planosPorTipo).map(([nome, qtd]) => {
                const isStart = nome === "Start";
                const isPro = nome === "Pro";
                const isUltra = nome === "Ultra";
                
                const PlanIcon = isUltra ? Sparkles : isPro ? Crown : Package;
                const planColor = isUltra ? "text-purple-600 bg-purple-50 border-purple-100" : 
                                 isPro ? "text-amber-600 bg-amber-50 border-amber-100" : 
                                 "text-emerald-600 bg-emerald-50 border-emerald-100";
                
                return (
                  <div 
                    key={nome} 
                    className={`p-5 rounded-2xl border transition-all hover:shadow-md flex items-center gap-4 ${planColor}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
                      <PlanIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-black font-display leading-none mb-1">{qtd}</p>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-80">Plano {nome}</p>
                    </div>
                  </div>
                );
              })}
            </div>

          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardData.map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
            <Card className="border-border/50 shadow-card hover:shadow-elevated transition-shadow overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-full h-1 ${i % 2 === 0 ? "bg-primary" : "bg-secondary"}`} />
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

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Crescimento Mensal (Lojas e Faturamento de Planos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: 13,
                    }}
                    formatter={(value: number, name: string) => [
                      name === "faturamento" ? formatCurrency(value) : value,
                      name === "lojas" ? "Novas Lojas" : "Receita Planos",
                    ]}
                  />
                  <Bar dataKey="lojas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="lojas" />
                  <Bar dataKey="faturamento" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="faturamento" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-2">
          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" />
                Distribuição Financeira Mensal (Comissões vs Plataforma)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: 13,
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "comissoes" ? "Comissões Afiliados" : "Receita Plataforma",
                    ]}
                  />
                  <Bar dataKey="comissoes" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="comissoes" />
                  <Bar dataKey="plataforma" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="plataforma" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
