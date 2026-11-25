# Imagens do Supabase para R2

## Preparacao inicial em 25/11/2026 (historico)

A Cloudflare respondeu `10042: Please enable R2 through the Cloudflare Dashboard`. O proprietário precisa ativar R2 na conta `serpainfoservice@gmail.com` (`88c3de75d07ceeb5bffad0346b0d232d`). Nenhum bucket remoto foi criado e nenhuma URL foi trocada nesta etapa.

O armazenamento de produção continua no Supabase. `VITE_MEDIA_STORAGE` precisa ser explicitamente `r2` para o navegador usar o novo envio; `R2_MEDIA_ENABLED` permanece `false` no Worker principal, sem binding R2. O ambiente Wrangler `r2` prepara um Worker separado, `noov-app-r2-preview`, com bucket `noov-images`.

### Correção do levantamento

O inventário inicial encontrou 492 registros e HEAD retornou 200 para todos. O download completo demonstrou que a consulta de cabeçalhos não era suficiente:

- **155 imagens foram baixadas e verificadas: 82.441.363 bytes (82,44 MB).**
- **337 registros retornaram `NoSuchKey` ao ler o conteúdo**, reconfirmado por GET; três amostras também falharam com credencial de servidor.
- Os 28 endereços antigos possuem metadados no projeto atual, mas **nenhum dos 28 arquivos foi recuperado**. Corrigir só o hostname não resolve.
- As 98 URLs atuais do Supabase encontradas em uso e que responderam 200 possuem cópias locais completas. Outro avatar citado no banco não consta no inventário e também não abre.

O backup e os relatórios não são versionados:

```text
D:/noov-releases/media-migration-20261125/backup-manifest.json
D:/noov-releases/media-migration-20261125/supabase-originals/
D:/noov-releases/media-migration-20261125/r2-url-plan.json
D:/noov-releases/audits/images-20261125/levantamento.txt
D:/noov-releases/audits/images-20261125/pendencias-sem-arquivo.csv
```

O plano atual seleciona os 155 arquivos efetivamente verificados e 100 campos de imagem no banco. Arquivos ausentes e imagens externas não entram na troca. Não excluir arquivos nem metadados antigos: podem ajudar na recuperação.

## Implementação

- `src/utils/imageStorage.ts` centraliza os envios das telas de produtos, pizzas, categorias, logos, banners, perfil, afiliados e fotos de clientes. Com R2 desligado, preserva o upload Supabase. Com R2 ligado, gera um caminho único por envio e usa a URL devolvida pelo servidor.
- O cadastro de afiliado passa a usar uma pasta do próprio usuário para o avatar, compatível com as políticas existentes de logos; falhas de envio não geram falsa confirmação de arquivo salvo.
- `worker/media.ts` publica somente sete namespaces de imagem em `/media/{bucket}/{path}`. Não publica instaladores, métricas privadas, executáveis ou listagem de arquivos.
- `PUT /api/media/{bucket}/{path}` usa a sessão real e a autorização por caminho do Supabase Storage (`createSignedUploadUrl`). O ticket é descartado, sem upload Supabase e sem usar service role nessa validação. A política anônima existente de fotos de clientes continua sendo consultada.
- Novos arquivos são validados pela assinatura do conteúdo, limitados a 5 MiB e gravados com condição de inexistência. Uma troca de imagem não sobrescreve a imagem guardada em pedidos antigos.
- Respostas de imagem têm MIME, ETag, `nosniff`, CSP com sandbox e CORS de leitura para o uso em canvas/PDF. Fotos pessoais não entram em cache compartilhado. Catálogo pode usar Cache API em domínio próprio; `workers.dev` não oferece esse cache.
- O endpoint interno aceita apenas a credencial de servidor, comparada criptograficamente, e rejeita origem de navegador. Ele atende aos dois geradores de imagens em Edge Functions. Nenhuma credencial interna vai para o frontend.
- As funções `generate-banner` e `generate-category-image` só usam R2 quando `MEDIA_STORAGE=r2`; caso contrário mantêm o armazenamento anterior. O gerador de banners também rejeita a ausência de autenticação antes de gerar imagens.
- `scripts/r2-migration.py` copia apenas os arquivos com hash confirmado, baixa novamente cada destino, produz o plano e aplica substituições condicionais com diário de retorno. Não executa SQL nem altera schema/RLS.

## Ativação, depois da liberação do proprietário

Os comandos abaixo são para execução no checkout preparado, com Node 22, Python 3.11+ e `npm ci`. As credenciais devem estar em arquivos ignorados ou no ambiente, nunca em argumentos ou no Git.

