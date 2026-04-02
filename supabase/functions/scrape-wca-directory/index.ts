import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as cheerio from 'https://esm.sh/cheerio@1.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BASE = 'https://www.wcaworld.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const NETWORK_IDS: Record<string, number> = {
  'WCA First': 1, 'WCA Advanced Professionals': 2, 'WCA China Global': 3,
  'WCA Inter Global': 4, 'Lognet Global': 61, 'Global Affinity Alliance': 98,
  'Elite Global Logistics Network': 108, 'InFinite Connection (IFC8)': 118,
  'WCA Projects': 5, 'WCA Dangerous Goods': 22, 'WCA Perishables': 13,
  'WCA Time Critical': 18, 'WCA Relocations': 15, 'WCA Pharma': 16,
  'WCA Vendors': 38, 'WCA eCommerce Solutions': 107, 'WCA Live Events and Expo': 124,
}
const ALL_NETWORK_IDS = Object.values(NETWORK_IDS)

// ─── Cookie Jar (from wca-app repo auth.js) ──────────────────

function cookieJar() {
  const jar: Record<string, Record<string, string>> = {}
  return {
    add(domain: string, setCookieHeaders: string[]) {
      if (!jar[domain]) jar[domain] = {}
      for (const raw of setCookieHeaders) {
        const c = raw.split(';')[0]
        const eq = c.indexOf('=')
        if (eq > 0) jar[domain][c.substring(0, eq)] = c
      }
    },
    get(domain: string): string {
      if (!jar[domain]) return ''
      return Object.values(jar[domain]).join('; ')
    },
    getAll(): string {
      const all: Record<string, string> = {}
      for (const d of Object.keys(jar)) {
        for (const [k, v] of Object.entries(jar[d])) all[k] = v
      }
      return Object.values(all).join('; ')
    },
    keys(domain: string): string[] {
      if (!jar[domain]) return []
      return Object.keys(jar[domain])
    },
  }
}

// ─── SSO Login (from wca-app repo auth.js) ───────────────────

