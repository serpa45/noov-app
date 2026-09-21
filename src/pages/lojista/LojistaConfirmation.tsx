import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Check, LogIn, FileDown, Loader2, ExternalLink, Store, PartyPopper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";

const LojistaConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const storeName = (location.state as any)?.storeName || "";
  const storeSlug = (location.state as any)?.storeSlug || "";
  const storeLink = storeSlug ? `https://noov.app.br/${storeSlug}` : "";
  const loginLink = `https://noov.app.br/lojista/login`;

  const [copiedStore, setCopiedStore] = useState(false);
  const [copiedLogin, setCopiedLogin] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const copyToClipboard = (text: string, type: "store" | "login") => {
    navigator.clipboard.writeText(text);
    if (type === "store") {
      setCopiedStore(true);
      setTimeout(() => setCopiedStore(false), 2000);
    } else {
      setCopiedLogin(true);
      setTimeout(() => setCopiedLogin(false), 2000);
    }
  };

  const generatePdf = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("NOOV", pageWidth / 2, 30, { align: "center" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Informacoes da Loja", pageWidth / 2, 42, { align: "center" });

      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.8);
      doc.line(20, 50, pageWidth - 20, 50);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Nome da Loja:", 20, 65);
      doc.setFontSize(16);
      doc.setTextColor(37, 99, 235);
      doc.text(storeName || "N/A", 20, 78);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Link do Cardapio (para clientes):", 20, 95);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(37, 99, 235);
      doc.text(storeLink || "N/A", 20, 107);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Link de Acesso ao Painel do Lojista:", 20, 125);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(37, 99, 235);
      doc.text(loginLink, 20, 137);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Proximos passos:", 20, 158);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const instructions = [
        "1. Confirme seu e-mail para ativar a conta",
        "2. Acesse o painel pelo link acima",
        "3. Cadastre seus produtos e configure sua loja",
        "4. Compartilhe o link do cardapio com seus clientes",
      ];
      instructions.forEach((line, i) => {
        doc.text(line, 25, 171 + i * 10);
      });

      doc.setDrawColor(200, 200, 200);
      doc.line(20, 270, pageWidth - 20, 270);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("NOOV - Seu delivery profissional sem taxas abusivas", pageWidth / 2, 278, { align: "center" });

      doc.save(`NOOV-Loja-${storeSlug || "info"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    }
    setGeneratingPdf(false);
  };

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
            Loja criada com sucesso! 🎉
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Verifique seu e-mail para confirmar a conta. Abaixo estão os links importantes da sua loja.
          </p>
        </motion.div>

        {/* Store menu link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                Link do cardápio (para divulgar aos clientes)
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Compartilhe este link para seus clientes fazerem pedidos
              </p>
              <div className="flex gap-2">
                <Input
                  value={storeLink}
                  readOnly
                  className="bg-card font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(storeLink, "store")}
                  className="shrink-0"
                >
                  {copiedStore ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Login link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Store className="w-4 h-4 text-accent" />
                Link de acesso ao painel do lojista
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Use este link para acessar seu painel e gerenciar sua loja
              </p>
              <div className="flex gap-2">
                <Input
                  value={loginLink}
                  readOnly
                  className="bg-card font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(loginLink, "login")}
                  className="shrink-0"
                >
                  {copiedLogin ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
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
            onClick={() => window.open("https://noov.app.br/lojista/login", "_blank")}
            className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold h-12"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Logar no Sistema
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
          Acesse seu painel em{" "}
          <button onClick={() => window.open("https://noov.app.br/lojista/login", "_blank")} className="text-primary hover:underline font-medium">
            noov.app.br/lojista/login
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default LojistaConfirmation;
