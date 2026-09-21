import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const normStr = (s: string) => (s || "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { step, email, documento, dataNascimento, securityAnswer, newPassword } = await req.json();
    const normEmail = (email || "").trim().toLowerCase();
    const normDoc = onlyDigits(documento || "");

    if (!normEmail) return json({ error: "E-mail é obrigatório." }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, email, cpf_cnpj, data_nascimento, security_answer")
      .ilike("email", normEmail)
      .maybeSingle();

    if (!profile) return json({ error: "E-mail não encontrado." }, 404);

    if (step === "check_email") {
      return json({ ok: true });
    }

    if (!normDoc) return json({ error: "CPF/CNPJ é obrigatório." }, 400);

    let docMatch = onlyDigits((profile as any).cpf_cnpj || "") === normDoc;
    if (!docMatch) {
      const { data: lojas } = await admin
        .from("lojas")
        .select("documento")
        .eq("user_id", profile.user_id);
      docMatch = (lojas || []).some(
        (l: any) => onlyDigits(l.documento || "") === normDoc,
      );
    }
    if (!docMatch) return json({ error: "CPF/CNPJ não confere." }, 404);

    if (step === "check_doc") {
      return json({ ok: true });
    }

    const normBirth = (dataNascimento || "").trim();
    if (!normBirth) return json({ error: "Data de nascimento é obrigatória." }, 400);

    const profBirth = (profile as any).data_nascimento
      ? String((profile as any).data_nascimento).slice(0, 10)
      : "";
    if (!profBirth || profBirth !== normBirth) {
      return json({ error: "Data de nascimento não confere." }, 404);
    }

    if (step === "check_birth") {
      return json({ ok: true });
    }

    // Security question step
    const storedAnswer = normStr((profile as any).security_answer || "");
    if (step === "check_security") {
      const provided = normStr(securityAnswer || "");
      if (!provided) return json({ error: "Resposta é obrigatória." }, 400);
      if (!storedAnswer) return json({ error: "Pergunta de segurança não cadastrada para esta conta." }, 404);
      if (storedAnswer !== provided) return json({ error: "Resposta não confere." }, 404);
      return json({ ok: true });
    }

    if (step === "reset") {
      // Re-validate security answer if it exists on account
      if (storedAnswer) {
        const provided = normStr(securityAnswer || "");
        if (storedAnswer !== provided) return json({ error: "Resposta de segurança não confere." }, 403);
      }
      if (!newPassword || String(newPassword).length < 6) {
        return json({ error: "Senha deve ter no mínimo 6 caracteres." }, 400);
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(
        profile.user_id,
        { password: String(newPassword) },
      );
      if (updErr) throw updErr;
      await admin
        .from("profiles")
        .update({ senha_painel: String(newPassword) })
        .eq("user_id", profile.user_id);
      return json({ ok: true });
    }

    return json({ error: "step inválido" }, 400);
  } catch (err: any) {
    return json({ error: err?.message || String(err) }, 500);
  }
});
