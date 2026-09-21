import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, DollarSign, Users, AlertTriangle, Pizza, Info, Ruler } from "lucide-react";
import { toast } from "sonner";

interface Props {
  storeId: string;
}

interface PizzaSize {
  id: string;
  name: string;
}

interface SizeSlot {
  defaultName: string;
  name: string;
  enabled: boolean;
  optionId: string | null;
  limit: number;
}

const DEFAULT_SIZES = ["Brotinho", "Pequena", "Média", "Grande", "Gigante"];

export default function PizzariaRulesManager({ storeId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [formaCobranca, setFormaCobranca] = useState<"fracionado" | "maior_preco">("fracionado");
  const [observacoes, setObservacoes] = useState("");
  const [sizes, setSizes] = useState<PizzaSize[]>([]);
  const [limiteSabores, setLimiteSabores] = useState<Record<string, number>>({});
  const [sizeCategoryId, setSizeCategoryId] = useState<string | null>(null);
  const [sizeSlots, setSizeSlots] = useState<SizeSlot[]>(
    DEFAULT_SIZES.map((n) => ({ defaultName: n, name: n, enabled: false, optionId: null, limit: 2 }))
  );

  useEffect(() => {
    if (!storeId) return;
    loadData();
  }, [storeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: cats } = await supabase
        .from("pizzaria_categories")
        .select("id")
        .eq("store_id", storeId)
        .eq("type", "size");

      const catIds = (cats || []).map((c) => c.id);
      setSizeCategoryId(catIds[0] || null);

      let sizeOptions: PizzaSize[] = [];
      if (catIds.length > 0) {
        const { data: opts } = await supabase
          .from("pizzaria_options")
          .select("id, name")
          .in("category_id", catIds);
        sizeOptions = opts || [];
      }
      setSizes(sizeOptions);

      const { data: config } = await supabase
        .from("pizzaria_configuracoes" as any)
        .select("*")
        .eq("loja_id", storeId)
        .maybeSingle();

      const cfgLimits: Record<string, number> = (config as any)?.limite_sabores || {};

      // Match existing options to default size slots by name (case-insensitive)
      const slots: SizeSlot[] = DEFAULT_SIZES.map((defName) => {
        const match = sizeOptions.find(
          (o) => o.name.trim().toLowerCase() === defName.toLowerCase()
        );
        return {
          defaultName: defName,
          name: match?.name || defName,
          enabled: !!match,
          optionId: match?.id || null,
          limit: match ? (cfgLimits[match.id] ?? 2) : 2,
        };
      });
      setSizeSlots(slots);

      if (config) {
        const c = config as any;
        setConfigId(c.id);
        setFormaCobranca(c.forma_cobranca);
        setObservacoes(c.observacoes || "");
        setLimiteSabores(cfgLimits);
      } else {
        const defaults: Record<string, number> = {};
        sizeOptions.forEach((s) => { defaults[s.id] = 2; });
        setLimiteSabores(defaults);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSlot = (idx: number, patch: Partial<SizeSlot>) => {
    setSizeSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const persistSizes = async (): Promise<{ id: string; name: string }[]> => {
    let catId = sizeCategoryId;
    if (!catId) {
      const { data: newCat, error: catErr } = await supabase
        .from("pizzaria_categories")
        .insert({ store_id: storeId, name: "Tamanhos", type: "size" })
        .select()
        .single();
      if (catErr) throw catErr;
      catId = newCat.id;
      setSizeCategoryId(catId);
    }

    const results: { id: string; name: string }[] = [];
    for (const slot of sizeSlots) {
      if (slot.enabled) {
        if (slot.optionId) {
          const { error } = await supabase
            .from("pizzaria_options")
            .update({ name: slot.name })
            .eq("id", slot.optionId);
          if (error) throw error;
          results.push({ id: slot.optionId, name: slot.name });
        } else {
          const { data, error } = await supabase
            .from("pizzaria_options")
            .insert({ category_id: catId, name: slot.name, additional_price: 0 })
            .select()
            .single();
          if (error) throw error;
          results.push({ id: data.id, name: data.name });
        }
      } else if (slot.optionId) {
        const { error } = await supabase
          .from("pizzaria_options")
          .delete()
          .eq("id", slot.optionId);
        if (error) throw error;
      }
    }
    return results;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const persistedSizes = await persistSizes();

      setSizes(persistedSizes);

      // Build limits from slots (matched by name)
      const newLimits: Record<string, number> = {};
      persistedSizes.forEach((s) => {
        const slot = sizeSlots.find(
          (sl) => sl.name.trim().toLowerCase() === s.name.trim().toLowerCase()
        );
        newLimits[s.id] = slot?.limit ?? 2;
      });
      setLimiteSabores(newLimits);

      setSizeSlots((prev) =>
        prev.map((s) => {
          if (!s.enabled) return { ...s, optionId: null };
          const found = persistedSizes.find(
            (p) => p.name.trim().toLowerCase() === s.name.trim().toLowerCase()
          );
          return { ...s, optionId: found?.id || s.optionId };
        })
      );

      const payload = {
        loja_id: storeId,
        forma_cobranca: formaCobranca,
        limite_sabores: newLimits,
        observacoes,
      };

      if (configId) {
        const { error } = await supabase
          .from("pizzaria_configuracoes" as any)
          .update(payload)
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("pizzaria_configuracoes" as any)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setConfigId((data as any).id);
      }
      toast.success("Regras salvas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="bg-primary/10 p-3 rounded-xl">
            <Pizza className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Regras da Pizzaria</h2>
            <p className="text-sm text-muted-foreground">
              Configure como o sistema deve calcular preços e validar pedidos de pizzas no seu cardápio.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Forma de Cobrança */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold">Forma de Cobrança</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Informe a forma que o sistema irá cobrar a montagem da pizza do seu cliente quando houver mais de um sabor.
          </p>

          <RadioGroup value={formaCobranca} onValueChange={(v) => setFormaCobranca(v as any)} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <label
              htmlFor="fracionado"
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                formaCobranca === "fracionado" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem value="fracionado" id="fracionado" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Valor Fracionado (Média dos sabores)</span>
                  <span className="text-[10px] font-bold uppercase bg-green-500/10 text-green-600 px-2 py-0.5 rounded">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  O preço final é a soma proporcional de cada sabor (ex: 1/2 Calabresa R$30 + 1/2 Mussarela R$20 = R$25). Justa e em conformidade com o CDC.
                </p>
              </div>
            </label>

            <label
              htmlFor="maior_preco"
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                formaCobranca === "maior_preco" ? "border-destructive bg-destructive/5" : "border-border hover:border-destructive/50"
              }`}
            >
              <RadioGroupItem value="maior_preco" id="maior_preco" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Valor do Sabor Mais Caro</span>
                  <span className="text-[10px] font-bold uppercase bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                    Não Recomendado
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cobra sempre o preço do sabor mais caro. Esta prática pode ser considerada abusiva pelo Código de Defesa do Consumidor (STJ REsp 1.876.628).
                </p>
              </div>
            </label>
          </RadioGroup>

          {formaCobranca === "maior_preco" && (
            <div className="flex gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                <strong>Atenção:</strong> Cobrar pelo sabor mais caro pode gerar reclamações e processos. O STJ já decidiu que essa prática é abusiva.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tamanhos de Pizza */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Ruler className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold">Tamanhos de Pizza</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Ative os tamanhos que sua pizzaria oferece e personalize os nomes se desejar. Os tamanhos ativados aparecerão no cadastro de pizzas e para o cliente escolher.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2">
            {sizeSlots.map((slot, idx) => (
              <div
                key={slot.defaultName}
                className={`p-2.5 rounded-lg border transition-all ${
                  slot.enabled ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <Pizza className={`w-3 h-3 shrink-0 ${slot.enabled ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                      {slot.defaultName}
                    </span>
                  </div>
                  <Switch
                    checked={slot.enabled}
                    onCheckedChange={(v) => updateSlot(idx, { enabled: v })}
                    className="scale-75 origin-right"
                  />
                </div>
                <Input
                  value={slot.name}
                  disabled={!slot.enabled}
                  onChange={(e) => updateSlot(idx, { name: e.target.value })}
                  placeholder={slot.defaultName}
                  className="h-8 text-xs px-2"
                />
                <div className="mt-2 pt-2 border-t border-border/50">
                  <Label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Máx. sabores
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    disabled={!slot.enabled}
                    value={slot.limit}
                    onChange={(e) =>
                      updateSlot(idx, { limit: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="h-8 text-xs px-2 w-full mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <Label htmlFor="obs" className="text-base font-semibold">Observações Internas</Label>
          <Textarea
            id="obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Notas sobre regras específicas da sua pizzaria..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="fixed bottom-6 right-4 md:right-6 z-50">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Regras
        </Button>
      </div>
    </div>
  );
}