### 1. Criar bucket e publicar o ambiente separado

Confirmar a conta com `npx wrangler whoami`. A conta esperada termina em `232d`.

```powershell
npx wrangler r2 bucket create noov-images
npm run cloudflare:types
npm run cloudflare:typecheck
npm run build:r2-preview
npm run cloudflare:r2:check
npx wrangler deploy --env r2 --secrets-file .dev.vars.r2
```

O build `r2-preview` requer `VITE_MEDIA_STORAGE=r2` em `.env.r2-preview.local`, além das variáveis públicas Supabase e Mapbox de `.env.local`. O arquivo local `.dev.vars.r2` deve conter `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` para envio como segredos do Worker. Ambos foram preparados localmente neste checkout, sem versionamento. Builds de preview não incrementam a versão do aplicativo no banco.

O bucket deve continuar privado e ser acessado pelo binding. Não habilitar publicação do bucket inteiro nem apontar CNAME para `workers.dev`.

### 2. Copiar e verificar o conteúdo

```powershell
python scripts/r2-migration.py --phase copy --work-dir D:/noov-releases/media-migration-20261125
```

O comando verifica os arquivos locais antes de qualquer envio, preserva `bucket/caminho` dentro de `noov-images` e compara SHA-256 do conteúdo completo baixado pelo Worker. Um arquivo já existente só é aceito se o hash for igual; divergências interrompem a cópia. O diário `r2-copy-verified.json` permite conferir o progresso. Não há exclusão de arquivos Supabase.

### 3. Preparar o Worker principal

Só depois de concluir a cópia:

```powershell
python scripts/r2-migration.py --phase prepare-cutover --work-dir D:/noov-releases/media-migration-20261125
npm run cloudflare:types
npm run cloudflare:typecheck
npm run build
npm run cloudflare:check
npx wrangler deploy --secrets-file .dev.vars.r2
```

`prepare-cutover` recusa diários incompletos. Quando válido, prepara localmente o binding `R2_IMAGES`, liga o recurso no Worker principal e define `VITE_MEDIA_STORAGE=r2` em `.env.local`. Isso ainda não publica nem grava dados remotos. As mudanças em `wrangler.jsonc` precisam ser versionadas depois da ativação para os próximos deploys manterem o binding. Configurar também `VITE_MEDIA_STORAGE=r2` no ambiente da integração de builds que vier a ser usada.

Validar o domínio `noov.app.br` no Worker antes de seguir. Se o DNS ainda não foi trocado, manter somente o ambiente de preview, sem aplicar URLs do domínio principal.

### 4. Atualizar os endereços

Regenerar o plano a partir dos valores atuais, preservando o relatório anterior fora do Git se necessário:

```powershell
python scripts/r2-migration.py --phase plan --work-dir D:/noov-releases/media-migration-20261125 --references D:/noov-releases/audits/images-20261125/referencias.csv --env-file D:/noov/.env
python scripts/r2-migration.py --phase apply --work-dir D:/noov-releases/media-migration-20261125 --env-file D:/noov/.env
```

`plan` é somente leitura e é o modo padrão. `apply` baixa e verifica os destinos no domínio final antes da primeira alteração no banco. Cada PATCH confere o valor anterior exato; edições concorrentes interrompem a operação. O diário registra as alterações confirmadas. URLs de arquivos ausentes ficam intactas. A aplicação de vários campos não é uma transação única: em interrupção, consultar o diário antes de prosseguir ou retornar.

### 5. Geradores de imagens e validação final

Publicar as duas Edge Functions preparadas e definir nelas `MEDIA_STORAGE=r2` e `MEDIA_API_ORIGIN=https://noov.app.br`, usando o acesso de gerenciamento ao projeto Supabase correto. Isso ainda não foi executado e depende de acesso de deploy do projeto.

Testar com usuários reais: cadastro e troca de produto, logo, banner, categoria, foto do cliente, avatar de afiliado e material gerado. Validar cardápio, pedidos antigos, impressão/PDF e remoção de referência de banner. Não excluir dados de produção como teste. Instaladores continuam fora do R2 de imagens.

## Retorno

```powershell
python scripts/r2-migration.py --phase rollback --work-dir D:/noov-releases/media-migration-20261125 --env-file D:/noov/.env
```

O retorno só reverte campos registrados no diário e ainda iguais ao valor aplicado; não sobrescreve alterações posteriores. Para parar novos uploads R2, voltar o build a `VITE_MEDIA_STORAGE=supabase` e as Edge Functions a `MEDIA_STORAGE=supabase`. **Manter a rota de leitura R2 disponível** enquanto houver URLs R2, inclusive de novos arquivos enviados após a troca. O script não apaga objetos R2 nem Supabase.

