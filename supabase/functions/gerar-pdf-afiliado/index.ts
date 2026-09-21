import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { codigo, link } = await req.json();

    if (!codigo || !link) {
      return new Response(JSON.stringify({ error: "Código e link são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a simple PDF using raw PDF syntax
    const title = "NOOV - Informações do Afiliado";
    const now = new Date().toLocaleDateString("pt-BR");

    const content = [
      title,
      "",
      `Data: ${now}`,
      "",
      "-------------------------------------------",
      "",
      `Codigo de Acesso: ${codigo}`,
      "",
      `Link de Compartilhamento:`,
      link,
      "",
      "-------------------------------------------",
      "",
      "Como funciona:",
      "",
      "1. Compartilhe o link acima com lojistas",
      "2. Quando eles se cadastrarem pelo link,",
      "   serao vinculados a sua conta",
      "3. Voce recebera comissoes automaticamente",
      "   sobre os pagamentos dos lojistas",
      "",
      "-------------------------------------------",
      "",
      "Acesse seu painel:",
      "https://noov.lovable.app/login",
      "",
      "Selecione 'Afiliado' e faca login com",
      "seu e-mail e senha cadastrados.",
    ];

    // Build PDF manually
    const lines = content;
    const fontSize = 12;
    const lineHeight = 18;
    const marginLeft = 50;
    const marginTop = 750;
    const pageWidth = 612;
    const pageHeight = 792;

    // Build content stream
    let stream = `BT\n/F1 ${fontSize} Tf\n`;

    // Title in larger font
    stream += `/F1 20 Tf\n${marginLeft} ${marginTop} Td\n(${escapeText(title)}) Tj\n`;
    stream += `/F1 ${fontSize} Tf\n`;

    let y = marginTop - 40;
    for (let i = 1; i < lines.length; i++) {
      if (y < 50) break;
      stream += `${marginLeft} ${y} Td\n(${escapeText(lines[i])}) Tj\n`;
      y -= lineHeight;
      // Reset position
      stream += `${-marginLeft} ${-y} Td\n`;
      y -= 0; // recalc
      const nextY = marginTop - 40 - (i * lineHeight);
      y = nextY;
    }

    // Rebuild properly
    stream = `BT\n/F1 20 Tf\n${marginLeft} ${marginTop} Td\n(${escapeText(title)}) Tj\nET\n`;

    let currentY = marginTop - 40;
    for (let i = 1; i < lines.length; i++) {
      if (currentY < 50) break;
      stream += `BT\n/F1 ${fontSize} Tf\n${marginLeft} ${currentY} Td\n(${escapeText(lines[i])}) Tj\nET\n`;
      currentY -= lineHeight;
    }

    const streamBytes = new TextEncoder().encode(stream);
    const streamLength = streamBytes.length;

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length ${streamLength} >>
stream
${stream}endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${(317 + streamLength).toString().padStart(4, "0")} 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;

    // Convert to base64
    const pdfBytes = new TextEncoder().encode(pdf);
    const base64 = btoa(String.fromCharCode(...pdfBytes));

    return new Response(JSON.stringify({ pdf: base64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro ao gerar PDF" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
