import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Star, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PaymentModal from "@/components/admin/PaymentModal";
import { useAuth } from "@/contexts/AuthContext";

const fallbackPlans = [
  {
    nome: "Start", preco: 0, periodo: "para sempre",
    descricao: "Ideal para validar seu negócio e começar a vender",
    popular: false, cta_texto: "Assinar Start",
    features: ["Até 30 produtos", "Até 100 clientes", "Pedidos online", "Painel básico", "Branding NOOV", "Suporte por e-mail"],
  },
  {
    nome: "Pro", preco: 97, periodo: "/mês",
    descricao: "Para negócios em crescimento que querem escalar vendas",
    popular: true, cta_texto: "Assinar Pro",
    features: ["Produtos ilimitados", "Clientes ilimitados", "PDV Balcão + Garçom", "Gestão de entregas", "Automação WhatsApp", "Cupons inteligentes", "Relatórios de lucro real", "Sem branding NOOV", "Suporte prioritário"],
  },
  {
    nome: "Ultra", preco: 197, periodo: "/mês",
    descricao: "Tudo ilimitado para operação profissional de alto volume",
    popular: false, cta_texto: "Assinar Ultra",
    features: ["Tudo do Pro", "Multi-lojas", "API aberta", "Domínio personalizado", "Recompra automática", "Programa de fidelidade", "Relatórios de BI", "Gerente de conta dedicado"],
  },
];

const PricingSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; nome: string; preco: number; periodo: string } | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: dbPlans } = useQuery({
    queryKey: ["landing-planos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, nome, preco, preco_promocional, promo_duracao_meses, periodo, descricao, popular, features, cta_texto, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      return data;
    },
    staleTime: 60_000,
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

  const plans = (dbPlans && dbPlans.length > 0 ? dbPlans : fallbackPlans) as Array<{
    id?: string;
    nome: string;
    preco: number;
    preco_promocional?: number;
    promo_duracao_meses?: number;
    periodo: string;
    descricao: string | null;
    popular: boolean;
    features: string[];
    cta_texto: string;
  }>;

  const handlePlanClick = (plan: typeof plans[number]) => {
    if (plan.preco === 0) {
      navigate("/cadastro");
    } else if (trialDays > 0) {
      navigate("/cadastro");
    } else if (!user) {
      navigate("/cadastro");
    } else {
      // No trial — open payment modal
      setSelectedPlan({ id: plan.id || "", nome: plan.nome, preco: plan.preco, periodo: plan.periodo });
      setPaymentOpen(true);
    }
  };

  return (
    <section className="py-24 bg-muted/50" id="planos">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
            Planos
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-foreground mb-4">
            Escolha o plano ideal para{" "}
            <span className="text-secondary">seu momento</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Comece grátis. Escale quando quiser. Sem surpresas.
          </p>
          {trialDays > 0 && (
            <p className="text-sm font-semibold text-primary mt-3">
              🎉 Teste grátis por {trialDays} dias com todos os recursos!
            </p>
          )}
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan, i) => {
            const priceLabel = plan.preco === 0 ? "Grátis" : `R$ ${plan.preco}`;
            return (
              <motion.div
                key={plan.nome}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-8 rounded-2xl border transition-all ${
                  plan.popular
                    ? "bg-gradient-hero text-primary-foreground border-transparent shadow-glow scale-105"
                    : "bg-card border-border/50 shadow-card"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-cta text-accent-foreground text-sm font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    Mais Popular
                  </div>
                )}

                <h3 className={`text-xl font-bold font-display mb-1 ${plan.popular ? "" : "text-foreground"}`}>
                  {plan.nome}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {plan.descricao}
                </p>

                <div className="mb-6">
                  {plan.preco_promocional && plan.promo_duracao_meses && plan.promo_duracao_meses > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold font-display">R$ {plan.preco_promocional}</span>
                        <span className={`text-xs ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          por {plan.promo_duracao_meses} meses
                        </span>
                      </div>
                      <div className={`text-xs ${plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        Depois R$ {plan.preco}{plan.periodo}
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-4xl font-extrabold font-display">{priceLabel}</span>
                      <span className={`text-sm ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {plan.periodo}
                      </span>
                    </>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f: string) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 ${plan.popular ? "text-secondary" : "text-primary"}`} />
                      <span className={plan.popular ? "text-primary-foreground/90" : "text-foreground"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {trialDays > 0 && plan.preco > 0 && (
                  <p className={`text-xs font-semibold text-center mb-3 ${plan.popular ? "text-secondary" : "text-primary"}`}>
                    {trialDays} dias grátis com todos os recursos
                  </p>
                )}

                <Button
                  onClick={() => handlePlanClick(plan)}
                  className={`w-full py-6 rounded-xl font-bold text-base ${
                    plan.popular
                      ? "bg-gradient-cta text-accent-foreground hover:scale-105 transition-transform border-0"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {trialDays > 0 && plan.preco > 0
                    ? `Testar ${trialDays} dias grátis`
                    : plan.cta_texto}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <PaymentModal
        open={paymentOpen}
        onClose={() => { setPaymentOpen(false); setSelectedPlan(null); }}
        plan={selectedPlan}
      />
    </section>
  );
};

export default PricingSection;
