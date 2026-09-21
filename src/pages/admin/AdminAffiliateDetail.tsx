import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import {
  Users, Loader2, Copy, Link2, Store, DollarSign, Hash, Mail, Phone,
  CheckCircle2, ArrowLeft, Percent, TrendingUp, KeyRound, Pencil, Trash2, Wallet, Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminAffiliateDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: afiliado, isLoading: loadingProfile } = useQuery({
    queryKey: ["admin-afiliado-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", id)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: lojas = [], isLoading: loadingLojas } = useQuery({
    queryKey: ["admin-afiliado-lojas", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, slug, segmento, created_at, ativo")
        .eq("afiliado_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: lojasPlanos = [] } = useQuery({
    queryKey: ["admin-afiliado-lojas-planos", id, lojas],
    queryFn: async () => {
      const lojaIds = lojas.map((l: any) => l.id);
      if (lojaIds.length === 0) return [];
      const { data } = await supabase
        .from("loja_planos")
        .select("loja_id, preco_assinado, ativo, planos(nome)")
        .in("loja_id", lojaIds)
        .eq("ativo", true);
      return data ?? [];
    },
    enabled: lojas.length > 0,
  });

  const { data: comissoes = [], isLoading: loadingComissoes } = useQuery({
    queryKey: ["admin-afiliado-comissoes", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("*")
        .eq("afiliado_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: globalComissaoConfig } = useQuery({
    queryKey: ["config-global", "comissao_afiliado_percent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "comissao_afiliado_percent")
        .maybeSingle();
      return data;
    },
  });

  const { data: saques = [], isLoading: loadingSaques } = useQuery({
    queryKey: ["admin-afiliado-saques", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("saques")
        .select("*")
        .eq("afiliado_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const markAsPaid = useMutation({
    mutationFn: async (comissaoId: string) => {
      const { error } = await supabase
        .from("comissoes")
        .update({ status: "pago", pago_em: new Date().toISOString() })
        .eq("id", comissaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-afiliado-comissoes", id] });
      toast({ title: "Comissão marcada como paga ✅" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar comissão", variant: "destructive" });
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", pix_tipo: "", pix_chave: "", pix_nome_favorecido: "", percentual: "10" });

  const isLoading = loadingProfile || loadingLojas || loadingComissoes || loadingSaques;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const globalComissaoPercent = globalComissaoConfig?.valor ? Number(globalComissaoConfig.valor) : 10;
  const effectiveComissaoPercent = (afiliado as any)?.comissao_percent != null ? Number((afiliado as any).comissao_percent) : globalComissaoPercent;

  const stats = useMemo(() => {
    const total = comissoes.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
    const percentual = effectiveComissaoPercent;
    const totalSaquesAprovados = saques.filter((s: any) => s.status === "pago").reduce((sum: number, s: any) => sum + Number(s.valor), 0);
    const saldoDisponivel = total - totalSaquesAprovados;
    const pago = totalSaquesAprovados;
    const pendente = total - pago;
    return { total, pago, pendente, percentual, saldoDisponivel, totalSaquesAprovados };
  }, [comissoes, saques, effectiveComissaoPercent]);

  const shareLink = afiliado?.codigo_afiliado
    ? `https://noov.app.br/cadastro?ref=${afiliado.codigo_afiliado}`
    : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Link copiado!" });
  };

  const openEdit = () => {
    if (!afiliado) return;
    setEditForm({
      full_name: afiliado.full_name || "",
      email: afiliado.email || "",
      phone: afiliado.phone || "",
      pix_tipo: afiliado.pix_tipo || "",
      pix_chave: afiliado.pix_chave || "",
      pix_nome_favorecido: afiliado.pix_nome_favorecido || "",
      percentual: (afiliado as any).comissao_percent != null ? String((afiliado as any).comissao_percent) : "",
    });
    setEditOpen(true);
  };

  const updateAffiliate = useMutation({
    mutationFn: async () => {
      const parsed = editForm.percentual === "" ? null : Number(editForm.percentual);
      const comissao_percent = parsed != null && !Number.isNaN(parsed) ? parsed : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone,
          pix_tipo: editForm.pix_tipo,
          pix_chave: editForm.pix_chave,
          pix_nome_favorecido: editForm.pix_nome_favorecido,
          comissao_percent,
        } as any)
        .eq("user_id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-afiliado-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-afiliado-comissoes", id] });
      setEditOpen(false);
      toast({ title: "Afiliado atualizado ✅" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteAffiliate = useMutation({
    mutationFn: async () => {
      // Delete commissions, then profile, then role
      await supabase.from("comissoes").delete().eq("afiliado_id", id!);
      await supabase.from("saques").delete().eq("afiliado_id", id!);
      // Unlink stores
      await supabase.from("lojas").update({ afiliado_id: null } as any).eq("afiliado_id", id!);
      await supabase.from("user_roles").delete().eq("user_id", id!).eq("role", "afiliado" as any);
      await supabase.from("profiles").delete().eq("user_id", id!);
    },
    onSuccess: () => {
      toast({ title: "Afiliado excluído" });
      navigate("/admin/afiliados");
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!afiliado) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Afiliado não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/afiliados")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/afiliados")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold font-display">Detalhes do Afiliado</h1>
      </div>

      {/* Affiliate Info Card */}
      <Card className="border-border/50 shadow-card">
        <CardContent className="p-5 space-y-4">
          {/* Avatar + Name + Actions */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {afiliado.avatar_url ? (
                <img src={afiliado.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-primary" />
                </div>
              )}
              <div>
                <p className="text-lg font-bold font-display text-foreground">{afiliado.full_name || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground">{afiliado.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={openEdit} title="Editar">
                <Pencil className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Excluir" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir afiliado?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá o afiliado, suas comissões e saques. As lojas vinculadas serão desvinculadas. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteAffiliate.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 pt-2 border-t border-border/50">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Código Link</p>
              <p className="text-sm font-mono font-bold text-foreground">{afiliado.codigo_afiliado || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> Código Acesso</p>
              <p className="text-sm font-mono font-bold text-foreground">{(afiliado as any).codigo_acesso || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Desde</p>
              <p className="text-sm text-foreground">{(afiliado as any).created_at ? formatDate((afiliado as any).created_at) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Telefone</p>
              <p className="text-sm text-foreground">{afiliado.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</p>
              <p className="text-sm text-foreground">{afiliado.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> Comissão Efetiva</p>
              <p className="text-sm font-bold text-primary">{effectiveComissaoPercent}% {(afiliado as any).comissao_percent != null ? "(Customizada)" : "(Padrão)"}</p>
            </div>
          </div>

          {/* Share Link */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">{shareLink}</span>
            <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => copyToClipboard(shareLink)}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Clientes Indicados", value: String(lojas.length), icon: Store, accent: "bg-primary/10 text-primary" },
          { label: "Saldo Disponível", value: formatCurrency(stats.saldoDisponivel), icon: Wallet, accent: "bg-green-100 text-green-600" },
          { label: "Saques Realizados", value: formatCurrency(stats.totalSaquesAprovados), icon: TrendingUp, accent: "bg-yellow-100 text-yellow-600" },
          { label: "Total Comissões", value: formatCurrency(stats.total), icon: DollarSign, accent: "bg-primary/10 text-primary" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 shadow-card overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-full h-1 ${i % 2 === 0 ? "bg-primary" : "bg-secondary"}`} />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.accent.split(" ")[0]}`}>
                    <stat.icon className={`w-4.5 h-4.5 ${stat.accent.split(" ")[1]}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold font-display text-foreground">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Clients List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Clientes Cadastrados pelo Link ({lojas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {lojas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente cadastrado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase">#</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase">Loja</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase">Segmento</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase">Plano</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase">Valor</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase">Cadastro</th>
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lojas.map((loja: any, idx: number) => (
                      <tr key={loja.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 px-2">
                          <p className="font-medium">{loja.nome}</p>
                          <p className="text-[10px] text-muted-foreground">/{loja.slug}</p>
                        </td>
                        <td className="py-2.5 px-2 capitalize text-muted-foreground">{loja.segmento}</td>
                        <td className="py-2.5 px-2">
                          {(() => {
                            const plano = lojasPlanos.find((p: any) => p.loja_id === loja.id);
                            return plano ? (
                              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                                {(plano as any).planos?.nome || "—"}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Sem plano</span>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-2">
                          {(() => {
                            const plano = lojasPlanos.find((p: any) => p.loja_id === loja.id);
                            return plano ? (
                              <span className="text-sm font-medium">{formatCurrency(Number(plano.preco_assinado))}</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-2 text-muted-foreground">{formatDate(loja.created_at)}</td>
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${loja.ativo ? "text-green-700 border-green-200" : "text-red-600 border-red-200"}`}>
                            {loja.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Commissions List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Comissões ({comissoes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {comissoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comissão registrada.</p>
            ) : (
              <div className="space-y-2">
                {comissoes.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{formatCurrency(Number(c.valor_comissao))}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.percentual}% de {formatCurrency(Number(c.valor_pedido))} · {formatDate(c.created_at)}
                      </p>
                    </div>
                    {c.status === "pago" ? (
                      <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 shrink-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Pago
                        {c.pago_em && <span className="ml-1">· {formatDate(c.pago_em)}</span>}
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 shrink-0 text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => markAsPaid.mutate(c.id)}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar pago
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* PIX Info */}
      {afiliado.pix_chave && (
        <Card className="border-border/50 shadow-card">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Dados PIX</p>
            {(afiliado as any).pix_nome_favorecido && (
              <p className="text-sm font-medium mb-0.5">Favorecido: {(afiliado as any).pix_nome_favorecido}</p>
            )}
            <p className="text-sm font-medium">{afiliado.pix_tipo}: {afiliado.pix_chave}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">% Comissão (padrão de Ajustes: {globalComissaoPercent}%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editForm.percentual}
                onChange={(e) => setEditForm(f => ({ ...f, percentual: e.target.value }))}
                placeholder={`Padrão: ${globalComissaoPercent}%`}
              />
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                * Priorize este campo para definir uma comissão específica para este afiliado. Se preenchido, ele ignora a comissão global.
              </p>
            </div>
            <div>
              <Label className="text-xs">Saldo Disponível</Label>
              <Input value={formatCurrency(stats.saldoDisponivel)} disabled className="bg-muted/50 font-bold text-green-700" />
            </div>
            <div>
              <Label className="text-xs">Nome do Favorecido</Label>
              <Input value={editForm.pix_nome_favorecido} onChange={(e) => setEditForm(f => ({ ...f, pix_nome_favorecido: e.target.value }))} placeholder="Nome do titular" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tipo PIX</Label>
                <Input value={editForm.pix_tipo} onChange={(e) => setEditForm(f => ({ ...f, pix_tipo: e.target.value }))} placeholder="cpf, email, telefone..." />
              </div>
              <div>
                <Label className="text-xs">Chave PIX</Label>
                <Input value={editForm.pix_chave} onChange={(e) => setEditForm(f => ({ ...f, pix_chave: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateAffiliate.mutate()} disabled={updateAffiliate.isPending}>
              {updateAffiliate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="border-border/50 shadow-card">
    <CardContent className="p-3 flex items-center gap-2">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default AdminAffiliateDetail;
