import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Truck, Wallet, Users, Bike, FileText, Printer, Flame, Lock, Banknote, TrendingDown, Scale, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTrialStatus } from "@/hooks/useTrialStatus";


const months = [
  { value: "all", label: "Todos os meses" },
  { value: "0", label: "Janeiro" }, { value: "1", label: "Fevereiro" },
  { value: "2", label: "Março" }, { value: "3", label: "Abril" },
  { value: "4", label: "Maio" }, { value: "5", label: "Junho" },
  { value: "6", label: "Julho" }, { value: "7", label: "Agosto" },
  { value: "8", label: "Setembro" }, { value: "9", label: "Outubro" },
  { value: "10", label: "Novembro" }, { value: "11", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const Relatorios = ({ activeTabDefault }: { activeTabDefault?: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trialDays, daysRemaining, isExpired } = useTrialStatus();
  const isInTrial = !isExpired && trialDays > 0 && daysRemaining > 0;
  const [searchParams] = useSearchParams();
  const [clienteFilter, setClienteFilter] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(currentYear.toString());
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(activeTabDefault || "vendas");



  useEffect(() => {
    if (activeTabDefault) {
      setActiveTab(activeTabDefault);
      return;
    }
    const tab = searchParams.get("tab");
    if (tab && ["vendas", "mais-vendidos", "entregas", "caixa", "clientes", "entregador"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTabDefault]);

  const tabLabels: Record<string, string> = {
    vendas: "Vendas", "mais-vendidos": "+ Vendidos", entregas: "Entregas", caixa: "Caixa", clientes: "Clientes", entregador: "Entregador",
  };

  // Fetch loja
  const { data: loja } = useQuery({
    queryKey: ["relatorio-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch plano atual para controle de abas
  const { data: lojaPlano } = useQuery({
    queryKey: ["loja-plano-relatorios", loja?.id],
    queryFn: async () => {
      const { data: lp } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(slug, limites)")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .maybeSingle();
      return lp;
    },
    enabled: !!loja?.id,
  });

  const planoSlug = (lojaPlano as any)?.planos?.slug || "";
  const limitesAssinado = (lojaPlano as any)?.limites_assinado || {};
  const limitesPlano = (lojaPlano as any)?.planos?.limites || {};
  const mergedLimites = { ...limitesPlano, ...limitesAssinado };
  const isPlanProOrUltra = planoSlug === "pro" || planoSlug === "ultra" || isInTrial || !!mergedLimites.relatorios;



  // Fetch pedidos
  const { data: pedidos = [] } = useQuery({
    queryKey: ["relatorio-vendas", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch entregas
  const { data: entregas = [] } = useQuery({
    queryKey: ["relatorio-entregas", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas")
        .select("*")
        .eq("lojista_id", loja!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!loja?.id,
  });

  // Fetch clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["relatorio-clientes", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .eq("loja_id", loja!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!loja?.id,
  });

  // Fetch despesas
  const { data: despesas = [] } = useQuery({
    queryKey: ["relatorio-despesas", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("despesas")
        .select("*")
        .eq("loja_id", loja!.id)
        .order("data", { ascending: false });
      return data || [];
    },
    enabled: !!loja?.id,
  });

  // Fetch PDV orders
  const { data: pdvPedidos = [] } = useQuery({
    queryKey: ["relatorio-pdv-pedidos", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_pedidos")
        .select("*")
        .eq("loja_id", loja!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!loja?.id,
  });

  // Fetch entregadores profiles
  const { data: entregadores = [] } = useQuery({
    queryKey: ["relatorio-entregadores-profiles", loja?.id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("loja_entregadores")
        .select("entregador_id")
        .eq("loja_id", loja!.id);
      if (!links?.length) return [];
      const ids = links.map(l => l.entregador_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", ids);
      return profiles || [];
    },
    enabled: !!loja?.id,
  });

  // Fetch all products to get real categories
  const { data: produtosData = [] } = useQuery({
    queryKey: ["relatorio-produtos-categorias", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("nome, categoria")
        .eq("loja_id", loja!.id);
      return data || [];
    },
    enabled: !!loja?.id,
  });

  const productCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    produtosData.forEach(p => {
      if (p.nome) map[p.nome] = p.categoria || "Sem categoria";
    });
    return map;
  }, [produtosData]);

  const entregadorMap = useMemo(() => {
    const map: Record<string, string> = {};
    entregadores.forEach(e => { map[e.user_id] = e.full_name || "Sem nome"; });
    return map;
  }, [entregadores]);

  // Generic date filter
  const filterByDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (dateFrom && date < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo && date > new Date(dateTo + "T23:59:59")) return false;
    if (monthFilter !== "all" && date.getMonth() !== parseInt(monthFilter)) return false;
    return true;
  };

  // Rótulo do período pesquisado (para o relatório impresso)
  const buildPeriodLabel = () => {
    const parts: string[] = [];
    if (clienteFilter) parts.push(`Cliente: ${clienteFilter}`);
    if (dateFrom || dateTo) {
      const f = dateFrom ? format(new Date(dateFrom + "T00:00:00"), "dd/MM/yyyy") : "início";
      const t = dateTo ? format(new Date(dateTo + "T00:00:00"), "dd/MM/yyyy") : "hoje";
      parts.push(`Dias: ${f} a ${t}`);
    }
    if (monthFilter !== "all") {
      const mLabel = months.find(m => m.value === monthFilter)?.label;
      if (mLabel) parts.push(`Mês: ${mLabel}`);
    }
    return parts.length ? parts.join(" • ") : "Todos os registros";
  };

  // ===== VENDAS =====
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      if (!filterByDate(p.created_at)) return false;
      if (clienteFilter && !(p.cliente_nome || "").toLowerCase().includes(clienteFilter.toLowerCase())) return false;
      return true;
    });
  }, [pedidos, clienteFilter, dateFrom, dateTo, monthFilter, yearFilter]);

  const vendasRows = useMemo(() => {
    return filteredPedidos.map(p => {
      const entrega = entregas.find(e => e.pedido_id === p.id);
      const items = Array.isArray(p.items) ? p.items : [];
      const qtd = items.reduce((sum: number, item: any) => sum + (item.quantity || item.qtd || 1), 0);
      return {
        id: p.id,
        numero: p.numero_diario || "—",
        data: p.created_at,
        cliente: p.cliente_nome || "—",
        entregador: entrega?.entregador_id ? (entregadorMap[entrega.entregador_id] || "—") : "—",
        bairro: p.endereco_entrega ? extractBairro(p.endereco_entrega) : "—",
        qtd_itens: qtd,
        valor_entrega: entrega?.valor_entrega || p.taxa_entrega || 0,
        valor_pedido: p.total - (p.taxa_entrega || 0),
        total: p.total,
        pedido: p,
      };
    });
  }, [filteredPedidos, entregas, entregadorMap]);

  // ===== ENTREGAS =====
  const filteredEntregas = useMemo(() => {
    return entregas.filter(e => {
      if (!filterByDate(e.created_at)) return false;
      return true;
    });
  }, [entregas, dateFrom, dateTo, monthFilter, yearFilter]);

  // ===== CAIXA =====
  const filteredDespesas = useMemo(() => {
    return despesas.filter(d => filterByDate(d.data));
  }, [despesas, dateFrom, dateTo, monthFilter, yearFilter]);

  const caixaEntradas = useMemo(() => filteredPedidos.reduce((s, p) => s + p.total, 0), [filteredPedidos]);
  const caixaSaidas = useMemo(() => filteredDespesas.reduce((s, d) => s + d.valor, 0), [filteredDespesas]);

  // ===== CLIENTES =====
  const filteredClientes = useMemo(() => {
    return clientes
      .filter(c => {
        if (!filterByDate(c.created_at)) return false;
        if (clienteFilter && !c.nome_completo.toLowerCase().includes(clienteFilter.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => (a.nome_completo || "").localeCompare(b.nome_completo || "", "pt-BR"));
  }, [clientes, clienteFilter, dateFrom, dateTo, monthFilter, yearFilter]);

  // ===== ENTREGADOR =====
  const entregadorStats = useMemo(() => {
    return entregadores.map(e => {
      const entregasDoEntregador = filteredEntregas.filter(en => en.entregador_id === e.user_id);
      const concluidas = entregasDoEntregador.filter(en => en.status === "entregue" || en.status === "finalizada");
      const totalValor = entregasDoEntregador.reduce((s, en) => s + (en.valor_entrega || 0), 0);
      return {
        id: e.user_id,
        nome: e.full_name || "Sem nome",
        telefone: e.phone || "—",
        total_entregas: entregasDoEntregador.length,
        concluidas: concluidas.length,
        pendentes: entregasDoEntregador.filter(en => en.status === "pendente").length,
        valor_total: totalValor,
      };
    });
  }, [entregadores, filteredEntregas]);

  // ===== MAIS VENDIDOS =====
  const filteredMaisVendidos = useMemo(() => {
    const productSales: Record<string, { nome: string; categoria: string; qtd: number; total: number }> = {};
    
    const processItems = (items: any[], date: string, status: string, isPdv: boolean) => {
      if (!filterByDate(date)) return;
      if (isPdv) {
        if (!["finalizado", "fechado"].includes(status)) return;
      } else {
        if (!["finalizado", "entregue"].includes(status)) return;
      }

      items.forEach((item: any) => {
        const nome = item.nome || item.name || "Sem nome";
        const categoria = productCategoryMap[nome] || item.categoria || item.category || "Sem categoria";
        const qtd = Number(item.quantity || item.quantidade || item.qtd || 1);
        const preco = Number(item.preco || item.price || 0);

        if (!productSales[nome]) {
          productSales[nome] = { nome, categoria, qtd: 0, total: 0 };
        }
        productSales[nome].qtd += qtd;
        productSales[nome].total += (qtd * preco);
      });
    };

    pedidos.forEach(p => processItems(Array.isArray(p.items) ? p.items : [], p.created_at, p.status, false));
    pdvPedidos.forEach(p => processItems(Array.isArray(p.items) ? p.items : [], p.created_at, p.status, true));

    return Object.values(productSales).sort((a, b) => b.qtd - a.qtd);
  }, [pedidos, pdvPedidos, productCategoryMap, dateFrom, dateTo, monthFilter, yearFilter]);

  // ===== PRINT =====
  const handlePrintReport = () => {
    const originalTitle = document.title;
    document.title = "Relatório";
    const titulo = "Relatório de " + (tabLabels[activeTab] || "Vendas");
    let tableHead = "";
    let tableRows = "";
    let footerHtml = "";

    if (activeTab === "vendas") {
      // Layout especial (igual ao Histórico de Pedidos) com cards no topo
      const totalRevenue = vendasRows.reduce((s, r) => s + r.total, 0);
      const totalEntregasValor = vendasRows.reduce((s, r) => s + r.valor_entrega, 0);
      const totalItens = vendasRows.reduce((s, r) => s + r.qtd_itens, 0);
      const ticketMedio = vendasRows.length > 0 ? totalRevenue / vendasRows.length : 0;
      const periodLabel = buildPeriodLabel();

      const rows = vendasRows.map((r, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f2f2f2";
        return `<tr style="background:${bg};">
          <td style="border:1px solid #999;padding:3px 6px;white-space:nowrap;">${format(new Date(r.data), "dd/MM/yy HH:mm")}</td>
          <td style="border:1px solid #999;padding:3px 6px;text-align:center;font-weight:bold;">${String(r.numero).padStart(2, "0")}</td>
          <td style="border:1px solid #999;padding:3px 6px;">${r.cliente}</td>
          <td style="border:1px solid #999;padding:3px 6px;">${r.bairro}</td>
          <td style="border:1px solid #999;padding:3px 6px;">${r.entregador}</td>
          <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${r.qtd_itens}</td>
          <td style="border:1px solid #999;padding:3px 6px;text-align:right;">${formatCurrency(r.valor_pedido)}</td>
          <td style="border:1px solid #999;padding:3px 6px;text-align:right;">${formatCurrency(r.valor_entrega)}</td>
          <td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold;">${formatCurrency(r.total)}</td>
        </tr>`;
      }).join("");

      const htmlVendas = `<html><head><title>Relatório de Vendas</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 20px; font-family: Arial, sans-serif; font-size: 10px; color: #222; }
          @media print { body { margin: 10px; } }
        </style></head><body>
        <div style="border-bottom:3px solid #2563EB;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <h1 style="margin:0;font-size:16px;color:#2563EB;">Relatório de Vendas</h1>
            <p style="margin:2px 0 0;font-size:10px;color:#666;">Período: ${periodLabel}</p>
          </div>
          <div style="text-align:right;font-size:9px;color:#888;">
            Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
          <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
            <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total Pedidos</div>
            <div style="font-size:14px;font-weight:bold;color:#222;">${vendasRows.length}</div>
          </div>
          <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
            <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Receita Total</div>
            <div style="font-size:14px;font-weight:bold;color:#16a34a;">${formatCurrency(totalRevenue)}</div>
          </div>
          <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
            <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Ticket Médio</div>
            <div style="font-size:14px;font-weight:bold;color:#222;">${formatCurrency(ticketMedio)}</div>
          </div>
          <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
            <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total Itens</div>
            <div style="font-size:14px;font-weight:bold;color:#222;">${totalItens}</div>
          </div>
          <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
            <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total Entregas</div>
            <div style="font-size:14px;font-weight:bold;color:#222;">${formatCurrency(totalEntregasValor)}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead>
            <tr style="background:#2563EB;color:#fff;">
              <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Data/Hora</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:center;">PNº</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Cliente</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Bairro</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Entregador</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Qtd</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Pedido</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Entrega</th>
              <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:10px;display:flex;justify-content:flex-end;">
          <div style="background:#e5e7eb;border:1px solid #999;padding:6px 12px;font-weight:bold;font-size:11px;">
            TOTAL GERAL: <span style="color:#16a34a;margin-left:8px;">${formatCurrency(totalRevenue)}</span>
          </div>
        </div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script>
        </body></html>`;

      const wv = window.open("", "_blank");
      if (wv) {
        wv.document.write(htmlVendas);
        wv.document.close();
        setTimeout(() => { document.title = originalTitle; }, 1000);
      }
      return;
    }

    if (activeTab === "entregas") {
      tableHead = "<th>Data</th><th>Entregador</th><th>Endereço Coleta</th><th>Endereço Entrega</th><th>Status</th><th class='right'>Valor</th>";
      tableRows = filteredEntregas.map((e, i) =>
        `<tr class="${i % 2 === 0 ? 'even' : 'odd'}"><td class="nowrap">${format(new Date(e.created_at), "dd/MM/yy HH:mm")}</td><td>${e.entregador_id ? (entregadorMap[e.entregador_id] || "—") : "—"}</td><td>${e.endereco_coleta || "—"}</td><td>${e.endereco_entrega || "—"}</td><td>${e.status}</td><td class="right">${formatCurrency((e.valor_entrega || 0))}</td></tr>`
      ).join("");
      const t = filteredEntregas.reduce((s, e) => s + (e.valor_entrega || 0), 0);
      footerHtml = `<p class="footer">${filteredEntregas.length} entrega(s) — Total: ${formatCurrency(t)}</p>`;
    } else if (activeTab === "caixa") {
      tableHead = "<th>Tipo</th><th>Data</th><th>Descrição</th><th>Categoria</th><th class='right'>Valor</th>";
      const caixaRows = [
        ...filteredPedidos.map(p => ({ tipo: "Entrada", data: p.created_at, desc: `Pedido Nº ${p.numero_diario || "—"} - ${p.cliente_nome || "Cliente"}`, cat: p.tipo, valor: p.total })),
        ...filteredDespesas.map(d => ({ tipo: "Saída", data: d.data, desc: d.descricao, cat: d.categoria, valor: -d.valor })),
      ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      tableRows = caixaRows.map((r, i) =>
        `<tr class="${i % 2 === 0 ? 'even' : 'odd'}"><td class="${r.tipo === 'Entrada' ? '' : 'bold'}">${r.tipo}</td><td class="nowrap">${format(new Date(r.data), "dd/MM/yy")}</td><td>${r.desc}</td><td>${r.cat}</td><td class="right ${r.valor >= 0 ? '' : 'bold'}">${r.valor >= 0 ? '' : '-'}${formatCurrency(Math.abs(r.valor))}</td></tr>`
      ).join("");
      footerHtml = `<p class="footer">Entradas: ${formatCurrency(caixaEntradas)} | Saídas: ${formatCurrency(caixaSaidas)} | Saldo: ${formatCurrency((caixaEntradas - caixaSaidas))}</p>`;
    } else if (activeTab === "clientes") {
      tableHead = "<th>Nome</th><th>Telefone</th><th>WhatsApp</th><th>Bairro</th><th>Cidade</th><th>Desde</th>";
      tableRows = filteredClientes.map((c, i) =>
        `<tr class="${i % 2 === 0 ? 'even' : 'odd'}"><td>${c.nome_completo}</td><td>${c.telefone}</td><td>${c.whatsapp || "—"}</td><td>${c.endereco_bairro || "—"}</td><td>${c.endereco_cidade || "—"}</td><td class="nowrap">${format(new Date(c.created_at), "dd/MM/yy")}</td></tr>`
      ).join("");
      footerHtml = `<p class="footer">${filteredClientes.length} cliente(s)</p>`;
    } else if (activeTab === "entregador") {
      tableHead = "<th>Nome</th><th>Telefone</th><th class='center'>Total</th><th class='center'>Concluídas</th><th class='center'>Pendentes</th><th class='right'>Valor</th>";
      tableRows = entregadorStats.map((e, i) =>
        `<tr class="${i % 2 === 0 ? 'even' : 'odd'}"><td>${e.nome}</td><td>${e.telefone}</td><td class="center">${e.total_entregas}</td><td class="center">${e.concluidas}</td><td class="center">${e.pendentes}</td><td class="right">${formatCurrency(e.valor_total)}</td></tr>`
      ).join("");
      footerHtml = `<p class="footer">${entregadorStats.length} entregador(es)</p>`;
    } else if (activeTab === "mais-vendidos") {
      tableHead = "<th>Posição</th><th>Produto</th><th>Categoria</th><th class='center'>Qtd Vendida</th><th class='right'>Total Bruto</th>";
      tableRows = filteredMaisVendidos.map((p, i) =>
        `<tr class="${i % 2 === 0 ? 'even' : 'odd'}"><td class="center font-bold">#${i + 1}</td><td>${p.nome}</td><td>${p.categoria}</td><td class="center">${p.qtd}</td><td class="right bold">${formatCurrency(p.total)}</td></tr>`
      ).join("");
      const t = filteredMaisVendidos.reduce((s, p) => s + p.total, 0);
      const q = filteredMaisVendidos.reduce((s, p) => s + p.qtd, 0);
      footerHtml = `<p class="footer">${filteredMaisVendidos.length} produto(s) — Qtd Total: ${q} — Total Bruto: ${formatCurrency(t)}</p>`;
    }

    const html = `<html><head><title>${titulo}</title>
      <style>
        @page { margin: 15mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; font-size: 10px; color: #222; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
        .header h2 { margin: 0; font-size: 16px; font-weight: 700; }
        .header .meta { font-size: 9px; color: #666; text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th { background: #2563eb; color: #fff; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; padding: 5px 6px; text-align: left; border: none; }
        td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        tr.even td { background: #f8fafc; }
        tr.odd td { background: #fff; }
        .mono { font-family: 'Courier New', monospace; font-weight: 600; }
        .nowrap { white-space: nowrap; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: 700; }
        .footer { margin-top: 12px; font-size: 12px; font-weight: 700; text-align: right; border-top: 2px solid #2563eb; padding-top: 8px; }
      </style>
      </head><body>
      <div class="header">
        <h2>${titulo}</h2>
        <div class="meta">Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      </div>
      <table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table>
      ${footerHtml}
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { 
      w.document.write(html); 
      w.document.close();
      // Restaurar o título original após um delay
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }
  };

  // Shared filters component
  const renderFilters = (showClienteFilter = false) => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {showClienteFilter && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
            <Select value={clienteFilter || "__all__"} onValueChange={v => setClienteFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Filtro cliente..." />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                  <Input
                    autoFocus
                    placeholder="Buscar cliente..."
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-8 text-sm"
                  />
                </div>
                <SelectItem value="__all__">Todos os clientes</SelectItem>
                {[...clientes]
                  .filter((c) =>
                    (c.nome_completo || "")
                      .toLowerCase()
                      .includes(clienteSearch.toLowerCase())
                  )
                  .sort((a, b) => (a.nome_completo || "").localeCompare(b.nome_completo || "", "pt-BR", { sensitivity: "base" }))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.nome_completo}>
                      {c.nome_completo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">De</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Até</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => handlePrintReport()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>
    </div>
  );

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pendente: "Pendente", aceita: "Aceita", em_transito: "Em trânsito", entregue: "Entregue", finalizada: "Finalizada", cancelada: "Cancelada" };
    return map[s] || s;
  };

  const isStartPlan = (lojaPlano as any)?.planos?.slug === "start";

  if (isStartPlan && ["vendas", "mais-vendidos", "caixa", "clientes"].includes(activeTab)) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold font-display">Acesso Bloqueado</h1>
        <p className="text-muted-foreground max-w-sm">
          A página de relatórios <strong>{tabLabels[activeTab]}</strong> não está disponível no plano Start.
        </p>
        <Button onClick={() => navigate("/lojista/plano")} className="font-bold">
          Fazer Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Relatório de {tabLabels[activeTab] || "Vendas"}</h1>
          <p className="text-sm text-muted-foreground">Visualize e imprima relatórios detalhados de {(tabLabels[activeTab] || "vendas").toLowerCase()}.</p>
        </div>
        {activeTab === "vendas" && (
          <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-2 sm:ml-auto w-full sm:w-auto">
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
                <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{vendasRows.length}</p>
                  <p className="text-[10px] text-muted-foreground">Pedidos</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[150px]">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(vendasRows.reduce((s, r) => s + r.total, 0))}</p>
                  <p className="text-[10px] text-muted-foreground">Valor dos pedidos</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {activeTab === "caixa" && (
          <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-2 sm:ml-auto w-full sm:w-auto">
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{formatCurrency(caixaEntradas)}</p>
                  <p className="text-[10px] text-muted-foreground">Entradas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{formatCurrency(caixaSaidas)}</p>
                  <p className="text-[10px] text-muted-foreground">Saídas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${caixaEntradas - caixaSaidas >= 0 ? "bg-primary/10" : "bg-red-500/10"}`}>
                  <Scale className={`w-4 h-4 ${caixaEntradas - caixaSaidas >= 0 ? "text-primary" : "text-red-600"}`} />
                </div>
                <div>
                  <p className={`text-sm sm:text-lg font-bold font-display leading-tight tabular-nums ${caixaEntradas - caixaSaidas >= 0 ? "" : "text-red-600"}`}>{formatCurrency(caixaEntradas - caixaSaidas)}</p>
                  <p className="text-[10px] text-muted-foreground">Saldo</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {!activeTabDefault && (
            <TabsList className="flex w-full mb-6 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="caixa" className="flex-1 text-xs">Caixa</TabsTrigger>
              <TabsTrigger value="clientes" className="flex-1 text-xs">Clientes</TabsTrigger>
              <TabsTrigger value="entregas" className="flex-1 text-xs">Entregas</TabsTrigger>
              <TabsTrigger 
                value="entregador" 
                disabled={!isPlanProOrUltra}
                className={`flex-1 text-xs flex items-center justify-center gap-1 ${!isPlanProOrUltra ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                Entregador {!isPlanProOrUltra && <Lock className="w-3 h-3" />}
              </TabsTrigger>
              <TabsTrigger value="mais-vendidos" className="flex-1 text-xs">Mais Vendidos</TabsTrigger>
              <TabsTrigger value="vendas" className="flex-1 text-xs">Vendas</TabsTrigger>
            </TabsList>
          )}


        {/* ===== VENDAS ===== */}
        {activeTab === "vendas" && (
          <div className="space-y-4">
            {renderFilters(true)}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 [&>th]:py-1.5 [&>th]:px-2">
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">PNº</TableHead>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Bairro</TableHead>
                        <TableHead className="text-xs">Entregador</TableHead>
                        <TableHead className="text-xs text-center">Qtd</TableHead>
                        <TableHead className="text-xs text-right">Pedido</TableHead>
                        <TableHead className="text-xs text-right">Entrega</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-center">Comp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendasRows.length === 0 ? (
                        <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma venda encontrada</TableCell></TableRow>
                      ) : vendasRows.map(row => (
                        <TableRow key={row.id} className="[&>td]:py-0 [&>td]:px-1.5">
                          <TableCell className="text-[11px] whitespace-nowrap">{format(new Date(row.data), "dd/MM/yy HH:mm")}</TableCell>
                          <TableCell className="text-[11px] font-mono font-semibold">{String(row.numero).padStart(2, "0")}</TableCell>
                          <TableCell className="text-[11px] max-w-[140px] truncate">{row.cliente}</TableCell>
                          <TableCell className="text-[11px] max-w-[100px] truncate">{row.bairro}</TableCell>
                          <TableCell className="text-[11px] max-w-[100px] truncate">{row.entregador}</TableCell>
                          <TableCell className="text-[11px] text-center">{row.qtd_itens}</TableCell>
                          <TableCell className="text-[11px] text-right">{formatCurrency(row.valor_pedido)}</TableCell>
                          <TableCell className="text-[11px] text-right">{formatCurrency(row.valor_entrega)}</TableCell>
                          <TableCell className="text-[11px] text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReceiptOrder(row.pedido)}>
                              <FileText className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {vendasRows.length > 0 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/20 text-sm font-semibold">
                    <span>{vendasRows.length} venda(s)</span>
                    <span>Total: {formatCurrency(vendasRows.reduce((s, r) => s + r.total, 0))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== MAIS VENDIDOS ===== */}
        {activeTab === "mais-vendidos" && (
          <div className="space-y-4">
            {renderFilters(false)}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 [&>th]:py-1.5 [&>th]:px-2">
                        <TableHead className="text-xs text-center w-16">Posição</TableHead>
                        <TableHead className="text-xs">Produto</TableHead>
                        <TableHead className="text-xs">Categoria</TableHead>
                        <TableHead className="text-xs text-center">Qtd Vendida</TableHead>
                        <TableHead className="text-xs text-right">Total Bruto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMaisVendidos.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma venda registrada no período</TableCell></TableRow>
                      ) : filteredMaisVendidos.map((p, i) => (
                        <TableRow key={p.nome} className="[&>td]:py-2 [&>td]:px-2">
                          <TableCell className="text-xs text-center font-bold">#{i + 1}</TableCell>
                          <TableCell className="text-xs font-semibold">{p.nome}</TableCell>
                          <TableCell className="text-xs">{p.categoria}</TableCell>
                          <TableCell className="text-xs text-center">{p.qtd}</TableCell>
                          <TableCell className="text-xs text-right font-bold">{formatCurrency(p.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredMaisVendidos.length > 0 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/20 text-sm font-semibold">
                    <span>{filteredMaisVendidos.length} produto(s)</span>
                    <span>Total Bruto: {formatCurrency(filteredMaisVendidos.reduce((s, p) => s + p.total, 0))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}


        {/* ===== ENTREGAS ===== */}
        {activeTab === "entregas" && (
          <div className="space-y-4">
            {renderFilters(false)}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 [&>th]:py-1.5 [&>th]:px-2">
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Entregador</TableHead>
                        <TableHead className="text-xs">End. Coleta</TableHead>
                        <TableHead className="text-xs">End. Entrega</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Valor Entrega</TableHead>
                        <TableHead className="text-xs text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntregas.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma entrega encontrada</TableCell></TableRow>
                      ) : filteredEntregas.map(e => (
                        <TableRow key={e.id} className="text-sm [&>td]:py-1 [&>td]:px-2">
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.created_at), "dd/MM/yy HH:mm")}</TableCell>
                          <TableCell className="text-xs">{e.entregador_id ? (entregadorMap[e.entregador_id] || "—") : "Sem entregador"}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{e.endereco_coleta || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{e.endereco_entrega || "—"}</TableCell>
                          <TableCell className="text-xs capitalize">{statusLabel(e.status)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency((e.valor_entrega || 0))}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{formatCurrency((e.valor_total || 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredEntregas.length > 0 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/20 text-sm font-semibold">
                    <span>{filteredEntregas.length} entrega(s)</span>
                    <span>Total: {formatCurrency(filteredEntregas.reduce((s, e) => s + (e.valor_entrega || 0), 0))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== CAIXA ===== */}
        {activeTab === "caixa" && (
          <div className="space-y-4">
            {renderFilters(false)}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 [&>th]:py-1.5 [&>th]:px-2">
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs">Categoria</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const caixaRows = [
                          ...filteredPedidos.map(p => ({ id: "p-" + p.id, tipo: "Entrada" as const, data: p.created_at, desc: `Pedido Nº ${p.numero_diario || "—"} - ${p.cliente_nome || "Cliente"}`, cat: p.tipo, valor: p.total })),
                          ...filteredDespesas.map(d => ({ id: "d-" + d.id, tipo: "Saída" as const, data: d.data, desc: d.descricao, cat: d.categoria, valor: d.valor })),
                        ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
                        if (caixaRows.length === 0) return <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum movimento encontrado</TableCell></TableRow>;
                        return caixaRows.map(r => (
                          <TableRow key={r.id} className="text-sm [&>td]:py-1 [&>td]:px-2">
                            <TableCell className={`text-xs font-semibold ${r.tipo === "Entrada" ? "text-green-600" : "text-red-500"}`}>{r.tipo}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.data), "dd/MM/yy")}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{r.desc}</TableCell>
                            <TableCell className="text-xs capitalize">{r.cat}</TableCell>
                            <TableCell className={`text-xs text-right font-semibold ${r.tipo === "Entrada" ? "text-green-600" : "text-red-500"}`}>
                              {r.tipo === "Saída" ? "-" : ""}{formatCurrency(r.valor)}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== CLIENTES ===== */}
        {activeTab === "clientes" && (
          <div className="space-y-4">
            {renderFilters(true)}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 [&>th]:py-1.5 [&>th]:px-2">
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">Telefone</TableHead>
                        <TableHead className="text-xs">WhatsApp</TableHead>
                        <TableHead className="text-xs">Aniversário</TableHead>
                        <TableHead className="text-xs">Desde</TableHead>
                        <TableHead className="text-xs">Bairro</TableHead>
                        <TableHead className="text-xs">Cidade</TableHead>
                        <TableHead className="text-xs text-center">Pedidos</TableHead>
                        <TableHead className="text-xs text-right">Total Gasto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientes.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</TableCell></TableRow>
                      ) : filteredClientes.map(c => {
                        const clientePedidos = pedidos.filter(p => p.cliente_telefone === c.telefone);
                        const qtdPedidos = clientePedidos.length;
                        const totalGasto = clientePedidos.reduce((s, p) => s + p.total, 0);
                        return (
                        <TableRow key={c.id} className="text-sm [&>td]:py-1 [&>td]:px-2">
                          <TableCell className="text-xs font-medium">{c.nome_completo}</TableCell>
                          <TableCell className="text-xs">{c.telefone}</TableCell>
                          <TableCell className="text-xs">{c.whatsapp || "—"}</TableCell>
                          <TableCell className="text-xs">{c.data_nascimento ? format(new Date(c.data_nascimento + "T12:00:00"), "dd/MM") : "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                          <TableCell className="text-xs">{c.endereco_bairro || "—"}</TableCell>
                          <TableCell className="text-xs">{c.endereco_cidade || "—"}</TableCell>
                          <TableCell className="text-xs text-center font-semibold">{qtdPedidos}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{formatCurrency(totalGasto)}</TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {filteredClientes.length > 0 && (
                  <div className="px-4 py-3 border-t bg-muted/20 text-sm font-semibold">
                    {filteredClientes.length} cliente(s)
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== ENTREGADOR ===== */}
        {activeTab === "entregador" && (
          <div className="space-y-4">
            {renderFilters(false)}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 [&>th]:py-1.5 [&>th]:px-2">
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">Telefone</TableHead>
                        <TableHead className="text-xs text-center">Total Entregas</TableHead>
                        <TableHead className="text-xs text-center">Concluídas</TableHead>
                        <TableHead className="text-xs text-center">Pendentes</TableHead>
                        <TableHead className="text-xs text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entregadorStats.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum entregador encontrado</TableCell></TableRow>
                      ) : entregadorStats.map(e => (
                        <TableRow key={e.id} className="text-sm [&>td]:py-1 [&>td]:px-2">
                          <TableCell className="text-xs font-medium">{e.nome}</TableCell>
                          <TableCell className="text-xs">{e.telefone}</TableCell>
                          <TableCell className="text-xs text-center">{e.total_entregas}</TableCell>
                          <TableCell className="text-xs text-center text-green-600 font-semibold">{e.concluidas}</TableCell>
                          <TableCell className="text-xs text-center text-orange-500 font-semibold">{e.pendentes}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{formatCurrency(e.valor_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {entregadorStats.length > 0 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/20 text-sm font-semibold">
                    <span>{entregadorStats.length} entregador(es)</span>
                    <span>Total: {formatCurrency(entregadorStats.reduce((s, e) => s + e.valor_total, 0))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        </Tabs>
      </div>


      {/* Receipt Dialog */}
      <Dialog open={!!receiptOrder} onOpenChange={() => setReceiptOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comprovante Nº {receiptOrder?.numero_diario || "—"}</DialogTitle>
          </DialogHeader>
          {receiptOrder && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Data:</span><span>{format(new Date(receiptOrder.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span>{receiptOrder.cliente_nome || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Telefone:</span><span>{receiptOrder.cliente_telefone || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="capitalize">{receiptOrder.tipo}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Endereço:</span><span className="text-right max-w-[200px]">{receiptOrder.endereco_entrega || "—"}</span></div>
              <hr />
              <div className="font-semibold">Itens:</div>
              <div className="space-y-1">
                {(Array.isArray(receiptOrder.items) ? receiptOrder.items : []).map((item: any, i: number) => (
                  <div key={i} className="flex flex-col text-xs">
                    <div className="flex justify-between">
                      <span>{item.quantity || item.qtd || 1}x {item.name || item.nome}</span>
                      <span>{formatCurrency(((item.price || item.preco || 0) * (item.quantity || item.qtd || 1)))}</span>
                    </div>
                    {item.weight && (
                      <span className="text-[10px] text-primary font-bold">
                        Peso: {item.weight}{item.unidade_medida === "kg" ? "g" : "ml"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <hr />
              {(receiptOrder.taxa_entrega || 0) > 0 && (
                <div className="flex justify-between text-xs"><span>Taxa de entrega</span><span>{formatCurrency((receiptOrder.taxa_entrega || 0))}</span></div>
              )}
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(receiptOrder.total)}</span></div>
              {receiptOrder.observacoes && (
                <div className="text-xs text-muted-foreground mt-2"><strong>Obs:</strong> {receiptOrder.observacoes}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function extractBairro(endereco: string): string {
  const parts = endereco.split(",").map(p => p.trim());
  if (parts.length >= 3) return parts[2];
  if (parts.length >= 2) return parts[1];
  return endereco;
}

export default Relatorios;
