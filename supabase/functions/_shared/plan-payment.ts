export async function getPaymentToken(client: any): Promise<string> {
  const secret = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (secret) return secret;
  const { data, error } = await client.from("configuracoes_globais")
    .select("valor").eq("chave", "mercadopago_access_token").maybeSingle();
  if (error || !data?.valor) throw new Error("Mercado Pago token not configured");
  return data.valor;
}

export async function activatePlanPayment(client: any, ref: any, amount: number, paymentId: string | number) {
  if (!ref?.loja_id || !ref?.plano_id || !paymentId) throw new Error("Invalid payment reference");
  const { error } = await client.rpc("process_plan_payment", {
    p_payment_id: String(paymentId),
    p_loja_id: ref.loja_id,
    p_plano_id: ref.plano_id,
    p_amount: amount,
  });
  if (error) throw new Error(`Plan payment processing failed: ${error.message}`);
}
