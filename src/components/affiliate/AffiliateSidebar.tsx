import {
  LayoutDashboard,
  Users,
  Wallet,
  Settings,
  LogOut,
  Link2,
  ChevronLeft,
  UserCheck,
  Megaphone,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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

const affiliateItems = [
  { title: "Dashboard", url: "/afiliado/painel", icon: LayoutDashboard },
  { title: "Indicados", url: "/afiliado/indicados", icon: Users },
  { title: "Financeiro/Saque", url: "/afiliado/financeiro", icon: Wallet },
  { title: "Meu Link", url: "/afiliado/link", icon: Link2 },
  { title: "Marketing", url: "/afiliado/marketing", icon: Megaphone },
];

export function AffiliateSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-accent" />
            <span className="text-xl font-extrabold font-display text-white tracking-tight">
              N<span className="text-secondary">O</span>OV
            </span>
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">Afiliado</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {affiliateItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/afiliado/painel"}
                      className="hover:bg-white/10 rounded-lg text-white/80 transition-colors"
                      activeClassName="bg-white/20 text-white font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/afiliado/configuracoes"
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
