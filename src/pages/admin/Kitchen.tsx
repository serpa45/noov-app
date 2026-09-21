import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Loader2,
  Flame,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

export default function Kitchen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: loja } = useQuery({
    queryKey: ["loja-kitchen", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["kitchen-pedidos", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_pedidos")
        .select("*, pdv_comandas(mesa_id, garcom_id, pdv_mesas:mesa_id(nome)), pdv_mesas:mesa_id(nome)")
        .eq("loja_id", loja!.id)
        .in("status_cozinha", ["pendente", "preparando", "pronto"])
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!loja,
  });

  useRealtimeSubscription("pdv_pedidos", [["kitchen-pedidos"]], loja ? `loja_id=eq.${loja.id}` : undefined);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pdv_pedidos").update({ status_cozinha: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-pedidos"] });
      if (status === "pronto") toast.success("🔔 Pedido marcado como pronto!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const pendentes = useMemo(() => pedidos.filter((p: any) => p.status_cozinha === "pendente"), [pedidos]);
  const preparando = useMemo(() => pedidos.filter((p: any) => p.status_cozinha === "preparando"), [pedidos]);
  const prontos = useMemo(() => pedidos.filter((p: any) => p.status_cozinha === "pronto"), [pedidos]);

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${mins % 60}m`;
  };

  const getMesaNome = (pedido: any) => {
    return pedido.pdv_mesas?.nome || pedido.pdv_comandas?.pdv_mesas?.nome || "Balcão";
  };

  const renderPedidoCard = (pedido: any, statusType: string) => {
    const isOld = (Date.now() - new Date(pedido.created_at).getTime()) > 600000; // 10min

    return (
      <motion.div
        key={pedido.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        layout
      >
        <Card className={`border-border/50 shadow-card ${isOld && statusType !== "pronto" ? "ring-2 ring-destructive/50" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-lg font-bold font-display text-foreground">{getMesaNome(pedido)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 text-xs ${isOld && statusType !== "pronto" ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                  <Clock className="w-3 h-3" /> {getTimeSince(pedido.created_at)}
                </div>
              </div>
            </div>

            <div className="space-y-1 mb-3">
              {Array.isArray(pedido.items) && pedido.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">
                    {item.qtd || item.qty || 1}x {item.weight ? `(${item.weight}${item.unidade_medida === "kg" ? "g" : "ml"}) ` : ""}{item.nome || item.name}
                  </span>
                </div>
              ))}
            </div>

            {pedido.observacoes && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mb-3">
                Obs: {pedido.observacoes}
              </p>
            )}

            <div className="flex gap-2">
              {statusType === "pendente" && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => updateStatus.mutate({ id: pedido.id, status: "preparando" })}
                  disabled={updateStatus.isPending}
                >
                  <Flame className="w-4 h-4 mr-1" /> Preparar
                </Button>
              )}
              {statusType === "preparando" && (
                <Button
                  size="sm"
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => updateStatus.mutate({ id: pedido.id, status: "pronto" })}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Pronto!
                </Button>
              )}
              {statusType === "pronto" && (
                <div className="w-full flex items-center justify-center gap-2 text-success text-sm font-bold">
                  <Bell className="w-4 h-4 animate-bounce" />
                  Aguardando garçom
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-primary" /> Cozinha
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie os pedidos em tempo real</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Pendentes: {pendentes.length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary" /> Preparando: {preparando.length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success" /> Prontos: {prontos.length}
          </span>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="text-center py-20">
          <ChefHat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum pedido na cozinha no momento</p>
          <p className="text-xs text-muted-foreground mt-1">Novos pedidos aparecerão automaticamente</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Pendentes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <h2 className="font-bold text-foreground">Novos ({pendentes.length})</h2>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {pendentes.map((p: any) => renderPedidoCard(p, "pendente"))}
              </AnimatePresence>
            </div>
          </div>

          {/* Preparando */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-secondary" />
              <h2 className="font-bold text-foreground">Preparando ({preparando.length})</h2>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {preparando.map((p: any) => renderPedidoCard(p, "preparando"))}
              </AnimatePresence>
            </div>
          </div>

          {/* Prontos */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-success" />
              <h2 className="font-bold text-foreground">Prontos ({prontos.length})</h2>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {prontos.map((p: any) => renderPedidoCard(p, "pronto"))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
