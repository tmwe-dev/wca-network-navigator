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
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wca_session_cookie', 'wca_auth_cookie'])

    const map: Record<string, string> = {}
    for (const s of (settings || [])) {
      if (s.key && s.value) map[s.key] = s.value
    }

    const cookie = map['wca_auth_cookie'] || map['wca_session_cookie'] || Deno.env.get('WCA_SESSION_COOKIE') || null

    if (!cookie) {
      await upsertStatus(supabase, 'no_cookie', new Date().toISOString())
      return respond({ authenticated: false, status: 'no_cookie' })
    }

    const authenticated = await testCookie(cookie)
    const status = authenticated ? 'ok' : 'expired'
    await upsertStatus(supabase, status, new Date().toISOString())

    return respond({ authenticated, status, checkedAt: new Date().toISOString() })
  } catch (error) {
    console.error('check-wca-session error:', error)
    return respond(
      { authenticated: false, reason: 'error', error: error instanceof Error ? error.message : 'Unknown' },
      500
    )
  }
})

async function testCookie(cookie: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.wcaworld.com/directory/members/86580', {
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
    console.log(`Cookie test: membersOnly=${membersOnlyCount}x, authenticated=${authenticated}`)
    return authenticated
  } catch (e) {
    console.error('Cookie test error:', e)
    return false
  }
}

async function upsertStatus(supabase: any, status: string, checkedAt: string) {
  const now = new Date().toISOString()
  await supabase.from('app_settings').upsert(
    { key: 'wca_session_status', value: status, updated_at: now },
    { onConflict: 'key' }
  )
  await supabase.from('app_settings').upsert(
    { key: 'wca_session_checked_at', value: checkedAt, updated_at: now },
    { onConflict: 'key' }
  )
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
