import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvUser } from "@/contexts/PdvUserContext";
import { Loader2 } from "lucide-react";

/**
 * Blocks lojista routes until the user picks a loja_usuario (if any exist).
 * If no loja_usuarios exist => unrestricted access.
 */
export default function PinGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pdvUser, clear } = usePdvUser();
  const navigate = useNavigate();
  const location = useLocation();

  // Se a sessão atual veio do link da comanda (garçom), sempre força a seleção
  // de usuário ao abrir o painel do lojista.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("pdv_from_comanda") === "1") {
        sessionStorage.removeItem("pdv_from_comanda");
        if (pdvUser) clear();
      }
    } catch {}
  }, [pdvUser, clear]);

  const { data: loja } = useQuery({
    queryKey: ["pin-gate-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: usuariosCount, isLoading } = useQuery({
    queryKey: ["pin-gate-count", loja?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("loja_usuarios" as any)
        .select("*", { count: "exact", head: true })
        .eq("loja_id", loja!.id)
        .eq("ativo", true);
      return count ?? 0;
    },
    enabled: !!loja?.id,
  });

  const needsPin = !!usuariosCount && usuariosCount > 0 && !pdvUser;

  useEffect(() => {
    if (needsPin && location.pathname !== "/lojista/pin") {
      navigate("/lojista/pin", { replace: true });
    }
  }, [needsPin, location.pathname, navigate]);

  if (isLoading || (loja && usuariosCount === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (needsPin) return null;

  return <>{children}</>;
}
