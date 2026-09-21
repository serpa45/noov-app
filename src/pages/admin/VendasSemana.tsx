import React, { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Loader2, ArrowLeft, BarChart3, DollarSign, ShoppingCart, TrendingUp, Calendar, ArrowUp, ArrowDown, Users, Printer } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList,
} from "recharts";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const useCountUp = (target: number, duration = 1200) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();
  const fromRef = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    const to = Number.isFinite(target) ? target : 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      setValue(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
};

const CircularStat = ({ label, rawValue, prevValue, delta, color, isCurrency, prevLabel, currLabel, detail, subtitle }: { label: string; rawValue: number; prevValue: number; delta: number; color: string; isCurrency?: boolean; prevLabel?: string; currLabel?: string; detail?: React.ReactNode; subtitle?: string }) => {
  const absPct = Math.min(100, Math.abs(delta));
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const positive = delta >= 0;
  const stroke = positive ? color : "#ef4444";

  const animatedPct = useCountUp(absPct);
  const animatedDelta = useCountUp(delta);
  const animatedCurr = useCountUp(rawValue);
  const animatedPrev = useCountUp(prevValue);
  const diff = rawValue - prevValue;
  const animatedDiff = useCountUp(diff);
  const dash = (animatedPct / 100) * circ;

  const fmt = (v: number) => isCurrency
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : Math.round(v).toLocaleString("pt-BR");
  const diffPositive = diff >= 0;

  // Semicircle (half-moon) gauge geometry
  const semiCirc = Math.PI * radius; // half circumference
  const semiDash = (animatedPct / 100) * semiCirc;
  const gradId = React.useId();

  return (
    <Card className="border-border/50 shadow-card animate-fade-in">
      <CardContent className="p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
        <div className="relative w-32 h-20 mx-auto">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 56">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.65" />
                <stop offset="100%" stopColor={stroke} stopOpacity="1" />
              </linearGradient>
              <filter id={`${gradId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* track */}
            <path
              d={`M 8 50 A ${radius} ${radius} 0 0 1 92 50`}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* progress */}
            <path
              d={`M 8 50 A ${radius} ${radius} 0 0 1 92 50`}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${semiDash} ${semiCirc}`}
              filter={`url(#${gradId}-glow)`}
              style={{ transition: "stroke-dasharray 0.6s ease-out" }}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-0">
            <span className={`text-lg font-bold font-display tabular-nums leading-none ${positive ? "text-foreground" : "text-red-500"}`}>
              {positive ? "+" : ""}{animatedDelta.toFixed(0)}%
            </span>
            <span className="text-[9px] text-muted-foreground mt-0.5">vs mês ant.</span>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          {subtitle && (
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center pb-1">{subtitle}</p>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">{prevLabel ?? "Total Anterior"}</span>
            <span className="font-semibold text-foreground tabular-nums">{fmt(animatedPrev)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">{currLabel ?? "Total Mês Atual"}</span>
            <span className="font-semibold text-foreground tabular-nums">{fmt(animatedCurr)}</span>
          </div>
          <div className="flex justify-between gap-2 pt-1 border-t border-border/50">
            <span className="text-muted-foreground font-medium">{diffPositive ? "Superávit" : "Déficit"}</span>
            <span className={`font-bold tabular-nums inline-flex items-center gap-1 ${diffPositive ? "text-green-600" : "text-red-500"}`}>
              <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
                {diffPositive
                  ? <polygon points="5,1 9,9 1,9" fill="currentColor" />
                  : <polygon points="1,1 9,1 5,9" fill="currentColor" />}
              </svg>
              {fmt(Math.abs(animatedDiff))}
            </span>
          </div>
        </div>
        {detail && (
          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground leading-relaxed space-y-0.5">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide text-center pb-1">
              Mês Anterior vs Mês Atual
            </p>
            {detail}
          </div>
        )}
      </CardContent>
    </Card>
  );
};


const VendasSemana = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"7" | "14" | "month" | "year" | "all">("7");
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [monthFilter, setMonthFilter] = useState<string>(new Date().getMonth().toString());

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];


  const { data: yearsAvailable = [] } = useQuery({
    queryKey: ["vendas-years", user?.id],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const [oldestPedido, oldestPdv] = await Promise.all([
        supabase.from("pedidos").select("created_at").eq("lojista_id", user!.id).in("status", ["finalizado", "entregue"]).order("created_at", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("pdv_pedidos").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      ]);
      const dates = [oldestPedido.data?.created_at, oldestPdv.data?.created_at].filter(Boolean) as string[];
      if (!dates.length) return [currentYear.toString()];
      const minYear = Math.min(...dates.map(d => new Date(d).getFullYear()));
      const list: string[] = [];
      for (let y = currentYear; y >= minYear; y--) list.push(y.toString());
      return list;
    },
    enabled: !!user,
  });
  const years = yearsAvailable.length ? yearsAvailable : [new Date().getFullYear().toString()];


  const { data: loja } = useQuery({
    queryKey: ["vendas-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["vendas-pedidos", user?.id, period, yearFilter, monthFilter],
    queryFn: async () => {
      const since = new Date();
      if (period === "all") {
        since.setFullYear(2000, 0, 1);
        since.setHours(0, 0, 0, 0);
      } else if (period === "year") {
        since.setFullYear(parseInt(yearFilter), 0, 1);
        since.setHours(0, 0, 0, 0);
      } else if (period === "month") {
        since.setFullYear(parseInt(yearFilter), parseInt(monthFilter), 1);
        since.setHours(0, 0, 0, 0);
      } else {
        since.setDate(since.getDate() - 90);
      }
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", user!.id)
        .in("status", ["finalizado", "entregue"])
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });


  const { data: pdvPedidos = [] } = useQuery({
    queryKey: ["vendas-pdv", loja?.id, period, yearFilter, monthFilter],
    queryFn: async () => {
      const since = new Date();
      if (period === "all") {
        since.setFullYear(2000, 0, 1);
        since.setHours(0, 0, 0, 0);
      } else if (period === "year") {
        since.setFullYear(parseInt(yearFilter), 0, 1);
        since.setHours(0, 0, 0, 0);
      } else if (period === "month") {
        since.setFullYear(parseInt(yearFilter), parseInt(monthFilter), 1);
        since.setHours(0, 0, 0, 0);
      } else {
        since.setDate(since.getDate() - 90);
      }
      const { data } = await supabase
        .from("pdv_pedidos")
        .select("*")
        .eq("loja_id", loja!.id)
        .in("status", ["finalizado", "fechado"])
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!loja?.id,
    placeholderData: keepPreviousData,
  });

  // Comparison: full current month vs full previous month + daily series
  const { data: monthCompare } = useQuery({
    queryKey: ["vendas-month-compare", user?.id, loja?.id, period, yearFilter, monthFilter],
    queryFn: async () => {
      const now = new Date();
      const baseYear = period === "month" ? parseInt(yearFilter) : now.getFullYear();
      const baseMonth = period === "month" ? parseInt(monthFilter) : now.getMonth();

      const isCurrentMonth = baseYear === now.getFullYear() && baseMonth === now.getMonth();
      const daysInCurr = new Date(baseYear, baseMonth + 1, 0).getDate();
      const daysInPrev = new Date(baseYear, baseMonth, 0).getDate();
      const cutoffDay = isCurrentMonth ? now.getDate() : daysInCurr;

      const startCurr = new Date(baseYear, baseMonth, 1).toISOString();
      const endCurr = new Date(baseYear, baseMonth + 1, 1).toISOString();
      const startPrev = new Date(baseYear, baseMonth - 1, 1).toISOString();
      const endPrev = startCurr;
      // Para comparação justa: se o mês atual está em andamento, limita o mês anterior
      // ao mesmo dia de corte (ex.: até dia 8). Caso contrário, usa o mês anterior inteiro.
      const prevCutoffDay = Math.min(cutoffDay, daysInPrev);
      const endPrevCompare = isCurrentMonth
        ? new Date(baseYear, baseMonth - 1, prevCutoffDay, 23, 59, 59, 999).toISOString()
        : endPrev;

      const [pedCurr, pedPrev, pdvCurr, pdvPrev, pedPrevFull, pdvPrevFull] = await Promise.all([
        supabase.from("pedidos").select("total,status,tipo,taxa_entrega,created_at").eq("lojista_id", user!.id).in("status", ["finalizado", "entregue"]).gte("created_at", startCurr).lt("created_at", endCurr),
        supabase.from("pedidos").select("total,status,tipo,taxa_entrega,created_at").eq("lojista_id", user!.id).in("status", ["finalizado", "entregue"]).gte("created_at", startPrev).lte("created_at", endPrevCompare),
        loja?.id ? supabase.from("pdv_pedidos").select("total,created_at").eq("loja_id", loja.id).in("status", ["finalizado", "fechado"]).gte("created_at", startCurr).lt("created_at", endCurr) : Promise.resolve({ data: [] as any[] }),
        loja?.id ? supabase.from("pdv_pedidos").select("total,created_at").eq("loja_id", loja.id).in("status", ["finalizado", "fechado"]).gte("created_at", startPrev).lte("created_at", endPrevCompare) : Promise.resolve({ data: [] as any[] }),
        supabase.from("pedidos").select("total,tipo,taxa_entrega,created_at").eq("lojista_id", user!.id).in("status", ["finalizado", "entregue"]).gte("created_at", startPrev).lt("created_at", endPrev),
        loja?.id ? supabase.from("pdv_pedidos").select("total,created_at").eq("loja_id", loja.id).in("status", ["finalizado", "fechado"]).gte("created_at", startPrev).lt("created_at", endPrev) : Promise.resolve({ data: [] as any[] }),
      ]);

      const sum = (arr: any[] | null | undefined) => (arr ?? []).reduce((s, p) => s + Number(p.total || 0), 0);
      const count = (arr: any[] | null | undefined) => (arr ?? []).length;
      const entregas = (arr: any[] | null | undefined) => (arr ?? []).filter(p => p.tipo === "delivery");
      const sumTaxa = (arr: any[] | null | undefined) => (arr ?? []).reduce((s, p) => s + Number(p.taxa_entrega || 0), 0);

      const curr = {
        receita: sum(pedCurr.data) + sum(pdvCurr.data),
        pedidos: count(pedCurr.data) + count(pdvCurr.data),
        qtdEntregas: count(entregas(pedCurr.data)),
        valorEntregas: sumTaxa(entregas(pedCurr.data)),
      };
      const prev = {
        receita: sum(pedPrev.data) + sum(pdvPrev.data),
        pedidos: count(pedPrev.data) + count(pdvPrev.data),
        qtdEntregas: count(entregas(pedPrev.data)),
        valorEntregas: sumTaxa(entregas(pedPrev.data)),
      };
      const prevFull = {
        receita: sum(pedPrevFull.data) + sum(pdvPrevFull.data),
        pedidos: count(pedPrevFull.data) + count(pdvPrevFull.data),
        qtdEntregas: count(entregas(pedPrevFull.data)),
        valorEntregas: sumTaxa(entregas(pedPrevFull.data)),
      };
      const pct = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;

      // Série diária: por dia do mês, soma receita e conta pedidos
      const buildDaily = (peds: any[], pdvs: any[]) => {
        const map: Record<number, { receita: number; pedidos: number }> = {};
        [...peds, ...pdvs].forEach(p => {
          const d = new Date(p.created_at).getDate();
          if (!map[d]) map[d] = { receita: 0, pedidos: 0 };
          map[d].receita += Number(p.total || 0);
          map[d].pedidos += 1;
        });
        return map;
      };
      const dailyCurr = buildDaily(pedCurr.data ?? [], pdvCurr.data ?? []);
      const dailyPrev = buildDaily(pedPrevFull.data ?? [], pdvPrevFull.data ?? []);

      const maxDays = Math.max(daysInCurr, daysInPrev);
      let accCurr = 0, accPrev = 0;
      const dailySeries: { dia: number; diaLabel: string; atual: number | null; anterior: number | null; atualAcum: number | null; anteriorAcum: number }[] = [];
      const wdShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      for (let d = 1; d <= maxDays; d++) {
        const atualDia = dailyCurr[d]?.receita ?? 0;
        const anteriorDia = dailyPrev[d]?.receita ?? 0;

        // dias futuros do mês corrente ficam null (não desenha)
        const isFuture = isCurrentMonth && d > cutoffDay;
        const atualExists = d <= daysInCurr && !isFuture;
        if (atualExists) accCurr += atualDia;
        if (d <= daysInPrev) accPrev += anteriorDia;

        // dia da semana baseado no mês atual (referência); se não existir no mês, usa o anterior
        const refDate = d <= daysInCurr
          ? new Date(baseYear, baseMonth, d)
          : new Date(baseYear, baseMonth - 1, d);
        const diaLabel = `${d}/${wdShort[refDate.getDay()]}`;

        dailySeries.push({
          dia: d,
          diaLabel,
          atual: atualExists ? atualDia : null,
          anterior: d <= daysInPrev ? anteriorDia : null,
          atualAcum: atualExists ? accCurr : null,
          anteriorAcum: accPrev,
        });
      }


      return {
        cutoffDay,
        daysInCurr,
        daysInPrev,
        isCurrentMonth,
        receita: { curr: curr.receita, prev: prev.receita, prevFull: prevFull.receita, delta: pct(curr.receita, prev.receita) },
        pedidos: { curr: curr.pedidos, prev: prev.pedidos, prevFull: prevFull.pedidos, delta: pct(curr.pedidos, prev.pedidos) },
        qtdEntregas: { curr: curr.qtdEntregas, prev: prev.qtdEntregas, prevFull: prevFull.qtdEntregas, delta: pct(curr.qtdEntregas, prev.qtdEntregas) },
        valorEntregas: { curr: curr.valorEntregas, prev: prev.valorEntregas, prevFull: prevFull.valorEntregas, delta: pct(curr.valorEntregas, prev.valorEntregas) },
        dailySeries,
      };
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });





  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrintMonthlyReport = async () => {
    if (!user) return;
    setIsPrinting(true);
    try {
      const year = parseInt(yearFilter);
      const month = parseInt(monthFilter);

      // Mês selecionado e anterior (ajusta ano quando janeiro)
      const currStart = new Date(year, month, 1);
      const currEnd = new Date(year, month + 1, 1);
      const prevStart = new Date(year, month - 1, 1);
      const prevEnd = currStart;

      const daysInCurr = new Date(year, month + 1, 0).getDate();
      const daysInPrev = new Date(year, month, 0).getDate();

      const fetchRange = async (from: Date, to: Date) => {
        const [{ data: peds }, pdvRes] = await Promise.all([
          supabase.from("pedidos")
            .select("total,tipo,taxa_entrega,created_at,status")
            .eq("lojista_id", user.id)
            .in("status", ["finalizado", "entregue"])
            .gte("created_at", from.toISOString())
            .lt("created_at", to.toISOString()),
          loja?.id
            ? supabase.from("pdv_pedidos")
                .select("total,created_at,status")
                .eq("loja_id", loja.id)
                .in("status", ["finalizado", "fechado"])
                .gte("created_at", from.toISOString())
                .lt("created_at", to.toISOString())
            : Promise.resolve({ data: [] as any[] }),
        ]);
        return { peds: peds ?? [], pdvs: (pdvRes as any).data ?? [] };
      };

      const [curr, prev] = await Promise.all([
        fetchRange(currStart, currEnd),
        fetchRange(prevStart, prevEnd),
      ]);

      const agg = (peds: any[], pdvs: any[]) => {
        const receita = peds.reduce((s, p) => s + Number(p.total || 0), 0)
          + pdvs.reduce((s, p) => s + Number(p.total || 0), 0);
        const pedidos = peds.length + pdvs.length;
        const entregasArr = peds.filter(p => p.tipo === "delivery");
        return {
          receita,
          pedidos,
          entregas: entregasArr.length,
          valorEntregas: entregasArr.reduce((s, p) => s + Number(p.taxa_entrega || 0), 0),
          ticket: pedidos ? receita / pedidos : 0,
        };
      };

      const currAgg = agg(curr.peds, curr.pdvs);
      const prevAgg = agg(prev.peds, prev.pdvs);

      const pct = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
      const deltaHtml = (c: number, p: number) => {
        const d = pct(c, p);
        const color = p === 0 && c === 0 ? "#6b7280" : d >= 0 ? "#16a34a" : "#dc2626";
        const arrow = p === 0 && c === 0 ? "—" : d >= 0 ? "▲" : "▼";
        return `<span style="color:${color};font-weight:600">${arrow} ${d >= 0 ? "+" : ""}${d.toFixed(1)}%</span>`;
      };

      // Séries diárias
      const dailyMap = (peds: any[], pdvs: any[]) => {
        const map: Record<number, { receita: number; pedidos: number }> = {};
        [...peds, ...pdvs].forEach(p => {
          const d = new Date(p.created_at).getDate();
          if (!map[d]) map[d] = { receita: 0, pedidos: 0 };
          map[d].receita += Number(p.total || 0);
          map[d].pedidos += 1;
        });
        return map;
      };
      const dailyCurr = dailyMap(curr.peds, curr.pdvs);
      const dailyPrev = dailyMap(prev.peds, prev.pdvs);
      const maxDays = Math.max(daysInCurr, daysInPrev);

      const fmt = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

      const wdShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const dailyRows = Array.from({ length: maxDays }, (_, i) => {
        const day = i + 1;
        const c = dailyCurr[day];
        const p = dailyPrev[day];
        const cRec = c?.receita ?? 0;
        const pRec = p?.receita ?? 0;
        const diff = cRec - pRec;
        const diffColor = diff === 0 ? "#6b7280" : diff > 0 ? "#16a34a" : "#dc2626";
        const wdCurr = day <= daysInCurr ? wdShort[new Date(year, month, day).getDay()] : "";
        return `
          <tr>
            <td>${day}${wdCurr ? ` <span style="color:#94a3b8">(${wdCurr})</span>` : ""}</td>
            <td style="text-align:right">${p ? fmt(pRec) : "—"}</td>
            <td style="text-align:right">${p?.pedidos ?? "—"}</td>
            <td style="text-align:right">${c ? fmt(cRec) : (day > daysInCurr ? "—" : fmt(0))}</td>
            <td style="text-align:right">${c?.pedidos ?? (day > daysInCurr ? "—" : 0)}</td>
            <td style="text-align:right;color:${diffColor};font-weight:600">${diff === 0 ? "—" : (diff > 0 ? "+" : "") + fmt(diff)}</td>
          </tr>`;
      }).join("");

      const currLabel = `${monthNames[month]} ${year}`;
      const prevMonthIdx = month === 0 ? 11 : month - 1;
      const prevYearVal = month === 0 ? year - 1 : year;
      const prevLabel = `${monthNames[prevMonthIdx]} ${prevYearVal}`;

      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Relatório Comparativo — ${currLabel} vs ${prevLabel}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;padding:24px;margin:0;background:#fff}
  .header{border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
  .header h1{font-size:22px;margin:0;color:#0f172a}
  .header .brand{font-size:11px;color:#2563eb;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
  .sub{color:#64748b;font-size:12px}
  .section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#334155;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}
  .card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc}
  .card .l{font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:.05em;font-weight:600}
  .card .v{font-size:16px;font-weight:700;margin-top:4px;color:#0f172a}
  .card .p{font-size:11px;color:#64748b;margin-top:2px}
  .card .d{font-size:11px;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:left}
  th{background:#f1f5f9;font-size:10px;text-transform:uppercase;color:#475569;font-weight:700}
  tfoot td{font-weight:700;background:#f8fafc;border-top:2px solid #cbd5e1}
  .compare-table th:nth-child(2),.compare-table th:nth-child(3){background:#eff6ff}
  .compare-table th:nth-child(4),.compare-table th:nth-child(5){background:#f0fdf4}
  .foot{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:10mm}.no-print{display:none};.cards{page-break-inside:avoid}}
</style></head><body>
  <div class="header">
    <div>
      <div class="brand">NOOV — Relatório de Vendas</div>
      <h1>Comparativo Mensal</h1>
      <div class="sub">${currLabel} <strong>vs</strong> ${prevLabel}</div>
    </div>
    <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
  </div>

  <div class="section-title">Resumo Executivo</div>
  <div class="cards">
    <div class="card">
      <div class="l">Receita</div>
      <div class="v">${fmt(currAgg.receita)}</div>
      <div class="p">Anterior: ${fmt(prevAgg.receita)}</div>
      <div class="d">${deltaHtml(currAgg.receita, prevAgg.receita)}</div>
    </div>
    <div class="card">
      <div class="l">Pedidos</div>
      <div class="v">${currAgg.pedidos}</div>
      <div class="p">Anterior: ${prevAgg.pedidos}</div>
      <div class="d">${deltaHtml(currAgg.pedidos, prevAgg.pedidos)}</div>
    </div>
    <div class="card">
      <div class="l">Ticket Médio</div>
      <div class="v">${fmt(currAgg.ticket)}</div>
      <div class="p">Anterior: ${fmt(prevAgg.ticket)}</div>
      <div class="d">${deltaHtml(currAgg.ticket, prevAgg.ticket)}</div>
    </div>
    <div class="card">
      <div class="l">Entregas</div>
      <div class="v">${currAgg.entregas}</div>
      <div class="p">Anterior: ${prevAgg.entregas}</div>
      <div class="d">${deltaHtml(currAgg.entregas, prevAgg.entregas)}</div>
    </div>
  </div>

  <div class="section-title">Comparativo Consolidado</div>
  <table class="compare-table">
    <thead><tr>
      <th>Indicador</th>
      <th style="text-align:right">${prevLabel}</th>
      <th style="text-align:right">${currLabel}</th>
      <th style="text-align:right">Diferença</th>
      <th style="text-align:right">Variação %</th>
    </tr></thead>
    <tbody>
      <tr><td>Receita Total</td><td style="text-align:right">${fmt(prevAgg.receita)}</td><td style="text-align:right">${fmt(currAgg.receita)}</td><td style="text-align:right">${fmt(currAgg.receita - prevAgg.receita)}</td><td style="text-align:right">${deltaHtml(currAgg.receita, prevAgg.receita)}</td></tr>
      <tr><td>Pedidos</td><td style="text-align:right">${prevAgg.pedidos}</td><td style="text-align:right">${currAgg.pedidos}</td><td style="text-align:right">${currAgg.pedidos - prevAgg.pedidos}</td><td style="text-align:right">${deltaHtml(currAgg.pedidos, prevAgg.pedidos)}</td></tr>
      <tr><td>Ticket Médio</td><td style="text-align:right">${fmt(prevAgg.ticket)}</td><td style="text-align:right">${fmt(currAgg.ticket)}</td><td style="text-align:right">${fmt(currAgg.ticket - prevAgg.ticket)}</td><td style="text-align:right">${deltaHtml(currAgg.ticket, prevAgg.ticket)}</td></tr>
      <tr><td>Qtd. Entregas</td><td style="text-align:right">${prevAgg.entregas}</td><td style="text-align:right">${currAgg.entregas}</td><td style="text-align:right">${currAgg.entregas - prevAgg.entregas}</td><td style="text-align:right">${deltaHtml(currAgg.entregas, prevAgg.entregas)}</td></tr>
      <tr><td>Taxa de Entrega (Receita)</td><td style="text-align:right">${fmt(prevAgg.valorEntregas)}</td><td style="text-align:right">${fmt(currAgg.valorEntregas)}</td><td style="text-align:right">${fmt(currAgg.valorEntregas - prevAgg.valorEntregas)}</td><td style="text-align:right">${deltaHtml(currAgg.valorEntregas, prevAgg.valorEntregas)}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Detalhamento Diário</div>
  <table>
    <thead><tr>
      <th>Dia</th>
      <th style="text-align:right">Receita ${prevLabel}</th>
      <th style="text-align:right">Pedidos ${prevLabel}</th>
      <th style="text-align:right">Receita ${currLabel}</th>
      <th style="text-align:right">Pedidos ${currLabel}</th>
      <th style="text-align:right">Diferença (R$)</th>
    </tr></thead>
    <tbody>${dailyRows}</tbody>
    <tfoot><tr>
      <td>Total</td>
      <td style="text-align:right">${fmt(prevAgg.receita)}</td>
      <td style="text-align:right">${prevAgg.pedidos}</td>
      <td style="text-align:right">${fmt(currAgg.receita)}</td>
      <td style="text-align:right">${currAgg.pedidos}</td>
      <td style="text-align:right">${fmt(currAgg.receita - prevAgg.receita)}</td>
    </tr></tfoot>
  </table>

  <div class="foot">NOOV — Relatório comparativo entre ${currLabel} e ${prevLabel}</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`;

      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) { toast.error("Bloqueador de pop-up impediu a impressão"); return; }
      w.document.open(); w.document.write(html); w.document.close();
    } catch (e: any) {
      toast.error("Erro ao gerar relatório: " + (e?.message || ""));
    } finally {
      setIsPrinting(false);
    }
  };


  const daysInSelectedMonth = useMemo(() => new Date(parseInt(yearFilter), parseInt(monthFilter) + 1, 0).getDate(), [yearFilter, monthFilter]);
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const numDays = period === "year" ? 365 : period === "all" ? 3650 : period === "month" ? daysInSelectedMonth : parseInt(period);



  const chartData = useMemo(() => {
    const getLocalDateStr = (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-CA');
    };

    if (period === "all") {
      const monthsShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const buckets: Record<string, { dia: string; sortKey: string; vendas: number; pedidos: number }> = {};
      const add = (arr: any[]) => arr.forEach(p => {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
        if (!buckets[key]) buckets[key] = {
          dia: `${monthsShort[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
          sortKey: key,
          vendas: 0,
          pedidos: 0,
        };
        buckets[key].vendas += Number(p.total || 0);
        buckets[key].pedidos += 1;
      });
      add(pedidos);
      add(pdvPedidos);
      return Object.values(buckets).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ dia, vendas, pedidos }) => ({ dia, vendas, pedidos }));
    }

    if (period === "year") {
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return months.map((month, index) => {
        const monthOrders = pedidos.filter(p => {
          const d = new Date(p.created_at);
          return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === index;
        });
        const monthPdv = pdvPedidos.filter(p => {
          const d = new Date(p.created_at);
          return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === index;
        });

        return {
          dia: month,
          vendas: monthOrders.reduce((s, p) => s + Number(p.total), 0) + monthPdv.reduce((s, p) => s + Number(p.total), 0),
          pedidos: monthOrders.length + monthPdv.length,
        };
      });
    }

    if (period === "month") {
      const y = parseInt(yearFilter);
      const m = parseInt(monthFilter);
      const result: { dia: string; data?: string; vendas: number; pedidos: number }[] = [];
      for (let day = 1; day <= daysInSelectedMonth; day++) {
        const d = new Date(y, m, day);
        const targetDateStr = getLocalDateStr(d);
        const dayOrders = pedidos.filter(p => getLocalDateStr(p.created_at) === targetDateStr);
        const dayPdv = pdvPedidos.filter(p => getLocalDateStr(p.created_at) === targetDateStr);
        result.push({
          dia: String(day).padStart(2, "0"),
          data: targetDateStr,
          vendas: dayOrders.reduce((s, p) => s + Number(p.total), 0) + dayPdv.reduce((s, p) => s + Number(p.total), 0),
          pedidos: dayOrders.length + dayPdv.length,
        });
      }
      return result;
    }


    const result: { dia: string; data?: string; vendas: number; pedidos: number }[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const targetDateStr = getLocalDateStr(d);
      
      const isToday = d.toDateString() === new Date().toDateString();
      const dayLabel = isToday ? "Hoje" : (numDays <= 7
        ? days[d.getDay()]
        : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
      
      const dayOrders = pedidos.filter(p => getLocalDateStr(p.created_at) === targetDateStr);
      const dayPdv = pdvPedidos.filter(p => getLocalDateStr(p.created_at) === targetDateStr);
      
      result.push({
        dia: dayLabel,
        data: targetDateStr,
        vendas: dayOrders.reduce((s, p) => s + Number(p.total), 0) + dayPdv.reduce((s, p) => s + Number(p.total), 0),
        pedidos: dayOrders.length + dayPdv.length,
      });
    }
    return result;
  }, [pedidos, pdvPedidos, numDays, period, yearFilter]);

  const { totalVendas, totalPedidos, ticketMedio, melhorDia, todayData } = useMemo(() => {
    const totalVendas = chartData.reduce((s, d) => s + d.vendas, 0);
    const totalPedidos = chartData.reduce((s, d) => s + d.pedidos, 0);
    const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
    const melhorDia = chartData.reduce((best, d) => d.vendas > best.vendas ? d : best, chartData[0]);
    
    const getLocalDateStr = (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-CA');
    };
    const today = getLocalDateStr(new Date());
    const todayOrders = pedidos.filter(p => getLocalDateStr(p.created_at) === today);
    const todayPdv = pdvPedidos.filter(p => getLocalDateStr(p.created_at) === today);
    const todayData = {
      vendas: todayOrders.reduce((s, p) => s + Number(p.total), 0) + todayPdv.reduce((s, p) => s + Number(p.total), 0),
      pedidos: todayOrders.length + todayPdv.length
    };

    return { totalVendas, totalPedidos, ticketMedio, melhorDia, todayData };
  }, [chartData, pedidos, pdvPedidos, period, yearFilter]);

  // Top products
  const topProducts = useMemo(() => {
    const sales: Record<string, { name: string; qty: number; revenue: number }> = {};
    const processItems = (items: any[]) => {
      items.forEach((item: any) => {
        const name = item.nome || item.name || "Item";
        const qty = Number(item.quantidade || item.quantity || item.qty || 1);
        const price = Number(item.preco || item.price || 0);
        if (!sales[name]) sales[name] = { name, qty: 0, revenue: 0 };
        sales[name].qty += qty;
        sales[name].revenue += qty * price;
      });
    };
    const sinceDate = new Date();
    if (period === "year") {
      sinceDate.setFullYear(parseInt(yearFilter), 0, 1);
      sinceDate.setHours(0, 0, 0, 0);
    } else {
      sinceDate.setDate(sinceDate.getDate() - numDays);
    }
    const sinceStr = sinceDate.toISOString().split("T")[0];
    const untilStr = period === "year"
      ? `${parseInt(yearFilter) + 1}-01-01`
      : "9999-12-31";
    pedidos.filter(p => p.created_at >= sinceStr && p.created_at < untilStr).forEach(p => processItems(Array.isArray(p.items) ? p.items as any[] : []));
    pdvPedidos.filter(p => p.created_at >= sinceStr && p.created_at < untilStr).forEach(p => processItems(Array.isArray(p.items) ? p.items as any[] : []));
    return Object.values(sales).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [pedidos, pdvPedidos, numDays, period, yearFilter]);

  // Recent orders in period
  const recentOrders = useMemo(() => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - numDays);
    const sinceStr = sinceDate.toISOString();
    return pedidos.filter(p => p.created_at >= sinceStr).slice(0, 15);
  }, [pedidos, numDays]);

  // Weekday aggregation (Seg, Ter, Qua, ...) — usa pedidos brutos do período selecionado
  // para garantir que TODOS os 7 dias apareçam (mesmo com 0) e que nenhum dia com vendas
  // seja omitido por causa do agrupamento mensal do chartData (year/all).
  const weeklyData = useMemo(() => {
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const buckets: Record<number, { semana: string; vendas: number; pedidos: number; order: number }> = {};
    for (let i = 0; i < 7; i++) buckets[i] = { semana: names[i], vendas: 0, pedidos: 0, order: i };

    // Define intervalo conforme filtro atual
    const now = new Date();
    let fromDate: Date;
    let toDate: Date;
    if (period === "all") {
      fromDate = new Date(2000, 0, 1);
      toDate = new Date(9999, 11, 31);
    } else if (period === "year") {
      const y = parseInt(yearFilter);
      fromDate = new Date(y, 0, 1);
      toDate = new Date(y + 1, 0, 1);
    } else if (period === "month") {
      const y = parseInt(yearFilter);
      const m = parseInt(monthFilter);
      fromDate = new Date(y, m, 1);
      toDate = new Date(y, m + 1, 1);
    } else {
      fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);
      fromDate.setDate(fromDate.getDate() - (numDays - 1));
      toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
    }

    const accumulate = (arr: any[]) => arr.forEach(p => {
      const d = new Date(p.created_at);
      if (d < fromDate || d >= toDate) return;
      const wd = d.getDay();
      buckets[wd].vendas += Number(p.total || 0);
      buckets[wd].pedidos += 1;
    });
    accumulate(pedidos);
    accumulate(pdvPedidos);

    return Object.values(buckets).sort((a, b) => b.vendas - a.vendas);
  }, [pedidos, pdvPedidos, period, yearFilter, monthFilter, numDays]);

  // Top 5 clientes que mais compram (por quantidade de pedidos)
  const topClientes = useMemo(() => {
    const sinceDate = new Date();
    if (period === "all") {
      sinceDate.setFullYear(2000, 0, 1);
    } else if (period === "year") {
      sinceDate.setFullYear(parseInt(yearFilter), 0, 1);
      sinceDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      sinceDate.setFullYear(parseInt(yearFilter), parseInt(monthFilter), 1);
      sinceDate.setHours(0, 0, 0, 0);
    } else {
      sinceDate.setDate(sinceDate.getDate() - numDays);
    }
    const untilStr = period === "year"
      ? `${parseInt(yearFilter) + 1}-01-01`
      : period === "month"
      ? new Date(parseInt(yearFilter), parseInt(monthFilter) + 1, 1).toISOString()
      : "9999-12-31";
    const sinceStr = sinceDate.toISOString();
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    pedidos
      .filter((p: any) => p.created_at >= sinceStr && p.created_at < untilStr)
      .forEach((p: any) => {
        const nome = (p.cliente_nome || "").trim();
        const tel = (p.cliente_telefone || "").trim();
        const key = tel || nome;
        if (!key) return;
        const cur = map.get(key) || { nome: nome || tel, qtd: 0, total: 0 };
        cur.qtd += 1;
        cur.total += Number(p.total || 0);
        if (!cur.nome && nome) cur.nome = nome;
        map.set(key, cur);
      });
    return Array.from(map.values())
      .sort((a, b) => b.qtd - a.qtd || b.total - a.total)
      .slice(0, 5);
  }, [pedidos, period, yearFilter, monthFilter, numDays]);




  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: "Vendas Hoje", value: formatCurrency(todayData.vendas), icon: DollarSign, color: "text-primary" },
    { label: "Total Pedidos", value: String(totalPedidos), icon: ShoppingCart, color: "text-secondary" },
    { label: "Total no Período", value: formatCurrency(totalVendas), icon: TrendingUp, color: "text-primary" },
    { label: "Melhor Dia", value: melhorDia && melhorDia.vendas > 0 ? `${melhorDia.dia} (${formatCurrency(melhorDia.vendas)})` : "—", icon: Calendar, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/lojista")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-display flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Vendas
            </h1>
            <p className="text-sm text-muted-foreground">Detalhamento de vendas do período. Pedidos finalizados.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["7", "14"] as const).map(p => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
              className="text-xs gap-1"
            >
              <Calendar className="w-3 h-3" />
              {`${p} dias`}
            </Button>
          ))}

          <Select
            value={period === "all" ? "all" : period === "month" ? monthFilter : ""}
            onValueChange={(v) => {
              if (v === "all") {
                setPeriod("all");
              } else {
                setMonthFilter(v);
                setPeriod("month");
              }
            }}
          >
            <SelectTrigger
              className={`h-8 w-auto gap-1 text-xs px-3 ${period === "month" || period === "all" ? "bg-primary text-primary-foreground border-primary [&>svg]:text-primary-foreground" : ""}`}
            >
              <Calendar className="w-3 h-3" />
              <SelectValue placeholder="Mês">
                {period === "all" ? "Todos" : period === "month" ? monthNames[parseInt(monthFilter)] : "Mês"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Todos</SelectItem>
              {monthNames.map((name, i) => (
                <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintMonthlyReport}
            disabled={isPrinting}
            className="text-xs gap-1"
          >
            {isPrinting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
            Imprimir Relatório
          </Button>
        </div>



      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={stat.label} className="border-border/50 shadow-card overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-full h-1 ${i % 2 === 0 ? "bg-primary" : "bg-secondary"}`} />
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0 ${i % 2 === 0 ? "bg-primary/10" : "bg-secondary/10"}`}>
                  <stat.icon className={`w-4 h-4 ${i % 2 === 0 ? "text-primary" : "text-secondary"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold font-display text-foreground leading-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>


      {/* Comparativo mensal (mês atual vs anterior) */}
      {monthCompare && period !== "all" && (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">
              📈 Comparativo: mês atual vs mês anterior {monthCompare.isCurrentMonth ? `até o dia ${monthCompare.cutoffDay}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const currMonthName = monthNames[period === "month" ? parseInt(monthFilter) : new Date().getMonth()];
                const prevIdx = (period === "month" ? parseInt(monthFilter) : new Date().getMonth()) - 1;
                const prevMonthName = monthNames[(prevIdx + 12) % 12];
                const sufixo = monthCompare.isCurrentMonth ? `Até o dia ${monthCompare.cutoffDay}` : "";
                const currLabel = currMonthName;
                const prevLabel = prevMonthName;

                const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const fmtNum = (n: number) => Math.round(n).toLocaleString("pt-BR");
                const arrow = (c: number, p: number) => c > p ? "▲" : c < p ? "▼" : "▬";
                const cls = (c: number, p: number) => c > p ? "text-green-600 dark:text-green-400" : c < p ? "text-red-500" : "text-muted-foreground";

                // Pedidos
                const pedDias = monthCompare.cutoffDay;
                const pedDiasPrev = monthCompare.isCurrentMonth
                  ? Math.min(monthCompare.cutoffDay, monthCompare.daysInPrev)
                  : monthCompare.daysInPrev;
                const pedPorDiaCurr = pedDias > 0 ? monthCompare.pedidos.curr / pedDias : 0;
                const pedPorDiaPrev = pedDiasPrev > 0 ? monthCompare.pedidos.prev / pedDiasPrev : 0;

                // Ticket médio
                const tmCurr = monthCompare.pedidos.curr > 0 ? monthCompare.receita.curr / monthCompare.pedidos.curr : 0;
                const tmPrev = monthCompare.pedidos.prev > 0 ? monthCompare.receita.prev / monthCompare.pedidos.prev : 0;

                // Receita/dia
                const recDiaCurr = pedDias > 0 ? monthCompare.receita.curr / pedDias : 0;
                const recDiaPrev = pedDiasPrev > 0 ? monthCompare.receita.prev / pedDiasPrev : 0;

                // % entregas sobre pedidos
                const pctEntCurr = monthCompare.pedidos.curr > 0 ? (monthCompare.qtdEntregas.curr / monthCompare.pedidos.curr) * 100 : 0;
                const pctEntPrev = monthCompare.pedidos.prev > 0 ? (monthCompare.qtdEntregas.prev / monthCompare.pedidos.prev) * 100 : 0;

                // Média por entrega
                const mediaEntCurr = monthCompare.qtdEntregas.curr > 0 ? monthCompare.valorEntregas.curr / monthCompare.qtdEntregas.curr : 0;
                const mediaEntPrev = monthCompare.qtdEntregas.prev > 0 ? monthCompare.valorEntregas.prev / monthCompare.qtdEntregas.prev : 0;

                const diffRow = (curr: number, prev: number, currency: boolean) => {
                  const d = curr - prev;
                  const fmt = currency ? fmtBRL : fmtNum;
                  const positive = d >= 0;
                  return (
                    <div className="flex justify-between pt-1 border-t border-border/30">
                      <span>{positive ? "Superávit" : "Déficit"}</span>
                      <span className={`font-bold tabular-nums inline-flex items-center gap-1 ${positive ? "text-green-600" : "text-red-500"}`}>
                        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
                          {positive
                            ? <polygon points="5,1 9,9 1,9" fill="currentColor" />
                            : <polygon points="1,1 9,1 5,9" fill="currentColor" />}
                        </svg>
                        {fmt(Math.abs(d))}
                      </span>
                    </div>
                  );
                };

                return (
                  <>
                    <CircularStat
                      label="Quantidade de Pedidos"
                      rawValue={monthCompare.pedidos.curr}
                      prevValue={monthCompare.pedidos.prev}
                      delta={monthCompare.pedidos.delta}
                      color="#F97316"
                      subtitle={sufixo}
                      prevLabel={prevLabel}
                      currLabel={currLabel}
                      detail={
                        <>
                          <div className="flex justify-between">
                            <span>Total {prevMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtNum(monthCompare.pedidos.prevFull)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total {currMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtNum(monthCompare.pedidos.curr)}</span>
                          </div>
                          {diffRow(monthCompare.pedidos.curr, monthCompare.pedidos.prevFull, false)}
                        </>
                      }
                    />
                    <CircularStat
                      label="Total de Pedidos (Receita)"
                      rawValue={monthCompare.receita.curr}
                      prevValue={monthCompare.receita.prev}
                      isCurrency
                      delta={monthCompare.receita.delta}
                      color="hsl(var(--primary))"
                      subtitle={sufixo}
                      prevLabel={prevLabel}
                      currLabel={currLabel}
                      detail={
                        <>
                          <div className="flex justify-between">
                            <span>Total {prevMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtBRL(monthCompare.receita.prevFull)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total {currMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtBRL(monthCompare.receita.curr)}</span>
                          </div>
                          {diffRow(monthCompare.receita.curr, monthCompare.receita.prevFull, true)}
                        </>
                      }
                    />
                    <CircularStat
                      label="Quantidade de Entregas"
                      rawValue={monthCompare.qtdEntregas.curr}
                      prevValue={monthCompare.qtdEntregas.prev}
                      delta={monthCompare.qtdEntregas.delta}
                      color="#22c55e"
                      subtitle={sufixo}
                      prevLabel={prevLabel}
                      currLabel={currLabel}
                      detail={
                        <>
                          <div className="flex justify-between">
                            <span>Total {prevMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtNum(monthCompare.qtdEntregas.prevFull)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total {currMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtNum(monthCompare.qtdEntregas.curr)}</span>
                          </div>
                          {diffRow(monthCompare.qtdEntregas.curr, monthCompare.qtdEntregas.prevFull, false)}
                        </>
                      }
                    />
                    <CircularStat
                      label="Valor das Entregas"
                      rawValue={monthCompare.valorEntregas.curr}
                      prevValue={monthCompare.valorEntregas.prev}
                      isCurrency
                      delta={monthCompare.valorEntregas.delta}
                      color="#a855f7"
                      subtitle={sufixo}
                      prevLabel={prevLabel}
                      currLabel={currLabel}
                      detail={
                        <>
                          <div className="flex justify-between">
                            <span>Total {prevMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtBRL(monthCompare.valorEntregas.prevFull)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total {currMonthName}</span>
                            <span className="font-semibold text-foreground tabular-nums">{fmtBRL(monthCompare.valorEntregas.curr)}</span>
                          </div>
                          {diffRow(monthCompare.valorEntregas.curr, monthCompare.valorEntregas.prevFull, true)}
                        </>
                      }
                    />
                  </>
                );
              })()}
            </div>


          </CardContent>
        </Card>
      )}

      {/* Vendas por Dia */}
      {monthCompare && period !== "all" && (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">📅 Vendas por dia — mês atual vs anterior</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Receita diária comparada dia a dia
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthCompare.dailySeries} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const entry = monthCompare.dailySeries.find((s: any) => s.dia === payload.value);
                      const atual = entry?.atual;
                      const anterior = entry?.anterior;
                      let color = "hsl(var(--muted-foreground))";
                      if (typeof atual === "number" && typeof anterior === "number") {
                        if (atual > anterior) color = "#16a34a";
                        else if (atual < anterior) color = "#dc2626";
                      }
                      return (
                        <text x={x} y={y + 10} textAnchor="middle" fontSize={10} fill={color} fontWeight={600}>
                          {payload.value}
                        </text>
                      );
                    }}
                  />

                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 700 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const atual = payload.find((p: any) => p.dataKey === "atual")?.value;
                      const anterior = payload.find((p: any) => p.dataKey === "anterior")?.value;
                      const atualNum = typeof atual === "number" ? atual : null;
                      const anteriorNum = typeof anterior === "number" ? anterior : null;
                      let diffPct: number | null = null;
                      if (atualNum != null && anteriorNum != null && anteriorNum > 0) {
                        diffPct = ((atualNum - anteriorNum) / anteriorNum) * 100;
                      } else if (atualNum != null && anteriorNum === 0 && atualNum > 0) {
                        diffPct = 100;
                      }
                      const positive = diffPct != null && diffPct >= 0;
                      return (
                        <div className="rounded-lg border border-border bg-background/95 backdrop-blur px-3 py-2 shadow-lg text-xs min-w-[220px]">
                          <div className="flex items-center justify-between gap-4 mb-1.5 pb-1.5 border-b border-border/60">
                            <span className="font-semibold text-foreground">Dia {monthCompare.dailySeries.find((s: any) => s.dia === label)?.diaLabel ?? label}</span>

                            {diffPct != null ? (
                              <span className={`flex items-center gap-0.5 font-bold tabular-nums ${positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                                  {positive
                                    ? <polygon points="5,1 9,9 1,9" fill="currentColor" />
                                    : <polygon points="1,1 9,1 5,9" fill="currentColor" />}
                                </svg>

                                {positive ? "+" : ""}{diffPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="w-2 h-2 rounded-sm" style={{ background: "#F97316" }} />
                                Mês anterior
                              </span>
                              <span className="font-medium text-foreground tabular-nums">
                                {anteriorNum == null ? "—" : formatCurrency(anteriorNum)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="w-2 h-2 rounded-sm" style={{ background: "hsl(var(--primary))" }} />
                                Mês atual
                              </span>
                              <span className="font-medium text-foreground tabular-nums">
                                {atualNum == null ? "—" : formatCurrency(atualNum)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="anterior" name="Mês anterior" fill="#F97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="atual" name="Mês atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}




      {/* Pie + Line side-by-side */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">🥧 Top Produtos (Receita)</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <defs>
                    {["#2563EB", "#F97316", "#22c55e", "#a855f7", "#06b6d4"].map((c, i) => (
                      <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  {(() => {
                    const data = topProducts.slice(0, 5).map(p => ({ name: p.name, value: p.revenue, qty: p.qty }));
                    const total = data.reduce((s, d) => s + d.value, 0) || 1;
                    return (
                      <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={3}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                        label={(e: any) => `${((e.value / total) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.map((_, i) => (
                          <Cell key={i} fill={`url(#pieGrad${i})`} />
                        ))}
                      </Pie>
                    );
                  })()}
                  <Tooltip
                    formatter={(v: number, _n: string, item: any) => [
                      `${formatCurrency(v)} • ${item?.payload?.qty ?? 0} vendidos`,
                      item?.payload?.name,
                    ]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 13 }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(value: string) => <span className="text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">📊 Semanas Mais Vendidas</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={weeklyData.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `R$${v}`} />
                  <YAxis type="category" dataKey="semana" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={60} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "Vendas" ? [formatCurrency(value), name] : [`${value} pedido${value === 1 ? "" : "s"}`, name]
                    }
                    itemSorter={(item) => (item.name === "Vendas" ? 0 : 1)}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 13 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    payload={[
                      { value: "Vendas", type: "square", color: "hsl(var(--primary))" },
                      { value: "Pedidos", type: "square", color: "#F97316" },
                    ]}
                  />
                  <Bar dataKey="pedidos" name="Pedidos" stackId="a" fill="#F97316" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="vendas" name="Vendas" stackId="a" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Bar Chart */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">📊 Vendas {period === "7" ? "dos últimos 7 dias" : period === "14" ? "dos últimos 14 dias" : period === "all" ? "de todos os meses" : period === "month" ? `de ${monthNames[parseInt(monthFilter)]}` : `de ${yearFilter}`}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(d => d.vendas === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "Vendas" ? [formatCurrency(value), name] : [`${value} pedido${value === 1 ? "" : "s"}`, name]
                  }
                  labelFormatter={(label: string, payload: any[]) => {
                    if (period === "7") return label;
                    const dataStr = payload?.[0]?.payload?.data;
                    if (!dataStr) return label;
                    const [y, m, d] = dataStr.split("-").map(Number);
                    const wd = new Date(y, m - 1, d).getDay();
                    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                    return `${names[wd]} · ${label}`;
                  }}
                  itemSorter={(item) => (item.name === "Vendas" ? 0 : 1)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: 13,
                  }}
                />

                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  payload={[
                    { value: "Vendas", type: "square", color: "hsl(var(--primary))" },
                    { value: "Pedidos", type: "square", color: "#F97316" },
                  ]}
                />
                <Bar dataKey="pedidos" name="Pedidos" stackId="a" fill="#F97316" radius={[0, 0, 6, 6]} />
                <Bar dataKey="vendas" name="Vendas" stackId="a" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Products */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">🔥 5 Mais Vendidos no Período</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem vendas no período.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {topProducts.slice(0, 5).map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">#{i + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.qty} vendidos</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary">{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Melhores Dias */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">🏆 5 Melhores Dias</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.every(d => d.vendas === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem vendas no período.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {[...chartData]
                  .filter(d => d.vendas > 0)
                  .sort((a, b) => b.vendas - a.vendas)
                  .slice(0, 5)
                  .map((d, i) => (
                    <div key={d.dia + i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${i < 3 ? "bg-primary/10" : "bg-muted"}`}>
                          <span className={`text-xs font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>#{i + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{d.dia}</p>
                          <p className="text-[10px] text-muted-foreground">{d.pedidos} pedidos</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-primary">{formatCurrency(d.vendas)}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Clientes que mais compram */}
        <Card className="border-border/50 shadow-card md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Top 5 Clientes que mais compram
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente identificado no período.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {topClientes.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${i < 3 ? "bg-primary/10" : "bg-muted"}`}>
                        <span className={`text-xs font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>#{i + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.nome || "Cliente"}</p>
                        <p className="text-[10px] text-muted-foreground">{c.qtd} pedido{c.qtd !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 tabular-nums shrink-0 ml-2">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default VendasSemana;