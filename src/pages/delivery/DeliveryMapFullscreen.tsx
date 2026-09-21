import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import DeliveryMap from "@/components/delivery/DeliveryMap";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Navigation, MapPin, Loader2, EyeOff, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DeliveryMapFullscreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entregaId = searchParams.get("entrega");
  const { user } = useAuth();
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const { location: currentLocation, permissionStatus } = useDriverLocation(user?.id || undefined, activeIds);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string }>({ distance: "--", duration: "--" });
  const [entrega, setEntrega] = useState<any>(null);
  const [pedido, setPedido] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [infoVisible, setInfoVisible] = useState(true);

  useEffect(() => {
    if (!entregaId) { setLoading(false); return; }
    const fetch = async () => {
      const { data: e } = await supabase.from("entregas").select("*").eq("id", entregaId).maybeSingle();
      setEntrega(e);
      if (e?.pedido_id) {
        const { data: p } = await supabase.from("pedidos").select("*").eq("id", e.pedido_id).maybeSingle();
        setPedido(p);
      }
      setLoading(false);
    };
    fetch();
  }, [entregaId]);

  useEffect(() => {
    if (entrega?.id) setActiveIds([entrega.id]);
  }, [entrega?.id]);

  useEffect(() => {
    if (!entregaId) return;
    const ch = supabase
      .channel(`entrega-map-${entregaId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "entregas", filter: `id=eq.${entregaId}` }, (payload) => {
        setEntrega((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [entregaId]);

  const destLat = pedido?.latitude_entrega ? Number(pedido.latitude_entrega) : null;
  const destLng = pedido?.longitude_entrega ? Number(pedido.longitude_entrega) : null;

  const statusConfig: Record<string, { nextStatus?: string; nextLabel?: string }> = {
    aceita: { nextStatus: "coletado", nextLabel: "COLETAR" },
    coletado: { nextStatus: "em_transito", nextLabel: "SAIU PARA ENTREGA" },
    em_transito: { nextStatus: "entregue", nextLabel: "ENTREGAR" },
  };
  const config = entrega ? statusConfig[entrega.status] || {} : {};

  const handleStatusUpdate = async () => {
    if (!entrega || !config.nextStatus) return;
    await supabase.from("entregas").update({ status: config.nextStatus }).eq("id", entrega.id);
    if (config.nextStatus === "entregue") {
      navigate(`/entregador?entrega=${entrega.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const arrivalTime = routeInfo?.duration
    ? new Date(Date.now() + (parseInt(routeInfo.duration) || 0) * 60000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  return (
    <div className="fixed inset-0 z-0 bg-background">
      {/* Map takes full screen */}
      <DeliveryMap
        driverLat={currentLocation?.lat}
        driverLng={currentLocation?.lng}
        destLat={destLat}
        destLng={destLng}
        fullscreen={true}
        showBottomBar={false}
        onRouteInfo={(info) => setRouteInfo({ distance: info.distance || "--", duration: info.duration || "--" })}
      />

      {/* Top buttons overlaid */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/entregador?entrega=${entregaId}`)} className="w-10 h-10 bg-background/90 backdrop-blur-md rounded-xl border border-border/40 shadow-lg">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setInfoVisible(!infoVisible)} className="w-10 h-10 bg-background/90 backdrop-blur-md rounded-xl border border-border/40 shadow-lg">
          {infoVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </Button>
      </div>

      {/* Bottom info + action overlaid on map */}
      {infoVisible && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] px-4 pb-4 pt-2 space-y-3">
          <div className="flex items-center justify-between bg-background/90 backdrop-blur-xl rounded-2xl px-4 py-3 border border-border/40 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Tempo</p>
                <p className="text-sm font-bold text-foreground">{routeInfo.duration}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Distância</p>
                <p className="text-sm font-bold text-foreground">{routeInfo.distance}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Chegada</p>
                <p className="text-sm font-bold text-foreground">{arrivalTime}</p>
              </div>
            </div>
          </div>

          {config.nextStatus && (
            <Button
              className={`w-full h-14 text-sm font-black rounded-2xl ${config.nextStatus === "entregue" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primary/90"} text-white shadow-xl active:scale-[0.98] transition-all uppercase tracking-wider`}
              onClick={handleStatusUpdate}
            >
              {config.nextLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryMapFullscreen;
