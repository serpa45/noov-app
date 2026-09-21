import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Ticket, 
  Plus, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Trash2,
  Edit2,
  UserPlus,
  UserMinus,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface CouponForm {
  id?: string;
  codigo: string;
  tipo: 'fixo' | 'percentual' | 'frete_gratis' | 'cliente_novo' | '';
  valor: number;
  valor_minimo: number;
  validade_inicio: string;
  validade_fim: string;
  limite_total: number | "";
  limite_por_cliente: number;
  uso_unico: boolean;
  tipo_publico: boolean;
  ativo: boolean;
  clientes_vinculados: { id: string; nome: string; telefone: string }[];
}

const initialForm: CouponForm = {
  codigo: "",
  tipo: "",
  valor: 0,
  valor_minimo: 0,
  validade_inicio: "",
  validade_fim: "",
  limite_total: "",
  limite_por_cliente: 1,
  uso_unico: false,
  tipo_publico: false,
  ativo: true,
  clientes_vinculados: []
};

const PerformanceChart = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-[40px] w-full mt-2">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default function Coupons() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(initialForm);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSelector, setShowClientSelector] = useState(true);

  const { data: loja } = useQuery({
    queryKey: ["loja-coupon-config", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("lojas") as any).select("id, cupons_ativos, cupom_popup_ativo, cupom_lembrete_ativo, cupom_popup_titulo, cupom_popup_subtitulo, cupom_popup_cta, cupom_popup_cor_fundo, cupom_popup_cor_texto, cupom_popup_imagem_url").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: cupons = [], isLoading } = useQuery({
    queryKey: ["loja-cupons", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cupons").select("*").eq("loja_id", loja!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!loja?.id,
  });

  const { data: usageStats } = useQuery({
    queryKey: ["loja-cupons-stats-summary", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uso_cupons")
        .select("created_at, valor_desconto, cupom_id")
        .in("cupom_id", cupons.map(c => c.id));
      
      if (error || !data) return { totalDesconto: 0, totalUsos: 0, chartData: [] };
      
      const totalDesconto = data.reduce((acc, curr) => acc + Number(curr.valor_desconto), 0);
      const totalUsos = data.length;
      
      const grouped = data.reduce((acc: any, curr) => {
        const day = format(new Date(curr.created_at), "dd/MM");
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      const chartData = Object.keys(grouped).map(day => ({
        name: day,
        value: grouped[day]
      })).slice(-7);

      return { totalDesconto, totalUsos, chartData };
    },
    enabled: !!loja?.id && cupons.length > 0,
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ["loja-clients-selection", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome_completo, telefone, foto_url").eq("loja_id", loja!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!loja?.id && !form.tipo_publico && showClientSelector,
  });

  const toggleSystemMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase.from("lojas").update({ cupons_ativos: active }).eq("id", loja!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-coupon-config"] });
      toast.success("Sistema atualizado");
    }
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ field, value }: { field: "cupom_popup_ativo" | "cupom_lembrete_ativo"; value: boolean }) => {
      const { error } = await (supabase.from("lojas") as any).update({ [field]: value }).eq("id", loja!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-coupon-config"] });
      toast.success("Configuração atualizada");
    }
  });

  const updatePopupFieldMutation = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await (supabase.from("lojas") as any).update(patch).eq("id", loja!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-coupon-config"] });
      toast.success("Popup atualizado");
    }
  });

  const handleUploadPopupImage = async (file: File) => {
    if (!loja?.id) return;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${loja.id}/cupom-popup-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Erro ao enviar imagem"); return; }
    const { data: urlData } = supabase.storage.from("banners").getPublicUrl(path);
    updatePopupFieldMutation.mutate({ cupom_popup_imagem_url: urlData.publicUrl });
  };

  const saveCouponMutation = useMutation({
    mutationFn: async (data: CouponForm) => {
      const { data: cupom, error: cupomError } = await supabase.from("cupons").upsert({
        id: data.id || undefined,
        loja_id: loja!.id,
        codigo: data.codigo.toUpperCase(),
        tipo: data.tipo as any,
        valor: data.valor,
        valor_minimo: data.valor_minimo,
        validade_inicio: data.validade_inicio || null,
        validade_fim: data.validade_fim || null,
        limite_total: data.limite_total === "" ? null : data.limite_total,
        limite_por_cliente: data.limite_por_cliente,
        uso_unico: data.uso_unico,
        tipo_publico: data.tipo_publico,
        ativo: data.ativo
      }).select().single();
      
      if (cupomError) throw cupomError;

      if (!data.tipo_publico) {
        await supabase.from("cupom_clientes").delete().eq("cupom_id", cupom.id);
        if (data.clientes_vinculados.length > 0) {
          await supabase.from("cupom_clientes").insert(
            data.clientes_vinculados.map(c => ({
              cupom_id: cupom.id,
              cliente_identificador: c.telefone,
              cliente_nome: c.nome
            }))
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-cupons"] });
      setIsModalOpen(false);
      toast.success("Cupom salvo!");
      setForm(initialForm);
      setShowClientSelector(true);
    }
  });

  const getStatusBadge = (cupom: any) => {
    if (!cupom.ativo) return <Badge variant="secondary" className="bg-muted text-muted-foreground border-none">Desativado</Badge>;
    const now = new Date();
    if (cupom.validade_fim && new Date(cupom.validade_fim) < now) return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none">Expirado</Badge>;
    if (cupom.limite_total && cupom.usos_count >= cupom.limite_total) return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Esgotado</Badge>;
    return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-none">Ativo</Badge>;
  };

  const filteredClients = allClients.filter(c => 
    c.nome_completo?.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.telefone?.includes(clientSearch)
  );

  const emptyChartData = Array.from({ length: 10 }).map((_, i) => ({ value: Math.random() * 10 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground tracking-tight">Gerenciamento de Cupons</h3>
          <p className="text-sm text-muted-foreground font-medium">Crie e gerencie campanhas de desconto para seus clientes.</p>
        </div>
        <Button onClick={() => { setForm(initialForm); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
          <Plus className="w-4 h-4 mr-2" /> Novo Cupom
        </Button>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Status do Sistema</h3>
              <p className="text-sm text-muted-foreground">Habilite ou desabilite a aceitação de cupons no checkout.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${loja?.cupons_ativos ? "text-emerald-600" : "text-muted-foreground"}`}>
                {loja?.cupons_ativos ? "ATIVADO" : "DESATIVADO"}
              </span>
              <Switch checked={loja?.cupons_ativos || false} onCheckedChange={(checked) => toggleSystemMutation.mutate(checked)} className="data-[state=checked]:bg-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Divulgação do Cupom Público</h3>
            <p className="text-sm text-muted-foreground">Controle como o cupom público é exibido para os clientes no cardápio.</p>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Popup ao abrir o cardápio</p>
              <p className="text-xs text-muted-foreground">Mostra um popup com o cupom assim que o cliente abre o cardápio.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${(loja as any)?.cupom_popup_ativo ? "text-emerald-600" : "text-muted-foreground"}`}>
                {(loja as any)?.cupom_popup_ativo ? "ATIVADO" : "DESATIVADO"}
              </span>
              <Switch
                checked={(loja as any)?.cupom_popup_ativo || false}
                onCheckedChange={(checked) => toggleFlagMutation.mutate({ field: "cupom_popup_ativo", value: checked })}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Lembrete acima de "Principais Escolhas"</p>
              <p className="text-xs text-muted-foreground">Exibe um lembrete fixo no cardápio com o código e as condições do cupom.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${(loja as any)?.cupom_lembrete_ativo ? "text-emerald-600" : "text-muted-foreground"}`}>
                {(loja as any)?.cupom_lembrete_ativo ? "ATIVADO" : "DESATIVADO"}
              </span>
              <Switch
                checked={(loja as any)?.cupom_lembrete_ativo || false}
                onCheckedChange={(checked) => toggleFlagMutation.mutate({ field: "cupom_lembrete_ativo", value: checked })}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          {(loja as any)?.cupom_popup_ativo && (
            <div className="border-t border-border pt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Personalização do Popup</p>
                <p className="text-xs text-muted-foreground">Edite textos, cores e imagem do popup do cupom.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título</Label>
                  <Input
                    defaultValue={(loja as any)?.cupom_popup_titulo ?? "Cupom de Desconto"}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== (loja as any)?.cupom_popup_titulo) updatePopupFieldMutation.mutate({ cupom_popup_titulo: v });
                    }}
                    placeholder="Cupom de Desconto"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto do botão</Label>
                  <Input
                    defaultValue={(loja as any)?.cupom_popup_cta ?? "COMEÇAR A PEDIR"}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== (loja as any)?.cupom_popup_cta) updatePopupFieldMutation.mutate({ cupom_popup_cta: v });
                    }}
                    placeholder="COMEÇAR A PEDIR"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Subtítulo / Mensagem</Label>
                <Input
                  defaultValue={(loja as any)?.cupom_popup_subtitulo ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (loja as any)?.cupom_popup_subtitulo) updatePopupFieldMutation.mutate({ cupom_popup_subtitulo: v });
                  }}
                  placeholder="Aproveite uma oferta especial no seu pedido!"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor de fundo</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={(loja as any)?.cupom_popup_cor_fundo || "#10b981"}
                      onChange={(e) => updatePopupFieldMutation.mutate({ cupom_popup_cor_fundo: e.target.value })}
                      className="h-10 w-12 rounded border border-input cursor-pointer bg-transparent"
                    />
                    <Input
                      defaultValue={(loja as any)?.cupom_popup_cor_fundo || "#10b981"}
                      onBlur={(e) => updatePopupFieldMutation.mutate({ cupom_popup_cor_fundo: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor do texto</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={(loja as any)?.cupom_popup_cor_texto || "#ffffff"}
                      onChange={(e) => updatePopupFieldMutation.mutate({ cupom_popup_cor_texto: e.target.value })}
                      className="h-10 w-12 rounded border border-input cursor-pointer bg-transparent"
                    />
                    <Input
                      defaultValue={(loja as any)?.cupom_popup_cor_texto || "#ffffff"}
                      onBlur={(e) => updatePopupFieldMutation.mutate({ cupom_popup_cor_texto: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Imagem (opcional)</Label>
                <div className="flex items-center gap-3">
                  {(loja as any)?.cupom_popup_imagem_url && (
                    <img src={(loja as any).cupom_popup_imagem_url} alt="Popup" className="w-16 h-16 rounded-lg object-cover border border-border" />
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadPopupImage(f); }}
                    className="flex-1"
                  />
                  {(loja as any)?.cupom_popup_imagem_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updatePopupFieldMutation.mutate({ cupom_popup_imagem_url: null })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Substitui o ícone padrão. Recomendado: 400×400px.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-sans">Desempenho</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-bold text-foreground font-sans">{usageStats?.totalUsos || 0}</h4>
              <p className="text-[10px] text-muted-foreground uppercase font-sans">Total de Usos</p>
            </div>
            <PerformanceChart data={usageStats?.chartData.length ? usageStats.chartData : emptyChartData} color="hsl(var(--primary))" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-sans">Economia</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-bold text-foreground font-sans">R$ {usageStats?.totalDesconto?.toFixed(2) || "0,00"}</h4>
              <p className="text-[10px] text-muted-foreground uppercase font-sans">Total de Desconto</p>
            </div>
            <PerformanceChart data={emptyChartData} color="hsl(var(--success))" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Users className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-sans">Engajamento</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-bold text-foreground font-sans">{cupons.filter(c => c.ativo).length}</h4>
              <p className="text-[10px] text-muted-foreground uppercase font-sans">Cupons Ativos</p>
            </div>
            <PerformanceChart data={emptyChartData} color="#f59e0b" />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-bold text-foreground">Seus Cupons</CardTitle>
          <CardDescription className="text-muted-foreground">Lista de todos os cupons cadastrados nesta loja.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-bold uppercase text-[10px]">Código</TableHead>
                  <TableHead className="text-foreground font-bold uppercase text-[10px]">Tipo</TableHead>
                  <TableHead className="text-foreground font-bold uppercase text-[10px]">Valor</TableHead>
                  <TableHead className="text-foreground font-bold uppercase text-[10px]">Min. Pedido</TableHead>
                  <TableHead className="text-foreground font-bold uppercase text-[10px]">Uso</TableHead>
                  <TableHead className="text-foreground font-bold uppercase text-[10px]">Status</TableHead>
                  <TableHead className="text-foreground font-bold uppercase text-[10px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Carregando cupons...</TableCell></TableRow>
                ) : cupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Ticket className="w-8 h-8 opacity-20" />
                        <span>Nenhum cupom cadastrado ainda.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  cupons.map((cupom) => (
                    <TableRow key={cupom.id} className="border-border hover:bg-muted/50 transition-colors">
                      <TableCell><span className="font-mono font-bold text-primary">{cupom.codigo}</span></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{cupom.tipo === 'fixo' ? 'Valor Fixo' : cupom.tipo === 'percentual' ? 'Percentual' : cupom.tipo === 'cliente_novo' ? 'Cliente Novo' : 'Frete Grátis'}</TableCell>
                      <TableCell className="font-semibold text-foreground">{(cupom.tipo === 'fixo' || cupom.tipo === 'cliente_novo') ? `R$ ${Number(cupom.valor).toFixed(2).replace('.', ',')}` : cupom.tipo === 'percentual' ? `${cupom.valor}%` : '---'}</TableCell>
                      <TableCell className="font-medium text-foreground text-xs">{cupom.valor_minimo > 0 ? `R$ ${Number(cupom.valor_minimo).toFixed(2).replace('.', ',')}` : '---'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex flex-col">
                          <span>{cupom.usos_count} / {cupom.limite_total || '∞'}</span>
                          <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${cupom.limite_total ? (cupom.usos_count / cupom.limite_total) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(cupom)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={async () => {
                            let vinculados: any[] = [];
                            if (!cupom.tipo_publico) {
                              const { data } = await supabase
                                .from("cupom_clientes")
                                .select("cliente_identificador, cliente_nome")
                                .eq("cupom_id", cupom.id);
                              
                              if (data) {
                                vinculados = data.map(v => ({
                                  id: v.cliente_identificador, // Usando o telefone como ID para manter compatibilidade
                                  nome: v.cliente_nome,
                                  telefone: v.cliente_identificador
                                }));
                              }
                            }

                            setForm({
                              ...cupom,
                              validade_inicio: cupom.validade_inicio ? cupom.validade_inicio.slice(0, 16) : "",
                              validade_fim: cupom.validade_fim ? cupom.validade_fim.slice(0, 16) : "",
                              limite_total: cupom.limite_total === null ? "" : cupom.limite_total,
                              uso_unico: cupom.uso_unico !== undefined ? cupom.uso_unico : false,
                              clientes_vinculados: vinculados
                            });
                            setIsModalOpen(true);
                          }}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={async () => {
                            if (confirm("Tem certeza que deseja excluir este cupom?")) {
                              const { error } = await supabase.from("cupons").delete().eq("id", cupom.id);
                              if (!error) { toast.success("Cupom removido"); queryClient.invalidateQueries({ queryKey: ["loja-cupons"] }); }
                            }
                          }}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto shadow-elevated focus-visible:outline-none">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">Preencha as informações do cupom.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">Código do Cupom</Label>
              <Input 
                placeholder="Ex: PROMO10" 
                value={form.codigo} 
                onChange={e => setForm({...form, codigo: e.target.value.replace(/\s/g, "").toUpperCase()})} 
                className="bg-background border-border text-foreground uppercase font-bold" 
              />
              <p className="text-[10px] text-muted-foreground italic">* Não utilize espaços no código</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">Tipo de Desconto</Label>
                <Select 
                  value={form.tipo} 
                  onValueChange={(v: any) => setForm({...form, tipo: v})}
                >
                  <SelectTrigger className="bg-background border-border text-foreground w-full">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border text-foreground z-[100001] shadow-2xl pointer-events-auto overflow-visible">
                    <SelectItem value="percentual" className="cursor-pointer hover:bg-muted font-medium">Percentual %</SelectItem>
                    <SelectItem value="fixo" className="cursor-pointer hover:bg-muted font-medium">Valor R$</SelectItem>
                    <SelectItem value="frete_gratis" className="cursor-pointer hover:bg-muted font-medium">Frete Grátis</SelectItem>
                    <SelectItem value="cliente_novo" className="cursor-pointer hover:bg-muted font-medium">Cliente Novo</SelectItem>
                  </SelectContent>
                </Select>
                {form.tipo === 'frete_gratis' && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                    * O valor do desconto será descontado no valor do frete
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">
                  {form.tipo === 'fixo' || form.tipo === 'cliente_novo' ? 'Valor do Desconto (R$)' : form.tipo === 'percentual' ? 'Porcentagem (%)' : 'Desconto'}
                </Label>
                {(form.tipo === 'fixo' || form.tipo === 'cliente_novo') ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={form.valor ? Number(form.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const num = digits ? Number(digits) / 100 : 0;
                      setForm({ ...form, valor: num });
                    }}
                    className="bg-background border-border text-foreground"
                  />
                ) : (
                  <Input
                    type="number"
                    placeholder={form.tipo === 'percentual' ? "Ex: 10" : "0"}
                    value={form.valor}
                    onChange={e => setForm({ ...form, valor: Number(e.target.value) })}
                    disabled={form.tipo === 'frete_gratis'}
                    className="bg-background border-border text-foreground"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">Valor Mínimo Pedido</Label>
                <Input type="number" placeholder="0.00" value={form.valor_minimo} onChange={e => setForm({...form, valor_minimo: Number(e.target.value)})} className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">Limite Total Usos</Label>
                <Input type="number" placeholder="Vazio = ilimitado" value={form.limite_total} onChange={e => setForm({...form, limite_total: e.target.value === "" ? "" : Number(e.target.value)})} className="bg-background border-border text-foreground" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground font-semibold text-xs">Válido De</Label>
                <Input type="datetime-local" value={form.validade_inicio} onChange={e => setForm({...form, validade_inicio: e.target.value})} className="bg-background border-border text-foreground text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-semibold text-xs">Válido Até</Label>
                <Input type="datetime-local" value={form.validade_fim} onChange={e => setForm({...form, validade_fim: e.target.value})} className="bg-background border-border text-foreground text-xs" />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <div className="space-y-0.5">
                <Label className="text-foreground text-sm font-semibold">Uso Único por Cliente</Label>
                <p className="text-[10px] text-muted-foreground font-medium">Cada cliente pode usar o cupom apenas uma vez</p>
              </div>
              <Switch checked={form.uso_unico} onCheckedChange={(checked) => setForm({...form, uso_unico: checked})} className="data-[state=checked]:bg-primary" />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <div className="space-y-0.5">
                <Label className="text-foreground text-sm font-semibold">Cupom Público</Label>
                <p className="text-[10px] text-muted-foreground font-medium">Disponível para todos os clientes</p>
              </div>
              <Switch checked={form.tipo_publico} onCheckedChange={(v) => { setForm({...form, tipo_publico: v}); if(!v) setShowClientSelector(true); }} className="data-[state=checked]:bg-primary" />
            </div>

            {!form.tipo_publico && (
              <div className="space-y-2 border border-border rounded-lg p-3 bg-muted">
                <Label className="text-foreground text-sm flex items-center gap-2 font-semibold"><Users className="w-4 h-4" /> Selecionar Clientes</Label>
                <div className="flex gap-2">
                  <Input placeholder="Buscar por nome ou telefone..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="bg-background border-border h-8 text-xs text-foreground" />
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {filteredClients.length > 0 ? filteredClients.map(c => {
                    const isLinked = form.clientes_vinculados.some(v => v.id === c.id);
                    return (
                      <div key={c.id} className="flex justify-between items-center p-2 rounded bg-background border border-border text-[11px]">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-border">
                            <AvatarImage src={c.foto_url} />
                            <AvatarFallback className="bg-muted text-[10px]">
                              <User className="w-3 h-3 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-foreground font-medium">{c.nome_completo} <span className="text-muted-foreground text-[10px] ml-1">{c.telefone}</span></span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`h-6 px-2 ${isLinked ? 'text-red-500 hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'}`} 
                          onClick={() => {
                            if(isLinked) setForm({...form, clientes_vinculados: form.clientes_vinculados.filter(v => v.id !== c.id)});
                            else setForm({...form, clientes_vinculados: [...form.clientes_vinculados, {id: c.id, nome: c.nome_completo, telefone: c.telefone}]});
                          }}
                        >
                          {isLinked ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    );
                  }) : <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum cliente encontrado.</p>}
                </div>
                <div className="pt-1 flex justify-between items-center border-t border-border">
                   <span className="text-[10px] text-muted-foreground font-bold">{form.clientes_vinculados.length} selecionado(s)</span>
                   {form.clientes_vinculados.length > 0 && (
                     <button className="text-[10px] text-red-500 hover:underline font-semibold" onClick={() => setForm({...form, clientes_vinculados: []})}>Limpar</button>
                   )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="bg-transparent border-border text-foreground hover:bg-muted">Cancelar</Button>
            <Button onClick={() => saveCouponMutation.mutate(form)} disabled={saveCouponMutation.isPending || !form.codigo} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
              {saveCouponMutation.isPending ? "Salvando..." : "Salvar Cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}