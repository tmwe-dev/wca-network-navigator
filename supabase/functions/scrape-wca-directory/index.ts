const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Mapping from network display names to WCA numeric networkIds
const NETWORK_ID_MAP: Record<string, number[]> = {
  '': [1,2,3,4,61,98,108,118,5,22,13,18,15,16,38,107,124], // All networks
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
 * Scrape the WCA directory listing page to get a list of members for a given country.
 * Phase 1: get the list of partner names + IDs from the directory.
 * 
 * URL format: https://www.wcaworld.com/Directory?siteID=24&pageIndex=1&pageSize=50&searchby=CountryCode&country=AL&networkIds=1&networkIds=2...
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    // Build the WCA directory URL with correct parameters
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
    
    // networkIds must be appended as repeated params
    const networkParams = networkIds.map(id => `networkIds=${id}`).join('&')
    
    const url = `https://www.wcaworld.com/Directory?${params.toString()}&${networkParams}`
    console.log(`Scraping WCA directory: ${url}`)

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          prompt: `You are looking at a WCA member directory listing page. It shows a table/list of freight forwarding companies.

Extract ALL member companies visible on this page. For each company entry, extract:
- company_name: the business name exactly as shown
- city: the city where the office is located
- country: country name if shown
- wca_id: the WCA member ID number. Look for it in links like "/directory/members/12345" or "/Directory/Members/12345" — the number at the end is the wca_id
- network_memberships: any network badges/labels shown (e.g. "WCA Inter Global", "WCA Projects")

Also extract pagination info:
- total_results: total number of results shown (e.g. "47 results" or "Showing 1-50 of 123")
- current_page: current page number
- total_pages: total number of pages (if shown, or calculate from total_results / page_size)
- has_next_page: boolean, whether there appears to be a next page

IMPORTANT: Extract every single row from the listing. Don't skip any.
If this is a login page, empty page, or error page, return members as an empty array.`,
          schema: {
            type: 'object',
            properties: {
              members: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    company_name: { type: 'string' },
                    city: { type: 'string' },
                    country: { type: 'string' },
                    wca_id: { type: 'number' },
                    network_memberships: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['company_name'],
                },
              },
              total_results: { type: 'number' },
              current_page: { type: 'number' },
              total_pages: { type: 'number' },
              has_next_page: { type: 'boolean' },
            },
            required: ['members'],
          },
        },
        waitFor: 10000,
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

    const extracted = scrapeData?.data?.extract || scrapeData?.extract || {}
    const members = extracted.members || []

    console.log(`Found ${members.length} members for ${countryCode} (page ${currentPage})${network ? ` [${network}]` : ''}`)

    // Calculate pagination — deterministic: if we got a full page, there's likely more
    const totalResults = extracted.total_results || members.length
    const totalPages = extracted.total_pages || Math.ceil(totalResults / size) || 1
    const hasNextPage = members.length >= size

    return new Response(
      JSON.stringify({
        success: true,
        members,
        pagination: {
          total_results: totalResults,
          current_page: currentPage,
          total_pages: totalPages,
          has_next_page: hasNextPage,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
