import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPhone } from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Clock,
  Star,
  MessageCircle,
  FileText,
  X,
  Printer,
  Pencil,
} from "lucide-react";

const statusMap: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
  confirmado: { label: "Confirmado", color: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  preparando: { label: "Preparando", color: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  pronto: { label: "Pronto", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  entregando: { label: "Entregando", color: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  entregue: { label: "Entregue", color: "bg-green-500/15 text-green-700 border-green-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/15 text-red-700 border-red-500/30" },
};

export default function ClientDetail() {
  const { telefone } = useParams<{ telefone: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    nome_completo: "",
    data_nascimento: "",
    whatsapp: "",
    endereco_rua: "",
    endereco_numero: "",
    endereco_bairro: "",
    endereco_complemento: "",
    endereco_cep: "",
  });

  const handlePrintReceipt = () => {
    if (!receiptOrder) return;
    const items = Array.isArray(receiptOrder.items)
      ? receiptOrder.items
      : typeof receiptOrder.items === "string"
        ? JSON.parse(receiptOrder.items)
        : [];
    const w = window.open("", "_blank", "width=300,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>Pedido Nº ${receiptOrder.id?.slice(0, 6)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 8px; width: 280px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .item { display: flex; justify-content: space-between; margin: 2px 0; }
        .total { font-size: 14px; font-weight: bold; }
        h2 { font-size: 16px; margin-bottom: 4px; }
      </style></head><body>
      <div class="center"><h2>Comprovante</h2></div>
      <div class="line"></div>
      <p class="bold">Pedido Nº ${receiptOrder.numero_diario ? String(receiptOrder.numero_diario).padStart(3, "0") : receiptOrder.id?.slice(0, 6).toUpperCase()}</p>
      <p>${new Date(receiptOrder.created_at).toLocaleString("pt-BR")}</p>
      <div class="line"></div>
      <p class="bold">Cliente: ${receiptOrder.cliente_nome || "—"}</p>
      <p>Tel: ${receiptOrder.cliente_telefone ? formatPhone(receiptOrder.cliente_telefone) : "—"}</p>
      ${receiptOrder.endereco_entrega ? `<p>End: ${receiptOrder.endereco_entrega}</p>` : ""}
      <div class="line"></div>
      <p class="bold">ITENS:</p>
      ${items
        .map((i: any) => {
          const name = i.nome || i.name || "Item";
          const qty = i.qtd || i.quantity || i.quantidade || 1;
          const price = i.preco || i.price || 0;
          return `<div class="item"><span>${qty}x ${i.weight && i.unidade_medida === "kg" ? `(${i.weight}kg) ` : ""}${name}</span><span>R$ ${Number(price).toFixed(2)}</span></div>
          ${i.tamanho ? `<p style="font-size:10px;color:#666;margin-left:12px;font-weight:bold;text-transform:uppercase">Tamanho: ${i.tamanho}</p>` : ""}
          ${i.sabores?.length ? `<p style="font-size:10px;color:#666;margin-left:12px">Sabores: ${i.sabores.join(" / ")}</p>` : ""}
          ${i.bordas?.length ? `<p style="font-size:10px;color:#666;margin-left:12px">Borda: ${i.bordas.join(", ")}</p>` : ""}
          ${i.observacao ? `<p style="font-size:10px;color:#666;margin-left:12px">Obs: ${i.observacao}</p>` : ""}
          ${(i.adicionais || []).length ? `<p style="font-size:10px;color:#666;margin-left:12px">+ ${(i.adicionais || []).map((a: any) => typeof a === "string" ? a : a.nome || a).join(", ")}</p>` : ""}`;
        })
        .join("")}
      <div class="line"></div>
      ${receiptOrder.observacoes ? `<p>Obs: ${receiptOrder.observacoes}</p><div class="line"></div>` : ""}
      <div class="item total"><span>TOTAL</span><span>R$ ${Number(receiptOrder.total).toFixed(2)}</span></div>
      ${(() => {
        const obs = receiptOrder.observacoes || "";
        const paymentMatch = obs.match(/Pagamento: ([^|]+)/);
        const changeMatch = obs.match(/Troco para: R\\$ ([^|]+)/);
        const payment = receiptOrder.forma_pagamento || (paymentMatch ? paymentMatch[1].trim() : "—");
        const changeVal = changeMatch ? changeMatch[1].trim().replace(",", ".") : null;
        const changeAmount = changeVal ? Number(changeVal) - Number(receiptOrder.total || 0) : null;
        return `
          <p>Pagamento: ${payment}</p>
          ${changeAmount && changeAmount > 0 ? `<p>Troco: R$ ${changeAmount.toFixed(2)}</p>` : ""}
        `;
      })()}
      ${(() => {
        const driverName = getEntregadorNome(receiptOrder.id);
        return driverName ? `<p>Entregador: ${driverName}</p>` : "";
      })()}
      <p>Tipo: ${receiptOrder.tipo || "delivery"}</p>
      <div class="line"></div>
      <p class="center" style="margin-top:8px">Obrigado pela preferência!</p>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };
  const decodedTelefone = decodeURIComponent(telefone || "");

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["client-orders", user?.id, decodedTelefone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", user!.id)
        .eq("cliente_telefone", decodedTelefone)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!decodedTelefone,
  });

  // Fetch client record for data_nascimento
  const { data: clienteRecord } = useQuery({
    queryKey: ["cliente-record", decodedTelefone],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("nome_completo, data_nascimento, endereco_rua, endereco_numero, endereco_bairro, endereco_complemento, endereco_cep")
        .eq("telefone", decodedTelefone)
        .maybeSingle();
      return data;
    },
    enabled: !!decodedTelefone,
  });

  useEffect(() => {
    if (clienteRecord || (pedidos.length > 0)) {
      setEditFormData({
        nome_completo: clienteRecord?.nome_completo || pedidos[0]?.cliente_nome || "",
        data_nascimento: clienteRecord?.data_nascimento || "",
        whatsapp: decodedTelefone,
        endereco_rua: clienteRecord?.endereco_rua || "",
        endereco_numero: clienteRecord?.endereco_numero || "",
        endereco_bairro: clienteRecord?.endereco_bairro || "",
        endereco_complemento: clienteRecord?.endereco_complemento || "",
        endereco_cep: clienteRecord?.endereco_cep || "",
      });
    }
  }, [clienteRecord, pedidos, decodedTelefone]);

  const updateClientMutation = useMutation({
    mutationFn: async (newData: typeof editFormData) => {
      const { error } = await supabase
        .from("clientes")
        .update({
          nome_completo: newData.nome_completo,
          data_nascimento: newData.data_nascimento || null,
          whatsapp: newData.whatsapp,
          endereco_rua: newData.endereco_rua,
          endereco_numero: newData.endereco_numero,
          endereco_bairro: newData.endereco_bairro,
          endereco_complemento: newData.endereco_complemento,
          endereco_cep: newData.endereco_cep,
        })
        .eq("telefone", decodedTelefone);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente-record", decodedTelefone] });
      queryClient.invalidateQueries({ queryKey: ["client-orders", user?.id, decodedTelefone] });
      toast.success("Cliente atualizado com sucesso!");
      setIsEditModalOpen(false);
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar cliente:", error);
      toast.error("Erro ao atualizar cliente.");
    },
  });
  const pedidoIds = pedidos.map((p) => p.id);
  const { data: entregas = [] } = useQuery({
    queryKey: ["client-entregas", pedidoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entregas")
        .select("pedido_id, entregador_id")
        .in("pedido_id", pedidoIds);
      if (error) throw error;
      // Fetch profiles for entregador names
      const entregadorIds = [...new Set((data || []).map((e) => e.entregador_id).filter(Boolean))] as string[];
      if (entregadorIds.length === 0) return (data || []).map((e) => ({ ...e, entregador_nome: null }));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", entregadorIds);
      const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.full_name]));
      return (data || []).map((e) => ({ ...e, entregador_nome: e.entregador_id ? nameMap[e.entregador_id] || null : null }));
    },
    enabled: pedidoIds.length > 0,
  });

  const getEntregadorNome = (pedidoId: string) => {
    const entrega = entregas.find((e) => e.pedido_id === pedidoId);
    return entrega?.entregador_nome || null;
  };

  const getFilteredPedidos = () => pedidos.filter((p) => {
    const d = new Date(p.created_at);
    if (filterDay !== "all" && d.getDate() !== Number(filterDay)) return false;
    if (filterMonth !== "all" && (d.getMonth() + 1) !== Number(filterMonth)) return false;
    if (filterYear !== "all" && d.getFullYear() !== Number(filterYear)) return false;
    return true;
  });

  const printReport = () => {
    const filtered = getFilteredPedidos();
    const fmt = (v: number) => `R$ ${v.toFixed(2)}`;
    const rows = filtered.map((p) => {
      const frete = Number(p.taxa_entrega) || 0;
      const totalPedido = Number(p.total);
      const valorProdutos = totalPedido - frete;
      const num = p.numero_diario ? String(p.numero_diario).padStart(3, "0") : "—";
      const driver = getEntregadorNome(p.id) || "—";
      return `<tr>
        <td>${num}</td>
        <td>${p.endereco_entrega?.split(",").pop()?.trim() || "—"}</td>
        <td>${driver}</td>
        <td style="text-align:right">${fmt(valorProdutos)}</td>
        <td style="text-align:right">${fmt(frete)}</td>
        <td style="text-align:right;font-weight:bold">${fmt(totalPedido)}</td>
      </tr>`;
    }).join("");

    const totalProdutos = filtered.reduce((s, p) => s + (Number(p.total) - (Number(p.taxa_entrega) || 0)), 0);
    const totalFrete = filtered.reduce((s, p) => s + (Number(p.taxa_entrega) || 0), 0);
    const totalGeral = filtered.reduce((s, p) => s + Number(p.total), 0);

    const w = window.open("", "_blank", "width=700,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>Relatório - ${pedidos[0]?.cliente_nome || "Cliente"}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size:12px; padding:20px; }
        h2 { margin-bottom:4px; }
        p.sub { color:#666; margin-bottom:12px; font-size:11px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; font-size:11px; }
        th { background:#f5f5f5; font-weight:bold; }
        tr:nth-child(even) { background:#fafafa; }
        .totals td { font-weight:bold; border-top:2px solid #333; }
      </style></head><body>
      <h2>Relatório de Pedidos — ${pedidos[0]?.cliente_nome || "Cliente"}</h2>
      <p class="sub">${filtered.length} pedido(s) | Filtros: ${filterDay !== "all" ? "Dia " + filterDay : ""} ${filterMonth !== "all" ? "Mês " + filterMonth : ""} ${filterYear !== "all" ? "Ano " + filterYear : ""} ${filterDay === "all" && filterMonth === "all" && filterYear === "all" ? "Todos" : ""}</p>
      <table>
        <thead><tr>
          <th>Nº Pedido</th><th>Bairro</th><th>Entregador</th>
          <th style="text-align:right">Produtos</th><th style="text-align:right">Taxa Entrega</th><th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}
          <tr class="totals">
            <td colspan="3">TOTAL (${filtered.length} pedidos)</td>
            <td style="text-align:right">${fmt(totalProdutos)}</td>
            <td style="text-align:right">${fmt(totalFrete)}</td>
            <td style="text-align:right">${fmt(totalGeral)}</td>
          </tr>
        </tbody>
      </table>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const clienteNome = pedidos[0]?.cliente_nome || "Cliente";
  const totalGasto = pedidos.reduce((acc, p) => acc + Number(p.total), 0);
  const ticketMedio = pedidos.length > 0 ? totalGasto / pedidos.length : 0;
  const primeiroPedido = pedidos.length > 0 ? pedidos[pedidos.length - 1].created_at : null;
  const ultimoPedido = pedidos.length > 0 ? pedidos[0].created_at : null;
  const pedidosEntregues = pedidos.filter((p) => p.status === "entregue").length;
  const pedidosCancelados = pedidos.filter((p) => p.status === "cancelado").length;

  const formatDateShort = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formatFull = (d: string) => `${formatDateShort(d)} às ${formatTime(d)}`;

  const whatsappLink = `https://wa.me/55${decodedTelefone.replace(/\D/g, "")}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/lojista/clientes")} className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar para clientes
      </Button>

      {/* Client Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
          {clienteNome.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground truncate">{clienteNome}</h1>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditModalOpen(true)}
              className="gap-2 shrink-0"
            >
              <Pencil className="w-4 h-4" />
              Editar Cliente
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {primeiroPedido && (
              <span>Cliente desde {formatDateShort(primeiroPedido)}</span>
            )}
            {clienteRecord?.data_nascimento && (
              <span>• Nascimento: {(() => { const [y,m,d] = clienteRecord.data_nascimento.split("-"); return `${d}/${m}/${y}`; })()}</span>
            )}
            {clienteRecord?.endereco_rua && (
              <span>• {clienteRecord.endereco_rua}, {clienteRecord.endereco_numero} {clienteRecord.endereco_bairro ? `- ${clienteRecord.endereco_bairro}` : ""}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: ShoppingCart, label: "Total Pedidos", value: pedidos.length, sub: `${pedidosEntregues} entregues`, iconColor: "text-primary" },
          { icon: TrendingUp, label: "Total Gasto", value: `R$ ${totalGasto.toFixed(2)}`, sub: "em todos os pedidos", iconColor: "text-emerald-500" },
          { icon: Star, label: "Ticket Médio", value: `R$ ${ticketMedio.toFixed(2)}`, sub: "por pedido", iconColor: "text-amber-500" },
          { icon: Clock, label: "Último Pedido", value: ultimoPedido ? new Date(ultimoPedido).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—", sub: pedidosCancelados > 0 ? `${pedidosCancelados} cancelado(s)` : "nenhum cancelado", iconColor: "text-sky-500" },
        ].map((s, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                </div>
                <div className="p-2 rounded-xl bg-muted/60">
                  <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Histórico de Pedidos</h2>
          <div className="flex items-center gap-2">
            <Select value={filterDay} onValueChange={setFilterDay}>
              <SelectTrigger className="h-8 w-[90px] text-xs">
                <SelectValue placeholder="Dia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Dia</SelectItem>
                {Array.from({ length: 31 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{String(i + 1).padStart(2, "0")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mês</SelectItem>
                {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="h-8 w-[90px] text-xs">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ano</SelectItem>
                {(() => {
                  const years = [...new Set(pedidos.map(p => new Date(p.created_at).getFullYear()))].sort((a, b) => b - a);
                  return years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>);
                })()}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={printReport}>
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {getFilteredPedidos().map((p) => {
            const st = statusMap[p.status] || { label: p.status, color: "bg-muted text-muted-foreground" };
            const items = Array.isArray(p.items) ? p.items : [];
            return (
              <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Left accent */}
                    <div className={`w-1 shrink-0 ${p.status === "entregue" ? "bg-green-500" : p.status === "cancelado" ? "bg-red-500" : "bg-primary"}`} />
                    <div className="flex-1 p-4 space-y-3">
                      {/* Top row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold text-foreground">
                            Pedido Nº {p.numero_diario ? String(p.numero_diario).padStart(3, "0") : "—"}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.color}`}>
                            {st.label}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
                            {p.tipo}
                          </span>
                        </div>
                        <span className="text-base font-bold text-foreground">
                          R$ {Number(p.total).toFixed(2)}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatFull(p.created_at)}
                        </span>
                        {p.endereco_entrega && (
                          <span className="flex items-center gap-1 truncate max-w-[250px]">
                            <MapPin className="w-3 h-3 shrink-0" /> {p.endereco_entrega}
                          </span>
                        )}
                      </div>

                      {/* Items */}
                      {items.length > 0 && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2 flex-1">
                              {items.map((item: any, i: number) => (
                                <span key={i} className="text-xs bg-muted/60 text-muted-foreground px-2 py-1 rounded-md">
                                  {item.quantidade || 1}x {item.weight && item.unidade_medida === "kg" ? `(${item.weight}kg) ` : ""}{item.nome || item.name}
                                </span>
                              ))}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 shrink-0 gap-1.5 text-primary"
                              onClick={(e) => { e.stopPropagation(); setReceiptOrder(p); }}
                            >
                              <FileText className="w-5 h-5" />
                              <span className="text-xs font-medium">Comprovante</span>
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Receipt Modal — matching delivery dashboard style */}
      <Dialog open={!!receiptOrder} onOpenChange={(o) => !o && setReceiptOrder(null)}>
        <DialogContent className="max-w-xs p-6 rounded-[32px] overflow-y-auto max-h-[90vh]">
          {receiptOrder && (() => {
            const items = Array.isArray(receiptOrder.items) ? receiptOrder.items : [];
            const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
            const subtotal = items.reduce((s: number, item: any) => s + (Number(item.preco || 0) * (item.quantidade || 1)), 0);
            const frete = Number(receiptOrder.taxa_entrega) || 0;
            const total = Number(receiptOrder.total);

            return (
              <div className="space-y-4 font-mono text-[10px]">
                <div className="border-b border-dashed pb-2 text-center flex flex-col items-center gap-2">
                  <div>
                    <p className="font-bold uppercase text-[11px] mb-0.5 tracking-tight">Comprovante</p>
                    <p className="font-bold uppercase mb-1 text-[10px]">
                      Nº {receiptOrder.numero_diario ? String(receiptOrder.numero_diario).padStart(3, "0") : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(receiptOrder.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 border-b border-dashed pb-2">
                  <p><span className="font-bold">CLIENTE:</span> {receiptOrder.cliente_nome || "Não informado"}</p>
                  {receiptOrder.cliente_telefone && <p><span className="font-bold">TEL:</span> {formatPhone(receiptOrder.cliente_telefone)}</p>}
                  <p><span className="font-bold">TIPO:</span> {receiptOrder.tipo === "delivery" ? "ENTREGA" : receiptOrder.tipo?.toUpperCase() || "ENTREGA"}</p>
                  {receiptOrder.endereco_entrega && <p><span className="font-bold">ENDEREÇO:</span> {receiptOrder.endereco_entrega}</p>}
                </div>

                <div className="space-y-1">
                  <p className="font-bold border-b border-dashed pb-1 mb-1">ITENS:</p>
                  {items.map((item: any, i: number) => (
                    <div key={i} className="flex flex-col mb-1">
                      <div className="flex justify-between">
                        <span>{item.quantidade || 1}x {item.weight && item.unidade_medida === "kg" ? `(${item.weight}kg) ` : ""}{item.nome || item.name}</span>
                        <span>{fmt(Number(item.preco || 0) * (item.quantidade || 1))}</span>
                      </div>
                      {item.sabores?.length > 0 && <p className="text-[8px] ml-2">• Sabores: {item.sabores.join(", ")}</p>}
                      {item.tamanho && <p className="text-[8px] ml-2">• Tamanho: {item.tamanho}</p>}
                      {item.bordas?.length > 0 && <p className="text-[8px] ml-2">• Bordas: {item.bordas.join(", ")}</p>}
                      {(item.adicionais || item.addons)?.length > 0 && (
                        <div className="ml-2">
                          <p className="text-[8px] font-bold">• Adicionais:</p>
                          {(item.adicionais || item.addons).map((a: any, idx: number) => (
                            <p key={idx} className="text-[8px] ml-1">
                              - {typeof a === "string" ? a : a.nome}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.observation && <p className="text-[8px] ml-2 italic">• Obs: {item.observation}</p>}
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed pt-2 space-y-1">
                  <div className="flex justify-between"><span>SUBTOTAL</span><span>{fmt(subtotal)}</span></div>
                  {frete > 0 && (
                    <div className="flex justify-between"><span>TAXA DE ENTREGA</span><span>{fmt(frete)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed">
                    <span>TOTAL</span><span>{fmt(total)}</span>
                  </div>
                </div>

                {(() => {
                  const obs = receiptOrder.observacoes || "";
                  const paymentMatch = obs.match(/Pagamento: ([^|]+)/);
                  const changeMatch = obs.match(/Troco para: R\$ ([^|]+)/);
                  const payment = receiptOrder.forma_pagamento || (paymentMatch ? paymentMatch[1].trim() : null);
                  const changeVal = changeMatch ? changeMatch[1].trim().replace(",", ".") : null;
                  const changeAmount = changeVal ? Number(changeVal) - total : null;

                  if (!payment && !receiptOrder.observacoes) return null;

                  return (
                    <div className="border-t border-dashed pt-2 space-y-1">
                      {payment && <p><span className="font-bold">PAGAMENTO:</span> {payment}</p>}
                      {changeAmount !== null && changeAmount > 0 && <p><span className="font-bold">TROCO:</span> {fmt(changeAmount)}</p>}
                      {receiptOrder.observacoes && <p><span className="font-bold">OBS:</span> {receiptOrder.observacoes}</p>}
                    </div>
                  );
                })()}

                <div className="pt-2 text-center text-[8px] text-muted-foreground uppercase">
                  Obrigado pela preferência!
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <Button
                    className="w-full font-black rounded-xl h-9"
                    size="sm"
                    onClick={handlePrintReceipt}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    IMPRIMIR
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full font-bold rounded-xl h-9 text-muted-foreground" 
                    size="sm"
                    onClick={() => setReceiptOrder(null)}
                  >
                    FECHAR
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input 
                id="nome" 
                value={editFormData.nome_completo} 
                onChange={(e) => setEditFormData({ ...editFormData, nome_completo: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nascimento">Nascimento</Label>
                <Input 
                  id="nascimento" 
                  type="date" 
                  value={editFormData.data_nascimento} 
                  onChange={(e) => setEditFormData({ ...editFormData, data_nascimento: e.target.value })} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input 
                  id="whatsapp" 
                  value={editFormData.whatsapp} 
                  onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })} 
                  placeholder="DDD + Número"
                />
              </div>
            </div>

            <Separator className="my-2" />
            <h3 className="font-semibold text-sm">Endereço</h3>
            
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 grid gap-2">
                <Label htmlFor="rua">Rua</Label>
                <Input 
                  id="rua" 
                  value={editFormData.endereco_rua} 
                  onChange={(e) => setEditFormData({ ...editFormData, endereco_rua: e.target.value })} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="numero">Nº</Label>
                <Input 
                  id="numero" 
                  value={editFormData.endereco_numero} 
                  onChange={(e) => setEditFormData({ ...editFormData, endereco_numero: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input 
                  id="bairro" 
                  value={editFormData.endereco_bairro} 
                  onChange={(e) => setEditFormData({ ...editFormData, endereco_bairro: e.target.value })} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cep">CEP</Label>
                <Input 
                  id="cep" 
                  value={editFormData.endereco_cep} 
                  onChange={(e) => setEditFormData({ ...editFormData, endereco_cep: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input 
                id="complemento" 
                value={editFormData.endereco_complemento} 
                onChange={(e) => setEditFormData({ ...editFormData, endereco_complemento: e.target.value })} 
              />
            </div>

            <p className="text-[10px] text-muted-foreground mt-2">
              Nota: Alterar o telefone não altera os pedidos passados vinculados a este número.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => updateClientMutation.mutate(editFormData)}
              disabled={updateClientMutation.isPending}
            >
              {updateClientMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
