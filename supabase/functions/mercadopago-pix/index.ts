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

    const { plano_id } = await req.json();

    if (!plano_id) {
      return new Response(JSON.stringify({ error: "plano_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan
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

    // Create PIX payment
    const payment = {
      transaction_amount: finalPrice,
      description: `Plano ${plano.nome} - NOOV`,
      payment_method_id: "pix",
      notification_url: notificationUrl,
      payer: {
        email: profile?.email || user.email || "cliente@noov.com.br",
      },
      external_reference: JSON.stringify({
        loja_id: loja.id,
        plano_id: plano.id,
        user_id: userId,
      }),
      metadata: {
        loja_id: loja.id,
        plano_id: plano.id,
        user_id: userId,
      },
    };

    console.log("Creating PIX payment:", JSON.stringify(payment));

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `${loja.id}-${plano.id}-${Date.now()}`,
      },
      body: JSON.stringify(payment),
    });

    const mpResponseText = await mpResponse.text();
    console.log("MP PIX response status:", mpResponse.status);
    console.log("MP PIX response body:", mpResponseText);

    if (!mpResponse.ok) {
      console.error("Mercado Pago PIX error:", mpResponse.status, mpResponseText);
      let errorDetail = "Erro ao gerar PIX";
      try {
        const errJson = JSON.parse(mpResponseText);
        errorDetail = errJson.message || errorDetail;
      } catch { /* use default */ }
      return new Response(JSON.stringify({ error: errorDetail, mp_status: mpResponse.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = JSON.parse(mpResponseText);
    const txData = mpData.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        payment_id: mpData.id,
        status: mpData.status,
        qr_code: txData?.qr_code,
        qr_code_base64: txData?.qr_code_base64,
        ticket_url: txData?.ticket_url,
        expiration_date: mpData.date_of_expiration,
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
