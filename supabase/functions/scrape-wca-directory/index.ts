const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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

/**
 * Parse members from HTML content returned by Firecrawl.
 * WCA directory links have the format:
 *   <a href="/Directory/Members/12345">City - Company Name (City, Head Office)</a>
 * We parse out the wca_id, company_name, and city.
 */
function parseMembersFromContent(html: string, markdown: string): { company_name: string; city?: string; country?: string; wca_id?: number }[] {
  const members: { company_name: string; city?: string; country?: string; wca_id?: number }[] = []
  const seen = new Set<number>()
  const content = html || markdown || ''

  // Match member links: href="/Directory/Members/XXXXX" with link text
  const linkRegex = /href="[^"]*\/[Dd]irectory\/[Mm]embers\/(\d+)"[^>]*>([^<]+)</gi
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    const wcaId = parseInt(match[1])
    let rawText = match[2].trim()
    if (!wcaId || seen.has(wcaId) || rawText.length < 2) continue
    seen.add(wcaId)

    // Decode HTML entities
    rawText = rawText.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')

    // Parse "City - Company Name (City, Head Office)" format
    let city: string | undefined
    let companyName = rawText

    // Remove trailing "(City, Head Office)" or "(Head Office)" 
    companyName = companyName.replace(/\s*\([^)]*(?:Head Office|Branch)\)\s*$/i, '')

    // Split "City - Company Name" 
    const dashIdx = companyName.indexOf(' - ')
    if (dashIdx > 0) {
      city = companyName.substring(0, dashIdx).trim()
      companyName = companyName.substring(dashIdx + 3).trim()
    }

    if (companyName.length > 0) {
      members.push({ company_name: companyName, city, wca_id: wcaId })
    }
  }

  // Fallback: markdown links [text](/Directory/Members/12345)
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
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { countryCode, network, pageIndex, pageSize } = await req.json()

    if (!countryCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'countryCode is required (e.g. "AL")' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const currentPage = pageIndex || 1
    const size = pageSize || 50

    const networkIds = NETWORK_ID_MAP[network || ''] || NETWORK_ID_MAP['']
    
    const params = new URLSearchParams()
    params.set('siteID', '24')
    params.set('pageIndex', String(currentPage))
    params.set('pageSize', String(size))
    params.set('searchby', 'CountryCode')
    params.set('country', countryCode)
    params.set('orderby', 'CountryCity')
    params.set('layout', 'v1')
    params.set('submitted', 'search')
    
    const networkParams = networkIds.map(id => `networkIds=${id}`).join('&')
    const url = `https://www.wcaworld.com/Directory?${params.toString()}&${networkParams}`
    console.log(`Scraping WCA directory: ${url}`)

    // Use markdown+html instead of extract (LLM) — much faster (~5s vs ~40s)
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'rawHtml'],
        waitFor: 3000,
      }),
    })

    const scrapeData = await scrapeResponse.json()

    if (!scrapeResponse.ok) {
      console.error('Firecrawl error:', scrapeData)
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl error: ${scrapeData?.error || scrapeResponse.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || ''
    const html = scrapeData?.data?.rawHtml || scrapeData?.rawHtml || ''

    console.log(`Got content: markdown=${markdown.length} chars, html=${html.length} chars`)

    // Parse members from content using regex
    const members = parseMembersFromContent(html, markdown)

    console.log(`Parsed ${members.length} members for ${countryCode} (page ${currentPage})${network ? ` [${network}]` : ''}`)

    // Deterministic pagination
    const hasNextPage = members.length >= size

    return new Response(
      JSON.stringify({
        success: true,
        members,
        pagination: {
          total_results: members.length,
          current_page: currentPage,
          total_pages: 0, // unknown without LLM
          has_next_page: hasNextPage,
        },
      }),
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
