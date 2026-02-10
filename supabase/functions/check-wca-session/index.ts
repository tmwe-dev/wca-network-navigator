import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Read cookies from app_settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wca_session_cookie', 'wca_auth_cookie'])

    let cookie: string | null = null
    for (const s of (settings || [])) {
      if (s.key === 'wca_auth_cookie' && s.value) cookie = s.value
      if (s.key === 'wca_session_cookie' && s.value && !cookie) cookie = s.value
    }

    // Also check env
    if (!cookie) cookie = Deno.env.get('WCA_SESSION_COOKIE') || null

    if (!cookie) {
      await upsertStatus(supabase, 'no_cookie', null)
      return respond({ authenticated: false, reason: 'no_cookie' })
    }

    // Fetch a known profile (ID 86580) to test auth
    const testUrl = 'https://www.wcaworld.com/directory/members/86580'
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const html = await res.text()

    const membersOnlyCount = (html.match(/Members\s*only/gi) || []).length
    const hasLoginPrompt = /please\s*Login|Login\s*to\s*view/i.test(html)
    const authenticated = membersOnlyCount < 3 && !hasLoginPrompt

    console.log(`WCA session check: status=${res.status}, membersOnly=${membersOnlyCount}x, loginPrompt=${hasLoginPrompt}, authenticated=${authenticated}`)

    const status = authenticated ? 'ok' : 'expired'
    await upsertStatus(supabase, status, new Date().toISOString())

    return respond({
      authenticated,
      status,
      checkedAt: new Date().toISOString(),
      reason: authenticated ? 'session_valid' : 'members_only_detected',
      membersOnlyCount,
    })
  } catch (error) {
    console.error('check-wca-session error:', error)
    return respond(
      { authenticated: false, reason: 'error', error: error instanceof Error ? error.message : 'Unknown' },
      500
    )
  }
})

async function upsertStatus(supabase: any, status: string, checkedAt: string | null) {
  const now = new Date().toISOString()
  await supabase.from('app_settings').upsert(
    { key: 'wca_session_status', value: status, updated_at: now },
    { onConflict: 'key' }
  )
  await supabase.from('app_settings').upsert(
    { key: 'wca_session_checked_at', value: checkedAt || now, updated_at: now },
    { onConflict: 'key' }
  )
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
