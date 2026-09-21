import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Silva",
    business: "Burger House",
    segment: "🍔 Hamburgueria",
    text: "Em 2 meses triplicamos nossos pedidos. O sistema é muito fácil de usar e o suporte é incrível.",
    metric: "+300% pedidos",
  },
  {
    name: "Ana Oliveira",
    business: "Pizza do Forno",
    segment: "🍕 Pizzaria",
    text: "A gestão de sabores e bordas é perfeita. Meus clientes adoram montar a pizza pelo app.",
    metric: "+R$ 8k/mês",
  },
  {
    name: "Rafael Santos",
    business: "Açaí Tropical",
    segment: "🍧 Açaiteria",
    text: "A montagem livre de açaí no cardápio online aumentou nosso ticket médio em 40%.",
    metric: "+40% ticket",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-24 bg-background" id="depoimentos">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Prova Social
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-foreground mb-4">
            Quem usa,{" "}
            <span className="text-gradient-hero">recomenda</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border/50 shadow-card"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-secondary text-secondary" />
                ))}
              </div>
              <p className="text-foreground mb-4 leading-relaxed">"{t.text}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold font-display text-foreground">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.segment} — {t.business}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
                  {t.metric}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
