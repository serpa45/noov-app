import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, ChevronDown, Clock, AlertTriangle, Cake, Eye, EyeOff, Check, MessageCircle, Send, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { usePlanCriticalStatus } from "@/hooks/usePlanCriticalStatus";
import TrialExpiredOverlay from "@/components/admin/TrialExpiredOverlay";
import SystemExpiredOverlay from "@/components/admin/SystemExpiredOverlay";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import PaymentModal from "@/components/admin/PaymentModal";
import { Button } from "@/components/ui/button";
import LojistaMensagensBell from "@/components/admin/LojistaMensagensBell";
import { Switch } from "@/components/ui/switch";
import { usePdvUser } from "@/contexts/PdvUserContext";
import { useToast } from "@/hooks/use-toast";
import { isStoreOpen } from "@/utils/storeHours";
// Removed PrintService import as it was deprecated

const getPageTitles = (base: string): Record<string, string> => ({
  [base]: "Dashboard",
  [`${base}/pedidos`]: "Gerenciador de Pedidos",
  [`${base}/produtos`]: "Produtos",
  [`${base}/entregas`]: "Entregas",
  [`${base}/financeiro`]: "Financeiro",
  [`${base}/usuarios`]: "Usuários",
  [`${base}/pdv-balcao`]: "PDV",
  [`${base}/pdv-garcom`]: "PDV Garçom",
  [`${base}/configuracoes`]: "Configurações",
  [`${base}/perfil`]: "Meu Perfil",
  [`${base}/plano`]: "Meu Plano",
  [`${base}/consultor`]: "Consultor IA de Negócios",
});

function CollapsedNoovBrand() {
  const { state, isMobile } = useSidebar();
  if (isMobile || state !== "collapsed") return null;
  return (
    <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-blue-600">
      N<span className="text-orange-500">O</span>OV
    </span>
  );
}

