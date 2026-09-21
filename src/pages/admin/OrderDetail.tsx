import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  Check,
  Truck,
  Printer,
  Copy,
  ExternalLink,
  ChefHat,
  Ban,
  Package,
  AlertCircle,
  MessageCircle,
  Timer,
  CreditCard,
  User,
  ShoppingBag,
  Image as ImageIcon,
  Undo2,
  Star,
  Bike,
  Sandwich,
  Trash2,
  Smile,
  Pencil,

} from "lucide-react";
import { cn, formatPhone } from "@/lib/utils";

const FastFoodIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Canudo */}
    <path d="M16 3 L18 1 L20 6" />
    {/* Copo */}
    <path d="M13 5 H21 L20 20 H14 Z" />
    <path d="M13 5 H21" />
    {/* Hambúrguer */}
    <path d="M4 9 C4 6 8 5 12 5 C16 5 20 6 20 9" />
    <path d="M4 13 C6 12 8 14 10 13 C12 12 14 14 16 13 C18 12 20 13 20 13" />
    <path d="M4 15 H20 V16 C20 19 16 20 12 20 C8 20 4 19 4 16 Z" />
  </svg>
);

import ThermalReceipt from "@/components/admin/ThermalReceipt";
import { isMobileOrTabletDevice, printReceipt, printKitchenTicket } from "@/utils/printHelper";
import { buildLegacyReceiptHTML } from "@/utils/legacyReceiptHTML";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";

interface OrderItem {
  id?: string;
  nome?: string;
  name?: string;
  qtd?: number;
  quantity?: number;
  quantidade?: number;
  preco?: number;
  price?: number;
  observacao?: string;
  adicionais?: any[];
  customLabel?: string;
  imagem_url?: string;
  sabores?: string[];
  quantidade_sabores?: number;
  tamanho?: string;
  bordas?: string[];
  quantidade_bordas?: number;
  gratis_ate?: number;
  weight?: string;
  unidade_medida?: string;
  caldo_sabor?: { nome: string; valorExtra: number } | null;
}

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
}

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  dotColor: string;
  icon: any;
  next?: string;
  nextLabel?: string;
  nextIcon?: any;
}> = {
  pendente: {
    label: "Pendente",
    color: "yellow",
    bgClass: "bg-yellow-500/10 border-yellow-500/30",
    textClass: "text-yellow-700 dark:text-yellow-400",
    dotColor: "bg-yellow-500",
    icon: AlertCircle,
    next: "aceito",
    nextLabel: "Aceitar Pedido",
    nextIcon: Check,
  },
  aceito: {
    label: "Aceito",
    color: "blue",
    bgClass: "bg-blue-500/10 border-blue-500/30",
    textClass: "text-blue-700 dark:text-blue-400",
    dotColor: "bg-blue-500",
    icon: Check,
    next: "preparando",
    nextLabel: "Iniciar Preparo",
    nextIcon: ChefHat,
  },
  preparando: {
    label: "Em Preparo",
    color: "orange",
    bgClass: "bg-orange-500/10 border-orange-500/30",
    textClass: "text-orange-700 dark:text-orange-400",
    dotColor: "bg-orange-500",
    icon: ChefHat,
    next: "aceita",
    nextLabel: "Enviar para entrega",
    nextIcon: Truck,
  },
  aceita: {
    label: "Aguarda Coleta",
    color: "purple",
    bgClass: "bg-purple-500/10 border-purple-500/30",
    textClass: "text-purple-700 dark:text-purple-400",
    dotColor: "bg-purple-500",
    icon: ShoppingBag,
    next: "saiu_entrega",
    nextLabel: "Enviar para entrega",
    nextIcon: Truck,
  },
  saiu_entrega: {
    label: "Em Entrega",
    color: "brown",
    bgClass: "bg-amber-800/10 border-amber-800/30",
    textClass: "text-amber-900 dark:text-amber-300",
    dotColor: "bg-amber-800",
    icon: Bike,
    next: "finalizado",
    nextLabel: "Finalizar Pedido",
    nextIcon: Package,
  },
  finalizado: {
    label: "Finalizado",
    color: "green",
    bgClass: "bg-green-500/10 border-green-500/30",
    textClass: "text-green-700 dark:text-green-400",
    dotColor: "bg-green-500",
    icon: Smile,

  },
  cancelado: {
    label: "Cancelado",
    color: "red",
    bgClass: "bg-destructive/10 border-destructive/30",
    textClass: "text-destructive",
    dotColor: "bg-destructive",
    icon: Ban,
  },
  entregue: {
    label: "Finalizado (PDV)",
    color: "green",
    bgClass: "bg-green-500/10 border-green-500/30",
    textClass: "text-green-700 dark:text-green-400",
    dotColor: "bg-green-500",
    icon: Smile,
  },
  pronto: {
    label: "Pronto",
    color: "teal",
    bgClass: "bg-teal-500/10 border-teal-500/30",
    textClass: "text-teal-700 dark:text-teal-400",
    dotColor: "bg-teal-500",
    icon: Check,
  },
};

