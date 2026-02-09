import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { wcaId } = await req.json()

    if (!wcaId || typeof wcaId !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'wcaId (number) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = `https://www.wcaworld.com/directory/members/${wcaId}`
    console.log(`Scraping WCA member profile: ${url}`)

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
          prompt: `Extract the freight forwarding company profile from this WCA member page. Extract: company_name, city, country (full name), country_code (2-letter ISO code), email, phone, website, address. If the page shows a 404 or "not found" or no company profile, return company_name as empty string.`,
          schema: {
            type: 'object',
            properties: {
              company_name: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              country_code: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              website: { type: 'string' },
              address: { type: 'string' },
            },
            required: ['company_name'],
          },
        },
        waitFor: 5000,
      }),
    })

    const scrapeData = await scrapeResponse.json()

    if (!scrapeResponse.ok) {
      console.error(`Firecrawl error for ID ${wcaId}:`, scrapeData)
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl error: ${scrapeData?.error || scrapeResponse.status}`, wcaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const extracted = scrapeData?.data?.extract || scrapeData?.extract || {}
    console.log(`Extracted for ID ${wcaId}:`, JSON.stringify(extracted))

    // Check if profile was found
    if (!extracted.company_name || extracted.company_name.trim() === '') {
      return new Response(
        JSON.stringify({ success: true, found: false, wcaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upsert into database
    const partnerRecord = {
      company_name: extracted.company_name.trim(),
      city: extracted.city?.trim() || 'Unknown',
      country_code: extracted.country_code?.trim()?.toUpperCase() || 'XX',
      country_name: extracted.country?.trim() || '',
      email: extracted.email?.trim() || null,
      phone: extracted.phone?.trim() || null,
      website: extracted.website?.trim() || null,
      wca_id: wcaId,
      address: extracted.address?.trim() || null,
      is_active: true,
    }

    // Check if exists by wca_id first, then by name+country
    const { data: existingById } = await supabase
      .from('partners')
      .select('id')
      .eq('wca_id', wcaId)
      .maybeSingle()

    let action = 'skipped'

    if (existingById) {
      const { error } = await supabase
        .from('partners')
        .update({ ...partnerRecord, updated_at: new Date().toISOString() })
        .eq('id', existingById.id)
      if (error) {
        console.error(`Update error for ID ${wcaId}:`, error)
        return new Response(
          JSON.stringify({ success: false, error: error.message, wcaId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      action = 'updated'
    } else {
      const { error } = await supabase
        .from('partners')
        .insert(partnerRecord)
      if (error) {
        console.error(`Insert error for ID ${wcaId}:`, error)
        return new Response(
          JSON.stringify({ success: false, error: error.message, wcaId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      action = 'inserted'
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        wcaId,
        action,
        partner: partnerRecord,
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
