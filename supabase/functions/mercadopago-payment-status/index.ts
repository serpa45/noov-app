import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function activatePlan(
  supabaseAdmin: any,
  ref: { loja_id: string; plano_id: string; user_id: string },
  valorPago?: number
) {
  // Get plan details
  const { data: plano } = await supabaseAdmin
    .from("planos")
    .select("*")
    .eq("id", ref.plano_id)
    .single();

  if (!plano) {
    console.error("Plan not found:", ref.plano_id);
    return false;
  }

  // Calculate expiration: 30 days from now, or 30 days from current expiration if still active
  const { data: currentPlan } = await supabaseAdmin
    .from("loja_planos")
    .select("expira_em, plano_id, promo_pagamentos_feitos")
    .eq("loja_id", ref.loja_id)
    .eq("ativo", true)
    .maybeSingle();

  const now = new Date();
  let baseDate = now;

  if (currentPlan?.expira_em) {
    const currentExp = new Date(currentPlan.expira_em);
    if (currentExp > now) {
      baseDate = currentExp;
    }
  }

  const expiraEm = new Date(baseDate);
  expiraEm.setDate(expiraEm.getDate() + 30);

  const finalPrice = valorPago ?? Number(plano.preco);

  // Calculate promo payments
  let promoPagamentosFeitos = currentPlan?.promo_pagamentos_feitos || 0;

  // If plan changed, reset counter
  if (currentPlan?.plano_id !== ref.plano_id) {
    promoPagamentosFeitos = 0;
  }

  // If paid price is the promo price, increment counter
  if (plano.preco_promocional && Number(finalPrice) === Number(plano.preco_promocional)) {
    promoPagamentosFeitos += 1;
  }

  // Upsert loja_planos
  const { error: upsertErr } = await supabaseAdmin
    .from("loja_planos")
    .upsert(
      {
        loja_id: ref.loja_id,
        plano_id: ref.plano_id,
        preco_assinado: finalPrice,
        features_assinado: plano.features,
        limites_assinado: plano.limites,
        ativo: true,
        assinado_em: new Date().toISOString(),
        expira_em: expiraEm.toISOString(),
        promo_pagamentos_feitos: promoPagamentosFeitos,
      },
      { onConflict: "loja_id" }
    );

  if (upsertErr) {
    console.error("Upsert error:", upsertErr);
    return false;
  }

  console.log(`Plan ${plano.nome} activated for store ${ref.loja_id}, expires at ${expiraEm.toISOString()}`);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id } = await req.json();

    if (!payment_id) {
      return new Response(JSON.stringify({ error: "payment_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.error("MP error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao consultar pagamento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await mpRes.json();
    console.log(`Payment ${payment_id} status: ${payment.status}`);

    // If approved, activate the plan directly (fallback in case webhook didn't fire)
    if (payment.status === "approved") {
      let ref: { loja_id: string; plano_id: string; user_id: string } | null = null;

      // Try to parse external_reference
      try {
        if (payment.external_reference) {
          ref = JSON.parse(payment.external_reference);
        }
      } catch {
        /* ignore parse error */
      }

      // Fallback to metadata
      if (!ref && payment.metadata?.loja_id && payment.metadata?.plano_id) {
        ref = {
          loja_id: payment.metadata.loja_id,
          plano_id: payment.metadata.plano_id,
          user_id: payment.metadata.user_id || "",
        };
      }

      if (ref?.loja_id && ref?.plano_id) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Check if plan was already activated by webhook (expira_em in the future)
        const { data: existingPlan } = await supabaseAdmin
          .from("loja_planos")
          .select("expira_em")
          .eq("loja_id", ref.loja_id)
          .eq("ativo", true)
          .maybeSingle();

        const alreadyActivated =
          existingPlan?.expira_em &&
          new Date(existingPlan.expira_em) > new Date(Date.now() + 24 * 60 * 60 * 1000); // more than 1 day in future

        if (!alreadyActivated) {
          console.log(`Webhook may not have fired. Activating plan directly for store ${ref.loja_id}`);
          await activatePlan(supabaseAdmin, ref, payment.transaction_amount);
        } else {
          console.log(`Plan already activated by webhook for store ${ref.loja_id}`);
        }
      } else {
        console.error("Could not extract ref from payment:", payment_id);
      }
    }

    return new Response(
      JSON.stringify({
        status: payment.status,
        status_detail: payment.status_detail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
