import { useQuery } from "@tanstack/react-query";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Plus, 
  Copy, 
  ExternalLink, 
  Smartphone, 
  Loader2, 
  UserPlus, 
  Shield, 
  UserRound, 
  BriefcaseBusiness, 
  Trash2,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import LojaUsuariosManager from "@/components/admin/LojaUsuariosManager";

export default function WaiterComandasPage() {
  const { user } = useAuth();
  useKeepScreenOn();
  const [showAddWaiter, setShowAddWaiter] = useState(false);

  const { data: loja } = useQuery({
    queryKey: ["loja-waiter-comandas", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, slug, nome").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["loja-usuarios-comandas", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_usuarios")
        .select("*")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .in("nivel", ["funcionario", "gerente"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!loja?.id,
  });

  const waiters = usuarios.filter((u: any) => u.nivel === "funcionario" || u.nivel === "gerente");

  const copyLink = (waiterName: string) => {
    const link = `https://noov.app.br/comanda/${loja?.slug || 'loja'}`;
    navigator.clipboard.writeText(link);
    toast.success(`Link de acesso copiado para ${waiterName}!`);
  };

  const openLink = () => {
    window.open(`/comanda/${loja?.slug || 'loja'}`, "_blank");
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Comandas (Garçons)</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus garçons e links de acesso para celular</p>
        </div>
        <Button onClick={() => setShowAddWaiter(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Novo Garçom
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Garçons Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {waiters.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center gap-2">
                <Users className="w-10 h-10 text-muted-foreground opacity-20" />
                <p className="text-sm text-muted-foreground">Nenhum garçom cadastrado ainda.</p>
                <Button variant="outline" size="sm" onClick={() => setShowAddWaiter(true)} className="mt-2">
                  Cadastrar Primeiro Garçom
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {waiters.map((waiter: any) => (
                  <div key={waiter.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                        waiter.nivel === "gerente" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-blue-50 text-blue-600 border-blue-200"
                      }`}>
                        {waiter.nivel === "gerente" ? <BriefcaseBusiness className="w-5 h-5" /> : <UserRound className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{waiter.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 uppercase">
                            {waiter.nivel}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">PIN: {waiter.pin}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => copyLink(waiter.nome)}
                      >
                        <Copy className="w-3 h-3" /> Copiar Link
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={openLink}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" /> Acesso Mobile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Para usar o aplicativo de comanda no celular, o garçom deve acessar o link abaixo e entrar com o nome e PIN dele.
              </p>
              <div className="bg-white border border-border/60 p-3 rounded-lg flex flex-col items-center gap-3 shadow-inner">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">URL de Acesso</p>
                  <p className="text-xs font-mono break-all text-primary font-bold">
                    noov.app.br/comanda/{loja?.slug || 'loja'}
                  </p>
                </div>
                <Button className="w-full h-9 gap-2" size="sm" onClick={() => copyLink("Sistema")}>
                  <Copy className="w-4 h-4" /> Copiar URL
                </Button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground">
                Dica: O garçom pode "Adicionar à tela de início" no navegador do celular para ter um ícone como app.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAddWaiter} onOpenChange={setShowAddWaiter}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Usuários (Garçons)</DialogTitle>
            <DialogDescription>
              Cadastre novos garçons e defina o PIN de acesso. Use o nível "Funcionário" ou "Gerente" para eles.
            </DialogDescription>
          </DialogHeader>
          {loja?.id && <LojaUsuariosManager lojaId={loja.id} />}
          <DialogFooter>
            <Button onClick={() => {
              setShowAddWaiter(false);
              // Invalidate query to refresh list
              supabase.from("loja_usuarios").select("*").eq("loja_id", loja?.id);
            }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
