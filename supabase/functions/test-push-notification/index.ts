import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

    webpush.setVapidDetails(
      'mailto:pedroalaby@gmail.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_data')
      .eq('user_id', userId)

    if (subError) throw subError
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma inscrição encontrada para este usuário.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const results = []
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          sub.subscription_data,
          JSON.stringify({
            title: 'Falaê Brasil! (Teste)',
            body: 'Teste de notificação push bem-sucedido!',
            url: '/'
          })
        )
        results.push({ endpoint: sub.subscription_data.endpoint, status: 'success' })
      } catch (err) {
        console.error(`Error sending push to ${sub.subscription_data.endpoint}:`, err)
        results.push({ endpoint: sub.subscription_data.endpoint, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
