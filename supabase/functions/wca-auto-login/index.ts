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
    // ── Auth check ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return respond({ success: false, error: 'Unauthorized' }, 401)
    }
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (claimsError || !claimsData?.claims?.sub) {
      return respond({ success: false, error: 'Unauthorized' }, 401)
    }

    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wca_username', 'wca_password'])

    const map: Record<string, string> = {}
    for (const s of (settings || [])) {
      if (s.key && s.value) map[s.key] = s.value
    }

    const username = map['wca_username']
    const password = map['wca_password']

    if (!username || !password) {
      return respond({ success: false, error: 'Credenziali WCA non configurate in app_settings' }, 400)
    }

    console.log(`wca-auto-login: attempting login for user "${username}"`)

    // Step 1: GET login page
    const loginPageRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'GET',
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    })
    
    const loginPageHtml = await loginPageRes.text()
    const cookieJar = extractAndMergeCookies([], loginPageRes)
    
    console.log(`Login page: status=${loginPageRes.status}, cookies=${cookieJar.length}, names=${cookieJar.map(c => c.split('=')[0]).join(',')}`)

    // Extract __RequestVerificationToken
    const tokenMatch = loginPageHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)
    const verificationToken = tokenMatch ? tokenMatch[1] : ''
    console.log(`Verification token found: ${!!verificationToken}`)

    // WCA login form field names (verified)
    const usernameField = 'Username'
    const passwordField = 'Password'
    console.log(`Form fields: username=${usernameField}, password=${passwordField}`)

    // Step 2: POST login
    const formBody = new URLSearchParams({
      [usernameField]: username,
      [passwordField]: password,
      '__RequestVerificationToken': verificationToken,
      'RememberMe': 'true',
    })

    const loginRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieJar.join('; '),
        'Origin': 'https://www.wcaworld.com',
        'Referer': 'https://www.wcaworld.com/Account/Login',
      },
      body: formBody.toString(),
      redirect: 'manual',
    })

    const postCookies = extractAndMergeCookies(cookieJar, loginRes)
    const locationHeader = loginRes.headers.get('location') || ''
    
    console.log(`Login POST: status=${loginRes.status}, location=${locationHeader}, cookies=${postCookies.length}, names=${postCookies.map(c => c.split('=')[0]).join(',')}`)

    // Step 3: Follow ALL redirects manually, collecting cookies at each step
    let currentCookies = postCookies
    let redirectUrl = locationHeader
    let redirectCount = 0
    const maxRedirects = 5

    while (redirectUrl && redirectCount < maxRedirects) {
      redirectCount++
      const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `https://www.wcaworld.com${redirectUrl}`
      console.log(`Following redirect ${redirectCount}: ${fullUrl}`)
      
      const redirectRes = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'User-Agent': UA,
          'Cookie': currentCookies.join('; '),
        },
        redirect: 'manual',
      })
      
      currentCookies = extractAndMergeCookies(currentCookies, redirectRes)
      console.log(`Redirect ${redirectCount}: status=${redirectRes.status}, cookies=${currentCookies.length}, names=${currentCookies.map(c => c.split('=')[0]).join(',')}`)
      
      // Check for further redirect
      const nextLocation = redirectRes.headers.get('location')
      if (redirectRes.status >= 300 && redirectRes.status < 400 && nextLocation) {
        redirectUrl = nextLocation
      } else {
        redirectUrl = ''
      }
    }

    const finalCookieStr = currentCookies.join('; ')
    const hasAspxAuth = currentCookies.some(c => c.startsWith('.ASPXAUTH=') || c.startsWith('.AspNet.ApplicationCookie='))

    console.log(`Final: hasAspxAuth=${hasAspxAuth}, totalCookies=${currentCookies.length}, redirects=${redirectCount}`)

    if (!hasAspxAuth) {
      console.log('wca-auto-login: FAILED — .ASPXAUTH not found after all redirects')
      const now = new Date().toISOString()
      await supabase.from('app_settings').upsert(
        { key: 'wca_session_status', value: 'expired', updated_at: now },
        { onConflict: 'key' }
      )
      return respond({ 
        success: false, 
        authenticated: false, 
        message: '❌ Login eseguito ma .ASPXAUTH non ottenuto. Possibile blocco WAF/Cloudflare. Usa l\'estensione Chrome.',
        debug: { redirectCount, cookieCount: currentCookies.length, cookieNames: currentCookies.map(c => c.split('=')[0]) }
      })
    }

    // Step 4: Deep verify with the obtained cookie
    const testResult = await testCookieDeep(finalCookieStr)
    const now = new Date().toISOString()

    if (testResult.authenticated) {
      // Save as wca_auth_cookie (primary) and wca_session_cookie (compat)
      await supabase.from('app_settings').upsert(
        { key: 'wca_auth_cookie', value: finalCookieStr, updated_at: now },
        { onConflict: 'key' }
      )
      await supabase.from('app_settings').upsert(
        { key: 'wca_session_cookie', value: finalCookieStr, updated_at: now },
        { onConflict: 'key' }
      )
      await supabase.from('app_settings').upsert(
        { key: 'wca_session_status', value: 'ok', updated_at: now },
        { onConflict: 'key' }
      )
      await supabase.from('app_settings').upsert(
        { key: 'wca_session_checked_at', value: now, updated_at: now },
        { onConflict: 'key' }
      )
      
      console.log('wca-auto-login: SUCCESS — cookie saved and deep-verified')
      return respond({ 
        success: true, 
        authenticated: true, 
        message: '✅ Login automatico riuscito! Contatti personali visibili.',
        diagnostics: testResult.diagnostics,
      })
    } else {
      await supabase.from('app_settings').upsert(
        { key: 'wca_session_status', value: 'expired', updated_at: now },
        { onConflict: 'key' }
      )
      
      console.log('wca-auto-login: FAILED — .ASPXAUTH present but private contacts not visible')
      return respond({ 
        success: false, 
        authenticated: false, 
        message: '⚠️ Login eseguito con .ASPXAUTH ma i contatti personali non sono visibili. Account potrebbe non avere i permessi.',
        diagnostics: testResult.diagnostics,
      })
    }
  } catch (error) {
    console.error('wca-auto-login error:', error)
    return respond(
      { success: false, error: error instanceof Error ? error.message : 'Errore sconosciuto' },
      500
    )
  }
})

function extractAndMergeCookies(existing: string[], res: Response): string[] {
  const merged = new Map<string, string>()
  for (const c of existing) {
    const eqIdx = c.indexOf('=')
    if (eqIdx > 0) merged.set(c.substring(0, eqIdx), c)
  }
  const raw = res.headers.getSetCookie?.() || []
  for (const c of raw) {
    const nameValue = c.split(';')[0].trim()
    if (nameValue && nameValue.includes('=')) {
      const eqIdx = nameValue.indexOf('=')
      merged.set(nameValue.substring(0, eqIdx), nameValue)
    }
  }
  return Array.from(merged.values())
}

function detectFieldName(html: string, type: string): string | null {
  const regex = new RegExp(`<input[^>]*type="${type}"[^>]*name="([^"]+)"`, 'i')
  const match = html.match(regex)
  if (match) return match[1]
  const regex2 = new RegExp(`<input[^>]*name="([^"]+)"[^>]*type="${type}"`, 'i')
  const match2 = html.match(regex2)
  return match2?.[1] || null
}

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
