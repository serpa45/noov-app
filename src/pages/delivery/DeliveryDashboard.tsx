import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { startOfDay, endOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Clock, CheckCircle, Navigation, LogOut, Phone,
  DollarSign, Bike, XCircle, Loader2, Package, ChevronRight, User,
  FileText, Printer, ArrowRight, Timer, TrendingUp, Star, Ban, CircleCheck, X, History, Maximize2, Minimize2,
  ChevronDown, Volume2, VolumeX, MessageCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useNavigationTTS } from "@/hooks/useNavigationTTS";
import DeliveryMap from "@/components/delivery/DeliveryMap";


type Entrega = Tables<"entregas"> & { loja_nome?: string; pedido?: Tables<"pedidos"> | null };
type StatusKey = "pendente" | "aceita" | "coletado" | "em_transito" | "entregue" | "cancelada";

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any; step: number; nextStatus?: string; nextLabel?: string }> = {
  pendente:    { label: "Disponível",  color: "text-amber-600",  bg: "bg-amber-500/10",  icon: Clock,       step: 0, nextStatus: "aceita", nextLabel: "ACEITAR" },
  aceita:      { label: "A caminho da loja", color: "text-blue-600",   bg: "bg-blue-500/10",   icon: Bike,        step: 1, nextStatus: "coletado", nextLabel: "COLETAR" },
  coletado:    { label: "Pedido Coletado",   color: "text-orange-600", bg: "bg-orange-500/10", icon: Package,     step: 2, nextStatus: "em_transito", nextLabel: "SAIR PARA ENTREGA" },
  em_transito: { label: "Em rota de entrega", color: "text-indigo-600", bg: "bg-indigo-500/10", icon: Navigation,  step: 3, nextStatus: "entregue", nextLabel: "FINALIZAR" },
  entregue:    { label: "Finalizado",   color: "text-emerald-600",bg: "bg-emerald-500/10",icon: CheckCircle, step: 4 },
  cancelada:   { label: "Cancelado",   color: "text-red-500",    bg: "bg-red-500/10",    icon: XCircle,     step: -1 },
};

const filterTabs: { key: StatusKey | "all" | "ativas"; label: string; emoji: string }[] = [
  { key: "all",      label: "Todas",       emoji: "📋" },
  { key: "pendente",  label: "Novas",       emoji: "🔔" },
  { key: "ativas",    label: "Ativas",      emoji: "🛵" },
  { key: "entregue",  label: "Concluídas",  emoji: "✅" },
];

const DeliveryDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusKey | "all" | "ativas">("all");
  const [searchParams] = useSearchParams();
  const initialEntrega = searchParams.get("entrega");
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(initialEntrega);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const processedEvents = useRef<Set<string>>(new Set());
  const [gpsLoading, setGpsLoading] = useState(false);
  
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const wakeLockRef = useRef<any>(null);
  const proximityAlertedRef = useRef<Set<string>>(new Set());
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(false);

  const requestGPS = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "GPS não disponível", description: "Seu dispositivo não suporta geolocalização.", variant: "destructive" });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        toast({ title: "GPS ativado! ✅", description: "Localização obtida com sucesso." });
        // Force re-render to update location status
        window.location.reload();
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast({
            title: "Permissão negada",
            description: "Você precisa permitir o acesso à localização nas configurações do seu navegador/celular.",
            variant: "destructive",
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast({ title: "GPS indisponível", description: "Não foi possível obter sua localização. Verifique se o GPS está ligado.", variant: "destructive" });
        } else {
          toast({ title: "Erro ao obter GPS", description: "Tempo esgotado. Tente novamente.", variant: "destructive" });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone || 
                        document.referrer.includes('android-app://');
    if (!isStandalone) setShowInstallPrompt(true);
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        (err) => console.warn("Location permission denied:", err),
        { enableHighAccuracy: true }
      );
    }

    document.body.style.overscrollBehaviorY = 'contain';
    return () => { document.body.style.overscrollBehaviorY = 'auto'; };
  }, []);

  const { data: storeInfo } = useQuery({
    queryKey: ["entregador-loja-branding", user?.id],
    queryFn: async () => {
      const { data: link } = await supabase
        .from("loja_entregadores").select("loja_id").eq("entregador_id", user!.id).limit(1).single();
      if (!link) return null;
      const { data: loja } = await supabase
        .from("lojas").select("nome, logo_url, cor_primaria, cor_secundaria, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado").eq("id", link.loja_id).single();
      return loja;
    },
    enabled: !!user,
  });

  const [driverStoreLoc, setDriverStoreLoc] = useState<[number, number] | null>(null);
  const [driverRouteInfo, setDriverRouteInfo] = useState<{ distance: string; duration: string; steps?: Array<{ instruction: string; distance: string; modifier?: string; type?: string }> } | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [geocodedCustomerLocs, setGeocodedCustomerLocs] = useState<Record<string, [number, number]>>({});
  const geocodedAddressesRef = useRef<Record<string, string>>({});
  const [roadDistances, setRoadDistances] = useState<Record<string, string>>({});
  const roadDistFetchedRef = useRef<Record<string, string>>({});

  // TTS voice navigation - speaks instructions in fullscreen mode
  useNavigationTTS(driverRouteInfo?.steps, mapFullscreen && !ttsMuted);

  // Set PWA manifest with store logo when logged in
  useEffect(() => {
    if (!storeInfo) return;
    const si = storeInfo as any;
    const logoUrl = si.logo_url;
    const storeName = si.nome || "Entregador";
    const manifest = {
      name: "Entregador",
      short_name: "Entregador",
      description: "Painel do Entregador",
      start_url: "/entregador/login",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#000000",
      icons: [
        { src: logoUrl || "/icon-entregador-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: logoUrl || "/icon-entregador-192.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: logoUrl || "/icon-entregador-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    let link = document.getElementById("manifest-link") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.id = "manifest-link";
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = url;

    if (logoUrl) {
      let touchIcon = document.getElementById("apple-touch-icon") as HTMLLinkElement;
      if (!touchIcon) {
        touchIcon = document.createElement("link");
        touchIcon.id = "apple-touch-icon";
        touchIcon.rel = "apple-touch-icon";
        document.head.appendChild(touchIcon);
      }
      touchIcon.href = logoUrl;
    }

    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name='${name}']`);
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", name); document.head.appendChild(meta); }
      meta.setAttribute("content", content);
    };
    updateMeta("apple-mobile-web-app-title", "Entregador");
  }, [storeInfo]);

  // Geocode store address for map
  useEffect(() => {
    if (!storeInfo) return;
    const si = storeInfo as any;
    const addr = [si.endereco_rua, si.endereco_numero, si.endereco_bairro, si.endereco_cidade, si.endereco_estado].filter(Boolean).join(", ");
    if (!addr) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`)
      .then(r => r.json())
      .then(data => { if (data?.[0]) setDriverStoreLoc([Number(data[0].lat), Number(data[0].lon)]); })
      .catch(() => {});
  }, [storeInfo]);


  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('entregas-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ["entregas-entregador"] });
      
      const isNewAssignment = payload.eventType === 'UPDATE' && 
                               payload.new?.entregador_id === user.id && 
                               payload.old?.entregador_id !== user.id;
      const isNewUnassigned = payload.eventType === 'INSERT' && !payload.new?.entregador_id;
      
      if (isNewAssignment || isNewUnassigned) {
        const eventKey = `${payload.new?.id}-${isNewAssignment ? 'assigned' : 'available'}`;
        if (processedEvents.current.has(eventKey)) return;
        processedEvents.current.add(eventKey);

        if (isNewUnassigned) {
          // Play a sound if possible (optional, but requested feeling of simultaneity)
          try {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
            audio.play().catch(() => {});
          } catch (e) {}
        }
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, toast]);

  const { data: linkedStores = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["loja-entregador-links", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("loja_entregadores").select("loja_id").eq("entregador_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const todayRange = useMemo(() => {
    const now = new Date();
    return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() };
  }, []);

  // Map loja IDs to their owner user_ids for filtering entregas
  const { data: storeOwnerMap = {} } = useQuery({
    queryKey: ["store-owner-map", linkedStores.map(l => (l as any).loja_id).join(",")],
    queryFn: async () => {
      const storeIds = linkedStores.map((l: any) => l.loja_id);
      const { data: lojas } = await supabase.from("lojas").select("id, user_id, nome").in("id", storeIds);
      const map: Record<string, { user_id: string; nome: string }> = {};
      (lojas || []).forEach(l => { map[l.id] = { user_id: l.user_id, nome: l.nome }; });
      return map;
    },
    enabled: linkedStores.length > 0,
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["entregas-entregador", JSON.stringify(storeOwnerMap), todayRange.start],
    queryFn: async () => {
      const storeIds = Object.keys(storeOwnerMap);
      if (storeIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("entregas")
        .select("*, pedidos(*)")
        .or(`entregador_id.eq.${user!.id},and(entregador_id.is.null,lojista_id.in.(${storeIds.join(",")}))`)
        .gte("created_at", todayRange.start)
        .lte("created_at", todayRange.end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Build lojista_id -> nome map
      const lojaNameMap: Record<string, string> = {};
      Object.values(storeOwnerMap).forEach(v => { lojaNameMap[v.user_id] = v.nome; });
      return (data || []).map(d => {
        const rawPedido = (d as any).pedidos;
        const pedido = Array.isArray(rawPedido) ? rawPedido[0] : rawPedido;
        return { ...d, loja_nome: lojaNameMap[d.lojista_id] || "Loja", pedido: pedido || null };
      }) as Entrega[];
    },
    enabled: !!user && Object.keys(storeOwnerMap).length > 0,
  });

  // Geocode delivery addresses when pedido has no lat/lng (pre-fetch for active ones)
  useEffect(() => {
    const activeDelivs = deliveries.filter(d => ["aceita", "coletado", "em_transito"].includes(d.status));
    
    activeDelivs.forEach(async (del) => {
      const pedido = del.pedido;
      if (pedido?.latitude_entrega && pedido?.longitude_entrega) return;
      
      const addr = del.endereco_entrega || pedido?.endereco_entrega;
      if (!addr || addr === geocodedAddressesRef.current[del.id]) return;
      
      geocodedAddressesRef.current[del.id] = addr;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`);
        const data = await r.json();
        if (data?.[0]) {
          setGeocodedCustomerLocs(prev => ({ ...prev, [del.id]: [Number(data[0].lat), Number(data[0].lon)] }));
        }
      } catch (e) {
        console.error("Geocode error:", e);
      }
    });
  }, [deliveries]);

  useEffect(() => {
    setDriverRouteInfo(null);
  }, [selectedDelivery]);

  const activeDeliveryIds = deliveries.filter((d) => ["aceita", "coletado", "em_transito"].includes(d.status) && d.entregador_id === user?.id).map((d) => d.id);
  const { location: currentLocation, permissionStatus: geoPermission } = useDriverLocation(user?.id, activeDeliveryIds);

  // Fetch OSRM road distances for delivery cards
  useEffect(() => {
    if (!currentLocation) return;
    const relevantDeliveries = deliveries.filter(d => !["entregue", "cancelada"].includes(d.status));
    
    relevantDeliveries.forEach(async (del) => {
      const pedido = del.pedido;
      let destLat: number | null = null;
      let destLng: number | null = null;

      if (pedido?.latitude_entrega && pedido?.longitude_entrega) {
        destLat = Number(pedido.latitude_entrega);
        destLng = Number(pedido.longitude_entrega);
      } else if (geocodedCustomerLocs[del.id]) {
        destLat = geocodedCustomerLocs[del.id][0];
        destLng = geocodedCustomerLocs[del.id][1];
      }

      if (destLat == null || destLng == null) return;

      const key = `${currentLocation.lat.toFixed(3)},${currentLocation.lng.toFixed(3)}-${destLat.toFixed(3)},${destLng.toFixed(3)}`;
      if (roadDistFetchedRef.current[del.id] === key) return;
      roadDistFetchedRef.current[del.id] = key;

      try {
        const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${destLng},${destLat}?overview=false`);
        const data = await r.json();
        if (data.routes?.[0]) {
          const distKm = (data.routes[0].distance / 1000).toFixed(1);
          setRoadDistances(prev => ({ ...prev, [del.id]: distKm }));
        }
      } catch {}
    });
  }, [currentLocation, deliveries, geocodedCustomerLocs]);

  // Wake Lock: keep screen on while GPS is active (now also handled in useDriverLocation for PWA)
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {
        console.log('Wake Lock not supported or denied');
      }
    };
    if (currentLocation) {
      requestWakeLock();
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentLocation) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [currentLocation]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: currentDelivery, error: getError } = await supabase
        .from("entregas")
        .select("status, entregador_id, pedido_id")
        .eq("id", id)
        .maybeSingle();

      if (getError) throw getError;
      if (!currentDelivery) throw new Error("Entrega não encontrada.");

      if (status === "aceita") {
        if (currentDelivery.status !== "pendente") throw new Error("Esta entrega já foi aceita.");
        if (currentDelivery.entregador_id && currentDelivery.entregador_id !== user!.id) throw new Error("Esta entrega já foi designada.");
      }

      const updates: any = { status };
      if (status === "aceita") { updates.aceita_em = new Date().toISOString(); updates.entregador_id = user!.id; }
      if (status === "entregue") { updates.finalizada_em = new Date().toISOString(); }
      
      // Save timestamp for this status change
      const { data: currentData } = await supabase.from("entregas").select("status_timestamps").eq("id", id).maybeSingle();
      const existingTimestamps = (currentData as any)?.status_timestamps || {};
      updates.status_timestamps = { ...existingTimestamps, [status]: new Date().toISOString() };
      
      const { error: updateError } = await supabase.from("entregas").update(updates).eq("id", id);
      if (updateError) throw updateError;

      if (!currentDelivery.pedido_id) return;

      const pedidoStatusMap: Record<string, string> = { 
        aceita: "aceita",
        coletado: "aceita",
        em_transito: "saiu_entrega",
        entregue: "finalizado" 
      };
      
      const newPedidoStatus = pedidoStatusMap[status];
      if (newPedidoStatus) {
        const { data: currentPedido } = await supabase.from("pedidos").select("status, status_historico").eq("id", currentDelivery.pedido_id).maybeSingle();
        if (currentPedido) {
          const currentHistorico = Array.isArray(currentPedido.status_historico) ? currentPedido.status_historico : [];
          await supabase.from("pedidos").update({
            status: newPedidoStatus,
            status_historico: [...currentHistorico, { status: newPedidoStatus, timestamp: new Date().toISOString(), entregador_id: user!.id, entregador_nome: profile?.full_name || "Entregador" }],
          }).eq("id", currentDelivery.pedido_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-entregador"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const filtered = deliveries.filter(d => {
    if (filter === "all") return true;
    if (filter === "ativas") return ["aceita", "coletado", "em_transito"].includes(d.status);
    return d.status === filter;
  });

  const stats = {
    pending: deliveries.filter(d => d.status === "pendente").length,
    active: deliveries.filter(d => ["aceita", "coletado", "em_transito"].includes(d.status)).length,
    delivered: deliveries.filter(d => d.status === "entregue").length,
    earnings: deliveries.filter(d => d.status === "entregue").reduce((sum, d) => sum + Number(d.valor_entrega || 0), 0),
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Haversine distance in km between two lat/lng points
  const calcDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Proximity alert: notify when driver is within 200m of destination
  useEffect(() => {
    if (!currentLocation) return;
    const activeDeliveries = deliveries.filter(d => ["aceita", "coletado", "em_transito"].includes(d.status) && d.entregador_id === user?.id);
    
    for (const del of activeDeliveries) {
      const pedido = del.pedido;
      let destLat: number | null = null;
      let destLng: number | null = null;

      if (pedido?.latitude_entrega && pedido?.longitude_entrega) {
        destLat = Number(pedido.latitude_entrega);
        destLng = Number(pedido.longitude_entrega);
      } else if (geocodedCustomerLocs[del.id]) {
        destLat = geocodedCustomerLocs[del.id][0];
        destLng = geocodedCustomerLocs[del.id][1];
      }

      if (destLat == null || destLng == null) continue;

      const distKm = calcDistance(currentLocation.lat, currentLocation.lng, destLat, destLng);
      const distMeters = distKm * 1000;

      if (distMeters <= 200 && !proximityAlertedRef.current.has(del.id)) {
        proximityAlertedRef.current.add(del.id);
        
        // Vibration
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200, 100, 300]);
        }
        

        // Proximity notification removed
      }
    }
  }, [currentLocation, deliveries, user?.id, calcDistance, geocodedCustomerLocs, selectedDelivery, toast]);

  const handleLogout = async () => { await signOut(); navigate("/entregador/login"); };

  const selectedDel = deliveries.find(d => d.id === selectedDelivery);

  if (loadingLinks) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  // Full-page delivery detail view
  if (selectedDel) {
    const config = statusConfig[selectedDel.status] || statusConfig.pendente;
    const StatusIcon = config.icon;
    const pedido = selectedDel.pedido;
    const items = pedido?.items ? (Array.isArray(pedido.items) ? pedido.items : []) : [];
    const detailSteps = [
      { key: "aceita", label: "Aceita", icon: Bike },
      { key: "coletado", label: "Coleta", icon: Package },
      { key: "em_transito", label: "Em Rota", icon: Navigation },
      { key: "entregue", label: "Concluída", icon: CheckCircle }
    ];
    const currentStepIdx = detailSteps.findIndex(s => s.key === selectedDel.status);

    const openWaze = () => {
      const address = selectedDel.endereco_entrega || pedido?.endereco_entrega;
      let lat: number | null = null;
      let lng: number | null = null;
      if (pedido?.latitude_entrega && pedido?.longitude_entrega) {
        lat = Number(pedido.latitude_entrega);
        lng = Number(pedido.longitude_entrega);
      } else if (geocodedCustomerLocs[selectedDel.id]) {
        lat = geocodedCustomerLocs[selectedDel.id][0];
        lng = geocodedCustomerLocs[selectedDel.id][1];
      }
      
      if (lat && lng) {
        window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, "_blank");
      } else if (address) {
        window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, "_blank");
      } else {
        toast({ title: "Endereço não disponível", variant: "destructive" });
      }
    };

    const openWhatsApp = () => {
      const phone = pedido?.cliente_telefone?.replace(/\D/g, "");
      if (phone) {
        const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent("Olá! Sou o entregador do seu pedido. 🛵")}`, "_blank");
      } else {
        toast({ title: "Telefone não disponível", variant: "destructive" });
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] flex flex-col select-none">
        {/* Clean Header */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedDelivery(null)} 
                className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center active:scale-95 transition-all"
              >
                <ChevronDown className="w-6 h-6 text-foreground rotate-90" />
              </button>
              <div>
                <p className="text-sm font-bold">Nº {pedido?.numero_diario ? String(pedido.numero_diario).padStart(3, "0") : selectedDel.id.slice(0, 4)}</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className={`${config.color} font-black text-[10px] uppercase tracking-widest`}>
                {config.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-56">
          {/* Progress Steps - More visual */}
          <div className="px-8 py-4">
            <div className="relative">
              <div className="flex items-center justify-between relative">
                <div className="absolute top-[22px] left-[22px] right-[22px] h-[3px] bg-muted/30 rounded-full">
                  <div 
                    className="h-full bg-primary transition-all duration-700 ease-out rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                    style={{ width: currentStepIdx >= 0 ? `${(currentStepIdx / (detailSteps.length - 1)) * 100}%` : '0%' }} 
                  />
                </div>
                
                {detailSteps.map((step, i) => {
                  const StepIcon = step.icon;
                  const isActive = i <= currentStepIdx;
                  const isCurrent = i === currentStepIdx;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-2.5 relative z-10">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                        isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-muted/80 text-muted-foreground"
                      } ${isCurrent ? "scale-110 ring-4 ring-primary/20" : ""}`}>
                        <StepIcon className={`${isCurrent ? "w-6 h-6" : "w-5 h-5"} transition-all`} />
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-tighter ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-4 space-y-4">
            {/* Address Card - Enhanced */}
            <div className="bg-card rounded-[2rem] border border-border/10 shadow-sm overflow-hidden group">
              <div className="p-6 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-[1.25rem] bg-destructive/10 flex items-center justify-center shrink-0 shadow-inner">
                    <MapPin className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Local de Entrega</h4>
                    <p className="text-base font-bold text-foreground leading-tight tracking-tight">
                      {selectedDel.endereco_entrega || pedido?.endereco_entrega || "Endereço não informado"}
                    </p>
                    {roadDistances[selectedDel.id] && (
                      <div className="flex items-center gap-1.5 mt-2 text-primary font-bold text-[10px] bg-primary/5 w-fit px-2.5 py-1 rounded-full border border-primary/10">
                        <Navigation className="w-3 h-3 fill-primary" />
                        {roadDistances[selectedDel.id]} KM DE VOCÊ
                      </div>
                    )}
                  </div>
                </div>

                {["aceita", "coletado", "em_transito"].includes(selectedDel.status) && (
                  <Button 
                    onClick={openWaze}
                    className="w-full bg-[#33ccff] hover:bg-[#33ccff]/90 text-white font-bold rounded-[1.25rem] h-14 flex items-center justify-center gap-3 shadow-lg shadow-[#33ccff]/25 active:scale-[0.98] transition-all text-sm"
                  >
                    <Navigation className="w-6 h-6" />
                    INICIAR NAVEGAÇÃO
                  </Button>
                )}
              </div>
            </div>

            {/* Customer & Payment Info */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-card rounded-[2rem] border border-border/10 shadow-sm p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border-4 border-background shadow-sm">
                  <User className="w-7 h-7 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold tracking-tight truncate">{pedido?.cliente_nome || "Cliente"}</p>
                  <p className="text-xs font-bold text-muted-foreground">{pedido?.cliente_telefone || "Sem telefone"}</p>
                </div>
                {pedido?.cliente_telefone && (
                  <div className="flex items-center gap-2">
                    <a 
                      href={`tel:${pedido.cliente_telefone}`} 
                      className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center active:scale-90 transition-all border border-primary/5 hover:bg-primary/20"
                    >
                      <Phone className="w-5 h-5 fill-primary/10" />
                    </a>
                    <button 
                      onClick={openWhatsApp} 
                      className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center active:scale-90 transition-all border border-emerald-500/5 hover:bg-emerald-500/20"
                    >
                      <MessageCircle className="w-5 h-5 fill-emerald-500/10" />
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Section - New! */}
              <div className="bg-white dark:bg-slate-900/50 rounded-[2rem] border border-border/10 shadow-sm p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Pagamento</p>
                    <p className="text-xs font-bold text-emerald-600 uppercase">
                      {(() => {
                        const obs = pedido?.observacoes || "";
                        const paymentMatch = obs.match(/Pagamento: ([^|]+)/);
                        return paymentMatch ? paymentMatch[1].trim() : "A combinar";
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {(() => {
                    const subtotal = (items || []).reduce((acc: number, item: any) => 
                      acc + (item.preco_total || (item.preco || 0) * (item.quantidade || 1)), 0);
                    const deliveryFee = Number(pedido?.taxa_entrega ?? selectedDel.valor_entrega ?? 0);
                    const total = subtotal + deliveryFee;
                    return (
                      <>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Subtotal</p>
                          <p className="text-[11px] font-bold text-foreground">{formatCurrency(subtotal)}</p>
                        </div>
                        {deliveryFee > 0 && (
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Entrega</p>
                            <p className="text-[11px] font-bold text-primary">{formatCurrency(deliveryFee)}</p>
                          </div>
                        )}
                        <div className="text-right border-t border-border/10 pt-1">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total</p>
                          <p className="text-base font-bold text-foreground">{formatCurrency(total)}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Observations if any */}
            {selectedDel.observacoes && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-[1.5rem] p-5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-lg">⚠️</span>
                </div>
                <div>
                  <h4 className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Instruções Importantes</h4>
                  <p className="text-[11px] font-bold text-amber-900/80 dark:text-amber-200/80 leading-relaxed italic">
                    "{selectedDel.observacoes}"
                  </p>
                </div>
              </div>
            )}

            {/* Items List - Redesigned */}
            <div className="bg-card rounded-[2rem] border border-border/10 shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-5 flex items-center justify-between border-b border-border/5">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Conteúdo</h4>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-9 px-4 text-[9px] font-bold rounded-xl gap-2 text-primary hover:bg-primary/5 border border-primary/10" 
                  onClick={() => setReceiptOrder({ ...pedido, entrega: selectedDel })}
                >
                  <FileText className="w-3.5 h-3.5" /> VER
                </Button>
              </div>
              <div className="divide-y divide-border/5 px-2">
                {items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 px-4 py-2 hover:bg-muted/30 transition-colors rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-[11px] font-bold text-foreground shrink-0 border border-border/5 shadow-inner">
                      {item.quantidade || item.qtd || 1}x
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold tracking-tight text-foreground/90">{item.nome || item.name}</p>
                      {(item.sabores?.length > 0 || item.adicionais?.length > 0 || item.observacao) && (
                        <div className="mt-1.5 space-y-1">
                          {item.sabores?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.sabores.map((s: string, i: number) => (
                                <span key={i} className="text-[8px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-muted-foreground uppercase">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.adicionais?.map((a: any, i: number) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="w-1 h-1 bg-muted-foreground/30 rounded-full shrink-0" />
                              <span className="text-[10px] font-bold text-muted-foreground/80">
                                {typeof a === "string" ? a : a.nome}
                              </span>
                            </div>
                          ))}
                          {item.unidade_medida === "kg" && (item.peso || item.weight) && (
                            <div className="flex items-center gap-1">
                              <span className="w-1 h-1 bg-primary/30 rounded-full shrink-0" />
                              <span className="text-[10px] font-bold text-primary">
                                Peso: {item.peso || item.weight}kg
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {item.observacao && (
                        <p className="text-[9px] text-muted-foreground italic mt-1.5 flex items-center gap-1">
                          <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                          {item.observacao}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer with Stats and Action */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-2xl border-t border-border/10 z-[2000] px-4 pt-4 pb-6 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {/* Stats row - Maintained but improved */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl px-4 py-3 border border-border/5 flex flex-col items-center">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Ganhos</p>
              <p className="text-sm font-black text-emerald-600">{formatCurrency(Number(selectedDel.valor_entrega))}</p>
            </div>
            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl px-4 py-3 border border-border/5 flex flex-col items-center">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Horário</p>
              <p className="text-sm font-black text-foreground">{formatTime(selectedDel.created_at)}</p>
            </div>
            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl px-4 py-3 border border-border/5 flex flex-col items-center">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Itens</p>
              <p className="text-sm font-black text-foreground">{items.length}</p>
            </div>
          </div>

          {config.nextStatus && (
            <Button 
              className={`w-full h-16 text-base font-black rounded-[1.5rem] ${config.nextStatus === "entregue" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"} text-white shadow-2xl active:scale-[0.97] transition-all uppercase tracking-widest`}
              disabled={updateStatus.isPending} 
              onClick={() => config.nextStatus === "entregue" ? setShowFinishConfirm(true) : updateStatus.mutate({ id: selectedDel.id, status: config.nextStatus! })}
            >
              {updateStatus.isPending ? <Loader2 className="animate-spin mr-3 w-5 h-5" /> : null}
              {config.nextLabel}
            </Button>
          )}

          {selectedDel.status === "entregue" && (
            <div className="w-full h-16 bg-emerald-500/10 rounded-[1.5rem] border border-emerald-500/20 text-emerald-600 font-black text-sm flex items-center justify-center gap-3 uppercase tracking-widest shadow-inner">
              <CircleCheck className="w-6 h-6" /> ENTREGA CONCLUÍDA
            </div>
          )}
        </div>

        {/* Finish confirmation dialog */}
        <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
          <DialogContent className="max-w-xs p-6 rounded-[32px]">
            <DialogHeader>
              <DialogTitle className="text-center font-display font-black">Finalizar Entrega?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground text-center">Tem certeza que deseja marcar esta entrega como concluída?</p>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setShowFinishConfirm(false)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1 h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={updateStatus.isPending}
                onClick={() => {
                  setShowFinishConfirm(false);
                  setMapFullscreen(false);
                  updateStatus.mutate({ id: selectedDel.id, status: "entregue" });
                }}
              >
                {updateStatus.isPending ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <CircleCheck className="w-4 h-4 mr-2" />}
                Sim, finalizar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog open={!!receiptOrder} onOpenChange={(o) => !o && setReceiptOrder(null)}>
          <DialogContent className="max-w-xs p-6 rounded-[32px]">
            <DialogHeader>
              <DialogTitle className="text-center font-display font-black"></DialogTitle>
            </DialogHeader>
            {receiptOrder && (
              <div className="space-y-4 font-mono text-[10px]">
                <div className="border-b border-dashed pb-2 text-center flex flex-col items-center gap-2">
                  <div>
                    <p className="font-bold uppercase text-[11px] mb-0.5 tracking-tight">{receiptOrder.entrega?.loja_nome || storeInfo?.nome || "Loja"}</p>
                    <p className="font-bold uppercase mb-1 text-[10px]">Nº {String(receiptOrder.numero_diario || "").padStart(3, "0")}</p>
                    <p className="text-[9px] text-muted-foreground">{new Date(receiptOrder.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <div className="space-y-1 border-b border-dashed pb-2">
                  <p><span className="font-bold">CLIENTE:</span> {receiptOrder.cliente_nome || "Não informado"}</p>
                  {receiptOrder.cliente_telefone && <p><span className="font-bold">TEL:</span> {receiptOrder.cliente_telefone}</p>}
                  <p><span className="font-bold">TIPO:</span> {receiptOrder.tipo === "delivery" ? "ENTREGA" : receiptOrder.tipo?.toUpperCase() || "ENTREGA"}</p>
                  {receiptOrder.endereco_entrega && <p><span className="font-bold">ENDEREÇO:</span> {receiptOrder.endereco_entrega}</p>}
                </div>
                <div className="space-y-1">
                  <p className="font-bold border-b border-dashed pb-1 mb-1">ITENS:</p>
                  {Array.isArray(receiptOrder.items) && receiptOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex flex-col mb-1">
                      <div className="flex justify-between">
                        <span>{item.quantidade}x {item.nome}</span>
                        <span>{formatCurrency(item.preco_total || (item.preco || 0) * (item.quantidade || 1))}</span>
                      </div>
                      {item.sabores?.length > 0 && <p className="text-[8px] ml-2">• Sabores: {item.sabores.join(", ")}</p>}
                      {item.unidade_medida === "kg" && (item.weight || item.peso) && (
                        <p className="text-[8px] ml-2 font-bold text-primary">
                          • Peso: {item.weight || item.peso}kg
                        </p>
                      )}
                      {item.bordas?.length > 0 && <p className="text-[8px] ml-2">• Bordas: {item.bordas.join(", ")}</p>}
                      {item.adicionais?.length > 0 && (
                        <div className="ml-2">
                          <p className="text-[8px] font-bold">• Adicionais:</p>
                          {item.adicionais.map((a: any, idx: number) => (
                            <p key={idx} className="text-[8px] ml-1">
                              - {typeof a === "string" ? a : a.nome}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.observacao && <p className="text-[8px] ml-2 italic">• Obs: {item.observacao}</p>}
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed pt-2 space-y-1">
                  {(() => {
                    const subtotal = (receiptOrder.items || []).reduce((acc: number, item: any) => 
                      acc + (item.preco_total || (item.preco || 0) * (item.quantidade || 1)), 0);
                    const deliveryFee = Number(receiptOrder.taxa_entrega ?? receiptOrder.entrega?.valor_entrega ?? 0);
                    const total = subtotal + deliveryFee;
                    return (
                      <>
                        <div className="flex justify-between"><span>SUBTOTAL</span><span>{formatCurrency(subtotal)}</span></div>
                        {deliveryFee > 0 && (
                          <div className="flex justify-between"><span>TAXA DE ENTREGA</span><span>{formatCurrency(deliveryFee)}</span></div>
                        )}
                        <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
                      </>
                    );
                  })()}
                </div>
                {(receiptOrder.observacoes || receiptOrder.forma_pagamento) && (
                  <div className="border-t border-dashed pt-2 space-y-1">
                    {(() => {
                      const subtotal = (receiptOrder.items || []).reduce((acc: number, item: any) => 
                        acc + (item.preco_total || (item.preco || 0) * (item.quantidade || 1)), 0);
                      const deliveryFee = Number(receiptOrder.taxa_entrega ?? receiptOrder.entrega?.valor_entrega ?? 0);
                      const total = subtotal + deliveryFee;
                      const obs = receiptOrder.observacoes || "";
                      const paymentMatch = obs.match(/Pagamento: ([^|]+)/);
                      const changeMatch = obs.match(/Troco para: R\$ ([^|]+)/);
                      const payment = receiptOrder.forma_pagamento || (paymentMatch ? paymentMatch[1].trim() : null);
                      const changeVal = changeMatch ? changeMatch[1].trim().replace(",", ".") : null;
                      const changeAmount = changeVal ? Number(changeVal) - total : null;
                      return (
                        <>
                          {payment && <p><span className="font-bold">PAGAMENTO:</span> {payment}</p>}
                          {changeAmount !== null && changeAmount > 0 && <p><span className="font-bold">TROCO PARA O CLIENTE:</span> {formatCurrency(changeAmount)}</p>}
                          {receiptOrder.observacoes && <p><span className="font-bold">OBS:</span> {receiptOrder.observacoes}</p>}
                        </>
                      );
                    })()}
                  </div>
                )}
                <div className="pt-2 text-center text-[8px] text-muted-foreground uppercase">Obrigado pela preferência!</div>
              </div>
            )}
            <Button className="w-full mt-4 font-black rounded-xl" onClick={() => setReceiptOrder(null)}>FECHAR</Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] flex flex-col select-none">
      {/* Top bar — like reference: hamburger + centered status badge */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center">
            {storeInfo?.logo_url ? (
              <img src={storeInfo.logo_url} className="h-8 w-8 rounded-xl object-cover" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">N</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentLocation ? (
              <Badge className="bg-emerald-500 text-white border-0 font-bold text-xs px-4 py-1.5 rounded-full shadow-md">
                <div className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse" />
                Disponível
              </Badge>
            ) : (
              <Badge 
                className="bg-amber-500 text-white border-0 font-bold text-xs px-4 py-1.5 rounded-full shadow-md cursor-pointer"
                onClick={() => navigator.geolocation.getCurrentPosition(() => window.location.reload(), () => { alert("Permita o acesso à localização nas configurações do navegador."); })}
              >
                <MapPin className="w-3 h-3 mr-1.5" />
                Ativar GPS
              </Badge>
            )}
          </div>
          <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full">

          {/* Earnings banner */}
          <div className="mx-4 mt-6 p-4 bg-white dark:bg-slate-900 border border-border/10 rounded-[2rem] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ganhos do dia</span>
            </div>
            <span className="text-base font-bold text-emerald-600">{formatCurrency(stats.earnings)}</span>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto px-4 pt-6 pb-2 scrollbar-none">
            {filterTabs.map((tab) => {
              const count = tab.key === "all" ? deliveries.length : tab.key === "ativas" ? stats.active : tab.key === "pendente" ? stats.pending : stats.delivered;
              const isActive = filter === tab.key;
              return (
                <button key={tab.key} onClick={() => setFilter(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-bold transition-all border whitespace-nowrap shadow-sm ${isActive ? "bg-foreground text-background border-foreground" : "bg-white dark:bg-slate-900 text-muted-foreground border-border/10"}`}>
                  <span>{tab.emoji}</span> {tab.label}
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] ${isActive ? "bg-background/20 text-background" : "bg-muted"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Delivery list */}
          <div className="px-4 pb-20 space-y-2.5 mt-1">
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground/30" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 space-y-3 opacity-50">
                <Package className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Nada por aqui no momento</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((delivery, i) => {
                  const config = statusConfig[delivery.status] || statusConfig.pendente;
                  const StatusIcon = config.icon;
                  return (
                    <motion.div key={delivery.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}>
                      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-border/10 p-5 hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98] shadow-sm" onClick={() => setSelectedDelivery(delivery.id)}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${config.bg}`}>
                            <StatusIcon className={`w-6 h-6 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">Nº {delivery.pedido?.numero_diario ? String(delivery.pedido.numero_diario).padStart(3, "0") : delivery.id.slice(0, 4)}</span>
                            </div>
                            <p className="text-[11px] font-bold text-muted-foreground truncate mt-1">
                              {delivery.pedido?.cliente_nome || "Cliente"}
                              {" • "}{formatTime(delivery.created_at)}
                              {roadDistances[delivery.id] ? ` • ${roadDistances[delivery.id]} km` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={`text-[8px] px-2 py-0.5 h-auto border-0 rounded-full font-bold uppercase tracking-wider ${config.bg} ${config.color} whitespace-nowrap`}>
                                {config.label}
                              </Badge>
                              <span className="text-sm font-bold text-emerald-600">{formatCurrency(Number(delivery.valor_entrega))}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </main>

      <Dialog open={showInstallPrompt} onOpenChange={setShowInstallPrompt}>
        <DialogContent className="max-w-[320px] rounded-[32px] p-5">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-[24px] flex items-center justify-center mx-auto"><Bike className="w-8 h-8 text-primary" /></div>
            <h3 className="text-xl font-black font-display">Instale o App</h3>
            <p className="text-sm text-muted-foreground">Adicione à tela de início para uma experiência melhor e notificações em tempo real.</p>
            <div className="bg-muted/50 p-4 rounded-3xl text-left space-y-3">
              <p className="text-xs font-bold flex gap-3"><span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px]">1</span> Toque em compartilhar ou no menu do navegador</p>
              <p className="text-xs font-bold flex gap-3"><span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px]">2</span> Selecione "Adicionar à Tela de Início"</p>
            </div>
            <Button className="w-full h-12 font-black rounded-2xl" onClick={() => setShowInstallPrompt(false)}>ENTENDI</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-30 bg-background/80 backdrop-blur-xl border-t border-border/10">
        <div className="flex max-w-lg mx-auto">
          <button className="flex-1 flex flex-col items-center gap-1.5 py-4 text-primary">
            <Package className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Pedidos</span>
          </button>
          <button className="flex-1 flex flex-col items-center gap-1.5 py-4 text-muted-foreground hover:text-foreground transition-colors" onClick={() => navigate("/entregador/historico")}>
            <History className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Histórico</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

function Header({ profile, currentLocation, onLogout, storeInfo }: any) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 h-16 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {storeInfo?.logo_url ? <img src={storeInfo.logo_url} className="h-8 w-8 rounded-xl object-cover" alt="" /> : <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xs">N</div>}
        <div><p className="text-xs font-black font-display tracking-tight leading-none">PAINEL</p><p className="text-[10px] font-bold text-muted-foreground leading-none mt-1 uppercase">Entregador</p></div>
      </div>
      <div className="flex items-center gap-2">
        {currentLocation ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Online</span>
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 text-[10px] font-black border-amber-500 text-amber-600 hover:bg-amber-50 rounded-xl gap-1.5 animate-bounce shadow-lg shadow-amber-500/10"
            onClick={() => navigator.geolocation.getCurrentPosition(() => window.location.reload(), () => { alert("Permita o acesso à localização nas configurações do navegador."); })}
          >
            <MapPin className="w-3.5 h-3.5" />
            ATIVAR GPS
          </Button>
        )}
        <div className="text-right hidden sm:block"><p className="text-xs font-bold leading-none">{profile?.full_name}</p></div>
        <Button variant="ghost" size="icon" onClick={onLogout} className="rounded-xl hover:bg-destructive/5 hover:text-destructive"><LogOut className="w-5 h-5" /></Button>
      </div>
    </header>
  );
}

function AddressCard({ icon, title, address }: { icon: React.ReactNode; title: string; address: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 border border-border/50 shadow-sm space-y-2.5">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <h5 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider leading-none">{title}</h5>
          <p className="text-xs font-bold text-foreground mt-1 leading-tight">{address}</p>
        </div>
      </div>
    </div>
  );
}

export default DeliveryDashboard;
