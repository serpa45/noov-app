export const toCents = (value: number | string) => Math.round(Number(value) * 100);

export function affiliateBalance(
  commissions: { valor_comissao: number | string }[],
  withdrawals: { valor: number | string; status: string }[],
) {
  const earned = commissions.reduce((sum, item) => sum + toCents(item.valor_comissao), 0);
  const reserved = withdrawals
    .filter((item) => item.status === "pago" || item.status === "pendente")
    .reduce((sum, item) => sum + toCents(item.valor), 0);
  return Math.max(0, earned - reserved) / 100;
}
