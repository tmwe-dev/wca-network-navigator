import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Scrape the WCA directory listing page to get a list of members for a given country.
 * This is Phase 1: get the list of partner names + IDs.
 * Phase 2 (existing scrape-wca-partners) downloads individual profiles.
 * 
 * Uses Firecrawl to scrape the WCA member directory page with country filter.
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

    const { country, network, page } = await req.json()

    if (!country) {
      return new Response(
        JSON.stringify({ success: false, error: 'country is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the WCA directory URL
    // The WCA directory can be browsed at: https://www.wcaworld.com/MemberDirectory
    // with query params for filtering
    const baseUrl = 'https://www.wcaworld.com/MemberDirectory'
    const params = new URLSearchParams()
    params.set('country', country) // country name like "Albania", "Italy"
    if (network && network !== '') {
      params.set('network', network)
    }
    if (page && page > 1) {
      params.set('page', String(page))
    }
    
    const url = `${baseUrl}?${params.toString()}`
    console.log(`Scraping WCA directory listing: ${url}`)

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
          prompt: `Extract all member companies listed on this WCA member directory page. 
For each company/member entry visible on the page, extract:
- company_name: the business name
- city: city where the office is located  
- country: country name
- wca_id: the WCA member ID number (look for it in links like /directory/members/XXXX or displayed as ID)
- network_memberships: any network badges or labels shown (e.g. "WCA Inter Global", "WCA Projects")

Also extract:
- total_results: the total number of results shown (if displayed, e.g. "Showing 1-20 of 45 results")
- current_page: current page number
- total_pages: total number of pages
- has_next_page: boolean, whether there's a next page link

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
        waitFor: 8000,
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

    console.log(`Found ${members.length} members for ${country}${network ? ` (${network})` : ''}`)

    return new Response(
      JSON.stringify({
        success: true,
        members,
        pagination: {
          total_results: extracted.total_results || members.length,
          current_page: extracted.current_page || page || 1,
          total_pages: extracted.total_pages || 1,
          has_next_page: extracted.has_next_page || false,
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