const AdminLayout = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const base = "/lojista";
  const pageTitles = getPageTitles(base);
  const pageTitle = pageTitles[location.pathname] || "Painel";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { pdvUser } = usePdvUser();
  const isRestrictedUser = !!pdvUser && pdvUser.nivel !== "admin";
  const { isExpired, daysRemaining, trialDays, isLoading: trialLoading, licenseDaysRemaining, licenseExpiring, planoId, valorExclusivo, planoExclusivoId } = useTrialStatus();
  const planCritical = usePlanCriticalStatus();
  const isInTrial = !isExpired && trialDays > 0 && daysRemaining > 0;
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [renewalPlan, setRenewalPlan] = useState<any>(null);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [waTarget, setWaTarget] = useState<{ id?: string; nome: string; telefone: string } | null>(null);
  const [sentBirthdayMsgs, setSentBirthdayMsgs] = useState<string[]>(() => {
    try {
      const year = new Date().getFullYear();
      return JSON.parse(localStorage.getItem(`sent-birthday-msgs-${year}`) || "[]");
    } catch { return []; }
  });
  useEffect(() => {
    try {
      const year = new Date().getFullYear();
      localStorage.setItem(`sent-birthday-msgs-${year}`, JSON.stringify(sentBirthdayMsgs));
    } catch {}
  }, [sentBirthdayMsgs]);
  const birthdayMessages = [
    "Passando aqui para desejar um Feliz Aniversário! Que seu dia seja repleto de alegria, saúde e muitos sorrisos.",
    "Feliz Aniversário! Que este novo ciclo traga muita paz, saúde e felicidade ao lado de quem você ama.",
    "Parabéns pelo seu dia! Desejo muita saúde, amor e conquistas neste novo ano de vida.",
    "Hoje é seu dia! Que Deus abençoe sua vida com muita saúde, paz e alegria. Feliz Aniversário!",
    "Muitas felicidades no seu aniversário! Que você continue espalhando essa energia boa por onde passar.",
    "Feliz Aniversário! Que este dia seja tão especial quanto você merece. Um forte abraço!",
    "Parabéns! Desejo um dia maravilhoso e um ano cheio de realizações e momentos felizes.",
    "Feliz Aniversário! Que a vida continue te presenteando com saúde, amor e boas surpresas.",
    "Parabéns pelo seu dia especial! Que a felicidade esteja sempre presente em sua caminhada.",
    "Feliz Aniversário! Que este novo ano seja iluminado por muita paz e alegria.",
    "Que este dia seja inesquecível! Desejo tudo de melhor pra você. Feliz Aniversário!",
    "Parabéns! Que seu novo ano de vida venha carregado de bênçãos, saúde e sorrisos.",
    "Feliz Aniversário! Que Deus continue guiando seus passos e abençoando sua vida.",
    "Hoje comemoramos você! Muita saúde, paz e felicidade neste novo ciclo.",
    "Feliz Aniversário! Que seu dia seja leve, feliz e cheio de carinho.",
    "Parabéns pelo aniversário! Desejo muita saúde e alegria em todos os dias do seu ano.",
    "Feliz Aniversário! Que seu coração esteja sempre em paz e sua vida cheia de amor.",
    "Um dia muito especial merece votos especiais! Feliz Aniversário, muita saúde e paz.",
    "Parabéns! Que este novo ano traga sonhos realizados e momentos inesquecíveis.",
    "Feliz Aniversário! Que a alegria de hoje se estenda por todos os dias do seu novo ano de vida.",
  ];
  const [waMessageIdx, setWaMessageIdx] = useState(0);
  const [waMessage, setWaMessage] = useState(birthdayMessages[0]);
  const [dismissedBirthdays, setDismissedBirthdays] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed-birthdays") || "[]");
    } catch { return []; }
  });

  // Initialize
  useEffect(() => {
    if (user) {
      // PrintService init removed
    }
  }, [user]);

  const toggleDismiss = (id: string) => {
    setDismissedBirthdays(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("dismissed-birthdays", JSON.stringify(next));
      return next;
    });
  };

  // Realtime: auto-refresh all lojista data
  useRealtimeSubscription("pedidos", [["pedidos"], ["pending-orders-count"]], `lojista_id=eq.${user?.id}`);
  useRealtimeSubscription("produtos", [["produtos"], ["lojista-produtos"]]);
  useRealtimeSubscription("lojas", [["lojista-loja"], ["lojista-loja-layout"], ["trial-loja"]]);
  useRealtimeSubscription("entregas", [["entregas"]]);
  useRealtimeSubscription("configuracoes_globais", [["config-global"]]);
  useRealtimeSubscription("loja_planos", [["trial-plano"]]);

  const { data: loja } = useQuery({
    queryKey: ["lojista-loja-layout", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome, logo_url, lembrete_aniversario, ocultar_evento, horario_funcionamento").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const horarioFuncionamento = (loja as any)?.horario_funcionamento;
  const storeOpenStatus = isStoreOpen(horarioFuncionamento);

  const { data: globalEventImage } = useQuery({
    queryKey: ["global-event-image-layout"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_rating_settings")
        .select("event_image_url")
        .eq("id", 1)
        .maybeSingle();
      return (data as any)?.event_image_url as string | null;
    },
  });

  const ocultarEvento = !!(loja as any)?.ocultar_evento;
  const toggleOcultarEvento = async (hide: boolean) => {
    if (!(loja as any)?.id) return;
    const { error } = await supabase
      .from("lojas")
      .update({ ocultar_evento: hide } as any)
      .eq("id", (loja as any).id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["lojista-loja-layout"] });
  };

  // Set PWA manifest with store logo when logged in
  useEffect(() => {
    if (!loja) return;
    const logoUrl = (loja as any)?.logo_url;
    const storeName = (loja as any)?.nome || "Lojista";
    const manifest = {
      name: "Lojista",
      short_name: "Lojista",
      description: "Painel do Lojista",
      start_url: "/lojista/login",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#2563EB",
      icons: [
        { src: logoUrl || "/icon-lojista-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: logoUrl || "/icon-lojista-192.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: logoUrl || "/icon-lojista-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    let link = document.getElementById("manifest-link") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.id = "manifest-link";
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = url;
    document.title = "Lojista - Painel";

    // Apple touch icon
    if (logoUrl) {
      let touchIcon = document.getElementById("apple-touch-icon") as HTMLLinkElement;
      if (!touchIcon) {
        touchIcon = document.createElement("link");
        touchIcon.id = "apple-touch-icon";
        touchIcon.rel = "apple-touch-icon";
        document.head.appendChild(touchIcon);
      }
      touchIcon.href = logoUrl;
    }

    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name='${name}']`);
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", name); document.head.appendChild(meta); }
      meta.setAttribute("content", content);
    };
    updateMeta("apple-mobile-web-app-title", "Lojista");
  }, [loja]);

  // Check if store has pro/ultra plan (for birthday feature)
  const { data: lojaPlano } = useQuery({
    queryKey: ["loja-plano-layout", (loja as any)?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(slug, limites)")
        .eq("loja_id", (loja as any)!.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!(loja as any)?.id,
  });

  const planoSlug = (lojaPlano as any)?.planos?.slug || "";
  const mergedLimites = { ...((lojaPlano as any)?.planos?.limites || {}), ...((lojaPlano as any)?.limites_assinado || {}) };
  const isPlanProOrUltra = planoSlug === "pro" || planoSlug === "ultra" || isInTrial || !!mergedLimites.lembrete_aniversario;
  const showBirthdayButton = isPlanProOrUltra && (loja as any)?.lembrete_aniversario !== false;

  const { data: pedidosPendentes = 0 } = useQuery({
    queryKey: ["pending-orders-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("pedidos")
        .select("*", { count: "exact", head: true })
        .eq("lojista_id", user!.id)
        .eq("status", "pendente");
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Global sound notification for new pending orders (plays on any /lojista page)
  const prevPendingRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize audio + unlock on first user gesture (required for mobile)
  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      a.preload = "auto";
      a.volume = 1.0;
      audioRef.current = a;
    }
    const unlock = async () => {
      if (audioUnlockedRef.current) return;
      try {
        const a = audioRef.current!;
        a.muted = true;
        await a.play();
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        audioUnlockedRef.current = true;
      } catch (e) {
        // ignore
      }
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx && !audioCtxRef.current) {
          audioCtxRef.current = new Ctx();
        }
        if (audioCtxRef.current?.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      } catch {}
    };
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "click", "touchstart", "keydown"];
    events.forEach((ev) => document.addEventListener(ev, unlock, { once: false, passive: true }));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, unlock));
    };
  }, []);

  const playOrderBeep = () => {
    // Try HTMLAudio first
    const a = audioRef.current;
    if (a) {
      try {
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.then === "function") {
          p.catch(() => playBeepFallback());
        }
        return;
      } catch {
        // fallback below
      }
    }
    playBeepFallback();
  };

  const playBeepFallback = () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.error("Beep fallback falhou:", e);
    }
  };

  useEffect(() => {
    const current = Number(pedidosPendentes) || 0;
    const prev = prevPendingRef.current;
    if (prev !== null && current > prev) {
      const isMuted = localStorage.getItem("orders-muted") === "true";
      if (!isMuted) {
        playOrderBeep();
      }
      toast({
        title: "🔔 NOVO PEDIDO!",
        description: "Um novo pedido acabou de chegar!",
        variant: "destructive",
      });
    }
    prevPendingRef.current = current;
  }, [pedidosPendentes, toast]);

  // Escuta evento global para reproduzir o mesmo bipe de novo pedido (usado pelo lembrete)
  useEffect(() => {
    const handler = () => {
      const isMuted = localStorage.getItem("orders-muted") === "true";
      if (!isMuted) playOrderBeep();
    };
    window.addEventListener("play-order-beep", handler);
    return () => window.removeEventListener("play-order-beep", handler);
  }, []);

  // Birthday query - clients with birthday this month
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentDay = String(now.getDate()).padStart(2, "0");
  const { data: aniversariantes = [] } = useQuery({
    queryKey: ["aniversariantes-mes", currentMonth, (loja as any)?.id],
    queryFn: async () => {
      if (!(loja as any)?.id) return [];
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_completo, data_nascimento, telefone, foto_url, aniversario_visto_ano")
        .eq("loja_id", (loja as any).id)
        .not("data_nascimento", "is", null);
      if (error) throw error;
      const currentYear = now.getFullYear();
      return (data || []).filter((c) => {
        if (!c.data_nascimento || (c as any).aniversario_visto_ano === currentYear) return false;
        const [, m] = c.data_nascimento.split("-");
        return m === currentMonth;
      }).sort((a, b) => {
        const [, , da] = a.data_nascimento.split("-");
        const [, , db] = b.data_nascimento.split("-");
        return parseInt(da) - parseInt(db);
      });

    },
    enabled: !!(loja as any)?.id,
  });

  const aniversariantesHoje = aniversariantes.filter((c) => {
    if (!c.data_nascimento) return false;
    const [, , d] = c.data_nascimento.split("-");
    return d === currentDay;
  });

  const isDayDismissed = dismissedBirthdays.includes(`day-${currentDay}-${currentMonth}`);
  
  useEffect(() => {
    const shownThisSession = sessionStorage.getItem("birthday-shown-session") === "true";
    if (aniversariantesHoje.length > 0 && !isDayDismissed && !birthdayOpen && !shownThisSession) {
      setBirthdayOpen(true);
      sessionStorage.setItem("birthday-shown-session", "true");
    }
  }, [aniversariantesHoje.length, isDayDismissed]);

  // Fetch plan details for renewal
  const { data: currentPlan } = useQuery({
    queryKey: ["renewal-plan", planoId],
    queryFn: async () => {
      const { data } = await supabase.from("planos").select("id, nome, preco, periodo").eq("id", planoId!).single();
      return data;
    },
    enabled: !!planoId,
  });

  const handleRenew = () => {
    if (currentPlan) {
      // Apply exclusive price if it exists for this plan
      const planToRenew = {
        ...currentPlan,
        preco: (valorExclusivo !== null && planoExclusivoId === currentPlan.id) 
          ? Number(valorExclusivo) 
          : Number(currentPlan.preco)
      };
      setRenewalPlan(planToRenew);
      setPaymentOpen(true);
    }
  };

  const logoUrl = (loja as any)?.logo_url || profile?.avatar_url;
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <SidebarProvider>
      {isExpired && !trialLoading && licenseDaysRemaining === null && <TrialExpiredOverlay />}
      {isExpired && !trialLoading && licenseDaysRemaining === 0 && planoId && (
        <SystemExpiredOverlay onRenew={handleRenew} canRenew={!!currentPlan} />
      )}
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className={`h-14 items-center border-b border-border bg-card px-4 gap-3 shadow-sm sticky top-0 z-30 ${(/^\/lojista\/(pedidos|pdv|comandas)/.test(location.pathname)) ? "hidden lg:flex" : "flex"}`}>
            <SidebarTrigger className="lg:hidden" />
            <CollapsedNoovBrand />
            <span
              className={`w-3 h-3 rounded-full shrink-0 ml-4 ${storeOpenStatus.open ? "bg-green-500" : "bg-red-500"} ${!storeOpenStatus.open ? "animate-pulse" : ""}`}
              title={storeOpenStatus.open ? "Estabelecimento aberto" : "Estabelecimento fechado"}
              aria-label={storeOpenStatus.open ? "Aberto" : "Fechado"}
            />
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold font-display text-foreground leading-tight">{pageTitle}</h2>
            </div>
            {licenseDaysRemaining !== null && (
              <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ml-auto ${
                licenseDaysRemaining <= 5 
                  ? "bg-red-500/10 text-red-600 border border-red-500/20" 
                  : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                Seu sistema vence em {licenseDaysRemaining} {licenseDaysRemaining === 1 ? "dia" : "dias"}.
                {licenseDaysRemaining <= 7 && !isRestrictedUser && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] ml-1 bg-white hover:bg-white/90 border-current" onClick={handleRenew}>
                    Renovar
                  </Button>
                )}
              </div>
            )}
            {isInTrial && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold ml-auto">
                <Clock className="w-3.5 h-3.5" />
                Restam {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"} de teste grátis, com todos os recursos liberados
              </div>
            )}
            {/* Removed redundant licenseExpiring block as it's now integrated above */}
            <div className="flex-1" />

            {globalEventImage && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-2xl bg-muted text-xs font-semibold mr-1">
                <div className="flex flex-col leading-tight">
                  <span>Exibir imagem de evento</span>
                  <span className="text-[10px] font-normal text-muted-foreground">no cabeçalho do cardápio</span>
                </div>
                <Switch
                  checked={!ocultarEvento}
                  onCheckedChange={(v) => toggleOcultarEvento(!v)}
                />
              </div>
            )}


            {/* Pedidos - Hidden for start plan */}
            {planoSlug !== "start" && (
              <button
                onClick={() => navigate(`${base}/pedidos`)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                title="Pedidos pendentes"
              >
                <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                {pedidosPendentes > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {pedidosPendentes > 9 ? "9+" : pedidosPendentes}
                  </span>
                )}
              </button>
            )}

            {/* Aniversariantes - only for pro/ultra with setting enabled */}
            {showBirthdayButton && !isRestrictedUser && (
              <button
                onClick={() => setBirthdayOpen(true)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                title="Aniversariantes do mês"
              >
                <Cake className="w-5 h-5 text-muted-foreground" />
                {aniversariantesHoje.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {aniversariantesHoje.length}
                  </span>
                )}
              </button>
            )}

            {/* Mensagens */}
            {!isRestrictedUser && <LojistaMensagensBell lojaId={(loja as any)?.id} />}

            {/* Alerta de upgrade */}
            {planCritical.isCritical && !isRestrictedUser && (
              <button
                onClick={() => navigate(`${base}/plano`)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors group"
                title="Atenção: seu plano precisa de upgrade"
              >
                <AlertTriangle className="w-5 h-5 text-orange-500 animate-pulse" />
                <span className="absolute -top-1 -right-1 min-w-[18px] px-1 flex items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                  UP
                </span>
              </button>
            )}

            {/* User profile */}
            <button
              onClick={() => navigate(`${base}/perfil`)}
              className="flex items-center gap-2 hover:bg-muted px-2 py-1.5 rounded-lg transition-colors"
              title="Meu perfil"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-full object-cover border-2 border-primary/20" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <span className="text-xs font-bold text-primary">{initials}</span>
                </div>
              )}
              {profile?.full_name && (
                <span className="text-sm font-semibold text-foreground hidden sm:block">
                  {profile.full_name.split(" ")[0]}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </header>
          {isInTrial && (
            <div className={`relative ${(/^\/lojista\/(pedidos|pdv|comandas)/.test(location.pathname)) ? "md:hidden flex" : "lg:hidden flex"} items-center justify-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-bold`}>
              {/^\/lojista\/(pedidos|pdv|comandas)/.test(location.pathname) && (
                <SidebarTrigger className="lg:hidden shrink-0 absolute left-1 top-1/2 -translate-y-1/2" />
              )}
              <Clock className="w-3.5 h-3.5" />
              <span>Restam {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"} de teste grátis, com todos os recursos liberados</span>
            </div>
          )}
          {/^\/lojista\/(pedidos|pdv|comandas)/.test(location.pathname) && (
            <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2 bg-card border-b border-border px-2 py-1.5 shadow-sm">
              <SidebarTrigger />
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${storeOpenStatus.open ? "bg-green-500" : "bg-red-500"} ${!storeOpenStatus.open ? "animate-pulse" : ""}`}
                title={storeOpenStatus.open ? "Estabelecimento aberto" : "Estabelecimento fechado"}
                aria-label={storeOpenStatus.open ? "Aberto" : "Fechado"}
              />
              {/^\/lojista\/pedidos/.test(location.pathname) && (
                <h2 className="text-sm font-bold font-display text-foreground">Gerenciador de Pedidos</h2>
              )}
            </div>
          )}
          {(licenseDaysRemaining !== null || globalEventImage) && (
            <div className={`${(/^\/lojista\/(pedidos|pdv|comandas)/.test(location.pathname)) ? "hidden" : "lg:hidden flex"} flex-col md:flex-row md:flex-wrap items-stretch`}>
              {licenseDaysRemaining !== null && (
                <div className={`relative flex-1 min-w-0 flex items-center justify-center gap-2 px-2 py-1.5 text-xs font-bold ${
                  licenseDaysRemaining <= 5 
                    ? "bg-red-500/10 text-red-600" 
                    : "bg-blue-500/10 text-blue-600"
                }`}>
                  {/^\/lojista\/(pedidos|pdv|comandas)/.test(location.pathname) && (
                    <SidebarTrigger className="lg:hidden shrink-0 absolute left-1 top-1/2 -translate-y-1/2" />
                  )}
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Seu sistema vence em {licenseDaysRemaining} {licenseDaysRemaining === 1 ? "dia" : "dias"}.</span>
                  {licenseDaysRemaining <= 7 && !isRestrictedUser && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] bg-white hover:bg-white/90 border-current shrink-0" onClick={handleRenew}>
                      Renovar
                    </Button>
                  )}
                </div>
              )}
              {globalEventImage && (
                <div className="flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-1.5 bg-muted text-xs font-semibold">
                  <div className="flex flex-col leading-tight text-center min-w-0">
                    <span className="truncate">Exibir imagem de evento</span>
                    <span className="text-[10px] font-normal text-muted-foreground truncate">no cabeçalho do cardápio</span>
                  </div>
                  <Switch
                    checked={!ocultarEvento}
                    onCheckedChange={(v) => toggleOcultarEvento(!v)}
                  />
                </div>
              )}
            </div>
          )}
          <div className="h-[2px] bg-secondary shrink-0" />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        plan={renewalPlan}
      />
      <Dialog open={birthdayOpen} onOpenChange={setBirthdayOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto top-[2vh] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-primary" /> Aniversariantes do Mês
              <span className="ml-auto mr-6 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {aniversariantes.length} {aniversariantes.length === 1 ? "aniversariante" : "aniversariantes"}
              </span>
            </DialogTitle>
            {aniversariantesHoje.length > 0 && (
              <p className="text-xs text-muted-foreground">
                🎉 {aniversariantesHoje.length} {aniversariantesHoje.length === 1 ? "faz aniversário hoje" : "fazem aniversário hoje"}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {aniversariantes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversariante este mês</p>
            ) : (
              aniversariantes.map((c) => {
                const [y, m, d] = (c.data_nascimento || "").split("-");
                const isToday = d === currentDay;
                const birthYear = parseInt(y, 10);
                const birthMonth = parseInt(m, 10);
                const birthDay = parseInt(d, 10);
                let age = now.getFullYear() - birthYear;
                const hadBirthday = (now.getMonth() + 1) > birthMonth || ((now.getMonth() + 1) === birthMonth && now.getDate() >= birthDay);
                if (!hadBirthday) age -= 1;
                return (
                  <div key={c.id} data-today={isToday ? "true" : undefined} ref={isToday ? (el) => { if (el && birthdayOpen) el.scrollIntoView({ block: "center", behavior: "smooth" }); } : undefined} className={`relative flex items-center justify-between p-3 pt-5 rounded-lg border ${isToday ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
                    {isToday && (
                      <span className="absolute top-1 right-2 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">🎂 Hoje!</span>
                    )}
                    <div className="flex items-center gap-3">
                      {(c as any).foto_url ? (
                        <img src={(c as any).foto_url} alt={c.nome_completo} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                          {c.nome_completo?.charAt(0)?.toUpperCase() || "C"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Cake className="w-3.5 h-3.5 text-primary" />
                          {c.nome_completo}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{d}/{m}/{y} ﹒ {age} anos</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0">
                      <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const { error } = await supabase
                            .from("clientes")
                            .update({ aniversario_visto_ano: now.getFullYear() } as any)
                            .eq("id", c.id);
                          if (!error) {
                            queryClient.invalidateQueries({ queryKey: ["aniversariantes-mes"] });
                            toast({ title: "Marcado como visto!", description: "O aniversariante não aparecerá mais este ano." });
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title="Marcar como visto"
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </button>
                      {isToday && (
                        <button
                          onClick={() => setWaTarget({ id: c.id, nome: c.nome_completo || "cliente", telefone: c.telefone })}
                          className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${sentBirthdayMsgs.includes(c.id) ? "" : "animate-pulse"}`}
                          title="Enviar WhatsApp"
                        >
                          <Send className={`w-4 h-4 ${sentBirthdayMsgs.includes(c.id) ? "text-muted-foreground" : "text-blue-600"}`} />
                        </button>
                      )}
                      <button
                        onClick={() => { setBirthdayOpen(false); navigate(`/lojista/clientes/${encodeURIComponent(c.telefone)}`); }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title="Ver cliente"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      </div>
                      {sentBirthdayMsgs.includes(c.id) && (
                        <span className="text-[11px] font-semibold text-green-600 leading-none -mt-1">
                          Mensagem enviada
                        </span>
                      )}
                    </div>
                  </div>
                );
              })

            )}
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
            <Checkbox
              id="dismiss-birthday"
              checked={dismissedBirthdays.includes(`day-${currentDay}-${currentMonth}`)}
              onCheckedChange={() => toggleDismiss(`day-${currentDay}-${currentMonth}`)}
            />
            <label htmlFor="dismiss-birthday" className="text-sm text-muted-foreground cursor-pointer">
              Não mostrar esse aviso hoje
            </label>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!waTarget} onOpenChange={(v) => !v && setWaTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Mensagem para {waTarget?.nome?.split(" ")[0]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <Textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={6}
                placeholder="Digite a mensagem..."
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Prévia:
              <div className="font-medium text-foreground whitespace-pre-line mt-1">
                {(() => {
                  const nomeLoja = (loja as any)?.nome || "";
                  const first = nomeLoja.trim().split(" ")[0] || "";
                  const prep = /a$/i.test(first) ? "da" : "do";
                  return `*Olá, ${waTarget?.nome?.split(" ")[0] || ""}!*\n${waMessage}\n\n*É o que nós ${prep} ${nomeLoja} desejamos a você!*`;
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const next = (waMessageIdx + 1) % birthdayMessages.length;
                setWaMessageIdx(next);
                setWaMessage(birthdayMessages[next]);
              }}
            >
              <Sparkles className="w-4 h-4" /> Gerar outra mensagem
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={() => {
                if (!waTarget) return;
                const phone = (waTarget.telefone || "").replace(/\D/g, "");
                const withCountry = phone.startsWith("55") ? phone : `55${phone}`;
                const firstName = (waTarget.nome || "cliente").split(" ")[0];
                const nomeLoja = (loja as any)?.nome || "";
                const first = nomeLoja.trim().split(" ")[0] || "";
                const prep = /a$/i.test(first) ? "da" : "do";
                const text = encodeURIComponent(`*Olá, ${firstName}!*\n${waMessage}\n\n*É o que nós ${prep} ${nomeLoja} desejamos a você!*`);
                window.open(`https://wa.me/${withCountry}?text=${text}`, "_blank");
                if (waTarget.id) setSentBirthdayMsgs((prev) => prev.includes(waTarget.id!) ? prev : [...prev, waTarget.id!]);
                setWaTarget(null);
              }}
            >
              <Send className="w-4 h-4" /> Enviar mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default AdminLayout;
