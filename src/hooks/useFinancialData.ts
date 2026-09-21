import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, format, parseISO, setMonth, setYear } from "date-fns";
import { ptBR } from "date-fns/locale";

export type FilterPeriod = "today" | "filter" | "custom";

interface DateRange {
  from: Date;
  to: Date;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const currentYear = new Date().getFullYear();
const yearsList = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

export function useFinancialData() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<FilterPeriod>("filter");
  // -1 means "todos" — por padrão, fixa no mês atual
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customRange, setCustomRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const dateRange = useMemo((): DateRange => {
    const now = new Date();
    switch (period) {
      case "today": return { from: startOfDay(now), to: endOfDay(now) };
      case "custom": return customRange;
      case "filter": {
        const allMonths = selectedMonth === -1;
        const allYears = selectedYear === -1;
        if (allMonths && allYears) {
          // todos os meses + todos os anos => todo o histórico
          return { from: new Date(2000, 0, 1), to: endOfDay(now) };
        }
        if (allMonths) {
          const base = setYear(now, selectedYear);
          return { from: startOfYear(base), to: endOfYear(base) };
        }
        if (allYears) {
          // mês específico em todos os anos => intervalo amplo desde 2000 (raro)
          return { from: new Date(2000, 0, 1), to: endOfDay(now) };
        }
        const base = setYear(setMonth(now, selectedMonth), selectedYear);
        return { from: startOfMonth(base), to: endOfMonth(base) };
      }
    }
  }, [period, selectedMonth, selectedYear, customRange]);

