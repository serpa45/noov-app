// Plan limits with trial support
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanLimits {
  max_produtos: number;
  max_clientes: number;
  dashboard: boolean;
  pedidos: boolean;
  produtos: boolean;
  entregas: boolean;
  financeiro: boolean;
  pdv: boolean;
  pdv_balcao: boolean;
  pdv_mesas: boolean;
  enviar_whatsapp: boolean;
  enviar_painel: boolean;
  relatorios: boolean;
  impressao_automatica: boolean;
}

const defaultLimits: PlanLimits = {
  max_produtos: 30,
  max_clientes: 100,
  dashboard: true,
  pedidos: true,
  produtos: true,
  entregas: true,
  financeiro: false,
  pdv: false,
  pdv_balcao: false,
  pdv_mesas: false,
  enviar_whatsapp: true,
  enviar_painel: false,
  relatorios: false,
  impressao_automatica: true,
};

// During trial: all features unlocked EXCEPT enviar_whatsapp
const trialLimits: PlanLimits = {
  max_produtos: -1,
  max_clientes: -1,
  dashboard: true,
  pedidos: true,
  produtos: true,
  entregas: true,
  financeiro: true,
  pdv: true,
  pdv_balcao: true,
  pdv_mesas: true,
  enviar_whatsapp: false,
  enviar_painel: true,
  relatorios: true,
  impressao_automatica: true,
};

export const useStorePlanLimits = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: loja } = useQuery({
    queryKey: ["plan-limits-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, created_at, dias_teste_extra")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: lojaPlano, isLoading } = useQuery({
    queryKey: ["plan-limits-plano", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(limites)")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!loja?.id,
  });

  // Realtime: quando o admin altera o plano/limites desta loja, refetch instantâneo
  useEffect(() => {
    if (!loja?.id) return;
    const channel = supabase
      .channel(`loja-planos-${loja.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loja_planos", filter: `loja_id=eq.${loja.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["plan-limits-plano", loja.id] });
          queryClient.invalidateQueries({ queryKey: ["bt-printer-plan-loja", user?.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loja?.id, user?.id, queryClient]);

  const { data: trialConfig } = useQuery({
    queryKey: ["config-global", "dias_teste_gratis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "dias_teste_gratis")
        .maybeSingle();
      return data;
    },
  });

  const hasActivePlan = !!lojaPlano;

  // Check if store is in trial period
  const isInTrial = (() => {
    if (hasActivePlan || !loja) return false;
    const trialDays = trialConfig?.valor ? parseInt(trialConfig.valor) : 0;
    const extraDays = (loja as any)?.dias_teste_extra ?? 0;
    const totalTrialDays = trialDays + extraDays;
    if (totalTrialDays <= 0) return false;
    const createdAt = new Date(loja.created_at);
    const trialEnd = new Date(createdAt.getTime() + totalTrialDays * 24 * 60 * 60 * 1000);
    return new Date() <= trialEnd;
  })();

  const overrideLimites = (lojaPlano as any)?.limites_assinado;
  const planoLimitesBase = (lojaPlano as any)?.planos?.limites || null;
  // Base = plano contratado; overrides da loja sobrescrevem apenas chaves alteradas
  const planLimites = (planoLimitesBase || overrideLimites)
    ? { ...(planoLimitesBase || {}), ...(overrideLimites || {}) }
    : null;

  let limits: PlanLimits;
  if (isInTrial) {
    limits = trialLimits;
  } else if (planLimites) {
    limits = { ...defaultLimits, ...planLimites };
  } else {
    limits = defaultLimits;
  }
  // Backward compat: legacy "pdv" flag enables both new PDV keys when not explicitly set
  if (planLimites && (planLimites as any).pdv === true) {
    if ((planLimites as any).pdv_balcao === undefined) limits.pdv_balcao = true;
    if ((planLimites as any).pdv_mesas === undefined) limits.pdv_mesas = true;
  }

  return { limits, isLoading, hasActivePlan, isInTrial };
};

// For public store pages (client menu) — fetch limits by store ID
export const usePublicStorePlanLimits = (storeId: string | undefined) => {
  const { data: storeData } = useQuery({
    queryKey: ["public-store-data", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("created_at, dias_teste_extra")
        .eq("id", storeId!)
        .single();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: lojaPlano, isLoading } = useQuery({
    queryKey: ["public-plan-limits", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(limites)")
        .eq("loja_id", storeId!)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: trialConfig } = useQuery({
    queryKey: ["config-global", "dias_teste_gratis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "dias_teste_gratis")
        .maybeSingle();
      return data;
    },
  });

  const hasActivePlan = !!lojaPlano;

  const isInTrial = (() => {
    if (hasActivePlan || !storeData) return false;
    const trialDays = trialConfig?.valor ? parseInt(trialConfig.valor) : 0;
    const extraDays = (storeData as any)?.dias_teste_extra ?? 0;
    const totalTrialDays = trialDays + extraDays;
    if (totalTrialDays <= 0) return false;
    const createdAt = new Date(storeData.created_at);
    const trialEnd = new Date(createdAt.getTime() + totalTrialDays * 24 * 60 * 60 * 1000);
    return new Date() <= trialEnd;
  })();

  const overrideLimites = (lojaPlano as any)?.limites_assinado;
  const planoLimitesBase = (lojaPlano as any)?.planos?.limites || null;
  const planLimites = (planoLimitesBase || overrideLimites)
    ? { ...(planoLimitesBase || {}), ...(overrideLimites || {}) }
    : null;

  let limits: PlanLimits;
  if (isInTrial) {
    limits = trialLimits;
  } else if (planLimites) {
    limits = { ...defaultLimits, ...planLimites };
  } else {
    limits = defaultLimits;
  }
  if (planLimites && (planLimites as any).pdv === true) {
    if ((planLimites as any).pdv_balcao === undefined) limits.pdv_balcao = true;
    if ((planLimites as any).pdv_mesas === undefined) limits.pdv_mesas = true;
  }

  return { limits, isLoading, hasActivePlan, isInTrial };
};
