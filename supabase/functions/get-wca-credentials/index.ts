import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Soft auth: try to identify user, but don't block if it fails (extension uses anon key)
    let userId: string | null = null
    try {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user }, error } = await authClient.auth.getUser(token)
      if (!error && user) {
        userId = user.id
      }
    } catch (e) {
      console.log('get-wca-credentials: auth check failed (extension call?)', e?.message)
    }

    // If authenticated user, try per-user credentials first
    if (userId) {
      const { data: userCreds } = await supabase
        .from('user_wca_credentials')
        .select('wca_username, wca_password')
        .eq('user_id', userId)
        .maybeSingle()

      if (userCreds?.wca_username && userCreds?.wca_password) {
        return new Response(JSON.stringify({
          username: userCreds.wca_username,
          password: userCreds.wca_password,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Fallback: app_settings (used by extensions and as legacy fallback)
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wca_username', 'wca_password'])

    if (error) throw error

    const settings: Record<string, string> = {}
    data?.forEach((row: any) => { settings[row.key] = row.value })

    return new Response(JSON.stringify({
      username: settings['wca_username'] || '',
      password: settings['wca_password'] || '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('get-wca-credentials error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
