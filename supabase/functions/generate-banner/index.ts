import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOOV_LOGO_URL = "https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/banners/noov-logo.png";

const BRAND_INSTRUCTIONS = `
BRAND GUIDELINES (MUST FOLLOW):
- Brand name: NOOV
- The logo text "NOOV" must ALWAYS appear on the banner prominently
- The first "O" in NOOV is ALWAYS orange (#F97316), the rest of the letters are white
- Primary brand color: Blue (#2563EB)
- Secondary/Accent color: Orange (#F97316)  
- Background should use dark tones (dark blue, dark gray, or black) for contrast
- The overall design must follow a modern, professional, vibrant style using these brand colors
- The NOOV logo/text should be large and clearly visible
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { tema, referenceImageBase64 } = await req.json();
    if (!tema || typeof tema !== "string") {
      return new Response(JSON.stringify({ error: "Tema é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Generate marketing copy
    const copyMessages: any[] = [
      {
        role: "system",
        content: `Você é um agente de marketing digital especialista em delivery e SaaS. 
Você cria materiais de divulgação para o sistema NOOV — uma plataforma de delivery próprio para restaurantes, pizzarias, hamburguerias e açaiterias.

A NOOV é anti-iFood: zero taxa por pedido, o lojista tem seu próprio cardápio digital, gestão completa, PDV, controle de entregas e relatórios financeiros.

Planos: Start (grátis), Pro (R$97/mês), Ultra (R$197/mês).

${BRAND_INSTRUCTIONS}

Retorne EXATAMENTE um JSON com:
{
  "titulo": "título curto e impactante do banner (max 60 chars)",
  "descricao": "descrição do material para o afiliado entender o contexto (1-2 frases)",
  "texto_whatsapp": "texto completo para enviar pelo WhatsApp com emojis, bullet points e CTA. NÃO inclua link, será adicionado automaticamente.",
  "texto_banner_principal": "frase principal curta e impactante que vai no topo do banner (max 40 chars, MAIÚSCULO)",
  "texto_banner_secundario": "subtítulo ou bullet points curtos para o banner (max 80 chars)",
  "prompt_imagem": "prompt detalhado em inglês para gerar uma imagem de banner de marketing profissional 1080x1080px. MUST include NOOV brand text with the first O in orange."
}

Responda APENAS o JSON, sem markdown.`
      },
      {
        role: "user",
        content: `Crie um material de marketing sobre: ${tema}${referenceImageBase64 ? "\n\nUma imagem de referência foi enviada pelo admin para inspirar o visual do banner." : ""}`
      }
    ];

    const copyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: copyMessages,
        tools: [
          {
            type: "function",
            function: {
              name: "create_banner_content",
              description: "Create marketing banner content",
              parameters: {
                type: "object",
                properties: {
                  titulo: { type: "string", description: "Short impactful title" },
                  descricao: { type: "string", description: "Context description for the affiliate" },
                  texto_whatsapp: { type: "string", description: "Full WhatsApp share text with emojis" },
                  texto_banner_principal: { type: "string", description: "Main text to render ON the banner image (max 40 chars, uppercase)" },
                  texto_banner_secundario: { type: "string", description: "Secondary text/bullets to render ON the banner image (max 80 chars)" },
                  prompt_imagem: { type: "string", description: "Detailed English prompt for banner image generation" },
                },
                required: ["titulo", "descricao", "texto_whatsapp", "texto_banner_principal", "texto_banner_secundario", "prompt_imagem"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_banner_content" } },
      }),
    });

    if (!copyResponse.ok) {
      const errText = await copyResponse.text();
      console.error("AI copy error:", copyResponse.status, errText);
      if (copyResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (copyResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao gerar conteúdo");
    }

    const copyData = await copyResponse.json();
    const toolCall = copyData.choices?.[0]?.message?.tool_calls?.[0];
    let content: any;
    if (toolCall?.function?.arguments) {
      content = JSON.parse(toolCall.function.arguments);
    } else {
      const raw = copyData.choices?.[0]?.message?.content || "";
      content = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    }

    // Step 2: Generate image with NOOV branding
    const brandedPrompt = `${content.prompt_imagem}.

CRITICAL REQUIREMENTS FOR THE BANNER IMAGE:
- The banner MUST prominently display the word "NOOV" as a logo. In the word NOOV, the first letter O MUST be orange (#F97316) while N, the second O, and V are white.
- Main headline text: "${content.texto_banner_principal}" — must be large, bold, white, high contrast
- Subtitle text: "${content.texto_banner_secundario}" — smaller but readable
- Color palette: dark background (dark blue #1E3A5F or black), primary blue (#2563EB), accent orange (#F97316), white text
- Professional marketing banner, 1080x1080px, modern clean design
- The NOOV logo text should be at the top or prominently placed
- All text must be clearly legible with proper contrast`;

    const imgMessages: any[] = [
      {
        role: "user",
        content: referenceImageBase64
          ? [
              { type: "text", text: brandedPrompt },
              { type: "image_url", image_url: { url: NOOV_LOGO_URL } },
              { type: "image_url", image_url: { url: referenceImageBase64 } },
            ]
          : [
              { type: "text", text: brandedPrompt },
              { type: "image_url", image_url: { url: NOOV_LOGO_URL } },
            ],
      },
    ];

    const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: imgMessages,
        modalities: ["image", "text"],
      }),
    });

    if (!imgResponse.ok) {
      console.error("AI image error:", imgResponse.status);
      // Save without image
      return new Response(JSON.stringify({
        success: true,
        preview: {
          titulo: content.titulo,
          descricao: content.descricao,
          texto_whatsapp: content.texto_whatsapp,
          imagem_url: null,
          warning: "Imagem não gerada. Tente novamente.",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imgData = await imgResponse.json();
    const base64Url = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    let imageUrl = null;
    let imageBase64Preview = null;
    if (base64Url) {
      imageBase64Preview = base64Url;
      const base64Data = base64Url.split(",")[1];
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const fileName = `banner-${Date.now()}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("banners")
        .upload(`materiais/${fileName}`, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pubUrl } = supabase.storage.from("banners").getPublicUrl(`materiais/${fileName}`);
        imageUrl = pubUrl.publicUrl;
      } else {
        console.error("Upload error:", uploadErr);
      }
    }

    // Return preview data — do NOT save to DB yet
    return new Response(JSON.stringify({
      success: true,
      preview: {
        titulo: content.titulo,
        descricao: content.descricao,
        texto_whatsapp: content.texto_whatsapp,
        imagem_url: imageUrl,
        imagem_base64: imageBase64Preview,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-banner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
