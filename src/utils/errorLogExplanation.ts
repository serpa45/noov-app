type LogDetails = { message?: string | null; url?: string | null; metadata?: Record<string, unknown> | null };

export function explainErrorLog(log: LogDetails) {
  const source = String(log.metadata?.source ?? "").toLowerCase();
  const type = String(log.metadata?.type ?? "").toLowerCase();
  const message = String(log.message ?? "").toLowerCase();
  const path = (log.url ?? "").split(/[?#]/)[0];
  const printing = /print|bluetooth/.test(source + " " + type) || path === "noov-print-agent";
  const area = printing ? "Impressão de pedidos"
    : source === "cart-upsell" ? "Sugestões de produtos no carrinho"
    : source === "order-history-deliveries" ? "Entregas no histórico de pedidos"
    : source === "order-history" || path.endsWith("/pedidos/historico") ? "Histórico de pedidos"
    : /system-metrics/.test(source) || path.endsWith("/metricas") ? "Métricas do sistema"
    : /admin-error-logs/.test(source) ? "Histórico de erros"
    : path.endsWith("/produtos") ? "Produtos"
    : path.endsWith("/clientes") ? "Clientes"
    : path.endsWith("/pedidos") ? "Pedidos"
    : path.endsWith("/financeiro") ? "Financeiro"
    : path.endsWith("/plano") ? "Plano e assinatura"
    : type === "query_error" ? "Consulta de informações"
    : type === "mutation_error" ? "Atualização de informações"
    : "Funcionamento do aplicativo";

  if (printing) return {
    area,
    explanation: "O sistema registrou uma falha relacionada à impressão. Este registro, sozinho, não confirma se o cupom saiu nem identifica um defeito na impressora.",
    nextStep: "Confira a conexão e se o cupom já saiu antes de tentar imprimir novamente.",
  };
  if (/jwt expired|token.*expired|session.*expired|sessão expirada|sessao expirada|invalid.*jwt/.test(message)) return {
    area,
    explanation: "O sistema não conseguiu validar o acesso desta sessão. Pode ser necessário entrar na conta novamente.",
    nextStep: "Entre novamente e confira se a operação foi concluída antes de repeti-la.",
  };
  if (/permission denied|row.level security|not authorized|unauthorized|forbidden|acesso negado/.test(message)) return {
    area,
    explanation: "O sistema recusou o acesso a uma informação ou operação. A conta pode estar sem a permissão necessária.",
    nextStep: "Confira a conta utilizada e informe este registro ao suporte se o acesso deveria ser permitido.",
  };
  if (/load failed|failed to fetch|networkerror|network request failed|fetch failed|timeout|timed out|tempo esgotado/.test(message)) return {
    area,
    explanation: type === "query_error"
      ? "Não foi possível carregar essas informações. Pode ter ocorrido uma interrupção da conexão ou uma indisponibilidade temporária. O registro não identifica a causa exata."
      : "A comunicação foi interrompida ou demorou demais. O registro não confirma se a operação foi concluída.",
    nextStep: type === "query_error"
      ? "Confira a conexão e atualize a página. Se continuar, informe o horário ao suporte."
      : "Confira se a alteração já foi aplicada antes de tentar novamente.",
  };
  if (/column .*does not exist|relation .*does not exist|schema cache|could not find.*column/.test(message)) return {
    area,
    explanation: "O aplicativo tentou acessar uma informação que o banco não encontrou. Pode haver uma diferença entre a versão do aplicativo e a estrutura do banco.",
    nextStep: "Encaminhe os detalhes técnicos ao suporte para verificar essa diferença.",
  };
  if (/is not a constructor|is not a function|cannot read propert|undefined is not|null is not/.test(message) || type === "react_error") return {
    area,
    explanation: "Uma parte do aplicativo encontrou uma falha interna ao executar esta função. É necessária uma análise do código para identificar a causa.",
    nextStep: "Atualize a página. Se o erro voltar, informe ao suporte o que estava fazendo e o horário.",
  };
  return {
    area,
    explanation: "O sistema registrou uma falha nesta área, mas os detalhes disponíveis não permitem explicar a causa com segurança.",
    nextStep: "Informe ao suporte o horário, a tela e a ação que estava realizando, junto com os detalhes técnicos.",
  };
}
