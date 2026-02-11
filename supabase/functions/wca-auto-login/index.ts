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
    // 1. Get saved credentials
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

    // 2. Get the login page first to obtain any anti-forgery tokens
    const loginPageRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'GET',
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    })
    
    const loginPageHtml = await loginPageRes.text()
    const loginPageCookies = extractSetCookies(loginPageRes)
    
    console.log(`Login page: status=${loginPageRes.status}, cookies=${loginPageCookies.length}`)

    // Extract __RequestVerificationToken from hidden input
    const tokenMatch = loginPageHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)
    const verificationToken = tokenMatch ? tokenMatch[1] : ''
    
    console.log(`Verification token found: ${!!verificationToken}`)

    // 3. Build cookie string from login page
    const cookieJar = loginPageCookies.join('; ')

    // 4. POST login form
    const formBody = new URLSearchParams({
      'Username': username,
      'Password': password,
      '__RequestVerificationToken': verificationToken,
      'RememberMe': 'true',
    })

    const loginRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieJar,
        'Origin': 'https://www.wcaworld.com',
        'Referer': 'https://www.wcaworld.com/Account/Login',
      },
      body: formBody.toString(),
      redirect: 'manual',
    })

    const loginStatus = loginRes.status
    const loginCookies = extractSetCookies(loginRes)
    const locationHeader = loginRes.headers.get('location') || ''
    
    console.log(`Login POST: status=${loginStatus}, location=${locationHeader}, newCookies=${loginCookies.length}`)

    // 5. Merge all cookies
    const allCookies = mergeCookies(loginPageCookies, loginCookies)
    const fullCookieStr = allCookies.join('; ')

    // Check if we got auth cookies
    const hasAuthCookie = allCookies.some(c => 
      c.startsWith('.ASPXAUTH=') || 
      c.startsWith('__AntiXsrfToken=') ||
      c.startsWith('.AspNet.ApplicationCookie=')
    )

    console.log(`Has auth cookie: ${hasAuthCookie}, total cookies: ${allCookies.length}`)

    // 6. Follow redirect if any to collect more cookies
    let finalCookieStr = fullCookieStr
    if (locationHeader && (loginStatus === 301 || loginStatus === 302)) {
      const redirectUrl = locationHeader.startsWith('http') 
        ? locationHeader 
        : `https://www.wcaworld.com${locationHeader}`
      
      const redirectRes = await fetch(redirectUrl, {
        method: 'GET',
        headers: {
          'User-Agent': UA,
          'Cookie': fullCookieStr,
        },
        redirect: 'manual',
      })
      
      const redirectCookies = extractSetCookies(redirectRes)
      const mergedAfterRedirect = mergeCookies(allCookies.map(c => c), redirectCookies)
      finalCookieStr = mergedAfterRedirect.join('; ')
      
      console.log(`Redirect: status=${redirectRes.status}, newCookies=${redirectCookies.length}`)
    }

    // 7. Verify the cookie works
    const authenticated = await testCookie(finalCookieStr)
    const now = new Date().toISOString()

    if (authenticated) {
      // Save the new cookie
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
      
      console.log('wca-auto-login: SUCCESS - cookie saved and verified')
      return respond({ success: true, authenticated: true, message: '✅ Login automatico riuscito!' })
    } else {
      await supabase.from('app_settings').upsert(
        { key: 'wca_session_status', value: 'expired', updated_at: now },
        { onConflict: 'key' }
      )
      
      console.log('wca-auto-login: FAILED - login did not produce valid session')
      return respond({ 
        success: false, 
        authenticated: false, 
        message: '⚠️ Login eseguito ma la sessione non è valida. Possibile blocco WAF/Cloudflare.',
        debug: { loginStatus, hasAuthCookie, locationHeader, cookieCount: allCookies.length }
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

function extractSetCookies(res: Response): string[] {
  const cookies: string[] = []
  // Deno's headers.getSetCookie() or iterate
  const raw = res.headers.getSetCookie?.() || []
  for (const c of raw) {
    // Extract just name=value part
    const nameValue = c.split(';')[0].trim()
    if (nameValue && nameValue.includes('=')) {
      cookies.push(nameValue)
    }
  }
  return cookies
}

function mergeCookies(existing: string[], newCookies: string[]): string[] {
  const map = new Map<string, string>()
  for (const c of existing) {
    const eqIdx = c.indexOf('=')
    if (eqIdx > 0) {
      map.set(c.substring(0, eqIdx), c)
    }
  }
  for (const c of newCookies) {
    const eqIdx = c.indexOf('=')
    if (eqIdx > 0) {
      map.set(c.substring(0, eqIdx), c)
    }
  }
  return Array.from(map.values())
}

async function testCookie(cookie: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.wcaworld.com/directory/members/86580', {
      method: 'GET',
      headers: { 'Cookie': cookie, 'User-Agent': UA },
    })
    const html = await res.text()
    const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html)
    const hasPhone = /\+?\d[\d\s\-().]{7,}/.test(html)
    const hasLogoutLink = /logout|log\s*out|sign\s*out/i.test(html)
    const hasLoginPrompt = /please\s*log\s*in|sign\s*in\s*to\s*view|login\s*required/i.test(html)
    const authenticated = !hasLoginPrompt && (hasEmail || hasPhone || hasLogoutLink)
    console.log(`testCookie: hasEmail=${hasEmail}, hasPhone=${hasPhone}, hasLogout=${hasLogoutLink}, auth=${authenticated}`)
    return authenticated
  } catch (e) {
    console.error('testCookie error:', e)
    return false
  }
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
