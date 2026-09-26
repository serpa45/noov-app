import { useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import Maintenance from "@/pages/Maintenance";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

interface MaintenanceGateProps {
  children?: React.ReactNode;
}

export const MaintenanceGate = ({ children }: MaintenanceGateProps) => {
  const location = useLocation();
  const { isBlocked, isMaintenanceActive, hasBypass, isAdmin, removeBypass } = useMaintenanceMode();

  // Rotas que NUNCA são bloqueadas pela manutenção (área admin e a própria página de manutenção)
  const isExcludedPath =
    location.pathname.startsWith("/admin") ||
    location.pathname === "/manutencao";

  // Se a manutenção estiver ativa e o visitante não for admin nem tiver bypass
  if (isBlocked && !isExcludedPath) {
    return <Maintenance />;
  }

  return (
    <>
      {/* Banner discreto para Administrador / Modo Bypass lembrando que o site está em manutenção para os outros */}
      {isMaintenanceActive && (hasBypass || isAdmin) && !location.pathname.startsWith("/admin") && (
        <div className="fixed bottom-3 right-3 z-[9999] flex items-center gap-2 bg-amber-500 text-black px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold animate-pulse">
          <Wrench className="w-3.5 h-3.5" />
          <span>Modo Manutenção Ativo (Bypass)</span>
          <button
            onClick={removeBypass}
            className="ml-1 text-[10px] underline hover:opacity-80 cursor-pointer"
            title="Voltar a ver a tela de manutenção"
          >
            Ver tela
          </button>
        </div>
      )}
      {children}
    </>
  );
};

export default MaintenanceGate;
