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
