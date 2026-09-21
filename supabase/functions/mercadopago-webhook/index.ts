import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function activatePlan(supabaseAdmin: any, ref: { loja_id: string; plano_id: string; user_id: string }, valorPago?: number) {
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

  // Upsert loja_planos (one active plan per store)
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

  // Record payment in pagamentos_loja
  const { error: pagErr } = await supabaseAdmin
    .from("pagamentos_loja")
    .insert({
      loja_id: ref.loja_id,
      plano_id: ref.plano_id,
      plano_nome: plano.nome,
      valor: finalPrice,
      metodo: "mercadopago",
      status: "aprovado",
    });
  if (pagErr) console.error("Payment record error:", pagErr);

  console.log(`Plan ${plano.nome} activated for store ${ref.loja_id}`);

  // Generate affiliate commission
  try {
    const { data: loja } = await supabaseAdmin
      .from("lojas")
      .select("afiliado_id")
      .eq("id", ref.loja_id)
      .single();

    if (loja?.afiliado_id) {
      // Get affiliate specific commission or global fallback
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("comissao_percent")
        .eq("user_id", loja.afiliado_id)
        .single();

      const { data: globalConfig } = await supabaseAdmin
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "comissao_afiliado_percent")
        .maybeSingle();

      const globalComissao = globalConfig?.valor ? parseFloat(globalConfig.valor) : 10;
      
      // Priority: Affiliate specific > Global config > Plan default
      const percentual = profile?.comissao_percent != null 
        ? parseFloat(profile.comissao_percent) 
        : globalComissao;

      const valorComissao = (finalPrice * percentual) / 100;

      const { error: comissaoErr } = await supabaseAdmin
        .from("comissoes")
        .insert({
          afiliado_id: loja.afiliado_id,
          loja_id: ref.loja_id,
          valor_pedido: finalPrice,
          percentual,
          valor_comissao: valorComissao,
          status: "pendente",
        });

      if (comissaoErr) {
        console.error("Commission insert error:", comissaoErr);
      } else {
        console.log(`Commission of R$${valorComissao.toFixed(2)} (${percentual}%) created for affiliate ${loja.afiliado_id}`);
      }
    }
  } catch (comErr) {
    console.error("Commission generation error:", comErr);
  }

  return true;
}

function parseRef(refStr: string | undefined, metadata: any): { loja_id: string; plano_id: string; user_id: string } | null {
  try {
    if (refStr) return JSON.parse(refStr);
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

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
            await activatePlan(supabaseAdmin, ref, preapproval.auto_recurring?.transaction_amount);
          } else {
            console.error("Invalid preapproval reference:", preapproval.external_reference);
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
            if (error) console.error("Deactivate error:", error);
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

      await activatePlan(supabaseAdmin, ref, payment.transaction_amount);
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
