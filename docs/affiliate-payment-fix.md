# Publicação da correção de afiliados e pagamentos

O push para o GitHub não atualiza o banco ou as Edge Functions do Supabase.

1. Aplique `supabase/migrations/20261010120000_fix_affiliate_payment_processing.sql`
   no projeto correto, antes de publicar as funções. A migração adiciona o
   processamento transacional e a validação de saldo para novos saques.
2. Publique as funções com o CLI autenticado nesse projeto:

   ```sh
   supabase functions deploy mercadopago-payment-status
   supabase functions deploy mercadopago-webhook --no-verify-jwt
   ```

3. Publique o frontend pelo fluxo habitual do projeto.
4. Confirme um pagamento de teste: um plano ativo, uma fatura e uma comissão.
   Consultas e notificações repetidas do mesmo pagamento não devem renovar o
   plano ou gerar outra comissão. Compras distintas têm processamento próprio.

As duas funções usam o secret `MERCADOPAGO_ACCESS_TOKEN` e, na ausência dele,
o token de `configuracoes_globais`, como já faz a criação da cobrança.

Pagamentos históricos já registrados não são creditados novamente. Esta
migração não reconcilia automaticamente faturas/comissões antigas incompletas
ou pagamentos que nunca foram notificados. Para o caso relatado, confira o ID
do pagamento no Mercado Pago, o vínculo `lojas.afiliado_id` e os registros do
banco antes de qualquer regularização manual.

O comando de build existente incrementa a versão do aplicativo no Supabase;
leve esse efeito em conta ao executar builds de validação.

## Verificação local

`npm test -- --run` verifica o cálculo em centavos. `deno check` nas duas
funções verifica os tipos. O teste transacional isolado está em
`supabase/tests/plan-payment.test.mjs`; ele cria um banco PGlite em memória,
sem acessar o Supabase. Instale `@electric-sql/pglite` em uma pasta temporária
e defina `PGLITE_MODULE` com o caminho absoluto de `dist/index.js` desse pacote
antes de executar `node supabase/tests/plan-payment.test.mjs`.

## Correção da entrada de centavos e pendências (15/10/2026)

O campo de saque usa entrada textual com teclado decimal e aceita `26,22`
ou `26.22`, sem depender da interpretação de vírgulas pelo navegador.

Os totais pagos e a pagar passam a usar os registros de `saques` em todas
as telas. Uma comissão é um ganho registrado; seu antigo campo `status`
não comprova pagamento de um saque. As telas de comissões exibem os ganhos
registrados e a confirmação de pagamento fica em `/admin/saques`.
Isso também permite contabilizar corretamente saques parciais, sem atribuir
um saque a uma loja ou comissão específica sem vínculo no banco.

A confirmação exige que exatamente um saque ainda pendente seja atualizado.
As telas de saques consultam novamente os dados a cada 15 segundos enquanto
abertas, além das atualizações em tempo real existentes.

Esta atualização é apenas do frontend e não exige nova migração ou publicação
de Edge Functions. Não altera valores, aprova solicitações pendentes nem
regulariza pagamentos históricos automaticamente. Caso um pagamento tenha
sido marcado somente em `comissoes`, confira o comprovante antes de confirmar
o saque correspondente em `/admin/saques`.
