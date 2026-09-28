import { loadConfig } from "../config.js";
import { buildDocument, type OrderRow } from "../documents.js";
import { configureLogger } from "../logger.js";
import { sendBytes } from "../transports/index.js";

const config = loadConfig();
configureLogger("debug");

const loja = {
  nome: "TESTE NOOV",
  documento: "00.000.000/0001-00",
  endereco_rua: "Rua de Teste",
  endereco_numero: "100",
  endereco_bairro: "Centro",
  endereco_cidade: "Sao Paulo",
  endereco_estado: "SP",
};

const order: OrderRow = {
  id: "00000000-0000-0000-0000-000000000000",
  numero_diario: 999,
  created_at: new Date().toISOString(),
  status: "aceito",
  tipo: "balcao",
  total: 42.5,
  taxa_entrega: 0,
  cliente_nome: "CLIENTE DE TESTE",
  cliente_telefone: "11999998888",
  observacoes: "Pagamento: Dinheiro",
  items: [
    { nome: "X-Salada", quantidade: 2, preco: 18.5, observacao: "Sem cebola", adicionais: [{ nome: "Bacon", preco: 3, quantidade: 1 }] },
    { nome: "Refrigerante Lata", quantidade: 1, preco: 5.5 },
  ],
};

let failures = 0;
for (const printer of config.printers) {
  if (!printer.enabled) continue;
  for (const kind of printer.documents) {
    process.stdout.write(`Enviando ${kind} para "${printer.name}" (${printer.transport} ${printer.address})... `);
    try {
      await sendBytes(printer, buildDocument(kind, order, loja, printer), "NOOV teste");
      console.log("ok");
    } catch (err: any) {
      failures++;
      console.log(`FALHOU: ${err?.message || err}`);
    }
  }
}

process.exit(failures ? 1 : 0);
