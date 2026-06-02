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

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, last_activity, last_notification_sent')
      .lt('last_activity', yesterday)

    if (profileError) throw profileError

    console.log(`Checking for inactive students since: ${yesterday}`);
    const results = []

    for (const profile of profiles) {
      // Verificar se já recebeu notificação nas últimas 24h
      if (profile.last_notification_sent && new Date(profile.last_notification_sent) > new Date(yesterday)) {
        continue;
      }

      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('subscription_data')
        .eq('user_id', profile.id)

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              sub.subscription_data,
              JSON.stringify({
                title: 'Falaê Brasil!',
                body: 'Vamos retomar o English? Lembre-se: inglês transversal é todos os dias. Cheers.',
                url: '/'
              })
            )
          } catch (e) {
            console.error('Erro ao enviar push:', e)
          }
        }

        await supabase
          .from('profiles')
          .update({ last_notification_sent: new Date().toISOString() })
          .eq('id', profile.id)
        
        results.push({ userId: profile.id, status: 'sent' })
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
