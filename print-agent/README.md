# NOOV Print Agent

Programa que o lojista instala no PC da loja para os pedidos saírem sozinhos na
impressora assim que são aceitos — cupom no balcão e comanda na cozinha, sem
clique e sem janela de permissão.

Substitui o QZ Tray. Sem certificado digital, sem assinatura, sem pop-up e sem
depender do navegador estar aberto: quem conversa com a impressora é este
programa, rodando direto no Windows.

## Instalação para o lojista

1. Baixar o `noov-print-agent.exe` e dar dois cliques. Não precisa instalar
   Node.js nem nada além disso.
2. A tela de configuração abre sozinha no navegador.
3. Entrar com o **mesmo e-mail e senha do painel do NOOV**.
4. Escolher a impressora do balcão e a da cozinha nas listas (elas são
   detectadas automaticamente) e clicar em **Imprimir teste**.
5. Clicar em **Salvar e ativar impressão automática**.

Pronto. O agente passa a subir junto com o Windows e imprime sozinho. Para
mexer na configuração depois, é só abrir o programa de novo (ou acessar
<http://localhost:7777>) — o segundo clique não abre outra cópia, apenas mostra
a tela do agente que já está rodando.

Depois de ativar, o lojista deve **desligar a impressão via QZ** em
Configurações → Impressora no painel, senão o navegador continua tentando
imprimir em paralelo.

### Quantas máquinas precisam do agente

Uma por loja — a que fica ligada no expediente e tem as impressoras. Como quem
imprime é o agente e não o navegador, o pedido sai na impressora mesmo quando é
aceito pelo celular, pelo tablet ou por outro computador. A única exceção é
quando a impressora da cozinha é USB presa em um segundo PC; aí são dois
agentes.

## Como funciona por dentro

1. Faz login no NOOV com as credenciais do lojista (chave pública `anon`, nunca
   chave de serviço) e enxerga apenas os pedidos da própria loja.
2. Escuta a tabela de pedidos em tempo real via Supabase Realtime.
3. Quando o pedido entra no status configurado (`aceito`, por padrão), monta o
   cupom em ESC/POS e envia os bytes crus para cada impressora.
4. A cada 20 segundos faz uma varredura de segurança, caso a conexão de tempo
   real caia sem avisar. Nada imprime duas vezes: cada combinação de pedido +
   impressora + documento fica registrada em `state/printed.json`.

## Formas de conexão suportadas

| Tipo na tela | `transport` | Endereço |
|---|---|---|
| USB / instalada no Windows | `spooler` | Nome exato da impressora |
| Rede (cabo ou Wi-Fi) | `network` | IP da impressora, porta 9100 |
| Porta COM / Bluetooth | `serial` | `COM3` |

No Windows o `spooler` envia dados RAW pela API `winspool.drv` — o mesmo caminho
que o QZ Tray usava, porém a partir de um processo local. O transporte serial
abre a porta como arquivo (`\\.\COM3`) depois de configurá-la com `mode`, sem
módulo nativo. Impressora Bluetooth: pareie no Windows normalmente, que ele cria
uma porta COM de saída — use essa porta.

## Onde ficam os arquivos

No executável distribuído, tudo vive em
`%APPDATA%\NOOV Print Agent\`:

| Arquivo | Conteúdo |
|---|---|
| `config.json` | Credenciais e impressoras da loja |
| `logs\agent-AAAA-MM-DD.log` | Registro diário de atividade |
| `state\printed.json` | Controle do que já foi impresso |
| `iniciar-oculto.vbs` | Lançador silencioso usado na inicialização |

A inicialização automática é registrada em
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, que não exige permissão de
administrador.

Como a configuração fica fora da pasta do executável, atualizar o agente não
apaga nada.

## Atualização automática

O agente consulta um manifesto a cada 6 horas e baixa a versão nova em segundo
plano. A troca só acontece no arranque seguinte, para nunca reiniciar no meio do
expediente e perder um pedido.

Manifesto em
`https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/installers/print-agent/latest.json`:

```json
{
  "version": "1.1.0",
  "url": "https://.../installers/print-agent/noov-print-agent-1.1.0.exe",
  "notes": "O que mudou"
}
```

Para publicar uma versão: suba o `version` no `package.json`, rode
`npm run package`, envie o `.exe` para o bucket `installers` em
`print-agent/` e atualize o `latest.json` apontando para ele.

## Desenvolvimento

```bash
npm install
npm run dev          # roda com tsx, usa a pasta do projeto como base
npm run build        # gera dist/agent.cjs
npm run package      # gera release/noov-print-agent.exe
npm run printers     # lista impressoras e portas detectadas
npm run test-print   # imprime um cupom de teste usando config.json
npm run typecheck
```

Em desenvolvimento o `config.json`, os logs e o estado ficam na própria pasta
`print-agent/`. Use `config.example.json` como ponto de partida — `url` e
`anonKey` do Supabase já vêm embutidos e podem ser omitidos.

O layout dos cupons **não** vive aqui: o agente importa `buildReceiptBytes` e
`buildKitchenBytes` de `src/utils/thermalPrint.ts`, o mesmo arquivo usado pelo
app. Ajuste o cupom lá e rode `npm run package` para o agente acompanhar.

## Diagnóstico

O registro de atividade aparece na própria tela de configuração e também em
`logs\`.

| Sintoma | O que verificar |
|---|---|
| "Nao foi possivel abrir a impressora" | O nome precisa ser idêntico ao detectado; reabra a tela e escolha na lista |
| Nada imprime, sem erro no log | Confira em qual status a loja dispara a impressão |
| Tempo esgotado em impressora de rede | IP correto e porta 9100 liberada no firewall |
| Reiniciou e reimprimiu tudo | Mantenha `printBacklogOnStart` em `false` |
| A tela não abre | Abra <http://localhost:7777> no navegador |
