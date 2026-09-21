import { motion } from "framer-motion";

const segments = [
  {
    emoji: "🍕",
    name: "Pizzaria",
    features: ["1, 2 ou 3 sabores", "Cobra o sabor mais caro", "Bordas recheadas", "Tamanhos variados"],
  },
  {
    emoji: "🍔",
    name: "Hamburgueria",
    features: ["Adicionais configuráveis", "Montagem de combos", "Observações do cliente", "Promoções"],
  },
  {
    emoji: "🍧",
    name: "Açaiteria",
    features: ["Complementos ilimitados", "Montagem livre", "Tamanhos personalizados", "Toppings"],
  },
  {
    emoji: "🥪",
    name: "Lanchonete",
    features: ["Cardápio flexível", "Combos e promoções", "Pedidos rápidos", "Variações"],
  },
];

const SegmentsSection = () => {
  return (
    <section className="py-24 bg-background" id="segmentos">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Multi-Segmento
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-foreground mb-4">
            Inteligência adaptada ao{" "}
            <span className="text-gradient-hero">seu negócio</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            O sistema reconhece seu segmento e configura automaticamente os campos, regras e fluxos ideais.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {segments.map((seg, i) => (
            <motion.div
              key={seg.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300"
            >
              <span className="text-4xl mb-4 block">{seg.emoji}</span>
              <h3 className="text-xl font-bold font-display text-foreground mb-3">{seg.name}</h3>
              <ul className="space-y-2">
                {seg.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SegmentsSection;
