import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Webhook,
  CreditCard,
  Banknote,
  Receipt,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AdminIntegracaoMercadoPago = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingUpWebhook, setSettingUpWebhook] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [tokenValidation, setTokenValidation] = useState<any>(null);

  const validateNewToken = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "mercadopago-update-token",
        { body: { access_token: newToken.trim() } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setTokenValidation(data);
      toast({
        title: "Token validado com sucesso ✅",
        description: `Conta: ${data.account?.email}. Agora atualize o secret no backend.`,
      });
    },
    onError: (err: any) => {
      setTokenValidation(null);
      toast({
        title: "Token inválido",
        description: err.message || "Verifique o token e tente novamente",
        variant: "destructive",
      });
    },
  });


  const {
    data: validation,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["mercadopago-validation"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "mercadopago-validate",
        { body: { action: "validate" } }
      );
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const setupWebhook = useMutation({
    mutationFn: async () => {
      setSettingUpWebhook(true);
      const { data, error } = await supabase.functions.invoke(
        "mercadopago-validate",
        { body: { action: "setup_webhook" } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSettingUpWebhook(false);
      queryClient.invalidateQueries({ queryKey: ["mercadopago-validation"] });
      const status = data?.webhook?.status;
      if (status === "created" || status === "already_configured" || status === "configured_via_notification_url") {
        toast({ title: "Webhook configurado com sucesso ✅" });
      } else {
        toast({
          title: "Webhook precisa de configuração manual",
          description: data?.webhook?.instructions,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      setSettingUpWebhook(false);
      toast({ title: "Erro ao configurar webhook", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isValid = validation?.valid === true;
  const account = validation?.account;
  const capabilities = validation?.capabilities;
  const tokenType = validation?.token_type;
  const webhookStatus = validation?.webhook?.status;

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isValid
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {isValid ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-foreground">
                Status da Integração
              </h3>
              <p className="text-sm text-muted-foreground">
                {isValid
                  ? "Mercado Pago conectado e funcionando"
                  : validation?.error || "Token não configurado ou inválido"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1 ${isRefetching ? "animate-spin" : ""}`}
            />
            Verificar
          </Button>
        </div>

        {isValid && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={tokenType === "production" ? "default" : "secondary"}
              className="gap-1"
            >
              {tokenType === "production" ? "Produção" : tokenType === "test" ? "Teste" : "Desconhecido"}
            </Badge>
            {account?.is_brazil && (
              <Badge variant="outline" className="gap-1">
                🇧🇷 Brasil (MLB)
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Dados da Conta */}
      {isValid && account && (
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
          <h3 className="text-base font-bold font-display text-foreground">
            Conta Conectada
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Nome:</span>{" "}
              <span className="font-medium text-foreground">
                {account.first_name} {account.last_name}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">E-mail:</span>{" "}
              <span className="font-medium text-foreground">{account.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Nickname:</span>{" "}
              <span className="font-medium text-foreground">
                {account.nickname}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">ID:</span>{" "}
              <span className="font-medium text-foreground">{account.id}</span>
            </div>
          </div>
        </div>
      )}

      {/* Métodos de Pagamento */}
      {isValid && capabilities && (
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
          <h3 className="text-base font-bold font-display text-foreground">
            Métodos de Pagamento Disponíveis
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CapabilityCard
              icon={<Banknote className="w-5 h-5" />}
              label="PIX"
              active={capabilities.pix}
            />
            <CapabilityCard
              icon={<CreditCard className="w-5 h-5" />}
              label="Cartão de Crédito"
              active={capabilities.credit_card}
            />
            <CapabilityCard
              icon={<Receipt className="w-5 h-5" />}
              label="Boleto"
              active={capabilities.boleto}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Total de métodos encontrados: {validation?.payment_methods_count || 0}
          </p>
        </div>
      )}

      {/* Webhook */}
      {isValid && (
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold font-display text-foreground">
                Webhook (Notificações)
              </h3>
            </div>
            <WebhookStatusBadge status={webhookStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            O webhook permite que o sistema receba notificações automáticas de
            pagamentos, assinaturas e cancelamentos do Mercado Pago.
          </p>
          {validation?.webhook?.url && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">URL do Webhook:</p>
              <code className="text-xs break-all text-foreground">
                {validation.webhook.url}
              </code>
            </div>
          )}
          <Button
            onClick={() => setupWebhook.mutate()}
            disabled={settingUpWebhook}
            size="sm"
            variant={webhookStatus === "active" || webhookStatus === "already_configured" ? "outline" : "default"}
          >
            {settingUpWebhook ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Webhook className="w-4 h-4 mr-1" />
            )}
            {webhookStatus === "active" || webhookStatus === "already_configured"
              ? "Reconfigurar Webhook"
              : "Configurar Webhook"}
          </Button>
        </div>
      )}

      {/* Trocar Access Token */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold font-display text-foreground">
            Trocar / Atualizar Access Token
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Cole o novo <strong>Access Token de Produção</strong> do Mercado Pago para
          validar antes de aplicar. Obtenha em{" "}
          <a
            href="https://www.mercadopago.com.br/developers/panel/app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline inline-flex items-center gap-1"
          >
            Mercado Pago Developers <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        <div className="space-y-2">
          <Label className="text-xs">Access Token</Label>
          <Input
            type="password"
            value={newToken}
            onChange={(e) => {
              setNewToken(e.target.value);
              setTokenValidation(null);
            }}
            placeholder="APP_USR-..."
            className="font-mono text-sm"
          />
        </div>

        {tokenValidation?.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Token válido!</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Conta: <strong>{tokenValidation.account?.email}</strong></p>
              <p>Nome: {tokenValidation.account?.first_name} {tokenValidation.account?.last_name}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {tokenValidation.message}
            </p>
          </div>
        )}

        <Button
          onClick={() => validateNewToken.mutate()}
          disabled={validateNewToken.isPending || newToken.trim().length < 10}
          size="sm"
        >
          {validateNewToken.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <ShieldCheck className="w-4 h-4 mr-1" />
          )}
          Validar Novo Token
        </Button>
      </div>
    </div>
  );
};

const CapabilityCard = ({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) => (
  <div
    className={`flex items-center gap-3 rounded-xl border p-4 ${
      active
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-border/50 bg-muted/30"
    }`}
  >
    <div
      className={`${active ? "text-emerald-500" : "text-muted-foreground"}`}
    >
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className={`text-xs ${active ? "text-emerald-500" : "text-muted-foreground"}`}>
        {active ? "Ativo" : "Indisponível"}
      </p>
    </div>
    {active ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
    ) : (
      <XCircle className="w-4 h-4 text-muted-foreground ml-auto" />
    )}
  </div>
);

const WebhookStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "active":
    case "already_configured":
      return (
        <Badge variant="default" className="gap-1 bg-emerald-500">
          <CheckCircle2 className="w-3 h-3" /> Ativo
        </Badge>
      );
    case "not_configured":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" /> Não configurado
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="w-3 h-3" /> {status || "Desconhecido"}
        </Badge>
      );
  }
};

export default AdminIntegracaoMercadoPago;
