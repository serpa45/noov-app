import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return jsonRes({ error: "Token Mercado Pago não configurado" }, 500);
    }

    const body = await req.json();
    const { action, amount, pedido_id, payment_id } = body;

    // Admin client for privileged ops
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get store
    const { data: loja } = await supabase
      .from("lojas")
      .select("id, nome, user_id")
      .eq("user_id", userId)
      .single();

    if (!loja) {
      return jsonRes({ error: "Loja não encontrada" }, 404);
    }

    // Get platform commission config
    const { data: comissaoConfig } = await supabaseAdmin
      .from("configuracoes_globais")
      .select("valor")
      .eq("chave", "comissao_plataforma_percent")
      .maybeSingle();

    const comissaoPercent = comissaoConfig?.valor ? parseFloat(comissaoConfig.valor) : 0;

    // ─── CREATE PIX ───
    if (action === "create") {
      if (!amount || amount <= 0) {
        return jsonRes({ error: "Valor inválido" }, 400);
      }

      const comissaoValor = Math.round(amount * (comissaoPercent / 100) * 100) / 100;
      const lojistaValor = Math.round((amount - comissaoValor) * 100) / 100;

      const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Idempotency-Key": `pdv-${pedido_id}-${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description: `PDV ${loja.nome} - Pedido`,
          payment_method_id: "pix",
          payer: { email: "cliente@pdv.local" },
          metadata: {
            loja_id: loja.id,
            pedido_id,
            comissao_plataforma: comissaoValor,
            valor_lojista: lojistaValor,
            comissao_percent: comissaoPercent,
          },
        }),
      });

      if (!mpRes.ok) {
        const errText = await mpRes.text();
        console.error("MP PIX error:", mpRes.status, errText);
        return jsonRes({ error: "Erro ao gerar PIX" }, 500);
      }

      const mpData = await mpRes.json();
      const pixInfo = mpData.point_of_interaction?.transaction_data;

      // Register in pix_split_pagamentos
      await supabaseAdmin.from("pix_split_pagamentos").insert({
        loja_id: loja.id,
        pedido_id: pedido_id || null,
        valor_total: amount,
        comissao_percentual: comissaoPercent,
        valor_plataforma: comissaoValor,
        valor_lojista: lojistaValor,
        payment_external_id: String(mpData.id),
        status: "pendente",
      });

      return jsonRes({
        payment_id: mpData.id,
        status: mpData.status,
        qr_code: pixInfo?.qr_code || null,
        qr_code_base64: pixInfo?.qr_code_base64 || null,
        amount,
        comissao_plataforma: comissaoValor,
        valor_lojista: lojistaValor,
        comissao_percent: comissaoPercent,
      });
    }

    // ─── CHECK STATUS ───
    if (action === "status") {
      if (!payment_id) {
        return jsonRes({ error: "payment_id obrigatório" }, 400);
      }

      const statusRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${payment_id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!statusRes.ok) {
        return jsonRes({ error: "Erro ao consultar status" }, 500);
      }

      const statusData = await statusRes.json();

      // If approved, update split record and trigger transfer
      if (statusData.status === "approved") {
        // Update pix_split_pagamentos
        await supabaseAdmin
          .from("pix_split_pagamentos")
          .update({ status: "aprovado" })
          .eq("payment_external_id", String(payment_id));

        // Get lojista PIX key for transfer
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("pix_tipo, pix_chave, pix_nome_favorecido, full_name")
          .eq("user_id", loja.user_id)
          .single();

        const meta = statusData.metadata || {};
        const lojistaValor = meta.valor_lojista || 0;

        // Auto-transfer to lojista via Mercado Pago PIX if they have a key
        let transferStatus = "sem_chave_pix";
        if (profile?.pix_chave && lojistaValor > 0) {
          try {
            // Map pix_tipo to Mercado Pago key_type
            const keyTypeMap: Record<string, string> = {
              cpf: "CPF",
              cnpj: "CNPJ",
              email: "EMAIL",
              telefone: "PHONE",
              aleatoria: "EVP",
            };
            const keyType = keyTypeMap[profile.pix_tipo || ""] || "EVP";

            const transferRes = await fetch(
              "https://api.mercadopago.com/v1/transaction_intentions/process",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                  "X-Idempotency-Key": `transfer-${payment_id}-${Date.now()}`,
                },
                body: JSON.stringify({
                  type: "withdrawal",
                  amount: lojistaValor,
                  currency_id: "BRL",
                  description: `Repasse PDV - ${loja.nome}`,
                  point_of_interaction: {
                    type: "PIX",
                    transaction_data: {
                      payer_account: {
                        type: "PIX",
                        number: profile.pix_chave,
                        key_type: keyType,
                        holder_name:
                          profile.pix_nome_favorecido ||
                          profile.full_name ||
                          "Lojista",
                      },
                    },
                  },
                }),
              }
            );

            if (transferRes.ok) {
              const transferData = await transferRes.json();
              transferStatus = transferData.status || "enviado";
              console.log("Transfer OK:", transferData.id);

              // Update split record with transfer info
              await supabaseAdmin
                .from("pix_split_pagamentos")
                .update({ status: "transferido" })
                .eq("payment_external_id", String(payment_id));
            } else {
              const errText = await transferRes.text();
              console.error("Transfer error:", transferRes.status, errText);
              transferStatus = "erro_transferencia";
            }
          } catch (transferErr) {
            console.error("Transfer exception:", transferErr);
            transferStatus = "erro_transferencia";
          }
        }

        return jsonRes({
          status: statusData.status,
          status_detail: statusData.status_detail,
          metadata: statusData.metadata,
          transfer_status: transferStatus,
        });
      }

      return jsonRes({
        status: statusData.status,
        status_detail: statusData.status_detail,
        metadata: statusData.metadata,
      });
    }

    return jsonRes({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("Error:", err);
    return jsonRes({ error: "Erro interno", details: String(err) }, 500);
  }
});
