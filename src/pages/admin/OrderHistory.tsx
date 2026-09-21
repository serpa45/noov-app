import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, CalendarIcon, Package, Printer, Bike, Star, GripVertical, DollarSign, Wallet
} from "lucide-react";
import { Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

const statusLabels: Record<string, string> = {
  pendente: "Pendente", aceito: "Aceito", preparando: "Em Preparo",
  aceita: "Pronto", saiu_entrega: "Saiu p/ Entrega", finalizado: "Finalizado", cancelado: "Cancelado"
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  aceito: "bg-blue-100 text-blue-800",
  preparando: "bg-orange-100 text-orange-800",
  aceita: "bg-emerald-100 text-emerald-800",
  saiu_entrega: "bg-purple-100 text-purple-800",
  finalizado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SortableHeader = ({ id, label, className }: { id: string, label: string, className?: string }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: 'relative' as const,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn("px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap group", className)}
    >
      <div className="flex items-center gap-1">
        <div {...attributes} {...listeners} className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3" />
        </div>
        {label}
      </div>
    </th>
  );
};

const OrderHistory = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [columnOrder, setColumnOrder] = useState<string[]>([
    "numero", "data", "cliente", "tipo", "itens", "status", "entregador", "preparo", "total", "taxa", "aval"
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingStatusId(orderId);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["order-history"] });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const { data: loja } = useQuery({
    queryKey: ["loja-user", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["order-history", loja?.id, selectedDate, selectedMonth, selectedYear, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase.from("pedidos").select("*").eq("lojista_id", user!.id).order("created_at", { ascending: false });
      if (dateFrom || dateTo) {
        if (dateFrom) {
          const start = new Date(dateFrom); start.setHours(0, 0, 0, 0);
          query = query.gte("created_at", start.toISOString());
        }
        if (dateTo) {
          const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
          query = query.lte("created_at", end.toISOString());
        }
      } else if (selectedDate) {
        const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);
        query = query.gte("created_at", dayStart.toISOString()).lte("created_at", dayEnd.toISOString());
      } else {
        const year = parseInt(selectedYear);
        if (selectedMonth !== "all") {
          const month = parseInt(selectedMonth);
          const start = new Date(year, month, 1);
          const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
          query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
        } else {
          const start = new Date(year, 0, 1);
          const end = new Date(year, 11, 31, 23, 59, 59, 999);
          query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const orderIds = orders.map((o: any) => o.id);
  const { data: deliveries = [] } = useQuery({
    queryKey: ["order-history-deliveries", orderIds.join(",")],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      const { data } = await supabase.from("entregas").select("*").in("pedido_id", orderIds);
      return data || [];
    },
    enabled: orderIds.length > 0,
  });

  const driverIds = [...new Set(deliveries.filter((d: any) => d.entregador_id).map((d: any) => d.entregador_id))];
  const { data: driverProfiles = [] } = useQuery({
    queryKey: ["driver-profiles", driverIds.join(",")],
    queryFn: async () => {
      if (driverIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", driverIds);
      return data || [];
    },
    enabled: driverIds.length > 0,
  });

  const driverMap = driverProfiles.reduce((acc: any, p: any) => ({ ...acc, [p.user_id]: p }), {});
  const deliveryMap = deliveries.reduce((acc: any, d: any) => ({ ...acc, [d.pedido_id]: d }), {});

  const months = [
    { value: "all", label: "Todos" }, { value: "0", label: "Jan" }, { value: "1", label: "Fev" },
    { value: "2", label: "Mar" }, { value: "3", label: "Abr" }, { value: "4", label: "Mai" },
    { value: "5", label: "Jun" }, { value: "6", label: "Jul" }, { value: "7", label: "Ago" },
    { value: "8", label: "Set" }, { value: "9", label: "Out" }, { value: "10", label: "Nov" },
    { value: "11", label: "Dez" }
  ];
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const totalDeliveryFees = orders.reduce((s: number, o: any) => s + Number(o.taxa_entrega || 0), 0);
  const totalSubtotal = totalRevenue - totalDeliveryFees;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=1000,height=700");
    if (!printWindow) return;

    const totalDelivery = orders.filter((o: any) => o.tipo === "delivery").length;
    const totalRetirada = orders.filter((o: any) => o.tipo === "retirada").length;
    const totalFinalizados = orders.filter((o: any) => o.status === "finalizado").length;
    const totalCancelados = orders.filter((o: any) => o.status === "cancelado").length;
    const ticketMedio = orders.length > 0 ? totalRevenue / orders.length : 0;

    const periodLabel = selectedDate
      ? format(selectedDate, "dd/MM/yyyy")
      : selectedMonth !== "all"
        ? `${months.find(m => m.value === selectedMonth)?.label}/${selectedYear}`
        : selectedYear;

    const rows = orders.map((order: any, idx: number) => {
      const delivery = deliveryMap[order.id];
      const driver = delivery?.entregador_id ? driverMap[delivery.entregador_id] : null;
      const num = order.numero_diario ? String(order.numero_diario).padStart(3, "0") : "---";
      const date = new Date(order.created_at);
      const bgColor = idx % 2 === 0 ? "#ffffff" : "#f2f2f2";

      // Cálculo do tempo de preparo (created_at até updated_at se finalizado)
      let tempoPreparo = "—";
      if (order.status === "finalizado" && order.updated_at) {
        const start = new Date(order.created_at);
        const end = new Date(order.updated_at);
        const diffMs = end.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        tempoPreparo = `${diffMins} min`;
      }

      return `<tr style="background:${bgColor};">
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;font-weight:bold;">${num}</td>
        <td style="border:1px solid #999;padding:3px 6px;white-space:nowrap;">${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
        <td style="border:1px solid #999;padding:3px 6px;">${order.cliente_nome || "—"}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${order.cliente_telefone || "—"}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${order.tipo === "retirada" ? "Retirada" : "Delivery"}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${getItemCount(order.items)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${statusLabels[order.status] || order.status}</td>
        <td style="border:1px solid #999;padding:3px 6px;">${driver?.full_name || "—"}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${tempoPreparo}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold;">${formatCurrency(order.total)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${order.avaliacao ? "⭐ " + order.avaliacao : "—"}</td>
      </tr>`;
    }).join("");

    printWindow.document.write(`
      <html><head><title>Relatório de Pedidos</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 20px; font-family: Arial, sans-serif; font-size: 10px; color: #222; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div style="border-bottom:3px solid #2563EB;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h1 style="margin:0;font-size:16px;color:#2563EB;">Relatório de Pedidos</h1>
          <p style="margin:2px 0 0;font-size:10px;color:#666;">Período: ${periodLabel}</p>
        </div>
        <div style="text-align:right;font-size:9px;color:#888;">
          Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total Pedidos</div>
          <div style="font-size:14px;font-weight:bold;color:#222;">${orders.length}</div>
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
          <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Delivery / Retirada</div>
          <div style="font-size:14px;font-weight:bold;color:#222;">${totalDelivery} / ${totalRetirada}</div>
        </div>
        <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Finalizados / Cancelados</div>
          <div style="font-size:14px;font-weight:bold;color:#222;">${totalFinalizados} / ${totalCancelados}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead>
          <tr style="background:#2563EB;color:#fff;">
            <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Nº</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Data/Hora</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Cliente</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Telefone</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Tipo</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Itens</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Status</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:left;">Entregador</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Preparo</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Total</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:center;">Aval.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#e5e7eb;font-weight:bold;">
            <td colspan="9" style="border:1px solid #999;padding:4px 6px;text-align:right;">TOTAL GERAL</td>
            <td style="border:1px solid #999;padding:4px 6px;text-align:right;color:#16a34a;">${formatCurrency(totalRevenue)}</td>
            <td style="border:1px solid #999;padding:4px 6px;"></td>
          </tr>
        </tfoot>
      </table>

      <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const getItemCount = (items: any) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((s: number, i: any) => s + (i.qtd || i.quantity || i.quantidade || 1), 0);
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/lojista/pedidos")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-black font-display">Histórico de Pedidos</h1>
            <p className="text-xs text-muted-foreground">{orders.length} pedidos • {formatCurrency(totalRevenue)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:flex sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Card className="border-border/50 shadow-card">
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{formatCurrency(totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground">Total Bruto</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-card">
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Bike className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{formatCurrency(totalDeliveryFees)}</p>
                <p className="text-[10px] text-muted-foreground">Taxas de Entregas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-card">
            <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-2.5 sm:min-w-[130px]">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-sm sm:text-lg font-bold font-display leading-tight tabular-nums">{formatCurrency(totalSubtotal)}</p>
                <p className="text-[10px] text-muted-foreground">Total Líquido</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("rounded-xl gap-2 text-xs", selectedDate && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Dia"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => { setSelectedDate(d); if (d) setSelectedMonth("all"); }} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {selectedDate && (
          <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setSelectedDate(undefined)}>Limpar</Button>
        )}
        <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setSelectedDate(undefined); }}>
          <SelectTrigger className="w-[90px] h-8 rounded-xl text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("rounded-xl gap-2 text-xs", dateFrom && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dateFrom ? `De ${format(dateFrom, "dd/MM/yy")}` : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); if (d) { setSelectedDate(undefined); setSelectedMonth("all"); } }} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">à</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("rounded-xl gap-2 text-xs", dateTo && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dateTo ? `Até ${format(dateTo, "dd/MM/yy")}` : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); if (d) { setSelectedDate(undefined); setSelectedMonth("all"); } }} locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Limpar período</Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handlePrint}>
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div ref={tableRef} className="overflow-x-auto border border-border rounded-lg">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToHorizontalAxis]}
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/70 text-left">
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {columnOrder.map((columnId) => {
                      switch (columnId) {
                        case "numero": return <SortableHeader key={columnId} id={columnId} label="Nº" />;
                        case "data": return <SortableHeader key={columnId} id={columnId} label="Data/Hora" />;
                        case "cliente": return <SortableHeader key={columnId} id={columnId} label="Cliente" />;
                        case "tipo": return <SortableHeader key={columnId} id={columnId} label="Tipo" />;
                        case "itens": return <SortableHeader key={columnId} id={columnId} label="Itens" />;
                        case "status": return <SortableHeader key={columnId} id={columnId} label="Status" />;
                        case "entregador": return <SortableHeader key={columnId} id={columnId} label="Entregador" />;
                        case "preparo": return <SortableHeader key={columnId} id={columnId} label="Preparo" className="text-center" />;
                        case "total": return <SortableHeader key={columnId} id={columnId} label="Total" className="text-right" />;
                        case "taxa": return <SortableHeader key={columnId} id={columnId} label="Taxa Entrega" className="text-right" />;
                        case "aval": return <SortableHeader key={columnId} id={columnId} label="Aval." className="text-center" />;
                        default: return null;
                      }
                    })}
                  </SortableContext>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order: any) => {
                  const delivery = deliveryMap[order.id];
                  const driver = delivery?.entregador_id ? driverMap[delivery.entregador_id] : null;
                  const num = order.numero_diario ? String(order.numero_diario).padStart(3, "0") : "---";
                  const date = new Date(order.created_at);
                  const colorClass = statusColors[order.status] || "bg-muted text-foreground";

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/lojista/pedidos/${order.id}`)}
                    >
                      {columnOrder.map((columnId) => {
                        switch (columnId) {
                          case "numero": return <td key={columnId} className="px-3 py-2 font-bold text-foreground">Nº {num}</td>;
                          case "data": return (
                            <td key={columnId} className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                          );
                          case "cliente": return <td key={columnId} className="px-3 py-2 text-foreground max-w-[140px] truncate">{order.cliente_nome || "—"}</td>;
                          case "tipo": return (
                            <td key={columnId} className="px-3 py-2">
                              <span className="text-[10px] font-medium">{order.tipo === "retirada" ? "Retirada" : "Delivery"}</span>
                            </td>
                          );
                          case "itens": return <td key={columnId} className="px-3 py-2 text-center text-muted-foreground">{getItemCount(order.items)}</td>;
                          case "status": return (
                            <td key={columnId} className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              {updatingStatusId === order.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground mx-auto" />
                              ) : (
                                <Select
                                  value={order.status}
                                  onValueChange={(newStatus) => handleStatusUpdate(order.id, newStatus)}
                                >
                                  <SelectTrigger className={cn("h-7 w-[120px] px-2 py-0.5 rounded-full text-[10px] font-bold border-none", colorClass)}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="text-[10px]">
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                      <SelectItem key={value} value={value} className="text-[10px]">
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                          );
                          case "entregador": return (
                            <td key={columnId} className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">
                              {driver ? (
                                <span className="flex items-center gap-1"><Bike className="w-3 h-3 shrink-0" /> {driver.full_name}</span>
                              ) : "—"}
                            </td>
                          );
                          case "preparo": return (
                            <td key={columnId} className="px-3 py-2 text-center text-muted-foreground">
                              {(() => {
                                if (order.status === "finalizado" && order.updated_at) {
                                  const start = new Date(order.created_at);
                                  const end = new Date(order.updated_at);
                                  const diffMs = end.getTime() - start.getTime();
                                  return `${Math.floor(diffMs / 60000)} min`;
                                }
                                return "—";
                              })()}
                            </td>
                          );
                          case "total": return <td key={columnId} className="px-3 py-2 text-right font-bold text-primary whitespace-nowrap">{formatCurrency(order.total)}</td>;
                          case "taxa": return <td key={columnId} className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{formatCurrency(order.taxa_entrega || 0)}</td>;
                          case "aval": return (
                            <td key={columnId} className="px-3 py-2 text-center">
                              {order.avaliacao ? (
                                <span className="flex items-center gap-0.5 justify-center">
                                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                  <span className="text-[10px] font-bold">{order.avaliacao}</span>
                                </span>
                              ) : "—"}
                            </td>
                          );
                          default: return null;
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-bold">
                  <td colSpan={columnOrder.length - 2} className="px-3 py-2.5 text-right text-muted-foreground">Total Geral</td>
                  <td className="px-3 py-2.5 text-right text-primary">{formatCurrency(totalRevenue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </DndContext>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