const getStatusForOrder = (order: any) => {
  const base = statusConfig[order.status] ?? statusConfig.pendente;
  const st = { ...base };
  const tipo = order.tipo || "delivery";

  if (tipo === "balcao" || tipo === "mesa") {
    if (order.status === "preparando") {
      st.next = "pronto";
      st.nextLabel = "Pedido Pronto";
      st.nextIcon = Check;
    } else if (order.status === "pronto") {
      st.next = "entregue";
      st.nextLabel = "Finalizar";
      st.nextIcon = Package;
    }
  } else if (tipo === "retirada") {
    if (order.status === "preparando") {
      st.next = "aceita";
      st.nextLabel = "Pronto p/ Buscar";
      st.nextIcon = Check;
    } else if (order.status === "aceita") {
      st.label = "Pronto p/ Buscar";
      st.icon = User;
      st.next = "finalizado";
      st.nextLabel = "Finalizar Pedido";
      st.nextIcon = Package;
    } else if (order.status === "finalizado") {
      st.label = "Retirado";
    }
  }

  return st;
};

const getStatusFlow = (orderType: string = "delivery") => {
  if (orderType === "balcao" || orderType === "mesa") {
    return ["preparando", "pronto", "entregue"];
  }
  if (orderType === "retirada") {
    return ["pendente", "aceito", "preparando", "aceita", "finalizado"];
  }
  return ["pendente", "aceito", "preparando", "aceita", "saiu_entrega", "finalizado"];
};

const getPrevStatus = (current: string, orderType: string = "delivery"): string | null => {
  const flow = getStatusFlow(orderType);
  const idx = flow.indexOf(current);
  return idx > 0 ? flow[idx - 1] : null;
};

