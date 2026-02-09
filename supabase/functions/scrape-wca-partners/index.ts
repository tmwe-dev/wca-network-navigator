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
          prompt: `Extract ALL information from this WCA freight forwarder member profile page. Extract every field available:
- company_name: the business name
- city: city where the office is located
- country: full country name
- country_code: 2-letter ISO country code
- office_type: "head_office" or "branch"
- email: company email (if visible, not behind login wall)
- phone: phone number
- fax: fax number
- website: website URL
- address: full street address
- profile_description: the full company profile/description text
- logo_url: URL of the company logo image
- member_since: date when they became a member (e.g. "Dec 10, 2003")
- gold_medallion: boolean, whether enrolled in Gold Medallion program
- networks: array of network memberships, each with name and expiry date
- certifications: array of certification/license names (e.g. IATA, C-TPAT, ISO, etc.)
- contacts: array of office contacts, each with title/role and name if visible
- branch_offices: array of other offices, each with city and wca_id if visible
- has_branches: boolean, whether the company has multiple offices

If the page shows 404, not found, or no company profile, return company_name as empty string.`,
          schema: {
            type: 'object',
            properties: {
              company_name: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              country_code: { type: 'string' },
              office_type: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              fax: { type: 'string' },
              website: { type: 'string' },
              address: { type: 'string' },
              profile_description: { type: 'string' },
              logo_url: { type: 'string' },
              member_since: { type: 'string' },
              gold_medallion: { type: 'boolean' },
              networks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    expires: { type: 'string' },
                  },
                },
              },
              certifications: {
                type: 'array',
                items: { type: 'string' },
              },
              contacts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                  },
                },
              },
              branch_offices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    city: { type: 'string' },
                    wca_id: { type: 'number' },
                  },
                },
              },
              has_branches: { type: 'boolean' },
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

    if (!extracted.company_name || extracted.company_name.trim() === '') {
      return new Response(
        JSON.stringify({ success: true, found: false, wcaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map office_type to enum
    const officeType = extracted.office_type?.toLowerCase()?.includes('branch') ? 'branch' : 'head_office'

    // Build partner record
    const partnerRecord = {
      company_name: extracted.company_name.trim(),
      city: extracted.city?.trim() || 'Unknown',
      country_code: extracted.country_code?.trim()?.toUpperCase() || 'XX',
      country_name: extracted.country?.trim() || '',
      email: extracted.email?.trim() || null,
      phone: extracted.phone?.trim() || null,
      fax: extracted.fax?.trim() || null,
      website: extracted.website?.trim() || null,
      wca_id: wcaId,
      address: extracted.address?.trim() || null,
      profile_description: extracted.profile_description?.trim() || null,
      office_type: officeType,
      member_since: extracted.member_since ? parseDateString(extracted.member_since) : null,
      has_branches: extracted.has_branches || false,
      branch_cities: extracted.branch_offices?.length > 0
        ? JSON.stringify(extracted.branch_offices)
        : '[]',
      is_active: true,
    }

    // Check if exists by wca_id
    const { data: existingById } = await supabase
      .from('partners')
      .select('id')
      .eq('wca_id', wcaId)
      .maybeSingle()

    let action = 'skipped'
    let partnerId = existingById?.id

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
      const { data: inserted, error } = await supabase
        .from('partners')
        .insert(partnerRecord)
        .select('id')
        .single()
      if (error) {
        console.error(`Insert error for ID ${wcaId}:`, error)
        return new Response(
          JSON.stringify({ success: false, error: error.message, wcaId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      partnerId = inserted.id
      action = 'inserted'
    }

    // Save certifications
    if (extracted.certifications?.length > 0 && partnerId) {
      const validCerts = ['IATA', 'BASC', 'ISO', 'C-TPAT', 'AEO']
      for (const cert of extracted.certifications) {
        const certUpper = cert.toUpperCase().trim()
        const matchedCert = validCerts.find(vc => certUpper.includes(vc))
        if (matchedCert) {
          const { data: existingCert } = await supabase
            .from('partner_certifications')
            .select('id')
            .eq('partner_id', partnerId)
            .eq('certification', matchedCert)
            .maybeSingle()
          if (!existingCert) {
            await supabase.from('partner_certifications').insert({
              partner_id: partnerId,
              certification: matchedCert,
            })
          }
        }
      }
    }

    // Save networks
    if (extracted.networks?.length > 0 && partnerId) {
      for (const network of extracted.networks) {
        if (!network.name) continue
        const { data: existingNet } = await supabase
          .from('partner_networks')
          .select('id')
          .eq('partner_id', partnerId)
          .eq('network_name', network.name)
          .maybeSingle()
        if (!existingNet) {
          await supabase.from('partner_networks').insert({
            partner_id: partnerId,
            network_name: network.name,
            expires: network.expires ? parseDateString(network.expires) : null,
          })
        }
      }
    }

    // Save contacts
    if (extracted.contacts?.length > 0 && partnerId) {
      for (const contact of extracted.contacts) {
        if (!contact.title) continue
        const { data: existingContact } = await supabase
          .from('partner_contacts')
          .select('id')
          .eq('partner_id', partnerId)
          .eq('title', contact.title)
          .maybeSingle()
        if (!existingContact) {
          await supabase.from('partner_contacts').insert({
            partner_id: partnerId,
            name: contact.name || contact.title,
            title: contact.title,
            email: contact.email || null,
          })
        }
      }
    }

    // Build full response with all extracted data
    const fullPartner = {
      ...partnerRecord,
      logo_url: extracted.logo_url || null,
      gold_medallion: extracted.gold_medallion || false,
      networks: extracted.networks || [],
      certifications: extracted.certifications || [],
      contacts: extracted.contacts || [],
      branch_offices: extracted.branch_offices || [],
    }

    // Trigger AI analysis asynchronously (fire and forget)
    let aiClassification = null
    try {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-partner`
      const analyzeResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partnerId, profileData: fullPartner }),
      })
      const analyzeData = await analyzeResponse.json()
      if (analyzeData.success) {
        aiClassification = analyzeData.classification
      }
    } catch (aiErr) {
      console.error('AI analysis error (non-blocking):', aiErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        wcaId,
        action,
        partnerId,
        partner: fullPartner,
        aiClassification,
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

function parseDateString(dateStr: string): string | null {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch {
    return null
  }
}
