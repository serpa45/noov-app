import { motion } from "framer-motion";
import { Users, Search, Loader2, Store, ChevronRight, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AffiliatePaymentDialog } from "@/components/affiliate/AffiliatePaymentDialog";

const AffiliateReferrals = () => {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["affiliate-referrals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, slug, segmento, created_at")
        .eq("afiliado_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch active plans for all referral stores
  const lojaIds = lojas.map((l) => l.id);
  const { data: planos = [] } = useQuery({
    queryKey: ["affiliate-referrals-planos", lojaIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("loja_id, ativo")
        .in("loja_id", lojaIds)
        .eq("ativo", true);
      return data ?? [];
    },
    enabled: lojaIds.length > 0,
  });

  // Fetch latest payment status per store
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["affiliate-referrals-pagamentos", lojaIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_loja")
        .select("loja_id, status")
        .in("loja_id", lojaIds)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: lojaIds.length > 0,
  });

  const planoMap = new Set(planos.map((p) => p.loja_id));
  // Group latest payment per store
  const pagamentoMap = new Map<string, string>();
  pagamentos.forEach((p) => {
    if (!pagamentoMap.has(p.loja_id)) {
      pagamentoMap.set(p.loja_id, p.status);
    }
  });

  const getLicenseStatus = (lojaId: string) => {
    const hasActivePlan = planoMap.has(lojaId);
    const latestPayment = pagamentoMap.get(lojaId);
    
    if (hasActivePlan) {
      return { 
        label: "Licença Ativa", 
        className: "text-green-700 border-green-200 bg-green-50" 
      };
    }
    
    if (latestPayment === "aprovado") {
      return { 
        label: "Licença em Ativação", 
        className: "text-blue-700 border-blue-200 bg-blue-50" 
      };
    }

    return { 
      label: "Licença Pendente", 
      className: "text-red-600 border-red-200 bg-red-50" 
    };
  };

  const filtered = lojas.filter((l) =>
    l.nome.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">
          Meus Indicados 👥
        </h1>
        <p className="text-muted-foreground mt-1">
          {lojas.length} {lojas.length === 1 ? "loja vinculada" : "lojas vinculadas"}
        </p>
      </motion.div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar indicado..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Todos os Indicados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.map((loja, i) => {
            const license = getLicenseStatus(loja.id);
            return (
              <motion.div
                key={loja.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
              >
                <div 
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  onClick={() => navigate(`/afiliado/indicados/${loja.id}`)}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{loja.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Desde {format(new Date(loja.created_at), "MMM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize hidden md:inline-flex">
                    {loja.segmento}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${license.className}`}
                  >
                    {license.label}
                  </Badge>
                  <div onClick={(e) => e.stopPropagation()}>
                    <AffiliatePaymentDialog 
                      lojaId={loja.id} 
                      lojaNome={loja.nome}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <CreditCard className="w-4 h-4" />
                        </Button>
                      }
                    />
                  </div>
                  <ChevronRight 
                    className="w-4 h-4 text-muted-foreground cursor-pointer" 
                    onClick={() => navigate(`/afiliado/indicados/${loja.id}`)}
                  />
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {lojas.length === 0
                ? "Nenhum lojista se cadastrou pelo seu link ainda."
                : "Nenhum indicado encontrado."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateReferrals;
