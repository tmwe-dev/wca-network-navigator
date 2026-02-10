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
      .in('key', ['wca_session_cookie', 'wca_auth_cookie', 'wca_username', 'wca_password'])

    const map: Record<string, string> = {}
    for (const s of (settings || [])) {
      if (s.key && s.value) map[s.key] = s.value
    }

    let cookie = map['wca_auth_cookie'] || map['wca_session_cookie'] || Deno.env.get('WCA_SESSION_COOKIE') || null

    // Step 1: Test existing cookie
    let authenticated = false
    if (cookie) {
      authenticated = await testCookie(cookie)
    }

    // Step 2: If not authenticated, try auto-login
    if (!authenticated) {
      const username = map['wca_username']
      const password = map['wca_password']

      if (!username || !password) {
        await upsertStatus(supabase, cookie ? 'expired' : 'no_cookie', new Date().toISOString())
        return respond({
          authenticated: false,
          reason: !cookie ? 'no_cookie' : 'expired',
          autoLoginAttempted: false,
          message: 'Credenziali WCA non configurate',
        })
      }

      console.log('Cookie expired/missing, attempting auto-login...')
      const loginResult = await directWcaLogin(username, password)

      if (loginResult.success && loginResult.cookies) {
        const newAuth = await testCookie(loginResult.cookies)
        if (newAuth) {
          cookie = loginResult.cookies
          authenticated = true
          await supabase.from('app_settings').upsert(
            { key: 'wca_session_cookie', value: cookie, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
          console.log('Auto-login successful, new cookie saved')
        } else {
          console.log('Auto-login got cookies but they dont work')
        }
      } else {
        console.log(`Auto-login failed: ${loginResult.error}`)
      }
    }

    const status = authenticated ? 'ok' : 'expired'
    await upsertStatus(supabase, status, new Date().toISOString())

    return respond({
      authenticated,
      status,
      checkedAt: new Date().toISOString(),
      autoLoginAttempted: true,
    })
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

async function directWcaLogin(username: string, password: string): Promise<{ cookies: string; success: boolean; error?: string }> {
  try {
    // Step 1: GET login page to get CSRF token and cookies
    const loginPageRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    })
    const loginPageHtml = await loginPageRes.text()
    const setCookies1 = loginPageRes.headers.getSetCookie?.() || []

    // Extract verification tokens (page may have multiple forms)
    const allTokens: string[] = []
    const tokenRegex = /name="__RequestVerificationToken"[^>]*value="([^"]*)"/gi
    const tokenRegex2 = /value="([^"]*)"[^>]*name="__RequestVerificationToken"/gi
    let tm
    while ((tm = tokenRegex.exec(loginPageHtml)) !== null) allTokens.push(tm[1])
    tokenRegex2.lastIndex = 0
    while ((tm = tokenRegex2.exec(loginPageHtml)) !== null) allTokens.push(tm[1])
    const uniqueTokens = [...new Set(allTokens)]
    const token = uniqueTokens[uniqueTokens.length - 1] || ''

    const cookieJar: string[] = setCookies1.map(sc => sc.split(';')[0])

    // Step 2: POST login - send both usr/pwd AND Username/Password for compatibility
    const formParams: Record<string, string> = {
      __RequestVerificationToken: token,
      usr: username,
      pwd: password,
      Username: username,
      Password: password,
    }
    const formBody = new URLSearchParams(formParams)

    const loginRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieJar.join('; '),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.wcaworld.com/Account/Login',
        'Origin': 'https://www.wcaworld.com',
      },
      body: formBody.toString(),
    })

    const setCookies2 = loginRes.headers.getSetCookie?.() || []
    for (const sc of setCookies2) {
      const val = sc.split(';')[0]
      const name = val.split('=')[0]
      const idx = cookieJar.findIndex(c => c.startsWith(name + '='))
      if (idx >= 0) cookieJar[idx] = val
      else cookieJar.push(val)
    }

    const isRedirect = loginRes.status >= 300 && loginRes.status < 400
    if (isRedirect) {
      const location = loginRes.headers.get('Location')
      if (location) {
        const redirectUrl = location.startsWith('http') ? location : `https://www.wcaworld.com${location}`
        const redirectRes = await fetch(redirectUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'Cookie': cookieJar.join('; '),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })
        const setCookies3 = redirectRes.headers.getSetCookie?.() || []
        for (const sc of setCookies3) {
          const val = sc.split(';')[0]
          const name = val.split('=')[0]
          const idx = cookieJar.findIndex(c => c.startsWith(name + '='))
          if (idx >= 0) cookieJar[idx] = val
          else cookieJar.push(val)
        }
      }
    }

    const hasAuthCookie = cookieJar.some(c => c.startsWith('.ASPXAUTH='))
    const allCookies = cookieJar.join('; ')
    console.log(`Direct login: hasASPXAUTH=${hasAuthCookie}, status=${loginRes.status}`)

    if (hasAuthCookie || isRedirect) {
      return { cookies: allCookies, success: true }
    }

    // Extract error message for logging
    try {
      const bodyText = await loginRes.text()
      const validationMatch = bodyText.match(/validation-summary[^>]*>([\s\S]{0,500}?)<\/div/i)
      const errorMsg = validationMatch?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (errorMsg) console.log(`Direct login error: ${errorMsg}`)
    } catch {}

    return { cookies: allCookies, success: false, error: `Login failed (status ${loginRes.status})` }
  } catch (err) {
    console.error('Direct login error:', err)
    return { cookies: '', success: false, error: err instanceof Error ? err.message : 'Login failed' }
  }
}

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