async function ssoLogin(username: string, password: string): Promise<{ success: boolean; cookies?: string; wcaToken?: string; error?: string }> {
  const WCA_DOMAIN = 'wcaworld.com'
  const SSO_DOMAIN = 'sso.api.wcaworld.com'
  const jar = cookieJar()

  try {
    // Step 1: GET login page → get SSO URL
    let resp = await fetch(`${BASE}/Account/Login`, { headers: { 'User-Agent': UA }, redirect: 'manual' })
    const rawCookies1 = resp.headers.getSetCookie?.() || []
    jar.add(WCA_DOMAIN, rawCookies1)
    let currentUrl = `${BASE}/Account/Login`
    let rc = 0
    while (resp.status >= 300 && resp.status < 400 && rc < 5) {
      const loc = resp.headers.get('location') || ''
      currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href
      resp = await fetch(currentUrl, { headers: { 'User-Agent': UA, 'Cookie': jar.get(WCA_DOMAIN) }, redirect: 'manual' })
      jar.add(WCA_DOMAIN, resp.headers.getSetCookie?.() || [])
      rc++
    }
    const loginHtml = resp.status === 200 ? await resp.text() : ''
    const ssoUrlMatch = loginHtml.match(/action\s*[:=]\s*['"]?(https:\/\/sso\.api\.wcaworld\.com[^'"&\s]+[^'"]*)/i)
    if (!ssoUrlMatch) {
      console.log('[auth] SSO URL not found in login page')
      return { success: false, error: 'SSO URL not found' }
    }
    const ssoUrl = ssoUrlMatch[1].replace(/&amp;/g, '&')
    console.log(`[auth] SSO URL: ${ssoUrl.substring(0, 80)}...`)

    // Step 2: POST credentials to SSO
    const ssoResp = await fetch(ssoUrl, {
      method: 'POST',
      headers: {
        'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://sso.api.wcaworld.com', 'Referer': ssoUrl,
      },
      body: `UserName=${encodeURIComponent(username)}&Password=${encodeURIComponent(password)}&pwd=${encodeURIComponent(password)}`,
      redirect: 'manual',
    })
    jar.add(SSO_DOMAIN, ssoResp.headers.getSetCookie?.() || [])
    const hasAuth = jar.keys(SSO_DOMAIN).includes('.ASPXAUTH')
    console.log(`[auth] SSO POST status=${ssoResp.status} hasAuth=${hasAuth}`)
    if (!hasAuth || ssoResp.status < 300 || ssoResp.status >= 400) {
      return { success: false, error: 'SSO login failed - no auth cookie' }
    }

    // Step 3: Follow redirect chain back to WCA
    let callbackUrl = ssoResp.headers.get('location') || ''
    let followCount = 0
    while (callbackUrl && followCount < 8) {
      const cbUrl = callbackUrl.startsWith('http') ? callbackUrl : new URL(callbackUrl, ssoUrl).href
      const cbDomain = cbUrl.includes('sso.api.wcaworld.com') ? SSO_DOMAIN : WCA_DOMAIN
      const cbResp = await fetch(cbUrl, {
        headers: { 'User-Agent': UA, 'Cookie': jar.get(cbDomain) }, redirect: 'manual',
      })
      jar.add(cbDomain, cbResp.headers.getSetCookie?.() || [])
      const nextLoc = cbResp.headers.get('location') || ''
      if (nextLoc) {
        callbackUrl = nextLoc.startsWith('http') ? nextLoc : new URL(nextLoc, cbUrl).href
      } else {
        callbackUrl = ''
      }
      if (cbResp.status === 200) break
      followCount++
    }

    // Step 4: Warmup /Directory
    let wcaCookies = jar.get(WCA_DOMAIN)
    let wcaToken: string | undefined
    try {
      let wr = await fetch(`${BASE}/Directory`, {
        headers: { 'User-Agent': UA, 'Cookie': wcaCookies }, redirect: 'manual',
      })
      jar.add(WCA_DOMAIN, wr.headers.getSetCookie?.() || [])
      let wLoc = wr.headers.get('location') || ''
      let wCount = 0
      while (wLoc && wCount < 3) {
        const wNext = wLoc.startsWith('http') ? wLoc : new URL(wLoc, `${BASE}/Directory`).href
        wr = await fetch(wNext, { headers: { 'User-Agent': UA, 'Cookie': jar.get(WCA_DOMAIN) }, redirect: 'manual' })
        jar.add(WCA_DOMAIN, wr.headers.getSetCookie?.() || [])
        wLoc = wr.headers.get('location') || ''
        wCount++
      }
      wcaCookies = jar.get(WCA_DOMAIN)
      if (wr.status === 200) {
        const wHtml = await wr.text()
        const tokenMatch = wHtml.match(/window\.wca\.token\s*=\s*['"]([^'"]+)['"]/) ||
          wHtml.match(/wca\.token\s*=\s*['"]([^'"]+)['"]/)
        if (tokenMatch) wcaToken = tokenMatch[1]
      }
    } catch (e) {
      console.log(`[auth] Warmup error: ${e}`)
    }

    console.log(`[auth] SSO login complete: cookieLen=${wcaCookies.length} hasToken=${!!wcaToken}`)
    return { success: true, cookies: wcaCookies, wcaToken }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ─── Cookie cache helpers ────────────────────────────────────

async function getCachedDirectCookies(supabase: any): Promise<{ cookies: string; wcaToken?: string } | null> {
  const { data: cached } = await supabase
    .from('app_settings')
    .select('value, updated_at')
    .eq('key', 'wca_direct_cookie')
    .maybeSingle()
  if (cached?.value) {
    const age = Date.now() - new Date(cached.updated_at).getTime()
    if (age < 600_000) { // 10 min
      console.log(`[auth] Using cached direct cookies (age: ${Math.round(age / 1000)}s)`)
      try {
        const parsed = JSON.parse(cached.value)
        return { cookies: parsed.cookies || cached.value, wcaToken: parsed.wcaToken }
      } catch {
        return { cookies: cached.value }
      }
    }
  }
  return null
}

async function saveCookiesToCache(supabase: any, cookies: string, wcaToken?: string) {
  const value = JSON.stringify({ cookies, wcaToken, savedAt: new Date().toISOString() })
  const { data: existing } = await supabase.from('app_settings').select('id').eq('key', 'wca_direct_cookie').maybeSingle()
  if (existing) {
    await supabase.from('app_settings').update({ value }).eq('key', 'wca_direct_cookie')
  } else {
    await supabase.from('app_settings').insert({ key: 'wca_direct_cookie', value })
  }
}

async function testCookies(cookies: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE}/Directory`, {
      headers: { 'User-Agent': UA, 'Cookie': cookies },
      redirect: 'manual',
    })
    const loc = resp.headers.get('location') || ''
    if (loc.toLowerCase().includes('/login') || loc.toLowerCase().includes('/signin')) return false
    if (resp.status === 200) {
      const html = await resp.text()
      return !html.includes('type="password"') && /logout|sign.?out/i.test(html)
    }
    return resp.status >= 200 && resp.status < 400
  } catch { return false }
}

async function getAuthenticatedCookies(supabase: any, userId: string): Promise<{ cookies: string; wcaToken?: string } | null> {
  // 1. Try cache
  const cached = await getCachedDirectCookies(supabase)
  if (cached) {
    const valid = await testCookies(cached.cookies)
    if (valid) return cached
    console.log('[auth] Cached cookies invalid, doing SSO login...')
  }

  // 2. SSO login with user credentials
  const { data: creds } = await supabase
    .from('user_wca_credentials')
    .select('wca_username, wca_password')
    .eq('user_id', userId)
    .maybeSingle()
  if (!creds?.wca_username || !creds?.wca_password) {
    console.log('[auth] No WCA credentials found')
    return null
  }

  const result = await ssoLogin(creds.wca_username, creds.wca_password)
  if (!result.success || !result.cookies) return null

  await saveCookiesToCache(supabase, result.cookies, result.wcaToken)
  return { cookies: result.cookies, wcaToken: result.wcaToken }
}

// ─── Directory Query Builder (from wca-app repo discover.js) ─

function buildQueryString(page: number, countryCode: string, network?: string): string {
  const params = new URLSearchParams()
  params.set('siteID', '24')
  params.set('au', '')
  params.set('pageIndex', String(page))
  params.set('pageSize', '50')
  params.set('layout', 'v1')
  params.set('submitted', 'search')
  params.set('searchby', 'CountryCode')
  params.set('country', countryCode)
  params.set('city', '')
  params.set('keyword', '')
  params.set('orderby', 'CountryCity')

  const networkNames = network ? [network] : Object.keys(NETWORK_IDS)
  for (const name of networkNames) {
    const id = NETWORK_IDS[name]
    if (id) params.append('networkIds', String(id))
  }

  return params.toString()
}

// ─── HTML Member Extraction (from wca-app repo discover.js) ──

function extractMembersFromHtml(html: string): { members: { id: number; name: string; href: string }[]; totalResults: number | null } {
  const members: { id: number; name: string; href: string }[] = []
  const seenIds = new Set<number>()
  const $ = cheerio.load(html)

  // Primary: li.directoyname (WCA has a typo in CSS class)
  $('li.directoyname a[href], li.directoryname a[href]').each((_: number, el: any) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/\/directory\/members\/(\d+)/i)
    if (match) {
      const id = parseInt(match[1])
      if (!seenIds.has(id)) {
        seenIds.add(id)
        members.push({ id, name: $(el).text().trim(), href })
      }
    }
  })

  // Fallback: any link with /directory/members/
  if (members.length === 0) {
    $('a[href]').each((_: number, el: any) => {
      const href = $(el).attr('href') || ''
      const match = href.match(/\/directory\/members\/(\d+)/i)
      if (match) {
        const id = parseInt(match[1])
        if (!seenIds.has(id) && id > 0) {
          seenIds.add(id)
          members.push({ id, name: $(el).text().trim(), href })
        }
      }
    })
  }

  let totalResults: number | null = null
  const totalMatch = html.match(/(\d[\d,]*)\s*(results?|members?|companies|records?|found|total)/i)
  if (totalMatch) totalResults = parseInt(totalMatch[1].replace(/,/g, ''))

  return { members, totalResults }
}

// ─── (Firecrawl fallback removed — all scraping goes through direct SSO) ──

// ─── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { countryCode, network, pageIndex, pageSize } = await req.json()
    const currentPage = pageIndex || 1
    const size = pageSize || 50

    if (!countryCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'countryCode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Primary: Direct SSO + cheerio (from wca-app repo) ──
    const auth = await getAuthenticatedCookies(supabase, userId)
    if (auth) {
      const qs = buildQueryString(currentPage, countryCode, network)
      console.log(`[discover] Direct fetch: country=${countryCode}, page=${currentPage}`)

      const headers: Record<string, string> = {
        'User-Agent': UA, 'Cookie': auth.cookies,
        'Referer': `${BASE}/Directory`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }

      // Try JSON API first (if we have wcaToken)
      if (auth.wcaToken) {
        try {
          const apiUrl = `${BASE}/Api/directories/view?${qs}`
          const apiResp = await fetch(apiUrl, {
            headers: { ...headers, 'Authorization': `Basic ${auth.wcaToken}`, 'Accept': 'application/json, text/html, */*', 'X-Requested-With': 'XMLHttpRequest' },
          })
          if (apiResp.status === 200) {
            const apiText = await apiResp.text()
            try {
              const apiJson = JSON.parse(apiText)
              const items = apiJson.members || apiJson.data || apiJson.results || []
              if (items.length > 0) {
                const members = items.map((item: any) => ({
                  company_name: item.name || item.companyName || '',
                  city: item.city || undefined,
                  wca_id: parseInt(item.id || item.memberId || item.wcaId || '0'),
                })).filter((m: any) => m.company_name && m.wca_id)
                const totalResults = apiJson.total || apiJson.totalCount || apiJson.totalResults || members.length
                const totalPages = Math.ceil(totalResults / size)
                console.log(`[discover] JSON API: ${members.length} members`)
                return new Response(JSON.stringify({
                  success: true, members,
                  pagination: { total_results: totalResults, current_page: currentPage, total_pages: totalPages, has_next_page: currentPage < totalPages },
                  source: 'direct_api',
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
            } catch {
              // Not JSON, try as HTML
              const parsed = extractMembersFromHtml(apiText)
              if (parsed.members.length > 0) {
                const members = parsed.members.map(m => ({ company_name: m.name, wca_id: m.id }))
                const totalPages = parsed.totalResults ? Math.ceil(parsed.totalResults / size) : 0
                return new Response(JSON.stringify({
                  success: true, members,
                  pagination: { total_results: parsed.totalResults || members.length, current_page: currentPage, total_pages: totalPages, has_next_page: members.length >= size },
                  source: 'direct_api_html',
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
            }
          }
        } catch (e) { console.log(`[discover] API error: ${e}`) }
      }

      // HTML directory page
      try {
        const getUrl = `${BASE}/Directory?${qs}`
        const getResp = await fetch(getUrl, { headers, redirect: 'follow' })
        if (getResp.url.toLowerCase().includes('/login')) {
          console.log('[discover] Redirected to login, cookies expired')
        } else {
          const getHtml = await getResp.text()
          const isLoggedIn = !getHtml.includes('type="password"') && /logout|sign.?out/i.test(getHtml)
          if (isLoggedIn) {
            const parsed = extractMembersFromHtml(getHtml)
            if (parsed.members.length > 0) {
              const members = parsed.members.map(m => ({ company_name: m.name, wca_id: m.id }))
              const totalPages = parsed.totalResults ? Math.ceil(parsed.totalResults / size) : 0
              console.log(`[discover] HTML page: ${members.length} members, total=${parsed.totalResults}`)
              return new Response(JSON.stringify({
                success: true, members,
                pagination: { total_results: parsed.totalResults || members.length, current_page: currentPage, total_pages: totalPages, has_next_page: members.length >= size },
                source: 'direct_html',
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
          }
        }
      } catch (e) { console.log(`[discover] HTML fetch error: ${e}`) }

      // AJAX fallback
      try {
        const ajaxUrl = `${BASE}/directories/next?${qs}`
        const ajaxHeaders = { ...headers, 'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*' }
        if (auth.wcaToken) (ajaxHeaders as any)['Authorization'] = `Basic ${auth.wcaToken}`
        const ajaxResp = await fetch(ajaxUrl, { headers: ajaxHeaders })
        if (ajaxResp.status === 200) {
          const ajaxHtml = await ajaxResp.text()
          const parsed = extractMembersFromHtml(ajaxHtml)
          if (parsed.members.length > 0) {
            const members = parsed.members.map(m => ({ company_name: m.name, wca_id: m.id }))
            console.log(`[discover] AJAX: ${members.length} members`)
            return new Response(JSON.stringify({
              success: true, members,
              pagination: { total_results: parsed.totalResults || members.length, current_page: currentPage, total_pages: 0, has_next_page: members.length >= size },
              source: 'direct_ajax',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
        }
      } catch (e) { console.log(`[discover] AJAX error: ${e}`) }

      console.log('[discover] Direct methods returned 0 members, falling back to Firecrawl')
    }

    // ── Fallback: Firecrawl ──
    console.log('[discover] Using Firecrawl fallback...')
    const fallback = await firecrawlFallback(countryCode, network || '', currentPage, size)
    if (fallback) {
      console.log(`[discover] Firecrawl: ${fallback.members.length} members`)
      return new Response(JSON.stringify({
        success: true, members: fallback.members,
        pagination: { total_results: fallback.members.length, current_page: currentPage, total_pages: 0, has_next_page: fallback.hasNextPage },
        source: 'firecrawl',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ success: false, error: 'No scraping method available', members: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
