import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Target,
  BarChart3,
  Calendar,
  Lock,
  ArrowRight,
  Info,
  ChevronRight,
  FileText,
  Download,
  Clock,
  XCircle,
  Users,
  LineChart,
  Package,
  DollarSign
} from "lucide-react";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ConsultorPage = () => {
  const { user } = useAuth();
  const { limits } = useStorePlanLimits();
  const navigate = useNavigate();
  const isStartPlan = limits.dashboard === false;

  const { data: loja } = useQuery({
    queryKey: ["consultor-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["consultor-pedidos-all", user?.id],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", user!.id)
        .gte("created_at", since.toISOString());
      return data ?? [];
    },
    enabled: !!user && !isStartPlan,
  });

  const { data: pdvPedidos = [] } = useQuery({
    queryKey: ["consultor-pdv-all", loja?.id],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data } = await supabase
        .from("pdv_pedidos")
        .select("*")
        .eq("loja_id", loja!.id)
        .gte("created_at", since.toISOString());
      return data ?? [];
    },
    enabled: !!loja?.id && !isStartPlan,
  });

  const analysis = useMemo(() => {
    if (isStartPlan) return null;

    const finalStatuses = ["finalizado", "entregue", "fechado"];
    const cancelStatuses = ["cancelado", "recusado"];

    const allRaw = [...pedidos, ...pdvPedidos];
    const allPedidos = allRaw.filter(p => finalStatuses.includes(p.status));
    const cancelados = allRaw.filter(p => cancelStatuses.includes(p.status));
    if (allPedidos.length === 0) return null;

    const weekdaySales: Record<number, { count: number; total: number }> = {};
    const hourSales: Record<number, number> = {};
    const productSales: Record<string, { qty: number; total: number }> = {};
    const monthSales: Record<string, number> = {};
    const clientOrders: Record<string, number> = {};
    const pairCounts: Record<string, number> = {};
    const ticketList: number[] = [];

    allPedidos.forEach(p => {
      const date = new Date(p.created_at);
      const weekday = date.getDay();
      const hour = date.getHours();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      weekdaySales[weekday] = weekdaySales[weekday] || { count: 0, total: 0 };
      weekdaySales[weekday].count++;
      weekdaySales[weekday].total += Number(p.total);

      hourSales[hour] = (hourSales[hour] || 0) + 1;
      monthSales[monthKey] = (monthSales[monthKey] || 0) + Number(p.total);
      ticketList.push(Number(p.total));

      const clienteKey = (p as any).cliente_telefone || (p as any).cliente_id || (p as any).cliente_nome;
      if (clienteKey) clientOrders[clienteKey] = (clientOrders[clienteKey] || 0) + 1;

      const items = Array.isArray(p.items) ? p.items : [];
      const namesInOrder: string[] = [];
      items.forEach((item: any) => {
        const name = item.nome || item.name || "Item";
        const qty = Number(item.quantity || item.qtd || 1);
        const price = Number(item.preco || item.price || 0);
        productSales[name] = productSales[name] || { qty: 0, total: 0 };
        productSales[name].qty += qty;
        productSales[name].total += qty * price;
        namesInOrder.push(name);
      });
      // pares (combos naturais)
      const uniq = Array.from(new Set(namesInOrder));
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          const key = [uniq[i], uniq[j]].sort().join(" + ");
          pairCounts[key] = (pairCounts[key] || 0) + 1;
        }
      }
    });

    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const salesByDay = Object.entries(weekdaySales).map(([day, stats]) => ({
      day: dayNames[Number(day)],
      dayIdx: Number(day),
      ...stats
    })).sort((a, b) => a.total - b.total);

    const weakDays = salesByDay.slice(0, 2);
    const strongDays = [...salesByDay].sort((a, b) => b.total - a.total).slice(0, 2);

    const sortedProducts = Object.entries(productSales)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.qty - a.qty);

    const topProducts = sortedProducts.slice(0, 5);
    const slowProducts = [...sortedProducts].reverse().slice(0, 5);

    // Horários ociosos (comparado à média)
    const hourValues = Object.entries(hourSales).map(([h, c]) => ({ hour: Number(h), count: c }));
    const avgPerHour = hourValues.reduce((s, h) => s + h.count, 0) / (hourValues.length || 1);
    const idleHours = hourValues
      .filter(h => h.count < avgPerHour * 0.4)
      .sort((a, b) => a.count - b.count)
      .slice(0, 3);
    const peakHours = [...hourValues].sort((a, b) => b.count - a.count).slice(0, 2);

    // Ticket médio + mediana
    const ticketMedio = ticketList.reduce((s, v) => s + v, 0) / ticketList.length;
    const sortedTickets = [...ticketList].sort((a, b) => a - b);
    const medianaTicket = sortedTickets[Math.floor(sortedTickets.length / 2)] || 0;
    const meta = medianaTicket * 1.15;

    // Cancelamento
    const totalOrdersAll = allPedidos.length + cancelados.length;
    const taxaCancelamento = totalOrdersAll > 0 ? (cancelados.length / totalOrdersAll) * 100 : 0;

    // Retenção
    const totalClientes = Object.keys(clientOrders).length;
    const clientesRecorrentes = Object.values(clientOrders).filter(c => c > 1).length;
    const taxaRetencao = totalClientes > 0 ? (clientesRecorrentes / totalClientes) * 100 : 0;

    // Tendência mensal (comparação últimos 2 meses fechados)
    const monthsSorted = Object.entries(monthSales).sort(([a], [b]) => a.localeCompare(b));
    const lastMonth = monthsSorted[monthsSorted.length - 1];
    const prevMonth = monthsSorted[monthsSorted.length - 2];
    const tendenciaPct = prevMonth && lastMonth && prevMonth[1] > 0
      ? ((lastMonth[1] - prevMonth[1]) / prevMonth[1]) * 100
      : 0;

    // Combos naturais
    const topPairs = Object.entries(pairCounts)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      weakDays,
      strongDays,
      topProducts,
      slowProducts,
      totalOrders: allPedidos.length,
      ticketMedio,
      medianaTicket,
      meta,
      idleHours,
      peakHours,
      taxaCancelamento,
      totalCancelados: cancelados.length,
      taxaRetencao,
      totalClientes,
      clientesRecorrentes,
      tendenciaPct,
      lastMonthKey: lastMonth?.[0],
      topPairs
    };
  }, [pedidos, pdvPedidos, isStartPlan]);

  if (isStartPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-primary" />
        </div>
        <div className="max-w-md">
          <h1 className="text-2xl font-bold font-display mb-2">Página de Consultor Bloqueada</h1>
          <p className="text-muted-foreground mb-6">
            A ferramenta de consultoria inteligente está disponível apenas para os planos <strong>Pro</strong> e <strong>Ultra</strong>. Faça o upgrade para desbloquear análises detalhadas do seu negócio.
          </p>
          <Button onClick={() => navigate("/lojista/plano")} className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Ver Planos e Upgrade
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto py-12">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Dados Insuficientes</h2>
          <p className="text-muted-foreground">
            Ainda não temos pedidos finalizados suficientes para realizar uma análise precisa. Continue vendendo para liberar as dicas do consultor!
          </p>
        </div>
      </div>
    );
  }

  const handlePrintReport = () => {
    const originalTitle = document.title;
    document.title = "Relatório";
    window.print();
    // Restaurar o título original após um pequeno delay para garantir que a janela de impressão o capturou
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];


  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" />
            Consultor de Negócios
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise baseada no seu histórico dos últimos 90 dias.
          </p>
        </div>
        <Button onClick={handlePrintReport} className="gap-2 font-bold shadow-sm">
          <FileText className="w-4 h-4" />
          Gerar Relatório
        </Button>
      </div>

      {/* LAUDO TÉCNICO FORMAL (Visível apenas na impressão) */}
      <div id="laudo-tecnico-container" className="hidden print:block text-slate-900 leading-tight max-w-[21cm] mx-auto bg-white p-[0.5cm] mt-[-1.5cm]">
        <div className="border-b-2 border-slate-900 pb-6 mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">LAUDO TÉCNICO DE CONSULTORIA ESTRATÉGICA</h1>
          <p className="text-xs uppercase tracking-widest text-slate-100">Sistema de Inteligência Artificial • Departamento de Análise de Dados</p>
        </div>

        <div className="grid grid-cols-2 gap-y-4 text-sm mb-8 py-4">
          <div><span className="font-bold uppercase text-[10px]">Identificação da Unidade:</span> <p className="font-bold">Loja #{loja?.id?.slice(0,8).toUpperCase()}</p></div>
          <div><span className="font-bold uppercase text-[10px]">Data da Análise:</span> <p className="font-bold">{new Date().toLocaleDateString('pt-BR')}</p></div>
          <div><span className="font-bold uppercase text-[10px]">Período Abrangido:</span> <p className="font-bold">Últimos 90 dias</p></div>
          <div><span className="font-bold uppercase text-[10px]">Amostragem:</span> <p className="font-bold">{analysis.totalOrders} registros processados</p></div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-wider">I. EXAME CLÍNICO (Análise de Performance)</h2>
            <p className="text-sm mb-4">
              Após análise detalhada do fluxo de transações, identificamos que o estabelecimento apresenta um ticket médio de <span className="font-bold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(analysis.ticketMedio)}</span>. 
              A curva de demanda atinge seu ápice (Dias de Ouro) especificamente em: <span className="font-bold">{analysis.strongDays.map(d => d.day).join(" e ")}</span>.
            </p>
            <p className="text-sm">
              Quanto ao mix de produtos, observa-se alta receptividade do mercado aos itens <span className="font-bold">{analysis.topProducts.map(p => p.name).join(", ")}</span>, que demonstram ser os pilares de sustentação do faturamento atual.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-wider">II. DIAGNÓSTICO (Pontos de Atenção)</h2>
            <p className="text-sm mb-4">
              Detectamos uma queda significativa de tração operacional nos períodos de <span className="font-bold">{analysis.weakDays.map(d => d.day).join(" e ")}</span>. Esta ociosidade indica um potencial de faturamento não explorado e um custo fixo proporcionalmente mais elevado nestes intervalos.
            </p>
            <p className="text-sm">
              Adicionalmente, os produtos <span className="font-bold">{analysis.slowProducts.map(p => p.name).join(", ")}</span> apresentam baixa rotatividade (giro lento), o que sugere a necessidade imediata de revisão de posicionamento no cardápio ou ações promocionais vinculadas.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-wider">III. INDICADORES OPERACIONAIS COMPLEMENTARES</h2>
            <ul className="text-sm space-y-2 list-disc pl-5">
              <li><span className="font-bold">Ticket Médio Atual:</span> {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(analysis.ticketMedio)} — Meta sugerida: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(analysis.meta)} (mediana +15%).</li>
              {analysis.idleHours.length > 0 && (
                <li><span className="font-bold">Horários Ociosos:</span> {analysis.idleHours.map(h => `${h.hour}h`).join(", ")} apresentam movimento &lt;40% da média. Horário de pico: {analysis.peakHours.map(h => `${h.hour}h`).join(", ")}.</li>
              )}
              <li><span className="font-bold">Taxa de Cancelamento:</span> {analysis.taxaCancelamento.toFixed(1)}% ({analysis.totalCancelados} pedidos) — {analysis.taxaCancelamento > 8 ? "ACIMA do saudável (>8%)." : "dentro do padrão saudável."}</li>
              <li><span className="font-bold">Retenção de Clientes:</span> {analysis.taxaRetencao.toFixed(0)}% ({analysis.clientesRecorrentes} de {analysis.totalClientes} clientes recorrentes).</li>
              {analysis.lastMonthKey && (
                <li><span className="font-bold">Tendência Mensal:</span> {analysis.tendenciaPct >= 0 ? "+" : ""}{analysis.tendenciaPct.toFixed(1)}% em relação ao mês anterior.</li>
              )}
              {analysis.topPairs.length > 0 && (
                <li><span className="font-bold">Combos Naturais Detectados:</span> {analysis.topPairs.map(p => `${p.pair} (${p.count}x)`).join("; ")}.</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-wider">IV. PRESCRIÇÃO E CONDUTA ESTRATÉGICA</h2>
            <ul className="text-sm space-y-3 list-disc pl-5">
              <li><span className="font-bold">Tratamento de Ociosidade (Dias):</span> Implementar cupons exclusivos para {analysis.weakDays.map(d => d.day).join("/")}, visando nivelar a curva de vendas semanal.</li>
              {analysis.idleHours.length > 0 && (
                <li><span className="font-bold">Happy Hour:</span> Criar promoção específica nas faixas {analysis.idleHours.map(h => `${h.hour}h`).join(", ")} para preencher horários ociosos.</li>
              )}
              <li><span className="font-bold">Otimização de Ticket Médio:</span> {analysis.ticketMedio < analysis.meta ? "Ativar upsell no checkout (sobremesas, bebidas premium) e destacar adicionais." : "Manter estratégia atual — ticket dentro da meta."}</li>
              <li><span className="font-bold">Combos de Tração:</span> Elaborar combo oficial {analysis.topPairs[0]?.pair || `${analysis.topProducts[0]?.name} + ${analysis.slowProducts[0]?.name}`} com preço promocional.</li>
              {analysis.taxaCancelamento > 8 && (
                <li><span className="font-bold">Redução de Cancelamentos:</span> Auditar tempo de aceite (&lt;3 min), disponibilidade de produtos e cobertura de área de entrega.</li>
              )}
              <li><span className="font-bold">Programa de Fidelização:</span> {analysis.taxaRetencao < 30 ? "Implementar programa (10ª compra grátis) e cupom de segunda compra." : "Reforçar clube de vantagens para clientes assíduos."}</li>
              {analysis.tendenciaPct < 0 && (
                <li><span className="font-bold">Reengajamento:</span> Campanha ativa por WhatsApp e revisão de preços frente à concorrência local (tendência negativa detectada).</li>
              )}
              <li><span className="font-bold">Alocação de Investimento:</span> Direcionar mídia paga para {analysis.weakDays[0]?.day} — no dia forte ({analysis.strongDays[0]?.day}) a demanda ocorre naturalmente.</li>
            </ul>
          </section>

          <section className="mt-12 pt-8">
            <p className="text-[10px] text-justify leading-relaxed italic">
              <strong>NOTAS FINAIS E ISENÇÃO:</strong> Este laudo técnico é gerado por algoritmos de inteligência de dados com base estritamente no histórico fornecido. As recomendações são de caráter sugestivo. A implementação e os riscos associados às decisões estratégicas são de responsabilidade integral do gestor do estabelecimento.
            </p>
          </section>

          <div className="mt-16 text-center space-y-1">
            <div className="w-48 border-b border-slate-400 mx-auto mb-2"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Inteligência Artificial</p>
            <p className="text-[9px]">Relatório Processado Eletronicamente</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            margin: 0;
            size: A4;
          }
          
          /* Hide EVERYTHING that is not the laudo */
          html, body, #root, [data-radix-portal], .sidebar-provider, header, nav, aside, footer, .print\:hidden, .fixed, .absolute:not(#laudo-tecnico-container *) {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }
          
          /* Specifically show ONLY the laudo technical container */
          body, #root {
            display: block !important;
            visibility: visible !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Force hide the main layout structure that contains the system header, alerts, etc */
          .sidebar-provider, header, [role="banner"], .h-14, .bg-card, .border-b, [class*="Alert"], [class*="Banner"], .top-0 {
            display: none !important;
          }

          #laudo-tecnico-container {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 1cm !important;
            background: white !important;
            z-index: 99999 !important;
          }

          .bg-slate-50 { background-color: transparent !important; border: 1px solid #e2e8f0 !important; }
          .bg-slate-100 { background-color: transparent !important; border-bottom: 1px solid #e2e8f0 !important; }
        }
      `}} />

      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 py-2 px-4 h-auto block leading-relaxed font-medium print:hidden">
        <AlertTriangle className="w-4 h-4 inline mr-2 -mt-0.5" />
        Aviso importante: As análises abaixo são geradas automaticamente com base nos seus dados históricos de vendas. Elas servem apenas como sugestões. Toda e qualquer decisão estratégica deve ser tomada sob responsabilidade exclusiva do proprietário.
      </Badge>

      <div className="grid md:grid-cols-2 gap-6 print:hidden">

        {/* PONTOS FORTES */}
        <Card className="border-green-100 bg-white shadow-sm overflow-hidden group">
          <div className="h-1 bg-green-500 w-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between text-green-700">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span>Pontos Fortes</span>
              </div>
              <Badge variant="outline" className="bg-green-100/50 text-green-700 border-green-200">Excelente</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
                <Calendar className="w-4 h-4" />
                <span>Dias de Ouro (Maior Faturamento)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...analysis.strongDays].reverse().map((d, idx) => (
                  <div key={d.day} className="flex flex-col items-center bg-white border border-green-100 p-2 rounded-lg min-w-[80px] shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-green-600">{idx === 0 ? "Top 1" : "Top 2"}</span>
                    <span className="text-sm font-bold">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Produtos com Alta Performance</span>
                <Badge variant="outline" className="ml-auto text-[10px] bg-green-50 border-green-200 text-green-700">Top 5</Badge>
              </div>
              <ol className="space-y-1.5">
                {analysis.topProducts.map((p, idx) => {
                  const max = analysis.topProducts[0]?.qty || 1;
                  const pct = Math.max(8, Math.round((p.qty / max) * 100));
                  return (
                    <li key={p.name} className="relative overflow-hidden rounded-md border border-green-100 bg-white">
                      <div className="absolute inset-y-0 left-0 bg-green-100/60" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center gap-2 px-2 py-1.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">{idx + 1}</span>
                        <span className="flex-1 text-sm font-medium text-green-900 truncate">{p.name}</span>
                        <Badge className="bg-green-600 hover:bg-green-700 shrink-0">{p.qty} vendas</Badge>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* PONTOS FRACOS */}
        <Card className="border-red-100 bg-white shadow-sm overflow-hidden group">
          <div className="h-1 bg-red-500 w-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between text-red-700">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg group-hover:scale-110 transition-transform">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <span>Pontos de Atenção</span>
              </div>
              <Badge variant="outline" className="bg-red-100/50 text-red-700 border-red-200">Crítico</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <Calendar className="w-4 h-4" />
                <span>Dias Lentos (Ociosidade)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.weakDays.map((d, idx) => (
                  <div key={d.day} className="flex flex-col items-center bg-white border border-red-100 p-2 rounded-lg min-w-[80px] shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-red-600">{idx === 0 ? "Menor" : "Baixo"}</span>
                    <span className="text-sm font-bold">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertTriangle className="w-4 h-4" />
                <span>Produtos que precisam de Giro</span>
                <Badge variant="outline" className="ml-auto text-[10px] bg-red-50 border-red-200 text-red-700">Top 5</Badge>
              </div>
              <ol className="space-y-1.5">
                {analysis.slowProducts.map((p, idx) => {
                  const max = analysis.topProducts[0]?.qty || 1;
                  const pct = Math.max(6, Math.round((p.qty / max) * 100));
                  return (
                    <li key={p.name} className="relative overflow-hidden rounded-md border border-red-100 bg-white">
                      <div className="absolute inset-y-0 left-0 bg-red-100/60" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center gap-2 px-2 py-1.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold shrink-0">{idx + 1}</span>
                        <span className="flex-1 text-sm font-medium text-red-900 truncate">{p.name}</span>
                        <Badge variant="destructive" className="bg-red-500 shrink-0">{p.qty} unid.</Badge>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ESTRATÉGIAS */}
      <div className="space-y-4 print:hidden">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />

          O que melhorar? (Sugestões do Sistema)
        </h2>

        <div className="grid gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold">Aumentar vendas em dias lentos ({analysis.weakDays.map(d => d.day).join(", ")})</h3>
                  <p className="text-sm text-muted-foreground">
                    Estes dias representam sua maior ociosidade. Considere criar cupons de desconto exclusivos para uso apenas nesses dias da semana.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => navigate("/lojista/configuracoes")} className="text-xs h-8">
                      Criar Cupom <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs h-8 gap-1">
                          <Info className="w-3 h-3" />
                          Como fazer?
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            Estratégia: Vendas em Dias Lentos
                          </DialogTitle>
                          <DialogDescription>
                            Passo a passo para implementar esta melhoria.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">1</div>
                              <p className="text-sm">Vá em <strong>Configurações</strong> no menu lateral.</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">2</div>
                              <p className="text-sm">Localize a seção de <strong>Cupons de Desconto</strong>.</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">3</div>
                              <p className="text-sm">Crie um cupom chamado <code>TERCAOFF</code> (ou o dia em questão).</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">4</div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">Regra de Uso:</p>
                                <p className="text-sm text-muted-foreground">Divulgue em suas redes sociais que este cupom é válido <strong>apenas para pedidos feitos às terças e quintas-feiras</strong>.</p>
                              </div>
                            </div>
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex gap-2">
                              <Lightbulb className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                              <p className="text-xs text-yellow-800">Dica: Oferecer um brinde (ex: refrigerante grátis) nestes dias costuma ter um custo menor que um desconto em dinheiro e atrai muito mais clientes.</p>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-secondary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold">Potencializar seu Ticket Médio (Atual: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(analysis.ticketMedio)})</h3>
                  <p className="text-sm text-muted-foreground">
                    Sugerimos criar combos vinculando seus produtos campeões ({analysis.topProducts[0]?.name}) com itens que possuem menor saída. Isso aumenta o valor da venda e gira o estoque parado.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => navigate("/lojista/produtos")} className="text-xs h-8">
                      Organizar Categorias <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs h-8 gap-1">
                          <Info className="w-3 h-3" />
                          Como fazer?
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-secondary" />
                            Estratégia: Aumentar Ticket Médio
                          </DialogTitle>
                          <DialogDescription>
                            Passo a passo para implementar esta melhoria.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-xs font-bold text-secondary">1</div>
                              <p className="text-sm">Vá em <strong>Produtos</strong> e identifique seu produto campeão: <strong>{analysis.topProducts[0]?.name}</strong>.</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-xs font-bold text-secondary">2</div>
                              <p className="text-sm">Crie uma nova categoria chamada <strong>"Combos Especiais"</strong>.</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-xs font-bold text-secondary">3</div>
                              <p className="text-sm">Cadastre um combo que inclua o {analysis.topProducts[0]?.name} + <strong>{analysis.slowProducts[0]?.name}</strong> (item de baixa saída).</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 text-xs font-bold text-secondary">4</div>
                              <p className="text-sm">Coloque o preço do combo ligeiramente menor do que a soma dos itens separados. Isso incentiva o cliente a gastar mais para "ganhar" o desconto.</p>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold">Fidelização de Clientes</h3>
                  <p className="text-sm text-muted-foreground">
                    Seu sistema registrou {analysis.totalOrders} pedidos. Use a aba de relatórios para exportar os contatos dos clientes que mais compraram e envie uma mensagem personalizada de agradecimento criando um cupom de desconto especial para o cliente escolhido.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => navigate("/lojista/relatorio-clientes")} className="text-xs h-8">
                      Ver Clientes <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs h-8 gap-1">
                          <Info className="w-3 h-3" />
                          Como fazer?
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-green-600" />
                            Estratégia: Fidelização Ativa
                          </DialogTitle>
                          <DialogDescription>
                            Passo a passo para implementar esta melhoria.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-xs font-bold text-green-600">1</div>
                              <p className="text-sm">Acesse o <strong>Relatório de Clientes</strong> e identifique os 10 clientes mais frequentes.</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-xs font-bold text-green-600">2</div>
                              <p className="text-sm">Copie o número de WhatsApp desses clientes.</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-xs font-bold text-green-600">3</div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">Exemplo de Mensagem:</p>
                                <div className="bg-muted p-2 rounded text-xs italic">
                                  "Olá [Nome], notamos que você é um de nossos clientes preferidos! Como forma de agradecimento, criamos um cupom de desconto especial exclusivo para você usar em seu próximo pedido: [NOME-DO-CUPOM]!"
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-xs font-bold text-green-600">4</div>
                              <p className="text-sm">Isso cria um laço emocional forte e garante que a próxima venda seja feita com você e não com o concorrente.</p>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1. Horários Ociosos */}
          {analysis.idleHours.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold">Horários ociosos identificados</h3>
                    <p className="text-sm text-muted-foreground">
                      Nos horários <strong>{analysis.idleHours.map(h => `${h.hour}h`).join(", ")}</strong> seu movimento é significativamente abaixo da média. Crie um <strong>Happy Hour</strong> com desconto exclusivo nessas faixas para nivelar as vendas do dia.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        Pico: {analysis.peakHours.map(h => `${h.hour}h`).join(", ")}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => navigate("/lojista/configuracoes")} className="text-xs h-8">
                        Criar Cupom Happy Hour <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. Ticket médio vs meta */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold">
                    {analysis.ticketMedio < analysis.meta ? "Ticket médio abaixo da meta" : "Ticket médio saudável"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Ticket atual: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(analysis.ticketMedio)}</strong> • Meta sugerida (+15% da mediana): <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(analysis.meta)}</strong>.
                    {analysis.ticketMedio < analysis.meta && " Sugestão: ativar upsell no checkout (sobremesas, bebidas premium) e tornar as bordas/adicionais mais visíveis."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => navigate("/lojista/produtos")} className="text-xs h-8">
                      Configurar Adicionais <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Taxa de cancelamento */}
          {analysis.totalCancelados > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${analysis.taxaCancelamento > 8 ? "bg-red-100" : "bg-slate-100"}`}>
                    <XCircle className={`w-5 h-5 ${analysis.taxaCancelamento > 8 ? "text-red-600" : "text-slate-600"}`} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold">
                      Taxa de cancelamento: {analysis.taxaCancelamento.toFixed(1)}%
                      {analysis.taxaCancelamento > 8 && <Badge variant="destructive" className="ml-2">Atenção</Badge>}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {analysis.totalCancelados} pedidos cancelados/recusados em 90 dias. {analysis.taxaCancelamento > 8
                        ? "Acima do saudável (>8%). Investigue: tempo de aceite, produtos em falta, ou área de entrega inconsistente."
                        : "Dentro do saudável. Mantenha o tempo de aceite abaixo de 3 minutos para reduzir ainda mais."}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => navigate("/lojista/pedidos")} className="text-xs h-8">
                        Ver Cancelados <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. Retenção de clientes */}
          {analysis.totalClientes > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold">Retenção de clientes: {analysis.taxaRetencao.toFixed(0)}%</h3>
                    <p className="text-sm text-muted-foreground">
                      <strong>{analysis.clientesRecorrentes}</strong> de <strong>{analysis.totalClientes}</strong> clientes voltaram a comprar. {analysis.taxaRetencao < 30
                        ? "Baixa recorrência — foque em programa de fidelidade (cada 10ª compra grátis) e cupom de segunda compra."
                        : "Boa recorrência! Reforce com clube de vantagens para os clientes mais assíduos."}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => navigate("/lojista/relatorio-clientes")} className="text-xs h-8">
                        Ver Clientes Recorrentes <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 5. Tendência mensal */}
          {analysis.lastMonthKey && (
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${analysis.tendenciaPct >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                    <LineChart className={`w-5 h-5 ${analysis.tendenciaPct >= 0 ? "text-green-600" : "text-red-600"}`} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold">
                      Tendência: {analysis.tendenciaPct >= 0 ? "+" : ""}{analysis.tendenciaPct.toFixed(1)}% vs. mês anterior
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {analysis.tendenciaPct >= 0
                        ? "Faturamento em crescimento. Mantenha a frequência de posts e campanhas ativas."
                        : "Faturamento em queda. Recomendamos ativar campanha de reengajamento por WhatsApp e revisar preços do concorrente na região."}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => navigate("/lojista/financeiro")} className="text-xs h-8">
                        Ver Financeiro <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 6. Combos naturais (produtos comprados juntos) */}
          {analysis.topPairs.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold">Produtos comprados juntos</h3>
                    <p className="text-sm text-muted-foreground">
                      Seus clientes já combinam naturalmente esses itens. Transforme em combos oficiais com nome próprio e preço promocional para acelerar o pedido:
                    </p>
                    <ul className="text-sm space-y-1 pt-1">
                      {analysis.topPairs.map((p, i) => (
                        <li key={p.pair} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span><strong>{p.pair}</strong> — {p.count}x juntos</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => navigate("/lojista/produtos")} className="text-xs h-8">
                        Criar Combo <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 7. Reforço de dias fracos com ação prática */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold">Distribua o esforço da semana</h3>
                  <p className="text-sm text-muted-foreground">
                    Diferença entre o dia mais forte (<strong>{analysis.strongDays[0]?.day}</strong>) e o mais fraco (<strong>{analysis.weakDays[0]?.day}</strong>) sugere concentração de campanhas nos dias errados. Reserve seu maior investimento em anúncios para <strong>{analysis.weakDays[0]?.day}</strong> — no dia forte a demanda acontece naturalmente.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => navigate("/lojista/configuracoes")} className="text-xs h-8">
                      Programar Campanha <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Rodapé do Laudo (visível apenas na impressão) */}
      <div className="hidden print:block mt-12 pt-6 border-t border-slate-200">
        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          <strong>Aviso importante:</strong> As análises contidas neste laudo são geradas automaticamente com base em dados históricos de vendas e servem apenas como sugestões estratégicas. Toda e qualquer decisão de negócio deve ser tomada sob responsabilidade exclusiva do proprietário do estabelecimento.
        </p>
        <p className="text-[10px] text-slate-400 text-center mt-2 font-display">
          Gerado pelo Sistema de Inteligência - O Futuro do seu Delivery
        </p>
      </div>
    </div>
  );
};

export default ConsultorPage;