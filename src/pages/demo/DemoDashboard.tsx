import { motion } from "framer-motion";
import { DollarSign, ShoppingCart, TrendingUp, Users, Package, CheckCircle2, AlertCircle, ChefHat, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDemoRequired } from "@/contexts/DemoContext";
import { useMemo } from "react";

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: AlertCircle },
  preparando: { label: "Em preparo", className: "bg-blue-100 text-blue-800 border-blue-200", icon: ChefHat },
  em_entrega: { label: "Em entrega", className: "bg-orange-100 text-orange-800 border-orange-200", icon: Truck },
  entregue: { label: "Finalizado", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
};

const DemoDashboard = () => {
  const { orders, products } = useDemoRequired();

  const stats = useMemo(() => {
    const totalPedidos = orders.length;
    const totalFaturamento = orders.reduce((acc, o) => acc + o.total, 0);
    const pendentes = orders.filter((o) => o.status === "pendente").length;
    const entregues = orders.filter((o) => o.status === "entregue").length;
    return { totalPedidos, totalFaturamento, pendentes, entregues, totalProdutos: products.length };
  }, [orders, products]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua loja</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Pedidos Hoje", value: stats.totalPedidos, icon: ShoppingCart, color: "text-primary", change: "+23%" },
          { title: "Faturamento", value: `R$ ${stats.totalFaturamento.toFixed(2)}`, icon: DollarSign, color: "text-emerald-500", change: "+18%" },
          { title: "Produtos", value: stats.totalProdutos, icon: Package, color: "text-blue-500", change: "" },
          { title: "Clientes", value: 47, icon: Users, color: "text-purple-500", change: "+12%" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  {stat.change && <span className="text-xs font-bold text-emerald-500">{stat.change}</span>}
                </div>
                <p className="text-2xl font-bold font-display mt-2">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Últimos Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders.map((order) => {
              const cfg = statusConfig[order.status] || statusConfig.pendente;
              return (
                <div key={order.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-semibold">{order.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {(order.items as any[]).map((i: any) => `${i.quantidade}x ${i.weight ? `(${i.weight}${i.unidade_medida === "kg" ? "g" : "ml"}) ` : ""}${i.nome}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold">R$ {order.total.toFixed(2)}</p>
                    <Badge className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DemoDashboard;
