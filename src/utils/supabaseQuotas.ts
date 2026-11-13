const docs = "https://supabase.com/docs/guides/platform/manage-your-usage/";
export const QUOTAS_VERIFIED_AT = "2026-11-13";
export const quotaMetrics = [
  { id: "egress", label: "Saída de dados sem cache", unit: "GB", limit: 250, scope: "Organização · ciclo", detail: "Dados enviados aos clientes por banco, autenticação, arquivos, funções e tempo real.", page: "egress" },
  { id: "cached_egress", label: "Saída de dados em cache", unit: "GB", limit: 250, scope: "Organização · ciclo", detail: "Arquivos entregues pelo cache da CDN. Tem franquia própria, separada da saída sem cache.", page: "egress" },
  { id: "storage", label: "Armazenamento médio do ciclo", unit: "GB", limit: 100, scope: "Organização · média do ciclo", detail: "Média de arquivos armazenados ao longo do ciclo. É diferente do espaço ocupado neste momento.", page: "storage-size" },
  { id: "disk", label: "Disco provisionado do banco", unit: "GB", limit: 8, scope: "Projeto · disco gp3", detail: "Capacidade contratada, incluindo áreas que não aparecem no tamanho dos dados. A referência de 8 GB é para o disco gp3 do banco principal.", page: "disk-size" },
  { id: "mau", label: "Usuários ativos de autenticação", unit: "usuários", limit: 100000, scope: "Organização · ciclo", detail: "Pessoas que entraram ou renovaram o acesso no ciclo. Não é o total de contas cadastradas.", page: "monthly-active-users" },
  { id: "third_party_mau", label: "Usuários ativos de autenticação externa", unit: "usuários", limit: 100000, scope: "Organização · ciclo", detail: "Contador específico da integração Third-Party Auth, quando utilizada.", page: "monthly-active-users-third-party" },
  { id: "sso_mau", label: "Usuários ativos via SSO", unit: "usuários", limit: 50, scope: "Organização · ciclo", detail: "Acessos por login corporativo SSO, quando habilitado.", page: "monthly-active-users-sso" },
  { id: "realtime_messages", label: "Mensagens em tempo real", unit: "mensagens", limit: 5000000, scope: "Organização · ciclo", detail: "Inclui eventos de alterações, Broadcast e Presence. Um evento pode contar várias vezes conforme os destinatários.", page: "realtime-messages" },
  { id: "realtime_peak", label: "Pico de conexões em tempo real", unit: "conexões", limit: 500, scope: "Organização · soma dos picos dos projetos", detail: "Não é o número de visitantes da tela: cada conexão WebSocket conta, inclusive de servidores.", page: "realtime-peak-connections" },
  { id: "functions", label: "Execuções de Edge Functions", unit: "execuções", limit: 2000000, scope: "Organização · ciclo", detail: "Chamadas de funções, inclusive respostas de erro. Requisições OPTIONS não entram nesse contador.", page: "edge-function-invocations" },
  { id: "images", label: "Imagens de origem transformadas", unit: "imagens", limit: 100, scope: "Organização · ciclo", detail: "Imagens distintas usadas nas transformações do Storage; não é o total de imagens cadastradas ou de downloads.", page: "storage-image-transformations" },
  { id: "logs_ingest", label: "Volume de logs recebido", unit: "GB", limit: 20, scope: "Organização · ciclo", detail: "Logs dos serviços processados pelo Supabase. Não corresponde apenas aos erros exibidos no Noov.", page: "logs-ingest" },
  { id: "logs_query", label: "Volume consultado nos logs", unit: "GB", limit: null, scope: "Organização · referência variável", detail: "Não há cobrança direta. A regra de consulta depende do volume recebido; confira no painel a situação e o cronograma de aplicação dessa regra.", page: "logs-query" },
  { id: "iops", label: "IOPS provisionadas", unit: "IOPS", limit: 3000, scope: "Projeto · disco gp3", detail: "Operações de disco contratadas por segundo. Outros tipos de disco têm condições diferentes.", page: "disk-iops" },
  { id: "throughput", label: "Vazão de disco provisionada", unit: "MB/s", limit: 125, scope: "Projeto · disco gp3", detail: "Capacidade de transferência do disco contratada. Não é a saída de dados pela internet.", page: "disk-throughput" },
] as const;
export type QuotaId = typeof quotaMetrics[number]["id"];
export type QuotaSnapshot = {
  version: 1; projectRef: string; plan: "pro"; cycleStart: string; cycleEnd: string; readAt: string;
  values: Partial<Record<QuotaId, number>>;
  limits: Partial<Record<QuotaId, number>>;
};
export const additionalUsage = [
  { label: "Compute, CPU, RAM e conexões do banco", page: "compute", detail: "Depende do tamanho da instância e das horas de uso. O limite de gastos não cobre compute; confirme os créditos e os projetos ativos." },
  { label: "Backups Point-in-Time Recovery", page: "point-in-time-recovery", detail: "Adicional conforme configuração e retenção." },
  { label: "Réplicas de leitura", page: "read-replicas", detail: "Cada réplica acrescenta recursos e custos próprios." },
  { label: "Branches de desenvolvimento", page: "branching", detail: "Confira ambientes ativos e horas de uso." },
  { label: "IPv4 dedicado", page: "ipv4", detail: "Adicional quando habilitado." },
  { label: "Domínios personalizados", page: "custom-domains", detail: "Adicional conforme domínios e projetos configurados." },
  { label: "MFA avançado por telefone", page: "advanced-mfa-phone", detail: "Adicional por projeto; custos de SMS também dependem do provedor." },
  { label: "Log Drains", page: "log-drains", detail: "Exportação de logs tem medição própria e pode gerar saída de dados." },
  { label: "Pipelines", page: "pipelines", detail: "Confira a configuração e o consumo específico na organização." },
];
export const technicalLimits = [
  { label: "Memória, CPU e duração das funções", url: "https://supabase.com/docs/guides/functions/limits" },
  { label: "Conexões, canais e mensagens por segundo", url: "https://supabase.com/docs/guides/realtime/quotas" },
  { label: "Taxas de autenticação e envio de e-mails", url: "https://supabase.com/docs/guides/auth/rate-limits" },
  { label: "Tamanho de uploads e restrições de arquivos", url: "https://supabase.com/docs/guides/storage/uploads/file-limits" },
  { label: "Compute, disco e conexões Postgres", url: "https://supabase.com/docs/guides/platform/compute-and-disk" },
];
export const usageDoc = (page: string) => docs + page;
const dateValid = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

