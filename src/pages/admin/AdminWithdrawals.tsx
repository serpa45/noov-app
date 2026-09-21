import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, Loader2, CheckCircle2, XCircle, Clock, DollarSign, Users, Wallet, Copy, Check, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const AdminWithdrawals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pixProfile, setPixProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: saques = [], isLoading } = useQuery({
    queryKey: ["admin-saques"],
    queryFn: async () => {
      const { data } = await supabase
        .from("saques")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-saques-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, pix_tipo, pix_chave, pix_nome_favorecido, avatar_url")
        .not("codigo_afiliado", "is", null);
      return data ?? [];
    },
  });

  const { data: comissoesPendentes = [] } = useQuery({
    queryKey: ["admin-comissoes-pendentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("valor_comissao")
        .eq("status", "pendente");
      return data ?? [];
    },
  });

  const updateSaque = useMutation({
    mutationFn: async ({ id, status, motivo_rejeicao }: { id: string; status: string; motivo_rejeicao?: string }) => {
      const updateData: any = { status };
      if (status === "pago") updateData.pago_em = new Date().toISOString();
      if (status === "rejeitado" && motivo_rejeicao) updateData.motivo_rejeicao = motivo_rejeicao;
      const { error } = await supabase.from("saques").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-saques"] });
      toast({ title: status === "pago" ? "Saque pago ✅" : "Saque rejeitado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar saque", variant: "destructive" });
    },
  });

  const deleteSaque = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saques").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-saques"] });
      toast({ title: "Saque excluído com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir saque", variant: "destructive" });
    },
  });

  const getProfile = (userId: string) => profiles.find((p: any) => p.user_id === userId);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const pendentes = saques.filter((s: any) => s.status === "pendente");
  const processados = saques.filter((s: any) => s.status !== "pendente");
  const totalPendente = pendentes.reduce((sum: number, s: any) => sum + Number(s.valor), 0);
  const totalPago = saques.filter((s: any) => s.status === "pago").reduce((sum: number, s: any) => sum + Number(s.valor), 0);

  const totalComissoesPendentes = comissoesPendentes.reduce((sum: number, c: any) => sum + Number(c.valor_comissao), 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Comissão Pendente", value: formatCurrency(totalComissoesPendentes), icon: Wallet, accent: "bg-orange-100 text-orange-600", sub: `${comissoesPendentes.length} comissão(ões)` },
          { label: "Saques Pendentes", value: String(pendentes.length), icon: Clock, accent: "bg-yellow-100 text-yellow-600" },
          { label: "Total Pendente", value: formatCurrency(totalPendente), icon: DollarSign, accent: "bg-primary/10 text-primary" },
          { label: "Total Processados", value: String(processados.length), icon: CheckCircle2, accent: "bg-green-100 text-green-600" },
          { label: "Total Pago", value: formatCurrency(totalPago), icon: DollarSign, accent: "bg-emerald-100 text-emerald-600" },
        ].map((stat: any, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.accent.split(" ")[0]}`}>
                    <stat.icon className={`w-4.5 h-4.5 ${stat.accent.split(" ")[1]}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold font-display text-foreground">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    {stat.sub && <p className="text-[9px] text-muted-foreground/70">{stat.sub}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pending Withdrawals */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-yellow-500" /> Saques Pendentes ({pendentes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum saque pendente.</p>
          ) : (
            <div className="space-y-3">
              {pendentes.map((s: any) => {
                const profile = getProfile(s.afiliado_id);
                return (
                  <div key={s.id} className="p-4 rounded-xl border border-yellow-200 bg-yellow-50/50">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{profile?.full_name || "Afiliado"}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                           {profile?.pix_chave && (
                            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                              {(profile as any)?.pix_nome_favorecido && (
                                <p>Favorecido: <span className="font-medium">{(profile as any).pix_nome_favorecido}</span></p>
                              )}
                              <p>
                                PIX {profile.pix_tipo}: <span className="font-medium">{profile.pix_chave}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold font-display text-foreground">{formatCurrency(Number(s.valor))}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(s.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {profile?.pix_chave && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => { setPixProfile(profile); setCopied(false); }}
                        >
                          <Wallet className="w-3.5 h-3.5 mr-1" /> Dados do PIX
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => { setRejectId(s.id); setRejectReason(""); }}
                        disabled={updateSaque.isPending}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => updateSaque.mutate({ id: s.id, status: "pago" })}
                        disabled={updateSaque.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar Pagamento
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Withdrawals */}
      {processados.length > 0 && (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Histórico de Saques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {processados.map((s: any) => {
                const profile = getProfile(s.afiliado_id);
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Users className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{profile?.full_name || "Afiliado"}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(s.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold">{formatCurrency(Number(s.valor))}</p>
                      <Badge variant="outline" className={`text-[10px] ${
                        s.status === "pago" ? "text-green-700 border-green-200" : "text-red-600 border-red-200"
                      }`}>
                        {s.status === "pago" ? "Pago" : "Rejeitado"}
                      </Badge>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Saque?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O registro deste saque será removido permanentemente do histórico.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => deleteSaque.mutate(s.id)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIX Details Dialog */}
      <Dialog open={!!pixProfile} onOpenChange={(open) => !open && setPixProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> Dados do PIX
            </DialogTitle>
          </DialogHeader>
          {pixProfile && (
            <div className="space-y-4 mt-2">
              <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Favorecido</p>
                  <p className="text-sm font-semibold text-foreground">{pixProfile.pix_nome_favorecido || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Chave</p>
                  <p className="text-sm font-semibold text-foreground capitalize">{pixProfile.pix_tipo}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Chave PIX</p>
                  <p className="text-sm font-semibold text-foreground">{pixProfile.pix_chave}</p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(pixProfile.pix_chave);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <><Check className="w-4 h-4 mr-2" /> Copiado!</> : <><Copy className="w-4 h-4 mr-2" /> Copiar Chave PIX</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) setRejectId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" /> Rejeitar Saque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Informe o motivo da rejeição:</p>
              <Textarea
                placeholder="Ex: Dados do PIX incorretos, saldo insuficiente..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setRejectId(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!rejectReason.trim() || updateSaque.isPending}
                onClick={() => {
                  if (rejectId) {
                    updateSaque.mutate(
                      { id: rejectId, status: "rejeitado", motivo_rejeicao: rejectReason.trim() },
                      { onSuccess: () => setRejectId(null) }
                    );
                  }
                }}
              >
                {updateSaque.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                Confirmar Rejeição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWithdrawals;
