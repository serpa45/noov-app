import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, CalendarIcon, Truck, Printer, Bike, Star, Trash2
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pendente: "Para Entrega",
  aceita: "Aceita",
  em_transito: "Em Trânsito",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  aceita: "bg-purple-100 text-purple-800",
  em_transito: "bg-blue-100 text-blue-800",
  entregue: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const DeliveryHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedDriver, setSelectedDriver] = useState<string>("all");

  const { data: loja } = useQuery({
    queryKey: ["loja-user", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["delivery-history", loja?.id, selectedDate, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!loja) return [];
      let query = supabase
        .from("entregas")
        .select("*, pedidos(*)")
        .eq("lojista_id", loja.id)
        .order("created_at", { ascending: false });

      if (selectedDate) {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);
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

      const rows = (data || []).map((d: any) => {
        const rawPedido = d.pedidos;
        const pedido = Array.isArray(rawPedido) ? rawPedido[0] : rawPedido;
        return { ...d, pedido: pedido || null };
      });
      return rows;
    },
    enabled: !!user && !!loja,
  });

  const driverIds = [...new Set(deliveries.filter((d: any) => d.entregador_id).map((d: any) => d.entregador_id))];
  const { data: driverProfiles = [] } = useQuery({
    queryKey: ["driver-profiles-hist", driverIds.join(",")],
    queryFn: async () => {
      if (driverIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", driverIds);
      return data || [];
    },
    enabled: driverIds.length > 0,
  });

  const driverMap = driverProfiles.reduce((acc: any, p: any) => ({ ...acc, [p.user_id]: p }), {});

  const months = [
    { value: "all", label: "Mês" }, { value: "0", label: "Jan" }, { value: "1", label: "Fev" },
    { value: "2", label: "Mar" }, { value: "3", label: "Abr" }, { value: "4", label: "Mai" },
    { value: "5", label: "Jun" }, { value: "6", label: "Jul" }, { value: "7", label: "Ago" },
    { value: "8", label: "Set" }, { value: "9", label: "Out" }, { value: "10", label: "Nov" },
    { value: "11", label: "Dez" },
  ];
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  const filteredDeliveries = selectedDriver === "all"
    ? deliveries
    : deliveries.filter((d: any) => d.entregador_id === selectedDriver);

  const totalValorEntrega = filteredDeliveries.reduce((s: number, d: any) => s + Number(d.valor_entrega || 0), 0);
  const totalValorTotal = filteredDeliveries.reduce((s: number, d: any) => s + Number(d.valor_total || d.pedido?.total || 0), 0);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("entregas").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado!");
    queryClient.invalidateQueries({ queryKey: ["delivery-history"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("entregas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir entrega");
      return;
    }
    toast.success("Entrega excluída com sucesso");
    queryClient.invalidateQueries({ queryKey: ["delivery-history"] });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=1000,height=700");
    if (!printWindow) return;

    const totalEntregues = filteredDeliveries.filter((d: any) => d.status === "entregue").length;
    const totalCanceladas = filteredDeliveries.filter((d: any) => d.status === "cancelada").length;

    const periodLabel = selectedDate
      ? format(selectedDate, "dd/MM/yyyy")
      : selectedMonth !== "all"
        ? `${months.find((m) => m.value === selectedMonth)?.label}/${selectedYear}`
        : selectedYear;

    const rows = filteredDeliveries
      .map((d: any, idx: number) => {
        const driver = d.entregador_id ? driverMap[d.entregador_id] : null;
        const pedido = d.pedido;
        const num = pedido?.numero_diario ? String(pedido.numero_diario).padStart(3, "0") : "---";
        const date = new Date(d.created_at);
        const bgColor = idx % 2 === 0 ? "#ffffff" : "#f2f2f2";
        return `<tr style="background:${bgColor};">
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;font-weight:bold;">${num}</td>
        <td style="border:1px solid #999;padding:3px 6px;white-space:nowrap;">${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
        <td style="border:1px solid #999;padding:3px 6px;">${pedido?.cliente_nome || "—"}</td>
        <td style="border:1px solid #999;padding:3px 6px;">${driver?.full_name || "—"}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:center;">${statusLabels[d.status] || d.status}</td>
        <td style="border:1px solid #999;padding:3px 6px;">${d.endereco_entrega || "—"}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold;">${formatCurrency(d.valor_entrega)}</td>
        <td style="border:1px solid #999;padding:3px 6px;text-align:right;font-weight:bold;">${formatCurrency(Number(d.valor_total || pedido?.total || 0))}</td>
      </tr>`;
      })
      .join("");

    printWindow.document.write(`
      <html><head><title>Relatório de Entregas</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 20px; font-family: Arial, sans-serif; font-size: 10px; color: #222; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div style="border-bottom:3px solid #2563EB;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h1 style="margin:0;font-size:16px;color:#2563EB;">Relatório de Entregas</h1>
          <p style="margin:2px 0 0;font-size:10px;color:#666;">Período: ${periodLabel}</p>
        </div>
        <div style="text-align:right;font-size:9px;color:#888;">
          Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Total Entregas</div>
          <div style="font-size:14px;font-weight:bold;">${filteredDeliveries.length}</div>
        </div>
        <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Valor Taxa Entrega</div>
          <div style="font-size:14px;font-weight:bold;color:#16a34a;">${formatCurrency(totalValorEntrega)}</div>
        </div>
        <div style="flex:1;min-width:100px;border:1px solid #ccc;border-radius:4px;padding:6px 10px;background:#f9fafb;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Entregues / Canceladas</div>
          <div style="font-size:14px;font-weight:bold;">${totalEntregues} / ${totalCanceladas}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead>
          <tr style="background:#2563EB;color:#fff;">
            <th style="border:1px solid #999;padding:4px 6px;">Pedido</th>
            <th style="border:1px solid #999;padding:4px 6px;">Data/Hora</th>
            <th style="border:1px solid #999;padding:4px 6px;">Cliente</th>
            <th style="border:1px solid #999;padding:4px 6px;">Entregador</th>
            <th style="border:1px solid #999;padding:4px 6px;">Status</th>
            <th style="border:1px solid #999;padding:4px 6px;">Endereço</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Taxa Entrega</th>
            <th style="border:1px solid #999;padding:4px 6px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#e5e7eb;font-weight:bold;">
            <td colspan="6" style="border:1px solid #999;padding:4px 6px;text-align:right;">TOTAL GERAL</td>
            <td style="border:1px solid #999;padding:4px 6px;text-align:right;color:#16a34a;">${formatCurrency(totalValorEntrega)}</td>
            <td style="border:1px solid #999;padding:4px 6px;text-align:right;color:#16a34a;">${formatCurrency(totalValorTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/lojista/entregas")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black font-display">Histórico de Entregas</h1>
          <p className="text-xs text-muted-foreground">
            {filteredDeliveries.length} entregas • {formatCurrency(totalValorEntrega)} em taxa de entrega
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("rounded-xl gap-2 text-xs", selectedDate && "border-primary text-primary")}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Dia"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d);
                if (d) setSelectedMonth("all");
              }}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        {selectedDate && (
          <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setSelectedDate(undefined)}>
            Limpar
          </Button>
        )}
        <Select
          value={selectedMonth}
          onValueChange={(v) => {
            setSelectedMonth(v);
            setSelectedDate(undefined);
          }}
        >
          <SelectTrigger className="w-[90px] h-8 rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedYear}
          onValueChange={(v) => {
            setSelectedYear(v);
            setSelectedDate(undefined);
          }}
        >
          <SelectTrigger className="w-[80px] h-8 rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedDriver} onValueChange={setSelectedDriver}>
          <SelectTrigger className="w-[130px] h-8 rounded-xl text-xs">
            <SelectValue placeholder="Entregador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Entregador</SelectItem>
            {driverProfiles.map((p: any) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.full_name?.split(" ")[0] || "Sem nome"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handlePrint}>
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma entrega encontrada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/70 text-left">
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Pedido</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Data/Hora</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Cliente</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Entregador</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">Endereço</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap text-right">Taxa Entrega</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap text-right">Total</th>
                <th className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDeliveries.map((d: any) => {
                const driver = d.entregador_id ? driverMap[d.entregador_id] : null;
                const pedido = d.pedido;
                const num = pedido?.numero_diario ? String(pedido.numero_diario).padStart(3, "0") : "---";
                const date = new Date(d.created_at);
                const colorClass = statusColors[d.status] || "bg-muted text-foreground";

                return (
                  <tr key={d.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2 font-bold text-foreground">Nº {num}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {date.toLocaleDateString("pt-BR")}{" "}
                      {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 text-foreground max-w-[140px] truncate">
                      {pedido?.cliente_nome || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">
                      {driver ? (
                        <span className="flex items-center gap-1">
                          <Bike className="w-3 h-3 shrink-0" /> {driver.full_name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={d.status}
                        onValueChange={(v) => handleUpdateStatus(d.id, v)}
                      >
                        <SelectTrigger className={cn("h-7 w-[110px] text-[10px] font-bold rounded-full border-none", colorClass)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([val, label]) => (
                            <SelectItem key={val} value={val} className="text-[10px]">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">
                      {d.endereco_entrega || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-primary whitespace-nowrap">
                      {formatCurrency(d.valor_entrega)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-foreground whitespace-nowrap">
                      {formatCurrency(Number(d.valor_total || pedido?.total || 0))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir entrega?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A entrega Nº {num} será removida permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(d.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold">
                <td colSpan={7} className="px-3 py-2.5 text-right text-muted-foreground">
                  Total Geral
                </td>
                <td className="px-3 py-2.5 text-right text-primary">{formatCurrency(totalValorEntrega)}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{formatCurrency(totalValorTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default DeliveryHistory;
