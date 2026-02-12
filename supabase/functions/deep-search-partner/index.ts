import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Helper: Firecrawl search
async function firecrawlSearch(query: string, firecrawlKey: string, limit = 5): Promise<any[]> {
  const resp = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  })
  if (!resp.ok) return []
  const data = await resp.json()
  return data?.data || data?.results || []
}

// Helper: AI pick best URL from results
async function aiPickUrl(
  prompt: string,
  lovableKey: string
): Promise<string | null> {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!resp.ok) {
    if (resp.status === 429) throw new Error('RATE_LIMITED')
    return null
  }
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content?.trim() || null
}

// Helper: AI generate profile
async function aiGenerateProfile(
  prompt: string,
  lovableKey: string
): Promise<string | null> {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!resp.ok) return null
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content?.trim() || null
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
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
      .select('id, company_name, website, city, country_name, enrichment_data')
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
    let rateLimited = false
    const contactProfiles: Record<string, any> = {}

    // ═══ SEARCH SOCIAL PROFILES FOR EACH CONTACT ═══
    for (const contact of contacts || []) {
      if (!contact.name || contact.name.length < 3) continue
      if (rateLimited) break

      const location = `${partner.city || ''} ${partner.country_name || ''}`.trim()

      // --- LinkedIn personal ---
      if (!existingSet.has(`${contact.id}_linkedin`)) {
        try {
          const query = `"${contact.name}" "${partner.company_name}" site:linkedin.com/in`
          console.log(`LinkedIn search: ${query}`)
          const results = (await firecrawlSearch(query, firecrawlKey, 5))
            .filter((r: any) => r.url?.includes('linkedin.com/in/'))

          if (results.length > 0) {
            const answer = await aiPickUrl(
              `Find the PERSONAL LinkedIn profile (linkedin.com/in/) of "${contact.name}" at "${partner.company_name}" in ${location}.${contact.title ? ` Title: "${contact.title}"` : ''}
Results:\n${results.map((r: any, i: number) => `${i + 1}. ${r.url} - ${r.title || ''}`).join('\n')}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
              lovableKey
            )
            if (answer && answer !== 'NONE' && answer.includes('linkedin.com/in/')) {
              const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/)
              if (urlMatch) {
                const { error } = await supabase.from('partner_social_links').insert({
                  partner_id: partnerId, contact_id: contact.id, platform: 'linkedin', url: urlMatch[1].replace(/\/$/, '')
                })
                if (!error) socialLinksFound++
              }
            }
          }
          await delay(500)
        } catch (e: any) {
          if (e.message === 'RATE_LIMITED') { rateLimited = true; break }
          console.error(`LinkedIn error for ${contact.name}:`, e)
        }
      }

      // --- Facebook personal ---
      if (!existingSet.has(`${contact.id}_facebook`) && !rateLimited) {
        try {
          const query = `"${contact.name}" "${partner.company_name}" site:facebook.com`
          console.log(`Facebook search: ${query}`)
          const results = (await firecrawlSearch(query, firecrawlKey, 5))
            .filter((r: any) => r.url?.includes('facebook.com/') && !r.url?.includes('/groups/') && !r.url?.includes('/events/'))

          if (results.length > 0) {
            const answer = await aiPickUrl(
              `Find the PERSONAL Facebook profile of "${contact.name}" at "${partner.company_name}" in ${location}.
Results:\n${results.map((r: any, i: number) => `${i + 1}. ${r.url} - ${r.title || ''}`).join('\n')}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
              lovableKey
            )
            if (answer && answer !== 'NONE' && answer.includes('facebook.com')) {
              const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+facebook\.com[^\s"<>]*)/)
              if (urlMatch) {
                const { error } = await supabase.from('partner_social_links').insert({
                  partner_id: partnerId, contact_id: contact.id, platform: 'facebook', url: urlMatch[1].replace(/\/$/, '')
                })
                if (!error) socialLinksFound++
              }
            }
          }
          await delay(500)
        } catch (e: any) {
          if (e.message === 'RATE_LIMITED') { rateLimited = true; break }
          console.error(`Facebook error for ${contact.name}:`, e)
        }
      }

      // --- Instagram personal ---
      if (!existingSet.has(`${contact.id}_instagram`) && !rateLimited) {
        try {
          const query = `"${contact.name}" "${partner.company_name}" site:instagram.com`
          console.log(`Instagram search: ${query}`)
          const results = (await firecrawlSearch(query, firecrawlKey, 5))
            .filter((r: any) => r.url?.includes('instagram.com/'))

          if (results.length > 0) {
            const answer = await aiPickUrl(
              `Find the Instagram profile of "${contact.name}" at "${partner.company_name}" in ${location}.
Results:\n${results.map((r: any, i: number) => `${i + 1}. ${r.url} - ${r.title || ''}`).join('\n')}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
              lovableKey
            )
            if (answer && answer !== 'NONE' && answer.includes('instagram.com')) {
              const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+instagram\.com[^\s"<>]*)/)
              if (urlMatch) {
                const { error } = await supabase.from('partner_social_links').insert({
                  partner_id: partnerId, contact_id: contact.id, platform: 'instagram', url: urlMatch[1].replace(/\/$/, '')
                })
                if (!error) socialLinksFound++
              }
            }
          }
          await delay(500)
        } catch (e: any) {
          if (e.message === 'RATE_LIMITED') { rateLimited = true; break }
          console.error(`Instagram error for ${contact.name}:`, e)
        }
      }

      // --- Personal web search (2-3 queries for identikit) ---
      if (!rateLimited) {
        try {
          const queries = [
            `"${contact.name}" "${partner.company_name}" ${location}`,
            `"${contact.name}" freight logistics ${partner.country_name || ''}`,
          ]
          if (contact.title) queries.push(`"${contact.name}" "${contact.title}" logistics`)

          let allSnippets: string[] = []
          for (const q of queries) {
            console.log(`Web search for profile: ${q}`)
            const results = await firecrawlSearch(q, firecrawlKey, 3)
            results.forEach((r: any) => {
              if (r.title || r.description) {
                allSnippets.push(`${r.title || ''}: ${r.description || ''} (${r.url || ''})`)
              }
            })
            await delay(300)
          }

          if (allSnippets.length > 0) {
            const profile = await aiGenerateProfile(
              `Based on web search results, create a brief professional profile for "${contact.name}" who works at "${partner.company_name}" (${partner.city}, ${partner.country_name}).${contact.title ? ` Role: ${contact.title}.` : ''}

Web results:
${allSnippets.slice(0, 15).join('\n')}

Generate a JSON object (no markdown, just raw JSON) with these fields:
- "background": brief professional background (1-2 sentences)
- "interests": any detectable hobbies or interests (array of strings, empty if none found)
- "languages": likely spoken languages based on location and name (array of strings)
- "other_companies": other companies they may be associated with (array of strings, empty if none)
- "notes": any other relevant info (1 sentence, or empty string)

If you can't find meaningful info, return: {"background":"","interests":[],"languages":[],"other_companies":[],"notes":""}`,
              lovableKey
            )

            if (profile) {
              try {
                const cleaned = profile.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                const parsed = JSON.parse(cleaned)
                contactProfiles[contact.id] = { name: contact.name, title: contact.title, ...parsed }
              } catch {
                console.log(`Could not parse profile JSON for ${contact.name}`)
              }
            }
          }
          await delay(500)
        } catch (e: any) {
          if (e.message === 'RATE_LIMITED') { rateLimited = true; break }
          console.error(`Profile search error for ${contact.name}:`, e)
        }
      }
    }

    // ═══ COMPANY LINKEDIN ═══
    if (!existingSet.has('company_linkedin') && !rateLimited) {
      try {
        const companyQuery = `"${partner.company_name}" site:linkedin.com/company`
        console.log(`Company LinkedIn: ${companyQuery}`)
        const results = await firecrawlSearch(companyQuery, firecrawlKey, 3)
        const companyResult = results.find((r: any) => r.url?.includes('linkedin.com/company/'))
        if (companyResult) {
          const { error } = await supabase.from('partner_social_links').insert({
            partner_id: partnerId, contact_id: null, platform: 'linkedin', url: companyResult.url.replace(/\/$/, '')
          })
          if (!error) socialLinksFound++
        }
      } catch (e) {
        console.error('Company LinkedIn error:', e)
      }
    }

    // ═══ COMPANY PROFILE SEARCH ═══
    let companyProfile: any = null
    if (!rateLimited) {
      try {
        const queries = [
          `"${partner.company_name}" ${partner.city || ''} freight forwarding awards certifications`,
          `"${partner.company_name}" ${partner.country_name || ''} logistics news`,
        ]
        let allSnippets: string[] = []
        for (const q of queries) {
          console.log(`Company profile search: ${q}`)
          const results = await firecrawlSearch(q, firecrawlKey, 3)
          results.forEach((r: any) => {
            if (r.title || r.description) {
              allSnippets.push(`${r.title || ''}: ${r.description || ''} (${r.url || ''})`)
            }
          })
          await delay(300)
        }

        if (allSnippets.length > 0) {
          const profile = await aiGenerateProfile(
            `Based on web results about "${partner.company_name}" (${partner.city}, ${partner.country_name}), a freight forwarding/logistics company, create a JSON company profile:

Web results:
${allSnippets.slice(0, 15).join('\n')}

Return JSON (no markdown):
- "awards": array of awards/recognitions (empty if none)
- "certifications_extra": extra certifications found beyond IATA/ISO (array, empty if none)
- "recent_news": 1-2 sentence summary of recent news (empty string if none)
- "specialties": notable specialties or strengths (array, empty if none)
- "founded_year": year founded if found (null if not)
- "employee_count_estimate": estimated employee count if mentioned (null if not)

If nothing meaningful found, return: {"awards":[],"certifications_extra":[],"recent_news":"","specialties":[],"founded_year":null,"employee_count_estimate":null}`,
            lovableKey
          )

          if (profile) {
            try {
              const cleaned = profile.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
              companyProfile = JSON.parse(cleaned)
            } catch {
              console.log('Could not parse company profile JSON')
            }
          }
        }
      } catch (e) {
        console.error('Company profile error:', e)
      }
    }

    // ═══ LOGO FROM WEBSITE ═══
    if (partner.website) {
      try {
        const websiteUrl = partner.website.startsWith('http') ? partner.website : `https://${partner.website}`
        console.log(`Scraping logo: ${websiteUrl}`)
        const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: websiteUrl, formats: ['links'] }),
        })
        if (scrapeResp.ok) {
          const scrapeData = await scrapeResp.json()
          const metadata = scrapeData?.data?.metadata || scrapeData?.metadata || {}
          let logoUrl = metadata.ogImage || metadata['og:image'] || metadata.favicon || metadata.icon || null
          if (!logoUrl) {
            try {
              const domain = new URL(websiteUrl).hostname
              logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
            } catch {}
          }
          if (logoUrl) {
            const { error } = await supabase.from('partners').update({ logo_url: logoUrl }).eq('id', partnerId)
            if (!error) logoFound = true
          }
        }
      } catch (e) {
        console.error('Logo error:', e)
      }
    }

    // ═══ SAVE ENRICHMENT DATA ═══
    const existingEnrichment = (partner.enrichment_data as any) || {}
    const updatedEnrichment = {
      ...existingEnrichment,
      ...(Object.keys(contactProfiles).length > 0 ? { contact_profiles: contactProfiles } : {}),
      ...(companyProfile ? { company_profile: companyProfile } : {}),
      deep_search_at: new Date().toISOString(),
    }

    await supabase.from('partners').update({ enrichment_data: updatedEnrichment }).eq('id', partnerId)

    console.log(`Deep search complete for ${partner.company_name}: ${socialLinksFound} social links, logo: ${logoFound}, profiles: ${Object.keys(contactProfiles).length}${rateLimited ? ' (rate limited)' : ''}`)

    return new Response(
      JSON.stringify({
        success: true,
        socialLinksFound,
        logoFound,
        contactProfilesFound: Object.keys(contactProfiles).length,
        companyProfileFound: !!companyProfile,
        rateLimited,
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
