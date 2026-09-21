import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { codigo, tipo } = await req.json();

    if (!codigo || typeof codigo !== "string" || codigo.trim().length < 4) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tipo || !["lojista", "afiliado"].includes(tipo)) {
      return new Response(JSON.stringify({ error: "Tipo inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get master code from configuracoes_globais
    const chave = tipo === "lojista" ? "master_code_lojista" : "master_code_afiliado";
    const { data: configData } = await supabase
      .from("configuracoes_globais")
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();

    if (!configData?.valor || configData.valor.trim() === "") {
      return new Response(JSON.stringify({ error: "Código master não configurado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compare codes (case-insensitive)
    if (codigo.trim().toUpperCase() !== configData.valor.trim().toUpperCase()) {
      return new Response(JSON.stringify({ error: "Código master inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the first admin user to create a session
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum administrador encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserId = adminRoles[0].user_id;

    // Get admin email
    const { data: userData } = await supabase.auth.admin.getUserById(adminUserId);
    if (!userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Admin sem email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate magic link token for admin
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("generateLink error:", linkError);
      return new Response(JSON.stringify({ error: "Erro ao gerar acesso" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        token_hash: linkData.properties.hashed_token,
        email: userData.user.email,
        tipo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("master-login error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
