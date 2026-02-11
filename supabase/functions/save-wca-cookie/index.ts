import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

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
    const hasAspxAuth = cookie.includes('.ASPXAUTH=')

    console.log(`save-wca-cookie: received cookie (${cookie.length} chars), hasAspxAuth=${hasAspxAuth}`)

    // Save cookie — use wca_auth_cookie key if it contains .ASPXAUTH
    const cookieKey = hasAspxAuth ? 'wca_auth_cookie' : 'wca_session_cookie'
    await supabase.from('app_settings').upsert(
      { key: cookieKey, value: cookie, updated_at: now },
      { onConflict: 'key' }
    )
    // Also save to the other key for compatibility
    await supabase.from('app_settings').upsert(
      { key: 'wca_session_cookie', value: cookie, updated_at: now },
      { onConflict: 'key' }
    )

    // Deep verify: check private contact visibility
    const testResult = await testCookieDeep(cookie)
    const status = testResult.authenticated ? 'ok' : 'expired'

    await supabase.from('app_settings').upsert(
      { key: 'wca_session_status', value: status, updated_at: now },
      { onConflict: 'key' }
    )
    await supabase.from('app_settings').upsert(
      { key: 'wca_session_checked_at', value: now, updated_at: now },
      { onConflict: 'key' }
    )

    console.log(`save-wca-cookie: saved and deep-verified, authenticated=${testResult.authenticated}`)

    let message: string
    if (testResult.authenticated) {
      message = '✅ Cookie salvato e verificato! Contatti personali visibili.'
    } else if (hasAspxAuth) {
      message = '⚠️ Cookie con .ASPXAUTH salvato ma i contatti personali non sono visibili. Sessione potrebbe essere scaduta.'
    } else {
      message = '❌ Cookie salvato ma MANCA .ASPXAUTH — i dati privati non saranno accessibili. Rilogga su wcaworld.com e riprova.'
    }

    return respond({
      success: true,
      authenticated: testResult.authenticated,
      hasAspxAuth,
      diagnostics: testResult.diagnostics,
      message,
    })
  } catch (error) {
    console.error('save-wca-cookie error:', error)
    return respond(
      { success: false, message: 'Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto') },
      500
    )
  }
})

async function testCookieDeep(cookie: string): Promise<{ authenticated: boolean; diagnostics: Record<string, any> }> {
  try {
    const res = await fetch('https://www.wcaworld.com/directory/members/86580', {
      method: 'GET',
      headers: { 'Cookie': cookie, 'User-Agent': UA },
    })
    const html = await res.text()
    
    const hasLoginPrompt = /please\s*log\s*in|sign\s*in\s*to\s*view|login\s*required/i.test(html)
    const membersOnlyCount = (html.match(/Members\s*only/gi) || []).length
    
    const contactBlocks = html.split(/contactperson_row/).slice(1)
    let contactsWithRealName = 0
    let contactsWithEmail = 0
    
    for (const block of contactBlocks) {
      const nameMatch = block.match(/profile_label">[^<]*Name[^<]*<\/div>[\s\S]*?profile_val">\s*([^<]+)/i)
      const name = nameMatch?.[1]?.trim()
      if (name && !/Members\s*only|Login/i.test(name) && name.length > 2) {
        contactsWithRealName++
      }
      const emailMatch = block.match(/profile_label">[^<]*Email[^<]*<\/div>[\s\S]*?profile_val">[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      if (emailMatch) contactsWithEmail++
    }
    
    const authenticated = !hasLoginPrompt && contactBlocks.length > 0 && contactsWithRealName > 0
    
    const diagnostics = {
      membersOnlyCount,
      contactsTotal: contactBlocks.length,
      contactsWithRealName,
      contactsWithEmail,
      hasAspxAuth: cookie.includes('.ASPXAUTH='),
    }
    
    console.log(`testCookieDeep: realNames=${contactsWithRealName}, emails=${contactsWithEmail}, membersOnly=${membersOnlyCount}, auth=${authenticated}`)
    return { authenticated, diagnostics }
  } catch (e) {
    console.error('testCookieDeep error:', e)
    return { authenticated: false, diagnostics: { error: String(e) } }
  }
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
