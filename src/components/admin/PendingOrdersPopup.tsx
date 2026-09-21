import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Início do dia atual no fuso de São Paulo (UTC-3), em ISO UTC
function startOfTodaySaoPauloISO(): string {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  sp.setHours(0, 0, 0, 0);
  // converte de volta para UTC (SP = UTC-3)
  const utc = new Date(sp.getTime() + sp.getTimezoneOffset() * 60000);
  // subtrai o offset de SP (-3h) -> soma 3h para UTC
  utc.setHours(utc.getHours() + 3);
  return utc.toISOString();
}

function todayKeySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const PendingOrdersPopup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const startToday = startOfTodaySaoPauloISO();

  const { data: pendentes = [] } = useQuery({
    queryKey: ["pedidos-pendentes-anteriores", user?.id, startToday],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_diario, status, total, created_at, cliente_nome")
        .eq("lojista_id", user!.id)
        .lt("created_at", startToday)
        .not("status", "in", "(finalizado,entregue,cancelado)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    if (pendentes.length === 0) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [pendentes, user?.id]);

  const handleGoTo = () => {
    setOpen(false);
    navigate("/lojista/pedidos/historico");
  };

  if (pendentes.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 [&>button]:text-white [&>button]:opacity-100">
        <DialogHeader className="bg-red-600 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-5 h-5" />
            Pedidos não finalizados
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-4">
          <DialogDescription className="text-sm">
            Identificamos {pendentes.length} pedido{pendentes.length > 1 ? "s" : ""} de dias anteriores que ainda não foi
            {pendentes.length > 1 ? "ram" : ""} finalizado{pendentes.length > 1 ? "s" : ""}. Clique no botão{" "}
            <strong>Ir para Histórico</strong> e localize o pedido e altere o status.
          </DialogDescription>

        <div className="max-h-64 overflow-auto rounded-lg border border-border divide-y divide-border">
          {pendentes.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <div className="min-w-0">
                <div className="font-semibold">
                  Pedido Nº {p.numero_diario ?? p.id.slice(0, 6)}
                  {typeof p.total === "number" && (
                    <span className="ml-2 text-primary">
                      {p.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.cliente_nome ? `${p.cliente_nome} · ` : ""}
                  {new Date(p.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} ·{" "}
                  {new Date(p.created_at).toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                {p.status}
              </Badge>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button onClick={handleGoTo}>Ir para Histórico</Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingOrdersPopup;
