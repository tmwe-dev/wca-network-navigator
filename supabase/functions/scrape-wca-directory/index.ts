import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const VERCEL_BASE = 'https://wca-app.vercel.app/api'

// ─── Vercel API helpers ──────────────────────────────────────

async function getVercelCookie(supabase: any, userId: string): Promise<string | null> {
  // Check cached cookie
  const { data: cached } = await supabase
    .from('app_settings')
    .select('value, updated_at')
    .eq('key', 'vercel_wca_cookie')
    .maybeSingle()

  if (cached?.value) {
    const age = Date.now() - new Date(cached.updated_at).getTime()
    if (age < 3600_000) { // < 1 hour
      console.log('Using cached Vercel WCA cookie')
      return cached.value
    }
  }

  // Get user credentials
  const { data: creds } = await supabase
    .from('user_wca_credentials')
    .select('wca_username, wca_password')
    .eq('user_id', userId)
    .maybeSingle()

  if (!creds?.wca_username || !creds?.wca_password) {
    console.log('No WCA credentials found for user')
    return null
  }

  // Login via Vercel API
  console.log('Logging in via Vercel API...')
  try {
    const res = await fetch(`${VERCEL_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.wca_username, password: creds.wca_password }),
    })
    const data = await res.json()
    if (data.cookie) {
      console.log('Vercel login OK, caching cookie')
      // Cache cookie
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'vercel_wca_cookie')
        .maybeSingle()
      if (existing) {
        await supabase.from('app_settings').update({ value: data.cookie }).eq('key', 'vercel_wca_cookie')
      } else {
        await supabase.from('app_settings').insert({ key: 'vercel_wca_cookie', value: data.cookie })
      }
      return data.cookie
    }
    console.error('Vercel login failed:', data)
  } catch (e) {
    console.error('Vercel login error:', e)
  }
  return null
}

async function discoverViaVercel(cookie: string, country: string, page: number): Promise<{ members: any[]; totalPages: number } | null> {
  try {
    const res = await fetch(`${VERCEL_BASE}/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country, page, cookie }),
    })
    if (!res.ok) {
      console.error('Vercel discover error:', res.status)
      return null
    }
    const data = await res.json()
    return { members: data.members || [], totalPages: data.totalPages || 0 }
  } catch (e) {
    console.error('Vercel discover error:', e)
    return null
  }
}

// ─── Firecrawl Fallback (existing logic) ─────────────────────

// Mapping from network display names to WCA numeric networkIds
const NETWORK_ID_MAP: Record<string, number[]> = {
  '': [1,2,3,4,61,98,108,118,5,22,13,18,15,16,38,107,124],
  'WCA Inter Global': [1],
  'WCA China Global': [2],
  'WCA First': [3],
  'WCA Advanced Professionals': [4],
  'WCA Projects': [5],
  'WCA Dangerous Goods': [13],
  'WCA Perishables': [15],
  'WCA Time Critical': [16],
  'WCA Pharma': [18],
}

function parseMembersFromContent(html: string, markdown: string): { company_name: string; city?: string; country?: string; wca_id?: number }[] {
  const members: { company_name: string; city?: string; country?: string; wca_id?: number }[] = []
  const seen = new Set<number>()
  const content = html || markdown || ''

  const linkRegex = /href="[^"]*\/[Dd]irectory\/[Mm]embers\/(\d+)"[^>]*>([^<]+)</gi
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    const wcaId = parseInt(match[1])
    let rawText = match[2].trim()
    if (!wcaId || seen.has(wcaId) || rawText.length < 2) continue
    seen.add(wcaId)
    rawText = rawText.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    let city: string | undefined
    let companyName = rawText
    companyName = companyName.replace(/\s*\([^)]*(?:Head Office|Branch)\)\s*$/i, '')
    const dashIdx = companyName.indexOf(' - ')
    if (dashIdx > 0) {
      city = companyName.substring(0, dashIdx).trim()
      companyName = companyName.substring(dashIdx + 3).trim()
    }
    if (companyName.length > 0) {
      members.push({ company_name: companyName, city, wca_id: wcaId })
    }
  }

  if (members.length === 0 && markdown) {
    const mdRegex = /\[([^\]]+)\]\([^)]*\/[Dd]irectory\/[Mm]embers\/(\d+)[^)]*\)/g
    while ((match = mdRegex.exec(markdown)) !== null) {
      const wcaId = parseInt(match[2])
      let rawText = match[1].trim()
      if (!wcaId || seen.has(wcaId) || rawText.length < 2) continue
      seen.add(wcaId)
      rawText = rawText.replace(/&amp;/g, '&')
      let city: string | undefined
      let companyName = rawText.replace(/\s*\([^)]*(?:Head Office|Branch)\)\s*$/i, '')
      const dashIdx = companyName.indexOf(' - ')
      if (dashIdx > 0) {
        city = companyName.substring(0, dashIdx).trim()
        companyName = companyName.substring(dashIdx + 3).trim()
      }
      if (companyName.length > 0) {
        members.push({ company_name: companyName, city, wca_id: wcaId })
      }
    }
  }

  return members
}

