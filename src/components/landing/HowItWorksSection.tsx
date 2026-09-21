import { motion } from "framer-motion";
import { Store, Package, Rocket } from "lucide-react";

const steps = [
  {
    icon: Store,
    step: "01",
    title: "Crie sua Loja",
    description: "Cadastre-se em segundos, escolha seu segmento e personalize seu cardápio.",
  },
  {
    icon: Package,
    step: "02",
    title: "Cadastre seus Produtos",
    description: "Adicione produtos com fotos, variações, adicionais e preços — tudo intuitivo.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Comece a Vender",
    description: "Compartilhe seu link e receba pedidos automaticamente. Simples assim.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-24 bg-muted/50" id="como-funciona">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
            Como Funciona
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-foreground mb-4">
            3 passos para começar a{" "}
            <span className="text-secondary">faturar mais</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
              )}
              <div className="relative z-10 w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-glow">
                <s.icon className="w-10 h-10 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-primary/50 font-display">{s.step}</span>
              <h3 className="text-xl font-bold font-display text-foreground mt-1 mb-2">{s.title}</h3>
              <p className="text-muted-foreground">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
