import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface PartnerData {
  company_name: string
  city: string
  country_code: string
  country_name: string
  email?: string
  phone?: string
  website?: string
  wca_id?: number
  address?: string
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

    const { countryCodes, countryNames } = await req.json()

    if (!countryCodes || !Array.isArray(countryCodes) || countryCodes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'countryCodes array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: { country: string; found: number; inserted: number; updated: number; errors: number }[] = []
    let totalFound = 0
    let totalInserted = 0
    let totalUpdated = 0
    let totalErrors = 0

    for (let i = 0; i < countryCodes.length; i++) {
      const code = countryCodes[i]
      const countryName = countryNames?.[i] || code

      console.log(`Scraping WCA directory for country: ${code} (${countryName})`)

      try {
        // Use Firecrawl to scrape with JSON extraction
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: `https://www.wcaworld.com/MemberSearch?country=${code}`,
            formats: ['extract'],
            extract: {
              prompt: `Extract all freight forwarding companies/members listed on this WCA directory page. For each company extract: company_name (the business name), city, email, phone, website URL, and WCA member ID (a numeric ID if visible). Return all companies found as an array. If no companies are found return an empty array.`,
              schema: {
                type: 'object',
                properties: {
                  partners: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        company_name: { type: 'string' },
                        city: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                        website: { type: 'string' },
                        wca_id: { type: 'number' },
                        address: { type: 'string' },
                      },
                      required: ['company_name', 'city'],
                    },
                  },
                },
                required: ['partners'],
              },
            },
            waitFor: 5000,
          }),
        })

        const scrapeData = await scrapeResponse.json()

        if (!scrapeResponse.ok) {
          console.error(`Firecrawl error for ${code}:`, scrapeData)
          results.push({ country: code, found: 0, inserted: 0, updated: 0, errors: 1 })
          totalErrors++
          continue
        }

        // Extract partners from response
        const extractedData = scrapeData?.data?.extract || scrapeData?.extract || {}
        const partners: PartnerData[] = (extractedData.partners || []).filter(
          (p: any) => p.company_name && p.city
        )

        console.log(`Found ${partners.length} partners for ${code}`)
        totalFound += partners.length

        let countInserted = 0
        let countUpdated = 0
        let countErrors = 0

        for (const partner of partners) {
          try {
            // Check if partner exists
            const { data: existing } = await supabase
              .from('partners')
              .select('id')
              .eq('company_name', partner.company_name)
              .eq('country_code', code)
              .maybeSingle()

            const partnerRecord = {
              company_name: partner.company_name,
              city: partner.city,
              country_code: code,
              country_name: countryName,
              email: partner.email || null,
              phone: partner.phone || null,
              website: partner.website || null,
              wca_id: partner.wca_id || null,
              address: partner.address || null,
              is_active: true,
            }

            if (existing) {
              const { error } = await supabase
                .from('partners')
                .update({ ...partnerRecord, updated_at: new Date().toISOString() })
                .eq('id', existing.id)

              if (error) {
                console.error(`Update error for ${partner.company_name}:`, error)
                countErrors++
              } else {
                countUpdated++
              }
            } else {
              const { error } = await supabase
                .from('partners')
                .insert(partnerRecord)

              if (error) {
                console.error(`Insert error for ${partner.company_name}:`, error)
                countErrors++
              } else {
                countInserted++
              }
            }
          } catch (err) {
            console.error(`Error processing partner ${partner.company_name}:`, err)
            countErrors++
          }
        }

        totalInserted += countInserted
        totalUpdated += countUpdated
        totalErrors += countErrors

        results.push({
          country: code,
          found: partners.length,
          inserted: countInserted,
          updated: countUpdated,
          errors: countErrors,
        })

        // Rate limiting: wait 2s between countries
        if (i < countryCodes.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      } catch (err) {
        console.error(`Error scraping ${code}:`, err)
        results.push({ country: code, found: 0, inserted: 0, updated: 0, errors: 1 })
        totalErrors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalCountries: countryCodes.length,
          totalFound,
          totalInserted,
          totalUpdated,
          totalErrors,
        },
        results,
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
