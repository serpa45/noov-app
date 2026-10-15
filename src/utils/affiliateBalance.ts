export const toCents = (value: number | string) => Math.round(Number(value) * 100);

export function parseWithdrawalAmount(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ""] = value.split(/[,.]/);
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents / 100 : null;
}

type Commission = { valor_comissao: number | string };
type Withdrawal = { valor: number | string; status: string };

export function affiliateTotals(commissions: Commission[], withdrawals: Withdrawal[]) {
  const earned = commissions.reduce((sum, item) => sum + toCents(item.valor_comissao), 0);
  const paid = withdrawals.filter((item) => item.status === "pago")
    .reduce((sum, item) => sum + toCents(item.valor), 0);
  const pending = withdrawals.filter((item) => item.status === "pendente")
    .reduce((sum, item) => sum + toCents(item.valor), 0);
  return {
    earned: earned / 100, paid: paid / 100, pending: pending / 100,
    unpaid: Math.max(0, earned - paid) / 100,
    available: Math.max(0, earned - paid - pending) / 100,
  };
}

export function unpaidAffiliateCommissions(
  commissions: (Commission & { afiliado_id: string })[],
  withdrawals: (Withdrawal & { afiliado_id: string })[],
) {
  const balances = new Map<string, number>();
  for (const item of commissions) {
    balances.set(item.afiliado_id, (balances.get(item.afiliado_id) ?? 0) + toCents(item.valor_comissao));
  }
  for (const item of withdrawals.filter((withdrawal) => withdrawal.status === "pago")) {
    balances.set(item.afiliado_id, (balances.get(item.afiliado_id) ?? 0) - toCents(item.valor));
  }
  return [...balances.values()].reduce((sum, value) => sum + Math.max(0, value), 0) / 100;
}

export function affiliateBalance(
  commissions: { valor_comissao: number | string }[],
  withdrawals: { valor: number | string; status: string }[],
) {
  return affiliateTotals(commissions, withdrawals).available;
}
