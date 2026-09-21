import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown } from "lucide-react";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/lojas": "Lojas",
  "/admin/usuarios": "Usuários",
  "/admin/pedidos": "Pedidos",
  "/admin/entregas": "Entregas",
  "/admin/financeiro": "Financeiro",
  "/admin/configuracoes": "Configurações",
  "/admin/afiliados": "Afiliados",
  "/admin/perfil": "Meu Perfil",
  "/admin/tickets": "Tickets de Suporte",
  "/admin/metricas": "Métricas do Sistema",
};

const AdminPanelLayout = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || "Painel Admin";

  // Realtime: auto-refresh all admin data
  useRealtimeSubscription("pedidos", [["pedidos"], ["admin-pedidos"], ["admin-pedidos-financeiro"]]);
  useRealtimeSubscription("lojas", [["admin-lojas"], ["admin-lojas-chart"]]);
  useRealtimeSubscription("produtos", [["admin-produtos"]]);
  useRealtimeSubscription("entregas", [["admin-entregas"]]);
  useRealtimeSubscription("profiles", [["admin-profiles"], ["admin-usuarios"]]);
  useRealtimeSubscription("planos", [["landing-planos"], ["admin-planos"]]);
  useRealtimeSubscription("comissoes", [["admin-comissoes"]]);
  useRealtimeSubscription("saques", [["admin-saques"]]);
  useRealtimeSubscription("configuracoes_globais", [["config-global"]]);
  useRealtimeSubscription("loja_planos", [["admin-loja-planos"]]);

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "A";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card px-4 gap-3 shadow-sm">
            <SidebarTrigger className="lg:hidden" />
            <h2 className="text-lg font-bold font-display text-foreground">{pageTitle}</h2>
            <div className="flex-1" />
            <button
              onClick={() => navigate("/admin/perfil")}
              className="flex items-center gap-2 hover:bg-muted px-2 py-1.5 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <span className="text-xs font-bold text-primary">{initials}</span>
              </div>
              {profile?.full_name && (
                <span className="text-sm font-semibold text-foreground hidden sm:block">
                  {profile.full_name.split(" ")[0]}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </header>
          <div className="h-[2px] bg-secondary shrink-0" />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanelLayout;
