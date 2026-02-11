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
    const { cookie } = await req.json()
    if (!cookie || typeof cookie !== 'string') {
      return respond({ success: false, message: 'Cookie mancante' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date().toISOString()

    // Save cookie
    await supabase.from('app_settings').upsert(
      { key: 'wca_session_cookie', value: cookie, updated_at: now },
      { onConflict: 'key' }
    )

    // Verify it works
    const authenticated = await testCookie(cookie)
    const status = authenticated ? 'ok' : 'expired'

    await supabase.from('app_settings').upsert(
      { key: 'wca_session_status', value: status, updated_at: now },
      { onConflict: 'key' }
    )
    await supabase.from('app_settings').upsert(
      { key: 'wca_session_checked_at', value: now, updated_at: now },
      { onConflict: 'key' }
    )

    console.log(`save-wca-cookie: saved and verified, authenticated=${authenticated}`)

    return respond({
      success: true,
      authenticated,
      message: authenticated
        ? '✅ Cookie salvato e verificato! Sessione attiva.'
        : '⚠️ Cookie salvato ma non sembra funzionare. Assicurati di essere loggato su wcaworld.com.',
    })
  } catch (error) {
    console.error('save-wca-cookie error:', error)
    return respond(
      { success: false, message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto') },
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
    const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html)
    const hasPhone = /\+?\d[\d\s\-().]{7,}/.test(html)
    const hasContactSection = /contact.*details|email.*address|phone.*number/i.test(html)
    const hasLoginPrompt = /please\s*log\s*in|sign\s*in\s*to\s*view|login\s*required/i.test(html)
    const hasLogoutLink = /logout|log\s*out|sign\s*out/i.test(html)
    const authenticated = !hasLoginPrompt && (hasEmail || hasPhone || hasContactSection || hasLogoutLink)
    console.log(`Cookie test: hasEmail=${hasEmail}, hasPhone=${hasPhone}, hasLogout=${hasLogoutLink}, authenticated=${authenticated}`)
    return authenticated
  } catch (e) {
    console.error('Cookie test error:', e)
    return false
  }
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
