import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { plano_id, success_url, failure_url } = await req.json();

    if (!plano_id || !success_url || !failure_url) {
      return new Response(JSON.stringify({ error: "plano_id, success_url e failure_url são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan details
    const { data: plano, error: planoErr } = await supabase
      .from("planos")
      .select("*")
      .eq("id", plano_id)
      .eq("ativo", true)
      .single();

    if (planoErr || !plano) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get store and its current plan info
    const { data: loja, error: lojaErr } = await supabase
      .from("lojas")
      .select("id, nome, valor_plano_exclusivo, plano_id_exclusivo")
      .eq("user_id", userId)
      .single();
    
    const { data: currentLojaPlano } = await supabase
      .from("loja_planos")
      .select("plano_id, promo_pagamentos_feitos")
      .eq("loja_id", loja?.id)
      .maybeSingle();

    if (lojaErr || !loja) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();

    let accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      const { data: config } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "mercadopago_access_token")
        .maybeSingle();
      accessToken = config?.valor;
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token Mercado Pago não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Validate the access token and confirm it's a Brazilian account
    console.log("Validating Mercado Pago access token...");
    const validateRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!validateRes.ok) {
      const valErr = await validateRes.text();
      console.error("Token validation failed:", validateRes.status, valErr);
      return new Response(JSON.stringify({ 
        error: "Token Mercado Pago inválido ou expirado",
        details: `Status: ${validateRes.status}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpUser = await validateRes.json();
    console.log("MP User:", JSON.stringify({ id: mpUser.id, site_id: mpUser.site_id, country_id: mpUser.country_id }));

    if (mpUser.site_id !== "MLB" && mpUser.country_id !== "BR") {
      console.error("Token is not from Brazil! site_id:", mpUser.site_id, "country_id:", mpUser.country_id);
      return new Response(JSON.stringify({ 
        error: "O token do Mercado Pago não é de uma conta brasileira (MLB)",
        details: `site_id: ${mpUser.site_id}, country_id: ${mpUser.country_id}`
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Token validated - Brazilian account confirmed (MLB)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // Calculate price logic
    let finalPrice = Number(plano.preco);

    // 1. Check exclusive price
    if (loja.plano_id_exclusivo === plano_id && loja.valor_plano_exclusivo) {
      finalPrice = Number(loja.valor_plano_exclusivo);
    } 
    // 2. Check promo price if plan has it
    else if (plano.preco_promocional && plano.promo_duracao_meses && plano.promo_duracao_meses > 0) {
      const isSamePlan = currentLojaPlano?.plano_id === plano_id;
      const pagos = isSamePlan ? (currentLojaPlano?.promo_pagamentos_feitos || 0) : 0;
      
      if (pagos < plano.promo_duracao_meses) {
        finalPrice = Number(plano.preco_promocional);
      }
    }

    // Create Mercado Pago checkout preference (one-time payment)
    const preference = {
      items: [
        {
          title: `Plano ${plano.nome} - NOOV`,
          quantity: 1,
          unit_price: finalPrice,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: profile?.email || user.email || "",
      },
      back_urls: {
        success: success_url,
        failure: failure_url,
        pending: success_url,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
      external_reference: JSON.stringify({
        loja_id: loja.id,
        plano_id: plano.id,
        user_id: userId,
      }),
    };

    console.log("Creating preference:", JSON.stringify(preference));

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const mpResponseText = await mpResponse.text();
    console.log("MP preference response status:", mpResponse.status);
    console.log("MP preference response body:", mpResponseText);

    if (!mpResponse.ok) {
      console.error("Mercado Pago preference error:", mpResponse.status, mpResponseText);
      
      let errorDetail = "Erro ao criar pagamento no Mercado Pago";
      try {
        const errJson = JSON.parse(mpResponseText);
        errorDetail = errJson.message || errJson.error || errorDetail;
        if (errJson.cause) {
          console.error("Error cause:", JSON.stringify(errJson.cause));
        }
      } catch { /* use default */ }

      return new Response(JSON.stringify({ error: errorDetail, mp_status: mpResponse.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = JSON.parse(mpResponseText);
    console.log("Preference created:", mpData.id);

    return new Response(
      JSON.stringify({
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
        id: mpData.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