  // Fetch loja
  const { data: loja } = useQuery({
    queryKey: ["minha-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch pedidos do app (receitas)
  const { data: pedidosApp = [], isLoading: loadingPedidos } = useQuery({
    queryKey: ["financial-pedidos", loja?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", user!.id)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch pedidos do PDV
  const { data: pedidosPdv = [], isLoading: loadingPdv } = useQuery({
    queryKey: ["financial-pdv-pedidos", loja?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_pedidos")
        .select("*")
        .eq("loja_id", loja!.id)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!loja,
  });

  // Unificar pedidos app + PDV num formato comum
  const pedidos = useMemo(() => {
    const fromApp = pedidosApp.map(p => ({
      id: p.id,
      cliente_nome: p.cliente_nome,
      tipo: p.tipo || "delivery",
      status: p.status,
      total: p.total,
      created_at: p.created_at,
      items: Array.isArray(p.items) ? p.items : [],
      origem: "app" as const,
    }));
    const fromPdv = pedidosPdv.map(p => ({
      id: p.id,
      cliente_nome: "PDV - Mesa",
      tipo: "mesa" as string,
      status: p.status === "fechado" ? "entregue" : p.status === "cancelado" ? "cancelado" : "aberto",
      total: p.total,
      created_at: p.created_at,
      items: Array.isArray(p.items) ? p.items : [],
      origem: "pdv" as const,
    }));
    return [...fromApp, ...fromPdv].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [pedidosApp, pedidosPdv]);

  // Fetch despesas
  const { data: despesas = [], isLoading: loadingDespesas, refetch: refetchDespesas } = useQuery({
    queryKey: ["financial-despesas", loja?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("despesas")
        .select("*")
        .eq("loja_id", loja!.id)
        .gte("data", format(dateRange.from, "yyyy-MM-dd"))
        .lte("data", format(dateRange.to, "yyyy-MM-dd"))
        .order("data", { ascending: false });
      return data || [];
    },
    enabled: !!loja,
  });

  // Fetch entregas (motoboy)
  const { data: entregas = [] } = useQuery({
    queryKey: ["financial-entregas", loja?.id, dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas")
        .select("*")
        .eq("lojista_id", loja!.id)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());
      return data || [];
    },
    enabled: !!loja,
  });

  // Fetch entregadores da loja
  const { data: entregadores = [] } = useQuery({
    queryKey: ["financial-entregadores", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_entregadores")
        .select("entregador_id")
        .eq("loja_id", loja!.id);
      if (!data?.length) return [];
      const ids = data.map(e => e.entregador_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", ids);
      return profiles || [];
    },
    enabled: !!loja,
  });

  // Calculações
  const receitaTotal = pedidos
    .filter(p => p.status === "finalizado" || p.status === "entregue")
    .reduce((sum, p) => sum + Number(p.total), 0);

  const despesaTotal = despesas.reduce((sum, d) => sum + Number(d.valor), 0);
  const lucroLiquido = receitaTotal - despesaTotal;
  const margemLucro = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0;
  const totalPedidos = pedidos.filter(p => p.status === "finalizado" || p.status === "entregue").length;

  // Formas de pagamento - extrair dos items dos pedidos
  const pagamentoPorForma = useMemo(() => {
    const formas: Record<string, number> = {};
    pedidos.filter(p => p.status === "finalizado" || p.status === "entregue").forEach(p => {
      const forma = "Não informado";
      formas[forma] = (formas[forma] || 0) + Number(p.total);
    });
    return Object.entries(formas).map(([nome, valor]) => ({
      nome,
      valor,
      percentual: receitaTotal > 0 ? (valor / receitaTotal) * 100 : 0,
    }));
  }, [pedidos, receitaTotal]);

  // Despesas por categoria
  const despesasPorCategoria = useMemo(() => {
    const cats: Record<string, number> = {};
    despesas.forEach(d => {
      cats[d.categoria] = (cats[d.categoria] || 0) + Number(d.valor);
    });
    return Object.entries(cats)
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: despesaTotal > 0 ? (valor / despesaTotal) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [despesas, despesaTotal]);

  // Dados para gráfico de evolução (diária OU mensal quando "todos os meses")
  const groupByMonth = period === "filter" && selectedMonth === -1;
  const evolucaoDiaria = useMemo(() => {
    const buckets: Record<string, { receita: number; despesa: number; sortKey: string }> = {};
    const keyFor = (iso: string) => {
      const d = parseISO(iso);
      if (groupByMonth) {
        const label = format(d, "MMM/yy", { locale: ptBR });
        const sortKey = format(d, "yyyy-MM");
        return { label, sortKey };
      }
      const label = format(d, "dd/MM");
      const sortKey = format(d, "yyyy-MM-dd");
      return { label, sortKey };
    };
    pedidos.filter(p => p.status === "finalizado" || p.status === "entregue").forEach(p => {
      const { label, sortKey } = keyFor(p.created_at);
      if (!buckets[label]) buckets[label] = { receita: 0, despesa: 0, sortKey };
      buckets[label].receita += Number(p.total);
    });
    despesas.forEach(d => {
      const { label, sortKey } = keyFor(d.data);
      if (!buckets[label]) buckets[label] = { receita: 0, despesa: 0, sortKey };
      buckets[label].despesa += Number(d.valor);
    });
    return Object.entries(buckets)
      .sort(([, a], [, b]) => a.sortKey.localeCompare(b.sortKey))
      .map(([dia, vals]) => ({
        dia,
        receita: vals.receita,
        despesa: vals.despesa,
        lucro: vals.receita - vals.despesa,
      }));
  }, [pedidos, despesas, groupByMonth]);


  // Produtos mais vendidos
  const produtosMaisVendidos = useMemo(() => {
    const prods: Record<string, { nome: string; qtd: number; total: number }> = {};
    pedidos.filter(p => p.status === "finalizado" || p.status === "entregue").forEach(p => {
      const items = Array.isArray(p.items) ? p.items : [];
      items.forEach((item: any) => {
        const nome = item.nome || item.name || "Sem nome";
        if (!prods[nome]) prods[nome] = { nome, qtd: 0, total: 0 };
        prods[nome].qtd += Number(item.quantidade || item.qty || 1);
        prods[nome].total += Number(item.total || item.preco || 0) * Number(item.quantidade || item.qty || 1);
      });
    });
    return Object.values(prods).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [pedidos]);

  // Motoboy ranking
  const motoboyRanking = useMemo(() => {
    const ranking: Record<string, { id: string; nome: string; entregas: number; valorTotal: number }> = {};
    entregas.forEach(e => {
      if (!ranking[e.entregador_id]) {
        const perfil = entregadores.find(p => p.user_id === e.entregador_id);
        ranking[e.entregador_id] = {
          id: e.entregador_id,
          nome: perfil?.full_name || "Entregador",
          entregas: 0,
          valorTotal: 0,
        };
      }
      ranking[e.entregador_id].entregas++;
      ranking[e.entregador_id].valorTotal += Number(e.valor_entrega);
    });
    return Object.values(ranking).sort((a, b) => b.entregas - a.entregas);
  }, [entregas, entregadores]);

  return {
    period, setPeriod,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    monthNames,
    yearsList,
    customRange, setCustomRange,
    dateRange,
    loja,
    pedidos, despesas, entregas,
    loading: loadingPedidos || loadingDespesas || loadingPdv,
    receitaTotal, despesaTotal, lucroLiquido, margemLucro, totalPedidos,
    pagamentoPorForma, despesasPorCategoria,
    evolucaoDiaria, produtosMaisVendidos, motoboyRanking,
    refetchDespesas,
  };
}
