import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ── Credit helpers ──
async function getUserId(req: Request, supabase: any): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth) return null
  const token = auth.replace('Bearer ', '')
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id || null
}

async function isByok(userId: string, supabase: any): Promise<boolean> {
  const { data } = await supabase
    .from('user_api_keys')
    .select('api_key')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle()
  return !!data?.api_key
}

async function consumeCredits(userId: string, totalTokens: { prompt: number; completion: number }, supabase: any) {
  const inputCost = Math.ceil(totalTokens.prompt / 1000 * 1)
  const outputCost = Math.ceil(totalTokens.completion / 1000 * 2)
  const total = inputCost + outputCost
  if (total <= 0) return

  const { data: credits } = await supabase.from('user_credits').select('balance, total_consumed').eq('user_id', userId).single()
  if (!credits) return

  await supabase.from('user_credits').update({
    balance: Math.max(0, credits.balance - total),
    total_consumed: credits.total_consumed + total,
  }).eq('user_id', userId)

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: -total,
    operation: 'ai_call',
    description: `deep-search-partner: ${totalTokens.prompt} in + ${totalTokens.completion} out`,
  })
  console.log(`Credits consumed: ${total} (balance: ${credits.balance - total})`)
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

// Helper: AI pick best URL from results (tracks tokens)
async function aiPickUrl(
  prompt: string,
  lovableKey: string,
  tokenAccumulator: { prompt: number; completion: number }
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
  if (data.usage) {
    tokenAccumulator.prompt += data.usage.prompt_tokens || 0
    tokenAccumulator.completion += data.usage.completion_tokens || 0
  }
  return data?.choices?.[0]?.message?.content?.trim() || null
}

// Helper: AI generate profile (tracks tokens)
async function aiGenerateProfile(
  prompt: string,
  lovableKey: string,
  tokenAccumulator: { prompt: number; completion: number }
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
  if (data.usage) {
    tokenAccumulator.prompt += data.usage.prompt_tokens || 0
    tokenAccumulator.completion += data.usage.completion_tokens || 0
  }
  return data?.choices?.[0]?.message?.content?.trim() || null
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// Helper: normalize phone for WhatsApp
function toWhatsAppNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '')
}

// Helper: extract seniority from LinkedIn title
function extractSeniority(title: string | undefined): { seniority: string; linkedin_title: string } | null {
  if (!title) return null
  const titleParts = title.split(' - ')
  if (titleParts.length < 2) return null
  const role = titleParts[1].split(' | ')[0]?.trim()
  if (!role) return null
  const seniorKeywords = ['CEO', 'Director', 'VP', 'President', 'Owner', 'Founder', 'Managing', 'General Manager', 'Head', 'Chief', 'Partner', 'Principal']
  const midKeywords = ['Manager', 'Supervisor', 'Lead', 'Senior', 'Coordinator', 'Team Lead']
  let seniority = 'junior'
  if (seniorKeywords.some(k => role.includes(k))) seniority = 'senior'
  else if (midKeywords.some(k => role.includes(k))) seniority = 'mid'
  return { seniority, linkedin_title: role }
}