async function firecrawlFallback(countryCode: string, network: string, currentPage: number, size: number): Promise<{ members: any[]; hasNextPage: boolean } | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY')
  if (!apiKey) return null

  const networkIds = NETWORK_ID_MAP[network || ''] || NETWORK_ID_MAP['']
  const params = new URLSearchParams()
  params.set('siteID', '24')
  params.set('pageIndex', String(currentPage))
  params.set('pageSize', String(size))
  params.set('searchby', 'CountryCode')
  params.set('orderby', 'CountryCity')
  params.set('layout', 'v1')
  params.set('submitted', 'search')
  params.set('country', countryCode)
  const networkParams = networkIds.map(id => `networkIds=${id}`).join('&')
  const url = `https://www.wcaworld.com/Directory?${params.toString()}&${networkParams}`
  console.log(`Firecrawl fallback: ${url}`)

  try {
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown', 'rawHtml'], waitFor: 3000 }),
    })
    const scrapeData = await scrapeResponse.json()
    if (!scrapeResponse.ok) {
      console.error('Firecrawl error:', scrapeData)
      return null
    }
    const markdown = scrapeData?.data?.markdown || ''
    const html = scrapeData?.data?.rawHtml || ''
    const members = parseMembersFromContent(html, markdown)
    return { members, hasNextPage: members.length >= size }
  } catch (e) {
    console.error('Firecrawl error:', e)
    return null
  }
}

// ─── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Auth check ──
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
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claimsData.claims.sub as string

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { countryCode, network, pageIndex, pageSize, searchBy, companyName, city, memberId } = await req.json()
    const searchMode = searchBy || 'CountryCode'
    const currentPage = pageIndex || 1
    const size = pageSize || 50

    if (searchMode === 'CountryCode' && !countryCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'countryCode is required when searching by CountryCode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Primary: Vercel API ──
    if (searchMode === 'CountryCode') {
      const cookie = await getVercelCookie(supabase, userId)
      if (cookie) {
        console.log(`Vercel discover: country=${countryCode}, page=${currentPage}`)
        const result = await discoverViaVercel(cookie, countryCode, currentPage)
        if (result && result.members.length > 0) {
          // Map Vercel format to our format
          const members = result.members.map((m: any) => ({
            company_name: m.companyName || m.company_name || m.name || '',
            city: m.city || undefined,
            wca_id: m.id || m.wcaId || m.wca_id || undefined,
          })).filter((m: any) => m.company_name)

          console.log(`Vercel: ${members.length} members for ${countryCode} (page ${currentPage}/${result.totalPages})`)

          return new Response(
            JSON.stringify({
              success: true,
              members,
              pagination: {
                total_results: members.length,
                current_page: currentPage,
                total_pages: result.totalPages,
                has_next_page: currentPage < result.totalPages,
              },
              source: 'vercel',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log('Vercel returned 0 members, falling back to Firecrawl')
      }
    }

    // ── Fallback: Firecrawl ──
    console.log('Using Firecrawl fallback...')
    const fallback = await firecrawlFallback(countryCode || '', network || '', currentPage, size)
    if (fallback) {
      console.log(`Firecrawl: ${fallback.members.length} members for ${countryCode} (page ${currentPage})`)
      return new Response(
        JSON.stringify({
          success: true,
          members: fallback.members,
          pagination: {
            total_results: fallback.members.length,
            current_page: currentPage,
            total_pages: 0,
            has_next_page: fallback.hasNextPage,
          },
          source: 'firecrawl',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'No scraping method available (Vercel API and Firecrawl both failed)', members: [] }),
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
