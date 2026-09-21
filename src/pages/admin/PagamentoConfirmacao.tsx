import { useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, ArrowLeft, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

const statusMap = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
    title: "Pagamento confirmado!",
    description: "Seu plano foi ativado com sucesso. Aproveite todos os recursos!",
  },
  failure: {
    icon: XCircle,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10",
    title: "Pagamento não concluído",
    description: "Houve um problema com o pagamento. Tente novamente ou escolha outra forma de pagamento.",
  },
  pending: {
    icon: Clock,
    iconClass: "text-yellow-500",
    bgClass: "bg-yellow-500/10",
    title: "Pagamento pendente",
    description: "Seu pagamento está sendo processado. O plano será ativado automaticamente após a confirmação.",
  },
};

const PagamentoConfirmacao = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get("status") as keyof typeof statusMap || "failure";
  const info = statusMap[status] || statusMap.failure;
  const Icon = info.icon;

  useEffect(() => {
    if (status === "success") {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [status]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-md w-full border-border/50 overflow-hidden">
        <div className={`flex flex-col items-center py-10 px-6 ${info.bgClass}`}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-background shadow mb-4">
            <Icon className={`w-8 h-8 ${info.iconClass}`} />
          </div>
          <h1 className="text-xl font-bold font-display text-center">{info.title}</h1>
          <p className="text-sm text-muted-foreground text-center mt-2 max-w-xs">{info.description}</p>
        </div>
        <CardContent className="p-6 flex flex-col gap-3">
          <Button className="w-full gap-2" onClick={() => navigate("/lojista/plano")}>
            <Crown className="w-4 h-4" /> Ver Meu Plano
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/lojista")}>
            <ArrowLeft className="w-4 h-4" /> Voltar ao painel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PagamentoConfirmacao;
