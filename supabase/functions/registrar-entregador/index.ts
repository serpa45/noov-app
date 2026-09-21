import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, telefone, loja_id } = await req.json();

    if (!nome || !loja_id) {
      return new Response(JSON.stringify({ error: "Nome e loja_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate unique login code (6 chars uppercase)
    const codigoAcesso = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(36).toUpperCase())
      .join("")
      .slice(0, 6);

    // Generate a unique email for this driver
    const uniqueEmail = `entregador_${codigoAcesso.toLowerCase()}@noov.delivery`;
    const tempPassword = crypto.randomUUID();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: uniqueEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "entregador", full_name: nome },
    });

    if (authError) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Erro ao criar entregador" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Update profile with codigo_acesso and phone
    await supabase
      .from("profiles")
      .update({
        codigo_acesso: codigoAcesso,
        full_name: nome,
        phone: telefone || null,
      })
      .eq("user_id", userId);

    // Link entregador to store
    const { error: linkError } = await supabase
      .from("loja_entregadores")
      .insert({ loja_id, entregador_id: userId });

    if (linkError) {
      console.error("Link error:", linkError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        entregador_id: userId,
        codigo_acesso: codigoAcesso,
        nome,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("registrar-entregador error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
