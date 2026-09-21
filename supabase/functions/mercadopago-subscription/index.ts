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

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    // Get store
    const { data: loja } = await supabase
      .from("lojas")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!loja) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    if (action === "cancel" && body.preapproval_id) {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Token Mercado Pago não configurado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cancel subscription
      const cancelRes = await fetch(`https://api.mercadopago.com/preapproval/${body.preapproval_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!cancelRes.ok) {
        const errBody = await cancelRes.text();
        console.error("Cancel error:", cancelRes.status, errBody);
        return new Response(JSON.stringify({ error: "Erro ao cancelar assinatura" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cancelData = await cancelRes.json();

      // Deactivate plan in database
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseAdmin
        .from("loja_planos")
        .update({ ativo: false })
        .eq("loja_id", loja.id);

      return new Response(JSON.stringify({ ok: true, status: cancelData.status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search for active subscriptions for this store
    let subscriptions: any[] = [];

    if (accessToken) {
      try {
        const searchRes = await fetch(
          `https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(JSON.stringify({ loja_id: loja.id }))}&status=authorized`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          subscriptions = searchData.results || [];
        } else {
          // Fallback: search without external_reference filter
          const fallbackRes = await fetch(
            `https://api.mercadopago.com/preapproval/search?status=authorized&limit=50`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            subscriptions = (fallbackData.results || []).filter((s: any) => {
              try {
                const ref = JSON.parse(s.external_reference || "{}");
                return ref.loja_id === loja.id;
              } catch {
                return false;
              }
            });
          }
        }
      } catch (mpErr) {
        console.error("Mercado Pago search error:", mpErr);
      }
    }

    // Get local plan info
    const { data: lojaPlano } = await supabase
      .from("loja_planos")
      .select("*, planos:plano_id(id, nome, preco, periodo)")
      .eq("loja_id", loja.id)
      .eq("ativo", true)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        subscriptions: subscriptions.map((s: any) => ({
          id: s.id,
          status: s.status,
          reason: s.reason,
          next_payment_date: s.next_payment_date,
          auto_recurring: s.auto_recurring,
          date_created: s.date_created,
          last_modified: s.last_modified,
          payer_email: s.payer_email,
        })),
        loja_plano: lojaPlano,
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
