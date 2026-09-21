import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Clock,
  MapPin,
  Phone,
  Check,
  Truck as TruckIcon,
  Loader2,
  Printer,
  X,
  ShoppingCart,
  CreditCard,
  ChefHat,
  Ban,
  Package,
  AlertCircle,
  Undo2,
  Star,
  Copy,
  Bike,
  Sandwich,
  User,
  MessageCircle,
  Pencil,
  Trash2,
  Volume2,
  VolumeX,
  Search,
  FileText,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvUser } from "@/contexts/PdvUserContext";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";
import { useToast } from "@/hooks/use-toast";
import { qzService } from "@/utils/qzService";
import { isMobileOrTabletDevice, printReceipt } from "@/utils/printHelper";

import { renderToStaticMarkup } from "react-dom/server";
import ThermalReceipt from "@/components/admin/ThermalReceipt";
import DailySalesReportDialog from "@/components/admin/DailySalesReportDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";

interface OrderItem {
  nome?: string;
  name?: string;
  qtd?: number;
  quantity?: number;
  quantidade?: number;
  preco?: number;
  price?: number;
  observacao?: string;
  adicionais?: string[];
  sabores?: string[];
  quantidade_sabores?: number;
  tamanho?: string;
  bordas?: string[];
  quantidade_bordas?: number;
  weight?: string;
  unidade_medida?: string;
}

const statusConfig: Record<
  string,
  {
    label: string;
    color: string;
    bgClass: string;
    textClass: string;
    icon: any;
    next?: string;
    nextLabel?: string;
    nextIcon?: any;
  }
> = {
  pendente: {
    label: "Pendente",
    color: "yellow",
    bgClass: "bg-yellow-500 border-yellow-600",
    textClass: "text-white",
    icon: AlertCircle,
    next: "aceito",
    nextLabel: "Aceitar Pedido",
    nextIcon: Check,
  },
  aceito: {
    label: "Aceito",
    color: "blue",
    bgClass: "bg-blue-500 border-blue-600",
    textClass: "text-white",
    icon: Check,
    next: "preparando",
    nextLabel: "Iniciar Preparo",
    nextIcon: ChefHat,
  },
  preparando: {
    label: "Em Preparo",
    color: "orange",
    bgClass: "bg-orange-500 border-orange-600",
    textClass: "text-white",
    icon: ChefHat,
    next: "aceita",
    nextLabel: "Enviar para entrega",
    nextIcon: TruckIcon,
  },
  aceita: {
    label: "Aguarda Coleta",
    color: "purple",
    bgClass: "bg-purple-500 border-purple-600",
    textClass: "text-white",
    icon: Sandwich,
    next: "saiu_entrega",
    nextLabel: "Saiu para entrega",
    nextIcon: TruckIcon,
  },
  saiu_entrega: {
    label: "Em Entrega",
    color: "brown",
    bgClass: "bg-amber-800 border-amber-900",
    textClass: "text-white",
    icon: Bike,
    next: "finalizado",
    nextLabel: "Finalizar",
    nextIcon: Package,
  },
  finalizado: {
    label: "Finalizado",
    color: "green",
    bgClass: "bg-green-600 border-green-700",
    textClass: "text-white",
    icon: Package,
  },
  cancelado: {
    label: "Cancelado",
    color: "gray",
    bgClass: "bg-muted border-muted-foreground/30",
    textClass: "text-muted-foreground",
    icon: Ban,
  },
  entregue: {
    label: "Finalizado",
    color: "green",
    bgClass: "bg-green-600 border-green-700",
    textClass: "text-white",
    icon: Package,
  },
  pronto: {
    label: "Pronto",
    color: "teal",
    bgClass: "bg-teal-500 border-teal-600",
    textClass: "text-white",
    icon: Check,
  },
};

const badgeBgByColor: Record<string, string> = {
  yellow: "bg-yellow-700 text-white",
  blue: "bg-blue-700 text-white",
  orange: "bg-orange-700 text-white",
  purple: "bg-purple-700 text-white",
  amber: "bg-amber-700 text-white",
  green: "bg-green-800 text-white",
  red: "bg-red-700 text-white",
  gray: "bg-background/80 text-muted-foreground",
  teal: "bg-teal-700 text-white",
};

