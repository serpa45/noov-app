import { motion } from "framer-motion";
import { ArrowRight, Zap, Store, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroBanner from "@/assets/hero-banner.png";
import heroDevices from "@/assets/hero-devices.png.asset.json";
import heroBurger from "@/assets/hero-burger.png";

const HeroSection = () => {
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
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-hero">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <img src={heroBanner} alt="" className="absolute bottom-0 right-0 w-full h-full object-cover object-center opacity-20 pointer-events-none select-none" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/3 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 mb-6"
            >
              <Zap className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium text-primary-foreground/90">
                +2.000 lojas já vendem sem depender de marketplace
              </span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-display text-primary-foreground leading-tight mb-6">
              Pare de perder dinheiro no iFood.{" "}
              <span className="relative">
                Crie seu próprio delivery
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 8C60 2 240 2 298 8" stroke="hsl(25, 95%, 55%)" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>{" "}
              hoje.
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-xl mx-auto lg:mx-0">
              Sistema completo para hamburguerias, pizzarias, açaiterias e lanchonetes aumentarem vendas e reduzirem custos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                size="lg"
                onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}
                className="bg-gradient-cta text-lg px-8 py-6 rounded-xl font-bold shadow-elevated hover:scale-105 transition-transform text-accent-foreground border-0"
              >
                Escolha um plano
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/demo")}
                className="text-lg px-8 py-6 rounded-xl font-semibold bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 backdrop-blur-sm"
              >
                Ver Demonstração
              </Button>
            </div>

            {trialDays > 0 && (
              <p className="text-sm font-semibold text-secondary mt-2 text-center lg:text-left">
                🎉 Teste grátis por {trialDays} dias em todos os planos!
              </p>
            )}

            <div className="flex items-center gap-6 mt-8 justify-center lg:justify-start text-primary-foreground/70">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                <span className="text-sm">Pronto em 5 min</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Zero taxa por pedido</span>
              </div>
            </div>

            {/* Trust phrases */}
            <div className="flex flex-wrap gap-3 mt-6 justify-center lg:justify-start">
              {[
                "Seu delivery, suas regras",
                "Menos taxas, mais lucro",
                "Você no controle",
              ].map((phrase) => (
                <span
                  key={phrase}
                  className={`text-xs px-3 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground/60 border border-primary-foreground/10 ${
                    phrase === "Menos taxas, mais lucro" ? "w-full sm:w-auto text-center" : ""
                  }`}
                >
                  {phrase}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Hero Devices Image */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              {/* Hambúrguer atrás do notebook, completo, alinhado à base da tela */}
              <motion.img
                src={heroBurger}
                alt=""
                aria-hidden="true"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="absolute top-[22%] -translate-y-1/2 -left-16 xl:-left-24 w-56 xl:w-72 h-auto pointer-events-none select-none z-0"
              />

              <img
                src={heroDevices.url}
                alt="NOOV painel do lojista no notebook e cardápio digital no celular"
                className="relative z-10 w-full h-auto object-contain drop-shadow-2xl scale-110 xl:scale-115 origin-center"
              />

              {/* Label: Gerenciador de Pedidos (sobre o notebook) */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="absolute -top-14 left-4 lg:left-8 bg-card rounded-xl shadow-elevated px-4 py-2 border border-border/50 flex items-center gap-2 z-20"
              >
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-semibold font-display text-foreground whitespace-nowrap">
                  Gerenciador de Pedidos
                </span>
              </motion.div>

              {/* Label: Cardápio do Cliente (abaixo do celular) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="absolute -bottom-16 right-2 lg:right-6 bg-card rounded-xl shadow-elevated px-4 py-2 border border-border/50 flex items-center gap-2 z-10"
              >
                <span className="text-lg">📱</span>
                <span className="text-sm font-semibold font-display text-foreground whitespace-nowrap">
                  Cardápio do Cliente
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
