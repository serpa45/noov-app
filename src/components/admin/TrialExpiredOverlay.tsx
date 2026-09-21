import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Flame, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import PaymentModal from "./PaymentModal";
import { useAuth } from "@/contexts/AuthContext";

const TrialExpiredOverlay = () => {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const { user } = useAuth();

  const { data: loja } = useQuery({
    queryKey: ["trial-expired-loja", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("lojas")
        .select("id, plano_id_exclusivo, valor_plano_exclusivo")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["trial-expired-planos", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      return data ?? [];
    },
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-5xl w-full"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold font-display text-foreground mb-2">
              Você já atingiu o período de teste grátis
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Contrate um de nossos planos e volte a aproveitar dos recursos contratados.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 items-start">
              {plans.map((plan: any, i: number) => {
                const isExclusivo = (loja as any)?.plano_id_exclusivo === plan.id && (loja as any)?.valor_plano_exclusivo;
                const precoEfetivo = isExclusivo ? Number((loja as any).valor_plano_exclusivo) : plan.preco;
                
                const features = Array.isArray(plan.features) ? plan.features : [];
                const priceLabel = precoEfetivo === 0 ? "Grátis" : formatCurrency(precoEfetivo);
                
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
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
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold font-display">{priceLabel}</span>
                          {precoEfetivo > 0 && (
                            <span className={`text-sm ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              /mês
                            </span>
                          )}
                        </div>
                        {isExclusivo && plan.preco > 0 && (
                          <span className={`text-xs line-through opacity-70 ${plan.popular ? "text-primary-foreground" : "text-muted-foreground"}`}>
                            De {formatCurrency(plan.preco)}
                          </span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {features.map((f: string) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className={`w-4 h-4 flex-shrink-0 ${plan.popular ? "text-secondary" : "text-primary"}`} />
                          <span className={plan.popular ? "text-primary-foreground/90" : "text-foreground"}>
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full py-5 rounded-xl font-bold ${
                        plan.popular
                          ? "bg-gradient-cta text-accent-foreground hover:scale-105 transition-transform border-0"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                      onClick={() => {
                        if (precoEfetivo === 0) {
                          toast.info("Este plano é gratuito, não precisa de pagamento.");
                          return;
                        }
                        setSelectedPlan({
                          ...plan,
                          preco: precoEfetivo
                        });
                      }}
                    >
                      {plan.cta_texto || "Assinar"}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <PaymentModal
        open={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        plan={selectedPlan}
      />
    </>
  );
};

export default TrialExpiredOverlay;
