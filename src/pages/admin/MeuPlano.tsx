import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import {
  Crown, Sparkles, AlertTriangle, TrendingUp, Package, ShoppingCart, User,
  HardDrive, Image, Calendar, CheckCircle2, XCircle, Clock, Loader2, ArrowUpRight, CreditCard, QrCode, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { limitLabels } from "@/constants/planos";

const MeuPlano = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const trialStatus = useTrialStatus();

  // Loja
  const { data: loja, isLoading: loadingLoja } = useQuery({
    queryKey: ["meu-plano-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Plano ativo
  const { data: planoAtivo, isLoading: loadingPlano } = useQuery({
    queryKey: ["meu-plano-ativo", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(id, nome, preco, periodo, features, limites, descricao, ordem)")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!loja?.id,
  });

  // Histórico de pagamentos (tabela dedicada)
  const { data: historicoPagamentos = [] } = useQuery({
    queryKey: ["meu-plano-pagamentos", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_loja")
        .select("id, valor, metodo, status, plano_nome, created_at")
        .eq("loja_id", loja!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!loja?.id,
  });

  // Todos os planos disponíveis
  const { data: todosPlanos = [] } = useQuery({
    queryKey: ["todos-planos-disponiveis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      return data || [];
    },
  });

  // Contagem de produtos (Histórico total no sistema)
  const { data: produtosCount = 0 } = useQuery({
    queryKey: ["meu-plano-produtos-real", loja?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("produtos")
        .select("id", { count: "exact", head: true })
        .eq("loja_id", loja!.id);
      return count || 0;
    },
    enabled: !!loja?.id,
  });

  // Contagem de clientes (Sincronizado com a tabela de clientes do sistema)
  const { data: clientesCount = 0 } = useQuery({
    queryKey: ["meu-plano-clientes-total-sincronizado", loja?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("loja_id", loja!.id);
      
      return count || 0;
    },
    enabled: !!loja?.id,
  });

  // Contagem de pedidos (Sincronizado com o histórico de pedidos do sistema no mês atual)
  const { data: pedidosMesCount = 0 } = useQuery({
    queryKey: ["meu-plano-pedidos-mes-total-sincronizado", loja?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Usar a mesma lógica de filtro do OrderHistory para consistência
      const { count } = await supabase
        .from("pedidos")
        .select("*", { count: "exact", head: true })
        .eq("lojista_id", user!.id) // Garantir que usa o user.id como lojista_id para bater com o histórico
        .gte("created_at", startOfMonth.toISOString());
      
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Cálculo de armazenamento usado
  const { data: storageUsed = 0 } = useQuery({
    queryKey: ["meu-plano-storage-used", loja?.id],
    queryFn: async () => {
      if (!loja?.id) return 0;
      
      // Busca produtos da loja para somar tamanhos de imagens
      const { data: produtos } = await supabase
        .from("produtos")
        .select("imagem_url")
        .eq("loja_id", loja.id);
      
      // Simulação de cálculo de armazenamento baseado em metadados de arquivos ou média
      // Como o Supabase Storage não expõe facilmente o tamanho total por 'folder' via API client,
      // estimamos com base no número de imagens (média 200KB por imagem)
      const imageCount = produtos?.filter(p => p.imagem_url)?.length || 0;
      return (imageCount * 0.2); // Retorna em MB
    },
    enabled: !!loja?.id,
  });

  const planoInfo = (planoAtivo as any)?.planos;
  const limites = planoInfo?.limites as any || (planoAtivo as any)?.limites_assinado as any || {};
  const features = planoInfo?.features as any[] || (planoAtivo as any)?.features_assinado as any[] || [];

  const limiteProdutos = limites?.max_produtos === -1 ? Infinity : (limites?.max_produtos ?? 999);
  const limiteClientes = limites?.max_clientes === -1 ? Infinity : (limites?.max_clientes ?? 999);
  const limitePedidosMes = limites?.max_pedidos_mes === -1 ? Infinity : (limites?.max_pedidos_mes ?? 999);
  const limiteStorage = limites?.max_armazenamento_mb === -1 ? Infinity : (limites?.max_armazenamento_mb ?? 100);

  const usoProdutos = produtosCount as number;
  const usoClientes = clientesCount as number;
  const usoPedidosMes = pedidosMesCount as number;
  const usoStorage = storageUsed as number;

  const pctProdutos = limiteProdutos === Infinity ? 0 : (limiteProdutos > 0 ? Math.min(100, (usoProdutos / limiteProdutos) * 100) : 0);
  const pctClientes = limiteClientes === Infinity ? 0 : (limiteClientes > 0 ? Math.min(100, (usoClientes / limiteClientes) * 100) : 0);
  const pctPedidos = limitePedidosMes === Infinity ? 0 : (limitePedidosMes > 0 ? Math.min(100, (usoPedidosMes / limitePedidosMes) * 100) : 0);
  const pctStorage = limiteStorage === Infinity ? 0 : (limiteStorage > 0 ? Math.min(100, (usoStorage / limiteStorage) * 100) : 0);

  // Status
  const statusInfo = useMemo(() => {
    if (planoAtivo) return { label: "Ativo", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
    if (trialStatus.isExpired) return { label: "Expirado", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (trialStatus.daysRemaining > 0) return { label: "Teste Grátis", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" };
    return { label: "Sem plano", color: "bg-muted text-muted-foreground" };
  }, [planoAtivo, trialStatus]);

  // Alertas
  const alertas = useMemo(() => {
    const list: { type: "warning" | "error"; message: string; suggestion?: string; consequence?: string }[] = [];
    
    // Alertas de produtos
    if (pctProdutos >= 80 && pctProdutos < 100)
      list.push({ type: "warning", message: `Você está usando ${Math.round(pctProdutos)}% do limite de produtos.`, suggestion: "Considere fazer upgrade para mais produtos.", consequence: "Ao atingir 100%, você não conseguirá cadastrar novos produtos no cardápio." });
    if (pctProdutos >= 100)
      list.push({ type: "error", message: "Limite de produtos atingido!", suggestion: "Faça upgrade para cadastrar mais produtos.", consequence: "O cadastro de novos produtos está bloqueado até que você faça upgrade ou remova produtos existentes." });
    
    // Alertas de clientes
    if (pctClientes >= 80 && pctClientes < 100)
      list.push({ type: "warning", message: `Você está usando ${Math.round(pctClientes)}% do limite de clientes.`, suggestion: "Considere fazer upgrade para mais clientes.", consequence: "Ao atingir 100%, novos clientes não poderão se cadastrar na sua loja." });
    if (pctClientes >= 100)
      list.push({ type: "error", message: "Limite de clientes atingido!", suggestion: "Faça upgrade para aceitar mais clientes.", consequence: "Novos clientes estão sendo impedidos de se cadastrar, o que pode reduzir suas vendas." });

    // Alertas de pedidos
    if (pctPedidos >= 80 && pctPedidos < 100)
      list.push({ type: "warning", message: `Você está usando ${Math.round(pctPedidos)}% do limite de pedidos por mês.`, suggestion: "Considere fazer upgrade para mais pedidos.", consequence: "Ao atingir 100%, sua loja deixará de receber novos pedidos até o próximo mês." });
    if (pctPedidos >= 100)
      list.push({ type: "error", message: "Limite de pedidos mensais atingido!", suggestion: "Faça upgrade para continuar recebendo pedidos.", consequence: "Sua loja não está recebendo novos pedidos. Cada pedido perdido é faturamento que vai para o concorrente." });

    if (trialStatus.isExpired && !planoAtivo)
      list.push({ type: "error", message: "Seu período de teste expirou. Assine um plano para continuar.", consequence: "O acesso ao painel será bloqueado e sua loja ficará indisponível para os clientes." });
    if (!trialStatus.isExpired && trialStatus.daysRemaining > 0 && trialStatus.daysRemaining <= 3)
      list.push({ type: "warning", message: `Seu teste expira em ${trialStatus.daysRemaining} dia(s). Assine para não perder acesso.`, consequence: "Quando o teste expirar, sua loja ficará offline e você perderá acesso ao painel até assinar um plano." });
    
    // Alerta de vencimento de plano (7 dias)
    if (trialStatus.hasActivePlan && trialStatus.licenseDaysRemaining !== null && trialStatus.licenseDaysRemaining <= 7) {
      list.push({ 
        type: "warning", 
        message: `Seu plano vence em ${trialStatus.licenseDaysRemaining} ${trialStatus.licenseDaysRemaining === 1 ? 'dia' : 'dias'}.`, 
        suggestion: "Renove agora para garantir a continuidade do seu serviço.",
        consequence: "Sem renovação, sua loja sairá do ar, os pedidos serão pausados e o acesso ao painel poderá ser suspenso.",
      });
    }
    
    return list;
  }, [pctProdutos, pctClientes, pctPedidos, trialStatus, planoAtivo]);

  // Recomendação inteligente baseada no uso real
  const planoRecomendado = useMemo(() => {
    if (!todosPlanos.length) return null;

    // Encontra o primeiro plano que suporte todo o uso atual
    const ideal = todosPlanos.find(p => {
      const pLimites = p.limites as any || {};
      const maxProd = pLimites.max_produtos === -1 ? Infinity : (pLimites.max_produtos ?? 0);
      const maxCli = pLimites.max_clientes === -1 ? Infinity : (pLimites.max_clientes ?? 0);
      const maxPed = pLimites.max_pedidos_mes === -1 ? Infinity : (pLimites.max_pedidos_mes ?? 0);

      return usoProdutos <= maxProd && usoClientes <= maxCli && usoPedidosMes <= maxPed;
    });

    const recomendado = ideal || todosPlanos[todosPlanos.length - 1]; // Se nenhum couber (improvável com ilimitados), pega o maior
    
    // Só recomenda se for um upgrade em relação ao plano atual ou se o lojista estiver sem plano
    if (planoAtivo && recomendado.ordem <= (planoInfo?.ordem || 0)) return null;
    if (recomendado.id === planoInfo?.id && planoAtivo) return null;
    
    return recomendado;
  }, [todosPlanos, planoInfo, planoAtivo, usoProdutos, usoClientes, usoPedidosMes]);

  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [loadingPixId, setLoadingPixId] = useState<string | null>(null);
  const [selectedPlanForContract, setSelectedPlanForContract] = useState<any | null>(null);
  const [pixData, setPixData] = useState<{
    qr_code: string;
    qr_code_base64: string;
    payment_id: string;
    plano_nome: string;
    preco: number;
  } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixPolling, setPixPolling] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Buscar assinatura recorrente no Mercado Pago
  const { data: subscriptionData } = useQuery({
    queryKey: ["minha-assinatura-plano", user?.id],
    queryFn: async () => {
      const res = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "status" },
      });
      if (res.error) throw res.error;
      return res.data as { subscriptions: Array<{ id: string; status: string }> };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const activeSubscription = subscriptionData?.subscriptions?.find(s => s.status === "authorized");

  const handleCancelSubscription = async () => {
    if (!activeSubscription) return;
    setCancelling(true);
    try {
      const res = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "cancel", preapproval_id: activeSubscription.id },
      });
      if (res.error) {
        toast.error("Erro ao cancelar assinatura.");
        return;
      }
      toast.success("Assinatura cancelada com sucesso. O acesso será mantido até o fim do período atual.");
      queryClient.invalidateQueries({ queryKey: ["minha-assinatura-plano"] });
      queryClient.invalidateQueries({ queryKey: ["meu-plano-ativo"] });
    } catch {
      toast.error("Erro ao cancelar assinatura.");
    } finally {
      setCancelling(false);
    }
  };

  const getFunctionHeaders = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error("Você precisa estar logado.");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getPaymentErrorMessage = (fallback: string, error: unknown, data: any) => {
    if (typeof data?.error === "string") return data.error;
    if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
      return error.message;
    }
    return fallback;
  };

  const handleSubscribe = async (planoId: string, planoNome: string, preco: number) => {
    if (preco === 0) {
      toast.info("Este plano é gratuito, não precisa de pagamento.");
      return;
    }

    setLoadingPlanId(planoId);

    try {
      const headers = await getFunctionHeaders();
      const baseUrl = window.location.origin;
      const res = await supabase.functions.invoke("mercadopago-checkout", {
        headers,
        body: {
          plano_id: planoId,
          success_url: `${baseUrl}/lojista/pagamento?status=success`,
          failure_url: `${baseUrl}/lojista/pagamento?status=failure`,
        },
      });

      if (res.error || !res.data?.init_point) {
        const message = getPaymentErrorMessage("Erro ao iniciar pagamento. Tente novamente.", res.error, res.data);
        console.error("Checkout error:", res.error, res.data);
        toast.error(message);
        return;
      }

      window.location.href = res.data.init_point;
    } catch (err) {
      console.error(err);
      toast.error(getPaymentErrorMessage("Erro ao processar pagamento.", err, null));
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handlePixPayment = async (planoId: string, planoNome: string, preco: number) => {
    if (preco === 0) {
      toast.info("Este plano é gratuito, não precisa de pagamento.");
      return;
    }

    setLoadingPixId(planoId);

    try {
      const headers = await getFunctionHeaders();
      const res = await supabase.functions.invoke("mercadopago-pix", {
        headers,
        body: { plano_id: planoId },
      });

      if (res.error || !res.data?.qr_code) {
        const message = getPaymentErrorMessage("Erro ao gerar PIX. Tente novamente.", res.error, res.data);
        console.error("PIX error:", res.error, res.data);
        toast.error(message);
        return;
      }

      setPixData({
        qr_code: res.data.qr_code,
        qr_code_base64: res.data.qr_code_base64,
        payment_id: res.data.payment_id,
        plano_nome: planoNome,
        preco,
      });

      setPixPolling(true);
      pollPixStatus(res.data.payment_id);
    } catch (err) {
      console.error(err);
      toast.error(getPaymentErrorMessage("Erro ao gerar PIX.", err, null));
    } finally {
      setLoadingPixId(null);
    }
  };

  const pollPixStatus = async (paymentId: string) => {
    const headers = await getFunctionHeaders();
    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
      attempts++;

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPixPolling(false);
        return;
      }

      try {
        const res = await supabase.functions.invoke("mercadopago-payment-status", {
          headers,
          body: { payment_id: paymentId },
        });

        if (res.data?.status === "approved") {
          clearInterval(interval);
          setPixPolling(false);
          setPixData(null);
          toast.success("Pagamento PIX confirmado! Seu plano foi ativado.");
          window.location.reload();
        }
      } catch {
        /* continue polling */
      }
    }, 5000);
  };

  const handleCopyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setPixCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  const isLoading = loadingLoja || loadingPlano || trialStatus.isLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6 pb-20 w-full max-w-7xl mx-auto px-2 sm:px-4">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Crown className="w-6 h-6 text-secondary" /> Meu Plano
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua assinatura e acompanhe seu uso</p>
      </div>

      {/* ALERTAS */}
      {alertas.length > 0 && (
        <div className="space-y-3">
          {alertas.map((a, i) => (
            <Alert key={i} variant={a.type === "error" ? "destructive" : "default"} className={a.type === "warning" ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{a.type === "error" ? "Atenção" : "Aviso"}</AlertTitle>
              <AlertDescription>
                {a.message}{a.consequence && ` ${a.consequence}`}
                {a.suggestion && <span className="block text-xs mt-1 opacity-80">{a.suggestion}</span>}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* CARD PRINCIPAL */}
      <Card className="border-border/50 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-display">
                    {planoInfo?.nome || (trialStatus.daysRemaining > 0 ? "Teste Grátis" : "Sem Plano")}
                  </h2>
                  <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                </div>
                {planoAtivo && (
                  <div className="flex flex-col mt-1">
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-primary">
                        R$ {Number(((loja as any)?.plano_id_exclusivo === planoInfo?.id && loja?.valor_plano_exclusivo) ? loja.valor_plano_exclusivo : (planoInfo?.preco ?? (planoAtivo as any).preco_assinado)).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">{planoInfo?.periodo || "/mês"}</span>
                      </p>
                      {loja?.valor_plano_exclusivo && loja?.plano_id_exclusivo === planoInfo?.id && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/20 h-fit">
                          Valor Especial
                        </Badge>
                      )}
                    </div>
                    {loja?.valor_plano_exclusivo && (loja as any)?.plano_id_exclusivo === planoInfo?.id && (
                      <p className="text-[10px] text-muted-foreground line-through">
                        De R$ {Number(planoInfo?.preco).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
                {!planoAtivo && trialStatus.daysRemaining > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    {trialStatus.daysRemaining} dia(s) restante(s) de teste
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {planoAtivo && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p><Calendar className="w-3 h-3 inline mr-1" />Início: {formatDate((planoAtivo as any).assinado_em)}</p>
                  {(planoAtivo as any).expira_em && (
                    <p><Clock className="w-3 h-3 inline mr-1" />Vencimento: {formatDate((planoAtivo as any).expira_em)}</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                {planoAtivo && activeSubscription && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 text-xs h-9 px-4 rounded-full" 
                        disabled={cancelling}
                      >
                        {cancelling ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <XCircle className="w-3 h-3 mr-1.5" />}
                        Cancelar Assinatura
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ao cancelar, seu plano será desativado e você não será cobrado no próximo mês.
                          O acesso será mantido até o fim do período atual. Você pode assinar novamente a qualquer momento.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelSubscription}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sim, cancelar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {planoAtivo && trialStatus.licenseDaysRemaining !== null && trialStatus.licenseDaysRemaining <= 5 && (
                  <Button 
                    size="sm" 
                    className="gap-1.5 rounded-full px-6 h-9"
                    onClick={() => {
                      const precoFinal = (loja as any)?.plano_id_exclusivo === planoInfo?.id && loja?.valor_plano_exclusivo 
                        ? Number(loja.valor_plano_exclusivo) 
                        : Number(planoInfo?.preco);
                      handleSubscribe(planoInfo.id, planoInfo.nome, precoFinal);
                    }}
                    disabled={loadingPlanId === planoInfo?.id}
                  >
                    {loadingPlanId === planoInfo?.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Renovar agora
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-5">
          {/* Barras de uso */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <UsageBar
              icon={<Package className="w-4 h-4 text-primary" />}
              label="Produtos"
              used={usoProdutos}
              limit={limiteProdutos}
              pct={pctProdutos}
            />
            <UsageBar
              icon={<User className="w-4 h-4 text-primary" />}
              label="Clientes"
              used={usoClientes}
              limit={limiteClientes}
              pct={pctClientes}
            />
            <UsageBar
              icon={<HardDrive className="w-4 h-4 text-primary" />}
              label="Armazenamento"
              used={usoStorage}
              limit={limiteStorage}
              pct={pctStorage}
              suffix="MB"
            />
            <UsageBar
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
              label="Pedidos/Mês"
              used={usoPedidosMes}
              limit={limitePedidosMes}
              pct={pctPedidos}
            />
          </div>

          {/* Limites e Recursos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Limites de acesso:
              </p>
              <div className="space-y-2 bg-muted/30 rounded-xl p-4 border border-border/50">
                {Object.entries(limitLabels).map(([key, label]) => {
                  const val = limites[key];
                  if (val === undefined || val === false || val === 0) return null;
                  
                  if (key.startsWith("max_")) {
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{label.split(" (")[0]}</span>
                        <span className="font-bold">{val === -1 ? "Ilimitado" : val}</span>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {features.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-secondary" /> Recursos exibidos:
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {features.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{typeof f === "string" ? f : f.label || f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RECOMENDAÇÃO */}
      {planoRecomendado && !trialStatus.hasActivePlan && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-secondary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-secondary flex items-center gap-2">
                Plano Sugerido: {planoRecomendado.nome}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Com base no seu histórico de uso ({usoProdutos} produtos, {usoClientes} clientes e {usoPedidosMes} pedidos este mês), 
                este é o plano que melhor atende suas necessidades atuais.
              </p>
              <p className="text-xs font-medium text-secondary/80 mt-1">
                {formatCurrency((loja as any)?.plano_id_exclusivo === planoRecomendado.id && loja?.valor_plano_exclusivo ? loja.valor_plano_exclusivo : planoRecomendado.preco)}{planoRecomendado.periodo}
              </p>
            </div>
            <Button 
              size="sm" 
              className="shrink-0 gap-1 bg-secondary hover:bg-secondary/90 text-white"
              onClick={() => {
                setSelectedPlanForContract(planoRecomendado);
              }}
            >
              Escolher este plano <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PLANOS DISPONÍVEIS */}
      <div>
        <h2 className="text-lg font-bold font-display mb-4">Planos Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {todosPlanos.map((plano) => {
            const isAtual = planoInfo?.id === plano.id;
            const isRetrocesso = planoAtivo && plano.ordem < (planoInfo?.ordem || 0);
            const planoFeatures = Array.isArray(plano.features) ? plano.features : [];
            const planoLimites = plano.limites as any || {};
            return (
              <Card
                key={plano.id}
                className={`relative border transition-all ${
                  isAtual
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : plano.popular
                    ? "border-secondary/50 bg-secondary/5"
                    : "border-border/50"
                }`}
              >
                {isAtual && (
                  <div className="absolute -top-3 left-4">
                    <Badge className="bg-primary text-primary-foreground text-[10px]">Seu plano atual</Badge>
                  </div>
                )}
                {plano.popular && !isAtual && (
                  <div className="absolute -top-3 left-4">
                    <Badge className="bg-secondary text-secondary-foreground text-[10px]">Mais popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display">{plano.nome}</CardTitle>
                  {plano.descricao && <CardDescription className="text-xs">{plano.descricao}</CardDescription>}
                  <div className="flex flex-col mt-1">
                    <div className="flex flex-col mt-1">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          {loja?.valor_plano_exclusivo && (loja as any)?.plano_id_exclusivo === plano.id && (
                            <p className="text-[10px] text-muted-foreground line-through">
                              De R$ {Number(plano.preco).toFixed(2)}
                            </p>
                          )}
                          <p className="text-2xl font-bold text-foreground">
                            {plano.preco === 0 ? "Grátis" : `R$ ${Number(((loja as any)?.plano_id_exclusivo === plano.id && loja?.valor_plano_exclusivo) ? loja.valor_plano_exclusivo : plano.preco).toFixed(2)}`}
                            {plano.preco > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">{plano.periodo}</span>}
                          </p>
                        </div>
                        {loja?.valor_plano_exclusivo && (loja as any)?.plano_id_exclusivo === plano.id && plano.preco > 0 && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/20 h-fit">
                            Valor Especial
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {/* Limites */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {Object.entries(limitLabels).map(([key, label]) => {
                      const val = planoLimites[key];
                      if (val === undefined || val === false || val === 0) return null;
                      
                      if (key.startsWith("max_")) {
                        return (
                          <p key={key}>
                            {key === "max_produtos" ? "📦" : "👥"} {val === -1 ? `${label.split(" (")[0]} ilimitado` : `Até ${val} ${label.split(" (")[0].toLowerCase()}`}
                          </p>
                        );
                      }
                      
                      return <p key={key}>✅ {label}</p>;
                    })}
                  </div>

                  {/* Features removidas conforme solicitado */}

                  {isAtual ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : isRetrocesso ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Indisponível
                    </Button>
                  ) : plano.preco === 0 ? (
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      variant="outline"
                      disabled={loadingPlanId === plano.id}
                      onClick={() => {
                        const precoFinal = (loja as any)?.plano_id_exclusivo === plano.id && loja?.valor_plano_exclusivo 
                          ? Number(loja.valor_plano_exclusivo) 
                          : Number(plano.preco);
                        handleSubscribe(plano.id, plano.nome, precoFinal);
                      }}
                    >
                      {plano.cta_texto || "Selecionar"}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        variant={plano.popular ? "default" : "outline"}
                        disabled={loadingPlanId === plano.id}
                        onClick={() => {
                          const precoFinal = (loja as any)?.plano_id_exclusivo === plano.id && loja?.valor_plano_exclusivo 
                            ? Number(loja.valor_plano_exclusivo) 
                            : Number(plano.preco);
                          handleSubscribe(plano.id, plano.nome, precoFinal);
                        }}
                      >
                        {loadingPlanId === plano.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <CreditCard className="w-3.5 h-3.5" />
                            Cartão
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        variant="outline"
                        disabled={loadingPixId === plano.id}
                        onClick={() => {
                          const precoFinal = (loja as any)?.plano_id_exclusivo === plano.id && loja?.valor_plano_exclusivo 
                            ? Number(loja.valor_plano_exclusivo) 
                            : Number(plano.preco);
                          handlePixPayment(plano.id, plano.nome, precoFinal);
                        }}
                      >
                        {loadingPixId === plano.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <QrCode className="w-3.5 h-3.5" />
                            PIX
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* HISTÓRICO DE FATURAS E COBRANÇAS */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Histórico de Faturas e Cobranças
          </CardTitle>
          <CardDescription>Acompanhe seus pagamentos e faturas emitidas</CardDescription>
        </CardHeader>
        <CardContent>
          {historicoPagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum pagamento registrado ainda.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {historicoPagamentos.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.plano_nome || "Plano"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      R$ {Number(item.valor).toFixed(2)}
                    </p>
                    <Badge className={`text-[10px] ${item.status === "aprovado" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"}`}>
                      {item.status === "aprovado" ? "Pago" : item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LICENÇA */}
      {loja && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Licença
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Código da loja:</span>
              <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{loja.codigo_convite}</code>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              {planoAtivo ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">Licença ativa</Badge>
              ) : trialStatus.daysRemaining > 0 ? (
                <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">Período de teste</Badge>
              ) : (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Inativa</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIX MODAL */}
      <Dialog open={!!pixData} onOpenChange={(open) => { if (!open) setPixData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Pagamento via PIX
            </DialogTitle>
            <DialogDescription>
              Plano {pixData?.plano_nome} — R$ {pixData?.preco?.toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {pixData?.qr_code_base64 && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
              </div>
            )}

            {/* Copia e Cola */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-lg p-2.5 text-xs font-mono break-all max-h-20 overflow-y-auto">
                  {pixData?.qr_code}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  onClick={handleCopyPix}
                >
                  {pixCopied ? (
                    <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copiar</>
                  )}
                </Button>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {pixPolling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Aguardando confirmação do pagamento...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  Escaneie o QR Code ou cole o código no seu app de banco
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CONTRATAÇÃO (PLANO RECOMENDADO) */}
      <Dialog open={!!selectedPlanForContract} onOpenChange={(open) => { if (!open) setSelectedPlanForContract(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              Assinar Plano {selectedPlanForContract?.nome}
            </DialogTitle>
            <DialogDescription>
              {selectedPlanForContract?.descricao || "Escolha a melhor forma de pagamento para sua loja."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <div className="bg-muted/50 p-4 rounded-xl border border-border/50 text-center">
              <p className="text-sm text-muted-foreground">Valor da assinatura</p>
              <p className="text-3xl font-bold text-foreground">
                {selectedPlanForContract?.preco === 0 ? "Grátis" : `R$ ${Number(((loja as any)?.plano_id_exclusivo === selectedPlanForContract?.id && loja?.valor_plano_exclusivo) ? loja.valor_plano_exclusivo : selectedPlanForContract?.preco).toFixed(2)}`}
                {selectedPlanForContract?.preco > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">{selectedPlanForContract?.periodo}</span>}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Formas de Pagamento</p>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  className="w-full gap-2 h-12"
                  disabled={loadingPlanId === selectedPlanForContract?.id}
                  onClick={() => {
                    handleSubscribe(selectedPlanForContract.id, selectedPlanForContract.nome, Number(selectedPlanForContract.preco));
                    setSelectedPlanForContract(null);
                  }}
                >
                  {loadingPlanId === selectedPlanForContract?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Pagar com Cartão (Recorrente)
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full gap-2 h-12"
                  disabled={loadingPixId === selectedPlanForContract?.id}
                  onClick={() => {
                    handlePixPayment(selectedPlanForContract.id, selectedPlanForContract.nome, Number(selectedPlanForContract.preco));
                    setSelectedPlanForContract(null);
                  }}
                >
                  {loadingPixId === selectedPlanForContract?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      Pagar com PIX
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <p className="text-[10px] text-center text-muted-foreground">
              Ao assinar, você concorda com nossos termos de uso e políticas de privacidade.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente de barra de uso
function UsageBar({ icon, label, used, limit, pct, suffix = "" }: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  pct: number;
  suffix?: string;
}) {
  const isUnlimited = limit === Infinity;
  const colorClass = pct >= 90 ? "[&>div]:bg-destructive" : pct >= 70 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-primary";
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium">{icon} {label}</span>
        <span className="text-[10px] text-muted-foreground font-medium">
          {Math.floor(used)}{suffix} / {isUnlimited ? "∞" : `${Math.floor(limit)}${suffix}`}
        </span>
      </div>
      {!isUnlimited ? (
        <Progress value={pct} className={`h-1.5 ${colorClass}`} />
      ) : (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full w-full bg-primary/20 animate-pulse" />
        </div>
      )}
    </div>
  );
}

export default MeuPlano;
