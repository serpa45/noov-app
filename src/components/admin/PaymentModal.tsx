import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, CreditCard, QrCode, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  plan: {
    id: string;
    nome: string;
    preco: number;
    periodo: string;
  } | null;
}

const PaymentModal = ({ open, onClose, plan }: PaymentModalProps) => {
  const navigate = useNavigate();
  const [pixData, setPixData] = useState<{
    qr_code: string;
    qr_code_base64: string;
    payment_id: string;
  } | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [pixExpired, setPixExpired] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expirationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const ensurePaymentContext = async () => {
    if (!plan?.id) {
      toast.error("Plano inválido. Atualize a página e tente novamente.");
      return false;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      toast.error("Faça login ou crie sua conta para continuar.");
      onClose();
      navigate("/cadastro");
      return false;
    }

    return true;
  };

  // Poll for payment status
  useEffect(() => {
    if (!pixData?.payment_id || paymentApproved) return;

    const checkStatus = async () => {
      try {
        const res = await supabase.functions.invoke("mercadopago-payment-status", {
          body: { payment_id: pixData.payment_id },
        });

        if (res.data?.status === "approved") {
          setPaymentApproved(true);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          toast.success("Pagamento confirmado! 🎉");

          // Redirect after a short delay
          setTimeout(() => {
            onClose();
            navigate("/lojista/pagamento?status=success");
          }, 2500);
        }
      } catch {
        // Silently retry on next interval
      }
    };

    // Check immediately, then every 5 seconds
    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pixData?.payment_id, paymentApproved, navigate, onClose]);

  const generatePix = async () => {
    if (!plan) return;
    if (!(await ensurePaymentContext())) return;

    setLoadingPix(true);
    setPaymentApproved(false);
    setPixExpired(false);
    // Clear previous expiration timer
    if (expirationRef.current) {
      clearTimeout(expirationRef.current);
      expirationRef.current = null;
    }
    try {
      const res = await supabase.functions.invoke("mercadopago-pix", {
        body: { plano_id: plan.id },
      });

      if (res.error || !res.data?.qr_code) {
        console.error("PIX error:", res.error, res.data);
        toast.error("Erro ao gerar PIX. Tente novamente.");
        return;
      }

      setPixData({
        qr_code: res.data.qr_code,
        qr_code_base64: res.data.qr_code_base64,
        payment_id: res.data.payment_id,
      });

      // Set 10-minute expiration
      expirationRef.current = setTimeout(() => {
        setPixExpired(true);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }, 10 * 60 * 1000);
    } catch {
      toast.error("Erro ao gerar PIX.");
    } finally {
      setLoadingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCreditCard = async () => {
    if (!plan) return;
    if (!(await ensurePaymentContext())) return;

    setLoadingCard(true);
    try {
      const baseUrl = window.location.origin;
      const res = await supabase.functions.invoke("mercadopago-checkout", {
        body: {
          plano_id: plan.id,
          success_url: `${baseUrl}/lojista/pagamento?status=success`,
          failure_url: `${baseUrl}/lojista/pagamento?status=failure`,
        },
      });

      if (res.error || !res.data?.init_point) {
        toast.error("Erro ao iniciar pagamento. Tente novamente.");
        return;
      }
      window.location.href = res.data.init_point;
    } catch {
      toast.error("Erro ao processar pagamento.");
    } finally {
      setLoadingCard(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setPixData(null);
      setCopied(false);
      setPaymentApproved(false);
      setPixExpired(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (expirationRef.current) {
        clearTimeout(expirationRef.current);
        expirationRef.current = null;
      }
      onClose();
    }
  };

  // Auto-generate PIX when modal opens
  const handleAfterOpen = () => {
    if (plan && !pixData && !loadingPix) {
      generatePix();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onAnimationEnd={handleAfterOpen}
      >
        <DialogHeader>
          <DialogTitle className="text-center font-display text-xl">
            {paymentApproved ? "Pagamento Confirmado!" : `Pagamento — Plano ${plan?.nome}`}
          </DialogTitle>
        </DialogHeader>

        {paymentApproved ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-8 gap-4"
          >
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-lg font-bold font-display text-foreground">Pagamento aprovado! 🎉</p>
            <div className="bg-muted/50 rounded-lg p-4 w-full border border-border/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-bold text-green-600">Aprovado</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ativação prevista:</span>
                <span className="font-bold">Imediata</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plano contratado:</span>
                <span className="font-bold">{plan?.nome}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Seu sistema está sendo liberado. Você será redirecionado...
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </motion.div>
        ) : (
          <>
            <div className="text-center mb-2">
              <span className="text-3xl font-extrabold font-display text-foreground">
                {plan ? formatCurrency(plan.preco) : ""}
              </span>
              <span className="text-sm text-muted-foreground ml-1">{plan?.periodo}</span>
            </div>

            {/* PIX Section */}
            <div className="space-y-4">
              {loadingPix ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Gerando PIX...</p>
                </div>
              ) : pixData && pixExpired ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center py-8 gap-4"
                >
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">QR Code expirado</p>
                  <p className="text-xs text-muted-foreground text-center">
                    O código PIX expirou após 10 minutos. Gere um novo para continuar.
                  </p>
                  <Button onClick={generatePix} disabled={loadingPix} className="gap-2">
                    <QrCode className="w-4 h-4" /> Gerar novo QR Code
                  </Button>
                </motion.div>
              ) : pixData ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white p-3 rounded-xl border">
                      {pixData.qr_code_base64 ? (
                        <img
                          src={`data:image/png;base64,${pixData.qr_code_base64}`}
                          alt="QR Code PIX"
                          className="w-48 h-48"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center">
                          <QrCode className="w-16 h-16 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground text-center">
                      Escaneie o QR Code ou copie o código PIX
                    </p>

                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Aguardando pagamento...
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handleCopyPix}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar código PIX
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">ou</span>
                    </div>
                  </div>

                  <Button
                    variant="default"
                    className="w-full gap-2 py-5 font-bold"
                    onClick={handleCreditCard}
                    disabled={loadingCard}
                  >
                    {loadingCard ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    Assinar Plano (Cartão)
                  </Button>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center py-8 gap-3">
                  <QrCode className="w-12 h-12 text-muted-foreground" />
                  <Button onClick={generatePix} disabled={loadingPix}>
                    Gerar PIX
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
