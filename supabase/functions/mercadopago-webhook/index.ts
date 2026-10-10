import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { activatePlanPayment, getPaymentToken } from "../_shared/plan-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseRef(refStr: string | undefined, metadata: any): { loja_id: string; plano_id: string; user_id: string } | null {
  try {
    if (refStr) {
      const ref = JSON.parse(refStr);
      if (ref?.loja_id && ref?.plano_id) return ref;
    }
  } catch { /* ignore */ }
  if (metadata?.loja_id && metadata?.plano_id) return metadata;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const accessToken = await getPaymentToken(supabaseAdmin);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle subscription (preapproval) events
    if (body.type === "subscription_preapproval" || body.action?.startsWith("updated") || body.action?.startsWith("created")) {
      const preapprovalId = body.data?.id;
      if (preapprovalId && (body.type === "subscription_preapproval" || body.topic === "preapproval")) {
        console.log("Processing preapproval event:", preapprovalId);

        const preapprovalRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!preapprovalRes.ok) {
          console.error("Failed to get preapproval:", await preapprovalRes.text());
          return new Response(JSON.stringify({ error: "Failed to fetch preapproval" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const preapproval = await preapprovalRes.json();
        console.log("Preapproval status:", preapproval.status);

        // Activate plan when subscription is authorized/active
        if (preapproval.status === "authorized") {
          const ref = parseRef(preapproval.external_reference, preapproval.metadata);
          if (ref) {
            await activatePlanPayment(supabaseAdmin, ref, preapproval.auto_recurring?.transaction_amount, `preapproval:${preapprovalId}`);
          } else {
            throw new Error("Invalid preapproval reference");
          }
        }

        // Deactivate plan when subscription is cancelled/paused
        if (preapproval.status === "cancelled" || preapproval.status === "paused") {
          const ref = parseRef(preapproval.external_reference, preapproval.metadata);
          if (ref) {
            const { error } = await supabaseAdmin
              .from("loja_planos")
              .update({ ativo: false })
              .eq("loja_id", ref.loja_id);
            if (error) throw error;
            else console.log(`Plan deactivated for store ${ref.loja_id} (status: ${preapproval.status})`);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Handle one-time payment events (PIX, etc.)
    if (body.type === "payment" || body.action === "payment.created" || body.action === "payment.updated") {
      const paymentId = body.data?.id;
      if (!paymentId) {
        return new Response(JSON.stringify({ error: "No payment ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!paymentRes.ok) {
        console.error("Failed to get payment:", await paymentRes.text());
        return new Response(JSON.stringify({ error: "Failed to fetch payment" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payment = await paymentRes.json();
      console.log("Payment status:", payment.status);

      if (payment.status !== "approved") {
        return new Response(JSON.stringify({ ok: true, status: payment.status }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ref = parseRef(payment.external_reference, payment.metadata);
      if (!ref) {
        console.error("Invalid reference:", payment.external_reference);
        return new Response(JSON.stringify({ error: "Invalid reference" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await activatePlanPayment(supabaseAdmin, ref, payment.transaction_amount, paymentId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
