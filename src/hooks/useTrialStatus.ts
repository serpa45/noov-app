import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getServerNow } from "@/lib/serverTime";

interface TrialStatus {
  isExpired: boolean;
  hasActivePlan: boolean;
  daysRemaining: number;
  trialDays: number;
  isLoading: boolean;
  licenseDaysRemaining: number | null;
  licenseExpiring: boolean;
  planoId: string | null;
  valorExclusivo: number | null;
  planoExclusivoId: string | null;
}

export const useTrialStatus = (): TrialStatus => {
  const { user } = useAuth();

  const { data: loja, isLoading: loadingLoja } = useQuery({
    queryKey: ["trial-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, created_at, dias_teste_extra, valor_plano_exclusivo, plano_id_exclusivo")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: lojaPlano, isLoading: loadingPlano } = useQuery({
    queryKey: ["trial-plano", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("id, ativo, expira_em, plano_id")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!loja?.id,
  });

  const { data: trialConfig, isLoading: loadingConfig } = useQuery({
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

  const isLoading = loadingLoja || loadingPlano || loadingConfig;
  const hasActivePlan = !!lojaPlano;
  const trialDays = trialConfig?.valor ? parseInt(trialConfig.valor) : 0;
  const extraDays = (loja as any)?.dias_teste_extra ?? 0;
  const totalTrialDays = trialDays + extraDays;
  const valorExclusivo = (loja as any)?.valor_plano_exclusivo ?? null;
  const planoExclusivoId = (loja as any)?.plano_id_exclusivo ?? null;

  // License expiration check
  let licenseDaysRemaining: number | null = null;
  let licenseExpiring = false;
  const planoId = (lojaPlano as any)?.plano_id ?? null;

  if (hasActivePlan && (lojaPlano as any)?.expira_em) {
    const expiraEm = new Date((lojaPlano as any).expira_em);
    const now = getServerNow();
    licenseDaysRemaining = Math.max(0, Math.ceil((expiraEm.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    licenseExpiring = licenseDaysRemaining <= 3;

    // If license expired, mark as not active
    if (licenseDaysRemaining <= 0) {
      return { 
        isExpired: true, 
        hasActivePlan: false, 
        daysRemaining: 0, 
        trialDays, 
        isLoading: false, 
        licenseDaysRemaining: 0, 
        licenseExpiring: true, 
        planoId,
        valorExclusivo,
        planoExclusivoId
      };
    }
  }

  if (isLoading || !loja) {
    return { 
      isExpired: false, 
      hasActivePlan: false, 
      daysRemaining: 0, 
      trialDays: 0, 
      isLoading, 
      licenseDaysRemaining: null, 
      licenseExpiring: false, 
      planoId: null,
      valorExclusivo: null,
      planoExclusivoId: null
    };
  }

  if (hasActivePlan) {
    return { 
      isExpired: false, 
      hasActivePlan: true, 
      daysRemaining: 0, 
      trialDays, 
      isLoading: false, 
      licenseDaysRemaining, 
      licenseExpiring, 
      planoId,
      valorExclusivo,
      planoExclusivoId
    };
  }

  if (trialDays <= 0 && extraDays <= 0) {
    return { 
      isExpired: true, 
      hasActivePlan: false, 
      daysRemaining: 0, 
      trialDays: totalTrialDays, 
      isLoading: false, 
      licenseDaysRemaining: null, 
      licenseExpiring: false, 
      planoId: null,
      valorExclusivo,
      planoExclusivoId
    };
  }

  const createdAt = new Date(loja.created_at);
  const trialEnd = new Date(createdAt.getTime() + totalTrialDays * 24 * 60 * 60 * 1000);
  const now = getServerNow();
  const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const isExpired = now > trialEnd;

  return { 
    isExpired, 
    hasActivePlan: false, 
    daysRemaining, 
    trialDays: totalTrialDays, 
    isLoading: false, 
    licenseDaysRemaining: null, 
    licenseExpiring: false, 
    planoId: null,
    valorExclusivo,
    planoExclusivoId
  };
};

// For public store pages: check if store has expired trial
export const useStoreTrialStatus = (storeId: string | undefined, storeCreatedAt: string | undefined) => {
  const { data: lojaPlano, isLoading: loadingPlano } = useQuery({
    queryKey: ["store-trial-plano", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("id, ativo, expira_em")
        .eq("loja_id", storeId!)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: lojaExtra, isLoading: loadingExtra } = useQuery({
    queryKey: ["store-trial-extra", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("dias_teste_extra")
        .eq("id", storeId!)
        .single();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: trialConfig, isLoading: loadingConfig } = useQuery({
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

  const isLoading = loadingPlano || loadingConfig || loadingExtra;
  const hasActivePlan = !!lojaPlano;
  const trialDays = trialConfig?.valor ? parseInt(trialConfig.valor) : 0;
  const extraDays = (lojaExtra as any)?.dias_teste_extra ?? 0;
  const totalTrialDays = trialDays + extraDays;

  if (isLoading || !storeId || !storeCreatedAt) {
    return { isExpired: false, isLoading };
  }

  if (hasActivePlan) {
    const expiraEm = (lojaPlano as any)?.expira_em;
    if (expiraEm && new Date(expiraEm) < getServerNow()) {
      return { isExpired: true, isLoading: false };
    }
    return { isExpired: false, isLoading: false };
  }
  if (totalTrialDays <= 0) return { isExpired: true, isLoading: false };

  const createdAt = new Date(storeCreatedAt);
  const trialEnd = new Date(createdAt.getTime() + totalTrialDays * 24 * 60 * 60 * 1000);
  return { isExpired: getServerNow() > trialEnd, isLoading: false };
};
