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

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

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

    // Check credits
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

    // Get contact
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

    const searchTerms = [personName, companyName].filter(Boolean).join(' ')
    if (!searchTerms) {
      return new Response(JSON.stringify({ success: false, error: 'Dati insufficienti per la ricerca' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const totalTokens = { prompt: 0, completion: 0 }
    let allSnippets: string[] = []

    // Search 1: Person + Company LinkedIn
    if (personName) {
      const q1 = `"${personName}" ${companyName ? `"${companyName}"` : ''} site:linkedin.com/in`
      console.log('Search 1:', q1)
      const r1 = await firecrawlSearch(q1, firecrawlKey, 5)
      r1.forEach((r: any) => allSnippets.push(`[LinkedIn] ${r.title || ''}: ${r.description || ''} (${r.url || ''})`))
      await delay(400)
    }

    // Search 2: Person + Company general
    const q2 = `"${personName || companyName}" ${companyName && personName ? `"${companyName}"` : ''} ${city} ${country}`.trim()
    console.log('Search 2:', q2)
    const r2 = await firecrawlSearch(q2, firecrawlKey, 5)
    r2.forEach((r: any) => allSnippets.push(`[Web] ${r.title || ''}: ${r.description || ''} (${r.url || ''})`))
    await delay(400)

    // Search 3: Facebook/Instagram
    if (personName) {
      const q3 = `"${personName}" ${companyName ? `"${companyName}"` : ''} (site:facebook.com OR site:instagram.com)`
      console.log('Search 3:', q3)
      const r3 = await firecrawlSearch(q3, firecrawlKey, 5)
      r3.forEach((r: any) => allSnippets.push(`[Social] ${r.title || ''}: ${r.description || ''} (${r.url || ''})`))
      await delay(400)
    }

    // Search 4: Company website/info
    if (companyName) {
      const q4 = `"${companyName}" ${city} ${country} logistics freight`.trim()
      console.log('Search 4:', q4)
      const r4 = await firecrawlSearch(q4, firecrawlKey, 3)
      r4.forEach((r: any) => allSnippets.push(`[Company] ${r.title || ''}: ${r.description || ''} (${r.url || ''})`))
    }

    // AI Analysis
    const aiPrompt = `Analyze these web search results about a person/company and extract a structured profile.

Person: ${personName || 'N/A'}
Company: ${companyName || 'N/A'}
Position: ${position || 'N/A'}
City: ${city || 'N/A'}
Country: ${country || 'N/A'}
Email: ${email || 'N/A'}

Web search results:
${allSnippets.slice(0, 25).join('\n')}

Generate a JSON object (raw JSON only, no markdown) with:
- "linkedin_url": personal LinkedIn URL if found, null otherwise
- "facebook_url": personal Facebook URL if found, null otherwise
- "instagram_url": personal Instagram URL if found, null otherwise
- "company_website": company website if found, null otherwise
- "professional_background": 2-3 sentence professional background
- "current_role": current role/title at current company
- "previous_companies": array of previous company names (max 3)
- "industry_keywords": array of industry keywords (max 5)
- "confidence": "high" | "medium" | "low" based on how well results match the person
- "summary": 1-2 sentence executive summary of who this person is`

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: aiPrompt }],
      }),
    })

    let enrichment: any = { search_results_count: allSnippets.length }

    if (aiResp.ok) {
      const aiData = await aiResp.json()
      if (aiData.usage) {
        totalTokens.prompt += aiData.usage.prompt_tokens || 0
        totalTokens.completion += aiData.usage.completion_tokens || 0
      }
      const raw = aiData?.choices?.[0]?.message?.content?.trim() || ''
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        enrichment = { ...enrichment, ...JSON.parse(cleaned) }
      } catch {
        enrichment.raw_ai_response = raw
      }
    }

    enrichment.deep_search_at = new Date().toISOString()
    enrichment.searches_performed = allSnippets.length

    // Save to contact
    const { error: updateError } = await supabase
      .from('imported_contacts')
      .update({
        enrichment_data: enrichment,
        deep_search_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (updateError) console.error('Update error:', updateError)

    // Deduct credits
    const inputCost = Math.ceil(totalTokens.prompt / 1000)
    const outputCost = Math.ceil(totalTokens.completion / 1000 * 2)
    const totalCost = Math.max(inputCost + outputCost, 2)
    await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: totalCost,
      p_operation: 'ai_call',
      p_description: `deep-search-contact: ${personName || companyName}`,
    })

    return new Response(JSON.stringify({
      success: true,
      contactName: personName || companyName,
      linkedinFound: !!enrichment.linkedin_url,
      socialLinksFound: [enrichment.linkedin_url, enrichment.facebook_url, enrichment.instagram_url].filter(Boolean).length,
      companyWebsiteFound: !!enrichment.company_website,
      confidence: enrichment.confidence || 'low',
      summary: enrichment.summary || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Deep search contact error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
