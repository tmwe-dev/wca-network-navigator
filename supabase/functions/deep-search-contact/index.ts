import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function getUserId(req: Request, supabase: any): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth) return null
  const token = auth.replace('Bearer ', '')
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id || null
}

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

async function aiPickUrl(
  prompt: string, lovableKey: string, tokens: { prompt: number; completion: number }
): Promise<string | null> {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'user', content: prompt }] }),
  })
  if (!resp.ok) {
    if (resp.status === 429) throw new Error('RATE_LIMITED')
    return null
  }
  const data = await resp.json()
  if (data.usage) {
    tokens.prompt += data.usage.prompt_tokens || 0
    tokens.completion += data.usage.completion_tokens || 0
  }
  return data?.choices?.[0]?.message?.content?.trim() || null
}

async function aiGenerateProfile(
  prompt: string, lovableKey: string, tokens: { prompt: number; completion: number }
): Promise<string | null> {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'user', content: prompt }] }),
  })
  if (!resp.ok) return null
  const data = await resp.json()
  if (data.usage) {
    tokens.prompt += data.usage.prompt_tokens || 0
    tokens.completion += data.usage.completion_tokens || 0
  }
  return data?.choices?.[0]?.message?.content?.trim() || null
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function getLastName(name: string): string { return name.trim().split(/\s+/).pop() || name }
function toWhatsAppNumber(phone: string): string { return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '') }

