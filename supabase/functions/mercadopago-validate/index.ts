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
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: "MERCADOPAGO_ACCESS_TOKEN não configurado" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if there's a body with action
    let action = "validate";
    try {
      const body = await req.json();
      action = body.action || "validate";
    } catch { /* no body = validate */ }

    // Validate token with /users/me
    const userRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("Token validation failed:", userRes.status, errText);
      return new Response(JSON.stringify({ 
        valid: false,
        error: `Token inválido (HTTP ${userRes.status})`,
        details: errText,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpUser = await userRes.json();

    // ========== WEBHOOK SETUP ==========
    if (action === "setup_webhook") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

      console.log("Setting up webhook URL:", webhookUrl);

      // First, list existing webhooks (via application notification URL)
      // MP uses the /v1/webhooks endpoint for notification webhooks
      const listRes = await fetch("https://api.mercadopago.com/v1/webhooks", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let existingWebhooks: any[] = [];
      if (listRes.ok) {
        const listData = await listRes.json();
        existingWebhooks = Array.isArray(listData) ? listData : (listData.results || []);
        console.log("Existing webhooks:", JSON.stringify(existingWebhooks));
      } else {
        const listErr = await listRes.text();
        console.log("List webhooks response:", listRes.status, listErr);
      }

      // Check if our webhook already exists
      const alreadyConfigured = existingWebhooks.find(
        (w: any) => w.url === webhookUrl || w.notification_url === webhookUrl
      );

      if (alreadyConfigured) {
        return new Response(JSON.stringify({
          valid: true,
          webhook: {
            status: "already_configured",
            id: alreadyConfigured.id,
            url: webhookUrl,
            events: alreadyConfigured.events || alreadyConfigured.topics,
          },
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create webhook
      const webhookPayload = {
        url: webhookUrl,
        events: ["payment", "subscription_preapproval", "plan"],
      };

      console.log("Creating webhook:", JSON.stringify(webhookPayload));

      const createRes = await fetch("https://api.mercadopago.com/v1/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(webhookPayload),
      });

      const createText = await createRes.text();
      console.log("Webhook creation response:", createRes.status, createText);

      if (!createRes.ok) {
        // Try alternative: update application notification preferences
        console.log("Trying application notification URL method...");

        const appRes = await fetch(`https://api.mercadopago.com/users/${mpUser.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            notification_url: webhookUrl,
          }),
        });

        const appText = await appRes.text();
        console.log("Application notification URL update:", appRes.status, appText);

        if (appRes.ok) {
          return new Response(JSON.stringify({
            valid: true,
            webhook: {
              status: "configured_via_notification_url",
              url: webhookUrl,
              method: "user_notification_url",
            },
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          valid: true,
          webhook: {
            status: "manual_setup_required",
            url: webhookUrl,
            error: createText,
            instructions: "Configure manualmente em: Mercado Pago > Suas Integrações > Webhooks",
            events_to_configure: ["payment", "subscription_preapproval"],
          },
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let createData;
      try { createData = JSON.parse(createText); } catch { createData = {}; }

      return new Response(JSON.stringify({
        valid: true,
        webhook: {
          status: "created",
          id: createData.id,
          url: webhookUrl,
          events: createData.events || createData.topics,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== STANDARD VALIDATION ==========
    const testRes = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const paymentMethods = testRes.ok ? await testRes.json() : [];

    const pixAvailable = paymentMethods.some?.((m: any) => m.id === "pix" && m.status === "active");
    const creditCardAvailable = paymentMethods.some?.((m: any) => m.payment_type_id === "credit_card" && m.status === "active");
    const boletoAvailable = paymentMethods.some?.((m: any) => m.id === "bolbradesco" && m.status === "active");

    // Check webhook status
    let webhookStatus = "unknown";
    let webhookUrl = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
      
      const whRes = await fetch("https://api.mercadopago.com/v1/webhooks", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (whRes.ok) {
        const whData = await whRes.json();
        const hooks = Array.isArray(whData) ? whData : (whData.results || []);
        const found = hooks.find((w: any) => w.url === webhookUrl || w.notification_url === webhookUrl);
        webhookStatus = found ? "active" : "not_configured";
      } else {
        await whRes.text(); // consume body
        webhookStatus = "check_failed";
      }
    } catch { webhookStatus = "check_error"; }

    return new Response(JSON.stringify({
      valid: true,
      account: {
        id: mpUser.id,
        email: mpUser.email,
        site_id: mpUser.site_id,
        country_id: mpUser.country_id,
        is_brazil: mpUser.site_id === "MLB",
        nickname: mpUser.nickname,
        first_name: mpUser.first_name,
        last_name: mpUser.last_name,
      },
      token_type: accessToken.startsWith("APP_USR") ? "production" : accessToken.startsWith("TEST") ? "test" : "unknown",
      capabilities: {
        pix: pixAvailable,
        credit_card: creditCardAvailable,
        boleto: boletoAvailable,
        payments: true,
        subscriptions: true,
      },
      webhook: {
        status: webhookStatus,
        url: webhookUrl,
      },
      payment_methods_count: paymentMethods.length || 0,
      status: "ACTIVE",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Validation error:", err);
    return new Response(JSON.stringify({ valid: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