const OrderDetail = () => {
  useKeepScreenOn(true);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { limits } = useStorePlanLimits();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState("");
  const isMobile = useIsMobile();
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isViewCancelReasonOpen, setIsViewCancelReasonOpen] = useState(false);
  
  const { data: loja } = useQuery({
    queryKey: ["lojista-loja-detail", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, telefone:user_id, impressao_duas_vias, impressora_qz_nome, documento, margem_superior, margem_inferior, margem_esquerda, margem_direita")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ["pedido-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clienteInfo } = useQuery({
    queryKey: ["cliente-foto", order?.cliente_telefone, loja?.id],
    queryFn: async () => {
      if (!order?.cliente_telefone || !loja?.id) return null;
      const { data } = await supabase
        .from("clientes")
        .select("foto_url, nome_completo")
        .eq("telefone", order.cliente_telefone)
        .eq("loja_id", loja.id)
        .maybeSingle();
      return data;
    },
    enabled: !!order?.cliente_telefone && !!loja?.id,
  });

  const { data: entrega } = useQuery({
    queryKey: ["pedido-entrega", id],
    queryFn: async () => {
      const { data: delivery, error } = await supabase
        .from("entregas")
        .select("*")
        .eq("pedido_id", id!)
        .maybeSingle();
      
      if (error) throw error;
      if (!delivery) return null;

      if (delivery.entregador_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", delivery.entregador_id)
          .maybeSingle();
        return { ...delivery, entregador: profile };
      }
      
      return delivery;
    },
    enabled: !!id,
  });

  const { data: dailyNumber } = useQuery({
    queryKey: ["daily-order-number", order?.id, order?.lojista_id, order?.created_at],
    queryFn: async () => {
      if (!order) return 1;
      if ((order as any).numero_diario) return (order as any).numero_diario;
      const orderDate = new Date(order.created_at);
      const startOfDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()).toISOString();
      const endOfDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate() + 1).toISOString();
      const { data } = await supabase
        .from("pedidos")
        .select("id")
        .eq("lojista_id", order.lojista_id)
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay)
        .order("created_at", { ascending: true });
      if (!data) return 1;
      const idx = data.findIndex(p => p.id === order.id);
      return idx >= 0 ? idx + 1 : data.length + 1;
    },
    enabled: !!order,
  });

  const orderNumStr = String(dailyNumber || 1).padStart(3, "0");

  const itemIds = order ? parseItems(order.items).map(i => i.id).filter(Boolean) : [];
  const { data: productImages } = useQuery({
    queryKey: ["product-images", itemIds],
    queryFn: async () => {
      if (itemIds.length === 0) return {};
      const { data } = await supabase
        .from("produtos")
        .select("id, imagem_url")
        .in("id", itemIds as string[]);
      const map: Record<string, string> = {};
      data?.forEach(p => { if (p.imagem_url) map[p.id] = p.imagem_url; });
      return map;
    },
    enabled: itemIds.length > 0,
  });

  useEffect(() => {
    if (!order) return;
    const isFinal = order.status === "finalizado" || order.status === "cancelado";
    const getFinalTimestamp = (): number => {
      const history: StatusHistoryEntry[] = Array.isArray((order as any)?.status_historico)
        ? (order as any).status_historico
        : [];
      const entry = [...history].reverse().find(
        (h) => h.status === "finalizado" || h.status === "cancelado"
      );
      if (entry?.timestamp) return new Date(entry.timestamp).getTime();
      return new Date(order.updated_at).getTime();
    };
    const update = () => {
      const endTime = isFinal ? getFinalTimestamp() : Date.now();
      const diff = Math.max(0, Math.floor((endTime - new Date(order.created_at).getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(h > 0 ? `${h}h ${m}min ${s}s` : `${m}min ${s}s`);
    };
    update();
    if (isFinal) return;
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [order?.created_at, order?.updated_at, order?.status, (order as any)?.status_historico]);

  const updateStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      const currentHistory: StatusHistoryEntry[] = Array.isArray((order as any)?.status_historico)
        ? (order as any).status_historico
        : [];
      
      const flow = getStatusFlow(order?.tipo);
      const currentStatusIndex = flow.indexOf(order?.status);
      const targetStatusIndex = flow.indexOf(status);
      
      const isReverting = status !== "cancelado" && 
                          order?.status !== "cancelado" && 
                          targetStatusIndex < currentStatusIndex;
      
      let newHistory: StatusHistoryEntry[];
      
      if (status === "cancelado") {
        newHistory = [...currentHistory, { status: "cancelado", timestamp: new Date().toISOString() }];
      } else if (order?.status === "cancelado") {
        // When re-activating, return to the state before cancellation
        // We find the last status before 'cancelado' in history
        const lastValidStatus = currentHistory.length > 0 
          ? currentHistory.filter(h => h.status !== "cancelado").pop()?.status 
          : flow[0];
        
        const reactivationStatus = status || lastValidStatus || flow[0];
        newHistory = currentHistory.filter(h => h.status !== "cancelado");
        status = reactivationStatus;
      } else if (isReverting) {
        // When reverting, remove the history entries for statuses ahead of the new status
        newHistory = currentHistory.filter(h => {
          const hIndex = flow.indexOf(h.status);
          return hIndex <= targetStatusIndex;
        });
      } else {
        newHistory = [...currentHistory, { status, timestamp: new Date().toISOString() }];
      }

      const updateData: any = { status, status_historico: newHistory };
      if (status === "cancelado" && reason) {
        updateData.cancel_reason = reason;
      } else if (status !== "cancelado") {
        updateData.cancel_reason = null; // Clear reason if un-cancelling
      }

      const { error } = await supabase
        .from("pedidos")
        .update(updateData)
        .eq("id", id!);
      if (error) throw error;

      // Só gera entrega quando o módulo de entregas está habilitado para a loja
      if (limits.entregas && !isReverting && (status === "aceita" || status === "saiu_entrega") && order && order.tipo !== "retirada") {
        const { data: existing } = await supabase
          .from("entregas")
          .select("id")
          .eq("pedido_id", id!)
          .maybeSingle();

        if (!existing) {
          const orderTaxaEntrega = (order as any).taxa_entrega;
          let deliveryFee: number;
          if (orderTaxaEntrega != null) {
            deliveryFee = Number(orderTaxaEntrega);
          } else {
            const subtotal = parseItems(order.items).reduce((acc, i) => acc + (i.preco || i.price || 0) * (i.qtd || i.quantity || i.quantidade || 1), 0);
            deliveryFee = Math.max(0, (order.total || 0) - subtotal);
          }
          
          await (supabase.from("entregas") as any).insert({
            pedido_id: id,
            lojista_id: loja?.id || order.lojista_id || user!.id,
            status: "pendente",
            endereco_entrega: order.endereco_entrega,
            valor_entrega: deliveryFee,
            valor_total: order.total,
          });
        }
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pedido-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-lojista"] });
      toast({ title: "Status atualizado ✅" });
      if (variables.status === "aceito") {
        import("@/utils/bluetoothPrint").then(({ getBluetoothSettings }) => {
          if (getBluetoothSettings().printOnAccept !== false) printOrder();
        }).catch(() => printOrder());
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const handleStatusUpdate = (status: string, reason?: string) => {
    updateStatus.mutate({ status, reason });
  };

  const updateCancelReason = useMutation({
    mutationFn: async (reason: string) => {
      const normalizedReason = reason.trim();
      if (!id || !normalizedReason) throw new Error("Informe o motivo do cancelamento.");

      const { error } = await supabase
        .from("pedidos")
        .update({ cancel_reason: normalizedReason })
        .eq("id", id)
        .eq("status", "cancelado");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedido-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setIsViewCancelReasonOpen(false);
      toast({ title: "Motivo atualizado ✅" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar o motivo", description: error.message, variant: "destructive" });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (indexToRemove: number) => {
      if (!order) return;
      
      const currentItems = [...parseItems(order.items)];
      if (indexToRemove < 0 || indexToRemove >= currentItems.length) return;
      
      const removedItem = currentItems[indexToRemove];
      const removedItemPrice = (removedItem.preco || removedItem.price || 0) * (removedItem.qtd || removedItem.quantity || removedItem.quantidade || 1);
      
      const newItems = currentItems.filter((_, idx) => idx !== indexToRemove);
      const newTotal = Math.max(0, (order.total || 0) - removedItemPrice);
      
      const { error } = await supabase
        .from("pedidos")
        .update({ 
          items: newItems as any,
          total: newTotal
        })
        .eq("id", id!);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedido-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({ title: "Item removido com sucesso ✅" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover item", description: err.message, variant: "destructive" });
    },
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const copyAddress = () => {
    if (order?.endereco_entrega) {
      navigator.clipboard.writeText(order.endereco_entrega);
      toast({ title: "Endereço copiado!" });
    }
  };

  const openMaps = () => {
    if (order?.endereco_entrega) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.endereco_entrega)}`, "_blank");
    }
  };

  const sendWhatsApp = () => {
    if (order?.cliente_telefone) {
      const phone = order.cliente_telefone.replace(/\D/g, "");
      const text = `Olá ${order.cliente_nome || ""}! Seu pedido Nº ${orderNumStr} está ${statusConfig[order.status]?.label || order.status}. Obrigado pela preferência!`;
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const printOrder = async () => {
    const { toast: sonnerToast } = await import("sonner");
    const { PRINT_SUCCESS_STYLE, PRINT_ERROR_STYLE } = await import("@/utils/printHelper");

    try {
      const content = receiptRef.current?.innerHTML;
      if (!content) {
        sonnerToast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
        return;
      }

      const isMobileOrTablet = isMobileOrTabletDevice();
      const { getBluetoothSettings, bluetoothPrintService } = await import("@/utils/bluetoothPrint");
      const btSettings = getBluetoothSettings();
      const btConfigured = !!(btSettings?.deviceId || btSettings?.deviceName);
      const btReady = btConfigured && bluetoothPrintService.isSupported();

      // 1) Prioridade: Bluetooth se configurada. Tenta reconectar silenciosamente.
      if (btReady) {
        try {
          if (!bluetoothPrintService.isConnected()) {
            await bluetoothPrintService.tryAutoReconnect();
          }
          if (bluetoothPrintService.isConnected()) {
            await bluetoothPrintService.printHTML(content);
            sonnerToast.success("Impressão enviada", PRINT_SUCCESS_STYLE);
            return;
          }
          if (isMobileOrTablet) {
            sonnerToast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
            return;
          }
        } catch (btErr) {
          console.warn("Falha Bluetooth:", btErr);
          if (isMobileOrTablet) {
            sonnerToast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
            return;
          }
        }
      }

      // 2) QZ Tray (desktop)
      const selectedPrinter = (loja as any)?.impressora_qz_nome || localStorage.getItem("qz-selected-printer");
      if (selectedPrinter && !isMobileOrTablet) {
        const printLabel = (label: string) => `
          <div style="text-align:center;font-weight:900;font-size:11px;border:1px solid #000;margin-bottom:8px;padding:2px;font-family:monospace;">
            VIA: ${label}
          </div>
        `;

        const marginSettings = {
          top: (loja as any).margem_superior || 0,
          bottom: (loja as any).margem_inferior || 0,
          left: (loja as any).margem_esquerda || 0,
          right: (loja as any).margem_direita || 0
        };

        const { qzService } = await import("@/utils/qzService");

        if ((loja as any)?.impressao_duas_vias) {
          await qzService.printHTML(printLabel("ESTABELECIMENTO") + content, selectedPrinter, marginSettings);
          await qzService.printHTML(printLabel("ENTREGADOR") + content, selectedPrinter, marginSettings);
        } else {
          await qzService.printHTML(content, selectedPrinter, marginSettings);
        }
        sonnerToast.success("Impressão enviada", PRINT_SUCCESS_STYLE);
        return;
      }

      // 3) Fallback: mobile sem BT ou desktop sem QZ
      if (isMobileOrTablet) {
        sonnerToast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
        return;
      }
      await printReceipt(content);
    } catch (err: any) {
      console.error("Erro na impressão:", err);
      sonnerToast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
    }
  };

  const printKitchen = async () => {
    try {
      const its = parseItems(order.items);
      await printKitchenTicket({
        orderNumber: orderNumStr,
        date: new Date(order.created_at || Date.now()).toLocaleTimeString("pt-BR"),
        items: its.map((i: any) => ({
          name: i.nome || i.name || "Item",
          qty: i.qtd || i.quantity || i.quantidade || 1,
          obs: i.observacao || i.observation || i.obs,
          extras: i.adicionais || i.addons || i.extras,
          sabores: i.sabores,
        })),
      });
    } catch (error) {
      console.error("Erro ao imprimir cozinha:", error);
      toast({ title: "Erro", description: "Falha ao gerar a comanda da cozinha.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/lojista/pedidos")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const st = getStatusForOrder(order);
  const StatusIcon = st.icon;
  const items = parseItems(order.items);
  const subtotal = items.reduce((acc, i) => {
    const q = i.qtd || i.quantity || i.quantidade || 1;
    const base = (i.preco || i.price || 0) * q;
    const adds = ((i.adicionais || (i as any).addons || []) as any[]).reduce((s: number, a: any) => {
      const p = typeof a === "object" ? Number(a.preco) || 0 : 0;
      const aq = typeof a === "object" ? Number(a.quantidade ?? a.qtd ?? 1) || 1 : 1;
      return s + p * aq;
    }, 0);
    return acc + base + adds * q;
  }, 0);
  const deliveryFee = (order as any).taxa_entrega != null ? Number((order as any).taxa_entrega) : Math.max(0, order.total - subtotal);
  const isOverdue = order.status === "pendente" && (Date.now() - new Date(order.created_at).getTime()) > 10 * 60 * 1000;
  const statusHistory: StatusHistoryEntry[] = Array.isArray((order as any).status_historico) ? (order as any).status_historico : [];
  const isPdv = order.tipo === "balcao" || order.tipo === "mesa";
  const firstStatus = isPdv ? "preparando" : "pendente";
  const timeline: StatusHistoryEntry[] = [
    { status: firstStatus, timestamp: order.created_at },
    ...statusHistory.filter(h => h.status !== firstStatus),
  ];
  const completedStatuses = new Set(timeline.map(h => h.status));
  const timelineMap: Record<string, string> = {};
  timeline.forEach(h => { timelineMap[h.status] = h.timestamp; });

  return (
    <div className="space-y-5 w-full max-w-7xl mx-auto px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 w-full sm:w-auto">
        <Button variant="ghost" size="icon" className="rounded-xl flex-shrink-0" onClick={() => navigate("/lojista/pedidos")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <h1 className="text-xl font-bold font-display text-foreground whitespace-nowrap">
                Pedido Nº: {orderNumStr}
              </h1>
              {order.status === "cancelado" && (
                <Badge variant="destructive" className="animate-in fade-in zoom-in duration-300">
                  Pedido Cancelado
                </Badge>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              {new Date(order.created_at).toLocaleString("pt-BR")}
              <span className="text-muted-foreground/40">•</span>
              <Timer className="w-3 h-3" />
              <span className={isOverdue ? "text-destructive font-bold animate-pulse" : "font-medium"}>{elapsed}</span>
            </div>

            {order.status === "cancelado" && (
              <div className="mt-2 flex items-center gap-2 text-xs font-bold text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-300">
                <span>MOTIVO: {(order as any).cancel_reason || "Não informado"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label="Editar motivo do cancelamento"
                  title="Editar motivo"
                  onClick={() => {
                    setCancelReason((order as any).cancel_reason || "");
                    setIsViewCancelReasonOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-row items-center justify-center sm:justify-end gap-2 w-full sm:w-auto sm:self-center">
          {st.next && (
            <Button 
              size="sm" 
              className={cn("flex-1 sm:flex-none sm:w-auto font-semibold", st.next === "aceito" && "bg-green-600 hover:bg-green-700 text-white border-0")} 
              disabled={updateStatus.isPending} 
              onClick={() => handleStatusUpdate(st.next!)}
            >
              {st.nextIcon && <st.nextIcon className="w-4 h-4 mr-1" />}
              {st.nextLabel}
            </Button>
          )}
          {order.status === "cancelado" && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-none sm:w-auto font-semibold bg-green-600 border-green-600 text-white hover:bg-green-700 hover:border-green-700 rounded-xl sm:rounded-md h-10 sm:h-9" 
              disabled={updateStatus.isPending}
              onClick={() => handleStatusUpdate("pendente")}
            >
              <Undo2 className="w-4 h-4 mr-1" /> Reativar Pedido
            </Button>
          )}
          {order.status !== "cancelado" && order.status !== "finalizado" && (
            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
              <Button asChild variant="destructive" size="sm" className="flex-1 sm:flex-none sm:w-auto font-semibold">
                <button onClick={() => setIsCancelDialogOpen(true)}>
                  <Ban className="w-4 h-4 mr-1" /> Cancelar
                </button>
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar Pedido</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo do cancelamento</Label>
                    <Textarea 
                      id="reason" 
                      placeholder="Ex: Falta de estoque, área de risco, etc..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>Voltar</Button>
                  <Button 
                    variant="destructive" 
                    disabled={!cancelReason.trim() || updateStatus.isPending}
                    onClick={() => {
                      handleStatusUpdate("cancelado", cancelReason);
                      setIsCancelDialogOpen(false);
                    }}
                  >
                    Confirmar Cancelamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {(() => {
            const prevStatus = getPrevStatus(order.status, order.tipo);
            if (!prevStatus || order.status === "cancelado") return null;
            return (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-none sm:w-auto font-semibold" 
                disabled={updateStatus.isPending} 
                onClick={() => handleStatusUpdate(prevStatus)}
              >
                <Undo2 className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
            );
          })()}
        </div>
      </div>

      <Dialog open={isViewCancelReasonOpen} onOpenChange={setIsViewCancelReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar motivo do cancelamento</DialogTitle>
            <DialogDescription>Atualize o motivo registrado neste pedido cancelado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="edit-cancel-reason">Motivo do cancelamento</Label>
            <Textarea
              id="edit-cancel-reason"
              placeholder="Ex: Falta de estoque, área de risco, etc..."
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewCancelReasonOpen(false)}>Cancelar</Button>
            <Button
              disabled={!cancelReason.trim() || updateCancelReason.isPending}
              onClick={() => updateCancelReason.mutate(cancelReason)}
            >
              {updateCancelReason.isPending ? "Salvando..." : "Salvar motivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Horizontal Status Timeline */}
      <Card className="border-border/50">
        <CardContent className="p-4 sm:p-6">
          <div className="relative flex justify-between">
            {/* Background Line */}
            <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-muted">
              {/* Dynamic Progress Bar */}
              <div 
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ 
                  width: `${(() => {
                    const flow = getStatusFlow(order.tipo);
                    const currentIndex = flow.indexOf(order.status);
                    if (currentIndex === -1) return 0;
                    return (currentIndex / (flow.length - 1)) * 100;
                  })()}%` 
                }}
              />
            </div>
            
            {(() => {
              const statusColorMap: Record<string, string> = {
                pendente: "bg-red-500 text-white",
                aceito: "bg-blue-500 text-white",
                preparando: "bg-orange-500 text-white",
                aceita: "bg-purple-500 text-white",
                saiu_entrega: "bg-amber-800 text-white",
                finalizado: "bg-green-600 text-white",
                entregue: "bg-green-600 text-white",
                pronto: "bg-teal-500 text-white",
                cancelado: "bg-destructive text-white",
              };
              const borderColorMap: Record<string, string> = {
                pendente: "border-red-500/40",
                aceito: "border-blue-500/40",
                preparando: "border-orange-500/40",
                aceita: "border-purple-500/40",
                saiu_entrega: "border-amber-800/40",
                finalizado: "border-green-600/40",
                entregue: "border-green-600/40",
                pronto: "border-teal-500/40",
                cancelado: "border-destructive/40",
              };
              return getStatusFlow(order.tipo).map((statusKey, index, array) => {
                const config = statusConfig[statusKey];
                const timestamp = timelineMap[statusKey];
                const isCompleted = !!timestamp || completedStatuses.has(statusKey);
                const isCurrent = order.status === statusKey;
                const Icon = config?.icon || Check;
                const colorClass = statusColorMap[statusKey] || "bg-primary text-primary-foreground";
                const borderClass = borderColorMap[statusKey] || "border-primary/40";

                return (
                  <div key={statusKey} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                    <div className="relative w-9 h-9 flex items-center justify-center">
                      {isCurrent && statusKey !== "finalizado" && (
                        <div className={cn(
                          "absolute -inset-1.5 rounded-full border-4 animate-border-pulse",
                          borderClass
                        )} />
                      )}
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 z-10",
                        isCompleted || isCurrent ? colorClass : "bg-muted text-muted-foreground",
                        isCurrent && "scale-110"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] sm:text-xs font-bold whitespace-nowrap ${
                        isCurrent ? 'text-foreground' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {config?.label || statusKey}
                      </p>
                      {timestamp && (
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="sm:col-span-2 space-y-4">
          <Card className="border-border/50 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent px-4 py-2.5 flex items-center gap-2 border-b border-border/50">
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-bold text-foreground">Itens do Pedido</h3>
              <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600 bg-orange-500/5">{items.length} {items.length === 1 ? "item" : "itens"}</Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-auto h-6 gap-1 rounded-full px-2.5 text-xs bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700" title="Excluir pedido">
                    <Trash2 className="w-3 h-3" />
                    Excluir pedido
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita. O pedido será removido permanentemente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const { error } = await (supabase.from("pedidos") as any).delete().eq("id", id);
                        if (error) {
                          toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
                        } else {
                          toast({ title: "Pedido excluído" });
                          navigate("/lojista/pedidos");
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <CardContent className="p-4">


              <div className="space-y-2">
                {items.map((item, idx) => {
                  const name = item.nome || item.name || "Item";
                  const qty = item.qtd || item.quantity || item.quantidade || 1;
                  const price = item.preco || item.price || 0;
                  const imgUrl = item.imagem_url || (item.id && productImages?.[item.id]) || null;
                  const addons = (item.adicionais || (item as any).addons || []).map((add: any, i: number) => {
                     const addName = typeof add === "string" ? add : (add as any).nome || add;
                     const addPrice = typeof add === "object" ? Number((add as any).preco) || 0 : 0;
                     const addQty = typeof add === "object" ? Number((add as any).quantidade ?? (add as any).qtd ?? 1) || 1 : 1;
                     return { nome: addName, preco: addPrice, quantidade: addQty };
                  });
                  const addonsTotal = addons.reduce((s, a) => s + a.preco * a.quantidade, 0);
                  const storedPrice = Number(price) || 0;
                  const itemSubtotal = storedPrice * qty;

                  return (
                    <div key={idx} className="flex items-stretch gap-0 p-0 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors overflow-hidden border border-border/30">
                      <div className="flex flex-1 flex-col gap-2 p-3 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border/30">
                            {imgUrl ? <img src={imgUrl} alt={name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground/40" /></div>}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start sm:gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground leading-tight">{name}</p>
                              {item.tamanho && <p className="text-[11px] font-bold text-primary mt-0.5 uppercase">Tamanho: {item.tamanho}</p>}
                              {item.weight && (item.unidade_medida === "kg" || /quilo|kg/i.test(String(item.unidade_medida || ""))) && (
                                <p className="text-[11px] font-bold text-primary mt-0.5">Peso: {item.weight}g</p>
                              )}
                              <div className="sm:hidden mt-1">
                                <div className="flex items-center justify-start gap-1.5 text-xs font-semibold text-foreground">
                                  <span>{qty}x</span>
                                  <span className="text-muted-foreground">·</span>
                                  <span>{formatCurrency(storedPrice)}</span>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="font-bold">{formatCurrency(itemSubtotal)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="hidden sm:block text-right min-w-[90px]">
                              <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-foreground">
                                <span>{qty}x</span>
                                <span className="text-muted-foreground">·</span>
                                <span>{formatCurrency(storedPrice)}</span>
                                <span className="text-muted-foreground">·</span>
                                <span className="font-bold">{formatCurrency(itemSubtotal)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-full min-w-0">
                          {item.sabores && item.sabores.length > 0 && (
                            <div className="mt-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Sabores:</p>
                              {item.sabores.map((s: any, i: number) => {
                                const sName = typeof s === "string" ? s : s?.nome || "";
                                const sPrice = typeof s === "object" ? Number(s?.preco ?? s?.valorExtra ?? 0) : 0;
                                return (
                                  <p key={i} className="text-[11px] text-muted-foreground">
                                    {sName}
                                    {sPrice > 0 && <span className="text-primary font-bold ml-1">({formatCurrency(sPrice)})</span>}
                                  </p>
                                );
                              })}
                            </div>
                          )}
                          {item.caldo_sabor && (
                            <div className="mt-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Sabor Caldo:</p>
                              <p className="text-[11px] text-muted-foreground">
                                {item.caldo_sabor.nome} 
                                {item.caldo_sabor.valorExtra > 0 && <span className="text-primary font-bold ml-1">({formatCurrency(item.caldo_sabor.valorExtra)})</span>}
                              </p>
                            </div>
                          )}
                          {addons.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Adicionais:</p>
                              {addons.map((add, i) => (
                                <p key={i} className="text-[11px] text-muted-foreground">
                                  + <span className="font-semibold">{add.quantidade}x</span> {add.nome}
                                  {add.preco > 0 && <span className="text-primary font-bold ml-1">({formatCurrency(add.preco * add.quantidade)})</span>}
                                </p>
                              ))}
                            </div>
                          )}
                          {(item.observacao || (item as any).observation) && <p className="text-[11px] text-yellow-700 dark:text-yellow-400 mt-1 italic">💬 {item.observacao || (item as any).observation}</p>}
                          {addonsTotal > 0 && (
                            <div className="mt-2 pt-2 border-t-2 border-border flex items-center justify-between gap-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Sub Total</p>
                              <p className="text-sm font-bold text-primary">{formatCurrency(itemSubtotal + addonsTotal * qty)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      
                      <div className="w-10 border-l border-border/30 flex flex-col items-center justify-center bg-white gap-2">
                        {order.status !== "finalizado" && order.status !== "cancelado" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" title="Excluir item">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeItem.mutate(idx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Taxa de entrega</span>
                    <span className={cn((order as any).cupom_tipo === 'frete_gratis' && "line-through opacity-60")}>
                      {formatCurrency(deliveryFee)}
                    </span>
                  </div>
                )}
                {order.cupom_desconto > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Desconto (Cupom: {order.cupom_codigo})</span>
                    {(order as any).cupom_tipo !== 'frete_gratis' && <span>-{formatCurrency(order.cupom_desconto)}</span>}
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-primary pt-1">
                  <span>Total</span>
                  <span>{formatCurrency(Number(order.total || 0))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Rating Comment (if any) */}
          {(order as any).avaliacao_comentario && (
            <Card className="border-border/50 shadow-sm border-yellow-500/30 bg-yellow-50/5 dark:bg-yellow-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <h3 className="text-sm font-bold text-foreground">Comentário do Cliente</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-sm text-muted-foreground italic">"{(order as any).avaliacao_comentario}"</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Info */}
          <Card className="border-border/50 overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2.5 flex items-center gap-2 border-b border-border/50">
              <User className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Cliente</h3>
            </div>
            <CardContent className="p-4 space-y-4">
              {/* Header: avatar + nome + ações rápidas */}
              <div className="flex items-center gap-3">
                {clienteInfo?.foto_url ? (
                  <img src={clienteInfo.foto_url} alt={order.cliente_nome || ""} className="w-12 h-12 rounded-full object-cover shrink-0 border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-base font-bold shrink-0">
                    {(order.cliente_nome || "C").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{order.cliente_nome || "Não identificado"}</p>
                  {order.cliente_telefone && (
                    <a href={`tel:${order.cliente_telefone}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary hover:underline">
                      <Phone className="w-3 h-3" /> {formatPhone(order.cliente_telefone)}
                    </a>
                  )}
                </div>
                {order.cliente_telefone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 rounded-lg bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-700 shrink-0"
                    onClick={sendWhatsApp}
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Pagamento */}
                {(order as any).forma_pagamento && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" /> Pagamento
                    </p>
                    <p className="text-sm font-semibold text-foreground">{(order as any).forma_pagamento}</p>
                    {((order as any).forma_pagamento?.toUpperCase() === "DINHEIRO" || (order as any).troco_para || (order as any).payment_method?.toUpperCase() === "DINHEIRO") && Number((order as any).troco_para) > 0 && (
                      <div className="pt-1 mt-1 border-t border-border/40 space-y-0.5">
                        <p className="text-[11px] text-muted-foreground">
                          Troco para: <span className="font-semibold text-foreground">{formatCurrency(Number((order as any).troco_para))}</span>
                        </p>
                        {Number((order as any).troco_para) - Number(order.total || 0) > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            TROCO: <span className="font-bold text-primary">{formatCurrency(Number((order as any).troco_para) - Number(order.total || 0))}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Endereço - ocupa toda a largura */}
                {order.endereco_entrega && (
                  <div className="sm:col-span-2 relative rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-muted/30 to-transparent p-3 space-y-2 overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-12 translate-x-12 pointer-events-none" />
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5 relative">
                      <MapPin className="w-3 h-3" /> Endereço de Entrega
                    </p>
                    <div className="relative flex gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground leading-snug flex-1">{order.endereco_entrega}</p>
                    </div>
                    <div className="flex gap-2 pt-1 relative">
                      <Button variant="outline" size="sm" className="text-xs h-8 rounded-lg flex-1 bg-background/50" onClick={copyAddress}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                      </Button>
                      <Button size="sm" className="text-xs h-8 rounded-lg flex-1 bg-primary hover:bg-primary/90" onClick={openMaps}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir no Maps
                      </Button>
                    </div>
                  </div>
                )}


              </div>
            </CardContent>
          </Card>


          {/* Delivery Info - full width (apenas se entregas habilitado no plano) */}
          {(entrega as any) && limits?.entregas && (

            <Card className="border-border/50 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent px-4 py-2.5 flex items-center gap-2 border-b border-border/50">
                <Truck className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-foreground">Entrega</h3>
                {(entrega as any).status && (
                  <Badge variant="outline" className="text-[10px] ml-auto uppercase border-orange-500/30 text-orange-600 bg-orange-500/5">
                    {(entrega as any).status}
                  </Badge>
                )}
              </div>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Entregador */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Entregador
                    </p>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {((entrega as any).entregador?.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {(entrega as any).entregador?.full_name || "Aguardando aceitação"}
                        </p>
                        {(entrega as any).entregador?.phone && (
                          <a href={`tel:${(entrega as any).entregador.phone}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-orange-600 hover:underline">
                            <Phone className="w-3 h-3" /> {(entrega as any).entregador.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Taxa de Entrega */}
                  <div className="relative rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-muted/30 to-transparent p-3 space-y-2 overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full -translate-y-10 translate-x-10 pointer-events-none" />
                    <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest flex items-center gap-1.5 relative">
                      <CreditCard className="w-3 h-3" /> Taxa de Entrega
                    </p>
                    <p className="text-2xl font-bold text-orange-600 relative">
                      {formatCurrency(Number((entrega as any).valor_entrega || 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        <div className="space-y-4 sm:sticky sm:top-6 self-start min-w-0">
          <div className="flex justify-center print:block overflow-hidden" style={{ zoom: 1.3 } as any}>
            <ThermalReceipt ref={receiptRef} order={order} loja={loja} orderNumStr={orderNumStr} />
          </div>
          <div className="flex flex-row gap-2 max-w-[300px] mx-auto w-full print:hidden">
            <Button variant="outline" size="sm" className="rounded-lg flex-1" onClick={printKitchen}>
              <Printer className="w-4 h-4 mr-2" /> Cozinha
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg flex-1" onClick={printOrder}>
              <Printer className="w-4 h-4 mr-2" /> Cliente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

function parseItems(items: any): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((i: any) => (typeof i === "string" ? { nome: i, qtd: 1 } : i));
}

export default OrderDetail;