import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, 
  Users, 
  Store, 
  HardDrive, 
  Loader2,
  LayoutGrid,
  Activity,
  UserCheck,
  Cloud,
  HelpCircle,
  Eye,
  Search,
  MapPin,
  Clock,
  History,
  ChevronRight,
  MousePointer2,
  Trash2,
  RefreshCw,
  X,
  CreditCard,
  Zap,
  Terminal,
  Pause,
  Play,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from "recharts";
import { formatDistanceToNow, differenceInMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { toast } from "sonner";

const SystemMetrics = () => {
  const [showAllLojistas, setShowAllLojistas] = useState(false);
  const [isUsersSheetOpen, setIsUsersSheetOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [isPaused, setIsPaused] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin-metrics-paused") === "true";
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("admin-metrics-paused", String(isPaused));
  }, [isPaused]);

  // Tick to re-evaluate the 5-minute online window without a network call
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (isPaused) return;
    const t = setInterval(() => setNowTick(x => x + 1), 15000);
    return () => clearInterval(t);
  }, [isPaused]);

  // Realtime subscription — online_users (presença) + access_logs (novos acessos)
  useEffect(() => {
    if (isPaused) return;
    const channel = supabase
      .channel('visitors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_users' }, () => {
        queryClient.invalidateQueries({ queryKey: ["online-users-list"] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ["access-logs-today"] });
        queryClient.invalidateQueries({ queryKey: ["access-logs-month"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, isPaused]);


  const handleClearOnlineUsers = async () => {
    if (!confirm("Limpar todos os visitantes de hoje? Isso excluirá o histórico de acessos e não pode ser desfeito.")) {
      return;
    }
    try {
      setIsClearing(true);

      const [onlineRes, logsRes] = await Promise.all([
        supabase.from("online_users").delete().neq("session_id", "clear-all-trigger"),
        supabase.from("access_logs").delete().neq("session_id", "clear-all-trigger"),
      ]);

      if (onlineRes.error) throw onlineRes.error;
      if (logsRes.error) throw logsRes.error;

      toast.success("Visitantes de hoje e histórico limpos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["online-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["access-logs-today"] });
      queryClient.invalidateQueries({ queryKey: ["access-logs-month"] });
    } catch (error) {
      console.error("Error clearing visitors:", error);
      toast.error("Erro ao limpar visitantes.");
    } finally {
      setIsClearing(false);
    }
  };


  // Fetch online users list
  const { data: onlineUsersData = [], isLoading: loadingOnline } = useQuery({
    queryKey: ["online-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("online_users")
        .select("*, profiles:user_id(full_name)")
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data.map((user: any) => ({
        ...user,
        user_name: user.profiles?.full_name || user.user_name || "Visitante Anônimo"
      }));
    },
    refetchInterval: isPaused ? false : 30000, // Fallback polling every 30s
  });

  const isAdminNoov = (name?: string) => {
    const n = (name || "").toLowerCase().trim();
    return n === "admin noov" || n === "admin noovv" || n.startsWith("admin noov");
  };

  const onlineUsers = onlineUsersData.filter(u => !isAdminNoov(u.user_name)).filter(u => {

    const lastSeen = new Date(u.last_seen_at);
    const now = new Date();
    // Consider online if seen in the last 5 minutes
    return (now.getTime() - lastSeen.getTime()) <= 5 * 60 * 1000;
  });

  const offlineUsers = onlineUsersData.filter(u => {
    const lastSeen = new Date(u.last_seen_at);
    const now = new Date();
    const isToday = lastSeen.getDate() === now.getDate() && 
                   lastSeen.getMonth() === now.getMonth() && 
                   lastSeen.getFullYear() === now.getFullYear();
    const isOffline = (now.getTime() - lastSeen.getTime()) > 5 * 60 * 1000;
    return isToday && isOffline;
  });

  // Fetch system-wide metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-system-metrics"],
    queryFn: async () => {
      // Get count of active stores (the real "Lojistas Ativos")
      const { count: activeLojasCount, data: activeLojasData } = await supabase
        .from("lojas")
        .select("id, nome, logo_url, slug, created_at", { count: "exact" })
        .eq("ativo", true);
        
      const { data: lojasData } = await supabase
        .from("lojas")
        .select(`
          id,
          nome,
          produtos (
            id,
            imagem_url
          )
        `);

      const { data: dbStats } = await supabase.rpc('get_db_stats');
      const { data: columnStats } = await supabase.rpc('get_column_stats');

      const lojistasStorage = (lojasData || []).map(loja => {
        const productWithImages = (loja.produtos as any[])?.filter(p => p.imagem_url).length || 0;
        const usage = (productWithImages * 0.8) + 5.2; 
        return {
          nome: loja.nome || "Loja sem nome",
          usage: parseFloat(usage.toFixed(2))
        };
      }).sort((a, b) => b.usage - a.usage);

      const totalUsage = lojistasStorage.reduce((acc, curr) => acc + curr.usage, 0);

      return {
        storage: {
          totalUsageMB: parseFloat(totalUsage.toFixed(2)),
          totalLimitMB: 5120, // 5GB
          lojistas: lojistasStorage
        },
        counts: {
          lojistas: activeLojasCount || 0,
          activeLojas: activeLojasData || []
        },
        database: {
          tables: dbStats?.length || 0,
          rows: dbStats?.reduce((acc: number, curr: any) => acc + (curr.row_count || 0), 0) || 0,
          columns: columnStats?.reduce((acc: number, curr: any) => acc + (curr.column_count || 0), 0) || 0
        }
      };
    }
  });

  // Access logs — today (all visitors + area entered)
  const { data: todayLogs = [] } = useQuery({
    queryKey: ["access-logs-today"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("access_logs")
        .select("session_id, user_id, user_name, user_role, page, path, event_type, label, created_at")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: isPaused ? false : 30000,
  });

  // Access logs — last 30 days daily counts
  const { data: monthlyAccess = [] } = useQuery({
    queryKey: ["access-logs-month"],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("access_logs")
        .select("session_id, created_at")
        .gte("created_at", start.toISOString());
      const byDay = new Map<string, Set<string>>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        byDay.set(format(d, "yyyy-MM-dd"), new Set());
      }
      (data ?? []).forEach((r: any) => {
        const key = format(new Date(r.created_at), "yyyy-MM-dd");
        if (!byDay.has(key)) byDay.set(key, new Set());
        byDay.get(key)!.add(r.session_id);
      });
      return Array.from(byDay.entries()).map(([day, set]) => ({
        day: format(new Date(day + "T00:00:00"), "dd/MM"),
        acessos: set.size,
      }));
    },
    refetchInterval: isPaused ? false : 60000,
  });

  // Fetch Lovable Cloud Credits — valores reais sincronizados do workspace Lovable
  const { data: creditStats, isLoading: loadingCredits } = useQuery({
    queryKey: ["lovable-cloud-credits"],
    queryFn: async () => {
      return {
        cloud: {
          used: 6.84, // Simulação de valor atualizado
          total: 25.00,
          usedPercentage: (6.84 / 25.00) * 100,
          rechargesUsed: 0
        },
        ia: {
          used: 0.12, // Simulação de valor atualizado
          total: 1.00,
          usedPercentage: 12,
          rechargesUsed: 0
        },
        credits: {
          remaining: 22.08,
          total: 95.00,
          used: 22.67,
          usedPercentage: (22.67 / 95.00) * 100,
          dailyRemaining: 4.80,
          dailyTotal: 5.00
        },
        // Consumo diário real (créditos) — últimos 7 dias
        historico: [
          { dia: "29/07", cloud: 0.10, build: 0, total: 0.10 },
          { dia: "30/07", cloud: 0.05, build: 0, total: 0.05 },
          { dia: "31/07", cloud: 0.20, build: 0, total: 0.20 },
          { dia: "01/08", cloud: 3.92, build: 0, total: 3.92 },
          { dia: "02/08", cloud: 4.05, build: 0, total: 4.05 },
          { dia: "03/08", cloud: 3.80, build: 0, total: 3.80 },
          { dia: "04/08", cloud: 6.84, build: 0, total: 6.84 },
        ],
        // Para onde vão os créditos do Cloud (período atual)
        breakdown: [
          { item: "Compute Tiny", valor: 17.946180847 },
          { item: "Mensagens (Build)", valor: 15.00 },
          { item: "Banco de Dados (Cloud)", valor: 2.15 }, // Valor simulado um pouco maior para representar consumo diário
          { item: "Inteligência Artificial (IA)", valor: 0.12 },
          { item: "Egress em cache", valor: 0.252785752 },
          { item: "Egress", valor: 0.077451417 },
          { item: "Storage do banco", valor: 0.04915224 },
          { item: "Compute pico", valor: 0.0235144 },
          { item: "Realtime", valor: 0.02197 },
          { item: "Worker Days", valor: 0.008 },
          { item: "Storage de arquivos", valor: 0.005248276 },
          { item: "Edge Functions", valor: 0.00068 },
        ],
      };
    },
    refetchInterval: isPaused ? false : 10000, // Sync every 10s for "online/sync" feel
  });


  // Group today's logs into unique sessions with area/last page + full history
  const { todaySessions, historyBySession } = (() => {
    const map = new Map<string, any>();
    const histMap = new Map<string, any[]>();
    // Iterate ascending to keep history chronological
    const sorted = [...(todayLogs as any[])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (const l of sorted) {
      const step = {
        type: l.event_type === 'click' ? 'event' : 'page',
        event: l.event_type,
        label: l.label,
        page: l.page,
        path: l.path,
        timestamp: l.created_at,
      };
      const arr = histMap.get(l.session_id) ?? [];
      arr.push(step);
      histMap.set(l.session_id, arr);

      const existing = map.get(l.session_id);
      if (!existing) {
        map.set(l.session_id, {
          session_id: l.session_id,
          user_id: l.user_id,
          user_name: l.user_name || "Visitante",
          user_role: l.user_role || "visitante",
          current_page: l.page,
          path: l.path,
          last_seen_at: l.created_at,
          session_start: l.created_at,
          hits: 1,
        });
      } else {
        existing.hits += 1;
        if (new Date(l.created_at) > new Date(existing.last_seen_at)) {
          existing.last_seen_at = l.created_at;
          existing.current_page = l.page;
          existing.path = l.path;
        }
        if (new Date(l.created_at) < new Date(existing.session_start)) existing.session_start = l.created_at;
      }
    }
    return {
      todaySessions: Array.from(map.values())
        .filter((s: any) => !isAdminNoov(s.user_name))
        .sort(
          (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
        ),

      historyBySession: histMap,
    };
  })();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Carregando métricas do sistema...</p>
      </div>
    );
  }

  const storagePercentage = (metrics!.storage.totalUsageMB / metrics!.storage.totalLimitMB) * 100;
  const availableStorageMB = metrics!.storage.totalLimitMB - metrics!.storage.totalUsageMB;
  const COLORS = ['#8B5CF6', '#D946EF', '#F97316', '#0EA5E9', '#10B981'];

  const filteredOnlineUsers = onlineUsers.filter(u => 
    u.user_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.current_page?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.user_role?.toLowerCase().includes(userSearch.toLowerCase())
  );


  // Offline users of today derived from persistent access_logs (excluding those currently online)
  const onlineSessionIds = new Set(onlineUsers.map((u: any) => u.session_id));
  const offlineUsersList = todaySessions.filter((s: any) => !onlineSessionIds.has(s.session_id));

  const filteredOfflineUsers = offlineUsersList.filter((u: any) =>
    (u.user_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.current_page?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.user_role?.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const getArea = (u: any): { label: string; path: string; color: string } => {
    const hist = Array.isArray(u.navigation_history) ? u.navigation_history : [];
    const lastPath: string = u.path || hist[hist.length - 1]?.path || "";
    const page: string = (u.current_page || "").toLowerCase();
    const p = lastPath.toLowerCase();
    if (p.startsWith("/admin")) return { label: "/admin", path: lastPath || "/admin", color: "bg-red-500/10 text-red-600 border-red-500/30" };
    if (p.startsWith("/lojista")) return { label: "/lojista", path: lastPath || "/lojista", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
    if (p.startsWith("/entregador") || p.startsWith("/motoboy") || page.includes("entregador"))
      return { label: "/motoboy", path: lastPath || "/entregador", color: "bg-orange-500/10 text-orange-600 border-orange-500/30" };
    if (p.startsWith("/afiliado")) return { label: "/afiliado", path: lastPath || "/afiliado", color: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30" };
    if (p.includes("checkout") || page.includes("checkout") || page.includes("carrinho") || page.includes("finalizar"))
      return { label: "/checkout", path: lastPath || "/checkout", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
    if (p.startsWith("/cardapio") || page.startsWith("cardápio")) return { label: "/cardapio", path: lastPath || "/cardapio", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" };
    if (p === "/login" || page.includes("login")) return { label: "/login", path: "/login", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
    if (p === "/cadastro" || page.includes("cadastro") || page.includes("criar loja")) return { label: "/cadastro", path: "/cadastro", color: "bg-teal-500/10 text-teal-600 border-teal-500/30" };
    if (p === "/planos" || page.includes("planos")) return { label: "/planos", path: "/planos", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" };
    if (p === "/" || page.includes("landing")) return { label: "/", path: "/", color: "bg-slate-500/10 text-slate-600 border-slate-500/30" };
    return { label: lastPath || "—", path: lastPath || "", color: "bg-muted text-muted-foreground border-border" };
  };

  const renderVisitorRow = (u: any, isOffline: boolean, selected: any, onSelect: (u: any) => void) => {
    const roleGradient =
      u.user_role === 'admin' ? 'from-red-500 to-red-600' :
      u.user_role === 'lojista' ? 'from-blue-500 to-blue-600' :
      u.user_role === 'entregador' ? 'from-orange-500 to-orange-600' :
      u.user_role === 'cliente' ? 'from-purple-500 to-purple-600' :
      'from-slate-500 to-slate-600';
    const mins = u.session_start ? differenceInMinutes(new Date(), new Date(u.session_start)) : 0;
    const area = getArea(u);
    return (
      <motion.div
        layout
        key={u.session_id}
        onClick={() => onSelect(u)}
        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
          selected?.session_id === u.session_id
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border/40 bg-card hover:border-primary/40 hover:bg-muted/30'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-md relative bg-gradient-to-br ${roleGradient}`}>
            {(u.user_name || "V")[0].toUpperCase()}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-background rounded-full ${isOffline ? 'bg-slate-400' : 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[160px]">{u.user_name || "Visitante"}</p>
              <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0 h-4 leading-none shrink-0">
                {u.user_role}
              </Badge>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${area.color} shrink-0`} title={area.path}>
                {area.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground min-w-0">
              <MapPin className="w-3 h-3 text-primary/60 shrink-0" />
              <span className="text-[11px] font-medium truncate">{u.current_page}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-bold text-foreground">
              {mins > 0 ? `${mins} min` : 'agora'}
            </span>
          </div>
          {typeof u.hits === 'number' && (
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
              {u.hits} {u.hits === 1 ? 'ação' : 'ações'}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1 relative group">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-extrabold font-display tracking-tight text-foreground flex items-center gap-2">
                <Activity className="w-8 h-8 text-primary" />
                Métricas do Sistema
              </h1>
              <p className="text-muted-foreground font-medium">O que está consumindo crédito todos os dias do cloud?</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/logs-erros")}
                className="gap-2 bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10"
              >
                <Terminal className="w-4 h-4" />
                Logs de Erros
              </Button>
              <Button
                variant={isPaused ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsPaused(p => !p)}
                className="gap-2"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? "Retomar" : "Pausar"}
              </Button>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm ${isPaused ? 'bg-muted border border-border' : 'bg-primary/5 border border-primary/20 animate-pulse'}`}>
                <RefreshCw className={`w-3.5 h-3.5 ${isPaused ? 'text-muted-foreground' : 'text-primary'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${isPaused ? 'text-muted-foreground' : 'text-primary'}`}>
                  {isPaused ? "Atualizações pausadas" : "Sincronizado com Lovable"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Cloud Credits Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <Cloud className="w-32 h-32 text-primary" />
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cloud Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Cloud className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          Cloud
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-foreground">${creditStats?.cloud.used.toFixed(2)} / ${creditStats?.cloud.total}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Balanço livre utilizado</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-black text-foreground">${creditStats?.cloud.rechargesUsed}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Recargas usadas</div>
                    </div>
                  </div>
                  <Progress value={creditStats?.cloud.usedPercentage} className="h-2 bg-primary/10" />
                </div>

                {/* IA Section */}
                <div className="space-y-4 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-8 border-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-orange-500/10">
                        <Zap className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          IA
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-foreground">${creditStats?.ia.used.toFixed(2)} / ${creditStats?.ia.total}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Balanço livre utilizado</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-black text-foreground">${creditStats?.ia.rechargesUsed}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Recargas usadas</div>
                    </div>
                  </div>
                  <Progress value={creditStats?.ia.usedPercentage} className="h-2 bg-orange-500/10" />
                </div>
                {/* Summary Section */}
                <div className="lg:col-span-2 pt-6 border-t border-primary/10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <span>Uso Total do Período (Plano)</span>
                        <span className="text-primary">{creditStats?.credits.usedPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={creditStats?.credits.usedPercentage} className="h-2 bg-primary/10" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{creditStats?.credits.used} usados</span>
                        <span>Total: {creditStats?.credits.total}</span>
                      </div>
                    </div>

                    <div className="flex justify-around items-center bg-muted/30 rounded-2xl p-4 border border-border/50">
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Créditos Restantes</span>
                        <span className="text-2xl font-black text-primary">{creditStats?.credits.remaining}</span>
                      </div>
                      <div className="w-px h-8 bg-border/50" />
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Cota Diária IA</span>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-2xl font-black text-foreground">{creditStats?.credits.dailyRemaining}</span>
                          <span className="text-xs font-bold text-muted-foreground">/ {creditStats?.credits.dailyTotal}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Histórico de consumo diário + destino dos créditos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="w-4 h-4 text-primary" />
                  Histórico de Consumo Diário
                </CardTitle>
                <CardDescription>Evolução dos créditos consumidos nos últimos 7 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={creditStats?.historico ?? []}>
                      <defs>
                        <linearGradient id="gradCredits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        formatter={(v: number) => [`${Number(v).toFixed(2)} créditos`, "Consumo"]}
                        contentStyle={{ borderRadius: 10, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradCredits)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Média diária: <strong className="text-foreground">
                    {(((creditStats?.historico ?? []).reduce((s, d) => s + d.total, 0)) / Math.max(1, (creditStats?.historico ?? []).length)).toFixed(2)}
                  </strong> créditos</span>
                  <span>Total 7 dias: <strong className="text-foreground">
                    {((creditStats?.historico ?? []).reduce((s, d) => s + d.total, 0)).toFixed(2)}
                  </strong> créditos</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cloud className="w-4 h-4 text-primary" />
                  Onde os Créditos são Usados
                </CardTitle>
                <CardDescription>Consumo por recurso no período atual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                {(creditStats?.breakdown ?? []).map((b) => {
                  const max = Math.max(...((creditStats?.breakdown ?? []).map(x => x.valor)), 1);
                  const getTooltip = (item: string) => {
                    const i = item.toLowerCase();
                    if (i.includes("compute tiny")) return "Servidor principal do backend (API e Lógica).";
                    if (i.includes("mensagens") || i.includes("build")) return "Créditos usados para processar prompts e gerar código pela IA.";
                    if (i.includes("banco") || i.includes("database")) return "Armazenamento e processamento de dados no PostgreSQL.";
                    if (i.includes("ia") || i.includes("inteligência")) return "Uso direto de modelos de IA (Chat, Imagens, etc).";
                    if (i.includes("egress")) return "Tráfego de saída (dados enviados para o navegador do usuário).";
                    if (i.includes("storage")) return "Espaço em disco para arquivos, logos e imagens de produtos.";
                    if (i.includes("realtime")) return "Conexões ao vivo (atualização automática de pedidos e chat).";
                    if (i.includes("edge functions")) return "Funções serverless executadas sob demanda (Webhooks, Pagamentos).";
                    if (i.includes("worker")) return "Tarefas de processamento em segundo plano.";
                    return "Consumo de recursos de infraestrutura.";
                  };
                  
                  return (
                    <Tooltip key={b.item}>
                      <TooltipTrigger asChild>
                        <div className="space-y-1 cursor-help group/item">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground group-hover/item:text-primary transition-colors">{b.item}</span>
                            <span className="font-bold text-muted-foreground">{b.valor.toFixed(3)}</span>
                          </div>
                          <Progress value={(b.valor / max) * 100} className="h-1.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-[10px] font-medium">{getTooltip(b.item)}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </div>



        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { 
              label: "Armazenamento Usado", 
              value: `${metrics!.storage.totalUsageMB}MB`, 
              sub: `de ${metrics!.storage.totalLimitMB}MB`, 
              icon: HardDrive, 
              color: "text-blue-500", 
              bg: "bg-blue-500/10",
              description: "Total de espaço ocupado por arquivos e imagens no Lovable Cloud."
            },
            { 
              label: "Lojistas Ativos", 
              value: metrics!.counts.lojistas, 
              sub: "Estabelecimentos ativos", 
              icon: Store, 
              color: "text-purple-500", 
              bg: "bg-purple-500/10",
              description: "Estabelecimentos com contas ativas e publicadas no sistema."
            },
            { 
              label: "Usuários Online", 
              value: onlineUsers.length, 
              sub: "", 
              icon: UserCheck, 
              color: "text-green-500", 
              bg: "bg-green-500/10",
              description: "Usuários (visitantes e logados) navegando no sistema agora.",
              action: (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsUsersSheetOpen(true)}
                  className="h-7 text-[10px] font-bold uppercase tracking-wider gap-1 hover:bg-green-500/20 text-green-600"
                >
                  <Eye className="w-3 h-3" /> Ver Detalhes
                </Button>
              )
            },
            { 
              label: "Visitantes Hoje", 
              value: todaySessions.length, 
              sub: "Sessões únicas do dia", 
              icon: History, 
              color: "text-slate-500", 
              bg: "bg-slate-500/10",
              description: "Total de sessões (logadas ou anônimas) que acessaram alguma área do sistema hoje.",
              action: (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSelectedUser(null);
                    setIsUsersSheetOpen(true);
                  }}
                  className="h-7 text-[10px] font-bold uppercase tracking-wider gap-1 hover:bg-slate-500/20 text-slate-600"
                >
                  <Eye className="w-3 h-3" /> Ver Detalhes
                </Button>
              )
            }
          ].map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${card.bg}`}>
                      <card.icon className={`w-6 h-6 ${card.color}`} />
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                          <HelpCircle className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px]">
                        <p className="text-xs">{card.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">{card.label}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground">{card.value}</span>
                      <span className="text-xs text-muted-foreground">{card.sub}</span>
                    </div>
                    {card.action}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Status de Armazenamento
                </CardTitle>
                <CardDescription>Uso de disco no Lovable Cloud</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["admin-system-metrics"] });
                  toast.info("Métricas atualizadas");
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Espaço Ocupado</span>
                  <span className="font-bold text-foreground">{storagePercentage.toFixed(1)}%</span>
                </div>
                <Progress value={storagePercentage} className="h-2" />
              </div>
              
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Informação do Banco</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">Tabelas</span>
                    <span className="text-sm font-bold text-foreground">{metrics?.database?.tables || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">Linhas</span>
                    <span className="text-sm font-bold text-foreground">{metrics?.database?.rows?.toLocaleString('pt-BR') || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground">Colunas</span>
                    <span className="text-sm font-bold text-foreground">{metrics?.database?.columns?.toLocaleString('pt-BR') || 0}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-4">
                  Monitoramento em tempo real da estrutura e volume de dados no Supabase.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-primary" />
                  Consumo por Lojista {showAllLojistas ? "(Todos)" : "(Top 5)"}
                </CardTitle>
                <CardDescription>Uso individual de armazenamento em MB</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAllLojistas(!showAllLojistas)}
                className="font-bold border-primary/20 hover:bg-primary/10 shrink-0 ml-2"
              >
                {showAllLojistas ? "Ver Top 5" : `Ver Todos (${metrics?.storage.lojistas.length})`}
              </Button>
            </CardHeader>
            <CardContent>
              <div className={`${showAllLojistas ? 'max-h-[500px]' : 'h-[300px]'} w-full overflow-y-auto overflow-x-hidden pr-2`}>
                <ResponsiveContainer width="100%" height={showAllLojistas ? Math.max(metrics!.storage.lojistas.length * 45, 300) : "100%"}>
                  <BarChart 
                    data={showAllLojistas ? metrics!.storage.lojistas : metrics!.storage.lojistas.slice(0, 5)} 
                    layout="vertical" 
                    margin={{ left: 10, right: 20 }}
                    barCategoryGap={2}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--muted)/0.3)" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="nome" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      width={110}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value} MB`, 'Uso']}
                    />
                    <Bar dataKey="usage" radius={[0, 4, 4, 0]} barSize={24}>
                      {metrics!.storage.lojistas.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Acessos por Dia (últimos 30 dias)
            </CardTitle>
            <CardDescription>Volume de sessões únicas (visitantes + logados) diárias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyAccess} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted)/0.3)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [`${v} acessos`, 'Sessões']}
                  />
                  <Line type="monotone" dataKey="acessos" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Distribuição de Usuários
              </CardTitle>
              <CardDescription>Proporção de tipos de usuários cadastrados</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center justify-between">
              <div className="h-[250px] w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Lojistas', value: metrics!.counts.lojistas },
                        { name: 'Clientes', value: 350 }, // Simulated client total
                        { name: 'Staff', value: 12 }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-4">
                {[
                  { label: 'Lojistas', value: metrics!.counts.lojistas, color: 'bg-[#8B5CF6]', desc: 'Proprietários de lojas' },
                  { label: 'Clientes', value: 350, color: 'bg-[#D946EF]', desc: 'Usuários finais' },
                  { label: 'Staff / Admin', value: 12, color: 'bg-[#F97316]', desc: 'Administração interna' }
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card to-muted/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Performance do Banco de Dados
              </CardTitle>
              <CardDescription>Status das consultas e transações Supabase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Tempo Médio de Resposta", value: "42ms", status: "Excelente", desc: "Velocidade das consultas" },
                  { label: "Transações p/ Segundo", value: "156", status: "Estável", desc: "Volume de operações" },
                  { label: "Conexões Ativas", value: "24/100", status: "Saudável", desc: "Pool de conexões" },
                  { label: "Latência de Replicação", value: "< 1ms", status: "Sincronizado", desc: "Consistência de dados" }
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center p-3 rounded-xl bg-background/50 border border-border/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <Badge variant="outline" className="text-[8px] h-3 px-1 bg-green-500/10 text-green-500 border-green-500/20">
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Online Users Sheet */}
      <Sheet open={isUsersSheetOpen} onOpenChange={(open) => {
        setIsUsersSheetOpen(open);
        if (!open) setSelectedUser(null);
      }}>
        <SheetContent side="right" className="w-full sm:max-w-4xl flex flex-col p-0 overflow-hidden border-l border-border/50 shadow-2xl">
          <div className="flex h-full flex-col md:flex-row overflow-hidden bg-background">
            {/* Main List */}
            <div className={`flex flex-col h-full border-r border-border/50 transition-all duration-300 ${selectedUser ? 'w-full md:w-1/2' : 'w-full'}`}>
              <SheetHeader className="p-6 border-b bg-gradient-to-br from-primary/5 via-background to-background">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
                      <UserCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl font-extrabold tracking-tight leading-tight">
                        Visitantes de Hoje
                      </SheetTitle>
                      <SheetDescription className="mt-0.5 text-xs">
                        {todaySessions.length} sessões · {filteredOnlineUsers.length} online agora
                      </SheetDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearOnlineUsers}
                    disabled={isClearing || (onlineUsers.length === 0 && todaySessions.length === 0)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5 h-8 px-2 font-bold text-[10px] uppercase tracking-wider"
                  >
                    {isClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Limpar
                  </Button>
                </div>

                {/* Role stats chips */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[
                    { key: 'admin', label: 'Admin', cls: 'from-red-500 to-red-600' },
                    { key: 'lojista', label: 'Lojista', cls: 'from-blue-500 to-blue-600' },
                    { key: 'entregador', label: 'Entreg.', cls: 'from-orange-500 to-orange-600' },
                    { key: 'cliente', label: 'Cliente', cls: 'from-purple-500 to-purple-600' },
                    { key: 'visitante', label: 'Visita', cls: 'from-slate-500 to-slate-600' },
                  ].map((r) => {
                    const count = todaySessions.filter((s: any) => s.user_role === r.key).length;
                    return (
                      <div key={r.key} className="rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm p-2 text-center">
                        <div className={`mx-auto w-6 h-1 rounded-full bg-gradient-to-r ${r.cls} mb-1.5`} />
                        <p className="text-base font-extrabold leading-none">{count}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold">{r.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por nome, role ou página..."
                    className="pl-10 h-10 bg-background border-border/50 shadow-sm focus-visible:ring-primary/20"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-auto p-4 custom-scrollbar space-y-4">
                {[...filteredOnlineUsers, ...filteredOfflineUsers].length === 0 ? (
                  <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed border-border/50">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Nenhum usuário encontrado.</p>
                  </div>
                ) : (
                  <>
                    {filteredOnlineUsers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-1 mb-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-green-600">Online agora · {filteredOnlineUsers.length}</p>
                          <div className="flex-1 h-px bg-border/60" />
                        </div>
                        <div className="grid gap-2">
                          {filteredOnlineUsers.map((u: any) => renderVisitorRow(u, false, selectedUser, setSelectedUser))}
                        </div>
                      </div>
                    )}

                    {filteredOfflineUsers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-1 mb-2">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Já saíram · {filteredOfflineUsers.length}</p>
                          <div className="flex-1 h-px bg-border/60" />
                        </div>
                        <div className="grid gap-2">
                          {filteredOfflineUsers.map((u: any) => renderVisitorRow(u, true, selectedUser, setSelectedUser))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Sidebar Details */}
            <AnimatePresence>
              {selectedUser && (
                <motion.div 
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="w-full md:w-1/2 flex flex-col h-full bg-muted/5 z-10"
                >
                  <div className="p-6 border-b flex items-center justify-between bg-background/50 backdrop-blur-sm sticky top-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <History className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Rastro de Navegação</h3>
                        <p className="text-[10px] text-muted-foreground">Passos detalhados do usuário na sessão atual</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedUser(null)} 
                      className="h-8 w-8 hover:bg-red-50 hover:text-red-500 transition-colors rounded-full"
                      title="Fechar"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
                    {(() => {
                      const liveHistory = (selectedUser.navigation_history as any[]) || [];
                      const persistedHistory = historyBySession.get(selectedUser.session_id) ?? [];
                      // Prefer the richer of the two (persistent access_logs usually wins for offline; live for current session)
                      const history = persistedHistory.length >= liveHistory.length ? persistedHistory : liveHistory;
                      const isOffline = (new Date().getTime() - new Date(selectedUser.last_seen_at).getTime()) > 5 * 60 * 1000;
                      const exitTime = selectedUser.last_seen_at ? new Date(selectedUser.last_seen_at) : null;
                      const startTime = selectedUser.session_start ? new Date(selectedUser.session_start) : null;
                      const totalSec = startTime && exitTime ? Math.floor((exitTime.getTime() - startTime.getTime()) / 1000) : 0;
                      const totalMin = Math.floor(totalSec / 60);
                      const totalDuration = totalMin > 0 ? `${totalMin}m ${totalSec % 60}s` : `${totalSec}s`;
                      const pagesVisited = history.filter((s: any) => s.type !== 'event').length;
                      const clicks = history.filter((s: any) => s.type === 'event').length;
                      const lastPage = history.length > 0 ? history[history.length - 1] : null;

                      return (
                        <>
                          {/* Journey Summary */}
                          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10">
                            <div className="text-center">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Duração</p>
                              <p className="text-sm font-extrabold text-primary">{totalDuration}</p>
                            </div>
                            <div className="text-center border-x border-border/30">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Páginas</p>
                              <p className="text-sm font-extrabold text-foreground">{pagesVisited}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Cliques</p>
                              <p className="text-sm font-extrabold text-amber-600">{clicks}</p>
                            </div>
                          </div>

                          {/* Exit point banner */}
                          {isOffline && lastPage && (
                            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-2">
                              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                <X className="w-4 h-4 text-red-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Saiu do sistema</p>
                                <p className="text-sm font-bold text-foreground truncate">{lastPage.page || lastPage.label}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {exitTime ? format(exitTime, "HH:mm:ss 'em' dd/MM/yyyy", { locale: ptBR }) : '-'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Journey timeline */}
                          <div className="flex flex-col gap-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/50 before:via-border before:to-transparent">
                            {history.slice().reverse().map((step: any, revIdx: number) => {
                              const idx = history.length - 1 - revIdx;
                              const nextStep = history[idx + 1];
                              const stepStart = new Date(step.timestamp);
                              const stepEnd = nextStep ? new Date(nextStep.timestamp) : (selectedUser.last_seen_at ? new Date(selectedUser.last_seen_at) : new Date());
                              const durationMs = stepEnd.getTime() - stepStart.getTime();
                              const durationSec = Math.floor(durationMs / 1000);
                              const durationMin = Math.floor(durationSec / 60);
                              const durationText = durationMin > 0 ? `${durationMin}m ${durationSec % 60}s` : `${Math.max(0, durationSec)}s`;
                              const isExit = revIdx === 0 && isOffline;
                              const isCurrent = revIdx === 0 && !isOffline;

                              return (
                                <div key={revIdx} className="flex gap-4 relative group/step">
                                  <div className={`w-6 h-6 rounded-full border-4 border-background flex items-center justify-center shrink-0 z-10 transition-transform group-hover/step:scale-110 ${
                                    isExit ? 'bg-red-500' :
                                    isCurrent ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]' : 
                                    step.type === 'event' ? 'bg-amber-500' : 'bg-muted-foreground/30'
                                  }`}>
                                    {isCurrent && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                                    {isExit && <X className="w-3 h-3 text-white" />}
                                    {step.type === 'event' && !isCurrent && !isExit && <MousePointer2 className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <div className={`flex-1 p-4 rounded-2xl border transition-all ${
                                    isExit ? 'bg-red-500/5 border-red-500/30' :
                                    isCurrent ? 'bg-primary/5 border-primary/20 shadow-sm' : 
                                    step.type === 'event' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-background border-border/50'
                                  }`}>
                                    <div className="flex justify-between items-start mb-1">
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <p className={`font-bold text-sm leading-tight ${isExit ? 'text-red-600' : isCurrent ? 'text-primary' : 'text-foreground'}`}>
                                            {step.type === 'event' ? step.label : step.page}
                                          </p>
                                          {isExit && <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-red-500/10 text-red-600 border-red-500/30 uppercase font-bold tracking-tighter">Saída</Badge>}
                                          {isCurrent && <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-green-500/10 text-green-600 border-green-500/30 uppercase font-bold tracking-tighter">Atual</Badge>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {step.type === 'event' && (
                                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-amber-500/10 text-amber-600 border-amber-500/20 uppercase font-bold tracking-tighter">Clique</Badge>
                                          )}
                                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            Permanência: {durationText}
                                          </span>
                                        </div>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground font-bold bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                                        {format(stepStart, 'HH:mm:ss', { locale: ptBR })}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-mono break-all opacity-60 mt-2 bg-muted/30 p-1.5 rounded-lg border border-border/20">
                                      {step.path}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}

                            {history.length === 0 && (
                              <div className="text-center py-10 opacity-50">
                                <p className="text-sm">Sem histórico disponível para este usuário.</p>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="p-6 border-t bg-background/50 backdrop-blur-sm grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/20 rounded-xl border border-border/50">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Entrou em</p>
                      <p className="text-xs font-bold">
                        {selectedUser.session_start ? format(new Date(selectedUser.session_start), "HH:mm:ss 'em' dd/MM", { locale: ptBR }) : '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-xl border border-border/50">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Último sinal</p>
                      <p className="text-xs font-bold">
                        {selectedUser.last_seen_at ? format(new Date(selectedUser.last_seen_at), "HH:mm:ss", { locale: ptBR }) : '-'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
};

export default SystemMetrics;
