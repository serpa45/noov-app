# Métricas e logs do Noov

O projeto de produção é `mwnjoglolbyeyrmkqqqc.supabase.co`. A publicação antiga
usava esse banco, mas ainda continha a tela de créditos do Lovable. A tela
de métricas reais estava apenas nas alterações locais e não no GitHub.

A listagem de erros fazia uma consulta à coluna inexistente
`lojas.nome_fantasia`. O contador consultava somente `error_logs`, portanto
mostrava um registro enquanto a lista falhava e exibia um estado vazio.
Agora a consulta usa `lojas.nome` e uma falha de leitura tem estado próprio.

As métricas vêm de `get_system_usage`, com fallback para a função
`system-metrics`. Não há valores fixos de créditos ou desempenho. Os limites
Free exibidos são referências identificadas como tal, não o plano contratado.
A coleta inclui estimativas de linhas do PostgreSQL, identificadas na tela.

A captura começa na entrada do aplicativo e inclui erros globais, rejeições
de promises, falhas de renderização React e erros finais de consultas e
mutações do React Query. O contexto da loja é associado quando disponível.
O logger não compartilha sessões com o editor Lovable, não envia parâmetros
da URL e remove tokens comuns dos detalhes registrados. Falhas de gravação
do próprio logger são informadas no console sem gerar recursão.

Validação em 18/10/2026: a RPC respondeu no banco Noov; a consulta corrigida
leu o registro existente. Um registro de diagnóstico foi inserido com a chave
pública, consultado com a projeção corrigida e removido pelo seu ID. Nenhum
registro histórico foi removido. A RPC já existia, sem necessidade de migração.

Não coloque `SUPABASE_SERVICE_ROLE_KEY` em variáveis `VITE_` nem no frontend.
As chaves administrativas ficam apenas no ambiente do servidor.

A publicação que atende `noov.app.br` é `sbarros82s-projects/noov-app`.
O deploy automático do GitHub também publica em outro projeto; confira o
domínio público depois de cada publicação.
