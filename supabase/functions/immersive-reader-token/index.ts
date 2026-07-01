import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const tenantId = Deno.env.get('AZURE_IR_TENANT_ID')
    const clientId = Deno.env.get('AZURE_IR_CLIENT_ID')
    const clientSecret = Deno.env.get('AZURE_IR_CLIENT_SECRET')
    const subdomain = Deno.env.get('AZURE_IR_SUBDOMAIN')

    if (!tenantId || !clientId || !clientSecret || !subdomain) {
      return new Response(
        JSON.stringify({ error: 'Missing Azure Immersive Reader configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const form = new URLSearchParams()
    form.set('grant_type', 'client_credentials')
    form.set('client_id', clientId)
    form.set('client_secret', clientSecret)
    form.set('resource', 'https://cognitiveservices.azure.com/')

    const tokenRes = await fetch(
      `https://login.windows.net/${tenantId}/oauth2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      },
    )

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Azure token error', tokenData)
      return new Response(
        JSON.stringify({ error: 'Failed to obtain Azure token', details: tokenData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // The Immersive Reader SDK expects the bare subdomain (e.g. "falaebrasil-immersive"),
    // not the full endpoint URL. Normalize in case the secret was set as a URL.
    const normalized = subdomain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.cognitiveservices\.azure\.com$/i, '')

    return new Response(
      JSON.stringify({ token: tokenData.access_token, subdomain: normalized }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('immersive-reader-token error', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})