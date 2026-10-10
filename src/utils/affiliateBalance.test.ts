import { describe, expect, it } from "vitest";
import { affiliateBalance, toCents } from "./affiliateBalance";

describe("affiliate withdrawal balance", () => {
  it("allows withdrawing the entire displayed balance after decimal arithmetic", () => {
    const balance = affiliateBalance([{ valor_comissao: 26.22 }, { valor_comissao: 0.1 }], [{ valor: 0.1, status: "pago" }]);
    expect(balance).toBe(26.22);
    expect(toCents(26.22) > toCents(balance)).toBe(false);
  });
  it("reserves pending withdrawals and ignores rejected ones", () => {
    expect(affiliateBalance([{ valor_comissao: "50.00" }], [
      { valor: "10.00", status: "pago" },
      { valor: "14.00", status: "pendente" },
      { valor: "26.00", status: "rejeitado" },
    ])).toBe(26);
  });
  it("does not display a negative available balance", () => {
    expect(affiliateBalance([], [{ valor: 26, status: "pendente" }])).toBe(0);
  });
});
