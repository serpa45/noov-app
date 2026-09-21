import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CtaSection = () => {
  const navigate = useNavigate();

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

  return (
    <section className="py-24 bg-gradient-hero relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-10 right-20 w-64 h-64 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-20 w-80 h-80 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <Zap className="w-12 h-12 text-secondary mx-auto mb-6" />
          <h2 className="text-3xl md:text-5xl font-extrabold font-display text-primary-foreground mb-6">
            Pare de perder vendas. Seu delivery profissional começa agora.
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-4">
            "Venda direto para seus clientes. Sem marketplace. Sem comissão."
          </p>
          <p className="text-base text-primary-foreground/60 mb-8">
            Do zero ao delivery completo em menos de 10 minutos.
            {trialDays > 0
              ? ` Teste grátis por ${trialDays} dias!`
              : " Plano grátis para começar."}
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/cadastro")}
            className="bg-gradient-cta text-lg px-10 py-7 rounded-xl font-bold shadow-elevated hover:scale-105 transition-transform text-accent-foreground border-0"
          >
            Criar Minha Loja Grátis
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <p className="text-sm text-primary-foreground/60 mt-4">
            {trialDays > 0
              ? `${trialDays} dias grátis • Sem cartão de crédito • Cancele quando quiser`
              : "Sem cartão de crédito • Setup em 5 minutos • Cancele quando quiser"}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CtaSection;