// Helper: extract last name for retry searches
function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1]
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

    // ── Auth & BYOK check ──
    const userId = await getUserId(req, supabase)
    const byok = userId ? await isByok(userId, supabase) : false

    if (userId && !byok) {
      const { data: credits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
      if (!credits || credits.balance < 10) {
        return new Response(
          JSON.stringify({ success: false, error: 'Crediti insufficienti. Acquista crediti extra o aggiungi le tue chiavi API.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { partnerId } = await req.json()

    if (!partnerId) {
      return new Response(JSON.stringify({ success: false, error: 'partnerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Token accumulator for all AI calls
    const totalTokens = { prompt: 0, completion: 0 }

    // Get partner data
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, company_name, website, city, country_name, enrichment_data, email, profile_description, member_since, phone')
      .eq('id', partnerId)
      .single()

    if (partnerError || !partner) {
      return new Response(JSON.stringify({ success: false, error: 'Partner not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get contacts (include mobile for WhatsApp)
    const { data: contacts = [] } = await supabase
      .from('partner_contacts')
      .select('id, name, title, email, mobile, direct_phone')
      .eq('partner_id', partnerId)

    // Get existing social links to avoid duplicates
    const { data: existingLinks = [] } = await supabase
      .from('partner_social_links')
      .select('contact_id, platform')
      .eq('partner_id', partnerId)

    // Get networks and certifications for rating
    const { data: networks = [] } = await supabase
      .from('partner_networks')
      .select('network_name')
      .eq('partner_id', partnerId)

    const { data: certifications = [] } = await supabase
      .from('partner_certifications')
      .select('certification')
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

      // --- LinkedIn personal (with smart retry) ---
      if (!existingSet.has(`${contact.id}_linkedin`)) {
        try {
          // First attempt: full name + company
          const query = `"${contact.name}" "${partner.company_name}" site:linkedin.com/in`
          console.log(`LinkedIn search: ${query}`)
          let results = (await firecrawlSearch(query, firecrawlKey, 5))
            .filter((r: any) => r.url?.includes('linkedin.com/in/'))

          // Smart retry: if no results, try with last name only + company + logistics
          if (results.length === 0) {
            const lastName = getLastName(contact.name)
            const retryQuery = `"${lastName}" "${partner.company_name}" logistics site:linkedin.com/in`
            console.log(`LinkedIn retry: ${retryQuery}`)
            results = (await firecrawlSearch(retryQuery, firecrawlKey, 5))
              .filter((r: any) => r.url?.includes('linkedin.com/in/'))
            await delay(300)
          }

          // Third attempt: name + city + logistics
          if (results.length === 0) {
            const retryQuery2 = `"${contact.name}" ${partner.city || ''} logistics linkedin`
            console.log(`LinkedIn retry 2: ${retryQuery2}`)
            results = (await firecrawlSearch(retryQuery2, firecrawlKey, 5))
              .filter((r: any) => r.url?.includes('linkedin.com/in/'))
            await delay(300)
          }

          if (results.length > 0) {
            const answer = await aiPickUrl(
              `Find the PERSONAL LinkedIn profile (linkedin.com/in/) of "${contact.name}" at "${partner.company_name}" in ${location}.${contact.title ? ` Title: "${contact.title}"` : ''}
Results:\n${results.map((r: any, i: number) => `${i + 1}. ${r.url} - ${r.title || ''}`).join('\n')}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
              lovableKey, totalTokens
            )
            if (answer && answer !== 'NONE' && answer.includes('linkedin.com/in/')) {
              const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/)
              if (urlMatch) {
                const { error } = await supabase.from('partner_social_links').insert({
                  partner_id: partnerId, contact_id: contact.id, platform: 'linkedin', url: urlMatch[1].replace(/\/$/, '')
                })
                if (!error) socialLinksFound++

                // ── Extract seniority from LinkedIn search result title ──
                const matchingResult = results.find((r: any) => r.url === urlMatch[1].replace(/\/$/, '') || urlMatch[1].includes(r.url?.replace(/\/$/, '')))
                const seniorityData = extractSeniority(matchingResult?.title || results[0]?.title)
                if (seniorityData) {
                  if (!contactProfiles[contact.id]) {
                    contactProfiles[contact.id] = { name: contact.name, title: contact.title }
                  }
                  contactProfiles[contact.id].seniority = seniorityData.seniority
                  contactProfiles[contact.id].linkedin_title = seniorityData.linkedin_title
                  console.log(`Seniority for ${contact.name}: ${seniorityData.seniority} (${seniorityData.linkedin_title})`)
                }
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
              lovableKey, totalTokens
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
              lovableKey, totalTokens
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

      // --- WhatsApp auto-link from mobile OR direct_phone fallback ---
      const whatsappNumber = contact.mobile || contact.direct_phone
      if (whatsappNumber && !existingSet.has(`${contact.id}_whatsapp`)) {
        try {
          const cleaned = toWhatsAppNumber(whatsappNumber)
          if (cleaned.length >= 8) {
            const { error } = await supabase.from('partner_social_links').insert({
              partner_id: partnerId, contact_id: contact.id, platform: 'whatsapp', url: `https://wa.me/${cleaned}`
            })
            if (!error) {
              socialLinksFound++
              console.log(`WhatsApp link created for ${contact.name}: wa.me/${cleaned} (from ${contact.mobile ? 'mobile' : 'direct_phone'})`)
            }
          }
        } catch (e) {
          console.error(`WhatsApp link error for ${contact.name}:`, e)
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
              lovableKey, totalTokens
            )

            if (profile) {
              try {
                const cleaned = profile.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                const parsed = JSON.parse(cleaned)
                // Merge with existing seniority data if already extracted
                contactProfiles[contact.id] = { 
                  ...contactProfiles[contact.id],
                  name: contact.name, 
                  title: contact.title, 
                  ...parsed 
                }
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
            lovableKey, totalTokens
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

    // ═══ WEBSITE DISCOVERY (from email domain if missing) ═══
    if (!partner.website) {
      // Try extracting domain from contact emails
      const contactWithEmail = contacts?.find(c => c.email && !c.email.includes('gmail.com') && !c.email.includes('yahoo.') && !c.email.includes('hotmail.') && !c.email.includes('outlook.'))
      if (contactWithEmail?.email) {
        const emailDomain = contactWithEmail.email.split('@')[1]
        if (emailDomain) {
          const websiteUrl = `https://${emailDomain}`
          console.log(`Website discovered from email domain: ${websiteUrl}`)
          await supabase.from('partners').update({ website: websiteUrl }).eq('id', partnerId)
          partner.website = websiteUrl
        }
      }

      // If still no website, search via Firecrawl
      if (!partner.website && !rateLimited) {
        try {
          const searchQuery = `"${partner.company_name}" ${partner.city || ''} ${partner.country_name || ''} official website`
          console.log(`Website search: ${searchQuery}`)
          const results = await firecrawlSearch(searchQuery, firecrawlKey, 3)
          const candidate = results.find((r: any) => r.url && !r.url.includes('linkedin.com') && !r.url.includes('facebook.com') && !r.url.includes('wca.org'))
          if (candidate?.url) {
            try {
              const domain = new URL(candidate.url).origin
              console.log(`Website found via search: ${domain}`)
              await supabase.from('partners').update({ website: domain }).eq('id', partnerId)
              partner.website = domain
            } catch {}
          }
        } catch (e) {
          console.error('Website search error:', e)
        }
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
          let logoUrl = metadata.ogImage || metadata['og:image'] || null
          
          // Validate the logo URL with a HEAD request
          if (logoUrl) {
            try {
              const headResp = await fetch(logoUrl, { method: 'HEAD' })
              if (!headResp.ok) logoUrl = null
            } catch { logoUrl = null }
          }

          // Fallback: Google favicon at 128px
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
        } else {
          // Scrape failed - use Google favicon as fallback
          try {
            const domain = new URL(websiteUrl).hostname
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
            const { error } = await supabase.from('partners').update({ logo_url: faviconUrl }).eq('id', partnerId)
            if (!error) logoFound = true
            console.log(`Logo fallback to Google favicon: ${faviconUrl}`)
          } catch {}
        }
      } catch (e) {
        console.error('Logo error:', e)
      }
    }

    // ═══ CONSUME CREDITS (all AI calls combined) ═══
    if (userId && !byok && (totalTokens.prompt > 0 || totalTokens.completion > 0)) {
      await consumeCredits(userId, totalTokens, supabase)
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

    // ═══ DETERMINISTIC RATING ═══
    let score = 0
    // Website present
    if (partner.website) score += 1
    // Company email
    if (partner.email) score += 0.5
    // Contacts with email
    if (contacts?.some(c => c.email)) score += 1
    // Contacts with phone
    if (contacts?.some(c => c.mobile || c.direct_phone)) score += 0.5
    // Profile description
    if (partner.profile_description) score += 0.5
    // Networks count
    if (networks.length >= 3) score += 1
    else if (networks.length >= 1) score += 0.5
    // Certifications
    if (certifications.length >= 2) score += 0.5
    else if (certifications.length >= 1) score += 0.25
    // Social links found
    if (socialLinksFound >= 3) score += 0.5
    else if (socialLinksFound >= 1) score += 0.25
    // Years of membership
    if (partner.member_since) {
      const memberYears = (Date.now() - new Date(partner.member_since).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      if (memberYears >= 10) score += 0.5
      else if (memberYears >= 5) score += 0.25
    }
    // Company profile enrichment
    if (companyProfile?.specialties?.length > 0) score += 0.25
    if (companyProfile?.awards?.length > 0) score += 0.25

    // Scale to 1-5
    const rating = Math.min(5, Math.max(1, Math.round(score * 0.8 + 1)))
    await supabase.from('partners').update({ rating }).eq('id', partnerId)
    console.log(`Rating calculated: ${rating}/5 (raw score: ${score})`)

    console.log(`Deep search complete for ${partner.company_name}: ${socialLinksFound} social links, logo: ${logoFound}, profiles: ${Object.keys(contactProfiles).length}, rating: ${rating}${rateLimited ? ' (rate limited)' : ''}`)

    return new Response(
      JSON.stringify({
        success: true,
        socialLinksFound,
        logoFound,
        contactProfilesFound: Object.keys(contactProfiles).length,
        companyProfileFound: !!companyProfile,
        rating,
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