const getStatusForOrder = (order: any) => {
  const base = statusConfig[order.status] ?? statusConfig.pendente;
  const st = { ...base };
  const tipo = order.tipo || "delivery";

  if (tipo === "balcao" || tipo === "mesa") {
    // PDV flow: preparando → pronto → entregue
    if (order.status === "preparando") {
      st.next = "pronto";
      st.nextLabel = "Pedido Pronto";
      st.nextIcon = Check;
    } else if (order.status === "pronto") {
      st.next = "entregue";
      st.nextLabel = "Finalizar";
      st.nextIcon = Package;
    }
    // No next for entregue
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
  // delivery uses default statusConfig next values

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

const tabs = [
  { key: "all", label: "Todos" },
  { key: "pendente", label: "Pendentes" },
  { key: "aceito", label: "Aceitos" },
  { key: "preparando", label: "Em Preparo" },
  { key: "saiu_entrega", label: "Em Entrega" },
  { key: "finalizado", label: "Finalizados" },
  { key: "cancelado", label: "Cancelados" },
];

const getDailyNumber = (order: any, allOrders: any[]): string => {
  const nd = (order as any).numero_diario;
  if (nd) return String(nd).padStart(3, "0");
  // Fallback: compute from position in same day
  const orderDate = new Date(order.created_at).toDateString();
  const sameDayOrders = allOrders
    .filter((o: any) => new Date(o.created_at).toDateString() === orderDate && o.lojista_id === order.lojista_id)
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const idx = sameDayOrders.findIndex((o: any) => o.id === order.id);
  return String((idx >= 0 ? idx + 1 : sameDayOrders.length + 1)).padStart(3, "0");
};

const Orders = () => {
  useKeepScreenOn(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("orders-muted") === "true";
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>({
    cliente_nome: "",
    cliente_telefone: "",
    endereco_entrega: "",
    observacoes: "",
    forma_pagamento: "",
    troco_para: "",
    total: 0
  });
  const isMobile = useIsMobile();

  const navigate = useNavigate();
  const { user } = useAuth();
  const { pdvUser, hasPermission } = usePdvUser();
  const { limits } = useStorePlanLimits();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prevCountRef = useRef(0);

  const toggleMute = () => {
    setIsMuted(prev => {
      const newVal = !prev;
      localStorage.setItem("orders-muted", String(newVal));
      return newVal;
    });
  };

  const { data: loja } = useQuery({
    queryKey: ["lojista-loja-orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, impressao_automatica, horario_funcionamento, avaliacoes_ativas, tolerancia_pedidos_min, impressao_automatica_qz, documento, impressora_qz_nome, impressao_status_gatilho, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, impressao_duas_vias, margem_superior, margem_inferior, margem_esquerda, margem_direita")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Início do "dia comercial": só estende para ontem se o expediente de ontem
  // cruzou a meia-noite (ex.: 18:00 → 02:00) e ainda estamos dentro dele (+60min de tolerância).
  // Caso contrário, sempre meia-noite de hoje.
  const getBusinessDayStart = useCallback(() => {
    const now = new Date();
    const midnightToday = new Date(now);
    midnightToday.setHours(0, 0, 0, 0);

    const horario = (loja as any)?.horario_funcionamento;
    if (!horario) return midnightToday;

    const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const ySchedule = horario[dayNames[yesterday.getDay()]];

    if (ySchedule?.aberto && ySchedule?.inicio && ySchedule?.fim) {
      const [openH, openM] = ySchedule.inicio.split(":").map(Number);
      const [closeH, closeM] = ySchedule.fim.split(":").map(Number);
      const openMin = openH * 60 + openM;
      const closeMin = closeH * 60 + closeM;

      // Cruzou meia-noite?
      if (closeMin <= openMin) {
        const closingToday = new Date(midnightToday);
        closingToday.setHours(closeH, closeM, 0, 0);
        const toleranciaMin = (loja as any)?.tolerancia_pedidos_min ?? 60;
        const toleranceEnd = new Date(closingToday.getTime() + toleranciaMin * 60000);

        if (now < toleranceEnd) {
          const openYesterday = new Date(yesterday);
          openYesterday.setHours(openH, openM, 0, 0);
          return openYesterday;
        }
      }
    }

    return midnightToday;
  }, [loja]);



  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["pedidos", loja?.id],
    queryFn: async () => {
      const businessStart = getBusinessDayStart();
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", user!.id)
        .gte("created_at", businessStart.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!loja,
  });

  // Fetch entregas with entregador info for each order
  const { data: entregasMap = {} } = useQuery({
    queryKey: ["entregas-por-pedido", user?.id],
    queryFn: async () => {
      const { data: lojaData } = await supabase.from("lojas").select("id").eq("user_id", user!.id).single();
      if (!lojaData) return {};
      const { data, error } = await supabase
        .from("entregas")
        .select("pedido_id, entregador_id, status")
        .eq("lojista_id", lojaData.id);
      if (error) return {};
      const map: Record<string, { entregador_id: string | null; status: string }> = {};
      for (const e of data || []) {
        if (e.pedido_id) map[e.pedido_id] = { entregador_id: e.entregador_id, status: e.status };
      }
      return map;
    },
    enabled: !!user,
  });

  const entregadorIds = Object.values(entregasMap).map((e: any) => e.entregador_id).filter(Boolean);
  const { data: entregadorProfiles = {} } = useQuery({
    queryKey: ["entregador-profiles", entregadorIds],
    queryFn: async () => {
      if (entregadorIds.length === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", entregadorIds);
      const map: Record<string, string> = {};
      for (const p of data || []) map[p.user_id] = p.full_name || "Entregador";
      return map;
    },
    enabled: entregadorIds.length > 0,
  });

  // Aggregated review stats (synced with /lojista/avaliacoes "Todos")
  const { data: reviewStats = { count: 0, avg: 0 } } = useQuery({
    queryKey: ["all-reviews-stats", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("avaliacao")
        .eq("lojista_id", user!.id)
        .not("avaliacao", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      const list = data ?? [];
      const avg = list.length > 0 ? list.reduce((s: number, r: any) => s + r.avaliacao, 0) / list.length : 0;
      return { count: list.length, avg };
    },
    enabled: !!user,
  });

  // Realtime subscription for new orders
  useRealtimeSubscription(
    "pedidos",
    [["pedidos"], ["pending-orders-count"]],
    user ? `lojista_id=eq.${user.id}` : undefined
  );

  // Track previous order statuses to detect transitions
  const prevStatusMapRef = useRef<Record<string, string>>({});

  // Sound notification for new pending orders is handled globally in AdminLayout
  // so it plays on any /lojista page, not just this one.

  // "Tick" que força re-render a cada 15s para que o tempo exibido nos cards
  // ("há X min") avance sozinho, sem precisar navegar para outra tela.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  // Lembrete sonoro: para todo pedido pendente há >= 1 min, dá 2 bips a cada 1 min
  // até o status mudar (deixar de ser "pendente"). Guarda o último bip por pedido.
  const reminderBeepsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const playTwoBeeps = () => {
      // Usa o mesmo bipe de novo pedido (tratado no AdminLayout)
      try {
        window.dispatchEvent(new CustomEvent("play-order-beep"));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("play-order-beep"));
        }, 320);
      } catch (err) {
        console.warn("Falha ao emitir bip de lembrete:", err);
      }
    };

    const interval = setInterval(() => {
      const now = Date.now();
      // Limpa entradas de pedidos que não são mais pendentes
      for (const id of Object.keys(reminderBeepsRef.current)) {
        const stillPending = (orders as any[]).some(
          (o) => o.id === id && o.status === "pendente"
        );
        if (!stillPending) delete reminderBeepsRef.current[id];
      }
      // Verifica cada pedido pendente
      (orders as any[])
        .filter((o) => o.status === "pendente")
        .forEach((o) => {
          const ageMs = now - new Date(o.created_at).getTime();
          if (ageMs < 60_000) return; // ainda não completou 1 minuto
          const lastBeep = reminderBeepsRef.current[o.id] ?? 0;
          if (now - lastBeep >= 60_000) {
            reminderBeepsRef.current[o.id] = now;
            playTwoBeeps();
          }
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [orders]);

  const autoPrintStatusInitializedRef = useRef(false);
  const autoPrintAttemptedPendingRef = useRef<Set<string>>(new Set());


  // Renderiza o MESMO ThermalReceipt usado em /lojista/pedido/:id para
  // garantir layout idêntico em qualquer ponto de impressão.
  const renderReceiptHTML = useCallback(
    (order: any) => {
      const orderNumStr = String(getDailyNumber(order, orders));
      return renderToStaticMarkup(
        <ThermalReceipt order={order} loja={loja} orderNumStr={orderNumStr} />
      );
    },
    [loja, orders]
  );

  // Auto print logic for QZ Tray — usa o HTML do ThermalReceipt
  const printThermal = useCallback(
    async (order: any) => {
      if (!loja || !order) return;
      try {
        const selectedPrinter =
          (loja as any)?.impressora_qz_nome || localStorage.getItem("qz-selected-printer");
        if (!selectedPrinter) return;

        const content = renderReceiptHTML(order);

        const printLabel = (label: string) => `
          <div style="text-align:center;font-weight:900;font-size:11px;border:1px solid #000;margin-bottom:8px;padding:2px;font-family:monospace;">
            VIA: ${label}
          </div>
        `;

        const marginSettings = {
          top: (loja as any).margem_superior || 0,
          bottom: (loja as any).margem_inferior || 0,
          left: (loja as any).margem_esquerda || 0,
          right: (loja as any).margem_direita || 0,
          doubleStrike: (loja as any).qz_double_strike || false,
        };

        if ((loja as any).impressao_duas_vias) {
          await qzService.printHTML(printLabel("ESTABELECIMENTO") + content, selectedPrinter, marginSettings);
          await qzService.printHTML(printLabel("ENTREGADOR") + content, selectedPrinter, marginSettings);
        } else {
          await qzService.printHTML(content, selectedPrinter, marginSettings);
        }

        console.log("Auto-printed via QZ Tray:", order.id);
      } catch (error) {
        console.error("QZ Auto print error:", error);
      }
    },
    [loja, renderReceiptHTML],
  );

  const printOrder = useCallback(
    async (order: any) => {
      if (!order) return;

      const selectedPrinter =
        (loja as any)?.impressora_qz_nome || localStorage.getItem("qz-selected-printer");
      const isMobileOrTablet = isMobileOrTabletDevice();
      const content = renderReceiptHTML(order);

      if (isMobileOrTablet) {
        try {
          toast({ title: "Enviando para a impressora Bluetooth..." });
          await printReceipt(content);
        } catch (error) {
          console.error("Erro ao imprimir pedido no dispositivo:", error);
          toast({
            title: "Erro na impressão",
            description: "Falha ao abrir a impressão do dispositivo.",
            variant: "destructive",
          });
        }
        return;
      }

      // Desktop: se houver impressora Bluetooth pareada, prioriza ela.
      let btAttempted = false;
      try {
        const { bluetoothPrintService, getBluetoothSettings } = await import("@/utils/bluetoothPrint");
        const bt = getBluetoothSettings();
        const btPaired = !!(bt.deviceId || bt.deviceName) && bluetoothPrintService.isSupported();
        if (btPaired) {
          btAttempted = true;
          if (!bluetoothPrintService.isConnected()) {
            try { await bluetoothPrintService.tryAutoReconnect(); } catch {}
          }
          if (bluetoothPrintService.isConnected()) {
            toast({ title: "Enviando para a impressora Bluetooth..." });
            await printReceipt(content);
            return;
          }
        }
      } catch {}

      // Fallback QZ Tray: se BT indisponível/falhou, tenta impressora térmica QZ.
      try {
        await qzService.connect();
        toast({ title: btAttempted ? "Bluetooth indisponível — usando impressora térmica..." : "Enviando para a impressora térmica..." });
        await printThermal(order);
        return;
      } catch {
        if (selectedPrinter) {
          toast({ title: "Enviando para a impressora térmica..." });
          await printThermal(order);
          return;
        }
      }

      try {
        toast({ title: "Abrindo janela de impressão..." });
        await printReceipt(content);
      } catch (error) {
        console.error("Erro ao imprimir pedido:", error);
        toast({
          title: "Erro na impressão",
          description: "Falha ao abrir a janela de impressão.",
          variant: "destructive",
        });
      }
    },
    [loja, printThermal, renderReceiptHTML],
  );


  const handleAutoPrint = useCallback(
    async (order: any) => {
      try {
        const { getBluetoothSettings } = await import("@/utils/bluetoothPrint");
        if (getBluetoothSettings().printOnAccept === false) return;
      } catch {}
      if (isMobileOrTabletDevice()) {
        await printOrder(order);
      } else if ((loja as any)?.impressao_automatica_qz) {
        await printThermal(order);
      } else if ((loja as any)?.impressao_automatica) {
        await printOrder(order);
      }
    },
    [loja, printThermal, printOrder],
  );

  // Auto-print quando um pedido entra em "pendente".
  // A tentativa é deduplicada por pedido antes do envio para evitar reimpressão
  // em refetches, eventos realtime duplicados ou re-renderizações.
  useEffect(() => {
    const list = (orders as any[]) || [];

    if (!autoPrintStatusInitializedRef.current) {
      prevStatusMapRef.current = Object.fromEntries(
        list.map((order) => [order.id, order.status])
      );
      autoPrintStatusInitializedRef.current = true;
      return;
    }

    const previousStatuses = prevStatusMapRef.current;
    const enteredPending = list.filter((order) => {
      const previousStatus = previousStatuses[order.id];
      const isNewOrder = previousStatus === undefined;
      const hasEnteredPending = order.status === "pendente" && previousStatus !== "pendente";

      if (!hasEnteredPending) return false;
      if (autoPrintAttemptedPendingRef.current.has(order.id)) return false;

      // Marca antes da impressão para impedir tentativas duplicadas mesmo se
      // ocorrer novo refetch enquanto a impressão ainda está em andamento.
      autoPrintAttemptedPendingRef.current.add(order.id);
      return isNewOrder || previousStatus !== undefined;
    });

    prevStatusMapRef.current = Object.fromEntries(
      list.map((order) => [order.id, order.status])
    );

    if (enteredPending.length === 0) return;

    (async () => {
      try {
        const isMobile = isMobileOrTabletDevice();
        const { getBluetoothSettings, bluetoothPrintService } = await import(
          "@/utils/bluetoothPrint"
        );
        const bt = getBluetoothSettings();
        const qzAuto = !!(loja as any)?.impressao_automatica_qz;
        const lojaAuto = !!(loja as any)?.impressao_automatica;

        // Mobile/Tablet: Bluetooth Mini Print
        if (isMobile) {
          if (!bt.autoPrint) return;
          if (!bluetoothPrintService.isConnected()) {
            try { await bluetoothPrintService.tryAutoReconnect(); } catch {}
          }
          for (const order of enteredPending) {
            try { await printOrder(order); } catch (e) { console.error(e); }
          }
          return;
        }

        // Desktop: prioriza Bluetooth se estiver pareada+autoPrint,
        // senão QZ Tray térmica, senão fallback padrão.
        const btPaired = !!(bt.deviceId || bt.deviceName);
        const btReady = bt.autoPrint && bluetoothPrintService.isSupported() && btPaired;

        if (btReady) {
          if (!bluetoothPrintService.isConnected()) {
            try { await bluetoothPrintService.tryAutoReconnect(); } catch {}
          }
          if (bluetoothPrintService.isConnected()) {
            for (const order of enteredPending) {
              try { await printOrder(order); } catch (e) { console.error(e); }
            }
            return;
          }
          // BT pareado mas indisponível → tenta QZ Tray como fallback
          try {
            await qzService.connect();
            for (const order of enteredPending) {
              try { await printThermal(order); } catch (e) { console.error(e); }
            }
            return;
          } catch { /* QZ indisponível também, segue fluxo */ }
        }

        if (qzAuto) {
          for (const order of enteredPending) {
            try { await printThermal(order); } catch (e) { console.error(e); }
          }
          return;
        }

        if (lojaAuto) {
          for (const order of enteredPending) {
            try { await printOrder(order); } catch (e) { console.error(e); }
          }
        }
      } catch (err) {
        console.error("Erro no auto-print:", err);
      }
    })();
  }, [orders, printOrder, printThermal, loja]);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, orderData }: { id: string; status: string; orderData?: any }) => {
      const currentHistory = Array.isArray(orderData?.status_historico) ? orderData.status_historico : [];
      const newHistory = [...currentHistory, { status, timestamp: new Date().toISOString() }];

      const { error } = await supabase
        .from("pedidos")
        .update({ status, status_historico: newHistory, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;

      // Create delivery record ONLY when the delivery module is enabled for this store
      if (limits.entregas && (status === "aceita" || status === "saiu_entrega") && orderData && orderData.tipo !== "retirada") {
        const { data: existing } = await supabase
          .from("entregas")
          .select("id")
          .eq("pedido_id", id)
          .maybeSingle();

        if (!existing) {
          const orderTaxaEntrega = (orderData as any).taxa_entrega;
          let deliveryFee: number;
          if (orderTaxaEntrega != null) {
            deliveryFee = Number(orderTaxaEntrega);
          } else {
            const items = parseItems(orderData.items);
            const subtotal = items.reduce((acc, i) => acc + (i.preco || i.price || 0) * (i.qtd || i.quantity || i.quantidade || 1), 0);
            deliveryFee = Math.max(0, (orderData.total || 0) - subtotal);
          }
          
          const lojaId = (loja as any)?.id;
          if (!lojaId) {
            console.error("Loja ID não encontrado para criar entrega");
            return;
          }

          const { error: deliveryError } = await (supabase.from("entregas") as any).insert({
            pedido_id: id,
            lojista_id: lojaId,
            status: "pendente",
            endereco_entrega: orderData.endereco_entrega,
            valor_entrega: deliveryFee,
            valor_total: orderData.total,
          });
          if (deliveryError) {
            console.error("Erro ao criar entrega:", deliveryError);
          }
        }
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-lojista"] });
      toast({ title: "Status atualizado ✅" });
      
      if (selectedOrder) {
        const updated = (orders as any[]).find((o: any) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder({ ...updated });
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
      toast({ title: "Pedido excluído 🗑️" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("pedidos")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({ title: "Pedido atualizado com sucesso! ✅" });
      setIsEditingOrder(false);
      setSelectedOrder(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar pedido", description: err.message, variant: "destructive" });
    },
  });

  const handleWhatsApp = (order: any) => {
    if (order?.cliente_telefone) {
      const phone = order.cliente_telefone.replace(/\D/g, "");
      const orderNum = getDailyNumber(order, orders);
      const text = `Olá ${order.cliente_nome || ""}! Seu pedido Nº ${orderNum} está ${statusConfig[order.status]?.label || order.status}. Obrigado pela preferência!`;
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const baseFiltered = activeTab === "all" ? orders : orders.filter((o: any) => o.status === activeTab);
  const filtered = searchQuery.trim()
    ? baseFiltered.filter((o: any) => getDailyNumber(o, orders).includes(searchQuery.trim()))
    : baseFiltered;

  const timeAgo = (order: any) => {
    const isFinal = order.status === "finalizado" || order.status === "retirado";
    const endTime = isFinal && order.updated_at
      ? new Date(order.updated_at).getTime()
      : Date.now();
    const diff = Math.floor((endTime - new Date(order.created_at).getTime()) / 60000);
    if (diff < 1) return isFinal ? "<1 min" : "agora";
    if (diff < 60) return isFinal ? `${diff} min` : `há ${diff} min`;
    const h = Math.floor(diff / 60);
    const min = diff % 60;
    if (isFinal) {
      return min > 0 ? `${h}h ${min}min` : `${h}h`;
    }
    return `há ${h}h${min > 0 ? ` ${min}min` : ""}`;
  };

  function parseItems(items: any): OrderItem[] {
    if (!Array.isArray(items)) return [];
    return items.map((i: any) => {
      if (typeof i === "string") return { nome: i, qtd: 1 };
      return i as OrderItem;
    });
  }

  function formatClienteNome(nome?: string | null): string {
    if (!nome) return "";
    // Preserve PDV Mesa identifiers as-is (e.g., "PDV Mesa 2")
    if (/^(pdv\s+)?mesa\b/i.test(nome.trim())) return nome.trim().replace(/^pdv\s+/i, "");
    const connectors = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del", "della"]);
    const cap = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);
    const words = nome.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    const first = words[0];
    const result: string[] = [cap(first)];
    let i = 1;
    // include connectors that follow the first name
    while (i < words.length && connectors.has(words[i])) {
      result.push(words[i]);
      i++;
    }
    // pick next non-connector as surname, plus any trailing connectors+word? keep simple: just surname
    if (i < words.length) {
      result.push(cap(words[i]));
    }
    return result.join(" ");
  }

  // Stats (synced with business day logic)
  const stats = {
    total: orders.length,
    pendentes: orders.filter((o: any) => o.status === "pendente").length,
    preparo: orders.filter((o: any) => o.status === "preparando" || o.status === "aceito").length,
    emEntrega: orders.filter((o: any) => o.status === "saiu_entrega").length,
    finalizados: orders.filter((o: any) => o.status === "finalizado").length,
  };

  // Tolerance countdown logic
  const [toleranceCountdown, setToleranceCountdown] = useState<string | null>(null);
  const isInTolerance = useRef(false);

  useEffect(() => {
    const horario = (loja as any)?.horario_funcionamento;
    if (!horario) return;

    const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

    const calcRemaining = () => {
      const now = new Date();
      const todayName = dayNames[now.getDay()];
      const todaySchedule = horario[todayName];
      const toleranciaMin = (loja as any)?.tolerancia_pedidos_min ?? 60;

      // Só exibe o banner de tolerância quando o fim da tolerância ultrapassa a meia-noite
      // (fechamento próximo/depois de 00:00). Se a loja fecha cedo e a tolerância termina
      // no mesmo dia, o banner fica oculto.
      const crossesMidnight = (closingTime: Date, toleranceEnd: Date) => {
        const midnightAfterClose = new Date(closingTime);
        midnightAfterClose.setHours(24, 0, 0, 0);
        return toleranceEnd > midnightAfterClose;
      };

      if (todaySchedule?.aberto && todaySchedule?.fim) {
        const [closeH, closeM] = todaySchedule.fim.split(":").map(Number);
        const closingTime = new Date(now);
        if (closeH < 12 && parseInt(todaySchedule.inicio) >= 12) {
          closingTime.setDate(closingTime.getDate() + 1);
        }
        closingTime.setHours(closeH, closeM, 0, 0);
        const toleranceEnd = new Date(closingTime.getTime() + toleranciaMin * 60000);

        if (now >= closingTime && now < toleranceEnd && crossesMidnight(closingTime, toleranceEnd)) {
          const remaining = toleranceEnd.getTime() - now.getTime();
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          isInTolerance.current = true;
          setToleranceCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
          return;
        }
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayName = dayNames[yesterday.getDay()];
      const yesterdaySchedule = horario[yesterdayName];

      if (yesterdaySchedule?.aberto && yesterdaySchedule?.fim) {
        const [closeH, closeM] = yesterdaySchedule.fim.split(":").map(Number);
        const closingTime = new Date(yesterday);
        if (closeH < 12 && parseInt(yesterdaySchedule.inicio) >= 12) {
          closingTime.setDate(closingTime.getDate() + 1);
        }
        closingTime.setHours(closeH, closeM, 0, 0);
        const toleranceEnd = new Date(closingTime.getTime() + toleranciaMin * 60000);

        if (now >= closingTime && now < toleranceEnd && crossesMidnight(closingTime, toleranceEnd)) {

          const remaining = toleranceEnd.getTime() - now.getTime();
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          isInTolerance.current = true;
          setToleranceCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
          return;
        }
      }

      if (isInTolerance.current) {
        isInTolerance.current = false;
        queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      }
      setToleranceCountdown(null);
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [loja, queryClient]);

  return (
    <div className="space-y-4">
      {/* Tolerance countdown banner */}
      {toleranceCountdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
                Estabelecimento fechado — tolerância ativa
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Os pedidos do dia serão zerados em <strong className="font-mono text-base">{toleranceCountdown}</strong>. 
                Após esse período, dê andamento nos pedidos pelo <strong>Histórico de Pedidos</strong>.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dashboard Stats */}
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pb-1">
        {[
          { label: "Pedidos Hoje", value: stats.total, icon: ShoppingCart, color: "text-primary" },
          { label: "Pendentes", value: stats.pendentes, icon: AlertCircle, color: "text-red-600" },
          { label: "Em Preparo", value: stats.preparo, icon: ChefHat, color: "text-orange-600" },
          { label: "Em Entrega", value: stats.emEntrega, icon: Bike, color: "text-amber-800" },
          { label: "Finalizados", value: stats.finalizados, icon: Package, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 min-w-[140px] flex-1">
            <CardContent className="p-4 flex flex-col lg:flex-row items-start lg:items-center gap-0.5 lg:gap-3 text-left">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted/50 ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold font-display text-foreground leading-none lg:hidden">{s.value}</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground leading-none hidden lg:block">{s.value}</p>
                <p className="text-xs text-muted-foreground lg:mt-0">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Avaliações card */}
        {(loja as any)?.avaliacoes_ativas !== false && (
          <Card
            className="border-border/50 min-w-[140px] flex-1 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => navigate("/lojista/avaliacoes")}
          >
            <CardContent className="p-4 flex flex-col lg:flex-row items-start lg:items-center gap-0.5 lg:gap-3 text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted/50 text-yellow-600">
                  <Star className="w-5 h-5" />
                </div>
                <div className="flex items-baseline gap-1 lg:hidden">
                  <p className="text-2xl font-bold font-display text-foreground leading-none">{reviewStats.avg.toFixed(1)}</p>
                  <span className="text-xs text-muted-foreground">({reviewStats.count})</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="hidden lg:flex items-baseline gap-1">
                  <p className="text-2xl font-bold font-display text-foreground leading-none">{reviewStats.avg.toFixed(1)}</p>
                  <span className="text-xs text-muted-foreground">({reviewStats.count})</span>
                </div>
                <div className="flex items-center justify-start lg:justify-between gap-2 lg:mt-1">
                  <p className="text-xs text-muted-foreground">Avaliações</p>
                  <span className="text-[10px] text-primary font-medium hidden lg:inline">Ver mais</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mb-2 px-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative flex-1 max-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Buscar nº do pedido..."
                    className="h-8 pl-8 text-xs rounded-lg"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-1 max-h-64 overflow-y-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                {orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2 text-center">Nenhum pedido hoje</p>
                ) : (
                  orders
                    .filter((o: any) => {
                      const q = searchQuery.trim();
                      if (!q) return true;
                      return getDailyNumber(o, orders).includes(q);
                    })
                    .map((o: any) => {
                      const num = getDailyNumber(o, orders);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setSearchQuery(num);
                            setSearchOpen(false);
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-muted flex items-center justify-between gap-2"
                        >
                          <span className="font-semibold">{num}</span>
                          <span className="text-muted-foreground truncate">{formatClienteNome(o.cliente_nome)}</span>
                        </button>
                      );
                    })
                )}
              </PopoverContent>
            </Popover>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReportOpen(true)}
            className="rounded-full transition-all duration-300 h-8 px-3 gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold"
            title="Vendas do Dia"
          >
            <FileText className="w-4 h-4" />
            Vendas do Dia
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className={cn(
              "rounded-full transition-all duration-300 w-8 h-8",
              isMuted ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            title={isMuted ? "Ativar som de pedidos" : "Silenciar som de pedidos"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none border-b border-border p-2">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const count =
              tab.key === "all" ? orders.length : orders.filter((o: any) => o.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors relative ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-muted border border-border"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>
        
        {hasPermission("financeiro") && limits?.pedidos && (
          <Button variant="outline" size="sm" className="rounded-xl gap-2 whitespace-nowrap border-dashed border-primary/50 text-primary hover:bg-primary/5" onClick={() => navigate("/lojista/pedidos/historico")}>
            <Clock className="w-4 h-4" />
            Histórico
          </Button>
        )}
      </div>

      {/* Order List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((order: any, i: number) => {
              const st = getStatusForOrder(order);
              const isPending = order.status === "pendente";
              const items = parseItems(order.items);
              const StatusIcon = st.icon;
              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className={`border cursor-pointer transition-all hover:shadow-lg overflow-hidden ${
                      isPending ? "animate-pulse ring-2 ring-red-500" : order.status === "cancelado" ? "bg-muted/50 border-muted-foreground/30" : ""
                    }`}
                    onClick={() => navigate(`/lojista/pedidos/${order.id}`)}
                  >
                    {/* Header */}
                    <div className={`px-4 py-3 flex items-center justify-between ${isPending ? "bg-red-500" : st.bgClass}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn("text-xl font-bold font-display", order.status === "cancelado" ? "text-foreground" : "text-white")}>
                          {getDailyNumber(order, orders)}
                        </span>
                        <span className={cn("text-[11px] flex items-center gap-1 shrink-0", order.status === "cancelado" ? "text-muted-foreground" : "text-white")}>
                          <Clock className="w-3 h-3" />
                          {timeAgo(order)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge className={`border-0 text-[10px] font-bold ${isPending ? "bg-red-700 text-white" : (badgeBgByColor[st.color] ?? "bg-black/30 text-white")}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {st.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className={cn("p-4 space-y-3", order.status === "cancelado" ? "bg-muted/30" : "bg-card")}>
                      {/* Cliente + meta inline */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {formatClienteNome(order.cliente_nome) || "Cliente"}
                        </p>
                        <span className="text-[11px] font-medium text-muted-foreground shrink-0 ml-auto">
                          {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {items.length} {items.length === 1 ? "item" : "itens"}
                          {" · "}
                          <span className="uppercase">{order.order_type === "mesa_cliente" ? "QR" : (order.tipo || "delivery")}</span>
                        </span>
                      </div>


                      {/* Extras opcionais */}
                      {(order.avaliacao || order.forma_pagamento) && (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          {order.forma_pagamento ? (
                            <span className="text-muted-foreground flex items-center gap-1 truncate">
                              <CreditCard className="w-3 h-3 shrink-0" />
                              <span className="truncate">{order.forma_pagamento}</span>
                            </span>
                          ) : <span />}
                          {order.avaliacao && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-3 h-3 ${s <= order.avaliacao ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer: total + botões à direita */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
                          <span className="text-lg font-bold font-display text-primary leading-none">
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          {st.next && (
                            <Button
                              size="sm"
                              variant={isPending ? "default" : "outline"}
                              className={`text-xs font-semibold ${isPending ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                              disabled={updateStatus.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus.mutate({ id: order.id, status: st.next!, orderData: order });
                                if (st.next === "aceito") {
                                  handleAutoPrint(order);
                                }
                              }}
                            >
                              {st.nextLabel}
                            </Button>
                          )}
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between font-display mb-2 pr-6">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-3 font-semibold text-lg">
                      Pedido Nº {getDailyNumber(selectedOrder, orders)}
                      {(() => {
                        const st = statusConfig[selectedOrder.status] ?? statusConfig.pendente;
                        return (
                          <Badge className={`border-0 text-xs ${st.bgClass} ${st.textClass}`}>
                            {st.label}
                          </Badge>
                        );
                      })()}
                    </span>
                    {loja && (loja as any).documento && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 font-normal">
                        CPF/CNPJ: {(loja as any).documento}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {isEditingOrder && (
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setIsEditingOrder(false)}>Sair</Button>
                        <Button size="sm" className="h-8 text-xs px-3" onClick={() => updateOrder.mutate({ id: selectedOrder.id, data: editingData })}>Salvar</Button>
                      </div>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {selectedOrder.avaliacao && (
                  <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-bold text-yellow-700">Avaliação do Cliente:</span>
                      <div className="flex items-center gap-0.5 ml-auto">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= selectedOrder.avaliacao ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                    </div>
                    {selectedOrder.avaliacao_comentario && (
                      <p className="text-sm text-yellow-800 italic bg-yellow-500/10 p-2 rounded-md">
                        "{selectedOrder.avaliacao_comentario}"
                      </p>
                    )}
                  </div>
                )}
                {/* Client Info */}
                <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                  {isEditingOrder ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Nome do Cliente</Label>
                        <Input 
                          value={editingData.cliente_nome} 
                          onChange={(e) => setEditingData({...editingData, cliente_nome: e.target.value})}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Telefone</Label>
                        <Input 
                          value={editingData.cliente_telefone} 
                          onChange={(e) => setEditingData({...editingData, cliente_telefone: e.target.value})}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Endereço de Entrega</Label>
                        <Textarea 
                          value={editingData.endereco_entrega} 
                          onChange={(e) => setEditingData({...editingData, endereco_entrega: e.target.value})}
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Forma de Pagamento</Label>
                          <Input 
                            value={editingData.forma_pagamento} 
                            onChange={(e) => setEditingData({...editingData, forma_pagamento: e.target.value})}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Troco Para</Label>
                          <Input 
                            type="number"
                            value={editingData.troco_para} 
                            onChange={(e) => setEditingData({...editingData, troco_para: e.target.value})}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Total do Pedido</Label>
                        <Input 
                          type="number"
                          value={editingData.total} 
                          onChange={(e) => setEditingData({...editingData, total: Number(e.target.value)})}
                          className="h-8 text-sm font-bold text-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Observações do Pedido</Label>
                        <Textarea 
                          value={editingData.observacoes} 
                          onChange={(e) => setEditingData({...editingData, observacoes: e.target.value})}
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">{selectedOrder.cliente_nome || "Cliente não identificado"}</p>
                      {selectedOrder.cliente_telefone && (
                        <>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> {selectedOrder.cliente_telefone}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 rounded-lg bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-700 w-full"
                            onClick={() => handleWhatsApp(selectedOrder)}
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Enviar WhatsApp
                          </Button>
                        </>
                      )}
                      {selectedOrder.endereco_entrega && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {selectedOrder.endereco_entrega}
                        </p>
                      )}
                      {selectedOrder.forma_pagamento && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" /> Pagamento: {selectedOrder.forma_pagamento}
                          </p>
                          {selectedOrder.troco_para && (
                            <p className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1.5 ml-5">
                              Troco para: {formatCurrency(Number(selectedOrder.troco_para))}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedOrder.created_at).toLocaleString("pt-BR")} • {selectedOrder.tipo || "delivery"}
                      </p>
                    </>
                  )}
                </div>

                {/* Items */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">Itens do Pedido</h4>
                    {!isEditingOrder && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-6 px-2 font-bold"
                        onClick={() => {
                          setIsEditingOrder(true);
                          setEditingData({
                            cliente_nome: selectedOrder.cliente_nome || "",
                            cliente_telefone: selectedOrder.cliente_telefone || "",
                            endereco_entrega: selectedOrder.endereco_entrega || "",
                            observacoes: selectedOrder.observacoes || "",
                            forma_pagamento: selectedOrder.forma_pagamento || "",
                            troco_para: selectedOrder.troco_para || "",
                            total: selectedOrder.total || 0
                          });
                        }}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Editar Pedido
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {parseItems(selectedOrder.items).map((item, idx) => {
                      const name = item.nome || item.name || "Item";
                      const qty = item.qtd || item.quantity || 1;
                      const price = item.preco || item.price || 0;
                      const addons = (item.adicionais || []).map((add: any) => {
                        if (typeof add === "string") return { nome: add, preco: 0 };
                        return { nome: (add as any).nome || add, preco: Number((add as any).preco) || 0 };
                      });
                      const addonsTotal = addons.reduce((s: number, a: any) => s + a.preco, 0);
                      const itemTotal = (price + addonsTotal) * qty;
                      return (
                        <div key={idx} className="p-2 rounded bg-muted/30 space-y-1">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium text-foreground">
                              {qty}x {name}
                            </p>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatCurrency(price)}
                            </span>
                          </div>
                          {item.weight && item.unidade_medida === "kg" && (
                            <p className="text-xs font-bold text-primary">Peso: {item.weight}g</p>
                          )}
                          {item.sabores && item.sabores.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Sabores ({item.quantidade_sabores || item.sabores.length}): {item.sabores.join(" / ")}
                            </p>
                          )}
                          {item.observacao && (
                            <p className="text-xs text-muted-foreground">Obs: {item.observacao}</p>
                          )}
                          {addons.length > 0 && (
                            <div className="space-y-0.5 pl-2 border-l-2 border-primary/20">
                              {addons.map((add: any, i: number) => (
                                <div key={i} className="flex justify-between text-[11px] text-muted-foreground">
                                  <span>+ {add.nome}</span>
                                  {add.preco > 0 && <span className="text-foreground font-medium">{formatCurrency(add.preco)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-end pt-0.5 border-t border-border/30">
                            <span className="text-sm font-semibold text-foreground">
                              {formatCurrency(itemTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Observations */}
                {selectedOrder.observacoes && (
                  <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">Observações</p>
                    <p className="text-sm text-foreground">{selectedOrder.observacoes}</p>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold font-display text-primary">
                    {formatCurrency(selectedOrder.total)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const st = getStatusForOrder(selectedOrder);
                    if (!st) return null;
                    const buttons = [];

                    const prev = getPrevStatus(selectedOrder.status, selectedOrder.tipo);
                    if (prev) {
                      buttons.push(
                        <Button
                          key="prev"
                          variant="outline"
                          className="font-semibold"
                          disabled={updateStatus.isPending}
                          onClick={() => {
                            updateStatus.mutate({ id: selectedOrder.id, status: prev, orderData: selectedOrder });
                            setSelectedOrder({ ...selectedOrder, status: prev });
                          }}
                        >
                          <Undo2 className="w-4 h-4 mr-1.5" />
                          Voltar
                        </Button>
                      );
                    }

                    if (st.next) {
                      const NextIcon = st.nextIcon || Check;
                      buttons.push(
                        <Button
                          key="next"
                          className="flex-1 font-semibold"
                          disabled={updateStatus.isPending}
                          onClick={() => {
                            updateStatus.mutate({ id: selectedOrder.id, status: st.next!, orderData: selectedOrder });
                            setSelectedOrder({ ...selectedOrder, status: st.next! });
                            if (st.next === "aceito") {
                              handleAutoPrint(selectedOrder);
                            }
                          }}
                        >
                          <NextIcon className="w-4 h-4 mr-1.5" />
                          {st.nextLabel}
                        </Button>
                      );
                    }

                    if (selectedOrder.status !== "cancelado" && selectedOrder.status !== "finalizado") {
                      buttons.push(
                        <AlertDialog key="cancel">
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              className="font-semibold"
                              disabled={updateStatus.isPending}
                            >
                              <Ban className="w-4 h-4 mr-1.5" />
                              Cancelar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar cancelamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação cancelará o pedido e o cliente será notificado. Deseja continuar?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Não, manter pedido</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => {
                                  updateStatus.mutate({ id: selectedOrder.id, status: "cancelado", orderData: selectedOrder });
                                  setSelectedOrder({ ...selectedOrder, status: "cancelado" });
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Sim, cancelar pedido
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      );
                    }

                    buttons.push(
                      <Button
                        key="print"
                        variant="outline"
                        onClick={() => printOrder(selectedOrder)}
                      >
                        <Printer className="w-4 h-4 mr-1.5" />
                        Imprimir
                      </Button>
                    );

                    return buttons;
                  })()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DailySalesReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        orders={orders as any[]}
        lojaNome={(loja as any)?.nome || ""}
        lojistaId={user?.id}
      />
    </div>
  );
};

export default Orders;
