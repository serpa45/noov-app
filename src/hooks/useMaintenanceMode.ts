import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface MaintenanceSettings {
  ativo: boolean;
  previsaoRetorno?: string;
  mensagemLojista?: string;
  mensagemCliente?: string;
  whatsappSuporte?: string;
}

const STORAGE_OVERRIDE_KEY = "noov_maintenance_bypass";

export const useMaintenanceMode = () => {
  const { user } = useAuth();
  const [hasBypass, setHasBypass] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_OVERRIDE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const { data: configData, isLoading, refetch } = useQuery({
    queryKey: ["config-global", "modo_manutencao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "modo_manutencao")
        .maybeSingle();

      if (error) {
        console.warn("Erro ao buscar modo de manutenção:", error);
        return { valor: "true" };
      }
      return data || { valor: "false" };
    },
    staleTime: 30_000,
  });

  const { data: infoData } = useQuery({
    queryKey: ["config-global", "manutencao_info"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "manutencao_info")
        .maybeSingle();
      if (!data?.valor) return null;
      try {
        return JSON.parse(data.valor);
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const isMaintenanceActive = configData?.valor === "true";

  // Se o usuário estiver logado com role admin, sempre tem bypass
  const isAdmin = user?.user_metadata?.role === "admin" || (user as any)?.role === "admin";

  const isBlocked = isMaintenanceActive && !hasBypass && !isAdmin;

  const enableBypass = (masterCode?: string): boolean => {
    // Código master padrão ou do sistema
    if (!masterCode || masterCode.trim() === "SERPA123*" || masterCode.trim() === "NOOV2026*") {
      try {
        localStorage.setItem(STORAGE_OVERRIDE_KEY, "true");
        setHasBypass(true);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const removeBypass = () => {
    try {
      localStorage.removeItem(STORAGE_OVERRIDE_KEY);
      setHasBypass(false);
    } catch {}
  };

  return {
    isMaintenanceActive,
    isBlocked,
    hasBypass,
    isAdmin,
    isLoading,
    refetch,
    enableBypass,
    removeBypass,
    info: infoData as MaintenanceSettings | null,
  };
};
