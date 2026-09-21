import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DemoLojistasSidebar } from "./DemoSidebar";
import { useDemoRequired } from "@/contexts/DemoContext";
import { Bell, ChevronDown } from "lucide-react";
import DemoBanner from "@/components/demo/DemoBanner";

const getPageTitles = (base: string): Record<string, string> => ({
  [base]: "Dashboard",
  [`${base}/pedidos`]: "Pedidos",
  [`${base}/produtos`]: "Produtos",
  [`${base}/entregas`]: "Entregas",
  [`${base}/financeiro`]: "Financeiro",
  [`${base}/configuracoes`]: "Configurações",
});

const DemoLojistaLayout = () => {
  const { profile, orders } = useDemoRequired();
  const navigate = useNavigate();
  const location = useLocation();
  const base = "/demo/lojista";
  const pageTitles = getPageTitles(base);
  const pageTitle = pageTitles[location.pathname] || "Painel Demo";
  const pedidosPendentes = orders.filter((o) => o.status === "pendente").length;

  const initials = profile.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "D";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-muted/30">
        <DemoBanner />
        <div className="flex flex-1">
          <DemoLojistasSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center border-b border-border bg-card px-4 gap-3 shadow-sm">
              <SidebarTrigger className="lg:hidden" />
              <h2 className="text-lg font-bold font-display text-foreground">{pageTitle}</h2>
              <div className="flex-1" />
              <button
                onClick={() => navigate(`${base}/pedidos`)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {pedidosPendentes > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {pedidosPendentes}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <span className="text-xs font-bold text-primary">{initials}</span>
                </div>
                <span className="text-sm font-semibold text-foreground hidden sm:block">
                  {profile.full_name.split(" ")[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
              </div>
            </header>
            <div className="h-[2px] bg-secondary shrink-0" />
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DemoLojistaLayout;
