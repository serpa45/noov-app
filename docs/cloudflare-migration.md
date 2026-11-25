# Migração de hospedagem para Cloudflare

## Destino

- Conta: `serpainfoservice@gmail.com` / `88c3de75d07ceeb5bffad0346b0d232d`.
- Worker: `noov-app`.
- Endereço temporário: `https://noov-app.noov-serpainfo.workers.dev`.
- Domínios finais: `noov.app.br` e `www.noov.app.br` (ainda não configurados nesta etapa).
- Supabase existente: `mwnjoglolbyeyrmkqqqc`; banco, Storage e Edge Functions continuam no Supabase.

O Noov usa Vite 5.4.19. A configuração automática do `cf` exige Vite >= 6 e foi recusada antes de modificar o projeto. A configuração manual usa Wrangler fixado em 4.168.0, sem atualizar o framework durante a migração.

## Aplicação e APIs

`wrangler.jsonc` publica `dist` com fallback de SPA. `/api` e `/api/*` passam pelo Worker antes do fallback. APIs desconhecidas retornam JSON 404.

O Worker adapta os handlers compartilhados existentes:

- `DELETE /api/admin/clear-error-logs`;
- `GET` / `PUT /api/admin/supabase-quota-readings`.

Ambos validam a sessão no Supabase e consultam a permissão de administrador. A configuração é passada por requisição, sem alterar `process.env`. Os adaptadores Vercel continuam funcionando para permitir retorno à hospedagem anterior.

## Variáveis e publicação

Use Node 22 e `npm ci`. Antes do build, configure as variáveis públicas `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_MAPBOX_TOKEN` no ambiente de build ou em arquivo local ignorado. Nunca use prefixo `VITE_` na chave service role.

`SUPABASE_URL` fica na configuração do Worker. `SUPABASE_SERVICE_ROLE_KEY` é um segredo do Worker, enviado por arquivo JSON ignorado com `--secrets-file`, ou cadastrado pelo painel. Não registre seu valor em arquivos versionados, comandos ou logs.

```powershell
npm test
npm run cloudflare:types
npm run build
npm run cloudflare:check
npm run cloudflare:deploy
```

O build de produção existente incrementa a versão do aplicativo no Supabase. O deploy não copia automaticamente as variáveis do painel da Vercel. A configuração de integração Git da Cloudflare também deve receber as quatro variáveis públicas de build; o segredo do Worker permanece separado.

Logs e traces do Worker estão habilitados com amostragem de 10%. Eles não substituem o histórico de erros do aplicativo no Supabase.

## Validação em 25/11/2026

- Worker publicado: versão `74d345ae-9855-43bb-836a-c0c38adb317c`.
- 97 testes existentes passaram; os 6 testes novos do Worker passaram. Os 20 testes de Worker e handlers administrativos também passaram na execução após o ajuste do setup Node.
- Tipos do Worker, build de produção, empacotamento sem upload e consistência do lockfile foram verificados.
- Chrome abriu o login do lojista e o cardápio Alloha, consultando os dados existentes no Supabase, sem exceção JavaScript.
- APIs retornaram 401 sem sessão e com token inválido, 405 para método não permitido e JSON 404 para caminho inexistente.
- A chave service role não aparece nos arquivos públicos nem no bundle baixado do endereço Cloudflare.
- O teste do cardápio encontrou uma imagem ainda apontando ao antigo projeto `oiyuyqkpkcezezusxdmu.supabase.co`, cujo hostname não resolveu. Essa referência não foi alterada pela migração de hospedagem.
- Login autenticado, gravações administrativas, pagamentos e impressão física precisam ser validados com usuários/equipamentos reais; não foram simulados com dados de produção.
- Os servidores DNS atuais continuam `ns1.vercel-dns.com` e `ns2.vercel-dns.com`. A zona Cloudflare e a integração de publicação contínua ainda estão pendentes.

## Troca de domínio

1. Validar o endereço temporário: carregamento da página e das rotas internas, login de lojista e administrador, consulta de pedidos, logs e métricas. Não realizar pagamentos ou apagar dados reais como teste.
2. Cadastrar `noov.app.br` nesta conta Cloudflare. Copiar todos os registros DNS existentes, inclusive MX, TXT, SPF, DKIM, DMARC e subdomínios, antes de trocar os servidores DNS no registrador. Se houver DNSSEC, seguir o procedimento do registrador e da Cloudflare.
3. Aguardar a zona ficar ativa. Adicionar `noov.app.br` e `www.noov.app.br` como Custom Domains do Worker e testar HTTPS, rotas e APIs nos dois endereços.
4. Verificar login, pedido e impressão no equipamento real. Uma origem temporária tem sessão e permissões de navegador próprias; a origem final permanece a mesma.
5. Configurar a publicação contínua da branch `main` na Cloudflare. Só desativar a publicação Vercel depois da validação do domínio final.

Não apontar CNAME diretamente para `workers.dev`. Usar Custom Domains do Worker em uma zona ativa. Guardar a configuração anterior e manter a Vercel disponível durante a transição para retorno rápido.

## Referências

- https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/workers/configuration/secrets/
