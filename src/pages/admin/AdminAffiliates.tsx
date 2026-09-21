import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Loader2,
  Eye,
  Copy,
  Link2,
  Store,
  DollarSign,
  Hash,
  Mail,
  Phone,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminAffiliates = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAfiliado, setSelectedAfiliado] = useState<any>(null);

  // Fetch all profiles with codigo_afiliado (affiliates)
  const { data: afiliados = [], isLoading } = useQuery({
    queryKey: ["admin-all-afiliados"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .not("codigo_afiliado", "is", null)
        .order("full_name", { ascending: true });
      return data ?? [];
    },
  });

  // Fetch all stores to map afiliado_id -> stores
  const { data: lojas = [] } = useQuery({
    queryKey: ["admin-afiliado-lojas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, slug, segmento, afiliado_id, created_at")
        .not("afiliado_id", "is", null);
      return data ?? [];
    },
  });

  // Fetch all loja_planos to determine active vs trial
  const { data: lojaPlanos = [] } = useQuery({
    queryKey: ["admin-afiliado-loja-planos"],
    queryFn: async () => {
      const { data } = await supabase.from("loja_planos").select("loja_id, ativo, preco_assinado");
      return data ?? [];
    },
  });

  // Fetch all commissions
  const { data: comissoes = [] } = useQuery({
    queryKey: ["admin-afiliado-comissoes"],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes").select("*");
      return data ?? [];
    },
  });

  // Fetch all withdrawals
  const { data: saques = [] } = useQuery({
    queryKey: ["admin-afiliado-saques-all"],
    queryFn: async () => {
      const { data } = await supabase.from("saques").select("*");
      return data ?? [];
    },
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
      queryClient.invalidateQueries({ queryKey: ["admin-afiliado-comissoes"] });
      toast({ title: "Comissão marcada como paga ✅" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar comissão", variant: "destructive" });
    },
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const getAfiliadoLojas = (userId: string) =>
    lojas.filter((l: any) => l.afiliado_id === userId);

  const getAfiliadoComissoes = (userId: string) =>
    comissoes.filter((c: any) => c.afiliado_id === userId);

  const getAfiliadoSaques = (userId: string) =>
    saques.filter((s: any) => s.afiliado_id === userId);

  const getSaldoDisponivel = (userId: string) => {
    const totalComissoes = getAfiliadoComissoes(userId).reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
    const totalSaquesPagos = getAfiliadoSaques(userId).filter((s: any) => s.status === "pago").reduce((s: number, sq: any) => s + Number(sq.valor), 0);
    return totalComissoes - totalSaquesPagos;
  };

  const getShareLink = (codigo: string) =>
    `https://noov.app.br/cadastro?ref=${codigo}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Global stats
  const totalComissoes = comissoes.reduce((sum: number, c: any) => sum + Number(c.valor_comissao), 0);
  const comissoesPagas = comissoes.filter((c: any) => c.status === "pago");
  const totalPago = comissoesPagas.reduce((sum: number, c: any) => sum + Number(c.valor_comissao), 0);
  const totalPendente = totalComissoes - totalPago;
  const saquesSolicitadosList = saques.filter((s: any) => s.status === "pendente" || s.status === "solicitado");
  const totalSaquesSolicitados = saquesSolicitadosList.reduce((sum: number, s: any) => sum + Number(s.valor || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Afiliados", value: String(afiliados.length), icon: Users, color: "text-primary" },
          { label: "Lojas Indicadas", value: String(lojas.length), icon: Store, color: "text-secondary" },
          { label: "Pendente de Saque", value: formatCurrency(totalPendente), icon: DollarSign, color: "text-yellow-600" },
          { label: "Saques Solicitados", value: formatCurrency(totalSaquesSolicitados), icon: Wallet, color: "text-orange-600" },
          { label: "Comissões Pagas", value: formatCurrency(totalPago), icon: DollarSign, color: "text-green-600" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <Card className="border-border/50 shadow-card hover:shadow-elevated transition-shadow overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-full h-1 ${i % 2 === 0 ? "bg-primary" : "bg-secondary"}`} />
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`w-4 h-4 ${stat.color} shrink-0`} />
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                </div>
                <p className="text-xl font-bold font-display text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>


      {/* Affiliates List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{afiliados.length} afiliado(s)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {afiliados.map((af: any) => {
            const indicados = getAfiliadoLojas(af.user_id);
            const comissoesAf = getAfiliadoComissoes(af.user_id);
            const totalPagoAf = getAfiliadoSaques(af.user_id)
              .filter((s: any) => s.status === "pago")
              .reduce((s: number, sq: any) => s + Number(sq.valor || 0), 0);
            const indicadosAtivos = indicados.filter((l: any) => {
              const plano = lojaPlanos.find((p: any) => p.loja_id === l.id && p.ativo);
              return plano && plano.preco_assinado > 0;
            });
            const indicadosTeste = indicados.length - indicadosAtivos.length;

            return (
              <Card key={af.id} className="border-border/50 shadow-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/afiliados/${af.user_id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    {af.avatar_url ? (
                      <img src={af.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-display truncate">
                        {af.full_name || "Sem nome"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{af.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-semibold font-display text-foreground">{indicadosTeste}</p>
                      <p className="text-[10px] text-muted-foreground">Em Teste</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold font-display text-foreground">{indicadosAtivos.length}</p>
                      <p className="text-[10px] text-muted-foreground">Ativos</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold font-display text-foreground">{formatCurrency(totalPagoAf)}</p>
                      <p className="text-[10px] text-muted-foreground">Total Pago</p>
                    </div>
                  </div>
                  {(() => {
                    const totalComissao = comissoesAf.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
                    return (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1 text-[10px]">
                          
                          <span className="text-muted-foreground">À Receber:</span>
                          <span className="font-semibold text-foreground">{formatCurrency(getSaldoDisponivel(af.user_id))}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-muted-foreground">Total comissão:</span>
                          <span className="font-semibold text-foreground">{formatCurrency(totalComissao)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
          {afiliados.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">
              Nenhum afiliado cadastrado.
            </p>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAfiliado} onOpenChange={() => setSelectedAfiliado(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedAfiliado && (
            <AfiliadoDetail
              afiliado={selectedAfiliado}
              lojas={getAfiliadoLojas(selectedAfiliado.user_id)}
              comissoes={getAfiliadoComissoes(selectedAfiliado.user_id)}
              shareLink={getShareLink(selectedAfiliado.codigo_afiliado)}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onCopy={copyToClipboard}
              onMarkPaid={(id) => markAsPaid.mutate(id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AfiliadoDetail = ({
  afiliado,
  lojas,
  comissoes,
  shareLink,
  formatCurrency,
  formatDate,
  onCopy,
  onMarkPaid,
}: {
  afiliado: any;
  lojas: any[];
  comissoes: any[];
  shareLink: string;
  formatCurrency: (v: number) => string;
  formatDate: (d: string) => string;
  onCopy: (text: string) => void;
  onMarkPaid: (comissaoId: string) => void;
}) => {
  const totalGanho = comissoes.reduce((s, c) => s + Number(c.valor_comissao), 0);
  const totalPago = comissoes.filter((c) => c.status === "pago").reduce((s, c) => s + Number(c.valor_comissao), 0);
  const totalPendente = totalGanho - totalPago;

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          {afiliado.avatar_url ? (
            <img src={afiliado.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <DialogTitle className="font-display">{afiliado.full_name || "Sem nome"}</DialogTitle>
            <p className="text-xs text-muted-foreground">{afiliado.email}</p>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 mt-2">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <InfoItem icon={<Hash className="w-4 h-4" />} label="Código" value={afiliado.codigo_afiliado} />
          <InfoItem icon={<Mail className="w-4 h-4" />} label="Email" value={afiliado.email || "—"} />
          <InfoItem icon={<Phone className="w-4 h-4" />} label="Telefone" value={afiliado.phone || "—"} />
          <InfoItem icon={<Store className="w-4 h-4" />} label="Indicados" value={`${lojas.length} loja(s)`} />
        </div>

        {/* Share Link */}
        <div className="p-3 rounded-xl bg-muted/50 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">{shareLink}</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => onCopy(shareLink)}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Commissions Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-green-50 text-center border border-green-100">
            <p className="text-sm font-bold text-green-700">{formatCurrency(totalGanho)}</p>
            <p className="text-[10px] text-green-600">Total</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 text-center border border-blue-100">
            <p className="text-sm font-bold text-blue-700">{formatCurrency(totalPago)}</p>
            <p className="text-[10px] text-blue-600">Pago</p>
          </div>
          <div className="p-3 rounded-xl bg-yellow-50 text-center border border-yellow-100">
            <p className="text-sm font-bold text-yellow-700">{formatCurrency(totalPendente)}</p>
            <p className="text-[10px] text-yellow-600">Pendente</p>
          </div>
        </div>

        {/* PIX Info */}
        {afiliado.pix_chave && (
          <div className="p-3 rounded-xl bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Chave PIX</p>
            <p className="text-sm font-medium">{afiliado.pix_tipo}: {afiliado.pix_chave}</p>
          </div>
        )}

        {/* Referred Stores */}
        {lojas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Lojas indicadas</p>
            <div className="space-y-2">
              {lojas.map((loja: any) => (
                <div key={loja.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                  <Store className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{loja.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {loja.segmento} · /{loja.slug} · {formatDate(loja.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Commissions */}
        {comissoes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Últimas comissões</p>
            <div className="space-y-2">
              {comissoes.slice(0, 10).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{formatCurrency(c.valor_comissao)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.percentual}% de {formatCurrency(c.valor_pedido)} · {formatDate(c.created_at)}
                    </p>
                  </div>
                  {c.status === "pago" ? (
                    <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 shrink-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Pago
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 shrink-0 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => onMarkPaid(c.id)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar pago
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
    <div className="text-muted-foreground">{icon}</div>
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  </div>
);

export default AdminAffiliates;
