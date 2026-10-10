import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { activatePlanPayment, getPaymentToken } from "../_shared/plan-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const accessToken = await getPaymentToken(supabaseAdmin);
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

    // If approved, activate the plan, record in pagamentos_loja and generate affiliate commission
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
      if ((!ref?.loja_id || !ref?.plano_id) && payment.metadata?.loja_id && payment.metadata?.plano_id) {
        ref = {
          loja_id: payment.metadata.loja_id,
          plano_id: payment.metadata.plano_id,
          user_id: payment.metadata.user_id || "",
        };
      }

      if (ref?.loja_id && ref?.plano_id) {
        await activatePlanPayment(supabaseAdmin, ref, payment.transaction_amount, payment_id);
      } else {
        throw new Error(`Could not extract plan reference from payment ${payment_id}`);
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
