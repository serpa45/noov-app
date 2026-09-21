import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard, Calendar, RefreshCw, XCircle, CheckCircle2,
  Loader2, AlertTriangle, Clock, Crown, ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import PaymentModal from "@/components/admin/PaymentModal";

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  authorized: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  paused: { label: "Pausada", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
  cancelled: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
};

const MinhaAssinatura = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["minha-assinatura", user?.id],
    queryFn: async () => {
      let functionResult: any = null;
      try {
        const res = await supabase.functions.invoke("mercadopago-subscription", {
          body: { action: "status" },
        });
        if (!res.error && res.data) {
          functionResult = res.data;
        }
      } catch (e) {
        console.warn("Mercado Pago subscription check error:", e);
      }

      if (functionResult?.loja_plano || (functionResult?.subscriptions && functionResult.subscriptions.length > 0)) {
        return functionResult as {
          subscriptions: Array<{
            id: string;
            status: string;
            reason: string;
            next_payment_date: string | null;
            auto_recurring: { transaction_amount: number; currency_id: string; frequency: number; frequency_type: string } | null;
            date_created: string;
            last_modified: string;
            payer_email: string;
          }>;
          loja_plano: any;
        };
      }

      // Fallback: fetch active plan directly from database
      const { data: storeData } = await supabase
        .from("lojas")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      let dbLojaPlano = null;
      if (storeData?.id) {
        const { data: lp } = await supabase
          .from("loja_planos")
          .select("*, planos:plano_id(id, nome, preco, periodo)")
          .eq("loja_id", storeData.id)
          .eq("ativo", true)
          .maybeSingle();
        dbLojaPlano = lp;
      }

      return {
        subscriptions: functionResult?.subscriptions || [],
        loja_plano: dbLojaPlano,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const handleCancel = async (preapprovalId: string) => {
    setCancelling(true);
    try {
      const res = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "cancel", preapproval_id: preapprovalId },
      });
      if (res.error) {
        toast.error("Erro ao cancelar assinatura.");
        return;
      }
      toast.success("Assinatura cancelada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["minha-assinatura"] });
      queryClient.invalidateQueries({ queryKey: ["meu-plano"] });
      refetch();
    } catch {
      toast.error("Erro ao cancelar assinatura.");
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const { data: loja } = useQuery({
    queryKey: ["loja-exclusive-price", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("valor_plano_exclusivo, plano_id_exclusivo")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const subscription = data?.subscriptions?.[0];
  const lojaPlano = data?.loja_plano;
  const planoInfo = lojaPlano?.planos;
  const isExpired = lojaPlano?.expira_em && new Date(lojaPlano.expira_em) < new Date();

  const precoReal = planoInfo?.preco || 0;
  const precoAtual = Number(
    (loja?.plano_id_exclusivo === planoInfo?.id && loja?.valor_plano_exclusivo)
      ? loja.valor_plano_exclusivo 
      : (planoInfo?.preco ?? lojaPlano?.preco_assinado ?? 0)
  );
  const temDesconto = precoReal > 0 && precoAtual < precoReal;
  const percentualDesconto = temDesconto ? Math.round(((precoReal - precoAtual) / precoReal) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusInfo = subscription
    ? statusLabels[subscription.status] || statusLabels.pending
    : null;

  return (
    <div className="space-y-4 pb-20 w-full max-w-7xl mx-auto px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-secondary" /> Minha Assinatura
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie sua assinatura recorrente
          </p>
        </div>
        
        {statusInfo && (
          <Badge className={`text-sm py-1.5 px-4 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500 ${statusInfo.color}`}>
            <statusInfo.icon className="w-4 h-4 mr-2" />
            Pagamento {statusInfo.label}
          </Badge>
        )}
      </div>
      
      {isExpired && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-bold">Plano Expirado / Bloqueado</AlertTitle>
          <AlertDescription>
            Seu plano venceu em <strong>{formatDate(lojaPlano.expira_em)}</strong> e o acesso aos recursos do sistema pode estar limitado. 
            Realize o pagamento para normalizar sua situação.
          </AlertDescription>
        </Alert>
      )}

      {!subscription && !lojaPlano && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sem assinatura ativa</AlertTitle>
          <AlertDescription>
            Você não possui nenhuma assinatura recorrente. Acesse a página de planos para assinar.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan Card */}
      {lojaPlano && (
        <Card className="border-border/50 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Crown className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold font-display">
                      Plano {planoInfo?.nome || "Ativo"}
                    </h2>
                    {isExpired ? (
                      <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                        Expirado
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-extrabold text-primary">
                          {formatCurrency(precoAtual)}
                        </p>
                        <span className="text-sm font-medium text-muted-foreground">
                          {planoInfo?.periodo || "/mês"}
                        </span>
                      </div>
                      {temDesconto && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-muted-foreground line-through">
                            De {formatCurrency(precoReal)}
                          </p>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] py-0">
                            Valor Especial
                          </Badge>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] py-0">
                            {percentualDesconto}% OFF
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch gap-2 shrink-0">
                <Button 
                  onClick={() => setPaymentOpen(true)}
                  className="gap-2 bg-primary hover:bg-primary/90 py-6 px-6 text-base font-bold shadow-lg shadow-primary/20"
                  size="lg"
                >
                  <CreditCard className="w-5 h-5" />
                  Renovar
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" disabled={cancelling}>
                      {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Cancelar Plano
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar plano?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ao cancelar, seu plano será desativado e você perderá acesso aos recursos premium.
                        {subscription ? " Sua assinatura recorrente também será cancelada." : ""}
                        {" "}Você pode assinar novamente a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Manter plano</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          setCancelling(true);
                          try {
                            if (subscription?.status === "authorized") {
                              await supabase.functions.invoke("mercadopago-subscription", {
                                body: { action: "cancel", preapproval_id: subscription.id },
                              });
                            }
                            await supabase
                              .from("loja_planos")
                              .update({ ativo: false })
                              .eq("id", lojaPlano.id);
                            toast.success("Plano cancelado com sucesso.");
                            queryClient.invalidateQueries({ queryKey: ["minha-assinatura"] });
                            queryClient.invalidateQueries({ queryKey: ["meu-plano"] });
                            refetch();
                          } catch {
                            toast.error("Erro ao cancelar plano.");
                          } finally {
                            setCancelling(false);
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sim, cancelar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Subscription Details */}
      {subscription && (
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                Detalhes da Assinatura
              </CardTitle>
              {statusInfo && (
                <Badge className={`text-xs ${statusInfo.color}`}>
                  <statusInfo.icon className="w-3 h-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              )}
            </div>
            <CardDescription>{subscription.reason}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Valor da Cobrança
                </p>
                <p className="text-lg font-bold">
                  {subscription.auto_recurring
                    ? formatCurrency(subscription.auto_recurring.transaction_amount)
                    : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Frequência
                </p>
                <p className="text-lg font-bold">
                  {subscription.auto_recurring
                    ? `A cada ${subscription.auto_recurring.frequency} ${
                        subscription.auto_recurring.frequency_type === "months" ? "mês(es)" : "dia(s)"
                      }`
                    : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Próxima Cobrança
                </p>
                <p className="text-lg font-bold text-primary">
                  {formatDate(subscription.next_payment_date)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Assinatura desde
                </p>
                <p className="text-lg font-bold">
                  {formatDate(subscription.date_created)}
                </p>
              </div>
            </div>

            {subscription.payer_email && (
              <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
                E-mail do pagador: <span className="font-medium text-foreground">{subscription.payer_email}</span>
              </div>
            )}

            {/* Cancel button */}
            {subscription.status === "authorized" && (
              <div className="border-t pt-4 mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={cancelling}>
                      {cancelling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Cancelar Assinatura
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ao cancelar, seu plano será desativado e você perderá acesso aos recursos premium.
                        Esta ação não pode ser desfeita. Você pode assinar novamente a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancel(subscription.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sim, cancelar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-xs text-muted-foreground mt-2">
                  Ao cancelar, o acesso será mantido até o fim do período atual.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No MP subscription but has local plan */}
      {!subscription && lojaPlano && (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-medium">Plano ativo via pagamento avulso (PIX)</p>
            {lojaPlano.expira_em && (
              <p className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${isExpired ? 'text-destructive bg-destructive/10' : 'text-orange-600 bg-orange-50'}`}>
                Vencimento: {formatDate(lojaPlano.expira_em)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Sua assinatura não é recorrente. Para ativar cobranças automáticas, assine um plano com cartão de crédito.
            </p>
            <Button onClick={() => navigate("/lojista/plano")} className="gap-1">
              <CreditCard className="w-4 h-4" /> Ver planos
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Payment Modal for Renewal */}
      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        plan={planoInfo ? {
          id: planoInfo.id,
          nome: planoInfo.nome,
          preco: precoAtual,
          periodo: planoInfo.periodo
        } : null}
      />
    </div>
  );
};

export default MinhaAssinatura;
