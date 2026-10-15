import { describe, expect, it } from "vitest";
import { affiliateBalance, toCents, parseWithdrawalAmount, affiliateTotals, unpaidAffiliateCommissions } from "./affiliateBalance";

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
  it.each(["26,22", "26.22", " 26,22 "])("accepts cents entered as %s", (input) => {
    expect(parseWithdrawalAmount(input)).toBe(26.22);
  });
  it.each(["", "0", "0,00", "-1", "26,222", "26.222", "1e3", "NaN", "1.000,00"])("rejects invalid amount %s", (input) => {
    expect(parseWithdrawalAmount(input)).toBeNull();
  });
  it("accepts a withdrawal of only one cent", () => {
    expect(parseWithdrawalAmount("0,01")).toBe(0.01);
  });
  it("clears the payment pending total while preserving the balance when a withdrawal is paid", () => {
    const commissions = [{ valor_comissao: 26.22 }];
    expect(affiliateTotals(commissions, [{ valor: 26.22, status: "pendente" }]))
      .toMatchObject({ pending: 26.22, paid: 0, available: 0, unpaid: 26.22 });
    expect(affiliateTotals(commissions, [{ valor: 26.22, status: "pago" }]))
      .toMatchObject({ pending: 0, paid: 26.22, available: 0, unpaid: 0 });
  });
  it("leaves only the unpaid remainder after a partial withdrawal", () => {
    expect(affiliateTotals([{ valor_comissao: 26.22 }], [{ valor: 26, status: "pago" }]))
      .toMatchObject({ unpaid: 0.22, available: 0.22, pending: 0 });
  });
  it("does not offset one affiliate's unpaid commissions with another's overpayment", () => {
    expect(unpaidAffiliateCommissions([
      { afiliado_id: "a", valor_comissao: 26.22 },
      { afiliado_id: "b", valor_comissao: 10 },
    ], [{ afiliado_id: "a", valor: 30, status: "pago" }])).toBe(10);
  });
});
