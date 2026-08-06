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
    const serviceKeyEarly = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
    const providedCronSecret = req.headers.get('x-cron-secret') ?? ''
    const isCron = !!cronSecret && providedCronSecret === cronSecret

    // Auth guard: the cron secret, the service role, or an admin may invoke this.
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!isCron && !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const serviceKey = serviceKeyEarly

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey
    )

    if (!isCron && token !== serviceKey) {
      const { data: userData } = await supabase.auth.getUser(token)
      if (!userData?.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: userData.user.id,
        _role: 'admin',
      })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

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
      .select('id, user_id, last_activity, last_notification_sent')
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
        .eq('user_id', profile.user_id)

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          try {
            console.log(`Sending notification to user ${profile.user_id}`);
            await webpush.sendNotification(
              sub.subscription_data,
              JSON.stringify({
                title: 'Falaê Brasil!',
                body: 'Vamos retomar o English? Lembre-se: inglês transversal é todos os dias. Cheers.',
                url: '/'
              })
            )
          } catch (e) {
            console.error(`Error sending push to user ${profile.user_id}:`, e)
          }
        }

        await supabase
          .from('profiles')
          .update({ last_notification_sent: new Date().toISOString() })
          .eq('id', profile.id)
        
        results.push({ userId: profile.user_id, status: 'sent' })
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
