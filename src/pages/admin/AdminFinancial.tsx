import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2, Users, Percent, Store, CreditCard, Wallet, Clock, History, BarChart3, Banknote } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminFinancial = () => {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Comissão % configurada
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

  // Taxa de integração MP configurada
  const { data: taxaMPConfig } = useQuery({
    queryKey: ["config-global", "taxa_integracao_mercado_pago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "taxa_integracao_mercado_pago")
        .maybeSingle();
      return data?.valor ? Number(data.valor) : 0.99;
    },
  });

  // Todas as comissões
  const { data: comissoes = [], isLoading: loadingComissoes } = useQuery({
    queryKey: ["admin-fin-comissoes"],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Lojas (para mapear nomes)
  const { data: lojas = [], isLoading: loadingLojas } = useQuery({
    queryKey: ["admin-fin-lojas"],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome, slug, logo_url, user_id, afiliado_id");
      return data ?? [];
    },
  });

  // Profiles (afiliados)
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-fin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email, codigo_afiliado, comissao_percent");
      return data ?? [];
    },
  });

  // Loja planos (pagamentos de lojistas)
  const { data: lojaPlanos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ["admin-fin-loja-planos"],
    queryFn: async () => {
      const { data } = await supabase.from("loja_planos").select("*").order("assinado_em", { ascending: false });
      return data ?? [];
    },
  });

  // Planos (para nome)
  const { data: planos = [] } = useQuery({
    queryKey: ["admin-fin-planos"],
    queryFn: async () => {
      const { data } = await supabase.from("planos").select("id, nome, preco");
      return data ?? [];
    },
  });

  // Saques
  const { data: saques = [] } = useQuery({
    queryKey: ["admin-fin-saques"],
    queryFn: async () => {
      const { data } = await supabase.from("saques").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Histórico de todos os pagamentos de todas as lojas
  const { data: todosPagamentos = [], isLoading: loadingTodosPagamentos } = useQuery({
    queryKey: ["admin-fin-todos-pagamentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_loja")
        .select("id, loja_id, valor, metodo, status, plano_nome, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const isLoading = loadingComissoes || loadingLojas || loadingProfiles || loadingPlanos || loadingTodosPagamentos;

  // Cálculos baseados no histórico real de pagamentos aprovados
  const pagamentosAprovados = todosPagamentos.filter(p => p.status === 'aprovado');
  const totalReceitaPlanos = pagamentosAprovados.reduce((s, p) => s + Number(p.valor), 0);
  
  // Comissão calculada: Prioriza comissão específica do afiliado, senão usa a global
  const totalComissoesCalculadas = pagamentosAprovados.reduce((acc, p) => {
    const loja = lojas.find(l => l.id === p.loja_id);
    if (!loja?.afiliado_id) return acc;
    
    const profile = profiles.find(pr => pr.user_id === loja.afiliado_id);
    const percent = profile?.comissao_percent != null ? Number(profile.comissao_percent) : (comissaoPercent ?? 10);
    
    return acc + (Number(p.valor) * (percent / 100));
  }, 0);

  const totalComissoesGeradas = comissoes.reduce((s, c) => s + Number(c.valor_comissao), 0);
  const totalComissoesPagas = comissoes.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_comissao), 0);
  const totalComissoesPendentes = comissoes.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_comissao), 0);
  
  // Taxa MP Total
  const totalTaxaMP = pagamentosAprovados.reduce((acc, p) => acc + (Number(p.valor) * (Number(taxaMPConfig || 0.99) / 100)), 0);

  // Receita Administrativa Total (S/ Taxa MP) = Receita Total - Comissões Afiliados
  const receitaAdminSemTaxaMP = totalReceitaPlanos - totalComissoesCalculadas;

  // Receita Admin Líquida = Receita Total - Comissões Calculadas - Taxas MP
  const receitaAdmin = totalReceitaPlanos - totalComissoesCalculadas - totalTaxaMP;
  const totalSaquesPagos = saques.filter((s: any) => s.status === "pago").reduce((sum: number, s: any) => sum + Number(s.valor), 0);
  const totalSaquesPendentes = saques.filter((s: any) => s.status === "pendente").reduce((sum: number, s: any) => sum + Number(s.valor), 0);

  // Afiliados únicos com comissões
  const afiliadosMap = useMemo(() => {
    const map: Record<string, { nome: string; email: string; totalComissao: number; totalPago: number; lojas: number }> = {};
    comissoes.forEach((c) => {
      if (!map[c.afiliado_id]) {
        const prof = profiles.find(p => p.user_id === c.afiliado_id);
        map[c.afiliado_id] = {
          nome: prof?.full_name || "Afiliado",
          email: prof?.email || "",
          totalComissao: 0,
          totalPago: 0,
          lojas: lojas.filter(l => l.afiliado_id === c.afiliado_id).length,
        };
      }
      map[c.afiliado_id].totalComissao += Number(c.valor_comissao);
      if (c.status === "pago") map[c.afiliado_id].totalPago += Number(c.valor_comissao);
    });
    return Object.entries(map).sort((a, b) => b[1].totalComissao - a[1].totalComissao);
  }, [comissoes, profiles, lojas]);

  // Pagamentos de lojistas agrupados por loja para o card principal
  const pagamentosLojistas = useMemo(() => {
    const map: Record<string, { 
      id: string; 
      loja_nome: string; 
      loja_logo?: string; 
      total_pago: number; 
      comissao_total: number; 
      taxa_mp_total: number;
      comissao_plataforma: number;
      afiliado_nome: string | null;
    }> = {};

    lojas.forEach(loja => {
      const pagamentosDaLoja = todosPagamentos.filter(p => p.loja_id === loja.id && p.status === 'aprovado');
      if (pagamentosDaLoja.length === 0) return;

      const totalPago = pagamentosDaLoja.reduce((s, p) => s + Number(p.valor), 0);
      const profile = loja.afiliado_id ? profiles.find(pr => pr.user_id === loja.afiliado_id) : null;
      const percent = profile?.comissao_percent != null ? Number(profile.comissao_percent) : (comissaoPercent ?? 10);
      const comissaoTotal = loja.afiliado_id ? totalPago * (percent / 100) : 0;
      
      const taxaMP = totalPago * (Number(taxaMPConfig || 5) / 100); 
      const comissaoPlataforma = totalPago - comissaoTotal - taxaMP;

      const afiliado = loja.afiliado_id ? profiles.find(p => p.user_id === loja.afiliado_id) : null;

      map[loja.id] = {
        id: loja.id,
        loja_nome: loja.nome || "—",
        loja_logo: loja.logo_url,
        total_pago: totalPago,
        comissao_total: comissaoTotal,
        taxa_mp_total: taxaMP,
        comissao_plataforma: comissaoPlataforma,
        afiliado_nome: afiliado?.full_name || null,
      };
    });

    return Object.values(map).sort((a, b) => b.total_pago - a.total_pago);
  }, [todosPagamentos, lojas, profiles, taxaMPConfig]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: "Receita Total (Planos)", value: formatCurrency(totalReceitaPlanos), icon: DollarSign, accent: "bg-primary/10 text-primary" },
    { label: "Comissão Afiliado", value: `${comissaoPercent ?? 10}%`, icon: Percent, accent: "bg-accent/10 text-accent" },
    { label: "Total Comissões Afiliados", value: formatCurrency(totalComissoesCalculadas), icon: Users, accent: "bg-accent/10 text-accent" },
    { label: "Receita Administrativa (S/ Taxa MP)", value: formatCurrency(receitaAdminSemTaxaMP > 0 ? receitaAdminSemTaxaMP : 0), icon: DollarSign, accent: "bg-indigo-100 text-indigo-600" },
    { label: "Total Taxa MP", value: formatCurrency(totalTaxaMP), icon: BarChart3, accent: "bg-blue-100 text-blue-600" },
    { label: "Receita Administrador", value: formatCurrency(receitaAdmin > 0 ? receitaAdmin : 0), icon: CreditCard, accent: "bg-primary/10 text-primary" },
    { label: "Comissões Pendentes", value: formatCurrency(totalComissoesPendentes), icon: Clock, accent: "bg-yellow-100 text-yellow-600" },
    { label: "Saques a Pagar", value: formatCurrency(totalSaquesPendentes), icon: Banknote, accent: "bg-orange-100 text-orange-600" },
    { label: "Comissões Pagas", value: formatCurrency(totalComissoesPagas), icon: Wallet, accent: "bg-green-100 text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Visão geral de pagamentos de lojistas e comissões de afiliados</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="border-border/50 shadow-card overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-full h-1 ${i % 2 === 0 ? "bg-primary" : "bg-accent"}`} />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.accent.split(" ")[0]}`}>
                    <stat.icon className={`w-4.5 h-4.5 ${stat.accent.split(" ")[1]}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold font-display text-foreground">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pagamentos de Lojistas */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Pagamentos de Lojistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Loja</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Total Pago</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Afiliado</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Comissão</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Taxa MP</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Plataforma</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentosLojistas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Nenhum pagamento de plano registrado.
                      </td>
                    </tr>
                  ) : (
                    pagamentosLojistas.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {p.loja_logo ? (
                              <img src={p.loja_logo} alt="" className="w-7 h-7 rounded-lg object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Store className="w-3.5 h-3.5 text-primary" />
                              </div>
                            )}
                            <span className="font-medium text-foreground">{p.loja_nome}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-foreground">{formatCurrency(p.total_pago)}</td>
                        <td className="py-3 px-2 text-foreground">{p.afiliado_nome || "—"}</td>
                        <td className="py-3 px-2 text-right font-semibold text-accent">
                          {p.comissao_total > 0 ? formatCurrency(p.comissao_total) : "—"}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {formatCurrency(p.taxa_mp_total)}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-primary">
                          {formatCurrency(p.comissao_plataforma)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Histórico Global de Faturas e Cobranças */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Histórico Global de Faturas e Cobranças
            </CardTitle>
            <p className="text-xs text-muted-foreground">Todos os pagamentos realizados por todas as lojas do sistema</p>
          </CardHeader>
          <CardContent>
            {todosPagamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum pagamento registrado no sistema ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Loja</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Plano</th>
                      <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Valor</th>
                      <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Comissão</th>
                      <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Taxa MP</th>
                      <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Plataforma</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todosPagamentos.map((item: any) => {
                      const loja = lojas.find(l => l.id === item.loja_id);
                      const valorPago = Number(item.valor);
                      const profile = loja?.afiliado_id ? profiles.find(pr => pr.user_id === loja.afiliado_id) : null;
                      const percent = profile?.comissao_percent != null ? Number(profile.comissao_percent) : (comissaoPercent ?? 10);
                      const comissaoAfiliado = loja?.afiliado_id ? valorPago * (percent / 100) : 0;
                      
                      const taxaMP = valorPago * (Number(taxaMPConfig || 5) / 100);
                      const valorPlataforma = valorPago - comissaoAfiliado - taxaMP;
                      
                      return (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              {loja?.logo_url ? (
                                <img src={loja.logo_url} alt="" className="w-6 h-6 rounded-lg object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Store className="w-3 h-3 text-primary" />
                                </div>
                              )}
                              <span className="font-medium text-foreground">{loja?.nome || "Loja Removida"}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-foreground">{item.plano_nome || "—"}</td>
                          <td className="py-3 px-2 text-right font-semibold text-foreground">{formatCurrency(valorPago)}</td>
                          <td className="py-3 px-2 text-right font-semibold text-accent">{comissaoAfiliado > 0 ? formatCurrency(comissaoAfiliado) : "—"}</td>
                          <td className="py-3 px-2 text-right text-muted-foreground">{formatCurrency(taxaMP)}</td>
                          <td className="py-3 px-2 text-right font-semibold text-primary">{formatCurrency(valorPlataforma)}</td>
                          <td className="py-3 px-2 text-muted-foreground text-xs">
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge variant="outline" className={`text-[10px] ${item.status === "aprovado" ? "text-green-700 border-green-200" : "text-yellow-700 border-yellow-200"}`}>
                              {item.status === "aprovado" ? "Pago" : item.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Afiliados */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Resumo por Afiliado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Afiliado</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Lojas Indicadas</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Comissão Total</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Pago</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Pendente</th>
                  </tr>
                </thead>
                <tbody>
                  {afiliadosMap.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nenhuma comissão de afiliado registrada.
                      </td>
                    </tr>
                  ) : (
                    afiliadosMap.map(([id, af]) => (
                      <tr key={id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-foreground">{af.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{af.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold">{af.lojas}</td>
                        <td className="py-3 px-2 text-right font-semibold text-foreground">{formatCurrency(af.totalComissao)}</td>
                        <td className="py-3 px-2 text-right font-semibold text-green-600">{formatCurrency(af.totalPago)}</td>
                        <td className="py-3 px-2 text-right font-semibold text-yellow-600">{formatCurrency(af.totalComissao - af.totalPago)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Saques recentes */}
      {saques.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                Saques de Afiliados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Afiliado</th>
                      <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Valor</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saques.slice(0, 10).map((s: any) => {
                      const prof = profiles.find(p => p.user_id === s.afiliado_id);
                      return (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-2 font-medium text-foreground">{prof?.full_name || "Afiliado"}</td>
                          <td className="py-3 px-2 text-right font-semibold">{formatCurrency(Number(s.valor))}</td>
                          <td className="py-3 px-2 text-muted-foreground text-xs">
                            {format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge variant="outline" className={`text-[10px] ${
                              s.status === "pago" ? "text-green-700 border-green-200" :
                              s.status === "pendente" ? "text-yellow-700 border-yellow-200" :
                              "text-muted-foreground border-border"
                            }`}>
                              {s.status === "pago" ? "Pago" : s.status === "pendente" ? "Pendente" : s.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default AdminFinancial;
