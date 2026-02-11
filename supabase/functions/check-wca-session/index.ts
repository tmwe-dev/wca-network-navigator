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

    // Prefer wca_auth_cookie (should contain .ASPXAUTH)
    const cookie = map['wca_auth_cookie'] || map['wca_session_cookie'] || Deno.env.get('WCA_SESSION_COOKIE') || null

    if (!cookie) {
      await upsertStatus(supabase, 'no_cookie', new Date().toISOString())
      return respond({ authenticated: false, status: 'no_cookie' })
    }

    // Check if .ASPXAUTH is present in cookie (diagnostic only)
    const hasAspxAuth = cookie.includes('.ASPXAUTH=')
    
    const testResult = await testCookieDeep(cookie)
    // Trust the real test result. Only fall back to ASPXAUTH if network error prevented the test.
    let authenticated = testResult.diagnostics?.error
      ? hasAspxAuth  // Network/WAF error: trust ASPXAUTH as fallback
      : testResult.authenticated  // Test succeeded: trust the result

    // AUTO-RENEW: if expired, try wca-auto-login to get a fresh cookie
    if (!authenticated) {
      console.log('check-wca-session: session expired, attempting auto-login renewal...')
      try {
        const autoLoginUrl = `${supabaseUrl}/functions/v1/wca-auto-login`
        const autoRes = await fetch(autoLoginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
        })
        const autoData = await autoRes.json()
        console.log('check-wca-session: auto-login result:', JSON.stringify(autoData))
        if (autoData.success && autoData.authenticated) {
          authenticated = true
          const now = new Date().toISOString()
          await upsertStatus(supabase, 'ok', now)
          return respond({
            authenticated: true,
            status: 'ok',
            checkedAt: now,
            hasAspxAuth: true,
            diagnostics: autoData.diagnostics,
            autoRenewed: true,
          })
        }
      } catch (autoErr) {
        console.error('check-wca-session: auto-login failed:', autoErr)
      }
    }

    const status = authenticated ? 'ok' : 'expired'
    await upsertStatus(supabase, status, new Date().toISOString())

    return respond({
      authenticated, 
      status, 
      checkedAt: new Date().toISOString(),
      hasAspxAuth,
      diagnostics: testResult.diagnostics,
    })
  } catch (error) {
    console.error('check-wca-session error:', error)
    return respond(
      { authenticated: false, reason: 'error', error: error instanceof Error ? error.message : 'Unknown' },
      500
    )
  }
})

/**
 * Deep cookie test: verifies that PRIVATE contact data (names, personal emails)
 * is visible, not just public company info.
 */
async function testCookieDeep(cookie: string): Promise<{ authenticated: boolean; diagnostics: Record<string, any> }> {
  try {
    const res = await fetch('https://www.wcaworld.com/directory/members/86580', {
      method: 'GET',
      headers: { 'Cookie': cookie, 'User-Agent': UA },
    })
    const html = await res.text()
    
    // Check for login prompts (definitely not authenticated)
    const hasLoginPrompt = /please\s*log\s*in|sign\s*in\s*to\s*view|login\s*required/i.test(html)
    const hasLogoutLink = /logout|log\s*out|sign\s*out/i.test(html)
    
    // Count "Members only" in contact person sections
    const membersOnlyCount = (html.match(/Members\s*only/gi) || []).length
    
    // Check contactperson_row blocks for REAL names (not "Members only")
    const contactBlocks = html.split(/contactperson_row/).slice(1)
    let contactsWithRealName = 0
    let contactsWithEmail = 0
    let contactsTotal = contactBlocks.length
    
    for (const block of contactBlocks) {
      // Extract Name field value
      const nameMatch = block.match(/profile_label">[^<]*Name[^<]*<\/div>[\s\S]*?profile_val">\s*([^<]+)/i)
      const name = nameMatch?.[1]?.trim()
      if (name && !/Members\s*only|Login/i.test(name) && name.length > 2) {
        contactsWithRealName++
      }
      // Extract Email field value  
      const emailMatch = block.match(/profile_label">[^<]*Email[^<]*<\/div>[\s\S]*?profile_val">[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      if (emailMatch) {
        contactsWithEmail++
      }
    }
    
    // Session is authenticated if we can see private contact data (names OR emails)
    const authenticated = !hasLoginPrompt && contactsTotal > 0 && (contactsWithRealName > 0 || contactsWithEmail > 0)
    
    const diagnostics = {
      hasLoginPrompt,
      hasLogoutLink,
      membersOnlyCount,
      contactsTotal,
      contactsWithRealName,
      contactsWithEmail,
      hasAspxAuth: cookie.includes('.ASPXAUTH='),
      htmlSize: html.length,
    }
    
    console.log(`testCookieDeep: contacts=${contactsTotal}, realNames=${contactsWithRealName}, emails=${contactsWithEmail}, membersOnly=${membersOnlyCount}, logout=${hasLogoutLink}, auth=${authenticated}`)
    
    return { authenticated, diagnostics }
  } catch (e) {
    console.error('testCookieDeep error:', e)
    return { authenticated: false, diagnostics: { error: String(e) } }
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
