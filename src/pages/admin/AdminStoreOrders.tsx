import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, Loader2, Star } from "lucide-react";

const AdminStoreOrders = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: loja } = useQuery({
    queryKey: ["admin-loja-detail", id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("nome, user_id").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["admin-loja-pedidos", loja?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", loja!.user_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!loja?.user_id,
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/lojas/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold font-display">
          Pedidos — {loja?.nome || "Loja"}
        </h1>
        <Badge variant="outline" className="text-xs">{pedidos.length} pedidos</Badge>
      </div>

      <Card className="border-border/50 shadow-card">
        <CardContent className="p-0">
          {pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum pedido encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left bg-muted/30">
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium">Data</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium">Tipo</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium">Cliente</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium">Telefone</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium text-right">Total</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium">Endereço</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium text-center">Avaliação</th>
                    <th className="py-3 px-3 text-xs text-muted-foreground font-medium">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/20 last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px]">{p.tipo}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-foreground">{p.cliente_nome || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{p.cliente_telefone || "—"}</td>
                      <td className="py-2.5 px-3">
                        <Badge className={`text-[10px] border-0 ${
                          p.status === "entregue" || p.status === "finalizado" ? "bg-green-500/10 text-green-700" :
                          p.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                          p.status === "pendente" ? "bg-yellow-500/10 text-yellow-700" :
                          "bg-primary/10 text-primary"
                        }`}>{p.status}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-foreground">{formatCurrency(Number(p.total))}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[180px] truncate">{p.endereco_entrega || "—"}</td>
                      <td className="py-2.5 px-3 text-center">
                        {p.avaliacao ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-[10px] font-bold text-yellow-700">{p.avaliacao}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[140px] truncate">{p.observacoes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStoreOrders;
