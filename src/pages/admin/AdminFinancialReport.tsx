import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const AdminFinancialReport = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedYear = Number(searchParams.get("year") || new Date().getFullYear());
  const selectedMonth = Number(searchParams.get("month") || new Date().getMonth());
  const selectedDay = searchParams.get("day") ? Number(searchParams.get("day")) : null;
  const selectedStoreId = searchParams.get("store") || "all";

  const periodStart = useMemo(() => {
    if (selectedDay) return new Date(selectedYear, selectedMonth, selectedDay).toISOString();
    return new Date(selectedYear, selectedMonth, 1).toISOString();
  }, [selectedYear, selectedMonth, selectedDay]);

  const periodEnd = useMemo(() => {
    if (selectedDay) return new Date(selectedYear, selectedMonth, selectedDay + 1).toISOString();
    return new Date(selectedYear, selectedMonth + 1, 1).toISOString();
  }, [selectedYear, selectedMonth, selectedDay]);

  const { data: lojas = [], isLoading: loadingLojas } = useQuery({
    queryKey: ["admin-report-lojas"],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome, slug, logo_url, user_id, segmento");
      return data ?? [];
    },
  });

  const { data: pedidosPeriodo = [], isLoading: loadingPedidos } = useQuery({
    queryKey: ["admin-report-pedidos", periodStart, periodEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("lojista_id, total, created_at, status, cliente_nome, items, tipo")
        .gte("created_at", periodStart)
        .lt("created_at", periodEnd);
      return data ?? [];
    },
  });

  const isLoading = loadingLojas || loadingPedidos;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const storeStats = useMemo(() => {
    let filteredLojas = lojas;
    if (selectedStoreId !== "all") {
      filteredLojas = lojas.filter((l: any) => l.id === selectedStoreId);
    }
    return filteredLojas.map((loja: any) => {
      const pedidos = pedidosPeriodo.filter((p: any) => p.lojista_id === loja.user_id);
      const faturamento = pedidos.reduce((s: number, p: any) => s + Number(p.total), 0);
      return { ...loja, pedidosMes: pedidos.length, faturamentoMes: faturamento };
    }).sort((a: any, b: any) => b.faturamentoMes - a.faturamentoMes);
  }, [lojas, pedidosPeriodo, selectedStoreId]);

  const totalFaturamento = storeStats.reduce((s: number, l: any) => s + l.faturamentoMes, 0);
  const totalPedidos = storeStats.reduce((s: number, l: any) => s + l.pedidosMes, 0);

  const periodLabel = selectedDay
    ? `${selectedDay} de ${MONTHS[selectedMonth]} de ${selectedYear}`
    : `${MONTHS[selectedMonth]} de ${selectedYear}`;

  const storeName = selectedStoreId !== "all"
    ? lojas.find((l: any) => l.id === selectedStoreId)?.nome
    : null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/financeiro")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <Button variant="default" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Imprimir
        </Button>
      </div>

      {/* Report Title */}
      <div className="text-center print:mb-4">
        <h1 className="text-2xl font-bold font-display text-foreground">
          Relatório Financeiro
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Período: <span className="font-semibold text-foreground capitalize">{periodLabel}</span>
          {storeName && <span> — Loja: <span className="font-semibold text-foreground">{storeName}</span></span>}
        </p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-4 border rounded-lg p-4 bg-muted/30">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase">Lojas</p>
          <p className="text-lg font-bold font-display">{storeStats.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase">Total Pedidos</p>
          <p className="text-lg font-bold font-display">{totalPedidos}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase">Faturamento Total</p>
          <p className="text-lg font-bold font-display">{formatCurrency(totalFaturamento)}</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">#</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Loja</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Segmento</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Pedidos</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Faturamento</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Ticket Médio</th>
              <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {storeStats.map((loja: any, idx: number) => (
              <tr key={loja.id} className="border-t border-border/50 hover:bg-muted/30">
                <td className="py-2.5 px-3 text-muted-foreground">{idx + 1}</td>
                <td className="py-2.5 px-3 font-medium">{loja.nome}</td>
                <td className="py-2.5 px-3 text-muted-foreground capitalize">{loja.segmento || "—"}</td>
                <td className="py-2.5 px-3 text-right">{loja.pedidosMes}</td>
                <td className="py-2.5 px-3 text-right">{formatCurrency(loja.faturamentoMes)}</td>
                <td className="py-2.5 px-3 text-right">
                  {loja.pedidosMes > 0 ? formatCurrency(loja.faturamentoMes / loja.pedidosMes) : "—"}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <Badge variant="outline" className={`text-[10px] ${loja.pedidosMes > 0 ? "text-green-700 border-green-200" : "text-muted-foreground"}`}>
                    {loja.pedidosMes > 0 ? "Ativa" : "Sem pedidos"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40 font-semibold">
            <tr className="border-t border-border">
              <td className="py-2.5 px-3" colSpan={3}>Total ({storeStats.length} lojas)</td>
              <td className="py-2.5 px-3 text-right">{totalPedidos}</td>
              <td className="py-2.5 px-3 text-right">{formatCurrency(totalFaturamento)}</td>
              <td className="py-2.5 px-3 text-right">
                {totalPedidos > 0 ? formatCurrency(totalFaturamento / totalPedidos) : "—"}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer for print */}
      <div className="text-center text-xs text-muted-foreground pt-4 hidden print:block">
        Relatório gerado em {new Date().toLocaleDateString("pt-BR")} — N<span className="text-secondary">O</span>OV
      </div>
    </div>
  );
};

export default AdminFinancialReport;