function extractSeniority(title: string | undefined): { seniority: string; linkedin_title: string } | null {
  if (!title) return null
  const titleParts = title.split(' - ')
  if (titleParts.length < 2) return null
  const role = titleParts[1].split(' | ')[0]?.trim()
  if (!role) return null
  const seniorKw = ['CEO', 'Director', 'VP', 'President', 'Owner', 'Founder', 'Managing', 'General Manager', 'Head', 'Chief', 'Partner', 'Principal']
  const midKw = ['Manager', 'Supervisor', 'Lead', 'Senior', 'Coordinator', 'Team Lead']
  let seniority = 'junior'
  if (seniorKw.some(k => role.includes(k))) seniority = 'senior'
  else if (midKw.some(k => role.includes(k))) seniority = 'mid'
  return { seniority, linkedin_title: role }
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

    if (!firecrawlKey || !lovableKey) {
      return new Response(JSON.stringify({ success: false, error: 'API keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const userId = await getUserId(req, supabase)
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Credit check
    const { data: credits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
    if (!credits || credits.balance < 5) {
      return new Response(JSON.stringify({ success: false, error: 'Crediti insufficienti' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { contactId } = await req.json()
    if (!contactId) {
      return new Response(JSON.stringify({ success: false, error: 'contactId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: contact, error: contactError } = await supabase
      .from('imported_contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return new Response(JSON.stringify({ success: false, error: 'Contact not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const personName = contact.name || ''
    const companyName = contact.company_name || ''
    const city = contact.city || ''
    const country = contact.country || ''
    const email = contact.email || ''
    const position = contact.position || ''
    const mobile = contact.mobile || ''
    const phone = contact.phone || ''
    const location = `${city} ${country}`.trim()

    const searchTerms = [personName, companyName].filter(Boolean).join(' ')
    if (!searchTerms) {
      return new Response(JSON.stringify({ success: false, error: 'Dati insufficienti per la ricerca' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const totalTokens = { prompt: 0, completion: 0 }
    let socialLinksFound = 0
    let logoFound = false
    let rateLimited = false
    const contactProfile: any = { name: personName, title: position }

    // ═══ 1. LINKEDIN PERSONAL (3 retry attempts) ═══
    let linkedinUrl: string | null = null
    if (personName && !rateLimited) {
      try {
        // Attempt 1: full name + company
        const q1 = `"${personName}" ${companyName ? `"${companyName}"` : ''} site:linkedin.com/in`
        console.log('LinkedIn search 1:', q1)
        let results = (await firecrawlSearch(q1, firecrawlKey, 5))
          .filter((r: any) => r.url?.includes('linkedin.com/in/'))

        // Attempt 2: last name + company
        if (results.length === 0 && companyName) {
          const lastName = getLastName(personName)
          const q2 = `"${lastName}" "${companyName}" site:linkedin.com/in`
          console.log('LinkedIn retry 2:', q2)
          results = (await firecrawlSearch(q2, firecrawlKey, 5))
            .filter((r: any) => r.url?.includes('linkedin.com/in/'))
          await delay(300)
        }

        // Attempt 3: name + city
        if (results.length === 0 && city) {
          const q3 = `"${personName}" ${city} linkedin`
          console.log('LinkedIn retry 3:', q3)
          results = (await firecrawlSearch(q3, firecrawlKey, 5))
            .filter((r: any) => r.url?.includes('linkedin.com/in/'))
          await delay(300)
        }

        if (results.length > 0) {
          const answer = await aiPickUrl(
            `Find the PERSONAL LinkedIn profile (linkedin.com/in/) of "${personName}"${companyName ? ` at "${companyName}"` : ''} in ${location}.${position ? ` Title: "${position}"` : ''}
Results:\n${results.map((r: any, i: number) => `${i + 1}. ${r.url} - ${r.title || ''}`).join('\n')}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
            lovableKey, totalTokens
          )
          if (answer && answer !== 'NONE' && answer.includes('linkedin.com/in/')) {
            const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+linkedin\.com\/in\/[^\s"<>]+)/)
            if (urlMatch) {
              linkedinUrl = urlMatch[1].replace(/\/$/, '')
              socialLinksFound++
              // Extract seniority
              const matchingResult = results.find((r: any) => r.url === linkedinUrl || linkedinUrl?.includes(r.url?.replace(/\/$/, '')))
              const seniorityData = extractSeniority(matchingResult?.title || results[0]?.title)
              if (seniorityData) {
                contactProfile.seniority = seniorityData.seniority
                contactProfile.linkedin_title = seniorityData.linkedin_title
              }
            }
          }
        }
        await delay(400)
      } catch (e: any) {
        if (e.message === 'RATE_LIMITED') rateLimited = true
        else console.error('LinkedIn error:', e)
      }
    }

    // ═══ 2. FACEBOOK PERSONAL ═══
    let facebookUrl: string | null = null
    if (personName && !rateLimited) {
      try {
        const q = `"${personName}" ${companyName ? `"${companyName}"` : ''} site:facebook.com`
        console.log('Facebook search:', q)
        const results = (await firecrawlSearch(q, firecrawlKey, 5))
          .filter((r: any) => r.url?.includes('facebook.com/') && !r.url?.includes('/groups/') && !r.url?.includes('/events/'))

        if (results.length > 0) {
          const answer = await aiPickUrl(
            `Find the PERSONAL Facebook profile of "${personName}"${companyName ? ` at "${companyName}"` : ''} in ${location}.
Results:\n${results.map((r: any, i: number) => `${i + 1}. ${r.url} - ${r.title || ''}`).join('\n')}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
            lovableKey, totalTokens
          )
          if (answer && answer !== 'NONE' && answer.includes('facebook.com')) {
            const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+facebook\.com[^\s"<>]*)/)
            if (urlMatch) { facebookUrl = urlMatch[1].replace(/\/$/, ''); socialLinksFound++ }
          }
        }
        await delay(400)
      } catch (e: any) {
        if (e.message === 'RATE_LIMITED') rateLimited = true
        else console.error('Facebook error:', e)
      }
    }

    // ═══ 3. INSTAGRAM PERSONAL ═══
    let instagramUrl: string | null = null
    if (personName && !rateLimited) {
      try {
        const q = `"${personName}" ${companyName ? `"${companyName}"` : ''} site:instagram.com`
        console.log('Instagram search:', q)
        const results = (await firecrawlSearch(q, firecrawlKey, 5))
          .filter((r: any) => r.url?.includes('instagram.com/'))

        if (results.length > 0) {
          const answer = await aiPickUrl(
            `Find the Instagram profile of "${personName}"${companyName ? ` at "${companyName}"` : ''} in ${location}.
Results:\n${results.map((r: any, i: number) => `${i + 1}. ${r.url} - ${r.title || ''}`).join('\n')}
If one matches, respond with ONLY the URL. If none, respond "NONE".`,
            lovableKey, totalTokens
          )
          if (answer && answer !== 'NONE' && answer.includes('instagram.com')) {
            const urlMatch = answer.match(/(https?:\/\/[^\s"<>]+instagram\.com[^\s"<>]*)/)
            if (urlMatch) { instagramUrl = urlMatch[1].replace(/\/$/, ''); socialLinksFound++ }
          }
        }
        await delay(400)
      } catch (e: any) {
        if (e.message === 'RATE_LIMITED') rateLimited = true
        else console.error('Instagram error:', e)
      }
    }

    // ═══ 4. WHATSAPP AUTO-LINK ═══
    let whatsappUrl: string | null = null
    const waNumber = mobile || phone
    if (waNumber) {
      const cleaned = toWhatsAppNumber(waNumber)
      if (cleaned.length >= 8) {
        whatsappUrl = `https://wa.me/${cleaned}`
        socialLinksFound++
        console.log(`WhatsApp auto-link: ${whatsappUrl}`)
      }
    }

    // ═══ 5. COMPANY LINKEDIN ═══
    let companyLinkedinUrl: string | null = null
    if (companyName && !rateLimited) {
      try {
        const q = `"${companyName}" site:linkedin.com/company`
        console.log('Company LinkedIn:', q)
        const results = await firecrawlSearch(q, firecrawlKey, 3)
        const match = results.find((r: any) => r.url?.includes('linkedin.com/company/'))
        if (match) { companyLinkedinUrl = match.url.replace(/\/$/, ''); socialLinksFound++ }
        await delay(300)
      } catch (e) { console.error('Company LinkedIn error:', e) }
    }

    // ═══ 6. WEBSITE DISCOVERY (from email domain) ═══
    let companyWebsite: string | null = null
    if (email && !email.includes('gmail.com') && !email.includes('yahoo.') && !email.includes('hotmail.') && !email.includes('outlook.')) {
      const domain = email.split('@')[1]
      if (domain) {
        companyWebsite = `https://${domain}`
        console.log(`Website from email domain: ${companyWebsite}`)
      }
    }
    // Fallback: search
    if (!companyWebsite && companyName && !rateLimited) {
      try {
        const q = `"${companyName}" ${city} ${country} official website`
        const results = await firecrawlSearch(q, firecrawlKey, 3)
        const candidate = results.find((r: any) => r.url && !r.url.includes('linkedin.com') && !r.url.includes('facebook.com'))
        if (candidate?.url) {
          try { companyWebsite = new URL(candidate.url).origin } catch {}
        }
        await delay(300)
      } catch (e) { console.error('Website search error:', e) }
    }

    // ═══ 7. LOGO DISCOVERY + WEBSITE QUALITY ═══
    let logoUrl: string | null = null
    let websiteQualityScore = 0
    if (companyWebsite && !rateLimited) {
      try {
        console.log(`Scraping website for logo + quality: ${companyWebsite}`)
        const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: companyWebsite, formats: ['branding', 'markdown'] }),
        })
        if (scrapeResp.ok) {
          const scrapeData = await scrapeResp.json()
          const branding = scrapeData?.data?.branding || scrapeData?.branding || {}
          const metadata = scrapeData?.data?.metadata || scrapeData?.metadata || {}

          logoUrl = branding?.logo || branding?.images?.logo || null
          if (!logoUrl) logoUrl = metadata.ogImage || metadata['og:image'] || null

          // Validate logo
          if (logoUrl) {
            try { const h = await fetch(logoUrl, { method: 'HEAD' }); if (!h.ok) logoUrl = null } catch { logoUrl = null }
          }
          // Favicon fallback
          if (!logoUrl) {
            try { const d = new URL(companyWebsite).hostname; logoUrl = `https://www.google.com/s2/favicons?domain=${d}&sz=128` } catch {}
          }
          if (logoUrl) logoFound = true

          // Website quality AI
          const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || ''
          if (markdown.length > 100) {
            try {
              const answer = await aiPickUrl(
                `Rate this company website 1-5 for: design quality, content completeness, professionalism, business signals. Respond with ONLY a number 1-5.\n\nContent:\n${markdown.slice(0, 3000)}`,
                lovableKey, totalTokens
              )
              if (answer) {
                const parsed = parseInt(answer.replace(/[^1-5]/g, ''))
                if (parsed >= 1 && parsed <= 5) websiteQualityScore = parsed
              }
            } catch (e: any) {
              if (e.message === 'RATE_LIMITED') rateLimited = true
            }
          }
        }
      } catch (e) { console.error('Logo/website error:', e) }
    }

    // ═══ 8. COMPANY PROFILE AI ═══
    let companyProfile: any = null
    if (companyName && !rateLimited) {
      try {
        const queries = [
          `"${companyName}" ${city} awards certifications specialties`,
          `"${companyName}" ${country} news employees`,
        ]
        let allSnippets: string[] = []
        for (const q of queries) {
          console.log('Company profile search:', q)
          const results = await firecrawlSearch(q, firecrawlKey, 3)
          results.forEach((r: any) => {
            if (r.title || r.description) allSnippets.push(`${r.title || ''}: ${r.description || ''} (${r.url || ''})`)
          })
          await delay(300)
        }

        if (allSnippets.length > 0) {
          const profile = await aiGenerateProfile(
            `Based on web results about "${companyName}" (${location}), create a JSON company profile:
Web results:\n${allSnippets.slice(0, 15).join('\n')}

Return JSON (no markdown):
- "awards": array of awards/recognitions (empty if none)
- "specialties": notable specialties or strengths (array, empty if none)
- "recent_news": 1-2 sentence summary (empty string if none)
- "founded_year": year founded if found (null if not)
- "employee_count_estimate": estimated employees if mentioned (null if not)
- "industry": industry sector (string, or null)

If nothing found: {"awards":[],"specialties":[],"recent_news":"","founded_year":null,"employee_count_estimate":null,"industry":null}`,
            lovableKey, totalTokens
          )
          if (profile) {
            try {
              companyProfile = JSON.parse(profile.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
            } catch { console.log('Could not parse company profile') }
          }
        }
      } catch (e) { console.error('Company profile error:', e) }
    }

    // ═══ 9. CONTACT PROFILE AI ═══
    if (personName && !rateLimited) {
      try {
        const queries = [
          `"${personName}" ${companyName ? `"${companyName}"` : ''} ${location}`,
          `"${personName}" ${position || ''} ${country}`,
        ]
        let allSnippets: string[] = []
        for (const q of queries) {
          console.log('Contact profile search:', q)
          const results = await firecrawlSearch(q, firecrawlKey, 3)
          results.forEach((r: any) => {
            if (r.title || r.description) allSnippets.push(`${r.title || ''}: ${r.description || ''} (${r.url || ''})`)
          })
          await delay(300)
        }

        if (allSnippets.length > 0) {
          const profile = await aiGenerateProfile(
            `Create a professional profile for "${personName}"${companyName ? ` at "${companyName}"` : ''} (${location}).${position ? ` Role: ${position}.` : ''}
Web results:\n${allSnippets.slice(0, 15).join('\n')}

Return JSON (no markdown):
- "background": professional background (1-2 sentences)
- "interests": hobbies/interests (array, empty if none)
- "languages": likely spoken languages (array)
- "other_companies": other associated companies (array, empty if none)
- "notes": other relevant info (string, empty if none)

If nothing found: {"background":"","interests":[],"languages":[],"other_companies":[],"notes":""}`,
            lovableKey, totalTokens
          )
          if (profile) {
            try {
              const parsed = JSON.parse(profile.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
              Object.assign(contactProfile, parsed)
            } catch { console.log('Could not parse contact profile') }
          }
        }
      } catch (e: any) {
        if (e.message === 'RATE_LIMITED') rateLimited = true
        else console.error('Contact profile error:', e)
      }
    }

    // ═══ SAVE ENRICHMENT DATA ═══
    const inputCost = Math.ceil(totalTokens.prompt / 1000)
    const outputCost = Math.ceil(totalTokens.completion / 1000 * 2)
    const creditsConsumed = Math.max(inputCost + outputCost, 2)

    const enrichment: any = {
      ...(contact.enrichment_data as any || {}),
      linkedin_url: linkedinUrl,
      facebook_url: facebookUrl,
      instagram_url: instagramUrl,
      whatsapp_url: whatsappUrl,
      company_linkedin_url: companyLinkedinUrl,
      company_website: companyWebsite,
      logo_url: logoUrl,
      website_quality_score: websiteQualityScore || null,
      company_profile: companyProfile,
      contact_profile: contactProfile,
      confidence: socialLinksFound >= 3 ? 'high' : socialLinksFound >= 1 ? 'medium' : 'low',
      deep_search_at: new Date().toISOString(),
      searches_performed: socialLinksFound,
      rate_limited: rateLimited,
      tokens_used: {
        prompt: totalTokens.prompt,
        completion: totalTokens.completion,
        credits_consumed: creditsConsumed,
      },
    }

    await supabase
      .from('imported_contacts')
      .update({ enrichment_data: enrichment, deep_search_at: new Date().toISOString() })
      .eq('id', contactId)

    // Deduct credits
    await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: creditsConsumed,
      p_operation: 'ai_call',
      p_description: `deep-search-contact: ${personName || companyName}`,
    })

    console.log(`Deep search contact complete: ${personName || companyName} — ${socialLinksFound} social, logo: ${logoFound}, quality: ${websiteQualityScore}${rateLimited ? ' (rate limited)' : ''}`)

    return new Response(JSON.stringify({
      success: true,
      contactName: personName || companyName,
      linkedinFound: !!linkedinUrl,
      socialLinksFound,
      companyWebsiteFound: !!companyWebsite,
      logoFound,
      companyProfileFound: !!companyProfile,
      confidence: enrichment.confidence,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Deep search contact error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
