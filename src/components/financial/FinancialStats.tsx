import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, CreditCard, PiggyBank, TrendingUp, ShoppingCart, ArrowUpRight } from "lucide-react";

interface Props {
  receitaTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  margemLucro: number;
  totalPedidos: number;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FinancialStats({ receitaTotal, despesaTotal, lucroLiquido, margemLucro, totalPedidos }: Props) {
  const stats = [
    { label: "Total Pedidos", value: String(totalPedidos), icon: ShoppingCart, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Receita Total", value: fmt(receitaTotal), icon: DollarSign, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Despesas", value: fmt(despesaTotal), icon: CreditCard, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Lucro Líquido", value: fmt(lucroLiquido), icon: PiggyBank, color: lucroLiquido >= 0 ? "text-green-500" : "text-red-500", bg: lucroLiquido >= 0 ? "bg-green-500/10" : "bg-red-500/10" },
    { label: "Margem de Lucro", value: `${margemLucro.toFixed(1)}%`, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {stats.map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <Card className="border-border/50 shadow-sm h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base sm:text-lg font-bold font-display leading-tight break-words">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
