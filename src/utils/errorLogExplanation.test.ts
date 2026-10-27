import { describe, expect, it } from "vitest";
import { explainErrorLog } from "./errorLogExplanation";

describe("plain-language error details", () => {
  it("explains the recorded history loading error without claiming an exact cause", () => {
    const result = explainErrorLog({ message: "TypeError: Load failed", metadata: { type: "query_error", source: "order-history" } });
    expect(result.area).toBe("Histórico de pedidos");
    expect(result.explanation).toContain("carregar");
    expect(result.explanation).toContain("não identifica a causa exata");
    expect(result.nextStep).toContain("atualize a página");
  });
  it("does not tell users to blindly repeat a write after a network failure", () => {
    const result = explainErrorLog({ message: "Failed to fetch", metadata: { type: "mutation_error" } });
    expect(result.explanation).toContain("não confirma se a operação foi concluída");
    expect(result.nextStep).toContain("já foi aplicada");
  });
  it("tells users to inspect paper before retrying an uncertain print", () => {
    const result = explainErrorLog({ message: "timeout", metadata: { type: "print_agent_error" } });
    expect(result.area).toBe("Impressão de pedidos");
    expect(result.explanation).toContain("não confirma se o cupom saiu");
    expect(result.nextStep).toContain("cupom já saiu");
  });
  it("identifies the affected cart feature without guessing a minified symbol's meaning", () => {
    const result = explainErrorLog({ message: "d6e is not a constructor", metadata: { type: "query_error", source: "cart-upsell" } });
    expect(result.area).toBe("Sugestões de produtos no carrinho");
    expect(result.explanation).toContain("falha interna");
    expect(result.explanation).not.toContain("Map");
  });
  it("distinguishes access restrictions, expired access and database differences", () => {
    expect(explainErrorLog({ message: "permission denied for table pedidos" }).explanation).toContain("permissão");
    expect(explainErrorLog({ message: "JWT expired" }).nextStep).toContain("Entre novamente");
    expect(explainErrorLog({ message: 'column lojas.nome_fantasia does not exist' }).explanation).toContain("banco não encontrou");
  });
  it("uses the route when old logs lack source metadata", () => {
    expect(explainErrorLog({ message: "Script error.", url: "https://noov.app.br/lojista/pedidos/historico?x=1#section" }).area).toBe("Histórico de pedidos");
  });
  it("makes insufficient evidence explicit and does not echo arbitrary error content", () => {
    const result = explainErrorLog({ message: "Unrecognized customer data", metadata: null });
    expect(result.explanation).toContain("não permitem explicar a causa com segurança");
    expect(JSON.stringify(result)).not.toContain("customer data");
    expect(explainErrorLog({})).toEqual(expect.objectContaining({ area: "Funcionamento do aplicativo" }));
  });
});
