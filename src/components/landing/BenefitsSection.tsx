import { motion } from "framer-motion";
import { ShoppingBag, BarChart3, Truck, Monitor, MessageCircle, Gift } from "lucide-react";

const benefits = [
  {
    icon: ShoppingBag,
    title: "Mais Pedidos, Zero Taxas",
    description: "Pare de depender de marketplace. Venda direto para seus clientes sem pagar comissão por pedido.",
  },
  {
    icon: BarChart3,
    title: "Lucro Real, Não Só Vendas",
    description: "Relatórios que mostram seu lucro líquido de verdade. Saiba exatamente quanto está ganhando.",
  },
  {
    icon: Truck,
    title: "Entregas Sob Controle",
    description: "Gerencie entregadores, acompanhe em tempo real e otimize rotas. Tudo automatizado.",
  },
  {
    icon: Monitor,
    title: "PDV Balcão + Garçom",
    description: "Atenda no salão e no balcão com sistema integrado. Pedidos sincronizados automaticamente.",
  },
  {
    icon: MessageCircle,
    title: "Automação WhatsApp",
    description: "Pedido confirmado, saiu pra entrega, entregue — tudo automático via WhatsApp pro cliente.",
  },
  {
    icon: Gift,
    title: "Cupom",
    description: "Crie cupons de desconto estratégicos para atrair novos clientes e fidelizar os antigos.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const BenefitsSection = () => {
  return (
    <section className="py-24 bg-background" id="beneficios">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Por que a NOOV?
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-foreground mb-4">
            Venda mais, pague menos taxas e{" "}
            <span className="text-gradient-hero">controle tudo</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transforme seu negócio em um delivery automatizado e lucrativo. Sem depender de nenhum marketplace.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {benefits.map((b) => (
            <motion.div
              key={b.title}
              variants={item}
              className="group p-6 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <b.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="text-lg font-bold font-display text-foreground mb-2">{b.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{b.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default BenefitsSection;
