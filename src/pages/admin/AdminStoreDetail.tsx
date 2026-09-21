import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Store, Loader2, ArrowLeft, MapPin, Calendar, Link2, Package,
  ShoppingCart, Truck, DollarSign, Crown, TrendingUp, Clock, History, CreditCard, Trash2, Pencil, UserCheck, Sparkles,
  Users, Eye, EyeOff, Shield, BriefcaseBusiness, UserRound, Key,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { EditLojistaSheet } from "@/components/admin/stores/EditLojistaSheet";
import { EditPlanLimitsDialog } from "@/components/admin/stores/EditPlanLimitsDialog";

const AdminStoreDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [extraDays, setExtraDays] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planExpireDate, setPlanExpireDate] = useState("");
  const [exclusivePrice, setExclusivePrice] = useState("");
  const [timeFilter, setTimeFilter] = useState<"today" | "month" | "year" | "all">("month");
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [userToDelete, setUserToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isEditLimitsOpen, setIsEditLimitsOpen] = useState(false);

  const { data: loja, isLoading: loadingLoja } = useQuery({
    queryKey: ["admin-loja-detail", id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  useMemo(() => {
    if (selectedPlanId && selectedPlanId === loja?.plano_id_exclusivo) {
      setExclusivePrice(loja.valor_plano_exclusivo?.toString() || "");
    } else {
      setExclusivePrice("");
    }
  }, [selectedPlanId, loja?.plano_id_exclusivo, loja?.valor_plano_exclusivo]);

  const { data: produtos = [] } = useQuery({
    queryKey: ["admin-loja-produtos", id],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("id").eq("loja_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["admin-loja-pedidos", loja?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", loja!.user_id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!loja?.user_id,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["admin-loja-entregas", loja?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas")
        .select("id, status, valor_entrega, created_at")
        .eq("lojista_id", id!);
      return data ?? [];
    },
    enabled: !!loja?.user_id,
  });

  const { data: lojaPlano } = useQuery({
    queryKey: ["admin-loja-plano", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos(nome, slug, preco, periodo, limites)")
        .eq("loja_id", id!)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: ultimoPagamento } = useQuery({
    queryKey: ["admin-loja-ultimo-pagamento", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_loja")
        .select("metodo, status, valor, plano_nome, created_at")
        .eq("loja_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: historicoPagamentos = [] } = useQuery({
    queryKey: ["admin-loja-pagamentos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_loja")
        .select("id, valor, metodo, status, plano_nome, created_at")
        .eq("loja_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["admin-all-planos"],
    queryFn: async () => {
      const { data } = await supabase.from("planos").select("*").eq("ativo", true).order("ordem");
      return data ?? [];
    },
  });

  const { data: trialConfig } = useQuery({
    queryKey: ["config-global", "dias_teste_gratis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "dias_teste_gratis")
        .maybeSingle();
      return data;
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["admin-loja-historico", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_plano_historico")
        .select("*")
        .eq("loja_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: lojistaProfile } = useQuery({
    queryKey: ["admin-loja-profile", loja?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, codigo_acesso, senha_painel")
        .eq("user_id", loja!.user_id)
        .single();
      return data;
    },
    enabled: !!loja?.user_id,
  });

  const { data: afiliado } = useQuery({
    queryKey: ["admin-loja-afiliado", loja?.afiliado_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, codigo_afiliado")
        .eq("user_id", loja!.afiliado_id!)
        .single();
      return data;
    },
    enabled: !!loja?.afiliado_id,
  });

  const { data: masterCode } = useQuery({
    queryKey: ["config-global", "master_code_lojista"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "master_code_lojista")
        .maybeSingle();
      return (data?.valor as string) ?? "";
    },
  });

  const { data: planLimites } = useQuery({
    queryKey: ["admin-loja-plan-limites", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("limites_assinado, planos:plano_id(limites)")
        .eq("loja_id", id!)
        .eq("ativo", true)
        .maybeSingle();
      const override = (data as any)?.limites_assinado;
      const base = (data as any)?.planos?.limites;
      const merged = (override && Object.keys(override).length > 0) ? override : base;
      return (merged ?? {}) as Record<string, any>;
    },
    enabled: !!id,
  });

  const { data: usageMetrics } = useQuery({
    queryKey: ["admin-loja-usage", id, loja?.user_id],
    queryFn: async () => {
      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setHours(0, 0, 0, 0);
      const [clientesRes, produtosRes, pedidosRes] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("loja_id", id!),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("loja_id", id!),
        supabase.from("pedidos").select("id", { count: "exact", head: true })
          .eq("lojista_id", loja!.user_id)
          .gte("created_at", startMonth.toISOString()),
      ]);
      return {
        clientes: clientesRes.count ?? 0,
        produtos: produtosRes.count ?? 0,
        pedidos: pedidosRes.count ?? 0,
      };
    },
    enabled: !!id && !!loja?.user_id,
  });

  const extendTrial = useMutation({
    mutationFn: async (days: number) => {
      const currentExtra = (loja as any)?.dias_teste_extra ?? 0;
      const { error } = await supabase.from("lojas").update({ dias_teste_extra: currentExtra + days }).eq("id", id!);
      if (error) throw error;
      await supabase.from("loja_plano_historico").insert({
        loja_id: id!,
        acao: "teste_estendido",
        dias_extras: days,
        observacao: `+${days} dias de teste (total extra: ${currentExtra + days})`,
        admin_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-historico", id] });
      setExtraDays("");
      toast.success("Dias de teste adicionados com sucesso");
    },
    onError: () => toast.error("Erro ao estender teste"),
  });

  const resetTrialExtra = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lojas").update({ dias_teste_extra: 0 }).eq("id", id!);
      if (error) throw error;
      await supabase.from("loja_plano_historico").insert({
        loja_id: id!,
        acao: "teste_estendido",
        dias_extras: 0,
        observacao: `Dias extras zerados (era ${(loja as any)?.dias_teste_extra ?? 0})`,
        admin_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-historico", id] });
      toast.success("Dias extras zerados");
    },
    onError: () => toast.error("Erro ao zerar dias extras"),
  });

  const updateExclusivePrice = useMutation({
    mutationFn: async ({ planId, price }: { planId: string, price: string }) => {
      const p = price === "" ? null : parseFloat(price);
      
      const { error } = await supabase
        .from("lojas")
        .update({ 
          valor_plano_exclusivo: p,
          plano_id_exclusivo: planId
        })
        .eq("id", id!);
      
      if (error) throw error;

      const plan = planos.find((p: any) => p.id === planId);
      await supabase.from("loja_plano_historico").insert({
        loja_id: id!,
        acao: "plano_atribuido",
        plano_id: planId,
        plano_nome: plan?.nome || "Plano",
        observacao: `Valor exclusivo de R$ ${p?.toFixed(2)} definido para o plano ${plan?.nome || ""}`,
        admin_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-historico", id] });
      toast.success("Valor exclusivo atualizado. O lojista verá este preço ao tentar assinar.");
    },
    onError: () => toast.error("Erro ao atualizar valor exclusivo"),
  });

  const assignPlan = useMutation({
    mutationFn: async ({ planId, exclusivePrice }: { planId: string, exclusivePrice: string }) => {
      const plan = planos.find((p: any) => p.id === planId);
      if (!plan) throw new Error("Plano não encontrado");

      const price = exclusivePrice === "" ? null : parseFloat(exclusivePrice);

      const { error: updateLojaError } = await supabase
        .from("lojas")
        .update({ 
          valor_plano_exclusivo: price,
          plano_id_exclusivo: planId,
          dias_teste_extra: 0 
        })
        .eq("id", id!);
      
      if (updateLojaError) throw updateLojaError;

      const expiraEmDate = planExpireDate 
        ? new Date(planExpireDate) 
        : new Date(new Date().setMonth(new Date().getMonth() + 1));

      const { error } = await supabase.from("loja_planos").upsert({
        loja_id: id!,
        plano_id: planId,
        preco_assinado: price ?? (plan as any).preco,
        features_assinado: (plan as any).features,
        limites_assinado: (plan as any).limites,
        ativo: true,
        assinado_em: new Date().toISOString(),
        expira_em: expiraEmDate.toISOString(),
      }, { onConflict: "loja_id" });

      if (error) throw error;

      await supabase.from("loja_plano_historico").insert({
        loja_id: id!,
        acao: "plano_atribuido",
        plano_id: planId,
        plano_nome: (plan as any).nome,
        observacao: `Plano ${(plan as any).nome} atribuído manualmente${price ? ` com valor exclusivo de R$ ${price.toFixed(2)}` : ""}`,
        admin_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-plano", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-historico", id] });
      setSelectedPlanId("");
      setPlanExpireDate("");
      setExclusivePrice("");
      toast.success("Plano atribuído com acesso imediato");
    },
    onError: () => toast.error("Erro ao atribuir plano"),
  });

  const removePlan = useMutation({
    mutationFn: async () => {
      if (!lojaPlano) return;
      const { error } = await supabase.from("loja_planos").update({ ativo: false }).eq("id", (lojaPlano as any).id);
      if (error) throw error;

      // Remove exclusive price when removing plan
      const { error: updateLojaError } = await supabase
        .from("lojas")
        .update({ 
          valor_plano_exclusivo: null,
          plano_id_exclusivo: null,
        })
        .eq("id", id!);
      
      if (updateLojaError) throw updateLojaError;
      await supabase.from("loja_plano_historico").insert({
        loja_id: id!,
        acao: "plano_removido",
        plano_nome: (lojaPlano as any)?.planos?.nome,
        observacao: `Plano removido manualmente`,
        admin_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-plano", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-historico", id] });
      setExclusivePrice("");
      setSelectedPlanId("");
      toast.success("Plano removido");
    },
    onError: () => toast.error("Erro ao remover plano"),
  });

  const removeExclusivePrice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lojas")
        .update({ 
          valor_plano_exclusivo: null,
          plano_id_exclusivo: null,
        })
        .eq("id", id!);
      
      if (error) throw error;

      await supabase.from("loja_plano_historico").insert({
        loja_id: id!,
        acao: "plano_atribuido",
        observacao: "Valor exclusivo removido pelo administrador. O lojista voltará ao preço padrão.",
        admin_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-historico", id] });
      setExclusivePrice("");
      toast.success("Valor exclusivo removido com sucesso");
    },
    onError: () => toast.error("Erro ao remover valor exclusivo"),
  });

  const deleteHistorico = useMutation({
    mutationFn: async (historicoId: string) => {
      const { error } = await supabase.from("loja_plano_historico").delete().eq("id", historicoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-historico", id] });
      toast.success("Registro excluído");
    },
    onError: () => toast.error("Erro ao excluir registro"),
  });

  // Loja Usuarios (PIN users created by lojista)
  const { data: lojaUsuarios = [] } = useQuery({
    queryKey: ["admin-loja-usuarios", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_usuarios")
        .select("id, nome, pin, nivel, ativo, created_at")
        .eq("loja_id", id!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const deleteLojaUsuario = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase.from("loja_usuarios").delete().eq("id", usuarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-usuarios", id] });
      toast.success("Usuário excluído");
      setUserToDelete(null);
    },
    onError: () => toast.error("Erro ao excluir usuário"),
  });


  const filteredPedidos = useMemo(() => {
    if (timeFilter === "all") return pedidos;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return pedidos.filter((p: any) => {
      const date = new Date(p.created_at).getTime();
      if (timeFilter === "today") return date >= startOfToday;
      if (timeFilter === "month") return date >= startOfMonth;
      if (timeFilter === "year") return date >= startOfYear;
      return true;
    });
  }, [pedidos, timeFilter]);

  const filteredEntregas = useMemo(() => {
    if (timeFilter === "all") return entregas;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return entregas.filter((e: any) => {
      const date = new Date(e.created_at).getTime();
      if (timeFilter === "today") return date >= startOfToday;
      if (timeFilter === "month") return date >= startOfMonth;
      if (timeFilter === "year") return date >= startOfYear;
      return true;
    });
  }, [entregas, timeFilter]);

  const stats = useMemo(() => {
    const totalPedidos = filteredPedidos.length;
    const faturamento = filteredPedidos.reduce((s: number, p: any) => s + Number(p.total), 0);
    const totalEntregas = filteredEntregas.length;
    const totalProdutos = produtos.length;
    return { totalPedidos, faturamento, totalEntregas, totalProdutos };
  }, [filteredPedidos, filteredEntregas, produtos]);

  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {};
    filteredPedidos.forEach((p: any) => {
      const day = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      byDay[day] = (byDay[day] || 0) + Number(p.total);
    });
    return Object.entries(byDay).map(([dia, valor]) => ({ dia, valor }));
  }, [filteredPedidos]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPedidos.forEach((p: any) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, total]) => ({ status, total }));
  }, [filteredPedidos]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (loadingLoja) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loja) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Loja não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/lojas")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  const isAtivo = loja.ativo !== false;
  const planoNome = (lojaPlano as any)?.planos?.nome || "Sem plano";
  const globalTrialDays = trialConfig?.valor ? parseInt(trialConfig.valor) : 0;
  const storeExtraDays = (loja as any)?.dias_teste_extra ?? 0;
  const totalTrialDays = globalTrialDays + storeExtraDays;

  const createdAt = new Date(loja.created_at);
  const trialEnd = new Date(createdAt.getTime() + totalTrialDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const trialExpired = now > trialEnd && !lojaPlano;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/lojas")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold font-display">Detalhes da Loja</h1>
        </div>
        <div className="flex items-center gap-2">
          {lojaPlano && (
            <Button variant="outline" size="sm" onClick={() => setIsEditLimitsOpen(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Editar Plano
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/lojas/${id}/pedidos`)}>
            <ShoppingCart className="w-4 h-4 mr-1" /> Ver Pedidos
          </Button>
        </div>
      </div>

      {/* Store Info Card */}
      <Card className="border-border/50 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            {loja.logo_url ? (
              <img src={loja.logo_url} alt={loja.nome} className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-lg font-bold font-display text-foreground">{loja.nome}</p>
              <p className="text-sm text-muted-foreground">/{loja.slug}</p>
              {lojistaProfile?.email && (
                <p className="text-xs text-muted-foreground">✉️ {lojistaProfile.email}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={isAtivo ? "text-green-700 border-green-200" : "text-red-700 border-red-200"}>
                {isAtivo ? "Ativa" : "Inativa"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditSheetOpen(true)}
              >
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (!confirm(`AVISO: Esta ação excluirá DEFINITIVAMENTE a loja "${loja.nome}", todos os produtos, pedidos, clientes, histórico financeiro, entregadores e a conta do lojista. Deseja continuar?`)) return;
                  
                  const loadingToast = toast.loading("Excluindo lojista e todos os dados...");
                  
                  try {
                    const { error } = await supabase.functions.invoke("delete-loja", {
                      body: { lojaId: id },
                    });

                    if (error) throw error;
                    
                    toast.success("Lojista e todos os dados foram excluídos com sucesso", { id: loadingToast });
                    navigate("/admin/lojas");
                  } catch (err: any) {
                    console.error("Erro ao excluir loja:", err);
                    toast.error(`Erro ao excluir loja: ${err.message || "Tente novamente"}`, { id: loadingToast });
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 pt-3 border-t border-border/50">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Segmento</p>
              <p className="text-sm font-medium text-foreground">{loja.segmento}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Cadastro</p>
              <p className="text-sm font-medium text-foreground">{formatDate(loja.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Código Convite</p>
              <p className="text-sm font-mono font-bold text-foreground">{loja.codigo_convite}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> Plano</p>
              <p className="text-sm font-bold text-foreground">{planoNome}</p>
              {lojaPlano && (
                <>
                  <p className="text-[10px] text-muted-foreground">
                    {formatCurrency(Number((lojaPlano as any).preco_assinado))}{(lojaPlano as any)?.planos?.periodo || "/mês"} · desde {formatDate((lojaPlano as any).assinado_em)}
                  </p>
                </>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Desde</p>
              <p className="text-sm text-foreground">{formatDate(loja.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Pagamento</p>
              {ultimoPagamento ? (
                <>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {ultimoPagamento.metodo === "mercadopago" ? "Cartão (MP)" : ultimoPagamento.metodo === "pix" ? "PIX" : ultimoPagamento.metodo}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatCurrency(Number(ultimoPagamento.valor))} · {ultimoPagamento.status === "aprovado" ? "✅ Aprovado" : ultimoPagamento.status} · {formatDate(ultimoPagamento.created_at)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum pagamento</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Afiliado</p>
              {afiliado ? (
                <>
                  <p className="text-sm font-medium text-foreground">{afiliado.full_name || "Sem nome"}</p>
                  <p className="text-[10px] text-muted-foreground">{afiliado.email} • Cód: {afiliado.codigo_afiliado}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem afiliado</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Key className="w-3.5 h-3.5" /> Senha master
              </p>
              {masterCode ? (
                <p
                  className="text-sm font-mono font-medium text-foreground cursor-pointer hover:text-primary"
                  title="Clique para copiar"
                  onClick={() => {
                    navigator.clipboard.writeText(masterCode);
                    toast.success("Senha master copiada");
                  }}
                >
                  {masterCode}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Não definida</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Use com o e-mail do lojista para acessar o painel.
              </p>
            </div>
          </div>

          {(loja.endereco_rua || loja.endereco_cidade) && (
            <div className="flex items-start gap-2 pt-3 border-t border-border/50">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                {[loja.endereco_rua, loja.endereco_numero, loja.endereco_bairro, loja.endereco_cidade, loja.endereco_estado].filter(Boolean).join(", ")}
                {loja.endereco_cep ? ` - ${loja.endereco_cep}` : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Limits Metrics */}
      <div>
        <h2 className="text-sm font-bold font-display text-muted-foreground uppercase tracking-wider mb-2">
          Limites do plano
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            const maxClientes = Number(planLimites?.max_clientes ?? 100);
            const maxProdutos = Number(planLimites?.max_produtos ?? 30);
            const maxArmaz = Number(planLimites?.max_armazenamento_mb ?? 512);
            const maxPedidos = Number(planLimites?.max_pedidos_mes ?? -1);
            const items = [
              { label: "Clientes", icon: Users, used: usageMetrics?.clientes ?? 0, limit: maxClientes, suffix: "" },
              { label: "Produtos", icon: Package, used: usageMetrics?.produtos ?? 0, limit: maxProdutos, suffix: "" },
              { label: "Armazenamento", icon: Sparkles, used: 0, limit: maxArmaz, suffix: " MB", hideUsed: true },
              { label: "Pedidos (mês)", icon: ShoppingCart, used: usageMetrics?.pedidos ?? 0, limit: maxPedidos, suffix: "" },
            ];
            return items.map((it) => {
              const Icon = it.icon;
              const unlimited = it.limit === -1;
              const pct = unlimited || it.limit === 0 ? 0 : Math.min(100, Math.round((it.used / it.limit) * 100));
              const danger = pct >= 90;
              const warn = pct >= 70 && pct < 90;
              return (
                <Card key={it.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" /> {it.label}
                      </p>
                      {unlimited && <Badge variant="secondary" className="text-[10px]">Ilimitado</Badge>}
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {it.hideUsed ? "—" : it.used.toLocaleString("pt-BR")}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}/ {unlimited ? "∞" : it.limit.toLocaleString("pt-BR")}{it.suffix}
                      </span>
                    </p>
                    {!unlimited && !it.hideUsed && (
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full transition-all ${danger ? "bg-destructive" : warn ? "bg-orange-500" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>
      </div>

      {/* Filter and Stats Cards */}
      <div className="flex items-center justify-between mb-2">

        <h2 className="text-sm font-bold font-display text-muted-foreground uppercase tracking-wider">Desempenho</h2>
        <div className="flex bg-muted p-1 rounded-lg gap-1">
          {[
            { id: "today", label: "Hoje" },
            { id: "month", label: "Mês" },
            { id: "year", label: "Ano" },
            { id: "all", label: "Tudo" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id as any)}
              className={`text-[10px] px-3 py-1 rounded-md transition-all font-medium ${
                timeFilter === f.id
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Faturamento", value: formatCurrency(stats.faturamento), icon: DollarSign, color: "text-primary" },
          { label: "Total Pedidos", value: String(stats.totalPedidos), icon: ShoppingCart, color: "text-secondary" },
          { label: "Produtos", value: String(stats.totalProdutos), icon: Package, color: "text-primary" },
          { label: "Entregas", value: String(stats.totalEntregas), icon: Truck, color: "text-secondary" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold font-display text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Faturamento Diário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), "Faturamento"]}
                  />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados de pedidos</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-secondary" /> Pedidos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados de pedidos</p>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Admin Controls: Trial & Plan Management */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Trial Extension */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Clock className="w-4 h-4 text-secondary" /> Teste Grátis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dias globais:</span>
              <span className="font-medium text-foreground">{globalTrialDays} dias</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dias extras (esta loja):</span>
              <span className="font-bold text-secondary">{storeExtraDays} dias</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-foreground">{totalTrialDays} dias</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              {lojaPlano ? (
                <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Plano ativo</Badge>
              ) : trialExpired ? (
                <Badge variant="destructive" className="text-[10px]">Expirado</Badge>
              ) : (
                <Badge className="bg-secondary/10 text-secondary border-0 text-[10px]">
                  {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Input
                type="number"
                placeholder="Dias extras"
                min={1}
                value={extraDays}
                onChange={(e) => setExtraDays(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => {
                  const days = parseInt(extraDays);
                  if (!days || days <= 0) return toast.error("Informe um número válido");
                  extendTrial.mutate(days);
                }}
                disabled={extendTrial.isPending}
              >
                {extendTrial.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
              </Button>
            </div>
            {storeExtraDays > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  if (confirm("Zerar os dias extras de teste?")) resetTrialExtra.mutate();
                }}
                disabled={resetTrialExtra.isPending}
              >
                {resetTrialExtra.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Zerar Dias Extras"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Plan Management */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Gerenciar Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plano atual:</span>
              <span className="font-bold text-foreground">{planoNome}</span>
            </div>
            {lojaPlano && (lojaPlano as any).expira_em && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expira em:</span>
                <span className="font-medium text-foreground">{formatDate((lojaPlano as any).expira_em)}</span>
              </div>
            )}
            {loja?.valor_plano_exclusivo && (
              <div className="pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Preço editado:
                  </span>
                  <span className="font-bold text-primary">{formatCurrency(Number(loja.valor_plano_exclusivo))}</span>
                </div>
                <p className="text-[10px] text-primary/80 mb-2 leading-tight">
                  Este valor será mantido permanentemente para o plano {planos.find(p => p.id === loja.plano_id_exclusivo)?.nome || "selecionado"} até ser removido.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-[10px] gap-1.5 border-primary/20 hover:bg-primary/5 text-primary"
                  onClick={() => {
                    if (confirm("Deseja remover o valor exclusivo e voltar ao preço padrão do plano?")) {
                      removeExclusivePrice.mutate();
                    }
                  }}
                  disabled={removeExclusivePrice.isPending}
                >
                  {removeExclusivePrice.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3" /> Excluir Oferta e Voltar ao Padrão
                    </>
                  )}
                </Button>
              </div>
            )}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="pt-2 border-t border-border/50">
                <label className="text-xs font-semibold text-foreground mb-2 block">Mudar Plano</label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar novo plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — {formatCurrency(p.preco)}{p.periodo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPlanId && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-primary" /> Valor Exclusivo para este plano (Opcional)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={`Valor padrão: ${formatCurrency(planos.find(p => p.id === selectedPlanId)?.preco || 0)}`}
                    value={exclusivePrice}
                    onChange={(e) => setExclusivePrice(e.target.value)}
                    className="flex-1"
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Se definido, este valor será cobrado no próximo pagamento para este plano específico.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de expiração (padrão: 1 mês)</label>
                <Input
                  type="date"
                  value={planExpireDate}
                  onChange={(e) => setPlanExpireDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (!selectedPlanId) return toast.error("Selecione um plano");
                    updateExclusivePrice.mutate({ planId: selectedPlanId, price: exclusivePrice });
                  }}
                  disabled={updateExclusivePrice.isPending}
                >
                  {updateExclusivePrice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Definir Valor (Oferta)"}
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (!selectedPlanId) return toast.error("Selecione um plano");
                    assignPlan.mutate({ planId: selectedPlanId, exclusivePrice });
                  }}
                  disabled={assignPlan.isPending}
                >
                  {assignPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atribuir Plano (Liberar)"}
                </Button>
              </div>
            </div>
            {lojaPlano && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  if (confirm("Remover plano atual?")) removePlan.mutate();
                }}
                disabled={removePlan.isPending}
              >
                Remover Plano Atual
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usuários do Sistema criados pelo lojista */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Usuários do Sistema
            <Badge variant="outline" className="ml-2 text-[10px]">
              {lojaUsuarios.length} {lojaUsuarios.length === 1 ? "usuário" : "usuários"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Usuários PIN criados pelo lojista para acessar o painel. Visualize a senha caso o lojista esqueça.
          </p>
        </CardHeader>
        <CardContent>
          {lojaUsuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum usuário do sistema cadastrado por este lojista.
            </p>
          ) : (
            <div className="space-y-2">
              {lojaUsuarios.map((u: any) => {
                const NivelIcon = u.nivel === "admin" ? Shield : u.nivel === "gerente" ? BriefcaseBusiness : UserRound;
                const nivelColor = u.nivel === "admin" ? "text-red-700 bg-red-50 border-red-200"
                  : u.nivel === "gerente" ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-blue-700 bg-blue-50 border-blue-200";
                const visible = !!showPin[u.id];
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${nivelColor}`}>
                        <NivelIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                          {u.nivel}{!u.ativo && " · inativo"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/60 border border-border">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Senha</span>
                      <code className="text-sm font-mono font-bold text-foreground tracking-widest">
                        {visible ? u.pin : "••••"}
                      </code>
                      <button
                        type="button"
                        onClick={() => setShowPin(s => ({ ...s, [u.id]: !s[u.id] }))}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={visible ? "Ocultar" : "Mostrar"}
                      >
                        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUserToDelete({ id: u.id, nome: u.nome })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário do sistema</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.nome}</strong>? Esta ação não pode ser desfeita e o usuário perderá o acesso ao painel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteLojaUsuario.mutate(userToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Histórico de Faturas e Cobranças */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Histórico de Faturas e Cobranças
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Pagamentos realizados pela loja para assinatura do plano.
          </p>
        </CardHeader>
        <CardContent>
          {historicoPagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum pagamento registrado para esta loja.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {historicoPagamentos.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.plano_nome || "Plano"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      R$ {Number(item.valor).toFixed(2)}
                    </p>
                    <Badge className={`text-[10px] ${item.status === "aprovado" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"}`}>
                      {item.status === "aprovado" ? "Pago" : item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {historico.length > 0 && (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" /> Histórico de Alterações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historico.map((h: any) => (
                <div key={h.id} className="flex items-center gap-3 text-sm py-2 border-b border-border/30 last:border-0">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${
                    h.acao === "teste_estendido" ? "text-secondary border-secondary/30" :
                    h.acao === "plano_atribuido" ? "text-primary border-primary/30" :
                    "text-destructive border-destructive/30"
                  }`}>
                    {h.acao === "teste_estendido" ? "Teste" :
                     h.acao === "plano_atribuido" ? "Plano" : "Removido"}
                  </Badge>
                  <span className="text-foreground flex-1">{h.observacao}</span>
                  <span className="text-muted-foreground text-xs shrink-0">{formatDateTime(h.created_at)}</span>
                  <button
                    onClick={() => {
                      if (confirm("Excluir este registro?")) deleteHistorico.mutate(h.id);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <EditLojistaSheet
        open={isEditSheetOpen}
        onOpenChange={setIsEditSheetOpen}
        loja={loja}
        profile={lojistaProfile}
      />
      {lojaPlano && (
        <EditPlanLimitsDialog
          open={isEditLimitsOpen}
          onOpenChange={setIsEditLimitsOpen}
          lojaPlanoId={(lojaPlano as any).id}
          lojaId={id!}
          planoId={(lojaPlano as any).plano_id}
          initialLimites={(lojaPlano as any).limites_assinado}
          planoLimites={(lojaPlano as any)?.planos?.limites}
          initialPreco={
            (loja as any)?.valor_plano_exclusivo != null
              ? Number((loja as any).valor_plano_exclusivo)
              : (lojaPlano as any)?.preco_assinado != null
                ? Number((lojaPlano as any).preco_assinado)
                : null
          }
          planoPrecoPadrao={(lojaPlano as any)?.planos?.preco}
          planoNome={(lojaPlano as any)?.planos?.nome}
        />
      )}
    </div>
  );
};

export default AdminStoreDetail;
