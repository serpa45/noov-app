import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Store, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const AdminStores = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["admin-all-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select(`
          *,
          loja_planos(
            ativo,
            preco_assinado,
            expira_em,
            planos(nome)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) console.error("Erro ao buscar lojas:", error);
      return data ?? [];
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("lojas").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-lojas"] });
      toast({ title: ativo ? "Loja ativada" : "Loja desativada" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const deleteLoja = async (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    if (!confirm(`AVISO: Esta ação excluirá DEFINITIVAMENTE a loja "${nome}", todos os produtos, pedidos, clientes, histórico financeiro, entregadores e a conta do lojista. Deseja continuar?`)) return;
    
    toast({ title: "Excluindo lojista...", description: "Por favor, aguarde enquanto limpamos todos os dados." });
    
    try {
      const { error } = await supabase.functions.invoke("delete-loja", {
        body: { lojaId: id },
      });

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["admin-all-lojas"] });
      toast({ title: "Loja e dados excluídos com sucesso" });
    } catch (err: any) {
      console.error("Erro ao excluir loja:", err);
      toast({ 
        title: "Erro ao excluir loja", 
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive" 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ativas = lojas.filter((l: any) => l.ativo !== false).length;
  const expiradas = lojas.filter((l: any) => {
    const lojaPlanoRaw = l.loja_planos;
    const lojaPlanoArr = Array.isArray(lojaPlanoRaw) ? lojaPlanoRaw : lojaPlanoRaw ? [lojaPlanoRaw] : [];
    const activePlan = lojaPlanoArr.find((lp: any) => lp?.ativo);
    if (!activePlan?.expira_em) return false;
    return new Date(activePlan.expira_em) < new Date();
  }).length;
  const inativas = lojas.length - ativas;

  const totalAtivo = lojas.reduce((acc: number, loja: any) => {
    const lojaPlanoRaw = loja.loja_planos;
    const lojaPlanoArr = Array.isArray(lojaPlanoRaw) ? lojaPlanoRaw : lojaPlanoRaw ? [lojaPlanoRaw] : [];
    const activePlan = lojaPlanoArr.find((lp: any) => lp?.ativo);
    return acc + (Number(activePlan?.preco_assinado) || 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <span>{lojas.length} loja(s) total</span>
        <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
          {ativas} ativas • R$ {totalAtivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </Badge>
        {expiradas > 0 && (
          <Badge variant="outline" className="text-orange-700 border-orange-200 bg-orange-50">
            {expiradas} expiradas
          </Badge>
        )}
        {inativas > 0 && (
          <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">
            {inativas} inativas
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lojas.map((loja: any) => {
          const isAtivo = loja.ativo !== false;
          const lojaPlanoRaw = loja.loja_planos;
          const lojaPlanoArr = Array.isArray(lojaPlanoRaw) ? lojaPlanoRaw : lojaPlanoRaw ? [lojaPlanoRaw] : [];
          const activePlan = lojaPlanoArr.find((lp: any) => lp?.ativo);
          const isExpirada = activePlan?.expira_em && new Date(activePlan.expira_em) < new Date();
          const planName = activePlan?.planos?.nome || "Teste";
          const planPrice = activePlan?.preco_assinado;
          const diasRestantes = activePlan?.expira_em
            ? Math.ceil((new Date(activePlan.expira_em).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <Card
              key={loja.id}
              className={`border-border/50 shadow-card transition-all cursor-pointer hover:shadow-elevated hover:border-primary/30 ${!isAtivo ? "opacity-60" : ""} ${isExpirada ? "border-orange-300 bg-orange-50/30" : ""}`}
              onClick={() => navigate(`/admin/lojas/${loja.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  {loja.logo_url ? (
                    <img src={loja.logo_url} alt={loja.nome} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-display truncate">{loja.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">/{loja.slug}</p>
                  </div>
                  <Switch
                    checked={isAtivo}
                    onCheckedChange={(checked) => {
                      toggleAtivo.mutate({ id: loja.id, ativo: checked });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title={isAtivo ? "Desativar loja" : "Ativar loja"}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${
                      loja.segmento === "hamburgueria" ? "text-red-700 border-red-300 bg-red-50" :
                      loja.segmento === "acaiteria" ? "text-purple-700 border-purple-300 bg-purple-50" :
                      loja.segmento === "pizzaria" ? "text-amber-700 border-amber-300 bg-amber-50" :
                      loja.segmento === "lanchonete" ? "text-green-700 border-green-300 bg-green-50" :
                      ""
                    }`}>{loja.segmento}</Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${isAtivo ? "text-green-700 border-green-200" : "text-red-700 border-red-200"}`}
                    >
                      {isAtivo ? "Ativa" : "Inativa"}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {planName} {planPrice ? `• R$ ${Number(planPrice).toFixed(2)}` : ""}
                    </Badge>
                    {diasRestantes !== null && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          diasRestantes <= 0
                            ? "text-red-700 border-red-200 bg-red-50"
                            : diasRestantes <= 7
                            ? "text-orange-700 border-orange-200 bg-orange-50"
                            : "text-green-700 border-green-200 bg-green-50"
                        }`}
                      >
                        {diasRestantes <= 0
                          ? "Expirado"
                          : `${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => deleteLoja(e, loja.id, loja.nome)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {lojas.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            Nenhuma loja cadastrada.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminStores;
