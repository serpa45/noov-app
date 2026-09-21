import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Check, LogIn, FileDown, Loader2, ExternalLink, KeyRound, PartyPopper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";

const AffiliateConfirmation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAccess, setCopiedAccess] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const affiliateLink = code ? `https://noov.app.br/cadastro?ref=${code}` : "";

  useEffect(() => {
    // Try to get codes from navigation state first
    const stateCode = (location.state as any)?.codigo;
    const stateAccessCode = (location.state as any)?.codigo_acesso;
    if (stateCode) {
      setCode(stateCode);
      if (stateAccessCode) setAccessCode(stateAccessCode);
      setLoading(false);
      return;
    }

    // Fallback: fetch from DB if user is available
    const userId = (location.state as any)?.userId || user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchCode = async () => {
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from("profiles")
          .select("codigo_afiliado, codigo_acesso")
          .eq("user_id", userId)
          .single();
        const c = (data as any)?.codigo_afiliado;
        const ac = (data as any)?.codigo_acesso;
        if (c) {
          setCode(c);
          if (ac) setAccessCode(ac);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      setLoading(false);
    };
    fetchCode();
  }, [user, location.state]);

  const copyToClipboard = (text: string, type: "link" | "code" | "access") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else if (type === "access") {
      setCopiedAccess(true);
      setTimeout(() => setCopiedAccess(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const generatePdf = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("NOOV", pageWidth / 2, 30, { align: "center" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Informacoes do Afiliado", pageWidth / 2, 42, { align: "center" });

      // Divider
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.8);
      doc.line(20, 50, pageWidth - 20, 50);

      // Access code section
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Codigo de Acesso ao Painel:", 20, 65);
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235);
      doc.text(accessCode || "N/A", 20, 78);

      // Affiliate link code section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Codigo do Link de Indicacao:", 20, 95);
      doc.setFontSize(16);
      doc.setTextColor(100, 100, 100);
      doc.text(code, 20, 106);

      // Link section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Link de Compartilhamento:", 20, 120);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(37, 99, 235);
      doc.text(affiliateLink, 20, 132);

      // Instructions
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Como funciona:", 20, 150);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const instructions = [
        "1. Compartilhe o link acima com lojistas",
        "2. Quando eles se cadastrarem pelo link, serao vinculados a sua conta",
        "3. Voce recebera comissoes automaticamente sobre os pagamentos",
      ];
      instructions.forEach((line, i) => {
        doc.text(line, 25, 163 + i * 10);
      });

      // Login info
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Acesse seu painel:", 20, 200);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(37, 99, 235);
      doc.text("https://noov.app.br/afiliado/login", 20, 210);

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text("Use seu CODIGO DE ACESSO (nao o codigo do link) para entrar.", 20, 222);

      // Footer
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 270, pageWidth - 20, 270);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("NOOV - Seu delivery profissional sem taxas abusivas", pageWidth / 2, 278, { align: "center" });

      doc.save(`NOOV-Afiliado-${code}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    }
    setGeneratingPdf(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg space-y-6"
      >
        {/* Success header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            Conta criada com sucesso! 🎉
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Verifique seu e-mail para confirmar. Abaixo estão seus dados de afiliado.
          </p>
        </motion.div>

        {/* Access Code - for login */}
        {accessCode && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-destructive" />
                  Código de acesso ao painel
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Use este código para fazer login. <strong>Não compartilhe com ninguém!</strong>
                </p>
                <div className="flex gap-2">
                  <Input
                    value={accessCode}
                    readOnly
                    className="text-center text-2xl tracking-[0.3em] uppercase font-mono font-bold bg-card"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(accessCode, "access")}
                    className="shrink-0"
                  >
                    {copiedAccess ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}


        {/* Sharing Link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                Link de compartilhamento
              </p>
              <div className="flex gap-2">
                <Input
                  value={affiliateLink}
                  readOnly
                  className="bg-card font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(affiliateLink, "link")}
                  className="shrink-0"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Lojistas que se cadastrarem por este link serão vinculados à sua conta automaticamente
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button
            onClick={() => window.open("https://noov.app.br/afiliado", "_blank")}
            className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold h-12"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Fazer login como afiliado
          </Button>

          <Button
            onClick={generatePdf}
            variant="outline"
            className="w-full h-12"
            disabled={generatingPdf}
          >
            {generatingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            Baixar PDF com informações
          </Button>
        </motion.div>

        <p className="text-xs text-muted-foreground text-center">
          Guarde seu código de acesso. Ele é sua chave de login em{" "}
          <button onClick={() => navigate("/afiliado/login")} className="text-primary hover:underline font-medium">
            /afiliado/login
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default AffiliateConfirmation;
