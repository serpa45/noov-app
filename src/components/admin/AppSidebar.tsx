import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Bike as TruckIcon,
  DollarSign,
  Monitor,
  UtensilsCrossed,
  Settings,
  LogOut,
  ChevronLeft,
  CreditCard,
  Store,
  RefreshCw,
  Users,
  Lock,
  MessageSquare,
  FileText,
  Bike,
  Wallet,
  Contact as Helmet,
  Ticket,
  ChevronDown,
  ChevronUp,
  Flame,
  LayoutGrid,
  Lightbulb,
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";
import { usePdvUser, PermissionKey } from "@/contexts/PdvUserContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_VERSION, APP_MAJOR, APP_MINOR } from "@/lib/version";
import { VersionCheckDialog } from "@/components/admin/VersionCheckDialog";
import { AlertTriangle } from "lucide-react";


export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, hasRole } = useAuth();
  const { limits } = useStorePlanLimits();
  const { hasPermission } = usePdvUser();
  const queryClient = useQueryClient();
  const base = "/lojista";
  const [versionDialogOpen, setVersionDialogOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (localStorage.getItem('reopen_version_dialog') === '1') {
        localStorage.removeItem('reopen_version_dialog');
        return true;
      }
    } catch { /* silencioso */ }
    return false;
  });


  // Close mobile sidebar automatically when navigating to a new route
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    principal: true,
    pos: true,
    reports: true,
    subscription: true
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Fetch pending orders count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-orders-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pedidos")
        .select("*", { count: "exact", head: true })
        .eq("lojista_id", user!.id)
        .eq("status", "pendente");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch loja id for delivery count
  const { data: lojaData } = useQuery({
    queryKey: ["sidebar-loja-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, segmento, created_at").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch pending deliveries count
  const { data: pendingDeliveries = 0 } = useQuery({
    queryKey: ["pending-deliveries-count", lojaData?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("entregas")
        .select("*", { count: "exact", head: true })
        .eq("lojista_id", lojaData!.id)
        .eq("status", "pendente");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!lojaData?.id,
    refetchInterval: 30000,
  });

  // Fetch pending support tickets count (admin replied and lojista has not read yet)
  const { data: pendingSupportCount = 0 } = useQuery({
    queryKey: ["pending-support-count", lojaData?.id],
    queryFn: async () => {
      if (!lojaData?.id) return 0;
      const { count, error } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("store_id", lojaData.id)
        .eq("status", "pending")
        .is("store_read_at", null);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!lojaData?.id,
    refetchInterval: 30000,
  });

  // Verifica se há versão nova publicada (para exibir alerta ao lado do nº da versão)
  const { data: remoteVersion } = useQuery({
    queryKey: ["app-version-check"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_version")
        .select("major, minor")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });
  const isVersionOutdated =
    !!remoteVersion &&
    (remoteVersion.major > APP_MAJOR ||
      (remoteVersion.major === APP_MAJOR && remoteVersion.minor > APP_MINOR));

  // Fetch PDV new orders count (mesas com novos pedidos - itens novos ou cozinha pendente)
  const { data: pdvNewItemsCount = 0 } = useQuery({
    queryKey: ["pdv-new-items-count", lojaData?.id],
    queryFn: async () => {
      if (!lojaData?.id) return 0;
      const { data, error } = await supabase
        .from("pdv_pedidos")
        .select("items,status_cozinha")
        .eq("loja_id", lojaData.id)
        .eq("status", "aberto");
      
      if (error) return 0;
      
      return data.filter(order => {
        const items = (order.items as any[]) || [];
        const hasNewItems = items.length > 0 && items.some(i => i.is_new === true);
        const isPending = order.status_cozinha === "pendente";
        return hasNewItems || isPending;
      }).length;
    },
    enabled: !!lojaData?.id,
    refetchInterval: 10000,
  });

  // Realtime subscription to refresh counts
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("sidebar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `lojista_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pdv_pedidos", filter: lojaData?.id ? `loja_id=eq.${lojaData.id}` : undefined }, () => {
        queryClient.invalidateQueries({ queryKey: ["pdv-new-items-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "entregas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pending-deliveries-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pending-support-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lojas", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["sidebar-loja-id"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, lojaData?.id]);

  const isNewItem = (createdAt?: string) => {
    if (!createdAt) return false;
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff < threeDaysInMs;
  };

  const showAiNew = true; // Forçado como true conforme solicitado para mostrar a tag Novo

  const mainItems = [
    { title: "Dashboard", url: base, icon: LayoutDashboard, limitKey: "dashboard" as const, permKey: "dashboard" as PermissionKey, badge: 0 },
    { title: "Financeiro", url: `${base}/financeiro`, icon: DollarSign, limitKey: "financeiro" as const, permKey: "financeiro" as PermissionKey, badge: 0 },
    { title: "Produtos", url: `${base}/produtos`, icon: Package, limitKey: "produtos" as const, permKey: "produtos" as PermissionKey, badge: 0 },
    { title: "Pedidos", url: `${base}/pedidos`, icon: ShoppingCart, limitKey: "pedidos" as const, permKey: "pedidos" as PermissionKey, badge: pendingCount },
    { title: "Entregas", url: `${base}/entregas`, icon: TruckIcon, limitKey: "entregas" as const, permKey: "entregas" as PermissionKey, badge: pendingDeliveries },
    { title: "Clientes", url: `${base}/clientes`, icon: Users, limitKey: "dashboard" as const, permKey: "clientes" as PermissionKey, badge: 0 },
    { title: "Entregadores", url: `${base}/relatorio-entregadores`, icon: Helmet, limitKey: "entregas" as const, permKey: "entregas" as PermissionKey, badge: 0 },

  ];

  const reportItems = [
    { title: "Caixa", url: `${base}/caixa`, icon: Wallet, limitKey: "financeiro" as const, permKey: "relatorios" as PermissionKey, badge: 0 },
    { title: "Vendas", url: `${base}/vendas`, icon: ShoppingCart, limitKey: "dashboard" as const, permKey: "relatorios" as PermissionKey, badge: 0 },
    { title: "+ Vendidos", url: `${base}/mais-vendidos`, icon: Flame, limitKey: "dashboard" as const, permKey: "relatorios" as PermissionKey, badge: 0 },
    { title: "Clientes", url: `${base}/relatorio-clientes`, icon: Users, limitKey: "dashboard" as const, permKey: "relatorios" as PermissionKey, badge: 0 },
    { title: "Entregas", url: `${base}/relatorio-entregas`, icon: TruckIcon, limitKey: "entregas" as const, permKey: "relatorios" as PermissionKey, badge: 0 },
    { title: "Consultor IA", url: `${base}/consultor`, icon: Lightbulb, limitKey: "dashboard" as const, permKey: "dashboard" as PermissionKey, badge: 0, isNew: false, isAi: false },
  ];

  const posItems = [
    { title: "PDV Balcão", url: `${base}/pdv-balcao`, icon: Monitor, limitKey: "pdv_balcao" as const, permKey: "pdv_balcao" as PermissionKey, badge: 0 },
    { title: "PDV Mesas", url: `${base}/pdv-mesas`, icon: UtensilsCrossed, limitKey: "pdv_mesas" as const, permKey: "pdv_mesas" as PermissionKey, badge: pdvNewItemsCount },
    { title: "Comandas (Garçons)", url: `${base}/comandas`, icon: Users, limitKey: "pdv_mesas" as const, permKey: "comandas" as PermissionKey, badge: 0 },
  ];

  type MenuItem = { title: string; url: string; icon: any; limitKey: keyof typeof limits; permKey: PermissionKey; badge: number; isNew?: boolean; isAi?: boolean };

  const renderMenuItem = (item: MenuItem) => {
    if (!hasPermission(item.permKey)) return null;
    
    // Check for Start plan restrictions
    const isStartPlan = limits.dashboard === false;
    const isRestrictedForStart = isStartPlan && (
      item.title === "Dashboard" || 
      item.title === "Caixa" || 
      item.title === "Vendas" || 
      item.title === "+ Vendidos" || 
      item.title === "Clientes"
    );

    const enabled = limits[item.limitKey] !== false && !isRestrictedForStart;
    const hasNewItem = (item.title === "PDV" || item.title === "PDV Mesas") && pdvNewItemsCount > 0;
    
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild={enabled} className={!enabled ? "opacity-40 cursor-not-allowed" : ""}>
          {enabled ? (
            <NavLink
              to={item.url}
              end={item.url === base}
              className="hover:bg-white/10 rounded-lg text-white/80 transition-colors relative"
              activeClassName="bg-white/20 text-white font-semibold"
            >
              <div className="relative">
                <item.icon className="mr-2 h-4 w-4" />
                {collapsed && (item.badge > 0 || item.isNew) && (
                  <span className={`absolute -top-1 left-2 ${item.isNew ? 'bg-blue-500' : 'bg-destructive'} text-destructive-foreground text-[7px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full z-10 p-0 leading-none`}>
                    <span className="flex items-center justify-center h-full w-full">{item.isNew ? "" : item.badge}</span>
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1 relative">
                    {item.title}
                    {item.isAi && (
                      <span className="ml-2 bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 leading-[1] rounded-full border border-red-500 shadow-sm whitespace-nowrap min-w-[32px] uppercase inline-flex items-center justify-center align-middle mb-1">
                        Novo
                      </span>
                    )}
                  </span>
                  {item.isNew && !item.isAi && (
                    <span className="ml-2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Novo
                    </span>
                  )}
                  {item.badge > 0 && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ) : (
            <div className="flex items-center rounded-lg text-white/40 px-2 py-1.5">
              <item.icon className="mr-2 h-4 w-4" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  <Lock className="w-3 h-3 ml-1" />
                </>
              )}
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Store className="w-5 h-5 text-secondary shrink-0" />
            <span className="text-xl font-extrabold font-display text-white tracking-tight">
              N<span className="text-secondary">O</span>OV
            </span>
            <button
              type="button"
              onClick={() => setVersionDialogOpen(true)}
              title={isVersionOutdated ? "Nova versão disponível" : "Verificar versão"}
              className="flex items-center gap-1 text-[9px] font-semibold text-white/40 hover:text-white tracking-wide ml-auto self-end mb-1 cursor-pointer transition-colors"
            >
              {isVersionOutdated && (
                <AlertTriangle className="w-3 h-3 text-orange-500 animate-pulse" />
              )}
              v{APP_VERSION}
            </button>
            <VersionCheckDialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen} />

          </div>
        )}


        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel 
            className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-white/80 transition-colors"
            onClick={() => !collapsed && toggleGroup('principal')}
          >
            <span>Principal</span>
            {!collapsed && (
              openGroups.principal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            )}
          </SidebarGroupLabel>
          {(collapsed || openGroups.principal) && (
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel 
            className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-white/80 transition-colors"
            onClick={() => !collapsed && toggleGroup('pos')}
          >
            <span>Ponto de Venda</span>
            {!collapsed && (
              openGroups.pos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            )}
          </SidebarGroupLabel>
          {(collapsed || openGroups.pos) && (
            <SidebarGroupContent>
              <SidebarMenu>
                {posItems.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel 
            className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-white/80 transition-colors"
            onClick={() => !collapsed && toggleGroup('reports')}
          >
            <span>Relatórios</span>
            {!collapsed && (
              openGroups.reports ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            )}
          </SidebarGroupLabel>
          {(collapsed || openGroups.reports) && (
            <SidebarGroupContent>
              <SidebarMenu>
                {reportItems.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel 
            className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-white/80 transition-colors"
            onClick={() => !collapsed && toggleGroup('subscription')}
          >
            <span>Assinatura</span>
            {!collapsed && (
              openGroups.subscription ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            )}
          </SidebarGroupLabel>
          {(collapsed || openGroups.subscription) && (
            <SidebarGroupContent>
              <SidebarMenu>
                {hasPermission("plano") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`${base}/plano`}
                      className="hover:bg-white/10 rounded-lg text-white/80 transition-colors"
                      activeClassName="bg-white/20 text-white font-semibold"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Meu Plano</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}
                {hasPermission("plano") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`${base}/assinatura`}
                      className="hover:bg-white/10 rounded-lg text-white/80 transition-colors"
                      activeClassName="bg-white/20 text-white font-semibold"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Assinatura</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-secondary/40 p-3 bg-secondary">
        <SidebarMenu>
          {hasPermission("configuracoes") && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to={`${base}/configuracoes`}
                className="hover:bg-white/15 rounded-lg text-white transition-colors"
                activeClassName="bg-white/25 text-white font-semibold"
              >
                <Settings className="mr-2 h-4 w-4" />
                {!collapsed && <span>Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to={`${base}/suporte`}
                className="hover:bg-white/15 rounded-lg text-white transition-colors relative"
                activeClassName="bg-white/25 text-white font-semibold"
              >
                <div className="relative">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {collapsed && pendingSupportCount > 0 && (
                    <span className="absolute -top-1 left-2 bg-destructive text-destructive-foreground text-[7px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full z-10 p-0 leading-none">
                      <span className="flex items-center justify-center h-full w-full">{pendingSupportCount}</span>
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1">Suporte</span>
                    {pendingSupportCount > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                        {pendingSupportCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => { sessionStorage.removeItem("pdv_active_user"); await signOut(); navigate("/lojista/login"); }}
              className="hover:bg-white/15 rounded-lg text-white/90 cursor-pointer transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
    </Sidebar>
  );
}
