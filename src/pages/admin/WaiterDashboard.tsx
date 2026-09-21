import { useQuery } from "@tanstack/react-query";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";

export default function WaiterDashboard() {
  const { user } = useAuth();
  useKeepScreenOn();

  const { data: loja } = useQuery({
    queryKey: ["loja-waiter-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["waiter-stats", loja?.id],
    queryFn: async () => {
      // Get all closed comandas with garcom info
      const { data: comandas } = await supabase
        .from("pdv_comandas")
        .select("garcom_id, total, status, created_at")
        .eq("loja_id", loja!.id)
        .eq("status", "fechada");

      if (!comandas || comandas.length === 0) return [];

      // Get garcom profiles
      const garcomIds = [...new Set(comandas.map((c) => c.garcom_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", garcomIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        profileMap[p.user_id] = p.full_name || p.email || "Garçom";
      });

      // Aggregate
      const garcomStats: Record<string, { nome: string; pedidos: number; vendas: number }> = {};
      comandas.forEach((c) => {
        if (!garcomStats[c.garcom_id]) {
          garcomStats[c.garcom_id] = {
            nome: profileMap[c.garcom_id] || "Garçom",
            pedidos: 0,
            vendas: 0,
          };
        }
        garcomStats[c.garcom_id].pedidos++;
        garcomStats[c.garcom_id].vendas += Number(c.total || 0);
      });

      return Object.values(garcomStats).sort((a, b) => b.vendas - a.vendas);
    },
    enabled: !!loja,
  });

  const totalVendas = stats.reduce((s, g) => s + g.vendas, 0);
  const totalPedidos = stats.reduce((s, g) => s + g.pedidos, 0);
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard Garçons</h1>
        <p className="text-sm text-muted-foreground">Performance dos garçons por comandas fechadas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Garçons</p>
                <p className="text-xl font-bold text-foreground">{stats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Comandas</p>
                <p className="text-xl font-bold text-foreground">{totalPedidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Vendas</p>
                <p className="text-xl font-bold text-foreground">R$ {totalVendas.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-xl font-bold text-foreground">R$ {ticketMedio.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Waiter ranking */}
      {stats.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">Nenhuma comanda fechada ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((garcom, i) => (
            <Card key={i} className="border-border/50 shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {i + 1}º
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{garcom.nome}</p>
                      <p className="text-xs text-muted-foreground">{garcom.pedidos} comandas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      R$ {garcom.vendas.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ticket: R$ {(garcom.pedidos > 0 ? garcom.vendas / garcom.pedidos : 0).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
