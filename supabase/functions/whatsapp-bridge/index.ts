import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, customerPhone, customerName } = await req.json()
    const adminPhone = Deno.env.get("ADMIN_WHATSAPP_NUMBER") || "5582993354558"
    
    // Aqui seria a integração com uma API de WhatsApp (Twilio, Evolution API, etc)
    // Para este exemplo, como estamos em ambiente de desenvolvimento, 
    // simularemos o envio e logaremos no console.
    
    console.log(`[WhatsApp Simulation] Enviar para: ${adminPhone}`)
    console.log(`[WhatsApp Simulation] De: ${customerName} (${customerPhone})`)
    console.log(`[WhatsApp Simulation] Mensagem: ${message}`)

    // Se o usuário configurar o Twilio, aqui faríamos o fetch para a API do Twilio
    /*
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN")
    if (twilioSid && twilioToken) {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: 'whatsapp:+14155238886', // Twilio Sandbox Number
          To: `whatsapp:+${adminPhone}`,
          Body: `Novo contato de ${customerName}: ${message}`
        })
      })
    }
    */

    return new Response(
      JSON.stringify({ success: true, message: 'Mensagem enviada com sucesso!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})