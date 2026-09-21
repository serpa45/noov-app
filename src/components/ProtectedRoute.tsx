import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import { usePdvUser, PermissionKey } from "@/contexts/PdvUserContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  requiredPermission?: PermissionKey;
}

const ProtectedRoute = ({ children, requiredRole, requiredPermission }: ProtectedRouteProps) => {
  const { user, isLoading, rolesLoaded, hasRole } = useAuth();
  const { hasPermission } = usePdvUser();

  // Wait for both auth and roles to load
  if (isLoading || (user && !rolesLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : requiredRole ? [requiredRole] : [];
    if (requiredRoles.length === 1 && requiredRoles[0] === "afiliado") {
      return <Navigate to="/afiliado/login" replace />;
    }
    if (requiredRoles.includes("admin")) {
      return <Navigate to="/admin/login" replace />;
    }
    if (requiredRoles.includes("lojista")) {
      return <Navigate to="/lojista/login" replace />;
    }
    if (requiredRoles.includes("entregador")) {
      return <Navigate to="/entregador/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!requiredRoles.some((r) => hasRole(r as any))) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Acesso negado</h1>
            <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
            <a href="/" className="text-primary hover:underline">Voltar ao início</a>
          </div>
        </div>
      );
    }
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Acesso negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área (falta permissão: {requiredPermission}).</p>
          <a href="/lojista" className="text-primary hover:underline">Voltar ao início</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