export function parseQuotaNumber(text: string): number | undefined {
  if (!text.trim()) return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(text.trim())) throw new Error("Use números sem separador de milhares, como 1250,50.");
  const value = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(value)) throw new Error("Informe um número válido.");
  return value;
}

export function validateQuotaSnapshot(input: unknown, projectRef: string, now = new Date()): QuotaSnapshot {
  const value = input as QuotaSnapshot;
  if (!value || value.version !== 1 || value.projectRef !== projectRef || value.plan !== "pro") throw new Error("O registro não é do plano Pro deste projeto.");
  if (!dateValid(value.cycleStart) || !dateValid(value.cycleEnd) || value.cycleStart > value.cycleEnd) throw new Error("Confira as datas do ciclo.");
  if (Date.parse(value.cycleEnd) - Date.parse(value.cycleStart) > 62 * 86400000) throw new Error("Confira o ciclo mensal: o intervalo informado ultrapassa 62 dias.");
  const readAt = typeof value.readAt === "string" ? Date.parse(value.readAt) : NaN;
  if (!Number.isFinite(readAt) || readAt > now.getTime() + 300000 || new Date(readAt).toISOString().slice(0, 10) < value.cycleStart) throw new Error("Confira a data da leitura: ela não pode estar no futuro ou antes do ciclo.");
  if (!value.values || typeof value.values !== "object" || Array.isArray(value.values) || !value.limits || typeof value.limits !== "object" || Array.isArray(value.limits)) throw new Error("Registro de consumo inválido.");
  const values: QuotaSnapshot["values"] = {}, limits: QuotaSnapshot["limits"] = {};
  for (const metric of quotaMetrics) {
    const n = value.values[metric.id], limit = value.limits[metric.id];
    if (n !== undefined) {
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER || (!["GB", "MB/s"].includes(metric.unit) && !Number.isSafeInteger(n))) throw new Error(`Consumo inválido: ${metric.label}.`);
      values[metric.id] = n;
    }
    if (limit !== undefined) {
      if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0 || limit > Number.MAX_SAFE_INTEGER || (!["GB", "MB/s"].includes(metric.unit) && !Number.isSafeInteger(limit))) throw new Error(`Limite inválido: ${metric.label}.`);
      limits[metric.id] = limit;
    }
  }
  return { version: 1, projectRef, plan: "pro", cycleStart: value.cycleStart, cycleEnd: value.cycleEnd, readAt: new Date(readAt).toISOString(), values, limits };
}

export function quotaStatus(metric: typeof quotaMetrics[number], snapshot: QuotaSnapshot | null, now = new Date()) {
  const value = snapshot?.values[metric.id];
  const limit = snapshot?.limits[metric.id] ?? metric.limit;
  const today = now.toISOString().slice(0, 10);
  const stale = !!snapshot && now.getTime() - Date.parse(snapshot.readAt) >= 24 * 3600000;
  if (value === undefined) return { value, limit, percent: null, state: "Sem leitura", stale };
  if (!snapshot || today < snapshot.cycleStart || today > snapshot.cycleEnd) return { value, limit, percent: null, state: "Outro ciclo", stale: true };
  const percent = limit === null ? null : value / limit * 100;
  const provisioned = ["disk", "iops", "throughput"].includes(metric.id);
  const state = provisioned && percent !== null && percent > 100 ? "Acima da referência"
    : provisioned && !stale ? "Configuração na referência"
    : provisioned && stale ? "Leitura antiga"
    : percent !== null && percent >= 100 ? "Franquia atingida"
    : percent !== null && percent >= 90 ? "Crítico"
    : percent !== null && percent >= 80 ? "Atenção"
    : stale ? "Leitura antiga"
    : percent === null ? "Sem franquia fixa" : "Dentro da referência";
  return { value, limit, percent, state, stale };
}
