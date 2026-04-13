import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

const VALID_SERVICES = [
  'air_freight', 'ocean_fcl', 'ocean_lcl', 'road_freight', 'rail_freight',
  'project_cargo', 'dangerous_goods', 'perishables', 'pharma',
  'ecommerce', 'relocations', 'customs_broker', 'warehousing', 'nvocc'
]

const VALID_PARTNER_TYPES = [
  'freight_forwarder', 'customs_broker', 'carrier', 'nvocc', '3pl', 'courier'
]

// ── Credit helpers ──
async function getUserId(req: Request, supabase: Record<string, unknown>): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth) return null
  const token = auth.replace('Bearer ', '')
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id || null
}

async function isByok(userId: string, supabase: Record<string, unknown>): Promise<boolean> {
  const { data } = await supabase
    .from('user_api_keys')
    .select('api_key')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle()
  return !!data?.api_key
}

async function consumeCredits(userId: string, usage: { prompt_tokens: number; completion_tokens: number }, supabase: Record<string, unknown>) {
  const inputCost = Math.ceil(usage.prompt_tokens / 1000 * 1)
  const outputCost = Math.ceil(usage.completion_tokens / 1000 * 2)
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
    description: `analyze-partner: ${usage.prompt_tokens} in + ${usage.completion_tokens} out`,
  })
  console.log(`Credits consumed: ${total} (balance: ${credits.balance - total})`)
}

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

    // ── Auth & BYOK check ──
    const userId = await getUserId(req, supabase)
    const byok = userId ? await isByok(userId, supabase) : false

    // ── Pre-check credits ──
    if (userId && !byok) {
      const { data: credits } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single()
      if (!credits || credits.balance < 5) {
        return new Response(
          JSON.stringify({ success: false, error: 'Crediti insufficienti. Acquista crediti extra o aggiungi le tue chiavi API.' }),
          { status: 402, headers: { ...dynCors, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { partnerId, profileData } = await req.json()

    if (!partnerId || !profileData) {
      return new Response(
        JSON.stringify({ success: false, error: 'partnerId and profileData required' }),
        { status: 400, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    const memberYears = profileData.member_since 
      ? Math.floor((Date.now() - new Date(profileData.member_since).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 0
    const branchCount = profileData.branch_offices?.length || 0
    const certCount = profileData.certifications?.length || 0
    const networkCount = profileData.networks?.length || 0
    const hasContacts = (profileData.contacts?.length || 0) > 0

    const prompt = `You are a logistics industry expert. Analyze this freight forwarding company profile and provide:

1. A concise summary (2-3 sentences, in Italian) of what this company does, their strengths, and specialties.
2. Classify their services from this EXACT list (return only matching codes):
   ${VALID_SERVICES.join(', ')}
3. Classify their partner type from this EXACT list (return only ONE):
   ${VALID_PARTNER_TYPES.join(', ')}
4. Rate this partner from 1.0 to 5.0 (with 0.5 increments) based on these criteria:
   - RELIABILITY (affidabilità): years in WCA (${memberYears} years), certifications (${certCount}: ${(profileData.certifications || []).join(', ')}), Gold Medallion: ${profileData.gold_medallion || false}
   - COMPLETENESS (completezza profilo): how detailed is their profile description, do they have contacts listed (${hasContacts}), email/phone/website provided
   - SENIORITY (anzianità WCA): member since ${profileData.member_since || 'unknown'}. >20y=excellent, >10y=good, >5y=fair, <5y=new
   - NETWORK SIZE (dimensione): ${branchCount} branch offices, networks: ${networkCount}
   - INFRASTRUCTURE: do they mention warehousing, own fleet/vehicles, CFS facilities in their profile?
   - SPECIALTIES: how many distinct service areas they cover
   
   Provide a rating breakdown with a score (1-5) for each of these 6 criteria, plus an overall weighted average.

Company: ${profileData.company_name}
City: ${profileData.city}, ${profileData.country_name}
Profile: ${profileData.profile_description || 'No description available'}
Certifications: ${(profileData.certifications || []).join(', ') || 'None'}
Networks: ${(profileData.networks || []).map((n: Record<string, unknown>) => n.name).join(', ') || 'None'}
Branch offices: ${branchCount}
Gold Medallion: ${profileData.gold_medallion || false}

IMPORTANT: Only use service codes from the exact list above. Be conservative - only assign services clearly indicated by the profile.`

    console.log('Calling AI gateway for partner analysis...')
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a logistics classification expert. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'classify_partner',
            description: 'Classify a logistics partner with summary, services, type, and rating',
            parameters: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: 'Concise summary in Italian (2-3 sentences)' },
                services: {
                  type: 'array',
                  items: { type: 'string', enum: VALID_SERVICES },
                  description: 'List of service categories',
                },
                partner_type: {
                  type: 'string',
                  enum: VALID_PARTNER_TYPES,
                  description: 'Primary partner type',
                },
                rating: { type: 'number', description: 'Overall rating 1.0-5.0 in 0.5 increments' },
                rating_details: {
                  type: 'object',
                  properties: {
                    reliability: { type: 'number', description: 'Affidabilità score 1-5' },
                    completeness: { type: 'number', description: 'Completezza profilo score 1-5' },
                    seniority: { type: 'number', description: 'Anzianità WCA score 1-5' },
                    network_size: { type: 'number', description: 'Dimensione network score 1-5' },
                    infrastructure: { type: 'number', description: 'Infrastruttura score 1-5' },
                    specialties: { type: 'number', description: 'Specializzazioni score 1-5' },
                  },
                  required: ['reliability', 'completeness', 'seniority', 'network_size', 'infrastructure', 'specialties'],
                },
              },
              required: ['summary', 'services', 'partner_type', 'rating', 'rating_details'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'classify_partner' } },
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

    // ── Consume credits ──
    if (userId && !byok && aiData.usage) {
      await consumeCredits(userId, {
        prompt_tokens: aiData.usage.prompt_tokens || 0,
        completion_tokens: aiData.usage.completion_tokens || 0,
      }, supabase)
    }

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0]
    
    if (!toolCall?.function?.arguments) {
      console.error('No tool call in response:', JSON.stringify(aiData))
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned no classification' }),
        { status: 500, headers: { ...dynCors, 'Content-Type': 'application/json' } }
      )
    }

    const classification = JSON.parse(toolCall.function.arguments)
    console.log(`Classification for ${partnerId}:`, JSON.stringify(classification))

    // Update partner with summary, type, and rating
    await supabase
      .from('partners')
      .update({
        profile_description: classification.summary + '\n\n---\n\n' + (profileData.profile_description || ''),
        partner_type: classification.partner_type,
        rating: classification.rating || null,
        rating_details: classification.rating_details || null,
      })
      .eq('id', partnerId)

    // Save services
    if (classification.services?.length > 0) {
      await supabase.from('partner_services').delete().eq('partner_id', partnerId)
      
      const validServices = classification.services.filter((s: string) => VALID_SERVICES.includes(s))
      if (validServices.length > 0) {
        await supabase.from('partner_services').insert(
          validServices.map((s: string) => ({
            partner_id: partnerId,
            service_category: s,
          }))
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        classification,
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
