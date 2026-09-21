import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type PermissionKey =
  | "dashboard"
  | "financeiro"
  | "pedidos"
  | "produtos"
  | "entregas"
  | "clientes"
  | "pdv"
  | "pdv_mesas"
  | "pdv_balcao"
  | "comandas"
  | "relatorios"
  | "configuracoes"
  | "plano";

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; desc: string }> = {
  dashboard: { label: "Dashboard", desc: "Visão geral do dia" },
  financeiro: { label: "Financeiro", desc: "Acesso total ao financeiro (vendas, gráficos e histórico)" },
  pedidos: { label: "Pedidos", desc: "Visualizar e gerenciar pedidos ativos" },
  produtos: { label: "Produtos", desc: "Cadastro, edição e exclusão de produtos" },
  entregas: { label: "Entregas", desc: "Gerenciar entregas e entregadores" },
  clientes: { label: "Clientes", desc: "Lista e detalhes de clientes" },
  pdv: { label: "PDV (Menu)", desc: "Acesso ao menu Ponto de Venda" },
  pdv_mesas: { label: "PDV Mesas", desc: "Acesso ao Ponto de Venda de Mesas" },
  pdv_balcao: { label: "PDV Balcão", desc: "Acesso ao Ponto de Venda de Balcão" },
  comandas: { label: "Comandas", desc: "Acesso à página de Comandas (Garçons)" },
  relatorios: { label: "Relatórios", desc: "Caixa, vendas, clientes" },
  configuracoes: { label: "Configurações", desc: "Configurações da loja e usuários" },
  plano: { label: "Plano / Assinatura", desc: "Visualizar e renovar plano" },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

export interface UserActionPermissions {
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  tabs?: string[];
}

export interface PdvUser {
  id: string;
  loja_id: string;
  nome: string;
  nivel: "admin" | "gerente" | "funcionario";
  permissoes: PermissionKey[];
  permissoes_acoes?: Record<string, UserActionPermissions>;
}

const STORAGE_KEY = "pdv_active_user";

interface PdvUserContextType {
  pdvUser: PdvUser | null;
  setPdvUser: (u: PdvUser | null) => void;
  hasPermission: (key: PermissionKey) => boolean;
  hasActionPermission: (area: string, action: "create" | "edit" | "delete") => boolean;
  hasTabPermission: (area: string, tab: string) => boolean;
  clear: () => void;
}

const Ctx = createContext<PdvUserContextType | undefined>(undefined);

export const PdvUserProvider = ({ children }: { children: ReactNode }) => {
  const [pdvUser, setPdvUserState] = useState<PdvUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setPdvUser = useCallback((u: PdvUser | null) => {
    setPdvUserState(u);
    if (u) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const clear = useCallback(() => setPdvUser(null), [setPdvUser]);

  const hasPermission = useCallback(
    (key: PermissionKey) => {
      // No PDV user selected => no restriction (admin/lojista mode)
      if (!pdvUser) return true;
      if (pdvUser.nivel === "admin") return true;
      return pdvUser.permissoes?.includes(key) ?? false;
    },
    [pdvUser]
  );

  const hasActionPermission = useCallback(
    (area: string, action: "create" | "edit" | "delete") => {
      if (!pdvUser) return true;
      if (pdvUser.nivel === "admin") return true;
      
      const areaPerms = pdvUser.permissoes_acoes?.[area];
      if (!areaPerms) return true;
      
      return areaPerms[action] !== false;
    },
    [pdvUser]
  );

  const hasTabPermission = useCallback(
    (area: string, tab: string) => {
      if (!pdvUser) return true;
      if (pdvUser.nivel === "admin") return true;
      
      const areaPerms = pdvUser.permissoes_acoes?.[area];
      if (!areaPerms || !areaPerms.tabs) return true;
      
      return areaPerms.tabs.includes(tab);
    },
    [pdvUser]
  );

  // Clear on supabase logout (storage event)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("sb-") && !e.newValue) clear();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clear]);

  return <Ctx.Provider value={{ pdvUser, setPdvUser, hasPermission, hasActionPermission, hasTabPermission, clear }}>{children}</Ctx.Provider>;
};

export function usePdvUser() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePdvUser must be used within PdvUserProvider");
  return ctx;
}
