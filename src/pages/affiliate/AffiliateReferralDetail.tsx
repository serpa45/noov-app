import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Store, Package, ShoppingCart, DollarSign,
  Link2, Copy, Check, CreditCard, Loader2, MessageCircle, Crown,
  Sparkles, Zap, ChevronDown, ChevronUp, History, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { AffiliatePaymentDialog } from "@/components/affiliate/AffiliatePaymentDialog";

const AffiliateReferralDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  // Real-time subscriptions to keep data updated
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`referral-detail-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loja_planos',
          filter: `loja_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["referral-detail-plano", id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lojas',
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["referral-detail-loja", id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagamentos_loja',
          filter: `loja_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["referral-detail-pagamentos", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Fetch store
  const { data: loja, isLoading: lojaLoading } = useQuery({
    queryKey: ["referral-detail-loja", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("*")
        .eq("id", id!)
        .eq("afiliado_id", user!.id)
        .single();
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch store owner profile (name + phone)
  const { data: ownerProfile } = useQuery({
    queryKey: ["referral-detail-owner", loja?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("user_id", loja!.user_id)
        .single();
      return data;
    },
    enabled: !!loja?.user_id,
  });

  // Fetch plan
  const { data: plano } = useQuery({
    queryKey: ["referral-detail-plano", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(nome, preco, periodo, features)")
        .eq("loja_id", id!)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Fetch products count
  const { data: produtos = [] } = useQuery({
    queryKey: ["referral-detail-produtos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id")
        .eq("loja_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Fetch orders
  const { data: pedidos = [] } = useQuery({
    queryKey: ["referral-detail-pedidos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, total, status, created_at")
        .eq("lojista_id", loja?.user_id ?? "")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!loja?.user_id,
  });

  // Fetch payments for this store
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["referral-detail-pagamentos", id, loja?.user_id],
    queryFn: async () => {
      // 1. Pagamentos vinculados diretamente à loja_id
      const { data: directPagamentos } = await supabase
        .from("pagamentos_loja")
        .select("*")
        .eq("loja_id", id!)
        .order("created_at", { ascending: false });
      
      const results: any[] = directPagamentos ? [...directPagamentos] : [];

      // 2. Pagamentos vinculados via payment_external_id (user_id do lojista)
      if (loja?.user_id) {
        const { data: userPagamentos } = await supabase
          .from("pagamentos_loja")
          .select("*")
          .eq("payment_external_id", loja.user_id)
          .order("created_at", { ascending: false });
        
        if (userPagamentos) {
          userPagamentos.forEach(p => {
            if (!results.find(r => r.id === p.id)) results.push(p);
          });
        }
      }

      // Normalizar status para garantir que 'pago', 'aprovado' e 'approved' sejam considerados liquidados
      // Isso sincroniza com a lógica do painel /admin e /lojista/plano
      const normalizedResults = results.map(p => ({
        ...p,
        status: (p.status === 'pago' || p.status === 'aprovado' || p.status === 'approved') ? 'aprovado' : p.status,
        metodo: p.metodo || 'N/A'
      }));

      return normalizedResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!id,
  });

  // Fetch commissions for this store
  const { data: comissoes = [] } = useQuery({
    queryKey: ["referral-detail-comissoes", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("*")
        .eq("afiliado_id", user!.id)
        .eq("loja_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id && !!user,
  });

  const copyLink = () => {
    if (!loja?.slug) return;
    navigator.clipboard.writeText(`https://noov.app.br/${loja.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ownerName = ownerProfile?.full_name || loja?.nome || "Lojista";
  const ownerPhone = ownerProfile?.phone || "";

  const sendWhatsAppRenewal = (phone: string) => {
    const msg = encodeURIComponent(
`Prezado(a) ${ownerName},

Esperamos que esteja bem!

Gostaríamos de informar que o pagamento da sua assinatura na plataforma *NOOV* encontra-se *vencido*.

Para continuar tendo acesso completo a todas as funcionalidades do seu painel — como gestão de pedidos, cardápio digital, entregas e relatórios financeiros — solicitamos gentilmente que realize a renovação do seu plano.

Caso tenha dúvidas ou precise de auxílio, estamos à disposição para ajudá-lo(a).

Atenciosamente,
Equipe NOOV`
    );
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  if (lojaLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loja) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loja não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/afiliado/indicados")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const totalFaturamento = pedidos.reduce((s, p) => s + Number(p.total), 0);
  const totalPedidos = pedidos.length;
  const totalProdutos = produtos.length;
  
  // Cálculo de comissões para os cards de estatísticas superiores
  const totalComissaoGeral = comissoes.reduce((s, c) => s + Number(c.valor_comissao), 0);
  const comissaoPendente = comissoes.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_comissao), 0);
  const comissaoPaga = comissoes.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_comissao), 0);

  // Novos cálculos para o resumo
  // Soma das comissões (35% do valor do plano) para chegar ao total pago pela loja
  const totalCalculadoPelaLoja = comissoes.reduce((s, c) => s + (Number(c.valor_pedido) || 0), 0);
  
  const totalPagamentosLojista = totalCalculadoPelaLoja || pagamentos
    .filter((p: any) => p.status === "aprovado" || p.status === "pago" || p.status === "approved")
    .reduce((s, p) => s + Number(p.valor), 0);
  const totalGanhosAfiliado = totalComissaoGeral;

  const planoInfo = plano?.planos as any;
  const isPlanActive = plano && (!plano.expira_em || new Date(plano.expira_em) > new Date());
  const latestPaymentApproved = isPlanActive || (pagamentos.length > 0 && (pagamentos[0].status === "aprovado" || pagamentos[0].status === "pago"));

  const stats = [
    { label: "Total de Pedidos", value: String(totalPedidos), icon: ShoppingCart, color: "text-primary" },
    { label: "Faturamento Loja", value: formatCurrency(totalFaturamento), icon: DollarSign, color: "text-green-600" },
    { label: "Assinaturas Pagas (MP)", value: formatCurrency(totalPagamentosLojista), icon: CreditCard, color: "text-blue-600" },
    { label: "Comissões Pagas", value: formatCurrency(comissaoPaga), icon: DollarSign, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/afiliado/indicados")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" /> {loja.nome}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {loja.segmento} • Desde {format(new Date(loja.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold font-display text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Plan Details */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/50 shadow-card h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  Plano Contratado
                </CardTitle>
                {/* Expiração movida para dentro do gradiente */}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {planoInfo ? (
                <>
                  <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 relative overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                        {planoInfo.nome.toLowerCase().includes("start") && <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        {planoInfo.nome.toLowerCase().includes("pro") && <Crown className="w-4 h-4 text-secondary fill-secondary" />}
                        {planoInfo.nome.toLowerCase().includes("ultra") && <Sparkles className="w-4 h-4 text-purple-500 fill-purple-500" />}
                        {planoInfo.nome}
                      </p>
                      {plano?.expira_em && (
                        <p className="text-[10px] font-medium text-muted-foreground/80">
                          Expira em: {format(new Date(plano.expira_em), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <div className="mt-1">
                      {loja.valor_plano_exclusivo || (plano.preco_assinado && Number(plano.preco_assinado) !== Number(planoInfo.preco)) ? (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-primary">
                              {formatCurrency(Number(loja.valor_plano_exclusivo || plano.preco_assinado))}
                              <span className="text-sm font-normal text-muted-foreground">{planoInfo.periodo}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground line-through">
                              De {formatCurrency(Number(planoInfo.preco))}
                            </p>
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/20 py-0 h-4">
                              Valor exclusivo
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <p className="text-2xl font-extrabold text-primary flex items-baseline gap-1">
                          {formatCurrency(Number(planoInfo.preco))}
                          <span className="text-sm font-normal text-muted-foreground">{planoInfo.periodo}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {Array.isArray(planoInfo.features) && planoInfo.features.length > 0 && (
                    <ul className="space-y-1">
                      {(planoInfo.features as string[]).map((f: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum plano ativo.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Link & Store Info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-border/50 shadow-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Dados do Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Link do cardápio</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-foreground flex-1 truncate">
                    https://noov.app.br/{loja.slug}
                  </code>
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={copyLink}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground">Segmento</p>
                  <p className="text-sm font-semibold capitalize">{loja.segmento}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className="text-[10px] border-success/30 bg-success/10 text-success mt-1">
                    {loja.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
              {loja.endereco_cidade && (
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground">Localização</p>
                  <p className="text-sm">{loja.endereco_cidade}{loja.endereco_estado ? ` - ${loja.endereco_estado}` : ""}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Payments */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  Pagamentos do Lojista
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-muted-foreground">Lojista:</p>
                  <span className="text-sm font-medium text-foreground">{ownerName}</span>
                  {latestPaymentApproved ? (
                    <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 bg-green-50">
                      Licença Ativa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                      Licença Pendente
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!latestPaymentApproved && (
                  <AffiliatePaymentDialog 
                    lojaId={id!} 
                    lojaNome={loja.nome}
                    trigger={
                      <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
                        <CreditCard className="w-4 h-4" />
                        Pagar Licença
                      </Button>
                    }
                  />
                )}
                {!latestPaymentApproved && ownerPhone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
                    onClick={() => sendWhatsAppRenewal(ownerPhone)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Cobrar via WhatsApp
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pagamentos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 bg-muted/30 p-3 rounded-xl border border-border/50">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Pago</p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(pagamentos
                      .filter((p: any) => p.status === "aprovado" || p.status === "pago")
                      .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0)
                    )}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pix</p>
                  <p className="text-sm font-bold">
                    {formatCurrency(pagamentos
                      .filter((p: any) => (p.status === "aprovado" || p.status === "pago") && p.metodo === "pix")
                      .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0)
                    )}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cartão</p>
                  <p className="text-sm font-bold">
                    {formatCurrency(pagamentos
                      .filter((p: any) => (p.status === "aprovado" || p.status === "pago") && p.metodo === "credit_card")
                      .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0)
                    )}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Mercado Pago</p>
                  <p className="text-sm font-bold">
                    {formatCurrency(pagamentos
                      .filter((p: any) => (p.status === "aprovado" || p.status === "pago") && p.metodo === "mercadopago")
                      .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0)
                    )}
                  </p>
                </div>
              </div>
            )}
            {pagamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado.</p>
            ) : (
              <div className="space-y-1">
                {pagamentos.slice(0, 20).map((p: any) => (
                  <div key={p.id} className="border-b border-border/50 last:border-0">
                    <div 
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedPayment(expandedPayment === p.id ? null : p.id)}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{formatCurrency(Number(p.valor))}</p>
                          <Badge variant="outline" className={`text-[10px] ${(p.status === "aprovado" || p.status === "pago") ? "text-green-700 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}`}>
                            {(p.status === "aprovado" || p.status === "pago") ? "Pago" : "Pendente"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {p.metodo === 'pix' ? 'Pix' : p.metodo === 'credit_card' ? 'Cartão' : p.metodo === 'mercadopago' ? 'Mercado Pago' : p.metodo || 'N/A'} · {p.plano_nome ?? "Plano"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedPayment === p.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedPayment === p.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden bg-muted/20 rounded-b-xl px-3 pb-3"
                        >
                          <div className="pt-2 border-t border-border/30 space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5 mb-2">
                                <History className="w-3 h-3" /> Histórico do Pagamento
                              </p>
                              
                              <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border/50">
                                {/* Simulação de histórico baseada no status atual e data de criação */}
                                <div className="relative pl-6">
                                  <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  </div>
                                  <p className="text-xs font-medium">Pagamento Iniciado</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {format(new Date(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>

                                {(p.status === "aprovado" || p.status === "pago") && (
                                  <div className="relative pl-6">
                                    <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    </div>
                                    <p className="text-xs font-medium text-green-700">Pagamento Confirmado</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Aprovado com sucesso via {p.metodo === 'pix' ? 'Pix' : p.metodo === 'credit_card' ? 'Cartão' : 'Mercado Pago'}
                                    </p>
                                  </div>
                                )}

                                {p.status === "pendente" && (
                                  <div className="relative pl-6">
                                    <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-amber-500/20 flex items-center justify-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    </div>
                                    <p className="text-xs font-medium text-amber-700">Aguardando Pagamento</p>
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> Pendente de processamento
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="pt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20">
                              <span>ID: {p.id.split('-')[0]}...</span>
                              <span className="capitalize">{p.metodo || 'não informado'}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Commissions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              Comissões desta Loja
            </CardTitle>
            <div className="flex gap-3 mt-2">
              <Badge variant="outline" className="text-[10px] text-green-700 border-green-200">
                Pago: {formatCurrency(comissaoPaga)}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-200">
                Pendente: {formatCurrency(comissaoPendente)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {comissoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comissão registrada.</p>
            ) : (
              <div className="space-y-1">
                {comissoes.slice(0, 20).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(Number(c.valor_comissao))}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.percentual}% de {formatCurrency(Number(c.valor_pedido))} · {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
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
      </motion.div>
    </div>
  );
};

export default AffiliateReferralDetail;
