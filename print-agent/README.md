# NOOV Print Agent

Serviço local que imprime automaticamente os pedidos do NOOV assim que eles são
aceitos — uma via no balcão e outra na cozinha, sem clique e sem janela de
permissão.

Substitui o QZ Tray. Não usa certificado digital, não usa assinatura, não
depende do navegador estar aberto e não mostra pop-up nenhum: quem conversa com
a impressora é este serviço, rodando direto no Windows.

## Como funciona

1. O agente faz login no NOOV com o e-mail e a senha do lojista.
2. Fica ouvindo a tabela de pedidos em tempo real (Supabase Realtime).
3. Quando um pedido entra no status configurado (`aceito`, por padrão), ele monta
   o cupom em ESC/POS — exatamente o mesmo layout que o app já gera — e envia os
   bytes crus para cada impressora cadastrada.
4. A cada 20 segundos faz também uma varredura de segurança, caso a conexão de
   tempo real caia sem avisar. Nada é impresso duas vezes: cada combinação de
   pedido + impressora + documento é registrada em `state/printed.json`.

## Formas de conexão suportadas

| `transport` | Serve para | `address` |
|---|---|---|
| `spooler` | Qualquer impressora instalada no Windows, inclusive USB (ex.: EPSON TM-T20) | Nome exato da impressora |
| `network` | Impressora Ethernet ou Wi-Fi com porta RAW/JetDirect | IP da impressora (porta 9100) |
| `serial` | Impressora em porta COM e impressora Bluetooth pareada no Windows | `COM3`, `/dev/ttyUSB0` |

No Windows, o `spooler` envia dados RAW pela API `winspool.drv` — o mesmo
caminho que o QZ Tray usava, porém a partir de um processo local.

Impressora Bluetooth: pareie no Windows normalmente; ele cria uma porta COM de
saída ("Standard Serial over Bluetooth link"). Use essa porta com
`transport: "serial"`. Para tablets na cozinha, o app já tem Bluetooth via
navegador e continua funcionando em paralelo.

## Instalação no PC da loja

Requer [Node.js 18 ou superior](https://nodejs.org).

```bash
cd print-agent
npm install
npm run build
```

Descubra o nome exato das impressoras:

```bash
npm run printers
```

Crie a configuração:

```bash
copy config.example.json config.json
```

Edite o `config.json` com as credenciais do lojista e as impressoras. Faça um
teste sem depender de pedido real:

```bash
npm run test-print
```

Saindo papel nas duas impressoras, instale como serviço do Windows (abra o
PowerShell **como administrador**):

```bash
npm run service:install
```

Pronto: o serviço sobe junto com o Windows e se reinicia sozinho se cair. Para
remover, `npm run service:uninstall`.

Para rodar em primeiro plano durante testes: `npm start`.

## Configuração

```jsonc
{
  "supabase": {
    "url": "https://mwnjoglolbyeyrmkqqqc.supabase.co",
    "anonKey": "chave publica anon",
    "email": "lojista@exemplo.com.br",
    "password": "senha do lojista"
  },
  "triggerStatus": ["aceito"],   // status que dispara a impressao
  "printPdvKitchen": true,        // imprime comandas de mesa/garcom na cozinha
  "printBacklogOnStart": false,   // true = imprime o que ja estava aceito ao subir
  "pollIntervalMs": 20000,
  "logLevel": "info",
  "retry": { "maxAttempts": 5, "delayMs": 4000 },
  "printers": [
    {
      "name": "Balcao",
      "transport": "spooler",
      "address": "EPSON TM-T20 Receipt",
      "documents": ["receipt"],
      "copies": 1,
      "paperWidth": 58
    },
    {
      "name": "Cozinha",
      "transport": "network",
      "address": "192.168.0.50",
      "port": 9100,
      "documents": ["kitchen"],
      "paperWidth": 80
    }
  ]
}
```

`documents` aceita `receipt` (cupom completo do cliente) e `kitchen` (comanda
enxuta da cozinha). Uma mesma impressora pode receber os dois, e `copies`
controla quantas vias saem.

O agente usa as credenciais normais do lojista e respeita as regras de acesso do
banco: ele só enxerga os pedidos da própria loja. Não use chave de serviço aqui.

## Desligue o QZ Tray

Com o agente rodando, entre em **Configurações → Impressora** no painel e
desative a impressão automática via QZ. Senão o navegador vai continuar
tentando imprimir em paralelo e mostrando a janela de permissão.

## Diagnóstico

Os logs ficam em `logs/agent-AAAA-MM-DD.log`.

| Sintoma | O que verificar |
|---|---|
| "Nao foi possivel abrir a impressora" | O nome em `address` precisa ser idêntico ao de `npm run printers` |
| Nada imprime, sem erro no log | Confira se `triggerStatus` bate com o status usado na loja |
| Tempo esgotado em impressora de rede | IP correto e porta 9100 liberada no firewall |
| "Transporte serial indisponivel" | `npm install serialport` dentro de `print-agent` |
| Reiniciou e reimprimiu tudo | Mantenha `printBacklogOnStart` em `false` |

## Desenvolvimento

O layout dos cupons **não** vive aqui: o agente importa `buildReceiptBytes` e
`buildKitchenBytes` de `src/utils/thermalPrint.ts`, o mesmo arquivo usado pelo
app. Ajuste o cupom lá e rode `npm run build` para o agente acompanhar.
