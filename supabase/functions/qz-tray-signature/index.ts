import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const normalizePem = (pem: string, label: string) => {
  const header = `-----BEGIN ${label}-----`
  const footer = `-----END ${label}-----`
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(header, '')
    .replace(footer, '')
    .replace(/\s/g, '')

  return `${header}\n${body.match(/.{1,64}/g)?.join('\n') ?? body}\n${footer}`
}

serve(async (req) => {
  const url = new URL(req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const globalHeaders: Record<string, string> = {}
    if (authHeader) {
      globalHeaders.Authorization = authHeader
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: globalHeaders,
        },
      }
    )

    // Get user
    const { data: { user } } = await supabaseClient.auth.getUser()

    // 1. Handle GET /qz/certificate
    if (req.method === 'GET') {
      let certificatePEM = ''

      // Check if user has a custom certificate
      if (user) {
        const { data: loja } = await supabaseClient
          .from('lojas')
          .select('qz_certificate')
          .eq('user_id', user.id)
          .single()
        
        if (loja?.qz_certificate) {
          certificatePEM = loja.qz_certificate
        }
      }

      // Fallback to global env var if no store-specific cert
      if (!certificatePEM) {
        certificatePEM = Deno.env.get('QZ_CERTIFICATE') || ''
      }

      if (!certificatePEM) {
        return new Response(JSON.stringify({ error: 'CERTIFICATE_NOT_SET' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }
      
      return new Response(normalizePem(certificatePEM, 'CERTIFICATE'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 200,
      })
    }

    // 2. Handle POST /qz/sign
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const request = body.request;
      
      if (!request) {
        return new Response(JSON.stringify({ error: 'Missing request body' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Private key is ALWAYS from ENV for security (users shouldn't upload private keys to a public DB table easily)
      // unless we had an encrypted way. For now, we use the system's key.
      const privateKeyPEM = Deno.env.get('QZ_PRIVATE_KEY')
      if (!privateKeyPEM) {
        return new Response(JSON.stringify({ error: 'SIGNATURE_KEY_NOT_SET' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, 
        })
      }

      // Import the private key
      const normalizedPrivateKey = normalizePem(privateKeyPEM, 'PRIVATE KEY')
      const keyData = normalizedPrivateKey
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s/g, '')
      const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))

      const key = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['sign']
      )

      // Sign the request data
      const encoder = new TextEncoder()
      const dataToSign = encoder.encode(request)
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        dataToSign
      )

      // Convert signature to base64
      const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))

      return new Response(base64Signature, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
