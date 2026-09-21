import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Create a unique session ID for the browser tab
const SESSION_ID = crypto.randomUUID();

export const useOnlineTracking = () => {
  const { user, profile, roles } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const isMasterSession = () => {
      try { return localStorage.getItem("noov_master_session") === "1"; } catch { return false; }
    };

    // Remove any lingering presence row for this tab if master flag is on
    const purgeIfMaster = () => {
      if (isMasterSession()) {
        supabase.from("online_users").delete().eq("session_id", SESSION_ID).then(() => {}, () => {});
        return true;
      }
      return false;
    };

    if (purgeIfMaster()) return;

    const trackPresence = async (eventDetails?: { type: string, label: string }) => {
      // Re-check master flag on every heartbeat/click — hides master sessions even if the flag is set after mount
      if (purgeIfMaster()) return;

      // Determine user role and page type
      let role = "visitante";
      if (user) {
        if (location.pathname.startsWith("/admin")) role = "admin";
        else if (location.pathname.startsWith("/lojista")) role = "lojista";
        else if (location.pathname.startsWith("/entregador")) role = "entregador";
        else if (location.pathname.startsWith("/afiliado")) role = "afiliado";
        else role = "cliente";
      }

      const pageName = location.pathname === "/" ? "Landing Page" : 
                       location.pathname === "/login" ? "Tela de Login" :
                       location.pathname === "/cadastro" ? "Criar Loja Grátis" :
                       location.pathname.startsWith("/cardapio") ? `Cardápio: ${location.pathname.split('/')[2] || ''}` :
                       location.pathname.startsWith("/lojista/pedidos") ? "Gestão de Pedidos" :
                       location.pathname.startsWith("/lojista/pdv") ? "PDV / Frente de Caixa" :
                       location.pathname.startsWith("/lojista") ? "Painel Lojista" :
                       location.pathname.startsWith("/admin/metricas") ? "Métricas do Sistema" :
                       location.pathname.startsWith("/admin") ? "Painel Admin" :
                       location.pathname.startsWith("/entregador") ? "App Entregador" :
                       location.pathname.startsWith("/planos") ? "Página de Planos" :
                       location.pathname.startsWith("/afiliado") ? "Painel Afiliado" :
                       location.pathname;

      try {
        // First, get the current record to check session start and history
        const { data: currentRecord } = await supabase
          .from("online_users")
          .select("session_start, navigation_history")
          .eq("session_id", SESSION_ID)
          .maybeSingle();

        const now = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Logic to reset if it's a new day
        let sessionStart = currentRecord?.session_start;
        let history = (currentRecord?.navigation_history as any[]) || [];

        if (!sessionStart || new Date(sessionStart) < startOfDay) {
          sessionStart = now.toISOString();
          history = [];
        }

        // Add current page to history if different from last
        const lastEntry = history.length > 0 ? history[history.length - 1] : null;
        
        if (eventDetails) {
          // If it's a click event, add it to history
          history.push({
            type: 'event',
            event: eventDetails.type,
            label: eventDetails.label,
            page: pageName,
            path: location.pathname,
            timestamp: now.toISOString()
          });
        } else if (!lastEntry || lastEntry.path !== location.pathname) {
          // Normal page navigation
          history.push({
            type: 'page',
            page: pageName,
            path: location.pathname,
            timestamp: now.toISOString()
          });
        }

        const displayName = profile?.full_name || user?.user_metadata?.full_name || (user ? "Usuário Autenticado" : "Visitante Anônimo");

        await supabase.from("online_users").upsert({
          session_id: SESSION_ID,
          user_id: user?.id || null,
          user_name: displayName,
          user_role: role,
          current_page: pageName,
          last_seen_at: now.toISOString(),
          session_start: sessionStart,
          navigation_history: history
        }, { onConflict: 'session_id' });

        // Persistent access log (new page nav or click event)
        if (eventDetails || !lastEntry || lastEntry.path !== location.pathname) {
          try {
            await supabase.from("access_logs").insert({
              session_id: SESSION_ID,
              user_id: user?.id || null,
              user_name: displayName,
              user_role: role,
              page: pageName,
              path: location.pathname,
              event_type: eventDetails ? 'click' : 'page',
              label: eventDetails?.label || null,
            });
          } catch {}
        }
      } catch (err) {
        // Suppress errors during navigation/unmount
      }
    };

    // Initial track and interval
    trackPresence();
    const interval = setInterval(() => trackPresence(), 30000); // Heartbeat every 30s

    // Click tracker for all pages
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], .track-click');
      
      if (clickable) {
        let label = clickable.textContent?.trim() || (clickable as any).innerText?.trim();
        
        // If no text, check aria-label or title
        if (!label) {
          label = clickable.getAttribute('aria-label') || clickable.getAttribute('title') || "Elemento sem texto";
        }

        // Add context based on component/text
        if (location.pathname.startsWith("/cardapio")) {
          const merchantName = document.querySelector('h1')?.textContent?.trim() || "Lojista";
          
          // Identify if it's a product
          const productCard = target.closest('[data-product-id]') || target.closest('.product-card');
          const productName = productCard?.querySelector('h3, .product-name')?.textContent?.trim();
          
          if (productName) {
            label = `[${merchantName}] Produto: ${productName}`;
          } else if (label.toLowerCase().includes('finalizar') || label.toLowerCase().includes('carrinho')) {
            label = `[${merchantName}] Checkout/Carrinho: ${label}`;
          } else {
            label = `[${merchantName}] ${label}`;
          }
        } else if (location.pathname.startsWith("/planos")) {
          label = `[Planos] ${label}`;
        }
        
        trackPresence({ type: 'click', label: label.substring(0, 150) });
      }
    };

    window.addEventListener('click', handleGlobalClick);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', handleGlobalClick);
      // Attempt to clean up session immediately on unmount/tab close
      const cleanup = async () => {
        try {
          await supabase.from("online_users").delete().eq("session_id", SESSION_ID);
        } catch (e) {}
      };
      cleanup();
    };
  }, [user, profile, location.pathname]);
};
