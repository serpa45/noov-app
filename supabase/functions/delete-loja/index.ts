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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify if requester is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Only admins can perform this action" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lojaId } = await req.json();

    if (!lojaId) {
      return new Response(JSON.stringify({ error: "lojaId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase with service role for administrative tasks
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get lojista user_id
    const { data: loja, error: lojaError } = await supabaseAdmin
      .from("lojas")
      .select("user_id")
      .eq("id", lojaId)
      .single();

    if (lojaError || !loja) {
      console.error("Loja not found:", lojaId);
      return new Response(JSON.stringify({ error: "Loja not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = loja.user_id;

    // 2. Delete from Storage
    const buckets = ["logos", "category-images", "product-images", "banners", "loja-assets"];
    for (const bucket of buckets) {
      try {
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucket)
          .list(lojaId, { recursive: true });

        if (!listError && files && files.length > 0) {
          const paths = files.map((f) => `${lojaId}/${f.name}`);
          const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths);
          if (removeError) console.error(`Error removing files from ${bucket}:`, removeError);
        }
      } catch (err) {
        console.error(`Error processing bucket ${bucket}:`, err);
      }
    }

    // 3. Call RPC to delete from DB
    const { error: rpcError } = await supabaseAdmin.rpc("delete_loja_complete", {
      p_loja_id: lojaId,
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      throw rpcError;
    }

    // 4. Delete Auth User
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.warn("Auth delete error (user might already be gone):", authError);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Main error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
