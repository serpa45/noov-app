import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, ExternalLink, Share2, Loader2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const AffiliateLink = () => {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["affiliate-code", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("codigo_afiliado")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: trialConfig } = useQuery({
    queryKey: ["config-global", "dias_teste_gratis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "dias_teste_gratis")
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const trialDays = trialConfig?.valor ? parseInt(trialConfig.valor) : 0;
  const trialActive = trialDays > 0;

  const code = (profile as any)?.codigo_afiliado || "";
  const affiliateLink = code ? `https://noov.app.br/cadastro?ref=${code}` : "";

  const copyLink = () => {
    if (!affiliateLink) return;
    navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!affiliateLink) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Conheça o NOOV! O melhor sistema de delivery sem taxas por pedido. Cadastre-se: ${affiliateLink}`)}`,
      "_blank"
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">
          Meu Link 🔗
        </h1>
        <p className="text-muted-foreground mt-1">Compartilhe e ganhe comissões recorrentes</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              Seu link exclusivo de afiliado
            </p>
            {code ? (
              <>
                <div className="flex gap-2">
                  <Input value={affiliateLink} readOnly className="bg-card font-mono text-sm" />
                  <Button
                    onClick={copyLink}
                    className={`px-4 shrink-0 transition-all ${
                      copied ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Seu código: <span className="font-mono font-bold text-foreground">{code}</span> — cada lojista que se cadastrar por este link será vinculado à sua conta automaticamente.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum código de afiliado encontrado. Entre em contato com o suporte.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-border/50 shadow-card">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-bold font-display text-foreground flex items-center gap-2">
              <Share2 className="w-4 h-4 text-muted-foreground" />
              Compartilhar
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button onClick={shareWhatsApp} variant="outline" className="justify-start gap-2">
                📱 Compartilhar no WhatsApp
              </Button>
              <Button onClick={copyLink} variant="outline" className="justify-start gap-2">
                📋 Copiar link
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-border/50 shadow-card">
          <CardContent className="p-6">
            <h3 className="font-bold font-display text-foreground mb-3">💡 Dicas para mais indicações</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Compartilhe em grupos de WhatsApp de comerciantes e empreendedores</li>
              <li>• Poste nas redes sociais mostrando os benefícios do NOOV</li>
              <li>• Visite pessoalmente restaurantes e lanchonetes da sua região</li>
              <li>• Mostre a comparação com taxas do iFood — isso converte muito!</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {trialActive && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-secondary/30 bg-secondary/5 shadow-card">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-bold font-display text-foreground">🎁 Teste Grátis Ativo</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Seus indicados ganham <span className="font-bold text-secondary">{trialDays} dias grátis</span> para testar a plataforma — isso facilita a conversão! Compartilhe essa vantagem ao divulgar seu link.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default AffiliateLink;
