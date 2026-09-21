import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2, Loader2, Check, Flame, X } from "lucide-react";
import { limitLabels, defaultLimites } from "@/constants/planos";

interface Plan {
  id: string;
  nome: string;
  slug: string;
  preco: number;
  preco_promocional?: number;
  promo_duracao_meses?: number;
  periodo: string;
  descricao: string | null;
  popular: boolean;
  ativo: boolean;
  ordem: number;
  features: string[];
  limites: Record<string, any>;
  cta_texto: string;
  comissao_afiliado: number;
}

const AdminPlanManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [newFeature, setNewFeature] = useState("");
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-planos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("*")
        .order("ordem", { ascending: true });
      return (data ?? []) as unknown as Plan[];
    },
  });

  const { data: lojaPlanos = [] } = useQuery({
    queryKey: ["admin-loja-planos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("*, lojas(nome, slug)")
        .order("assinado_em", { ascending: false });
      return data ?? [];
    },
  });

  const savePlan = useMutation({
    mutationFn: async (plan: Plan) => {
      const payload = {
        nome: plan.nome,
        slug: plan.slug,
        preco: plan.preco,
        preco_promocional: plan.preco_promocional,
        promo_duracao_meses: plan.promo_duracao_meses,
        periodo: plan.periodo,
        descricao: plan.descricao,
        popular: plan.popular,
        ativo: plan.ativo,
        ordem: plan.ordem,
        features: plan.features as any,
        limites: plan.limites as any,
        cta_texto: plan.cta_texto,
        comissao_afiliado: plan.comissao_afiliado,
      };

      if (plan.id) {
        const { error } = await supabase.from("planos").update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-planos"] });
      setEditOpen(false);
      toast({ title: "Plano salvo ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar plano", variant: "destructive" }),
  });

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from("planos").delete().eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-planos"] });
      toast({ title: "Plano excluído" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const openNew = () => {
    setEditPlan({
      id: "",
      nome: "",
      slug: "",
      preco: 0,
      preco_promocional: 0,
      promo_duracao_meses: 0,
      periodo: "/mês",
      descricao: "",
      popular: false,
      ativo: true,
      ordem: plans.length + 1,
      features: [],
      limites: { ...defaultLimites },
      cta_texto: "Assinar",
      comissao_afiliado: 10,
    });
    setEditOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditPlan({ ...plan, limites: { ...defaultLimites, ...(plan.limites || {}) } });
    setEditOpen(true);
  };

  const addFeature = () => {
    if (!newFeature.trim() || !editPlan) return;
    
    if (editingFeatureIndex !== null) {
      const updatedFeatures = [...editPlan.features];
      updatedFeatures[editingFeatureIndex] = newFeature.trim();
      setEditPlan({ ...editPlan, features: updatedFeatures });
      setEditingFeatureIndex(null);
    } else {
      setEditPlan({ ...editPlan, features: [...editPlan.features, newFeature.trim()] });
    }
    
    setNewFeature("");
  };

  const startEditFeature = (idx: number) => {
    if (!editPlan) return;
    setNewFeature(editPlan.features[idx]);
    setEditingFeatureIndex(idx);
  };

  const removeFeature = (idx: number) => {
    if (!editPlan) return;
    setEditPlan({ ...editPlan, features: editPlan.features.filter((_, i) => i !== idx) });
  };

  const updateLimit = (key: string, value: any) => {
    if (!editPlan) return;
    setEditPlan({ ...editPlan, limites: { ...editPlan.limites, [key]: value } });
  };

  const subscriberCount = (planId: string) =>
    lojaPlanos.filter((lp: any) => lp.plano_id === planId && lp.ativo).length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-display text-foreground">Gerenciar Planos</h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo Plano
        </Button>
      </div>

      {/* Landing-page style preview cards */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        {plans.map((plan) => {
          const priceLabel = plan.preco === 0 ? "Grátis" : `R$ ${plan.preco}`;
          const subs = subscriberCount(plan.id);
          return (
            <div
              key={plan.id}
              className={`relative p-8 rounded-2xl border transition-all ${
                plan.popular
                  ? "bg-gradient-hero text-primary-foreground border-transparent shadow-glow scale-105"
                  : "bg-card border-border/50 shadow-card"
              } ${!plan.ativo ? "opacity-50" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-cta text-accent-foreground text-sm font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  Mais Popular
                </div>
              )}

              {!plan.ativo && (
                <div className="absolute top-3 right-3">
                  <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                </div>
              )}

              <h3 className={`text-xl font-bold font-display mb-1 ${plan.popular ? "" : "text-foreground"}`}>
                {plan.nome}
              </h3>
              <p className={`text-sm mb-4 ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {plan.descricao}
              </p>

              <div className="mb-6">
                {plan.preco_promocional && plan.promo_duracao_meses && plan.promo_duracao_meses > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold font-display">R$ {plan.preco_promocional}</span>
                      <span className={`text-xs ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        por {plan.promo_duracao_meses} meses
                      </span>
                    </div>
                    <div className={`text-xs ${plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      Depois R$ {plan.preco}{plan.periodo}
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold font-display">{priceLabel}</span>
                    <span className={`text-sm ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {plan.periodo}
                    </span>
                  </>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={`w-4 h-4 flex-shrink-0 ${plan.popular ? "text-secondary" : "text-primary"}`} />
                    <span className={plan.popular ? "text-primary-foreground/90" : "text-foreground"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <div className={`text-xs mb-4 ${plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                {subs} assinante{subs !== 1 ? "s" : ""}
              </div>

              {/* Admin action buttons */}
              <div className="flex gap-2">
                <Button
                  variant={plan.popular ? "secondary" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(plan)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (subs > 0) {
                      toast({ title: "Não é possível excluir plano com assinantes ativos", variant: "destructive" });
                      return;
                    }
                    deletePlan.mutate(plan.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPlan?.id ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          {editPlan && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left column — Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={editPlan.nome} onChange={(e) => setEditPlan({ ...editPlan, nome: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Slug</Label>
                    <Input value={editPlan.slug} onChange={(e) => setEditPlan({ ...editPlan, slug: e.target.value })} placeholder="ex: pro" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Preço (R$)</Label>
                    <Input type="number" value={editPlan.preco} onChange={(e) => setEditPlan({ ...editPlan, preco: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Preço Promo (R$)</Label>
                    <Input type="number" value={editPlan.preco_promocional || 0} onChange={(e) => setEditPlan({ ...editPlan, preco_promocional: Number(e.target.value) })} />
                    <p className="text-[10px] text-muted-foreground mt-1">Valor reduzido inicial</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Duração Promo (meses)</Label>
                    <Input type="number" value={editPlan.promo_duracao_meses || 0} onChange={(e) => setEditPlan({ ...editPlan, promo_duracao_meses: Number(e.target.value) })} />
                    <p className="text-[10px] text-muted-foreground mt-1">0 = sem promoção</p>
                  </div>
                  <div>
                    <Label className="text-xs">Período</Label>
                    <Input value={editPlan.periodo} onChange={(e) => setEditPlan({ ...editPlan, periodo: e.target.value })} placeholder="/mês" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Ordem</Label>
                  <Input type="number" value={editPlan.ordem} onChange={(e) => setEditPlan({ ...editPlan, ordem: Number(e.target.value) })} />
                </div>

                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={editPlan.descricao || ""} onChange={(e) => setEditPlan({ ...editPlan, descricao: e.target.value })} rows={2} />
                </div>

                <div>
                  <Label className="text-xs">Texto do Botão (CTA)</Label>
                  <Input value={editPlan.cta_texto} onChange={(e) => setEditPlan({ ...editPlan, cta_texto: e.target.value })} />
                </div>

                <div>
                  <Label className="text-xs">Comissão do Afiliado (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={editPlan.comissao_afiliado}
                    onChange={(e) => setEditPlan({ ...editPlan, comissao_afiliado: Number(e.target.value) })}
                    placeholder="Ex: 10"
                    className="w-32"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Porcentagem paga ao afiliado por assinatura deste plano</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={editPlan.popular} onCheckedChange={(v) => setEditPlan({ ...editPlan, popular: v })} />
                    <Label className="text-xs">Popular</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editPlan.ativo} onCheckedChange={(v) => setEditPlan({ ...editPlan, ativo: v })} />
                    <Label className="text-xs">Ativo</Label>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recursos exibidos</h4>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      placeholder={editingFeatureIndex !== null ? "Editando recurso..." : "Novo recurso..."}
                      className="text-sm"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                    />
                    <Button variant="outline" size="sm" onClick={addFeature}>
                      {editingFeatureIndex !== null ? "Salvar" : "Adicionar"}
                    </Button>
                    {editingFeatureIndex !== null && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditingFeatureIndex(null); setNewFeature(""); }}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {editPlan.features.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <span className="text-sm text-foreground">{f}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => startEditFeature(i)} className="text-muted-foreground hover:text-primary transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column — Limits */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limites de acesso</h4>
                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-4">
                  {Object.entries(limitLabels).map(([key, label]) => {
                    const val = editPlan.limites[key];
                    const isNumeric = key.startsWith("max_");
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-foreground">{label}</span>
                        {isNumeric ? (
                          <Input
                            type="number"
                            value={val ?? 0}
                            onChange={(e) => updateLimit(key, Number(e.target.value))}
                            className="w-24 h-8 text-xs text-right"
                          />
                        ) : (
                          <Switch
                            checked={!!val}
                            onCheckedChange={(v) => updateLimit(key, v)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => editPlan && savePlan.mutate(editPlan)} disabled={savePlan.isPending}>
              {savePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlanManager;
