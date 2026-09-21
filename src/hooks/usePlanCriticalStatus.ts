import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialStatus } from "@/hooks/useTrialStatus";

/**
 * Indica se algo na página /lojista/plano está em estado crítico
 * (barra de uso vermelha >=90% ou alerta de erro equivalente).
 */
export function usePlanCriticalStatus(): { isCritical: boolean } {
  const { user } = useAuth();
  const trialStatus = useTrialStatus();

  const { data: loja } = useQuery({
    queryKey: ["plan-critical-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: planoAtivo } = useQuery({
    queryKey: ["plan-critical-plano", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("limites_assinado, planos:plano_id(limites)")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!loja?.id,
    staleTime: 60_000,
  });

  const { data: produtosCount = 0 } = useQuery({
    queryKey: ["plan-critical-produtos", loja?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("produtos")
        .select("id", { count: "exact", head: true })
        .eq("loja_id", loja!.id);
      return count || 0;
    },
    enabled: !!loja?.id,
    staleTime: 60_000,
  });

  const { data: clientesCount = 0 } = useQuery({
    queryKey: ["plan-critical-clientes", loja?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("loja_id", loja!.id);
      return count || 0;
    },
    enabled: !!loja?.id,
    staleTime: 60_000,
  });

  const { data: pedidosMesCount = 0 } = useQuery({
    queryKey: ["plan-critical-pedidos-mes", user?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("pedidos")
        .select("*", { count: "exact", head: true })
        .eq("lojista_id", user!.id)
        .gte("created_at", startOfMonth.toISOString());
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const planoInfo: any = (planoAtivo as any)?.planos;
  const limites: any =
    planoInfo?.limites || (planoAtivo as any)?.limites_assinado || {};

  const limiteProdutos =
    limites?.max_produtos === -1 ? Infinity : limites?.max_produtos ?? 999;
  const limiteClientes =
    limites?.max_clientes === -1 ? Infinity : limites?.max_clientes ?? 999;
  const limitePedidosMes =
    limites?.max_pedidos_mes === -1 ? Infinity : limites?.max_pedidos_mes ?? 999;

  const pct = (used: number, limit: number) =>
    limit === Infinity ? 0 : limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const pctProdutos = pct(produtosCount as number, limiteProdutos);
  const pctClientes = pct(clientesCount as number, limiteClientes);
  const pctPedidos = pct(pedidosMesCount as number, limitePedidosMes);

  const usageCritical =
    pctProdutos >= 90 || pctClientes >= 90 || pctPedidos >= 90;

  const trialExpiredNoPlan = trialStatus.isExpired && !trialStatus.hasActivePlan;
  const licenseCritical =
    trialStatus.hasActivePlan &&
    trialStatus.licenseDaysRemaining !== null &&
    trialStatus.licenseDaysRemaining <= 3;

  return {
    isCritical: usageCritical || trialExpiredNoPlan || licenseCritical,
  };
}
