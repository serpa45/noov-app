import { useState, useRef } from "react";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvUser } from "@/contexts/PdvUserContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableQrModal } from "@/components/pdv/TableQrModal";
import { AllTablesQrModal } from "@/components/pdv/AllTablesQrModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Users,
  Clock,
  Trash2,
  Loader2,
  ChefHat,
  UtensilsCrossed,
  CheckCircle2,
  QrCode,
  Download,
  Printer,
  ChevronLeft,
  ArrowLeft,
  Banknote,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type MesaStatus = "livre" | "ocupada" | "reservada";

export default function PdvMesas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useKeepScreenOn();
  const { pdvUser } = usePdvUser();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [qrTarget, setQrTarget] = useState<any>(null);
  const [showAllQr, setShowAllQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [newMesaNome, setNewMesaNome] = useState("");
  const [newMesaLugares, setNewMesaLugares] = useState(4);

  // Get loja
  const { data: loja } = useQuery({
    queryKey: ["loja-pdv", user?.id, pdvUser?.loja_id],
    queryFn: async () => {
      // If we have a pdvUser, we use their loja_id directly
      if (pdvUser?.loja_id) {
        const { data } = await supabase
          .from("lojas")
          .select("id, slug, nome, logo_url, cor_primaria")
          .eq("id", pdvUser.loja_id)
          .maybeSingle();
        return data;
      }

      // Fallback for store owner
      const { data } = await supabase
        .from("lojas")
        .select("id, slug, nome, logo_url, cor_primaria")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user || !!pdvUser,
  });

  // Get mesas and today's summary
  const { data: mesasData, isLoading } = useQuery({
    queryKey: ["pdv-mesas", loja?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const { data: mesasRaw } = await supabase
        .from("pdv_mesas")
        .select("*")
        .eq("loja_id", loja!.id)
        .order("nome");
      
      if (!mesasRaw) return { mesas: [], summary: { totalPaid: 0, pendingTotal: 0, paidTablesCount: 0 } };

      const occupiedIds = mesasRaw.filter(m => m.pedido_atual_id).map(m => m.pedido_atual_id!);
      let ordersMap: Record<string, any> = {};
      let pendingTotal = 0;

      if (occupiedIds.length > 0) {
        const { data: orders } = await supabase
          .from("pdv_pedidos")
          .select("id, items, total, created_at, updated_at, status_cozinha, numero_diario, pagamento_status, valor_pago, garcom_nome")
          .in("id", occupiedIds);
        
        if (orders) {
          orders.forEach(o => { 
            ordersMap[o.id] = o;
            // Se o pedido não estiver totalmente pago, adicionamos o que falta ao pendente
            const total = Number(o.total) || 0;
            const pago = Number(o.valor_pago) || 0;
            if (o.pagamento_status !== 'pago') {
              pendingTotal += (total - pago);
            }
          });
        }
      }

      // Buscar pedidos pagos hoje
      const { data: todayPaidOrders } = await supabase
        .from("pdv_pedidos")
        .select("total, valor_pago")
        .eq("loja_id", loja!.id)
        .eq("pagamento_status", "pago")
        .gte("updated_at", todayStr);

      const totalPaid = todayPaidOrders?.reduce((acc, o) => acc + (Number(o.valor_pago) || 0), 0) || 0;
      const paidTablesCount = todayPaidOrders?.length || 0;

      const mesasWithOrders = mesasRaw.map(m => ({ 
        ...m, 
        pedido: m.pedido_atual_id ? ordersMap[m.pedido_atual_id] : null 
      }));

      return { 
        mesas: mesasWithOrders, 
        summary: { totalPaid, pendingTotal, paidTablesCount } 
      };
    },
    enabled: !!loja,
  });

  const mesas = mesasData?.mesas || [];
  const summary = mesasData?.summary || { totalPaid: 0, pendingTotal: 0, paidTablesCount: 0 };

  useRealtimeSubscription("pdv_mesas", [["pdv-mesas"]], loja ? `loja_id=eq.${loja.id}` : undefined);
  useRealtimeSubscription("pdv_pedidos", [["pdv-mesas"]], loja ? `loja_id=eq.${loja.id}` : undefined);

  // Create mesa
  const createMesa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pdv_mesas").insert({
        loja_id: loja!.id,
        nome: newMesaNome,
        lugares: newMesaLugares,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-mesas"] });
      setShowAddModal(false);
      setNewMesaNome("");
      setNewMesaLugares(4);
      toast({ title: "Mesa criada com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao criar mesa", variant: "destructive" }),
  });

  // Delete mesa
  const deleteMesa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pdv_mesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-mesas"] });
      setDeleteTarget(null);
      toast({ title: "Mesa removida" });
    },
  });

  // Click mesa
  const handleMesaClick = async (mesa: any) => {
    if (mesa.status === "livre") {
      const { data: pedido, error } = await supabase
        .from("pdv_pedidos")
        .insert({ loja_id: loja!.id, mesa_id: mesa.id })
        .select()
        .single();
      if (error || !pedido) {
        toast({ title: "Erro ao criar pedido", variant: "destructive" });
        return;
      }
      await supabase
        .from("pdv_mesas")
        .update({ status: "ocupada", pedido_atual_id: pedido.id })
        .eq("id", mesa.id);
      navigate(`/lojista/pdv-mesas/${mesa.id}`);
    } else if (mesa.status === "ocupada") {
      navigate(`/lojista/pdv-mesas/${mesa.id}`);
    }
  };

  const sortedMesas = [...mesas].sort((a: any, b: any) => {
    const aHasNew = Array.isArray(a.pedido?.items) && a.pedido.items.some((i: any) => i.is_new);
    const bHasNew = Array.isArray(b.pedido?.items) && b.pedido.items.some((i: any) => i.is_new);
    
    // Mesas com novos itens vêm primeiro (topo da lista)
    if (aHasNew && !bHasNew) return -1;
    if (!aHasNew && bHasNew) return 1;

    // Depois mesas ocupadas
    if (a.status === "ocupada" && b.status !== "ocupada") return -1;
    if (a.status !== "ocupada" && b.status === "ocupada") return 1;

    // Por fim, ordem alfabética numérica
    return a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' });
  });

  const mesasLivres = sortedMesas.filter((m: any) => m.status === "livre");
  const mesasOcupadas = sortedMesas.filter((m: any) => m.status === "ocupada");

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${mins % 60}m`;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      {/* Today's Summary Cards */}
      {!isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20">
              <CardContent className="p-5 flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Total pagos</p>
                  <p className="text-2xl font-bold font-display">{formatCurrency(summary.totalPaid)}</p>
                  <p className="text-[11px] text-white/70">{summary.paidTablesCount} {summary.paidTablesCount === 1 ? "mesa" : "mesas"} hoje</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 md:hidden lg:flex">
                  <Banknote className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20">
              <CardContent className="p-5 flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Mesas em aberto</p>
                  <p className="text-2xl font-bold font-display">{formatCurrency(summary.pendingTotal)}</p>
                  <p className="text-[11px] text-white/70">{mesasOcupadas.length} {mesasOcupadas.length === 1 ? "ocupada" : "ocupadas"}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 md:hidden lg:flex">
                  <Clock className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <CardContent className="p-5 flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Mesas pagas</p>
                  <p className="text-2xl font-bold font-display">{summary.paidTablesCount}</p>
                  <p className="text-[11px] text-white/70">finalizadas hoje</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 md:hidden lg:flex">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="border-t border-border" />
        </>
      )}



      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/lojista")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">{mesas?.length || 0} · Mesas</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Livres ({mesasLivres.length})
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "linear-gradient(90deg, #ef4444 50%, #f97316 50%)" }} /> Ocupadas ({mesasOcupadas.length})
              </span>
            </p>

          </div>
        </div>
        <div className="flex items-center gap-4">

          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Mesa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAllQr(true)} disabled={!mesas || mesas.length === 0}>
            <QrCode className="w-4 h-4 mr-1" /> QR Code Mesas
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : mesas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">Nenhuma mesa cadastrada</p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Criar primeira mesa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnimatePresence>
            {sortedMesas.map((mesa: any, i: number) => {
              const pedido = mesa.pedido;
              const isOccupied = mesa.status === "ocupada";
              const isFree = mesa.status === "livre";
              const isOld = pedido?.created_at && (Date.now() - new Date(pedido.created_at).getTime()) > 600000;
               const kitchenStatus = pedido?.status_cozinha;
               const hasNewItems = Array.isArray(pedido?.items) && pedido.items.some((i: any) => i.is_new);

              return (
                <motion.div
                  key={mesa.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    onClick={() => handleMesaClick(mesa)}
                    className={`cursor-pointer relative overflow-hidden rounded-2xl border transition-all select-none group
                      ${isFree
                        ? "border-border hover:border-primary/40 hover:shadow-card bg-card"
                        : isOld
                          ? "border-destructive/40 bg-destructive/5 ring-1 ring-destructive/30"
                          : "border-primary/30 bg-primary/5 hover:shadow-elevated"
                      }`}
                  >
                    {/* Top status bar with label */}
                    <div className={`relative w-full px-3 py-1.5 flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-white ${
                       isFree ? "bg-emerald-500" :
                       hasNewItems ? "bg-red-600 animate-pulse ring-2 ring-red-600 ring-offset-2" :
                       kitchenStatus === "pronto" ? "bg-green-600" :
                       kitchenStatus === "em_preparo" ? "bg-orange-500" :
                       "bg-red-600"
                     }`}>
                       {isFree ? (
                         <><CheckCircle2 className="w-3 h-3" /> Livre</>
                      ) : hasNewItems ? (
                        <><Plus className="w-3 h-3" /> Novo Pedido</>
                       ) : kitchenStatus === "em_preparo" ? (
                        <><ChefHat className="w-3 h-3" /> Preparando</>
                      ) : kitchenStatus === "pronto" ? (
                        <><UtensilsCrossed className="w-3 h-3" /> Pronto</>
                      ) : (
                        <><Clock className="w-3 h-3" /> Novo Pedido</>
                      )}

                      {/* Delete button integrated in the bar */}
                      {isFree && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(mesa);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white/90 hover:text-white" />
                        </button>
                      )}
                    </div>

                    <CardContent className="p-4 space-y-2.5">
                      {/* Name */}
                      <div className="text-center">
                        <p className="text-base font-bold font-display text-foreground leading-tight">{mesa.nome}</p>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <Users className="w-3 h-3" /> {mesa.lugares} lugares
                        </div>
                      </div>

                      {/* Occupied info */}
                      {isOccupied && (
                        <>
                          <div className="border-t border-border" />
                          <div className="space-y-2">
                            {/* Waiter Name */}
                            {pedido?.garcom_nome && (
                              <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
                                <ChefHat className="w-3 h-3" /> Garçom: {pedido.garcom_nome}
                              </div>
                            )}

                            {/* Order number + time on same row */}
                            <div className="flex items-center justify-between">
                              {pedido?.numero_diario && (
                                <p className="text-base font-bold text-black">
                                  Nº {String(pedido.numero_diario).padStart(3, "0")}
                                </p>
                              )}
                              {pedido?.status_cozinha !== "pendente" && pedido?.pagamento_status !== "pago" && pedido?.updated_at && (
                                <div className={`flex items-center gap-1 text-[11px] ${isOld ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                                  <Clock className="w-3 h-3" /> {getTimeSince(pedido.updated_at)}
                                  {isOld && <span className="ml-0.5">⚠️</span>}
                                </div>
                              )}
                            </div>

                            {/* Total - centered and larger */}
                            {pedido?.total > 0 && (
                              <p className="text-2xl font-bold font-display text-foreground text-center">
                                {formatCurrency(Number(pedido.total))}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir mesa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMesa.mutate(deleteTarget.id)}
              disabled={deleteMesa.isPending}
            >
              {deleteMesa.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add mesa modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nome</label>
              <Input
                placeholder="Ex: Mesa 01"
                value={newMesaNome}
                onChange={(e) => setNewMesaNome(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Lugares</label>
              <Input
                type="number"
                min={1}
                value={newMesaLugares}
                onChange={(e) => setNewMesaLugares(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button
              onClick={() => createMesa.mutate()}
              disabled={!newMesaNome.trim() || createMesa.isPending}
            >
              {createMesa.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Banner Modal */}
      <TableQrModal 
        open={!!qrTarget} 
        onOpenChange={(open) => !open && setQrTarget(null)} 
        mesa={qrTarget} 
        loja={loja} 
      />

      <AllTablesQrModal
        open={showAllQr}
        onOpenChange={setShowAllQr}
        mesas={mesas || []}
        loja={loja}
      />
    </div>

  );
}