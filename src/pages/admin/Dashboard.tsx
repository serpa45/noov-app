import { motion } from "framer-motion";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  ArrowUpRight,
  Clock,
  Bike,
  CheckCircle2,
  AlertCircle,
  Flame,
  Eye,
  ChefHat,
  Loader2,
  BarChart3,
  Crown,
  Zap,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Sparkles,
  Calendar,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { toast } from "sonner";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { usePdvUser } from "@/contexts/PdvUserContext";
import PendingOrdersPopup from "@/components/admin/PendingOrdersPopup";
import { fetchAllPaginated } from "@/utils/supabasePagination";

function AlertInfoBadge({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((o) => !o)}
          className="absolute top-1.5 right-1.5 p-1 rounded-full hover:bg-red-500/10 transition-colors z-10"
          aria-label="Ver detalhes do alerta"
        >
          <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-64 text-xs"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="font-bold text-sm mb-1 flex items-center gap-1 text-red-600">
          <AlertCircle className="w-4 h-4" /> Atenção
        </p>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </PopoverContent>
    </Popover>
  );
}


const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", className: "bg-red-100 text-red-800 border-red-200", icon: AlertCircle },
  preparando: { label: "Em preparo", className: "bg-blue-100 text-blue-800 border-blue-200", icon: ChefHat },
  em_entrega: { label: "Em entrega", className: "bg-orange-100 text-orange-800 border-orange-200", icon: Bike },
  entregue: { label: "Finalizado", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

const Dashboard = () => {
  const { user, profile, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { hasPermission } = usePdvUser();
  const canViewFinanceiro = hasPermission("financeiro");
  const navigate = useNavigate();
  const [showSetupPopup, setShowSetupPopup] = useState(false);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [period, setPeriod] = useState<"7" | "14" | "30" | "60" | "90">("7");
  const [chartView, setChartView] = useState<"mes" | "ano">("mes");
  const [chartType, setChartType] = useState<"barra" | "linha">("linha");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; payment_id: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixPolling, setPixPolling] = useState(false);
  const queryClient = useQueryClient();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const userName = profile?.full_name?.split(" ")[0] || "Lojista";

  // Fetch the user's store
  const { data: loja } = useQuery({
    queryKey: ["dashboard-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, logo_url, endereco_rua, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, horario_funcionamento, tolerancia_pedidos_min, valor_plano_exclusivo, plano_id_exclusivo")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Calculate business day start based on store operating hours + tolerance (synced with Orders.tsx)
  const getBusinessDayStart = useCallback(() => {
    const now = new Date();
    const horario = (loja as any)?.horario_funcionamento;
    if (!horario) {
      const t = new Date(now);
      t.setHours(0, 0, 0, 0);
      return t;
    }

    const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const toleranceMin = (loja as any)?.tolerancia_pedidos_min ?? 60;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayName = dayNames[yesterday.getDay()];
    const yesterdaySchedule = horario[yesterdayName];

    if (yesterdaySchedule?.aberto && yesterdaySchedule?.fim) {
      const [closeH, closeM] = yesterdaySchedule.fim.split(":").map(Number);
      const closingTime = new Date(yesterday);
      if (closeH < 12 && parseInt(yesterdaySchedule.inicio) >= 12) {
        closingTime.setDate(closingTime.getDate() + 1);
      }
      closingTime.setHours(closeH, closeM, 0, 0);
      const toleranceEnd = new Date(closingTime.getTime() + toleranceMin * 60000);

      if (now < toleranceEnd) {
        const [openH, openM] = yesterdaySchedule.inicio.split(":").map(Number);
        const openTime = new Date(yesterday);
        openTime.setHours(openH, openM, 0, 0);
        return openTime;
      }
    }

    const todayName = dayNames[now.getDay()];
    const todaySchedule = horario[todayName];

    if (todaySchedule?.aberto && todaySchedule?.inicio) {
      const [openH, openM] = todaySchedule.inicio.split(":").map(Number);
      const openTime = new Date(now);
      openTime.setHours(openH, openM, 0, 0);
      return openTime;
    }

    const t = new Date(now);
    t.setHours(0, 0, 0, 0);
    return t;
  }, [loja]);

  // Fetch plano ativo to check permissions
  const { data: planoAtivo } = useQuery({
    queryKey: ["dashboard-plano-ativo", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(limites, slug)")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!loja?.id,
  });

  const { isExpired, daysRemaining, trialDays } = useTrialStatus();
  const isInTrial = !isExpired && trialDays > 0 && daysRemaining > 0;

  const overrideLimites = (planoAtivo as any)?.limites_assinado || {};
  const planoLimitesBase = (planoAtivo as any)?.planos?.limites || {};
  // Merge: base do plano + overrides da loja sobrescrevem apenas chaves alteradas
  const limites = { ...planoLimitesBase, ...overrideLimites };
  const planoSlug = (planoAtivo as any)?.planos?.slug || "";
  const isProOrHigher = ["pro", "ultra"].includes(planoSlug) || isInTrial;
  const canViewDashboard = limites.dashboard !== false || isInTrial;

  // Fetch Ultra plan
  const { data: ultraPlan } = useQuery({
    queryKey: ["ultra-plan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, nome, preco, periodo, features")
        .eq("slug", "ultra")
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
  });

  // Fetch orders for this store owner
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["dashboard-pedidos", user?.id, period],
    queryFn: async () => {
      const numDays = parseInt(period);
      const since = new Date();
      since.setDate(since.getDate() - numDays);
      since.setHours(0, 0, 0, 0);
      
      return fetchAllPaginated((from, to) =>
        supabase
          .from("pedidos")
          .select("*")
          .eq("lojista_id", user!.id)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    },
    enabled: !!user && !!loja,
  });

  // Realtime subscription for live updates
  useRealtimeSubscription(
    "pedidos",
    [["dashboard-pedidos"], ["dashboard-loja"]],
    user ? `lojista_id=eq.${user.id}` : undefined
  );

  // Fetch PDV orders for this store
  const { data: pdvPedidos = [] } = useQuery({
    queryKey: ["dashboard-pdv-pedidos", loja?.id, period],
    queryFn: async () => {
      const numDays = parseInt(period);
      const since = new Date();
      since.setDate(since.getDate() - numDays);
      since.setHours(0, 0, 0, 0);

      return fetchAllPaginated((from, to) =>
        supabase
          .from("pdv_pedidos")
          .select("*")
          .eq("loja_id", loja!.id)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    },
    enabled: !!loja?.id,
  });

  // Fetch ALL pedidos of the current month (for monthly KPI cards)
  const { data: pedidosMesAll = [] } = useQuery({
    queryKey: ["dashboard-pedidos-mes", user?.id],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return fetchAllPaginated((from, to) =>
        supabase
          .from("pedidos")
          .select("id,total,taxa_entrega,status,created_at")
          .eq("lojista_id", user!.id)
          .gte("created_at", monthStart.toISOString())
          .range(from, to)
      );
    },
    enabled: !!user,
  });

  const { data: pdvPedidosMesAll = [] } = useQuery({
    queryKey: ["dashboard-pdv-pedidos-mes", loja?.id],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return fetchAllPaginated((from, to) =>
        supabase
          .from("pdv_pedidos")
          .select("id,total,status,created_at")
          .eq("loja_id", loja!.id)
          .gte("created_at", monthStart.toISOString())
          .range(from, to)
      );
    },
    enabled: !!loja?.id,
  });

  // Yearly data (for "Ano" chart filter)
  const { data: pedidosAnoAll = [] } = useQuery({
    queryKey: ["dashboard-pedidos-ano", user?.id],
    queryFn: async () => {
      const yearStart = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0);
      return fetchAllPaginated((from, to) =>
        supabase
          .from("pedidos")
          .select("id,total,status,created_at")
          .eq("lojista_id", user!.id)
          .gte("created_at", yearStart.toISOString())
          .range(from, to)
      );
    },
    enabled: !!user,
  });

  const { data: pdvPedidosAnoAll = [] } = useQuery({
    queryKey: ["dashboard-pdv-pedidos-ano", loja?.id],
    queryFn: async () => {
      const yearStart = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0);
      return fetchAllPaginated((from, to) =>
        supabase
          .from("pdv_pedidos")
          .select("id,total,status,created_at")
          .eq("loja_id", loja!.id)
          .gte("created_at", yearStart.toISOString())
          .range(from, to)
      );
    },
    enabled: !!loja?.id,
  });

  const { data: entregasMes = [] } = useQuery({
    queryKey: ["dashboard-entregas-mes", loja?.id],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const { data } = await supabase
        .from("entregas")
        .select("pedido_id,valor_entrega,created_at")
        .eq("lojista_id", loja!.id)
        .gte("created_at", monthStart.toISOString());
      return data ?? [];
    },
    enabled: !!loja?.id,
  });

  // Fetch products for top products
  const { data: produtos = [] } = useQuery({
    queryKey: ["dashboard-produtos", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, preco, categoria")
        .eq("loja_id", loja!.id)
        .eq("disponivel", true)
        .order("nome");
      return data ?? [];
    },
    enabled: !!loja?.id,
  });

  // Fetch all merchant payments for admin view
  const { data: todosPagamentos = [] } = useQuery({
    queryKey: ["admin-todos-pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_loja")
        .select(`
          *,
          lojas (nome)
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) {
        console.error("Erro ao buscar pagamentos:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: isAdmin,
  });


  // Show setup popup only if required store fields are missing

  const storeProfileIncomplete = useMemo(() => {
    if (!loja) return true;
    return !loja.logo_url || !loja.endereco_rua || !loja.endereco_bairro || !loja.endereco_cidade || !loja.endereco_estado || !loja.endereco_cep;
  }, [loja]);

  useEffect(() => {
    if (!user) return;
    if (loja === undefined) return;
    if (storeProfileIncomplete) {
      setShowSetupPopup(true);
    } else {
      setShowSetupPopup(false);
    }
  }, [user, loja, storeProfileIncomplete]);

  const dismissSetup = () => {
    setShowSetupPopup(false);
  };

  // Sales chart data – todos os dias do mês atual (inclui PDV)
  const chartData = useMemo(() => {
    const getLocalDateStr = (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-CA');
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: { dia: string; vendas: number; pedidos: number; weekday: number }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const targetDateStr = getLocalDateStr(d);

      const dayOrders = (pedidosMesAll as any[]).filter(p =>
        getLocalDateStr(p.created_at) === targetDateStr &&
        ["finalizado", "entregue"].includes(p.status)
      );
      const dayPdv = (pdvPedidosMesAll as any[]).filter(p =>
        getLocalDateStr(p.created_at) === targetDateStr &&
        ["finalizado", "fechado"].includes(p.status)
      );

      result.push({
        dia: String(day).padStart(2, "0"),
        vendas: dayOrders.reduce((sum, p) => sum + Number(p.total), 0) + dayPdv.reduce((sum, p) => sum + Number(p.total), 0),
        pedidos: dayOrders.length + dayPdv.length,
        weekday: d.getDay(),
      });
    }
    return result;
  }, [pedidosMesAll, pdvPedidosMesAll]);

  // Yearly chart data – aggregated by month for the current year
  const yearChartData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const result = months.map((label, i) => ({ dia: label, vendas: 0, pedidos: 0, weekday: 0, monthIdx: i }));
    (pedidosAnoAll as any[]).forEach(p => {
      if (!["finalizado", "entregue"].includes(p.status)) return;
      const m = new Date(p.created_at).getMonth();
      result[m].vendas += Number(p.total);
      result[m].pedidos += 1;
    });
    (pdvPedidosAnoAll as any[]).forEach(p => {
      if (!["finalizado", "fechado"].includes(p.status)) return;
      const m = new Date(p.created_at).getMonth();
      result[m].vendas += Number(p.total);
      result[m].pedidos += 1;
    });
    return result;
  }, [pedidosAnoAll, pdvPedidosAnoAll]);

  const activeChartData = chartView === "ano" ? yearChartData : chartData;

  // Ranking por dia da semana no mês (apenas dias com vendas)
  const weekdayRanking = useMemo(() => {
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const totals: Record<number, number> = {};
    chartData.forEach(d => {
      if (d.vendas > 0) {
        totals[d.weekday] = (totals[d.weekday] || 0) + d.vendas;
      }
    });
    return Object.entries(totals)
      .map(([wd, value]) => ({ label: labels[Number(wd)], value }))
      .sort((a, b) => b.value - a.value);
  }, [chartData]);

  const getFunctionHeaders = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Você precisa estar logado.");
    return { Authorization: `Bearer ${token}` };
  };

  const handleUltraCheckout = async () => {
    if (!ultraPlan) return;
    setLoadingCheckout(true);
    try {
      const headers = await getFunctionHeaders();
      const baseUrl = window.location.origin;
      const res = await supabase.functions.invoke("mercadopago-checkout", {
        headers,
        body: {
          plano_id: ultraPlan.id,
          success_url: `${baseUrl}/lojista/pagamento?status=success`,
          failure_url: `${baseUrl}/lojista/pagamento?status=failure`,
        },
      });
      if (res.error || !res.data?.init_point) {
        toast.error("Erro ao iniciar pagamento. Tente novamente.");
        return;
      }
      window.location.href = res.data.init_point;
    } catch {
      toast.error("Erro ao processar pagamento.");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleUltraPix = async () => {
    if (!ultraPlan) return;
    setLoadingPix(true);
    try {
      const headers = await getFunctionHeaders();
      const res = await supabase.functions.invoke("mercadopago-pix", {
        headers,
        body: { plano_id: ultraPlan.id },
      });
      if (res.error || !res.data?.qr_code) {
        toast.error("Erro ao gerar PIX. Tente novamente.");
        return;
      }
      setPixData({ qr_code: res.data.qr_code, qr_code_base64: res.data.qr_code_base64, payment_id: res.data.payment_id });
      setPixPolling(true);
      // Poll payment status
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts >= 60) { clearInterval(interval); setPixPolling(false); return; }
        try {
          const h = await getFunctionHeaders();
          const r = await supabase.functions.invoke("mercadopago-payment-status", { headers: h, body: { payment_id: res.data.payment_id } });
          if (r.data?.status === "approved") {
            clearInterval(interval);
            setPixPolling(false);
            setPixData(null);
            toast.success("Pagamento PIX confirmado! Plano Ultra ativado.");
            window.location.reload();
          }
        } catch { /* continue */ }
      }, 5000);
    } catch {
      toast.error("Erro ao gerar PIX.");
    } finally {
      setLoadingPix(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate real stats (delivery + PDV) using business day logic
  const businessStart = getBusinessDayStart();
  const isToday = (dateStr: string) => {
    return new Date(dateStr) >= businessStart;
  };

  const pedidosFiltradosHoje = pedidos.filter(p => isToday(p.created_at));
  
  const pedidosHoje = pedidosFiltradosHoje.filter(p => ["finalizado", "entregue"].includes(p.status));
  const pdvHoje = pdvPedidos.filter(p => isToday(p.created_at) && ["finalizado", "fechado"].includes(p.status));
  
  // Stats do Mês Atual (para os novos cards)
  const isThisMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const pedidosMes = pedidosMesAll.filter((p: any) => isThisMonth(p.created_at) && ["finalizado", "entregue"].includes(p.status));
  const pdvPedidosMes = pdvPedidosMesAll.filter((p: any) => isThisMonth(p.created_at) && ["finalizado", "fechado"].includes(p.status));

  const entregaFeeByPedido = new Map<string, number>();
  (entregasMes as any[]).forEach((e) => {
    if (e.pedido_id) entregaFeeByPedido.set(e.pedido_id, Number(e.valor_entrega || 0));
  });

  const totalFaturamentoBrutoMes = pedidosMes.reduce((sum, p: any) => sum + Number(p.total || 0), 0) + pdvPedidosMes.reduce((sum, p: any) => sum + Number(p.total || 0), 0);
  const totalTaxasMes = pedidosMes.reduce((sum, p: any) => {
    const fee = entregaFeeByPedido.get(p.id);
    return sum + Number(fee ?? p.taxa_entrega ?? 0);
  }, 0);
  const totalSubtotalMes = totalFaturamentoBrutoMes - totalTaxasMes;
  const totalPedidosMesCount = pedidosMes.length + pdvPedidosMes.length;

  const vendasHoje = pedidosHoje.reduce((sum, p) => sum + Number(p.total), 0) + pdvHoje.reduce((sum, p) => sum + Number(p.total), 0);
  const pedidosAtivos = pedidos.filter(p => ["pendente", "preparando", "em_entrega", "aceito", "aceita", "saiu_entrega"].includes(p.status)).length;
  const totalPedidos = pedidosHoje.length + pdvHoje.length;
  const vendasTotal = vendasHoje;
  const ticketMedio = totalPedidos > 0 ? vendasTotal / totalPedidos : 0;

  const pendingCount = pedidos.filter(p => isToday(p.created_at) && p.status === "pendente").length;
  const preparingCount = pedidos.filter(p => isToday(p.created_at) && ["aceito", "preparando"].includes(p.status)).length;
  const deliveringCount = pedidos.filter(p => isToday(p.created_at) && ["aceita", "saiu_entrega", "em_transito"].includes(p.status)).length;
  const doneCount = pedidosHoje.length;

  const recentOrders = pedidos.slice(0, 5);

  // Build top products from order items (delivery + PDV)
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  const processItems = (items: any[]) => {
    items.forEach((item: any) => {
      const name = item.nome || item.name || "Item";
      const qty = Number(item.quantidade || item.quantity || item.qty || 1);
      const price = Number(item.preco || item.price || 0);
      if (!productSales[name]) productSales[name] = { name, qty: 0, revenue: 0 };
      productSales[name].qty += qty;
      productSales[name].revenue += qty * price;
    });
  };
  pedidos.filter(p => ["finalizado", "entregue"].includes(p.status)).forEach(p => processItems(Array.isArray(p.items) ? p.items as any[] : []));
  pdvPedidos.filter(p => ["finalizado", "fechado"].includes(p.status)).forEach(p => processItems(Array.isArray(p.items) ? p.items as any[] : []));
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return "agora";
    if (diff < 60) return `${diff} min`;
    return `${Math.floor(diff / 60)}h`;
  };

  const pedidosPendentesAll = pedidos.filter(
    p => !["finalizado", "entregue", "cancelado"].includes(p.status)
  );
  const faturamentoPendente = pedidosPendentesAll.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const temPendenteAtrasado = pedidosPendentesAll.some(p => !isToday(p.created_at));

  const taxaEntregaTotal = pedidosHoje.reduce((sum, p) => sum + Number(p.taxa_entrega || 0), 0);

  const stats = [
    { label: "Pedidos Pendentes", value: String(pedidosPendentesAll.length), icon: AlertCircle, color: "text-amber-600", alert: temPendenteAtrasado },
    { label: "Faturamento Pendente", value: formatCurrency(faturamentoPendente), icon: Clock, color: "text-amber-600", alert: temPendenteAtrasado },
    { label: "Pedidos Concluídos", value: String(doneCount), icon: CheckCircle2, color: "text-green-600" },
    { label: "Faturamento Concluído", value: formatCurrency(vendasHoje), icon: DollarSign, color: "text-primary" },
    { label: "Taxa de Entrega", value: formatCurrency(taxaEntregaTotal), icon: Bike, color: "text-orange-500" },
  ];


  return (
    <div className="space-y-6">
      <PendingOrdersPopup />
      {(!isProOrHigher || !canViewDashboard) && (
        <Alert className="border-primary/50 bg-primary/5">
          <TrendingUp className="h-4 w-4 text-primary" />
          <AlertTitle>Página Bloqueada</AlertTitle>
          <AlertDescription className="text-sm">
            Seu plano atual não inclui acesso ao Dashboard e estatísticas avançadas. 
            <Button variant="link" size="sm" onClick={() => navigate("/lojista/plano")} className="p-0 h-auto font-bold ml-1">
              Faça upgrade agora
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {(!canViewDashboard) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold font-display">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">
            O Dashboard está bloqueado no plano Start. Realize o upgrade para visualizar suas métricas.
          </p>
          <Button onClick={() => navigate("/lojista/plano")} className="font-bold">
            Ver Planos Disponíveis
          </Button>
        </div>
      ) : (
        <>
      {/* Setup popup */}
      <Dialog open={showSetupPopup} onOpenChange={setShowSetupPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <span className="text-3xl">🏪</span>
            </div>
            <DialogTitle className="text-center text-xl font-display">
              Finalize o cadastro do seu estabelecimento
            </DialogTitle>
            <DialogDescription className="text-center">
              Complete as informações do seu perfil como logo, endereço e dados do estabelecimento para começar a receber pedidos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              className="bg-gradient-cta border-0 text-accent-foreground font-bold h-11"
              onClick={() => { dismissSetup(); navigate("/lojista/perfil"); }}
            >
              Finalizar cadastro
            </Button>
            <button
              onClick={dismissSetup}
              className="text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
            >
              Fazer isso depois
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Greeting */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div>
            <p className="text-lg font-semibold text-foreground">
              {greeting}, {userName} 👋
            </p>
            <p className="text-muted-foreground text-sm leading-tight">
              Aqui está o resumo do seu delivery. Pedidos Finalizados
            </p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-2"
        >
          <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-2 w-full sm:w-auto">
            <Card className="border-border/50 shadow-card relative">
              <div className="absolute -top-3.5 -left-1.5 text-[8px] text-muted-foreground px-1.5 py-0.5 font-bold z-10">mês</div>
              <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{totalPedidosMesCount}</p>
                  <p className="text-[10px] text-muted-foreground">Pedidos</p>
                </div>
              </CardContent>
            </Card>
            {canViewFinanceiro && (
              <>
                <Card className="border-border/50 shadow-card relative">
                  
                  <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[150px]">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{formatCurrency(totalFaturamentoBrutoMes)}</p>
                      <p className="text-[10px] text-muted-foreground">Total Bruto</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-card relative">
                  
                  <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[150px]">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <Bike className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{formatCurrency(totalTaxasMes)}</p>
                      <p className="text-[10px] text-muted-foreground">Taxa de Entrega</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-card relative">
                  
                  <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[150px]">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums text-primary">{formatCurrency(totalSubtotalMes)}</p>
                      <p className="text-[10px] text-muted-foreground">Total Líquido</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Stats Cards removed from here to be placed inside Pipeline */}

      {/* Pipeline, Recent Orders, Top Products - Pro+ only */}
      {isProOrHigher && (
        <>
          {/* Pipeline */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-border/50 shadow-card">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-display text-foreground">Pedidos em Tempo Real</CardTitle>
                  <div className="text-right">
                    <div className="text-[7px] uppercase tracking-wide text-muted-foreground leading-none">Ticket Médio</div>
                    <div className="text-lg font-bold text-foreground leading-tight">{formatCurrency(ticketMedio)}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-6">
                {/* General Stats row inside Pipeline */}
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                  {stats.map((stat, i) => (
                    <div key={stat.label} className="p-3 rounded-xl border bg-muted/30 shadow-sm relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-full h-1 ${i % 2 === 0 ? "bg-primary" : "bg-secondary"}`} />
                      {(stat as any).alert && (
                        <AlertInfoBadge
                          description={
                            stat.label === "Pedidos Pendentes"
                              ? "Existem pedidos pendentes de dias anteriores que ainda não foram finalizados. Acesse a página de Pedidos para revisá-los."
                              : "Há valores pendentes de recebimento referentes a pedidos de dias anteriores que ainda não foram concluídos."
                          }
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`hidden sm:flex w-8 h-8 rounded-lg items-center justify-center shrink-0 ${i % 2 === 0 ? "bg-primary/10" : "bg-secondary/10"}`}>
                          <stat.icon className={`w-4 h-4 ${i % 2 === 0 ? "text-primary" : "text-secondary"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold font-display text-foreground leading-tight truncate">{stat.value}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{stat.label}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "pendente", count: pendingCount, color: "bg-red-500" },
                    { key: "preparando", count: preparingCount, color: "bg-blue-500" },
                    { key: "em_entrega", count: deliveringCount, color: "bg-orange-500" },
                    { key: "entregue", count: doneCount, color: "bg-green-500" },
                  ].map((stage) => {
                    const cfg = statusConfig[stage.key];
                    const Icon = cfg.icon;
                    return (
                      <Card key={stage.key} className={`p-3 rounded-xl border ${cfg.className} shadow-sm text-center`}>
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-2xl font-bold font-display">{stage.count}</p>
                        <p className="text-[10px] font-medium">{cfg.label}</p>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Weekly Sales Chart - requires financeiro permission */}
      {canViewFinanceiro && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-border/50 shadow-card">
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base font-display flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        {chartView === "ano" ? `Vendas do Ano (${new Date().getFullYear()})` : "Vendas do Mês"}
                      </CardTitle>
                      
                      <div className="flex gap-2">
                        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
                          <button
                            type="button"
                            onClick={() => setChartView("mes")}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${chartView === "mes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            Mês
                          </button>
                          <button
                            type="button"
                            onClick={() => setChartView("ano")}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${chartView === "ano" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            Ano
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setChartType(chartType === "linha" ? "barra" : "linha")}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border bg-muted/40 text-[10px] font-bold text-primary hover:bg-primary/5 transition-all shadow-sm"
                        >
                          {chartType === "linha" ? (
                            <>
                              <BarChart3 className="w-3.5 h-3.5" />
                              Visão Barra
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-3.5 h-3.5" />
                              Visão Linha
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5 relative h-8"
                      onClick={() => navigate("/lojista/graficos-vendas")}
                    >
                      Mais Detalhes
                      <ArrowUpRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {activeChartData.every(d => d.vendas === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma venda no período selecionado.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    {chartType === "linha" ? (
                      <LineChart data={activeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(v) => `R$${v}`}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            name === "vendas" ? formatCurrency(value) : String(value),
                            name === "vendas" ? "Vendas" : "Pedidos"
                          ]}
                          labelFormatter={(label: string, payload: any[]) => {
                            if (chartView === "ano") return label;
                            const wd = payload?.[0]?.payload?.weekday;
                            const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                            return typeof wd === "number" ? `${names[wd]} · ${label}` : label;
                          }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            fontSize: 13,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="vendas"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 5, stroke: "white" }}
                          activeDot={{ r: 7 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="pedidos"
                          stroke="hsl(var(--secondary))"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: "hsl(var(--secondary))", strokeWidth: 2, r: 4, stroke: "white" }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={activeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(v) => `R$${v}`}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            name === "vendas" ? formatCurrency(value) : String(value),
                            name === "vendas" ? "Vendas" : "Pedidos"
                          ]}
                          labelFormatter={(label: string, payload: any[]) => {
                            if (chartView === "ano") return label;
                            const wd = payload?.[0]?.payload?.weekday;
                            const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                            return typeof wd === "number" ? `${names[wd]} · ${label}` : label;
                          }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            fontSize: 13,
                          }}
                        />
                        <Bar
                          dataKey="vendas"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                        <Bar
                          dataKey="pedidos"
                          fill="hsl(var(--secondary))"
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
                {chartView === "mes" && weekdayRanking.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Ranking da semana</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                      {weekdayRanking.map((w, i) => (
                        <span key={w.label} className="flex items-center gap-1.5">
                          <span className={`font-bold ${i === 0 ? "text-primary" : "text-foreground"}`}>{i + 1}º</span>
                          <span className="font-semibold">{w.label}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-semibold text-foreground">{formatCurrency(w.value)}</span>
                          {i < weekdayRanking.length - 1 && <span className="text-muted-foreground/50 ml-1">-</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
      )}

      {/* Orders + Top Products - Pro+ only */}
      {isProOrHigher && (
        <>
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Recent Orders */}
            <motion.div
              className="lg:col-span-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Pedidos Recentes
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary"
                      onClick={() => navigate("/lojista/pedidos")}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver todos
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum pedido ainda. Quando seus clientes fizerem pedidos, eles aparecerão aqui.
                    </p>
                  ) : (
                    recentOrders.map((order) => {
                      const st = statusConfig[order.status] ?? { label: order.status, className: "bg-muted text-muted-foreground", icon: Clock };
                      const orderNum = order.numero_diario ? String(order.numero_diario).padStart(3, "0") : order.id.slice(0, 4);
                      return (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold font-display text-foreground">
                                Pedido Nº {orderNum}
                              </span>
                              <Badge variant="outline" className={`text-[10px] px-2 py-0 border ${st.className}`}>
                                {st.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{formatTime(order.created_at)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {order.cliente_nome || "Cliente"} · {order.tipo}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-foreground whitespace-nowrap ml-2">
                            {formatCurrency(Number(order.total))}
                          </span>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Top Products */}
            <motion.div
              className={isAdmin ? "lg:col-span-1" : "lg:col-span-2"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="border-border/50 shadow-card h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Flame className="w-4 h-4 text-accent" />
                    Mais Vendidos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        {produtos.length > 0
                          ? "Nenhuma venda registrada ainda."
                          : "Cadastre seus produtos para começar a vender."}
                      </p>
                    </div>
                  ) : (
                    topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">#{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.qty} vendidos</p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Admin Payments Card */}
            {isAdmin && (
              <motion.div
                className="lg:col-span-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-border/50 shadow-card h-full">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      Pagamentos de Lojistas
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] h-7 px-2"
                      onClick={() => navigate("/admin/configuracoes?tab=ajustes")}
                    >
                      Ver tudo
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {todosPagamentos.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                      </div>
                    ) : (
                      todosPagamentos.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {p.lojas?.nome || "Loja s/ nome"}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-primary/5 border-primary/20 text-primary">
                                {p.plano_nome}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(p.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">
                              {formatCurrency(Number(p.valor))}
                            </p>
                            <Badge className={`text-[9px] px-1 py-0 h-4 ${p.status === "aprovado" ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"}`}>
                              {p.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </>
      )}

      {/* Upgrade popup */}
      <Dialog open={showUpgradePopup} onOpenChange={setShowUpgradePopup}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-3">
              <Crown className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl font-display">
              Desbloqueie o plano <span className="text-primary">Ultra</span>
            </DialogTitle>
            <DialogDescription className="text-center">
              Acesse relatórios completos de vendas, gráficos detalhados, ranking de melhores dias e muito mais.
            </DialogDescription>
          </DialogHeader>

          {/* Price */}
          {ultraPlan && (
            <div className="text-center py-4 border-y border-border/50 my-2">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold font-display text-foreground">
                  R$ {Number(
                    (loja?.plano_id_exclusivo === ultraPlan.id && loja?.valor_plano_exclusivo)
                      ? loja.valor_plano_exclusivo
                      : ultraPlan.preco
                  ).toFixed(2).replace(".", ",")}
                </span>
                <span className="text-sm text-muted-foreground">{ultraPlan.periodo}</span>
              </div>
            </div>
          )}

          {/* Features */}
          {Array.isArray(ultraPlan?.features) && ultraPlan.features.length > 0 && (
            <div className="grid grid-cols-2 gap-2 my-2">
              {(ultraPlan.features as any[]).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-foreground">{typeof f === "string" ? f : f.label || f.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* PIX QR Code */}
          {pixData && (
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
              {pixData.qr_code_base64 && (
                <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-40 h-40 rounded-lg" />
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixData.qr_code);
                  setPixCopied(true);
                  toast.success("Código PIX copiado!");
                  setTimeout(() => setPixCopied(false), 3000);
                }}
                className="flex items-center gap-2 text-xs text-primary hover:underline"
              >
                {pixCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {pixCopied ? "Copiado!" : "Copiar código PIX"}
              </button>
              {pixPolling && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Aguardando pagamento...
                </p>
              )}
            </div>
          )}

          {/* Buttons */}
          {!pixData && (
            <div className="flex flex-col gap-2 mt-1">
              <Button
                className="bg-gradient-cta border-0 text-accent-foreground font-bold h-12 text-base gap-2"
                onClick={handleUltraCheckout}
                disabled={loadingCheckout || !ultraPlan}
              >
                {loadingCheckout ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Assinar Ultra agora
              </Button>
              <Button
                variant="outline"
                className="h-11 gap-2 font-semibold"
                onClick={handleUltraPix}
                disabled={loadingPix || !ultraPlan}
              >
                {loadingPix ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                Pagar com PIX
              </Button>
              <div className="flex items-center justify-center gap-4 mt-1">
                <button
                  onClick={() => { setShowUpgradePopup(false); navigate("/lojista/plano"); }}
                  className="text-xs text-primary hover:underline"
                >
                  Ver todos os planos
                </button>
                <button
                  onClick={() => setShowUpgradePopup(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Agora não
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
};

export default Dashboard;
