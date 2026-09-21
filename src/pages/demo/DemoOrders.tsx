import { useDemoRequired } from "@/contexts/DemoContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ChefHat, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const statusFlow = ["pendente", "preparando", "em_entrega", "entregue"];
const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType; next?: string }> = {
  pendente: { label: "Pendente", className: "bg-yellow-100 text-yellow-800", icon: AlertCircle, next: "preparando" },
  preparando: { label: "Em preparo", className: "bg-blue-100 text-blue-800", icon: ChefHat, next: "em_entrega" },
  em_entrega: { label: "Em entrega", className: "bg-orange-100 text-orange-800", icon: Truck, next: "entregue" },
  entregue: { label: "Finalizado", className: "bg-green-100 text-green-800", icon: CheckCircle2 },
};

const DemoOrders = () => {
  const { orders, updateOrderStatus } = useDemoRequired();
  const navigate = useNavigate();

  const handleAdvance = (id: string, current: string) => {
    const cfg = statusConfig[current];
    if (cfg?.next) {
      updateOrderStatus(id, cfg.next);
      toast.success(`Pedido avançado para: ${statusConfig[cfg.next].label} (demo)`);
      if (cfg.next === "em_entrega") {
        navigate("/lojista/entregas");
      }
    }
  };

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold font-display">Pedidos</h1>

      <div className="space-y-3">
        {orders.map((order) => {
          const cfg = statusConfig[order.status] || statusConfig.pendente;
          const Icon = cfg.icon;
          return (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{order.cliente_nome}</p>
                      <Badge className={`text-[10px] ${cfg.className}`}>
                        <Icon className="w-3 h-3 mr-1" /> {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(order.items as any[]).map((i: any) => `${i.quantidade}x ${i.weight ? `(${i.weight}${i.unidade_medida === "kg" ? "g" : "ml"}) ` : ""}${i.nome}`).join(" • ")}
                    </p>
                    {order.endereco_entrega && (
                      <p className="text-xs text-muted-foreground mt-1">📍 {order.endereco_entrega}</p>
                    )}
                    {order.observacoes && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">💬 {order.observacoes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold">R$ {order.total.toFixed(2)}</p>
                    {cfg.next && (
                      <Button size="sm" onClick={() => handleAdvance(order.id, order.status)} className={order.status === "preparando" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}>
                        {order.status === "preparando" ? "Enviar para entrega" : "Avançar"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {orders.length === 0 && (
          <p className="text-center text-muted-foreground py-10">Nenhum pedido na demo</p>
        )}
      </div>
    </div>
  );
};

export default DemoOrders;
