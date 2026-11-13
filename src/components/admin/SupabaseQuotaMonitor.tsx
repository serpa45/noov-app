import { useQuery, useQueryClient } from "@tanstack/react-query";
import { requestQuotaReading } from "@/utils/supabaseQuotaReadings";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Download, Upload, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { additionalUsage, parseQuotaNumber, quotaMetrics, quotaStatus, QUOTAS_VERIFIED_AT,
  technicalLimits, usageDoc, validateQuotaSnapshot, type QuotaSnapshot } from "@/utils/supabaseQuotas";

const format = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const localDateTime = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const usageUrl = "https://supabase.com/dashboard/org/_/usage";
type Draft = { start: string; end: string; readAt: string; values: Record<string, string>; limits: Record<string, string> };

export function SupabaseQuotaMonitor() {
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(timer); }, []);
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID || "mwnjoglolbyeyrmkqqqc";
  const queryClient = useQueryClient();
  const readingKey = ["supabase-quota-reading", projectRef];
  const { data: reading, isLoading, isError, error, refetch } = useQuery({
    queryKey: readingKey, queryFn: () => requestQuotaReading(projectRef), staleTime: 60000,
  });
  const snapshot = reading?.snapshot ?? null;
  const [storageError, setStorageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ start: "", end: "", readAt: "", values: {}, limits: {} });
  const importRef = useRef<HTMLInputElement>(null);
  const states = quotaMetrics.map(metric => ({ metric, ...quotaStatus(metric, snapshot) }));
  const missing = states.filter(s => s.state === "Sem leitura").length;
  const outdated = states.some(s => s.stale);
  const alerts = states.filter(s => ["Atenção", "Crítico", "Franquia atingida", "Acima da referência"].includes(s.state)).length;
  const color = (state: string) => ["Franquia atingida", "Crítico", "Acima da referência"].includes(state)
    ? "border-red-500/40 text-red-700 bg-red-500/5" : ["Dentro da referência", "Configuração na referência"].includes(state)
    ? "border-blue-500/30 text-blue-700 bg-blue-500/5" : "border-amber-500/40 text-amber-800 bg-amber-500/5";
  const persist = async (value: QuotaSnapshot) => {
    const verified = validateQuotaSnapshot(value, projectRef);
    const saved = await requestQuotaReading(projectRef, verified);
    queryClient.setQueryData(readingKey, saved);
    setStorageError("");
  };
  const configure = () => {
    setDraft({ start: snapshot?.cycleStart || "", end: snapshot?.cycleEnd || "",
      readAt: localDateTime(snapshot?.readAt || new Date().toISOString()),
      values: Object.fromEntries(quotaMetrics.map(m => [m.id, snapshot?.values[m.id]?.toString() ?? ""])),
      limits: Object.fromEntries(quotaMetrics.map(m => [m.id, snapshot?.limits[m.id]?.toString() ?? ""])) });
    setOpen(true);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!draft.readAt || Number.isNaN(Date.parse(draft.readAt))) throw new Error("Informe a data e hora da leitura.");
      const values: QuotaSnapshot["values"] = {}, limits: QuotaSnapshot["limits"] = {};
      for (const metric of quotaMetrics) {
        const value = parseQuotaNumber(draft.values[metric.id] || ""), limit = parseQuotaNumber(draft.limits[metric.id] || "");
        if (value !== undefined) values[metric.id] = value;
        if (limit !== undefined) limits[metric.id] = limit;
      }
      await persist({ version: 1, projectRef, plan: "pro", cycleStart: draft.start, cycleEnd: draft.end,
        readAt: new Date(draft.readAt).toISOString(), values, limits });
      setOpen(false); toast.success("Leitura salva entre os administradores. Ela não é atualizada automaticamente.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a leitura."); }
    finally { setSaving(false); }
  };
  const exportReading = () => {
    if (!snapshot) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `supabase-${projectRef}-${snapshot.cycleStart}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importReading = async (file?: File) => {
    if (!file || saving) return;
    setSaving(true);
    try {
      if (file.size > 200000) throw new Error("O arquivo de leitura é muito grande.");
      if (!window.confirm("Importar e substituir a leitura compartilhada entre os administradores?")) return;
      await persist(validateQuotaSnapshot(JSON.parse(await file.text()), projectRef));
      toast.success("Leitura importada. Confira o ciclo e a data.");
    } catch (error) { setStorageError(error instanceof Error ? error.message : "Arquivo inválido."); }
    finally { setSaving(false); if (importRef.current) importRef.current.value = ""; }
  };
  const setCycle = (field: "start" | "end", value: string) => setDraft(d => ({ ...d, [field]: value, values: {} }));

  return <Card className="border-primary/30" data-testid="supabase-quota-monitor">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>Franquias e limites do Supabase</CardTitle>
          <Badge variant="outline">Plano Pro</Badge>
          <CardDescription>Consumo do ciclo de cobrança, separado da ocupação atual do banco e dos arquivos.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={isLoading || isError || saving} onClick={configure}><Settings2 className="h-4 w-4 mr-2" />Registrar consumo</Button>
          <Button asChild variant="outline" size="sm"><a href={usageUrl} target="_blank" rel="noopener noreferrer">Abrir consumo no Supabase<ExternalLink className="h-3 w-3 ml-2" /></a></Button>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm space-y-2" role="status">
        <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />Consumo de cobrança não coletado automaticamente nesta conexão</p>
        <p>Saída comum e saída em cache têm franquias separadas. Os contadores abaixo precisam ser copiados da página de consumo do Supabase. Sem leitura não significa consumo zero.</p>
        <p>{missing} indicador(es) sem leitura · {alerts} alerta(s) nos valores informados{outdated ? " · Há leitura antiga ou de outro ciclo." : ""}</p>
        <p>As leituras são compartilhadas entre os administradores deste projeto e ficam em armazenamento privado. Alertas são exibidos nesta tela; não enviam e-mails nem monitoram em segundo plano.</p>
      </div>
      {isLoading && <p className="text-sm">Carregando leitura compartilhada...</p>}
      {isError && <div role="alert" className="text-sm text-destructive"><p>Falha ao carregar leitura compartilhada: {error instanceof Error ? error.message : "tente novamente"}</p><Button variant="outline" size="sm" onClick={() => refetch()}>Recarregar leitura</Button></div>}
      {storageError && <p role="alert" className="text-sm text-destructive">{storageError}</p>}
      <div className="flex flex-wrap justify-between gap-3 items-center text-xs text-muted-foreground">
        <p>{snapshot ? `Ciclo informado: ${snapshot.cycleStart} a ${snapshot.cycleEnd} · Leitura do painel: ${new Date(snapshot.readAt).toLocaleString("pt-BR")}` : "Nenhum ciclo de cobrança informado. As datas não são presumidas pelo mês do calendário."}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={!snapshot} onClick={exportReading}><Download className="h-3 w-3 mr-1" />Exportar leitura</Button>
          <Button variant="ghost" size="sm" disabled={isLoading || isError || saving} onClick={() => importRef.current?.click()}><Upload className="h-3 w-3 mr-1" />Importar leitura</Button>
          <input aria-label="Arquivo de leitura do Supabase" className="hidden" ref={importRef} type="file" accept="application/json,.json" onChange={e => void importReading(e.target.files?.[0])} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {states.slice(0, 4).map(({ metric, value, limit, percent, state, stale }) => <div key={metric.id} className={`rounded-xl border p-4 space-y-3 ${color(state)}`}>
          <h3 className="font-semibold text-sm">{metric.label}</h3>
          <p className="text-xl font-bold">{value === undefined ? "Sem leitura" : `${format(value)} ${metric.unit}`}</p>
          <p className="text-xs">{snapshot?.limits[metric.id] !== undefined ? "Limite informado" : "Referência Pro"}: {limit === null ? "variável" : `${format(limit)} ${metric.unit}`}</p>
          {percent !== null && <><Progress value={Math.min(100, percent)} aria-label={`Uso de ${metric.label}`} className={percent > 100 ? "[&>div]:bg-destructive" : ""} /><p className="text-xs">{format(percent)}% da referência</p></>}
          <Badge variant="outline">{state}</Badge>
          {stale && <p className="text-xs font-semibold">Atualize a leitura: ela tem mais de 24h ou pertence a outro ciclo.</p>}
          <p className="text-xs text-muted-foreground">{metric.scope}. {metric.detail}</p>
          <a className="text-xs underline" href={usageDoc(metric.page)} target="_blank" rel="noopener noreferrer">Como o Supabase mede</a>
        </div>)}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm"><caption className="text-left p-3 font-semibold">Autenticação, tempo real, funções, imagens, logs e disco</caption>
          <thead className="bg-muted/40"><tr><th className="p-3 text-left">Indicador</th><th className="p-3 text-left">Consumo informado</th><th className="p-3 text-left">Franquia / referência</th><th className="p-3 text-left">Situação</th></tr></thead>
          <tbody>{states.slice(4).map(({ metric, value, limit, percent, state, stale }) => <tr key={metric.id} className="border-t align-top">
            <td className="p-3 min-w-[250px]"><a className="font-medium underline" href={usageDoc(metric.page)} target="_blank" rel="noopener noreferrer">{metric.label}</a><p className="text-xs text-muted-foreground mt-1">{metric.scope}. {metric.detail}</p></td>
            <td className="p-3 whitespace-nowrap">{value === undefined ? "Sem leitura" : `${format(value)} ${metric.unit}`}</td>
            <td className="p-3 whitespace-nowrap">{limit === null ? "Variável; conferir painel" : `${format(limit)} ${metric.unit}`}<p className="text-xs text-muted-foreground">{snapshot?.limits[metric.id] !== undefined ? "Limite informado" : "Referência do plano Pro"}</p></td>
            <td className="p-3"><Badge variant="outline" className={color(state)}>{state}</Badge>{percent !== null && <p className="text-xs mt-1">{format(percent)}%</p>}{stale && <p className="text-xs mt-1">Leitura desatualizada</p>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Alertas de consumo: 80%, 90% e 100%. Para recursos provisionados, estar exatamente no incluído não significa excedente. Franquias de organização podem ser compartilhadas com outros projetos: copie a leitura com o mesmo escopo indicado acima.</p>
        <p>Referências verificadas em {QUOTAS_VERIFIED_AT}. Contratos, adicionais e limites personalizados podem mudar esses valores. Não é uma fatura nem uma previsão completa de custos.</p>
        <p>Reduzir arquivos não apaga o tráfego já servido. A média de armazenamento do ciclo também não cai imediatamente ao apagar arquivos.</p>
      </div>
      <details className="rounded-lg border p-4"><summary className="font-semibold cursor-pointer">Outros custos e restrições que precisam ser conferidos</summary>
        <div className="grid md:grid-cols-2 gap-3 mt-4">{additionalUsage.map(item => <div key={item.page}><a href={usageDoc(item.page)} className="text-sm underline font-medium" target="_blank" rel="noopener noreferrer">{item.label}</a><p className="text-xs text-muted-foreground">{item.detail}</p></div>)}</div>
        <p className="text-sm font-semibold mt-5 mb-2">Limites técnicos dependem da configuração de cada serviço</p>
        <ul className="text-sm space-y-2">{technicalLimits.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer" className="underline">{item.label}</a></li>)}</ul>
        <p className="text-xs text-muted-foreground mt-3">Não há leitura automática destes adicionais nesta tela. Confira também o limite de gastos (Spend Cap) e os avisos de cobrança da organização.</p>
      </details>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>Registrar leitura do painel Supabase</SheetTitle><SheetDescription>Copie os contadores do mesmo ciclo e escopo. Compartilhado entre os administradores. Em branco significa sem leitura; informe 0 apenas quando o painel mostrar zero.</SheetDescription></SheetHeader>
        <div className="space-y-4 mt-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Primeiro dia do ciclo<Input type="date" value={draft.start} onChange={e => setCycle("start", e.target.value)} /></label>
            <label className="text-sm">Último dia do ciclo<Input type="date" value={draft.end} onChange={e => setCycle("end", e.target.value)} /></label>
          </div>
          <p className="text-xs text-muted-foreground">Trocar as datas limpa os consumos do formulário, para não reutilizar números de outro ciclo.</p>
          <label className="block text-sm">Data e hora da leitura<Input type="datetime-local" value={draft.readAt} onChange={e => setDraft(d => ({ ...d, readAt: e.target.value }))} /></label>
          <p className="text-xs text-muted-foreground">Ao atualizar a data da leitura, confira novamente todos os valores preenchidos. Use números sem separador de milhares, como 1250,50.</p>
          {quotaMetrics.map(metric => <div key={metric.id} className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-semibold">{metric.label} ({metric.unit})</p><p className="text-xs text-muted-foreground">{metric.scope}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">Consumo<Input aria-label={`Consumo: ${metric.label}`} inputMode="decimal" value={draft.values[metric.id] || ""} placeholder="Não informado" onChange={e => setDraft(d => ({ ...d, values: { ...d.values, [metric.id]: e.target.value } }))} /></label>
              <label className="text-xs">Limite diferente do padrão (opcional)<Input aria-label={`Limite: ${metric.label}`} inputMode="decimal" value={draft.limits[metric.id] || ""} placeholder={metric.limit === null ? "Sem referência fixa" : String(metric.limit)} onChange={e => setDraft(d => ({ ...d, limits: { ...d.limits, [metric.id]: e.target.value } }))} /></label>
            </div>
          </div>)}
          <Button className="w-full" disabled={saving} onClick={() => void save()}>{saving ? "Salvando..." : "Salvar leitura compartilhada"}</Button>
        </div>
      </SheetContent></Sheet>
    </CardContent>
  </Card>;
}
