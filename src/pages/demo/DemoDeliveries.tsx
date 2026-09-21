import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Bike, User, MapPin, CheckCircle2 } from "lucide-react";
import { useDemoRequired } from "@/contexts/DemoContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DemoDeliveries = () => {
  const { deliveries, assignDelivery } = useDemoRequired();

  const handleAssign = (deliveryId: string) => {
    assignDelivery(deliveryId, "demo-driver-001");
    toast.success("Entregador designado com sucesso (demo)");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Entregas</h1>
        <Badge variant="outline" className="bg-blue-50">
          {deliveries.length} ativa(s)
        </Badge>
      </div>

      <div className="grid gap-4">
        {deliveries.length > 0 ? (
          deliveries.map((delivery) => (
            <Card key={delivery.id} className="overflow-hidden border-border/50">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Entrega Nº {delivery.id.split("-").pop()}</CardTitle>
                      <p className="text-[10px] text-muted-foreground">Pedido: {delivery.pedido?.cliente_nome}</p>
                    </div>
                  </div>
                  <Badge className={delivery.status === "pendente" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                    {delivery.status === "pendente" ? "Aguardando Entregador" : "Em Trânsito"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <p className="text-xs">{delivery.endereco_entrega || "Endereço não informado"}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-dashed">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-medium">
                        {delivery.entregador_id ? "João (Entregador)" : "Não designado"}
                      </p>
                    </div>
                    {!delivery.entregador_id && (
                      <Button size="sm" onClick={() => handleAssign(delivery.id)} className="h-8">
                        <Bike className="w-3 h-3 mr-1" />
                        Designar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-10 text-center">
              <Truck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground font-medium">Nenhuma entrega ativa</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">
                As entregas aparecerão aqui quando você clicar em <strong>"Enviar para entrega"</strong> na tela de pedidos.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DemoDeliveries;