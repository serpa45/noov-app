import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Loader2, DollarSign } from "lucide-react";
import { limitLabels, defaultLimites } from "@/constants/planos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lojaPlanoId: string;
  lojaId: string;
  planoId?: string | null;
  initialLimites?: Record<string, any> | null;
  planoLimites?: Record<string, any> | null;
  initialPreco?: number | null;
  planoPrecoPadrao?: number | null;
  planoNome?: string | null;
}

export const EditPlanLimitsDialog = ({
  open, onOpenChange, lojaPlanoId, lojaId, planoId,
  initialLimites, planoLimites, initialPreco, planoPrecoPadrao, planoNome,
}: Props) => {
  const queryClient = useQueryClient();
  const [limites, setLimites] = useState<Record<string, any>>({});
  const [preco, setPreco] = useState<string>("");

  useEffect(() => {
    if (open) {
      // Prioridade TOTAL do override da loja sobre o plano.
      // Se a loja tem override definido para uma chave, esse valor prevalece (mesmo false/0).
      // Se não tem override para a chave, usa o valor do plano contratado (ou default).
      const base = { ...defaultLimites, ...(planoLimites || {}) };
      const override = initialLimites || {};
      const merged: Record<string, any> = { ...base };
      for (const k of Object.keys(override)) {
        merged[k] = (override as any)[k];
      }
      // Backward compat: legacy "pdv" flag → habilita ambas as chaves PDV se não houver override explícito
      const legacyPdv = Boolean((planoLimites || {}).pdv) || Boolean((override as any).pdv);
      if (legacyPdv) {
        if (!Object.prototype.hasOwnProperty.call(override, "pdv_balcao") && merged.pdv_balcao === undefined) merged.pdv_balcao = true;
        if (!Object.prototype.hasOwnProperty.call(override, "pdv_mesas") && merged.pdv_mesas === undefined) merged.pdv_mesas = true;
      }
      setLimites(merged);
      setPreco(initialPreco != null ? String(initialPreco) : "");
    }
  }, [open, initialLimites, planoLimites, initialPreco]);

  const save = useMutation({
    mutationFn: async () => {
      const precoNum = preco === "" ? null : Number(preco);
      const lojaPlanoUpdate: any = { limites_assinado: limites as any };
      if (precoNum != null && !Number.isNaN(precoNum)) {
        lojaPlanoUpdate.preco_assinado = precoNum;
      }
      const { error } = await supabase
        .from("loja_planos")
        .update(lojaPlanoUpdate)
        .eq("id", lojaPlanoId);
      if (error) throw error;

      // Sync exclusive price on lojas so MeuPlano / pagamento usa o valor correto
      const lojaUpdate: any = {};
      if (precoNum != null && !Number.isNaN(precoNum)) {
        lojaUpdate.valor_plano_exclusivo = precoNum;
        if (planoId) lojaUpdate.plano_id_exclusivo = planoId;
      } else {
        lojaUpdate.valor_plano_exclusivo = null;
        lojaUpdate.plano_id_exclusivo = null;
      }
      const { error: e2 } = await supabase.from("lojas").update(lojaUpdate).eq("id", lojaId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-plano"] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail"] });
      queryClient.invalidateQueries({ queryKey: ["plan-limits-plano", lojaId] });
      queryClient.invalidateQueries({ queryKey: ["public-plan-limits", lojaId] });
      toast.success("Plano desta loja atualizado");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const update = (k: string, v: any) => setLimites((p) => ({ ...p, [k]: v }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Plano desta Loja</SheetTitle>
          <SheetDescription className="text-xs">
            Estas alterações se aplicam apenas a esta loja e não alteram o plano público da landing page.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Nome do plano + indicador de personalização */}
          {planoNome && (() => {
            const base = { ...defaultLimites, ...(planoLimites || {}) } as Record<string, any>;
            const keys = new Set([...Object.keys(base), ...Object.keys(limites || {})]);
            let personalizado = false;
            for (const k of keys) {
              const a = base[k];
              const b = (limites as any)?.[k];
              const norm = (v: any) => (v === undefined ? undefined : v);
              if (norm(a) !== norm(b) && !(a === undefined && (b === false || b === 0)) && !(b === undefined && (a === false || a === 0))) {
                personalizado = true;
                break;
              }
            }
            return (
              <div className="px-1">
                <p className="text-lg font-bold text-foreground">
                  Plano {planoNome}
                  {personalizado && <span className="text-muted-foreground text-base font-semibold"> · <span className="text-primary">Personalizado</span></span>}
                </p>
              </div>
            );
          })()}

          {/* Preço exclusivo */}
          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-primary" /> Valor cobrado nesta loja (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder={planoPrecoPadrao != null ? `Padrão: R$ ${Number(planoPrecoPadrao).toFixed(2)}` : "Ex: 97.00"}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Este valor substitui o preço do plano nesta loja e é usado na integração de pagamento (Meu Plano). Deixe vazio para voltar ao preço padrão.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-4">
            {Object.entries(limitLabels).map(([key, label]) => {
              const val = limites[key];
              const isNumeric = key.startsWith("max_");
              const baseVal = (planoLimites && Object.prototype.hasOwnProperty.call(planoLimites, key))
                ? (planoLimites as any)[key]
                : (defaultLimites as any)[key];
              const changed = isNumeric ? Number(val ?? 0) !== Number(baseVal ?? 0) : Boolean(val) !== Boolean(baseVal);
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">
                    {changed && <span className="text-primary font-bold mr-1">*</span>}
                    {label}
                  </span>
                  {isNumeric ? (
                    <Input
                      type="number"
                      value={val ?? 0}
                      onChange={(e) => update(key, Number(e.target.value))}
                      className="w-24 h-8 text-xs text-right"
                    />
                  ) : (
                    <Switch checked={!!val} onCheckedChange={(v) => update(key, v)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