## Validação realizada

- 130 testes Vitest passaram e 11 testes Python do plano/retorno passaram.
- Worker passou no typecheck estrito; build do preview e empacotamento Wrangler sem upload passaram.
- No emulador R2 local: upload interno 201, download com bytes/hash iguais, HEAD 200, condicional 304, sobrescrita 409, envio anônimo 401 e arquivo executável 415.
- Os filtros de comparação de valores escalares e JSON foram conferidos com GET no Supabase, sem PATCH real.
- Bridge das Edge Functions tem testes de destino, credencial e falha, além de conferência de sintaxe. As funções não foram publicadas nem chamadas para gerar imagens reais.
- Typecheck geral do aplicativo ainda apresenta os seis erros anteriores de `Dashboard.tsx` (PostgREST builder tratado como Promise); nenhum erro novo permaneceu no recorte modificado.
- A validação remota do R2, a troca de URLs e o uso autenticado com usuários reais ficam para depois da ativação e do deploy.

As métricas atuais do painel continuam sendo do Supabase; não representam automaticamente as cobranças R2/Workers. Usar o painel Cloudflare para acompanhar o consumo desses serviços durante a transição.

## Referências

- https://developers.cloudflare.com/r2/get-started/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/r2/examples/cache-api/
- https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl

## Producao ativada em 25/11/2026

R2 foi ativado na conta correta. O bucket privado Standard `noov-images` recebeu 155 arquivos, totalizando 82.441.363 bytes, todos baixados novamente e conferidos por SHA-256. Os arquivos originais no Supabase foram preservados.

Worker principal publicado com `R2_MEDIA_ENABLED=true` e binding `R2_IMAGES`. Versao Cloudflare: `f4d862d3-c44c-4509-9b57-a8979838c374`; frontend v8.5. `noov.app.br` e `www.noov.app.br` usam dominios personalizados do Worker. O preview tem `routes: []` e nao assume esses dominios.

O build passa a usar R2 por padrao quando `VITE_MEDIA_STORAGE` nao estiver definido. Para retorno de novos uploads, definir explicitamente `VITE_MEDIA_STORAGE=supabase`, preservando o binding e a leitura dos arquivos R2.

Um envio pela API publica de foto de cliente foi autorizado pelas politicas atuais do Supabase e retornou 201; a leitura devolveu os mesmos bytes. Somente esse arquivo temporario foi removido apos o teste.

Geradores `generate-banner` e `generate-category-image`: publicados na versao 7 apos liberar acesso de gerenciamento ao projeto. Ambos estao ACTIVE, com verify_jwt=true e o bridge R2 presente no pacote remoto. `MEDIA_STORAGE=r2` e `MEDIA_API_ORIGIN=https://noov.app.br` foram configurados e os hashes remotos conferidos. OPTIONS respondeu 200 e POST sem autenticacao respondeu 401 nas duas funcoes. O logo usado nos banners agora aponta para o arquivo publico do site Noov, conferido com HTTP 200 e image/png. Os tres testes existentes do bridge passaram. Fontes e metadados anteriores foram preservados fora do Git em `D:/noov-releases/media-migration-20261125/edge-functions-before-r2/`.

Pendencia de IA: as duas funcoes ainda dependem de `LOVABLE_API_KEY`, ausente nos segredos do projeto. A integracao de armazenamento esta publicada, mas nao houve chamada real ao provedor de IA nem validacao de geracao completa. Para gerar imagens, configurar uma chave valida desse provedor ou adaptar as funcoes para outro provedor.
## Resultado da troca de URLs

Foram atualizados e relidos com sucesso 100 campos: produtos 82, imagens de categorias 7, lojas 4, materiais de afiliado 4 e perfis 3. O plano foi regenerado com as referencias atuais imediatamente antes da aplicacao. Diario de retorno: `D:/noov-releases/media-migration-20261125/r2-url-journal.json`; plano aplicado: `r2-url-plan.json` na mesma pasta. Preservar ambos para eventual retorno.

As 337 entradas sem arquivo e um avatar sem objeto continuam pendentes de recuperacao. URLs externas e de arquivos ausentes nao foram substituidas. Banco de dados, login e pagamentos permanecem no Supabase.

Conferencia no navegador do cardapio Alloha: 143 elementos de imagem, 141 carregados; os 135 elementos que usavam R2 carregaram, sem erros JavaScript nessa navegacao. Duas imagens fora do R2 permaneceram sem carregar.
