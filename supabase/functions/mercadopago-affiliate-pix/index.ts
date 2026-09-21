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

    const { plano_id, loja_id } = await req.json();

    if (!plano_id || !loja_id) {
      return new Response(JSON.stringify({ error: "plano_id e loja_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify if user is the affiliate for this store
    const { data: loja, error: lojaErr } = await supabase
      .from("lojas")
      .select("id, nome, afiliado_id")
      .eq("id", loja_id)
      .eq("afiliado_id", user.id)
      .single();

    if (lojaErr || !loja) {
      return new Response(JSON.stringify({ error: "Loja não encontrada ou você não tem permissão" }), {
        status: 403,
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

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token Mercado Pago não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // Create PIX payment
    const payment = {
      transaction_amount: Number(plano.preco),
      description: `Plano ${plano.nome} - Ativado por Afiliado para ${loja.nome}`,
      payment_method_id: "pix",
      notification_url: notificationUrl,
      payer: {
        email: user.email || "afiliado@noov.com.br",
      },
      external_reference: JSON.stringify({
        loja_id: loja.id,
        plano_id: plano.id,
        user_id: user.id, // The payer's ID
      }),
      metadata: {
        loja_id: loja.id,
        plano_id: plano.id,
        user_id: user.id,
        is_affiliate_payment: true
      },
    };

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `affiliate-${loja.id}-${plano.id}-${Date.now()}`,
      },
      body: JSON.stringify(payment),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ error: mpData.message || "Erro no Mercado Pago" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
