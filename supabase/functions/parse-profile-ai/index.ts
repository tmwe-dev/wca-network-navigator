import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { partnerId, forceReparse } = await req.json()

    if (!partnerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'partnerId is required' }),
        { status: 400, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch partner with raw content
    const { data: partner, error: fetchErr } = await supabase
      .from('partners')
      .select('id, wca_id, company_name, raw_profile_html, raw_profile_markdown, ai_parsed_at')
      .eq('id', partnerId)
      .single()

    if (fetchErr || !partner) {
      return new Response(
        JSON.stringify({ success: false, error: 'Partner not found' }),
        { status: 404, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    if (!partner.raw_profile_html && !partner.raw_profile_markdown) {
      return new Response(
        JSON.stringify({ success: false, error: 'No raw profile data saved. Re-download the partner first.' }),
        { status: 400, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    if (partner.ai_parsed_at && !forceReparse) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: 'Already AI-parsed. Use forceReparse=true to re-run.' }),
        { headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    // Use markdown if available (cleaner), otherwise truncated HTML
    const profileContent = partner.raw_profile_markdown || partner.raw_profile_html || ''
    // Truncate to ~15k chars for AI context window efficiency
    const truncated = profileContent.substring(0, 15000)

    const prompt = `Analizza questa pagina profilo di un membro WCA (World Cargo Alliance) e estrai TUTTI i dati strutturati.

REGOLE IMPORTANTI:
- Estrai TUTTI i contatti della sezione "Office Contacts", non solo i primi
- Per ogni contatto, estrai: nome completo, titolo/ruolo, email, telefono diretto, mobile
- Se un campo ha più valori separati da virgola/punto e virgola, mettili tutti
- I "Pricing Department" sono contatti validi, estraili come gli altri
- Estrai indirizzo completo, telefono sede, fax, email sede, emergency phone
- Estrai il profilo/descrizione aziendale completo
- Estrai TUTTE le certificazioni menzionate (IATA, ISO, BASC, C-TPAT, AEO, etc.)
- Estrai TUTTE le reti/network WCA di appartenenza con date scadenza
- Identifica se l'azienda è Gold Medallion e quali uffici sono coperti
- Estrai la data "Member Since" / "Proudly Enrolled Since"
- Identifica branch offices con le rispettive città

PAGINA PROFILO:
${truncated}`

    console.log(`AI parsing profile for partner ${partnerId} (${partner.company_name})...`)

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Sei un esperto di parsing dati logistici. Rispondi sempre con JSON strutturato tramite tool call.' },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_wca_profile',
            description: 'Extract all structured data from a WCA member profile page',
            parameters: {
              type: 'object',
              properties: {
                company_name: { type: 'string' },
                city: { type: 'string' },
                country: { type: 'string' },
                country_code: { type: 'string', description: '2-letter ISO code' },
                address: { type: 'string' },
                phone: { type: 'string', description: 'Main office phone' },
                fax: { type: 'string' },
                email: { type: 'string', description: 'Main office email (first valid one)' },
                website: { type: 'string' },
                emergency_phone: { type: 'string' },
                mobile: { type: 'string' },
                profile_description: { type: 'string', description: 'Full company profile/description text' },
                member_since: { type: 'string', description: 'Date string like "Aug 28, 2015"' },
                gold_medallion: { type: 'boolean' },
                office_type: { type: 'string', enum: ['head_office', 'branch'] },
                networks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      expires: { type: 'string' },
                    },
                    required: ['name'],
                  },
                },
                certifications: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Only from: IATA, BASC, ISO, C-TPAT, AEO',
                },
                contacts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Full name e.g. Mr. Azam Durrani' },
                      title: { type: 'string', description: 'Role/title e.g. Country Manager' },
                      email: { type: 'string' },
                      phone: { type: 'string', description: 'Direct line phone' },
                      mobile: { type: 'string' },
                    },
                    required: ['name', 'title'],
                  },
                  description: 'ALL office contacts including Pricing Departments',
                },
                branch_offices: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      city: { type: 'string' },
                      country: { type: 'string' },
                    },
                    required: ['city'],
                  },
                },
              },
              required: ['company_name', 'contacts'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_wca_profile' } },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI error:', response.status, errText)
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, try again later' }),
          { status: 429, headers: { ...dynCors, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ success: false, error: `AI error: ${response.status}` }),
        { status: 500, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    const aiData = await response.json()
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0]

    if (!toolCall?.function?.arguments) {
      console.error('No tool call in AI response:', JSON.stringify(aiData))
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned no data' }),
        { status: 500, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    const extracted = JSON.parse(toolCall.function.arguments)
    console.log(`AI extracted for ${partner.company_name}: ${extracted.contacts?.length || 0} contacts`)

    // Update partner with AI-extracted data (only fill gaps, don't overwrite existing good data)
    const updates: Record<string, any> = { ai_parsed_at: new Date().toISOString() }

    // Fill missing fields from AI extraction
    const { data: current } = await supabase
      .from('partners')
      .select('email, phone, fax, mobile, emergency_phone, website, address, profile_description, member_since')
      .eq('id', partnerId)
      .single()

    if (current) {
      if (!current.email && extracted.email) updates.email = extracted.email
      if (!current.phone && extracted.phone) updates.phone = extracted.phone
      if (!current.fax && extracted.fax) updates.fax = extracted.fax
      if (!current.mobile && extracted.mobile) updates.mobile = extracted.mobile
      if (!current.emergency_phone && extracted.emergency_phone) updates.emergency_phone = extracted.emergency_phone
      if (!current.website && extracted.website) updates.website = extracted.website
      if (!current.address && extracted.address) updates.address = extracted.address
      if (!current.member_since && extracted.member_since) {
        const parsed = parseDateString(extracted.member_since)
        if (parsed) updates.member_since = parsed
      }
    }

    await supabase.from('partners').update(updates).eq('id', partnerId)

    // Upsert contacts from AI - merge with existing, add missing ones
    if (extracted.contacts?.length > 0) {
      const { data: existingContacts } = await supabase
        .from('partner_contacts')
        .select('id, title, name, email, direct_phone, mobile')
        .eq('partner_id', partnerId)

      const existingByName = new Map<string, any>()
      for (const c of (existingContacts || [])) {
        existingByName.set((c.name || '').toLowerCase(), c)
        existingByName.set((c.title || '').toLowerCase(), c)
      }

      for (const aiContact of extracted.contacts) {
        const nameKey = (aiContact.name || '').toLowerCase()
        const titleKey = (aiContact.title || '').toLowerCase()
        const existing = existingByName.get(nameKey) || existingByName.get(titleKey)

        if (existing) {
          // Update missing fields
          const contactUpdates: Record<string, any> = {}
          if (aiContact.email && !existing.email) contactUpdates.email = aiContact.email
          if (aiContact.phone && !existing.direct_phone) contactUpdates.direct_phone = aiContact.phone
          if (aiContact.mobile && !existing.mobile) contactUpdates.mobile = aiContact.mobile
          if (aiContact.name && existing.name === existing.title) contactUpdates.name = aiContact.name

          if (Object.keys(contactUpdates).length > 0) {
            await supabase.from('partner_contacts').update(contactUpdates).eq('id', existing.id)
          }
        } else {
          // Insert new contact
          await supabase.from('partner_contacts').insert({
            partner_id: partnerId,
            name: aiContact.name || aiContact.title,
            title: aiContact.title,
            email: aiContact.email || null,
            direct_phone: aiContact.phone || null,
            mobile: aiContact.mobile || null,
          })
        }
      }
    }

    // Upsert networks from AI
    if (extracted.networks?.length > 0) {
      const { data: existingNets } = await supabase
        .from('partner_networks')
        .select('network_name')
        .eq('partner_id', partnerId)
      const existingNetSet = new Set((existingNets || []).map((n: Record<string, unknown>) => n.network_name))

      const newNets = extracted.networks
        .filter((n: Record<string, unknown>) => n.name && !existingNetSet.has(n.name))
        .map((n: Record<string, unknown>) => ({
          partner_id: partnerId,
          network_name: n.name,
          expires: n.expires ? parseDateString(n.expires) : null,
        }))

      if (newNets.length > 0) {
        await supabase.from('partner_networks').insert(newNets)
      }
    }

    // Upsert certifications from AI
    if (extracted.certifications?.length > 0) {
      const validCerts = ['IATA', 'BASC', 'ISO', 'C-TPAT', 'AEO']
      const { data: existingCerts } = await supabase
        .from('partner_certifications')
        .select('certification')
        .eq('partner_id', partnerId)
      const existingCertSet = new Set((existingCerts || []).map((c: Record<string, unknown>) => c.certification))

      const newCerts = extracted.certifications
        .filter((c: string) => validCerts.includes(c) && !existingCertSet.has(c))
        .map((c: string) => ({ partner_id: partnerId, certification: c }))

      if (newCerts.length > 0) {
        await supabase.from('partner_certifications').insert(newCerts)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        partnerId,
        extracted,
        contactsFound: extracted.contacts?.length || 0,
      }),
      { headers: { ...dynCors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...dynCors, 'Content-Type': 'application/json' } }
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
