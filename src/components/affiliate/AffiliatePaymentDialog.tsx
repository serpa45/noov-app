import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, QrCode, Copy, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface AffiliatePaymentDialogProps {
  lojaId: string;
  lojaNome: string;
  trigger?: React.ReactNode;
}

export const AffiliatePaymentDialog = ({ lojaId, lojaNome, trigger }: AffiliatePaymentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: planos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleGeneratePix = async () => {
    if (!selectedPlanId) {
      toast.error("Selecione um plano");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-affiliate-pix", {
        body: { loja_id: lojaId, plano_id: selectedPlanId },
      });

      if (error) throw error;
      setPixData(data);
      toast.success("PIX gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Pagar Licença
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pagar Licença - {lojaNome}</DialogTitle>
          <DialogDescription>
            Escolha um plano e gere o PIX para ativar a licença do lojista.
            A comissão será creditada em sua conta após a confirmação.
          </DialogDescription>
        </DialogHeader>

        {!pixData ? (
          <div className="space-y-4 py-4">
            {loadingPlanos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-3">
                {planos.map((plano) => (
                  <div
                    key={plano.id}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedPlanId === plano.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedPlanId(plano.id)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold">{plano.nome}</p>
                      <p className="text-primary font-bold">
                        {formatCurrency(plano.preco)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {plano.descricao}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!selectedPlanId || loading}
              onClick={handleGeneratePix}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando PIX...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Gerar QR Code PIX
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 py-6">
            <div className="bg-white p-4 rounded-xl border">
              <img
                src={`data:image/jpeg;base64,${pixData.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-48 h-48"
              />
            </div>
            
            <div className="w-full space-y-2">
              <p className="text-xs text-center text-muted-foreground">
                Ou copie o código "Copia e Cola" abaixo:
              </p>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg break-all">
                <code className="text-[10px] flex-1 line-clamp-2">
                  {pixData.qr_code}
                </code>
                <Button size="icon" variant="ghost" className="shrink-0" onClick={copyPix}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Badge variant="outline" className="animate-pulse text-yellow-600 border-yellow-200">
              Aguardando pagamento...
            </Badge>

            <Button variant="outline" className="w-full" onClick={() => setPixData(null)}>
              Voltar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
