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
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!lovableKey) {
      return new Response(JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { partnerId } = await req.json()

    if (!partnerId) {
      return new Response(JSON.stringify({ success: false, error: 'partnerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get partner data
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, company_name, website, city, country_name')
      .eq('id', partnerId)
      .single()

    if (partnerError || !partner) {
      return new Response(JSON.stringify({ success: false, error: 'Partner not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get contacts
    const { data: contacts = [] } = await supabase
      .from('partner_contacts')
      .select('id, name, title, email')
      .eq('partner_id', partnerId)

    // Get existing social links to avoid duplicates
    const { data: existingLinks = [] } = await supabase
      .from('partner_social_links')
      .select('contact_id, platform')
      .eq('partner_id', partnerId)

    const existingSet = new Set(existingLinks.map(l => `${l.contact_id || 'company'}_${l.platform}`))

    let socialLinksFound = 0
    let logoFound = false

    // --- Search LinkedIn for each contact ---
    for (const contact of contacts || []) {
      if (!contact.name || contact.name.length < 3) continue

      // Skip if already has LinkedIn
      if (existingSet.has(`${contact.id}_linkedin`)) {
        console.log(`Skipping ${contact.name} - already has LinkedIn`)
        continue
      }

      const query = `"${contact.name}" "${partner.company_name}" site:linkedin.com/in`
      console.log(`Searching: ${query}`)

      try {
        const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, limit: 5 }),
        })

        if (!searchResp.ok) {
          console.error(`Firecrawl search error for ${contact.name}: ${searchResp.status}`)
          continue
        }

        const searchData = await searchResp.json()
        const results = searchData?.data || searchData?.results || []

        if (results.length === 0) {
          console.log(`No results for ${contact.name}`)
          continue
        }

        // Use AI to pick the best LinkedIn URL
        const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [{
              role: 'user',
              content: `I'm looking for the LinkedIn profile of "${contact.name}" who works at "${partner.company_name}" in ${partner.city || ''}, ${partner.country_name || ''}.${contact.title ? ` Their title is "${contact.title}".` : ''}

Here are the search results:
${results.map((r: any, i: number) => `${i + 1}. URL: ${r.url}\n   Title: ${r.title || 'N/A'}\n   Description: ${r.description || 'N/A'}`).join('\n\n')}

If one of these results clearly matches the person, respond with ONLY the LinkedIn URL (e.g., https://www.linkedin.com/in/username). If none match or you're not confident, respond with "NONE".`
            }],
          }),
        })

        if (!aiResp.ok) {
          if (aiResp.status === 429) {
            console.error('AI rate limited, stopping social search')
            break
          }
          console.error(`AI error: ${aiResp.status}`)
          continue
        }

        const aiData = await aiResp.json()
        const answer = aiData?.choices?.[0]?.message?.content?.trim() || ''

        if (answer !== 'NONE' && answer.includes('linkedin.com/in/')) {
          // Extract clean URL
          const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/)
          if (urlMatch) {
            const linkedinUrl = urlMatch[1].replace(/\/$/, '')
            console.log(`Found LinkedIn for ${contact.name}: ${linkedinUrl}`)

            const { error: insertError } = await supabase
              .from('partner_social_links')
              .insert({
                partner_id: partnerId,
                contact_id: contact.id,
                platform: 'linkedin',
                url: linkedinUrl,
              })

            if (!insertError) {
              socialLinksFound++
            } else {
              console.error(`Insert error for ${contact.name}:`, insertError)
            }
          }
        } else {
          console.log(`No confident match for ${contact.name}`)
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500))
      } catch (e) {
        console.error(`Error searching for ${contact.name}:`, e)
      }
    }

    // --- Search company LinkedIn page ---
    if (!existingSet.has('company_linkedin')) {
      try {
        const companyQuery = `"${partner.company_name}" site:linkedin.com/company`
        console.log(`Searching company LinkedIn: ${companyQuery}`)

        const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: companyQuery, limit: 3 }),
        })

        if (searchResp.ok) {
          const searchData = await searchResp.json()
          const results = searchData?.data || searchData?.results || []

          // Pick first linkedin.com/company result
          const companyResult = results.find((r: any) => r.url?.includes('linkedin.com/company/'))
          if (companyResult) {
            const { error: insertError } = await supabase
              .from('partner_social_links')
              .insert({
                partner_id: partnerId,
                contact_id: null,
                platform: 'linkedin',
                url: companyResult.url.replace(/\/$/, ''),
              })
            if (!insertError) socialLinksFound++
          }
        }
      } catch (e) {
        console.error('Error searching company LinkedIn:', e)
      }
    }

    // --- Extract logo from website ---
    if (partner.website) {
      try {
        const websiteUrl = partner.website.startsWith('http') ? partner.website : `https://${partner.website}`
        console.log(`Scraping website for logo: ${websiteUrl}`)

        const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: websiteUrl,
            formats: ['links'],
          }),
        })

        if (scrapeResp.ok) {
          const scrapeData = await scrapeResp.json()
          const metadata = scrapeData?.data?.metadata || scrapeData?.metadata || {}

          // Try og:image first, then favicon
          let logoUrl = metadata.ogImage || metadata['og:image'] || null

          if (!logoUrl) {
            // Try favicon from metadata
            logoUrl = metadata.favicon || metadata.icon || null
          }

          if (!logoUrl) {
            // Fallback: use Google's favicon service
            try {
              const domain = new URL(websiteUrl).hostname
              logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
            } catch {}
          }

          if (logoUrl) {
            console.log(`Found logo: ${logoUrl}`)
            const { error: updateError } = await supabase
              .from('partners')
              .update({ logo_url: logoUrl })
              .eq('id', partnerId)

            if (!updateError) logoFound = true
            else console.error('Logo update error:', updateError)
          }
        }
      } catch (e) {
        console.error('Error extracting logo:', e)
      }
    }

    console.log(`Deep search complete for ${partner.company_name}: ${socialLinksFound} social links, logo: ${logoFound}`)

    return new Response(
      JSON.stringify({
        success: true,
        socialLinksFound,
        logoFound,
        companyName: partner.company_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('Deep search error:', e)
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
