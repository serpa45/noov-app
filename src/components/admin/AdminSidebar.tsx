import {
  LayoutDashboard,
  Store,
  Users,
  UserCheck,
  DollarSign,
  Settings,
  LogOut,
  ChevronLeft,
  Shield,
  CreditCard,
  QrCode,
  ImageIcon,
  MessageSquare,
  Star,
  Ticket as TicketIcon,
  Activity,
  Terminal,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
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

const navigationGroups = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Métricas", url: "/admin/metricas", icon: Activity },
      { title: "Logs de Erros", url: "/admin/logs-erros", icon: Terminal },
    ]
  },
  {
    label: "Negócio",
    items: [
      { title: "Lojas", url: "/admin/lojas", icon: Store },
      { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
      { title: "PIX Split", url: "/admin/pix-split", icon: QrCode },
      { title: "Eventos", url: "/admin/avaliacoes", icon: Star },
    ]
  },
  {
    label: "Afiliados",
    items: [
      { title: "Rede de Afiliados", url: "/admin/afiliados", icon: UserCheck },
      { title: "Saques", url: "/admin/saques", icon: CreditCard },
      { title: "Materiais", url: "/admin/materiais", icon: ImageIcon },
    ]
  },
  {
    label: "Atendimento",
    items: [
      { title: "Mensagens", url: "/admin/mensagens", icon: MessageSquare },
      { title: "Tickets", url: "/admin/tickets", icon: TicketIcon },
    ]
  },
  {
    label: "Administração",
    items: [
      { title: "Usuários", url: "/admin/usuarios", icon: Users },
    ]
  }
];

export function AdminSidebar() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const queryClient = useQueryClient();
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["admin-saques-pendentes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("saques")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: pendingTicketsCount = 0 } = useQuery({
    queryKey: ["admin-tickets-pendentes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .is("admin_read_at", null);
      return count ?? 0;
    },

    refetchInterval: 30000,
  });

  const { data: errorCount = 0 } = useQuery({
    queryKey: ["admin-error-logs-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("error_logs" as any)
        .select("*", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const channelSaques = supabase
      .channel("admin-sidebar-saques-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "saques" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-saques-pendentes-count"] });
      })
      .subscribe();

    const channelTickets = supabase
      .channel("admin-sidebar-tickets-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-tickets-pendentes-count"] });
      })
      .subscribe();

    const channelErrors = supabase
      .channel("admin-sidebar-errors-count")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "error_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-error-logs-count"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelSaques);
      supabase.removeChannel(channelTickets);
      supabase.removeChannel(channelErrors);
    };
  }, [queryClient]);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-secondary" />
            <span className="text-xl font-extrabold font-display text-white tracking-tight">
              N<span className="text-secondary">O</span>OV
            </span>
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">Admin</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <SidebarContent className="gap-0">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] px-4 mb-2">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        className="hover:bg-white/10 rounded-lg text-white/80 transition-all duration-200 relative group"
                        activeClassName="bg-white/15 text-white font-semibold ring-1 ring-white/10"
                      >
                        <div className="relative flex items-center w-full">
                          <item.icon className="mr-2 h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                          
                          {collapsed && item.title === "Saques" && pendingCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full z-10 border-2 border-sidebar">
                              {pendingCount}
                            </span>
                          )}
                          {collapsed && item.title === "Tickets" && pendingTicketsCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full z-10 border-2 border-sidebar">
                              {pendingTicketsCount}
                            </span>
                          )}
                          {collapsed && item.title === "Logs de Erros" && errorCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full z-10 border-2 border-sidebar animate-pulse">
                              {errorCount}
                            </span>
                          )}

                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{item.title}</span>
                              {item.title === "Saques" && pendingCount > 0 && (
                                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm">
                                  {pendingCount}
                                </span>
                              )}
                              {item.title === "Tickets" && pendingTicketsCount > 0 && (
                                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm">
                                  {pendingTicketsCount}
                                </span>
                              )}
                              {item.title === "Logs de Erros" && errorCount > 0 && (
                                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm animate-pulse">
                                  {errorCount}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/admin/configuracoes"
                className="hover:bg-white/10 rounded-lg text-white/80 transition-colors"
                activeClassName="bg-white/20 text-white font-semibold"
              >
                <Settings className="mr-2 h-4 w-4" />
                {!collapsed && <span>Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => { await signOut(); navigate("/"); }}
              className="hover:bg-white/10 rounded-lg text-white/60 cursor-pointer transition-colors"
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